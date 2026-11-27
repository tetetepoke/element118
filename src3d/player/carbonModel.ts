// Carbon's look: the official GLB model, with the code-built placeholder as a fallback.
// - The placeholder shows right away; the GLB loads in the background (no wait at start).
// - If the GLB is missing or fails to load, the placeholder simply stays (the game is unaffected).
// - Same CharacterVisual interface, so movement, collision and camera code do not change.
// - Animations are called by name with a 0.2 s cross-fade; any clip in the file can be played later
//   with playClip('Wave') etc.
import * as THREE from 'three';
import type { CharacterVisual, MoveInfo, MoveState } from './visual';

/** how the game's states and actions map to clip names in the GLB */
export const CARBON_ANIM = {
  idle: 'Idle',
  walk: 'Walk',
  jog: 'Jog',
  sprint: 'Sprint',
  jump: 'Jump',
  hit: 'HitReact',
  death: 'Death',
  actions: { hard_break: 'Hook', bond: 'Cheer' } as Record<string, string>,
  /** ground speed (m/s) each loop shows at timeScale 1 — used to keep the feet from sliding */
  clipSpeed: { Walk: 1.5, Jog: 3.4, Sprint: 6.0 } as Record<string, number>,
  /** speed bands (m/s) for choosing the loop */
  jogFrom: 4.2,
  sprintFrom: 7.2,
  fade: 0.2,
};

/** fine adjustments for the model file (if it faces another way or stands lower) */
export const CARBON_FIT = { yaw: 0, height: 0, lift: 0 };

export class CarbonModel implements CharacterVisual {
  readonly root = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private oneShot = 0;
  private form = 'normal';
  private formT = 0;
  private height = 1.3;
  loaded = false;
  failed = false;

  constructor(private fallback: CharacterVisual & { setFormProgress?(v: string, t: number): void; anchor?(o: THREE.Vector3): THREE.Vector3 }) {
    this.root.add(fallback.root);
    // the placeholder's own transform is driven through this root from now on
    fallback.root.position.set(0, 0, 0);
    fallback.root.rotation.set(0, 0, 0);
  }

