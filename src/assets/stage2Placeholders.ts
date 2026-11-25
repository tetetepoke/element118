// Stage 2 (珪晶の谷) placeholder art, drawn in code. Every key can be replaced by a PNG in
// public/assets/manifest.json with the same frame layout (see ASSETS.md).
import Phaser from 'phaser';
import { addSheet } from './placeholders';

type G = CanvasRenderingContext2D;
function mk(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
const R = (g: G, x: number, y: number, w: number, h: number, col: string) => {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), w, h);
};
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ───────────────────────── tiles2 (16 x 16, 16 per row) ─────────────────────────
// 0-15 walkable, 16+ solid. Valley.ts uses these ids.
export const T2 = {
  FLOOR: 0, FLOOR2: 1, GRAVEL: 2, PATH: 3, CRYS_FLOOR: 4, HOT: 5, LAB_FLOOR: 6, RAIL: 7, GRASS: 8, BRIDGE: 9, SAND: 10, PLATE_PAD: 11,
  CLIFF: 16, CLIFF_TOP: 17, CRYSTAL: 18, ROCK: 19, LAB_WALL: 20, WATER: 21, TREE: 22, CHASM: 23, MACHINE: 24, MINE_WALL: 25,
} as const;
export const FIRST_SOLID2 = 16;

function speckle(g: G, x: number, y: number, base: string, dots: [string, number][], seed: number) {
  R(g, x, y, 16, 16, base);
  const r = rng(seed);
  for (const [col, n] of dots) for (let i = 0; i < n; i++) R(g, x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, col);
}

