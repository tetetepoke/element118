// Player control, independent of how Carbon looks.
// States: Idle, Walk, Run, Jump, Fall, Land (+ Climb, Swim). Jumps go through phases the visual can show:
// takeoff (short crouch) → rise → apex (lighter gravity, a little hang) → fall (heavier) → land (impact).
// Speed builds up and slows down (no instant top speed); turning is smooth and sharp reversals skid.
import * as THREE from 'three';
import type { InputState } from '../core/input';
import type { ColliderWorld } from '../world/colliders';
import { ground as getGround } from '../world/ground';
const heightAt = (x: number, z: number) => getGround().heightAt(x, z);
import type { CharacterVisual, MoveState, MoveInfo } from './visual';

export const TUNING = {
  walk: 3.9,
  run: 7.6,
  swim: 2.4,
  accel: 13, // m/s² on the ground
  runAccel: 16,
  decel: 20,
  airAccel: 5,
  turnRate: 11, // rad/s on the ground
  airTurnRate: 3.5,
  gravityUp: 24,
  gravityApex: 13, // |vy| < apexBand: hang a little at the top
  gravityDown: 34,
  apexBand: 1.6,
  terminal: -28,
  jump: 8.4,
  takeoff: 0.07, // s of crouch before leaving the ground
  coyote: 0.12,
  jumpBuffer: 0.14,
  radius: 0.34,
  height: 1.7,
  step: 0.45,
  maxSlope: 1.2, // rise per metre (≈50°)
  ledgeMax: 2.3,
  airLedgeMax: 1.5,
};

