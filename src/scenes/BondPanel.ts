import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS, KIND_COLORS } from '../config';
import { game, bus, MAX_ATOMS } from '../core/state';
import { txt, panel, button, atomToken, Button } from '../ui/widgets';
import { element } from '../data/elements';
import { tryCovalent, explainFailure, composition } from '../chem/bonding';
import { substanceByComposition, substance, kindOf, KIND_LABEL } from '../data/substances';
import { SCRIPT, SPEAKER_NAME } from '../data/script';
import { sfx } from '../core/audio';

const SLOT_X = [520, 720, 920];
const SLOT_Y = 330;
const SLOT_R = 54;

/** "BOND" panel. Stage 1 has only the つなぐ (covalent) mode; the other three kinds are shown locked. */
export class BondPanel extends Phaser.Scene {
  private slots: (string | null)[] = [null, null, null];
  private slotLayer!: Phaser.GameObjects.Container;
  private bondGfx!: Phaser.GameObjects.Graphics;
  private tray!: Phaser.GameObjects.Container;
  private inv!: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Container;
  private bondBtn!: Button;
  private busy = false;

  constructor() {
    super('BondPanel');
  }

  create() {
    this.slots = [null, null, null];
    this.busy = false;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0).setInteractive();
    panel(this, 30, 24, GAME_W - 60, GAME_H - 48, 0x10152a, 0.97, KIND_COLORS.covalent);

    txt(this, 70, 46, 'BOND ― 結合', 40, '#ffffff', { fontStyle: 'bold' });
    txt(this, 70, 98, 'カーボンの力で、原子の「結合の手」をつなぐ。手が全部つながったときだけ、分子ができる。', 22, '#cfe8ff');

    // the four kinds of 合わさり方: only つなぐ is open in stage 1
    const tabs: [string, number, boolean][] = [
      ['つなぐ', KIND_COLORS.covalent, true],
      ['わたす', KIND_COLORS.ionic, false],
      ['まぜる', KIND_COLORS.mixture, false],
      ['反応', KIND_COLORS.reaction, false],
    ];
    tabs.forEach(([label, col, open], i) => {
      const x = 760 + i * 150, y = 62;
      const g = this.add.graphics();
      g.fillStyle(open ? col : 0x2a2f40, open ? 1 : 1);
      g.fillRoundedRect(x - 66, y - 26, 132, 52, 14);
      g.lineStyle(3, open ? 0xffffff : 0x4a5066, 1);
      g.strokeRoundedRect(x - 66, y - 26, 132, 52, 14);
      txt(this, x, y, open ? label : '？？？', 24, open ? '#10152a' : '#6a7088', { fontStyle: 'bold' }).setOrigin(0.5);
      if (!open) {
        const z = this.add.zone(x, y, 132, 52).setInteractive();
        z.on('pointerup', () => this.showStatus('この合わさり方は、冒険の先で出会えるかも……', '#aab4d0'));
      }
    });
    button(this, GAME_W - 110, 62, 120, 56, 'とじる', () => this.close(), 0x3a3f55, 24);

    // slots
    this.bondGfx = this.add.graphics();
    this.slotLayer = this.add.container(0, 0);
    const sg = this.add.graphics();
    SLOT_X.forEach((x) => {
      sg.lineStyle(4, 0x8fd3ff, 0.35);
      sg.strokeCircle(x, SLOT_Y, SLOT_R + 10);
    });
    txt(this, 720, 190, 'スロット（タップで外す）', 22, '#8fa5c8').setOrigin(0.5);
    this.status = txt(this, 720, 470, '', 28, '#ffffff', { align: 'center', wordWrap: { width: 860 } }).setOrigin(0.5);

    this.bondBtn = button(this, 720, 565, 300, 84, 'BOND！', () => this.tryBond(), 0x1f8a5a, 38);
    button(this, 950, 565, 130, 64, 'クリア', () => this.clearSlots(), 0x3a3f55, 24);

    // tray of atoms
    txt(this, 80, 610, '手持ちの原子（タップでスロットへ）', 22, '#8fa5c8');
    this.tray = this.add.container(0, 0);
    // inventory with BREAK / equip
    txt(this, 1100, 160, '作った物質', 24, '#8fa5c8');
    this.inv = this.add.container(0, 0);
    this.hint = this.add.container(0, 0);

