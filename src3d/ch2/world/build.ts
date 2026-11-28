// Builds the chapter-2 world: mine meshes, roots, the stuck gate, the lift, the miners' village,
// copper and tin places, the deep vein, the old power station, people and creatures.
// Placement only; what happens is decided in ../main.ts.
import * as THREE from 'three';
import { caveCanopy, caveWallLife } from '../../world/caveLife';
import { addCaveHouseholds } from '../../world/caveHousehold';
import { ColliderWorld } from '../../world/colliders';
import { buildMineMeshes, heightAt, ceilAt, ZONES, SPOTS, STREAM, CORRIDORS, vnoise } from './mine';
import { Npc, type NpcLook } from '../../ch1/world/actors';
import { Bug, mothSwarm } from './actors';

export type ThingKind = 'node' | 'obstacle' | 'npc' | 'device' | 'scan' | 'gap';
export interface Thing {
  id: string;
  kind: ThingKind;
  mat: string;
  pos: THREE.Vector3;
  r: number;
  obj?: THREE.Object3D;
  give?: string[];
  left?: number;
  colliders?: string[];
  broken?: boolean;
  onBreak?: string;
  label?: string;
}
export interface LightSpot { pos: THREE.Vector3; color: number; power: number }

const std = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const g = (x: number, z: number) => heightAt(x, z);

