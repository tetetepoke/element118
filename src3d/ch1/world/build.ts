// Builds the chapter-1 world: cave meshes, the blue roots, props, people, creatures and every
// interactable "thing". Logic (what happens) is in main.ts + game/*; this file only places things.
import * as THREE from 'three';
import { ColliderWorld } from '../../world/colliders';
import { buildCaveMeshes, heightAt, SPOTS, RIVER, CHASM, CORRIDORS, ZONES, vnoise } from './cavern';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Npc, Crawler, Snail, Hakobi, FishSchool, glowMotes, type NpcLook } from './actors';

export type ThingKind = 'pick' | 'node' | 'obstacle' | 'npc' | 'device' | 'scan' | 'plate';
export interface Thing {
  id: string;
  kind: ThingKind;
  mat: string;
  pos: THREE.Vector3;
  r: number; // how close you must be to use it
  obj?: THREE.Object3D;
  give?: string[]; // items it gives, in turn
  left?: number; // how many times it can still be harvested
  colliders?: string[];
  npc?: Npc;
  broken?: boolean;
  onBreak?: string; // event handled by main.ts
  label?: string; // what to call it in prompts
}
export interface LightSpot { pos: THREE.Vector3; color: number; power: number }

const std = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const g = (x: number, z: number) => heightAt(x, z);

/** a line spiralling along the surface of a tube (light strands on the roots) */
class Strand extends THREE.Curve<THREE.Vector3> {
  private fr: { normals: THREE.Vector3[]; binormals: THREE.Vector3[] };
  constructor(private c: THREE.CatmullRomCurve3, private r: number, private off: number) {
    super();
    this.fr = c.computeFrenetFrames(60, false);
  }
  getPoint(u: number, out = new THREE.Vector3()) {
    const i = Math.min(60, Math.round(u * 60));
    const a = this.off + u * 7;
    return out.copy(this.c.getPoint(u)).addScaledVector(this.fr.normals[i], Math.cos(a) * this.r).addScaledVector(this.fr.binormals[i], Math.sin(a) * this.r);
  }
}

