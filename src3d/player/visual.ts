// Character visuals are separate from character control.
// The controller only calls setState / setForm / playAction / update; any model can implement this —
// the code-built placeholder below today, a GLB (see gltfCharacter.ts) later.
import * as THREE from 'three';

export type MoveState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Fall' | 'Land' | 'Climb' | 'Swim';

export interface CharacterVisual {
  readonly root: THREE.Object3D;
  setState(state: MoveState, speed01: number): void;
  setForm(variant: string): void;
  /** One-shot action (e.g. 'hard_break', 'bond'); returns its length in seconds. */
  playAction(name: string): number;
  update(dt: number): void;
}

// ───────────────────────── shared chibi body builder ─────────────────────────
interface BodyOpts {
  skin: number; hair: number; shirt: number; pants: number; boots: number;
  hairStyle: 'spiky' | 'swept';
}

interface Body {
  root: THREE.Group; // origin at the feet
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
}

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function limb(len: number, rTop: number, rBot: number, m: THREE.Material) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry((rTop + rBot) / 2, len, 4, 8), m);
  mesh.position.y = -len / 2 - (rTop + rBot) / 2;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

function buildBody(o: BodyOpts): Body {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);
  // legs
  const legM = mat(o.pants), bootM = mat(o.boots, { roughness: 0.7 });
  const mkLeg = (x: number) => {
    const l = limb(0.42, 0.11, 0.1, legM);
    l.position.set(x, 0, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.3), bootM);
    boot.position.set(0, -0.68, 0.04);
    boot.castShadow = true;
    l.add(boot);
    hips.add(l);
    return l;
  };
  const legL = mkLeg(0.12), legR = mkLeg(-0.12);
  // torso
  const torso = new THREE.Group();
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.32, 4, 10), mat(o.shirt));
  chest.position.y = 0.32;
  chest.scale.set(1, 1, 0.78);
  chest.castShadow = true;
  torso.add(chest);
  // arms
  const armM = mat(o.shirt);
  const mkArm = (x: number) => {
    const a = limb(0.36, 0.08, 0.075, armM);
    a.position.set(x, 0.58, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(o.skin));
    hand.position.y = -0.56;
    a.add(hand);
    torso.add(a);
    return a;
  };
  const armL = mkArm(0.32), armR = mkArm(-0.32);
  // head (big, chibi)
  const head = new THREE.Group();
  head.position.y = 0.98;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), mat(o.skin));
  skull.castShadow = true;
  head.add(skull);
  const hairM = mat(o.hair, { roughness: 0.9, flatShading: true });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  cap.position.set(0, 0.03, -0.03);
  cap.castShadow = true;
  head.add(cap);
  const spikes = o.hairStyle === 'spiky' ? 14 : 9;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(o.hairStyle === 'spiky' ? 0.11 : 0.14, o.hairStyle === 'spiky' ? 0.34 : 0.4, 5), hairM);
    const up = o.hairStyle === 'spiky' ? 0.15 + (i % 3) * 0.06 : 0.05;
    s.position.set(Math.sin(a) * 0.3, up, Math.cos(a) * 0.3 - 0.04);
    s.lookAt(new THREE.Vector3(Math.sin(a) * 2, up + (o.hairStyle === 'spiky' ? 1.2 : -0.6), Math.cos(a) * 2 - 0.1));
    s.rotateX(Math.PI / 2);
    s.castShadow = true;
    head.add(s);
  }
  return { root, hips, torso, head, armL, armR, legL, legR };
}

/** Procedural walk / run / jump / climb animation on a Body. */
class BodyAnimator {
  state: MoveState = 'Idle';
  speed = 0;
  t = 0;
  action: { name: string; t: number; len: number } | null = null;
  landT = 0;
  constructor(private b: Body, private baseHipY = 0.78) {}

  set(state: MoveState, speed01: number) {
    if (state === 'Land' && this.state !== 'Land') this.landT = 0.18;
    this.state = state;
    this.speed = speed01;
  }

  play(name: string, len: number) {
    this.action = { name, t: 0, len };
    return len;
  }

