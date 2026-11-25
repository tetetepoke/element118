// Placeholder art, drawn in code onto canvases. Every texture here has a fixed key and
// frame layout (documented in ASSETS.md). A real PNG with the same key and layout can
// replace any of them through public/assets/manifest.json — no game code changes.
import Phaser from 'phaser';

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

/** Register a canvas as a spritesheet texture with numbered frames. */
export function addSheet(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, fw: number, fh: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, c)!;
  let i = 0;
  for (let y = 0; y + fh <= c.height; y += fh) for (let x = 0; x + fw <= c.width; x += fw) tex.add(i++, 0, x, y, fw, fh);
}

// deterministic random
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ───────────────────────────────── tiles ─────────────────────────────────
// Tile ids (16 per row). 0-15 walkable, 16+ solid.
export const T = {
  GRASS: 0, GRASS2: 1, FLOWERS: 2, PATH: 3, SAND: 4, WATER_EDGE: 5, BRIDGE: 6, STONE: 7, TALL: 8, PLATEAU: 9, PLATEAU2: 10, RUIN_FLOOR: 11,
  TREE: 16, ROCK: 17, CLIFF: 18, CLIFF_TOP: 19, WALL: 20, ROOF: 21, DOOR: 22, FENCE: 23, MILL_WALL: 24, MILL_ROOF: 25,
  BUSH: 26, PILLAR: 27, CHASM: 28, WINDOW: 29, WATER: 30, PINE: 31,
} as const;
export const FIRST_SOLID = 16;

function grassBase(g: G, x: number, y: number, base: string, dark: string, light: string, seed: number) {
  R(g, x, y, 16, 16, base);
  const r = rng(seed);
  for (let i = 0; i < 10; i++) R(g, x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, dark);
  for (let i = 0; i < 5; i++) R(g, x + Math.floor(r() * 16), y + Math.floor(r() * 15), 1, 2, light);
}

