// Party: Carbon is always there; up to two companions travel with him. Swap at 元素碑 / camps / villages.
import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS } from '../config';
import { game, bus } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { sfx } from '../core/audio';

const INFO: Record<string, { sym: string; name: string; note: string }> = {
  hyde: { sym: 'H', name: 'ハイド', note: '水素。元気で前向き。' },
  oxy: { sym: 'O', name: 'オキシ', note: '酸素。しっかり者。' },
  silica: { sym: 'Si', name: 'シリカ', note: 'ケイ素。論理的で慎重。' },
};

export class PartySelect extends Phaser.Scene {
  private chosen: string[] = [];
  private locked: string[] = [];
  private forced = false;
  private cards = new Map<string, Phaser.GameObjects.Graphics>();
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('PartySelect');
  }

  init(data: { forced?: boolean; locked?: string[] }) {
    this.forced = !!data?.forced;
    this.locked = data?.locked ?? [];
    this.chosen = game.data.activeParty.slice(0, 2);
    for (const id of this.locked) if (game.hasParty(id) && !this.chosen.includes(id)) this.chosen = [id, ...this.chosen].slice(0, 2);
    this.cards.clear();
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0).setInteractive();
    panel(this, 160, 70, GAME_W - 320, GAME_H - 140, 0x10152a, 0.98, 0x59e0a8);
    txt(this, GAME_W / 2, 110, 'いっしょに行く仲間（最大2人）', 40, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, GAME_W / 2, 160, 'カーボン ＋ SLOT 1 ＋ SLOT 2 の3人で進む。えらばなかった仲間は元素碑で待っている。', 22, '#8fa5c8').setOrigin(0.5);
    const ids = game.data.party.filter((id) => INFO[id]);
    ids.forEach((id, i) => {
      const x = GAME_W / 2 + (i - (ids.length - 1) / 2) * 300, y = 380;
      const g = this.add.graphics();
      this.cards.set(id, g);
      const info = INFO[id];
      const c = this.add.container(x, y);
      const icon = this.add.graphics();
      icon.fillStyle(ELEMENT_COLORS[info.sym] ?? 0x666666, 1);
      icon.fillCircle(0, -50, 52);
      c.add([g, icon, txt(this, 0, -54, info.sym, 46, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5), txt(this, 0, 30, info.name, 30, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5), txt(this, 0, 74, info.note, 20, '#cfe8ff').setOrigin(0.5)]);
      if (this.locked.includes(id)) c.add(txt(this, 0, 110, '（このステージでは必須）', 18, '#ffd84a').setOrigin(0.5));
      const z = this.add.zone(x, y, 260, 300).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.toggle(id));
    });
    this.msg = txt(this, GAME_W / 2, 590, '', 24, '#ffd84a').setOrigin(0.5);
    button(this, GAME_W / 2, 670, 340, 76, 'これで行く', () => this.confirm(), 0x2a6a4a, 30);
    this.redraw();
  }

  private toggle(id: string) {
    if (this.locked.includes(id)) {
      this.msg.setText('シリカはこのステージで必要な仲間です。');
      return;
    }
    sfx('ui');
    if (this.chosen.includes(id)) this.chosen = this.chosen.filter((x) => x !== id);
    else if (this.chosen.length < 2) this.chosen.push(id);
    else {
      // replace the last non-locked pick
      const idx = this.chosen.findIndex((x) => !this.locked.includes(x));
      if (idx >= 0) this.chosen.splice(idx, 1);
      this.chosen.push(id);
    }
    this.msg.setText('');
    this.redraw();
  }

  private redraw() {
    for (const [id, g] of this.cards) {
      const on = this.chosen.includes(id);
      g.clear();
      g.fillStyle(on ? 0x1f4a3a : 0x1a1f33, 1);
      g.fillRoundedRect(-125, -140, 250, 280, 18);
      g.lineStyle(5, on ? 0x59e0a8 : 0x3a4060, 1);
      g.strokeRoundedRect(-125, -140, 250, 280, 18);
    }
  }

  private confirm() {
    const need = Math.min(2, game.data.party.filter((id) => INFO[id]).length);
    if (this.chosen.length < need) {
      this.msg.setText(`あと${need - this.chosen.length}人えらんでください。`);
      return;
    }
    game.setActiveParty(this.chosen);
    sfx('discover');
    this.scene.stop();
    bus.emit('party-changed');
    bus.emit('world-resume');
  }
}
