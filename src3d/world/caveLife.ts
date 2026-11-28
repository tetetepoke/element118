import * as THREE from 'three';

type Point = readonly [x: number, z: number];
type Height = (x: number, z: number) => number;
type CavernZone = { c: THREE.Vector2; rx: number; rz: number };
type Light = { pos: THREE.Vector3; color: number; power: number };

function softDot() {
  const size = 32;
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const d = Math.hypot((i % size + 0.5) / size - 0.5, (Math.floor(i / size) + 0.5) / size - 0.5) * 2;
    rgba.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - d) ** 1.65)], i * 4);
  }
  const texture = new THREE.DataTexture(rgba, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function caveDust(isTouch: boolean) {
  const count = isTouch ? 260 : 400;
  const span = new THREE.Vector3(24, 10, 24);
  const seeds = new Float32Array(count * 3);
  const positions = new THREE.BufferAttribute(new Float32Array(seeds.length), 3).setUsage(THREE.DynamicDrawUsage);
  const colors = new Float32Array(seeds.length);
  const geometry = new THREE.BufferGeometry().setAttribute('position', positions).setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: softDot(), size: 0.032, transparent: true, opacity: 0.54,
    vertexColors: true, depthWrite: false, alphaTest: 0.025,
  });
  const mesh = new THREE.Points(geometry, material);
  mesh.name = 'cave_dust';
  mesh.frustumCulled = false;
  let seed = 1729;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    seeds.set([rand() * span.x, rand() * span.y, rand() * span.z], i * 3);
    const pale = 0.36 + rand() * 0.60;
    colors.set([pale, pale * 0.83, pale * 0.68], i * 3);
  }
  const wrap = (v: number, focus: number, width: number) =>
    THREE.MathUtils.euclideanModulo(v - focus + width / 2, width) - width / 2;
  return {
    mesh,
    update(t: number, camera: THREE.Vector3) {
      mesh.position.copy(camera);
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        positions.setXYZ(i,
          wrap(seeds[j] + t * 0.11 + Math.sin(i + t * 0.6) * 0.23, camera.x, span.x),
          wrap(seeds[j + 1] + t * (i % 2 ? -0.057 : 0.035), camera.y, span.y),
          wrap(seeds[j + 2] + Math.cos(i * 3 + t * 0.48) * 0.65, camera.z, span.z),
        );
      }
      positions.needsUpdate = true;
    },
  };
}

export function caveCanopy(root: THREE.Group, paths: Point[][], floor: Height, ceiling: Height, lights: Light[]) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x315c84, roughness: 0.67, emissive: 0x184b8b, emissiveIntensity: 0.33 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x6bcaff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.SpriteMaterial({ map: softDot(), color: 0x377ddc, transparent: true, opacity: 0.31, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [index, path] of paths.entries()) {
    const points = path.map(([x, z], i) => {
      const y = floor(x, z);
      const roof = ceiling(x, z);
      return new THREE.Vector3(x, Math.min(roof - 0.9, y + 5.8 + Math.sin(i * 1.05 + index) * 1.7), z);
    });
    if (points.some((p) => p.y < floor(p.x, p.z) + 3.5)) continue;
    const rootMesh = new THREE.Group();
    rootMesh.name = 'overhead_blue_root';
    root.add(rootMesh);
    const curve = new THREE.CatmullRomCurve3(points);
    rootMesh.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.13, 7), bark));
    for (const side of [-1, 1]) {
      const vein = new THREE.CatmullRomCurve3(points.map((p, i) => (
        p.clone().add(new THREE.Vector3(Math.cos(i * 1.4) * 0.07, -0.12, side * 0.075))
      )));
      rootMesh.add(new THREE.Mesh(new THREE.TubeGeometry(vein, 24, 0.026, 5), glow));
    }
    for (const u of [0.22, 0.55, 0.82]) {
      const lobe = new THREE.Sprite(halo);
      lobe.scale.setScalar(1.6);
      lobe.position.copy(curve.getPoint(u));
      rootMesh.add(lobe);
    }
    const tip = curve.getPoint(0.55);
    lights.push({ pos: tip.clone().add(new THREE.Vector3(0, -0.6, 0)), color: 0x599dff, power: 0.65 });
  }
}

