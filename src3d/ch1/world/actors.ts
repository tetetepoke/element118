// Placeholder people and creatures (primitive shapes). Logic lives elsewhere; each class here only
// owns a `root` Object3D, so a GLB can replace it later without touching gameplay code.
import * as THREE from 'three';
import { buildBody, BodyAnimator, type BodyOpts } from '../../player/visual';
import { TUNING } from '../../player/controller';
import type { Collider, ColliderWorld } from '../../world/colliders';

const std = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

export type NpcLook = 'worker' | 'worker2' | 'elder' | 'researcher' | 'resident' | 'resident2' | 'child' | 'vendor' | 'gatherer' | 'ferryman';

const LOOKS: Record<NpcLook, BodyOpts & { scale?: number }> = {
  worker: { skin: 0xe0b08c, hair: 0x3a2a22, tunic: 0xe0702a, pants: 0x3a3e4a, boots: 0x4a3020, sleeve: 0x2e3038, glove: 0x8a6a40, hairStyle: 'spiky', scale: 1.15 },
  worker2: { skin: 0xc8946e, hair: 0x5a4030, tunic: 0xd8642a, pants: 0x34383f, boots: 0x3a2818, sleeve: 0x2a2c34, glove: 0x8a6a40, hairStyle: 'swept', scale: 1.22 },
  elder: { skin: 0xd8b494, hair: 0xe8e4dc, tunic: 0x4a3a5a, pants: 0x3a3040, boots: 0x3a2a20, sleeve: 0x5a4a6a, glove: 0xd8b494, hairStyle: 'swept', scale: 1.1 },
  researcher: { skin: 0xf0d0b0, hair: 0x2a3a5a, tunic: 0xd8dce0, pants: 0x3a3e48, boots: 0x2a2a30, sleeve: 0xe0e4e8, glove: 0x6a8aa8, hairStyle: 'swept', scale: 1.15 },
  resident: { skin: 0xd8a888, hair: 0x6a3a2a, tunic: 0x6a4a3a, pants: 0x4a3a30, boots: 0x3a2a20, sleeve: 0x7a5a48, glove: 0xd8a888, hairStyle: 'spiky', scale: 1.15 },
  resident2: { skin: 0xe8c0a0, hair: 0x2a2a3a, tunic: 0x3a5a5a, pants: 0x2a3a3a, boots: 0x2a2a2a, sleeve: 0x4a6a6a, glove: 0xe8c0a0, hairStyle: 'swept', scale: 1.15 },
  child: { skin: 0xf0c8a8, hair: 0xa0603a, tunic: 0x8a5a7a, pants: 0x4a3a50, boots: 0x5a3a2a, sleeve: 0x9a6a8a, glove: 0xf0c8a8, hairStyle: 'spiky', scale: 0.85 },
  vendor: { skin: 0xc8946a, hair: 0x3a2a20, tunic: 0x8a6a2a, pants: 0x4a3a20, boots: 0x3a2a18, sleeve: 0x9a7a3a, glove: 0xc8946a, hairStyle: 'swept', scale: 1.2 },
  gatherer: { skin: 0xd0a080, hair: 0x4a3a5a, tunic: 0x4a3a5a, pants: 0x3a3048, boots: 0x2a2030, sleeve: 0x5a4a6a, glove: 0x7a6a8a, hairStyle: 'spiky', scale: 1.15 },
  ferryman: { skin: 0xa87a58, hair: 0x1a1a1a, tunic: 0x2a4a4a, pants: 0x2a3434, boots: 0x1a2020, sleeve: 0x2a5050, glove: 0xa87a58, hairStyle: 'swept', scale: 1.2 },
};