  /** start loading the GLB (does not block); resolves true when the model is in use */
  async load(url: string) {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      this.attach(gltf.scene, gltf.animations);
      return true;
    } catch (e) {
      this.failed = true;
      console.warn('Carbon GLB not used, keeping the placeholder:', e);
      return false;
    }
  }

  private attach(scene: THREE.Object3D, clips: THREE.AnimationClip[]) {
    // size and feet: match the placeholder's height so the collider and camera framing stay right
    const target = new THREE.Box3().setFromObject(this.fallback.root).getSize(new THREE.Vector3()).y || 1.3;
    const wrap = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = (CARBON_FIT.height || target) / (size.y || 1);
    scene.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(scene);
    const c = b2.getCenter(new THREE.Vector3());
    scene.position.x -= c.x;
    scene.position.z -= c.z;
    scene.position.y -= b2.min.y - CARBON_FIT.lift;
    wrap.add(scene);
    wrap.rotation.y = CARBON_FIT.yaw;
    this.height = CARBON_FIT.height || target;
    this.model = wrap;
    this.mixer = new THREE.AnimationMixer(scene);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', () => { this.oneShot = 0; });
    this.calibrate(scene);
    this.root.add(wrap);
    this.loaded = true;
    this.fadeTo(CARBON_ANIM.idle);
    this.applyVisibility();
  }

  /** the GLB has no SiC armour yet: during SiC FORM (and while it grows) the placeholder with armour shows */
  private applyVisibility() {
    const useModel = this.loaded && this.form === 'normal' && this.formT <= 0.001;
    if (this.model) this.model.visible = useModel;
    this.fallback.root.visible = !useModel;
  }

  /**
   * Measure how far a foot travels in each loop (Walk / Jog / Sprint) so the playback speed matches the
   * ground speed and the feet do not slide. Uses the model's own foot bones; keeps the defaults if none.
   */
  private calibrate(scene: THREE.Object3D) {
    if (!this.mixer) return;
    let foot: THREE.Object3D | null = null;
    scene.traverse((o) => { if (!foot && (o as THREE.Bone).isBone && /(left|_l\b|\.l\b|l_).*?(foot|ankle)|(foot|ankle).*?(left|_l\b|\.l\b)/i.test(o.name)) foot = o; });
    if (!foot) scene.traverse((o) => { if (!foot && (o as THREE.Bone).isBone && /foot|ankle/i.test(o.name)) foot = o; });
    // generic bone names (bone_0…): the foot is the lowest bone in the rest pose, the hips the top bone
    const bones: THREE.Object3D[] = [];
    scene.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o); });
    scene.updateMatrixWorld(true);
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    if (!foot && bones.length) foot = bones.reduce((a, o) => (wp(o).y < wp(a).y ? o : a));
    const hips = bones.find((o) => !(o.parent as THREE.Bone)?.isBone) ?? null;
    if (!foot) return;
    const f = foot as THREE.Object3D;
    const p = new THREE.Vector3(), h = new THREE.Vector3(), inv = new THREE.Matrix4();
    for (const name of [CARBON_ANIM.walk, CARBON_ANIM.jog, CARBON_ANIM.sprint]) {
      const a = this.actions.get(name);
      if (!a) continue;
      const dur = a.getClip().duration;
      this.mixer.stopAllAction();
      a.reset().play();
      const N = 96, zs: number[] = [];
      for (let i = 0; i < N; i++) {
        this.mixer.setTime((i / N) * dur);
        scene.updateMatrixWorld(true);
        inv.copy(scene.matrixWorld).invert();
        f.getWorldPosition(p).applyMatrix4(inv); // in the model's own space (forward = +z)
        if (hips && hips !== f) p.sub(hips.getWorldPosition(h).applyMatrix4(inv)); // ignore root motion
        zs.push(p.z * scene.scale.z);
      }
      const min = Math.min(...zs), max = Math.max(...zs), mid = (min + max) / 2;
      // a clip can hold several gait cycles: count them by the foot swinging forward past the middle
      let cycles = 0;
      for (let i = 0; i < N; i++) if (zs[i] < mid && zs[(i + 1) % N] >= mid) cycles++;
      cycles = Math.max(1, cycles);
      const stride = (max - min) * 2; // the body moves about twice the foot's swing per gait cycle
      if (stride > 0.05 && dur > 0) CARBON_ANIM.clipSpeed[name] = (stride * cycles) / dur;
      a.stop();
    }
    // keep the order Walk < Jog < Sprint (a short, in-place sprint loop can measure low)
    const cs = CARBON_ANIM.clipSpeed, W = CARBON_ANIM.walk, J = CARBON_ANIM.jog, S = CARBON_ANIM.sprint;
    cs[J] = Math.max(cs[J], cs[W] * 1.4);
    cs[S] = Math.max(cs[S], cs[J] * 1.4);
    // switch clips halfway between their natural speeds, so each plays near 1x
    CARBON_ANIM.jogFrom = (cs[W] + cs[J]) / 2;
    // Sprint only when actually running (walk 3.9 m/s → Jog, run 7.6 m/s → Sprint)
    CARBON_ANIM.sprintFrom = Math.max((cs[J] + cs[S]) / 2, 5.2);
    this.mixer.stopAllAction();
    this.current = null;
  }

  /**
   * Add the clips of the full file (carbon_all.glb: all 27 moves) so any of them can be played by name.
   * Only loaded when asked for, so the normal start stays light. Same skeleton, so tracks bind by bone name.
   */
  async loadAllClips(url: string) {
    if (!this.mixer) return false;
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      for (const clip of gltf.animations) if (!this.actions.has(clip.name)) this.actions.set(clip.name, this.mixer.clipAction(clip));
      return true;
    } catch (e) {
      console.warn('extra Carbon clips not loaded:', e);
      return false;
    }
  }

  /** names of every clip in the file */
  get clipNames() { return [...this.actions.keys()]; }
  get currentClip() { return this.current?.getClip().name ?? null; }
  /** measured ground speed (m/s) of each locomotion clip at 1x */
  get clipSpeeds() { return { ...CARBON_ANIM.clipSpeed }; }
  get timeScale() { return this.current?.timeScale ?? 1; }

  private fadeTo(name: string, loop = true) {
    const a = this.actions.get(name);
    if (!a) return false;
    if (a === this.current) return true;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.enabled = true;
    a.play();
    if (this.current) this.current.crossFadeTo(a, CARBON_ANIM.fade, false);
    this.current = a;
    return true;
  }

  /** play any clip in the file by name (one-shot); returns its length */
  playClip(name: string) {
    const a = this.actions.get(name);
    if (!a) return 0;
    this.fadeTo(name, false);
    this.oneShot = a.getClip().duration;
    return this.oneShot;
  }

  setState(state: MoveState, speed01: number, info?: MoveInfo) {
    this.fallback.setState(state, speed01, info);
    if (!this.loaded || this.oneShot > 0) return;
    const A = CARBON_ANIM;
    const mps = speed01 * 7.6; // speed01 is relative to the run speed
    let name = A.idle;
    if (state === 'Jump' || state === 'Fall' || state === 'Climb') name = A.jump;
    else if (state === 'Walk' || state === 'Run' || state === 'Swim') name = mps >= A.sprintFrom ? A.sprint : mps >= A.jogFrom ? A.jog : A.walk;
    if (!this.actions.has(name)) name = A.idle;
    this.fadeTo(name, name !== A.jump);
    // keep the feet in step with the ground speed
    const cs = A.clipSpeed[name];
    if (this.current) this.current.timeScale = cs ? THREE.MathUtils.clamp(mps / cs, 0.5, 2.2) : 1;
  }

  setForm(variant: string) {
    this.form = variant;
    this.fallback.setForm(variant);
    this.formT = variant === 'normal' ? 0 : 1;
    this.applyVisibility();
  }

  setFormProgress(variant: string, t: number) {
    this.fallback.setFormProgress?.(variant, t);
    this.formT = t;
    if (t > 0.001) this.form = variant;
    else if (t <= 0.001 && this.form !== 'normal') this.form = 'normal';
    this.applyVisibility();
  }

  playAction(name: string) {
    const fb = this.fallback.playAction(name);
    if (!this.loaded) return fb;
    const clip = CARBON_ANIM.actions[name] ?? name;
    return this.playClip(clip) || fb;
  }

  anchor(out: THREE.Vector3) {
    if (!this.loaded || !this.model?.visible) return this.fallback.anchor ? this.fallback.anchor(out) : out.copy(this.root.position);
    // the chest crystal: about 62% of the height, a little forward
    const f = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    return out.copy(this.root.position).addScaledVector(f, 0.12).add(new THREE.Vector3(0, this.height * 0.62, 0));
  }

  update(dt: number) {
    this.fallback.update(dt);
    if (this.oneShot > 0) this.oneShot -= dt;
    this.mixer?.update(dt);
  }
}
