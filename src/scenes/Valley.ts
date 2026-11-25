// Stage 2: 珪晶の谷. A separate scene so stage 1 (World) stays untouched.
// Core idea of this stage: BOND makes Carbon strong (SiC FORM) — but some places only open with BREAK.
import Phaser from 'phaser';
import { ZOOM, TILE } from '../config';
import { buildValley, VMAP_W, VMAP_H, VEntity, VP } from '../data/valleyMap';
import { T2, FIRST_SOLID2 } from '../assets/stage2Placeholders';
import { Player, PERFECT_GUARD_MS } from '../entities/Player';
import { Breakling } from '../entities/Enemy';
import { game, bus, EV, input, ui } from '../core/state';
import { SCRIPT } from '../data/script';
import { SCRIPT2 } from '../data/script2';
import { sfx } from '../core/audio';
import { facingVector, spriteRowFor } from '../core/facing';

type Mode = 'together' | 'sic' | 'split';

interface Interactable { id: string; x: number; y: number; r: number; verb: string; enabled: () => boolean; run: () => void }
interface Barrier { id: string; sprites: Phaser.GameObjects.Sprite[]; zone: Phaser.GameObjects.Zone; x: number; y: number; w: number; h: number }
interface Plate { id: string; group: string; x: number; y: number; sprite: Phaser.GameObjects.Sprite }

const tc = (t: number) => t * TILE + TILE / 2;

export class Valley extends Phaser.Scene {
  player!: Player; // Carbon (always the "main" body)
  partner: Player | null = null; // Silica while split
  controlled!: Player;
  mode: Mode = 'together';
  busy = false;
  private enemies: Breakling[] = [];
  private npcs = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private interactables: Interactable[] = [];
  private barriers = new Map<string, Barrier>();
  private plates: Plate[] = [];
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private sicBlockers!: Phaser.Physics.Arcade.StaticGroup;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private solidLayer!: Phaser.Tilemaps.TilemapLayer;
  private trail: { x: number; y: number }[] = [];
  private followers: { id: string; sprite: Phaser.Physics.Arcade.Sprite }[] = [];
  private shards: Phaser.Physics.Arcade.Sprite[] = [];
  private lastSafe = new Map<Player, { x: number; y: number }>();
  private heatCooldown = 0;
  private lastTime = 0;
  private fresh = false;
  private triggersDone = new Set<string>();
  private triggers: VEntity[] = [];
  private lastClank = 0;
  // boss
  private boss?: Phaser.Physics.Arcade.Sprite;
  private bossZone?: Phaser.GameObjects.Zone;
  private bossPhase: 'sleep' | 'p1' | 'p2' | 'p3' | 'down' = 'sleep';
  private shellHp = 6;
  private coreHp = 4;
  private nextVolley = 0;
  private consoles = new Map<string, Phaser.GameObjects.Sprite>();
  private hotRing: { x: number; y: number; t: number }[] = [];

  constructor() {
    super('Valley');
  }

  init(data: { fresh?: boolean }) {
    this.fresh = !!data?.fresh;
    this.enemies = [];
    this.npcs.clear();
    this.interactables = [];
    this.barriers.clear();
    this.plates = [];
    this.trail = [];
    this.followers = [];
    this.shards = [];
    this.lastSafe.clear();
    this.triggersDone.clear();
    this.triggers = [];
    this.consoles.clear();
    this.hotRing = [];
    this.partner = null;
    this.busy = false;
    this.boss = undefined;
    this.bossPhase = 'sleep';
    this.shellHp = 6;
    this.coreHp = 4;
  }