function drawTile2(g: G, id: number, x: number, y: number) {
  switch (id) {
    case T2.FLOOR: speckle(g, x, y, '#8d8478', [['#776e63', 12], ['#a39a8d', 6]], 1); break;
    case T2.FLOOR2: speckle(g, x, y, '#888073', [['#71695e', 10], ['#a39a8d', 8]], 2); break;
    case T2.GRAVEL: speckle(g, x, y, '#7a7268', [['#5f584f', 20], ['#9a9184', 14]], 3); break;
    case T2.PATH: speckle(g, x, y, '#b59a72', [['#98805c', 12], ['#cdb38a', 6]], 4); break;
    case T2.CRYS_FLOOR:
      speckle(g, x, y, '#7d7a8f', [['#66627a', 10]], 5);
      R(g, x + 3, y + 4, 2, 1, '#bfe6ff'); R(g, x + 11, y + 10, 1, 2, '#c9b8ff'); R(g, x + 7, y + 13, 1, 1, '#e8f6ff');
      break;
    case T2.HOT: {
      speckle(g, x, y, '#5a3a32', [['#43302a', 10]], 6);
      g.fillStyle = '#ff7a2a';
      [[2, 3, 6, 1], [7, 3, 1, 5], [8, 8, 5, 1], [3, 11, 1, 4], [4, 14, 6, 1], [12, 1, 1, 4]].forEach(([a, b, w, h]) => g.fillRect(x + a, y + b, w, h));
      R(g, x + 7, y + 4, 1, 1, '#ffd36a'); R(g, x + 10, y + 8, 1, 1, '#ffd36a'); R(g, x + 3, y + 13, 1, 1, '#ffd36a');
      break;
    }
    case T2.LAB_FLOOR:
      R(g, x, y, 16, 16, '#5c6474'); R(g, x, y, 16, 1, '#6e7788'); R(g, x, y, 1, 16, '#6e7788');
      R(g, x + 7, y + 7, 2, 2, '#7fd0ff');
      break;
    case T2.RAIL:
      speckle(g, x, y, '#7a7268', [['#5f584f', 12]], 7);
      R(g, x + 3, y, 2, 16, '#6b6f78'); R(g, x + 11, y, 2, 16, '#6b6f78');
      for (let i = 1; i < 16; i += 5) R(g, x + 1, y + i, 14, 2, '#7a5530');
      break;
    case T2.GRASS: speckle(g, x, y, '#6aa83a', [['#4f8a26', 12], ['#8fc85a', 6]], 8); break;
    case T2.BRIDGE:
      R(g, x, y, 16, 16, '#8a5a30');
      for (let i = 0; i < 16; i += 4) R(g, x, y + i, 16, 1, '#5e3a1c');
      break;
    case T2.SAND: speckle(g, x, y, '#cdbb92', [['#b3a077', 10]], 9); break;
    case T2.PLATE_PAD: speckle(g, x, y, '#8d8478', [['#776e63', 8]], 10); break;
    case T2.CLIFF:
      R(g, x, y, 16, 16, '#6b5f55'); R(g, x, y + 12, 16, 4, '#4f453d');
      R(g, x + 2, y + 3, 5, 1, '#857669'); R(g, x + 9, y + 7, 5, 1, '#857669'); R(g, x + 4, y + 10, 3, 1, '#3e352f');
      break;
    case T2.CLIFF_TOP:
      R(g, x, y, 16, 16, '#7d7166'); R(g, x, y + 13, 16, 3, '#4f453d'); R(g, x, y, 16, 2, '#968a7d');
      R(g, x + 5, y + 6, 1, 1, '#a9cfe8');
      break;
    case T2.CRYSTAL:
      speckle(g, x, y, '#7d7a8f', [['#66627a', 6]], 11);
      g.fillStyle = '#8fd6ff'; g.beginPath(); g.moveTo(x + 4, y + 15); g.lineTo(x + 6, y + 2); g.lineTo(x + 9, y + 15); g.fill();
      g.fillStyle = '#b9a0ff'; g.beginPath(); g.moveTo(x + 8, y + 15); g.lineTo(x + 11, y + 5); g.lineTo(x + 14, y + 15); g.fill();
      R(g, x + 6, y + 4, 1, 6, '#e8f8ff'); R(g, x + 11, y + 7, 1, 4, '#efe6ff');
      break;
    case T2.ROCK:
      speckle(g, x, y, '#8d8478', [['#776e63', 6]], 12);
      g.fillStyle = '#6e6560'; g.beginPath(); g.ellipse(x + 8, y + 9, 7, 6, 0, 0, Math.PI * 2); g.fill();
      R(g, x + 4, y + 5, 4, 2, '#948a84');
      break;
    case T2.LAB_WALL:
      R(g, x, y, 16, 16, '#9aa0aa'); R(g, x, y + 7, 16, 1, '#7a808a'); R(g, x + 7, y, 1, 7, '#7a808a'); R(g, x + 3, y + 8, 1, 8, '#7a808a');
      R(g, x, y + 14, 16, 2, '#6a707a');
      break;
    case T2.WATER: {
      R(g, x, y, 16, 16, '#3f8fd2');
      R(g, x + 2, y + 4, 5, 1, '#8fd0ff'); R(g, x + 9, y + 10, 5, 1, '#8fd0ff');
      break;
    }
    case T2.TREE:
      speckle(g, x, y, '#6aa83a', [['#4f8a26', 6]], 13);
      R(g, x + 7, y + 10, 2, 5, '#6b4423');
      g.fillStyle = '#2f7a3a'; g.beginPath(); g.arc(x + 8, y + 7, 6, 0, Math.PI * 2); g.fill();
      R(g, x + 5, y + 4, 2, 2, '#4fa05a');
      break;
    case T2.CHASM: R(g, x, y, 16, 16, '#16121c'); R(g, x, y, 16, 2, '#3a3040'); break;
    case T2.MACHINE:
      R(g, x, y, 16, 16, '#5a5f6a'); R(g, x + 2, y + 2, 12, 12, '#454a55'); R(g, x + 6, y + 6, 4, 4, '#7fd0ff');
      break;
    case T2.MINE_WALL:
      R(g, x, y, 16, 16, '#5a4636'); R(g, x + 1, y, 2, 16, '#7a5530'); R(g, x + 13, y, 2, 16, '#7a5530'); R(g, x, y + 2, 16, 2, '#7a5530');
      break;
    default: R(g, x, y, 16, 16, '#ff00ff');
  }
}

