// "つなぐ" (covalent) rule: a molecule forms only when every atom's "結合の手" is used.
// Atoms are joined into a tree (no rings, matching the 3-slot prototype); a bond may use
// 1, 2 or 3 hands on each side (single / double / triple bond).
// This is a school-level simplification (valence). Exceptions exist and are noted in the codex.

export interface BondAttempt {
  ok: boolean;
  /** [i, j, order] between atom indices. Best arrangement found (also for failures). */
  bonds: [number, number, number][];
  /** Unused hands per atom in that arrangement. */
  free: number[];
  reason?: 'too_few' | 'no_hands' | 'free_hands';
}

export type HandsOf = (symbol: string) => number | null;

export function tryCovalent(symbols: string[], handsOf: HandsOf): BondAttempt {
  const n = symbols.length;
  const hands = symbols.map((s) => handsOf(s));
  if (n < 2) return { ok: false, bonds: [], free: hands.map((h) => h ?? 0), reason: 'too_few' };
  if (hands.some((h) => h === null)) return { ok: false, bonds: [], free: hands.map((h) => h ?? 0), reason: 'no_hands' };
  const cap = hands as number[];

  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);

  let best: { bonds: [number, number, number][]; free: number[]; used: number } | null = null;
  const orders = new Array(pairs.length).fill(0);

  const evaluate = () => {
    const used = new Array(n).fill(0);
    const edges: [number, number, number][] = [];
    for (let p = 0; p < pairs.length; p++) {
      const o = orders[p];
      if (!o) continue;
      const [i, j] = pairs[p];
      used[i] += o;
      used[j] += o;
      edges.push([i, j, o]);
    }
    for (let i = 0; i < n; i++) if (used[i] > cap[i]) return;
    if (edges.length > n - 1) return; // would contain a ring
    if (hasCycle(n, edges)) return;
    const total = used.reduce((a, b) => a + b, 0);
    const free = cap.map((c, i) => c - used[i]);
    const connected = edges.length === n - 1;
    const score = total + (connected ? 0.5 : 0);
    if (!best || score > best.used) best = { bonds: edges, free, used: score };
  };

  const rec = (p: number) => {
    if (p === pairs.length) return evaluate();
    for (let o = 0; o <= 3; o++) {
      orders[p] = o;
      rec(p + 1);
    }
    orders[p] = 0;
  };
  rec(0);

  const b = best as { bonds: [number, number, number][]; free: number[] } | null;
  if (!b) return { ok: false, bonds: [], free: cap.slice(), reason: 'free_hands' };
  const ok = b.bonds.length === n - 1 && b.free.every((f) => f === 0);
  return { ok, bonds: b.bonds, free: b.free, reason: ok ? undefined : 'free_hands' };
}

function hasCycle(n: number, edges: [number, number, number][]): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return true;
    parent[ra] = rb;
  }
  return false;
}

export function composition(symbols: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const s of symbols) c[s] = (c[s] ?? 0) + 1;
  return c;
}

/** Japanese explanation for a failed attempt, e.g. "Oの手がまだ1本余っている". */
export function explainFailure(symbols: string[], a: BondAttempt): string {
  if (a.reason === 'too_few') return '原子が1つだけでは、結合する相手がいない。';
  if (a.reason === 'no_hands') return 'この元素は「手をつなぐ」結合が苦手みたいだ。';
  const parts: string[] = [];
  const seen = new Set<string>();
  symbols.forEach((s, i) => {
    if (a.free[i] > 0 && !seen.has(s)) {
      const total = symbols.reduce((acc, t, k) => acc + (t === s ? a.free[k] : 0), 0);
      parts.push(`${s}の手が${total}本`);
      seen.add(s);
    }
  });
  if (!parts.length) return 'うまくつながらなかった。';
  return `${parts.join('、')}、まだ余っている。このままでは安定しない。`;
}
