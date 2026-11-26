// Material data. Every thing in the world points at one of these, and one shared rule engine
// (interact.ts) decides what tools, abilities and actions do to it — no per-object special code.
//
// Science vs game:
//   kind / composition / facts  = real science (simplified, but not wrong)
//   hardness … harvest / weak    = game numbers (1–10 scales chosen for play, loosely inspired by reality)
export type ElementSymbol = 'H' | 'C' | 'N' | 'O' | 'Si' | 'Fe' | 'Ca' | 'Al' | 'Cu';

export interface ElementInfo {
  symbol: ElementSymbol;
  z: number;
  nameJa: string;
  fact: string;
}

export const ELEMENTS: Record<ElementSymbol, ElementInfo> = {
  H: { symbol: 'H', z: 1, nameJa: '水素', fact: 'いちばん軽い元素。水（H₂O）や、生き物の体をつくる物質の多くに入っている。' },
  C: { symbol: 'C', z: 6, nameJa: '炭素', fact: '原子1つが最大4本の結合をつくれる。鎖・輪・網などいろいろな形になり、生き物の体の骨組みになる。' },
  N: { symbol: 'N', z: 7, nameJa: '窒素', fact: '空気の約78％。たんぱく質など、生き物の体にも入っている。' },
  O: { symbol: 'O', z: 8, nameJa: '酸素', fact: '地球の岩石の重さのおよそ半分は酸素。水にも、石英にも、さびにも入っている。' },
  Si: { symbol: 'Si', z: 14, nameJa: 'ケイ素', fact: '地球の岩石に酸素の次に多い元素。酸素と結びついて石英（SiO₂）や砂、多くの岩をつくる。' },
  Fe: { symbol: 'Fe', z: 26, nameJa: '鉄', fact: '鉄鉱石（赤鉄鉱 Fe₂O₃ など）から取り出す金属。少しの炭素をまぜると鋼（はがね）になる。' },
  Ca: { symbol: 'Ca', z: 20, nameJa: 'カルシウム', fact: '石灰岩や骨・貝がらに入っている。' },
  Al: { symbol: 'Al', z: 13, nameJa: 'アルミニウム', fact: '地殻に3番目に多い元素。粘土や長石などの鉱物に入っている。' },
  Cu: { symbol: 'Cu', z: 29, nameJa: '銅', fact: '電気と熱をよく通す赤い金属。' },
};

/** what kind of substance it is (real chemistry categories) */
export type MaterialKind = 'element' | 'compound' | 'mixture' | 'alloy' | 'mineral' | 'material' | 'organism' | 'unknown';
export const KIND_JA: Record<MaterialKind, string> = {
  element: '元素（単体）',
  compound: '化合物',
  mixture: '混合物',
  alloy: '合金',
  mineral: '鉱物',
  material: '材料',
  organism: '生き物',
  unknown: '???',
};

export type StatKey = 'cut' | 'impact' | 'pierce';
export type MatState = 'solid' | 'liquid' | 'gas';

export interface MaterialDef {
  id: string;
  nameJa: string;
  kind: MaterialKind;
  /** elements it contains, main ones first. `bonds` = connections Carbon can see with SCAN */
  composition: ElementSymbol[];
  formula?: string;
  bonds?: [ElementSymbol, ElementSymbol][];
  // ── game properties (simplified 0–10) ──
  hardness: number; // how hard it is to break / cut
  toughness: number; // how well it survives use as a tool part
  conductivity: number;
  heatResistance: number;
  flammability: number;
  moisture: number;
  state: MatState;
  /** which tool stats work on it, and how well (multiplier on the tool's number) */
  weak: Partial<Record<StatKey, number>>;
  breakable: boolean;
  /** harvesting: what you need to understand and how strong you must be */
  harvest?: { tier: 0 | 1 | 2; needKnown?: ElementSymbol[]; power?: number };
  facts: string[]; // real science
  gameNote?: string; // how the game uses it (fiction)
  /** never fully revealed in chapter 1 */
  mystery?: boolean;
}

const M = (d: MaterialDef) => d;