export class Npc {
  readonly root = new THREE.Group();
  private anim: BodyAnimator;
  private body: ReturnType<typeof buildBody>;
  private target: THREE.Vector3 | null = null;
  private wander: { home: THREE.Vector3; r: number; wait: number } | null = null;
  private collider?: Collider;
  private height: number;
  facing = 0;
  constructor(public id: string, public look: NpcLook) {
    const L = LOOKS[look];
    this.body = buildBody({ ...L, smooth: true, headScale: 1.1, capOnly: look === 'worker' || look === 'worker2' }); // rounded, soft-shaded placeholder people
    this.body.root.scale.setScalar(L.scale ?? 1);
    this.root.add(this.body.root);
    this.anim = new BodyAnimator(this.body);
    const head = this.body.head;
    if (look === 'worker' || look === 'worker2') {
      // yellow hard hat with a brim and goggles, orange work clothes, a tool belt with pouches
      const yellow = std(0xf0b820, { roughness: 0.35, metalness: 0.1 });
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), yellow);
      helmet.position.y = 0.06;
      helmet.scale.set(1, 0.92, 1.04);
      head.add(helmet);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 8, 28), yellow);
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 0.07;
      head.add(brim);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), yellow);
      ridge.position.set(0, 0.42, 0);
      head.add(ridge);
      const gog = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16), std(0x2a2a30, { metalness: 0.6, roughness: 0.3 }));
      for (const sx of [-1, 1]) { const g2 = gog.clone(); g2.position.set(sx * 0.11, 0.17, 0.3); head.add(g2); }
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), std(0x9ab8d0, { metalness: 0.4, roughness: 0.1 }));
      for (const sx of [-1, 1]) { const l2 = lens.clone(); l2.position.set(sx * 0.11, 0.17, 0.315); head.add(l2); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0xfff0c0, { emissive: 0xffd080, emissiveIntensity: 2 }));
      lamp.position.set(0, 0.32, 0.33);
      head.add(lamp);
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.07, 3), std(0x2a2a30));
      mark.position.set(0, 0.36, -0.2);
      mark.rotation.y = Math.PI;
      this.body.chest.add(mark);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.04, 8, 24), std(0x6a4a28, { roughness: 0.6 }));
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 0.08;
      belt.scale.set(1, 0.8, 1);
      this.body.torso.add(belt);
      const pouchM = std(0x8a6a3a, { roughness: 0.7 });
      for (const [x, z] of [[0.2, 0.08], [-0.2, 0.08], [0.12, -0.14]]) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.07), pouchM);
        pouch.position.set(x, 0.0, z);
        pouch.lookAt(0, 0, 0);
        this.body.torso.add(pouch);
      }
      const wrench = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), std(0x9aa0a8, { metalness: 0.8, roughness: 0.3 }));
      wrench.position.set(-0.24, -0.04, 0.02);
      this.body.torso.add(wrench);
    }
    if (look === 'elder') {
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), std(0xeeeae2));
      beard.rotation.x = Math.PI;
      beard.position.set(0, 0.02, 0.17);
      head.add(beard);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6), std(0x6a4a2a));
      staff.position.set(-0.45, 0.85, 0.15);
      this.root.add(staff);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0x9fdcff, { emissive: 0x3a9aff, emissiveIntensity: 1.5 }));
      orb.position.set(-0.45, 1.72, 0.15);
      this.root.add(orb);
    }
    if (look === 'researcher') {
      const gog = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16), std(0x2a2a30, { metalness: 0.6 }));
      gog.position.set(0, 0.22, 0.02);
      gog.rotation.x = Math.PI / 2 - 0.3;
      head.add(gog);
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.75, 10, 1, true), std(0xf0f2f4, { side: THREE.DoubleSide }));
      coat.position.y = 0.55;
      this.root.add(coat);
    }
    if (look === 'vendor' || look === 'gatherer' || look === 'ferryman') {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.22, 10), std(look === 'gatherer' ? 0x6a4a8a : 0x8a7a50));
      hat.position.y = 0.36;
      head.add(hat);
    }
    if (look === 'resident' || look === 'gatherer' || look === 'ferryman') {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xffe0a0, { emissive: 0xffa040, emissiveIntensity: 2 }));
      lantern.position.set(0, -0.32, 0.05);
      this.body.armL.lower.add(lantern);
    }
    this.root.scale.setScalar(0.5);
    const bounds = new THREE.Box3().setFromObject(this.root);
    this.height = bounds.max.y;
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }
  addCollider(world: ColliderWorld) {
    const { x, y, z } = this.root.position;
    this.collider = world.add({
      id: `npc_${this.id}`, kind: 'cyl', x, z, r: 0.22 * (LOOKS[this.look].scale ?? 1),
      bottom: y, top: y + this.height, dynamic: true, climbable: false, cameraIgnore: true, model: this.root,
    });
  }
  syncCollider() {
    if (!this.collider) return;
    const { x, y, z } = this.root.position;
    // Render culling can hide a person without removing them from the world.
    Object.assign(this.collider, { x, z, bottom: y, top: y + this.height });
  }
  walkTo(p: THREE.Vector3 | null) { this.target = p ? p.clone() : null; }
  setWander(home: THREE.Vector3, r: number) { this.wander = { home: home.clone(), r, wait: Math.random() * 3 }; }
  lookAt(p: THREE.Vector3) {
    this.facing = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
  }
  play(name: string) { this.anim.play(name, 0.8); }
  update(dt: number, groundY: (x: number, z: number) => number, player?: THREE.Vector3) {
    let moving = false;
    if (!this.target && this.wander) {
      this.wander.wait -= dt;
      if (this.wander.wait <= 0) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * this.wander.r;
        this.target = this.wander.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        this.wander.wait = 3 + Math.random() * 5;
      }
    }
    if (this.target) {
      const dx = this.target.x - this.root.position.x, dz = this.target.z - this.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) this.target = null;
      else {
        const sp = Math.min(d, 1.6 * dt);
        const p = this.root.position;
        const x = p.x + (dx / d) * sp, z = p.z + (dz / d) * sp;
        const y = groundY(x, z);
        const gap = this.collider?.r ?? 0;
        const blocked = player && this.collider?.enabled && player.y < y + this.height && player.y + TUNING.height > y
          && Math.hypot(x - player.x, z - player.z) < gap + TUNING.radius
          && Math.hypot(x - player.x, z - player.z) < Math.hypot(p.x - player.x, p.z - player.z);
        if (!blocked) {
          p.set(x, y, z);
          moving = true;
        }
        this.facing = Math.atan2(dx, dz);
      }
    }
    this.root.position.y = groundY(this.root.position.x, this.root.position.z);
    this.syncCollider();
    let df = this.facing - this.root.rotation.y;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    this.root.rotation.y += df * Math.min(1, dt * 6);
    this.anim.set(moving ? 'Walk' : 'Idle', moving ? 0.4 : 0);
    this.anim.update(dt);
  }
}

