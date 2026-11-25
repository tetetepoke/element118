// Substances and reactions. The four kinds of "合わさり方" are kept apart (design doc §0, §5):
//   element_bond : 同じ元素どうしの結合（H₂, O₂）            → つなぐ
//   compound     : 分子・化合物（covalent: H₂O, CO₂ / ionic） → つなぐ・わたす
//   mixture      : 混合物・合金（formula is always null）      → まぜる   (not in stage 1)
//   reaction     : 化学反応（conditions + balanced equation）  → 反応

export type Category = 'element_bond' | 'compound' | 'mixture';
export type BondType = 'covalent' | 'ionic';

export interface Substance {
  id: string;
  category: Category;
  bondType?: BondType;
  /** Display formula with subscripts. null for mixtures and alloys (no fixed formula). */
  formula: string | null;
  composition: Record<string, number>;
  /** Bonds for the structure drawing: [atomIndexA, atomIndexB, order]. Atoms listed in `atoms`. */
  atoms: string[];
  bonds: [number, number, number][];
  /** Bond angle in degrees for 3-atom molecules (centre = atoms[0]). */
  angle?: number;
  name: { ja: string; en: string };
  state: string;
  /** Short property labels used in the "性質の比較" panel. */
  properties: string[];
  /** Game effects (world interactions). */
  effects: string[];
  break: { allowed: boolean; realMethod?: string };
  facts: string[];
  /** Simplifications made for the game, shown under a "ゲームのルール" label. */
  gameNotes: string[];
  /** Safety lines, shown with a warning style. */
  dangers: string[];
  /** "ほんとうは？" — how it really forms. */
  realProcess?: string;
  ceremony: 'medium' | 'big';
  pubchemCid: number;
  /** Discoverable in the current stage. */
  implemented: boolean;
  reviewed: boolean;
}

export const SUBSTANCES: Substance[] = [
  {
    id: 'h2',
    category: 'element_bond',
    bondType: 'covalent',
    formula: 'H₂',
    composition: { H: 2 },
    atoms: ['H', 'H'],
    bonds: [[0, 1, 1]],
    name: { ja: '水素', en: 'Hydrogen' },
    state: '気体',
    properties: ['空気より軽い気体', '非常に燃えやすい'],
    effects: ['fill_buoyancy_device'],
    break: { allowed: true, realMethod: '高温などで原子に分かれる' },
    facts: ['水素原子2個が、手を1本ずつ使ってつながった分子。', '空気より軽い気体。', '非常に燃えやすい。'],
    gameNotes: ['ゲームに出てくる「古代の浮力装置」は架空の装置です。'],
    dangers: ['現実でまねしないこと。水素は火がつくと爆発的に燃えることがあり、とても危険です。'],
    ceremony: 'medium',
    pubchemCid: 783,
    implemented: true,
    reviewed: false,
  },
  {
    id: 'o2',
    category: 'element_bond',
    bondType: 'covalent',
    formula: 'O₂',
    composition: { O: 2 },
    atoms: ['O', 'O'],
    bonds: [[0, 1, 2]],
    name: { ja: '酸素', en: 'Oxygen' },
    state: '気体',
    properties: ['気体', '物が燃えるのを助ける'],
    effects: ['feed_fire'],
    break: { allowed: true, realMethod: '高温などで原子に分かれる' },
    facts: [
      '酸素原子2個が、手を2本ずつ使ってつながった分子（二重結合）。',
      '物が燃えるのを助ける気体。空気のおよそ5分の1をしめる。',
    ],
    gameNotes: [],
    dangers: ['火のそばで酸素を増やすと、炎が急に大きくなって危険です。'],
    ceremony: 'medium',
    pubchemCid: 977,
    implemented: true,
    reviewed: false,
  },
  {
    id: 'h2o',
    category: 'compound',
    bondType: 'covalent',
    formula: 'H₂O',
    composition: { H: 2, O: 1 },
    atoms: ['O', 'H', 'H'],
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
    ],
    angle: 104.5,
    name: { ja: '水', en: 'Water' },
    state: '液体',
    properties: ['ふつうの温度では液体', '火を消す'],
    effects: ['extinguish'],
    break: { allowed: true, realMethod: '電気分解' },
    facts: [
      '水素原子2個と酸素原子1個が結合した分子。',
      '酸素の2本の手に、水素が1つずつつながっている。',
      '分子は折れ曲がった形をしている（角度は約104.5°）。',
    ],
    gameNotes: ['ゲームではカーボンの力で、原子がその場で静かに結合します。'],
    dangers: [],
    realProcess:
      '現実では、水素（H₂）と酸素（O₂）を反応させると激しく燃えて水ができる：2H₂ ＋ O₂ → 2H₂O。とても危険なので、まねしてはいけない。',
    ceremony: 'big',
    pubchemCid: 962,
    implemented: true,
    reviewed: false,
  },
  {
    // Exists so the "hands rule" never produces an unregistered molecule (validator).
    // Not obtainable in stage 1 (no C atoms can be carried yet).
    id: 'co2',
    category: 'compound',
    bondType: 'covalent',
    formula: 'CO₂',
    composition: { C: 1, O: 2 },
    atoms: ['C', 'O', 'O'],
    bonds: [
      [0, 1, 2],
      [0, 2, 2],
    ],
    angle: 180,
    name: { ja: '二酸化炭素', en: 'Carbon dioxide' },
    state: '気体',
    properties: ['気体', '燃えない'],
    effects: ['extinguish'],
    break: { allowed: true, realMethod: '特別な装置や植物の光合成など' },
    facts: ['炭素の4本の手に、酸素が2本ずつつながった分子。', '物を燃やさない気体で、火を消すのに使われることがある。'],
    gameNotes: [],
    dangers: [],
    ceremony: 'medium',
    pubchemCid: 280,
    implemented: false,
    reviewed: false,
  },
];

