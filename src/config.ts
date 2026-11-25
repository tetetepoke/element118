// ELEMENT 118 — global constants.
// The game canvas is 1440x810. The world camera zooms 3x, so the player sees
// 480x270 world pixels (30x17 tiles of 16px). UI is laid out in canvas pixels.

export const GAME_W = 1440;
export const GAME_H = 810;
export const ZOOM = 3;
export const TILE = 16;

export const VERSION = '0.2.0';
export const STAGE_LABEL = 'ステージ1〜2　プロトタイプ';

/** Every browser-storage key this game uses starts with this prefix. Nothing else is ever touched. */
export const SAVE_PREFIX = 'element118.';

/**
 * Prototype only: facts written for the codex are shown even before a human has
 * reviewed them, with a "監修前" badge. Set to false for a release build so that
 * only reviewed facts are displayed (rule 1 of the design doc).
 */
export const SHOW_UNREVIEWED_FACTS = true;

export const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';

/** Colours for the four kinds of "合わさり方" (design doc §0 rule 4). */
export const KIND_COLORS: Record<string, number> = {
  element_bond: 0x7fd4ff, // つなぐ（元素同士）
  covalent: 0x59e0a8,     // つなぐ（分子）
  network: 0x9fb8ff,      // 共有結合の結晶（SiC など）
  ionic: 0xffc857,        // わたす
  mixture: 0xc79bff,      // まぜる
  reaction: 0xff7a59,     // 反応
};

export const ELEMENT_COLORS: Record<string, number> = {
  H: 0x5fb7ff,
  C: 0x4a4a55,
  O: 0xff5a5a,
  Si: 0x8a7ad8,
};