    // Carbon at the side (shy)
    this.add.image(170, 330, 'pt_carbon').setDisplaySize(200, 200);
    txt(this, 170, 450, 'カーボン（C）\n結合の手 4本', 22, '#cfe8ff', { align: 'center' }).setOrigin(0.5, 0);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-ENTER', () => this.tryBond());
    this.refresh();
    this.showStatus('原子を2つ以上スロットに入れて、BOND！', '#ffffff');
  }

  private placedCount(sym: string) {
    return this.slots.filter((s) => s === sym).length;
  }

  private refresh() {
    // tray
    this.tray.removeAll(true);
    const syms = game.data.discovered.elements.filter((s) => s !== 'C');
    if (!syms.length) this.tray.add(txt(this, 80, 660, 'まだ原子を持っていない。川辺や台地の結晶を探してみよう。', 24, '#aab4d0'));
    syms.forEach((sym, i) => {
      const x = 140 + i * 190, y = 710;
      const left = game.atoms(sym) - this.placedCount(sym);
      const e = element(sym);
      const tok = atomToken(this, x, y, sym, 40, e.hands, ELEMENT_COLORS[sym] ?? 0x888888);
      tok.setAlpha(left > 0 ? 1 : 0.35);
      this.tray.add(tok);
      this.tray.add(txt(this, x + 66, y - 20, `×${left}`, 30, '#ffffff'));
      this.tray.add(txt(this, x, y + 50, `${e.ja}（手${e.hands}本）`, 18, '#cfe8ff').setOrigin(0.5, 0));
      const z = this.add.zone(x + 20, y, 150, 110).setInteractive();
      this.tray.add(z);
      z.on('pointerup', () => this.addToSlot(sym));
    });

    // slots (shown re-ordered so the atom holding the others sits in the middle)
    this.slotLayer.removeAll(true);
    const view = this.layout();
    view.order.forEach((slotIndex, pos) => {
      const sym = this.slots[slotIndex]!;
      const x = SLOT_X[pos];
      const tok = atomToken(this, x, SLOT_Y, sym, SLOT_R, null, ELEMENT_COLORS[sym] ?? 0x888888);
      this.slotLayer.add(tok);
      const z = this.add.zone(x, SLOT_Y, SLOT_R * 2.4, SLOT_R * 2.4).setInteractive();
      this.slotLayer.add(z);
      z.on('pointerup', () => {
        if (this.busy) return;
        this.slots.splice(slotIndex, 1);
        this.slots.push(null);
        sfx('ui');
        this.refresh();
      });
    });
    this.drawPreview(view);
    this.drawInventory();
  }

  /** Display order of the filled slots plus the best arrangement of hands. */
  private layout() {
    const idx = this.slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    const syms = idx.map((i) => this.slots[i]!);
    const a = syms.length >= 2 ? tryCovalent(syms, (s) => element(s).hands) : null;
    let orderK = syms.map((_, k) => k); // indices into syms
    if (a && syms.length === 3) {
      const deg = syms.map(() => 0);
      a.bonds.forEach(([p, q]) => { deg[p]++; deg[q]++; });
      const centre = deg.indexOf(Math.max(...deg));
      if (deg[centre] >= 2 || (deg[centre] === 1 && a.bonds.length === 1)) {
        const others = orderK.filter((k) => k !== centre);
        // keep a lone atom (no bond) at the right end
        if (a.bonds.length === 1) {
          const [p, q] = a.bonds[0];
          const lone = orderK.find((k) => k !== p && k !== q)!;
          orderK = [p, q, lone];
        } else orderK = [others[0], centre, others[1]];
      }
    }
    const posOfK = new Map<number, number>();
    orderK.forEach((k, pos) => posOfK.set(k, pos));
    return { idx, syms, a, order: orderK.map((k) => idx[k]), posOfK };
  }

  /** Show the best arrangement of hands for what is in the slots: lines for bonds, glowing dots for free hands. */
  private drawPreview(view: ReturnType<BondPanel['layout']>) {
    const g = this.bondGfx;
    g.clear();
    const { syms, a, posOfK } = view;
    if (!syms.length) return;
    const free = a ? a.free : syms.map((s) => element(s).hands ?? 0);
    if (a) {
      for (const [p, q, order] of a.bonds) {
        const x1 = SLOT_X[posOfK.get(p)!], x2 = SLOT_X[posOfK.get(q)!];
        const offsets = order === 1 ? [0] : order === 2 ? [-10, 10] : [-16, 0, 16];
        g.lineStyle(8, 0xffffff, 0.95);
        offsets.forEach((o) => g.lineBetween(Math.min(x1, x2) + SLOT_R - 4, SLOT_Y + o, Math.max(x1, x2) - SLOT_R + 4, SLOT_Y + o));
      }
    }
    // free (unconnected) hands glow yellow
    syms.forEach((_, k) => {
      const n = free[k];
      const cx = SLOT_X[posOfK.get(k)!];
      for (let h = 0; h < n; h++) {
        const ang = Math.PI / 2 + (h - (n - 1) / 2) * 0.75;
        const x = cx + Math.cos(ang) * (SLOT_R + 24);
        const y = SLOT_Y + Math.sin(ang) * (SLOT_R + 24);
        g.lineStyle(7, 0xffd84a, 1);
        g.lineBetween(cx + Math.cos(ang) * SLOT_R, SLOT_Y + Math.sin(ang) * SLOT_R, x, y);
        g.fillStyle(0xffd84a, 1);
        g.fillCircle(x, y, 10);
      }
    });
  }

  private drawInventory() {
    this.inv.removeAll(true);
    const ids = ['h2', 'o2', 'h2o'].filter((id) => game.knows('substances', id));
    if (!ids.length) {
      this.inv.add(txt(this, 1100, 200, 'まだない', 24, '#6a7088'));
      return;
    }
    ids.forEach((id, i) => {
      const s = substance(id);
      const y = 215 + i * 112;
      const kind = kindOf(s);
      const g = this.add.graphics();
      g.fillStyle(0x1b2340, 1);
      g.fillRoundedRect(1090, y - 8, 300, 100, 12);
      g.fillStyle(KIND_COLORS[kind], 1);
      g.fillRect(1090, y - 8, 8, 100);
      this.inv.add(g);
      this.inv.add(txt(this, 1110, y, `${s.formula}  ${s.name.ja}`, 26, '#ffffff', { fontStyle: 'bold' }));
      this.inv.add(txt(this, 1110, y + 36, `×${game.count(id)}`, 26, '#cfe8ff'));
      const br = button(this, 1330, y + 52, 100, 44, 'BREAK', () => this.breakSubstance(id), 0x6a3a8a, 20);
      br.setEnabled(game.count(id) > 0);
      this.inv.add(br.root);
      if (id === 'h2o') {
        const eq = game.data.equipped === 'h2o';
        const eb = button(this, 1225, y + 52, 100, 44, eq ? 'そうび中' : 'そうび', () => {
          game.data.equipped = 'h2o';
          bus.emit('inventory');
          this.refresh();
        }, eq ? 0x1f6a8a : 0x2a3a66, 18);
        this.inv.add(eb.root);
      }
    });
    this.inv.add(txt(this, 1100, 215 + ids.length * 112, 'H₂は浮力装置、O₂はたいまつに\n近づいて「しらべる」で使える', 18, '#8fa5c8'));
  }

  private addToSlot(sym: string) {
    if (this.busy) return;
    if (game.atoms(sym) - this.placedCount(sym) <= 0) {
      sfx('fail');
      this.showStatus(`${sym}のかけらが足りない。結晶を探そう。`, '#ffb4b4');
      return;
    }
    const i = this.slots.indexOf(null);
    if (i < 0) {
      sfx('fail');
      this.showStatus('スロットがいっぱい。タップして外せる。', '#ffb4b4');
      return;
    }
    this.slots[i] = sym;
    sfx('ui');
    this.refresh();
    const n = this.slots.filter(Boolean).length;
    this.showStatus(n < 2 ? 'もう1つ以上入れてみよう' : '黄色い手は、まだつながっていない手', '#ffffff');
  }

  private clearSlots() {
    this.slots = [null, null, null];
    this.refresh();
    this.showStatus('原子を2つ以上スロットに入れて、BOND！', '#ffffff');
  }

  private showStatus(s: string, color: string) {
    this.status.setText(s).setColor(color);
  }

  private tryBond() {
    if (this.busy) return;
    const syms = this.slots.filter((s): s is string => !!s);
    if (syms.length < 2) {
      sfx('fail');
      this.showStatus('原子が1つだけでは、結合する相手がいない。', '#ffb4b4');
      return;
    }
    game.data.stats.bondAttempts++;
    const a = tryCovalent(syms, (s) => element(s).hands);
    if (!a.ok) {
      game.data.stats.bondFailures++;
      sfx('fail');
      this.cameras.main.shake(180, 0.006);
      this.showStatus(`結合しなかった……\n${explainFailure(syms, a)}`, '#ffb4b4');
      this.slotLayer.list.forEach((o) => this.tweens.add({ targets: o, x: '+=8', duration: 50, yoyo: true, repeat: 3 }));
      const key = syms.slice().sort().join('');
      if (key === 'HO' && !game.flag('hint_ho') && game.hasParty('oxy')) {
        game.setFlag('hint_ho');
        this.showHint('hint_ho_1');
      } else if (game.data.stats.bondFailures === 2 && game.hasParty('hyde')) this.showHint('hint_any_2');
      else if (game.data.stats.bondFailures >= 3) this.showHint('hint_any_3');
      return;
    }
    const s = substanceByComposition(composition(syms));
    if (!s || !s.implemented) {
      sfx('fail');
      this.showStatus('手はつながるけれど、この世界ではまだ作れないようだ。', '#ffd9a0');
      return;
    }
    if (!game.takeAtoms(syms)) return;
    game.addSubstance(s.id);
    const first = game.discover('substances', s.id);
    game.discover('bondKinds', kindOf(s));
    if (s.id === 'h2o' && !game.data.equipped) game.data.equipped = 'h2o';
    sfx('bondTry');
    this.busy = true;
    this.slots = [null, null, null];
    if (first) {
      // full ceremony
      this.scene.pause();
      this.scene.setVisible(false);
      this.scene.launch('Ceremony', { id: s.id, bonds: a.bonds, atoms: syms });
      this.scene.bringToTop('Ceremony');
      this.events.once(Phaser.Scenes.Events.RESUME, () => {
        this.scene.setVisible(true);
        this.busy = false;
        this.refresh();
        if (s.ceremony === 'big') this.close(s.id);
        else this.showStatus(`${s.formula}（${s.name.ja}）を作った！`, '#9fe0b8');
      });
    } else {
      // quick repeat
      sfx('snap');
      this.busy = false;
      this.refresh();
      this.showStatus(`${s.formula}（${s.name.ja}）を作った！　×${game.count(s.id)}`, '#9fe0b8');
      bus.emit('bond-made', s.id);
    }
  }

  private breakSubstance(id: string) {
    if (this.busy) return;
    const s = substance(id);
    for (const [sym, n] of Object.entries(s.composition)) {
      if (game.atoms(sym) + n > MAX_ATOMS) {
        sfx('fail');
        this.showStatus(`${sym}がいっぱいで、分けた原子を持ちきれない。`, '#ffb4b4');
        return;
      }
    }
    if (!game.useSubstance(id)) return;
    for (const [sym, n] of Object.entries(s.composition)) game.addAtom(sym, n);
    sfx('snap');
    const parts = Object.entries(s.composition).map(([k, n]) => `${k}×${n}`).join('と');
    this.showStatus(`BREAK！ ${s.formula}を分けて、${parts}に戻した。\n（現実では${s.break.realMethod ?? '特別な方法'}で分けられる）`, '#d9c8ff');
    this.refresh();
  }

  private showHint(key: string) {
    this.hint.removeAll(true);
    const line = SCRIPT[key]?.[0];
    if (!line) return;
    const x = 700, y = 650;
    this.hint.add(panel(this, x, y - 10, 690, 100, 0x1b2340, 0.98, 0xffd84a));
    this.hint.add(this.add.image(x + 50, y + 40, `pt_${line.who}`).setDisplaySize(80, 80));
    this.hint.add(txt(this, x + 100, y, SPEAKER_NAME[line.who], 20, '#ffd84a'));
    this.hint.add(txt(this, x + 100, y + 30, line.text, 22, '#ffffff', { wordWrap: { width: 580, useAdvancedWrap: false } }));
    this.hint.setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 250 });
    sfx('talk');
  }

  private close(madeId?: string) {
    this.scene.stop();
    bus.emit('world-resume');
    if (madeId) bus.emit('bond-made', madeId);
  }
}