function makeTiles2(scene: Phaser.Scene) {
  const [c, g] = mk(16 * 16, 16 * 2);
  for (let id = 0; id < 32; id++) drawTile2(g, id, (id % 16) * 16, Math.floor(id / 16) * 16);
  scene.textures.exists('tiles2') && scene.textures.remove('tiles2');
  scene.textures.addCanvas('tiles2', c);
}

// ───────────────────────── enemies (32x32, frames: move, move, hit, stun) ─────────────────────────
function enemySheet(scene: Phaser.Scene, key: string, draw: (g: G, ox: number, f: number) => void) {
  const [c, g] = mk(128, 32);
  for (let f = 0; f < 4; f++) {
    g.save();
    draw(g, f * 32, f);
    g.restore();
    if (f === 2) { // hit flash
      const d = g.getImageData(f * 32, 0, 32, 32);
      for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) { d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; }
      g.putImageData(d, f * 32, 0);
    }
  }
  addSheet(scene, key, c, 32, 32);
}
const shadow = (g: G, ox: number, w = 9) => { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(ox + 16, 29, w, 2.5, 0, 0, Math.PI * 2); g.fill(); };

function makeEnemies(scene: Phaser.Scene) {
  enemySheet(scene, 'cslime', (g, ox, f) => { // クリスタルスライム
    shadow(g, ox);
    const sq = f === 1 ? 1 : 0;
    g.fillStyle = '#2b2440'; g.beginPath(); g.ellipse(ox + 16, 23 + sq, 11 + sq, 7 - sq, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a8cf0'; g.beginPath(); g.ellipse(ox + 16, 23 + sq, 10 + sq, 6 - sq, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9e8ff'; g.beginPath(); g.moveTo(ox + 11, 19); g.lineTo(ox + 13, 10 + sq); g.lineTo(ox + 15, 19); g.fill();
    g.beginPath(); g.moveTo(ox + 16, 18); g.lineTo(ox + 19, 8 + sq); g.lineTo(ox + 21, 18); g.fill();
    R(g, ox + 12, 23, 2, 2, '#2b2440'); R(g, ox + 18, 23, 2, 2, '#2b2440');
    if (f === 3) { R(g, ox + 11, 23, 4, 1, '#2b2440'); R(g, ox + 17, 23, 4, 1, '#2b2440'); }
  });
  enemySheet(scene, 'golem', (g, ox, f) => { // ロックゴーレム
    shadow(g, ox, 11);
    const b = f === 1 ? -1 : 0;
    g.fillStyle = '#2e2a28'; g.fillRect(ox + 6, 9 + b, 20, 19);
    g.fillStyle = '#857a72'; g.fillRect(ox + 7, 10 + b, 18, 17);
    R(g, ox + 7, 10 + b, 18, 3, '#a39890'); R(g, ox + 4, 15 + b, 4, 9, '#6e655f'); R(g, ox + 24, 15 + b, 4, 9, '#6e655f');
    R(g, ox + 11, 15 + b, 3, 2, '#ffb84a'); R(g, ox + 18, 15 + b, 3, 2, '#ffb84a');
    R(g, ox + 9, 25, 5, 3, '#5e5650'); R(g, ox + 18, 25, 5, 3, '#5e5650');
  });
  enemySheet(scene, 'beetle', (g, ox, f) => { // クリスタルビートル（硬い殻）
    shadow(g, ox, 10);
    const l = f === 1 ? 1 : 0;
    g.strokeStyle = '#2b2440'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ox + 10, 20 + i * 3); g.lineTo(ox + 5, 22 + i * 3 + l); g.stroke(); g.beginPath(); g.moveTo(ox + 22, 20 + i * 3); g.lineTo(ox + 27, 22 + i * 3 - l); g.stroke(); }
    g.fillStyle = '#2b2440'; g.beginPath(); g.ellipse(ox + 16, 21, 9, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b6aa8'; g.beginPath(); g.ellipse(ox + 16, 21, 8, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bfe6ff'; g.beginPath(); g.moveTo(ox + 12, 19); g.lineTo(ox + 14, 9); g.lineTo(ox + 16, 19); g.fill();
    g.fillStyle = '#d8c8ff'; g.beginPath(); g.moveTo(ox + 16, 19); g.lineTo(ox + 19, 11); g.lineTo(ox + 21, 19); g.fill();
    R(g, ox + 12, 25, 2, 1, '#ffd84a'); R(g, ox + 18, 25, 2, 1, '#ffd84a');
  });
  enemySheet(scene, 'drill', (g, ox, f) => { // メカドリル
    shadow(g, ox, 11);
    R(g, ox + 7, 14, 14, 12, '#2e2a28'); R(g, ox + 8, 15, 12, 10, '#c9a24a'); R(g, ox + 8, 15, 12, 2, '#e8c46a');
    g.fillStyle = '#9aa0aa'; g.beginPath(); g.moveTo(ox + 20, 15); g.lineTo(ox + 30, 20); g.lineTo(ox + 20, 25); g.fill();
    for (let i = 0; i < 3; i++) R(g, ox + 21 + i * 3, 17 + ((i + f) % 2), 1, 6 - i * 2, '#6a707a');
    R(g, ox + 9, 26, 4, 3, '#3a3a40'); R(g, ox + 15, 26, 4, 3, '#3a3a40'); R(g, ox + 11, 18, 3, 3, '#7fd0ff');
  });
}

