// BOND / BREAK effect sequencer.
// BOND : short freeze → Silica breaks into particles → they stream into Carbon's crystal →
//        black crystalline armour grows piece by piece → SiC FORM.
// BREAK: the reverse — armour falls away into particles → they gather beside Carbon → Silica reforms.
// The game state is changed once, at a fixed point (onCommit), so the effect can never leave the
// save half-done; control is locked only while the sequence runs (about 1.6 s / 1.1 s).
import * as THREE from 'three';

const N = 56;

interface Seq {
  kind: 'bond' | 'break';
  t: number;
  len: number;
  committed: boolean;
  from: () => THREE.Vector3;
  to: () => THREE.Vector3;
  setProgress: (t: number) => void;
  silica: THREE.Object3D;
  onCommit: () => void;
  onDone: () => void;
  commitAt: number;
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

export class BondFx {
  readonly root = new THREE.Group();
  private parts: THREE.InstancedMesh;
  private seed: { o: THREE.Vector3; spin: number; delay: number; s: number }[] = [];
  private ring: THREE.Mesh;
  private flash: THREE.Sprite;
  private seq: Seq | null = null;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sv = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.parts = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07, 0), mat, N);
    this.parts.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.seed.push({
        o: new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 1.6, (Math.random() - 0.5) * 0.9),
        spin: (Math.random() - 0.5) * 9,
        delay: Math.random() * 0.25,
        s: 0.6 + Math.random() * 1.1,
      });
      this.parts.setColorAt(i, c.setHSL(i % 4 === 0 ? 0.56 : 0.76, 0.85, 0.5));
    }
    this.parts.visible = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.75, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.visible = false;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(170,220,255,0.7)');
    grd.addColorStop(1, 'rgba(120,180,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.flash.visible = false;
    this.root.add(this.parts, this.ring, this.flash);
  }

  get active() { return !!this.seq; }
  /** true during the opening hit-stop: the caller pauses movement and animation */
  get frozen() { return !!this.seq && this.seq.t < (this.seq.kind === 'bond' ? 0.16 : 0.1); }

  playBond(o: Omit<Seq, 'kind' | 't' | 'len' | 'committed' | 'commitAt'>) {
    this.finish();
    this.seq = { ...o, kind: 'bond', t: 0, len: 1.65, committed: false, commitAt: 1.05 };
    this.parts.visible = true;
  }

  playBreak(o: Omit<Seq, 'kind' | 't' | 'len' | 'committed' | 'commitAt'>) {
    this.finish();
    this.seq = { ...o, kind: 'break', t: 0, len: 1.15, committed: false, commitAt: 0.62 };
    this.parts.visible = true;
  }

  /** Jump to the end (used when another sequence starts or the page needs a consistent state). */
  finish() {
    const s = this.seq;
    if (!s) return;
    s.t = s.len;
    this.step(s, 0);
  }

  update(dt: number) {
    if (this.seq) this.step(this.seq, dt);
  }

  private step(s: Seq, dt: number) {
    s.t = Math.min(s.len, s.t + dt);
    const t = s.t;
    const from = this.a.copy(s.from());
    const to = this.b.copy(s.to());
    if (s.kind === 'bond') {
      // Silica dissolves (0.16 → 0.55), particles rise around her, then stream into Carbon (0.5 → 1.1)
      const dissolve = ease(span(t, 0.16, 0.55));
      s.silica.visible = dissolve < 0.98;
      s.silica.scale.set(1 - dissolve * 0.6, 1 - dissolve * 0.85, 1 - dissolve * 0.6);
      this.drawParticles(t, from, to, 0.16, 0.5, 1.12);
      s.setProgress(ease(span(t, 0.95, 1.55)));
      this.flashAt(to, span(t, 1.0, 1.4));
    } else {
      // armour falls away (0.1 → 0.55), particles leave Carbon and gather where Silica reforms (0.6 → 1.05)
      s.setProgress(1 - ease(span(t, 0.1, 0.55)));
      this.drawParticles(t, from, to, 0.1, 0.32, 0.8);
      const form = ease(span(t, 0.62, 1.05));
      s.silica.visible = form > 0.02;
      s.silica.scale.set(0.4 + form * 0.6, 0.15 + form * 0.85, 0.4 + form * 0.6);
      this.flashAt(from, span(t, 0.08, 0.45));
    }
    if (!s.committed && t >= s.commitAt) { s.committed = true; s.onCommit(); }
    if (t >= s.len) {
      if (!s.committed) { s.committed = true; s.onCommit(); }
      this.seq = null;
      this.parts.visible = false;
      this.ring.visible = false;
      this.flash.visible = false;
      s.silica.scale.set(1, 1, 1);
      s.onDone();
    }
  }

  /** gather around `from`, then fly in an arc to `to` */
  private drawParticles(t: number, from: THREE.Vector3, to: THREE.Vector3, t0: number, t1: number, t2: number) {
    for (let i = 0; i < N; i++) {
      const sd = this.seed[i];
      const rise = ease(span(t, t0 + sd.delay * 0.5, t1));
      const fly = ease(span(t, t1 + sd.delay, t2 + sd.delay * 0.4));
      const ang = sd.spin * t;
      // start: on the body; gather: a loose swirl above it
      this.v.set(sd.o.x * (1 + rise * 0.6), sd.o.y + rise * 0.5, sd.o.z * (1 + rise * 0.6));
      this.v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, ang * rise * 0.3);
      this.v.add(from);
      // fly: arc over toward the target, tightening into it
      this.sv.copy(to);
      const p = this.v.lerp(this.sv, fly);
      p.y += Math.sin(fly * Math.PI) * 0.5 * sd.s;
      const vis = t < t0 + sd.delay * 0.5 || fly >= 1 ? 0 : (0.6 + 0.5 * sd.s) * (1 - fly * 0.5);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, ang);
      this.m4.compose(p, this.q, this.sv.set(vis, vis, vis));
      this.parts.setMatrixAt(i, this.m4);
    }
    this.parts.instanceMatrix.needsUpdate = true;
  }

  private flashAt(at: THREE.Vector3, k: number) {
    const on = k > 0 && k < 1;
    this.flash.visible = on;
    this.ring.visible = on;
    if (!on) return;
    this.flash.position.copy(at);
    this.flash.scale.setScalar(0.6 + Math.sin(k * Math.PI) * 2.2);
    (this.flash.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.9;
    this.ring.position.set(at.x, at.y - 0.9, at.z);
    this.ring.scale.setScalar(1 + k * 3);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
  }
}
