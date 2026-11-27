// Chapter 1 underground world: one heightfield floor + one ceiling, built from "zones" (caverns)
// joined by "corridors" (tunnels and ramps). Everything else is solid rock.
// There is no sky anywhere: the ceiling closes every open space.
// Progress goes north (-z) and up: deepest = the dump (y 0), the upper gate is at y 62.
import * as THREE from 'three';
import type { Ground } from '../../world/ground';

export const HALF = 160;
export const ROCK = 320; // solid rock surface height (above every ceiling)

export interface Zone {
  id: string;
  name: string; // shown when you enter
  sub: string;
  c: THREE.Vector2;
  rx: number;
  rz: number;
  y: number; // floor height
  clear: number; // ceiling height above the floor
  rough: number; // floor unevenness (m)
  tint: number; // floor colour
  ceilTint: number;
}
export interface Corridor {
  id: string;
  a: THREE.Vector2;
  b: THREE.Vector2;
  y0: number;
  y1: number;
  w: number; // half width
  clear: number;
}

const V = (x: number, z: number) => new THREE.Vector2(x, z);

export const ZONES: Zone[] = [
  { id: 'dump', name: '第七廃棄区', sub: 'だいななはいきく', c: V(20, 120), rx: 34, rz: 26, y: 0, clear: 26, rough: 0.8, tint: 0x5a4a3c, ceilTint: 0x2a2420 },
  { id: 'cave', name: '廃棄区の奥', sub: '誰も入れなかった場所', c: V(-30, 128), rx: 8, rz: 7, y: 0.5, clear: 7, rough: 0.3, tint: 0x4a4038, ceilTint: 0x241f1c },
  { id: 'city', name: '地下都市', sub: 'アトミア', c: V(10, 20), rx: 60, rz: 50, y: 4, clear: 66, rough: 0.25, tint: 0x6a5f54, ceilTint: 0x1e1c22 },
  { id: 'river', name: '地下水脈', sub: 'くらい川が流れる場所', c: V(-78, -25), rx: 34, rz: 28, y: 14, clear: 28, rough: 0.6, tint: 0x3c4a50, ceilTint: 0x1a2228 },
  { id: 'fungus', name: '菌類の森', sub: '光る菌が育つ層', c: V(-60, -85), rx: 30, rz: 24, y: 22, clear: 30, rough: 0.7, tint: 0x4a3c58, ceilTint: 0x221a2a },
  { id: 'mineral', name: '鉱物層', sub: '赤い岩と砂の層', c: V(10, -95), rx: 32, rz: 24, y: 32, clear: 28, rough: 0.9, tint: 0x7a5440, ceilTint: 0x2c1e18 },
  { id: 'ante', name: '古い部屋', sub: '二つの台座', c: V(70, -72), rx: 16, rz: 12, y: 36, clear: 14, rough: 0.05, tint: 0x5c5a58, ceilTint: 0x262628 },
  { id: 'crystal', name: '結晶層', sub: '光が上へ流れる場所', c: V(105, -15), rx: 28, rz: 32, y: 44, clear: 90, rough: 0.6, tint: 0x56607a, ceilTint: 0x161a26 },
  { id: 'facility', name: '古代施設', sub: '誰が作ったのか', c: V(85, 62), rx: 24, rz: 16, y: 52, clear: 26, rough: 0.05, tint: 0x55575c, ceilTint: 0x202124 },
  { id: 'gate', name: '上層門', sub: 'ここから、上へ', c: V(126, 78), rx: 15, rz: 14, y: 62, clear: 36, rough: 0.1, tint: 0x4c4e56, ceilTint: 0x18191e },
  // behind the gate: a shaft going up further than anyone can see (never entered in chapter 1)
  { id: 'beyond', name: '???', sub: '', c: V(148, 78), rx: 8, rz: 8, y: 62, clear: 240, rough: 0.1, tint: 0x3a3c44, ceilTint: 0x101014 },
];

