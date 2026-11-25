// End of stage 2: the periodic table lights up H, C, O, Si — the other 114 stay dark.
// Then night: blue-white electricity far away (UNKNOWN ENERGY) → next region 「雷導の街」 (Cu).
import Phaser from 'phaser';
import { GAME_W, GAME_H, ELEMENT_COLORS } from '../config';
import { game, bus } from '../core/state';
import { txt, button } from '../ui/widgets';
import { sfx } from '../core/audio';
import { ELEMENTS } from '../data/elements';
import { SCRIPT2 } from '../data/script2';
import { SPEAKER_NAME } from '../data/script';

export class Periodic extends Phaser.Scene {
  constructor() {
    super('Periodic');
  }

  create() {
    void this.run();
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, res));
  }

  /** Shows a list of lines one by one; tap / key to advance. */
  private lines(key: string, y = GAME_H - 150) {
    return new Promise<void>((res) => {
      const list = SCRIPT2[key] ?? [];
      let i = 0;
      const box = this.add.rectangle(GAME_W / 2, y, GAME_W - 160, 150, 0x10152a, 0.92).setStrokeStyle(3, 0x8fa5c8);
      const name = txt(this, 110, y - 60, '', 24, '#8fd3ff', { fontStyle: 'bold' });
      const t = txt(this, 110, y - 26, '', 28, '#ffffff', { wordWrap: { width: GAME_W - 240, useAdvancedWrap: true } });
      const show = () => {
        if (i >= list.length) {
          box.destroy(); name.destroy(); t.destroy();
          this.input.off('pointerdown', next);
          this.input.keyboard?.off('keydown', next);
          return res();
        }
        name.setText(SPEAKER_NAME[list[i].who] ?? '');
        t.setText(list[i].text);
        i++;
      };
      const next = () => { sfx('ui'); show(); };
      this.input.on('pointerdown', next);
      this.input.keyboard?.on('keydown', next);
      show();
    });
  }

  private async run() {
    const bg = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 1).setOrigin(0);
    sfx('bigchime');
    const title = txt(this, GAME_W / 2, 60, 'ステージ2「珪晶の谷」クリア', 44, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5);
    // the whole table, dark
    const cw = 70, ch = 56, ox = (GAME_W - cw * 18) / 2, oy = 104;
    const cells = new Map<string, { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number; y: number }>();
    for (const e of ELEMENTS) {
      const x = ox + (e.col - 1) * cw, y = oy + (e.row <= 7 ? e.row - 1 : e.row - 1.5) * ch;
      const g = this.add.graphics();
      g.fillStyle(0x161a28, 1);
      g.fillRoundedRect(x + 2, y + 2, cw - 4, ch - 4, 6);
      const t = txt(this, x + cw / 2, y + ch / 2, e.symbol, 22, '#2e3448').setOrigin(0.5);
      cells.set(e.symbol, { g, t, x, y });
    }
    await this.wait(900);
    const lit = ['H', 'C', 'O', 'Si'].filter((s) => game.knows('elements', s));
    const counter = txt(this, GAME_W - 110, GAME_H - 62, `0 / 118`, 64, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    for (let i = 0; i < lit.length; i++) {
      const c = cells.get(lit[i])!;
      c.g.clear();
      c.g.fillStyle(ELEMENT_COLORS[lit[i]] ?? 0x888888, 1);
      c.g.fillRoundedRect(c.x + 2, c.y + 2, cw - 4, ch - 4, 6);
      c.g.lineStyle(3, 0xffffff, 1);
      c.g.strokeRoundedRect(c.x + 2, c.y + 2, cw - 4, ch - 4, 6);
      c.t.setColor('#ffffff').setFontStyle('bold');
      this.tweens.add({ targets: c.t, scale: 1.6, duration: 200, yoyo: true });
      sfx('discover');
      counter.setText(`${i + 1} / 118`);
      await this.wait(650);
    }
    const sub = txt(this, ox, GAME_H - 100, '残りの元素は、まだ暗いまま。', 30, '#cfe8ff');
    await this.wait(900);
    const big = txt(this, ox, GAME_H - 58, 'いつか、この全部と出会う。', 30, '#ffd84a', { fontStyle: 'bold' });
    this.tweens.add({ targets: counter, scale: 1.25, duration: 500, yoyo: true, repeat: 1 });
    await this.wait(2600);
    await this.lines('s2_after_boss_recap');

    // ── night ──
    this.children.list.slice().forEach((o) => { if (o !== bg) o.destroy(); });
    void title; void sub; void big;
    bg.setFillStyle(0x0a1230, 1);
    const sky = this.add.graphics();
    for (let i = 0; i < 80; i++) { sky.fillStyle(0xffffff, Math.random() * 0.8); sky.fillRect(Math.random() * GAME_W, Math.random() * 420, 2, 2); }
    sky.fillStyle(0x151a33, 1);
    sky.fillTriangle(0, 620, 380, 300, 760, 620);
    sky.fillTriangle(500, 620, 980, 260, 1440, 620);
    sky.fillStyle(0x0c0f20, 1);
    sky.fillRect(0, 600, GAME_W, 210);
    // distant facility
    sky.fillStyle(0x23294a, 1);
    sky.fillRect(1010, 330, 60, 60); sky.fillRect(1030, 290, 20, 40);
    const bolt = this.add.graphics();
    this.time.addEvent({
      delay: 220, loop: true, callback: () => {
        bolt.clear();
        if (Math.random() < 0.55) {
          bolt.lineStyle(3, 0xbfe9ff, 1);
          let x = 1040, y = 290;
          bolt.beginPath(); bolt.moveTo(x, y);
          for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y -= 22; bolt.lineTo(x, y); }
          bolt.strokePath();
          bolt.fillStyle(0xbfe9ff, 0.25); bolt.fillCircle(1040, 330, 60);
        }
      },
    });
    txt(this, 120, 80, 'その夜', 36, '#cfe8ff');
    await this.wait(1200);
    await this.lines('s2_night', GAME_H - 120);
    // codex card: UNKNOWN ENERGY
    game.setFlag('codex_unknown_energy');
    sfx('discover');
    const card = this.add.container(GAME_W / 2, 300);
    card.add(this.add.rectangle(0, 0, 640, 200, 0x10152a, 0.95).setStrokeStyle(4, 0xbfe9ff));
    card.add(txt(this, 0, -60, '図鑑に記録：UNKNOWN ENERGY', 30, '#bfe9ff', { fontStyle: 'bold' }).setOrigin(0.5));
    card.add(txt(this, 0, 0, '遠くの古代施設で光る、正体不明のエネルギー。', 24, '#ffffff').setOrigin(0.5));
    card.add(txt(this, 0, 50, '谷の動かなかった装置と、関係があるのだろうか……？', 22, '#8fa5c8').setOrigin(0.5));
    await this.wait(3200);
    card.destroy();
    await this.lines('s2_next', GAME_H - 120);
    // next region
    const next = this.add.container(GAME_W / 2, 330);
    next.add(this.add.rectangle(0, 0, 760, 300, 0x10152a, 0.95).setStrokeStyle(4, 0xb87333));
    next.add(txt(this, 0, -110, '次の地域：「雷導の街」', 40, '#ffd84a', { fontStyle: 'bold' }).setOrigin(0.5));
    next.add(txt(this, 0, -40, '次の主要元素候補', 24, '#8fa5c8').setOrigin(0.5));
    const g = this.add.graphics();
    g.fillStyle(0xb87333, 1); g.fillRoundedRect(-300, -10, 130, 130, 12);
    next.add(g);
    next.add(txt(this, -235, 55, 'Cu', 56, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
    next.add(txt(this, -290, -4, '29', 20, '#ffffff'));
    next.add(txt(this, -140, 20, 'Copper ／ 銅', 34, '#ffffff', { fontStyle: 'bold' }));
    next.add(txt(this, -140, 70, '原子番号 29', 26, '#cfe8ff'));
    await this.wait(800);
    txt(this, GAME_W / 2, 560, '―― つづく ――', 34, '#ffffff').setOrigin(0.5);
    button(this, GAME_W / 2 - 200, 690, 340, 72, '谷にもどる', () => {
      this.scene.stop();
      const v = this.scene.get('Valley') as unknown as { player: { lock: (v: boolean) => void }; busy: boolean };
      v.player.lock(false);
      v.busy = false;
      bus.emit('world-resume');
    }, 0x1f6a8a, 30);
    button(this, GAME_W / 2 + 200, 690, 340, 72, 'タイトルへ', () => {
      this.scene.stop('UI');
      this.scene.stop('Valley');
      this.scene.stop();
      this.scene.start('Title');
    }, 0x3a3f55, 30);
  }
}
