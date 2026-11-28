// Character visuals are separate from character control.
// The controller only calls setState / setForm / playAction / update; any model can implement this —
// the code-built placeholders below today, a GLB (see gltfCharacter.ts) later.
import * as THREE from 'three';
import { surfaceBump } from './surfaceDetail';

export type MoveState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Fall' | 'Land' | 'Climb' | 'Swim';

export interface MoveInfo {
  /** jump phases so the model can show takeoff → rise → apex → fall → land */
  phase: 'none' | 'takeoff' | 'rise' | 'apex' | 'fall' | 'land';
  /** 0..1 how hard the last landing was */
  impact: number;
  /** signed turn angle being steered (radians) — for leaning into turns */
  turn: number;
}

export interface CharacterVisual {
  readonly root: THREE.Object3D;
  setState(state: MoveState, speed01: number, info?: MoveInfo): void;
  setForm(variant: string): void;
  /** One-shot action (e.g. 'hard_break', 'bond'); returns its length in seconds. */
  playAction(name: string): number;
  update(dt: number): void;
  /** Optional: partial transformation 0..1 (BOND / BREAK effects grow or shrink form parts). */
  setFormProgress?(variant: string, t: number): void;
  /** Optional: world position where effects gather (chest crystal). */
  anchor?(out: THREE.Vector3): THREE.Vector3;
}

// ───────────────────────── shape helpers ─────────────────────────
const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  parent?.add(o);
  return o;
}

/** Tapered limb segment hanging along -y, radius r0 at the top to r1 at the bottom, rounded ends. */
function taper(len: number, r0: number, r1: number) {
  const out: THREE.Vector2[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 0.5;
    out.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0 * 0.6));
  }
  out.push(new THREE.Vector2(r0 * 1.03, -len * 0.25));
  out.push(new THREE.Vector2((r0 + r1) / 2, -len * 0.62));
  out.push(new THREE.Vector2(r1, -len));
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI * 0.5;
    out.push(new THREE.Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1 * 0.7));
  }
  return new THREE.LatheGeometry(out, 10);
}

/** A soft rounded hair clump: a smooth teardrop pointing up +y (no sharp facets). */
function softClump(r: number, h: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(r * Math.pow(Math.sin(Math.PI * t), 0.55) * (1 - t * 0.35) + 0.002, t * h)); // round, blunt tip
  }
  const g = new THREE.LatheGeometry(pts, 9);
  g.translate(0, -h * 0.12, 0);
  return g;
}

/** A cone bent along z (horns, hair clumps). */
function bentCone(r: number, h: number, bend: number, seg = 6) {
  const g = new THREE.ConeGeometry(r, h, seg, 4);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h;
    p.setZ(i, p.getZ(i) + bend * y * y);
  }
  g.computeVertexNormals();
  return g;
}