function drawTile(g: G, id: number, x: number, y: number) {
  const r = rng(id * 97 + 13);
  switch (id) {
    case T.GRASS: grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 1); break;
    case T.GRASS2: grassBase(g, x, y, '#66b82e', '#4b9420', '#8fd14f', 2); break;
    case T.FLOWERS:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 3);
      [['#ffffff', 3, 4], ['#ffd84a', 10, 2], ['#ff7aa8', 6, 11], ['#ffffff', 12, 12], ['#b48cff', 2, 13]].forEach(([c, fx, fy]) => {
        R(g, x + (fx as number), y + (fy as number), 2, 2, c as string);
        R(g, x + (fx as number), y + (fy as number) + 2, 1, 1, '#3d7a1a');
      });
      break;
    case T.PATH:
      R(g, x, y, 16, 16, '#d2ad6d');
      for (let i = 0; i < 9; i++) R(g, x + Math.floor(r() * 15), y + Math.floor(r() * 15), 2, 1, '#b48f52');
      for (let i = 0; i < 4; i++) R(g, x + Math.floor(r() * 15), y + Math.floor(r() * 15), 1, 1, '#e8c98f');
      break;
    case T.SAND:
      R(g, x, y, 16, 16, '#ead79f');
      for (let i = 0; i < 10; i++) R(g, x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, '#cdb57a');
      break;
    case T.WATER_EDGE:
      R(g, x, y, 16, 16, '#ead79f');
      R(g, x, y + 10, 16, 6, '#7cc6f2');
      R(g, x, y + 10, 16, 1, '#ffffff');
      break;
    case T.BRIDGE:
      R(g, x, y, 16, 16, '#3b8fd9');
      R(g, x + 1, y, 14, 16, '#a8743f');
      for (let i = 0; i < 4; i++) R(g, x + 1, y + i * 4 + 3, 14, 1, '#7a5229');
      R(g, x + 1, y, 1, 16, '#6b4520');
      R(g, x + 14, y, 1, 16, '#6b4520');
      break;
    case T.STONE:
      R(g, x, y, 16, 16, '#a7a7a0');
      R(g, x, y + 7, 16, 1, '#86867f');
      R(g, x + 7, y, 1, 7, '#86867f');
      R(g, x + 3, y + 8, 1, 8, '#86867f');
      break;
    case T.TALL:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 4);
      for (let i = 0; i < 6; i++) {
        const bx = x + 1 + i * 2.5;
        R(g, bx, y + 6, 1, 9, '#3f8a1c');
        R(g, bx + 1, y + 4, 1, 6, '#9be05f');
      }
      break;
    case T.PLATEAU: grassBase(g, x, y, '#5cae35', '#468a26', '#82c95a', 5); break;
    case T.PLATEAU2: grassBase(g, x, y, '#58a832', '#438423', '#82c95a', 6); break;
    case T.RUIN_FLOOR:
      R(g, x, y, 16, 16, '#9a9284');
      R(g, x + 1, y + 1, 6, 6, '#a9a192');
      R(g, x + 9, y + 9, 6, 6, '#a9a192');
      break;
    case T.TREE:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 7);
      R(g, x + 6, y + 11, 4, 5, '#6b4520');
      g.fillStyle = '#2f7a2a';
      g.beginPath(); g.arc(x + 8, y + 7, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f9a35';
      g.beginPath(); g.arc(x + 7, y + 6, 5, 0, Math.PI * 2); g.fill();
      R(g, x + 5, y + 3, 2, 2, '#6cc25a');
      break;
    case T.PINE:
      grassBase(g, x, y, '#5cae35', '#468a26', '#82c95a', 8);
      R(g, x + 7, y + 12, 2, 4, '#6b4520');
      g.fillStyle = '#1f5f3a';
      g.beginPath(); g.moveTo(x + 8, y + 1); g.lineTo(x + 14, y + 13); g.lineTo(x + 2, y + 13); g.closePath(); g.fill();
      R(g, x + 6, y + 5, 2, 2, '#3c8c55');
      break;
    case T.ROCK:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 9);
      g.fillStyle = '#8a8a8a';
      g.beginPath(); g.ellipse(x + 8, y + 9, 7, 6, 0, 0, Math.PI * 2); g.fill();
      R(g, x + 4, y + 5, 4, 2, '#b5b5b5');
      R(g, x + 3, y + 12, 10, 2, '#6a6a6a');
      break;
    case T.CLIFF:
      R(g, x, y, 16, 16, '#8a6a4a');
      for (let i = 0; i < 4; i++) R(g, x, y + i * 4 + 2, 16, 1, '#6e5238');
      for (let i = 0; i < 5; i++) R(g, x + Math.floor(r() * 14), y + Math.floor(r() * 14), 2, 2, '#a68462');
      break;
    case T.CLIFF_TOP:
      R(g, x, y, 16, 16, '#8a6a4a');
      R(g, x, y, 16, 6, '#5cae35');
      R(g, x, y + 6, 16, 1, '#3d7a1a');
      for (let i = 0; i < 2; i++) R(g, x, y + 9 + i * 4, 16, 1, '#6e5238');
      break;
    case T.WALL:
      R(g, x, y, 16, 16, '#efe2c2');
      R(g, x, y, 16, 1, '#b99a6a');
      R(g, x, y + 15, 16, 1, '#8a6a40');
      R(g, x + 7, y, 2, 16, '#9a7444');
      break;
    case T.WINDOW:
      R(g, x, y, 16, 16, '#efe2c2');
      R(g, x + 4, y + 4, 8, 7, '#6b4520');
      R(g, x + 5, y + 5, 6, 5, '#8fd3ff');
      R(g, x + 7, y + 5, 2, 5, '#6b4520');
      break;
    case T.ROOF:
      R(g, x, y, 16, 16, '#c8473a');
      for (let i = 0; i < 4; i++) R(g, x, y + i * 4 + 3, 16, 1, '#9a2f26');
      for (let i = 0; i < 4; i++) R(g, x + ((i % 2) * 4) + 2, y + i * 4, 1, 3, '#9a2f26');
      break;
    case T.DOOR:
      R(g, x, y, 16, 16, '#efe2c2');
      R(g, x + 3, y + 2, 10, 14, '#7a4a22');
      R(g, x + 4, y + 3, 8, 13, '#9a5f2e');
      R(g, x + 10, y + 9, 1, 2, '#ffd84a');
      break;
    case T.FENCE:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 10);
      R(g, x, y + 6, 16, 2, '#a8743f');
      R(g, x, y + 10, 16, 2, '#a8743f');
      R(g, x + 2, y + 3, 3, 12, '#8a5a2c');
      R(g, x + 11, y + 3, 3, 12, '#8a5a2c');
      break;
    case T.MILL_WALL:
      R(g, x, y, 16, 16, '#b8b0a0');
      for (let i = 0; i < 4; i++) R(g, x, y + i * 4, 16, 1, '#8d8678');
      R(g, x + (r() > 0.5 ? 4 : 10), y + 1, 1, 3, '#8d8678');
      break;
    case T.MILL_ROOF:
      R(g, x, y, 16, 16, '#5a5f8a');
      for (let i = 0; i < 4; i++) R(g, x, y + i * 4 + 3, 16, 1, '#40446a');
      break;
    case T.BUSH:
      grassBase(g, x, y, '#6abe30', '#4f9a22', '#8fd14f', 11);
      g.fillStyle = '#3d8f2c';
      g.beginPath(); g.ellipse(x + 8, y + 10, 7, 5, 0, 0, Math.PI * 2); g.fill();
      R(g, x + 4, y + 7, 3, 2, '#5fb548');
      break;
    case T.PILLAR:
      R(g, x, y, 16, 16, '#9a9284');
      R(g, x + 3, y, 10, 16, '#c9c1b0');
      R(g, x + 3, y, 10, 2, '#e3dccd');
      R(g, x + 5, y + 4, 1, 10, '#a69e8d');
      break;
    case T.CHASM:
      R(g, x, y, 16, 16, '#141a2e');
      R(g, x, y, 16, 3, '#2a3352');
      for (let i = 0; i < 3; i++) R(g, x + Math.floor(r() * 15), y + 6 + Math.floor(r() * 9), 1, 1, '#2a3352');
      break;
    case T.WATER:
      R(g, x, y, 16, 16, '#3b8fd9');
      for (let i = 0; i < 3; i++) R(g, x + Math.floor(r() * 12), y + Math.floor(r() * 15), 4, 1, '#7cc6f2');
      break;
    default:
      R(g, x, y, 16, 16, '#ff00ff');
  }
}

export function makeTiles(scene: Phaser.Scene) {
  const [c, g] = mk(256, 64);
  for (let id = 0; id < 64; id++) drawTile(g, id, (id % 16) * 16, Math.floor(id / 16) * 16);
  if (scene.textures.exists('tiles')) scene.textures.remove('tiles');
  scene.textures.addCanvas('tiles', c);
}

