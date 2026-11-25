// The 200 m prototype field: meadow, hills, a pond, rocks, trees, ruins on a hill, a plateau with
// cliffs reached by one gorge ramp (blocked by a hard rock), and a crystal spire landmark on top.
import * as THREE from 'three';
import { buildTerrainMesh, heightAt, HALF, PLACES, WATER_Y, plateauMask, rampCoord, normalAt } from './terrain';
import { ColliderWorld, Collider } from './colliders';

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

  // ── trees (instanced) ──
  const okForTree = (x: number, z: number) => {
    if (Math.abs(x) > 90 || Math.abs(z) > 90) return false;
    if (plateauMask(x, z) > 0.02 && plateauMask(x, z) < 0.98) return false; // not on cliffs
    if (Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y) < 18) return false;
    if (Math.hypot(x - PLACES.ruins.x, z - PLACES.ruins.y) < 13) return false;
    if (Math.hypot(x - PLACES.spawn.x, z - PLACES.spawn.y) < 8) return false;
    if (Math.hypot(x - PLACES.silica.x, z - PLACES.silica.y) < 7) return false;
    const { t, d } = rampCoord(x, z);
    if (t > -0.2 && t < 1.1 && d < 8) return false;
    if (Math.abs(x - Math.sin(z * 0.05) * 6) < 4 && z > -20 && z < 74) return false; // keep the path clear
    return heightAt(x, z) > WATER_Y + 0.6;
  };
  const trees: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 900 && trees.length < 170; i++) {
    const x = (r() * 2 - 1) * 92, z = (r() * 2 - 1) * 92;
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
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  const rockM = new THREE.MeshStandardMaterial({ color: 0x8d857c, roughness: 0.95, flatShading: true });
  const rockMesh = new THREE.InstancedMesh(rockG, rockM, rocks.length);
  rocks.forEach((k, i) => {
    const y = heightAt(k.x, k.z);
    q.setFromEuler(new THREE.Euler(r() * 0.4, r() * Math.PI * 2, r() * 0.4));
    m4.compose(pv.set(k.x, y + k.h * 0.35, k.z), q, sv.set(k.s, k.h, k.s));
    rockMesh.setMatrixAt(i, m4);
    col.setHSL(0.08, 0.06, 0.45 + r() * 0.15);
    rockMesh.setColorAt(i, col);
    colliders.add({ id: `rock${i}`, kind: 'cyl', x: k.x, z: k.z, r: k.s * 0.82, bottom: y - 1, top: y + k.h * 1.2 });
  });
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  root.add(rockMesh);

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

  // ── distant mountains outside the field (silhouettes for depth) ──
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x6a7f96, roughness: 1, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.1;
    const dist = 230 + r() * 140, h = 50 + r() * 90, w = 50 + r() * 50;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6 + Math.floor(r() * 3)), mtnMat);
    m.position.set(Math.cos(a) * dist, h / 2 - 6, Math.sin(a) * dist);
    m.rotation.y = r() * 3;
    root.add(m);
    if (h > 100) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.28, h * 0.28, 6), snowMat);
      cap.position.set(m.position.x, h - 6 - h * 0.14, m.position.z);
      root.add(cap);
    }
  }
  // ground beyond the field
  const outer = new THREE.Mesh(new THREE.RingGeometry(HALF * 1.35, 600, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a8a40, roughness: 1 }));
  outer.position.y = 8;
  root.add(outer);

  // ── grass tufts and flowers (instanced, cheap) ──
  const tuftG = new THREE.ConeGeometry(0.05, 0.32, 3).translate(0, 0.16, 0);
  const tuftCount = window.innerWidth < 900 ? 1400 : 2600;
  const tufts = new THREE.InstancedMesh(tuftG, new THREE.MeshStandardMaterial({ color: 0x8fcc5a, roughness: 1 }), tuftCount);
  const n = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < tuftCount * 3 && k < tuftCount; i++) {
    const x = (r() * 2 - 1) * 92, z = (r() * 2 - 1) * 92;
    const y = heightAt(x, z);
    normalAt(x, z, n);
    if (n.y < 0.85 || y < WATER_Y + 0.4) continue;
    m4.compose(pv.set(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), sv.set(1, 0.6 + r() * 0.9, 1));
    tufts.setMatrixAt(k, m4);
    col.setHSL(r() < 0.06 ? r() : 0.27, r() < 0.06 ? 0.8 : 0.5, r() < 0.06 ? 0.7 : 0.38 + r() * 0.1);
    tufts.setColorAt(k, col);
    k++;
  }
  tufts.count = k;
  root.add(tufts);

  return {
    root,
    colliders,
    breakables,
    landmarkGlow: glow,
    update(_dt: number, t: number) {
      glow.scale.setScalar(1 + Math.sin(t * 1.6) * 0.12);
      (water.material as THREE.MeshStandardMaterial).opacity = 0.74 + Math.sin(t * 0.8) * 0.04;
      glyph.rotation.y = t * 0.3;
    },
  };
}
