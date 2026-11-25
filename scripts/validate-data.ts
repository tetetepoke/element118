// Build-time data checks (design doc §6 and §0 rules). Fails the build on any problem.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ELEMENTS, element } from '../src/data/elements';
import { SUBSTANCES, REACTIONS, compositionKey, substanceByComposition } from '../src/data/substances';
import { tryCovalent } from '../src/chem/bonding';

const MAX_SLOTS = 3;
const errors: string[] = [];
const err = (m: string) => errors.push(m);

// 1. Elements: 118 unique entries, Z = 1..118.
if (ELEMENTS.length !== 118) err(`elements: expected 118, got ${ELEMENTS.length}`);
const syms = new Set<string>();
ELEMENTS.forEach((e, i) => {
  if (e.z !== i + 1) err(`element ${e.symbol}: z ${e.z} != ${i + 1}`);
  if (syms.has(e.symbol)) err(`element symbol duplicated: ${e.symbol}`);
  syms.add(e.symbol);
  if (!e.ja || !e.en) err(`element ${e.symbol}: missing name`);
  if (e.implemented && e.facts.length === 0) err(`element ${e.symbol}: implemented but has no facts`);
});
const cells = new Set(ELEMENTS.map((e) => `${e.col},${e.row}`));
if (cells.size !== 118) err('periodic table: two elements share a cell');

// 2. Substances.
const keys = new Set<string>();
for (const s of SUBSTANCES) {
  for (const sym of Object.keys(s.composition)) if (!syms.has(sym)) err(`${s.id}: unknown element ${sym}`);
  const k = compositionKey(s.composition);
  if (keys.has(k) && s.category !== 'mixture') err(`${s.id}: composition ${k} duplicated`);
  keys.add(k);
  if (s.category === 'mixture' && s.formula !== null) err(`${s.id}: mixtures/alloys must not have a formula`);
  if (s.category !== 'mixture' && !s.formula) err(`${s.id}: missing formula`);
  if (!s.pubchemCid) err(`${s.id}: missing PubChem CID (real-substance check)`);
  if (s.facts.length === 0) err(`${s.id}: no facts`);
  if (s.category === 'element_bond' && Object.keys(s.composition).length !== 1) err(`${s.id}: element_bond must be one element`);
  // atoms list must match composition
  const fromAtoms: Record<string, number> = {};
  s.atoms.forEach((a) => (fromAtoms[a] = (fromAtoms[a] ?? 0) + 1));
  if (compositionKey(fromAtoms) !== k) err(`${s.id}: atoms list does not match composition`);
  // structure drawing must satisfy the hands rule
  const used = s.atoms.map(() => 0);
  s.bonds.forEach(([a, b, o]) => {
    used[a] += o;
    used[b] += o;
  });
  s.atoms.forEach((a, i) => {
    const h = element(a).hands;
    if (s.bondType === 'covalent' && h !== null && used[i] !== h) err(`${s.id}: atom ${a}#${i} uses ${used[i]} hands, expected ${h}`);
  });
  if (s.implemented) {
    for (const sym of Object.keys(s.composition)) if (!element(sym).implemented) err(`${s.id}: implemented but uses unimplemented ${sym}`);
  }
}

// 3. Every combination the hands rule accepts must be a registered, real substance.
const covalentElems = ELEMENTS.filter((e) => e.implemented && e.hands !== null).map((e) => e.symbol);
function multisets(size: number, from: number, acc: string[], out: string[][]) {
  if (acc.length === size) return void out.push(acc.slice());
  for (let i = from; i < covalentElems.length; i++) {
    acc.push(covalentElems[i]);
    multisets(size, i, acc, out);
    acc.pop();
  }
}
let accepted = 0;
for (let size = 2; size <= MAX_SLOTS; size++) {
  const out: string[][] = [];
  multisets(size, 0, [], out);
  for (const combo of out) {
    const r = tryCovalent(combo, (s) => element(s).hands);
    if (!r.ok) continue;
    accepted++;
    const c: Record<string, number> = {};
    combo.forEach((s) => (c[s] = (c[s] ?? 0) + 1));
    if (!substanceByComposition(c)) err(`hands rule accepts ${combo.join('+')} but no real substance is registered for it`);
  }
}

// 4. Reactions: balanced when an equation is given.
const subById = new Map(SUBSTANCES.map((s) => [s.id, s]));
for (const r of REACTIONS) {
  if (r.facts.length === 0) err(`${r.id}: no facts`);
  if (!r.equation) continue;
  const count = (terms: { id: string; n: number }[]) => {
    const c: Record<string, number> = {};
    for (const t of terms) {
      const s = subById.get(t.id);
      const comp = s ? s.composition : syms.has(t.id) ? { [t.id]: 1 } : null;
      if (!comp) {
        err(`${r.id}: unknown term ${t.id}`);
        continue;
      }
      for (const [k, v] of Object.entries(comp)) c[k] = (c[k] ?? 0) + v * t.n;
    }
    return compositionKey(c);
  };
  if (count(r.reactants) !== count(r.products)) err(`${r.id}: equation is not balanced`);
}

// 5. Only src/core/storage.ts may use localStorage (keeps every key under "element118.").
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk('src')) {
  if (!/\.(ts|js)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (file.replace(/\\/g, '/').endsWith('src/core/storage.ts')) {
    if (/localStorage\.clear|\.clear\(\)/.test(text)) err('storage.ts must never call clear()');
    continue;
  }
  if (/localStorage|sessionStorage|indexedDB/.test(text)) err(`${file}: storage access outside src/core/storage.ts`);
}

// 6. Character design reference (docs/CHARACTER_DESIGN.md): kept byte-for-byte and never shipped.
//    Only the tracing scripts (scripts/trace-*.py) may open it, read-only, as an underdrawing.
const REF = 'art/reference/character-design-reference.png';
const REF_SHA256 = '2b09ca700caeadd5911caccf699a352c03318cd6a7a504a56fe78011aec2eeba';
if (!existsSync(REF)) err(`${REF} is missing`);
else if (createHash('sha256').update(readFileSync(REF)).digest('hex') !== REF_SHA256)
  err(`${REF} has been changed (re-encoded, resized or overwritten). Restore the original PNG.`);
for (const file of [...walk('src'), ...walk('scripts'), ...walk('public'), 'index.html', 'vite.config.ts']) {
  if (!/\.(ts|js|mjs|py|html|json)$/.test(file) || file.endsWith('validate-data.ts')) continue;
  if (/scripts[\\/]trace-[\w-]+\.py$/.test(file)) continue;
  if (/character-design-reference/.test(readFileSync(file, 'utf8'))) err(`${file}: the design reference may only be read by scripts/trace-*.py`);
}
for (const file of walk('public')) {
  if (/\.png$/.test(file) && createHash('sha256').update(readFileSync(file)).digest('hex') === REF_SHA256)
    err(`${file}: copy of the design reference inside public/`);
}

if (errors.length) {
  console.error('DATA VALIDATION FAILED');
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log(`data ok: 118 elements, ${SUBSTANCES.length} substances, ${REACTIONS.length} reactions, ${accepted} combinations accepted by the hands rule (all registered)`);
