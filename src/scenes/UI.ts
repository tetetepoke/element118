import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS, KIND_COLORS } from '../config';
import { bus, EV, game, input, ui } from '../core/state';
import { Line, SPEAKER_NAME } from '../data/script';
import { txt, panel } from '../ui/widgets';
import { sfx } from '../core/audio';
import { element } from '../data/elements';
import { reaction, substance } from '../data/substances';

type Mode = 'normal' | 'hidden' | 'black';

interface CircleBtn {
  c: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  t: Phaser.GameObjects.Text;
  r: number;
  color: number;
  pressed: boolean;
}

export class UI extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Container;
  private hearts!: Phaser.GameObjects.Graphics;
  private atomText!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  private joyBase!: Phaser.GameObjects.Graphics;
  private joyKnob!: Phaser.GameObjects.Graphics;
  private joyId: number | null = null;
  private joyOrigin = { x: 230, y: 620 };
  private btnA!: CircleBtn;
  private btnE!: CircleBtn;
  private btnBond!: CircleBtn;
  private guardPointer: number | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private showTouch = true;

  // dialogue
  private dlg!: Phaser.GameObjects.Container;
  private dlgText!: Phaser.GameObjects.Text;
  private dlgName!: Phaser.GameObjects.Text;
  private dlgPortrait!: Phaser.GameObjects.Image;
  private dlgArrow!: Phaser.GameObjects.Text;
  private queue: Line[] = [];
  private onDone?: () => void;
  private typing = '';
  private typedLen = 0;
  private typeAcc = 0;
  private black!: Phaser.GameObjects.Rectangle;
  private banner?: Phaser.GameObjects.Container;
  private mode: Mode = 'normal';

  constructor() {
    super('UI');
  }

  create() {
    this.queue = [];
    this.onDone = undefined;
    this.joyId = null;
    this.guardPointer = null;
    this.mode = 'normal';
    ui.locked = false;
    const params = new URLSearchParams(location.search);
    this.showTouch = this.sys.game.device.input.touch || params.has('touch');
    this.input.addPointer(3);

    this.black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0).setVisible(false);

    // ── HUD ──
    this.hud = this.add.container(0, 0);
    this.hearts = this.add.graphics();
    this.atomText = this.add.container(30, 92);
    this.hud.add([this.hearts, this.atomText]);
    const menuBtn = this.makeCircle(GAME_W - 70, 66, 46, 0x2a3352, 'メニュー', 20);
    menuBtn.c.getByName('zone')?.on('pointerdown', () => { input.menu = true; this.press(menuBtn); });
    this.hud.add(menuBtn.c);
    this.btnBond = this.makeCircle(GAME_W - 186, 66, 50, KIND_COLORS.covalent, 'BOND', 24);
    this.btnBond.c.getByName('zone')?.on('pointerdown', () => { input.bond = true; this.press(this.btnBond); });
    this.hud.add(this.btnBond.c);

    // ── touch controls ──
    this.controls = this.add.container(0, 0);
    this.joyBase = this.add.graphics();
    this.joyKnob = this.add.graphics();
    this.controls.add([this.joyBase, this.joyKnob]);
    this.drawJoy(this.joyOrigin.x, this.joyOrigin.y, this.joyOrigin.x, this.joyOrigin.y, false);

    this.btnA = this.makeCircle(GAME_W - 170, GAME_H - 165, 92, 0xd8584a, '攻撃', 30);
    const btnB = this.makeCircle(GAME_W - 345, GAME_H - 90, 62, 0x3d6fd8, '回避', 24);
    const btnG = this.makeCircle(GAME_W - 360, GAME_H - 250, 62, 0x6a7a8a, 'ガード', 22);
    this.btnE = this.makeCircle(GAME_W - 150, GAME_H - 370, 62, 0x2a8ad8, '元素', 22);
    this.btnA.c.getByName('zone')?.on('pointerdown', () => { input.attack = true; this.press(this.btnA); });
    btnB.c.getByName('zone')?.on('pointerdown', () => { input.dodge = true; this.press(btnB); });
    this.btnE.c.getByName('zone')?.on('pointerdown', () => { input.element = true; this.press(this.btnE); });
    const gz = btnG.c.getByName('zone') as Phaser.GameObjects.Zone;
    gz.on('pointerdown', (p: Phaser.Input.Pointer) => {
      input.guard = true;
      input.guardPressedAt = this.time.now;
      this.guardPointer = p.id;
      btnG.pressed = true;
      this.drawCircle(btnG);
    });
    const releaseGuard = (p: Phaser.Input.Pointer) => {
      if (this.guardPointer !== p.id) return;
      this.guardPointer = null;
      input.guard = false;
      btnG.pressed = false;
      this.drawCircle(btnG);
    };
    this.input.on('pointerup', releaseGuard);
    this.controls.add([this.btnA.c, btnB.c, btnG.c, this.btnE.c]);
    this.controls.setVisible(this.showTouch);

    if (!this.showTouch) {
      this.hud.add(
        txt(this, 30, GAME_H - 44, '移動 WASD/矢印　攻撃・調べる J/Space　回避 K/Shift　ガード L　元素 I　BOND U　図鑑 C　メニュー Esc', 18, '#ffffff', {
          backgroundColor: 'rgba(0,0,0,0.45)',
          padding: { x: 10, y: 4 },
        }),
      );
    }

    // joystick: left half of the screen
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.dlg.visible) {
        this.advance();
        return;
      }
      if (this.mode !== 'normal' || ui.locked) return;
      if (over.length) return;
      if (p.x < GAME_W * 0.5 && this.joyId === null) {
        this.joyId = p.id;
        this.joyOrigin = { x: p.x, y: p.y };
        this.drawJoy(p.x, p.y, p.x, p.y, true);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      const dx = p.x - this.joyOrigin.x, dy = p.y - this.joyOrigin.y;
      const max = 100;
      const len = Math.hypot(dx, dy);
      const k = len > max ? max / len : 1;
      input.moveX = (dx * k) / max;
      input.moveY = (dy * k) / max;
      this.drawJoy(this.joyOrigin.x, this.joyOrigin.y, this.joyOrigin.x + dx * k, this.joyOrigin.y + dy * k, true);
    });
    const releaseJoy = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      this.joyId = null;
      input.moveX = input.moveY = 0;
      this.joyOrigin = { x: 230, y: 620 };
      this.drawJoy(this.joyOrigin.x, this.joyOrigin.y, this.joyOrigin.x, this.joyOrigin.y, false);
    };
    this.input.on('pointerup', releaseJoy);
    this.input.on('pointerupoutside', releaseJoy);

    // keyboard
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,I,U,C,SPACE,SHIFT,ESC,ENTER,Z,X') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (e: KeyboardEvent) => {
      const k = e.code;
      if (this.dlg.visible) {
        if (['Space', 'Enter', 'KeyJ', 'KeyZ'].includes(k)) this.advance();
        return;
      }
      if (k === 'KeyJ' || k === 'Space' || k === 'KeyZ') input.attack = true;
      if (k === 'KeyK' || k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyX') input.dodge = true;
      if (k === 'KeyL') { input.guard = true; input.guardPressedAt = this.time.now; }
      if (k === 'KeyI') input.element = true;
      if (k === 'KeyU' || k === 'KeyB') input.bond = true;
      if (k === 'KeyC') input.codex = true;
      if (k === 'Escape') input.menu = true;
    });
    kb.on('keyup-L', () => (input.guard = false));

    // ── dialogue box ──
    this.dlg = this.add.container(0, 0).setVisible(false);
    const box = panel(this, 40, GAME_H - 250, GAME_W - 80, 220, 0x10152a, 0.95);
    this.dlgPortrait = this.add.image(80 + 96, GAME_H - 250 + 110, 'pt_carbon').setDisplaySize(192, 192);
    this.dlgName = txt(this, 290, GAME_H - 236, '', 26, '#8fd3ff', { fontStyle: 'bold' });
    this.dlgText = txt(this, 290, GAME_H - 196, '', 30, '#ffffff', { wordWrap: { width: GAME_W - 400, useAdvancedWrap: true } });
    this.dlgArrow = txt(this, GAME_W - 90, GAME_H - 70, '▼', 26, '#ffd84a');
    this.tweens.add({ targets: this.dlgArrow, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.dlg.add([box, this.dlgPortrait, this.dlgName, this.dlgText, this.dlgArrow]);

    // ── events ──
    bus.on(EV.SAY, this.onSay, this);
    bus.on(EV.HP, this.drawHearts, this);
    bus.on(EV.INVENTORY, this.drawAtoms, this);
    bus.on(EV.TOAST, this.toast, this);
    bus.on(EV.UI_MODE, this.setMode, this);
    bus.on(EV.DISCOVER_ELEMENT, this.bannerElement, this);
    bus.on(EV.DISCOVER_REACTION, this.bannerReaction, this);
    bus.on(EV.SAVED, this.onSaved, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.SAY, this.onSay, this);
      bus.off(EV.HP, this.drawHearts, this);
      bus.off(EV.INVENTORY, this.drawAtoms, this);
      bus.off(EV.TOAST, this.toast, this);
      bus.off(EV.UI_MODE, this.setMode, this);
      bus.off(EV.DISCOVER_ELEMENT, this.bannerElement, this);
      bus.off(EV.DISCOVER_REACTION, this.bannerReaction, this);
      bus.off(EV.SAVED, this.onSaved, this);
    });

    this.drawHearts();
    this.drawAtoms();
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  update(_t: number, dt: number) {
    // keyboard movement (merged with joystick)
    if (this.joyId === null) {
      const k = this.keys;
      const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      input.moveX = x;
      input.moveY = y;
    }
    if (this.btnA.t.text !== ui.aLabel) this.btnA.t.setText(ui.aLabel);
    this.btnBond.c.setVisible(game.flag('got_codex'));

    // typewriter
    if (this.typing) {
      this.typeAcc += dt;
      const step = 28;
      let changed = false;
      while (this.typeAcc > step && this.typedLen < this.typing.length) {
        this.typeAcc -= step;
        this.typedLen++;
        changed = true;
        if (this.typedLen % 3 === 0) sfx('talk');
      }
      if (changed) this.dlgText.setText(this.typing.slice(0, this.typedLen));
      if (this.typedLen >= this.typing.length) {
        this.typing = '';
        this.dlgArrow.setVisible(true);
      }
    }
  }

  // ─────────────────────────────── controls drawing ───────────────────────────────
  private makeCircle(x: number, y: number, r: number, color: number, label: string, size: number): CircleBtn {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const t = txt(this, 0, 0, label, size, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    const zone = this.add.zone(0, 0, r * 2.1, r * 2.1).setInteractive(new Phaser.Geom.Circle(r * 1.05, r * 1.05, r * 1.05), Phaser.Geom.Circle.Contains);
    zone.setName('zone');
    c.add([g, t, zone]);
    const b: CircleBtn = { c, g, t, r, color, pressed: false };
    this.drawCircle(b);
    return b;
  }

  private drawCircle(b: CircleBtn) {
    b.g.clear();
    b.g.fillStyle(b.color, b.pressed ? 0.85 : 0.5);
    b.g.fillCircle(0, 0, b.r);
    b.g.lineStyle(4, 0xffffff, b.pressed ? 0.95 : 0.6);
    b.g.strokeCircle(0, 0, b.r);
  }

  private press(b: CircleBtn) {
    b.pressed = true;
    this.drawCircle(b);
    this.time.delayedCall(110, () => {
      b.pressed = false;
      this.drawCircle(b);
    });
  }

  private drawJoy(bx: number, by: number, kx: number, ky: number, active: boolean) {
    this.joyBase.clear();
    this.joyBase.fillStyle(0xffffff, active ? 0.14 : 0.07);
    this.joyBase.fillCircle(bx, by, 110);
    this.joyBase.lineStyle(4, 0xffffff, active ? 0.45 : 0.2);
    this.joyBase.strokeCircle(bx, by, 110);
    this.joyKnob.clear();
    this.joyKnob.fillStyle(0xffffff, active ? 0.6 : 0.25);
    this.joyKnob.fillCircle(kx, ky, 48);
  }

  // ─────────────────────────────── HUD ───────────────────────────────
  private drawHearts() {
    const p = game.data.player;
    const g = this.hearts;
    g.clear();
    for (let i = 0; i < p.maxHp / 2; i++) {
      const x = 44 + i * 54, y = 46;
      const fill = Math.max(0, Math.min(2, p.hp - i * 2));
      this.heart(g, x, y, 0x3a2030, 1);
      if (fill === 2) this.heart(g, x, y, 0xff4d6d, 1);
      if (fill === 1) this.heart(g, x, y, 0xff4d6d, 0.5);
    }
  }

  private heart(g: Phaser.GameObjects.Graphics, x: number, y: number, col: number, part: number) {
    g.fillStyle(col, 1);
    if (part === 1) {
      g.fillCircle(x - 10, y - 6, 12);
      g.fillCircle(x + 10, y - 6, 12);
      g.fillTriangle(x - 21, y - 1, x + 21, y - 1, x, y + 22);
    } else {
      g.fillCircle(x - 10, y - 6, 12);
      g.fillTriangle(x - 21, y - 1, x, y - 1, x, y + 22);
      g.fillRect(x - 10, y - 18, 10, 18);
    }
  }

  private drawAtoms() {
    this.atomText.removeAll(true);
    let x = 0;
    for (const sym of game.data.discovered.elements) {
      if (sym === 'C') continue;
      const n = game.atoms(sym);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x - 6, -4, 112, 52, 12);
      g.fillStyle(ELEMENT_COLORS[sym] ?? 0x888888, 1);
      g.fillCircle(x + 22, 22, 20);
      this.atomText.add(g);
      this.atomText.add(txt(this, x + 22, 22, sym, 22, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
      this.atomText.add(txt(this, x + 50, 6, `×${n}`, 26, '#ffffff'));
      x += 124;
    }
    for (const id of ['h2', 'o2', 'h2o']) {
      const n = game.count(id);
      if (!game.knows('substances', id)) continue;
      const s = substance(id);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x - 6, -4, 132, 52, 12);
      this.atomText.add(g);
      this.atomText.add(txt(this, x + 4, 6, `${s.formula} ×${n}`, 26, id === 'h2o' ? '#9fdcff' : '#ffffff'));
      x += 144;
    }
    // element button shows the equipped substance
    const eq = game.data.equipped;
    if (eq) {
      const s = substance(eq);
      this.btnE.t.setText(`${s.formula}\n×${game.count(eq)}`);
      this.btnE.color = eq === 'h2o' ? 0x2a8ad8 : 0x6a7a8a;
    } else {
      this.btnE.t.setText('元素');
      this.btnE.color = 0x444a58;
    }
    this.drawCircle(this.btnE);
  }

  private toastObj?: Phaser.GameObjects.Text;
  private toast(msg: string) {
    this.toastObj?.destroy();
    const t = txt(this, GAME_W / 2, 220, msg, 28, '#ffffff', { backgroundColor: 'rgba(16,21,42,0.85)', padding: { x: 18, y: 8 } }).setOrigin(0.5);
    this.toastObj = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  private onSaved(ok: boolean) {
    if (!ok) this.toast('セーブできませんでした（ブラウザの保存領域を確認してください）');
  }

  private setMode(m: Mode) {
    this.mode = m;
    this.black.setVisible(m === 'black');
    this.hud.setVisible(m === 'normal');
    this.controls.setVisible(m === 'normal' && this.showTouch && !this.dlg.visible);
    if (m !== 'normal') {
      this.joyId = null;
      input.moveX = input.moveY = 0;
      this.drawJoy(230, 620, 230, 620, false);
    }
  }

  // ─────────────────────────────── dialogue ───────────────────────────────
  private onSay(lines: Line[], onDone?: () => void) {
    this.queue.push(...lines);
    const prev = this.onDone;
    this.onDone = () => {
      prev?.();
      onDone?.();
    };
    if (!this.dlg.visible) this.nextLine();
  }

  private nextLine() {
    const line = this.queue.shift();
    if (!line) {
      this.dlg.setVisible(false);
      this.controls.setVisible(this.mode === 'normal' && this.showTouch);
      ui.locked = false;
      const cb = this.onDone;
      this.onDone = undefined;
      cb?.();
      return;
    }
    ui.locked = true;
    input.moveX = input.moveY = 0;
    input.clearEdges();
    this.joyId = null;
    this.controls.setVisible(false);
    this.dlg.setVisible(true);
    const sys = line.who === 'sys';
    this.dlgPortrait.setVisible(!sys);
    if (!sys) this.dlgPortrait.setTexture(`pt_${line.who}`).setDisplaySize(192, 192);
    this.dlgName.setText(SPEAKER_NAME[line.who]);
    this.dlgName.setX(sys ? 80 : 290);
    this.dlgText.setX(sys ? 80 : 290);
    this.dlgText.setWordWrapWidth(sys ? GAME_W - 200 : GAME_W - 400, true);
    this.typing = line.text;
    this.typedLen = 0;
    this.typeAcc = 0;
    this.dlgText.setText('');
    this.dlgArrow.setVisible(false);
  }

  private advance() {
    if (this.typing) {
      this.typedLen = this.typing.length;
      this.dlgText.setText(this.typing);
      this.typing = '';
      this.dlgArrow.setVisible(true);
      return;
    }
    if (!this.dlg.visible) return;
    sfx('ui');
    this.nextLine();
  }

  // ─────────────────────────────── discovery banners ───────────────────────────────
  private showBanner(build: (c: Phaser.GameObjects.Container) => void) {
    this.banner?.destroy();
    const c = this.add.container(GAME_W / 2, 300);
    build(c);
    c.setScale(0.6).setAlpha(0);
    this.banner = c;
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: 270, delay: 2800, duration: 400, onComplete: () => c.destroy() });
  }

  private bannerElement(sym: string) {
    const e = element(sym);
    sfx('discover');
    this.showBanner((c) => {
      c.add(panel(this, -330, -130, 660, 260, 0x10152a, 0.95, 0xffd84a));
      c.add(txt(this, 0, -104, '新しい元素を発見！', 32, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5));
      const g = this.add.graphics();
      g.fillStyle(ELEMENT_COLORS[sym] ?? 0x888888, 1);
      g.fillRoundedRect(-300, -60, 150, 160, 12);
      g.lineStyle(4, 0xffffff, 0.9);
      g.strokeRoundedRect(-300, -60, 150, 160, 12);
      c.add(g);
      c.add(txt(this, -288, -52, String(e.z), 24, '#ffffff'));
      c.add(txt(this, -225, 18, e.symbol, 72, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
      c.add(txt(this, -225, 78, e.en, 18, '#ffffff').setOrigin(0.5));
      c.add(txt(this, -120, -52, `${e.symbol} ＝ ${e.ja}`, 40, '#ffffff', { fontStyle: 'bold' }));
      c.add(txt(this, -120, 6, `${e.en}　原子番号 ${e.z}`, 26, '#cfe8ff'));
      c.add(txt(this, -120, 50, e.hands ? `結合の手：${e.hands}本` : '', 26, '#9fe0b8'));
    });
  }

  private bannerReaction(id: string) {
    const r = reaction(id);
    sfx('discover');
    this.showBanner((c) => {
      c.add(panel(this, -330, -110, 660, 220, 0x10152a, 0.95, KIND_COLORS.reaction));
      c.add(txt(this, 0, -84, '化学反応を発見！', 32, '#ff9a7a', { fontStyle: 'bold' }).setOrigin(0.5));
      c.add(txt(this, 0, -24, r.name.ja, 48, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
      c.add(txt(this, 0, 40, '物質が酸素と結びつき、別の物質に変わる', 24, '#ffd9cc').setOrigin(0.5));
      c.add(txt(this, 0, 78, '【化学反応】として図鑑に登録された', 20, '#ff9a7a').setOrigin(0.5));
    });
  }
}
