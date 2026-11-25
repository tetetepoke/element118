// Stage 2 map: 珪晶の谷. South (entrance from Carbo village) → north (Crystal Breaker).
// Plain data; Valley.ts turns it into tiles and objects. Uses the 'tiles2' tileset ids (T2).
import { T2 } from '../assets/stage2Placeholders';

export const VMAP_W = 48;
export const VMAP_H = 96;

export type VEntityType =
  | 'npc' | 'enemy' | 'monument' | 'hardrock' | 'crevice' | 'plate' | 'gate' | 'terminal' | 'unknown'
  | 'boss' | 'console' | 'deco' | 'trigger' | 'exit';

export interface VEntity {
  type: VEntityType;
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props?: Record<string, string | number | boolean>;
}

export interface ValleyMap {
  ground: number[][];
  solid: number[][];
  entities: VEntity[];
  start: { x: number; y: number };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Tile coordinates of key places (also used by tests). */
export const VP = {
  start: { x: 24, y: 90 },
  researcher: { x: 20, y: 88 },
  monument1: { x: 31, y: 87 },
  rockwall: { y: 74, x0: 14, x1: 33 },
  silica: { x: 40, y: 67 },
  terminal: { x: 40, y: 52 },
  unknown: { x: 37, y: 53 },
  heat1: { y0: 65, y1: 69 },
  monument2: { x: 17, y: 62 },
  crevice: { x0: 23, x1: 24, y0: 56, y1: 61 },
  plate1: { x: 15, y: 50 },
  plate2: { x: 31, y: 50 },
  gate1: { y: 44, x0: 22, x1: 25 },
  rocks2: { y: 40, x0: 12, x1: 35 },
  heat2: { y0: 34, y1: 37 },
  plate3: { x: 14, y: 32 },
  plate4: { x: 33, y: 32 },
  gate2: { y: 30, x0: 22, x1: 25 },
  monument3: { x: 16, y: 26 },
  miner: { x: 31, y: 25 },
  boss: { x: 24, y: 12 },
  consoleL: { x: 10, y: 9 },
  consoleR: { x: 37, y: 9 },
  exit: { x: 23, y: 3 },
};

export function buildValley(): ValleyMap {
  const W = VMAP_W, H = VMAP_H;
  const r = rng(14);
  const ground = Array.from({ length: H }, () => Array.from({ length: W }, () => T2.FLOOR as number));
  const solid = Array.from({ length: H }, () => Array.from({ length: W }, () => T2.CLIFF as number));
  const entities: VEntity[] = [];
  const floor = (x0: number, y0: number, x1: number, y1: number, t: number = -1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      solid[y][x] = -1;
      ground[y][x] = t >= 0 ? t : r() < 0.3 ? T2.FLOOR2 : T2.FLOOR;
    }
  };
  const g = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ground[y][x] = t;
  };
  const s = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) solid[y][x] = t; };
  const e = (type: VEntityType, id: string, x: number, y: number, extra: Partial<VEntity> = {}) => entities.push({ type, id, x, y, ...extra });

  // ── entrance: the river above Carbo village ──
  floor(6, 82, 41, 94, T2.GRASS);
  g(6, 93, 41, 94, T2.SAND);
  for (let x = 0; x < W; x++) { s(x, 95, T2.WATER); }
  g(22, 82, 25, 94, T2.PATH);
  [[8, 84], [10, 90], [38, 85], [36, 91], [12, 86], [40, 89]].forEach(([x, y]) => s(x, y, T2.TREE));
  e('npc', 'researcher', 20, 88, { props: { sprite: 'elder', speaker: 'researcher' } });
  e('monument', 'monument1', 31, 87);
  e('trigger', 'entrance_talk', 23, 86, { w: 4, h: 1 });

  // ── lower valley up to the rock wall ──
  floor(14, 75, 33, 83);
  g(22, 75, 25, 83, T2.PATH);
  e('enemy', 'v_s1', 18, 79, { props: { kind: 'cslime' } });
  e('enemy', 'v_s2', 29, 78, { props: { kind: 'cslime' } });
  [[15, 76], [32, 81]].forEach(([x, y]) => e('deco', `d${x}_${y}`, x, y));
  // rock wall (HARD BREAK target)
  floor(VP.rockwall.x0, VP.rockwall.y, VP.rockwall.x1, VP.rockwall.y);
  e('hardrock', 'rockwall', VP.rockwall.x0, VP.rockwall.y, { w: VP.rockwall.x1 - VP.rockwall.x0 + 1, props: { story: true } });
  e('trigger', 'rockwall_first', 18, 76, { w: 12, h: 1 });

  // ── east route: cliff path → Silica → ancient lab ──
  floor(34, 78, 43, 80);
  floor(38, 59, 43, 80);
  floor(35, 63, 45, 71, T2.CRYS_FLOOR);
  [[36, 64], [44, 64], [36, 70], [45, 68]].forEach(([x, y]) => s(x, y, T2.CRYSTAL));
  e('npc', 'silica', VP.silica.x, VP.silica.y, { props: { sprite: 'silica', speaker: 'silica' } });
  e('trigger', 'east_hint', 34, 79, { w: 1, h: 2 });
  // lab building
  for (let y = 49; y <= 58; y++) for (let x = 34; x <= 46; x++) s(x, y, T2.LAB_WALL);
  floor(35, 50, 45, 57, T2.LAB_FLOOR);
  floor(39, 58, 41, 58, T2.LAB_FLOOR); // door
  s(36, 53, T2.MACHINE); s(36, 54, T2.MACHINE);
  e('terminal', 'terminal', VP.terminal.x, VP.terminal.y);
  e('unknown', 'cu_device1', VP.unknown.x, VP.unknown.y, { props: { needs: 'Cu', label: '電気が必要な装置' } });
  e('enemy', 'v_s3', 41, 74, { props: { kind: 'cslime' } });

  // ── beyond the wall: first heat zone ──
  floor(14, 62, 33, 73);
  g(14, VP.heat1.y0, 33, VP.heat1.y1, T2.HOT);
  g(22, 70, 25, 73, T2.PATH);
  e('trigger', 'heat_first', 14, 71, { w: 20, h: 1 });
  e('monument', 'monument2', VP.monument2.x, VP.monument2.y);
  [[31, 63], [29, 72]].forEach(([x, y]) => e('deco', `d${x}_${y}`, x, y));

  // ── narrow crevice (SiC FORM cannot fit) ──
  floor(VP.crevice.x0, VP.crevice.y0, VP.crevice.x1, VP.crevice.y1, T2.GRAVEL);
  e('crevice', 'crevice1', VP.crevice.x0, VP.crevice.y0, { w: 2, h: VP.crevice.y1 - VP.crevice.y0 + 1 });
  e('trigger', 'crevice_talk', 21, 61, { w: 6, h: 1 });

  // ── twin-switch room 1 ──
  floor(12, 45, 33, 55);
  e('plate', 'p1', VP.plate1.x, VP.plate1.y, { props: { group: 'g1' } });
  e('plate', 'p2', VP.plate2.x, VP.plate2.y, { props: { group: 'g1' } });
  floor(VP.gate1.x0, VP.gate1.y, VP.gate1.x1, VP.gate1.y);
  e('gate', 'g1', VP.gate1.x0, VP.gate1.y, { w: 4 });
  e('enemy', 'v_g1', 24, 50, { props: { kind: 'golem' } });
  e('trigger', 'plates_hint', 18, 53, { w: 12, h: 1 });
  [[13, 46], [33, 54]].forEach(([x, y]) => s(x, y, T2.CRYSTAL));

  // ── second cycle: hard rocks → heat → twin switches ──
  floor(12, 31, 35, 43);
  floor(VP.rocks2.x0, VP.rocks2.y, VP.rocks2.x1, VP.rocks2.y);
  e('hardrock', 'rocks2', VP.rocks2.x0, VP.rocks2.y, { w: VP.rocks2.x1 - VP.rocks2.x0 + 1 });
  g(12, VP.heat2.y0, 35, VP.heat2.y1, T2.HOT);
  e('enemy', 'v_b1', 18, 42, { props: { kind: 'beetle' } });
  e('enemy', 'v_b2', 30, 42, { props: { kind: 'beetle' } });
  e('enemy', 'v_d1', 24, 32, { props: { kind: 'drill' } });
  e('plate', 'p3', VP.plate3.x, VP.plate3.y, { props: { group: 'g2' } });
  e('plate', 'p4', VP.plate4.x, VP.plate4.y, { props: { group: 'g2' } });
  floor(VP.gate2.x0, VP.gate2.y, VP.gate2.x1, VP.gate2.y);
  e('gate', 'g2', VP.gate2.x0, VP.gate2.y, { w: 4 });
  e('trigger', 'lower_hint', 14, 43, { w: 22, h: 1 });

  // ── camp before the boss ──
  floor(12, 22, 35, 29);
  g(22, 22, 25, 29, T2.RAIL);
  e('monument', 'monument3', VP.monument3.x, VP.monument3.y);
  e('npc', 'miner', VP.miner.x, VP.miner.y, { props: { sprite: 'villager', speaker: 'miner' } });
  floor(22, 21, 25, 21, T2.RAIL);

  // ── boss arena (old mine) ──
  floor(8, 5, 39, 20, T2.GRAVEL);
  for (let x = 8; x <= 39; x++) { s(x, 4, T2.MINE_WALL); }
  [[9, 6], [38, 6], [9, 19], [38, 19]].forEach(([x, y]) => s(x, y, T2.CRYSTAL));
  e('boss', 'crystal_breaker', VP.boss.x, VP.boss.y);
  e('console', 'consoleL', VP.consoleL.x, VP.consoleL.y);
  e('console', 'consoleR', VP.consoleR.x, VP.consoleR.y);
  e('trigger', 'boss_intro', 14, 20, { w: 20, h: 1 });
  floor(23, 2, 24, 4, T2.RAIL);
  e('exit', 'exit', VP.exit.x, VP.exit.y, { w: 2 });

  // cliff tops: a cliff tile with floor below reads as a wall face; with floor above, as a top
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid[y][x] === T2.CLIFF && solid[y - 1][x] === -1) solid[y][x] = T2.CLIFF_TOP;
  }
  return { ground, solid, entities, start: VP.start };
}

