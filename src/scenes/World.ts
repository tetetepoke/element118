import Phaser from 'phaser';
import { ZOOM, TILE } from '../config';
import { buildWorld, MAP_W, MAP_H, EntityDef } from '../data/worldMap';
import { T, FIRST_SOLID } from '../assets/placeholders';
import { Player, PERFECT_GUARD_MS } from '../entities/Player';
import { Breakling } from '../entities/Enemy';
import { game, bus, EV, input, ui } from '../core/state';
import { SCRIPT } from '../data/script';
import { sfx } from '../core/audio';
import { facingVector, spriteRowFor } from '../core/facing';

interface Interactable {
  id: string;
  x: number;
  y: number;
  r: number;
  verb: string;
  enabled: () => boolean;
  run: () => void;
}

interface Barrier {
  id: string;
  sprites: Phaser.GameObjects.Sprite[];
  body: Phaser.GameObjects.Zone;
  x: number;
  y: number;
  w: number;
}

interface Crystal {
  id: string;
  element: string;
  sprite: Phaser.GameObjects.Sprite;
  respawn: boolean;
  available: boolean;
}

const tileCenter = (t: number) => t * TILE + TILE / 2;

export class World extends Phaser.Scene {
  player!: Player;
  private enemies: Breakling[] = [];
  private npcs = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private interactables: Interactable[] = [];
  private crystals: Crystal[] = [];
  private barriers = new Map<string, Barrier>();
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private solidLayer!: Phaser.Tilemaps.TilemapLayer;
  private trail: { x: number; y: number }[] = [];
  private followers: { id: string; sprite: Phaser.Physics.Arcade.Sprite }[] = [];
  private shots: Phaser.Physics.Arcade.Sprite[] = [];
  busy = false; // a scripted sequence is running
  private gateguard?: Phaser.Physics.Arcade.Sprite;
  private devices = new Map<string, Phaser.GameObjects.Sprite>();
  private torchSprite?: Phaser.GameObjects.Sprite;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastTime = 0;
  private fresh = false;

  constructor() {
    super('World');
  }

  init(data: { fresh?: boolean }) {
    this.fresh = !!data?.fresh;
    this.enemies = [];
    this.npcs.clear();
    this.interactables = [];
    this.crystals = [];
    this.barriers.clear();
    this.trail = [];
    this.followers = [];
    this.shots = [];
    this.devices.clear();
    this.busy = false;
  }

