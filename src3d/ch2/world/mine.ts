// Chapter 2 underground world (the far side of the upper gate): caverns ("zones") joined by tunnels
// ("corridors"), one floor and one ceiling. Corridor ends reach well inside the caverns they join. Same rules as chapter 1: no sky anywhere.
// Progress: the gate (south, +z) → the old adit → the miners' village → west (malachite) / east (tin
// stream) → south-west deep vein / south-east power station → back to the big shaft and up.
import * as THREE from 'three';
import { caveSurface } from '../../world/caveSurface';
import type { Ground } from '../../world/ground';

export const HALF = 120;
export const ROCK = 260;

export interface Zone {
  id: string; name: string; sub: string;
  c: THREE.Vector2; rx: number; rz: number;
  y: number; clear: number; rough: number; tint: number; ceilTint: number;
}
export interface Corridor { id: string; a: THREE.Vector2; b: THREE.Vector2; y0: number; y1: number; w: number; clear: number }

const V = (x: number, z: number) => new THREE.Vector2(x, z);

export const ZONES: Zone[] = [
  { id: 'gate', name: '上層門の裏', sub: 'もう、戻れない', c: V(0, 92), rx: 14, rz: 11, y: 0, clear: 34, rough: 0.1, tint: 0x4c4e56, ceilTint: 0x18191e },
  { id: 'shaft', name: '大縦穴', sub: '根が、上へ', c: V(27, 90), rx: 11, rz: 11, y: 0, clear: 220, rough: 0.2, tint: 0x3e4250, ceilTint: 0x101218 },
  { id: 'adit', name: '上層坑道', sub: 'レールが続いている', c: V(0, 58), rx: 7, rz: 16, y: 3, clear: 9, rough: 0.15, tint: 0x5a4a3a, ceilTint: 0x221c18 },
  { id: 'village', name: 'カンテラ村', sub: '坑夫たちの集落', c: V(0, 12), rx: 34, rz: 26, y: 6, clear: 32, rough: 0.25, tint: 0x6a5848, ceilTint: 0x201a18 },
  { id: 'green', name: '緑の坑', sub: '孔雀石の層', c: V(-58, 0), rx: 22, rz: 18, y: 10, clear: 18, rough: 0.6, tint: 0x3a5a48, ceilTint: 0x16221c },
  { id: 'stream', name: '砂錫の沢', sub: '重い砂がたまる沢', c: V(56, 4), rx: 22, rz: 16, y: 2, clear: 16, rough: 0.35, tint: 0x5a5650, ceilTint: 0x1c1c20 },
  { id: 'record', name: '記録の間', sub: 'だれも読めない文字', c: V(0, -40), rx: 9, rz: 7, y: 8, clear: 10, rough: 0.05, tint: 0x5c5a58, ceilTint: 0x262628 },
  { id: 'deep', name: '緑青の洞', sub: '眠るもの', c: V(-62, -62), rx: 20, rz: 16, y: 16, clear: 20, rough: 0.5, tint: 0x2e5a4a, ceilTint: 0x12201c },
  { id: 'station', name: '根の光の発電所', sub: 'だれが作ったのか', c: V(52, -62), rx: 22, rz: 16, y: 12, clear: 30, rough: 0.05, tint: 0x55575c, ceilTint: 0x1a1b20 },
];

export const CORRIDORS: Corridor[] = [
  { id: 'gate_adit', a: V(0, 86), b: V(0, 70), y0: 0, y1: 3, w: 4, clear: 7 },
  { id: 'gate_shaft', a: V(11, 91), b: V(18, 90), y0: 0, y1: 0, w: 4.5, clear: 10 },
  { id: 'adit_village', a: V(0, 48), b: V(0, 32), y0: 3, y1: 6, w: 4, clear: 8 },
  { id: 'vil_green', a: V(-26, 7), b: V(-41, 2), y0: 6, y1: 10, w: 4, clear: 8 },
  { id: 'vil_stream', a: V(26, 9), b: V(39, 6), y0: 6, y1: 2, w: 4, clear: 8 },
  { id: 'vil_record', a: V(0, -8), b: V(0, -36), y0: 6, y1: 8, w: 3.2, clear: 7 },
  { id: 'green_deep', a: V(-58, -12), b: V(-60, -50), y0: 10, y1: 16, w: 3.5, clear: 7 },
  { id: 'stream_station', a: V(56, -6), b: V(54, -50), y0: 2, y1: 12, w: 3.5, clear: 8 },
];

