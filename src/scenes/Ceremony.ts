import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS, KIND_COLORS } from '../config';
import { txt, panel, atomToken } from '../ui/widgets';
import { substance, kindOf, KIND_LABEL, Substance } from '../data/substances';
import { element } from '../data/elements';
import { sfx } from '../core/audio';

/**
 * Discovery ceremony for a newly made substance.
 * big (H₂O):  atoms bond → flash → "H₂O" → WATER／水 → structure → property comparison → codex → ability
 * medium (H₂, O₂): atoms bond → name → structure + properties + safety lines
 * Each stage waits for a tap (or advances by itself after a while).
 */
export class Ceremony extends Phaser.Scene {
  private s!: Substance;
  private stage = 0;
  private stages: (() => void)[] = [];
  private layer!: Phaser.GameObjects.Container;
  private tapHint!: Phaser.GameObjects.Text;
  private ready = false;
  private autoTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Ceremony');
  }

  init(data: { id: string }) {
    this.s = substance(data.id);
    this.stage = 0;
    this.ready = false;
  }

  create() {
    const big = this.s.ceremony === 'big';
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x02040a, big ? 0.96 : 0.94).setOrigin(0).setInteractive();
    // slow rotating rays behind everything
    const rays = this.add.graphics({ x: GAME_W / 2, y: 300 });
    const kc = KIND_COLORS[kindOf(this.s)];
    for (let i = 0; i < 16; i++) {
      rays.fillStyle(kc, 0.06);
      const a = (i / 16) * Math.PI * 2;
      rays.fillTriangle(0, 0, Math.cos(a) * 900, Math.sin(a) * 900, Math.cos(a + 0.12) * 900, Math.sin(a + 0.12) * 900);
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    this.layer = this.add.container(0, 0);
    this.tapHint = txt(this, GAME_W / 2, GAME_H - 46, 'タップで次へ', 24, '#8fa5c8').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.tapHint, alpha: { from: 0.3, to: 1 }, duration: 600, yoyo: true, repeat: -1, paused: true });

    this.stages = big
      ? [() => this.stBond(rays, true), () => this.stName(true), () => this.stStructure(), () => this.stCompare(), () => this.stCodex(), () => this.stAbility()]
      : [() => this.stBond(rays, false), () => this.stName(false), () => this.stMediumInfo()];

    this.input.on('pointerup', () => this.next());
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyJ', 'KeyZ'].includes(e.code)) this.next();
    });
    this.stages[0]();
  }

  private setReady(autoMs: number) {
    this.ready = true;
    this.tapHint.setAlpha(1);
    this.autoTimer?.remove();
    if (autoMs > 0) this.autoTimer = this.time.delayedCall(autoMs, () => this.next());
  }

  private next() {
    if (!this.ready) return;
    this.ready = false;
    this.autoTimer?.remove();
    this.tapHint.setAlpha(0);
    this.stage++;
    if (this.stage >= this.stages.length) return this.finish();
    sfx('ui');
    this.stages[this.stage]();
  }

  private finish() {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.resume('BondPanel');
    });
  }

  private clearLayer(keep = false) {
    if (!keep) this.layer.removeAll(true);
  }

  // ── stage: atoms come together and bond ──
  private stBond(rays: Phaser.GameObjects.Graphics, big: boolean) {
    const s = this.s;
    const cx = GAME_W / 2, cy = 300;
    const pos = this.structurePositions(s, cx, cy, big ? 150 : 130);
    const starts = [
      { x: 200, y: 640 },
      { x: GAME_W - 200, y: 640 },
      { x: cx, y: 760 },
    ];
    const toks = s.atoms.map((sym, i) => {
      const t = atomToken(this, starts[i % 3].x, starts[i % 3].y, sym, big ? 60 : 52, null, ELEMENT_COLORS[sym] ?? 0x888888);
      t.setScale(0.6).setAlpha(0);
      this.layer.add(t);
      return t;
    });
    const bondG = this.add.graphics();
    this.layer.addAt(bondG, 0);
    toks.forEach((t, i) => {
      this.tweens.add({ targets: t, alpha: 1, scale: 1, x: pos[i].x, y: pos[i].y, duration: 700, delay: 150 + i * 160, ease: 'Cubic.easeOut' });
    });
    // draw bonds one by one with a snap
    const bondDelay = 150 + s.atoms.length * 160 + 650;
    s.bonds.forEach(([a, b, order], k) => {
      this.time.delayedCall(bondDelay + k * 380, () => {
        const pa = pos[a], pb = pos[b];
        const prog = { t: 0 };
        this.tweens.add({
          targets: prog, t: 1, duration: 260,
          onUpdate: () => {
            this.drawBond(bondG, pa, pb, order, big ? 60 : 52, prog.t, k, s.bonds.length);
          },
        });
        sfx('snap');
        this.cameras.main.shake(90, 0.004);
      });
    });
    const flashAt = bondDelay + s.bonds.length * 380 + 300;
    this.time.delayedCall(flashAt, () => {
      const flash = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 1).setOrigin(0);
      this.tweens.add({ targets: flash, alpha: 0, duration: big ? 900 : 500, onComplete: () => flash.destroy() });
      this.tweens.add({ targets: rays, alpha: 1, duration: 800 });
      sfx(big ? 'bigchime' : 'discover');
      const tex = s.id === 'h2o' ? 'px_water' : 'px_spark';
      const em = this.add.particles(cx, cy, tex, {
        speed: { min: 150, max: big ? 520 : 320 }, lifespan: 1400, quantity: big ? 70 : 30, scale: { start: big ? 3 : 2, end: 0 },
        alpha: { start: 1, end: 0 }, gravityY: 200, emitting: false,
      });
      em.explode(big ? 70 : 30);
      if (big) {
        const em2 = this.add.particles(cx, cy, 'px_spark', { speed: { min: 80, max: 300 }, lifespan: 1200, quantity: 40, scale: { start: 3, end: 0 }, emitting: false });
        em2.explode(40);
      }
      this.time.delayedCall(big ? 700 : 400, () => this.setReady(big ? 2500 : 1800));
    });
  }

  private drawBond(g: Phaser.GameObjects.Graphics, pa: { x: number; y: number }, pb: { x: number; y: number }, order: number, r: number, t: number, k: number, total: number) {
    if (k === 0 && t < 0.02) g.clear();
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const offsets = order === 1 ? [0] : order === 2 ? [-11, 11] : [-17, 0, 17];
    g.lineStyle(10, 0xffffff, 1);
    offsets.forEach((o) => {
      const x1 = pa.x + ux * r * 0.9 + nx * o, y1 = pa.y + uy * r * 0.9 + ny * o;
      const x2 = x1 + (dx - ux * r * 1.8) * t, y2 = y1 + (dy - uy * r * 1.8) * t;
      g.lineBetween(x1, y1, x2, y2);
    });
    void total;
  }

  /** Atom positions for the structure drawing (centre atom = atoms[0] for 3-atom molecules). */
  private structurePositions(s: Substance, cx: number, cy: number, bond: number) {
    if (s.atoms.length === 2) return [{ x: cx - bond / 2 - 20, y: cy }, { x: cx + bond / 2 + 20, y: cy }];
    const ang = ((s.angle ?? 180) * Math.PI) / 180;
    const half = ang / 2;
    const d = bond + 30;
    return [
      { x: cx, y: cy - (s.angle && s.angle < 180 ? 40 : 0) },
      { x: cx - Math.sin(half) * d, y: cy - (s.angle && s.angle < 180 ? 40 : 0) + Math.cos(half) * d },
      { x: cx + Math.sin(half) * d, y: cy - (s.angle && s.angle < 180 ? 40 : 0) + Math.cos(half) * d },
    ];
  }

  // ── stage: big name ──
  private stName(big: boolean) {
    const s = this.s;
    // shrink the molecule up and show the formula
    this.tweens.add({ targets: this.layer, y: -60, scale: 0.72, x: GAME_W * 0.14, duration: 500, ease: 'Cubic.easeInOut' });
    const f = txt(this, GAME_W / 2, 560, s.formula ?? '', big ? 150 : 110, '#ffffff', { fontStyle: 'bold', stroke: '#1b2a55', strokeThickness: 12 }).setOrigin(0.5).setScale(0.3).setAlpha(0);
    const sub = txt(this, GAME_W / 2, 680, big ? `${s.name.en.toUpperCase()}　／　${s.name.ja}` : `${s.name.ja}（${s.state}）`, big ? 52 : 40, big ? '#9fdcff' : '#cfe8ff', { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    const tag = txt(this, GAME_W / 2, 470, `【${KIND_LABEL[kindOf(s)]}】`, 26, '#' + KIND_COLORS[kindOf(s)].toString(16).padStart(6, '0')).setOrigin(0.5).setAlpha(0);
    this.extra.push(f, sub, tag);
    this.tweens.add({ targets: f, scale: 1, alpha: 1, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, delay: 450, duration: 400 });
    this.tweens.add({ targets: tag, alpha: 1, delay: 700, duration: 400 });
    if (big) this.time.delayedCall(250, () => sfx('discover'));
    this.time.delayedCall(900, () => this.setReady(big ? 3200 : 2500));
  }

  private extra: Phaser.GameObjects.GameObject[] = [];
  private clearExtra() {
    this.extra.forEach((o) => o.destroy());
    this.extra = [];
  }

  // ── stage: structure ──
  private stStructure() {
    this.clearExtra();
    this.layer.removeAll(true);
    this.layer.setPosition(0, 0).setScale(1);
    const s = this.s;
    const cx = GAME_W / 2, cy = 330;
    const pos = this.structurePositions(s, cx, cy, 170);
    const g = this.add.graphics();
    this.layer.add(g);
    s.bonds.forEach(([a, b, o], k) => this.drawBond(g, pos[a], pos[b], o, 64, 1, k, s.bonds.length));
    s.atoms.forEach((sym, i) => this.layer.add(atomToken(this, pos[i].x, pos[i].y, sym, 64, null, ELEMENT_COLORS[sym] ?? 0x888888)));
    // angle arc for bent molecules
    if (s.angle && s.angle < 180 && s.atoms.length === 3) {
      const arc = this.add.graphics();
      const a1 = Math.atan2(pos[1].y - pos[0].y, pos[1].x - pos[0].x);
      const a2 = Math.atan2(pos[2].y - pos[0].y, pos[2].x - pos[0].x);
      arc.lineStyle(4, 0xffd84a, 1);
      arc.beginPath();
      arc.arc(pos[0].x, pos[0].y, 110, a2, a1, false);
      arc.strokePath();
      this.layer.add(arc);
      this.layer.add(txt(this, pos[0].x, pos[0].y + 150, `約${s.angle}°`, 30, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5));
    }
    this.layer.add(txt(this, GAME_W / 2, 92, `${s.formula} の形`, 40, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
    this.layer.add(txt(this, GAME_W / 2, 620, 'Oの2本の手に、Hが1つずつつながっている', 34, '#cfe8ff').setOrigin(0.5));
    this.layer.add(txt(this, GAME_W / 2, 672, '水の分子は、まっすぐではなく折れ曲がった形', 26, '#8fa5c8').setOrigin(0.5));
    this.layer.setAlpha(0);
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 400 });
    this.time.delayedCall(700, () => this.setReady(4500));
  }

  // ── stage: properties before / after ──
  private stCompare() {
    this.layer.removeAll(true);
    this.layer.setAlpha(1);
    this.layer.add(txt(this, GAME_W / 2, 80, '組み合わさると、性質がまったく変わる！', 44, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5));
    const card = (x: number, id: string, delay: number, big = false) => {
      const sub = substance(id);
      const w = big ? 400 : 330, h = big ? 380 : 330;
      const c = this.add.container(x, 420);
      c.add(panel(this, -w / 2, -h / 2, w, h, big ? 0x123a5a : 0x1b2340, 0.98, big ? 0x9fdcff : 0x4a5a80));
      c.add(txt(this, 0, -h / 2 + 50, sub.formula ?? '', big ? 72 : 60, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
      c.add(txt(this, 0, -h / 2 + 112, `${sub.name.ja}（${sub.state}）`, 28, '#cfe8ff').setOrigin(0.5));
      sub.properties.forEach((p, i) => c.add(txt(this, 0, -h / 2 + 180 + i * 56, p, big ? 34 : 28, big ? '#9fdcff' : '#ffffff', { fontStyle: 'bold', align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5)));
      c.setAlpha(0).setScale(0.8);
      this.layer.add(c);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, delay, duration: 350, ease: 'Back.easeOut' });
      return c;
    };
    card(240, 'h2', 0);
    this.layer.add(txt(this, 440, 420, '＋', 60, '#ffffff').setOrigin(0.5));
    card(640, 'o2', 250);
    const arrow = txt(this, 870, 420, '→', 72, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    this.layer.add(arrow);
    this.tweens.add({ targets: arrow, alpha: 1, delay: 700, duration: 300 });
    card(1150, 'h2o', 1000, true);
    this.layer.add(txt(this, GAME_W / 2, 690, '燃える気体と、燃えるのを助ける気体から、火を消す液体ができた', 28, '#ffffff').setOrigin(0.5));
    this.layer.add(txt(this, GAME_W / 2, 734, '（ゲームでは H 2つと O 1つを直接つないでいるが、現実では H₂ と O₂ の反応で水ができる）', 20, '#8fa5c8').setOrigin(0.5));
    this.time.delayedCall(1400, () => {
      sfx('discover');
      this.setReady(6000);
    });
  }

  // ── stage: codex registration ──
  private stCodex() {
    this.layer.removeAll(true);
    const s = this.s;
    const c = this.add.container(GAME_W / 2, 380);
    c.add(panel(this, -480, -230, 960, 460, 0x10152a, 0.98, 0xffd84a));
    c.add(txt(this, 0, -190, '図鑑に登録しました', 40, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(txt(this, -420, -120, `${s.formula}　${s.name.ja}（${s.name.en}）`, 38, '#ffffff', { fontStyle: 'bold' }));
    c.add(txt(this, -420, -66, `【${KIND_LABEL[kindOf(s)]}】`, 26, '#59e0a8'));
    c.add(txt(this, -420, -20, s.facts.join('\n'), 24, '#cfe8ff', { wordWrap: { width: 840 } }));
    if (s.realProcess) {
      c.add(txt(this, -420, 110, 'ほんとうは？', 24, '#ffd84a', { fontStyle: 'bold' }));
      c.add(txt(this, -420, 146, s.realProcess, 21, '#ffffff', { wordWrap: { width: 840 } }));
    }
    c.setScale(0.85).setAlpha(0);
    this.layer.add(c);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    sfx('pickup');
    this.time.delayedCall(700, () => this.setReady(7000));
  }

  // ── stage: new ability ──
  private stAbility() {
    this.layer.removeAll(true);
    const c = this.add.container(GAME_W / 2, 380);
    const g = this.add.graphics();
    g.fillStyle(0x2a8ad8, 1);
    g.fillCircle(0, -60, 110);
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(0, -60, 110);
    c.add(g);
    c.add(this.add.image(0, -60, 'water_shot').setScale(9));
    c.add(txt(this, 0, 110, '水の能力が使えるようになった！', 44, '#9fdcff', { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(txt(this, 0, 170, '「元素」ボタン（キーボードは I）で、水をかけられる', 28, '#ffffff').setOrigin(0.5));
    c.setAlpha(0);
    this.layer.add(c);
    this.tweens.add({ targets: c, alpha: 1, duration: 350 });
    this.tweens.add({ targets: g, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
    sfx('discover');
    this.time.delayedCall(700, () => this.setReady(0));
  }

  // ── medium: structure + properties + safety ──
  private stMediumInfo() {
    this.clearExtra();
    this.layer.removeAll(true);
    this.layer.setPosition(0, 0).setScale(1);
    const s = this.s;
    const pos = this.structurePositions(s, 330, 330, 120);
    const g = this.add.graphics();
    this.layer.add(g);
    s.bonds.forEach(([a, b, o], k) => this.drawBond(g, pos[a], pos[b], o, 52, 1, k, s.bonds.length));
    s.atoms.forEach((sym, i) => this.layer.add(atomToken(this, pos[i].x, pos[i].y, sym, 52, null, ELEMENT_COLORS[sym] ?? 0x888888)));
    const handsText = s.bonds[0][2] === 2 ? '手を2本ずつ使ってつながる（二重結合）' : '手を1本ずつ使ってつながる';
    this.layer.add(txt(this, 330, 460, handsText, 24, '#cfe8ff', { align: 'center', wordWrap: { width: 480 } }).setOrigin(0.5));
    this.layer.add(txt(this, 330, 520, '同じ元素どうしの結合', 24, '#7fd4ff').setOrigin(0.5));

    const x = 640;
    this.layer.add(txt(this, x, 120, `${s.formula}（${s.name.ja}）`, 46, '#ffffff', { fontStyle: 'bold' }));
    let y = 200;
    s.properties.forEach((p) => {
      this.layer.add(txt(this, x, y, `・${p}`, 30, '#ffffff'));
      y += 48;
    });
    s.gameNotes.forEach((n) => {
      this.layer.add(txt(this, x, y, `・${n}`, 26, '#9fe0b8', { wordWrap: { width: 720 } }));
      y += 48;
    });
    s.dangers.forEach((d) => {
      this.layer.add(txt(this, x, y, `⚠ ${d}`, 24, '#ffb4b4', { wordWrap: { width: 720 } }));
      y += 72;
    });
    this.layer.add(txt(this, x, Math.max(y + 10, 520), '図鑑に登録しました', 30, '#ffd84a', { fontStyle: 'bold' }));
    this.layer.setAlpha(0);
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 350 });
    sfx('pickup');
    this.time.delayedCall(700, () => this.setReady(0));
  }
}
