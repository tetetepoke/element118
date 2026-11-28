// Chapter 2 characters and creatures (primitive placeholders, like chapter 1; root-only so a GLB can
// replace them later). Uses the shared body builder, but nothing here changes shared code.
import * as THREE from 'three';
import { buildBody, BodyAnimator, type MoveState } from '../../player/visual';

const std = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

/** Cupra (Cu): copper-red hair, a green-patina cloak, a mask marked "Cu" */
export class ProceduralCupra {
  readonly root = new THREE.Group();
  private anim: BodyAnimator;
  private chest: THREE.Object3D;
  constructor() {
    const b = buildBody({ skin: 0xf0d0b4, hair: 0xc8642e, tunic: 0x3a7a62, pants: 0x4a3a2e, boots: 0xb87038, sleeve: 0x4a8a72, glove: 0xc87a48, hairStyle: 'swept', smooth: true, headScale: 1.1 });
    this.anim = new BodyAnimator(b);
    this.chest = b.chest;
    this.root.add(b.root);
    b.root.scale.setScalar(0.95);
    // patina cloak and copper bands
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 14, 1, true), std(0x2f8a6a, { side: THREE.DoubleSide, roughness: 0.9 }));
    cloak.position.set(0, 0.32, -0.04);
    b.chest.add(cloak);
    for (const y of [0.15, 0.5]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 18), std(0xd07a48, { metalness: 0.7, roughness: 0.3 }));
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      b.chest.add(band);
    }
    // half mask with "Cu" (like Carbon's "C"): something fell from above before
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2), std(0xf2f0ea, { roughness: 0.5 }));
    mask.rotation.x = -0.2;
    mask.position.set(0, 0.05, 0.02);
    b.head.add(mask);
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 32;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#b05a2a'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('Cu', 32, 26);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
    label.position.set(0, 0.24, 0.3);
    b.head.add(label);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), std(0xffb070, { emissive: 0xff8030, emissiveIntensity: 1.4 }));
    gem.position.set(0, 0.62, 0.2);
    b.chest.add(gem);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }
  setState(s: MoveState, v: number) { this.anim.set(s, v); }
  playAction(name: string) { return this.anim.play(name, 0.8); }
  anchor(out: THREE.Vector3) { return this.chest.getWorldPosition(out).add(new THREE.Vector3(0, 0.4, 0)); }
  update(dt: number) { this.anim.update(dt); }
}

/** copper-colour plates and glow shown on Carbon while linked with Cupra (Cu LINK) */
export function buildCuOverlay() {
  const g = new THREE.Group();
  const mat = std(0xd07a48, { metalness: 0.8, roughness: 0.25, emissive: 0x6a2a08, emissiveIntensity: 0.6 });
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    pad.position.set(sx * 0.3, 1.02, 0);
    pad.rotation.z = -sx * 0.5;
    g.add(pad);
  }
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3 + i * 0.4;
    ring.userData.spin = i;
    g.add(ring);
  }
  g.visible = false;
  return g;
}

/** ロクショウムシ: small green beetles that live on copper (fiction). They bump Carbon away. */
export class Bug {
  readonly root = new THREE.Group();
  private target = new THREE.Vector3();
  private wait = 0;
  lure: THREE.Vector3 | null = null;
  constructor(public home: THREE.Vector3, private r = 5, seed = 1) {
    const shell = std(0x2f9a6a, { metalness: 0.5, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), shell);
    body.scale.set(1, 0.55, 1.35);
    body.position.y = 0.2;
    this.root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), std(0x6a4a2a, { metalness: 0.6 }));
    head.position.set(0, 0.2, 0.36);
    this.root.add(head);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), std(0x3a2a1a));
      leg.position.set(sx * 0.24, 0.1, -0.18 + k * 0.18);
      leg.rotation.z = sx * 1.1;
      this.root.add(leg);
    }
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), std(0xffb070, { emissive: 0xff7a30, emissiveIntensity: 1.2 }));
    spot.position.set(0, 0.36, -0.05);
    this.root.add(spot);
    this.root.position.copy(home).add(new THREE.Vector3(Math.sin(seed) * r * 0.5, 0, Math.cos(seed * 1.7) * r * 0.5));
    this.target.copy(this.root.position);
  }
  update(dt: number, groundY: (x: number, z: number) => number) {
    const p = this.root.position;
    const centre = this.lure ?? this.home;
    const rr = this.lure ? 1.4 : this.r;
    this.wait -= dt;
    if (this.wait <= 0 || p.distanceTo(this.target) < 0.2) {
      this.wait = 0.6 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2, d = Math.random() * rr;
      this.target.set(centre.x + Math.sin(a) * d, 0, centre.z + Math.cos(a) * d);
    }
    const to = new THREE.Vector3(this.target.x - p.x, 0, this.target.z - p.z);
    const d = to.length();
    if (d > 0.05) {
      const sp = this.lure && p.distanceTo(this.lure) > 3 ? 3.2 : 1.4;
      p.addScaledVector(to.normalize(), Math.min(d, sp * dt));
      this.root.rotation.y = Math.atan2(to.x, to.z);
    }
    p.y = groundY(p.x, p.z);
  }
}

/** ヒカリクイ: moths circling a light (visual only) */
export function mothSwarm(center: THREE.Vector3, n: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const ms: { m: THREE.Mesh; a: number; r: number; h: number; s: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), mat);
    g.add(m);
    ms.push({ m, a: Math.random() * 6.28, r: 0.4 + Math.random() * 0.9, h: (Math.random() - 0.5) * 0.8, s: 1.5 + Math.random() * 2 });
  }
  g.position.copy(center);
  return {
    root: g,
    update(t: number) {
      for (const k of ms) {
        const a = k.a + t * k.s;
        k.m.position.set(Math.cos(a) * k.r, k.h + Math.sin(t * 3 + k.a) * 0.2, Math.sin(a) * k.r);
        k.m.rotation.y = -a;
        k.m.scale.x = 0.6 + Math.abs(Math.sin(t * 20 + k.a)) * 0.6;
      }
    },
  };
}
