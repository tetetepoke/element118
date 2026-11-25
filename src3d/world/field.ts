// The 200 m prototype field: rolling meadow, a stream into a pond, rock fields, trees, ruins on a hill,
// a lookout crag over the ruins, and a plateau with cliffs. Two ways up the plateau: the gorge ramp
// (blocked by a hard rock → HARD BREAK) or the rock shelves along the south cliff (climb).
// A crystal spire landmark on top is visible from everywhere.
import * as THREE from 'three';
import { buildTerrainMesh, heightAt, HALF, PLACES, WATER_Y, plateauMask, rampCoord, normalAt, STREAM, streamLevel, streamDistance, stairTreadTop, STAIR_STEPS, vnoise } from './terrain';
import { ColliderWorld, Collider } from './colliders';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Breakable {
  id: string;
  collider: Collider;
  mesh: THREE.Object3D;
  /** obstacle tags matched against ability.breaks */
  tags: string[];
  broken: boolean;
}

export interface Field {
  root: THREE.Group;
  colliders: ColliderWorld;
  breakables: Breakable[];
  landmarkGlow: THREE.Object3D;
  update(dt: number, t: number): void;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildField(): Field {
  const root = new THREE.Group();
  const colliders = new ColliderWorld();
  const breakables: Breakable[] = [];
  const r = rng(118);

  root.add(buildTerrainMesh(window.innerWidth < 900 ? 160 : 200));

  // ── water (pond) ──
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(17, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3f8fd2, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.1 }),
  );
  water.position.set(PLACES.pond.x, WATER_Y, PLACES.pond.y);
  water.name = 'water';
  root.add(water);

  // ── stream (a water ribbon that follows the carved bed) ──
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < STREAM.length - 1; i++) {
    const a = STREAM[i], b = STREAM[i + 1];
    const n = Math.ceil(a.distanceTo(b) / 1.5);
    for (let j = 0; j < n; j++) pts.push(a.clone().lerp(b, j / n));
  }
  pts.push(STREAM[STREAM.length - 1].clone());
  const sPos: number[] = [], sIdx: number[] = [], sUv: number[] = [];
  let along = 0;
  pts.forEach((p, i) => {
    const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)];
    const dx = q1.x - q0.x, dz = q1.y - q0.y, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l, w = 2.3;
    const y = Math.max(WATER_Y + 0.02, streamLevel(p.x, p.y));
    if (i > 0) along += p.distanceTo(pts[i - 1]);
    sPos.push(p.x + nx * w, y, p.y + nz * w, p.x - nx * w, y, p.y - nz * w);
    sUv.push(0, along / 6, 1, along / 6);
    if (i > 0) { const k = i * 2; sIdx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const sG = new THREE.BufferGeometry();
  sG.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  sG.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
  sG.setIndex(sIdx);
  sG.computeVertexNormals();
  const streamMat = new THREE.MeshStandardMaterial({ color: 0x4a9ad8, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.1, emissive: 0x0a2a44, side: THREE.DoubleSide });
  const stream = new THREE.Mesh(sG, streamMat);
  stream.name = 'stream';
  root.add(stream);

  // ── trees (instanced) ──
  const _n = new THREE.Vector3();
  const okForTree = (x: number, z: number) => {
    if (Math.abs(x) > 95 || Math.abs(z) > 95) return false;
    if (normalAt(x, z, _n).y < (Math.max(Math.abs(x), Math.abs(z)) > 80 ? 0.55 : 0.8)) return false; // not on steep ground (the rim is wooded)
    if (plateauMask(x, z) > 0.02 && plateauMask(x, z) < 0.98) return false; // not on cliffs
    if (Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y) < 18) return false;
    if (Math.hypot(x - PLACES.ruins.x, z - PLACES.ruins.y) < 13) return false;
    if (Math.hypot(x - PLACES.spawn.x, z - PLACES.spawn.y) < 8) return false;
    if (Math.hypot(x - PLACES.silica.x, z - PLACES.silica.y) < 7) return false;
    const { t, d } = rampCoord(x, z);
    if (t > -0.2 && t < 1.1 && d < 8) return false;
    if (Math.abs(x - Math.sin(z * 0.05) * 6) < 4 && z > -20 && z < 74) return false; // keep the path clear
    if (streamDistance(x, z) < 4.5) return false;
    if (x > 26 && x < 58 && z > -22 && z < -6) return false; // the climbing shelves
    if (Math.hypot(x - PLACES.crag.x, z - PLACES.crag.y) < 13) return false;
    if (Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.y) < 6) return false;
    return heightAt(x, z) > WATER_Y + 0.6;
  };
  const trees: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 1400 && trees.length < 210; i++) {
    const x = (r() * 2 - 1) * 96, z = (r() * 2 - 1) * 96;
    if (!okForTree(x, z)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue;
    trees.push({ x, z, s: 0.8 + r() * 0.7 });
  }
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6).translate(0, 1.1, 0);
  const crownG = new THREE.IcosahedronGeometry(1.6, 0).translate(0, 3.2, 0);
  const crown2G = new THREE.ConeGeometry(1.5, 2.6, 7).translate(0, 4.4, 0);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }), trees.length);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9, flatShading: true }), trees.length);
  const crowns2 = new THREE.InstancedMesh(crown2G, new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, flatShading: true }), trees.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const col = new THREE.Color();
  trees.forEach((t, i) => {
    const y = heightAt(t.x, t.z) - 0.1;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    sv.set(t.s, t.s * (0.9 + r() * 0.3), t.s);
    pv.set(t.x, y, t.z);
    m4.compose(pv, q, sv);
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
    crowns2.setMatrixAt(i, m4);
    col.setHSL(0.28 + r() * 0.06, 0.45, 0.32 + r() * 0.08);
    crowns.setColorAt(i, col);
    crowns2.setColorAt(i, col.offsetHSL(0, 0, -0.04));
    colliders.add({ id: `tree${i}`, kind: 'cyl', x: t.x, z: t.z, r: 0.35 * t.s + 0.1, bottom: y, top: y + 6 * t.s });
  });
  for (const m of [trunks, crowns, crowns2]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }

  // ── rocks (instanced, standable / climbable) ──
  const rocks: { x: number; z: number; s: number; h: number }[] = [];
  const addRock = (x: number, z: number, s: number, h: number) => rocks.push({ x, z, s, h });
  // a small climbing playground near the spawn: low → mid → high
  addRock(8, 60, 0.9, 0.4); addRock(11, 58, 1.2, 1.0); addRock(14, 55, 1.4, 1.8); addRock(17.5, 53, 1.6, 2.6);
  for (let i = 0; i < 400 && rocks.length < 70; i++) {
    const x = (r() * 2 - 1) * 90, z = (r() * 2 - 1) * 90;
    if (!okForTree(x, z) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
    const s = 0.6 + r() * 1.6;
    addRock(x, z, s, s * (0.6 + r() * 0.6));
  }
  // rock fields: big boulders you walk around (routes branch between them)
  const boulderField = (cx: number, cz: number, n: number, spread: number) => {
    for (let i = 0; i < n * 6 && n > 0; i++) {
      const x = cx + (r() * 2 - 1) * spread, z = cz + (r() * 2 - 1) * spread;
      if (rocks.some((k) => Math.hypot(k.x - x, k.z - z) < k.s + 2.8)) continue;
      if (Math.abs(x - Math.sin(z * 0.05) * 6) < 3 && z > -20 && z < 74) continue;
      if (streamDistance(x, z) < 3.5) continue;
      const s = 2 + r() * 2.2;
      addRock(x, z, s, s * (1.1 + r() * 0.6));
      n--;
    }
  };
  boulderField(-22, -6, 9, 9); // between the path and the ruins
  boulderField(58, 12, 8, 10); // east meadow
  boulderField(-60, 60, 6, 9); // behind the pond hill
  // three jittered rock shapes so no two look the same
  const rockShape = (seed: number) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 0.78 + 0.42 * vnoise(v.x * 1.7 + seed, v.z * 1.7 + v.y * 1.3 + seed * 3);
      v.multiplyScalar(k);
      if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.35; // flat-ish bottom
      v.y *= v.y > 0.55 ? 0.85 : 1;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };
  const rockM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const shapes = [rockShape(1), rockShape(7), rockShape(13)];
  const rockSolid = new THREE.MeshStandardMaterial({ color: 0x8f877d, roughness: 0.95, flatShading: true });
  const byShape: number[][] = [[], [], []];
  rocks.forEach((_, i) => byShape[i % 3].push(i));
  shapes.forEach((g, si) => {
    const ids = byShape[si];
    const mesh = new THREE.InstancedMesh(g, rockM, Math.max(1, ids.length));
    ids.forEach((ri, i) => {
      const k = rocks[ri];
      const y = heightAt(k.x, k.z);
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * Math.PI * 2, (r() - 0.5) * 0.3));
      m4.compose(pv.set(k.x, y + k.h * 0.3, k.z), q, sv.set(k.s, k.h, k.s * (0.85 + r() * 0.3)));
      mesh.setMatrixAt(i, m4);
      col.setHSL(0.07 + r() * 0.04, 0.06 + r() * 0.05, 0.42 + r() * 0.16);
      mesh.setColorAt(i, col);
      colliders.add({ id: `rock${ri}`, kind: 'cyl', x: k.x, z: k.z, r: k.s * 0.82, bottom: y - 1, top: y + k.h * 1.2 });
    });
    mesh.count = ids.length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  });
  // pebbles (no collision)
  const pebbleCount = window.innerWidth < 900 ? 160 : 320;
  const pebbles = new THREE.InstancedMesh(shapes[1], rockM, pebbleCount);
  let pk = 0;
  for (let i = 0; i < pebbleCount * 4 && pk < pebbleCount; i++) {
    const x = (r() * 2 - 1) * 90, z = (r() * 2 - 1) * 90;
    const near = streamDistance(x, z) < 5 || r() < 0.35;
    if (!near || heightAt(x, z) < WATER_Y + 0.1) continue;
    const s = 0.12 + r() * 0.3;
    m4.compose(pv.set(x, heightAt(x, z) + s * 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), sv.set(s, s * 0.6, s));
    pebbles.setMatrixAt(pk, m4);
    pebbles.setColorAt(pk, col.setHSL(0.08, 0.05, 0.5 + r() * 0.2));
    pk++;
  }
  pebbles.count = pk;
  pebbles.receiveShadow = true;
  root.add(pebbles);

  // cliff outcrops: rock faces set into the plateau cliffs so they read as rock, not a ramp of grass
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.95, flatShading: true });
  const outcrops: THREE.Matrix4[] = [];
  for (let i = 0; i < 2400 && outcrops.length < 90; i++) {
    const x = 16 + r() * 80, z = -96 + r() * 80;
    const pm = plateauMask(x, z);
    if (pm < 0.25 || pm > 0.75) continue;
    const rc = rampCoord(x, z);
    if (rc.t > -0.1 && rc.t < 1.1 && rc.d < 8) continue;
    if (x > 27 && x < 57 && z > -23) continue;
    const g = normalAt(x, z, new THREE.Vector3());
    const yaw = Math.atan2(g.x, g.z);
    const s = 2.2 + r() * 2.5;
    const y = heightAt(x, z);
    const mm = new THREE.Matrix4().compose(
      new THREE.Vector3(x - g.x * 1.5, y - s * 0.2, z - g.z * 1.5),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, yaw, (r() - 0.5) * 0.3)),
      new THREE.Vector3(s, s * (1.3 + r() * 1.2), s * 0.7),
    );
    outcrops.push(mm);
  }
  const outcropMesh = new THREE.InstancedMesh(shapes[2], cliffMat, outcrops.length);
  outcrops.forEach((mm, i) => { outcropMesh.setMatrixAt(i, mm); outcropMesh.setColorAt(i, col.setHSL(0.07, 0.08, 0.4 + r() * 0.15)); });
  outcropMesh.name = 'outcrops';
  outcropMesh.castShadow = true;
  outcropMesh.receiveShadow = true;
  root.add(outcropMesh);

  // the climbing shelves on the south cliff: flat rock treads (terrain gives the collision)
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x9a8e80, roughness: 0.9, flatShading: true });
  const stepW = (PLACES.stepsB.x - PLACES.stepsA.x) / STAIR_STEPS;
  for (let k = 0; k < STAIR_STEPS; k++) {
    const top = stairTreadTop(k);
    const hgt = 2.6 + k * 0.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(stepW + 0.15, hgt, 8.2), shelfMat);
    m.position.set(PLACES.stepsA.x + stepW * (k + 0.5), top - hgt / 2 - 0.03, -16.3);
    m.rotation.set((r() - 0.5) * 0.02, (r() - 0.5) * 0.05, 0);
    m.castShadow = m.receiveShadow = true;
    m.name = `shelf${k}`;
    root.add(m);
  }

  // a boulder at the top end of the shelves so you don't run off the east edge
  {
    const bx = PLACES.stepsB.x + 0.9, bz = -13.8, by = heightAt(bx, bz);
    const top = stairTreadTop(STAIR_STEPS - 1) + 1.6;
    const bm = new THREE.Mesh(shapes[0], rockSolid);
    bm.scale.set(1.6, (top - by) / 1.1, 2.4);
    bm.position.set(bx, by + (top - by) * 0.5, bz);
    bm.castShadow = bm.receiveShadow = true;
    root.add(bm);
    colliders.add({ id: 'shelf_guard', kind: 'cyl', x: bx, z: bz, r: 1.5, bottom: by, top });
  }

  // stepping stones across the stream below the ruins
  [[-51.6, 2.8], [-49.8, 3.3], [-48.0, 3.9], [-46.3, 4.3]].forEach(([x, z], i) => {
    const y = heightAt(x, z);
    const st = new THREE.Mesh(shapes[i % 3], rockSolid);
    st.scale.set(0.8, 0.5, 0.8);
    st.position.set(x, y + 0.45, z);
    st.castShadow = st.receiveShadow = true;
    root.add(st);
    colliders.add({ id: `steppingstone${i}`, kind: 'cyl', x, z, r: 0.7, bottom: y - 0.5, top: y + 0.75 });
  });

  // the lookout crag over the ruins: a spiral of rock shelves to its top
  const cg = PLACES.crag;
  const cragTop = heightAt(cg.x, cg.y);
  const shelfR = rockShape(21);
  for (let i = 0; i < 8; i++) {
    const a = 0.9 + i * 0.34; // starts south-east, winds round toward the ruins side
    const rad = 10.4 - i * 0.45;
    const x = cg.x + Math.cos(a) * rad, z = cg.y + Math.sin(a) * rad;
    const g0 = heightAt(cg.x + Math.cos(0.9) * 11.5, cg.y + Math.sin(0.9) * 11.5);
    const top = g0 + (cragTop - g0) * ((i + 1) / 8.3);
    const y = Math.min(heightAt(x, z), top) - 1;
    const hgt = top - y;
    const rk = new THREE.Mesh(shelfR, rockSolid);
    rk.scale.set(1.5, hgt / 1.15, 1.5);
    rk.position.set(x, y + hgt * 0.5, z);
    rk.rotation.y = a;
    rk.castShadow = rk.receiveShadow = true;
    root.add(rk);
    colliders.add({ id: `crag_shelf${i}`, kind: 'cyl', x, z, r: 1.45, bottom: y, top, tags: ['climb'] });
  }
  // a cairn and a little banner at the lookout
  const cairn = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(shapes[i % 3], rockSolid);
    c.scale.setScalar(0.55 - i * 0.1);
    c.position.y = 0.3 + i * 0.42;
    cairn.add(c);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }));
  pole.position.set(0.5, 1.3, 0);
  cairn.add(pole);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), new THREE.MeshStandardMaterial({ color: 0x5fb8ff, side: THREE.DoubleSide, emissive: 0x123a5a }));
  banner.position.set(0.82, 2.4, 0);
  cairn.add(banner);
  cairn.position.set(cg.x + 1.5, cragTop, cg.y + 1.5);
  cairn.traverse((o) => { o.castShadow = true; });
  root.add(cairn);
  colliders.add({ id: 'cairn', kind: 'cyl', x: cg.x + 1.5, z: cg.y + 1.5, r: 0.6, bottom: cragTop, top: cragTop + 1.8 });

  // ── ruins on the hill ──
  const ruins = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: 0.9 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x9e9484, roughness: 0.95 });
  const cx = PLACES.ruins.x, cz = PLACES.ruins.y, gy = heightAt(cx, cz);
  const box = (id: string, x: number, z: number, w: number, d: number, h: number, y0: number, rot = 0, mat = stone) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z);
    m.rotation.y = -rot;
    m.castShadow = m.receiveShadow = true;
    ruins.add(m);
    colliders.add({ id, kind: 'box', x, z, hx: w / 2, hz: d / 2, rot, bottom: y0, top: y0 + h });
    return m;
  };
  // stepped platform (each step 0.4 m: walk straight up)
  box('ruin_step1', cx, cz, 12, 12, 0.4, gy);
  box('ruin_step2', cx, cz, 9, 9, 0.4, gy + 0.4);
  box('ruin_step3', cx, cz, 6, 6, 0.4, gy + 0.8, 0, stoneDark);
  // pillars (some broken)
  [[-5, -5, 5], [5, -5, 2.4], [-5, 5, 3.6], [5, 5, 5], [0, -5.5, 1.2], [-5.5, 0, 4.2]].forEach(([dx, dz, h], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, h, 10), stone);
    p.position.set(cx + dx, gy + 0.4 + h / 2, cz + dz);
    p.castShadow = p.receiveShadow = true;
    ruins.add(p);
    colliders.add({ id: `pillar${i}`, kind: 'cyl', x: cx + dx, z: cz + dz, r: 0.65, bottom: gy, top: gy + 0.4 + h });
  });
  // arch on the north side
  box('arch_l', cx - 2.2, cz - 8.5, 1, 1, 4, gy);
  box('arch_r', cx + 2.2, cz - 8.5, 1, 1, 4, gy);
  box('arch_top', cx, cz - 8.5, 5.4, 1.2, 0.8, gy + 4);
  // low broken walls (1.2 m: climb up)
  box('wall1', cx - 9, cz + 2, 1, 7, 1.3, gy - 0.3, 0, stoneDark);
  box('wall2', cx + 8, cz + 7, 6, 1, 1.0, gy - 0.3, 0.3, stoneDark);
  // a fallen pillar on the east slope (walk round it or hop over)
  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 10), stone);
  const fx = cx + 12, fz = cz + 4, fy = heightAt(fx, fz);
  fallen.rotation.set(0, 0, Math.PI / 2);
  fallen.rotation.y = 0.5;
  fallen.position.set(fx, fy + 0.45, fz);
  fallen.castShadow = fallen.receiveShadow = true;
  ruins.add(fallen);
  colliders.add({ id: 'fallen_pillar', kind: 'box', x: fx, z: fz, hx: 3, hz: 0.6, rot: 0.5, bottom: fy, top: fy + 1.0 });
  // a glowing glyph in the middle (C ... and a few other symbols)
  const glyph = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
  glyph.position.set(cx, gy + 1.22, cz);
  ruins.add(glyph);
  root.add(ruins);

  // ── the hard rock that blocks the gorge ──
  const hr = PLACES.hardRock;
  const hy = heightAt(hr.x, hr.y);
  const hardGroup = new THREE.Group();
  const hardMat = new THREE.MeshStandardMaterial({ color: 0x5f5866, roughness: 0.6, metalness: 0.15, flatShading: true });
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 1), hardMat);
  core.scale.set(1.25, 1, 1.1);
  core.position.y = 2.4;
  hardGroup.add(core);
  // crystal veins
  const vein = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2a5a8a, roughness: 0.2 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + r() * 0.5, 0), vein);
    const a = r() * Math.PI * 2;
    c.position.set(Math.cos(a) * 3.3, 1 + r() * 3, Math.sin(a) * 3);
    c.scale.y = 2;
    c.rotation.set(r(), r(), r());
    hardGroup.add(c);
  }
  hardGroup.position.set(hr.x, hy - 0.4, hr.y);
  hardGroup.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  root.add(hardGroup);
  const hardCol = colliders.add({ id: 'hard_rock_gorge', kind: 'cyl', x: hr.x, z: hr.y, r: 4.9, bottom: hy - 1, top: hy + 6.5, tags: ['hard_rock'] });
  breakables.push({ id: 'hard_rock_gorge', collider: hardCol, mesh: hardGroup, tags: ['hard_rock'], broken: false });

  // ── the landmark: a crystal spire on the plateau, seen from everywhere ──
  const lm = PLACES.landmark;
  const ly = heightAt(lm.x, lm.y);
  const spire = new THREE.Group();
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x3a7ac8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true });
  const mainC = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMat);
  mainC.scale.set(4, 22, 4);
  mainC.position.y = 20;
  spire.add(mainC);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMat);
    const a = (i / 6) * Math.PI * 2;
    s.scale.set(1.6, 7 + r() * 5, 1.6);
    s.position.set(Math.cos(a) * 5, 6, Math.sin(a) * 5);
    s.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    spire.add(s);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.18, depthWrite: false }));
  glow.position.y = 38;
  spire.add(glow);
  spire.position.set(lm.x, ly, lm.y);
  root.add(spire);
  colliders.add({ id: 'spire', kind: 'cyl', x: lm.x, z: lm.y, r: 6.5, bottom: ly, top: ly + 42 });
  // a ring of standing stones around it: a place to reach
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = lm.x + Math.cos(a) * 12, z = lm.y + Math.sin(a) * 12;
    const y = heightAt(x, z);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 0.6), stone);
    st.position.set(x, y + 1.3, z);
    st.rotation.y = -a;
    st.castShadow = true;
    root.add(st);
    colliders.add({ id: `stone${i}`, kind: 'box', x, z, hx: 0.5, hz: 0.3, rot: a, bottom: y, top: y + 2.6 });
  }

  // ── distant ridges outside the field: two rings, the far one paler (aerial perspective) ──
  const ridgeRing = (r0: number, r1: number, hMax: number, seed: number, near: THREE.Color, far: THREE.Color) => {
    const N = 220;
    const rows = [0, 0.45, 0.62, 0.8, 1];
    const lift = [0, 0.75, 1, 0.7, 0.05];
    const pos: number[] = [], colr: number[] = [], idx: number[] = [];
    const c = new THREE.Color(), snow = new THREE.Color(0xeef3f8);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const u = (i / N) * 26;
      let ridge = 0, amp = 1, f = 1;
      for (let o = 0; o < 4; o++) { ridge += amp * (1 - Math.abs(2 * vnoise(u * f + seed, seed * 2 + o) - 1)); amp *= 0.5; f *= 2.1; }
      ridge /= 1.875;
      const hPeak = hMax * (0.25 + 0.75 * ridge * ridge);
      rows.forEach((t, j) => {
        const rr = r0 + (r1 - r0) * t + (vnoise(u * 1.3, j + seed) - 0.5) * 14;
        const y = 6 + hPeak * lift[j] * (0.85 + 0.3 * vnoise(u * 3, j * 7 + seed));
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
        c.copy(near).lerp(far, t * 0.6);
        if (y > hMax * 0.72) c.lerp(snow, Math.min(1, (y - hMax * 0.72) / (hMax * 0.15)));
        colr.push(c.r, c.g, c.b);
      });
    }
    const R = rows.length;
    for (let i = 0; i < N; i++) for (let j = 0; j < R - 1; j++) {
      const a = i * R + j, b = (i + 1) * R + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    m.name = 'ridge';
    return m;
  };
  root.add(ridgeRing(170, 250, 55, 3, new THREE.Color(0x4f7a4a), new THREE.Color(0x6a8a8a)));
  root.add(ridgeRing(300, 420, 130, 11, new THREE.Color(0x6d8098), new THREE.Color(0x8fa2b8)));
  // ground beyond the field
  const outer = new THREE.Mesh(new THREE.RingGeometry(HALF, 600, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a8a40, roughness: 1 }));
  outer.position.y = 7;
  root.add(outer);

  // ── grass clumps and flowers (instanced, cheap) ──
  const blade = (ang: number, lean: number) => {
    const g = new THREE.ConeGeometry(0.045, 0.42, 3).translate(0, 0.21, 0);
    g.rotateZ(lean);
    g.rotateY(ang);
    return g;
  };
  const clumpParts = [blade(0, 0.25), blade(2.1, 0.3), blade(4.2, 0.2), blade(1, -0.05)];
  const clumpG = mergeGeometries(clumpParts);
  const tuftCount = window.innerWidth < 900 ? 2200 : 4800;
  const tufts = new THREE.InstancedMesh(clumpG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), tuftCount);
  const flowerCount = window.innerWidth < 900 ? 260 : 600;
  const flowerG = new THREE.IcosahedronGeometry(0.075, 0).translate(0, 0.32, 0);
  const flowers = new THREE.InstancedMesh(flowerG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), flowerCount);
  const flowerHues = [[0.14, 0.9, 0.6], [0, 0, 0.95], [0.75, 0.55, 0.7], [0.97, 0.6, 0.72]];
  const n = new THREE.Vector3();
  let k = 0, fk = 0;
  for (let i = 0; i < tuftCount * 3 && k < tuftCount; i++) {
    // clustered placement: denser in patches, sparse on paths
    const x = (r() * 2 - 1) * 92, z = (r() * 2 - 1) * 92;
    if (vnoise(x * 0.08, z * 0.08) < 0.35 && r() < 0.7) continue;
    if (Math.abs(x - Math.sin(z * 0.05) * 6) < 1.4 && z > -22 && z < 74) continue;
    const y = heightAt(x, z);
    normalAt(x, z, n);
    if (n.y < 0.86 || y < WATER_Y + 0.4 || streamDistance(x, z) < 2.2) continue;
    const s = 0.7 + r() * 0.9;
    m4.compose(pv.set(x, y - 0.02, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), sv.set(s, s * (0.7 + r() * 0.7), s));
    tufts.setMatrixAt(k, m4);
    col.setHSL(0.24 + r() * 0.06, 0.5, 0.34 + r() * 0.12);
    tufts.setColorAt(k, col);
    k++;
    if (fk < flowerCount && r() < 0.16) {
      m4.compose(pv.set(x + (r() - 0.5) * 0.5, y, z + (r() - 0.5) * 0.5), q, sv.set(1, 0.6 + r() * 0.8, 1));
      flowers.setMatrixAt(fk, m4);
      const fh = flowerHues[Math.floor(vnoise(x * 0.05, z * 0.05) * 3.99)];
      flowers.setColorAt(fk, col.setHSL(fh[0], fh[1], fh[2]));
      fk++;
    }
  }
  tufts.count = k;
  flowers.count = fk;
  tufts.receiveShadow = true;
  tufts.name = 'grass';
  flowers.name = 'flowers';
  root.add(tufts, flowers);

  return {
    root,
    colliders,
    breakables,
    landmarkGlow: glow,
    update(_dt: number, t: number) {
      glow.scale.setScalar(1 + Math.sin(t * 1.6) * 0.12);
      (water.material as THREE.MeshStandardMaterial).opacity = 0.74 + Math.sin(t * 0.8) * 0.04;
      streamMat.emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.25;
      banner.rotation.y = Math.sin(t * 2.4) * 0.35;
      glyph.rotation.y = t * 0.3;
    },
  };
}
