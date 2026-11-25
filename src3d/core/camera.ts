// Third-person camera: a little behind and above Carbon, 360° yaw, clamped pitch,
// smooth follow, and a simple collision so it never goes into the ground, cliffs or rocks.
import * as THREE from 'three';
import type { ColliderWorld } from '../world/colliders';

export class ThirdPersonCamera {
  yaw = 0; // camera south of Carbon, looking north (-z)
  pitch = 0.32;
  distance = 6.2;
  minPitch = -0.45;
  maxPitch = 1.15;
  private target = new THREE.Vector3();
  private current = new THREE.Vector3();
  private curDist = 6.2;
  private first = true;

  constructor(public cam: THREE.PerspectiveCamera, private colliders: ColliderWorld) {}

  addLook(dx: number, dy: number) {
    this.yaw += dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, this.minPitch, this.maxPitch);
  }

  /** Unit vectors on the ground plane: where "forward" and "right" point for the player. */
  basis() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { forward: f, right: r };
  }

  update(dt: number, focus: THREE.Vector3) {
    this.target.copy(focus).add(new THREE.Vector3(0, 1.45, 0));
    if (this.first) { this.current.copy(this.target); this.first = false; }
    // smooth follow (frame-rate independent)
    const k = 1 - Math.exp(-dt * 10);
    this.current.lerp(this.target, k);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const desired = this.current.clone().addScaledVector(dir, this.distance);
    // collision: shorten instantly when blocked, come back out slowly
    const free = this.colliders.sweep(this.current.x, this.current.y, this.current.z, desired.x, desired.y, desired.z, 0.35);
    const want = Math.max(1.2, this.distance * free);
    this.curDist = want < this.curDist ? want : this.curDist + (want - this.curDist) * (1 - Math.exp(-dt * 3));
    this.cam.position.copy(this.current).addScaledVector(dir, this.curDist);
    this.cam.lookAt(this.current);
  }
}