// ─────────────────────────────── Carbon (player) ───────────────────────────────
// Sheet: 32x32 frames. Rows: 0 down, 1 up, 2 side(right). Columns:
// 0-1 idle, 2-5 walk, 6-8 attack, 9 dodge, 10 guard, 11 hurt, 12-13 bond.
export const CARBON_COLS = 14;
export const CARBON_ANIMS = {
  idle: [0, 1],
  walk: [2, 3, 4, 5],
  attack: [6, 7, 8],
  dodge: [9],
  guard: [10],
  hurt: [11],
  bond: [12, 13],
};

const PAL = {
  hair: '#4a2f1e', hairHi: '#6b4630', mask: '#f3efe4', maskShade: '#d8d1bf', ink: '#2a2230', red: '#c8473a',
  cloak: '#c9b48a', cloakDark: '#9e875f', cloakPatch: '#8fa0a8', strap: '#6b4520', bag: '#7a5230', crystal: '#7fe0ff',
  pants: '#4c4a58', boot: '#4a3020', skin: '#f1c9a5', lid: '#9aa3ad', lidDark: '#6d757e',
};

function carbonFrame(g: G, ox: number, oy: number, row: number, col: number) {
  const P = PAL;
  let bob = 0, legL = 0, legR = 0, lean = 0, crouch = 0;
  let arms: 'down' | 'swing1' | 'swing2' | 'swing3' | 'guard' | 'up' | 'hurt' = 'down';
  if (col === 1) bob = 1;
  if (col >= 2 && col <= 5) {
    const ph = col - 2;
    bob = ph % 2 === 0 ? 0 : -1;
    legL = ph === 0 ? -1 : ph === 2 ? 1 : 0;
    legR = -legL;
  }
  if (col === 6) arms = 'swing1';
  if (col === 7) { arms = 'swing2'; lean = 1; }
  if (col === 8) { arms = 'swing3'; lean = 1; }
  if (col === 9) crouch = 5;
  if (col === 10) arms = 'guard';
  if (col === 11) { arms = 'hurt'; lean = -1; }
  if (col === 12) arms = 'up';
  if (col === 13) { arms = 'up'; bob = -1; }

  const x0 = ox, y0 = oy + bob + crouch;
  const side = row === 2, up = row === 1;
  const lx = side ? lean : 0;

  // shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(ox + 16, oy + 29.5, 7, 2, 0, 0, Math.PI * 2); g.fill();

  // boots
  if (crouch === 0) {
    if (side) {
      R(g, x0 + 12 + legL, oy + 26 + Math.min(0, legL), 4, 3, P.boot);
      R(g, x0 + 16 + legR, oy + 26 + Math.min(0, legR), 4, 3, P.boot);
    } else {
      R(g, x0 + 11, oy + 26 + legL, 4, 3, P.boot);
      R(g, x0 + 17, oy + 26 + legR, 4, 3, P.boot);
    }
    R(g, x0 + 12, y0 + 23, 8, 3, P.pants);
  }

  // cloak (tattered)
  const cy = y0 + 14;
  R(g, x0 + 9 + lx, cy, 14, 10, P.cloak);
  R(g, x0 + 8 + lx, cy + 3, 16, 7, P.cloak);
  // jagged hem
  for (let i = 0; i < 16; i += 2) R(g, x0 + 8 + lx + i, cy + 10, 1, (i * 7) % 3 === 0 ? 2 : 1, P.cloakDark);
  R(g, x0 + 10 + lx, cy + 9, 2, 1, P.cloakDark);
  // patches and tears
  R(g, x0 + (up ? 12 : 18) + lx, cy + 5, 3, 3, P.cloakPatch);
  R(g, x0 + (up ? 19 : 10) + lx, cy + 2, 1, 3, P.cloakDark);
  if (!up) {
    // strap + bag
    for (let i = 0; i < 9; i++) R(g, x0 + 10 + i + lx, cy + 1 + i, 1, 1, P.strap);
    R(g, x0 + 18 + lx, cy + 7, 5, 4, P.bag);
    R(g, x0 + 20 + lx, cy + 8, 1, 2, P.crystal);
  } else {
    R(g, x0 + 9, cy + 6, 4, 4, P.bag);
  }

  // arms / hands
  const hand = (hx: number, hy: number) => R(g, x0 + hx + lx, y0 + hy, 2, 2, P.skin);
  if (arms === 'down') { hand(8, 21); hand(22, 21); }
  if (arms === 'swing1') { hand(side ? 20 : 22, 17); }
  if (arms === 'swing2') { hand(side ? 23 : 20, 20); }
  if (arms === 'swing3') { hand(side ? 22 : 11, 23); }
  if (arms === 'hurt') { hand(7, 17); hand(23, 17); }
  if (arms === 'up') { hand(8, 12); hand(22, 12); }
  if (arms === 'guard') {
    // pot-lid shield: part of the "unfinished" starting gear
    if (up) { R(g, x0 + 10, y0 + 13, 12, 3, P.lidDark); }
    else if (side) {
      R(g, x0 + 21, y0 + 13, 4, 11, P.lid); R(g, x0 + 24, y0 + 13, 1, 11, P.lidDark); R(g, x0 + 22, y0 + 17, 2, 2, P.lidDark);
    } else {
      g.fillStyle = P.lid; g.beginPath(); g.ellipse(x0 + 16, y0 + 20, 7, 5, 0, 0, Math.PI * 2); g.fill();
      R(g, x0 + 15, y0 + 18, 2, 2, P.lidDark);
      R(g, x0 + 10, y0 + 23, 12, 1, P.lidDark);
    }
  }

  // head
  const hx = x0 + (side ? 1 + lx : 0), hy = y0;
  R(g, hx + 9, hy + 3, 14, 11, P.hair);
  // messy spikes
  [[9, 1], [12, 0], [15, 1], [18, 0], [21, 2], [7, 5], [23, 6], [8, 10], [23, 11]].forEach(([sx, sy]) => R(g, hx + sx, hy + sy, 2, 3, P.hair));
  R(g, hx + 12, hy + 3, 4, 1, P.hairHi);
  if (up) {
    // back of head: mask string
    R(g, hx + 9, hy + 9, 14, 1, P.strap);
    R(g, hx + 15, hy + 9, 2, 2, P.strap);
  } else if (side) {
    // profile mask facing right
    R(g, hx + 16, hy + 5, 7, 8, P.mask);
    R(g, hx + 22, hy + 7, 2, 4, P.mask);
    R(g, hx + 17, hy + 4, 2, 2, P.mask); // ear
    R(g, hx + 20, hy + 7, 2, 1, P.ink); // eye slit
    R(g, hx + 18, hy + 10, 2, 1, P.red);
    R(g, hx + 16, hy + 12, 6, 1, P.maskShade);
  } else {
    // front mask with "C" and "6"
    R(g, hx + 11, hy + 5, 10, 9, P.mask);
    R(g, hx + 10, hy + 6, 12, 6, P.mask);
    R(g, hx + 11, hy + 4, 2, 2, P.mask); // fox ears
    R(g, hx + 19, hy + 4, 2, 2, P.mask);
    R(g, hx + 11, hy + 13, 10, 1, P.maskShade);
    // "C"
    R(g, hx + 13, hy + 7, 3, 1, P.ink); R(g, hx + 13, hy + 8, 1, 3, P.ink); R(g, hx + 13, hy + 11, 3, 1, P.ink);
    // "6"
    R(g, hx + 18, hy + 9, 2, 1, P.ink); R(g, hx + 18, hy + 10, 1, 2, P.ink); R(g, hx + 19, hy + 11, 1, 1, P.ink); R(g, hx + 19, hy + 10, 1, 1, P.ink);
    R(g, hx + 11, hy + 9, 1, 1, P.red); R(g, hx + 20, hy + 7, 1, 1, P.red);
  }
  if (crouch) {
    // motion streaks
    R(g, ox + 2, oy + 22, 5, 1, 'rgba(255,255,255,0.6)');
    R(g, ox + 3, oy + 26, 4, 1, 'rgba(255,255,255,0.5)');
  }
}