function glowSprite(color: string, size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

// ───────────────────────── a jointed chibi body ─────────────────────────
export interface BodyOpts {
  skin: number; hair: number; tunic: number; pants: number; boots: number; sleeve: number; glove: number;
  hairStyle: 'spiky' | 'swept';
  /** soft, rounded hair clumps with smooth shading (stylised anime look) instead of sharp cones */
  smooth?: boolean;
  /** only the hair cap (e.g. under a helmet) */
  capOnly?: boolean;
  /** bigger head for a chibi look (1 = default) */
  headScale?: number;
}

export interface Joint { root: THREE.Group; lower: THREE.Group }
export interface Body {
  root: THREE.Group; // origin at the feet
  hips: THREE.Group;
  torso: THREE.Group; // pivot at the waist
  chest: THREE.Group;
  head: THREE.Group;
  armL: Joint; armR: Joint;
  legL: Joint; legR: Joint;
  tunicMat: THREE.MeshStandardMaterial;
}

export function buildBody(o: BodyOpts): Body {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.74;
  root.add(hips);
  const cloth = o.smooth ? surfaceBump('weave', 0.011) : {};
  const leather = o.smooth ? surfaceBump('leather', 0.014) : {};
  const pantsM = std(o.pants, cloth), bootM = std(o.boots, { roughness: 0.76, ...leather }), wrapM = std(0x8a6a4a, { roughness: 0.95, ...cloth });
  // legs: thigh + shin (knee joint), chunky boots with a slightly upturned toe
  const mkLeg = (x: number): Joint => {
    const j = new THREE.Group();
    j.position.set(x, 0, 0);
    hips.add(j);
    mesh(taper(0.3, 0.1, 0.085), pantsM, j);
    const knee = new THREE.Group();
    knee.position.y = -0.32;
    j.add(knee);
    mesh(taper(0.26, 0.085, 0.07), pantsM, knee);
    const wrap = mesh(new THREE.CylinderGeometry(0.083, 0.078, 0.12, 10), wrapM, knee);
    wrap.position.y = -0.17;
    const boot = new THREE.Group();
    boot.position.y = -0.34;
    knee.add(boot);
    mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 10), bootM, boot);
    const foot = mesh(new THREE.SphereGeometry(0.1, 10, 8), bootM, boot);
    foot.scale.set(0.95, 0.55, 1.55);
    foot.position.set(0, -0.07, 0.06);
    const toe = mesh(new THREE.SphereGeometry(0.06, 8, 6), bootM, boot);
    toe.position.set(0, -0.05, 0.19);
    toe.scale.set(1.1, 0.8, 0.9);
    const cuff = mesh(new THREE.TorusGeometry(0.093, 0.022, 6, 12), std(0x5a3a22), boot);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = 0.08;
    return { root: j, lower: knee };
  };
  const legL = mkLeg(0.11), legR = mkLeg(-0.11);
  // torso: a lathe-turned tunic — narrow neck, broad shoulders, cinched waist, flared hem
  const torso = new THREE.Group();
  hips.add(torso);
  const tunicMat = std(o.tunic, { roughness: 0.9, ...cloth });
  const prof = [
    [0.0, 0.66], [0.08, 0.66], [0.11, 0.62], [0.2, 0.58], [0.27, 0.52], [0.275, 0.44], [0.25, 0.3], [0.21, 0.16],
    [0.205, 0.06], [0.23, -0.04], [0.27, -0.13], [0.3, -0.2], [0.0, -0.2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tunicGeometry = new THREE.LatheGeometry(prof, o.smooth ? 24 : 16);
  if (o.smooth) {
    const position = tunicGeometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const angle = Math.atan2(x, z);
      const hem = THREE.MathUtils.smoothstep(0.23 - y, 0, 0.43);
      const fold = 1 + hem * (0.048 * Math.sin(7 * angle + y * 2) + 0.019 * Math.cos(11 * angle));
      position.setXYZ(i, x * fold, y, z * fold);
    }
    tunicGeometry.computeVertexNormals();
  }
  const tunic = mesh(tunicGeometry, tunicMat, torso);
  tunic.scale.set(1, 1, 0.74);
  for (let i = 0; i < 8; i++) { // ragged hem tabs
    const a = (i / 8) * Math.PI * 2;
    const tab = mesh(new THREE.ConeGeometry(0.045, 0.1, 3), tunicMat, torso);
    tab.position.set(Math.sin(a) * 0.27, -0.24, Math.cos(a) * 0.2);
    tab.rotation.set(Math.PI, a, 0);
  }
  const chest = new THREE.Group();
  torso.add(chest);
  // arms: upper + forearm (elbow joint) + glove
  const sleeveM = std(o.sleeve, cloth), gloveM = std(o.glove, { roughness: 0.72, ...leather });
  const mkArm = (x: number): Joint => {
    const j = new THREE.Group();
    j.position.set(x, 0.52, 0);
    chest.add(j);
    const sh = mesh(new THREE.SphereGeometry(0.095, 10, 8), sleeveM, j);
    sh.scale.set(1.05, 0.9, 1);
    mesh(taper(0.22, 0.078, 0.065), sleeveM, j);
    const elbow = new THREE.Group();
    elbow.position.y = -0.25;
    j.add(elbow);
    mesh(taper(0.18, 0.065, 0.058), sleeveM, elbow);
    const glove = mesh(new THREE.SphereGeometry(0.075, 10, 8), gloveM, elbow);
    glove.position.y = -0.26;
    glove.scale.set(0.9, 1.1, 0.85);
    const thumb = mesh(new THREE.SphereGeometry(0.03, 6, 5), gloveM, elbow);
    thumb.position.set(x > 0 ? -0.04 : 0.04, -0.24, 0.05);
    const cuff = mesh(new THREE.TorusGeometry(0.066, 0.02, 6, 10), gloveM, elbow);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.17;
    return { root: j, lower: elbow };
  };
  const armL = mkArm(0.3), armR = mkArm(-0.3);
  // head (big, chibi), slightly oval
  const head = new THREE.Group();
  head.position.y = 0.96;
  torso.add(head);
  const neck = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), std(o.skin), torso);
  neck.position.y = 0.72;
  const skull = mesh(new THREE.SphereGeometry(0.34, 22, 16), std(o.skin), head);
  skull.scale.set(1, 0.95, 0.96);
  const hairM = std(o.hair, o.smooth ? { roughness: 0.66, ...surfaceBump('hair', 0.018) } : { roughness: 0.92, flatShading: true });
  if (o.headScale) head.scale.setScalar(o.headScale);
  const cap = mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, head);
  cap.position.set(0, 0.03, -0.03);
  cap.scale.set(1.02, 1, 1.04);
  // hair clumps in layered rows, sweeping back and out; a few bangs over the forehead
  const rows = o.hairStyle === 'spiky'
    ? [{ n: 9, el: 0.25, len: 0.32, r: 0.1, bend: -0.14 }, { n: 11, el: 0.65, len: 0.3, r: 0.1, bend: -0.1 }, { n: 7, el: 1.05, len: 0.22, r: 0.09, bend: -0.04 }]
    : [{ n: 8, el: 0.35, len: 0.36, r: 0.12, bend: -0.2 }, { n: 10, el: 0.75, len: 0.34, r: 0.13, bend: -0.16 }, { n: 6, el: 1.1, len: 0.3, r: 0.12, bend: -0.1 }];
  if (!o.capOnly) rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const az = (i / row.n) * Math.PI * 2 + ri * 0.3;
      if (Math.cos(az) > 0.55 && row.el > 0.5) continue; // keep the face clear
      const len = row.len * (0.8 + ((i * 37) % 10) / 25);
      const s = mesh(o.smooth ? softClump(row.r * 1.7, len * 0.68) : bentCone(row.r, len, row.bend, 5), hairM, head);
      const dir = new THREE.Vector3(Math.sin(az) * Math.sin(row.el + 0.4), Math.cos(row.el + 0.4), Math.cos(az) * Math.sin(row.el + 0.4));
      s.position.copy(dir.clone().multiplyScalar(0.27));
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.add(new THREE.Vector3(0, 0.35, -0.25)).normalize());
    }
  });
  for (let i = 0; i < (o.capOnly ? 0 : o.hairStyle === 'spiky' ? 4 : 3); i++) {
    const b = mesh(o.smooth ? softClump(0.1, 0.16) : bentCone(0.07, 0.2, 0.08, 4), hairM, head);
    b.position.set(-0.15 + i * 0.1, 0.24, 0.24);
    b.rotation.set(1.9, 0, (i - 1.5) * 0.25);
  }
  return { root, hips, torso, chest, head, armL, armR, legL, legR, tunicMat };
}

