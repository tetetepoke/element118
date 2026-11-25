// All 118 elements: symbol, Japanese name, English name. Atomic number = position + 1.
// Basic data is present for every element from day one so the periodic table layout is final.
// Only elements with `implemented: true` can appear in play.

const RAW =
  'H,水素,Hydrogen;He,ヘリウム,Helium;Li,リチウム,Lithium;Be,ベリリウム,Beryllium;B,ホウ素,Boron;' +
  'C,炭素,Carbon;N,窒素,Nitrogen;O,酸素,Oxygen;F,フッ素,Fluorine;Ne,ネオン,Neon;' +
  'Na,ナトリウム,Sodium;Mg,マグネシウム,Magnesium;Al,アルミニウム,Aluminium;Si,ケイ素,Silicon;P,リン,Phosphorus;' +
  'S,硫黄,Sulfur;Cl,塩素,Chlorine;Ar,アルゴン,Argon;K,カリウム,Potassium;Ca,カルシウム,Calcium;' +
  'Sc,スカンジウム,Scandium;Ti,チタン,Titanium;V,バナジウム,Vanadium;Cr,クロム,Chromium;Mn,マンガン,Manganese;' +
  'Fe,鉄,Iron;Co,コバルト,Cobalt;Ni,ニッケル,Nickel;Cu,銅,Copper;Zn,亜鉛,Zinc;' +
  'Ga,ガリウム,Gallium;Ge,ゲルマニウム,Germanium;As,ヒ素,Arsenic;Se,セレン,Selenium;Br,臭素,Bromine;' +
  'Kr,クリプトン,Krypton;Rb,ルビジウム,Rubidium;Sr,ストロンチウム,Strontium;Y,イットリウム,Yttrium;Zr,ジルコニウム,Zirconium;' +
  'Nb,ニオブ,Niobium;Mo,モリブデン,Molybdenum;Tc,テクネチウム,Technetium;Ru,ルテニウム,Ruthenium;Rh,ロジウム,Rhodium;' +
  'Pd,パラジウム,Palladium;Ag,銀,Silver;Cd,カドミウム,Cadmium;In,インジウム,Indium;Sn,スズ,Tin;' +
  'Sb,アンチモン,Antimony;Te,テルル,Tellurium;I,ヨウ素,Iodine;Xe,キセノン,Xenon;Cs,セシウム,Caesium;' +
  'Ba,バリウム,Barium;La,ランタン,Lanthanum;Ce,セリウム,Cerium;Pr,プラセオジム,Praseodymium;Nd,ネオジム,Neodymium;' +
  'Pm,プロメチウム,Promethium;Sm,サマリウム,Samarium;Eu,ユウロピウム,Europium;Gd,ガドリニウム,Gadolinium;Tb,テルビウム,Terbium;' +
  'Dy,ジスプロシウム,Dysprosium;Ho,ホルミウム,Holmium;Er,エルビウム,Erbium;Tm,ツリウム,Thulium;Yb,イッテルビウム,Ytterbium;' +
  'Lu,ルテチウム,Lutetium;Hf,ハフニウム,Hafnium;Ta,タンタル,Tantalum;W,タングステン,Tungsten;Re,レニウム,Rhenium;' +
  'Os,オスミウム,Osmium;Ir,イリジウム,Iridium;Pt,白金,Platinum;Au,金,Gold;Hg,水銀,Mercury;' +
  'Tl,タリウム,Thallium;Pb,鉛,Lead;Bi,ビスマス,Bismuth;Po,ポロニウム,Polonium;At,アスタチン,Astatine;' +
  'Rn,ラドン,Radon;Fr,フランシウム,Francium;Ra,ラジウム,Radium;Ac,アクチニウム,Actinium;Th,トリウム,Thorium;' +
  'Pa,プロトアクチニウム,Protactinium;U,ウラン,Uranium;Np,ネプツニウム,Neptunium;Pu,プルトニウム,Plutonium;Am,アメリシウム,Americium;' +
  'Cm,キュリウム,Curium;Bk,バークリウム,Berkelium;Cf,カリホルニウム,Californium;Es,アインスタイニウム,Einsteinium;Fm,フェルミウム,Fermium;' +
  'Md,メンデレビウム,Mendelevium;No,ノーベリウム,Nobelium;Lr,ローレンシウム,Lawrencium;Rf,ラザホージウム,Rutherfordium;Db,ドブニウム,Dubnium;' +
  'Sg,シーボーギウム,Seaborgium;Bh,ボーリウム,Bohrium;Hs,ハッシウム,Hassium;Mt,マイトネリウム,Meitnerium;Ds,ダームスタチウム,Darmstadtium;' +
  'Rg,レントゲニウム,Roentgenium;Cn,コペルニシウム,Copernicium;Nh,ニホニウム,Nihonium;Fl,フレロビウム,Flerovium;Mc,モスコビウム,Moscovium;' +
  'Lv,リバモリウム,Livermorium;Ts,テネシン,Tennessine;Og,オガネソン,Oganesson';

