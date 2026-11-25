// Third-person camera. Close behind Carbon with him in the lower part of the screen, so the wide world
// opens up beyond him. 360° yaw, clamped pitch, smooth follow, gentle auto-follow behind while moving,
// and a collision test so it never goes into the ground, cliffs, rocks or ruins.
import * as THREE from 'three';
import type { ColliderWorld } from '../world/colliders';

export const CAMERA_TUNING = {
  distance: 4.4,
  minDistance: 0.9,
  pivotHeight: 1.35, // orbit point above the feet
  lookAbove: 0.85, // aim above the head → Carbon sits low in the frame
  lookAhead: 1.6, // aim a little ahead → more world, less ground
  pitch: 0.2,
  minPitch: -0.5,
  maxPitch: 1.2,
  followXZ: 10,
  followY: 5, // softer vertically: jumps don't jerk the view
  autoFollow: 0.9, // rad/s toward Carbon's back while moving and the camera is left alone
};

export class ThirdPersonCamera {
  yaw = 0; // camera south of Carbon, looking north (-z)
  pitch = CAMERA_TUNING.pitch;
  private yawTarget = 0;
  private pitchTarget = CAMERA_TUNING.pitch;
  private pivot = new THREE.Vector3();
  private curDist = CAMERA_TUNING.distance;
  private first = true;
  private idleLook = 0;

  constructor(public cam: THREE.PerspectiveCamera, private colliders: ColliderWorld) {}

  addLook(dx: number, dy: number) {
    if (dx || dy) this.idleLook = 0;
    this.yawTarget += dx;
    this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget - dy, CAMERA_TUNING.minPitch, CAMERA_TUNING.maxPitch);
  }

  /** Set the view directly (tests, cut-scenes). */
  setView(yaw: number, pitch = this.pitchTarget) {
    this.yaw = this.yawTarget = yaw;
    this.pitch = this.pitchTarget = pitch;
  }

  /** Ground-plane unit vectors: where "forward" and "right" point for the player (camera relative). */
  basis() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { forward: f, right: r };
  }

  update(dt: number, focus: THREE.Vector3, moving = false, facing = 0) {
    const C = CAMERA_TUNING;
    this.idleLook += dt;
    // gently swing behind Carbon when walking and the player is not steering the camera
    if (moving && this.idleLook > 1.4) {
      const behindYaw = facing + Math.PI; // camera yaw that looks along Carbon's facing
      let d = behindYaw - this.yawTarget;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) this.yawTarget += Math.sign(d) * Math.min(Math.abs(d), C.autoFollow * dt);
    }
    this.yaw += (this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 18));
    this.pitch += (this.pitchTarget - this.pitch) * (1 - Math.exp(-dt * 18));

    const target = focus.clone();
    target.y += C.pivotHeight;
    if (this.first) { this.pivot.copy(target); this.first = false; }
    const kxz = 1 - Math.exp(-dt * C.followXZ), ky = 1 - Math.exp(-dt * C.followY);
    this.pivot.x += (target.x - this.pivot.x) * kxz;
    this.pivot.z += (target.z - this.pivot.z) * kxz;
    this.pivot.y += (target.y - this.pivot.y) * ky;

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const desired = this.pivot.clone().addScaledVector(dir, C.distance);
    // collision: pull in at once when blocked, ease back out
    const free = this.colliders.sweep(this.pivot.x, this.pivot.y, this.pivot.z, desired.x, desired.y, desired.z, 0.3);
    const want = Math.max(C.minDistance, C.distance * free);
    this.curDist = want < this.curDist ? want : this.curDist + (want - this.curDist) * (1 - Math.exp(-dt * 2.5));
    this.cam.position.copy(this.pivot).addScaledVector(dir, this.curDist);
    // aim above and slightly ahead of Carbon (less when the camera is pulled in close)
    const close = this.curDist / C.distance;
    const { forward } = this.basis();
    const look = this.pivot.clone();
    look.y += C.lookAbove * close;
    look.addScaledVector(forward, C.lookAhead * close);
    this.cam.lookAt(look);
  }
}
