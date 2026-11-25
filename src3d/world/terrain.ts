// Terrain = an analytic height function. Ground checks, slopes, the camera and the mesh all use
// the same heightAt(), so what you see is exactly what you walk on.
// World units are metres. The playable field is 200 m x 200 m (x, z in [-100, 100]); -z is north.
import * as THREE from 'three';

export const HALF = 100;
export const WATER_Y = 0;
export const PLATEAU_H = 16;

/** Key places (also used by tests). */
export const PLACES = {
  spawn: new THREE.Vector2(0, 72),
  silica: new THREE.Vector2(2, -9),
  rampA: new THREE.Vector2(8, -20), // bottom of the gorge ramp
  rampB: new THREE.Vector2(36, -48), // top (on the plateau)
  hardRock: new THREE.Vector2(19.6, -31.6), // blocks the gorge where it enters the plateau
  plateau: new THREE.Vector2(56, -56),
  landmark: new THREE.Vector2(62, -64),
  ruins: new THREE.Vector2(-45, -35),
  pond: new THREE.Vector2(-30, 38),
};

// ── noise ──
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** 0 outside → 1 on the plateau, with a steep 3 m cliff band. */
export function plateauMask(x: number, z: number) {
  const dx = Math.abs(x - PLACES.plateau.x) - 34, dz = Math.abs(z - PLACES.plateau.y) - 34;
  const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - 4;
  return 1 - smoothstep(-1.5, 1.5, d);
}

/** Position along the gorge ramp: t (0 = bottom, 1 = top) and distance from its centre line. */
export function rampCoord(x: number, z: number) {
  const ax = PLACES.rampA.x, az = PLACES.rampA.y, bx = PLACES.rampB.x, bz = PLACES.rampB.y;
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz;
  const t = ((x - ax) * vx + (z - az) * vz) / len2;
  const px = ax + vx * t, pz = az + vz * t;
  return { t, d: Math.hypot(x - px, z - pz) };
}

function base(x: number, z: number) {
  let h = 1.4 + 1.6 * (vnoise(x * 0.035, z * 0.035) - 0.5) + 0.6 * (vnoise(x * 0.11 + 7, z * 0.11 + 3) - 0.5);
  // hills
  h += gauss(x, z, PLACES.ruins.x, PLACES.ruins.y, 22, 9);
  h += gauss(x, z, -62, 44, 16, 6);
  h += gauss(x, z, 42, 36, 20, 5);
  h += gauss(x, z, -8, 18, 11, 2.5);
  h += gauss(x, z, -80, -80, 25, 12);
  h += gauss(x, z, 82, 70, 22, 8);
  // pond basin
  const pd = Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y);
  h -= 4.2 * (1 - smoothstep(4, 15, pd));
  return h;
}

export function heightAt(x: number, z: number): number {
  let h = base(x, z);
  // flat top for the ruins
  const rd = Math.hypot(x - PLACES.ruins.x, z - PLACES.ruins.y);
  const ruinsTop = base(PLACES.ruins.x, PLACES.ruins.y);
  h = h + (ruinsTop - h) * (1 - smoothstep(8, 12, rd));
  // plateau
  h += PLATEAU_H * plateauMask(x, z);
  // the gorge ramp cut into the plateau (the only walkable way up — blocked by a hard rock)
  const { t, d } = rampCoord(x, z);
  if (t > -0.08 && t < 1.08) {
    const tc = Math.min(1, Math.max(0, t));
    const target = base(x, z) + PLATEAU_H * tc;
    const m = (1 - smoothstep(3.5, 5.5, d)) * (1 - smoothstep(1.0, 1.08, t)) * smoothstep(-0.08, 0, t);
    h = h + (target - h) * m;
  }
  // soft walls at the edge of the field
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(92, 100, edge) * 14;
  return h;
}

export function normalAt(x: number, z: number, out = new THREE.Vector3()) {
  const e = 0.35;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

/** Terrain mesh with vertex colours (grass / dirt path / rock on steep slopes / sand by the water). */
export function buildTerrainMesh(segments = 200) {
  const size = HALF * 2;
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const grassA = new THREE.Color(0x5fa03a), grassB = new THREE.Color(0x86b84a), rock = new THREE.Color(0x8a8076), rockDark = new THREE.Color(0x6b625a);
  const sand = new THREE.Color(0xd8c48e), dirt = new THREE.Color(0xb08a5a), plateauGrass = new THREE.Color(0x7aa848);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    normalAt(x, z, n);
    const steep = 1 - n.y;
    c.copy(grassA).lerp(grassB, vnoise(x * 0.08, z * 0.08));
    if (plateauMask(x, z) > 0.95) c.lerp(plateauGrass, 0.5);
    // footpath from the spawn to the gorge
    const pathD = Math.abs(x - (Math.sin(z * 0.05) * 6 + (z < 0 ? (-z) * 0.25 : 0)));
    if (z < 74 && z > -22 && pathD < 1.6) c.lerp(dirt, 0.75 * (1 - pathD / 1.6));
    const { t, d } = rampCoord(x, z);
    if (t > 0 && t < 1 && d < 3.5) c.lerp(dirt, 0.6);
    if (h < WATER_Y + 0.8) c.lerp(sand, smoothstep(WATER_Y + 0.8, WATER_Y + 0.1, h));
    if (steep > 0.28) c.copy(rock).lerp(rockDark, vnoise(x * 0.5, z * 0.5) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