// ───────────────────────── procedural animation ─────────────────────────
export class BodyAnimator {
  state: MoveState = 'Idle';
  speed = 0;
  info: MoveInfo = { phase: 'none', impact: 0, turn: 0 };
  t = 0;
  phase = 0; // gait phase
  action: { name: string; t: number; len: number } | null = null;
  constructor(private b: Body, private baseHipY = 0.74) {}

  set(state: MoveState, speed01: number, info?: MoveInfo) {
    this.state = state;
    this.speed = speed01;
    if (info) this.info = info;
  }

  play(name: string, len: number) {
    this.action = { name, t: 0, len };
    return len;
  }

  update(dt: number) {
    const b = this.b;
    this.t += dt;
    const s = this.state, ph = this.info.phase;
    this.phase += dt * (s === 'Run' ? 10.5 : s === 'Walk' ? 7.2 + this.speed * 4 : 6);
    const T = {
      thighL: 0, thighR: 0, kneeL: 0.05, kneeR: 0.05, armL: 0.08, armR: 0.08, armLz: 0.1, armRz: -0.1,
      elbL: -0.15, elbR: -0.15, lean: 0, roll: 0, hipY: this.baseHipY, headX: 0, headY: 0,
    };
    const p = this.phase;
    if (s === 'Walk' || s === 'Run') {
      const run = s === 'Run';
      const amp = run ? 0.95 : 0.55;
      T.thighL = Math.sin(p) * amp;
      T.thighR = -Math.sin(p) * amp;
      T.kneeL = Math.max(0, -Math.cos(p)) * (run ? 1.4 : 0.7) + 0.05; // knee bends while the leg swings forward
      T.kneeR = Math.max(0, Math.cos(p)) * (run ? 1.4 : 0.7) + 0.05;
      T.armL = -Math.sin(p) * amp * 0.85;
      T.armR = Math.sin(p) * amp * 0.85;
      T.elbL = T.elbR = run ? -1.35 : -0.35;
      T.lean = run ? 0.28 : 0.07;
      T.hipY = this.baseHipY - (run ? 0.04 : 0.01) + Math.abs(Math.sin(p)) * (run ? 0.06 : 0.025);
      T.roll = THREE.MathUtils.clamp(-this.info.turn * 0.18 * this.speed, -0.25, 0.25); // lean into turns
      T.headX = run ? -0.12 : 0;
    } else if (s === 'Idle') {
      const br = Math.sin(this.t * 1.8);
      T.hipY = this.baseHipY + br * 0.008;
      T.armLz = 0.12 + br * 0.02;
      T.armRz = -0.12 - br * 0.02;
      T.headY = Math.sin(this.t * 0.6) * 0.12;
      T.headX = Math.sin(this.t * 0.9) * 0.04;
    } else if (s === 'Jump' || s === 'Fall') {
      if (ph === 'takeoff') { // crouch to spring
        T.hipY = this.baseHipY - 0.2; T.thighL = T.thighR = -0.6; T.kneeL = T.kneeR = 1.2; T.armL = T.armR = 0.7; T.lean = 0.25;
      } else if (ph === 'rise') { // one knee up, arms swing up
        T.thighL = -1.1; T.kneeL = 1.3; T.thighR = 0.25; T.kneeR = 0.3; T.armL = -2.0; T.armR = -0.9; T.elbL = -0.4; T.lean = 0.05;
      } else if (ph === 'apex') { // tuck at the top
        T.thighL = -0.9; T.thighR = -0.6; T.kneeL = 1.4; T.kneeR = 1.2; T.armLz = 1.0; T.armRz = -1.0; T.armL = T.armR = -0.6;
      } else { // falling: legs reach down, arms out for balance
        T.thighL = -0.25; T.thighR = 0.15; T.kneeL = 0.35; T.kneeR = 0.15; T.armLz = 1.35; T.armRz = -1.35; T.armL = T.armR = -0.9; T.elbL = T.elbR = -0.5; T.headX = 0.15;
      }
    } else if (s === 'Land') {
      const k = 0.3 + this.info.impact * 0.7;
      T.hipY = this.baseHipY - 0.22 * k; T.thighL = T.thighR = -0.7 * k; T.kneeL = T.kneeR = 1.3 * k; T.lean = 0.3 * k; T.armL = T.armR = 0.5 * k; T.armLz = 0.5; T.armRz = -0.5;
    } else if (s === 'Climb') {
      const c = this.t * 9;
      T.armL = -2.7 + Math.sin(c) * 0.3; T.armR = -2.7 - Math.sin(c) * 0.3; T.elbL = T.elbR = -0.6;
      T.thighL = -1.0 + Math.sin(c) * 0.4; T.thighR = -1.0 - Math.sin(c) * 0.4; T.kneeL = T.kneeR = 1.3; T.lean = 0.3;
    } else if (s === 'Swim') {
      const c = this.t * 5;
      T.armL = -1.6 + Math.sin(c) * 0.9; T.armR = -1.6 - Math.sin(c) * 0.9; T.elbL = T.elbR = -0.3;
      T.thighL = Math.sin(c * 1.3) * 0.4; T.thighR = -Math.sin(c * 1.3) * 0.4; T.lean = 1.0; T.hipY = this.baseHipY - 0.1; T.headX = -0.8;
    }
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const q = a.t / a.len;
      if (a.name === 'hard_break') {
        const wind = q < 0.4;
        const punch = wind ? 0 : Math.max(0, 1 - (q - 0.4) / 0.6);
        T.armR = wind ? 0.9 * (q / 0.4) : -1.65 * punch;
        T.elbR = wind ? -1.6 : -0.1;
        T.lean = wind ? -0.12 : 0.35 * punch;
        T.thighL = wind ? 0 : -0.5 * punch; T.kneeL = wind ? 0.2 : 0.5 * punch;
      } else if (a.name === 'bond' || a.name === 'break') {
        T.armL = T.armR = -2.6; T.armLz = 0.6; T.armRz = -0.6; T.elbL = T.elbR = -0.2; T.headX = -0.25;
      }
      if (a.t >= a.len) this.action = null;
    }
    const k = 1 - Math.exp(-dt * (s === 'Land' || ph === 'takeoff' ? 26 : 14));
    const lerp = (o: THREE.Object3D, ax: 'x' | 'y' | 'z', v: number) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
    lerp(b.legL.root, 'x', T.thighL); lerp(b.legR.root, 'x', T.thighR);
    lerp(b.legL.lower, 'x', T.kneeL); lerp(b.legR.lower, 'x', T.kneeR);
    lerp(b.armL.root, 'x', T.armL); lerp(b.armR.root, 'x', T.armR);
    lerp(b.armL.root, 'z', T.armLz); lerp(b.armR.root, 'z', T.armRz);
    lerp(b.armL.lower, 'x', T.elbL); lerp(b.armR.lower, 'x', T.elbR);
    lerp(b.torso, 'x', T.lean); lerp(b.torso, 'z', T.roll);
    lerp(b.head, 'x', T.headX); lerp(b.head, 'y', T.headY);
    b.hips.position.y += (T.hipY - b.hips.position.y) * k;
  }
}