// ───────────────────────── objects ─────────────────────────
function makeObjects2(scene: Phaser.Scene) {
  { // hardrock 16x16: 0 whole, 1 cracked
    const [c, g] = mk(32, 16);
    for (let f = 0; f < 2; f++) {
      const x = f * 16;
      R(g, x, 0, 16, 16, '#4a4038'); R(g, x + 1, 1, 14, 13, '#9a8f84'); R(g, x + 1, 1, 14, 3, '#b6aca0'); R(g, x + 1, 13, 14, 2, '#6e645b');
      R(g, x + 4, 6, 1, 1, '#d8eefc'); R(g, x + 10, 9, 1, 1, '#d8eefc');
      if (f === 1) { g.fillStyle = '#2e2620'; [[7, 2, 1, 5], [8, 6, 1, 4], [6, 9, 1, 4], [9, 9, 3, 1]].forEach(([a, b, w, h]) => g.fillRect(x + a, b, w, h)); }
    }
    addSheet(scene, 'hardrock', c, 16, 16);
  }
  { // plate 16x16: 0 up, 1 pressed
    const [c, g] = mk(32, 16);
    for (let f = 0; f < 2; f++) {
      const x = f * 16;
      R(g, x + 1, 3, 14, 11, '#3a3f4a'); R(g, x + 2, f ? 5 : 3, 12, f ? 8 : 9, f ? '#59e0a8' : '#8a92a2');
      R(g, x + 6, f ? 7 : 6, 4, 3, f ? '#c9ffe8' : '#c9d2e2');
    }
    addSheet(scene, 'plate', c, 16, 16);
  }
  { // gate 16x16: 0 closed bars, 1 open (frame only)
    const [c, g] = mk(32, 16);
    for (let f = 0; f < 2; f++) {
      const x = f * 16;
      R(g, x, 0, 16, 2, '#5a5f6a'); R(g, x, 14, 16, 2, '#5a5f6a');
      if (!f) for (let i = 1; i < 16; i += 4) R(g, x + i, 2, 2, 12, '#9aa0aa');
    }
    addSheet(scene, 'gate', c, 16, 16);
  }
  { // narrow crevice marker 16x16 (just shading; the zone does the blocking)
    const [c, g] = mk(16, 16);
    R(g, 0, 0, 2, 16, 'rgba(0,0,0,0.35)'); R(g, 14, 0, 2, 16, 'rgba(0,0,0,0.35)');
    addSheet(scene, 'crevice', c, 16, 16);
  }
  { // unknown device (needs electricity) 32x32: 0 dead, 1 sparking
    const [c, g] = mk(64, 32);
    for (let f = 0; f < 2; f++) {
      const x = f * 32;
      R(g, x + 6, 6, 20, 24, '#2e2a28'); R(g, x + 7, 7, 18, 22, '#6a707a'); R(g, x + 9, 9, 14, 8, '#20242c');
      R(g, x + 11, 11, 10, 4, f ? '#bfe9ff' : '#3a404a');
      R(g, x + 10, 20, 3, 6, '#b87333'); R(g, x + 19, 20, 3, 6, '#b87333'); // copper terminals
      R(g, x + 14, 22, 4, 2, '#3a404a');
      if (f) { R(g, x + 13, 3, 1, 3, '#bfe9ff'); R(g, x + 18, 2, 1, 4, '#bfe9ff'); }
    }
    addSheet(scene, 'unknown_device', c, 32, 32);
  }
  { // ancient lab terminal 16x32
    const [c, g] = mk(16, 32);
    R(g, 2, 8, 12, 22, '#2e2a28'); R(g, 3, 9, 10, 20, '#7a808a'); R(g, 4, 11, 8, 6, '#7fd0ff'); R(g, 5, 12, 6, 1, '#e8f8ff');
    R(g, 5, 20, 2, 2, '#ffd84a'); R(g, 9, 20, 2, 2, '#59e0a8');
    addSheet(scene, 'terminal', c, 16, 32);
  }
  { // element monument (元素碑) 16x32, 2 frames glow
    const [c, g] = mk(32, 32);
    for (let f = 0; f < 2; f++) {
      const x = f * 16;
      R(g, x + 2, 26, 12, 4, '#4a4038'); R(g, x + 4, 4, 8, 23, '#2e2a28'); R(g, x + 5, 5, 6, 21, '#8a8f9a');
      R(g, x + 6, 9, 4, 4, f ? '#bfe9ff' : '#7fb8e8'); R(g, x + 7, 15, 2, 8, '#6a707a');
    }
    addSheet(scene, 'monument', c, 16, 32);
  }
  { // control console (boss phase 3) 16x32: 0 off, 1 on
    const [c, g] = mk(32, 32);
    for (let f = 0; f < 2; f++) {
      const x = f * 16;
      R(g, x + 1, 12, 14, 18, '#2e2a28'); R(g, x + 2, 13, 12, 16, '#5a5f6a'); R(g, x + 3, 15, 10, 5, f ? '#59e0a8' : '#ff6a5a');
      R(g, x + 5, 23, 6, 3, '#9aa0aa');
    }
    addSheet(scene, 'console', c, 16, 32);
  }
  { // crystal shard projectile 8x8
    const [c, g] = mk(8, 8);
    g.fillStyle = '#bfe6ff'; g.beginPath(); g.moveTo(4, 0); g.lineTo(7, 4); g.lineTo(4, 8); g.lineTo(1, 4); g.fill();
    R(g, 3, 2, 1, 3, '#ffffff');
    addSheet(scene, 'shard', c, 8, 8);
  }
  { // crystal cluster decor 16x32
    const [c, g] = mk(16, 32);
    g.fillStyle = '#2b2440'; g.beginPath(); g.moveTo(1, 31); g.lineTo(5, 6); g.lineTo(9, 31); g.fill();
    g.fillStyle = '#8fd6ff'; g.beginPath(); g.moveTo(2, 30); g.lineTo(5, 8); g.lineTo(8, 30); g.fill();
    g.fillStyle = '#b9a0ff'; g.beginPath(); g.moveTo(7, 30); g.lineTo(11, 14); g.lineTo(15, 30); g.fill();
    R(g, 5, 11, 1, 10, '#e8f8ff');
    addSheet(scene, 'crystal_deco', c, 16, 32);
  }
  { // Crystal Breaker boss 96x96: 0 shell, 1 shell (step), 2 shell broken (core showing), 3 stopped
    const [c, g] = mk(96 * 4, 96);
    for (let f = 0; f < 4; f++) {
      const x = f * 96;
      const b = f === 1 ? 2 : 0;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + 48, 88, 34, 6, 0, 0, Math.PI * 2); g.fill();
      // legs
      R(g, x + 18, 64 + b, 14, 22, '#3a3530'); R(g, x + 64, 64 - b, 14, 22, '#3a3530');
      R(g, x + 20, 66 + b, 10, 18, '#6e655f'); R(g, x + 66, 66 - b, 10, 18, '#6e655f');
      // body
      R(g, x + 16, 24, 64, 44, '#2e2a28'); R(g, x + 18, 26, 60, 40, f >= 2 ? '#5a504a' : '#857a72');
      // arms
      R(g, x + 4, 34, 14, 26, '#3a3530'); R(g, x + 78, 34, 14, 26, '#3a3530'); R(g, x + 6, 36, 10, 22, '#6e655f'); R(g, x + 80, 36, 10, 22, '#6e655f');
      if (f < 2) {
        // crystal shell
        g.fillStyle = '#8fd6ff';
        [[22, 26, 30, 4, 38, 26], [44, 26, 52, 0, 60, 26], [62, 26, 68, 8, 76, 26], [8, 34, 12, 18, 16, 34], [80, 34, 86, 16, 90, 34]].forEach(([a, b1, c1, d1, e1, f1]) => { g.beginPath(); g.moveTo(x + a, b1); g.lineTo(x + c1, d1); g.lineTo(x + e1, f1); g.fill(); });
        g.fillStyle = '#c9b8ff'; R(g, x + 26, 34, 44, 6, '#a6c8e8');
        R(g, x + 30, 44, 36, 14, '#5b6aa8');
      } else {
        // core exposed: glowing hot center
        R(g, x + 32, 38, 32, 22, '#2e2a28'); R(g, x + 34, 40, 28, 18, f === 3 ? '#3a404a' : '#ff7a2a'); R(g, x + 42, 44, 12, 10, f === 3 ? '#5a5f6a' : '#ffd36a');
      }
      R(g, x + 38, 28, 6, 4, f === 3 ? '#3a404a' : '#ff5a4a'); R(g, x + 52, 28, 6, 4, f === 3 ? '#3a404a' : '#ff5a4a');
    }
    addSheet(scene, 'boss_cb', c, 96, 96);
  }
}