  update(dt: number) {
    const b = this.b;
    this.t += dt;
    const k = 1 - Math.exp(-dt * 14);
    const target = { legL: 0, legR: 0, armL: 0.1, armR: -0.1, armLz: 0.12, armRz: -0.12, torso: 0, hipY: this.baseHipY, head: 0 };
    const s = this.state;
    if (s === 'Walk' || s === 'Run') {
      const freq = s === 'Run' ? 11 : 7.5;
      const amp = s === 'Run' ? 0.95 : 0.6;
      const ph = this.t * freq;
      target.legL = Math.sin(ph) * amp;
      target.legR = -Math.sin(ph) * amp;
      target.armL = -Math.sin(ph) * amp * 0.9;
      target.armR = Math.sin(ph) * amp * 0.9;
      target.torso = s === 'Run' ? 0.22 : 0.06;
      target.hipY = this.baseHipY + Math.abs(Math.cos(ph)) * (s === 'Run' ? 0.08 : 0.04);
    } else if (s === 'Idle') {
      target.hipY = this.baseHipY + Math.sin(this.t * 2) * 0.012;
      target.head = Math.sin(this.t * 0.7) * 0.05;
    } else if (s === 'Jump') {
      target.legL = -0.9; target.legR = 0.3; target.armL = -2.2; target.armR = -0.6; target.torso = 0.1;
    } else if (s === 'Fall') {
      target.legL = 0.3; target.legR = -0.2; target.armLz = 1.1; target.armRz = -1.1; target.armL = -0.4; target.armR = -0.4;
    } else if (s === 'Climb') {
      const ph = this.t * 9;
      target.armL = -2.6 + Math.sin(ph) * 0.3; target.armR = -2.6 - Math.sin(ph) * 0.3;
      target.legL = -0.8 + Math.sin(ph) * 0.4; target.legR = -0.8 - Math.sin(ph) * 0.4; target.torso = 0.25;
    } else if (s === 'Swim') {
      const ph = this.t * 5;
      target.armL = -1.6 + Math.sin(ph) * 0.8; target.armR = -1.6 - Math.sin(ph) * 0.8;
      target.legL = Math.sin(ph * 1.3) * 0.4; target.legR = -Math.sin(ph * 1.3) * 0.4; target.torso = 0.9;
      target.hipY = this.baseHipY - 0.1;
    }
    if (this.landT > 0) {
      this.landT -= dt;
      target.hipY -= 0.12;
      target.legL = target.legR = -0.4;
    }
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const p = a.t / a.len;
      if (a.name === 'hard_break') {
        // wind up, then a big punch forward
        const punch = p < 0.4 ? -p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.6);
        target.armR = p < 0.4 ? 0.9 * (p / 0.4) : -1.6 * punch;
        target.torso = p < 0.4 ? -0.15 : 0.35 * punch;
      } else if (a.name === 'bond') {
        target.armL = -2.8; target.armR = -2.8; target.armLz = 0.5; target.armRz = -0.5;
      }
      if (a.t >= a.len) this.action = null;
    }
    const l = (o: THREE.Object3D, ax: 'x' | 'y' | 'z', v: number) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
    l(b.legL, 'x', target.legL); l(b.legR, 'x', target.legR);
    l(b.armL, 'x', target.armL); l(b.armR, 'x', target.armR);
    l(b.armL, 'z', target.armLz); l(b.armR, 'z', target.armRz);
    l(b.torso, 'x', target.torso);
    l(b.head, 'y', target.head);
    b.hips.position.y += (target.hipY - b.hips.position.y) * k;
  }
}