export function caveWallLife(root: THREE.Group, zones: readonly CavernZone[], floor: Height) {
  const route: { beetle: THREE.Group; legs: THREE.Mesh[]; start: THREE.Vector2; end: THREE.Vector2; phase: number }[] = [];
  const shell = new THREE.MeshStandardMaterial({ color: 0x504c45, roughness: 0.74 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x373033, roughness: 0.84 });
  const spot = new THREE.MeshStandardMaterial({ color: 0xbab686, emissive: 0x5e7738, emissiveIntensity: 0.22 });
  const shellGeometry = new THREE.SphereGeometry(1, 8, 6);
  const legGeometry = new THREE.CylinderGeometry(0.012, 0.017, 0.16, 5);
  for (const [index, zone] of zones.entries()) {
    let placed = 0;
    for (let direction = 0; direction < 10 && placed < 2; direction++) {
      const a = (direction + index * 0.37) * Math.PI * 2 / 10;
      const edge = (r: number) => zone.c.clone().add(new THREE.Vector2(Math.cos(a) * zone.rx * r, Math.sin(a) * zone.rz * r));
      const ground = floor(zone.c.x, zone.c.y);
      const band = Array.from({ length: 25 }, (_, i) => edge(0.68 + i * 0.012));
      const at = band.findIndex((p) => floor(p.x, p.y) > ground + 2.2);
      const start = band[at], end = band[at + 2];
      if (at < 1 || !end || floor(end.x, end.y) > ground + 17 || floor(end.x, end.y) - floor(start.x, start.y) < 1.2) continue;
      const beetle = new THREE.Group();
      beetle.name = 'wall_crawler';
      const body = new THREE.Mesh(shellGeometry, shell);
      body.scale.set(0.15, 0.092, 0.24);
      body.position.y = 0.09;
      beetle.add(body);
      const head = new THREE.Mesh(shellGeometry, spot);
      head.scale.set(0.082, 0.056, 0.09);
      head.position.set(0, 0.075, 0.19);
      beetle.add(head);
      const legs: THREE.Mesh[] = [];
      for (const side of [-1, 1]) for (const z of [-0.14, 0, 0.13]) {
        const leg = new THREE.Mesh(legGeometry, joint);
        leg.position.set(side * 0.14, 0.052, z);
        beetle.add(leg);
        legs.push(leg);
      }
      beetle.visible = false;
      root.add(beetle);
      route.push({ beetle, legs, start, end, phase: direction + index * 2.4 });
      placed++;
    }
  }
  const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
  const frame = new THREE.Matrix4();
  return (t: number, eye: THREE.Vector3) => {
    for (const { beetle, legs, start, end, phase } of route) {
      beetle.visible = eye.distanceToSquared(beetle.position) < 38 ** 2 || Math.hypot(eye.x - start.x, eye.z - start.y) < 35;
      if (!beetle.visible) continue;
      const cycle = t * 0.38 + phase, p = 0.5 - 0.5 * Math.cos(cycle);
      const x = THREE.MathUtils.lerp(start.x, end.x, p), z = THREE.MathUtils.lerp(start.y, end.y, p);
      const gx = (floor(x + 0.13, z) - floor(x - 0.13, z)) / 0.26;
      const gz = (floor(x, z + 0.13) - floor(x, z - 0.13)) / 0.26;
      up.set(-gx, 1, -gz).normalize();
      const dx = end.x - start.x, dz = end.y - start.y;
      forward.set(dx, gx * dx + gz * dz, dz).normalize().multiplyScalar(Math.sin(cycle) < 0 ? -1 : 1);
      right.crossVectors(up, forward).normalize();
      beetle.quaternion.setFromRotationMatrix(frame.makeBasis(right, up, forward));
      beetle.position.set(x, floor(x, z), z).addScaledVector(up, 0.025);
      legs.forEach((leg, i) => {
        leg.rotation.z = (i < 3 ? -1 : 1) * (1.16 + 0.17 * Math.sin(t * 8 + i * 2.1));
        leg.rotation.x = 0.26 * Math.sin(t * 8 + i * 2.1);
      });
    }
  };
}
