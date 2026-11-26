// Free tool making. A tool is parts in slots (handle / head / binding). Its numbers are computed
// from the parts' shape and material — there is no recipe list. The same function works for any
// future part (new slots can be added to ToolDesign.parts later).
import * as THREE from 'three';
import { ITEMS, MATERIALS, type ItemDef, type StatKey } from './materials';

export interface ToolDesign {
  handle: string | null;
  head: string | null;
  binding: string | null;
}
export interface ToolStats {
  reach: number;
  cut: number;
  pierce: number;
  impact: number;
  weight: number;
  durability: number;
}
export interface Tool {
  design: ToolDesign;
  stats: ToolStats;
  name: string;
  uses: number; // left
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function toolStats(d: ToolDesign): ToolStats | null {
  const head = d.head ? ITEMS[d.head] : null;
  const handle = d.handle ? ITEMS[d.handle] : null;
  const bind = d.binding ? ITEMS[d.binding] : null;
  if (!head && !handle) return null;
  // a handle alone is a stick: it can poke and knock a little
  const h: ItemDef = head ?? handle!;
  const hm = MATERIALS[h.mat];
  const lever = head && handle ? handle.length : 0.35; // a head held in the hand has no lever
  const hard = hm.hardness / 5;
  const weight = (head?.mass ?? 0) + (handle?.mass ?? 0);
  const reach = 0.6 + (head && handle ? handle.length * 0.9 + head.length * 0.4 : h.length * 0.6);
  const impact = h.mass * (0.5 + h.blunt) * (0.5 + lever) * hard;
  const cut = h.edge * hm.hardness * (0.55 + lever * 0.45);
  const pierce = h.point * hm.hardness * (0.45 + lever * 0.55);
  // the weakest part and how well they are tied decide how long it lasts
  const toughs = [hm.toughness, handle ? MATERIALS[handle.mat].toughness : 10];
  const tied = head && handle ? (bind ? 1.6 : 0.7) : 1;
  const durability = Math.min(...toughs) * tied * 3;
  return { reach: r1(reach), cut: r1(cut), pierce: r1(pierce), impact: r1(impact), weight: r1(weight), durability: Math.max(3, Math.round(durability)) };
}

export function bestStat(s: ToolStats): StatKey {
  const e: [StatKey, number][] = [['cut', s.cut], ['impact', s.impact], ['pierce', s.pierce]];
  return e.sort((a, b) => b[1] - a[1])[0][0];
}

/** a name the game gives to what you made (the player decided the shape; the game just describes it) */
export function toolName(d: ToolDesign, s: ToolStats) {
  const b = bestStat(s);
  if (!d.head || !d.handle) {
    if (!d.head) return '棒';
    return b === 'impact' ? '手で持つ石（たたく）' : b === 'cut' ? '手で持つ刃' : '手で持つとがり';
  }
  if (b === 'impact') return 'ハンマーのような道具';
  if (b === 'cut') return s.cut >= 4 ? '斧のような切断工具' : 'なたのような道具';
  return '槍のような道具';
}

export function makeTool(d: ToolDesign): Tool | null {
  const s = toolStats(d);
  if (!s) return null;
  return { design: { ...d }, stats: s, name: toolName(d, s), uses: s.durability };
}

/** simple 3D look of a tool, built from its parts (swap for real models later) */
export function toolMesh(d: ToolDesign) {
  const g = new THREE.Group();
  const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: c === 0xa8acb2 || c === 0x7a7e84 ? 0.5 : 0 });
  const handle = d.handle ? ITEMS[d.handle] : null;
  const head = d.head ? ITEMS[d.head] : null;
  let top = 0;
  if (handle) {
    const L = handle.length * 0.7;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, L, 6), std(handle.color));
    m.position.y = L / 2 - 0.12;
    g.add(m);
    top = L - 0.12;
  }
  if (head) {
    let geo: THREE.BufferGeometry;
    const s = 0.6 + head.mass * 0.15;
    if (head.blunt > 0.6) geo = new THREE.DodecahedronGeometry(0.08 * s, 0);
    else if (head.edge > head.point) geo = new THREE.BoxGeometry(0.03, 0.12 * s, 0.16 * s);
    else geo = new THREE.ConeGeometry(0.045 * s, 0.18 * s, 5);
    const m = new THREE.Mesh(geo, std(head.color));
    m.position.y = top + 0.04;
    if (head.edge > head.point && head.blunt <= 0.6) m.position.z = 0.06;
    g.add(m);
    if (d.binding && handle) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.012, 5, 8), std(ITEMS[d.binding].color));
      b.rotation.x = Math.PI / 2;
      b.position.y = top - 0.03;
      g.add(b);
    }
  }
  g.rotation.x = Math.PI / 2; // held pointing forward
  g.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  return g;
}