function makeCarbon(scene: Phaser.Scene) {
  const [c, g] = mk(32 * CARBON_COLS, 32 * 3);
  for (let row = 0; row < 3; row++) for (let col = 0; col < CARBON_COLS; col++) carbonFrame(g, col * 32, row * 32, row, col);
  addSheet(scene, 'carbon', c, 32, 32);
}

// ─────────────────────────────── NPCs ───────────────────────────────
// 32x32, one row: 0-1 idle, 2-3 walk.
interface NpcLook { hair: string; hairStyle: 'spiky' | 'twin' | 'bald' | 'short'; body: string; skin: string; beard?: boolean; small?: boolean; cane?: boolean }
const LOOKS: Record<string, NpcLook> = {
  hyde: { hair: '#4aa3ff', hairStyle: 'spiky', body: '#eaf6ff', skin: '#f6d2b0', small: true },
  oxy: { hair: '#ff6f9a', hairStyle: 'twin', body: '#e2474f', skin: '#f6d2b0', small: true },
  elder: { hair: '#d8d8d8', hairStyle: 'bald', body: '#5f8f4e', skin: '#e8c19c', beard: true, cane: true },
  villager: { hair: '#7a4a22', hairStyle: 'short', body: '#4f7fb5', skin: '#f1c9a5' },
};

function npcFrame(g: G, ox: number, oy: number, look: NpcLook, col: number) {
  const bob = col === 1 || col === 3 ? -1 : 0;
  const s = look.small ? 2 : 0;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(ox + 16, oy + 29.5, 6, 2, 0, 0, Math.PI * 2); g.fill();
  const y = oy + bob + s;
  R(g, ox + 12, oy + 26, 3, 3, '#3a2a20');
  R(g, ox + 17, oy + 26, 3, 3, '#3a2a20');
  R(g, ox + 10, y + 15, 12, 11, look.body);
  R(g, ox + 9, y + 18, 14, 6, look.body);
  if (look.hair === '#4aa3ff') { R(g, ox + 14, y + 17, 4, 4, '#4aa3ff'); } // H badge
  R(g, ox + 8, y + 18, 2, 2, look.skin);
  R(g, ox + 22, y + 18, 2, 2, look.skin);
  // head
  R(g, ox + 10, y + 4, 12, 11, look.skin);
  R(g, ox + 13, y + 9, 1, 2, '#2a2230');
  R(g, ox + 18, y + 9, 1, 2, '#2a2230');
  if (look.hairStyle === 'spiky') {
    R(g, ox + 9, y + 2, 14, 5, look.hair);
    [[9, 0], [12, -1], [16, 0], [20, -1], [22, 2]].forEach(([a, b]) => R(g, ox + a, y + b, 2, 3, look.hair));
  } else if (look.hairStyle === 'twin') {
    R(g, ox + 9, y + 2, 14, 5, look.hair);
    R(g, ox + 6, y + 5, 4, 8, look.hair);
    R(g, ox + 22, y + 5, 4, 8, look.hair);
    R(g, ox + 15, y + 1, 2, 2, '#ffd84a');
  } else if (look.hairStyle === 'short') {
    R(g, ox + 9, y + 2, 14, 5, look.hair);
  } else {
    R(g, ox + 9, y + 6, 2, 4, look.hair);
    R(g, ox + 21, y + 6, 2, 4, look.hair);
  }
  if (look.beard) R(g, ox + 11, y + 11, 10, 6, '#eeeeee');
  if (look.cane) { R(g, ox + 24, y + 12, 2, 16, '#7a4a22'); R(g, ox + 23, y + 11, 4, 2, '#7a4a22'); }
}

