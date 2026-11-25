// Terrain = an analytic height function. Ground checks, slopes, water, the camera and the mesh all use
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
  rampA: new THREE.Vector2(8, -20), // gorge ramp bottom
  rampB: new THREE.Vector2(36, -48), // gorge ramp top (on the plateau)
  hardRock: new THREE.Vector2(19.6, -31.6), // blocks the gorge where it enters the plateau
  stepsA: new THREE.Vector2(30, -14), // rock shelves along the south cliff (the climbing route), low end
  stepsB: new THREE.Vector2(54, -14), // high end, level with the plateau
  plateau: new THREE.Vector2(56, -56),
  landmark: new THREE.Vector2(62, -64),
  ruins: new THREE.Vector2(-45, -35),
  crag: new THREE.Vector2(-66, -52), // lookout crag over the ruins
  hollow: new THREE.Vector2(30, 22),
  pond: new THREE.Vector2(-30, 38),
};

/** The stream: from the north-west hills down past the ruins into the pond. */
export const STREAM = [
  new THREE.Vector2(-88, -80), new THREE.Vector2(-84, -60), new THREE.Vector2(-72, -36), new THREE.Vector2(-58, -20), new THREE.Vector2(-50, -6),
  new THREE.Vector2(-48, 12), new THREE.Vector2(-40, 28), new THREE.Vector2(-32, 36),
];

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
function fbm(x: number, z: number, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** distance to a polyline (and the index of the closest segment) */
function polyDist(x: number, z: number, line: THREE.Vector2[]) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const vx = b.x - a.x, vz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.y) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - (a.x + vx * t), z - (a.y + vz * t));
    if (d < best) best = d;
  }
  return best;
}

/** 0 outside → 1 on the plateau; the cliff line wanders so it does not look ruled. */
export function plateauMask(x: number, z: number) {
  const dx = Math.abs(x - PLACES.plateau.x) - 34, dz = Math.abs(z - PLACES.plateau.y) - 34;
  let d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - 4;
  // wander, but keep the gorge and the climbing shelves exact
  const keep = Math.min(rampCoord(x, z).d / 10, Math.hypot(Math.max(0, Math.abs(x - 42) - 14), z + 18) / 8, 1);
  d += (fbm(x * 0.06, z * 0.06, 3) - 0.5) * 7 * smoothstep(0.3, 1, keep);
  return 1 - smoothstep(-1.6, 1.6, d);
}

/** Position along a segment: t (0..1) and distance from it. */
function segCoord(x: number, z: number, a: THREE.Vector2, b: THREE.Vector2) {
  const vx = b.x - a.x, vz = b.y - a.y;
  const len2 = vx * vx + vz * vz;
  const t = ((x - a.x) * vx + (z - a.y) * vz) / len2;
  return { t, d: Math.hypot(x - (a.x + vx * t), z - (a.y + vz * t)) };
}
export const rampCoord = (x: number, z: number) => segCoord(x, z, PLACES.rampA, PLACES.rampB);

function base(x: number, z: number) {
  // gentle rolling ground with small-scale relief (no flat planes)
  let h = 1.2 + 2.4 * (fbm(x * 0.025, z * 0.025) - 0.5) + 0.35 * (vnoise(x * 0.3, z * 0.3) - 0.5);
  h += gauss(x, z, PLACES.ruins.x, PLACES.ruins.y, 22, 9);
  h += gauss(x, z, -62, 44, 16, 6);
  h += gauss(x, z, 42, 38, 20, 5);
  h += gauss(x, z, -8, 18, 11, 2.5);
  h += gauss(x, z, -82, -82, 25, 12);
  h += gauss(x, z, 82, 72, 22, 8);
  h += gauss(x, z, 14, 44, 9, 3.5); // little knoll by the start
  h -= gauss(x, z, PLACES.hollow.x, PLACES.hollow.y, 9, 3.2); // a low hollow
  // lookout crag: steep sides, a flat-ish top (climb the rock shelves around it)
  const cd = Math.hypot(x - PLACES.crag.x, z - PLACES.crag.y);
  h += 13 * (1 - smoothstep(5.5, 9.5, cd)) + 2 * gauss(x, z, PLACES.crag.x, PLACES.crag.y, 14, 1);
  // pond basin
  const pd = Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y);
  h -= 4.2 * (1 - smoothstep(4, 15, pd));
  return h;
}

/** Stream bed depth at a point (0 away from the stream). */
function streamCarve(x: number, z: number) {
  const d = polyDist(x, z, STREAM);
  return 1.3 * (1 - smoothstep(1.2, 4.2, d));
}

export function heightAt(x: number, z: number): number {
  let h = base(x, z);
  const rd = Math.hypot(x - PLACES.ruins.x, z - PLACES.ruins.y);
  const ruinsTop = base(PLACES.ruins.x, PLACES.ruins.y);
  h = h + (ruinsTop - h) * (1 - smoothstep(8, 12, rd)); // flat top for the ruins
  h -= streamCarve(x, z);
  h += PLATEAU_H * plateauMask(x, z);
  // the gorge ramp (blocked by a hard rock)
  const r = rampCoord(x, z);
  if (r.t > -0.08 && r.t < 1.08) {
    const tc = Math.min(1, Math.max(0, r.t));
    const target = base(x, z) + PLATEAU_H * tc;
    const m = (1 - smoothstep(3.5, 5.5, r.d)) * (1 - smoothstep(1.0, 1.08, r.t)) * smoothstep(-0.08, 0, r.t);
    h = h + (target - h) * m;
  }
  // rock shelves along the south cliff: ~1.8 m steps you climb one by one (the other way up)
  const st = stairAt(x, z);
  if (st !== null) h = Math.max(h, st);
  // the field's edge rises into wooded hills (a wandering rise, not a straight wall)
  const edge = Math.max(Math.abs(x), Math.abs(z)) + (fbm(x * 0.04 + 31, z * 0.04, 3) - 0.5) * 9;
  h += smoothstep(78, 102, edge) ** 1.5 * 15;
  return h;
}

