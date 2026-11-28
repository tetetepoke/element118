// 第七廃棄区 (the dump) — visual dressing only.
// Recognisable junk (broken machines, gears, drums, pipes, crates, metal sheets, furniture, cloth,
// canisters, cables, rocks, odd ancient parts), ground detail (plates, gravel, puddles, cracks) and fake
// lighting (lamp halos, warm light pools, light cones, root glow). Repeated things are instanced.
// Gameplay spots and walking lines are kept clear; only big solid props get simple colliders through the
// existing collider system. Fine bumps are visual only and never touch the walkable ground height.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColliderWorld } from '../../world/colliders';
import { ZONES, SPOTS, vnoise } from './cavern';
import type { LightSpot } from './build';

interface Ctx {
  root: THREE.Group;
  colliders: ColliderWorld;
  lights: LightSpot[];
  g: (x: number, z: number) => number;
  rnd: () => number;
}

const V2 = (x: number, z: number) => new THREE.Vector2(x, z);
/** places where the story, people, harvest piles and paths are: nothing big goes here */
const CLEAR_POINTS: [THREE.Vector2, number][] = [
  [SPOTS.wake, 5.5], [V2(12, 110), 3.5], [V2(15, 112), 3.5], [V2(12, 108), 3], [V2(14.5, 110), 3], [V2(19, 113), 3], [V2(21, 112.5), 3],
  [V2(13, 101), 3.2], [V2(4, 112), 3.2], [V2(26, 108), 3.2], [V2(34, 108), 3.2], [V2(4, 106), 3], [SPOTS.pit, 8.5],
  [V2(30, 128), 6.5], [SPOTS.exitHeap, 7], [SPOTS.caveBoulder, 4.5], [SPOTS.pileTop, 2.5],
  [V2(12, 110), 4], [V2(28, 102), 2], [V2(36, 116), 2], [V2(14, 130), 2],
];
const CLEAR_LINES: [THREE.Vector2, THREE.Vector2, number][] = [
  [SPOTS.wake, V2(16.6, 102), 3], [V2(16.6, 102), SPOTS.exitHeap, 3], [SPOTS.wake, V2(14, 111), 3], [SPOTS.wake, V2(34, 108), 3],
  [SPOTS.wake, V2(4, 112), 3], [V2(14, 111), SPOTS.pit, 3], [SPOTS.wake, V2(-8, 124), 3], [V2(-8, 124), V2(-24, 127), 3.5],
  [V2(14, 111), V2(30, 124), 3], [SPOTS.wake, V2(26, 108), 3],
];
function segDist(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}
function isClear(x: number, z: number, pad: number) {
  const p = V2(x, z);
  for (const [c, r] of CLEAR_POINTS) if (p.distanceTo(c) < r + pad) return false;
  for (const [a, b, r] of CLEAR_LINES) if (segDist(p, a, b) < r + pad) return false;
  return true;
}

// ── materials: each kind of stuff looks different ──
const M = {
  rust: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.55 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x6a6e76, roughness: 0.38, metalness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.7, metalness: 0 }),
  rock: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }),
  sheet: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.65, side: THREE.DoubleSide }),
  ancient: new THREE.MeshStandardMaterial({ color: 0x5a5e6a, roughness: 0.3, metalness: 0.85 }),
  glyph: new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x2a7aff, emissiveIntensity: 1.2, roughness: 0.3 }),
  puddle: new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0.85 }),
};
const RUST = [0x7a3e22, 0x8a5030, 0x5e3a2a, 0x6e4a36, 0x9a5a2e, 0x4e4a48];
const WOOD = [0x8a6a44, 0x7a5a3a, 0x9a7a50, 0x6a4e34];
const CLOTH = [0xcab894, 0x9a9488, 0xb8a888, 0x7a7068, 0xa89878];

