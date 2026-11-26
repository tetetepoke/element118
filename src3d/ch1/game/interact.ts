// The one rule engine for "what happens when this power meets this material".
// Tools, BOND abilities and bare hands all become a Power; materials say what they are weak to.
import { MATERIALS, type MaterialDef, type StatKey } from './materials';
import { level, type KnowledgeState } from './knowledge';

export interface Power {
  cut: number;
  impact: number;
  pierce: number;
  source: string; // shown to the player: 'すで' / tool name / 'SiC FORM'
}

export const HANDS: Power = { cut: 0, impact: 1, pierce: 0, source: '素手' };

/** the best way this power can work on the material */
export function effect(m: MaterialDef, p: Power): { stat: StatKey | null; value: number } {
  let stat: StatKey | null = null, value = 0;
  for (const k of ['cut', 'impact', 'pierce'] as StatKey[]) {
    const v = (p[k] ?? 0) * (m.weak[k] ?? 0);
    if (v > value) { value = v; stat = k; }
  }
  return { stat, value };
}

export function canBreak(matId: string, p: Power) {
  const m = MATERIALS[matId];
  const e = effect(m, p);
  return { ok: m.breakable && e.value >= m.hardness, ...e, need: m.hardness };
}

export type HarvestCheck = { ok: true } | { ok: false; why: string };

export function canHarvest(k: KnowledgeState, matId: string, p: Power): HarvestCheck {
  const m = MATERIALS[matId];
  const h = m.harvest;
  if (!h) return { ok: false, why: 'これは取れない。' };
  if (!k.harvest) return { ok: false, why: 'どうやって取ればいいのか、まだわからない。' };
  if (h.needKnown?.some((s) => level(k, s) < 2)) return { ok: false, why: 'これが何でできているか、まだ理解できていない。' };
  if (h.power && Math.max(p.impact, p.cut) < h.power) return { ok: false, why: '硬すぎて、今の力ではかけらも取れない。' };
  return { ok: true };
}

export const STAT_JA: Record<StatKey, string> = { cut: '切る', impact: 'たたく', pierce: '突く' };