export const MATERIALS: Record<string, MaterialDef> = {
  wood: M({
    id: 'wood', nameJa: '木材', kind: 'mixture', composition: ['C', 'H', 'O'], formula: 'セルロース (C₆H₁₀O₅)ₙ など', bonds: [['C', 'C'], ['C', 'O'], ['C', 'H']],
    hardness: 2, toughness: 5, conductivity: 0, heatResistance: 1, flammability: 7, moisture: 3, state: 'solid',
    weak: { cut: 1, impact: 0.6 }, breakable: true, harvest: { tier: 0 },
    facts: ['木はおもにセルロースとリグニンでできた混合物。どれも炭素・水素・酸素の化合物。', 'ねばり強く、柄（え）に向いている。'],
  }),
  stone: M({
    id: 'stone', nameJa: '岩石', kind: 'mixture', composition: ['O', 'Si', 'Al', 'Ca'], formula: 'ケイ酸塩鉱物などの集まり', bonds: [['Si', 'O']],
    hardness: 5, toughness: 4, conductivity: 0, heatResistance: 8, flammability: 0, moisture: 1, state: 'solid',
    weak: { impact: 1, cut: 0.2 }, breakable: true, harvest: { tier: 0 },
    facts: ['ふつうの岩はいくつもの鉱物が混ざった混合物。多くはケイ素と酸素の結びついたケイ酸塩鉱物。'],
  }),
  scrap_metal: M({
    id: 'scrap_metal', nameJa: '金属くず', kind: 'alloy', composition: ['Fe', 'C'], formula: '鋼（鉄＋少量の炭素）', bonds: [['Fe', 'Fe'], ['Fe', 'C']],
    hardness: 6, toughness: 7, conductivity: 7, heatResistance: 7, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 0.5, cut: 0.3 }, breakable: false, harvest: { tier: 0 },
    facts: ['鋼は鉄に少しだけ炭素をまぜた合金。炭素が入ることで、純粋な鉄より硬く強くなる。'],
  }),
  rust: M({
    id: 'rust', nameJa: 'さびた鉄板', kind: 'mixture', composition: ['Fe', 'O', 'H'], formula: 'さび（酸化鉄・水酸化鉄）＋鉄', bonds: [['Fe', 'O']],
    hardness: 4, toughness: 3, conductivity: 4, heatResistance: 6, flammability: 0, moisture: 2, state: 'solid',
    weak: { impact: 0.9 }, breakable: true,
    facts: ['鉄が水と酸素にふれると、さび（酸化鉄など）ができる。もろく、ぼろぼろくずれる。'],
  }),
  water: M({
    id: 'water', nameJa: '水', kind: 'compound', composition: ['H', 'O'], formula: 'H₂O', bonds: [['H', 'O']],
    hardness: 0, toughness: 0, conductivity: 1, heatResistance: 0, flammability: 0, moisture: 10, state: 'liquid',
    weak: {}, breakable: false,
    facts: ['水は水素原子2つと酸素原子1つが結びついた化合物（H₂O）。'],
  }),
  fungus: M({
    id: 'fungus', nameJa: '巨大菌', kind: 'organism', composition: ['C', 'H', 'O', 'N'], formula: 'キチン・たんぱく質などの集まり', bonds: [['C', 'N'], ['C', 'O']],
    hardness: 2, toughness: 3, conductivity: 0, heatResistance: 1, flammability: 3, moisture: 8, state: 'solid',
    weak: { cut: 1, impact: 0.7 }, breakable: true, harvest: { tier: 0 },
    facts: ['キノコ（菌類）の細胞の壁は、エビやカニの殻と同じキチンという物質でできている。'],
    gameNote: '地下の菌は青い根の光を浴びて育つ（この世界の設定）。',
  }),
  fiber: M({
    id: 'fiber', nameJa: '菌糸のひも', kind: 'material', composition: ['C', 'H', 'O', 'N'], formula: 'キチン繊維', bonds: [['C', 'O']],
    hardness: 1, toughness: 6, conductivity: 0, heatResistance: 1, flammability: 4, moisture: 4, state: 'solid',
    weak: { cut: 1 }, breakable: true, harvest: { tier: 0 },
    facts: ['細い糸状の菌糸をより合わせると、丈夫なひもになる。'],
  }),
  dead_root: M({
    id: 'dead_root', nameJa: '枯れた根のかたまり', kind: 'mixture', composition: ['C', 'H', 'O'], formula: 'セルロース・リグニン', bonds: [['C', 'C'], ['C', 'O']],
    hardness: 4, toughness: 6, conductivity: 0, heatResistance: 2, flammability: 6, moisture: 2, state: 'solid',
    weak: { cut: 1, impact: 0.5 }, breakable: true,
    facts: ['植物の繊維は、引っぱりにもたたきにも強い。刃で断つほうがよい。'],
  }),
  quartz: M({
    id: 'quartz', nameJa: '石英', kind: 'mineral', composition: ['Si', 'O'], formula: 'SiO₂', bonds: [['Si', 'O']],
    hardness: 7, toughness: 4, conductivity: 0, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 0.8 }, breakable: true, harvest: { tier: 2, needKnown: ['Si'], power: 6 },
    facts: ['石英はケイ素と酸素がつながった網目状の結晶（SiO₂）。モース硬度7で、鉄のナイフより硬い。', '割れ口は鋭く、昔の人も刃として使った。'],
  }),
  sand: M({
    id: 'sand', nameJa: '石英の砂', kind: 'mixture', composition: ['Si', 'O'], formula: 'おもに SiO₂ の粒', bonds: [['Si', 'O']],
    hardness: 1, toughness: 0, conductivity: 0, heatResistance: 9, flammability: 0, moisture: 1, state: 'solid',
    weak: {}, breakable: false,
    facts: ['多くの砂は、石英の小さな粒が集まった混合物。'],
  }),
  hard_rock: M({
    id: 'hard_rock', nameJa: '硬い岩盤', kind: 'mineral', composition: ['Si', 'O'], formula: '珪岩（石英が固まった岩）', bonds: [['Si', 'O']],
    hardness: 8, toughness: 8, conductivity: 0, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 1, cut: 0.15 }, breakable: true,
    facts: ['珪岩は石英の粒がぎっしり固まった岩。とても硬く、ふつうの石ではかけらも取れない。'],
  }),
  hematite: M({
    id: 'hematite', nameJa: '鉄鉱石', kind: 'mineral', composition: ['Fe', 'O'], formula: 'Fe₂O₃（赤鉄鉱）', bonds: [['Fe', 'O']],
    hardness: 6, toughness: 6, conductivity: 2, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: { impact: 1 }, breakable: true, harvest: { tier: 2, needKnown: ['Fe'], power: 6 },
    facts: ['赤鉄鉱は鉄と酸素の化合物（Fe₂O₃）の鉱物。重く、赤茶色。人はここから鉄を取り出してきた。'],
  }),
  ancient_alloy: M({
    id: 'ancient_alloy', nameJa: '古代の合金', kind: 'alloy', composition: ['Fe', 'Cu'], formula: '???', bonds: [],
    hardness: 9, toughness: 9, conductivity: 8, heatResistance: 9, flammability: 0, moisture: 0, state: 'solid',
    weak: {}, breakable: false, mystery: true,
    facts: ['いくつかの金属を混ぜた合金。何が入っているかは、まだ全部はわからない。'],
  }),
  blue_root: M({
    id: 'blue_root', nameJa: '青い根', kind: 'unknown', composition: [], formula: '???', bonds: [],
    hardness: 10, toughness: 10, conductivity: 0, heatResistance: 10, flammability: 0, moisture: 5, state: 'solid',
    weak: {}, breakable: false, mystery: true,
    facts: ['？？？'],
    gameNote: '中を何かが流れている。光……？',
  }),
  machine: M({
    id: 'machine', nameJa: '古代装置', kind: 'unknown', composition: ['Fe', 'Cu', 'Si'], formula: '???', bonds: [['Si', 'O']],
    hardness: 9, toughness: 9, conductivity: 8, heatResistance: 8, flammability: 0, moisture: 0, state: 'solid',
    weak: {}, breakable: false, mystery: true,
    facts: ['いろいろな材料を組み合わせた装置。だれが、何のために作ったのかはわからない。'],
  }),
  creature: M({
    id: 'creature', nameJa: '生き物', kind: 'organism', composition: ['C', 'H', 'O', 'N'], bonds: [['C', 'C'], ['C', 'H']],
    hardness: 1, toughness: 1, conductivity: 0, heatResistance: 1, flammability: 0, moisture: 7, state: 'solid',
    weak: {}, breakable: false,
    facts: ['生き物の体は、水と、炭素を骨組みにしたたくさんの化合物が集まった混合物。'],
  }),
};