export interface ElementInfo {
  z: number;
  symbol: string;
  ja: string;
  en: string;
  /** Periodic-table cell. row 1-7 main table, row 9-10 = lanthanoid / actinoid rows. */
  col: number;
  row: number;
  implemented: boolean;
  /** "結合の手" used by the BOND panel (game rule based on school-level valence). null = no hands (metals etc.). */
  hands: number | null;
  facts: string[];
  properties: string[];
  character?: string;
  /** false = cannot be carried as a "かけら" / used in the つなぐ panel (e.g. Si appears as a party member). */
  carryable: boolean;
  reviewed: boolean;
}

function position(z: number): { col: number; row: number } {
  if (z === 1) return { col: 1, row: 1 };
  if (z === 2) return { col: 18, row: 1 };
  if (z <= 10) return { col: z <= 4 ? z - 2 : z + 8, row: 2 };
  if (z <= 18) return { col: z <= 12 ? z - 10 : z, row: 3 };
  if (z <= 36) return { col: z - 18, row: 4 };
  if (z <= 54) return { col: z - 36, row: 5 };
  if (z <= 86) {
    if (z <= 56) return { col: z - 54, row: 6 };
    if (z <= 71) return { col: z - 57 + 3, row: 9 };
    return { col: z - 68, row: 6 };
  }
  if (z <= 88) return { col: z - 86, row: 7 };
  if (z <= 103) return { col: z - 89 + 3, row: 10 };
  return { col: z - 100, row: 7 };
}

/** Facts for the implemented elements. Written for review: reviewed=false until a human checks them. */
const DETAILS: Record<string, Partial<ElementInfo>> = {
  H: {
    implemented: true,
    hands: 1,
    character: 'hyde',
    properties: ['いちばん軽い元素', '結合の手は1本'],
    facts: [
      '原子番号1。すべての元素の中でいちばん軽い。',
      'ふだんは水素原子が2個結びついたH₂という気体として存在する。',
      '宇宙でいちばん多い元素。',
    ],
  },
  C: {
    implemented: true,
    hands: 4,
    character: 'carbon',
    properties: ['結合の手は4本', 'たくさんの種類の物質をつくる'],
    facts: [
      '原子番号6。結合の手を4本もち、ほかの原子と結びついてとても多くの種類の物質をつくる。',
      '生き物の体をつくる物質の中心になる元素。',
      'ダイヤモンドも黒鉛（鉛筆のしんの材料）も、炭素だけでできている。',
    ],
  },
  O: {
    implemented: true,
    hands: 2,
    character: 'oxy',
    properties: ['結合の手は2本', '物が燃えるのを助ける'],
    facts: [
      '原子番号8。ふだんは酸素原子が2個結びついたO₂という気体として存在する。',
      '空気のおよそ5分の1は酸素。',
      '物が燃えるのを助け、わたしたちは呼吸で酸素を取り入れている。',
    ],
  },
  Si: {
    implemented: true,
    hands: 4,
    character: 'silica',
    carryable: false,
    properties: ['結合の手は4本（炭素と同じ）', '岩や砂の中に多い'],
    facts: [
      '原子番号14。周期表で炭素のすぐ下にあり、炭素と同じく結合の手を4本もつ。',
      '地球の表面近く（地殻）では、酸素の次に多い元素。',
      '自然の中では単体ではほとんど見つからず、二酸化ケイ素（石英や砂の主成分）などとして存在する。',
      'コンピューターのチップや太陽電池をつくる半導体の材料になる。',
    ],
  },
};

export const ELEMENTS: ElementInfo[] = RAW.split(';').map((entry, i) => {
  const [symbol, ja, en] = entry.split(',');
  const z = i + 1;
  const d = DETAILS[symbol] ?? {};
  return {
    z,
    symbol,
    ja,
    en,
    ...position(z),
    implemented: d.implemented ?? false,
    hands: d.hands ?? null,
    facts: d.facts ?? [],
    properties: d.properties ?? [],
    character: d.character,
    carryable: d.carryable ?? true,
    reviewed: false,
  };
});

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function element(symbol: string): ElementInfo {
  const e = BY_SYMBOL.get(symbol);
  if (!e) throw new Error(`unknown element ${symbol}`);
  return e;
}

export function hasElement(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}