export interface ReactionTerm {
  id: string; // substance id, element symbol, or a generic label
  n: number;
}

export interface Reaction {
  id: string;
  name: { ja: string; en: string };
  reactants: ReactionTerm[];
  products: ReactionTerm[];
  /** Display equation. null when the reaction is generic (e.g. burning plants of mixed composition). */
  equation: string | null;
  conditions: string[];
  facts: string[];
  gameNotes: string[];
  dangers: string[];
  implemented: boolean;
  reviewed: boolean;
}

export const REACTIONS: Reaction[] = [
  {
    id: 'combustion',
    name: { ja: '燃焼', en: 'Combustion' },
    reactants: [],
    products: [],
    equation: null,
    conditions: ['火', '酸素'],
    facts: [
      '物質が酸素と結びつき、熱と光を出しながら別の物質に変わる反応。',
      '枯れた植物には炭素などがふくまれていて、燃えると二酸化炭素や水などに変わる。',
      '燃えたあとの物質は、元の物質とは別の物質になっている。',
    ],
    gameNotes: ['ゲームでは、たいまつに酸素を送るとイバラが一気に燃えます。'],
    dangers: ['火遊びは絶対にしないこと。'],
    implemented: true,
    reviewed: false,
  },
  {
    // The real-world process behind water. Shown in the codex as "ほんとうは？"; not triggered in play.
    id: 'h2_o2',
    name: { ja: '水素の燃焼（水ができる反応）', en: 'Hydrogen combustion' },
    reactants: [
      { id: 'h2', n: 2 },
      { id: 'o2', n: 1 },
    ],
    products: [{ id: 'h2o', n: 2 }],
    equation: '2H₂ ＋ O₂ → 2H₂O',
    conditions: ['火花などのきっかけ'],
    facts: ['水素と酸素が反応すると、激しく燃えて水ができる。'],
    gameNotes: [],
    dangers: ['爆発的に反応することがあり、とても危険。まねしないこと。'],
    implemented: false,
    reviewed: false,
  },
];

const BY_ID = new Map(SUBSTANCES.map((s) => [s.id, s]));
export function substance(id: string): Substance {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown substance ${id}`);
  return s;
}
export function reaction(id: string): Reaction {
  const r = REACTIONS.find((x) => x.id === id);
  if (!r) throw new Error(`unknown reaction ${id}`);
  return r;
}

export function compositionKey(c: Record<string, number>): string {
  return Object.keys(c)
    .sort()
    .map((k) => `${k}${c[k]}`)
    .join('');
}

const BY_COMPOSITION = new Map(SUBSTANCES.map((s) => [compositionKey(s.composition), s]));
export function substanceByComposition(c: Record<string, number>): Substance | undefined {
  return BY_COMPOSITION.get(compositionKey(c));
}

export const KIND_LABEL: Record<string, string> = {
  element_bond: '元素同士の結合',
  covalent: '分子（共有結合）',
  ionic: '化合物（イオン結合）',
  mixture: '混合物・合金',
  reaction: '化学反応',
};

export function kindOf(s: Substance): string {
  if (s.category === 'element_bond') return 'element_bond';
  if (s.category === 'compound') return s.bondType ?? 'covalent';
  return 'mixture';
}
