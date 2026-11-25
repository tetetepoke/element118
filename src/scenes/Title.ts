import Phaser from 'phaser';
import { GAME_W, GAME_H, VERSION, STAGE_LABEL } from '../config';
import { txt, button } from '../ui/widgets';
import { unlockAudio, sfx } from '../core/audio';
import { hasSave, loadGame, newGame, deleteSave } from '../core/save';
import { game } from '../core/state';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a4a8a, 0x2a4a8a, 0x8fd3ff, 0xbfe9ff, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // floating islands silhouette
    g.fillStyle(0x5cae35, 1);
    g.fillEllipse(260, 640, 420, 80);
    g.fillEllipse(1180, 600, 360, 70);
    g.fillStyle(0x8a6a4a, 1);
    g.fillTriangle(60, 650, 460, 650, 260, 790);
    g.fillTriangle(1010, 610, 1350, 610, 1180, 760);
    // drifting atoms
    for (let i = 0; i < 14; i++) {
      const sym = ['H', 'O', 'C'][i % 3];
      const col = sym === 'H' ? 0x5fb7ff : sym === 'O' ? 0xff5a5a : 0x4a4a55;
      const x = 80 + Math.random() * (GAME_W - 160), y = 80 + Math.random() * 420;
      const c = this.add.container(x, y);
      const cg = this.add.graphics();
      cg.fillStyle(col, 0.55);
      cg.fillCircle(0, 0, 18);
      c.add([cg, txt(this, 0, 0, sym, 18, '#ffffff').setOrigin(0.5).setAlpha(0.8)]);
      this.tweens.add({ targets: c, y: y - 30, duration: 2000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    if (this.textures.exists('keyart')) {
      // key visual from the concept sheet
      const art = this.add.image(0, 0, 'keyart').setOrigin(0, 0);
      const s = Math.max(GAME_W / art.width, GAME_H / art.height);
      art.setScale(s);
      art.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    } else {
      const carbon = this.add.sprite(GAME_W / 2 - 300, 470, 'carbon', 0).setScale(7);
      carbon.play('carbon_idle_down');
    }

    const hasArt = this.textures.exists('keyart');
    const bx = hasArt ? GAME_W - 330 : GAME_W / 2 + 120;
    if (hasArt) {
      this.add.rectangle(bx, GAME_H - 160, 520, 300, 0x0e1630, 0.55).setOrigin(0.5);
      txt(this, bx, GAME_H - 290, STAGE_LABEL, 24, '#ffffff').setOrigin(0.5);
    } else {
    txt(this, GAME_W / 2 + 120, 200, 'ELEMENT 118', 104, '#ffffff', { fontStyle: 'bold', stroke: '#1b2a55', strokeThickness: 10 }).setOrigin(0.5);
    txt(this, GAME_W / 2 + 120, 290, '— エレメント118 —', 36, '#1b2a55').setOrigin(0.5);
    txt(this, GAME_W / 2 + 120, 340, STAGE_LABEL, 26, '#1b2a55').setOrigin(0.5);
    }

    const start = (cont: boolean) => {
      unlockAudio();
      sfx('discover');
      if (cont) {
        const d = loadGame();
        game.reset(d ?? newGame());
      } else {
        game.reset(newGame());
      }
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(game.worldKey, { fresh: !cont }));
    };

    const saved = hasSave();
    let y = hasArt ? GAME_H - 220 : 470;
    if (saved) {
      button(this, bx, y, 420, 84, 'つづきから', () => start(true), 0x2a6a4a, 34);
      y += hasArt ? 100 : 110;
    }
    const newBtn = button(this, bx, y, 420, 84, saved ? 'はじめから' : 'はじめる', () => {
      if (saved && !confirmPending) {
        confirmPending = true;
        newBtn.setLabel('もう一度押すと上書き');
        this.time.delayedCall(2500, () => {
          confirmPending = false;
          newBtn.setLabel('はじめから');
        });
        return;
      }
      if (saved) deleteSave();
      start(false);
    }, 0x2a3a66, 34);
    let confirmPending = false;

    txt(this, 24, GAME_H - 40, `v${VERSION}　プロトタイプ`, 20, hasArt ? '#ffffff' : '#1b2a55', hasArt ? { backgroundColor: 'rgba(0,0,0,0.4)', padding: { x: 8, y: 3 } } : {});
    // separate 3D technology prototype (its own page; shares no save data with the 2D game)
    const to3d = txt(this, GAME_W - 24, GAME_H - 40, '3D試作（技術検証）▶', 20, '#ffffff', { backgroundColor: 'rgba(20,24,42,0.7)', padding: { x: 10, y: 5 } }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    to3d.on('pointerdown', () => { window.location.href = new URL("3d/", document.baseURI.replace(/[^/]*$/, "")).href; });
    if (!hasArt) txt(this, GAME_W - 24, GAME_H - 40, 'iPhoneは横向きで / ホーム画面に追加すると全画面', 20, '#1b2a55').setOrigin(1, 0);

    // iOS needs a gesture to unlock audio; any tap does it.
    this.input.once('pointerdown', () => unlockAudio());
    this.input.keyboard?.once('keydown', () => unlockAudio());
    this.input.keyboard?.on('keydown-ENTER', () => start(saved));
  }
}
