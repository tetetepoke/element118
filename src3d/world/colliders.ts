// Simple solid shapes standing on the terrain: vertical cylinders (trees, rocks, pillars) and
// boxes rotated around Y (walls, steps, platforms). The player can stand on their tops,
// step onto low ones, climb (mantle) onto mid-height ones, and is pushed out of the sides.
import { ground } from './ground';
const heightAt = (x: number, z: number) => ground().heightAt(x, z);

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
}

export class ColliderWorld {
  list: Collider[] = [];

  add(c: Omit<Collider, 'enabled'> & { enabled?: boolean }) {
    const full = { enabled: true, ...c } as Collider;
    this.list.push(full);
    return full;
  }

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
   * Terrain counts too.
   */
  groundAt(x: number, z: number, feetY: number, reach = 0.5, pad = 0) {
    let g = heightAt(x, z);
    for (const c of this.list) {
      if (!c.enabled || c.top > feetY + reach || c.top <= g) continue;
      if (this.contains(c, x, z, pad)) g = c.top;
    }
    return g;
  }

  /** Highest top under (x, z), ignoring reach (used for climbing / mantling). */
  topAt(x: number, z: number, pad = 0) {
    let g = heightAt(x, z);
    for (const c of this.list) if (c.enabled && c.top > g && this.contains(c, x, z, pad)) g = c.top;
    return g;
  }

  /** Push a circle of radius `rad` at feet height `feetY` (body height `h`) out of every side it overlaps. */
  pushOut(pos: { x: number; z: number }, feetY: number, rad: number, h: number, step: number) {
    let hit = false;
    for (const c of this.list) {
      if (!c.enabled) continue;
      if (feetY + step >= c.top || feetY + h <= c.bottom) continue; // standing on it / stepping up / passing under
      if (c.kind === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), min = (c.r ?? 0) + rad;
        if (d < min && d > 1e-6) {
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
          hit = true;
        }
      } else {
        const rot = c.rot ?? 0;
        const { lx, lz } = this.local(c, pos.x, pos.z);
        const hx = c.hx ?? 0, hz = c.hz ?? 0;
        const cx = Math.max(-hx, Math.min(hx, lx)), cz = Math.max(-hz, Math.min(hz, lz));
        let ddx = lx - cx, ddz = lz - cz;
        let d = Math.hypot(ddx, ddz);
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
        pos.x = c.x + nlx * co - nlz * s;
        pos.z = c.z + nlx * s + nlz * co;
        hit = true;
        void d;
      }
    }
    return hit;
  }

  /** Does the segment pass through a solid (for the camera)? Returns the free fraction 0..1. */
  sweep(ax: number, ay: number, az: number, bx: number, by: number, bz: number, margin: number) {
    const steps = 24;
    // only colliders near the ray are tested
    const minX = Math.min(ax, bx) - margin, maxX = Math.max(ax, bx) + margin, minZ = Math.min(az, bz) - margin, maxZ = Math.max(az, bz) + margin;
    const near = this.list.filter((c) => {
      if (!c.enabled || c.cameraIgnore) return false;
      const e = c.kind === 'cyl' ? c.r ?? 0 : Math.hypot(c.hx ?? 0, c.hz ?? 0);
      return c.x + e >= minX && c.x - e <= maxX && c.z + e >= minZ && c.z - e <= maxZ;
    });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      if (y < heightAt(x, z) + margin) return (i - 1) / steps;
      for (const c of near) {
        if (!c.enabled || c.cameraIgnore) continue;
        if (y > c.top + margin || y < c.bottom) continue;
        if (this.contains(c, x, z, margin)) return (i - 1) / steps;
      }
    }
    return 1;
  }
}
