// Chapter 2 data: new elements, materials and items. Registered into the shared tables at runtime,
// only inside the chapter-2 page (chapter 1's own page never loads this file).
//
// Science vs game (same rule as chapter 1):
//   kind / composition / formula / facts = real science (simplified, not wrong)
//   hardness … weak / gameNote           = game numbers and this world's fiction
import { ELEMENTS, MATERIALS, ITEMS, type ElementInfo, type MaterialDef, type ItemDef, type ElementSymbol } from '../ch1/game/materials';

// Sn is new in chapter 2 (the shared symbol type only lists chapter-1 symbols, so it is added loosely)
export const SN = 'Sn' as ElementSymbol;

const NEW_ELEMENTS: Record<string, ElementInfo> = {
  Cu: {
    ...ELEMENTS.Cu,
    fact: '電気と熱をとてもよく通す赤い金属。やわらかく、のびやすいので細い線にできる。電線の多くは銅でできている。',
    ability: 'C とつながって Cu LINK になる。電気の通り道になれる（ゲームの能力）',
  },
  Sn: { symbol: SN, z: 50, nameJa: 'スズ', en: 'TIN', color: 0xc8ccd4, fact: 'やわらかい銀白色の金属。とける温度が低い（約232℃）。銅にまぜると、銅よりかたい青銅（ブロンズ）になる。' },
};