function makeNpcs(scene: Phaser.Scene) {
  for (const [key, look] of Object.entries(LOOKS)) {
    const [c, g] = mk(128, 32);
    for (let col = 0; col < 4; col++) npcFrame(g, col * 32, 0, look, col);
    addSheet(scene, key, c, 32, 32);
  }
}

// ─────────────────────────────── enemies ───────────────────────────────
// breakling: 32x32, 0-1 move, 2 hit, 3 stunned
function makeBreakling(scene: Phaser.Scene) {
  const [c, g] = mk(128, 32);
  for (let col = 0; col < 4; col++) {
    const ox = col * 32;
    const squash = col === 1 ? 1 : 0;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(ox + 16, 28.5, 8, 2, 0, 0, Math.PI * 2); g.fill();
    const body = col === 2 ? '#ffffff' : '#8a5cff';
    g.fillStyle = body;
    g.beginPath(); g.ellipse(ox + 16, 19 + squash, 9 + squash, 8 - squash, 0, 0, Math.PI * 2); g.fill();
    R(g, ox + 10, 13 + squash, 3, 2, '#b598ff');
    // broken bond sticks floating
    R(g, ox + 4, 8 + (col % 2), 4, 1, '#d9c8ff');
    R(g, ox + 24, 10 - (col % 2), 4, 1, '#d9c8ff');
    R(g, ox + 15, 5, 1, 4, '#d9c8ff');
    if (col === 3) {
      R(g, ox + 11, 17, 3, 1, '#2a1a4a'); R(g, ox + 18, 17, 3, 1, '#2a1a4a');
      R(g, ox + 12, 9, 1, 1, '#ffd84a'); R(g, ox + 19, 8, 1, 1, '#ffd84a');
    } else {
      R(g, ox + 12, 17, 2, 3, '#2a1a4a'); R(g, ox + 18, 17, 2, 3, '#2a1a4a');
      R(g, ox + 12, 17, 1, 1, '#ffffff'); R(g, ox + 18, 17, 1, 1, '#ffffff');
    }
  }
  addSheet(scene, 'breakling', c, 32, 32);
}

