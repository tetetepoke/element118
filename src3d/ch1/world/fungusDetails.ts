import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function tint(geometry: THREE.BufferGeometry, color: THREE.Color) {
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createFungusGeometries() {
  const stem = new THREE.CylinderGeometry(0.73, 1, 1, 16, 10);
  const pos = stem.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i) + 0.5;
    const angle = Math.atan2(z, x);
    const grain = Math.sin(angle * 7 + y * 3) * 0.04 + Math.cos(angle * 4 - y * 5) * 0.025;
    const width = 0.89 + grain + 0.04 * Math.cos(y * 12);
    pos.setXYZ(i, x * width, y - 0.5, z * width);
    const shade = 0.48 + y * 0.38 + grain * 3;
    colors.push(shade * 0.93, shade * 0.91, shade);
  }
  stem.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  stem.computeVertexNormals();

  const cap = new THREE.LatheGeometry([
    [0, -0.035], [0.20, -0.052], [0.43, -0.069], [0.67, -0.077], [0.9, -0.051],
    [0.99, -0.017], [1, 0.015], [0.95, 0.063], [0.80, 0.14],
    [0.55, 0.208], [0.28, 0.243], [0, 0.25],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  const skin = cap.attributes.position;
  const capColors: number[] = [];
  for (let i = 0; i < skin.count; i++) {
    const x = skin.getX(i), z = skin.getZ(i), y = skin.getY(i);
    const radius = Math.hypot(x, z);
    const angle = Math.atan2(x, z);
    const ripple = Math.sin(angle * 5) * 0.018 + Math.sin(angle * 9) * 0.012;
    const gill = (Math.cos(angle * 24) + 1) * 0.5;
    const folds = y < 0 ? gill * Math.sin(Math.PI * radius) : 0;
    skin.setXYZ(i, x * (0.965 + ripple), y + ripple * radius - folds * 0.019, z * (0.965 + ripple));
    const shade = y < 0 ? 0.38 + folds * 0.58 : 0.79 + Math.cos(radius * 23 + ripple * 30) * 0.12 + ripple * 1.8;
    capColors.push(shade, shade * (y < 0 ? 0.83 : 0.96), shade);
  }
  cap.setAttribute('color', new THREE.Float32BufferAttribute(capColors, 3));
  cap.computeVertexNormals();
  return { stem, cap };
}

export function createGlowPlantGeometry() {
  const foliage = new THREE.Color(0x327675), petal = new THREE.Color(0x8ac6df), bud = new THREE.Color(0xb8edff);
  const parts = [
    tint(new THREE.CylinderGeometry(0.01, 0.023, 0.38, 6).translate(0, 0.19, 0).toNonIndexed(), foliage),
    tint(new THREE.IcosahedronGeometry(0.044, 0).scale(0.85, 1.3, 0.85).translate(0, 0.40, 0), bud),
  ];
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const blade = new THREE.SphereGeometry(1, 5, 3).scale(0.018, 0.095, 0.033)
      .rotateZ(-0.82).translate(0.055, 0.17, 0).rotateY(angle).toNonIndexed();
    const bloom = new THREE.SphereGeometry(1, 5, 3).scale(0.026, 0.065, 0.037)
      .rotateZ(-0.75).translate(0.04, 0.385, 0).rotateY(angle).toNonIndexed();
    parts.push(tint(blade, foliage), tint(bloom, petal));
  }
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}
