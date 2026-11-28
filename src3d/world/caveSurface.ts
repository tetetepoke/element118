/// <reference types="vite/client" />
import * as THREE from 'three';

let textures: { ground: THREE.Texture; rock: THREE.Texture } | undefined;

function loadSurface(name: string) {
  // Neutral gray preserves the vertex colors until the photo is ready.
  const placeholder = document.createElement('canvas');
  placeholder.width = placeholder.height = 512;
  const context = placeholder.getContext('2d')!;
  context.fillStyle = '#c5c5c5';
  context.fillRect(0, 0, placeholder.width, placeholder.height);

  const texture = new THREE.CanvasTexture(placeholder);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  const image = new Image();
  image.onload = () => {
    context.drawImage(image, 0, 0, placeholder.width, placeholder.height);
    texture.needsUpdate = true;
  };
  image.src = `${import.meta.env.BASE_URL}assets/terrain/${name}.webp`;
  return texture;
}

export function caveSurface(ceiling = false) {
  textures ??= { ground: loadSurface('cave-ground'), rock: loadSurface('cave-rock') };
  const { ground, rock } = textures;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: ceiling ? 1 : 0.95,
    side: ceiling ? THREE.DoubleSide : THREE.FrontSide,
    map: ceiling ? rock : ground,
  });

  // These are static terrain meshes built in cave coordinates. Blending the three projections
  // keeps the photo from stretching where the ground mesh rises steeply to form a wall.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.caveRock = { value: rock };
    const varyings = 'varying vec3 cavePosition; varying vec3 caveNormal;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ncavePosition = position;\ncaveNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${varyings}\nuniform sampler2D caveRock;`)
      .replace('#include <map_fragment>', `
        vec3 weight = pow(abs(normalize(caveNormal)), vec3(4.0));
        weight /= weight.x + weight.y + weight.z;
        float surfaceTone = dot(weight, vec3(
          texture2D(caveRock, cavePosition.zy / 5.0).r,
          texture2D(map, cavePosition.xz / 3.4).r,
          texture2D(caveRock, cavePosition.xy / 5.0).r
        ));
        diffuseColor.rgb *= mix(0.22, 1.65, surfaceTone);
      `);
  };
  return material;
}
