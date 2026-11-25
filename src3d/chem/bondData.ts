// Data-driven BOND for the 3D version. Add elements / recipes / forms / abilities here — no code changes.
// Real science (facts, MaterialProperty) is kept apart from game fiction (gameNotes, Ability).
//
//   Element        an element that can appear (as a partner, an NPC, a mineral...)
//   BondRecipe     Carbon + partner element(s) → a real substance → a BondForm
//   BondForm       Carbon's form while bonded (visual variant + abilities)
//   Ability        what a form can do in the game (fiction), with the real property that inspired it
//   MaterialProperty  a real property of a substance (science)
//   ObstacleSolution  an obstacle can list several ways through (abilities, climbing, routes...)

export interface MaterialProperty {
  id: string;
  label: string; // shown in the codex under "本物の科学"
}

export interface Element {
  symbol: string;
  number: number;
  nameJa: string;
  nameEn: string;
  facts: string[];
  /** Who represents it in the field (a partner character id), if anyone. */
  partner?: string;
}

export interface Substance {
  formula: string;
  nameJa: string;
  nameEn: string;
  structure: 'molecule' | 'network' | 'metal' | 'ionic';
  properties: string[]; // MaterialProperty ids (real)
  facts: string[]; // real science
}

export interface BondRecipe {
  id: string;
  /** Carbon is always one side; the other inputs are partner elements. */
  inputs: string[];
  substance: Substance;
  form: string; // BondForm id
}

export interface Ability {
  id: string;
  name: string;
  description: string; // game rule
  /** Real MaterialProperty ids that inspired it (for the codex — inspiration, not a claim). */
  motif: string[];
  /** Obstacle tags it can clear. */
  breaks?: string[];
  passes?: string[];
}

export interface BondForm {
  id: string;
  name: string;
  partner: string; // partner character id that merges in
  visual: string; // visual variant key for the character model
  abilities: string[];
  gameNotes: string[]; // fiction, always shown apart from facts
}

export interface ObstacleSolution {
  kind: 'ability' | 'climb' | 'route' | 'device';
  ability?: string;
  note: string;
  available: boolean; // false = planned for later versions
}

export const PROPERTIES: Record<string, MaterialProperty> = {
  hardness: { id: 'hardness', label: '高い硬度（とても硬い）' },
  wear_resistance: { id: 'wear_resistance', label: '耐摩耗性（すり減りにくい）' },
  heat_resistance: { id: 'heat_resistance', label: '耐熱性（高い温度に強い）' },
  semiconductor: { id: 'semiconductor', label: '半導体の性質' },
};

export const ELEMENTS: Record<string, Element> = {
  C: { symbol: 'C', number: 6, nameJa: '炭素', nameEn: 'Carbon', facts: ['原子番号6。結合の手は4本。', '生き物の体をつくる物質の中心になる元素。'] },
  Si: {
    symbol: 'Si', number: 14, nameJa: 'ケイ素', nameEn: 'Silicon', partner: 'silica',
    facts: ['原子番号14。炭素と同じく結合の手は4本。', '地殻に酸素の次に多い。石英や砂（二酸化ケイ素）にふくまれる。', '半導体の材料になる。'],
  },
  // future partners: H, O, Fe, Cu ... (add here)
};

export const RECIPES: BondRecipe[] = [
  {
    id: 'c_si',
    inputs: ['Si'],
    form: 'sic',
    substance: {
      formula: 'SiC',
      nameJa: '炭化ケイ素',
      nameEn: 'Silicon carbide',
      structure: 'network',
      properties: ['hardness', 'wear_resistance', 'heat_resistance', 'semiconductor'],
      facts: [
        'ケイ素と炭素が1：1で結びついた化合物。',
        '分子ではなく、原子が網目のようにどこまでもつながった「共有結合の結晶」。',
        'とても硬く、研磨剤（物をけずる道具）に使われる。',
        '高温に強く、パワー半導体の材料にもなる。',
      ],
    },
  },
];

export const ABILITIES: Record<string, Ability> = {
  hard_break: {
    id: 'hard_break',
    name: 'HARD BREAK',
    description: 'ふつうでは壊せない硬い岩を砕く。',
    motif: ['hardness', 'wear_resistance'],
    breaks: ['hard_rock'],
  },
};

export const FORMS: Record<string, BondForm> = {
  sic: {
    id: 'sic',
    name: 'SiC FORM',
    partner: 'silica',
    visual: 'sic',
    abilities: ['hard_break'],
    gameNotes: [
      'SiC FORM は、カーボンとシリカが力を合わせたゲームの中の架空の姿。',
      'HARD BREAK は、本物のSiCの「硬さ」「すり減りにくさ」をモチーフにした能力。',
      '本物の人がSiCになったり、パンチで岩を砕けるようになったりはしない。',
    ],
  },
};

/** Ways through each obstacle — the design goal is several per obstacle. */
export const OBSTACLE_SOLUTIONS: Record<string, ObstacleSolution[]> = {
  hard_rock_gorge: [
    { kind: 'ability', ability: 'hard_break', note: 'SiC FORM の HARD BREAK で砕く', available: true },
    { kind: 'climb', note: '崖を登って上から回りこむ（崖登りとスタミナは今後）', available: false },
    { kind: 'device', note: '別の元素で古代装置を動かす（今後）', available: false },
  ],
};

export function recipeFor(partnerElement: string): BondRecipe | undefined {
  return RECIPES.find((r) => r.inputs.length === 1 && r.inputs[0] === partnerElement);
}