// ───────────────────────── deformable cape (no cloth sim — angles per state, with a spring) ─────────────────────────
class Cape {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private cols = 7;
  private rows = 9;
  private width = 0.74;
  private len = 0.98;
  private base = 0.15;
  private baseV = 0;
  private flutter = 0;
  private hem: number[] = [];

  constructor(color: number) {
    const g = new THREE.PlaneGeometry(1, 1, this.cols, this.rows);
    this.geo = g;
    for (let c = 0; c <= this.cols; c++) this.hem.push(1 - ((c * 53) % 7) / 32 - (c % 2 ? 0.06 : 0)); // ragged hem
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.shape(0.15, 0, 0);
  }

  update(dt: number, state: MoveState, speed: number, phase: MoveInfo['phase'], t: number) {
    let target = 0.1, flut = 0.02;
    if (state === 'Walk') { target = 0.32 + speed * 0.3; flut = 0.06; }
    else if (state === 'Run') { target = 0.85 + speed * 0.25; flut = 0.14; }
    else if (state === 'Jump') { target = phase === 'takeoff' ? 0.2 : phase === 'rise' ? 0.18 : 0.6; flut = 0.08; }
    else if (state === 'Fall') { target = phase === 'apex' ? 0.7 : 1.35; flut = 0.18; }
    else if (state === 'Land') { target = 0.05; flut = 0.02; }
    else if (state === 'Climb') { target = 0.25; flut = 0.05; }
    else if (state === 'Swim') { target = 1.3; flut = 0.05; }
    const stiff = 40, damp = 9; // springy: it snaps down on landing and lifts while falling
    this.baseV += ((target - this.base) * stiff - this.baseV * damp) * Math.min(dt, 0.05);
    this.base += this.baseV * Math.min(dt, 0.05);
    this.flutter += (flut - this.flutter) * (1 - Math.exp(-dt * 4));
    this.shape(this.base, this.flutter, t);
  }

