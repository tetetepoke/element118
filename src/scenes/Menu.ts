import Phaser from 'phaser';
import { GAME_W, GAME_H, VERSION } from '../config';
import { game, bus } from '../core/state';
import { txt, panel, button } from '../ui/widgets';
import { deleteSave } from '../core/save';
import { storage } from '../core/storage';
import { isMuted, setMuted } from '../core/audio';

export class Menu extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;
  private eraseStep = 0;

  constructor() {
    super('Menu');
  }

  create() {
    this.eraseStep = 0;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.8).setOrigin(0).setInteractive();
    panel(this, GAME_W / 2 - 360, 60, 720, GAME_H - 120, 0x10152a, 0.97);
    txt(this, GAME_W / 2, 100, 'メニュー', 40, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    const t = Math.floor(game.data.playTimeSec);
    txt(this, GAME_W / 2, 150, `プレイ時間 ${Math.floor(t / 60)}分${t % 60}秒　／　発見した元素 ${game.data.discovered.elements.length}`, 22, '#8fa5c8').setOrigin(0.5);

    const x = GAME_W / 2;
    const codexBtn = button(this, x - 70, 230, 320, 70, '元素図鑑', () => {
      this.scene.pause();
      this.scene.launch('Codex', { returnTo: 'menu' });
      this.scene.bringToTop('Codex');
    }, 0x5a4a1a, 30);
    codexBtn.setEnabled(game.flag('got_codex'));
    button(this, x + 300, 230, 120, 70, 'マップ', () => {
      const world = this.scene.get(game.worldKey) as unknown as { autosave: () => void };
      world.autosave();
      this.scene.pause();
      this.scene.launch('MapView');
      this.scene.bringToTop('MapView');
    }, 0x4a3a7a, 24);
    button(this, x, 320, 460, 70, 'セーブする', () => {
      const world = this.scene.get(game.worldKey) as unknown as { autosave: () => void };
      world.autosave();
      this.msg.setText(storage.get('save.slot1') ? 'セーブしました' : 'セーブできませんでした');
    }, 0x2a6a4a, 30);
    const soundBtn = button(this, x, 410, 460, 70, isMuted() ? '音：オフ' : '音：オン', () => {
      setMuted(!isMuted());
      soundBtn.setLabel(isMuted() ? '音：オフ' : '音：オン');
    }, 0x2a3a66, 30);
    button(this, x, 500, 460, 70, 'タイトルへもどる', () => {
      const world = this.scene.get(game.worldKey) as unknown as { autosave: () => void };
      world.autosave();
      this.scene.stop('UI');
      this.scene.stop(game.worldKey);
      this.scene.stop();
      this.scene.start('Title');
    }, 0x3a3f55, 30);
    const erase = button(this, x, 590, 460, 70, 'セーブデータを消す', () => {
      if (this.eraseStep === 0) {
        this.eraseStep = 1;
        erase.setLabel('本当に消す？（もう一度押す）');
        return;
      }
      deleteSave();
      storage.removeAllOwnKeys(); // only keys starting with "element118."
      this.scene.stop('UI');
      this.scene.stop(game.worldKey);
      this.scene.stop();
      this.scene.start('Title');
    }, 0x7a2a2a, 26);
    button(this, x, 680, 460, 70, 'ゲームにもどる', () => this.close(), 0x1f6a8a, 30);
    this.msg = txt(this, x, 740, `v${VERSION}`, 20, '#8fa5c8').setOrigin(0.5);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close() {
    this.scene.stop();
    bus.emit('world-resume');
  }
}