// ───────────────────────── Carbon (placeholder until the GLB exists) ─────────────────────────
function maskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f1e8';
  g.fillRect(0, 0, 256, 256);
  // red-orange markings
  g.fillStyle = '#de5c3e';
  g.fillRect(34, 60, 12, 46);
  g.fillRect(210, 150, 12, 30);
  // big C
  g.fillStyle = '#2e2834';
  g.font = 'bold 150px "Hiragino Sans", "Noto Sans JP", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('C', 120, 112);
  // small 6 (atomic number)
  g.font = 'bold 54px Arial, sans-serif';
  g.fillText('6', 200, 196);
  // eye holes
  g.fillStyle = '#3a2a2e';
  g.beginPath(); g.ellipse(82, 206, 20, 12, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(160, 206, 20, 12, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function capeGeometry() {
  // a ragged cloak: wide at the shoulders, torn hem
  const w = 0.62, h = 0.95, seg = 9;
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.45, 0);
  shape.lineTo(w * 0.45, 0);
  for (let i = seg; i >= 0; i--) {
    const x = -w / 2 + (w * i) / seg;
    const y = -h + (i % 2 ? 0.12 : 0) + (i % 3 === 0 ? 0.06 : 0);
    shape.lineTo(x * 1.25, y);
  }
  shape.lineTo(-w * 0.45, 0);
  return new THREE.ShapeGeometry(shape);
}

export class ProceduralCarbon implements CharacterVisual {
  readonly root = new THREE.Group();
  private body: Body;
  private anim: BodyAnimator;
  private sicParts = new THREE.Group();
  private cape: THREE.Mesh;
  private scarf: THREE.Mesh;
  private crystal: THREE.Mesh;
  private shirtMat: THREE.MeshStandardMaterial;
  private t = 0;

  constructor() {
    this.body = buildBody({ skin: 0xf2c9a0, hair: 0x4a2f2c, shirt: 0x2e2420, pants: 0x3a2c26, boots: 0x6e4224, hairStyle: 'spiky' });
    this.anim = new BodyAnimator(this.body);
    this.root.add(this.body.root);
    const b = this.body;
    this.shirtMat = (b.torso.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    // orange lock in the hair
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), mat(0xe8963e));
    lock.position.set(0.18, 0.3, 0.12);
    lock.rotation.set(0.4, 0, -0.5);
    b.head.add(lock);
    // mask with horns, C and 6
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.62), new THREE.MeshStandardMaterial({ map: maskTexture(), roughness: 0.5, side: THREE.DoubleSide }));
    mask.position.set(0, 0.0, 0.05);
    mask.scale.set(1.04, 1.08, 1.1);
    mask.castShadow = true;
    b.head.add(mask);
    const hornM = mat(0xf6f1e8, { roughness: 0.4 });
    for (const sx of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 8), hornM);
      horn.position.set(sx * 0.2, 0.3, 0.2);
      horn.rotation.set(-0.3, 0, sx * -0.45);
      horn.castShadow = true;
      b.head.add(horn);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), mat(0xde5c3e));
      tip.position.set(0, 0.12, 0);
      horn.add(tip);
    }
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), mat(0xf0a840));
    clip.position.set(-0.31, 0.02, 0.12);
    b.head.add(clip);
    // ragged cream cape (behind) and a short scarf
    const capeM = new THREE.MeshStandardMaterial({ color: 0xead6a4, roughness: 1, side: THREE.DoubleSide });
    this.cape = new THREE.Mesh(capeGeometry(), capeM);
    this.cape.position.set(0, 0.66, -0.2);
    this.cape.castShadow = true;
    b.torso.add(this.cape);
    this.scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 14), new THREE.MeshStandardMaterial({ color: 0xead6a4, roughness: 1 }));
    this.scarf.rotation.x = Math.PI / 2;
    this.scarf.position.y = 0.66;
    b.torso.add(this.scarf);
    // leather belt + small bag
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.035, 6, 18), mat(0x7a4a28, { roughness: 0.6 }));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.1;
    b.torso.add(belt);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.09), mat(0xa86c34, { roughness: 0.7 }));
    bag.position.set(-0.24, 0.02, 0.1);
    bag.rotation.y = -0.6;
    bag.castShadow = true;
    b.torso.add(bag);
    // glowing blue crystal on the chest
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: 0x3aa8ff, emissiveIntensity: 1.6, roughness: 0.2 }));
    this.crystal.scale.y = 1.6;
    this.crystal.position.set(0, 0.4, 0.2);
    b.torso.add(this.crystal);
    // SiC FORM extras (hidden until bonded): crystal spikes, silver armour plates, purple scarf
    const sicCrystal = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, emissive: 0x5a8ac8, emissiveIntensity: 0.5, roughness: 0.15, flatShading: true });
    const armour = new THREE.MeshStandardMaterial({ color: 0xb8c4d8, metalness: 0.6, roughness: 0.35 });
    for (const sx of [1, -1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), armour);
      pad.position.set(sx * 0.3, 0.6, 0);
      this.sicParts.add(pad);
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), sicCrystal);
        sp.scale.y = 3;
        sp.position.set(sx * (0.32 + i * 0.04), 0.74 + i * 0.05, -0.05 + i * 0.03);
        sp.rotation.z = sx * -0.6;
        this.sicParts.add(sp);
      }
    }
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), sicCrystal);
      sp.scale.y = 3.5;
      sp.position.set((i - 2) * 0.1, 0.62 + Math.abs(i - 2) * -0.06, -0.26);
      sp.rotation.x = -0.5;
      this.sicParts.add(sp);
    }
    const sicScarf = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.08, 6, 14), new THREE.MeshStandardMaterial({ color: 0x5a4a9a, roughness: 0.8 }));
    sicScarf.rotation.x = Math.PI / 2;
    sicScarf.position.y = 0.68;
    this.sicParts.add(sicScarf);
    this.sicParts.visible = false;
    b.torso.add(this.sicParts);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  setState(state: MoveState, speed01: number) {
    this.anim.set(state, speed01);
  }

  setForm(variant: string) {
    const sic = variant === 'sic';
    this.sicParts.visible = sic;
    this.scarf.visible = !sic;
    this.shirtMat.color.setHex(sic ? 0x8a96b0 : 0x2e2420);
    (this.cape.material as THREE.MeshStandardMaterial).color.setHex(sic ? 0xd8e4f6 : 0xead6a4);
    this.root.scale.setScalar(sic ? 1.12 : 1);
  }

  playAction(name: string) {
    return this.anim.play(name, name === 'hard_break' ? 0.55 : 0.8);
  }

  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    // cape sways with movement
    const sway = this.anim.state === 'Run' ? 0.55 : this.anim.state === 'Walk' ? 0.3 : this.anim.state === 'Fall' || this.anim.state === 'Jump' ? 0.7 : 0.08;
    this.cape.rotation.x += ((sway + Math.sin(this.t * 6) * 0.05 * (sway > 0.1 ? 1 : 0.4)) - this.cape.rotation.x) * (1 - Math.exp(-dt * 6));
    (this.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + Math.sin(this.t * 3) * 0.4;
  }
}