/** an item you can carry. Its "shape" numbers are what free crafting reads. */
export interface ItemDef {
  id: string;
  nameJa: string;
  mat: string;
  length: number; // m
  mass: number; // kg
  edge: number; // 0..1 how sharp the edge is
  point: number; // 0..1 how pointed
  blunt: number; // 0..1 how much a flat striking face it has
  binding?: boolean; // can tie parts together
  color: number;
}
export const ITEMS: Record<string, ItemDef> = {
  stick: { id: 'stick', nameJa: '木の棒', mat: 'wood', length: 1.0, mass: 0.5, edge: 0, point: 0.15, blunt: 0.2, color: 0x8a6a44 },
  pipe: { id: 'pipe', nameJa: '鉄パイプ', mat: 'scrap_metal', length: 1.2, mass: 1.6, edge: 0, point: 0, blunt: 0.4, color: 0x7a7e84 },
  sharp_stone: { id: 'sharp_stone', nameJa: 'とがった石', mat: 'stone', length: 0.16, mass: 0.35, edge: 0.4, point: 0.85, blunt: 0.1, color: 0x8c8580 },
  heavy_stone: { id: 'heavy_stone', nameJa: '重い石', mat: 'stone', length: 0.26, mass: 2.0, edge: 0, point: 0, blunt: 1, color: 0x6e6862 },
  blade: { id: 'blade', nameJa: '金属の刃', mat: 'scrap_metal', length: 0.32, mass: 0.5, edge: 0.9, point: 0.3, blunt: 0, color: 0xa8acb2 },
  fiber: { id: 'fiber', nameJa: '菌糸のひも', mat: 'fiber', length: 0.5, mass: 0.05, edge: 0, point: 0, blunt: 0, binding: true, color: 0xd8c8e8 },
  quartz: { id: 'quartz', nameJa: '石英のかけら', mat: 'quartz', length: 0.22, mass: 0.35, edge: 1, point: 0.9, blunt: 0, color: 0xe8f0ff },
  ore: { id: 'ore', nameJa: '鉄鉱石', mat: 'hematite', length: 0.3, mass: 3.2, edge: 0, point: 0, blunt: 1, color: 0x8a3a2a },
  fungus_stem: { id: 'fungus_stem', nameJa: '菌の茎', mat: 'fungus', length: 1.1, mass: 0.4, edge: 0, point: 0, blunt: 0.2, color: 0xb8a8d8 },
};