  private shape(base: number, flutter: number, t: number) {
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const cols = this.cols, rows = this.rows;
    const segLen = this.len / rows;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols - 0.5;
      let y = 0, z = 0;
      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        if (r > 0) {
          const a = base * (0.35 + v * 0.9) + Math.sin(t * 7 + v * 3.2 + u * 2.4) * flutter * v * 1.6; // curls back more at the hem
          const L = segLen * (v <= this.hem[c] ? 1 : 0.15);
          y -= Math.cos(a) * L;
          z -= Math.sin(a) * L;
        }
        p.setXYZ(r * (cols + 1) + c, u * this.width * (0.8 + v * 0.45), y, z - Math.abs(u) * 0.06);
      }
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// ───────────────────────── Carbon (placeholder until the GLB exists) ─────────────────────────
function maskTexture(detailed = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  if (detailed) {
    const glaze = g.createRadialGradient(111, 92, 30, 125, 127, 163);
    glaze.addColorStop(0, '#fff9ec');
    glaze.addColorStop(0.68, '#f0e7d8');
    glaze.addColorStop(1, '#b9a795');
    g.fillStyle = glaze;
  } else g.fillStyle = '#f6f1e8';
  g.fillRect(0, 0, 256, 256);
  if (detailed) {
    // Small pits and scuffs beneath the painted markings.
    for (let i = 0; i < 720; i++) {
      const x = (i * 73 + i * i * 7) % 256, y = (i * 137 + i * i * 13) % 256;
      g.fillStyle = i % 3 ? '#6e584111' : '#ffffff40';
      g.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }
  }
  g.fillStyle = '#de5c3e';
  g.fillRect(40, 64, 10, 44);
  g.fillRect(206, 150, 10, 30);
  g.fillStyle = '#2e2834';
  g.font = 'bold 150px "Hiragino Sans", "Noto Sans JP", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('C', 122, 110);
  g.font = 'bold 50px Arial, sans-serif';
  g.fillText('6', 198, 192);
  g.fillStyle = '#3a2a2e';
  g.beginPath(); g.ellipse(86, 208, 19, 11, -0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(160, 208, 19, 11, 0.1, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ProceduralCarbon implements CharacterVisual {
  readonly root = new THREE.Group();
  private body: Body;
  private anim: BodyAnimator;
  private cape: Cape;
  private armour: THREE.Object3D[] = [];
  private crystal: THREE.Mesh;
  private glow: THREE.Sprite;
  private t = 0;
  private formT = 0; // 0 normal … 1 SiC
  private readonly baseScale: number;
  private readonly normalTunicColor: THREE.Color;
  private readonly armourTunicColor = new THREE.Color(0x22262e);

  constructor(opts: { smooth?: boolean; scale?: number } = {}) {
    this.baseScale = opts.scale ?? 1;
    this.root.scale.setScalar(this.baseScale);
    const detailed = opts.smooth === true;
    this.body = buildBody({
      skin: 0xf2c9a0, hair: 0x4a2f2c, tunic: detailed ? 0x384e5b : 0x2a201c,
      pants: detailed ? 0x45454a : 0x332620, boots: 0x6e4224,
      sleeve: detailed ? 0x415865 : 0x2e2420, glove: 0x5a3a26,
      hairStyle: detailed ? 'swept' : 'spiky', smooth: detailed, headScale: detailed ? 0.91 : undefined,
    });
    this.normalTunicColor = this.body.tunicMat.color.clone();
    this.anim = new BodyAnimator(this.body);
    this.root.add(this.body.root);
    const b = this.body;
    if (detailed) b.head.position.y -= 0.055;
    const lock = mesh(opts.smooth ? softClump(0.08, 0.3) : bentCone(0.07, 0.3, -0.12, 5), std(0xe8963e, opts.smooth ? { roughness: 0.6 } : {}), b.head); // orange lock
    lock.position.set(0.16, 0.26, 0.14);
    lock.rotation.set(0.3, 0, -0.6);
    // the mask: face plate with a little fox-like chin, C and 6, curved horns with red tips
    const maskG = new THREE.SphereGeometry(0.335, 24, 18, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.2, Math.PI * 0.62);
    const mp = maskG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const y = mp.getY(i), x = mp.getX(i);
      const z = mp.getZ(i);
      const jaw = THREE.MathUtils.smoothstep(-y, 0.015, 0.23);
      const chin = Math.max(0, -y - 0.05) * Math.max(0, 1 - Math.abs(x) * 2.2);
      if (detailed) mp.setXYZ(i, x * (1 - 0.19 * jaw), y - 0.029 * jaw, z + chin * 0.62);
      else mp.setZ(i, z + chin * 0.5);
    }
    maskG.computeVertexNormals();
    const mask = mesh(maskG, new THREE.MeshStandardMaterial({ map: maskTexture(opts.smooth), roughness: opts.smooth ? 0.59 : 0.45, side: THREE.DoubleSide, ...(opts.smooth ? surfaceBump('ceramic', 0.014) : {}) }), b.head);
    mask.position.set(0, -0.01, 0.045);
    mask.scale.set(detailed ? 1 : 1.05, detailed ? 1.11 : 1.08, 1.12);
    const hornM = std(0xf6f1e8, { roughness: 0.35 });
    for (const sx of [1, -1]) {
      const horn = mesh(bentCone(0.055, 0.3, -0.12, 8), hornM, b.head);
      horn.position.set(sx * 0.19, 0.27, 0.2);
      horn.rotation.set(-0.35, 0, sx * -0.42);
      if (detailed) horn.scale.set(0.81, 0.82, 0.84);
      const tip = mesh(new THREE.ConeGeometry(0.03, 0.08, 6), std(0xde5c3e), horn);
      tip.position.set(0, 0.29, -0.11);
      tip.rotation.x = -0.6;
    }
    const clip = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), std(0xf0a840, { roughness: 0.4, metalness: 0.3 }), b.head);
    clip.position.set(-0.32, 0.02, 0.12);
    // cream scarf at the neck, with a short tail
    const scarfM = std(0xead6a4, { roughness: 1 });
    const scarf = mesh(new THREE.TorusGeometry(0.17, 0.065, 8, 16), scarfM, b.chest);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.64;
    scarf.scale.set(1, 0.82, 1);
    const tail = mesh(new THREE.BoxGeometry(0.1, 0.24, 0.03), scarfM, b.chest);
    tail.position.set(0.1, 0.5, 0.18);
    tail.rotation.set(0.2, 0, -0.2);
    if (detailed) {
      // Raised piping follows the opening of the coat and remains readable from the gameplay camera.
      const seamMat = std(0xb39763, { roughness: 0.87 });
      for (const side of [-1, 1]) {
        const seam = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.115, 0.59, 0.142),
          new THREE.Vector3(side * 0.062, 0.43, 0.207),
          new THREE.Vector3(side * 0.061, 0.19, 0.175),
          new THREE.Vector3(side * 0.083, -0.13, 0.196),
        ]);
        mesh(new THREE.TubeGeometry(seam, 12, 0.008, 5, false), seamMat, b.chest);
      }
    }
    // ragged cape
    this.cape = new Cape(0xead6a4);
    this.cape.mesh.position.set(0, 0.62, -0.17);
    b.chest.add(this.cape.mesh);
    // leather belt + brass buckle, strap across the chest, bag on the hip
    const leather = std(0x7a4a28, { roughness: 0.55 });
    const belt = mesh(new THREE.TorusGeometry(0.215, 0.032, 6, 20), leather, b.torso);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.08;
    belt.scale.set(1, 0.76, 1);
    const buckle = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), std(0xd8a84a, { metalness: 0.6, roughness: 0.35 }), b.torso);
    buckle.position.set(0, 0.08, 0.165);
    const strap = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.2, 0.56, 0.12), new THREE.Vector3(0.05, 0.38, 0.2), new THREE.Vector3(-0.15, 0.18, 0.18), new THREE.Vector3(-0.24, 0.04, 0.08),
    ]);
    mesh(new THREE.TubeGeometry(strap, 12, 0.018, 5, false), leather, b.chest);
    const bag = new THREE.Group();
    bag.position.set(-0.25, -0.02, 0.06);
    bag.rotation.y = -0.7;
    b.torso.add(bag);
    mesh(new THREE.BoxGeometry(0.17, 0.15, 0.09), std(0xa86c34, { roughness: 0.7 }), bag);
    const flap = mesh(new THREE.BoxGeometry(0.18, 0.07, 0.1), std(0x8a5428, { roughness: 0.7 }), bag);
    flap.position.y = 0.05;
    // glowing blue crystal with a soft halo
    this.crystal = mesh(new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshStandardMaterial({ color: 0x9fe4ff, emissive: 0x3aa8ff, emissiveIntensity: 1.8, roughness: 0.15 }), b.chest);
    this.crystal.scale.y = 1.6;
    this.crystal.position.set(0, 0.42, 0.205);
    this.glow = glowSprite('rgba(110,200,255,0.9)', 0.32);
    this.glow.position.copy(this.crystal.position).add(new THREE.Vector3(0, 0, 0.02));
    b.chest.add(this.glow);
    this.buildArmour();
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** SiC FORM: black crystalline armour (real silicon carbide crystals are dark). Pieces grow in one after another. */
  private buildArmour() {
    const b = this.body;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.55, roughness: 0.22, flatShading: true });
    const shard = new THREE.MeshStandardMaterial({ color: 0x2a3140, emissive: 0x2a5a9a, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.15, flatShading: true });
    const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number], delay: number) => {
      const o = mesh(g, m, parent);
      o.position.set(...pos);
      o.rotation.set(...rot);
      o.userData = { delay, scale: new THREE.Vector3(...scale) };
      o.scale.setScalar(0.0001);
      o.visible = false;
      this.armour.push(o);
    };
    add(b.chest, new THREE.IcosahedronGeometry(0.2, 0), dark, [0, 0.36, 0.08], [0, 0, 0], [1.25, 1.1, 0.75], 0.0);
    for (let i = 0; i < 5; i++) add(b.chest, new THREE.OctahedronGeometry(0.07, 0), shard, [(i - 2) * 0.1, 0.5 - Math.abs(i - 2) * 0.07, -0.2], [-0.55, 0, (i - 2) * 0.25], [1, 3.6 - Math.abs(i - 2) * 0.6, 1], 0.2 + Math.abs(i - 2) * 0.05);
    for (const [j, sx] of [[b.armL, 1], [b.armR, -1]] as const) {
      add(j.root, new THREE.IcosahedronGeometry(0.11, 0), dark, [sx * 0.02, 0.04, 0], [0, 0, 0], [1.2, 0.9, 1.1], 0.1);
      for (let i = 0; i < 2; i++) add(j.root, new THREE.OctahedronGeometry(0.045, 0), shard, [sx * (0.06 + i * 0.03), 0.1 + i * 0.05, -0.02], [0, 0, sx * -0.7], [1, 3, 1], 0.25 + i * 0.05);
      add(j.lower, new THREE.CylinderGeometry(0.075, 0.068, 0.14, 6), dark, [0, -0.1, 0], [0, 0, 0], [1, 1, 1], 0.3);
    }
    for (const j of [b.legL, b.legR]) add(j.lower, new THREE.CylinderGeometry(0.09, 0.08, 0.16, 6), dark, [0, -0.1, 0.02], [0, 0, 0], [1, 1, 1], 0.35);
  }

  setState(state: MoveState, speed01: number, info?: MoveInfo) {
    this.anim.set(state, speed01, info);
  }

  setForm(variant: string) {
    this.setFormProgress(variant, variant === 'sic' ? 1 : 0);
  }

  /** 0 → normal, 1 → SiC FORM; in between, armour pieces grow in turn. */
  setFormProgress(variant: string, t: number) {
    this.formT = variant === 'sic' ? t : 0;
    for (const o of this.armour) {
      const k = THREE.MathUtils.clamp((this.formT - (o.userData.delay as number)) / 0.45, 0, 1);
      const e = k * k * (3 - 2 * k);
      o.visible = e > 0.001;
      o.scale.copy(o.userData.scale as THREE.Vector3).multiplyScalar(Math.max(0.0001, e));
    }
    this.body.tunicMat.color.copy(this.formT > 0.5 ? this.armourTunicColor : this.normalTunicColor);
    this.root.scale.setScalar(this.baseScale * (1 + this.formT * 0.08));
  }

  anchor(out: THREE.Vector3) {
    return this.crystal.getWorldPosition(out);
  }

  playAction(name: string) {
    return this.anim.play(name, name === 'hard_break' ? 0.55 : 0.8);
  }

  private flashT = 0;
  private hand: THREE.Group | null = null;
  /** an empty group in the right glove: tools are parented here */
  get rightHand() {
    if (!this.hand) {
      this.hand = new THREE.Group();
      this.hand.position.set(0, -0.27, 0.02);
      this.body.armR.lower.add(this.hand);
    }
    return this.hand;
  }
  /** the chest crystal flares for a moment (it reacts to the blue roots) */
  flashCrystal(sec = 1.2) { this.flashT = sec; }
  update(dt: number) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.anim.update(dt);
    this.cape.update(dt, this.anim.state, this.anim.speed, this.anim.info.phase, this.t);
    const boost = this.flashT > 0 ? Math.sin((this.flashT / 1.2) * Math.PI) * 5 : 0;
    (this.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(this.t * 3) * 0.45 + boost;
    this.glow.material.opacity = Math.min(1, 0.55 + Math.sin(this.t * 3) * 0.25 + boost * 0.2);
    this.glow.scale.setScalar(0.32 * (1 + boost * 0.5));
  }
}