/** Text dump for checking the layout in tests. */
export function valleyAscii(m: ValleyMap): string {
  const ch: Record<number, string> = { [T2.CLIFF]: '#', [T2.CLIFF_TOP]: '^', [T2.CRYSTAL]: 'C', [T2.LAB_WALL]: 'L', [T2.WATER]: 'w', [T2.TREE]: 'T', [T2.MACHINE]: 'M', [T2.MINE_WALL]: 'm' };
  const rows = m.ground.map((row, y) => row.map((gt, x) => {
    const st = m.solid[y][x];
    if (st >= 0) return ch[st] ?? '#';
    return gt === T2.HOT ? '~' : gt === T2.PATH ? '=' : '.';
  }));
  const tag: Record<string, string> = { npc: 'N', enemy: 'e', monument: 'S', hardrock: 'R', crevice: 'n', plate: 'P', gate: 'D', terminal: 'K', unknown: 'U', boss: 'B', console: 'c', deco: '*', trigger: '', exit: 'X' };
  for (const en of m.entities) {
    const t = tag[en.type];
    if (!t) continue;
    for (let i = 0; i < (en.w ?? 1); i++) for (let j = 0; j < (en.h ?? 1); j++) rows[en.y + j][en.x + i] = t;
  }
  return rows.map((r) => r.join('')).join('\n');
}
