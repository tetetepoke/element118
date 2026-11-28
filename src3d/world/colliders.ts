// Collision world shared by every 3D page.
//
// Collision shapes are kept apart from the drawn meshes: each solid is a simple shape standing on the
// terrain — a vertical cylinder (trees, rocks, pillars, roots, drums) or a box rotated around Y (walls,
// buildings, machines, furniture, platforms). The terrain itself (meadow heightmap or cave floor /
// ceiling) is the other solid. The player is a vertical capsule (radius + height).
//
// The player can stand on tops, step onto low ones, climb (mantle) onto mid-height ones, and is pushed
// out of the sides. Resolution runs a few passes so a push out of one solid cannot leave the body inside
// another (corners, narrow gaps), and steep terrain (cave walls, cliffs) blocks the whole body, not just
// its centre.
import type * as THREE from 'three';
import { ground } from './ground';
const heightAt = (x: number, z: number) => ground().heightAt(x, z);

/** what a solid is, for the debug view and for future tools */
export type ColliderLayer = 'obstacle' | 'terrain';

export interface Collider {
  id: string;
  kind: 'cyl' | 'box';
  x: number;
  z: number;
  /** cyl: radius; box: half sizes */
  r?: number;
  hx?: number;
  hz?: number;
  /** box rotation around Y (radians) */
  rot?: number;
  bottom: number;
  top: number;
  /** camera may pass through (e.g. thin foliage) */
  cameraIgnore?: boolean;
  enabled: boolean;
  /** material / obstacle tags, e.g. 'hard_rock' — used by abilities */
  tags?: string[];
  // ── common object info (all optional; defaults in brackets) ──
  layer?: ColliderLayer; // ['obstacle']
  /** the player walks through it (still a target for scans / abilities) [false] */
  passable?: boolean;
  /** the player may climb (mantle) onto its top [true] */
  climbable?: boolean;
  /** can be destroyed (BREAK etc.); when broken set enabled = false [false] */
  breakable?: boolean;
  /** moves or changes size at run time: always tested, never cached in the grid [false] */
  dynamic?: boolean;
  /** the drawn model this shape stands for (drawing and collision stay separate objects) */
  model?: THREE.Object3D;
}

export interface ResolveResult {
  /** touched something */
  hit: boolean;
  /** summed push direction (wall normal for sliding), not normalised */
  nx: number;
  nz: number;
  /** how deep the body is still inside something after resolving (m) */
  residual: number;
}

const CELL = 8;
/** terrain steeper than this (rise per metre, ≈79°; 90 % of cave walls are steeper than 7) is a wall for the body; gentler slopes are left to the
 *  walking rules (too steep to walk, but you can still hop up them) */
const WALL_GRADE = 5;
const key = (i: number, j: number) => i * 73856093 + j;

export class ColliderWorld {
  list: Collider[] = [];
  private grid = new Map<number, Collider[]>();
  private dyn: Collider[] = [];
  private dirty = true;
  private stamp = 0;
  private seen = new WeakMap<Collider, number>();

  add(c: Omit<Collider, 'enabled'> & { enabled?: boolean }) {
    const full = { enabled: true, ...c } as Collider;
    this.list.push(full);
    this.dirty = true;
    return full;
  }

  /** call after moving / resizing a non-dynamic collider */
  markMoved() { this.dirty = true; }

  private extent(c: Collider) {
    return c.kind === 'cyl' ? c.r ?? 0 : Math.hypot(c.hx ?? 0, c.hz ?? 0);
  }

  private rebuild() {
    this.grid.clear();
    this.dyn = [];
    for (const c of this.list) {
      if (c.dynamic) { this.dyn.push(c); continue; }
      const e = this.extent(c);
      const i0 = Math.floor((c.x - e) / CELL), i1 = Math.floor((c.x + e) / CELL);
      const j0 = Math.floor((c.z - e) / CELL), j1 = Math.floor((c.z + e) / CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        let cell = this.grid.get(k);
        if (!cell) this.grid.set(k, (cell = []));
        cell.push(c);
      }
    }
    this.dirty = false;
  }

  /** colliders whose footprint may touch the rectangle (broad phase) */
  near(minX: number, maxX: number, minZ: number, maxZ: number, out: Collider[] = []) {
    if (this.dirty) this.rebuild();
    out.length = 0;
    const s = ++this.stamp;
    const i0 = Math.floor(minX / CELL), i1 = Math.floor(maxX / CELL), j0 = Math.floor(minZ / CELL), j1 = Math.floor(maxZ / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const cell = this.grid.get(key(i, j));
      if (!cell) continue;
      for (const c of cell) if (this.seen.get(c) !== s) { this.seen.set(c, s); out.push(c); }
    }
    for (const c of this.dyn) out.push(c);
    return out;
  }

  private tmp: Collider[] = [];
  private around(x: number, z: number, r: number) {
    return this.near(x - r, x + r, z - r, z + r, this.tmp);
  }

