import * as THREE from 'three';

type Surface = 'weave' | 'leather' | 'hair' | 'ceramic';
const maps = new Map<Surface, THREE.DataTexture>();

/** Small shared height maps in model UV space. They add lighting detail without extra meshes. */
export function surfaceBump(surface: Surface, bumpScale: number) {
  let bumpMap = maps.get(surface);
  if (!bumpMap) {
    const size = 64;
    const pixels = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
        const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        const grain = hash - Math.floor(hash) - 0.5;
        let height: number;
        switch (surface) {
          case 'weave':
            height = Math.sin(12 * u) * Math.cos(12 * v) * 0.22 + Math.cos(3 * u + 2 * v) * 0.12 + grain * 0.1;
            break;
          case 'leather':
            height = Math.sin(6 * u + Math.sin(4 * v)) * Math.sin(7 * v) * 0.12 + grain * 0.35;
            break;
          case 'hair':
            height = Math.cos(12 * u + Math.sin(2 * v) * 0.55) * 0.29 + Math.cos(5 * u - 2 * v) * 0.10 + grain * 0.07;
            break;
          case 'ceramic':
            height = Math.cos(3 * u - v) * Math.sin(4 * v) * 0.14 + grain * 0.22;
            break;
        }
        pixels[y * size + x] = Math.round((0.5 + height) * 255);
      }
    }
    bumpMap = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.magFilter = THREE.LinearFilter;
    bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
    bumpMap.generateMipmaps = true;
    bumpMap.needsUpdate = true;
    maps.set(surface, bumpMap);
  }
  return { bumpMap, bumpScale };
}