const M = (d: MaterialDef) => d;
const NEW_MATERIALS: Record<string, MaterialDef> = {
  malachite: M({
    id: 'malachite', nameJa: '孔雀石', kind: 'mineral', composition: ['Cu', 'C', 'O', 'H'], formula: 'Cu₂CO₃(OH)₂', bonds: [['Cu', 'O'], ['C', 'O']],
    hardness: 4, toughness: 3, conductivity: 1, heatResistance: 4, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 1, cut: 0.3 }, breakable: true, harvest: { tier: 0 },
    facts: ['孔雀石は銅をふくむ緑色の鉱物（塩基性炭酸銅）。しま模様がある。', '炭（炭素）といっしょに強く熱すると、銅を取り出せる。'],
  }),
  native_copper: M({
    id: 'native_copper', nameJa: '銅', kind: 'element', composition: ['Cu'], formula: 'Cu', bonds: [['Cu', 'Cu']],
    hardness: 3, toughness: 8, conductivity: 10, heatResistance: 6, flammability: 0, moisture: 0, state: 'solid',
    weak: { cut: 0.6, impact: 0.6 }, breakable: false,
    facts: ['銅は電気と熱をとてもよく通す。', 'たたいたり引っぱったりすると、こわれずに広がったりのびたりする（展性・延性）。'],
  }),
  charcoal: M({
    id: 'charcoal', nameJa: '炭', kind: 'material', composition: ['C'], formula: 'おもに炭素（C）', bonds: [['C', 'C']],
    hardness: 1, toughness: 1, conductivity: 3, heatResistance: 2, flammability: 9, moisture: 0, state: 'solid',
    weak: { impact: 1, cut: 1 }, breakable: true,
    facts: ['木を空気（酸素）の少ない所で熱すると、水分などがぬけて、炭素の多い炭が残る。', '炭は高い温度で燃え、金属を取り出すときにも使われてきた。'],
  }),
  verdigris: M({
    id: 'verdigris', nameJa: '緑青（ろくしょう）', kind: 'mixture', composition: ['Cu', 'O', 'C', 'H'], formula: '塩基性炭酸銅など', bonds: [['Cu', 'O']],
    hardness: 3, toughness: 2, conductivity: 1, heatResistance: 4, flammability: 0, moisture: 2, state: 'solid',
    weak: { impact: 1 }, breakable: false,
    facts: ['銅が空気中の水分や二酸化炭素などと長い時間をかけて反応してできる、緑色のさび。', '鉄のさびとちがって、表面をおおって中を守るはたらきがある。'],
  }),
  cassiterite: M({
    id: 'cassiterite', nameJa: '砂錫（すず石の粒）', kind: 'mineral', composition: [SN, 'O'], formula: 'SnO₂（錫石）', bonds: [[SN, 'O']],
    hardness: 6, toughness: 4, conductivity: 1, heatResistance: 8, flammability: 0, moisture: 1, state: 'solid',
    weak: {}, breakable: false, harvest: { tier: 0 },
    facts: ['錫石はスズと酸素の化合物の鉱物。とても重いので、川の流れで軽い砂が流されると、底にたまる（砂錫）。', '炭といっしょに熱すると、スズを取り出せる。'],
  }),
  tin: M({
    id: 'tin', nameJa: 'スズ', kind: 'element', composition: [SN], formula: 'Sn', bonds: [[SN, SN]],
    hardness: 2, toughness: 5, conductivity: 6, heatResistance: 3, flammability: 0, moisture: 0, state: 'solid',
    weak: { cut: 1 }, breakable: false,
    facts: ['スズはやわらかい金属。銅にまぜて青銅をつくる。'],
  }),
  bronze: M({
    id: 'bronze', nameJa: '青銅', kind: 'alloy', composition: ['Cu', SN], formula: '銅＋スズ（合金）', bonds: [['Cu', SN]],
    hardness: 6.5, toughness: 8, conductivity: 6, heatResistance: 7, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 0.5 }, breakable: false,
    facts: ['青銅は銅にスズをまぜた合金。まぜると、どちらの金属だけのときよりもかたくなる。', '人は大昔から、青銅で刃物や道具をつくってきた。'],
  }),
  green_rubble: M({
    id: 'green_rubble', nameJa: '緑の岩くず', kind: 'mixture', composition: ['Si', 'O', 'Cu'], formula: '岩と孔雀石が固まったもの', bonds: [['Si', 'O'], ['Cu', 'O']],
    hardness: 7, toughness: 6, conductivity: 1, heatResistance: 8, flammability: 0, moisture: 1, state: 'solid',
    weak: { impact: 1, cut: 0.2 }, breakable: true,
    facts: ['崩れた岩が、しみ出した銅の成分で固められている。たたいて砕くしかない。'],
  }),
  si_panel: M({
    id: 'si_panel', nameJa: '古い光の板', kind: 'material', composition: ['Si', 'Cu', 'O'], formula: '???', bonds: [['Si', 'Si']],
    hardness: 6, toughness: 3, conductivity: 5, heatResistance: 6, flammability: 0, moisture: 0, state: 'solid',
    weak: {}, breakable: false,
    facts: ['本物の世界でも、ケイ素は光を電気に変える部品（太陽電池）の材料に使われている。'],
    gameNote: '根の光を受けて電気をつくっていた板（この世界の設定）。だれが作ったのかはわからない。',
  }),
  rokusho_bug: M({
    id: 'rokusho_bug', nameJa: 'ロクショウムシ', kind: 'organism', composition: ['C', 'H', 'O', 'N', 'Cu'], bonds: [['C', 'C'], ['C', 'N']],
    hardness: 3, toughness: 3, conductivity: 1, heatResistance: 2, flammability: 0, moisture: 5, state: 'solid',
    weak: {}, breakable: false,
    facts: ['本物の生き物にも、体に銅をふくむものがいる（エビやイカの青い血は、銅をふくむたんぱく質で酸素を運ぶ）。'],
    gameNote: '銅をかじって生きる、この世界の虫（架空）。銅のにおいに集まる。かたい物にはぶつかってはね返る。',
  }),
  light_moth: M({
    id: 'light_moth', nameJa: 'ヒカリクイ', kind: 'organism', composition: ['C', 'H', 'O', 'N'], bonds: [['C', 'C']],
    hardness: 1, toughness: 1, conductivity: 0, heatResistance: 1, flammability: 1, moisture: 6, state: 'solid',
    weak: {}, breakable: false,
    facts: ['本物のガの多くも、夜に光へ集まる。'],
    gameNote: '根の光やランプの光のまわりを飛ぶ、この世界の虫（架空）。',
  }),
  geode: M({
    id: 'geode', nameJa: '緑のまゆ', kind: 'unknown', composition: ['Cu', 'C', 'O'], formula: '???', bonds: [],
    hardness: 9, toughness: 9, conductivity: 4, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: {}, breakable: false, mystery: true,
    facts: ['孔雀石が何重にも重なって、まゆのようになっている。中に何かいる。'],
  }),
  tensho_plate: M({
    id: 'tensho_plate', nameJa: '古い石板', kind: 'unknown', composition: ['Si', 'O'], formula: '???', bonds: [['Si', 'O']],
    hardness: 8, toughness: 8, conductivity: 0, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: {}, breakable: false, mystery: true,
    facts: ['石に、細かい文字と、枝分かれした線の図が彫られている。'],
  }),
};

