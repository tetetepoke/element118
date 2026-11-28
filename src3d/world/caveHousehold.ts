import * as THREE from 'three';
import type { ColliderWorld } from './colliders';

/** Small storage and rest areas tucked beside occupied buildings. */
export function addCaveHouseholds(root: THREE.Group, colliders: ColliderWorld, heightAt: (x: number, z: number) => number,
  sites: readonly (readonly [x: number, z: number])[]) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x694731, roughness: 0.89 });
  const clay = new THREE.MeshStandardMaterial({ color: 0x8d5540, roughness: 0.81 });
  const cloth = [0x874d42, 0x687b82, 0xb98c60].map((color) => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }));
  const pot = new THREE.LatheGeometry([
    [0, 0], [0.13, 0], [0.16, 0.12], [0.2, 0.26], [0.18, 0.37], [0.11, 0.4], [0.12, 0.46],
    [0.09, 0.46], [0.088, 0.405], [0.095, 0.36],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  for (const [i, [x, z]] of sites.entries()) {
    const y = heightAt(x, z);
    if (colliders.penetration(x, z, y, 1.1, 1.5, 0) > 0.01) continue;
    const group = new THREE.Group();
    group.name = 'household_goods';
    group.position.set(x, y, z);
    root.add(group);
    const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wood);
      part.position.set(x, y, z);
      group.add(part);
    };
    box(1.45, 0.12, 0.39, 0, 0.38, 0);
    for (const side of [-1, 1]) box(0.12, 0.35, 0.29, side * 0.53, 0.175, 0);
    colliders.add({ id: `household_bench_${i}`, kind: 'box', x, z, hx: 0.725, hz: 0.195, bottom: y, top: y + 0.44 });
    for (const [j, dx] of [-0.56, 0.43].entries()) {
      const jar = new THREE.Mesh(pot, clay);
      const jz = z + 0.55, jx = x + dx, jy = heightAt(jx, jz);
      if (colliders.penetration(jx, jz, jy, 0.25, 0.48, 0) > 0.01) continue;
      jar.scale.setScalar(j === 0 ? 0.82 : 1);
      jar.position.set(dx, jy - y, jz - z);
      group.add(jar);
      colliders.add({ id: `household_pot_${i}_${j}`, kind: 'cyl', x: jx, z: jz, r: 0.2 * jar.scale.x, bottom: jy, top: jy + 0.46 * jar.scale.y });
    }
    for (const dx of [-1.05, 1.05]) {
      if (colliders.penetration(x + dx, z - 0.42, y, 0.1, 1.8, 0) > 0.01) continue;
      box(0.07, 1.76, 0.07, dx, 0.88, -0.42);
      colliders.add({ id: `household_post_${i}_${dx}`, kind: 'cyl', x: x + dx, z: z - 0.42, r: 0.05, bottom: y, top: y + 1.76 });
    }
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.05, 1.7, -0.42), new THREE.Vector3(0, 1.53, -0.42), new THREE.Vector3(1.05, 1.7, -0.42));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.01, 4, false), wood));
    for (const [j, dx] of [-0.53, 0.02, 0.53].entries()) {
      const linen = new THREE.PlaneGeometry(0.35 + j * 0.05, j === 1 ? 0.52 : 0.41, 6, 3);
      const p = linen.attributes.position;
      for (let k = 0; k < p.count; k++) {
        p.setZ(k, Math.sin(p.getX(k) * 37 + j) * 0.041 * (0.6 - p.getY(k)));
      }
      linen.computeVertexNormals();
      const textile = new THREE.Mesh(linen, cloth[(i + j) % cloth.length]);
      textile.position.set(dx, j === 1 ? 1.34 : 1.41, -0.42);
      group.add(textile);
    }
  }
}
