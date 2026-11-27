// Developer view of collision: draws what the collision system actually uses, on top of the scene.
//   player capsule: green · obstacles: red · terrain (floor, and cave ceiling): blue · camera: yellow
// Off by default; costs nothing while hidden. While shown, only things near the player are drawn and
// the line buffers are rebuilt a few times a second, so it stays usable on an iPhone.
import * as THREE from 'three';
import type { ColliderWorld, Collider } from './colliders';
import { ground } from './ground';

const COL = { player: 0x33ff66, obstacle: 0xff3344, terrain: 0x3388ff, camera: 0xffdd22 };
const RANGE = 26; // m around the player

function lines(color: number) {
  const g = new THREE.BufferGeometry();
  const m = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 });
  const l = new THREE.LineSegments(g, m);
  l.renderOrder = 999;
  l.frustumCulled = false;
  return l;
}
function setLines(l: THREE.LineSegments, pts: number[]) {
  l.geometry.dispose();
  l.geometry = new THREE.BufferGeometry();
  l.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

export interface DebugPlayer { pos: THREE.Vector3; radius: number; height: number }
export interface DebugCamera { pivot: THREE.Vector3; cam: THREE.Vector3; radius: number }

export class CollisionDebug {
  readonly group = new THREE.Group();
  private player = lines(COL.player);
  private obstacles = lines(COL.obstacle);
  private terrain = lines(COL.terrain);
  private camera = lines(COL.camera);
  private t = 0;
  private lastAt = new THREE.Vector3(1e9, 0, 0);
  private lastCount = -1;

  constructor(scene: THREE.Scene, private colliders: ColliderWorld) {
    this.group.add(this.player, this.obstacles, this.terrain, this.camera);
    this.group.visible = false;
    this.group.name = 'collisionDebug';
    scene.add(this.group);
  }

  get visible() { return this.group.visible; }
  set visible(v: boolean) {
    this.group.visible = v;
    this.lastAt.set(1e9, 0, 0); // rebuild on show
  }

  update(dt: number, p: DebugPlayer, c: DebugCamera) {
    if (!this.group.visible) return;
    // player capsule and camera ball: every frame (they move)
    const pl: number[] = [];
    this.capsule(pl, p.pos.x, p.pos.y, p.pos.z, p.radius, p.height);
    setLines(this.player, pl);
    const cm: number[] = [c.pivot.x, c.pivot.y, c.pivot.z, c.cam.x, c.cam.y, c.cam.z];
    this.sphere(cm, c.cam.x, c.cam.y, c.cam.z, c.radius);
    this.sphere(cm, c.pivot.x, c.pivot.y, c.pivot.z, 0.08);
    setLines(this.camera, cm);
    // obstacles and terrain: a few times a second, or when moved / something changed (BREAK, doors)
    this.t -= dt;
    const enabled = this.colliders.list.reduce((n, k) => n + (k.enabled ? 1 : 0), 0);
    if (this.t > 0 && this.lastAt.distanceTo(p.pos) < 3 && enabled === this.lastCount) return;
    this.t = 0.4;
    this.lastAt.copy(p.pos);
    this.lastCount = enabled;
    const ob: number[] = [];
    for (const k of this.colliders.near(p.pos.x - RANGE, p.pos.x + RANGE, p.pos.z - RANGE, p.pos.z + RANGE, [])) {
      if (!k.enabled || k.passable) continue;
      if (k.top < p.pos.y - 20 || k.bottom > p.pos.y + 30) continue;
      this.solid(ob, k);
    }
    setLines(this.obstacles, ob);
    const tr: number[] = [];
    this.heightGrid(tr, p.pos.x, p.pos.z);
    setLines(this.terrain, tr);
  }

  private solid(o: number[], k: Collider) {
    const b = Math.max(k.bottom, -1e4), t = k.top;
    if (k.kind === 'cyl') {
      const r = k.r ?? 0, n = r > 2 ? 24 : 12;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const x0 = k.x + Math.sin(a0) * r, z0 = k.z + Math.cos(a0) * r, x1 = k.x + Math.sin(a1) * r, z1 = k.z + Math.cos(a1) * r;
        o.push(x0, t, z0, x1, t, z1, x0, b, z0, x1, b, z1);
        if (i % (n / 4) === 0) o.push(x0, b, z0, x0, t, z0);
      }
      return;
    }
    const s = Math.sin(k.rot ?? 0), c = Math.cos(k.rot ?? 0), hx = k.hx ?? 0, hz = k.hz ?? 0;
    const corner = (lx: number, lz: number) => [k.x + lx * c - lz * s, k.z + lx * s + lz * c];
    const cs = [corner(-hx, -hz), corner(hx, -hz), corner(hx, hz), corner(-hx, hz)];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = cs[i], [x1, z1] = cs[(i + 1) % 4];
      o.push(x0, t, z0, x1, t, z1, x0, b, z0, x1, b, z1, x0, b, z0, x0, t, z0);
    }
  }

  private capsule(o: number[], x: number, y: number, z: number, r: number, h: number) {
    const n = 16;
    for (const yy of [y + r, y + h - r]) for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      o.push(x + Math.sin(a0) * r, yy, z + Math.cos(a0) * r, x + Math.sin(a1) * r, yy, z + Math.cos(a1) * r);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      o.push(x + dx * r, y + r, z + dz * r, x + dx * r, y + h - r, z + dz * r);
      // rounded ends
      for (let j = 0; j < 4; j++) {
        const b0 = (j / 4) * (Math.PI / 2), b1 = ((j + 1) / 4) * (Math.PI / 2);
        o.push(x + dx * r * Math.cos(b0), y + r - r * Math.sin(b0), z + dz * r * Math.cos(b0), x + dx * r * Math.cos(b1), y + r - r * Math.sin(b1), z + dz * r * Math.cos(b1));
        o.push(x + dx * r * Math.cos(b0), y + h - r + r * Math.sin(b0), z + dz * r * Math.cos(b0), x + dx * r * Math.cos(b1), y + h - r + r * Math.sin(b1), z + dz * r * Math.cos(b1));
      }
    }
  }

  private sphere(o: number[], x: number, y: number, z: number, r: number) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const s0 = Math.sin(a0) * r, c0 = Math.cos(a0) * r, s1 = Math.sin(a1) * r, c1 = Math.cos(a1) * r;
      o.push(x + s0, y + c0, z, x + s1, y + c1, z, x, y + c0, z + s0, x, y + c1, z + s1, x + s0, y, z + c0, x + s1, y, z + c1);
    }
  }

  /** the terrain as the collision code sees it: a height grid around the player (and the cave ceiling) */
  private heightGrid(o: number[], cx: number, cz: number) {
    const G = ground(), step = 1, R = 14;
    const x0 = Math.round(cx) - R, z0 = Math.round(cz) - R;
    const ceil = G.ceilingAt?.bind(G);
    for (let i = 0; i <= R * 2; i++) for (let j = 0; j <= R * 2; j++) {
      const x = x0 + i * step, z = z0 + j * step;
      const h = G.heightAt(x, z);
      if (i < R * 2) o.push(x, h + 0.02, z, x + step, G.heightAt(x + step, z) + 0.02, z);
      if (j < R * 2) o.push(x, h + 0.02, z, x, G.heightAt(x, z + step) + 0.02, z + step);
      if (ceil && (i % 2 === 0) && (j % 2 === 0) && i < R * 2 && j < R * 2) {
        const c = ceil(x, z);
        if (c - h < 30) o.push(x, c, z, x + step * 2, ceil(x + step * 2, z), z, x, c, z, x, ceil(x, z + step * 2), z + step * 2);
      }
    }
  }
}