export function buildWorld() {
  const root = new THREE.Group();
  const colliders = new ColliderWorld();
  const things: Thing[] = [];
  const lights: LightSpot[] = [];
  const npcs: Npc[] = [];
  const crawlers: Crawler[] = [];
  const snails: Snail[] = [];
  const updaters: ((t: number, dt: number) => void)[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const { floor, ceiling } = buildCaveMeshes(window.innerWidth < 900 ? 200 : 256);
  root.add(floor, ceiling);

  // ── helpers ──
  const box = (id: string, x: number, z: number, w: number, h: number, d: number, mat: THREE.Material, o: { rot?: number; y?: number; collide?: boolean; tags?: string[]; parent?: THREE.Object3D } = {}) => {
    const y = o.y ?? g(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = -(o.rot ?? 0);
    m.castShadow = m.receiveShadow = true;
    (o.parent ?? root).add(m);
    if (o.collide !== false) colliders.add({ id, kind: 'box', x, z, hx: w / 2, hz: d / 2, rot: o.rot ?? 0, bottom: y - 2, top: y + h, tags: o.tags });
    return m;
  };
  const cyl = (id: string, x: number, z: number, r: number, h: number, mat: THREE.Material, o: { y?: number; collide?: boolean; seg?: number; top?: number } = {}) => {
    const y = o.y ?? g(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 10), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    if (o.collide !== false) colliders.add({ id, kind: 'cyl', x, z, r, bottom: y - 2, top: y + h });
    return m;
  };
  /** a wall across a corridor at parameter t (0..1) */
  const acrossCorridor = (cid: string, t: number) => {
    const c = CORRIDORS.find((k) => k.id === cid)!;
    const dx = c.b.x - c.a.x, dz = c.b.y - c.a.y, l = Math.hypot(dx, dz);
    return { x: c.a.x + dx * t, z: c.a.y + dz * t, rot: Math.atan2(dx / l, -dz / l), w: c.w * 2 + 1.5, y: c.y0 + (c.y1 - c.y0) * t };
  };

  // ── the blue roots (only pieces of them, running through the rock) ──
  const rootMat = std(0x2a3448, { emissive: 0x123a8a, emissiveIntensity: 0.45, roughness: 0.55 });
  const veinMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const roots: THREE.Mesh[] = [];
  const addRoot = (pts: [number, number, number][], r: number, id: string) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 12, false);
    // bark knots: push vertices in and out a little
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = (vnoise(v.x * 0.6, v.y * 0.6 + v.z * 0.6) - 0.5) * r * 0.35; p.setXYZ(i, v.x + k, v.y + k * 0.5, v.z - k); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rootMat);
    m.name = id;
    root.add(m);
    roots.push(m);
    for (let k = 0; k < 3; k++) {
      // thin light strands running along the root, slightly twisted
      const off = (k / 3) * Math.PI * 2;
      const strand = new Strand(curve, r * 1.01, off);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(strand, Math.max(40, pts.length * 20), Math.max(0.05, r * 0.07), 4, false), veinMat));
    }
    for (let i = 0; i <= 2; i++) lights.push({ pos: curve.getPoint(0.15 + i * 0.35), color: 0x4a9aff, power: 1.3 + r * 0.25 });
    things.push({ id: `root_${id}`, kind: 'scan', mat: 'blue_root', pos: curve.getPoint(0.5), r: r + 6, label: '青い根' });
    return curve;
  };
  const wakeRoot = addRoot([[-8, 7, 99], [1, 3, 102], [6, 0.6, 106], [10, -1.5, 110]], 1.2, 'dump_wake');
  addRoot([[26, 25, 108], [40, 19, 122], [58, 28, 134]], 1.4, 'dump_ceiling');
  addRoot([[50, 74, -16], [47, 42, -5], [44, 14, 1], [41, 3, 6], [39, -2, 9]], 2.6, 'city_main');
  addRoot([[-42, 60, -12], [0, 64, -22], [42, 56, -26]], 1.8, 'city_far');
  addRoot([[-102, 40, -12], [-78, 37, -32], [-50, 40, -44]], 1.5, 'river');
  addRoot([[-88, 44, -78], [-70, 30, -90], [-56, 21, -97]], 1.5, 'fungus');
  addRoot([[22, 58, -120], [10, 46, -106], [-2, 38, -114]], 1.3, 'mineral');
  addRoot([[108, 40, -12], [106.5, 80, -13.5], [109, 130, -11], [110, 160, -12]], 5, 'crystal_shaft');
  addRoot([[92, 44, 2], [100, 60, -6], [106, 75, -10]], 1.2, 'crystal_branch');
  addRoot([[68, 80, 50], [80, 64, 47], [96, 76, 45]], 1.4, 'facility');
  addRoot([[152, 60, 80], [150, 140, 78], [149, 300, 79]], 3, 'gate_shaft');
  updaters.push((t) => {
    rootMat.emissiveIntensity = 0.5 + Math.sin(t * 0.6) * 0.1;
    veinMat.opacity = 0.55 + Math.sin(t * 1.8) * 0.2;
  });

  // ── 第七廃棄区 (the dump) ──
  const junkMats = [std(0x6a5040), std(0x5a5a60, { metalness: 0.4 }), std(0x7a6a4a), std(0x4a3a2a), std(0x8a4a30, { metalness: 0.3 }), std(0x6a6a5a)];
  const junkGeos = [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(0.5, 0.5, 1, 8), new THREE.DodecahedronGeometry(0.6, 0), new THREE.BoxGeometry(1.6, 0.3, 0.8)];
  const dumpZ = ZONES.find((z) => z.id === 'dump')!;
  {
    // junk heaps: instanced (4 shapes, colour per piece) so the dump stays cheap on phones
    const junkCols = [0x6a5040, 0x5a5a60, 0x7a6a4a, 0x4a3a2a, 0x8a4a30, 0x6a6a5a];
    const inst = junkGeos.map((geo) => new THREE.InstancedMesh(geo, std(0xffffff, { metalness: 0.25 }), 80));
    const counts = [0, 0, 0, 0];
    const jm = new THREE.Matrix4(), jq = new THREE.Quaternion(), js = new THREE.Vector3(), jp = new THREE.Vector3(), jc = new THREE.Color();
    for (let i = 0; i < 300; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.92;
      const x = dumpZ.c.x + Math.cos(a) * dumpZ.rx * rr, z = dumpZ.c.y + Math.sin(a) * dumpZ.rz * rr;
      if (Math.hypot(x - SPOTS.wake.x, z - SPOTS.wake.y) < 5 || Math.hypot(x - SPOTS.pit.x, z - SPOTS.pit.y) < 7 || (Math.abs(x - 20) < 5 && z < 101)) continue;
      const k = i % 4;
      if (counts[k] >= 80) continue;
      const sc = 0.5 + rnd() * 1.6;
      jm.compose(jp.set(x, g(x, z) + sc * 0.25, z), jq.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), js.set(sc, sc * (0.5 + rnd()), sc));
      inst[k].setMatrixAt(counts[k], jm);
      inst[k].setColorAt(counts[k], jc.set(junkCols[i % junkCols.length]));
      counts[k]++;
    }
    inst.forEach((m, k) => { m.count = counts[k]; root.add(m); });
  }
  // the collector machine (a crane on rails)
  const crane = new THREE.Group();
  const yellow = std(0xc89a20, { metalness: 0.3 });
  const cb = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), yellow);
  cb.position.y = 1.5;
  crane.add(cb);
  const arm = new THREE.Group();
  arm.position.set(0, 3, 0);
  const armM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 12), yellow);
  armM.position.z = 6;
  arm.add(armM);
  const claw = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 4), std(0x5a5a60, { metalness: 0.6 }));
  claw.position.set(0, -1.5, 11.5);
  claw.rotation.x = Math.PI;
  arm.add(claw);
  crane.add(arm);
  const cabLight = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0xffd080, { emissive: 0xffa030, emissiveIntensity: 3 }));
  cabLight.position.set(0, 3.4, 2);
  crane.add(cabLight);
  crane.position.set(30, g(30, 128), 128);
  crane.rotation.y = Math.PI + 0.6;
  crane.traverse((o) => { o.castShadow = true; });
  root.add(crane);
  colliders.add({ id: 'crane', kind: 'box', x: 30, z: 128, hx: 2.6, hz: 2.2, rot: -0.6, bottom: crane.position.y - 1, top: crane.position.y + 3 });
  lights.push({ pos: new THREE.Vector3(30, crane.position.y + 5, 128), color: 0xffb060, power: 3 });
  // dump lamps on poles
  const lampPost = (x: number, z: number) => {
    cyl(`post_${x}_${z}`, x, z, 0.08, 4, std(0x4a4a4a, { metalness: 0.5 }), { collide: false, seg: 6 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), std(0xffe0a0, { emissive: 0xffa040, emissiveIntensity: 2.5 }));
    b.position.set(x, g(x, z) + 4.1, z);
    root.add(b);
    lights.push({ pos: b.position.clone(), color: 0xffb060, power: 2.2 });
  };
  [[12, 110], [28, 102], [36, 116], [14, 130]].forEach(([x, z]) => lampPost(x, z));
  // harvestable piles: wood scraps, stones, scrap metal
  const pile = (id: string, x: number, z: number, mat: string, give: string[], color: number, label: string) => {
    const grp = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(mat === 'wood' ? new THREE.CylinderGeometry(0.06, 0.07, 0.9, 5) : mat === 'stone' ? new THREE.DodecahedronGeometry(0.22, 0) : new THREE.BoxGeometry(0.5, 0.06, 0.25), std(color, { metalness: mat === 'scrap_metal' ? 0.5 : 0 }));
      m.position.set((rnd() - 0.5) * 0.9, 0.1 + rnd() * 0.25, (rnd() - 0.5) * 0.9);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      grp.add(m);
    }
    grp.position.set(x, g(x, z), z);
    root.add(grp);
    things.push({ id, kind: 'node', mat, pos: grp.position.clone(), r: 1.8, obj: grp, give, left: 99, label });
  };
  pile('dump_wood', 13, 101, 'wood', ['stick'], 0x8a6a44, '木くずの山');
  pile('dump_stone', 4, 112, 'stone', ['sharp_stone', 'heavy_stone'], 0x8c8580, '石くずの山');
  pile('dump_scrap', 26, 108, 'scrap_metal', ['blade', 'pipe'], 0x9a9ea4, '金属くずの山');
  pile('city_wood', -20, 8, 'wood', ['stick'], 0x8a6a44, '木くず');
  pile('city_stone', -30, 10, 'stone', ['sharp_stone', 'heavy_stone'], 0x8c8580, '石くず');
  // rusty plates (scan them: Fe and O together)
  const rustM = std(0x8a4a2a, { roughness: 1 });
  const rp = box('rust_plate', 34, 108, 2.4, 1.6, 0.15, rustM, { rot: 0.4 });
  rp.rotation.x = -0.2;
  things.push({ id: 'rust_plate', kind: 'scan', mat: 'rust', pos: rp.position.clone(), r: 3, label: 'さびた鉄板' });
  // a puddle of drip water (scan: H and O)
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16).rotateX(-Math.PI / 2), std(0x2a4a6a, { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.8 }));
  pud.position.set(4, g(4, 106) + 0.05, 106);
  root.add(pud);
  things.push({ id: 'dump_puddle', kind: 'scan', mat: 'water', pos: pud.position.clone(), r: 2.5, label: '水たまり' });
  // the junk heap blocking the way out: climb it (stacked boxes = steps)
  const heapM = std(0x5a4a3a);
  const ex = SPOTS.exitHeap;
  const ey = g(ex.x, ex.y);
  box('heap_wall', ex.x, ex.y - 0.6, 10, 4.2, 1.6, heapM, { y: ey });
  box('heap_s1', ex.x - 3.4, ex.y + 1.6, 2, 1.2, 1.8, heapM, { y: ey, rot: 0.1 });
  box('heap_s2', ex.x - 1.4, ex.y + 1.4, 2, 2.4, 1.8, heapM, { y: ey, rot: -0.15 });
  box('heap_s3', ex.x + 1.2, ex.y + 1.2, 2.2, 3.4, 1.6, junkMats[1], { y: ey, rot: 0.05 });
  // the deepest pit (fenced off)
  const pitY = g(SPOTS.pit.x + 7, SPOTS.pit.y);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = SPOTS.pit.x + Math.cos(a) * 6.2, z = SPOTS.pit.y + Math.sin(a) * 6.2;
    box(`fence${i}`, x, z, 2.8, 1.1, 0.12, std(0x6a6a6a, { metalness: 0.5 }), { rot: a + Math.PI / 2, y: pitY });
  }
  things.push({ id: 'pit', kind: 'scan', mat: 'stone', pos: new THREE.Vector3(SPOTS.pit.x, pitY, SPOTS.pit.y), r: 8, label: '最深部への穴' });
  // the hard boulder sealing a side cave (you come back later)
  const hb = SPOTS.caveBoulder;
  const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), std(0x9a9086, { flatShading: true }));
  boulder.scale.set(1, 1.15, 1.3);
  boulder.position.set(hb.x, g(hb.x, hb.y) + 1.8, hb.y);
  root.add(boulder);
  colliders.add({ id: 'cave_boulder', kind: 'cyl', x: hb.x, z: hb.y, r: 2.6, bottom: g(hb.x, hb.y) - 1, top: g(hb.x, hb.y) + 4.2 });
  things.push({ id: 'cave_boulder', kind: 'obstacle', mat: 'hard_rock', pos: boulder.position.clone(), r: 4.2, obj: boulder, colliders: ['cave_boulder'], onBreak: 'cave', label: '硬い岩' });
  // inside the cave: an old shell and a mask fragment (someone else came down before)
  const capsule = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), std(0xd8dce0, { metalness: 0.3, side: THREE.DoubleSide }));
  capsule.position.set(-31, g(-31, 129) + 0.3, 129);
  capsule.rotation.set(2.4, 0.4, 0.3);
  root.add(capsule);
  const frag = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI, 0, Math.PI), std(0xf4f2ec, { side: THREE.DoubleSide }));
  frag.position.set(-29, g(-29, 127) + 0.15, 127);
  frag.rotation.set(-1.2, 0.5, 0);
  root.add(frag);
  things.push({ id: 'mask_fragment', kind: 'device', mat: 'machine', pos: frag.position.clone(), r: 2.2, onBreak: 'fragment', label: '白いかけら' });
  const oreVein = (id: string, x: number, z: number) => {
    const grp = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.3, 0), std(0x8a3a2a, { roughness: 0.6, metalness: 0.2, flatShading: true }));
      m.position.set((rnd() - 0.5) * 1.6, rnd() * 1.4, (rnd() - 0.5) * 1.6);
      grp.add(m);
    }
    grp.position.set(x, g(x, z), z);
    root.add(grp);
    things.push({ id, kind: 'node', mat: 'hematite', pos: grp.position.clone(), r: 2.4, obj: grp, give: ['ore'], left: 99, label: '赤い鉱石' });
  };
  oreVein('cave_ore', -35, 125);

  // ── 地下都市 (the city) ──
  const houseM = [std(0x8a7a66), std(0x7a6a5a), std(0x6a6458), std(0x9a8a72)];
  const winM = std(0xffd890, { emissive: 0xffa040, emissiveIntensity: 1.6 });
  const city = ZONES.find((z) => z.id === 'city')!;
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.05;
    const x = city.c.x + Math.cos(a) * city.rx * 1.02, z = city.c.y + Math.sin(a) * city.rz * 1.02;
    if (Math.hypot(x - 20, z - 70) < 14 || Math.hypot(x + 46, z - 10) < 10 || Math.hypot(x - 10, z + 30) < 8) continue;
    // houses carved into the wall, stacked several storeys
    const levels = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < levels; k++) {
      const w = 3 + rnd() * 2.5, h = 2.6 + rnd(), d = 3;
      const y = city.y + 0.2 + k * 4.2 + rnd() * 0.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseM[(i + k) % 4]);
      m.position.set(x - Math.cos(a) * 1.8, y + h / 2, z - Math.sin(a) * 1.8);
      m.rotation.y = -a + Math.PI / 2;
      root.add(m);
      if (rnd() < 0.75) {
        const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), winM);
        wdw.position.set(0, 0.1, d / 2 + 0.02);
        wdw.rotation.y = Math.PI;
        wdw.position.z = -d / 2 - 0.02;
        m.add(wdw);
      }
      if (k === 0) colliders.add({ id: `house${i}`, kind: 'box', x: m.position.x, z: m.position.z, hx: w / 2, hz: d / 2, rot: a - Math.PI / 2, bottom: y - 2, top: y + h });
    }
    if (i % 7 === 0) lights.push({ pos: new THREE.Vector3(x - Math.cos(a) * 4, city.y + 6, z - Math.sin(a) * 4), color: 0xffb070, power: 2.5 });
  }
  // market stalls around the plaza
  const clothM = [std(0x8a3a3a), std(0x3a6a8a), std(0x8a7a3a), std(0x5a3a7a)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = SPOTS.plaza.x + Math.cos(a) * 9, z = SPOTS.plaza.y + Math.sin(a) * 9;
    box(`stall${i}`, x, z, 2.4, 1, 1.4, std(0x6a5038), { rot: a });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.9), clothM[i % 4]);
    roof.position.set(x, g(x, z) + 2.3, z);
    roof.rotation.y = -a;
    root.add(roof);
    for (const s of [-1, 1]) cyl(`stallp${i}${s}`, x + Math.cos(a + Math.PI / 2) * s * 1.2, z + Math.sin(a + Math.PI / 2) * s * 1.2, 0.05, 2.3, std(0x4a3a2a), { collide: false, seg: 5 });
    const goods = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), i % 2 ? std(0xb8a8e8, { emissive: 0x5a40a0, emissiveIntensity: 0.8 }) : std(0xd8b070));
    goods.position.set(x, g(x, z) + 1.15, z);
    root.add(goods);
  }
  lights.push({ pos: new THREE.Vector3(SPOTS.plaza.x, city.y + 7, SPOTS.plaza.y), color: 0xffc080, power: 4 });
  // lantern posts along the paths
  [[22, 46], [16, 38], [8, 22], [-10, 12], [-24, 8], [28, 14], [-36, 12]].forEach(([x, z]) => lampPost(x, z));
  // bridges over the chasm
  const bridgeM = std(0x6a4a30);
  for (const [bx, len] of [[SPOTS.bridgeA.x, 13], [SPOTS.bridgeB.x, 13]] as [number, number][]) {
    const bz = CHASM.z + Math.sin(bx * 0.08) * 3;
    const y = city.y - 0.15;
    box(`bridge_${bx}`, bx, bz, 3, 0.4, len, bridgeM, { y });
    for (const s of [-1, 1]) box(`rail_${bx}_${s}`, bx + s * 1.5, bz, 0.12, 1.1, len, std(0x4a3420), { y: y + 0.4 });
  }
  // the lab (researcher)
  const labM = std(0x9aa4ac, { metalness: 0.2 });
  box('lab_w1', SPOTS.lab.x - 4, SPOTS.lab.y - 3, 0.4, 3.4, 7, labM);
  box('lab_w2', SPOTS.lab.x, SPOTS.lab.y - 6.5, 8, 3.4, 0.4, labM);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7a8a9a, { metalness: 0.3, side: THREE.DoubleSide }));
  dome.position.set(SPOTS.lab.x, g(SPOTS.lab.x, SPOTS.lab.y) + 3.4, SPOTS.lab.y - 3);
  root.add(dome);
  box('lab_table', SPOTS.lab.x + 1.5, SPOTS.lab.y - 3.5, 2.4, 0.9, 1.1, std(0x5a4a3a));
  const sample = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), std(0xe8f0ff, { emissive: 0x3a6a9a, emissiveIntensity: 0.5 }));
  sample.position.set(SPOTS.lab.x + 1.5, g(SPOTS.lab.x, SPOTS.lab.y) + 1.15, SPOTS.lab.y - 3.5);
  root.add(sample);
  lights.push({ pos: new THREE.Vector3(SPOTS.lab.x, city.y + 4, SPOTS.lab.y - 2), color: 0xd0e0ff, power: 3 });
  // an old device nobody understands
  const dev = new THREE.Group();
  const devBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 8), std(0x4a4e58, { metalness: 0.6 }));
  devBase.position.y = 0.7;
  dev.add(devBase);
  const devRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 20), std(0x6a8aa8, { emissive: 0x1a3a5a, emissiveIntensity: 0.6, metalness: 0.7 }));
  devRing.position.y = 1.6;
  dev.add(devRing);
  dev.position.set(SPOTS.lab.x - 2, g(SPOTS.lab.x - 2, SPOTS.lab.y - 4), SPOTS.lab.y - 4);
  root.add(dev);
  colliders.add({ id: 'lab_device', kind: 'cyl', x: dev.position.x, z: dev.position.z, r: 0.9, bottom: dev.position.y - 1, top: dev.position.y + 1.8 });
  things.push({ id: 'lab_device', kind: 'scan', mat: 'machine', pos: dev.position.clone(), r: 2.6, label: '古い装置' });
  updaters.push((t) => { devRing.rotation.z = t * 0.2; });
  // the cracked wall at the north end: a shortcut nobody can open (very hard rock)
  const ck = acrossCorridor('shortcut', 0.78);
  const crackM = std(0x8a8278, { flatShading: true });
  const crack = box('city_crack', ck.x, ck.z, ck.w, 7, 1.8, crackM, { rot: ck.rot, y: ck.y - 0.5 });
  things.push({ id: 'city_crack', kind: 'obstacle', mat: 'hard_rock', pos: crack.position.clone().setY(ck.y + 1), r: 3.6, obj: crack, colliders: ['city_crack'], onBreak: 'shortcut', label: 'ひびの入った岩壁' });
  // glowing plants that live on the roots' light (ネビカリ草)
  const plantM = std(0x7ad0ff, { emissive: 0x2a8ad0, emissiveIntensity: 1.3 });
  const plantG = mergeGeometries([new THREE.CylinderGeometry(0.015, 0.025, 0.4, 4).translate(0, 0.2, 0).toNonIndexed(), new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.43, 0)]);
  const plantSpots: [number, number, number][] = [[38, 10, 14], [8, 104, 10], [-60, -22, 10], [-64, -86, 18], [6, -104, 8], [100, -18, 16], [82, 56, 8]];
  const plants = new THREE.InstancedMesh(plantG, plantM, 520);
  let pk = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (const [cx, cz, rr] of plantSpots) for (let i = 0; i < 70 && pk < 520; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * rr;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const s = 0.6 + rnd() * 1.2;
    m4.compose(pv.set(x, g(x, z), z), q.setFromAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), (rnd() - 0.5) * 0.5), sv.set(s, s * (0.8 + rnd()), s));
    plants.setMatrixAt(pk++, m4);
  }
  plants.count = pk;
  root.add(plants);
  things.push({ id: 'plant_city', kind: 'scan', mat: 'creature', pos: new THREE.Vector3(38, g(38, 10), 10), r: 6, label: 'ネビカリ草' });

  // people in the city
  const person = (id: string, look: NpcLook, x: number, z: number, face = 0, wander = 0) => {
    const n = new Npc(id, look);
    n.root.position.set(x, g(x, z), z);
    n.facing = face;
    n.root.rotation.y = face;
    if (wander) n.setWander(n.root.position, wander);
    root.add(n.root);
    npcs.push(n);
    things.push({ id, kind: 'npc', mat: 'creature', pos: n.root.position, r: 2.4, npc: n });
    return n;
  };
  person('worker_a', 'worker', 12, 110, -2.2);
  person('worker_b', 'worker2', 15, 112, -2.6);
  person('res_a', 'resident', 4, 18, 1.2);
  person('res_b', 'resident2', 6, 20.5, 2.6);
  person('child', 'child', 14, 8, 0, 4);
  person('vendor', 'vendor', SPOTS.plaza.x + 9, SPOTS.plaza.y + 1.5, -Math.PI / 2);
  person('res_c', 'resident', -6, 30 - 12, 0, 6);
  person('res_d', 'resident2', 24, 0, 0, 5);
  person('elder', 'elder', SPOTS.elder.x, SPOTS.elder.y, Math.atan2(41 - SPOTS.elder.x, 6 - SPOTS.elder.y));
  person('researcher', 'researcher', SPOTS.lab.x + 1.5, SPOTS.lab.y - 1.8, Math.PI);
  person('ferryman', 'ferryman', SPOTS.riverDock.x + 2.5, SPOTS.riverDock.y + 2, -Math.PI / 2);
  person('gatherer', 'gatherer', -52, -80, -1.2, 3);
  for (const [x, z, r] of [[16, 116, 6], [30, 104, 6], [-8, 24, 8], [36, 30 - 10, 6], [-70, -12, 6], [-58, -78, 8]] as [number, number, number][]) {
    const c = new Crawler(new THREE.Vector3(x, g(x, z), z), r);
    root.add(c.root);
    crawlers.push(c);
  }
  things.push({ id: 'crawler', kind: 'scan', mat: 'creature', pos: crawlers[0].root.position, r: 3, label: 'シンドウムシ' });

  // ── 地下水脈 (the river) ──
  const waterM = std(0x1a4a7a, { roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82, emissive: 0x0a2a4a, emissiveIntensity: 0.6 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0 + 14, RIVER.half * 2 + 1.4, 40, 4).rotateX(-Math.PI / 2), waterM);
  water.position.set((RIVER.x0 + RIVER.x1) / 2 + 3, RIVER.level, RIVER.z);
  root.add(water);
  updaters.push((t) => { waterM.emissiveIntensity = 0.5 + Math.sin(t * 2.5) * 0.15; });
  things.push({ id: 'river_water', kind: 'scan', mat: 'water', pos: new THREE.Vector3(-74, RIVER.level, RIVER.z), r: 7, label: '川の水' });
  const fish = new FishSchool(RIVER.x0, RIVER.x1, RIVER.z, RIVER.level);
  root.add(fish.root);
  updaters.push((t, dt) => fish.update(dt, t, RIVER.x0, RIVER.x1));
  things.push({ id: 'fish', kind: 'scan', mat: 'creature', pos: new THREE.Vector3(-70, RIVER.level, RIVER.z), r: 7, label: 'メナシウオ' });
  // the grate where the river leaves (fall in and the current carries you here)
  for (let i = 0; i < 7; i++) cyl(`grate${i}`, RIVER.x1 + 4, RIVER.z - 3 + i, 0.08, 3, std(0x5a5a5a, { metalness: 0.6 }), { y: RIVER.level - 2, collide: false, seg: 5 });
  // solution A: a tall fungus stalk on the bank. Cut or knock it down and it falls across.
  const st = SPOTS.riverStalk;
  const stalk = new THREE.Group();
  const stalkM = std(0xb8a8d8, { emissive: 0x3a2a5a, emissiveIntensity: 0.4 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 16, 10), stalkM);
  stem.position.y = 8;
  stalk.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x8a6ab8, { emissive: 0x5a3aa0, emissiveIntensity: 0.9 }));
  cap.scale.y = 0.5;
  cap.position.y = 16;
  stalk.add(cap);
  stalk.position.set(st.x, g(st.x, st.y), st.y);
  root.add(stalk);
  colliders.add({ id: 'stalk', kind: 'cyl', x: st.x, z: st.y, r: 0.8, bottom: stalk.position.y - 1, top: stalk.position.y + 16 });
  lights.push({ pos: new THREE.Vector3(st.x, stalk.position.y + 15, st.y), color: 0xa070ff, power: 2 });
  things.push({ id: 'stalk', kind: 'obstacle', mat: 'fungus', pos: stalk.position.clone().setY(stalk.position.y + 1), r: 2.4, obj: stalk, colliders: ['stalk'], onBreak: 'stalk_fall', label: '背の高い菌' });
  // solution B: stepping stones far upstream
  [-24.2, -26.3, -28.4, -30.5, -32.6].forEach((z, i) => {
    const x = SPOTS.riverStones.x + (i % 2 ? 0.5 : -0.4);
    const m = cyl(`stone${i}`, x, z, 0.75, 1.0, std(0x6a6a70, { flatShading: true }), { y: RIVER.level - 0.3, seg: 7 });
    m.scale.y = 1;
  });
  // solution C: the ferry beast ハコビ
  const hak = new Hakobi();
  hak.root.position.set(SPOTS.riverDock.x, RIVER.level - 1.1, SPOTS.riverDock.y - 3.8);
  hak.root.rotation.y = Math.PI / 2;
  root.add(hak.root);
  box('dock', SPOTS.riverDock.x, SPOTS.riverDock.y + 0.3, 4, 0.4, 3, bridgeM, { y: RIVER.level + 0.4 });
  box('dock_far', SPOTS.riverFar.x, SPOTS.riverFar.y - 0.3, 4, 0.4, 3, bridgeM, { y: RIVER.level + 0.4 });
  things.push({ id: 'hakobi', kind: 'scan', mat: 'creature', pos: hak.root.position, r: 4.5, label: 'ハコビ' });
  // river lights: glowing water plants along the banks
  lights.push({ pos: new THREE.Vector3(-74, RIVER.level + 3, -20), color: 0x60c0ff, power: 3 });
  root.add(glowMotes(new THREE.Vector3(-78, RIVER.level + 1, RIVER.z), new THREE.Vector3(60, 6, 14), 120, 0x9fe8ff).obj);

  // ── 菌類の森 (fungus forest) ──
  const fz = ZONES.find((z) => z.id === 'fungus')!;
  const capMats = [std(0x8a5ab8, { emissive: 0x5a2aa0, emissiveIntensity: 0.8 }), std(0x5ab8a8, { emissive: 0x1a8a7a, emissiveIntensity: 0.8 }), std(0xb85a8a, { emissive: 0x8a2a5a, emissiveIntensity: 0.7 })];
  const stemM = std(0xd8d0e0);
  const mushroom = (id: string, x: number, z: number, h: number, r: number, mi: number, solid: boolean) => {
    const y = g(x, z);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.3, h, 8), stemM);
    s.position.set(x, y + h / 2, z);
    root.add(s);
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMats[mi % 3]);
    c.scale.y = 0.42;
    c.position.set(x, y + h - 0.05, z);
    root.add(c);
    if (solid) {
      colliders.add({ id: `${id}_stem`, kind: 'cyl', x, z, r: r * 0.3, bottom: y - 1, top: y + h - 0.3 });
      colliders.add({ id, kind: 'cyl', x, z, r: r * 0.92, bottom: y + h - 0.5, top: y + h + r * 0.25, tags: ['cap'] });
    }
    return c;
  };
  for (let i = 0; i < 36; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.85;
    const x = fz.c.x + Math.cos(a) * fz.rx * rr, z = fz.c.y + Math.sin(a) * fz.rz * rr;
    if (Math.hypot(x + 56, z + 96) < 9 || Math.hypot(x + 66, z + 72) < 5) continue;
    const big = rnd() < 0.3;
    mushroom(`mush${i}`, x, z, big ? 9 + rnd() * 8 : 2 + rnd() * 3, big ? 3 + rnd() * 2 : 1 + rnd(), i, !big);
  }
  // solution B for the root tangle: hop up the caps to the high crack
  const capSteps: [number, number, number][] = [[-58, -92, 1.8], [-56.2, -95.6, 3.6], [-54.6, -99.2, 5.4], [-53, -102.4, 7.2]];
  capSteps.forEach(([x, z, h], i) => mushroom(`capstep${i}`, x, z, h, 1.7, i, true));
  lights.push({ pos: new THREE.Vector3(-56, fz.y + 8, -96), color: 0xb080ff, power: 3 });
  lights.push({ pos: new THREE.Vector3(-64, fz.y + 6, -80), color: 0x60e0c0, power: 3 });
  root.add(glowMotes(new THREE.Vector3(fz.c.x, fz.y + 1, fz.c.y), new THREE.Vector3(50, 10, 40), 160, 0xd0a0ff).obj);
  pile('fungus_fiber', -66, -84, 'fiber', ['fiber'], 0xd8c8e8, '菌糸のかたまり');
  pile('fungus_stems', -50, -76, 'fungus', ['fungus_stem'], 0xb8a8d8, '菌の茎');
  things.push({ id: 'mush_scan', kind: 'scan', mat: 'fungus', pos: new THREE.Vector3(-62, fz.y, -82), r: 6, label: '巨大菌' });
  // the dead root tangle blocking the tunnel up to the mineral layer
  const bt = acrossCorridor('to_mineral', 0.26);
  const tangle = new THREE.Group();
  const deadM = std(0x4a3a2a, { roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.5, rnd() * 6, (rnd() - 0.5)), new THREE.Vector3(0, rnd() * 6, (rnd() - 0.5) * 1.5), new THREE.Vector3(4.5, rnd() * 6, (rnd() - 0.5))]);
    tangle.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.35 + rnd() * 0.3, 6), deadM));
  }
  tangle.position.set(bt.x, bt.y, bt.z);
  tangle.rotation.y = -bt.rot;
  root.add(tangle);
  colliders.add({ id: 'tangle', kind: 'box', x: bt.x, z: bt.z, hx: bt.w / 2, hz: 0.9, rot: bt.rot, bottom: bt.y - 2, top: bt.y + 7 });
  things.push({ id: 'tangle', kind: 'obstacle', mat: 'dead_root', pos: new THREE.Vector3(bt.x, bt.y + 1, bt.z), r: 3.4, obj: tangle, colliders: ['tangle'], onBreak: 'tangle', label: '枯れた根のかたまり' });

  // ── 鉱物層 (mineral layer) ──
  const mz = ZONES.find((z) => z.id === 'mineral')!;
  const redM = std(0x8a4a30, { flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, rr = 0.35 + rnd() * 0.55;
    const x = mz.c.x + Math.cos(a) * mz.rx * rr, z = mz.c.y + Math.sin(a) * mz.rz * rr;
    if (Math.hypot(x - SPOTS.silica.x, z - SPOTS.silica.y) < 6) continue;
    const h = 2 + rnd() * 7;
    cyl(`redpillar${i}`, x, z, 0.6 + rnd() * 0.8, h, redM, { top: 0.2 + rnd() * 0.4, seg: 6 });
  }
  const quartzM = std(0xe8f0ff, { roughness: 0.2, emissive: 0x4a6a9a, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 });
  const quartzCluster = (id: string, x: number, z: number, n: number, s: number, give = true) => {
    const grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.18 * s, 1.3 * s, 6), quartzM);
      c.position.set((rnd() - 0.5) * s, 0.5 * s, (rnd() - 0.5) * s);
      c.rotation.set((rnd() - 0.5) * 0.9, rnd() * 3, (rnd() - 0.5) * 0.9);
      grp.add(c);
    }
    grp.position.set(x, g(x, z), z);
    root.add(grp);
    if (give) things.push({ id, kind: 'node', mat: 'quartz', pos: grp.position.clone(), r: 2.2, obj: grp, give: ['quartz'], left: 99, label: '透明な結晶' });
    return grp;
  };
  quartzCluster('quartz_a', 22, -96, 7, 1.4);
  quartzCluster('quartz_b', -6, -104, 5, 1.2);
  oreVein('ore_a', 30, -104);
  oreVein('ore_b', 0, -84);
  // sand dune where Silica sits
  const dune = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd8c8a0));
  dune.scale.y = 0.18;
  dune.position.set(SPOTS.silica.x, g(SPOTS.silica.x, SPOTS.silica.y) - 0.1, SPOTS.silica.y);
  root.add(dune);
  things.push({ id: 'sand', kind: 'scan', mat: 'sand', pos: dune.position.clone(), r: 6, label: '白い砂' });
  lights.push({ pos: new THREE.Vector3(SPOTS.silica.x, mz.y + 5, SPOTS.silica.y), color: 0xc0d8ff, power: 3 });
  lights.push({ pos: new THREE.Vector3(26, mz.y + 5, -100), color: 0xff9060, power: 2.5 });
  for (const [x, z] of [[2, -92], [24, -88]]) {
    const s = new Snail(new THREE.Vector3(x, g(x, z), z));
    root.add(s.root);
    snails.push(s);
  }
  things.push({ id: 'snail', kind: 'scan', mat: 'creature', pos: snails[0].root.position, r: 3, label: 'コウセキマイマイ' });
  // the hard rock plug on the way to the old room
  const hw = acrossCorridor('to_ante', 0.36);
  const wallRock = box('hard_wall', hw.x, hw.z, hw.w, 7, 2.2, std(0xa09890, { flatShading: true }), { rot: hw.rot, y: hw.y - 0.5 });
  things.push({ id: 'hard_wall', kind: 'obstacle', mat: 'hard_rock', pos: wallRock.position.clone().setY(hw.y + 1), r: 3.8, obj: wallRock, colliders: ['hard_wall'], onBreak: 'hard_wall', label: '硬い岩盤' });

  // ── 古い部屋 (two plates and a door) ──
  const az = ZONES.find((z) => z.id === 'ante')!;
  const plateM = std(0x5a6a7a, { metalness: 0.5, emissive: 0x0a1a2a, emissiveIntensity: 0.5 });
  for (const [id, p] of [['plate_a', SPOTS.plateA], ['plate_b', SPOTS.plateB]] as [string, THREE.Vector2][]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.18, 16), plateM.clone());
    m.position.set(p.x, g(p.x, p.y) + 0.06, p.y);
    root.add(m);
    things.push({ id, kind: 'plate', mat: 'machine', pos: m.position.clone(), r: 1.25, obj: m, label: '台座' });
  }
  const dr = acrossCorridor('to_crystal', 0.25);
  const door = box('ante_door', dr.x, dr.z, dr.w, 6.5, 0.8, std(0x6a6e78, { metalness: 0.6 }), { rot: dr.rot, y: dr.y - 0.2 });
  things.push({ id: 'ante_door', kind: 'scan', mat: 'ancient_alloy', pos: door.position.clone(), r: 3.5, obj: door, colliders: ['ante_door'], label: '古い扉' });
  const glyphM = std(0x9fd8ff, { emissive: 0x3a8aff, emissiveIntensity: 1.2 });
  for (let i = 0; i < 6; i++) {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), glyphM);
    gl.position.set(az.c.x - 6 + i * 2.4, az.y + 3, az.c.y + az.rz * 0.9);
    gl.rotation.z = i % 2 ? 0.4 : -0.4;
    root.add(gl);
  }
  lights.push({ pos: new THREE.Vector3(az.c.x, az.y + 4, az.c.y), color: 0x90c0ff, power: 3 });

  // ── 結晶層 (crystal layer) ──
  const cz = ZONES.find((z) => z.id === 'crystal')!;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, rr = 0.3 + rnd() * 0.62;
    const x = cz.c.x + Math.cos(a) * cz.rx * rr, z = cz.c.y + Math.sin(a) * cz.rz * rr;
    if (Math.hypot(x - SPOTS.rootShaft.x, z - SPOTS.rootShaft.y) < 8) continue;
    const s = 1.2 + rnd() * 3.5;
    const cl = quartzCluster(`crys${i}`, x, z, 5, s, i % 5 === 0);
    if (s > 3) colliders.add({ id: `crys${i}`, kind: 'cyl', x, z, r: s * 0.45, bottom: g(x, z) - 1, top: g(x, z) + s * 1.1 });
    void cl;
  }
  lights.push({ pos: new THREE.Vector3(105, cz.y + 6, -20), color: 0x80b8ff, power: 4 });
  root.add(glowMotes(new THREE.Vector3(108, cz.y + 2, -12), new THREE.Vector3(30, 50, 30), 220, 0x9fd8ff).obj);
  for (const [x, z] of [[96, -4], [114, -26]]) {
    const s = new Snail(new THREE.Vector3(x, g(x, z), z));
    root.add(s.root);
    snails.push(s);
  }

  // ── 古代施設 (ancient facility) ──
  const fac = ZONES.find((z) => z.id === 'facility')!;
  const ancM = std(0x5a5e66, { metalness: 0.5 });
  for (let i = 0; i < 8; i++) {
    const x = fac.c.x - 16 + i * 4.5;
    for (const s of [-1, 1]) cyl(`fpil${i}${s}`, x, fac.c.y + s * 9, 0.7, 14, ancM, { seg: 8 });
  }
  // murals: a figure falling, with a light on its chest; a big tree-like shape cut off at the top
  const muralM = std(0x3a3e46, { metalness: 0.2 });
  const mural = box('mural', fac.c.x, fac.c.y - 13.2, 14, 7, 0.4, muralM, { y: fac.y + 0.5 });
  const lineM = std(0x9fd8ff, { emissive: 0x3a8aff, emissiveIntensity: 1 });
  const fig = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), lineM);
  fig.position.set(-3, 1.4, 0.22);
  mural.add(fig);
  for (let i = 0; i < 5; i++) {
    const ln = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.05), lineM);
    ln.position.set(-3 + (i - 2) * 0.25, 2.4 + i * 0.3, 0.22);
    mural.add(ln);
  }
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.05), lineM);
  trunk.position.set(3, 0, 0.22);
  mural.add(trunk);
  things.push({ id: 'mural', kind: 'scan', mat: 'machine', pos: mural.position.clone(), r: 6, label: '古い壁画' });
  const lift = new THREE.Group();
  const liftBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 16), ancM);
  lift.add(liftBase);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 12, 0.3), ancM);
    p.position.set(Math.cos(i * Math.PI / 2) * 2.4, 6, Math.sin(i * Math.PI / 2) * 2.4);
    lift.add(p);
  }
  lift.position.set(fac.c.x + 12, g(fac.c.x + 12, fac.c.y + 2), fac.c.y + 2);
  root.add(lift);
  things.push({ id: 'lift', kind: 'scan', mat: 'machine', pos: lift.position.clone(), r: 4, label: '動かない昇降機' });
  lights.push({ pos: new THREE.Vector3(fac.c.x, fac.y + 6, fac.c.y), color: 0x8ab0e0, power: 3 });

  // ── 上層門 (the upper gate) ──
  const gz = ZONES.find((z) => z.id === 'gate')!;
  const gateX = SPOTS.gateDoor.x;
  const gateM = std(0x4a4e5a, { metalness: 0.6, roughness: 0.4 });
  const gy = gz.y;
  box('gate_wall_l', gateX, 78 - 12, 1.6, 40, 16, gateM, { y: gy - 1 });
  box('gate_wall_r', gateX, 78 + 12, 1.6, 40, 16, gateM, { y: gy - 1 });
  box('gate_lintel', gateX, 78, 1.6, 24, 8.4, gateM, { y: gy + 16 });
  const doorL = box('gate_door_l', gateX, 76, 1.2, 16, 4, std(0x6a6e7a, { metalness: 0.7 }), { y: gy });
  const doorR = box('gate_door_r', gateX, 80, 1.2, 16, 4, std(0x6a6e7a, { metalness: 0.7 }), { y: gy });
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 8, 24), std(0x9fd8ff, { emissive: 0x2a8aff, emissiveIntensity: 0.4 }));
  emblem.position.set(gateX - 0.7, gy + 9, 78);
  emblem.rotation.y = Math.PI / 2;
  root.add(emblem);
  const socket = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), std(0x2a3a5a, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 }));
  socket.position.copy(emblem.position);
  socket.scale.y = 1.6;
  root.add(socket);
  const stripM = std(0x9fd8ff, { emissive: 0x3a8aff, emissiveIntensity: 1.6 });
  for (const zz of [70.5, 85.5]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 18, 0.3), stripM);
    strip.position.set(gateX - 0.9, gy + 9, zz);
    root.add(strip);
    lights.push({ pos: new THREE.Vector3(gateX - 3, gy + 8, zz), color: 0x6aa8ff, power: 2.5 });
  }
  for (let i = 0; i < 4; i++) lampPost(gateX - 8 - i * 4, 78 + (i % 2 ? 5 : -5));
  things.push({ id: 'gate', kind: 'scan', mat: 'ancient_alloy', pos: new THREE.Vector3(gateX - 1, gy + 2, 78), r: 7, label: '上層門' });
  lights.push({ pos: new THREE.Vector3(gateX - 6, gy + 6, 78), color: 0x7aa8ff, power: 3 });
  // far above, behind the gate: faint warm lights of something nobody has seen (no sky)
  const farPos: number[] = [];
  for (let i = 0; i < 40; i++) farPos.push(148 + (rnd() - 0.5) * 12, 120 + rnd() * 170, 78 + (rnd() - 0.5) * 12);
  const farG = new THREE.BufferGeometry();
  farG.setAttribute('position', new THREE.Float32BufferAttribute(farPos, 3));
  const farLights = new THREE.Points(farG, new THREE.PointsMaterial({ color: 0xffc890, size: 1.6, fog: false, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(farLights);

  // mark corridor mouths with a few lanterns so the way is readable in the dark
  for (const c of CORRIDORS) {
    if (c.id === 'cap_route' || c.id === 'to_cave') continue;
    const x = c.a.x + (c.b.x - c.a.x) * 0.5, z = c.a.y + (c.b.y - c.a.y) * 0.5;
    lights.push({ pos: new THREE.Vector3(x, g(x, z) + 3, z), color: 0xffa860, power: 1.6 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), std(0xffe0a0, { emissive: 0xffa040, emissiveIntensity: 2.5 }));
    b.position.set(x, g(x, z) + 2.6, z);
    root.add(b);
  }

  return {
    root, colliders, things, lights, npcs, crawlers, snails, hakobi: hak, crane, craneArm: arm, wakeRoot,
    doors: { gateL: doorL, gateR: doorR, emblem, socket, farLights, ante: door },
    update(t: number, dt: number) { for (const u of updaters) u(t, dt); },
  };
}
export type World = ReturnType<typeof buildWorld>;