// ── geometries (built once) ──
function drumGeo() {
  const body = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 18, 1);
  const rims = [-0.58, -0.2, 0.2, 0.58].map((y) => new THREE.TorusGeometry(0.43, 0.025, 4, 18).rotateX(Math.PI / 2).translate(0, y, 0));
  const lid = new THREE.CircleGeometry(0.36, 18).rotateX(-Math.PI / 2).translate(0, 0.601, 0);
  return mergeGeometries([body.toNonIndexed(), ...rims.map((r) => r.toNonIndexed()), lid.toNonIndexed()]);
}
function crateGeo() {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 0.8, 0.8)];
  // frame boards stand slightly proud of the box
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.BoxGeometry(1.04, 0.1, 0.1).translate(0, sy * 0.36, sz * 0.36));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(sx * 0.47, 0, sz * 0.36));
  parts.push(new THREE.BoxGeometry(1.0, 0.09, 0.84).rotateZ(0.65).translate(0, 0, 0)); // diagonal board
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}
function gearGeo(teeth = 14) {
  const sh = new THREE.Shape();
  const R = 1, r = 0.84;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : R;
    if (i === 0) sh.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    sh.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    sh.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.22, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  for (let k = 0; k < 4; k++) {
    const h = new THREE.Path();
    const a = (k / 4) * Math.PI * 2 + 0.4;
    h.absarc(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.14, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  return new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.08);
}
function rockGeo(seed: number) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = vnoise(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.3 + seed * 3);
    v.multiplyScalar(0.8 + 0.35 * n);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); // smooth shading: rounded, not faceted
  return geo;
}
function canisterGeo() {
  const body = new THREE.CylinderGeometry(0.22, 0.24, 0.6, 16);
  const cap = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10).translate(0.08, 0.35, 0);
  const handle = new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI).translate(-0.04, 0.3, 0);
  return mergeGeometries([body.toNonIndexed(), cap.toNonIndexed(), handle.toNonIndexed()]);
}
function chairGeo() {
  const parts = [
    new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.45, 0),
    new THREE.BoxGeometry(0.5, 0.55, 0.05).translate(0, 0.75, -0.23),
    new THREE.BoxGeometry(0.05, 0.45, 0.05).translate(-0.22, 0.22, -0.22),
    new THREE.BoxGeometry(0.05, 0.45, 0.05).translate(0.22, 0.22, -0.22),
    new THREE.BoxGeometry(0.05, 0.45, 0.05).translate(-0.22, 0.22, 0.22),
    new THREE.BoxGeometry(0.05, 0.22, 0.05).translate(0.22, 0.33, 0.22), // broken leg
  ];
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}
function cabinetGeo() {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.9, 1.3, 0.5).translate(0, 0.65, 0)];
  for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(0.8, 0.02, 0.02).translate(0, 0.35 + i * 0.4, 0.26));
  for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(0.16, 0.04, 0.04).translate(0, 0.5 + i * 0.4, 0.27));
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

/** a cloth thrown over something: a soft dome with sagging, wavy edges */
function clothGeo(seed: number, w = 2.2) {
  const geo = new THREE.PlaneGeometry(w, w, 14, 14).rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x, z) / (w * 0.5);
    let y = Math.max(0, 1 - d * d) * 0.9 - Math.max(0, d - 0.75) * 0.6;
    y += (vnoise(x * 3 + seed, z * 3) - 0.5) * 0.12 + Math.sin(Math.atan2(z, x) * 6 + seed) * 0.05 * d;
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  return geo;
}

function texture(draw: (c: CanvasRenderingContext2D) => void, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!);
  return new THREE.CanvasTexture(cv);
}
const radial = (inner: string, outer: string) => texture((c) => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
});

