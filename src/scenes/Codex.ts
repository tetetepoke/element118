import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS, KIND_COLORS, SHOW_UNREVIEWED_FACTS } from '../config';
import { game, bus } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { ELEMENTS, ElementInfo } from '../data/elements';
import { SUBSTANCES, REACTIONS, Substance, kindOf, KIND_LABEL } from '../data/substances';

type Tab = 'elements' | 'substances' | 'kinds';

/** 元素図鑑: periodic table (118 cells, dark until discovered), substances, and the four kinds of 合わさり方. */
export class Codex extends Phaser.Scene {
  private tab: Tab = 'elements';
  private body!: Phaser.GameObjects.Container;
  private detail?: Phaser.GameObjects.Container;
  private returnTo: 'world' | 'menu' = 'world';

  constructor() {
    super('Codex');
  }

  init(data: { returnTo?: 'world' | 'menu' }) {
    this.returnTo = data?.returnTo ?? 'world';
    this.tab = 'elements';
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.9).setOrigin(0).setInteractive();
    panel(this, 20, 16, GAME_W - 40, GAME_H - 32, 0x0e1326, 0.98, 0xffd84a);
    txt(this, 56, 34, '元素図鑑', 40, '#ffd84a', { fontStyle: 'bold' });
    const tabs: [Tab, string][] = [
      ['elements', '元素（周期表）'],
      ['substances', '物質・反応'],
      ['kinds', '4つの合わさり方'],
    ];
    tabs.forEach(([t, label], i) => button(this, 450 + i * 250, 60, 230, 56, label, () => this.show(t), 0x2a3352, 22));
    button(this, GAME_W - 100, 60, 130, 56, 'とじる', () => this.close(), 0x3a3f55, 24);
    this.body = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => (this.detail ? this.closeDetail() : this.close()));
    this.input.keyboard?.on('keydown-C', () => this.close());
    this.show('elements');
  }

  private show(t: Tab) {
    this.tab = t;
    this.closeDetail();
    this.body.removeAll(true);
    if (t === 'elements') this.drawTable();
    else if (t === 'substances') this.drawSubstances();
    else this.drawKinds();
  }

  // ── periodic table ──
  private drawTable() {
    const known = new Set(game.data.discovered.elements);
    const cw = 72, ch = 60, x0 = 64, y0 = 120;
    const count = known.size;
    this.body.add(txt(this, GAME_W - 64, 700, `発見した元素　${count} ／ 118`, 28, '#ffd84a', { fontStyle: 'bold' }).setOrigin(1, 0));
    for (const e of ELEMENTS) {
      const rowY = e.row <= 7 ? y0 + (e.row - 1) * ch : y0 + 7 * ch + 22 + (e.row - 9) * ch;
      const x = x0 + (e.col - 1) * cw;
      const lit = known.has(e.symbol);
      const g = this.add.graphics();
      g.fillStyle(lit ? ELEMENT_COLORS[e.symbol] ?? 0x5a7ab0 : 0x1a2036, 1);
      g.fillRoundedRect(x + 2, rowY + 2, cw - 4, ch - 4, 6);
      g.lineStyle(2, lit ? 0xffffff : 0x2c3452, 1);
      g.strokeRoundedRect(x + 2, rowY + 2, cw - 4, ch - 4, 6);
      this.body.add(g);
      this.body.add(txt(this, x + 6, rowY + 4, String(e.z), 13, lit ? '#ffffff' : '#3d4766'));
      this.body.add(txt(this, x + cw / 2, rowY + ch / 2 + 4, e.symbol, 24, lit ? '#ffffff' : '#3d4766', { fontStyle: 'bold' }).setOrigin(0.5));
      if (lit) {
        this.tweens.add({ targets: g, alpha: { from: 0.75, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
        const z = this.add.zone(x + cw / 2, rowY + ch / 2, cw, ch).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => this.elementDetail(e));
        this.body.add(z);
      }
    }
    this.body.add(txt(this, x0 + 2 * cw, y0 + 7 * ch + 22 + 2 * ch + 8, '光っている元素をタップすると、くわしく見られる。暗いマスは、まだ見つけていない元素。', 20, '#8fa5c8'));
  }

  private elementDetail(e: ElementInfo) {
    this.closeDetail();
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerup', () => this.closeDetail()));
    c.add(panel(this, 220, 120, 1000, 580, 0x10152a, 0.99, ELEMENT_COLORS[e.symbol] ?? 0xffffff));
    const g = this.add.graphics();
    g.fillStyle(ELEMENT_COLORS[e.symbol] ?? 0x5a7ab0, 1);
    g.fillRoundedRect(260, 170, 220, 240, 14);
    g.lineStyle(4, 0xffffff, 1);
    g.strokeRoundedRect(260, 170, 220, 240, 14);
    c.add(g);
    c.add(txt(this, 276, 180, String(e.z), 30, '#ffffff'));
    c.add(txt(this, 370, 290, e.symbol, 100, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(txt(this, 370, 370, e.en, 24, '#ffffff').setOrigin(0.5));
    c.add(txt(this, 520, 170, `${e.symbol} ＝ ${e.en} ＝ ${e.ja}`, 40, '#ffffff', { fontStyle: 'bold' }));
    c.add(txt(this, 520, 228, `原子番号 ${e.z}　${e.hands ? `結合の手 ${e.hands}本（ゲームのルール）` : ''}`, 26, '#cfe8ff'));
    let y = 290;
    if (e.facts.length && (e.reviewed || SHOW_UNREVIEWED_FACTS)) {
      e.facts.forEach((f) => {
        c.add(txt(this, 520, y, `・${f}`, 24, '#ffffff', { wordWrap: { width: 660, useAdvancedWrap: true } }));
        y += f.length > 26 ? 70 : 40;
      });
      if (!e.reviewed) c.add(txt(this, 1196, 140, '監修前', 18, '#10152a', { backgroundColor: '#ffd84a', padding: { x: 8, y: 3 } }).setOrigin(1, 0));
    }
    if (e.symbol === 'C') c.add(txt(this, 260, 440, 'カーボンのお面の「C」と「6」は、\n元素記号と原子番号。', 22, '#9fe0b8'));
    c.add(txt(this, 520, 640, '「結合の手」は学校で習う考え方を使った簡略化で、例外もあります。', 18, '#8fa5c8'));
    c.add(button(this, 1150, 660, 120, 52, 'もどる', () => this.closeDetail(), 0x3a3f55, 22).root);
    this.detail = c;
  }

  // ── substances & reactions ──
  private drawSubstances() {
    const items: { title: string; sub: string; color: number; known: boolean; open: () => void }[] = [];
    for (const s of SUBSTANCES.filter((x) => x.implemented)) {
      const known = game.knows('substances', s.id);
      items.push({ title: known ? `${s.formula}　${s.name.ja}` : '？？？', sub: known ? KIND_LABEL[kindOf(s)] : 'まだ見つけていない', color: KIND_COLORS[kindOf(s)], known, open: () => this.substanceDetail(s) });
    }
    for (const r of REACTIONS.filter((x) => x.implemented)) {
      const known = game.knows('reactions', r.id);
      items.push({ title: known ? r.name.ja : '？？？', sub: known ? KIND_LABEL.reaction : 'まだ見つけていない', color: KIND_COLORS.reaction, known, open: () => this.reactionDetail(r.id) });
    }
    items.forEach((it, i) => {
      const x = 70 + (i % 2) * 660, y = 130 + Math.floor(i / 2) * 140;
      const g = this.add.graphics();
      g.fillStyle(it.known ? 0x1b2340 : 0x141a2c, 1);
      g.fillRoundedRect(x, y, 630, 120, 14);
      g.fillStyle(it.known ? it.color : 0x2c3452, 1);
      g.fillRoundedRect(x, y, 14, 120, { tl: 14, bl: 14, tr: 0, br: 0 });
      this.body.add(g);
      this.body.add(txt(this, x + 36, y + 18, it.title, 34, it.known ? '#ffffff' : '#4a5470', { fontStyle: 'bold' }));
      this.body.add(txt(this, x + 36, y + 70, it.sub, 22, it.known ? '#' + it.color.toString(16).padStart(6, '0') : '#4a5470'));
      if (it.known) {
        const z = this.add.zone(x + 315, y + 60, 630, 120).setInteractive({ useHandCursor: true });
        z.on('pointerup', it.open);
        this.body.add(z);
      }
    });
    this.body.add(txt(this, 70, GAME_H - 80, '色は合わさり方の種類。タップすると、くわしい説明と「ほんとうは？」が見られる。', 20, '#8fa5c8'));
  }

  private substanceDetail(s: Substance) {
    this.closeDetail();
    const kc = KIND_COLORS[kindOf(s)];
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerup', () => this.closeDetail()));
    c.add(panel(this, 120, 70, 1200, 680, 0x10152a, 0.99, kc));
    c.add(txt(this, 160, 96, `${s.formula}　${s.name.ja}（${s.name.en}）`, 44, '#ffffff', { fontStyle: 'bold' }));
    c.add(txt(this, 160, 160, `【${KIND_LABEL[kindOf(s)]}】　${s.state}　材料：${Object.entries(s.composition).map(([k, n]) => `${k}原子${n}個`).join('、')}`, 24, '#' + kc.toString(16).padStart(6, '0')));
    let y = 214;
    const section = (title: string, lines: string[], color: string, titleColor = '#ffd84a') => {
      if (!lines.length) return;
      c.add(txt(this, 160, y, title, 24, titleColor, { fontStyle: 'bold' }));
      y += 36;
      lines.forEach((l) => {
        const t = txt(this, 180, y, `・${l}`, 22, color, { wordWrap: { width: 1080, useAdvancedWrap: true } });
        c.add(t);
        y += t.height + 6;
      });
      y += 10;
    };
    if (s.reviewed || SHOW_UNREVIEWED_FACTS) section('わかっていること', [...s.properties.map((p) => p), ...s.facts], '#ffffff');
    section('ゲームのルール（現実とはちがう簡略化）', s.gameNotes, '#9fe0b8', '#9fe0b8');
    section('注意', s.dangers, '#ffb4b4', '#ff8a8a');
    if (s.realProcess) section('ほんとうは？', [s.realProcess], '#ffffff');
    if (s.break.allowed && s.break.realMethod) section('分けるには', [`ゲームではBREAKで原子に戻せる。現実では${s.break.realMethod}などで分けられる。`], '#cfe8ff');
    if (!s.reviewed) c.add(txt(this, 1300, 86, '監修前', 18, '#10152a', { backgroundColor: '#ffd84a', padding: { x: 8, y: 3 } }).setOrigin(1, 0));
    c.add(button(this, 1240, 712, 120, 52, 'もどる', () => this.closeDetail(), 0x3a3f55, 22).root);
    this.detail = c;
  }

  private reactionDetail(id: string) {
    this.closeDetail();
    const r = REACTIONS.find((x) => x.id === id)!;
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerup', () => this.closeDetail()));
    c.add(panel(this, 160, 110, 1120, 600, 0x10152a, 0.99, KIND_COLORS.reaction));
    c.add(txt(this, 200, 136, r.name.ja, 46, '#ffffff', { fontStyle: 'bold' }));
    c.add(txt(this, 200, 200, `【化学反応】　起きる条件：${r.conditions.join('・')}`, 24, '#ff9a7a'));
    let y = 260;
    const lines = (title: string, arr: string[], color: string) => {
      if (!arr.length) return;
      c.add(txt(this, 200, y, title, 24, '#ffd84a', { fontStyle: 'bold' }));
      y += 36;
      arr.forEach((l) => {
        const t = txt(this, 220, y, `・${l}`, 22, color, { wordWrap: { width: 1000, useAdvancedWrap: true } });
        c.add(t);
        y += t.height + 6;
      });
      y += 10;
    };
    if (r.reviewed || SHOW_UNREVIEWED_FACTS) lines('わかっていること', r.facts, '#ffffff');
    lines('ゲームのルール', r.gameNotes, '#9fe0b8');
    lines('注意', r.dangers, '#ffb4b4');
    if (!r.reviewed) c.add(txt(this, 1260, 126, '監修前', 18, '#10152a', { backgroundColor: '#ffd84a', padding: { x: 8, y: 3 } }).setOrigin(1, 0));
    c.add(button(this, 1200, 672, 120, 52, 'もどる', () => this.closeDetail(), 0x3a3f55, 22).root);
    this.detail = c;
  }

  // ── the four kinds ──
  private drawKinds() {
    const kinds: [string, string, string, string[]][] = [
      ['element_bond', 'つなぐ（同じ元素どうし）', '同じ元素の原子が、結合の手をつなぐ。', ['h2', 'o2']],
      ['covalent', 'つなぐ（分子）', 'ちがう元素の原子が、結合の手をつなぐ。', ['h2o', 'co2']],
      ['ionic', 'わたす（イオン結合）', '電子をわたしたり受け取ったりして、引き合う。', []],
      ['mixture', 'まぜる（混合物・合金）', '結合せずに、まざっているだけ。割合を変えられる。', []],
      ['reaction', '反応（化学反応）', '条件がそろうと、別の物質に変わる。', []],
    ];
    this.body.add(txt(this, 70, 112, '物質の「合わさり方」は1種類ではない。見つけた合わさり方が光る。', 24, '#cfe8ff'));
    kinds.forEach(([k, title, desc, ids], i) => {
      const y = 160 + i * 116;
      const seen = game.knows('bondKinds', k);
      const g = this.add.graphics();
      g.fillStyle(seen ? 0x1b2340 : 0x141a2c, 1);
      g.fillRoundedRect(70, y, GAME_W - 140, 100, 14);
      g.fillStyle(seen ? KIND_COLORS[k] : 0x2c3452, 1);
      g.fillRoundedRect(70, y, 14, 100, { tl: 14, bl: 14, tr: 0, br: 0 });
      this.body.add(g);
      this.body.add(txt(this, 106, y + 14, seen ? title : '？？？', 30, seen ? '#ffffff' : '#4a5470', { fontStyle: 'bold' }));
      this.body.add(txt(this, 106, y + 58, seen ? desc : 'まだ出会っていない合わさり方', 22, seen ? '#cfe8ff' : '#4a5470'));
      const found = k === 'reaction' ? (game.knows('reactions', 'combustion') ? ['燃焼'] : []) : ids.filter((id) => game.knows('substances', id)).map((id) => SUBSTANCES.find((s) => s.id === id)!.formula ?? '');
      if (seen && found.length) this.body.add(txt(this, GAME_W - 100, y + 34, found.join('　'), 30, '#' + KIND_COLORS[k].toString(16).padStart(6, '0'), { fontStyle: 'bold' }).setOrigin(1, 0));
    });
  }

  private closeDetail() {
    this.detail?.destroy();
    this.detail = undefined;
  }

  private close() {
    this.scene.stop();
    if (this.returnTo === 'menu') this.scene.resume('Menu');
    else bus.emit('world-resume');
  }
}
