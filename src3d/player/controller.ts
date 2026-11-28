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
  height: 1.45, // capsule height: Carbon's visible height plus a little (he fits under what he looks like he fits under)
  step: 0.45,
  maxSlope: 1.2, // rise per metre (≈50°)
  ledgeMax: 2.3,
  airLedgeMax: 1.5,
  // ── collision (the body is a vertical capsule: radius × height) ──
  footPad: 0.14, // the base is a disc: tops this far around the centre still hold the player up
  subStep: 0.12, // longest move per collision step (m): fast moves are split, nothing thin is skipped
  stuckTime: 0.25, // still inside something this long → back to the last safe spot
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
  /** last position standing free on the ground (fallback if the body ever ends up inside something) */
  readonly lastSafe = new THREE.Vector3();
  private stuckT = 0;
  /** how deep the body was inside something after the last step (tests / debug view) */
  penetration = 0;
  /** times the safe-spot fallback fired (tests) */
  rescues = 0;

  constructor(public visual: CharacterVisual, private colliders: ColliderWorld) {
    const sp = getGround().spawn;
    this.pos.set(sp.x, heightAt(sp.x, sp.z), sp.z);
    this.unstick();
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
    this.unstick();
  }

  /**
   * If the body starts inside something (loaded save, warp, a door that closed on it), move it to the
   * nearest free spot around. Searches rings out to 3 m; stays put if nothing better is found.
   */
  unstick() {
    const T = TUNING, C = this.colliders;
    const free = (x: number, z: number, y: number) => C.penetration(x, z, y, T.radius, T.height, T.step) < 0.01;
    if (free(this.pos.x, this.pos.z, this.pos.y)) { this.lastSafe.copy(this.pos); return true; }
    for (let r = 0.25; r <= 3; r += 0.25) {
      const n = Math.max(8, Math.round(r * 10));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
        const y = C.groundAt(x, z, this.pos.y, T.step + 0.6, T.footPad);
        if (Math.abs(y - this.pos.y) > 1.2 || !free(x, z, y)) continue;
        this.pos.set(x, y, z);
        this.lastSafe.copy(this.pos);
        return true;
      }
    }
    return false;
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
      const up = Math.min(1, p / 0.65), over = Math.max(0, (p - 0.65) / 0.35);
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

    // ── horizontal move: the capsule moves in short sub-steps; after each one it is pushed out of
    //    solids and steep terrain (several passes), which also makes it slide along walls ──
    const stepX = this.vel.x * dt, stepZ = this.vel.z * dt;
    const pad = T.footPad;
    const sideStep = T.step;
    const tryMove = (dx: number, dz: number) => {
      const nx = this.pos.x + dx, nz = this.pos.z + dz;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return true;
      const g = this.colliders.groundAt(nx, nz, this.pos.y, T.step, pad);
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
    const ox = this.pos.x, oz = this.pos.z;
    const n = Math.max(1, Math.min(8, Math.ceil(Math.hypot(stepX, stepZ) / T.subStep)));
    const p2 = { x: 0, z: 0 };
    let blocked = 0, inside = 0;
    for (let i = 0; i < n; i++) {
      const fromX = this.pos.x, fromZ = this.pos.z;
      const sx = stepX / n, sz = stepZ / n;
      if (!tryMove(sx, sz)) {
        const okX = tryMove(sx, 0), okZ = tryMove(0, sz);
        if (!okX && !okZ) blocked++;
      }
      p2.x = this.pos.x; p2.z = this.pos.z;
      const r = this.colliders.resolve(p2, this.pos.y, T.radius, T.height, sideStep, sideStep);
      if (r.residual > 0.02) {
        const previous = this.colliders.penetration(fromX, fromZ, this.pos.y, T.radius, T.height, sideStep);
        if (previous < r.residual) {
          this.pos.x = fromX; this.pos.z = fromZ;
          inside = previous;
          blocked++;
          continue;
        }
      }
      this.pos.x = p2.x; this.pos.z = p2.z;
      inside = r.residual;
    }
    if (blocked === n && n > 0) this.speed *= 0.5; // walked into a slope wall
    else if (grounded && this.speed > 1) {
      // pushing head-on into a wall: slow to the speed actually made (min 1 m/s keeps a walk in place)
      const made = Math.hypot(this.pos.x - ox, this.pos.z - oz) / dt;
      if (made < this.speed * 0.3) this.speed = Math.max(1, this.speed - T.decel * 0.6 * dt);
    }
    const half = getGround().half;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -half + 4, half - 4);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -half + 4, half - 4);

    // ── vertical ──
    // in the air the whole base disc counts, so a body overlapping an edge lands on it instead of hanging in it
    const ground = this.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y, T.step, this.onGround ? pad : T.radius + 0.03);
    const prevY = this.pos.y;
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
      // head into a ceiling (an overhang, a cave roof): stop rising
      if (this.vel.y > 0) {
        const ceil = this.colliders.ceilingAt(this.pos.x, this.pos.z, prevY, T.height, -0.25);
        if (this.pos.y + T.height > ceil) { this.pos.y = Math.max(ground, ceil - T.height); this.vel.y = 0; }
      }
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        this.settleOnEdge(ground);
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

    // Landing, stepping down or rising can put the body alongside a solid that was clear at prevY.
    // Recheck at the final height before drawing the player or saving the position as safe.
    if (this.pos.y !== prevY || inside > 0.02) {
      inside = this.colliders.resolve(this.pos, this.pos.y, T.radius, T.height, sideStep, sideStep).residual;
    }
    this.penetration = inside;

    // ── safety net: remember where it was free; if the body stays inside something (or ends up under
    //    the terrain) put it back there ──
    if (this.onGround && !swim && inside < 0.02 && this.pos.y >= heightAt(this.pos.x, this.pos.z) - 0.05) this.lastSafe.copy(this.pos);
    this.stuckT = inside > 0.08 ? this.stuckT + dt : 0;
    if (this.stuckT > T.stuckTime || this.pos.y < heightAt(this.pos.x, this.pos.z) - 1.2) {
      this.pos.copy(this.lastSafe);
      this.vel.set(0, 0, 0);
      this.speed = 0;
      this.onGround = true;
      this.stuckT = 0;
      this.rescues++;
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
    else st = this.speed > (T.walk + T.run) * this.speedMul / 2 ? 'Run' : 'Walk';
    this.info = { phase, impact: st === 'Land' ? this.info.impact : 0, turn };
    this.setState(st, Math.min(1, this.speed / T.run));
    this.applyVisual();
  }

  private applyVisual() {
    this.visual.root.position.copy(this.pos);
    this.visual.root.rotation.y = this.facing;
  }

  /**
   * Landed with only the edge of the base disc on a top: step the centre in a little so the feet are
   * really on it (otherwise the next frame would drop off again).
   */
  private settleOnEdge(top: number) {
    const T = TUNING, C = this.colliders;
    if (C.groundAt(this.pos.x, this.pos.z, top, 0.05, T.footPad) >= top - 0.02) return;
    const d = T.radius + 0.03 - T.footPad + 0.02;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = this.pos.x + Math.sin(a) * d, z = this.pos.z + Math.cos(a) * d;
      if (C.groundAt(x, z, top, 0.05, T.footPad) >= top - 0.02 && C.penetration(x, z, top, T.radius, T.height, T.step) < 0.01) { this.pos.x = x; this.pos.z = z; return; }
    }
  }

  /** Climb onto a ledge in front if it is within reach and flat on top. */
  private tryLedge(fwd: THREE.Vector3, maxRise: number) {
    const T = TUNING, C = this.colliders;
    for (const dist of [0.55, 0.85]) {
      const ax = this.pos.x + fwd.x * dist, az = this.pos.z + fwd.z * dist;
      const top = C.topAt(ax, az);
      const rise = top - this.pos.y;
      if (rise <= T.step || rise > maxRise) continue;
      // A narrow step may only have room to land near its front edge.
      for (const extra of [0.5, 0.3, 0.15, 0]) {
        const bx = this.pos.x + fwd.x * (dist + extra), bz = this.pos.z + fwd.z * (dist + extra);
        const top2 = C.topAt(bx, bz);
        if (Math.abs(top2 - top) > 0.4 || !this.ledgePathClear(bx, top2, bz, dist + extra)) continue;
        this.climb = { t: 0, len: 0.32 + rise * 0.18, from: this.pos.clone(), to: new THREE.Vector3(bx, top2, bz) };
        this.vel.set(0, 0, 0);
        this.takeoffT = 0;
        return true;
      }
    }
    return false;
  }

  /** The mantle animation rises at the starting point and then moves across at the landing height. */
  private ledgePathClear(x: number, y: number, z: number, distance: number) {
    const T = TUNING, C = this.colliders;
    const from = this.pos;
    const terrain = getGround();
    const clear = (px: number, py: number, pz: number) => C.penetration(px, pz, py, T.radius, T.height, 0, T.step) < 0.02
      && py + T.height <= (terrain.ceilingAt?.(px, pz) ?? Infinity);
    const upSteps = Math.ceil((y - from.y) / T.subStep);
    for (let i = 1; i <= upSteps; i++) {
      if (!clear(from.x, THREE.MathUtils.lerp(from.y, y, i / upSteps), from.z)) return false;
    }
    const overSteps = Math.ceil(distance / T.subStep);
    for (let i = 1; i <= overSteps; i++) {
      if (!clear(THREE.MathUtils.lerp(from.x, x, i / overSteps), y, THREE.MathUtils.lerp(from.z, z, i / overSteps))) return false;
    }
    return true;
  }

  private setState(s: MoveState, speed: number) {
    this.state = s;
    this.visual.setState(s, speed, this.info);
  }
}
