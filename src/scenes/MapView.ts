// Map of the current stage with "？" marks for places that need an element we have not found yet.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { game } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { buildWorld, MAP_W, MAP_H } from '../data/worldMap';
import { buildValley, VMAP_W, VMAP_H } from '../data/valleyMap';
import { T2 } from '../assets/stage2Placeholders';
import { FIRST_SOLID } from '../assets/placeholders';

export class MapView extends Phaser.Scene {
  constructor() {
    super('MapView');
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.9).setOrigin(0).setInteractive();
    panel(this, 80, 40, GAME_W - 160, GAME_H - 80, 0x10152a, 0.98);
    const stage = game.data.stage;
    txt(this, 120, 66, stage >= 2 ? 'マップ ―― 珪晶の谷' : 'マップ ―― カーボ村〜炎の道', 34, '#ffffff', { fontStyle: 'bold' });
    let w: number, h: number, cell: (x: number, y: number) => number;
    if (stage >= 2) {
      const m = buildValley();
      w = VMAP_W; h = VMAP_H;
      cell = (x, y) => (m.solid[y][x] >= 0 ? (m.solid[y][x] === T2.WATER ? 3 : 1) : m.ground[y][x] === T2.HOT ? 2 : 0);
    } else {
      const m = buildWorld();
      w = MAP_W; h = MAP_H;
      cell = (x, y) => (m.solid[y][x] >= FIRST_SOLID ? 1 : 0);
    }
    const s = Math.min(640 / h, 6);
    const ox = 140, oy = 120;
    const g = this.add.graphics();
    const col = [0x8a8270, 0x2a2630, 0xd8582a, 0x3f8fd2];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      g.fillStyle(col[cell(x, y)], 1);
      g.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
    }
    // player
    const px = game.data.player.x / 16, py = game.data.player.y / 16;
    const me = this.add.circle(ox + px * s, oy + py * s, 6, 0xffd84a).setStrokeStyle(2, 0x000000);
    this.tweens.add({ targets: me, scale: 1.5, duration: 500, yoyo: true, repeat: -1 });
    // ? markers
    const marks = game.data.markers.filter((m) => m.stage === stage);
    for (const m of marks) {
      const mx = ox + (m.x + 0.5) * s, my = oy + (m.y + 0.5) * s;
      this.add.circle(mx, my, 11, m.solved ? 0x59e0a8 : 0x7a4ad8).setStrokeStyle(2, 0xffffff);
      txt(this, mx, my, m.solved ? '✓' : '？', 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    }
    const lx = ox + w * s + 60;
    txt(this, lx, 130, '● 今いる場所', 22, '#ffd84a');
    txt(this, lx, 170, '■ 熱い地帯', 22, '#ff8a5a');
    txt(this, lx, 230, '「？」の場所', 24, '#c9b0ff', { fontStyle: 'bold' });
    if (!marks.length) txt(this, lx, 270, 'まだない', 22, '#8fa5c8');
    marks.forEach((m, i) => {
      txt(this, lx, 270 + i * 70, `？ ${m.label}`, 22, '#ffffff');
      txt(this, lx + 20, 300 + i * 70, m.solved ? '解決した' : 'UNKNOWN PROPERTY ―― 新しい元素が必要', 18, '#8fa5c8');
    });
    txt(this, lx, GAME_H - 230, '新しい元素を仲間にすると、\n前に行けなかった場所に行けるようになる。', 20, '#cfe8ff');
    button(this, GAME_W - 260, GAME_H - 110, 260, 64, 'とじる', () => this.close(), 0x3a3f55, 26);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close() {
    this.scene.stop();
    this.scene.resume('Menu');
  }
}