// ─────────────────────────────── objects ───────────────────────────────
function makeObjects(scene: Phaser.Scene) {
  // element crystals: 16x16, frames 0-1 shine, 2 empty socket
  for (const [key, col, light] of [['crystal_H', '#4aa3ff', '#bfe4ff'], ['crystal_O', '#ff4d5e', '#ffc2c8']] as const) {
    const [c, g] = mk(48, 16);
    for (let f = 0; f < 3; f++) {
      const ox = f * 16;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(ox + 8, 14, 5, 1.5, 0, 0, Math.PI * 2); g.fill();
      R(g, ox + 4, 12, 8, 2, '#7d7d86');
      if (f === 2) continue;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(ox + 8, 1); g.lineTo(ox + 13, 7); g.lineTo(ox + 8, 13); g.lineTo(ox + 3, 7); g.closePath(); g.fill();
      R(g, ox + 6, 4, 2, 4, light);
      if (f === 1) { R(g, ox + 11, 2, 1, 1, '#ffffff'); R(g, ox + 2, 9, 1, 1, '#ffffff'); }
      g.fillStyle = '#ffffff';
      g.font = 'bold 6px monospace';
      g.fillText(key.endsWith('H') ? 'H' : 'O', ox + 6, 10);
    }
    addSheet(scene, key, c, 16, 16);
  }

  // buoyancy device (fictional ancient machine): 32x48, 0 dormant, 1 filled/glowing
  {
    const [c, g] = mk(64, 48);
    for (let f = 0; f < 2; f++) {
      const ox = f * 32;
      R(g, ox + 2, 38, 28, 8, '#7d7466');
      R(g, ox + 2, 38, 28, 2, '#a59b89');
      R(g, ox + 4, 30, 24, 8, '#9a8f7c');
      [6, 14, 22].forEach((px) => R(g, ox + px, 32, 4, 4, f ? '#7fe0ff' : '#5a5348'));
      // sealed tank
      g.fillStyle = f ? '#c9f1ff' : '#b8a27a';
      g.beginPath(); g.ellipse(ox + 16, 16, 11, 13, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6b5a3a'; g.lineWidth = 2; g.stroke();
      R(g, ox + 5, 15, 22, 2, '#6b5a3a');
      R(g, ox + 15, 3, 2, 26, '#6b5a3a');
      R(g, ox + 9, 8, 3, 4, '#ffffff');
      R(g, ox + 13, 28, 6, 3, '#6b5a3a');
    }
    addSheet(scene, 'device', c, 32, 48);
  }

  // torch: 16x32, 0 unlit, 1-3 lit
  {
    const [c, g] = mk(64, 32);
    for (let f = 0; f < 4; f++) {
      const ox = f * 16;
      R(g, ox + 6, 14, 4, 16, '#6b4520');
      R(g, ox + 4, 12, 8, 3, '#8a8a8a');
      if (f === 0) { R(g, ox + 6, 10, 4, 2, '#3a3a3a'); continue; }
      const h = 6 + f * 2;
      g.fillStyle = '#ff8a2a';
      g.beginPath(); g.moveTo(ox + 8, 12 - h); g.lineTo(ox + 13, 12); g.lineTo(ox + 3, 12); g.closePath(); g.fill();
      g.fillStyle = '#ffe14a';
      g.beginPath(); g.moveTo(ox + 8, 12 - h + 4); g.lineTo(ox + 11, 12); g.lineTo(ox + 5, 12); g.closePath(); g.fill();
    }
    addSheet(scene, 'torch', c, 16, 32);
  }

  // bramble (dry thorns): 16x16, 2 frames
  {
    const [c, g] = mk(32, 16);
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      R(g, ox, 0, 16, 16, '#6abe30');
      g.strokeStyle = f ? '#7a5a2a' : '#6b4a20';
      g.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        g.beginPath(); g.moveTo(ox + (i * 5) % 16, 16); g.lineTo(ox + ((i * 7 + 3) % 16), 1 + (i % 3)); g.stroke();
      }
      for (let i = 0; i < 10; i++) R(g, ox + (i * 7) % 15, (i * 5) % 14, 1, 1, '#c9a35a');
    }
    addSheet(scene, 'bramble', c, 16, 16);
  }

  // flame (fire wall segment): 16x32, 4 frames
  {
    const [c, g] = mk(64, 32);
    for (let f = 0; f < 4; f++) {
      const ox = f * 16;
      const wob = [0, 2, -1, 1][f];
      g.fillStyle = '#e8401f';
      g.beginPath(); g.moveTo(ox + 8 + wob, 1); g.lineTo(ox + 15, 30); g.lineTo(ox + 1, 30); g.closePath(); g.fill();
      g.fillStyle = '#ff9a2a';
      g.beginPath(); g.moveTo(ox + 8 - wob, 8); g.lineTo(ox + 13, 30); g.lineTo(ox + 3, 30); g.closePath(); g.fill();
      g.fillStyle = '#ffe96a';
      g.beginPath(); g.moveTo(ox + 8, 16 + wob); g.lineTo(ox + 11, 30); g.lineTo(ox + 5, 30); g.closePath(); g.fill();
    }
    addSheet(scene, 'flame', c, 16, 32);
  }

  // fog barrier (unravelled matter): 16x16, 4 frames
  {
    const [c, g] = mk(64, 16);
    for (let f = 0; f < 4; f++) {
      const ox = f * 16;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(150,110,255,${0.35 + ((i + f) % 3) * 0.12})`;
        g.beginPath(); g.arc(ox + ((i * 5 + f * 3) % 16), (i * 6 + f * 2) % 16, 4, 0, Math.PI * 2); g.fill();
      }
    }
    addSheet(scene, 'fog', c, 16, 16);
  }

  // save stone: 16x32, 2 frames (glow)
  {
    const [c, g] = mk(32, 32);
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(ox + 8, 29, 7, 2, 0, 0, Math.PI * 2); g.fill();
      R(g, ox + 2, 8, 12, 21, '#8f97a8');
      R(g, ox + 3, 6, 10, 3, '#8f97a8');
      R(g, ox + 2, 8, 2, 21, '#b8c0d0');
      R(g, ox + 5, 13, 6, 7, f ? '#bff4ff' : '#7fe0ff');
      g.fillStyle = '#2a3352'; g.font = 'bold 7px monospace'; g.fillText('C', ox + 6, 19);
    }
    addSheet(scene, 'savestone', c, 16, 32);
  }

  // sign: 16x16
  {
    const [c, g] = mk(16, 16);
    R(g, 7, 8, 2, 8, '#6b4520');
    R(g, 1, 2, 14, 8, '#b4834a');
    R(g, 1, 2, 14, 1, '#d8a868');
    R(g, 3, 5, 10, 1, '#6b4520');
    R(g, 3, 7, 7, 1, '#6b4520');
    addSheet(scene, 'sign', c, 16, 16);
  }

  // goal marker: 16x16, 2 frames
  {
    const [c, g] = mk(32, 16);
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      g.fillStyle = f ? '#fff6b0' : '#ffd84a';
      g.beginPath(); g.moveTo(ox + 8, 1 + f); g.lineTo(ox + 14, 9 + f); g.lineTo(ox + 10, 9 + f); g.lineTo(ox + 10, 15); g.lineTo(ox + 6, 15); g.lineTo(ox + 6, 9 + f); g.lineTo(ox + 2, 9 + f); g.closePath(); g.fill();
    }
    addSheet(scene, 'goal', c, 16, 16);
  }

  // slash arc (drawn pointing right, rotated in code): 32x32, 3 frames
  {
    const [c, g] = mk(96, 32);
    for (let f = 0; f < 3; f++) {
      const ox = f * 32;
      g.strokeStyle = `rgba(255,255,255,${0.9 - f * 0.25})`;
      g.lineWidth = 3 - f * 0.5;
      g.beginPath(); g.arc(ox + 8, 16, 12, -Math.PI / 2.4 + f * 0.3, Math.PI / 2.4 + f * 0.3); g.stroke();
      g.strokeStyle = `rgba(255,230,160,${0.7 - f * 0.2})`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(ox + 8, 16, 9, -Math.PI / 3 + f * 0.3, Math.PI / 3 + f * 0.3); g.stroke();
    }
    addSheet(scene, 'slash', c, 32, 32);
  }

  // particles and small things
  const dot = (key: string, size: number, draw: (g: G) => void) => {
    const [c, g] = mk(size, size);
    draw(g);
    addSheet(scene, key, c, size, size);
  };
  dot('px_water', 6, (g) => { g.fillStyle = '#7cc6f2'; g.beginPath(); g.arc(3, 3, 3, 0, Math.PI * 2); g.fill(); R(g, 2, 1, 1, 1, '#ffffff'); });
  dot('px_steam', 10, (g) => { g.fillStyle = 'rgba(240,248,255,0.85)'; g.beginPath(); g.arc(5, 5, 5, 0, Math.PI * 2); g.fill(); });
  dot('px_leaf', 4, (g) => { R(g, 0, 1, 4, 2, '#5fb548'); R(g, 1, 0, 2, 1, '#8fd14f'); });
  dot('px_spark', 4, (g) => { R(g, 1, 0, 2, 4, '#fff6b0'); R(g, 0, 1, 4, 2, '#fff6b0'); });
  dot('px_dust', 4, (g) => { g.fillStyle = 'rgba(230,210,170,0.8)'; g.beginPath(); g.arc(2, 2, 2, 0, Math.PI * 2); g.fill(); });
  dot('px_fire', 6, (g) => { g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(3, 3, 3, 0, Math.PI * 2); g.fill(); R(g, 2, 2, 2, 2, '#ffe96a'); });
  dot('px_purple', 6, (g) => { g.fillStyle = '#b598ff'; g.beginPath(); g.arc(3, 3, 3, 0, Math.PI * 2); g.fill(); });
  dot('water_shot', 12, (g) => {
    g.fillStyle = '#3b8fd9'; g.beginPath(); g.arc(6, 6, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9fdcff'; g.beginPath(); g.arc(5, 5, 3, 0, Math.PI * 2); g.fill();
    R(g, 4, 3, 2, 2, '#ffffff');
  });
  dot('heart_pickup', 10, (g) => {
    g.fillStyle = '#ff4d6d';
    g.beginPath(); g.arc(3, 3.5, 2.6, 0, Math.PI * 2); g.arc(7, 3.5, 2.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0.6, 4.4); g.lineTo(5, 9.5); g.lineTo(9.4, 4.4); g.closePath(); g.fill();
  });
  dot('glow', 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
}

// ─────────────────────────────── portraits ───────────────────────────────
// 192x192 vector-style placeholders for the dialogue box.
function portraitBase(g: G, bg: string) {
  g.fillStyle = bg;
  g.fillRect(0, 0, 192, 192);
}

function drawCarbonPortrait(g: G, shy: boolean) {
  portraitBase(g, '#26304d');
  // cloak collar
  g.fillStyle = '#c9b48a';
  g.beginPath(); g.moveTo(30, 192); g.lineTo(50, 140); g.lineTo(142, 140); g.lineTo(162, 192); g.closePath(); g.fill();
  g.fillStyle = '#9e875f';
  for (let i = 0; i < 6; i++) { g.fillRect(52 + i * 16, 150 + (i % 2) * 8, 6, 3); }
  g.fillStyle = '#8fa0a8'; g.fillRect(118, 160, 18, 16); // patch
  // hair
  g.fillStyle = '#4a2f1e';
  g.beginPath(); g.ellipse(96, 84, 64, 60, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    g.beginPath();
    g.moveTo(96 + Math.cos(a - 0.15) * 56, 84 + Math.sin(a - 0.15) * 52);
    g.lineTo(96 + Math.cos(a) * 82, 84 + Math.sin(a) * 74);
    g.lineTo(96 + Math.cos(a + 0.15) * 56, 84 + Math.sin(a + 0.15) * 52);
    g.closePath(); g.fill();
  }
  // mask (fox-like) with C and 6
  g.fillStyle = '#f3efe4';
  g.beginPath(); g.moveTo(52, 60); g.lineTo(60, 30); g.lineTo(78, 52); g.lineTo(114, 52); g.lineTo(132, 30); g.lineTo(140, 60);
  g.quadraticCurveTo(146, 128, 96, 146); g.quadraticCurveTo(46, 128, 52, 60); g.closePath(); g.fill();
  g.strokeStyle = '#d8d1bf'; g.lineWidth = 3; g.stroke();
  // eye slits (looking away when shy)
  g.fillStyle = '#2a2230';
  const lookX = shy ? -6 : 0;
  g.fillRect(68 + lookX, 82, 16, 4);
  g.fillRect(108 + lookX, 82, 16, 4);
  // red markings
  g.fillStyle = '#c8473a';
  g.fillRect(62, 96, 12, 3); g.fillRect(118, 96, 12, 3);
  g.fillRect(94, 58, 4, 10);
  // C and 6
  g.fillStyle = '#2a2230';
  g.font = 'bold 44px sans-serif';
  g.fillText('C', 80, 128);
  g.font = 'bold 18px sans-serif';
  g.fillText('6', 112, 136);
  if (shy) {
    // sweat drop + raised hand covering part of the mask
    g.fillStyle = '#8fd3ff';
    g.beginPath(); g.moveTo(150, 60); g.quadraticCurveTo(162, 82, 150, 86); g.quadraticCurveTo(138, 82, 150, 60); g.fill();
    g.fillStyle = '#f1c9a5';
    g.beginPath(); g.ellipse(132, 150, 16, 12, -0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(30 + i * 8, 40 - i * 4); g.lineTo(36 + i * 8, 30 - i * 4); g.stroke(); }
  }
}

function drawSimplePortrait(g: G, look: NpcLook, bg: string, extra?: (g: G) => void) {
  portraitBase(g, bg);
  g.fillStyle = look.body;
  g.beginPath(); g.moveTo(36, 192); g.lineTo(56, 140); g.lineTo(136, 140); g.lineTo(156, 192); g.closePath(); g.fill();
  g.fillStyle = look.skin;
  g.beginPath(); g.ellipse(96, 96, 46, 52, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.hair;
  if (look.hairStyle === 'spiky') {
    g.beginPath(); g.ellipse(96, 62, 52, 30, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(44 + i * 16, 60); g.lineTo(52 + i * 16, 14 + (i % 2) * 14); g.lineTo(60 + i * 16, 60); g.fill(); }
  } else if (look.hairStyle === 'twin') {
    g.beginPath(); g.ellipse(96, 60, 54, 32, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(36, 110, 16, 40, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(156, 110, 16, 40, -0.2, 0, Math.PI * 2); g.fill();
  } else if (look.hairStyle === 'short') {
    g.beginPath(); g.ellipse(96, 58, 50, 26, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.ellipse(52, 86, 10, 20, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(140, 86, 10, 20, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#2a2230';
  g.fillRect(74, 96, 8, 12);
  g.fillRect(110, 96, 8, 12);
  g.fillStyle = '#ffffff';
  g.fillRect(74, 96, 3, 3);
  g.fillRect(110, 96, 3, 3);
  if (look.beard) {
    g.fillStyle = '#eeeeee';
    g.beginPath(); g.ellipse(96, 140, 36, 30, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = '#c8473a';
    g.fillRect(90, 124, 12, 3);
  }
  extra?.(g);
}

function makePortraits(scene: Phaser.Scene) {
  const add = (key: string, draw: (g: G) => void) => {
    const [c, g] = mk(192, 192);
    draw(g);
    addSheet(scene, key, c, 192, 192);
  };
  add('pt_carbon', (g) => drawCarbonPortrait(g, false));
  add('pt_carbon_shy', (g) => drawCarbonPortrait(g, true));
  add('pt_hyde', (g) =>
    drawSimplePortrait(g, LOOKS.hyde, '#1f3a5a', (g) => {
      g.fillStyle = '#4aa3ff'; g.fillRect(84, 156, 24, 24);
      g.fillStyle = '#ffffff'; g.font = 'bold 20px sans-serif'; g.fillText('H', 89, 176);
    }),
  );
  add('pt_oxy', (g) =>
    drawSimplePortrait(g, LOOKS.oxy, '#4a1f2e', (g) => {
      g.fillStyle = '#ff4d5e'; g.beginPath(); g.arc(96, 168, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.font = 'bold 20px sans-serif'; g.fillText('O', 89, 175);
    }),
  );
  add('pt_elder', (g) => drawSimplePortrait(g, LOOKS.elder, '#2e3a26'));
  add('pt_villager', (g) => drawSimplePortrait(g, LOOKS.villager, '#2a3040'));
}

/** Names of textures produced here (for the asset override check). */
export const PLACEHOLDER_KEYS = [
  'tiles', 'carbon', 'hyde', 'oxy', 'elder', 'villager', 'breakling', 'crystal_H', 'crystal_O', 'device', 'torch', 'bramble',
  'flame', 'fog', 'savestone', 'sign', 'goal', 'slash', 'pt_carbon', 'pt_carbon_shy', 'pt_hyde', 'pt_oxy', 'pt_elder', 'pt_villager',
];

/** Create every placeholder texture that was not already loaded from a real file. */
export function makeAllPlaceholders(scene: Phaser.Scene, skip: Set<string>) {
  const run = (key: string, fn: () => void) => {
    if (!skip.has(key)) fn();
  };
  run('tiles', () => makeTiles(scene));
  run('carbon', () => makeCarbon(scene));
  // NPC/portrait/object groups: generate all, then restore any real files that were loaded
  makeNpcsFiltered(scene, skip);
  run('breakling', () => makeBreakling(scene));
  makeObjectsFiltered(scene, skip);
  makePortraitsFiltered(scene, skip);
}

function withSkip(scene: Phaser.Scene, skip: Set<string>, fn: () => void) {
  // Temporarily rename real textures so the generator can't overwrite them.
  const keep: [string, Phaser.Textures.Texture][] = [];
  skip.forEach((k) => {
    if (scene.textures.exists(k)) {
      const t = scene.textures.get(k);
      keep.push([k, t]);
      scene.textures.renameTexture(k, `__real_${k}`);
    }
  });
  fn();
  keep.forEach(([k]) => {
    if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.renameTexture(`__real_${k}`, k);
  });
}
function makeNpcsFiltered(scene: Phaser.Scene, skip: Set<string>) {
  withSkip(scene, skip, () => makeNpcs(scene));
}
function makeObjectsFiltered(scene: Phaser.Scene, skip: Set<string>) {
  withSkip(scene, skip, () => makeObjects(scene));
}
function makePortraitsFiltered(scene: Phaser.Scene, skip: Set<string>) {
  withSkip(scene, skip, () => makePortraits(scene));
}