// ───────────────────────── Silica (placeholder) ─────────────────────────
export class ProceduralSilica implements CharacterVisual {
  readonly root = new THREE.Group();
  private anim: BodyAnimator;
  private cape: Cape;
  private body: Body;
  private t = 0;
  constructor(opts: { smooth?: boolean; scale?: number } = {}) {
    const b = buildBody({ skin: 0xf6dcc4, hair: 0xe6e8f0, tunic: 0xf0f0f4, pants: 0x4a3f6a, boots: 0xe0b040, sleeve: 0xe8e8f0, glove: 0x4a3f6a, hairStyle: 'swept', smooth: opts.smooth, headScale: opts.smooth ? 1.1 : undefined });
    this.body = b;
    this.anim = new BodyAnimator(b);
    b.root.scale.setScalar(opts.scale ?? 1);
    this.root.add(b.root);
    const scarf = mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 16), std(0x5a4a9a, { roughness: 0.8 }), b.chest);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.64;
    this.cape = new Cape(0x4a3f6a);
    this.cape.mesh.position.set(0, 0.62, -0.17);
    this.cape.mesh.scale.set(0.9, 0.85, 1);
    b.chest.add(this.cape.mesh);
    const ornament = mesh(new THREE.OctahedronGeometry(0.085, 0), new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x4a8ad8, emissiveIntensity: 0.9 }), b.head);
    ornament.scale.y = 2.4;
    ornament.position.set(0.24, 0.28, 0.05);
    ornament.rotation.z = -0.5;
    for (const sx of [1, -1]) {
      const eye = mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6a5aa8 }), b.head);
      eye.position.set(sx * 0.11, -0.03, 0.305);
      eye.scale.set(1, 1.35, 0.5);
    }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }
  setState(s: MoveState, v: number, info?: MoveInfo) { this.anim.set(s, v, info); }
  setForm() {}
  playAction(name: string) { return this.anim.play(name, 0.8); }
  anchor(out: THREE.Vector3) { return this.body.chest.getWorldPosition(out).add(new THREE.Vector3(0, 0.4, 0)); }
  update(dt: number) {
    this.t += dt;
    this.anim.update(dt);
    this.cape.update(dt, this.anim.state, this.anim.speed, this.anim.info.phase, this.t);
  }
}