/** named spots (gameplay and tests) */
export const SPOTS = {
  start: V(0, 97),
  gateDoor: V(0, 100.5),
  lift: V(22, 90),
  rootShaft: V(30, 92),
  adit: V(0, 58),
  village: V(0, 22),
  chief: V(6, 4),
  smelter: V(-16, 14),
  furnace: V(-20, 10),
  kiln: V(-22, 18),
  keeper: V(14, -6),
  timber: V(5, 66),
  timber2: V(18, 24),
  malachite: V(-60, -2),
  stream: V(56, 4),
  rubble: V(-59, -30),
  geode: V(-64, -66),
  bait: V(-50, -54),
  plate: V(0, -44),
  gapA: V(44, -66),
  gapB: V(60, -66),
  panels: V(52, -74),
};

export const STREAM = { z: 4, half: 2.6, x0: 36, x1: 78, level: 1.75 };

// ── noise ──
function hash(x: number, z: number) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number, oct = 3) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function segT(x: number, z: number, a: THREE.Vector2, b: THREE.Vector2) {
  const vx = b.x - a.x, vz = b.y - a.y, len2 = vx * vx + vz * vz;
  const raw = ((x - a.x) * vx + (z - a.y) * vz) / len2;
  const t = Math.max(0, Math.min(1, raw)), len = Math.sqrt(len2);
  const beyond = raw < 0 ? -raw * len : raw > 1 ? (raw - 1) * len : 0;
  return { t, d: Math.hypot(x - (a.x + vx * t), z - (a.y + vz * t)), beyond };
}

export function zoneAt(x: number, z: number): { zone: Zone | null; w: number } {
  let best: Zone | null = null, bw = 0;
  const wob = (fbm(x * 0.07, z * 0.07) - 0.5) * 0.14;
  for (const zn of ZONES) {
    const ed = Math.hypot((x - zn.c.x) / zn.rx, (z - zn.c.y) / zn.rz) + wob;
    const w = 1 - smoothstep(0.82, 1.0, ed);
    if (w > bw) { bw = w; best = zn; }
  }
  return { zone: best, w: bw };
}

const _s = { floor: 0, ceil: 0, open: 0 };
function sample(x: number, z: number) {
  const { zone, w: zw } = zoneAt(x, z);
  let open = 0, ceil = 0, W = zw;
  if (zone) {
    open = zone.y + (fbm(x * 0.09, z * 0.09) - 0.5) * 2 * zone.rough;
    ceil = zone.y + zone.clear - fbm(x * 0.05 + 7, z * 0.05) * zone.clear * 0.35;
    if (zone.id === 'stream') {
      const dz = Math.abs(z - STREAM.z - Math.sin(x * 0.15) * 1.2);
      open -= 0.75 * (1 - smoothstep(STREAM.half - 1.2, STREAM.half + 0.6, dz));
    }
    if (zone.id === 'green') open += 1.6 * smoothstep(0.6, 0.85, vnoise(x * 0.11, z * 0.11));
  }
  let sw = 0, sy = 0, cwMax = 0, cCeil = -Infinity;
  for (const c of CORRIDORS) {
    const s = segT(x, z, c.a, c.b);
    const cw = (1 - smoothstep(c.w * 0.62, c.w, s.d)) * (1 - smoothstep(0, 2.5, s.beyond));
    if (cw <= 0) continue;
    const cy = c.y0 + (c.y1 - c.y0) * s.t + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.2;
    const k = cw ** 4;
    sw += k; sy += cy * k;
    cwMax = Math.max(cwMax, cw);
    cCeil = Math.max(cCeil, cy + c.clear - vnoise(x * 0.2, z * 0.2) * 1.2);
  }
  if (cwMax > 0) {
    const cy = sy / sw;
    open = W > 0 ? open + (cy - open) * cwMax : cy;
    ceil = Math.max(W > 0.01 && zone ? ceil : -Infinity, cCeil);
    W = Math.max(W, cwMax);
  }
  _s.open = W;
  _s.floor = ROCK + (open - ROCK) * W;
  _s.ceil = W > 0 ? Math.max(ceil, _s.floor + 0.2) : ROCK;
  return _s;
}

