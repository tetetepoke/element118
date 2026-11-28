import { ITEMS, MATERIALS, type ItemDef, type StatKey } from '../ch1/game/materials';

export const WILDLIFE_MATERIALS: readonly ItemDef[] = [
  { id: 'cave_fang', nameJa: '結晶の牙', mat: 'cave_fang', length: 0.32, mass: 0.4, edge: 0.54, point: 1, blunt: 0.11, color: 0xa7dae0, visual: { proc: 'crystal' } },
  { id: 'cave_shell', nameJa: 'ロクショウムシの甲殻', mat: 'cave_shell', length: 0.31, mass: 1.25, edge: 0.59, point: 0.37, blunt: 0.88, color: 0x558776, visual: { proc: 'heavy' } },
  { id: 'cave_claw', nameJa: 'シンドウムシの爪', mat: 'cave_claw', length: 0.26, mass: 0.38, edge: 0.89, point: 0.67, blunt: 0.23, color: 0x9d8b62, visual: { proc: 'blade' } },
  { id: 'cave_membrane', nameJa: '洞虫の皮膜', mat: 'cave_membrane', length: 0.41, mass: 0.09, edge: 0, point: 0, blunt: 0, binding: true, color: 0xc196a3, visual: { proc: 'fiber' } },
  { id: 'cave_lantern', nameJa: 'ヒカリクイの発光器官', mat: 'cave_lantern', length: 0.23, mass: 0.23, edge: 0.24, point: 0.32, blunt: 0.46, color: 0xc9e98c, visual: { proc: 'crystal' } },
  { id: 'cave_mycelium', nameJa: '絡み菌糸', mat: 'cave_mycelium', length: 0.55, mass: 0.08, edge: 0, point: 0, blunt: 0, binding: true, color: 0xd9c5eb, visual: { proc: 'fiber' } },
];

export function registerWildlifeMaterials() {
  for (const item of WILDLIFE_MATERIALS) {
    ITEMS[item.id] = item;
    MATERIALS[item.mat] = {
      id: item.mat, nameJa: item.nameJa, kind: 'organism', composition: [],
      hardness: item.binding ? 2 : 6, toughness: item.binding ? 7 : 5,
      conductivity: 0, heatResistance: 1, flammability: 0, moisture: 2,
      state: 'solid', weak: {}, breakable: false, facts: [],
      gameNote: 'ゲームに登場する架空の地下生物に由来する素材。実在する化学物質の分類・組成はありません。',
    };
  }
}

interface Creature {
  label: string; hp: number; damage: number; armor: number; speed: number; radius: number; height: number;
  attack: string; range: number; aim: number; windup: number; recovery: number; detection: number; leash: number;
  pattern: 'guard' | 'rush' | 'circle'; weakness: StatKey; color: number; glow: number;
  habitat: string; respawn: number; drops: readonly (readonly [item: string, chance: number])[];
}
export const CREATURES = {
  cave_vibration_guard: { label: 'シンドウムシ（縄張り個体）', hp: 16, damage: 8, armor: 1, speed: 1.25, radius: 0.39, height: 0.64,
    attack: '体当たり', range: 1.2, aim: 0.66, windup: 0.85, recovery: 1.05, detection: 4.8, leash: 6.3, pattern: 'guard', weakness: 'impact', color: 0x6f614a, glow: 0xe09a64,
    habitat: '第七廃棄区・菌類の森の脇道', respawn: 65, drops: [['cave_claw', 1], ['cave_mycelium', 0.55], ['cave_membrane', 0.33]] },
  cave_patina_guard: { label: 'ロクショウムシ（縄張り個体）', hp: 25, damage: 12, armor: 3, speed: 1.65, radius: 0.47, height: 0.67,
    attack: '角突き', range: 1.52, aim: 0.8, windup: 0.86, recovery: 1.2, detection: 5.3, leash: 6.9, pattern: 'rush', weakness: 'pierce', color: 0x376b53, glow: 0xd2b762,
    habitat: '緑の坑・緑青の洞の脇道', respawn: 85, drops: [['cave_shell', 1], ['cave_fang', 0.72], ['cave_membrane', 0.40]] },
  cave_light_guard: { label: 'ヒカリクイ（縄張り個体）', hp: 17, damage: 9, armor: 1, speed: 1.95, radius: 0.34, height: 0.51,
    attack: '横薙ぎ', range: 1.16, aim: 0.63, windup: 0.65, recovery: 0.87, detection: 5.2, leash: 6.2, pattern: 'circle', weakness: 'cut', color: 0x626a43, glow: 0xc8f986,
    habitat: '砂錫の沢・結晶層の脇道', respawn: 70, drops: [['cave_lantern', 1], ['cave_membrane', 0.52], ['cave_fang', 0.35]] },
} as const satisfies Record<string, Creature>;

export type CreatureId = keyof typeof CREATURES;
export type Encounter = readonly [id: string, species: CreatureId, x: number, z: number];
