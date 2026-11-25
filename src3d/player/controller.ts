// Player control, independent of how Carbon looks. States: Idle, Walk, Run, Jump, Fall, Land, Climb, Swim.
// Ground is checked every frame against the terrain function and the colliders' tops.
// No air jumps. Slopes up to ~50° are walkable; low steps are stepped onto; ledges up to 2.3 m are climbed.
import * as THREE from 'three';
import type { InputState } from '../core/input';
import type { ColliderWorld } from '../world/colliders';
import { heightAt, WATER_Y, PLACES, HALF } from '../world/terrain';
import type { CharacterVisual, MoveState } from './visual';

export const TUNING = {
  walk: 4.2,
  run: 8.0,
  swim: 2.4,
  accelGround: 28,
  accelAir: 7,
  gravity: -26,
  jump: 8.6,
  coyote: 0.12,
  jumpBuffer: 0.12,
  radius: 0.34,
  height: 1.7,
  step: 0.45,
  maxSlope: 1.2, // rise per metre (≈50°)
  ledgeMax: 2.3, // highest ledge that can be climbed from the ground (with Jump)
  airLedgeMax: 1.5,
  pondRadius: 17,
};

export class PlayerController {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  facing = Math.PI; // radians (model faces +z at 0) — start looking north, back to the camera
  state: MoveState = 'Idle';
  onGround = true;
  locked = false; // cut-scenes / BOND
  speedMul = 1;
  private coyote = 0;
  private jumpBuf = 0;
  private landT = 0;
  private climb: { t: number; len: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  private lastAir = 0;

  constructor(public visual: CharacterVisual, private colliders: ColliderWorld) {
    this.pos.set(PLACES.spawn.x, heightAt(PLACES.spawn.x, PLACES.spawn.y), PLACES.spawn.y);
  }

  /** Swap the model (e.g. the official GLB) without touching control. */
  setVisual(v: CharacterVisual) {
    const parent = this.visual.root.parent;
    parent?.remove(this.visual.root);
    this.visual = v;
    parent?.add(v.root);
  }

  teleport(x: number, z: number, y?: number) {
    this.pos.set(x, y ?? this.colliders.topAt(x, z), z);
    this.vel.set(0, 0, 0);
    this.climb = null;
    this.onGround = true;
  }

  private waterDepthAt(x: number, z: number) {
    if (Math.hypot(x - PLACES.pond.x, z - PLACES.pond.y) > TUNING.pondRadius) return 0;
    return WATER_Y - heightAt(x, z);
  }

  get swimming() {
    return this.state === 'Swim';
  }

  update(dt: number, inp: InputState, forward: THREE.Vector3, right: THREE.Vector3) {
    dt = Math.min(dt, 1 / 20);
    const T = TUNING;
    if (inp.jump) this.jumpBuf = T.jumpBuffer;
    this.jumpBuf -= dt;

    // ── climbing (mantle) in progress ──
    if (this.climb) {
      const c = this.climb;
      c.t += dt;
      const p = Math.min(1, c.t / c.len);
      // up first, then over the edge
      const up = Math.min(1, p / 0.65), over = Math.max(0, (p - 0.45) / 0.55);
      this.pos.set(
        c.from.x + (c.to.x - c.from.x) * over,
        c.from.y + (c.to.y - c.from.y) * (1 - (1 - up) * (1 - up)),
        c.from.z + (c.to.z - c.from.z) * over,
      );
      this.setState('Climb', 0);
      if (p >= 1) { this.climb = null; this.onGround = true; this.vel.set(0, 0, 0); }
      this.visual.root.position.copy(this.pos);
      return;
    }

    // ── desired horizontal velocity (camera relative) ──
    const mx = this.locked ? 0 : inp.moveX, my = this.locked ? 0 : inp.moveY;
    const wish = new THREE.Vector3().addScaledVector(forward, my).addScaledVector(right, mx);
    const mag = Math.min(1, wish.length());
    if (mag > 1e-3) wish.normalize();
    const depth = this.waterDepthAt(this.pos.x, this.pos.z);
    const swim = depth > 1.1 && this.pos.y < WATER_Y - 0.6;
    let top = (inp.run ? T.run : T.walk) * this.speedMul;
    if (swim) top = T.swim;
    else if (depth > 0.35 && this.onGround) top *= 0.7;
    const target = wish.clone().multiplyScalar(top * mag);
    const accel = this.onGround || swim ? T.accelGround : T.accelAir;
    const k = 1 - Math.exp(-accel * dt / Math.max(top, 1));
    this.vel.x += (target.x - this.vel.x) * Math.min(1, k * 3);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, k * 3);

    // ── jump / ledge grab ──
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (!this.locked && this.jumpBuf > 0 && (this.onGround || this.coyote > 0) && !swim) {
      this.jumpBuf = 0;
      if (mag > 0.2 && this.tryLedge(fwd, T.ledgeMax)) return;
      this.vel.y = T.jump;
      this.onGround = false;
      this.coyote = 0;
    }
    if (!this.onGround && !swim && !this.locked && mag > 0.3 && this.vel.y < 3) {
      if (this.tryLedge(fwd, T.airLedgeMax)) return;
    }

    // ── horizontal move with slope / wall checks ──
    const stepX = this.vel.x * dt, stepZ = this.vel.z * dt;
    const tryMove = (dx: number, dz: number) => {
      const nx = this.pos.x + dx, nz = this.pos.z + dz;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return true;
      const g = this.colliders.groundAt(nx, nz, this.pos.y, T.step);
      const rise = g - this.pos.y;
      const terrNew = heightAt(nx, nz);
      const onTerrain = g <= terrNew + 1e-3;
      if (onTerrain) {
        // terrain: judge by the slope itself, so tiny steps can't creep up a cliff
        const slope = (terrNew - heightAt(this.pos.x, this.pos.z)) / len;
        if (slope > T.maxSlope && terrNew > this.pos.y - 0.05) return false;
      } else if (this.onGround && rise > T.step) return false; // colliders: low steps only (higher = climb)
      if (!this.onGround && rise > 0.3) return false;
      this.pos.x = nx;
      this.pos.z = nz;
      return true;
    };
    if (!tryMove(stepX, stepZ)) {
      // slide along: try each axis on its own
      if (!tryMove(stepX, 0)) this.vel.x = 0;
      if (!tryMove(0, stepZ)) this.vel.z = 0;
    }
    const p2 = { x: this.pos.x, z: this.pos.z };
    this.colliders.pushOut(p2, this.pos.y, T.radius, T.height, T.step);
    this.pos.x = THREE.MathUtils.clamp(p2.x, -HALF + 4, HALF - 4);
    this.pos.z = THREE.MathUtils.clamp(p2.z, -HALF + 4, HALF - 4);

    // ── vertical ──
    const ground = this.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y, T.step);
    if (swim) {
      this.vel.y = 0;
      this.pos.y += (WATER_Y - 0.95 - this.pos.y) * (1 - Math.exp(-dt * 6));
      if (this.pos.y < ground) this.pos.y = ground;
      this.onGround = false;
      this.coyote = 0;
    } else if (this.onGround) {
      if (ground < this.pos.y - 0.7) {
        // walked off a ledge
        this.onGround = false;
        this.coyote = T.coyote;
        this.lastAir = 0;
      } else {
        this.pos.y = ground; // follow slopes and steps (up and down)
        this.vel.y = 0;
      }
    } else {
      this.coyote -= dt;
      this.lastAir += dt;
      this.vel.y += T.gravity * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground) {
        const hard = this.vel.y < -9;
        this.pos.y = ground;
        this.vel.y = 0;
        this.onGround = true;
        if (hard && this.lastAir > 0.25) this.landT = 0.16;
      }
    }

    // ── facing & state ──
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.4) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 14));
    }
    this.landT -= dt;
    let st: MoveState;
    if (swim) st = 'Swim';
    else if (!this.onGround) st = this.vel.y > 0 ? 'Jump' : 'Fall';
    else if (this.landT > 0) st = 'Land';
    else if (hs < 0.35) st = 'Idle';
    else st = hs > (T.walk + T.run) / 2 ? 'Run' : 'Walk';
    this.setState(st, Math.min(1, hs / T.run));
    this.visual.root.position.copy(this.pos);
    this.visual.root.rotation.y = this.facing;
  }

  /** Climb onto a ledge in front if it is within reach, flat on top and has room to stand. */
  private tryLedge(fwd: THREE.Vector3, maxRise: number) {
    const T = TUNING;
    for (const dist of [0.55, 0.85]) {
      const ax = this.pos.x + fwd.x * dist, az = this.pos.z + fwd.z * dist;
      const top = this.colliders.topAt(ax, az);
      const rise = top - this.pos.y;
      if (rise <= T.step || rise > maxRise) continue;
      // flat on top: sample a little further and to the sides
      const bx = this.pos.x + fwd.x * (dist + 0.5), bz = this.pos.z + fwd.z * (dist + 0.5);
      const top2 = this.colliders.topAt(bx, bz);
      if (Math.abs(top2 - top) > 0.4) continue;
      const to = new THREE.Vector3(bx, top2, bz);
      this.climb = { t: 0, len: 0.32 + rise * 0.18, from: this.pos.clone(), to };
      this.vel.set(0, 0, 0);
      return true;
    }
    return false;
  }

  private setState(s: MoveState, speed: number) {
    this.state = s;
    this.visual.setState(s, speed);
  }
}