  create() {
    const vm = buildValley();
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: VMAP_W, height: VMAP_H });
    const ts = map.addTilesetImage('tiles2', 'tiles2', TILE, TILE, 0, 0)!;
    this.groundLayer = map.createBlankLayer('ground', ts)!;
    this.groundLayer.putTilesAt(vm.ground, 0, 0);
    this.solidLayer = map.createBlankLayer('solid', ts)!;
    this.solidLayer.putTilesAt(vm.solid, 0, 0);
    this.solidLayer.setCollisionBetween(FIRST_SOLID2, 31);
    this.physics.world.setBounds(0, 0, VMAP_W * TILE, VMAP_H * TILE);
    this.blockers = this.physics.add.staticGroup();
    this.sicBlockers = this.physics.add.staticGroup();

    const d = game.data;
    this.player = new Player(this, d.player.x, d.player.y);
    this.player.facing = d.player.facing;
    this.player.setForm(d.form === 'sic' ? 'sic' : 'normal');
    this.player.onSwing = (x, y, r, step) => this.onSwing(this.player, x, y, r, step);
    this.player.onDust = (x, y) => this.burst('px_dust', x, y, 3, 20, 300);
    this.controlled = this.player;
    this.mode = d.form === 'sic' ? 'sic' : game.flag('s2_split') ? 'split' : 'together';

    for (const e of vm.entities) this.spawn(e);

    this.physics.add.collider(this.player, this.solidLayer);
    this.physics.add.collider(this.player, this.blockers);
    this.physics.add.collider(this.player, this.sicBlockers, undefined, () => this.player.form === 'sic');
    for (const en of this.enemies) {
      this.physics.add.collider(en, this.solidLayer);
      this.physics.add.collider(en, this.blockers);
    }
    for (const [, npc] of this.npcs) this.physics.add.collider(this.player, npc);

    if (this.mode === 'split') this.makePartner(this.player.x + 14, this.player.y);

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, VMAP_W * TILE, VMAP_H * TILE);
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.setRoundPixels(true);
    cam.fadeIn(500);
    this.refreshFollowers();

    this.scene.launch('UI');
    this.scene.bringToTop('UI');
    bus.on('world-resume', this.onResume, this);
    bus.on('bond-made', this.onBondMade, this);
    bus.on('form-made', this.onFormMade, this);
    bus.on('party-changed', this.refreshFollowers, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('world-resume', this.onResume, this);
      bus.off('bond-made', this.onBondMade, this);
      bus.off('form-made', this.onFormMade, this);
      bus.off('party-changed', this.refreshFollowers, this);
      document.removeEventListener('visibilitychange', this.onVisibility);
      ui.formLabel = '';
      ui.swapVisible = false;
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.lastTime = this.time.now;
    if (!game.flag('s2_intro')) this.time.delayedCall(50, () => this.runIntro());
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.autosave();
  };

  // ─────────────────────────────── spawning ───────────────────────────────
  private spawn(e: VEntity) {
    const x = tc(e.x), y = tc(e.y);
    switch (e.type) {
      case 'npc': {
        if (e.id === 'silica' && game.flag('s2_silica_with')) break;
        const key = String(e.props?.sprite ?? 'villager');
        const tex = this.textures.exists(key) ? key : 'villager';
        const s = this.physics.add.sprite(x, y, tex, 0).setOrigin(0.5, 0.85).setImmovable(true);
        if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
        if (key === 'silica' && !this.textures.exists('silica')) s.setTint(0xd8d0ff);
        (s.body as Phaser.Physics.Arcade.Body).setSize(12, 8).setOffset(10, 20);
        s.setDepth(y);
        this.npcs.set(e.id, s);
        this.interactables.push({ id: e.id, x, y, r: 26, verb: 'はなす', enabled: () => s.visible && !!s.body?.enable, run: () => this.talkTo(e.id) });
        break;
      }
      case 'enemy': {
        if (game.flag(`defeated_${e.id}`)) break;
        const kind = String(e.props?.kind ?? 'cslime');
        const en = new Breakling(this, x, y, e.id, kind);
        if (kind === 'cslime') en.hp = 2;
        if (kind === 'golem') { en.hp = 5; en.speedMul = 0.7; }
        if (kind === 'beetle') { en.hp = 2; en.armored = true; }
        if (kind === 'drill') { en.hp = 3; en.speedMul = 1.4; }
        this.enemies.push(en);
        break;
      }
      case 'monument': {
        this.add.sprite(x, (e.y + 1) * TILE, 'monument', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.addBlocker(x, y + 4, 12, 8);
        this.interactables.push({ id: e.id, x, y, r: 24, verb: 'しらべる', enabled: () => true, run: () => this.useMonument(x, y + 16) });
        break;
      }
      case 'hardrock': {
        if (game.flag(`broken_${e.id}`)) break;
        const w = e.w ?? 1;
        const sprites: Phaser.GameObjects.Sprite[] = [];
        for (let i = 0; i < w; i++) sprites.push(this.add.sprite(tc(e.x + i), y, 'hardrock', 0).setDepth(y));
        const zone = this.add.zone(e.x * TILE + (w * TILE) / 2, y, w * TILE, TILE);
        this.physics.add.existing(zone, true);
        this.blockers.add(zone);
        this.barriers.set(e.id, { id: e.id, sprites, zone, x: e.x * TILE + (w * TILE) / 2, y, w, h: 1 });
        break;
      }
      case 'crevice': {
        const h = e.h ?? 1, w = e.w ?? 1;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.add.sprite(tc(e.x + i), tc(e.y + j), 'crevice').setDepth(1);
        const zone = this.add.zone(e.x * TILE + (w * TILE) / 2, e.y * TILE + (h * TILE) / 2, w * TILE, h * TILE);
        this.physics.add.existing(zone, true);
        this.sicBlockers.add(zone);
        break;
      }
      case 'plate': {
        const s = this.add.sprite(x, y, 'plate', 0).setDepth(2);
        this.plates.push({ id: e.id, group: String(e.props?.group), x, y, sprite: s });
        if (game.flag(`gate_${e.props?.group}`)) s.setFrame(1);
        break;
      }
      case 'gate': {
        const w = e.w ?? 1;
        const open = game.flag(`gate_${e.id}`);
        const sprites: Phaser.GameObjects.Sprite[] = [];
        for (let i = 0; i < w; i++) sprites.push(this.add.sprite(tc(e.x + i), y, 'gate', open ? 1 : 0).setDepth(y));
        const zone = this.add.zone(e.x * TILE + (w * TILE) / 2, y, w * TILE, TILE);
        this.physics.add.existing(zone, true);
        if (!open) this.blockers.add(zone);
        this.barriers.set(e.id, { id: e.id, sprites, zone, x: e.x * TILE + (w * TILE) / 2, y, w, h: 1 });
        break;
      }
      case 'terminal': {
        this.add.sprite(x, (e.y + 1) * TILE, 'terminal', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.addBlocker(x, y + 4, 12, 8);
        this.interactables.push({ id: e.id, x, y, r: 24, verb: 'しらべる', enabled: () => true, run: () => this.readTerminal() });
        break;
      }
      case 'unknown': {
        const s = this.add.sprite(x, (e.y + 1) * TILE, 'unknown_device', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.addBlocker(x, y + 2, 22, 10);
        this.interactables.push({ id: e.id, x, y, r: 26, verb: 'しらべる', enabled: () => true, run: () => this.checkUnknown(e, s) });
        break;
      }
      case 'deco': {
        this.add.sprite(x, (e.y + 1) * TILE, 'crystal_deco', 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE);
        this.addBlocker(x, y + 4, 10, 8);
        break;
      }
      case 'trigger':
        this.triggers.push(e);
        break;
      case 'boss': {
        const down = game.flag('s2_boss_down');
        const s = this.physics.add.sprite(x, y + 30, 'boss_cb', down ? 3 : 0).setOrigin(0.5, 1).setDepth(y + 30).setImmovable(true);
        (s.body as Phaser.Physics.Arcade.Body).setSize(60, 26).setOffset(18, 62);
        this.boss = s;
        this.bossPhase = down ? 'down' : 'sleep';
        this.physics.add.collider(this.player, s);
        break;
      }
      case 'console': {
        const s = this.add.sprite(x, (e.y + 1) * TILE, 'console', game.flag('s2_boss_down') ? 1 : 0).setOrigin(0.5, 1).setDepth((e.y + 1) * TILE).setAlpha(0.6);
        this.consoles.set(e.id, s);
        break;
      }
      case 'exit': {
        const zone = this.add.zone(x + ((e.w ?? 1) - 1) * TILE / 2, y, (e.w ?? 1) * TILE, TILE);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => this.reachExit());
        if (!game.flag('s2_boss_down')) this.blockers.add(this.addBlocker(x + 8, y + 12, 32, 8));
        break;
      }
    }
  }

  private addBlocker(x: number, y: number, w: number, h: number) {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.blockers.add(z);
    return z;
  }

  // ─────────────────────────────── partner (Silica after BREAK) ───────────────────────────────
  private makePartner(x: number, y: number) {
    const p = new Player(this, x, y, 'silica');
    if (!this.textures.exists('silica')) p.setTint(0xd8d0ff);
    p.facing = this.player.facing;
    p.onSwing = (sx, sy, r, step) => this.onSwing(p, sx, sy, r, step);
    p.onDust = (dx, dy) => this.burst('px_dust', dx, dy, 3, 20, 300);
    this.physics.add.collider(p, this.solidLayer);
    this.physics.add.collider(p, this.blockers);
    for (const [, npc] of this.npcs) this.physics.add.collider(p, npc);
    if (this.boss) this.physics.add.collider(p, this.boss);
    this.partner = p;
    (p.body as Phaser.Physics.Arcade.Body).enable = false;
    return p;
  }

  private setControl(who: Player) {
    if (this.controlled === who) return;
    const prev = this.controlled;
    prev.setVelocity(0, 0);
    (prev.body as Phaser.Physics.Arcade.Body).enable = prev === this.player; // Carbon keeps his body (blocks); Silica follows freely
    this.controlled = who;
    (who.body as Phaser.Physics.Arcade.Body).enable = true;
    this.cameras.main.startFollow(who, true, 0.14, 0.14);
    this.trail = [];
    sfx('ui');
  }

  // ─────────────────────────────── main loop ───────────────────────────────
  update(time: number) {
    const dt = time - this.lastTime;
    this.lastTime = time;
    if (!ui.locked && !this.busy) game.data.playTimeSec += dt / 1000;
    const locked = ui.locked || this.busy;
    const me = this.controlled;

    // UI state for the FORM / 交代 buttons
    ui.formLabel = !game.flag('s2_sic_found') ? '' : this.mode === 'sic' ? 'BREAK' : 'C＋Si';
    ui.swapVisible = this.mode === 'split';

    const v = facingVector(me.facing);
    const fx = me.x + v.x * 12, fy = me.y - 4 + v.y * 12;
    let target: Interactable | null = null;
    let best = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const dd = Math.hypot(it.x - fx, it.y - fy);
      if (dd < it.r && dd < best) { best = dd; target = it; }
    }
    ui.aLabel = target ? target.verb : this.mode === 'sic' ? 'HARD BREAK' : '攻撃';

    if (!locked && input.attack && target && me.st === 'normal') { input.attack = false; target.run(); }
    if (!locked && input.bond) { input.bond = false; this.openBond(); }
    if (!locked && input.form) { input.form = false; this.toggleForm(); }
    if (!locked && input.swap) { input.swap = false; this.swap(); }
    if (!locked && input.element) { input.element = false; this.say('no_ability'); }
    if (!locked && input.menu) { input.menu = false; this.openOverlay('Menu'); }
    if (!locked && input.codex) { input.codex = false; this.openOverlay('Codex'); }

    me.update(time, locked);
    me.setDepth(me.y);
    if (this.partner) {
      const other = me === this.player ? this.partner : this.player;
      this.moveIdle(other, me);
    }
    for (const en of this.enemies) en.update(time, me.x, me.y);
    this.checkEnemyContacts(time);
    this.updateMask();
    this.updateFollowers();
    this.checkHeat(time);
    this.checkPlates();
    this.checkTriggers();
    this.updateBoss(time);
    this.updateShards(time);
  }

  /** The character you are not controlling: waits on a switch/console, otherwise follows. */
  private moveIdle(p: Player, leader: Player) {
    const now = this.time.now;
    p.setVelocity(0, 0);
    p.setAlpha(now < p.invulnUntil ? (Math.floor(now / 70) % 2 ? 0.45 : 1) : 1);
    p.setDepth(p.y);
    if (this.isOnSwitch(p)) {
      p.anim('idle');
      return;
    }
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - leader.x, last.y - leader.y) > 2) {
      this.trail.unshift({ x: leader.x, y: leader.y });
      if (this.trail.length > 60) this.trail.pop();
    }
    const tgt = this.trail[Math.min(this.trail.length - 1, 10)] ?? { x: leader.x, y: leader.y };
    const dist = Math.hypot(tgt.x - p.x, tgt.y - p.y);
    if (dist > 1) {
      p.x += (tgt.x - p.x) * 0.22;
      p.y += (tgt.y - p.y) * 0.22;
      p.facing = leader.facing;
    }
    const lv = (leader.body as Phaser.Physics.Arcade.Body).velocity;
    p.anim(dist > 1.5 || Math.hypot(lv.x, lv.y) > 8 ? 'walk' : 'idle');
    if (p.body && !(p.body as Phaser.Physics.Arcade.Body).enable) (p.body as Phaser.Physics.Arcade.Body).reset(p.x, p.y);
  }

  private isOnSwitch(p: Player) {
    if (this.plates.some((pl) => Math.hypot(pl.x - p.x, pl.y - (p.y - 2)) < 9)) return true;
    for (const [, c] of this.consoles) if (this.bossPhase === 'p3' && Math.hypot(c.x - p.x, c.y + 6 - p.y) < 14) return true;
    return false;
  }

  // ─────────────────────────────── FORM: BOND / BREAK ───────────────────────────────
  private toggleForm() {
    if (!game.flag('s2_sic_found')) return;
    if (this.mode === 'sic') return void this.doBreak();
    if (this.mode === 'split' && this.partner) {
      if (Math.hypot(this.partner.x - this.player.x, this.partner.y - this.player.y) > 40) return this.say('s2_need_together');
      return void this.doBond();
    }
    if (this.mode === 'together') return void this.doBond();
  }

  private async doBond() {
    this.busy = true;
    const at = this.controlled;
    const x = at.x, y = at.y;
    sfx('snap');
    this.burst('px_spark', x, y - 10, 18, 80, 500);
    this.cameras.main.flash(180, 200, 220, 255);
    if (this.partner) {
      this.partner.destroy();
      this.partner = null;
    }
    this.controlled = this.player;
    this.player.setPosition(x, y);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.mode = 'sic';
    this.player.setForm('sic');
    game.data.form = 'sic';
    game.setFlag('s2_split', false);
    bus.emit(EV.TOAST, 'BOND！ SiC FORM');
    this.refreshFollowers();
    await this.wait(250);
    this.busy = false;
    this.autosave();
  }

  private async doBreak() {
    // Silica appears next to Carbon. Find a free spot.
    const spots = [[14, 0], [-14, 0], [0, 12], [0, -12]];
    let sx = this.player.x, sy = this.player.y;
    for (const [dx, dy] of spots) {
      const t = this.solidLayer.getTileAtWorldXY(this.player.x + dx, this.player.y + dy);
      if (!t || !t.collides) { sx = this.player.x + dx; sy = this.player.y + dy; break; }
    }
    this.busy = true;
    sfx('snap');
    this.burst('px_spark', this.player.x, this.player.y - 10, 14, 70, 450);
    this.mode = 'split';
    this.player.setForm('normal');
    game.data.form = 'normal';
    game.setFlag('s2_split');
    const p = this.makePartner(this.player.x, this.player.y);
    this.tweens.add({ targets: p, x: sx, y: sy, duration: 220 });
    bus.emit(EV.TOAST, 'BREAK！ C ＋ Si');
    this.refreshFollowers();
    await this.wait(260);
    this.busy = false;
    if (!game.flag('s2_first_break')) {
      game.setFlag('s2_first_break');
      await this.sayAsync('s2_after_break_first');
    }
    this.autosave();
  }

  private swap() {
    if (this.mode !== 'split' || !this.partner) return;
    this.setControl(this.controlled === this.player ? this.partner : this.player);
  }

  // ─────────────────────────────── combat ───────────────────────────────
  private swingId = 0;
  private onSwing(actor: Player, x: number, y: number, r: number, step: number) {
    this.swingId++;
    const v = facingVector(actor.facing);
    const hard = actor === this.player && this.mode === 'sic';
    const fxs = this.add.sprite(actor.x + v.x * 10, actor.y - 8 + v.y * 10, 'slash', 0).setDepth(actor.y + 1);
    fxs.setRotation(Math.atan2(v.y, v.x));
    if (hard) fxs.setTint(0xbfd8ff).setScale(1.4);
    fxs.play('slash_fx');
    fxs.once('animationcomplete', () => fxs.destroy());
    const now = this.time.now;
    for (const en of this.enemies) {
      if (en.dead || en.lastSwingHit === this.swingId) continue;
      if (Math.hypot(en.x - x, en.y - 6 - y) < r + 8) {
        en.lastSwingHit = this.swingId;
        if (en.armored && !hard) {
          en.takeHit(actor.x, actor.y, now, 0);
          sfx('block');
          if (now - this.lastClank > 2500) { this.lastClank = now; bus.emit(EV.TOAST, 'カキン！ HARD BREAK なら効きそうだ'); }
          continue;
        }
        const dmg = (step === 3 ? 2 : 1) + (hard ? 1 : 0);
        const killed = en.takeHit(actor.x, actor.y, now, dmg);
        sfx('hit');
        this.cameras.main.shake(60, hard ? 0.004 : 0.002);
        this.burst('px_purple', en.x, en.y - 8, 4, 50, 350);
        if (killed) this.killEnemy(en);
      }
    }
    // hard rocks
    for (const [id, b] of this.barriers) {
      if (!this.textures.exists('hardrock') || b.sprites[0]?.texture.key !== 'hardrock') continue;
      const inX = Math.abs(x - b.x) < (b.w * TILE) / 2 + r, inY = Math.abs(y - b.y) < TILE / 2 + r;
      if (!inX || !inY) continue;
      if (hard) void this.breakRock(id);
      else if (now - this.lastClank > 1200) {
        this.lastClank = now;
        sfx('block');
        this.burst('px_spark', x, y, 4, 40, 250);
        this.say('s2_rockwall_hit');
      }
    }
    // boss
    if (this.boss && (this.bossPhase === 'p1' || this.bossPhase === 'p2')) this.hitBoss(actor, x, y, r, hard);
  }

  private async breakRock(id: string) {
    const b = this.barriers.get(id);
    if (!b || this.busy) return;
    this.barriers.delete(id);
    this.busy = true;
    sfx('hit');
    this.cameras.main.shake(260, 0.008);
    b.sprites.forEach((s) => s.setFrame(1));
    await this.wait(220);
    b.sprites.forEach((s, i) => {
      this.burst('px_dust', s.x, s.y, 5, 70, 500);
      this.tweens.add({ targets: s, alpha: 0, y: s.y + 4, duration: 300, delay: i * 12, onComplete: () => s.destroy() });
    });
    this.blockers.remove(b.zone, true, true);
    game.setFlag(`broken_${id}`);
    await this.wait(400);
    this.busy = false;
    if (id === 'rockwall') await this.sayAsync('s2_rockwall_break');
    this.setCheckpoint(this.player.x, this.player.y);
    this.autosave();
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
  }

  private dropHeart(x: number, y: number) {
    const h = this.physics.add.sprite(x, y, 'heart_pickup').setDepth(y);
    this.tweens.add({ targets: h, y: y - 6, duration: 400, yoyo: true, repeat: -1 });
    const take = () => {
      if (!h.active) return;
      h.destroy();
      const p = game.data.player;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      sfx('pickup');
      bus.emit(EV.HP);
    };
    this.physics.add.overlap(this.player, h, take);
    this.time.delayedCall(12000, () => h.active && h.destroy());
  }

  private checkEnemyContacts(now: number) {
    if (ui.locked || this.busy) return;
    const bodies = this.partner ? [this.player, this.partner] : [this.player];
    for (const en of this.enemies) {
      if (!en.dangerous) continue;
      for (const p of bodies) {
        if (Math.hypot(en.x - p.x, en.y - p.y) > 13) continue;
        this.damage(p, en.x, en.y, now, en);
      }
    }
    if (this.boss && (this.bossPhase === 'p1' || this.bossPhase === 'p2')) {
      for (const p of bodies) if (Math.abs(p.x - this.boss.x) < 34 && p.y < this.boss.y + 4 && p.y > this.boss.y - 30) this.damage(p, this.boss.x, this.boss.y - 20, now);
    }
  }

  private damage(p: Player, fromX: number, fromY: number, now: number, en?: Breakling) {
    if (now < p.invulnUntil) return;
    if (p === this.controlled && p.guarding && p.facesToward(fromX, fromY)) {
      if (en && now - input.guardPressedAt < PERFECT_GUARD_MS) {
        en.stun(p.x, p.y, now);
        sfx('perfect');
        bus.emit(EV.TOAST, 'ジャストガード！');
      } else sfx('block');
      p.invulnUntil = now + 250;
      return;
    }
    const d = game.data.player;
    d.hp -= this.mode === 'sic' ? 1 : 1;
    sfx('hurt');
    this.cameras.main.shake(120, 0.004);
    p.hurt(fromX, fromY, now);
    bus.emit(EV.HP);
    if (d.hp <= 0) void this.gameOver();
  }

  private async gameOver() {
    if (this.busy) return;
    this.busy = true;
    this.player.lock(true);
    this.cameras.main.fadeOut(600, 40, 0, 0);
    await this.wait(700);
    await this.sayAsync('s2_game_over');
    const d = game.data;
    d.player.hp = d.player.maxHp;
    this.player.setPosition(d.checkpoint.x, d.checkpoint.y);
    if (this.partner) {
      this.partner.setPosition(d.checkpoint.x + 14, d.checkpoint.y);
      this.setControl(this.player);
    }
    this.shards.forEach((s) => s.destroy());
    this.shards = [];
    this.trail = [];
    bus.emit(EV.HP);
    this.cameras.main.fadeIn(500);
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  // ─────────────────────────────── world rules ───────────────────────────────
  /** HEAT RESIST: only SiC FORM can stand on hot ground (game rule — see the codex). */
  private checkHeat(now: number) {
    if (this.busy || ui.locked) return;
    const bodies = this.partner ? [this.player, this.partner] : [this.player];
    for (const p of bodies) {
      const t = this.groundLayer.getTileAtWorldXY(p.x, p.y - 2);
      const hot = t?.index === T2.HOT;
      const safeForm = p === this.player && this.mode === 'sic';
      if (!hot || safeForm) {
        if (!hot) this.lastSafe.set(p, { x: p.x, y: p.y });
        if (hot && safeForm && !game.flag('s2_heat_ok')) {
          game.setFlag('s2_heat_ok');
          this.time.delayedCall(400, () => this.say('s2_heat_ok'));
        }
        continue;
      }
      if (now < this.heatCooldown) continue;
      this.heatCooldown = now + 700;
      const safe = this.lastSafe.get(p) ?? { x: p.x, y: p.y + 20 };
      this.burst('px_fire', p.x, p.y - 6, 6, 50, 400);
      game.data.player.hp -= 1;
      sfx('hurt');
      bus.emit(EV.HP);
      p.setPosition(safe.x, safe.y);
      p.setVelocity(0, 0);
      p.invulnUntil = now + 600;
      if (!game.flag('s2_heat_told')) {
        game.setFlag('s2_heat_told');
        this.say(game.flag('s2_sic_found') ? 's2_hot_damage' : 's2_heat_first');
      } else bus.emit(EV.TOAST, 'あつい！');
      if (game.data.player.hp <= 0) void this.gameOver();
    }
  }

  private checkPlates() {
    const bodies = this.partner ? [this.player, this.partner] : [this.player];
    const groups = new Map<string, { total: number; down: number }>();
    for (const pl of this.plates) {
      const pressed = game.flag(`gate_${pl.group}`) || bodies.some((b) => Math.hypot(pl.x - b.x, pl.y - (b.y - 2)) < 9);
      pl.sprite.setFrame(pressed ? 1 : 0);
      const g = groups.get(pl.group) ?? { total: 0, down: 0 };
      g.total++;
      if (pressed) g.down++;
      groups.set(pl.group, g);
      if (pressed && this.mode === 'sic' && !game.flag(`gate_${pl.group}`) && !game.flag('s2_sic_switch_told')) {
        game.setFlag('s2_sic_switch_told');
        this.say('s2_sic_no_switch');
      }
    }
    for (const [group, g] of groups) {
      if (g.down === g.total && !game.flag(`gate_${group}`)) void this.openGate(group);
    }
  }

  private async openGate(id: string) {
    game.setFlag(`gate_${id}`);
    const b = this.barriers.get(id);
    sfx('rise');
    this.cameras.main.shake(200, 0.003);
    if (b) {
      b.sprites.forEach((s) => s.setFrame(1));
      this.blockers.remove(b.zone, true, true);
      this.barriers.delete(id);
    }
    this.say('s2_door_open');
    this.setCheckpoint(this.controlled.x, this.controlled.y);
    this.autosave();
  }

  private checkTriggers() {
    if (this.busy || ui.locked) return;
    const me = this.controlled;
    for (const t of this.triggers) {
      if (this.triggersDone.has(t.id) || game.flag(`trig_${t.id}`)) continue;
      const x0 = t.x * TILE, y0 = t.y * TILE, x1 = x0 + (t.w ?? 1) * TILE, y1 = y0 + (t.h ?? 1) * TILE;
      if (me.x < x0 - 4 || me.x > x1 + 4 || me.y < y0 - 4 || me.y > y1 + 8) continue;
      if (!this.runTrigger(t.id)) continue;
      this.triggersDone.add(t.id);
      game.setFlag(`trig_${t.id}`);
      return;
    }
    // Silica meeting
    if (!game.flag('s2_silica_with')) {
      const s = this.npcs.get('silica');
      if (s && Math.hypot(s.x - me.x, s.y - me.y) < 46) void this.meetSilica();
    }
  }

  /** Returns false to keep the trigger for later. */
  private runTrigger(id: string): boolean {
    switch (id) {
      case 'entrance_talk': return true;
      case 'rockwall_first':
        if (game.flag('broken_rockwall')) return true;
        this.say('s2_rockwall_first');
        return true;
      case 'east_hint': this.say('s2_east_hint'); return true;
      case 'heat_first': return true;
      case 'crevice_talk':
        if (this.mode !== 'sic') return false;
        this.say('s2_crevice_block');
        return true;
      case 'plates_hint': this.say('s2_plates_hint'); return true;
      case 'lower_hint': this.say('s2_lower_hint'); return true;
      case 'boss_intro':
        if (game.flag('s2_boss_down')) return true;
        void this.startBoss();
        return true;
    }
    return true;
  }

  private updateMask() {
    const p = this.player;
    if (this.mode === 'sic') return p.setMasked(false);
    const on = p.masked;
    const near = (x: number, y: number, r: number) => Math.hypot(x - p.x, y - p.y) < r;
    let want = false;
    for (const [id, n] of this.npcs) {
      if (!n.visible || id === 'silica') continue;
      if (near(n.x, n.y, on ? 64 : 44)) { want = true; break; }
    }
    if (!want) want = this.enemies.some((en) => !en.dead && en.active && near(en.x, en.y, on ? 92 : 68));
    if (!want && this.boss && this.bossPhase !== 'down' && this.bossPhase !== 'sleep') want = near(this.boss.x, this.boss.y, 160);
    p.setMasked(want);
  }

  // ─────────────────────────────── followers ───────────────────────────────
  /** Who walks behind: the active party, plus Silica while she travels with Carbon in normal form. */
  private refreshFollowers = () => {
    this.followers.forEach((f) => f.sprite.destroy());
    this.followers = [];
    const ids = game.data.activeParty.filter((id) => id !== 'silica');
    if (game.flag('s2_silica_with') && this.mode === 'together') ids.unshift('silica');
    for (const id of ids) {
      const tex = this.textures.exists(id) ? id : 'villager';
      const s = this.physics.add.sprite(this.player.x, this.player.y + 6, tex, 0).setOrigin(0.5, 0.85);
      if (id === 'silica' && !this.textures.exists('silica')) s.setTint(0xd8d0ff);
      (s.body as Phaser.Physics.Arcade.Body).enable = false;
      this.followers.push({ id, sprite: s });
    }
  };

  private ftrail: { x: number; y: number }[] = [];
  private updateFollowers() {
    const lead = this.controlled;
    const last = this.ftrail[0];
    if (!last || Math.hypot(last.x - lead.x, last.y - lead.y) > 2) {
      this.ftrail.unshift({ x: lead.x, y: lead.y });
      if (this.ftrail.length > 80) this.ftrail.pop();
    }
    const offset = this.partner ? 1 : 0;
    this.followers.forEach((f, i) => {
      const idx = Math.min(this.ftrail.length - 1, (i + 1 + offset) * 12);
      const p = this.ftrail[idx] ?? { x: lead.x, y: lead.y + 10 };
      const lv = (lead.body as Phaser.Physics.Arcade.Body).velocity;
      const moving = Math.hypot(p.x - f.sprite.x, p.y - f.sprite.y) > 0.5 || Math.hypot(lv.x, lv.y) > 8;
      const [row, flip] = spriteRowFor(lead.facing, 4);
      f.sprite.x += (p.x - f.sprite.x) * 0.25;
      f.sprite.y += (p.y - f.sprite.y) * 0.25;
      f.sprite.setDepth(f.sprite.y);
      let key = moving ? `${f.id}_walk_${row}` : `${f.id}_idle_${row}`;
      let flipX = flip;
      if (row === 'side' && flip && this.anims.exists(`${f.id}_${moving ? 'walk' : 'idle'}_side_left`)) { key = `${f.id}_${moving ? 'walk' : 'idle'}_side_left`; flipX = false; }
      f.sprite.setFlipX(flipX);
      if (this.anims.exists(key) && f.sprite.anims.currentAnim?.key !== key) f.sprite.play(key);
    });
  }

  // ─────────────────────────────── story ───────────────────────────────
  say(key: string, onDone?: () => void) {
    const lines = SCRIPT2[key] ?? SCRIPT[key];
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
    await this.sayAsync('s2_intro');
    bus.emit(EV.UI_MODE, 'normal');
    this.cameras.main.fadeIn(800);
    await this.wait(500);
    await this.sayAsync('s2_researcher');
    game.setFlag('s2_intro');
    this.setCheckpoint(this.player.x, this.player.y);
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  private talkTo(id: string) {
    if (id === 'researcher') this.say(game.flag('s2_sic_found') ? 's2_researcher_after' : 's2_researcher_repeat');
    else if (id === 'miner') this.say(game.flag('s2_boss_down') ? 's2_miner_after' : 's2_miner');
    else if (id === 'silica') void this.meetSilica();
  }

  private async meetSilica() {
    if (this.busy || game.flag('s2_silica_with')) return;
    this.busy = true;
    this.player.lock(true);
    await this.sayAsync('s2_silica_meet');
    bus.emit(EV.DISCOVER_ELEMENT, 'Si');
    game.discover('elements', 'Si');
    await this.wait(2400);
    await this.sayAsync('s2_silica_join');
    game.setFlag('s2_silica_with');
    if (!game.hasParty('silica')) game.data.party.push('silica');
    const others = game.data.activeParty.filter((id) => id !== 'silica');
    const n = this.npcs.get('silica');
    if (n) { n.disableBody(true, true); }
    if (others.length >= 2) {
      await this.sayAsync('s2_party_full');
      await this.choosePartyAsync(true);
    } else game.setActiveParty(['silica', ...others]);
    this.refreshFollowers();
    if (!game.flag('broken_rockwall')) await this.sayAsync('s2_silica_try');
    this.player.lock(false);
    this.busy = false;
    this.autosave();
  }

  private choosePartyAsync(forced: boolean): Promise<void> {
    return new Promise((res) => {
      const done = () => { bus.off('party-changed', done); res(); };
      bus.on('party-changed', done);
      this.openOverlay('PartySelect', { forced, locked: game.flag('s2_boss_down') ? [] : ['silica'] });
    });
  }

  private async readTerminal() {
    if (!game.flag('s2_silica_with')) return this.say('s2_terminal_locked');
    if (game.flag('s2_record_read')) return this.say('s2_lab_record_repeat');
    this.busy = true;
    await this.sayAsync('s2_lab_record');
    game.setFlag('s2_record_read');
    this.busy = false;
    this.autosave();
  }

  private checkUnknown(e: VEntity, s: Phaser.GameObjects.Sprite) {
    const first = game.addMarker({ id: e.id, x: e.x, y: e.y, label: String(e.props?.label ?? 'UNKNOWN PROPERTY') });
    s.setFrame(0);
    this.cameras.main.shake(80, 0.001);
    this.say(first ? 's2_unknown_device' : 's2_unknown_device_again');
    if (first) this.autosave();
  }

  private useMonument(x: number, y: number) {
    const p = game.data.player;
    p.hp = p.maxHp;
    bus.emit(EV.HP);
    this.setCheckpoint(x, y);
    sfx('save');
    this.burst('px_spark', x, y - 24, 10, 50, 600);
    this.autosave();
    const recruited = game.data.party.length;
    if (!game.flag('s2_monument_told')) {
      game.setFlag('s2_monument_told');
      this.say('s2_monument', () => { if (recruited > 2) void this.choosePartyAsync(false).then(() => this.say('s2_party_changed')); });
    } else if (recruited > 2) void this.choosePartyAsync(false).then(() => this.say('s2_party_changed'));
    else this.say('save_stone');
  }

  // ─────────────────────────────── boss: クリスタル・ブレイカー ───────────────────────────────
  private async startBoss() {
    if (!this.boss || this.bossPhase !== 'sleep') return;
    this.busy = true;
    this.player.lock(true);
    this.cameras.main.pan(this.boss.x, this.boss.y - 20, 700, 'Sine.easeInOut');
    this.cameras.main.shake(500, 0.006);
    await this.wait(800);
    await this.sayAsync('s2_boss_intro');
    if (this.mode !== 'sic') await this.sayAsync('s2_boss_p1_hint');
    this.cameras.main.startFollow(this.controlled, true, 0.14, 0.14);
    this.bossPhase = 'p1';
    this.nextVolley = this.time.now + 2000;
    this.setCheckpoint(tc(24), tc(19));
    this.player.lock(false);
    this.busy = false;
  }

  private hitBoss(actor: Player, x: number, y: number, r: number, hard: boolean) {
    const b = this.boss!;
    const now = this.time.now;
    if (this.bossPhase === 'p1') {
      if (Math.abs(x - b.x) > 36 + r || y < b.y - 70 || y > b.y + 10) return;
      if (!hard) {
        sfx('block');
        this.burst('px_spark', x, y, 4, 40, 250);
        if (now - this.lastClank > 2500) { this.lastClank = now; this.say('s2_boss_p1_hint'); }
        return;
      }
      this.shellHp--;
      sfx('hit');
      this.cameras.main.shake(120, 0.006);
      this.burst('px_spark', x, y, 10, 90, 400);
      b.setTintFill(0xffffff);
      this.time.delayedCall(80, () => b.clearTint());
      if (this.shellHp <= 0) void this.shellBroken();
    } else if (this.bossPhase === 'p2') {
      // the hot core: only reachable by standing in the heat (SiC FORM)
      if (Math.hypot(x - b.x, y - (b.y - 30)) > 30 + r) return;
      this.coreHp--;
      sfx('hit');
      this.cameras.main.shake(120, 0.006);
      this.burst('px_fire', x, y, 10, 90, 400);
      b.setTintFill(0xffffff);
      this.time.delayedCall(80, () => b.clearTint());
      if (this.coreHp <= 0) void this.coreDown();
      void actor;
    }
  }

  private async shellBroken() {
    this.busy = true;
    this.bossPhase = 'p2';
    this.shards.forEach((s) => s.destroy());
    this.shards = [];
    const b = this.boss!;
    b.setFrame(2);
    this.burst('px_purple', b.x, b.y - 40, 30, 120, 800);
    this.cameras.main.shake(400, 0.01);
    // the inside is hot: a ring of hot ground around the machine
    const cx = Math.floor(b.x / TILE), cy = Math.floor((b.y - 10) / TILE);
    for (let y = cy - 3; y <= cy + 2; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      const t = this.groundLayer.getTileAt(x, y);
      if (!t) continue;
      this.hotRing.push({ x, y, t: t.index });
      this.groundLayer.putTileAt(T2.HOT, x, y);
    }
    await this.sayAsync('s2_boss_shell_broken');
    (b.body as Phaser.Physics.Arcade.Body).setSize(40, 10).setOffset(28, 76);
    this.nextVolley = this.time.now + 2500;
    this.busy = false;
  }

  private async coreDown() {
    this.busy = true;
    this.bossPhase = 'p3';
    this.shards.forEach((s) => s.destroy());
    this.shards = [];
    // cool down so the two of them can walk around
    this.hotRing.forEach((h) => this.groundLayer.putTileAt(h.t, h.x, h.y));
    this.hotRing = [];
    this.consoles.forEach((c) => c.setAlpha(1).setFrame(0));
    this.cameras.main.shake(300, 0.006);
    await this.sayAsync('s2_boss_core_down');
    this.busy = false;
  }

  private updateBoss(now: number) {
    const b = this.boss;
    if (!b || this.busy || ui.locked) return;
    if (this.bossPhase === 'p1') {
      // slow stomp toward the player, then a crystal volley
      const me = this.controlled;
      const dx = me.x - b.x;
      b.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.25);
      b.x = Phaser.Math.Clamp(b.x, tc(13), tc(34));
      (b.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
      b.setFrame(Math.floor(now / 400) % 2);
      b.setDepth(b.y);
      if (now > this.nextVolley) { this.volley(8, 70); this.nextVolley = now + 2600; }
    } else if (this.bossPhase === 'p2') {
      b.setDepth(b.y);
      if (now > this.nextVolley) { this.volley(6, 60); this.nextVolley = now + 3200; }
    } else if (this.bossPhase === 'p3') {
      b.x += Math.sin(now / 40) * 0.3; // trembling
      const bodies = this.partner ? [this.player, this.partner] : [this.player];
      let on = 0;
      for (const [, c] of this.consoles) {
        const pressed = bodies.some((p) => Math.hypot(c.x - p.x, c.y + 6 - p.y) < 14);
        c.setFrame(pressed ? 1 : 0);
        if (pressed) on++;
      }
      if (on === 1 && this.mode === 'sic' && !game.flag('s2_console_told')) {
        game.setFlag('s2_console_told');
        this.say('s2_boss_console_one');
      }
      if (on === 2) void this.bossStop();
    }
  }

  private volley(n: number, speed: number) {
    const b = this.boss!;
    sfx('hit');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (this.time.now / 1000) % 1;
      const s = this.physics.add.sprite(b.x, b.y - 30, 'shard').setDepth(100000);
      s.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      s.setRotation(a + Math.PI / 2);
      s.setData('until', this.time.now + 2600);
      this.shards.push(s);
    }
  }

  private updateShards(now: number) {
    const bodies = this.partner ? [this.player, this.partner] : [this.player];
    for (const s of this.shards.slice()) {
      let done = now > (s.getData('until') as number) || !!this.solidLayer.getTileAtWorldXY(s.x, s.y)?.collides;
      if (!done && !ui.locked && !this.busy) {
        for (const p of bodies) {
          if (Math.hypot(p.x - s.x, p.y - 8 - s.y) < 8) {
            done = true;
            this.damage(p, s.x, s.y, now);
          }
        }
      }
      if (done) {
        s.destroy();
        this.shards.splice(this.shards.indexOf(s), 1);
      }
    }
  }

  private async bossStop() {
    if (this.bossPhase !== 'p3') return;
    this.bossPhase = 'down';
    this.busy = true;
    const b = this.boss!;
    b.setFrame(3);
    sfx('bigchime');
    this.cameras.main.flash(400, 255, 255, 255);
    this.burst('px_spark', b.x, b.y - 40, 30, 100, 900);
    game.setFlag('s2_boss_down');
    await this.wait(800);
    await this.sayAsync('s2_boss_stop');
    // gather the two of them and talk
    if (this.mode === 'split') {
      this.setControl(this.player);
      this.partner?.setPosition(this.player.x + 14, this.player.y);
    }
    await this.sayAsync('s2_after_boss');
    game.setFlag('silica_official');
    this.blockers.getChildren().forEach((z) => {
      const zone = z as Phaser.GameObjects.Zone;
      if (Math.abs(zone.x - (tc(VP.exit.x) + 8)) < 2 && Math.abs(zone.y - (tc(VP.exit.y) + 12)) < 2) this.blockers.remove(zone, true, true);
    });
    this.setCheckpoint(this.player.x, this.player.y);
    this.busy = false;
    this.autosave();
  }

  private reachExit() {
    if (!game.flag('s2_boss_down') || this.busy || ui.locked || game.flag('stage2_clear_shown')) return;
    game.setFlag('stage2_clear');
    game.setFlag('stage2_clear_shown');
    this.autosave();
    this.busy = true;
    this.player.lock(true);
    this.scene.pause();
    bus.emit(EV.UI_MODE, 'hidden');
    this.scene.launch('Periodic');
    this.scene.bringToTop('Periodic');
  }

  // ─────────────────────────────── panels ───────────────────────────────
  private openBond() {
    if (game.flag('s2_record_read') || game.flag('s2_sic_found')) {
      const near = this.mode !== 'split' || (!!this.partner && Math.hypot(this.partner.x - this.player.x, this.partner.y - this.player.y) < 40);
      this.openOverlay('FormBond', { near, mode: this.mode });
    } else this.openOverlay('BondPanel');
  }

  private openOverlay(key: string, data?: object) {
    this.controlled.setVelocity(0, 0);
    input.moveX = input.moveY = 0;
    input.guard = false;
    this.scene.pause();
    bus.emit(EV.UI_MODE, 'hidden');
    this.scene.launch(key, data);
    this.scene.bringToTop(key);
  }

  private onResume = () => {
    bus.emit(EV.UI_MODE, 'normal');
    if (this.scene.isPaused()) this.scene.resume();
    this.lastTime = this.time.now;
  };

  private onBondMade = () => this.autosave();

  /** CHARACTER BOND finished in the FormBond scene. */
  private onFormMade = (form: string) => {
    if (form !== 'sic') return;
    const first = !game.flag('s2_sic_found');
    game.setFlag('s2_sic_found');
    this.time.delayedCall(60, async () => {
      if (this.mode !== 'sic') await this.doBond();
      if (first) {
        this.busy = true;
        await this.sayAsync('s2_after_sic');
        this.busy = false;
        this.autosave();
      }
    });
  };

  private setCheckpoint(x: number, y: number) {
    game.data.checkpoint = { x: Math.round(x), y: Math.round(y) };
  }

  autosave() {
    const d = game.data;
    d.player.x = Math.round(this.player.x);
    d.player.y = Math.round(this.player.y);
    d.player.facing = this.player.facing;
    game.save();
  }

  burst(tex: string, x: number, y: number, n: number, speed: number, life: number, gravityY = 0) {
    if (!this.textures.exists(tex)) return;
    const em = this.add.particles(x, y, tex, { speed: { min: speed * 0.3, max: speed }, lifespan: life, quantity: n, scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, gravityY, emitting: false });
    em.setDepth(y + 200);
    em.explode(n);
    this.time.delayedCall(life + 100, () => em.destroy());
  }
}