/** floor mesh resolution; collision uses the same triangles so feet sit on the drawn floor */
export const FLOOR_SEG = typeof window !== 'undefined' && window.innerWidth < 900 ? 160 : 200;
const FCELL = (HALF * 2) / FLOOR_SEG;
const fgrid = new Float32Array((FLOOR_SEG + 1) * (FLOOR_SEG + 1)).fill(NaN);
const fv = (i: number, j: number) => {
  i = Math.max(0, Math.min(FLOOR_SEG, i)); j = Math.max(0, Math.min(FLOOR_SEG, j));
  const k = j * (FLOOR_SEG + 1) + i;
  let h = fgrid[k];
  if (h !== h) h = fgrid[k] = sample(-HALF + i * FCELL, -HALF + j * FCELL).floor;
  return h;
};
export function heightAt(x: number, z: number) {
  const gx = (x + HALF) / FCELL, gz = (z + HALF) / FCELL;
  const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
  const ha = fv(i, j), hb = fv(i, j + 1), hd = fv(i + 1, j);
  if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
  const hc = fv(i + 1, j + 1);
  return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
}
export function ceilAt(x: number, z: number) { return sample(x, z).ceil; }
export function waterAt(x: number, z: number): number | null {
  if (x > STREAM.x0 && x < STREAM.x1 && Math.abs(z - STREAM.z - Math.sin(x * 0.15) * 1.2) < STREAM.half) return STREAM.level;
  return null;
}

export const mineGround: Ground = { heightAt, waterAt, ceilingAt: ceilAt, half: HALF, spawn: { x: SPOTS.start.x, z: SPOTS.start.y } };

export function buildMineMeshes(seg = FLOOR_SEG) {
  const size = HALF * 2;
  const floorG = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const cseg = Math.round(seg * 0.6);
  const ceilG = new THREE.PlaneGeometry(size, size, cseg, cseg).rotateX(Math.PI / 2);
  const fp = floorG.attributes.position as THREE.BufferAttribute, cp = ceilG.attributes.position as THREE.BufferAttribute;
  const fc = new Float32Array(fp.count * 3), cc = new Float32Array(cp.count * 3);
  const c = new THREE.Color(), rock = new THREE.Color(0x3a3430), rockB = new THREE.Color(0x4c4540), dark = new THREE.Color(0x15130f), zc = new THREE.Color();
  const green = new THREE.Color(0x3aa070), copperC = new THREE.Color(0xa0603a);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    const s = sample(x, z);
    fp.setY(i, s.floor);
    const { zone } = zoneAt(x, z);
    zc.set(zone ? zone.tint : 0x3a3430);
    c.copy(rock).lerp(rockB, vnoise(x * 0.05, s.floor * 0.35));
    if (s.open > 0.6) c.lerp(zc, smoothstep(0.6, 0.95, s.open)).multiplyScalar(0.85 + 0.3 * vnoise(x * 0.4, z * 0.4));
    if (s.floor > 120) c.lerp(dark, 0.7);
    // copper country: green streaks of malachite / verdigris, and coppery bands in the walls
    if ((zone?.id === 'green' || zone?.id === 'deep') && vnoise(x * 0.5 + 3, z * 0.5) > 0.66) c.lerp(green, 0.55);
    if (vnoise(x * 0.3 + 11, s.floor * 0.5) > 0.82) c.lerp(copperC, 0.35);
    fc.set([c.r, c.g, c.b], i * 3);
  }
  for (let i = 0; i < cp.count; i++) {
    const cx = cp.getX(i), cz = cp.getZ(i);
    const cs = sample(cx, cz);
    cp.setY(i, cs.ceil);
    const z2 = zoneAt(cx, cz).zone;
    c.set(z2 ? z2.ceilTint : 0x1a1714).multiplyScalar(0.7 + 0.5 * vnoise(cx * 0.3, cz * 0.3));
    cc.set([c.r, c.g, c.b], i * 3);
  }
  floorG.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  ceilG.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  floorG.computeVertexNormals();
  ceilG.computeVertexNormals();
  const floor = new THREE.Mesh(floorG, caveSurface());
  const ceiling = new THREE.Mesh(ceilG, caveSurface(true));
  floor.name = 'floor';
  ceiling.name = 'ceiling';
  return { floor, ceiling };
}