export class PlayerController {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  facing = Math.PI; // radians (model faces +z at 0) — start looking north, back to the camera
  state: MoveState = 'Idle';
  info: MoveInfo = { phase: 'none', impact: 0, turn: 0 };
  onGround = true;
  locked = false;
  speedMul = 1;
  private speed = 0; // horizontal speed (m/s)
  private moveYaw = Math.PI; // direction of horizontal travel
  private coyote = 0;
  private jumpBuf = 0;
  private takeoffT = 0;
  private landT = 0;
  private landLen = 0.15;
  private climb: { t: number; len: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  private airTime = 0;
  private minFallVy = 0;

  constructor(public visual: CharacterVisual, private colliders: ColliderWorld) {
    const sp = getGround().spawn;
    this.pos.set(sp.x, heightAt(sp.x, sp.z), sp.z);
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
    this.speed = 0;
    this.climb = null;
    this.takeoffT = 0;
    this.onGround = true;
  }

  get moving() {
    return this.speed > 0.5;
  }

  get horizontalSpeed() {
    return this.speed;
  }

  /** water surface under the player (updated each step) */
  private waterY = -Infinity;
  private waterDepthAt(x: number, z: number) {
    const w = getGround().waterAt(x, z);
    this.waterY = w ?? -Infinity;
    if (w === null) return 0;
    return w - heightAt(x, z);
  }

  update(dt: number, inp: InputState, forward: THREE.Vector3, right: THREE.Vector3) {
    dt = Math.min(dt, 1 / 20);
    const T = TUNING;
    if (inp.jump) this.jumpBuf = T.jumpBuffer;
    this.jumpBuf -= dt;

    // ── climbing a ledge ──
    if (this.climb) {
      const c = this.climb;
      c.t += dt;
      const p = Math.min(1, c.t / c.len);
      const up = Math.min(1, p / 0.65), over = Math.max(0, (p - 0.45) / 0.55);
      this.pos.set(
        c.from.x + (c.to.x - c.from.x) * over,
        c.from.y + (c.to.y - c.from.y) * (1 - (1 - up) * (1 - up)),
        c.from.z + (c.to.z - c.from.z) * over,
      );
      this.info = { phase: 'none', impact: 0, turn: 0 };
      this.setState('Climb', 0);
      if (p >= 1) { this.climb = null; this.onGround = true; this.vel.set(0, 0, 0); this.speed = 0; }
      this.applyVisual();
      return;
    }

    // ── what the stick asks for (camera relative) ──
    const mx = this.locked ? 0 : inp.moveX, my = this.locked ? 0 : inp.moveY;
    const wish = new THREE.Vector3().addScaledVector(forward, my).addScaledVector(right, mx);
    const mag = Math.min(1, wish.length());
    const depth = this.waterDepthAt(this.pos.x, this.pos.z);
    const swim = depth > 1.1 && this.pos.y < this.waterY - 0.6;
    let top = (inp.run ? T.run : T.walk) * this.speedMul;
    if (swim) top = T.swim;
    else if (depth > 0.35 && this.onGround) top *= 0.7;
    if (this.landT > 0 && this.info.impact > 0.5) top *= 0.45; // heavy landing slows you for a moment
    const grounded = this.onGround || swim;

    // ── turning: travel direction rotates toward the stick; a sharp reversal skids first ──
    let turn = 0;
    if (mag > 0.05) {
      const wishYaw = Math.atan2(wish.x, wish.z);
      let d = wishYaw - this.moveYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (this.speed < 0.6) this.moveYaw = wishYaw; // from standing: go where the stick points (the model still turns smoothly)
      else {
        const rate = grounded ? T.turnRate : T.airTurnRate;
        this.moveYaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
        turn = d;
        if (grounded && Math.abs(d) > 2.3) this.speed = Math.max(0, this.speed - T.decel * 1.6 * dt); // skid
      }
    }
    // ── speed: accelerate / decelerate, never instantly ──
    const targetSpeed = top * mag;
    if (grounded) {
      if (this.speed < targetSpeed) this.speed = Math.min(targetSpeed, this.speed + (inp.run ? T.runAccel : T.accel) * dt);
      else this.speed = Math.max(targetSpeed, this.speed - T.decel * dt);
    } else if (this.speed < targetSpeed) this.speed = Math.min(targetSpeed, this.speed + T.airAccel * dt);
    this.vel.x = Math.sin(this.moveYaw) * this.speed;
    this.vel.z = Math.cos(this.moveYaw) * this.speed;

    // ── jump: buffered press → short takeoff crouch → launch; or climb a ledge in front ──
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (!this.locked && this.jumpBuf > 0 && (this.onGround || this.coyote > 0) && !swim && this.takeoffT <= 0) {
      this.jumpBuf = 0;
      if (mag > 0.2 && this.tryLedge(fwd, T.ledgeMax)) return;
      this.takeoffT = this.onGround ? T.takeoff : 0.001;
    }
    if (this.takeoffT > 0) {
      this.takeoffT -= dt;
      if (this.takeoffT <= 0) {
        this.vel.y = T.jump;
        this.onGround = false;
        this.coyote = 0;
        this.airTime = 0;
        this.minFallVy = 0;
      }
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
      if (g <= terrNew + 1e-3) {
        const slope = (terrNew - heightAt(this.pos.x, this.pos.z)) / len;
        if (slope > T.maxSlope && terrNew > this.pos.y - 0.05) return false;
      } else if (this.onGround && rise > T.step) return false;
      if (!this.onGround && rise > 0.3) return false;
      this.pos.x = nx;
      this.pos.z = nz;
      return true;
    };
    if (!tryMove(stepX, stepZ)) {
      const okX = tryMove(stepX, 0), okZ = tryMove(0, stepZ);
      if (!okX && !okZ) this.speed *= 0.5; // walked into a wall
    }
    const p2 = { x: this.pos.x, z: this.pos.z };
    this.colliders.pushOut(p2, this.pos.y, T.radius, T.height, T.step);
    const half = getGround().half;
    this.pos.x = THREE.MathUtils.clamp(p2.x, -half + 4, half - 4);
    this.pos.z = THREE.MathUtils.clamp(p2.z, -half + 4, half - 4);

    // ── vertical ──
    const ground = this.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y, T.step);
    if (swim) {
      this.vel.y = 0;
      this.pos.y += (this.waterY - 0.95 - this.pos.y) * (1 - Math.exp(-dt * 6));
      if (this.pos.y < ground) this.pos.y = ground;
      this.onGround = false;
      this.coyote = 0;
    } else if (this.onGround) {
      if (ground < this.pos.y - 0.7) {
        this.onGround = false; // walked off a ledge
        this.coyote = T.coyote;
        this.airTime = 0;
        this.minFallVy = 0;
      } else {
        this.pos.y = ground;
        this.vel.y = 0;
      }
    } else {
      this.coyote -= dt;
      this.airTime += dt;
      const g = this.vel.y > T.apexBand ? T.gravityUp : this.vel.y > -T.apexBand ? T.gravityApex : T.gravityDown;
      this.vel.y = Math.max(T.terminal, this.vel.y - g * dt);
      this.minFallVy = Math.min(this.minFallVy, this.vel.y);
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        const impact = THREE.MathUtils.clamp((-this.minFallVy - 4) / 14, 0, 1);
        this.vel.y = 0;
        this.onGround = true;
        if (this.airTime > 0.18) {
          this.landLen = 0.1 + impact * 0.22;
          this.landT = this.landLen;
          this.info.impact = impact;
        }
      }
    }

