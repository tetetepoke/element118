// The ground the shared movement code walks on. Each page plugs in its own world:
// /3d/ uses the meadow terrain, the chapter-1 game uses the underground caverns.
export interface Ground {
  heightAt(x: number, z: number): number;
  /** water surface height at (x, z), or null when there is no water */
  waterAt(x: number, z: number): number | null;
  /** rock ceiling height at (x, z) (caves); leave out for open sky */
  ceilingAt?(x: number, z: number): number;
  /** half size of the playable square (x, z in [-half, half]) */
  half: number;
  spawn: { x: number; z: number };
}

let current: Ground | null = null;

export function setGround(g: Ground) {
  current = g;
}

export function ground(): Ground {
  if (!current) throw new Error('setGround() must be called before the world is used');
  return current;
}