export const CORRIDORS: Corridor[] = [
  { id: 'dump_exit', a: V(20, 101), b: V(20, 74), y0: 0, y1: 12, w: 4.5, clear: 7 },
  { id: 'city_ledge', a: V(20, 74), b: V(20, 66), y0: 12, y1: 12, w: 6, clear: 9 },
  { id: 'city_ramp', a: V(20, 66), b: V(27, 50), y0: 12, y1: 4, w: 4, clear: 9 },
  { id: 'to_river', a: V(-34, 18), b: V(-64, -10), y0: 4, y1: 14, w: 4.5, clear: 8 },
  { id: 'to_fungus', a: V(-84, -36), b: V(-70, -70), y0: 14, y1: 22, w: 4.5, clear: 8 },
  { id: 'to_mineral', a: V(-38, -87), b: V(-12, -93), y0: 22, y1: 32, w: 4, clear: 7 },
  { id: 'cap_route', a: V(-52, -104), b: V(-8, -104), y0: 30, y1: 32, w: 3, clear: 6 },
  { id: 'to_ante', a: V(36, -92), b: V(60, -76), y0: 32, y1: 36, w: 3.5, clear: 7 },
  { id: 'shortcut', a: V(6, -78), b: V(10, -22), y0: 32, y1: 4, w: 3.5, clear: 7 },
  { id: 'to_crystal', a: V(72, -66), b: V(95, -38), y0: 36, y1: 44, w: 3.5, clear: 7 },
  { id: 'to_facility', a: V(104, 10), b: V(92, 52), y0: 44, y1: 52, w: 4, clear: 8 },
  { id: 'to_gate', a: V(100, 64), b: V(118, 76), y0: 52, y1: 62, w: 4, clear: 9 },
  { id: 'to_cave', a: V(-8, 124), b: V(-24, 127), y0: 0, y1: 0.5, w: 2.4, clear: 5 },
];

/** Named spots (gameplay and tests). */
export const SPOTS = {
  wake: V(8, 104),
  pileTop: V(22, 116),
  pit: V(42, 132),
  exitHeap: V(20, 97.5),
  ledge: V(20, 69),
  bridgeA: V(4, 30),
  bridgeB: V(33, 29),
  plaza: V(8, 14),
  elder: V(36, 8),
  root_city: V(42, 2),
  lab: V(-26, 2),
  cityCrack: V(9.2, -33.2),
  riverStalk: V(-80, -20.5),
  riverStones: V(-104, -28),
  riverDock: V(-62, -21),
  riverFar: V(-62, -36),
  rootBarrier: V(-31.5, -88.6),
  silica: V(18, -100),
  hardWall: V(44.4, -86.8),
  plateA: V(62, -75),
  plateB: V(79, -69),
  anteDoor: V(77.75, -59),
  rootShaft: V(108, -12),
  reveal: V(98, -32),
  gateDoor: V(140, 78),
  gateStop: V(132, 78),
  caveBoulder: V(-15.5, 125.4),
};

export const RIVER = { z: -28, half: 4.4, x0: -112, x1: -46, level: 13.2 };
export const CHASM = { z: 30, x0: -45, x1: 62 };

// ── noise ──
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number, oct = 3) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function segT(x: number, z: number, a: THREE.Vector2, b: THREE.Vector2) {
  const vx = b.x - a.x, vz = b.y - a.y;
  const len2 = vx * vx + vz * vz;
  const raw = ((x - a.x) * vx + (z - a.y) * vz) / len2;
  const t = Math.max(0, Math.min(1, raw));
  const len = Math.sqrt(len2);
  const beyond = raw < 0 ? -raw * len : raw > 1 ? (raw - 1) * len : 0;
  return { t, d: Math.hypot(x - (a.x + vx * t), z - (a.y + vz * t)), beyond };
}

/** which zone a point is in (strongest), and how open the point is */
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

interface Sample { floor: number; ceil: number; open: number }
const _s: Sample = { floor: 0, ceil: 0, open: 0 };