// ───────────────────────── Silica (placeholder) ─────────────────────────
export class ProceduralSilica implements CharacterVisual {
  readonly root = new THREE.Group();
  private anim: BodyAnimator;
  constructor() {
    const b = buildBody({ skin: 0xf6dcc4, hair: 0xe6e8f0, shirt: 0xf2f2f6, pants: 0x4a3f6a, boots: 0xe0b040, hairStyle: 'swept' });
    this.anim = new BodyAnimator(b);
    this.root.add(b.root);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.08, 6, 14), new THREE.MeshStandardMaterial({ color: 0x5a4a9a, roughness: 0.8 }));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.66;
    b.torso.add(scarf);
    const capeM = new THREE.MeshStandardMaterial({ color: 0x4a3f6a, roughness: 1, side: THREE.DoubleSide });
    const cape = new THREE.Mesh(capeGeometry(), capeM);
    cape.position.set(0, 0.66, -0.2);
    cape.rotation.x = 0.1;
    b.torso.add(cape);
    const ornament = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x4a8ad8, emissiveIntensity: 0.8 }));
    ornament.scale.y = 2.2;
    ornament.position.set(0.24, 0.28, 0.05);
    ornament.rotation.z = -0.5;
    b.head.add(ornament);
    // eyes
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6a5aa8 }));
      eye.position.set(sx * 0.11, -0.02, 0.31);
      eye.scale.set(1, 1.3, 0.5);
      b.head.add(eye);
    }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }
  setState(s: MoveState, v: number) { this.anim.set(s, v); }
  setForm() {}
  playAction(name: string) { return this.anim.play(name, 0.8); }
  update(dt: number) { this.anim.update(dt); }
}