// ───────── creatures (none of them are enemies) ─────────

/** シンドウムシ: no eyes; feels vibrations. When something runs near, it curls up and burrows. */
export class Crawler {
  readonly root = new THREE.Group();
  private legs: THREE.Mesh[] = [];
  private t = Math.random() * 10;
  private dir = Math.random() * Math.PI * 2;
  hide = 0; // 0 out … 1 hidden
  constructor(public home: THREE.Vector3, private r = 5) {
    const shell = std(0x6a5a4a, { roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.16 - i * 0.025, 8, 6), shell);
      seg.scale.set(1, 0.6, 1.1);
      seg.position.set(0, 0.12, -i * 0.2);
      this.root.add(seg);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), shell);
        leg.position.set(s * 0.15, 0.06, -i * 0.2);
        leg.rotation.z = s * 1.0;
        this.root.add(leg);
        this.legs.push(leg);
      }
    }
    const feeler = std(0xd8c8a0, { emissive: 0x806a30, emissiveIntensity: 0.6 });
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), feeler);
      f.position.set(s * 0.06, 0.2, 0.25);
      f.rotation.x = 1.0;
      this.root.add(f);
    }
    this.root.position.copy(home);
  }
  update(dt: number, groundY: (x: number, z: number) => number, player: THREE.Vector3, playerSpeed: number) {
    this.t += dt;
    const d = this.root.position.distanceTo(player);
    const scared = d < 7 && playerSpeed > 5; // running = big vibrations
    this.hide += ((scared ? 1 : 0) - this.hide) * Math.min(1, dt * (scared ? 6 : 0.8));
    if (this.hide < 0.5) {
      if (Math.random() < dt * 0.4) this.dir += (Math.random() - 0.5) * 2;
      const p = this.root.position;
      if (p.distanceTo(this.home) > this.r) this.dir = Math.atan2(this.home.x - p.x, this.home.z - p.z);
      p.x += Math.sin(this.dir) * 0.5 * dt;
      p.z += Math.cos(this.dir) * 0.5 * dt;
      this.root.rotation.y = this.dir;
      this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.t * 14 + i) * 0.5));
    }
    this.root.position.y = groundY(this.root.position.x, this.root.position.z) - this.hide * 0.32;
  }
}

