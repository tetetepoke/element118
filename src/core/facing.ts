// 8-direction facing. Movement is free (360°); the facing is kept in 8 directions so that
// 8-direction sprite sheets can be dropped in later. With 4-direction sheets the diagonals
// fall back to the nearest available row (design decision 2026-11-25).

export enum Facing {
  E = 0,
  SE = 1,
  S = 2,
  SW = 3,
  W = 4,
  NW = 5,
  N = 6,
  NE = 7,
}

export function facingFromVector(x: number, y: number, prev: Facing): Facing {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return prev;
  const a = Math.atan2(y, x); // screen coords: +y is down
  const idx = Math.round(a / (Math.PI / 4));
  return (((idx % 8) + 8) % 8) as Facing;
}

export function facingVector(f: Facing): { x: number; y: number } {
  const a = (f * Math.PI) / 4;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** Rows in a sprite sheet. 4-direction sheets use down/up/side; 8-direction sheets add down_side/up_side. */
export type SpriteRow = 'down' | 'up' | 'side' | 'down_side' | 'up_side';

const FALLBACK4: Record<Facing, [SpriteRow, boolean]> = {
  [Facing.E]: ['side', false],
  [Facing.SE]: ['side', false],
  [Facing.S]: ['down', false],
  [Facing.SW]: ['side', true],
  [Facing.W]: ['side', true],
  [Facing.NW]: ['side', true],
  [Facing.N]: ['up', false],
  [Facing.NE]: ['side', false],
};

const FULL8: Record<Facing, [SpriteRow, boolean]> = {
  [Facing.E]: ['side', false],
  [Facing.SE]: ['down_side', false],
  [Facing.S]: ['down', false],
  [Facing.SW]: ['down_side', true],
  [Facing.W]: ['side', true],
  [Facing.NW]: ['up_side', true],
  [Facing.N]: ['up', false],
  [Facing.NE]: ['up_side', false],
};

/** Which row to draw and whether to flip horizontally. */
export function spriteRowFor(f: Facing, directions: 4 | 8): [SpriteRow, boolean] {
  return (directions === 8 ? FULL8 : FALLBACK4)[f];
}