  /** solid for the player right now */
  private solid(c: Collider) { return c.enabled && !c.passable; }

  /** Local box coordinates of a point. */
  private local(c: Collider, x: number, z: number) {
    const dx = x - c.x, dz = z - c.z;
    const s = Math.sin(-(c.rot ?? 0)), co = Math.cos(-(c.rot ?? 0));
    return { lx: dx * co - dz * s, lz: dx * s + dz * co };
  }

  /** Is (x, z) inside the footprint, grown by `pad`? */
  contains(c: Collider, x: number, z: number, pad = 0) {
    if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) <= (c.r ?? 0) + pad;
    const { lx, lz } = this.local(c, x, z);
    return Math.abs(lx) <= (c.hx ?? 0) + pad && Math.abs(lz) <= (c.hz ?? 0) + pad;
  }

  /**
   * Highest walkable surface under (x, z) that can be reached from `feetY` (tops above feetY + reach are ignored).
   * Terrain counts too. `pad` grows the footprints (the capsule's base is a disc, not a point).
   */
  groundAt(x: number, z: number, feetY: number, reach = 0.5, pad = 0) {
    let g = heightAt(x, z);
    for (const c of this.around(x, z, Math.max(pad, 0) + 0.01)) {
      if (!this.solid(c) || c.top > feetY + reach || c.top <= g) continue;
      if (this.contains(c, x, z, pad)) g = c.top;
    }
    return g;
  }

  /** Highest climbable top under (x, z), ignoring reach (used for climbing / mantling). */
  topAt(x: number, z: number, pad = 0) {
    let g = heightAt(x, z);
    for (const c of this.around(x, z, Math.max(pad, 0) + 0.01)) if (this.solid(c) && c.climbable !== false && c.top > g && this.contains(c, x, z, pad)) g = c.top;
    return g;
  }

  /** Lowest solid underside above the head (obstacles + the ground's ceiling), Infinity if none. */
  ceilingAt(x: number, z: number, feetY: number, h: number, pad = 0) {
    let c0 = Infinity;
    for (const c of this.around(x, z, Math.max(pad, 0) + 0.01)) {
      if (!this.solid(c) || c.bottom < feetY + h - 0.3 || c.bottom >= c0) continue;
      if (this.contains(c, x, z, pad)) c0 = c.bottom;
    }
    const gc = ground().ceilingAt?.(x, z);
    // only ceilings the body fits under count (a crawl space must not trap the player)
    if (gc !== undefined && gc - heightAt(x, z) >= h + 0.1) c0 = Math.min(c0, gc);
    return c0;
  }

  /** One pass of pushing a disc out of the solids' sides; returns how far it moved. */
  private pushObstacles(pos: { x: number; z: number }, feetY: number, rad: number, h: number, step: number, acc: { nx: number; nz: number }) {
    let moved = 0;
    for (const c of this.around(pos.x, pos.z, rad + 0.01)) {
      if (!this.solid(c)) continue;
      if (feetY + step >= c.top || feetY + h <= c.bottom) continue; // standing on it / stepping up / passing under
      let nx: number, nz: number;
      if (c.kind === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), min = (c.r ?? 0) + rad;
        if (d >= min) continue;
        if (d > 1e-6) { nx = c.x + (dx / d) * min; nz = c.z + (dz / d) * min; }
        else { nx = c.x + min; nz = c.z; }
      } else {
        const rot = c.rot ?? 0;
        const { lx, lz } = this.local(c, pos.x, pos.z);
        const hx = c.hx ?? 0, hz = c.hz ?? 0;
        const cx = Math.max(-hx, Math.min(hx, lx)), cz = Math.max(-hz, Math.min(hz, lz));
        let ddx = lx - cx, ddz = lz - cz;
        const d = Math.hypot(ddx, ddz);
        if (d >= rad) continue;
        let nlx: number, nlz: number;
        if (d < 1e-6) {
          // centre inside the box: push out through the nearest face
          const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx || 1) * (hx + rad); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz || 1) * (hz + rad); }
        } else {
          ddx /= d; ddz /= d;
          nlx = cx + ddx * rad;
          nlz = cz + ddz * rad;
        }
        const s = Math.sin(rot), co = Math.cos(rot);
        nx = c.x + nlx * co - nlz * s;
        nz = c.z + nlx * s + nlz * co;
      }
      acc.nx += nx - pos.x;
      acc.nz += nz - pos.z;
      moved = Math.max(moved, Math.hypot(nx - pos.x, nz - pos.z));
      pos.x = nx;
      pos.z = nz;
    }
    return moved;
  }

  /**
   * One pass of pushing a disc away from terrain that rises more than `step` above the feet
   * (cave walls, cliffs). The ring of the disc is sampled so the whole body stays out of the rock.
   */
  private pushTerrain(pos: { x: number; z: number }, feetY: number, rad: number, step: number, acc: { nx: number; nz: number }) {
    const lim = feetY + step, hc = heightAt(pos.x, pos.z);
    const wall = (x: number, z: number, d: number) => { const h = heightAt(x, z); return h > lim && (h - hc) / Math.max(d, 1e-3) > WALL_GRADE; };
    let px = 0, pz = 0, n = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      if (!wall(pos.x + dx * rad, pos.z + dz * rad, rad)) continue;
      // nearest blocked distance along this direction
      let d = rad;
      for (const f of [0.25, 0.5, 0.75]) if (wall(pos.x + dx * rad * f, pos.z + dz * rad * f, rad * f)) { d = rad * f; break; }
      const push = rad - d + 0.004;
      px -= dx * push;
      pz -= dz * push;
      n++;
    }
    if (!n) return 0;
    // opposite samples cancel (a narrow crack): then only the remaining side pushes
    const m = Math.min(Math.hypot(px, pz), rad) / Math.max(1e-6, Math.hypot(px, pz));
    const mx = px * m * 0.6, mz = pz * m * 0.6;
    pos.x += mx;
    pos.z += mz;
    acc.nx += mx;
    acc.nz += mz;
    return Math.hypot(mx, mz);
  }

  /** how deep a disc is inside something (0 = free) */
  penetration(x: number, z: number, feetY: number, rad: number, h: number, step: number, terrainStep = step) {
    let worst = 0;
    for (const c of this.around(x, z, rad + 0.01)) {
      if (!this.solid(c) || feetY + step >= c.top || feetY + h <= c.bottom) continue;
      let d: number;
      if (c.kind === 'cyl') d = (c.r ?? 0) + rad - Math.hypot(x - c.x, z - c.z);
      else {
        const { lx, lz } = this.local(c, x, z);
        const hx = c.hx ?? 0, hz = c.hz ?? 0;
        const ox = Math.abs(lx) - hx, oz = Math.abs(lz) - hz;
        const out = Math.hypot(Math.max(ox, 0), Math.max(oz, 0)), inside = Math.min(Math.max(ox, oz), 0);
        d = rad - (out + inside);
      }
      worst = Math.max(worst, d);
    }
    const lim = feetY + terrainStep, hc = heightAt(x, z);
    if (hc > lim + 0.3) worst = Math.max(worst, rad); // under the terrain
    else for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, h = heightAt(x + Math.sin(a) * rad * 0.7, z + Math.cos(a) * rad * 0.7);
      if (h > lim && (h - hc) / (rad * 0.7) > WALL_GRADE) { worst = Math.max(worst, rad * 0.3); break; }
    }
    return Math.max(0, worst);
  }

  /**
   * Push the player's capsule (disc of radius `rad`, feet at `feetY`, height `h`) out of every solid and
   * steep terrain. Several passes: a push out of one solid must not leave it inside another.
   */
  resolve(pos: { x: number; z: number }, feetY: number, rad: number, h: number, step: number, terrainStep = step, passes = 4): ResolveResult {
    const acc = { nx: 0, nz: 0 };
    let hit = false;
    for (let i = 0; i < passes; i++) {
      const a = this.pushObstacles(pos, feetY, rad, h, step, acc);
      const b = this.pushTerrain(pos, feetY, rad, terrainStep, acc);
      if (a > 0 || b > 0) hit = true;
      if (a < 1e-4 && b < 1e-4) break;
    }
    return { hit, nx: acc.nx, nz: acc.nz, residual: this.penetration(pos.x, pos.z, feetY, rad, h, step, terrainStep) };
  }

  /** Old single-call API (kept for callers outside the player): resolve without terrain. */
  pushOut(pos: { x: number; z: number }, feetY: number, rad: number, h: number, step: number) {
    const acc = { nx: 0, nz: 0 };
    let hit = false;
    for (let i = 0; i < 4; i++) { const m = this.pushObstacles(pos, feetY, rad, h, step, acc); if (m > 0) hit = true; else break; }
    return hit;
  }

  /** Does the segment pass through a solid (for the camera)? Returns the free fraction 0..1. */
  sweep(ax: number, ay: number, az: number, bx: number, by: number, bz: number, margin: number, solid = (c: Collider) => !c.cameraIgnore) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    // samples closer than the camera ball's radius, so nothing thinner than the ball slips between them
    const steps = Math.max(8, Math.min(64, Math.ceil(len / Math.max(0.08, margin * 0.6))));
    const near = this.near(Math.min(ax, bx) - margin, Math.max(ax, bx) + margin, Math.min(az, bz) - margin, Math.max(az, bz) + margin, []).filter((c) => c.enabled && solid(c));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      if (y < heightAt(x, z) + margin) return (i - 1) / steps;
      for (const c of near) {
        if (y > c.top + margin || y < c.bottom - margin) continue;
        if (this.contains(c, x, z, margin)) return (i - 1) / steps;
      }
    }
    return 1;
  }
}