// ───────────────────────── portraits (192x192) ─────────────────────────
function portrait(scene: Phaser.Scene, key: string, hair: string, skin: string, body: string, bg: string, extra?: (g: G) => void) {
  const [c, g] = mk(192, 192);
  R(g, 0, 0, 192, 192, bg);
  g.fillStyle = body; g.beginPath(); g.moveTo(30, 192); g.lineTo(56, 138); g.lineTo(136, 138); g.lineTo(162, 192); g.fill();
  g.fillStyle = skin; g.beginPath(); g.ellipse(96, 98, 44, 50, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair; g.beginPath(); g.ellipse(96, 66, 54, 34, 0, 0, Math.PI * 2); g.fill();
  R(g, 76, 100, 8, 10, '#2a2230'); R(g, 108, 100, 8, 10, '#2a2230');
  extra?.(g);
  addSheet(scene, key, c, 192, 192);
}

function makePortraits2(scene: Phaser.Scene) {
  portrait(scene, 'pt_silica', '#e6e8f0', '#f6dcc4', '#4a3f6a', '#2a2f4a', (g) => {
    g.fillStyle = '#9fd6ff'; g.beginPath(); g.moveTo(130, 40); g.lineTo(156, 18); g.lineTo(146, 58); g.fill();
    R(g, 76, 100, 8, 10, '#6a5aa8'); R(g, 108, 100, 8, 10, '#6a5aa8');
  });
  portrait(scene, 'pt_researcher', '#e8e8e8', '#eccaa8', '#c9a46a', '#2e3a26', (g) => { R(g, 70, 96, 52, 4, '#2a2230'); });
  portrait(scene, 'pt_miner', '#c9a24a', '#eccaa8', '#7a5530', '#3a2f26', (g) => { R(g, 46, 40, 100, 22, '#d8b04a'); });
}

/** Create every Stage 2 placeholder texture that was not loaded from a real file. */
export function makeStage2Placeholders(scene: Phaser.Scene, skip: Set<string>) {
  const keep: string[] = [];
  skip.forEach((k) => {
    if (scene.textures.exists(k)) {
      scene.textures.renameTexture(k, `__real2_${k}`);
      keep.push(k);
    }
  });
  makeTiles2(scene);
  makeEnemies(scene);
  makeObjects2(scene);
  makePortraits2(scene);
  keep.forEach((k) => {
    if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.renameTexture(`__real2_${k}`, k);
  });
}
