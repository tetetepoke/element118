// CHARACTER BOND: Carbon + one travelling partner. The player picks the partner.
// C + Si → SiC (silicon carbide, a covalent network solid) → SiC FORM (game fiction).
import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS, KIND_COLORS } from '../config';
import { game, bus, EV } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { sfx } from '../core/audio';
import { substance } from '../data/substances';

const PARTNER_ELEMENT: Record<string, string> = { hyde: 'H', oxy: 'O', silica: 'Si' };
const PARTNER_NAME: Record<string, string> = { hyde: 'ハイド', oxy: 'オキシ', silica: 'シリカ' };

export class FormBond extends Phaser.Scene {
  private pick: string | null = null;
  private near = true;
  private mode = 'together';
  private slot!: Phaser.GameObjects.Container;
  private msg!: Phaser.GameObjects.Text;
  private bondBtn!: ReturnType<typeof button>;
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super('FormBond');
  }

  init(data: { near?: boolean; mode?: string }) {
    this.pick = null;
    this.near = data?.near ?? true;
    this.mode = data?.mode ?? 'together';
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0).setInteractive();
    this.root = this.add.container(0, 0);
    const r = this.root;
    r.add(panel(this, 60, 40, GAME_W - 120, GAME_H - 80, 0x10152a, 0.98, KIND_COLORS.network));
    r.add(txt(this, 110, 70, 'BOND —— 仲間とBOND', 44, '#ffffff', { fontStyle: 'bold' }));
    r.add(txt(this, 110, 130, 'カーボンと、いっしょにいる仲間を1人えらんで結合する。元素の組み合わせしだいで、新しい FORM が生まれる。', 22, '#cfe8ff'));

    // Carbon (fixed)
    this.token(r, 330, 330, 'C', 'カーボン', true);
    r.add(txt(this, 470, 330, '＋', 80, '#ffffff').setOrigin(0.5));
    this.slot = this.add.container(610, 330);
    r.add(this.slot);
    this.drawSlot();

    // partners travelling with Carbon
    const ids = ['silica', ...game.data.activeParty.filter((id) => id !== 'silica')].filter((id) => id === 'silica' ? game.flag('s2_silica_with') : true);
    r.add(txt(this, 110, 520, 'いっしょにいる仲間（タップでえらぶ）', 24, '#8fa5c8'));
    ids.forEach((id, i) => {
      const x = 200 + i * 190;
      const c = this.token(r, x, 640, PARTNER_ELEMENT[id] ?? '?', PARTNER_NAME[id] ?? id, false);
      const z = this.add.zone(x, 640, 140, 160).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        this.pick = id;
        sfx('ui');
        this.drawSlot();
      });
      r.add(z);
      void c;
    });

    this.msg = txt(this, 820, 300, this.near ? '' : 'カーボンとシリカが離れている。近くに集まってからBONDしよう。', 26, '#ffd84a', { wordWrap: { width: 520, useAdvancedWrap: true } });
    r.add(this.msg);
    this.bondBtn = button(this, 1060, 450, 300, 90, 'BOND！', () => this.tryBond(), 0x5a4ab8, 40);
    r.add(this.bondBtn.root);
    r.add(button(this, 1060, 580, 300, 64, '原子をつなぐ →', () => {
      this.scene.stop();
      this.scene.launch('BondPanel');
      this.scene.bringToTop('BondPanel');
    }, 0x1f6a5a, 26).root);
    r.add(button(this, 1060, 680, 300, 64, 'とじる', () => this.close(), 0x3a3f55, 26).root);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private token(r: Phaser.GameObjects.Container, x: number, y: number, sym: string, name: string, fixed: boolean) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(ELEMENT_COLORS[sym] ?? 0x666666, 1);
    g.fillCircle(0, 0, 58);
    g.lineStyle(5, fixed ? 0xffd84a : 0xffffff, 0.9);
    g.strokeCircle(0, 0, 58);
    c.add([g, txt(this, 0, -4, sym, 50, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5), txt(this, 0, 80, name, 22, '#ffffff').setOrigin(0.5)]);
    r.add(c);
    return c;
  }

  private drawSlot() {
    this.slot.removeAll(true);
    const g = this.add.graphics();
    if (!this.pick) {
      g.lineStyle(4, 0x8fa5c8, 0.8);
      g.strokeCircle(0, 0, 58);
      this.slot.add([g, txt(this, 0, 0, '？', 46, '#8fa5c8').setOrigin(0.5)]);
      return;
    }
    const sym = PARTNER_ELEMENT[this.pick] ?? '?';
    g.fillStyle(ELEMENT_COLORS[sym] ?? 0x666666, 1);
    g.fillCircle(0, 0, 58);
    g.lineStyle(5, 0xffffff, 0.9);
    g.strokeCircle(0, 0, 58);
    this.slot.add([g, txt(this, 0, -4, sym, 50, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5), txt(this, 0, 80, PARTNER_NAME[this.pick], 22, '#ffffff').setOrigin(0.5)]);
  }

  private tryBond() {
    if (!this.pick) {
      this.msg.setText('仲間を1人えらんでください。');
      return;
    }
    if (this.pick === 'silica' && !this.near) {
      this.msg.setText('カーボンとシリカが離れている。近くに集まってからBONDしよう。');
      sfx('fail');
      return;
    }
    game.data.stats.bondAttempts++;
    if (this.pick !== 'silica') {
      game.data.stats.bondFailures++;
      sfx('fail');
      this.msg.setText(`C ＋ ${PARTNER_ELEMENT[this.pick]}……この組み合わせで起きることは、まだわからない。`);
      return;
    }
    if (this.mode === 'sic') {
      this.msg.setText('いまは、もう SiC FORM だ。');
      return;
    }
    if (game.flag('s2_sic_found')) {
      // already known: quick BOND
      this.scene.stop();
      bus.emit('world-resume');
      bus.emit('form-made', 'sic');
      return;
    }
    void this.ceremony();
  }

  /** C + Si → BOND → SiC → SILICON CARBIDE → (network structure) → NEW FORM DISCOVERED */
  private async ceremony() {
    const wait = (ms: number) => new Promise<void>((res) => this.time.delayedCall(ms, res));
    this.root.setVisible(false);
    const s = substance('sic');
    const cx = GAME_W / 2, cy = GAME_H / 2;
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 1).setOrigin(0));
    // two atoms approach
    const atom = (sym: string, x: number) => {
      const a = this.add.container(x, cy);
      const g = this.add.graphics();
      g.fillStyle(ELEMENT_COLORS[sym], 1);
      g.fillCircle(0, 0, 70);
      g.lineStyle(5, 0xffffff, 0.9);
      g.strokeCircle(0, 0, 70);
      a.add([g, txt(this, 0, 0, sym, 60, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5)]);
      c.add(a);
      return a;
    };
    const aC = atom('C', cx - 380), aSi = atom('Si', cx + 380);
    const plus = txt(this, cx, cy, '＋', 90, '#ffffff').setOrigin(0.5);
    c.add(plus);
    sfx('bondTry');
    await wait(700);
    this.tweens.add({ targets: aC, x: cx - 80, duration: 700, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: aSi, x: cx + 80, duration: 700, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: plus, alpha: 0, duration: 400 });
    await wait(720);
    sfx('snap');
    this.cameras.main.flash(300, 210, 220, 255);
    const bondTxt = txt(this, cx, cy - 170, 'BOND！', 80, '#ffd84a', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
    c.add(bondTxt);
    await wait(900);
    // name
    sfx('bigchime');
    const formula = txt(this, cx, cy + 140, 'SiC', 96, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    const name = txt(this, cx, cy + 230, 'SILICON CARBIDE　／　炭化ケイ素', 40, '#cfe8ff').setOrigin(0.5).setAlpha(0);
    c.add([formula, name]);
    this.tweens.add({ targets: [formula, name], alpha: 1, duration: 500 });
    await wait(1800);
    // structure: not a molecule — a network
    this.tweens.add({ targets: [aC, aSi, bondTxt, formula, name], alpha: 0, duration: 400 });
    await wait(420);
    const net = this.add.container(cx, cy - 40);
    const g = this.add.graphics();
    const pts: [number, number, string][] = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) pts.push([(i - 2.5) * 110 + (j % 2) * 55, (j - 1.5) * 90, (i + j) % 2 ? 'Si' : 'C']);
    g.lineStyle(4, 0x9fb8ff, 0.8);
    for (const [x1, y1] of pts) for (const [x2, y2] of pts) if (Math.hypot(x1 - x2, y1 - y2) < 115 && Math.hypot(x1 - x2, y1 - y2) > 1) g.lineBetween(x1, y1, x2, y2);
    net.add(g);
    for (const [x, y, sym] of pts) {
      const gg = this.add.graphics();
      gg.fillStyle(ELEMENT_COLORS[sym], 1);
      gg.fillCircle(x, y, sym === 'Si' ? 22 : 18);
      net.add([gg, txt(this, x, y, sym, 16, '#ffffff').setOrigin(0.5)]);
    }
    net.setAlpha(0);
    c.add(net);
    this.tweens.add({ targets: net, alpha: 1, duration: 600 });
    const cap1 = txt(this, cx, cy + 210, 'SiCは小さな分子ではない。SiとCが1：1で、網目のようにどこまでもつながった結晶（共有結合の結晶）。', 26, '#ffffff', { align: 'center', wordWrap: { width: 1200, useAdvancedWrap: true } }).setOrigin(0.5);
    const cap2 = txt(this, cx, cy + 270, 'とても硬く、高い温度に強い。（本物の科学）', 24, '#9fb8ff').setOrigin(0.5);
    c.add([cap1, cap2]);
    await wait(3600);
    // new form
    this.tweens.add({ targets: [net, cap1, cap2], alpha: 0, duration: 400 });
    await wait(420);
    sfx('discover');
    this.cameras.main.flash(250, 255, 240, 200);
    const nf = txt(this, cx, 170, 'NEW FORM DISCOVERED', 64, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5);
    const fn = txt(this, cx, 260, 'SiC FORM', 80, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    const look = this.textures.exists('sic') ? this.add.sprite(cx, 420, 'sic', 0).setScale(5) : this.add.sprite(cx, 420, 'carbonm', 0).setScale(5).setTint(0xbfd0ff);
    const ab = txt(this, cx, 560, 'HARD BREAK ―― 硬い岩をこわす\nHEAT RESIST ―― 熱い地帯を進む', 32, '#cfe8ff', { align: 'center' }).setOrigin(0.5);
    const note = txt(this, cx, 660, '※ SiC FORM はゲームの中の架空の能力。本物のSiCの「硬さ」「熱への強さ」をモチーフにしている。\n人がSiCになったり、熱い所を歩けるようになったりはしない。', 20, '#9fe0b8', { align: 'center' }).setOrigin(0.5);
    c.add([nf, fn, look, ab, note]);
    game.discover('substances', 'sic');
    game.discover('bondKinds', 'network');
    game.addSubstance('sic', 0);
    bus.emit(EV.DISCOVER_SUBSTANCE, 'sic');
    const ok = button(this, cx, 750, 320, 70, 'つづける', () => {
      this.scene.stop();
      bus.emit('world-resume');
      bus.emit('form-made', 'sic');
    }, 0x5a4ab8, 30);
    c.add(ok.root);
    void s;
  }

  private close() {
    this.scene.stop();
    bus.emit('world-resume');
  }
}
