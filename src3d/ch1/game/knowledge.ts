// What Carbon understands. The world starts as UNKNOWN; scanning and meeting elements raise it.
// Element levels: 0 = "???" (not even noticed), 1 = "Si ?" (sensed, not understood), 2 = understood.
import { ELEMENTS, MATERIALS, KIND_JA, type ElementSymbol, type MaterialDef } from './materials';

export interface KnowledgeState {
  scan: boolean; // MATERIAL SCAN unlocked
  harvest: boolean;
  create: boolean;
  bond: boolean;
  breakSkill: boolean;
  el: Partial<Record<ElementSymbol, 0 | 1 | 2>>;
  scanned: string[]; // material ids scanned
}

export const newKnowledge = (): KnowledgeState => ({ scan: false, harvest: false, create: false, bond: false, breakSkill: false, el: {}, scanned: [] });

export function level(k: KnowledgeState, s: ElementSymbol) {
  return k.el[s] ?? 0;
}

/** what the SCAN unlock gives: Carbon knows himself, and senses the common elements around him */
export function unlockScan(k: KnowledgeState) {
  k.scan = true;
  k.el.C = 2;
  for (const s of ['O', 'Si', 'Fe', 'H'] as ElementSymbol[]) if (level(k, s) < 1) k.el[s] = 1;
}

/**
 * Rules for "understanding" an element by noticing connections: the same element turning up
 * in different things. Returns symbols newly understood.
 */
const UNDERSTAND_RULES: { el: ElementSymbol; need: string[][]; text: string }[] = [
  { el: 'O', need: [['water', 'stone'], ['water', 'rust'], ['stone', 'rust']], text: '水にも、石にも、さびにも同じものが入っている。……O、酸素。' },
  { el: 'H', need: [['water', 'wood'], ['water', 'fungus']], text: '水と、木（菌）に共通するもの。とても小さくて軽い……H、水素。' },
  { el: 'Fe', need: [['scrap_metal', 'rust'], ['scrap_metal', 'hematite'], ['rust', 'hematite']], text: '金属くずと、さびた鉄板。どちらにも同じ金属の原子……Fe、鉄。' },
];

export function noteScan(k: KnowledgeState, matId: string): { el: ElementSymbol; text: string }[] {
  if (!k.scanned.includes(matId)) k.scanned.push(matId);
  const out: { el: ElementSymbol; text: string }[] = [];
  for (const r of UNDERSTAND_RULES) {
    if (level(k, r.el) >= 2) continue;
    if (r.need.some((pair) => pair.every((m) => k.scanned.includes(m)))) {
      k.el[r.el] = 2;
      out.push({ el: r.el, text: r.text });
    }
  }
  return out;
}

export function elementLabel(k: KnowledgeState, s: ElementSymbol) {
  const lv = level(k, s);
  if (lv === 0) return '???';
  if (lv === 1) return `${s} ?`;
  return `${s}（${ELEMENTS[s].nameJa}）`;
}

export interface ScanView {
  title: string;
  kind: string;
  formula: string;
  parts: { label: string; lv: number }[];
  bonds: string[];
  props: { label: string; v: number }[];
  facts: string[];
  note?: string;
  unknown: boolean;
}

/** what the scan panel shows for a material, given what Carbon understands now */
export function scanView(k: KnowledgeState, m: MaterialDef): ScanView {
  if (!k.scan) {
    return { title: 'UNKNOWN', kind: '???', formula: '', parts: [], bonds: [], props: [], facts: ['……なんだろう。よくわからない。'], unknown: true };
  }
  const parts = m.composition.map((s) => ({ label: elementLabel(k, s), lv: level(k, s) }));
  // composition the scan cannot read yet shows as extra ??? rows
  const hidden = m.mystery ? 2 : parts.filter((p) => p.lv === 0).length ? 1 : 0;
  for (let i = 0; i < hidden; i++) parts.push({ label: '???', lv: 0 });
  const known = (s: ElementSymbol) => level(k, s) >= 1;
  const bonds = (m.bonds ?? []).map(([a, b]) => `${known(a) ? a : '?'} ─ ${known(b) ? b : '?'}`);
  const understoodAll = m.composition.length > 0 && m.composition.slice(0, 2).every((s) => level(k, s) >= 2);
  const title = m.mystery ? `${m.nameJa}（UNKNOWN）` : m.nameJa;
  return {
    title,
    kind: m.mystery ? '???' : KIND_JA[m.kind],
    formula: understoodAll && !m.mystery ? m.formula ?? '' : m.formula ? '？？？' : '',
    parts,
    bonds,
    props: [
      { label: 'かたさ', v: m.hardness },
      { label: 'ねばり', v: m.toughness },
      { label: '電気・熱を通す', v: m.conductivity },
      { label: '熱に強い', v: m.heatResistance },
      { label: '燃えやすさ', v: m.flammability },
      { label: 'しめりけ', v: m.moisture },
    ],
    facts: understoodAll || !m.mystery ? m.facts : ['？？？'],
    note: m.gameNote,
    unknown: !!m.mystery,
  };
}

export function discoveredCount(k: KnowledgeState) {
  return Object.values(k.el).filter((v) => (v ?? 0) >= 2).length;
}

export { MATERIALS };
