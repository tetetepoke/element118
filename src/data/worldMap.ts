// Stage 1 world: カーボ村 → 草原 → 川辺 → 崖と古代の浮力装置 → 風車の台地 → 炎の道.
// Built in code from simple shapes so it is easy to adjust now; it can be replaced by a Tiled
// (.tmj) map later without touching the game logic (entities are plain data).
import { T, FIRST_SOLID } from '../assets/placeholders';

export const MAP_W = 48;
export const MAP_H = 100;

export type EntityType =
  | 'player' | 'npc' | 'enemy' | 'crystal' | 'device' | 'torch' | 'bramble' | 'fire' | 'fog'
  | 'savestone' | 'sign' | 'goal' | 'gateguard' | 'tallgrass';

export interface EntityDef {
  type: EntityType;
  id: string;
  x: number; // tile coords
  y: number;
  w?: number; // width in tiles (barriers)
  props?: Record<string, string | number | boolean>;
}

export interface Building {
  /** decor image key drawn over the footprint when real art is loaded */
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldMap {
  ground: number[][];
  solid: number[][];
  entities: EntityDef[];
  buildings: Building[];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildWorld(): WorldMap {
  const W = MAP_W, H = MAP_H;
  const r = rng(118);
  const ground = Array.from({ length: H }, () => Array.from({ length: W }, () => (r() < 0.3 ? T.GRASS2 : T.GRASS) as number));
  const solid = Array.from({ length: H }, () => Array.from({ length: W }, () => -1));
  const reserved = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  const entities: EntityDef[] = [];
  const buildings: Building[] = [];

  const setG = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) ground[y][x] = t; };
  const setS = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) solid[y][x] = t; };
  const res = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < H && x >= 0 && x < W) reserved[y][x] = true;
  };
  const rectG = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setG(x, y, t);
  };
  const rowS = (y: number, t: number, gapFrom: number, gapTo: number) => {
    for (let x = 2; x < W - 2; x++) if (x < gapFrom || x > gapTo) setS(x, y, t);
  };
  const ent = (e: EntityDef) => { entities.push(e); res(e.x - 1, e.y - 1, e.x + (e.w ?? 1), e.y + 1); };

  // plateau grass (upper area) looks a little different
  for (let y = 0; y <= 35; y++) for (let x = 0; x < W; x++) ground[y][x] = r() < 0.3 ? T.PLATEAU2 : T.PLATEAU;

  // main north-south path (x 23..25)
  rectG(23, 3, 25, 97, T.PATH);
  res(21, 2, 27, 97);

  // ── Village (rows 77-97) ──
  rectG(6, 88, 41, 89, T.PATH);
  res(5, 87, 42, 90);
  const house = (x: number, y: number, w: number, h: number, key = 'house_a') => {
    buildings.push({ key, x, y, w, h });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setS(xx, yy, yy < y + 2 ? T.ROOF : T.WALL);
    const doorX = x + Math.floor(w / 2);
    setS(doorX, y + h - 1, T.DOOR);
    if (w >= 6) { setS(x + 1, y + h - 1, T.WINDOW); setS(x + w - 2, y + h - 1, T.WINDOW); }
    res(x - 1, y - 1, x + w, y + h + 1);
    rectG(doorX, y + h, doorX, 87, T.PATH);
    return doorX;
  };
  house(8, 82, 7, 4); // Carbon's house, door (11,85)
  house(31, 80, 8, 4, 'house_b'); // elder
  house(13, 91, 6, 4, 'house_c');
  house(31, 92, 7, 4, 'house_c');
  // flower beds
  for (let i = 0; i < 40; i++) {
    const x = 3 + Math.floor(r() * (W - 6)), y = 78 + Math.floor(r() * 19);
    if (!reserved[y][x] && solid[y][x] < 0) setG(x, y, T.FLOWERS);
  }
  // fence with gate at x 23..25
  rowS(76, T.FENCE, 23, 25);
  ent({ type: 'gateguard', id: 'gateguard', x: 23, y: 77, w: 3 });
  ent({ type: 'player', id: 'start', x: 11, y: 87 });
  ent({ type: 'npc', id: 'elder', x: 35, y: 85, props: { sprite: 'elder' } });
  ent({ type: 'npc', id: 'villager', x: 18, y: 89, props: { sprite: 'villager', wander: true } });
  ent({ type: 'savestone', id: 'save_village', x: 27, y: 86 });
  ent({ type: 'sign', id: 'sign_village', x: 21, y: 79, props: { text: 'sign_village' } });

  // ── Grassland (rows 63-75) ──
  ent({ type: 'enemy', id: 'b1', x: 18, y: 71 });
  ent({ type: 'enemy', id: 'b2', x: 30, y: 69 });
  ent({ type: 'enemy', id: 'b3', x: 24, y: 66 });
  ent({ type: 'sign', id: 'sign_grass', x: 27, y: 73, props: { text: 'sign_grass' } });
  // barrier line at row 62 with fog in the gap
  rowS(62, T.TREE, 22, 26);
  ent({ type: 'fog', id: 'fog1', x: 22, y: 62, w: 5 });
  // tall grass patches (cuttable)
  for (const [cx, cy] of [[8, 68], [37, 72], [12, 64], [40, 65], [33, 58], [10, 47], [38, 44]]) {
    for (let i = 0; i < 7; i++) {
      const x = cx + Math.floor(r() * 4) - 1, y = cy + Math.floor(r() * 3) - 1;
      if (!reserved[y]?.[x] && solid[y][x] < 0) setG(x, y, T.TALL);
    }
  }

  // ── River (rows 51-55) ──
  for (let x = 2; x < W - 2; x++) {
    setG(x, 51, T.SAND);
    setG(x, 55, T.WATER_EDGE);
    for (let y = 52; y <= 54; y++) setS(x, y, T.WATER);
  }
  rectG(23, 52, 25, 54, T.BRIDGE);
  for (let y = 52; y <= 54; y++) for (let x = 23; x <= 25; x++) solid[y][x] = -1;
  rectG(2, 56, W - 3, 57, T.SAND);
  ent({ type: 'crystal', id: 'h_a', x: 15, y: 57, props: { element: 'H', respawn: true } });
  ent({ type: 'crystal', id: 'h_b', x: 18, y: 56, props: { element: 'H', respawn: true } });
  ent({ type: 'crystal', id: 'h_c', x: 33, y: 57, props: { element: 'H', respawn: true } });
  ent({ type: 'crystal', id: 'h_hidden', x: 43, y: 59, props: { element: 'H', respawn: false } }); // behind trees
  ent({ type: 'npc', id: 'hyde', x: 28, y: 58, props: { sprite: 'hyde' } });

  // ── Under the cliff (rows 40-50) ──
  for (let y = 36; y <= 39; y++) for (let x = 2; x < W - 2; x++) setS(x, y, y === 36 ? T.CLIFF_TOP : T.CLIFF);
  ent({ type: 'device', id: 'device_low', x: 24, y: 41, props: { target: 'device_high' } });
  ent({ type: 'sign', id: 'sign_device', x: 27, y: 43, props: { text: 'sign_device' } });
  ent({ type: 'enemy', id: 'b4', x: 14, y: 45 });
  rectG(21, 40, 27, 41, T.STONE);

  // ── Plateau (rows 19-35) ──
  ent({ type: 'device', id: 'device_high', x: 24, y: 33, props: { target: 'device_low', upper: true } });
  rectG(21, 32, 27, 35, T.STONE);
  // windmill building
  for (let y = 21; y <= 25; y++) for (let x = 30; x <= 35; x++) setS(x, y, y <= 22 ? T.MILL_ROOF : T.MILL_WALL);
  setS(32, 25, T.DOOR);
  buildings.push({ key: 'windmill', x: 30, y: 21, w: 6, h: 5 });
  res(29, 20, 36, 27);
  ent({ type: 'npc', id: 'oxy', x: 28, y: 28, props: { sprite: 'oxy' } });
  ent({ type: 'crystal', id: 'o_a', x: 18, y: 27, props: { element: 'O', respawn: true } });
  ent({ type: 'crystal', id: 'o_b', x: 20, y: 29, props: { element: 'O', respawn: true } });
  ent({ type: 'crystal', id: 'o_c', x: 37, y: 30, props: { element: 'O', respawn: true } });
  ent({ type: 'torch', id: 'torch1', x: 20, y: 20 });
  rowS(18, T.PINE, 22, 26);
  ent({ type: 'bramble', id: 'bramble1', x: 22, y: 18, w: 5 });
  ent({ type: 'sign', id: 'sign_mill', x: 27, y: 31, props: { text: 'sign_mill' } });
  ent({ type: 'savestone', id: 'save_plateau', x: 21, y: 30 });

  // ── Fire road (rows 4-17) ──
  for (let y = 9; y <= 10; y++) for (let x = 2; x < W - 2; x++) setS(x, y, T.CHASM);
  rectG(23, 9, 25, 10, T.BRIDGE);
  for (let y = 9; y <= 10; y++) for (let x = 23; x <= 25; x++) solid[y][x] = -1;
  rowS(12, T.PINE, 22, 26);
  ent({ type: 'fire', id: 'fire1', x: 22, y: 12, w: 5 });
  // crystals right before the fire, so the player can experiment there without backtracking
  ent({ type: 'crystal', id: 'h_fire_a', x: 20, y: 16, props: { element: 'H', respawn: true } });
  ent({ type: 'crystal', id: 'h_fire_b', x: 21, y: 14, props: { element: 'H', respawn: true } });
  ent({ type: 'crystal', id: 'o_fire', x: 28, y: 16, props: { element: 'O', respawn: true } });
  ent({ type: 'enemy', id: 'b5', x: 15, y: 15 });
  ent({ type: 'enemy', id: 'b6', x: 31, y: 14 });
  ent({ type: 'sign', id: 'sign_fire', x: 27, y: 15, props: { text: 'sign_fire' } });
  rectG(20, 3, 28, 7, T.RUIN_FLOOR);
  setS(20, 4, T.PILLAR); setS(28, 4, T.PILLAR); setS(20, 6, T.PILLAR); setS(28, 6, T.PILLAR);
  ent({ type: 'goal', id: 'goal', x: 24, y: 4 });

  // ── Borders and scattered scenery ──
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) setS(x, y, y <= 35 ? T.PINE : T.TREE);
  }
  const scatter = (y0: number, y1: number, density: number, tiles: number[]) => {
    for (let y = y0; y <= y1; y++) for (let x = 2; x < W - 2; x++) {
      if (reserved[y][x] || solid[y][x] >= 0 || ground[y][x] === T.SAND || ground[y][x] === T.WATER_EDGE) continue;
      if (r() < density) setS(x, y, tiles[Math.floor(r() * tiles.length)]);
    }
  };
  scatter(78, 97, 0.05, [T.TREE, T.BUSH]);
  scatter(63, 75, 0.07, [T.TREE, T.ROCK, T.BUSH]);
  scatter(56, 61, 0.05, [T.TREE, T.ROCK]);
  scatter(40, 50, 0.08, [T.TREE, T.ROCK, T.BUSH]);
  scatter(19, 35, 0.07, [T.PINE, T.ROCK]);
  scatter(11, 17, 0.08, [T.PINE, T.ROCK]);
  scatter(2, 8, 0.12, [T.PINE]);

  // make sure nothing solid sits on entity tiles that must be walkable
  for (const e of entities) {
    if (['crystal', 'npc', 'savestone', 'sign', 'goal', 'player', 'device', 'torch', 'enemy'].includes(e.type)) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const v = solid[e.y + dy]?.[e.x + dx];
        if (v !== undefined && v >= FIRST_SOLID && v !== T.CLIFF && v !== T.CLIFF_TOP && v !== T.WATER && v !== T.CHASM && !isBuilding(v)) solid[e.y + dy][e.x + dx] = -1;
      }
    }
  }
  // hide the bonus crystal behind a ring of trees, with one gap
  for (const [x, y] of [[42, 58], [43, 58], [44, 58], [42, 60], [43, 60], [44, 60], [44, 59]]) setS(x, y, T.TREE);
  setS(42, 59, -1);
  setS(41, 59, -1);
  return { ground, solid, entities, buildings };
}

function isBuilding(t: number) {
  return t === T.WALL || t === T.ROOF || t === T.DOOR || t === T.WINDOW || t === T.MILL_WALL || t === T.MILL_ROOF || t === T.FENCE || t === T.PILLAR;
}