  create() {
    const wm = buildWorld();
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: MAP_W, height: MAP_H });
    const ts = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.groundLayer = map.createBlankLayer('ground', ts)!;
    this.groundLayer.putTilesAt(wm.ground, 0, 0);
    this.solidLayer = map.createBlankLayer('solid', ts)!;
    this.solidLayer.putTilesAt(wm.solid, 0, 0);
    this.solidLayer.setCollisionBetween(FIRST_SOLID, 63);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    this.blockers = this.physics.add.staticGroup();
    this.particles = this.add.particles(0, 0, 'px_spark', { emitting: false, lifespan: 500, speed: { min: 20, max: 60 }, scale: { start: 1, end: 0 } });
    this.particles.setDepth(100000);

    const d = game.data;
    this.player = new Player(this, d.player.x, d.player.y);
    this.player.facing = d.player.facing;
    this.player.onSwing = (x, y, r, step) => this.onSwing(x, y, r, step);
    this.player.onDust = (x, y) => this.burst('px_dust', x, y, 3, 20, 300);

    // real building art (from the concept sheet) drawn over the solid footprint
    for (const b of wm.buildings) {
      if (!this.textures.exists(b.key)) continue;
      const img = this.add.image(b.x * TILE + (b.w * TILE) / 2, (b.y + b.h) * TILE + 2, b.key).setOrigin(0.5, 1);
      const scale = Math.min(((b.w + 1) * TILE) / img.width, ((b.h + 2.2) * TILE) / img.height);
      img.setScale(scale).setDepth((b.y + b.h) * TILE - 1);
      this.solidLayer.forEachTile((t) => t.setVisible(false), undefined, b.x, b.y, b.w, b.h);
    }
    for (const e of wm.entities) this.spawn(e);

    this.physics.add.collider(this.player, this.solidLayer);
    this.physics.add.collider(this.player, this.blockers);
    for (const en of this.enemies) {
      this.physics.add.collider(en, this.solidLayer);
      this.physics.add.collider(en, this.blockers);
      this.physics.add.overlap(this.player, en, () => this.onEnemyTouch(en));
    }
    for (const [, npc] of this.npcs) this.physics.add.collider(this.player, npc);

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.setRoundPixels(true);
    cam.fadeIn(500);

    // restore party followers
    for (const id of d.party) this.makeFollower(id);

    this.scene.launch('UI');
    this.scene.bringToTop('UI');

    bus.on('bond-made', this.onBondMade, this);
    bus.on('world-resume', this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('bond-made', this.onBondMade, this);
      bus.off('world-resume', this.onResume, this);
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
    document.addEventListener('visibilitychange', this.onVisibility);

    this.lastTime = this.time.now;
    if (this.fresh && !game.flag('intro_done')) this.time.delayedCall(50, () => this.runIntro());
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.autosave();
  };

  // ─────────────────────────────── spawning ───────────────────────────────
  private spawn(e: EntityDef) {
    const x = tileCenter(e.x), y = tileCenter(e.y);
    switch (e.type) {
      case 'npc': {
        const key = String(e.props?.sprite ?? 'villager');
        const s = this.physics.add.sprite(x, y, key, 0).setOrigin(0.5, 0.85);
        s.play(`${key}_idle`);
        s.setImmovable(true);
        (s.body as Phaser.Physics.Arcade.Body).setSize(12, 8).setOffset(10, 20);
        s.setDepth(y);
        this.npcs.set(e.id, s);
        if ((e.id === 'hyde' || e.id === 'oxy') && game.hasParty(e.id)) {
          s.disableBody(true, true);
        }
        this.interactables.push({
          id: e.id, x, y, r: 26, verb: 'はなす',
          enabled: () => s.visible && s.body!.enable,
          run: () => this.talkTo(e.id),
        });
        if (e.props?.wander) {
          this.time.addEvent({
            delay: 2200, loop: true, callback: () => {
              if (this.busy || ui.locked) return;
              const dx = (Math.random() - 0.5) * 24;
              this.tweens.add({ targets: s, x: Phaser.Math.Clamp(s.x + dx, x - 30, x + 30), duration: 800, onUpdate: () => (s.body as Phaser.Physics.Arcade.Body).updateFromGameObject() });
              s.setFlipX(dx < 0);
            },
          });
        }
        break;
      }
      case 'enemy': {
        if (game.flag(`defeated_${e.id}`)) break;
        const en = new Breakling(this, x, y, e.id);
        this.enemies.push(en);
        break;
      }
      case 'crystal': {
        const el = String(e.props?.element);
        const s = this.add.sprite(x, y, `crystal_${el}`, 0).setOrigin(0.5, 0.8).setDepth(y);
        const respawn = !!e.props?.respawn;
        const taken = !respawn && game.flag(`picked_${e.id}`);
        const c: Crystal = { id: e.id, element: el, sprite: s, respawn, available: !taken };
        if (taken) s.setFrame(2);
        else s.play(`crystal_${el}_shine`);
        this.tweens.add({ targets: s, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.crystals.push(c);
        break;
      }
      case 'device': {
        const s = this.add.sprite(x, (e.y + 1) * TILE, 'device', game.flag('device_active') ? 1 : 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.devices.set(e.id, s);
        this.addBlocker(x, (e.y + 1) * TILE - 6, 26, 12);
        const upper = !!e.props?.upper;
        this.interactables.push({
          id: e.id, x, y: y + 10, r: 26, verb: upper ? 'おりる' : 'しらべる',
          enabled: () => true,
          run: () => this.useDevice(upper),
        });
        break;
      }
      case 'torch': {
        const s = this.add.sprite(x, (e.y + 1) * TILE, 'torch', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.torchSprite = s;
        if (game.flag('bramble_burned')) s.play('torch_lit');
        this.addBlocker(x, y + 4, 10, 8);
        this.interactables.push({ id: e.id, x, y, r: 24, verb: 'しらべる', enabled: () => !game.flag('bramble_burned'), run: () => this.useTorch() });
        break;
      }
      case 'bramble':
      case 'fire':
      case 'fog': {
        const flagDone = e.type === 'bramble' ? 'bramble_burned' : e.type === 'fire' ? 'fire_out' : 'fog_cleared';
        if (game.flag(flagDone)) break;
        const w = e.w ?? 1;
        const sprites: Phaser.GameObjects.Sprite[] = [];
        for (let i = 0; i < w; i++) {
          const sx = tileCenter(e.x + i);
          let s: Phaser.GameObjects.Sprite;
          if (e.type === 'bramble') s = this.add.sprite(sx, y, 'bramble', i % 2).setDepth(y);
          else if (e.type === 'fire') s = this.add.sprite(sx, (e.y + 1) * TILE, 'flame', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE).play({ key: 'flame_burn', startFrame: i % 4 });
          else s = this.add.sprite(sx, y, 'fog', 0).setDepth(y + 8).setScale(1.3).play({ key: 'fog_drift', startFrame: i % 4 });
          sprites.push(s);
        }
        const zone = this.add.zone(e.x * TILE + (w * TILE) / 2, y, w * TILE, TILE);
        this.physics.add.existing(zone, true);
        this.blockers.add(zone);
        this.barriers.set(e.id, { id: e.id, sprites, body: zone, x: e.x * TILE + (w * TILE) / 2, y, w });
        if (e.type === 'fire') {
          this.interactables.push({ id: e.id, x: e.x * TILE + (w * TILE) / 2, y: y + 14, r: 40, verb: 'しらべる', enabled: () => !game.flag('fire_out'), run: () => this.say(game.knows('substances', 'h2o') ? 'fire_touch' : 'fire_first') });
        }
        break;
      }
      case 'savestone': {
        const s = this.add.sprite(x, (e.y + 1) * TILE, 'savestone', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE).play('savestone_glow');
        this.addBlocker(x, y + 4, 12, 8);
        this.interactables.push({ id: e.id, x, y, r: 24, verb: 'しらべる', enabled: () => true, run: () => this.useSaveStone(x, y + 16) });
        void s;
        break;
      }
      case 'sign': {
        this.add.sprite(x, y, 'sign', 0).setDepth(y);
        this.addBlocker(x, y + 4, 12, 6);
        const key = String(e.props?.text);
        this.interactables.push({ id: e.id, x, y, r: 22, verb: 'よむ', enabled: () => true, run: () => this.say(key) });
        break;
      }
      case 'goal': {
        const s = this.add.sprite(x, y, 'goal', 0).setDepth(y).play('goal_bob');
        this.tweens.add({ targets: s, y: y - 4, duration: 700, yoyo: true, repeat: -1 });
        const zone = this.add.zone(x, y + 8, 40, 24);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => this.reachGoal());
        break;
      }
      case 'gateguard': {
        const gx = e.x * TILE + ((e.w ?? 1) * TILE) / 2;
        const s = this.physics.add.sprite(gx, y, 'villager', 0).setOrigin(0.5, 0.85).setImmovable(true).play('villager_idle');
        (s.body as Phaser.Physics.Arcade.Body).setSize(44, 10).setOffset(-6, 18);
        s.setDepth(y);
        this.gateguard = s;
        this.npcs.set('gateguard', s);
        if (game.flag('got_codex')) this.openGate(false);
        this.interactables.push({ id: 'gateguard', x: gx, y, r: 30, verb: 'はなす', enabled: () => true, run: () => this.say(game.flag('got_codex') ? 'gate_open' : 'gate_closed') });
        break;
      }
      default:
        break;
    }
  }

  private addBlocker(x: number, y: number, w: number, h: number) {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.blockers.add(z);
    return z;
  }

  // ─────────────────────────────── main loop ───────────────────────────────
  update(time: number) {
    const dt = time - this.lastTime;
    this.lastTime = time;
    if (!ui.locked && !this.busy) game.data.playTimeSec += dt / 1000;
    const locked = ui.locked || this.busy;

    // interaction target (in front of the player)
    const v = facingVector(this.player.facing);
    const fx = this.player.x + v.x * 12, fy = this.player.y - 4 + v.y * 12;
    let target: Interactable | null = null;
    let best = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const dd = Math.hypot(it.x - fx, it.y - fy);
      if (dd < it.r && dd < best) {
        best = dd;
        target = it;
      }
    }
    ui.aLabel = target ? target.verb : '攻撃';

    if (!locked && input.attack && target && this.player.st === 'normal') {
      input.attack = false;
      target.run();
    }
    if (!locked && input.bond) {
      input.bond = false;
      this.openBond();
    }
    if (!locked && input.element) {
      input.element = false;
      this.useElementAbility();
    }
    if (!locked && input.menu) {
      input.menu = false;
      this.openOverlay('Menu');
    }
    if (!locked && input.codex) {
      input.codex = false;
      if (game.flag('got_codex')) this.openOverlay('Codex');
    }

    this.player.update(time, locked);
    this.player.setDepth(this.player.y);

    for (const en of this.enemies) en.update(time, this.player.x, this.player.y);
    this.updateFollowers();
    this.checkCrystals();
    this.checkTriggers();
    this.updateShots(time);
  }

  // ─────────────────────────────── combat ───────────────────────────────
  private swingId = 0;
  private onSwing(x: number, y: number, r: number, step: number) {
    this.swingId++;
    const v = facingVector(this.player.facing);
    const fx = this.add.sprite(this.player.x + v.x * 10, this.player.y - 8 + v.y * 10, 'slash', 0).setDepth(this.player.y + 1);
    fx.setRotation(Math.atan2(v.y, v.x));
    if (step === 3) fx.setScale(1.3);
    fx.play('slash_fx');
    fx.once('animationcomplete', () => fx.destroy());
    const now = this.time.now;
    for (const en of this.enemies) {
      if (en.dead || en.lastSwingHit === this.swingId) continue;
      if (Math.hypot(en.x - x, en.y - 6 - y) < r + 8) {
        en.lastSwingHit = this.swingId;
        const killed = en.takeHit(this.player.x, this.player.y, now, step === 3 ? 2 : 1);
        sfx('hit');
        this.cameras.main.shake(60, 0.002);
        this.burst('px_purple', en.x, en.y - 8, 4, 50, 350);
        if (killed) this.killEnemy(en);
      }
    }
    // cut tall grass
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let ddx = -1; ddx <= 1; ddx++) for (let ddy = -1; ddy <= 1; ddy++) {
      const t = this.groundLayer.getTileAt(tx + ddx, ty + ddy);
      if (t && t.index === T.TALL && Math.hypot(t.getCenterX() - x, t.getCenterY() - y) < r + 6) {
        this.groundLayer.putTileAt(T.GRASS, t.x, t.y);
        this.burst('px_leaf', t.getCenterX(), t.getCenterY(), 6, 50, 500);
        if (game.data.player.hp < game.data.player.maxHp && Math.random() < 0.18) this.dropHeart(t.getCenterX(), t.getCenterY());
      }
    }
  }

  private killEnemy(en: Breakling) {
    en.dead = true;
    (en.body as Phaser.Physics.Arcade.Body).enable = false;
    game.setFlag(`defeated_${en.id}`);
    game.data.stats.enemiesDefeated++;
    sfx('defeat');
    this.burst('px_purple', en.x, en.y - 8, 14, 90, 600);
    this.tweens.add({ targets: en, alpha: 0, scale: 1.6, duration: 250, onComplete: () => en.destroy() });
    if (Math.random() < 0.35) this.dropHeart(en.x, en.y);
    if (['b1', 'b2', 'b3'].includes(en.id) && ['b1', 'b2', 'b3'].every((id) => game.flag(`defeated_${id}`)) && !game.flag('fog_cleared')) {
      this.time.delayedCall(500, () => this.clearFog());
    }
  }

  private dropHeart(x: number, y: number) {
    const h = this.physics.add.sprite(x, y, 'heart_pickup').setDepth(y);
    this.tweens.add({ targets: h, y: y - 6, duration: 400, yoyo: true, repeat: -1 });
    this.physics.add.overlap(this.player, h, () => {
      h.destroy();
      const p = game.data.player;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      sfx('pickup');
      bus.emit(EV.HP);
    });
    this.time.delayedCall(12000, () => h.active && h.destroy());
  }

  private onEnemyTouch(en: Breakling) {
    const now = this.time.now;
    if (!en.dangerous || ui.locked || this.busy) return;
    if (now < this.player.invulnUntil) return;
    if (this.player.guarding && this.player.facesToward(en.x, en.y)) {
      if (now - input.guardPressedAt < PERFECT_GUARD_MS) {
        en.stun(this.player.x, this.player.y, now);
        sfx('perfect');
        bus.emit(EV.TOAST, 'ジャストガード！');
        this.burst('px_spark', (en.x + this.player.x) / 2, (en.y + this.player.y) / 2 - 8, 10, 80, 400);
      } else {
        en.takeHit(this.player.x, this.player.y, now, 0);
        en.hp += 0;
        sfx('block');
        this.burst('px_spark', (en.x + this.player.x) / 2, (en.y + this.player.y) / 2 - 8, 4, 40, 250);
      }
      this.player.invulnUntil = now + 250;
      return;
    }
    const p = game.data.player;
    p.hp -= 1;
    sfx('hurt');
    this.cameras.main.shake(120, 0.004);
    this.player.hurt(en.x, en.y, now);
    bus.emit(EV.HP);
    if (p.hp <= 0) this.gameOver();
  }

  private async gameOver() {
    this.busy = true;
    this.player.lock(true);
    this.cameras.main.fadeOut(600, 40, 0, 0);
    await this.wait(700);
    await this.sayAsync('game_over');
    const d = game.data;
    d.player.hp = d.player.maxHp;
    this.player.setPosition(d.checkpoint.x, d.checkpoint.y);
    this.trail = [];
    bus.emit(EV.HP);
    this.cameras.main.fadeIn(500);
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  // ─────────────────────────────── items & world ───────────────────────────────
  private checkCrystals() {
    for (const c of this.crystals) {
      if (!c.available) continue;
      if (Math.hypot(c.sprite.x - this.player.x, c.sprite.y - this.player.y) > 13) continue;
      if (!game.addAtom(c.element)) {
        if (!c.sprite.getData('fullWarned')) {
          c.sprite.setData('fullWarned', true);
          bus.emit(EV.TOAST, `${c.element}はこれ以上持てない（最大9）`);
          this.time.delayedCall(3000, () => c.sprite.setData('fullWarned', false));
        }
        continue;
      }
      c.available = false;
      sfx('pickup');
      this.burst('px_spark', c.sprite.x, c.sprite.y - 6, 8, 60, 400);
      c.sprite.anims.stop();
      c.sprite.setFrame(2);
      bus.emit(EV.TOAST, `${c.element} のかけらを拾った`);
      if (c.respawn) {
        this.time.delayedCall(9000, () => {
          c.available = true;
          c.sprite.play(`crystal_${c.element}_shine`);
          this.burst('px_spark', c.sprite.x, c.sprite.y - 6, 4, 30, 300);
        });
      } else game.setFlag(`picked_${c.id}`);
      this.discoverElement(c.element);
    }
  }

  private checkTriggers() {
    if (this.busy || ui.locked) return;
    const px = this.player.x, py = this.player.y;
    const near = (id: string, r: number) => {
      const n = this.npcs.get(id);
      return n && n.visible && Math.hypot(n.x - px, n.y - py) < r;
    };
    if (!game.flag('met_hyde') && near('hyde', 44)) void this.meetHyde();
    else if (!game.flag('met_oxy') && near('oxy', 44)) void this.meetOxy();
    else if (!game.flag('fire_seen') && !game.flag('fire_out')) {
      const f = this.barriers.get('fire1');
      if (f && Math.hypot(f.x - px, f.y - py) < 64) {
        game.setFlag('fire_seen');
        if (!game.knows('substances', 'h2o')) this.say('fire_first');
      }
    }
  }

  private discoverElement(sym: string) {
    if (game.discover('elements', sym)) {
      bus.emit(EV.DISCOVER_ELEMENT, sym);
      this.autosave();
    }
  }

  // ─────────────────────────────── dialogue helpers ───────────────────────────────
  say(key: string, onDone?: () => void) {
    const lines = SCRIPT[key];
    if (!lines) return onDone?.();
    bus.emit(EV.SAY, lines, onDone);
  }
  sayAsync(key: string): Promise<void> {
    return new Promise((res) => this.say(key, res));
  }
  wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  private async runIntro() {
    this.busy = true;
    this.player.lock(true);
    bus.emit(EV.UI_MODE, 'black');
    await this.wait(300);
    await this.sayAsync('intro_narration');
    bus.emit(EV.UI_MODE, 'normal');
    this.cameras.main.fadeIn(800);
    this.player.facing = 2;
    await this.wait(600);
    await this.sayAsync('intro_wake');
    game.setFlag('intro_done');
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  private async talkTo(id: string) {
    if (id === 'elder') {
      if (!game.flag('got_codex')) {
        this.busy = true;
        await this.sayAsync('elder_first');
        game.setFlag('got_codex');
        sfx('discover');
        await this.sayAsync('got_codex');
        this.discoverElement('C');
        await this.wait(1600);
        await this.sayAsync('elder_after_codex');
        this.openGate(true);
        this.busy = false;
        this.autosave();
      } else this.say(game.flag('fire_out') ? 'elder_late' : 'elder_repeat');
    } else if (id === 'villager') this.say(game.flag('fire_out') ? 'villager_late' : 'villager');
    else if (id === 'hyde') this.say('hyde_talk');
    else if (id === 'oxy') this.say('oxy_talk');
  }

  private openGate(animate: boolean) {
    const g = this.gateguard;
    if (!g) return;
    (g.body as Phaser.Physics.Arcade.Body).enable = false;
    if (animate) this.tweens.add({ targets: g, x: g.x + 44, duration: 900 });
    else g.x += 44;
  }

  private async meetHyde() {
    this.busy = true;
    game.setFlag('met_hyde');
    this.facePlayerTo('hyde');
    await this.sayAsync('hyde_meet');
    this.joinParty('hyde');
    await this.sayAsync('hyde_join');
    this.busy = false;
    this.autosave();
  }

  private async meetOxy() {
    this.busy = true;
    game.setFlag('met_oxy');
    this.facePlayerTo('oxy');
    await this.sayAsync('oxy_meet');
    this.joinParty('oxy');
    await this.sayAsync('oxy_join');
    this.busy = false;
    this.autosave();
  }

  private facePlayerTo(id: string) {
    const n = this.npcs.get(id);
    if (!n) return;
    this.player.setVelocity(0, 0);
  }

  private joinParty(id: string) {
    game.joinParty(id);
    const n = this.npcs.get(id);
    if (n) {
      (n.body as Phaser.Physics.Arcade.Body).enable = false;
      n.setVisible(false);
    }
    this.makeFollower(id);
    sfx('discover');
  }

  private makeFollower(id: string) {
    if (this.followers.some((f) => f.id === id)) return;
    const s = this.physics.add.sprite(this.player.x, this.player.y, id, 0).setOrigin(0.5, 0.85);
    (s.body as Phaser.Physics.Arcade.Body).enable = false;
    s.play(`${id}_idle`);
    this.followers.push({ id, sprite: s });
  }

  private updateFollowers() {
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.player.x, last.y - this.player.y) > 2) {
      this.trail.unshift({ x: this.player.x, y: this.player.y });
      if (this.trail.length > 80) this.trail.pop();
    }
    this.followers.forEach((f, i) => {
      const idx = Math.min(this.trail.length - 1, (i + 1) * 12);
      const p = this.trail[idx] ?? { x: this.player.x, y: this.player.y + 10 };
      const pv = (this.player.body as Phaser.Physics.Arcade.Body).velocity;
      const moving = Math.hypot(p.x - f.sprite.x, p.y - f.sprite.y) > 0.5 || Math.hypot(pv.x, pv.y) > 8;
      // same facing as Carbon
      const [row, flip] = spriteRowFor(this.player.facing, 4);
      f.sprite.setFlipX(flip);
      f.sprite.x += (p.x - f.sprite.x) * 0.25;
      f.sprite.y += (p.y - f.sprite.y) * 0.25;
      f.sprite.setDepth(f.sprite.y);
      const key = moving ? `${f.id}_walk_${row}` : `${f.id}_idle_${row}`;
      if (f.sprite.anims.currentAnim?.key !== key) f.sprite.play(key);
    });
  }

  // ─────────────────────────────── puzzles ───────────────────────────────
  private async useDevice(upper: boolean) {
    if (!game.flag('device_active')) {
      if (game.count('h2') > 0) {
        this.busy = true;
        this.player.lock(true);
        game.useSubstance('h2');
        await this.sayAsync('device_fill');
        game.setFlag('device_active');
        this.devices.forEach((s) => s.setFrame(1));
        sfx('rise');
        const low = this.devices.get('device_low')!;
        this.burst('px_spark', low.x, low.y - 30, 16, 70, 700);
        await this.ride(true);
        if (game.hasParty('hyde')) await this.sayAsync('device_after');
        this.setCheckpoint(tileCenter(24), tileCenter(35));
        this.player.lock(false);
        this.busy = false;
        this.autosave();
      } else if (game.hasParty('hyde')) this.say('device_hint');
      else this.say('device_empty');
      return;
    }
    this.busy = true;
    this.player.lock(true);
    sfx('rise');
    await this.ride(!upper);
    this.player.lock(false);
    this.busy = false;
  }

  /** Ride the (fictional) buoyancy platform between the two docks. */
  private async ride(up: boolean) {
    const from = this.devices.get(up ? 'device_low' : 'device_high')!;
    const to = this.devices.get(up ? 'device_high' : 'device_low')!;
    const platform = this.add.sprite(from.x, from.y, 'device', 1).setOrigin(0.5, 1).setDepth(from.y + 50);
    from.setVisible(false);
    this.player.setPosition(from.x, from.y - 30);
    this.player.setDepth(from.y + 60);
    this.followers.forEach((f) => f.sprite.setVisible(false));
    const dy = to.y - from.y;
    await new Promise<void>((res) =>
      this.tweens.add({
        targets: [platform],
        y: platform.y + dy,
        duration: 1800,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.player.setPosition(platform.x, platform.y - 30);
          this.player.setDepth(platform.depth + 10);
          if (Math.random() < 0.3) this.burst('px_steam', platform.x + (Math.random() - 0.5) * 20, platform.y, 1, 20, 500);
        },
        onComplete: () => res(),
      }),
    );
    platform.destroy();
    from.setVisible(true);
    this.player.setPosition(to.x, to.y + 14);
    this.trail = [];
    this.followers.forEach((f) => {
      f.sprite.setPosition(this.player.x, this.player.y + 4);
      f.sprite.setVisible(true);
    });
  }

  private async useTorch() {
    if (game.count('o2') > 0) {
      this.busy = true;
      this.player.lock(true);
      game.useSubstance('o2');
      await this.sayAsync('torch_fill');
      sfx('fire');
      this.torchSprite?.play('torch_lit');
      const b = this.barriers.get('bramble1');
      if (b) {
        this.cameras.main.pan(b.x, b.y, 500, 'Sine.easeInOut');
        for (let i = 0; i < b.sprites.length; i++) {
          const s = b.sprites[i];
          await this.wait(220);
          const f = this.add.sprite(s.x, s.y + 8, 'flame', 0).setOrigin(0.5, 1).setDepth(s.depth + 1).play('flame_burn');
          sfx('fire');
          this.tweens.add({ targets: s, alpha: 0, duration: 700 });
          this.tweens.add({ targets: f, alpha: 0, scaleY: 0.2, delay: 600, duration: 500, onComplete: () => f.destroy() });
          this.burst('px_fire', s.x, s.y, 6, 50, 600);
        }
        await this.wait(900);
        this.removeBarrier('bramble1');
        this.cameras.main.pan(this.player.x, this.player.y, 400, 'Sine.easeInOut');
        await this.wait(450);
        this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
      }
      game.setFlag('bramble_burned');
      if (game.discover('reactions', 'combustion')) {
        game.discover('bondKinds', 'reaction');
        bus.emit(EV.DISCOVER_REACTION, 'combustion');
        await this.wait(1800);
      }
      if (game.hasParty('oxy')) await this.sayAsync('torch_after');
      this.setCheckpoint(tileCenter(24), tileCenter(17));
      this.player.lock(false);
      this.busy = false;
      this.autosave();
    } else if (game.hasParty('oxy')) this.say('torch_hint');
    else this.say('torch_dim');
  }

  private removeBarrier(id: string) {
    const b = this.barriers.get(id);
    if (!b) return;
    b.sprites.forEach((s) => s.destroy());
    this.blockers.remove(b.body, true, true);
    this.barriers.delete(id);
  }

  private async clearFog() {
    const b = this.barriers.get('fog1');
    game.setFlag('fog_cleared');
    if (b) {
      this.tweens.add({ targets: b.sprites, alpha: 0, duration: 1200 });
      this.burst('px_purple', b.x, b.y, 20, 60, 900);
      await this.wait(1200);
      this.removeBarrier('fog1');
    }
    this.say('fog_cleared');
    this.setCheckpoint(tileCenter(24), tileCenter(64));
    this.autosave();
  }

  private useElementAbility() {
    const eq = game.data.equipped;
    if (!eq) return this.say('no_ability');
    if (eq === 'h2o') {
      if (game.count('h2o') <= 0) return this.say('no_water');
      game.useSubstance('h2o');
      this.shootWater();
    }
  }

  private shootWater() {
    const v = facingVector(this.player.facing);
    const s = this.physics.add.sprite(this.player.x + v.x * 10, this.player.y - 8 + v.y * 10, 'water_shot').setDepth(this.player.y + 2);
    s.setVelocity(v.x * 210, v.y * 210);
    s.setData('until', this.time.now + 650);
    this.shots.push(s);
    sfx('water');
    this.player.playBondPose();
  }

  private updateShots(now: number) {
    for (const s of this.shots.slice()) {
      if (Math.random() < 0.6) this.burst('px_water', s.x, s.y, 1, 15, 250);
      let done = now > (s.getData('until') as number);
      const fire = this.barriers.get('fire1');
      if (fire && Math.abs(s.x - fire.x) < (fire.w * TILE) / 2 + 4 && Math.abs(s.y - (fire.y - 4)) < 18) {
        done = true;
        void this.extinguish();
      }
      for (const en of this.enemies) {
        if (!en.dead && Math.hypot(en.x - s.x, en.y - 8 - s.y) < 14) {
          done = true;
          if (en.takeHit(s.x, s.y, now, 1)) this.killEnemy(en);
          sfx('hit');
        }
      }
      if (this.solidLayer.getTileAtWorldXY(s.x, s.y + 4)?.collides) done = true;
      if (done) {
        this.burst('px_water', s.x, s.y, 8, 60, 400);
        s.destroy();
        this.shots.splice(this.shots.indexOf(s), 1);
      }
    }
  }

  private async extinguish() {
    if (game.flag('fire_out') || this.busy) return;
    const b = this.barriers.get('fire1');
    if (!b) return;
    this.busy = true;
    this.player.lock(true);
    game.setFlag('fire_out');
    sfx('steam');
    for (const s of b.sprites) {
      this.tweens.add({ targets: s, scaleY: 0, alpha: 0, duration: 900, ease: 'Quad.easeIn' });
      for (let i = 0; i < 4; i++) this.time.delayedCall(i * 150, () => this.burst('px_steam', s.x + (Math.random() - 0.5) * 10, s.y - 10, 2, 30, 1200, -40));
    }
    await this.wait(1300);
    this.removeBarrier('fire1');
    await this.sayAsync('fire_out');
    this.setCheckpoint(tileCenter(24), tileCenter(13));
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  private async reachGoal() {
    if (game.flag('stage1_clear') || this.busy || ui.locked) return;
    this.busy = true;
    this.player.lock(true);
    game.setFlag('stage1_clear');
    await this.sayAsync('goal');
    this.autosave();
    this.scene.pause();
    bus.emit(EV.UI_MODE, 'hidden');
    this.scene.launch('StageClear');
    this.scene.bringToTop('StageClear');
  }

  private useSaveStone(x: number, y: number) {
    const p = game.data.player;
    p.hp = p.maxHp;
    bus.emit(EV.HP);
    this.setCheckpoint(x, y);
    sfx('save');
    this.burst('px_spark', x, y - 24, 10, 50, 600);
    this.autosave();
    this.say('save_stone');
  }

  private setCheckpoint(x: number, y: number) {
    game.data.checkpoint = { x, y };
  }

  autosave() {
    const d = game.data;
    d.player.x = Math.round(this.player.x);
    d.player.y = Math.round(this.player.y);
    d.player.facing = this.player.facing;
    game.save();
  }

  // ─────────────────────────────── panels ───────────────────────────────
  private openBond() {
    if (!game.flag('got_codex')) {
      bus.emit(EV.TOAST, '村長に会ってみよう');
      return;
    }
    this.openOverlay('BondPanel');
  }

  private openOverlay(key: string) {
    this.player.setVelocity(0, 0);
    input.moveX = input.moveY = 0;
    input.guard = false;
    this.scene.pause();
    bus.emit(EV.UI_MODE, 'hidden');
    this.scene.launch(key);
    this.scene.bringToTop(key);
  }

  private onResume = () => {
    bus.emit(EV.UI_MODE, 'normal');
    this.scene.resume();
    this.lastTime = this.time.now;
  };

  private onBondMade = (id: string) => {
    if (id === 'h2o' && !game.flag('water_talked')) {
      game.setFlag('water_talked');
      this.time.delayedCall(300, async () => {
        this.busy = true;
        if (game.hasParty('hyde') || game.hasParty('oxy')) await this.sayAsync('water_after');
        this.busy = false;
        this.autosave();
      });
    } else this.autosave();
  };

  // ─────────────────────────────── fx ───────────────────────────────
  burst(tex: string, x: number, y: number, n: number, speed: number, life: number, gravityY = 0) {
    const em = this.add.particles(x, y, tex, {
      speed: { min: speed * 0.3, max: speed },
      lifespan: life,
      quantity: n,
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY,
      emitting: false,
    });
    em.setDepth(y + 200);
    em.explode(n);
    this.time.delayedCall(life + 100, () => em.destroy());
  }
}