export function buildDumpProps(ctx: Ctx) {
  const { root, colliders, lights, g, rnd } = ctx;
  const dump = ZONES.find((z) => z.id === 'dump')!;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  const e = new THREE.Euler();
  const updaters: ((t: number) => void)[] = [];
  /** a random open spot in the dump, away from gameplay; ring 0..1 = centre..wall */
  const spot = (pad: number, ring0 = 0.25, ring1 = 0.93): [number, number] | null => {
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, rr = ring0 + (ring1 - ring0) * Math.sqrt(rnd());
      const x = dump.c.x + Math.cos(a) * dump.rx * rr, z = dump.c.y + Math.sin(a) * dump.rz * rr;
      if (isClear(x, z, pad)) return [x, z];
    }
    return null;
  };
  /** a spot just beside a walking line (junk lines both sides of every path), or a free spot */
  const flank = (pad: number, near = 0.6, far = 3.2): [number, number] | null => {
    for (let k = 0; k < 30; k++) {
      const [a, b, r] = CLEAR_LINES[Math.floor(rnd() * CLEAR_LINES.length)];
      const t = rnd();
      const d = b.clone().sub(a).normalize();
      const side = rnd() < 0.5 ? 1 : -1;
      const off = r + pad + near + rnd() * (far - near);
      const x = a.x + (b.x - a.x) * t - d.y * off * side, z = a.y + (b.y - a.y) * t + d.x * off * side;
      if (Math.hypot((x - dump.c.x) / dump.rx, (z - dump.c.y) / dump.rz) > 0.93) continue;
      if (isClear(x, z, pad)) return [x, z];
    }
    return spot(pad);
  };
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.count = 0;
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const put = (m: THREE.InstancedMesh, x: number, y: number, z: number, rot: THREE.Euler, s: THREE.Vector3, c: number) => {
    if (m.count >= m.instanceMatrix.count) return false;
    m4.compose(pv.set(x, y, z), q.setFromEuler(rot), s);
    m.setMatrixAt(m.count, m4);
    m.setColorAt(m.count, col.set(c));
    m.count++;
    return true;
  };

  // ── junk mounds: soft rounded heaps (smooth shading) that the props sit on ──
  const moundGeo = rockGeo(4);
  const mounds = inst(moundGeo, M.rock, 40);
  const moundAt: [number, number, number][] = [];
  for (let i = 0; i < 38; i++) {
    const s = i < 22 ? flank(2.6, 1.5, 5) : spot(3.5, 0.5, 0.95);
    if (!s) continue;
    const [x, z] = s;
    const r = 2.2 + rnd() * 2.6, h = 0.9 + rnd() * 1.6;
    put(mounds, x, g(x, z) - 0.4, z, e.set(0, rnd() * 6, 0), sv.set(r, h, r * (0.8 + rnd() * 0.4)), [0x4a3e34, 0x3e3630, 0x56483a][i % 3]);
    moundAt.push([x, z, h]);
  }
  // the heap Carbon is found in (prologue) stays a heap
  put(mounds, SPOTS.pileTop.x, g(SPOTS.pileTop.x, SPOTS.pileTop.y) - 0.9, SPOTS.pileTop.y, e.set(0, 0.5, 0), sv.set(2.4, 1.3, 2.2), 0x4e4236);
  const onMound = (): [number, number, number] => {
    const [mx, mz, mh] = moundAt[Math.floor(rnd() * moundAt.length)] ?? [dump.c.x, dump.c.y, 0];
    const a = rnd() * Math.PI * 2, d = rnd() * 1.6;
    return [mx + Math.cos(a) * d, mz + Math.sin(a) * d, mh * (0.5 + rnd() * 0.4)];
  };

  // ── drums: standing (solid) and lying on the heaps ──
  const drums = inst(drumGeo(), M.rust, 60);
  for (let i = 0; i < 36; i++) {
    const s = flank(0.5);
    if (!s) continue;
    const [x, z] = s;
    const lying = rnd() < 0.35;
    const y = g(x, z);
    if (lying) {
      const yaw = rnd() * 6;
      put(drums, x, y + 0.4, z, e.set(Math.PI / 2, yaw, 0, 'YXZ'), sv.set(1, 1, 1), RUST[i % RUST.length]);
      colliders.add({ id: `drum${i}`, kind: 'box', x, z, hx: 0.45, hz: 0.58, rot: -yaw, bottom: y - 0.05, top: y + 0.85 });
      e.order = 'XYZ';
    } else {
      put(drums, x, y + 0.58, z, e.set((rnd() - 0.5) * 0.15, rnd() * 6, (rnd() - 0.5) * 0.15), sv.set(1, 1, 1), RUST[i % RUST.length]);
      colliders.add({ id: `drum${i}`, kind: 'cyl', x, z, r: 0.45, bottom: y - 1, top: y + 1.2 });
    }
  }
  for (let i = 0; i < 22; i++) {
    const [x, z, hy] = onMound();
    put(drums, x, g(x, z) + hy, z, e.set(rnd() * 3, rnd() * 6, rnd() * 3), sv.setScalar(0.9 + rnd() * 0.2), RUST[(i + 2) % RUST.length]);
  }
  // ── crates: single and stacked ──
  const crates = inst(crateGeo(), M.wood, 60);
  for (let i = 0; i < 26; i++) {
    const s = flank(0.6);
    if (!s) continue;
    const [x, z] = s;
    const y = g(x, z), rot = rnd() * 6, stack = rnd() < 0.4 ? 2 : 1;
    for (let k = 0; k < stack; k++) put(crates, x + (rnd() - 0.5) * 0.15, y + 0.4 + k * 0.8, z + (rnd() - 0.5) * 0.15, e.set(0, rot + (rnd() - 0.5) * 0.3, 0), sv.setScalar(1), WOOD[(i + k) % WOOD.length]);
    colliders.add({ id: `crate${i}`, kind: 'box', x, z, hx: 0.55, hz: 0.45, rot: -rot, bottom: y - 1, top: y + 0.8 * stack });
  }
  for (let i = 0; i < 18; i++) {
    const [x, z, hy] = onMound();
    put(crates, x, g(x, z) + hy, z, e.set((rnd() - 0.5) * 0.8, rnd() * 6, (rnd() - 0.5) * 0.8), sv.setScalar(0.8 + rnd() * 0.3), WOOD[i % WOOD.length]);
  }
  // ── gears: big ones leaning against heaps, small ones scattered ──
  const gears = inst(gearGeo(), M.rust, 22);
  for (let i = 0; i < 22; i++) {
    const big = i < 7;
    const free = big ? flank(1.2, 1, 3) : null;
    const [x, z, hy] = free ? [free[0], free[1], 0] : onMound();
    const s = big ? 1.1 + rnd() * 0.9 : 0.35 + rnd() * 0.4;
    put(gears, x, g(x, z) + (free ? s * 0.85 : hy), z, e.set(free ? 0.25 : rnd() * 3, rnd() * 6, free ? (rnd() - 0.5) * 0.3 : rnd() * 3), sv.setScalar(s), RUST[(i + 3) % RUST.length]);
    if (free) colliders.add({ id: `gear${i}`, kind: 'box', x, z, hx: 0.8 * s, hz: 0.25 * s, rot: -e.y, bottom: g(x, z) - 0.05, top: g(x, z) + 1.65 * s });
  }
  // ── metal sheets leaning and lying ──
  const sheets = inst(new THREE.BoxGeometry(1.6, 0.03, 1.0, 1, 1, 1), M.sheet, 44);
  for (let i = 0; i < 44; i++) {
    const free = i < 22 ? flank(0.4, 0.2, 1.5) : null;
    const [x, z, hy] = free ? [free[0], free[1], 0] : onMound();
    put(sheets, x, g(x, z) + (free ? 0.45 : hy), z, e.set(free ? 1.1 + rnd() * 0.3 : rnd() * 1.5, rnd() * 6, (rnd() - 0.5) * 0.4), sv.set(0.7 + rnd() * 0.8, 1, 0.7 + rnd() * 0.6), [0x6a6e74, 0x7a5a44, 0x5a6066, 0x8a6a4a][i % 4]);
  }
  // ── canisters / containers ──
  const cans = inst(canisterGeo(), M.rust, 44);
  for (let i = 0; i < 44; i++) {
    const free = i < 26 ? flank(0.3, 0.1, 1.6) : null;
    const [x, z, hy] = free ? [free[0], free[1], 0] : onMound();
    put(cans, x, g(x, z) + (free ? 0.3 : hy), z, free ? e.set(0, rnd() * 6, 0) : e.set(rnd() * 3, rnd() * 6, rnd() * 3), sv.setScalar(0.9 + rnd() * 0.4), [0xb8a050, 0x8a9a6a, 0x9a4a3a, 0x6a7a8a, 0xc8c0a8][i % 5]);
  }
  // ── broken furniture ──
  const chairs = inst(chairGeo(), M.wood, 6);
  const cabinets = inst(cabinetGeo(), M.wood, 5);
  for (let i = 0; i < 6; i++) { const [x, z, hy] = onMound(); put(chairs, x, g(x, z) + hy, z, e.set((rnd() - 0.5) * 1.2, rnd() * 6, (rnd() - 0.5) * 1.6), sv.setScalar(1), WOOD[i % WOOD.length]); }
  for (let i = 0; i < 5; i++) {
    const s = spot(1.2, 0.6, 0.95);
    if (!s) continue;
    const [x, z] = s;
    const tilt = (rnd() - 0.5) * 0.4, rot = rnd() * 6;
    put(cabinets, x, g(x, z), z, e.set(tilt, rot, 0), sv.setScalar(1), [0x6a5a48, 0x5a6a6a, 0x7a6a5a][i % 3]);
    colliders.add({ id: `cabinet${i}`, kind: 'box', x, z, hx: 0.5, hz: 0.3, rot: -rot, bottom: g(x, z) - 1, top: g(x, z) + 1.3 });
  }
  // ── rocks (smooth) ──
  const rocks = inst(rockGeo(9), M.rock, 50);
  for (let i = 0; i < 50; i++) {
    const s = i % 2 ? flank(0.4, 0.2, 2.5) : spot(0.8, 0.4, 0.97);
    if (!s) continue;
    const [x, z] = s;
    const r = 0.3 + rnd() * (i < 10 ? 1.2 : 0.5);
    put(rocks, x, g(x, z) + r * 0.1, z, e.set(0, rnd() * 6, 0), sv.set(r, r * (0.6 + rnd() * 0.4), r), [0x5e5650, 0x6a6058, 0x4e4844][i % 3]);
    if (r > 0.9) colliders.add({ id: `drock${i}`, kind: 'cyl', x, z, r: r * 0.85, bottom: g(x, z) - 1, top: g(x, z) + r * 0.8 });
  }
  // ── cloth thrown over junk ──
  for (let i = 0; i < 12; i++) {
    const [x, z, hy] = onMound();
    const m = new THREE.Mesh(clothGeo(i * 3.1, 1.8 + rnd()), M.cloth.clone());
    (m.material as THREE.MeshStandardMaterial).color.set(CLOTH[i % CLOTH.length]);
    m.position.set(x, g(x, z) + hy * 0.8, z);
    m.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.3);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  }

  // ── broken machines: big composite pieces near the walls (solid) ──
  const machine = (x: number, z: number, rot: number, size: number, idx: number) => {
    const grp = new THREE.Group();
    const bodyM = M.rust.clone();
    bodyM.color.set(RUST[idx % RUST.length]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.6), bodyM);
    body.position.y = 0.8;
    grp.add(body);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 20), M.steel);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(1.7, 0.7, 0);
    grp.add(motor);
    const gear = new THREE.Mesh(gearGeo(16), bodyM);
    gear.scale.setScalar(0.9);
    gear.position.set(-1.3, 1.5, 0.82);
    grp.add(gear);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 1.6, 0), new THREE.Vector3(0.7, 2.6, -0.3), new THREE.Vector3(-0.6, 2.9, -0.6), new THREE.Vector3(-1.4, 2.2, -0.5)]), 20, 0.12, 10), M.steel);
    grp.add(pipe);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.04), M.steel);
    panel.position.set(0, 1.0, 0.82);
    grp.add(panel);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff8a40, emissive: 0xff6a20, emissiveIntensity: idx % 2 ? 2 : 0 }));
    light.position.set(0.3, 1.1, 0.85);
    grp.add(light);
    grp.position.set(x, g(x, z) - 0.15, z);
    grp.rotation.set((rnd() - 0.5) * 0.12, rot, (rnd() - 0.5) * 0.18);
    grp.scale.setScalar(size);
    grp.traverse((o) => { o.castShadow = o.receiveShadow = true; });
    root.add(grp);
    colliders.add({ id: `machine${idx}`, kind: 'box', x, z, hx: 1.9 * size, hz: 0.9 * size, rot: -rot, bottom: g(x, z) - 1, top: g(x, z) + 1.7 * size });
  };
  for (let i = 0; i < 5; i++) { const s = spot(3.2, 0.7, 0.9); if (s) machine(s[0], s[1], rnd() * 6, 0.9 + rnd() * 0.5, i); }

  // ── pipes running along the walls and over the heaps ──
  for (let i = 0; i < 6; i++) {
    const a0 = rnd() * Math.PI * 2, a1 = a0 + 0.5 + rnd() * 0.6;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (a1 - a0) * (k / 4);
      const x = dump.c.x + Math.cos(a) * dump.rx * 0.97, z = dump.c.y + Math.sin(a) * dump.rz * 0.97;
      pts.push(new THREE.Vector3(x, 3 + i * 1.6 + Math.sin(k * 1.7 + i) * 0.6, z));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.16 + rnd() * 0.12, 10), i % 2 ? M.steel : M.rust);
    root.add(m);
  }
  // ── cables sagging between lamp posts and machines ──
  const cableM = M.rubber;
  const posts = [[12, 110], [28, 102], [36, 116], [14, 130], [6, 120], [24, 96.8]];
  for (let i = 0; i < posts.length - 1; i++) {
    const [ax, az] = posts[i], [bx, bz] = posts[i + 1];
    const a = new THREE.Vector3(ax, g(ax, az) + 4, az), b = new THREE.Vector3(bx, g(bx, bz) + 4, bz);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 1.2;
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.03, 5), cableM));
  }
  // ── odd ancient parts (nobody knows what they were) ──
  for (let i = 0; i < 3; i++) {
    const s = spot(1.5, 0.55, 0.92);
    if (!s) continue;
    const [x, z] = s;
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 12, 36), M.ancient);
    grp.add(ring);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 28), M.ancient);
    disc.rotation.x = Math.PI / 2;
    grp.add(disc);
    for (let k = 0; k < 5; k++) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), M.glyph);
      const a = (k / 5) * Math.PI * 2;
      gl.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.06);
      gl.rotation.z = a;
      grp.add(gl);
    }
    grp.position.set(x, g(x, z) + 0.75, z);
    grp.rotation.set(0.35, rnd() * 6, 0.2);
    root.add(grp);
    colliders.add({ id: `ancient${i}`, kind: 'cyl', x, z, r: 0.8, bottom: g(x, z) - 1, top: g(x, z) + 1.6 });
  }

  // ── ground detail (visual only: never changes the walkable height) ──
  const align = (x: number, z: number, out: THREE.Quaternion) => {
    const e2 = 0.4;
    const n = new THREE.Vector3(g(x - e2, z) - g(x + e2, z), 2 * e2, g(x, z - e2) - g(x, z + e2)).normalize();
    return out.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  };
  const plates = inst(new THREE.BoxGeometry(1, 0.025, 1), M.sheet, 40);
  plates.castShadow = false;
  const qy = new THREE.Quaternion();
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.9;
    const x = dump.c.x + Math.cos(a) * dump.rx * rr, z = dump.c.y + Math.sin(a) * dump.rz * rr;
    if (Math.hypot(x - SPOTS.pit.x, z - SPOTS.pit.y) < 7) continue;
    align(x, z, q).multiply(qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6));
    m4.compose(pv.set(x, g(x, z) + 0.03, z), q, sv.set(0.8 + rnd() * 1.4, 1, 0.6 + rnd() * 1.0));
    plates.setMatrixAt(plates.count, m4);
    plates.setColorAt(plates.count, col.set([0x5a5e64, 0x6a4a36, 0x4e5258, 0x7a5a3a][i % 4]));
    plates.count++;
  }
  // gravel and small debris
  const gravelGeo = new THREE.IcosahedronGeometry(1, 0);
  const gravel = inst(gravelGeo, M.rock, 700);
  gravel.castShadow = false;
  for (let i = 0; i < 700; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.95;
    const x = dump.c.x + Math.cos(a) * dump.rx * rr, z = dump.c.y + Math.sin(a) * dump.rz * rr;
    if (Math.hypot(x - SPOTS.pit.x, z - SPOTS.pit.y) < 5.5) continue;
    const s = 0.04 + rnd() * 0.12;
    put(gravel, x, g(x, z) + s * 0.3, z, e.set(rnd() * 3, rnd() * 3, rnd() * 3), sv.setScalar(s), [0x6a625a, 0x7a7068, 0x5a5048, 0x8a6a4a][i % 4]);
  }
  // puddles
  for (const [x, z, r] of [[10, 116, 1.4], [22, 104, 1.1], [-2, 118, 1.8], [30, 116, 1.2], [18, 124, 1.5]] as [number, number, number][]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), M.puddle);
    m.quaternion.copy(align(x, z, q)).multiply(qy.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    m.position.set(x, g(x, z) + 0.035, z);
    m.scale.set(1, 0.7 + rnd() * 0.4, 1);
    m.renderOrder = 1;
    root.add(m);
  }
  // cracks: dark lines on a decal
  const crackTex = texture((c) => {
    c.clearRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(10,8,6,0.85)';
    c.lineWidth = 2.2;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      let x = 64, y = 64;
      c.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += Math.cos(k * 2.1 + s * 0.6) * 9 + (Math.random() - 0.5) * 8; y += Math.sin(k * 2.1 + s * 0.6) * 9 + (Math.random() - 0.5) * 8; c.lineTo(x, y); }
      c.stroke();
    }
  });
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), crackMat, 30);
  cracks.count = 0;
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.85;
    const x = dump.c.x + Math.cos(a) * dump.rx * rr, z = dump.c.y + Math.sin(a) * dump.rz * rr;
    align(x, z, q).multiply(qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6));
    m4.compose(pv.set(x, g(x, z) + 0.04, z), q, sv.setScalar(1.5 + rnd() * 2));
    cracks.setMatrixAt(cracks.count++, m4);
  }
  root.add(cracks);

  // ── fake light: lamp heads glow, warm pools on the ground, faint light cones (no extra real lights) ──
  const haloTex = radial('rgba(255,200,130,1)', 'rgba(255,140,60,0)');
  const poolTex = radial('rgba(255,150,70,0.55)', 'rgba(255,120,40,0)');
  const blueTex = radial('rgba(110,180,255,0.9)', 'rgba(60,120,255,0)');
  const lamp = (x: number, z: number, h = 4.1) => {
    const y = g(x, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    halo.position.set(x, y + h, z);
    halo.scale.setScalar(2.6);
    root.add(halo);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    pool.position.set(x, y + 0.06, z);
    root.add(pool);
    updaters.push((t) => { halo.material.opacity = 0.8 + Math.sin(t * 7 + x) * 0.03 + (Math.sin(t * 23 + z) > 0.97 ? -0.3 : 0); });
  };
  for (const [x, z] of [[12, 110], [28, 102], [36, 116], [14, 130]]) lamp(x, z);
  // extra work lights on the walls (decoration + a light spot for the pool)
  const fixtureM = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.4 });
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb050, emissiveIntensity: 3 });
  for (const [x, z] of [[6, 120], [24, 96.8], [-4, 110], [44, 120], [2, 132], [34, 136]] as [number, number][]) {
    const y = g(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8), fixtureM);
    pole.position.set(x, y + 2.3, z);
    root.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 16, 1, true), fixtureM);
    shade.position.set(x, y + 4.7, z);
    root.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), bulbM);
    bulb.position.set(x, y + 4.55, z);
    root.add(bulb);
    lamp(x, z, 4.5);
    lights.push({ pos: new THREE.Vector3(x, y + 4.3, z), color: 0xffa860, power: 2.4 });
  }
  // blue glow where the root comes out of the rock
  for (const [x, y, z, s] of [[-2, 4, 101, 7], [4, 1.5, 104, 5], [9, 0.3, 108.5, 4], [40, 18, 122, 9]] as [number, number, number, number][]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: blueTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    root.add(sp);
    updaters.push((t) => { sp.material.opacity = 0.45 + Math.sin(t * 0.6 + x) * 0.1; });
  }
  const bluePool = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radial('rgba(80,150,255,0.45)', 'rgba(40,100,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  bluePool.position.set(5, g(5, 105) + 0.07, 105);
  root.add(bluePool);

  // ── haze: a few huge soft sprites deep in the cavern separate near / middle / far ──
  const hazeTex = radial('rgba(120,110,140,0.35)', 'rgba(60,50,80,0)');
  for (const [x, y, z, s, c] of [[20, 8, 140, 40, 0xffffff], [-8, 6, 122, 30, 0x9fb8ff], [46, 10, 112, 36, 0xffc8a0], [26, 14, 120, 50, 0xffffff]] as [number, number, number, number, number][]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hazeTex, color: c, depthWrite: false, transparent: true, opacity: 0.35, fog: false }));
    sp.position.set(x, y, z);
    sp.scale.set(s, s * 0.45, 1);
    root.add(sp);
  }

  return { update(t: number) { for (const u of updaters) u(t); } };
}