/** コウセキマイマイ: a slow snail that eats minerals; its shell grows crystals. */
export class Snail {
  readonly root = new THREE.Group();
  private t = Math.random() * 10;
  constructor(public home: THREE.Vector3) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), std(0x9a8a7a));
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.14;
    this.root.add(body);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), std(0x6a5a8a, { roughness: 0.4 }));
    shell.position.set(0, 0.4, -0.08);
    this.root.add(shell);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), std(0xbfe0ff, { emissive: 0x4a90d0, emissiveIntensity: 1.2 }));
      c.scale.y = 2;
      c.position.set(Math.cos(i * 1.3) * 0.2, 0.62, -0.08 + Math.sin(i * 1.3) * 0.2);
      c.rotation.z = Math.cos(i) * 0.5;
      this.root.add(c);
    }
    this.root.position.copy(home);
  }
  update(dt: number, groundY: (x: number, z: number) => number) {
    this.t += dt;
    const a = this.t * 0.05;
    this.root.position.x = this.home.x + Math.cos(a) * 2.5;
    this.root.position.z = this.home.z + Math.sin(a) * 2.5;
    this.root.rotation.y = -a;
    this.root.position.y = groundY(this.root.position.x, this.root.position.z);
  }
}

/** ハコビ: a big gentle beast that lives with people and carries them across the river. */
export class Hakobi {
  readonly root = new THREE.Group();
  private t = 0;
  private legs: THREE.Object3D[] = [];
  private head: THREE.Group;
  constructor() {
    const skin = std(0x5a6a7a, { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), skin);
    body.scale.set(1.2, 0.7, 1.7);
    body.position.y = 1.5;
    this.root.add(body);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.3), std(0x3a4a5a, { roughness: 0.4 }));
    shell.scale.set(1.2, 0.6, 1.7);
    shell.position.y = 1.65;
    this.root.add(shell);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.2), std(0x8a5a3a));
    saddle.position.y = 2.42;
    this.root.add(saddle);
    for (const [x, z] of [[-1.1, 1.3], [1.1, 1.3], [-1.1, -1.3], [1.1, -1.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 1.2, 8), skin);
      leg.position.set(x, 0.6, z);
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.head = new THREE.Group();
    this.head.position.set(0, 1.5, 2.4);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), skin);
    h.scale.set(1, 0.8, 1.2);
    this.head.add(h);
    // no eyes; glowing feelers on the snout instead
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), std(0xbfe8ff, { emissive: 0x4ab0ff, emissiveIntensity: 2 }));
      f.position.set(s * 0.3, 0.3, 0.55);
      this.head.add(f);
    }
    this.root.add(this.head);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }
  update(dt: number, walking: boolean) {
    this.t += dt;
    this.head.rotation.y = Math.sin(this.t * 0.5) * 0.25;
    this.head.position.y = 1.5 + Math.sin(this.t * 1.2) * 0.05;
    this.legs.forEach((l, i) => (l.rotation.x = walking ? Math.sin(this.t * 4 + (i % 2) * Math.PI) * 0.4 : 0));
  }
}

/** glowing blind cave fish swimming in the river */
export class FishSchool {
  readonly root = new THREE.Group();
  private fish: { m: THREE.Mesh; x: number; z: number; ph: number; sp: number }[] = [];
  constructor(x0: number, x1: number, z: number, y: number, n = 14) {
    const mat = std(0xcfe8ff, { emissive: 0x5ab0ff, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 });
    const g = new THREE.ConeGeometry(0.08, 0.36, 5).rotateX(Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, mat);
      const f = { m, x: x0 + Math.random() * (x1 - x0), z: z + (Math.random() - 0.5) * 5, ph: Math.random() * 6, sp: 0.6 + Math.random() };
      m.position.set(f.x, y - 0.5 - Math.random() * 0.8, f.z);
      this.fish.push(f);
      this.root.add(m);
    }
  }
  update(dt: number, t: number, x0: number, x1: number) {
    for (const f of this.fish) {
      f.x -= f.sp * dt; // swim upstream
      if (f.x < x0) f.x = x1;
      f.m.position.x = f.x;
      f.m.position.z = f.z + Math.sin(t * f.sp + f.ph) * 0.6;
      f.m.rotation.y = -Math.PI / 2 + Math.cos(t * f.sp + f.ph) * 0.3;
    }
  }
}

/** a cloud of tiny glowing moths/spores drifting around a spot */
export function glowMotes(center: THREE.Vector3, spread: THREE.Vector3, n: number, color: number) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = center.x + (Math.random() - 0.5) * spread.x;
    pos[i * 3 + 1] = center.y + Math.random() * spread.y;
    pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread.z;
    seed[i] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const c = cv.getContext('2d')!;
  const grd = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grd;
  c.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ color, size: 0.18, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  const base = pos.slice();
  return {
    obj: pts,
    update(t: number) {
      for (let i = 0; i < n; i++) {
        const s = seed[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.4 + s) * 1.2;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.7 + s * 2) * 0.6;
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 + s) * 1.2;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
