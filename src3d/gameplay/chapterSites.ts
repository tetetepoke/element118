import type { MapLayer, MapLocation } from './explorationMap';
import type { Encounter } from './wildlifeData';

export const CHAPTER1_LAYERS: readonly MapLayer[] = [['廃棄区・アトミア', -Infinity], ['水脈・菌類の森', 11], ['鉱物層・古い部屋', 29], ['結晶層・上層門', 42]];
export const CHAPTER2_LAYERS: readonly MapLayer[] = [['上層門・坑道・砂錫の沢', -Infinity], ['カンテラ村・記録の間', 4.7], ['緑の坑・発電所', 9], ['緑青の洞', 14.4]];

export const CHAPTER1_ENCOUNTERS: readonly Encounter[] = [
  ['dump_guard', 'cave_vibration_guard', 34, 122],
  ['fungus_guard', 'cave_vibration_guard', -78, -92],
  ['crystal_guard', 'cave_light_guard', 96, -22],
];
export const CHAPTER2_ENCOUNTERS: readonly Encounter[] = [
  ['green_guard', 'cave_patina_guard', -63, 10],
  ['deep_guard', 'cave_patina_guard', -71, -60],
  ['stream_guard', 'cave_light_guard', 66, 9],
];

export const location = (name: string, p: { x: number; y: number }): MapLocation => [name, p.x, p.y];
