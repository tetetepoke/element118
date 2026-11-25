import Phaser from 'phaser';
import { GAME_W, GAME_H, KIND_COLORS } from '../config';
import { game, bus } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { sfx } from '../core/audio';

export class StageClear extends Phaser.Scene {
  constructor() {
    super('StageClear');
  }

  create() {
    sfx('bigchime');
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.85).setOrigin(0).setInteractive();
    panel(this, 160, 60, GAME_W - 320, GAME_H - 120, 0x10152a, 0.98, 0xffd84a);
    txt(this, GAME_W / 2, 110, '第一段階クリア！', 56, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5);
    const d = game.data;
    const t = Math.floor(d.playTimeSec);
    const rows: [string, string][] = [
      ['プレイ時間', `${Math.floor(t / 60)}分${t % 60}秒`],
      ['発見した元素', d.discovered.elements.map((e) => e).join('　') || 'なし'],
      ['つなぐ（同じ元素どうし）', ['h2', 'o2'].filter((id) => d.discovered.substances.includes(id)).map((id) => (id === 'h2' ? 'H₂' : 'O₂')).join('　') || 'なし'],
      ['つなぐ（分子）', d.discovered.substances.includes('h2o') ? 'H₂O（水）' : 'なし'],
      ['化学反応', d.discovered.reactions.includes('combustion') ? '燃焼' : 'なし'],
      ['BONDに挑戦した回数', `${d.stats.bondAttempts}回（うまくいかなかった ${d.stats.bondFailures}回）`],
    ];
    const colors = ['#ffffff', '#ffffff', '#' + KIND_COLORS.element_bond.toString(16), '#' + KIND_COLORS.covalent.toString(16), '#' + KIND_COLORS.reaction.toString(16), '#ffffff'];
    rows.forEach(([k, v], i) => {
      txt(this, 260, 200 + i * 62, k, 28, '#8fa5c8');
      txt(this, 720, 200 + i * 62, v, 30, colors[i], { fontStyle: 'bold' });
    });
    txt(this, GAME_W / 2, 600, '元素は組み合わさると性質が変わる。でも、合わさり方は1種類じゃない――\nこの先「滝の崖」で、新しい合わさり方が待っている（次のバージョン）', 24, '#cfe8ff', { align: 'center' }).setOrigin(0.5);
    button(this, GAME_W / 2 - 200, 700, 340, 72, '冒険を続ける', () => {
      this.scene.stop();
      const w = this.scene.get('World') as unknown as { player: { lock: (v: boolean) => void }; busy: boolean };
      w.player.lock(false);
      (w as unknown as { busy: boolean }).busy = false;
      bus.emit('world-resume');
    }, 0x1f6a8a, 30);
    button(this, GAME_W / 2 + 200, 700, 340, 72, 'タイトルへ', () => {
      this.scene.stop('UI');
      this.scene.stop('World');
      this.scene.stop();
      this.scene.start('Title');
    }, 0x3a3f55, 30);
  }
}
