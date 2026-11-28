import { ITEMS, type StatKey } from '../ch1/game/materials';

export const WEAPONS = {
  sword: { label: '剣', stat: 'cut', speed: 0.87, length: 0.90, thickness: 1.0 },
  dagger: { label: '短剣', stat: 'pierce', speed: 1.12, length: 0.57, thickness: 0.84 },
  spear: { label: '槍', stat: 'pierce', speed: 0.83, length: 1.46, thickness: 0.76 },
  axe: { label: '斧', stat: 'cut', speed: 0.76, length: 1.02, thickness: 1.08 },
  hammer: { label: 'ハンマー', stat: 'impact', speed: 0.69, length: 0.95, thickness: 1.28 },
  club: { label: '棍棒', stat: 'impact', speed: 0.93, length: 0.98, thickness: 1.15 },
} as const satisfies Record<string, { label: string; stat: StatKey; speed: number; length: number; thickness: number }>;

export type WeaponKind = keyof typeof WEAPONS;
export type PartSlot = 'handle' | 'head' | 'binding';
export const PART_SLOTS: readonly PartSlot[] = ['head', 'handle', 'binding'];

export function eligiblePart(slot: PartSlot, id: string, kind?: WeaponKind) {
  const item = ITEMS[id];
  if (!item) return false;
  if (slot === 'binding') return !!item.binding;
  if (!kind) return true;
  if (slot === 'handle') return !item.binding && item.length >= 0.7;
  if (item.binding) return false;
  const profile = WEAPONS[kind as WeaponKind];
  return !!profile && (profile.stat === 'cut' ? item.edge >= 0.4 : profile.stat === 'pierce' ? item.point >= 0.3 : item.blunt >= 0.18);
}