export function buildWorld() {
  const root = new THREE.Group();
  const colliders = new ColliderWorld();
  const things: Thing[] = [];
  const lights: LightSpot[] = [];
  const npcs: Npc[] = [];
  const bugs: Bug[] = [];
  const updaters: ((t: number, dt: number) => void)[] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const { floor, ceiling } = buildMineMeshes();
  root.add(floor, ceiling);

  const box = (id: string, x: number, z: number, w: number, h: number, d: number, mat: THREE.Material, o: { rot?: number; y?: number; collide?: boolean; tags?: string[] } = {}) => {
    const y = o.y ?? g(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = -(o.rot ?? 0);
    root.add(m);
    if (o.collide !== false) colliders.add({ id, kind: 'box', x, z, hx: w / 2, hz: d / 2, rot: o.rot ?? 0, bottom: y - 2, top: y + h, tags: o.tags, model: m });
    return m;
  };
  const cyl = (id: string, x: number, z: number, r: number, h: number, mat: THREE.Material, o: { y?: number; collide?: boolean; seg?: number; top?: number } = {}) => {
    const y = o.y ?? g(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 10), mat);
    m.position.set(x, y + h / 2, z);
    root.add(m);
    if (o.collide !== false) colliders.add({ id, kind: 'cyl', x, z, r, bottom: y - 2, top: y + h, model: m });
    return m;
  };
  const lamp = (x: number, z: number, h = 3.2, color = 0xffb060) => {
    cyl(`lamp_${x}_${z}`, x, z, 0.07, h, std(0x4a4a4a, { metalness: 0.5 }), { collide: false, seg: 6 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), std(0xffe0a0, { emissive: color, emissiveIntensity: 2.4 }));
    b.position.set(x, g(x, z) + h + 0.1, z);
    root.add(b);
    lights.push({ pos: b.position.clone(), color, power: 2 });
    return b.position.clone();
  };

  // ── roots (the blue roots — still just "青い根" to everyone here) ──
  const rootMat = std(0x26324a, { emissive: 0x0e2e70, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.15 });
  const veinMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const addRoot = (pts: [number, number, number][], r: number, id: string, hairs = 0) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 12, false);
    const p = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = (vnoise(v.x * 0.6, v.y * 0.6 + v.z * 0.6) - 0.5) * r * 0.35; p.setXYZ(i, v.x + k, v.y + k * 0.5, v.z - k); }
    geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, rootMat));
    for (let k = 0; k < 3; k++) {
      const pts2: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40, a = (k / 3) * Math.PI * 2 + u * 7; const c = curve.getPoint(u); pts2.push(c.add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))); }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 60, Math.max(0.05, r * 0.07), 4, false), veinMat));
    }
    // fine hair-like rootlets: the first sign that this is a plant's root (chapter 2's reveal)
    for (let i = 0; i < hairs; i++) {
      const u = rnd(), c = curve.getPoint(u), dir = new THREE.Vector3(rnd() - 0.5, -rnd() * 0.6, rnd() - 0.5).normalize();
      const hp = [c.clone(), c.clone().addScaledVector(dir, r + 0.8 + rnd()), c.clone().addScaledVector(dir, r + 1.6 + rnd() * 2).add(new THREE.Vector3(0, -0.6, 0))];
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 8, 0.05 + rnd() * 0.05, 4, false), rootMat));
    }
    for (let i = 0; i <= 2; i++) lights.push({ pos: curve.getPoint(0.15 + i * 0.35), color: 0x4a9aff, power: 1.3 + r * 0.25 });
    const len = curve.getLength(), n = Math.max(2, Math.ceil(len / (r * 1.2)));
    for (let i = 0; i <= n; i++) { const q = curve.getPoint(i / n); colliders.add({ id: `root_${id}_${i}`, kind: 'cyl', x: q.x, z: q.z, r: r * 0.95, bottom: q.y - r, top: q.y + r, tags: ['root'] }); }
    things.push({ id: `root_${id}`, kind: 'scan', mat: 'blue_root', pos: curve.getPoint(0.5), r: r + 6, label: '青い根' });
    return curve;
  };
  const shaftRoot = addRoot([[33, -4, 95], [31, 40, 93], [29, 120, 90], [28, 220, 88]], 4.2, 'shaft', 26);
  addRoot([[-30, 36, -2], [-6, 30, 6], [20, 34, 14]], 1.6, 'village', 8);
  addRoot([[40, 40, -78], [52, 22, -76], [64, 30, -72]], 2.2, 'station', 10);
  addRoot([[-12, 16, -48], [0, 14, -47], [12, 16, -48]], 1.0, 'record', 30);
  addRoot([[-80, 34, -70], [-66, 30, -64], [-50, 34, -58]], 1.3, 'deep', 6);
  updaters.push((t) => {
    rootMat.emissiveIntensity = 0.3 + Math.sin(t * 0.6) * 0.07;
    veinMat.opacity = 0.55 + Math.sin(t * 1.8) * 0.2;
  });

  // ── the upper gate, seen from behind: stuck a hand's width open ──
  const gateMat = std(0x3a3d44, { metalness: 0.6, roughness: 0.4 });
  const gz = SPOTS.gateDoor.y;
  const gateL = box('gate_l', -3.6, gz, 7, 14, 1.2, gateMat, { y: g(0, gz - 3) });
  const gateR = box('gate_r', 3.6, gz, 7, 14, 1.2, gateMat, { y: g(0, gz - 3) });
  gateL.position.x -= 0.25; gateR.position.x += 0.25;
  box('gate_frame', 0, gz + 1.2, 18, 18, 1, std(0x2a2c32), { y: g(0, gz - 3) - 1 });
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), std(0x9fd8ff, { emissive: 0x2a6aff, emissiveIntensity: 0.4 }));
  emblem.position.set(0, g(0, gz - 3) + 9, gz - 0.62);
  emblem.rotation.y = Math.PI;
  root.add(emblem);
  things.push({ id: 'gate', kind: 'scan', mat: 'ancient_alloy', pos: new THREE.Vector3(0, g(0, gz - 3) + 1, gz - 1), r: 5, label: '上層門' });
  lamp(-7, 94); lamp(7, 94, 3.2, 0x8ab8ff);

  // ── the lift in the big shaft (no power) ──
  const L = SPOTS.lift, ly = g(L.x, L.y);
  const liftG = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 24), std(0x5a5048, { metalness: 0.4 }));
  deck.position.y = 0.2;
  liftG.add(deck);
  const railM = std(0x8a6a3a, { metalness: 0.7, roughness: 0.35 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), railM);
    post.position.set(Math.cos(a) * 2.8, 1.4, Math.sin(a) * 2.8);
    liftG.add(post);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.06, 6, 32), railM);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.6;
  liftG.add(ring);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), std(0x3a3a40, { metalness: 0.5 }));
  console_.position.set(-2, 0.95, 0);
  liftG.add(console_);
  const liftLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0x402010, { emissive: 0x000000 }));
  liftLamp.position.set(-2, 1.6, 0);
  liftG.add(liftLamp);
  liftG.position.set(L.x, ly, L.y);
  root.add(liftG);
  colliders.add({ id: 'lift_deck', kind: 'cyl', x: L.x, z: L.y, r: 3, bottom: ly - 2, top: ly + 0.4, dynamic: true });
  // the cable from the station: hangs dead along the shaft wall until power returns
  const cableM = new THREE.MeshStandardMaterial({ color: 0x5a3a20, metalness: 0.6, roughness: 0.4, emissive: 0x000000 });
  const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(L.x - 3, ly + 0.4, L.y), new THREE.Vector3(14, 3, 84), new THREE.Vector3(8, 6, 70), new THREE.Vector3(4, 6, 40)]);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 60, 0.07, 5, false), cableM));
  things.push({ id: 'lift', kind: 'device', mat: 'machine', pos: new THREE.Vector3(L.x - 2, ly, L.y), r: 3.2, label: '昇降機' });
  lamp(16, 84, 3, 0x8ab8ff);

  // ── 上層坑道: rails, timber frames, lanterns with moths ──
  const timberM = std(0x6a4a2e), railSteel = std(0x6a6058, { metalness: 0.6, roughness: 0.4 });
  for (let z = 44; z <= 80; z += 1.2) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.25), timberM);
    sleeper.position.set(0, g(0, z) + 0.05, z);
    root.add(sleeper);
  }
  for (const sx of [-0.55, 0.55]) {
    const pts: THREE.Vector3[] = [];
    for (let z = 44; z <= 80; z += 2) pts.push(new THREE.Vector3(sx, g(0, z) + 0.14, z));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.04, 4, false), railSteel));
  }
  for (let z = 48; z <= 76; z += 7) {
    for (const sx of [-3.2, 3.2]) box(`frame_${z}_${sx}`, sx, z, 0.3, 3.6, 0.3, timberM);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.3, 0.3), timberM);
    beam.position.set(0, g(0, z) + 3.75, z);
    root.add(beam);
  }
  const cart = box('cart', 2.3, 50, 1.3, 0.9, 1.8, std(0x6a5040, { metalness: 0.4 }));
  cart.rotation.z = 0.05;
  for (const z of [56, 70]) {
    const at = lamp(-2.6, z, 2.6);
    const sw = mothSwarm(at, 7);
    root.add(sw.root);
    updaters.push((t) => sw.update(t));
    things.push({ id: `moth_${z}`, kind: 'scan', mat: 'light_moth', pos: at.clone().setY(g(-2.6, z)), r: 2.5, label: 'ヒカリクイ' });
  }
  // old pit props: wood for the charcoal kiln
  const timberPile = (id: string, x: number, z: number) => {
    const grp = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.2, 6), timberM);
      m.position.set((rnd() - 0.5) * 0.6, 0.1 + i * 0.07, (rnd() - 0.5) * 0.6);
      m.rotation.set(Math.PI / 2, rnd() * 3, 0);
      grp.add(m);
    }
    grp.position.set(x, g(x, z), z);
    root.add(grp);
    things.push({ id, kind: 'node', mat: 'wood', pos: grp.position, r: 1.6, give: ['stick'], left: 99, label: '古い坑木' });
  };
  timberPile('timber_adit', SPOTS.timber.x, SPOTS.timber.y);
  timberPile('timber_village', SPOTS.timber2.x, SPOTS.timber2.y);

  // ── カンテラ村 ──
  const wall = std(0x7a6a58), roof = std(0x5a3a2a), door = std(0x3a2a1e);
  const house = (id: string, x: number, z: number, w: number, d: number, rot = 0) => {
    box(id, x, z, w, 3, d, wall, { rot });
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, 1.8, 4), roof);
    r.position.set(x, g(x, z) + 3.9, z);
    r.rotation.y = Math.PI / 4 - rot;
    root.add(r);
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), door);
    const s = Math.sin(rot), c = Math.cos(rot);
    dm.position.set(x - s * (d / 2 + 0.01) * -1, g(x, z) + 0.85, z + c * (d / 2 + 0.01));
    dm.rotation.y = -rot;
    root.add(dm);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), std(0xffd090, { emissive: 0xffa040, emissiveIntensity: 1.6 }));
    win.position.set(x + c * w * 0.25, g(x, z) + 1.9, z + c * (d / 2 + 0.02));
    win.rotation.y = -rot;
    root.add(win);
  };
  house('h1', -12, 0, 5, 4); house('h2', 14, 18, 5, 4); house('h3', 20, 2, 4, 5, 0.3); house('h4', -8, 26, 4, 4, -0.2); house('h5', 24, -12, 5, 4, 0.5); house('h6', -24, -6, 4, 4);
  for (const [x, z] of [[-4, 20], [8, 10], [-10, 8], [16, -4], [2, -8], [-20, 22], [26, 12]]) lamp(x, z, 3, 0xffa050);
  // the old furnace (smelter) and the charcoal kiln
  const F = SPOTS.furnace, K = SPOTS.kiln;
  const furn = cyl('furnace', F.x, F.y, 1.4, 3.2, std(0x6a4a3a), { top: 0.9, seg: 12 });
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), std(0xff8030, { emissive: 0xff5010, emissiveIntensity: 1.2 }));
  mouth.position.set(F.x, g(F.x, F.y) + 0.7, F.y + 1.36);
  root.add(mouth);
  lights.push({ pos: new THREE.Vector3(F.x, g(F.x, F.y) + 1.4, F.y + 2), color: 0xff7030, power: 2.6 });
  things.push({ id: 'furnace', kind: 'device', mat: 'stone', pos: new THREE.Vector3(F.x, g(F.x, F.y), F.y), r: 2.6, label: '古い炉', obj: furn });
  const kiln = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7a5a44));
  kiln.position.set(K.x, g(K.x, K.y), K.y);
  root.add(kiln);
  colliders.add({ id: 'kiln', kind: 'cyl', x: K.x, z: K.y, r: 1.3, bottom: g(K.x, K.y) - 2, top: g(K.x, K.y) + 1.3, model: kiln });
  things.push({ id: 'kiln', kind: 'device', mat: 'stone', pos: kiln.position, r: 2.4, label: '炭焼き窯' });
  // a little copper display in the chief's yard (the last copper the village had)
  const relic = new THREE.Mesh(new THREE.TorusKnotGeometry(0.2, 0.06, 40, 6), std(0xd07a48, { metalness: 0.8, roughness: 0.3 }));
  relic.position.set(9, g(9, 2) + 1.2, 2);
  root.add(relic);
  box('relic_stand', 9, 2, 0.5, 0.9, 0.5, std(0x4a3a2e));
  things.push({ id: 'relic', kind: 'scan', mat: 'native_copper', pos: relic.position.clone().setY(g(9, 2)), r: 1.8, label: '銅の飾り' });
  updaters.push((t) => { relic.rotation.y = t * 0.5; });

  // people
  const person = (id: string, look: NpcLook, x: number, z: number, face = 0, wander = 0) => {
    const n = new Npc(id, look);
    n.root.position.set(x, g(x, z), z);
    n.facing = face;
    n.root.rotation.y = face;
    if (wander) n.setWander(n.root.position, wander);
    root.add(n.root);
    n.addCollider(colliders);
    npcs.push(n);
    things.push({ id, kind: 'npc', mat: 'creature', pos: n.root.position, r: 2.4 });
    return n;
  };
  person('chief', 'worker2', SPOTS.chief.x, SPOTS.chief.y, Math.PI);
  person('smelter', 'vendor', SPOTS.smelter.x, SPOTS.smelter.y, -2.2);
  person('keeper', 'elder', SPOTS.keeper.x, SPOTS.keeper.y, 2.8);
  person('miner_a', 'worker', -4, 30, 0.4, 3);
  person('miner_b', 'worker', 2, 64, Math.PI);
  person('kid', 'child', 6, 16, 0, 5);
  person('panner', 'gatherer', 50, 9, -2.4);
  person('weaver', 'resident2', -14, 18, 1.2);

  // ── 緑の坑: malachite ──
  const malM = std(0x2f9a6a, { metalness: 0.2, roughness: 0.45 });
  const vein = (id: string, x: number, z: number) => {
    const grp = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rnd() * 0.35, 0), malM);
      m.position.set((rnd() - 0.5) * 1.4, 0.2 + rnd() * 0.9, (rnd() - 0.5) * 1.4);
      m.scale.y = 0.6 + rnd();
      grp.add(m);
    }
    grp.position.set(x, g(x, z), z);
    root.add(grp);
    lights.push({ pos: grp.position.clone().add(new THREE.Vector3(0, 2, 0)), color: 0x4affb0, power: 0.8 });
    things.push({ id, kind: 'node', mat: 'malachite', pos: grp.position, r: 1.8, give: ['malachite'], left: 99, label: '孔雀石' });
  };
  vein('mal_a', SPOTS.malachite.x, SPOTS.malachite.y); vein('mal_b', -68, 8); vein('mal_c', -50, 10);
  things.push({ id: 'verdigris_wall', kind: 'scan', mat: 'verdigris', pos: new THREE.Vector3(-72, g(-72, -6), -6), r: 4, label: '緑の岩肌' });
  for (let i = 0; i < 2; i++) { const b = new Bug(new THREE.Vector3(-60, 0, 4), 6, i * 2.1); root.add(b.root); bugs.push(b); }
  lamp(-46, -2, 3, 0x8affc0);

  // ── 砂錫の沢: shallow water over heavy black sand ──
  const waterM = new THREE.MeshStandardMaterial({ color: 0x2a4a5a, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.2 });
  const wpts: number[] = [];
  const wg = new THREE.PlaneGeometry(STREAM.x1 - STREAM.x0, STREAM.half * 2 + 2.4, 40, 4).rotateX(-Math.PI / 2);
  const wp = wg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < wp.count; i++) { const x = wp.getX(i) + (STREAM.x0 + STREAM.x1) / 2; wp.setX(i, x); wp.setZ(i, wp.getZ(i) + STREAM.z + Math.sin(x * 0.15) * 1.2); wp.setY(i, STREAM.level); }
  void wpts;
  const water = new THREE.Mesh(wg, waterM);
  root.add(water);
  const gravel = (id: string, x: number) => {
    const z = STREAM.z + Math.sin(x * 0.15) * 1.2;
    const grp = new THREE.Group();
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.08 + rnd() * 0.06, 5, 4), std(0x2a2624, { metalness: 0.4 })); m.position.set((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2); grp.add(m); }
    grp.position.set(x, g(x, z) + 0.05, z);
    root.add(grp);
    things.push({ id, kind: 'node', mat: 'cassiterite', pos: grp.position, r: 1.8, give: ['cassiterite'], left: 99, label: '黒い重い砂' });
  };
  gravel('tin_a', 48); gravel('tin_b', 62); gravel('tin_c', 70);
  lamp(46, 12, 3); lamp(66, -4, 3);
  updaters.push((t) => { waterM.opacity = 0.7 + Math.sin(t * 1.3) * 0.05; });

  // ── 記録の間: a stone plate with a branching diagram ──
  const P = SPOTS.plate;
  const plate = box('plate', P.x, P.y, 3.4, 2.4, 0.4, std(0x6a6660));
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 180;
  const cx = cv.getContext('2d')!;
  cx.fillStyle = '#5a5650'; cx.fillRect(0, 0, 256, 180);
  cx.strokeStyle = '#a8d8ff'; cx.lineWidth = 3;
  const branch = (x: number, y: number, a: number, len: number, d: number) => {
    if (d > 5) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x2, y2); cx.stroke();
    branch(x2, y2, a - 0.45, len * 0.7, d + 1);
    branch(x2, y2, a + 0.4, len * 0.68, d + 1);
  };
  branch(128, 20, Math.PI / 2, 46, 0); // a root drawn from the top, branching downward
  cx.fillStyle = '#d8e8ff'; cx.font = '22px serif'; cx.textAlign = 'center'; cx.fillText('天 晶 脈', 128, 172);
  const tex = new THREE.CanvasTexture(cv);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.25), new THREE.MeshStandardMaterial({ map: tex, emissive: 0x2a4a7a, emissiveMap: tex, emissiveIntensity: 0.0 }));
  face.position.set(P.x, g(P.x, P.y) + 1.2, P.y + 0.21);
  root.add(face);
  void plate;
  things.push({ id: 'plate', kind: 'device', mat: 'tensho_plate', pos: new THREE.Vector3(P.x, g(P.x, P.y), P.y + 0.6), r: 2.6, label: '古い石板' });
  lamp(-5, -38, 2.6, 0x8ab8ff);

  // ── 緑青の洞: rubble on the way, the green cocoon, a swarm of bugs ──
  const R = CORRIDORS.find((c) => c.id === 'green_deep')!;
  const rx = R.a.x + (R.b.x - R.a.x) * 0.45, rz = R.a.y + (R.b.y - R.a.y) * 0.45;
  const rub = new THREE.Group();
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.6, 0), i % 3 ? std(0x4a4a44) : malM); m.position.set((rnd() - 0.5) * 6, rnd() * 2.4, (rnd() - 0.5) * 1.6); rub.add(m); }
  rub.position.set(rx, g(rx, rz), rz);
  root.add(rub);
  colliders.add({ id: 'rubble', kind: 'box', x: rx, z: rz, hx: 4.2, hz: 1.2, rot: 0, bottom: g(rx, rz) - 2, top: g(rx, rz) + 3.4, breakable: true });
  things.push({ id: 'rubble', kind: 'obstacle', mat: 'green_rubble', pos: rub.position, r: 3.2, obj: rub, colliders: ['rubble'], onBreak: 'rubble', label: '緑の岩くず' });
  const G = SPOTS.geode;
  const geo = new THREE.Group();
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rnd() * 0.5, 0), malM); const a = (i / 18) * Math.PI * 2; m.position.set(Math.cos(a) * 1.2, 0.6 + (i % 3) * 0.7, Math.sin(a) * 1.2); geo.add(m); }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 1.2;
  geo.add(glow);
  geo.position.set(G.x, g(G.x, G.y), G.y);
  root.add(geo);
  colliders.add({ id: 'geode', kind: 'cyl', x: G.x, z: G.y, r: 1.8, bottom: g(G.x, G.y) - 2, top: g(G.x, G.y) + 2.6 });
  lights.push({ pos: new THREE.Vector3(G.x, g(G.x, G.y) + 2, G.y), color: 0xff9050, power: 2 });
  things.push({ id: 'geode', kind: 'device', mat: 'geode', pos: geo.position, r: 2.9, obj: geo, label: '緑のまゆ' });
  updaters.push((t) => { glow.scale.setScalar(1 + Math.sin(t * 2) * 0.08); });
  for (let i = 0; i < 9; i++) { const b = new Bug(new THREE.Vector3(G.x, 0, G.y), 4.2, i * 1.3 + 0.5); root.add(b.root); bugs.push(b); }
  things.push({ id: 'bugs', kind: 'scan', mat: 'rokusho_bug', pos: new THREE.Vector3(G.x + 3, g(G.x + 3, G.y), G.y), r: 4, label: 'ロクショウムシ' });
  const B = SPOTS.bait;
  const stand = box('bait_stand', B.x, B.y, 1, 0.8, 1, std(0x5a4a3a));
  void stand;
  things.push({ id: 'bait', kind: 'device', mat: 'stone', pos: new THREE.Vector3(B.x, g(B.x, B.y), B.y), r: 1.9, label: '平らな石の台' });
  lamp(-52, -48, 2.8, 0x8affc0);

  // ── 根の光の発電所: light panels around a root, two broken joints in the line ──
  const panelM = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: 0.5, roughness: 0.2, emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI * 0.9 + (i / 9) * Math.PI * 0.8, r = 9;
    const x = SPOTS.panels.x + Math.cos(a) * r, z = SPOTS.panels.y - 2 + Math.sin(a) * r * 0.6;
    const pn = box(`panel_${i}`, x, z, 2.2, 0.15, 1.4, panelM, { y: g(x, z) + 1.4 });
    pn.rotation.x = -0.5;
    cyl(`panel_leg_${i}`, x, z, 0.08, 1.4, std(0x4a4a4a), { collide: false, seg: 5 });
  }
  things.push({ id: 'panels', kind: 'scan', mat: 'si_panel', pos: new THREE.Vector3(SPOTS.panels.x, g(SPOTS.panels.x, SPOTS.panels.y - 8), SPOTS.panels.y - 8), r: 6, label: '古い光の板' });
  const lineM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, metalness: 0.6, roughness: 0.4, emissive: 0x000000 });
  const gapMarks: Record<string, THREE.Mesh> = {};
  for (const [id, s] of [['gapA', SPOTS.gapA], ['gapB', SPOTS.gapB]] as const) {
    const y = g(s.x, s.y);
    for (const dx of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 8), std(0x8a6a3a, { metalness: 0.7, roughness: 0.3 }));
      post.position.set(s.x + dx, y + 0.55, s.y);
      root.add(post);
    }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 18), new THREE.MeshStandardMaterial({ color: 0x3a3a40, emissive: 0x2a1004, emissiveIntensity: 1 }));
    pad.position.set(s.x, y + 0.04, s.y);
    root.add(pad);
    gapMarks[id] = pad;
    things.push({ id, kind: 'gap', mat: 'machine', pos: new THREE.Vector3(s.x, y, s.y), r: 2.2, label: id === 'gapA' ? '切れた線（西）' : '切れた線（東）' });
  }
  const linePts = [new THREE.Vector3(SPOTS.panels.x, 13, -70), new THREE.Vector3(SPOTS.gapB.x + 1.6, 13, -66), new THREE.Vector3(SPOTS.gapA.x - 1.6, 13, -66), new THREE.Vector3(48, 10, -44), new THREE.Vector3(55, 4, -14)];
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linePts), 60, 0.08, 5, false), lineM));
  for (const [x, z] of [[40, -54], [64, -54], [52, -50]]) lamp(x, z, 3.2, 0x8ab8ff);

  // corridor mouths: a lantern each
  for (const c of CORRIDORS) {
    const x = (c.a.x + c.b.x) / 2, z = (c.a.y + c.b.y) / 2;
    lights.push({ pos: new THREE.Vector3(x, g(x, z) + 3, z), color: 0xffa860, power: 1.4 });
  }

  caveCanopy(root, [
    [[-6, 91], [-2, 88], [3, 89], [8, 92]],
    [[-2, 62], [-1.4, 58], [1.2, 54], [2, 50]],
    [[-12, 17], [-3, 12], [7, 14], [17, 17]],
    [[-72, -62], [-66, -58], [-60, -60], [-53, -58]],
  ], g, ceilAt, lights);
  const updateWallLife = caveWallLife(root, ZONES.filter((zone) => ['adit', 'green', 'village', 'deep'].includes(zone.id)), g);
  addCaveHouseholds(root, colliders, g, [[-9, 4], [17.6, 22.7], [23, -6]]);

  return {
    root, colliders, things, lights, npcs, updateWallLife, bugs, shaftRoot,
    parts: { gateL, gateR, emblem, liftG, liftLamp, cableM, lineM, panelM, gapMarks, plateFace: face, geode: geo },
    update(t: number, dt: number) { for (const u of updaters) u(t, dt); },
  };
}
export type World = ReturnType<typeof buildWorld>;
