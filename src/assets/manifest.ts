// Asset override: put a PNG in public/assets/sprites/ and list it in public/assets/manifest.json.
// Anything listed there replaces the placeholder with the same key. Frame layouts: ASSETS.md.
import Phaser from 'phaser';

export interface SpriteOverride {
  file: string; // relative to public/assets/
  frameWidth?: number;
  frameHeight?: number;
  /** Player sheet only: 4 (down/up/side) or 8 (down/up/side/down_side/up_side). */
  directions?: 4 | 8;
  /** "image" for single pictures (title art, buildings); default is a sprite sheet. */
  type?: 'image' | 'sheet';
}

export type AssetManifest = Record<string, SpriteOverride>;

/** Directions available per sprite key (default 4). Read by the player animation code. */
export const spriteDirections: Record<string, 4 | 8> = { carbon: 4 };

export function queueOverrides(scene: Phaser.Scene, manifest: AssetManifest): Set<string> {
  const loaded = new Set<string>();
  for (const [key, o] of Object.entries(manifest)) {
    if (!o || typeof o.file !== 'string' || key.startsWith('_')) continue;
    const url = o.file.startsWith('data:') ? o.file : `assets/${o.file}`;
    if (key === 'tiles' || o.type === 'image') scene.load.image(key, url);
    else scene.load.spritesheet(key, url, { frameWidth: o.frameWidth ?? 32, frameHeight: o.frameHeight ?? 32 });
    if (o.directions) spriteDirections[key] = o.directions;
    loaded.add(key);
  }
  return loaded;
}
