import Phaser from 'phaser';
import { FONT } from '../config';
import { sfx } from '../core/audio';

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 28,
  color = '#ffffff',
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, s, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    lineSpacing: Math.round(size * 0.35),
    ...opts,
  });
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = 0x141a2e, alpha = 0.94, stroke = 0x8fd3ff) {
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(4, stroke, 0.9);
  g.strokeRoundedRect(x, y, w, h, 18);
  return g;
}

export interface Button {
  root: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Graphics;
  setEnabled(v: boolean): void;
  setLabel(s: string): void;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  color = 0x2a3a66,
  size = 28,
): Button {
  const root = scene.add.container(x, y);
  const bg = scene.add.graphics();
  let enabled = true;
  const draw = (pressed = false) => {
    bg.clear();
    bg.fillStyle(enabled ? color : 0x333844, pressed ? 0.75 : 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(3, enabled ? 0xbfe4ff : 0x555a66, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw();
  const t = txt(scene, 0, 0, label, size, '#ffffff').setOrigin(0.5);
  root.add([bg, t]);
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  root.add(zone);
  zone.on('pointerdown', () => {
    if (!enabled) return;
    draw(true);
  });
  zone.on('pointerout', () => draw(false));
  zone.on('pointerup', () => {
    if (!enabled) return;
    draw(false);
    sfx('ui');
    onClick();
  });
  return {
    root,
    label: t,
    bg,
    setEnabled(v: boolean) {
      enabled = v;
      t.setAlpha(v ? 1 : 0.5);
      draw();
    },
    setLabel(s: string) {
      t.setText(s);
    },
  };
}

/** Atom token: coloured circle with symbol and its "結合の手" sticks. */
export function atomToken(scene: Phaser.Scene, x: number, y: number, symbol: string, r: number, hands: number | null, color: number) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  if (hands) {
    g.lineStyle(Math.max(4, r * 0.16), 0xffffff, 0.9);
    for (let i = 0; i < hands; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(hands, 1) + (hands === 1 ? Math.PI / 2 : 0);
      g.lineBetween(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, r * 0.14);
    }
  }
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(3, 0xffffff, 0.85);
  g.strokeCircle(0, 0, r);
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(-r * 0.35, -r * 0.35, r * 0.28);
  const t = txt(scene, 0, 0, symbol, Math.round(r * 0.95), '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
  c.add([g, t]);
  return c;
}