    // ── model facing follows the travel direction smoothly ──
    if (this.speed > 0.15 || mag > 0.05) {
      let d = this.moveYaw - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * (grounded ? 13 : 6)));
    }

    // ── state + phase for the visual ──
    this.landT -= dt;
    let st: MoveState;
    let phase: MoveInfo['phase'] = 'none';
    if (swim) st = 'Swim';
    else if (this.takeoffT > 0) { st = 'Jump'; phase = 'takeoff'; }
    else if (!this.onGround) {
      if (this.vel.y > T.apexBand) { st = 'Jump'; phase = 'rise'; }
      else if (this.vel.y > -T.apexBand) { st = this.vel.y >= 0 ? 'Jump' : 'Fall'; phase = 'apex'; }
      else { st = 'Fall'; phase = 'fall'; }
    } else if (this.landT > 0) { st = 'Land'; phase = 'land'; }
    else if (this.speed < 0.3) st = 'Idle';
    else st = this.speed > (T.walk + T.run) / 2 ? 'Run' : 'Walk';
    this.info = { phase, impact: st === 'Land' ? this.info.impact : 0, turn };
    this.setState(st, Math.min(1, this.speed / T.run));
    this.applyVisual();
  }

  private applyVisual() {
    this.visual.root.position.copy(this.pos);
    this.visual.root.rotation.y = this.facing;
  }

  /** Climb onto a ledge in front if it is within reach and flat on top. */
  private tryLedge(fwd: THREE.Vector3, maxRise: number) {
    const T = TUNING;
    for (const dist of [0.55, 0.85]) {
      const ax = this.pos.x + fwd.x * dist, az = this.pos.z + fwd.z * dist;
      const top = this.colliders.topAt(ax, az);
      const rise = top - this.pos.y;
      if (rise <= T.step || rise > maxRise) continue;
      const bx = this.pos.x + fwd.x * (dist + 0.5), bz = this.pos.z + fwd.z * (dist + 0.5);
      const top2 = this.colliders.topAt(bx, bz);
      if (Math.abs(top2 - top) > 0.4) continue;
      this.climb = { t: 0, len: 0.32 + rise * 0.18, from: this.pos.clone(), to: new THREE.Vector3(bx, top2, bz) };
      this.vel.set(0, 0, 0);
      this.takeoffT = 0;
      return true;
    }
    return false;
  }

  private setState(s: MoveState, speed: number) {
    this.state = s;
    this.visual.setState(s, speed, this.info);
  }
}
