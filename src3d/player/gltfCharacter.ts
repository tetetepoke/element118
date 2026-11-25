// Drop-in replacement for the placeholder once the official Carbon GLB exists.
//   const carbon = await GltfCharacter.load('/element118/models/carbon.glb', CARBON_CLIPS);
//   player.setVisual(carbon);
// Clip names in the GLB are mapped to the controller's states below; missing clips fall back to Idle.
// Forms (e.g. SiC FORM) are child nodes named "form_<variant>" toggled by setForm().
import * as THREE from 'three';
import type { CharacterVisual, MoveState } from './visual';

export type ClipMap = Partial<Record<MoveState | 'hard_break' | 'bond', string>>;

export const CARBON_CLIPS: ClipMap = {
  Idle: 'Idle', Walk: 'Walk', Run: 'Run', Jump: 'Jump', Fall: 'Fall', Land: 'Land', Climb: 'Climb', Swim: 'Swim',
  hard_break: 'HardBreak', bond: 'Bond',
};

export class GltfCharacter implements CharacterVisual {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private oneShot = false;

  private constructor(scene: THREE.Object3D, clips: THREE.AnimationClip[], private map: ClipMap) {
    this.root = scene;
    this.mixer = new THREE.AnimationMixer(scene);
    for (const c of clips) this.actions.set(c.name, this.mixer.clipAction(c));
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.mixer.addEventListener('finished', () => { this.oneShot = false; });
  }

  /** Loads with a dynamic import so the loader is only downloaded when a GLB is actually used. */
  static async load(url: string, map: ClipMap = CARBON_CLIPS, scale = 1) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.scale.setScalar(scale);
    return new GltfCharacter(gltf.scene, gltf.animations, map);
  }

  private fadeTo(name: string | undefined, loop = true) {
    const a = name ? this.actions.get(name) : undefined;
    if (!a || a === this.current) return;
    a.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.play();
    if (this.current) this.current.crossFadeTo(a, 0.18, false);
    this.current = a;
  }

  setState(state: MoveState, speed01: number) {
    if (this.oneShot) return;
    this.fadeTo(this.map[state] ?? this.map.Idle);
    if (this.current) this.current.timeScale = state === 'Walk' || state === 'Run' ? 0.8 + speed01 * 0.4 : 1;
  }

  setForm(variant: string) {
    this.root.traverse((o) => {
      if (o.name.startsWith('form_')) o.visible = o.name === `form_${variant}`;
    });
  }

  playAction(name: string) {
    const clip = this.map[name as keyof ClipMap];
    const a = clip ? this.actions.get(clip) : undefined;
    if (!a) return 0.5;
    this.oneShot = true;
    this.fadeTo(clip, false);
    return a.getClip().duration;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }
}