const NEW_ITEMS: Record<string, ItemDef> = {
  malachite: { id: 'malachite', nameJa: '孔雀石', mat: 'malachite', length: 0.2, mass: 1.2, edge: 0, point: 0, blunt: 0.8, color: 0x2f9a6a, visual: { proc: 'ore', important: true } },
  charcoal: { id: 'charcoal', nameJa: '炭', mat: 'charcoal', length: 0.18, mass: 0.15, edge: 0, point: 0, blunt: 0.3, color: 0x1e1c1c, visual: { proc: 'stone' } },
  copper: { id: 'copper', nameJa: '銅のかたまり', mat: 'native_copper', length: 0.18, mass: 1.6, edge: 0, point: 0, blunt: 1, color: 0xd07a48, visual: { proc: 'heavy', important: true } },
  copper_wire: { id: 'copper_wire', nameJa: '銅線', mat: 'native_copper', length: 1.2, mass: 0.2, edge: 0, point: 0, blunt: 0, binding: true, color: 0xe0905a, visual: { proc: 'fiber', important: true } },
  cassiterite: { id: 'cassiterite', nameJa: '砂錫', mat: 'cassiterite', length: 0.1, mass: 0.8, edge: 0, point: 0, blunt: 0.3, color: 0x4a4440, visual: { proc: 'stone' } },
  tin: { id: 'tin', nameJa: 'スズのかたまり', mat: 'tin', length: 0.15, mass: 0.9, edge: 0, point: 0, blunt: 0.8, color: 0xc8ccd4, visual: { proc: 'heavy' } },
  bronze: { id: 'bronze', nameJa: '青銅のかたまり', mat: 'bronze', length: 0.28, mass: 3.0, edge: 0, point: 0, blunt: 1, color: 0xb08040, visual: { proc: 'heavy', important: true } },
  bronze_blade: { id: 'bronze_blade', nameJa: '青銅の刃', mat: 'bronze', length: 0.34, mass: 0.6, edge: 0.95, point: 0.3, blunt: 0, color: 0xc89a5a, visual: { proc: 'blade', important: true } },
};

/** add chapter 2 to the shared tables (idempotent) */
export function registerChapter2Data() {
  Object.assign(ELEMENTS as Record<string, ElementInfo>, NEW_ELEMENTS);
  Object.assign(MATERIALS, NEW_MATERIALS);
  Object.assign(ITEMS, NEW_ITEMS);
}

/** smelting recipes at the old furnace (real chemistry, simplified) */
export const SMELT: { id: string; label: string; need: Record<string, number>; give: Record<string, number>; note: string }[] = [
  { id: 'copper', label: '銅を取り出す', need: { malachite: 1, charcoal: 1 }, give: { copper: 1 }, note: '孔雀石を炭と熱すると、炭素が酸素をうばって銅が残る。' },
  { id: 'wire', label: '銅を細くのばして線にする', need: { copper: 1 }, give: { copper_wire: 2 }, note: '銅はのびやすい。たたいて、引きのばすと線になる。' },
  { id: 'tin', label: 'スズを取り出す', need: { cassiterite: 2, charcoal: 1 }, give: { tin: 1 }, note: '錫石も、炭と熱するとスズが残る。' },
  { id: 'bronze', label: '銅とスズをまぜる（青銅）', need: { copper: 1, tin: 1 }, give: { bronze: 1 }, note: '銅にスズをまぜた合金、青銅。銅よりかたい。' },
  { id: 'bblade', label: '青銅を刃にする', need: { bronze: 1 }, give: { bronze_blade: 1 }, note: '青銅は、昔から刃物にも使われてきた。' },
];