function sample(x: number, z: number): Sample {
  const { zone, w: zw } = zoneAt(x, z);
  let open = 0, ceil = 0, W = zw;
  if (zone) {
    open = zone.y + (fbm(x * 0.09, z * 0.09) - 0.5) * 2 * zone.rough;
    ceil = zone.y + zone.clear - fbm(x * 0.05 + 7, z * 0.05) * zone.clear * 0.35;
    // features carved into zones
    if (zone.id === 'river') {
      const dz = Math.abs(z - RIVER.z), inX = smoothstep(RIVER.x0 - 4, RIVER.x0, x) * (1 - smoothstep(RIVER.x1, RIVER.x1 + 6, x));
      open -= 3.4 * (1 - smoothstep(RIVER.half - 1.6, RIVER.half + 0.6, dz)) * Math.max(inX, x > RIVER.x1 ? 1 : 0);
    }
    if (zone.id === 'city') {
      const cz = CHASM.z + Math.sin(x * 0.08) * 3;
      const dz = Math.abs(z - cz);
      if (x > CHASM.x0 - 12 && x < CHASM.x1 + 12) open -= 22 * (1 - smoothstep(3.2, 4.6, dz));
    }
    if (zone.id === 'dump') {
      const d = Math.hypot(x - SPOTS.pit.x, z - SPOTS.pit.y);
      open -= 40 * (1 - smoothstep(3.6, 5.2, d)); // the deepest pit: nobody knows how far down it goes
      // heaps of junk: big lumps of ground
      open += 2.2 * smoothstep(0.55, 0.85, vnoise(x * 0.09, z * 0.09));
    }
    if (zone.id === 'crystal') open += 2.5 * smoothstep(0.6, 0.9, vnoise(x * 0.12 + 3, z * 0.12));
  }
  // corridors: blended by how strongly each one claims the point. Past its ends a corridor fades
  // quickly, so two corridors meeting at a joint do not fight over the slope.
  let sw = 0, sy = 0, cwMax = 0, cCeil = -Infinity;
  for (const c of CORRIDORS) {
    const s = segT(x, z, c.a, c.b);
    const cw = (1 - smoothstep(c.w * 0.62, c.w, s.d)) * (1 - smoothstep(0, 2.5, s.beyond));
    if (cw <= 0) continue;
    const cy = c.y0 + (c.y1 - c.y0) * s.t + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.2;
    const k = cw ** 4;
    sw += k;
    sy += cy * k;
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

export function heightAt(x: number, z: number) {
  return sample(x, z).floor;
}
export function ceilAt(x: number, z: number) {
  return sample(x, z).ceil;
}
export function openAt(x: number, z: number) {
  return sample(x, z).open;
}

export function waterAt(x: number, z: number): number | null {
  if (x > RIVER.x0 - 2 && x < RIVER.x1 + 6 && Math.abs(z - RIVER.z) < RIVER.half + 0.2) return RIVER.level;
  return null;
}

export const caveGround: Ground = {
  heightAt,
  waterAt,
  ceilingAt: ceilAt,
  half: HALF,
  spawn: { x: SPOTS.wake.x, z: SPOTS.wake.y },
};

// ── meshes ──
export function buildCaveMeshes(seg = 256) {
  const size = HALF * 2;
  const floorG = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const cseg = Math.round(seg * 0.6); // the ceiling is mostly in the dark: coarser is fine
  const ceilG = new THREE.PlaneGeometry(size, size, cseg, cseg).rotateX(Math.PI / 2);
  const fp = floorG.attributes.position as THREE.BufferAttribute;
  const cp = ceilG.attributes.position as THREE.BufferAttribute;
  const fc = new Float32Array(fp.count * 3), cc = new Float32Array(cp.count * 3);
  const c = new THREE.Color(), rock = new THREE.Color(0x3a3430), rockB = new THREE.Color(0x4c4540), dark = new THREE.Color(0x15130f);
  const zc = new THREE.Color();
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    const s = sample(x, z);
    const fl = s.floor, ce = s.ceil, o = s.open;
    fp.setY(i, fl);
    const { zone } = zoneAt(x, z);
    zc.set(zone ? zone.tint : 0x3a3430);
    // strata on the walls, the zone's own floor colour where it is open
    c.copy(rock).lerp(rockB, vnoise(x * 0.05, fl * 0.35));
    if (o > 0.6) c.lerp(zc, smoothstep(0.6, 0.95, o)).multiplyScalar(0.85 + 0.3 * vnoise(x * 0.4, z * 0.4));
    if (fl > 120) c.lerp(dark, 0.7);
    if (zone?.id === 'crystal' && o > 0.5 && vnoise(x * 0.6, z * 0.6) > 0.78) c.lerp(new THREE.Color(0x7fb0e0), 0.5);
    if (zone?.id === 'mineral' && vnoise(x * 0.5 + 9, z * 0.5) > 0.75) c.lerp(new THREE.Color(0xa0603a), 0.5);
    fc.set([c.r, c.g, c.b], i * 3);
    void ce;
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
  const floor = new THREE.Mesh(floorG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const ceiling = new THREE.Mesh(ceilG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  floor.name = 'floor';
  ceiling.name = 'ceiling';
  return { floor, ceiling };
}