export const STAIR_STEPS = 9;
const STAIR_Z0 = -11.6; // south edge of the shelves (the north side runs into the cliff)
let stairLo = NaN, stairHi = NaN;
/** Height of the climbing shelves at (x, z), or null outside them. Treads are flat. */
export function stairAt(x: number, z: number): number | null {
  const a = PLACES.stepsA, b = PLACES.stepsB;
  if (x < a.x - 1 || x > b.x + 1 || z > STAIR_Z0 + 1.2 || z < -21) return null;
  if (Number.isNaN(stairLo)) { stairLo = base(a.x, a.y) + 0.6; stairHi = base(b.x, -21) + PLATEAU_H; }
  const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
  const k = Math.min(STAIR_STEPS - 1, Math.floor(t * STAIR_STEPS));
  const top = stairLo + (stairHi - stairLo) * (k / (STAIR_STEPS - 1));
  const m = smoothstep(a.x - 1, a.x, x) * (1 - smoothstep(b.x, b.x + 1, x)) * (1 - smoothstep(STAIR_Z0, STAIR_Z0 + 1.2, z));
  const g = base(x, z) - streamCarve(x, z);
  return g + (top - g) * m;
}
/** Tread top of shelf k (for meshes and tests). */
export function stairTreadTop(k: number) {
  stairAt(PLACES.stepsA.x, PLACES.stepsA.y);
  return stairLo + (stairHi - stairLo) * (k / (STAIR_STEPS - 1));
}

/** Water surface at (x, z) or null. The pond is level; the stream follows its bed. */
export function waterSurfaceAt(x: number, z: number): number | null {
  if (Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y) < 17) return WATER_Y;
  const d = polyDist(x, z, STREAM);
  if (d < 2.6) return streamLevel(x, z);
  return null;
}

/** Stream water level along the stream (for the water ribbon mesh). */
export function streamLevel(x: number, z: number) {
  return base(x, z) - 0.85;
}

export function normalAt(x: number, z: number, out = new THREE.Vector3()) {
  const e = 0.35;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

export function streamDistance(x: number, z: number) {
  return polyDist(x, z, STREAM);
}

/** Terrain mesh with vertex colours: two grasses, dry patches, dirt paths, rock on steep slopes, sand by water. */
export function buildTerrainMesh(segments = 200) {
  const size = HALF * 2;
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const grassA = new THREE.Color(0x5a9a38), grassB = new THREE.Color(0x8cbc4c), dry = new THREE.Color(0xa8b45a);
  const rock = new THREE.Color(0x8d847a), rockDark = new THREE.Color(0x645c55), rockWarm = new THREE.Color(0x9a8a76);
  const sand = new THREE.Color(0xd2c08c), dirt = new THREE.Color(0xa8855a), plateauGrass = new THREE.Color(0x78a446), moss = new THREE.Color(0x4a7a34);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    normalAt(x, z, n);
    const steep = 1 - n.y;
    c.copy(grassA).lerp(grassB, fbm(x * 0.05, z * 0.05, 3));
    c.lerp(dry, smoothstep(0.62, 0.8, vnoise(x * 0.02 + 9, z * 0.02)) * 0.6);
    if (plateauMask(x, z) > 0.95) c.lerp(plateauGrass, 0.45);
    // footpath: spawn → gorge, with a branch toward the ruins
    const p1 = Math.abs(x - (Math.sin(z * 0.05) * 6 + (z < 0 ? -z * 0.25 : 0)));
    const p2 = Math.abs(z - (-12 + (x + 10) * -0.45)) ;
    if (z < 74 && z > -22 && p1 < 1.5) c.lerp(dirt, 0.75 * (1 - p1 / 1.5));
    if (x < -8 && x > -36 && p2 < 1.3) c.lerp(dirt, 0.6 * (1 - p2 / 1.3));
    const r = rampCoord(x, z);
    if (r.t > 0 && r.t < 1 && r.d < 3.5) c.lerp(dirt, 0.6);
    const sd = streamDistance(x, z);
    if (sd < 4.5) c.lerp(moss, 0.5 * (1 - sd / 4.5));
    if (h < WATER_Y + 0.8 && Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y) < 22) c.lerp(sand, smoothstep(WATER_Y + 0.8, WATER_Y + 0.1, h));
    if (sd < 2.4) c.lerp(sand, 0.5);
    const edgeZone = smoothstep(80, 92, Math.max(Math.abs(x), Math.abs(z)));
    if (edgeZone > 0) c.lerp(new THREE.Color(0x3f7a34), edgeZone * 0.6); // forested rim
    if (steep > 0.3 && edgeZone < 0.5) c.copy(rock).lerp(rockDark, vnoise(x * 0.5, z * 0.5) * 0.7).lerp(rockWarm, vnoise(x * 0.13, h * 0.4) * 0.4);
    else if (steep > 0.2) c.lerp(rock, Math.min(1, (steep - 0.2) * 6) * (edgeZone > 0.5 ? 0.5 : 1));
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
