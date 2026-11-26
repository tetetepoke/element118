// Third-person orbit camera around Carbon. The player turns it freely: 360° yaw, pitch between
// minPitch and maxPitch. Light smoothing only (it must feel like *you* moved it).
// Obstacles (terrain, walls, rocks, buildings, roots, cave ceilings) between Carbon and the camera pull
// it in at once; when the way is clear it eases back out to the normal distance.
import * as THREE from 'three';
import type { ColliderWorld } from '../world/colliders';

export const CAMERA_TUNING = {
  distance: 4.6,
  minDistance: 0.8,
  pivotHeight: 1.35, // orbit point above the feet
  lookAbove: 0.75, // aim a little above the head → Carbon sits low in the frame
  lookAhead: 0, // aim ahead of Carbon along the camera's forward (0 = pure orbit)
  pitch: 0.22,
  minPitch: -0.45, // never under the ground
  maxPitch: 1.25, // never straight overhead
  smooth: 26, // how fast the view follows your input (higher = snappier, still no jitter)
  followXZ: 12,
  followY: 6, // softer vertically: jumps don't jerk the view
  autoFollow: 0, // rad/s toward Carbon's back while moving (0 = off: the player owns the camera)
  radius: 0.32, // the camera is a small ball, not a point: it can't peek past wall edges
  returnSpeed: 2.2, // how fast it eases back out after an obstacle
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
  /** extra solid space the colliders don't know about (e.g. cave ceilings): true = inside rock */
  extraSolid: ((x: number, y: number, z: number) => boolean) | null = null;
  /** distance after obstacles (tests read it) */
  get distance() { return this.curDist; }

  constructor(public cam: THREE.PerspectiveCamera, private colliders: ColliderWorld) {}

  addLook(dx: number, dy: number) {
    if (dx || dy) this.idleLook = 0;
    this.yawTarget += dx;
    // dy > 0 = look up → camera goes lower
    this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget - dy, CAMERA_TUNING.minPitch, CAMERA_TUNING.maxPitch);
  }

  /** Set the view directly (tests, cut-scenes). */
  setView(yaw: number, pitch = this.pitchTarget) {
    this.yaw = this.yawTarget = yaw;
    this.pitch = this.pitchTarget = THREE.MathUtils.clamp(pitch, CAMERA_TUNING.minPitch, CAMERA_TUNING.maxPitch);
  }

  /** Ground-plane unit vectors for camera-relative movement ("up on the stick" = into the screen). */
  basis() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { forward: f, right: r };
  }

  /** how far (0..1) the camera can go from `from` toward `to` before something solid */
  private clearFraction(from: THREE.Vector3, to: THREE.Vector3) {
    const R = CAMERA_TUNING.radius;
    let f = this.colliders.sweep(from.x, from.y, from.z, to.x, to.y, to.z, R);
    if (this.extraSolid) {
      const n = 24;
      for (let i = 1; i <= n; i++) {
        const u = (i / n) * f;
        const x = from.x + (to.x - from.x) * u, y = from.y + (to.y - from.y) * u, z = from.z + (to.z - from.z) * u;
        if (this.extraSolid(x, y + R, z)) { f = Math.max(0, ((i - 1) / n) * f); break; }
      }
    }
    return f;
  }

  update(dt: number, focus: THREE.Vector3, moving = false, facing = 0) {
    const C = CAMERA_TUNING;
    this.idleLook += dt;
    if (C.autoFollow > 0 && moving && this.idleLook > 1.4) {
      let d = facing + Math.PI - this.yawTarget;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) this.yawTarget += Math.sign(d) * Math.min(Math.abs(d), C.autoFollow * dt);
    }
    const ks = 1 - Math.exp(-dt * C.smooth);
    this.yaw += (this.yawTarget - this.yaw) * ks;
    this.pitch += (this.pitchTarget - this.pitch) * ks;

    const target = focus.clone();
    target.y += C.pivotHeight;
    if (this.first) { this.pivot.copy(target); this.first = false; }
    const kxz = 1 - Math.exp(-dt * C.followXZ), ky = 1 - Math.exp(-dt * C.followY);
    this.pivot.x += (target.x - this.pivot.x) * kxz;
    this.pivot.z += (target.z - this.pivot.z) * kxz;
    this.pivot.y += (target.y - this.pivot.y) * ky;
    // keep the orbit point inside open space too (low tunnels)
    if (this.extraSolid?.(this.pivot.x, this.pivot.y + C.radius, this.pivot.z)) this.pivot.y = target.y;

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const desired = this.pivot.clone().addScaledVector(dir, C.distance);
    // the centre ray plus four rays toward the edges of the view, so a wall corner can't slip in
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.45);
    const up = new THREE.Vector3(0, 0.3, 0);
    let free = this.clearFraction(this.pivot, desired);
    for (const off of [side, side.clone().negate(), up, up.clone().negate()]) {
      free = Math.min(free, this.clearFraction(this.pivot, desired.clone().add(off)) + 0.08);
    }
    const want = Math.max(C.minDistance, C.distance * Math.min(1, free) - C.radius * 0.5);
    this.curDist = want < this.curDist ? want : this.curDist + (want - this.curDist) * (1 - Math.exp(-dt * C.returnSpeed));
    this.cam.position.copy(this.pivot).addScaledVector(dir, this.curDist);
    const close = this.curDist / C.distance;
    const look = this.pivot.clone();
    look.y += C.lookAbove * close;
    if (C.lookAhead) look.addScaledVector(this.basis().forward, C.lookAhead * close);
    this.cam.lookAt(look);
  }
}
