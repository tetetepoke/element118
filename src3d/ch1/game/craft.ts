// Free tool making. A tool is parts in slots (handle / head / binding). Its numbers are computed
// from the parts' shape and material — there is no recipe list. The same function works for any
// future part (new slots can be added to ToolDesign.parts later).
import * as THREE from 'three';
import { ITEMS, MATERIALS, type ItemDef, type StatKey } from './materials';
import { CHAPTER_CARBON_SCALE } from '../../core/chapterPresentation';
import { WEAPONS, PART_SLOTS, eligiblePart, type PartSlot, type WeaponKind } from '../../gameplay/weaponTypes';

export interface ToolDesign {
  handle: string | null;
  head: string | null;
  binding: string | null;
  kind?: WeaponKind;
}
export interface ToolStats {
  reach: number;
  cut: number;
  pierce: number;
  impact: number;
  weight: number;
  durability: number;
  limitingPart: PartSlot;
  attack: number;
  attackSpeed: number;
  effect?: string;
}
export interface Tool {
  design: ToolDesign;
  stats: ToolStats;
  name: string;
  uses: number; // left
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function partsNeeded(d: ToolDesign) {
  const need: Record<string, number> = {};
  for (const slot of PART_SLOTS) {
    const id = d[slot];
    if (id) need[id] = (need[id] ?? 0) + 1;
  }
  return need;
}

export function toolStats(d: ToolDesign): ToolStats | null {
  const profile = d.kind ? WEAPONS[d.kind] : undefined;
  if (d.kind && !profile) return null;
  if (PART_SLOTS.some((slot) => {
    const id = d[slot];
    return profile ? !id || !eligiblePart(slot, id, d.kind) : !!id && !ITEMS[id];
  })) return null;
  const head = d.head ? ITEMS[d.head] : null;
  const handle = d.handle ? ITEMS[d.handle] : null;
  const bind = d.binding ? ITEMS[d.binding] : null;
  if (!head && !handle) return null;
  // a handle alone is a stick: it can poke and knock a little
  const h: ItemDef = head ?? handle!;
  const hm = MATERIALS[h.mat];
  const lever = head && handle ? handle.length : 0.35; // a head held in the hand has no lever
  const hard = hm.hardness / 5;
  const weight = (head?.mass ?? 0) + (handle?.mass ?? 0) + (profile ? bind?.mass ?? 0 : 0);
  const reach = 0.6 + (head && handle ? handle.length * 0.9 + head.length * 0.4 : h.length * 0.6);
  const impact = h.mass * (0.5 + h.blunt) * (0.5 + lever) * hard;
  const cut = h.edge * hm.hardness * (0.55 + lever * 0.45);
  const pierce = h.point * hm.hardness * (0.45 + lever * 0.55);
  // Compare the load each part can tolerate. Material ratings and the result are game units.
  const handleMat = handle && MATERIALS[handle.mat];
  const bindingMat = bind && MATERIALS[bind.mat];
  const headLoad = profile?.stat === 'impact' ? 1.2 : 1;
  const bendingLoad = 1 + (head?.mass ?? 0) * lever * 0.19;
  const limits: [PartSlot, number][] = [];
  if (head) limits.push(['head', (hm.toughness * 4 + hm.hardness * 0.7) / headLoad]);
  if (handleMat) limits.push(['handle', handleMat.toughness * 5 / bendingLoad]);
  if (head && handle) limits.push(['binding', (bindingMat ? 8 + bindingMat.toughness * 4.5 : 11) / bendingLoad]);
  const [limitingPart, durability] = limits.reduce((weakest, part) => part[1] < weakest[1] ? part : weakest);
  const values = { impact, cut, pierce };
  const effect = d.head === 'cave_lantern' ? '灯り：暗所で先端が光る' : d.head === 'cave_fang' ? '結晶：硬い相手に追加ダメージ' : undefined;
  const length = profile ? weaponDimensions(d).tip : 0;
  return { reach: r1(profile ? 0.55 + length * CHAPTER_CARBON_SCALE : reach), cut: r1(cut), pierce: r1(pierce), impact: r1(impact),
    weight: r1(weight), durability: Math.max(3, Math.round(durability)), limitingPart,
    attack: Math.round(4 + (profile ? values[profile.stat] * 2.1 : Math.max(cut, pierce, impact) * 1.65)),
    attackSpeed: r1((profile?.speed ?? 0.89) * (1.6 / (1 + weight * 0.11))), effect };
}

export function bestStat(s: ToolStats): StatKey {
  const e: [StatKey, number][] = [['cut', s.cut], ['impact', s.impact], ['pierce', s.pierce]];
  return e.sort((a, b) => b[1] - a[1])[0][0];
}

/** a name the game gives to what you made (the player decided the shape; the game just describes it) */
export function toolName(d: ToolDesign, s: ToolStats) {
  if (d.kind) return WEAPONS[d.kind].label;
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

export interface SavedTool {
  design: ToolDesign;
  uses: number;
  capacity?: number;
}

export function restoreTool(saved: SavedTool): Tool | null {
  const tool = makeTool(saved.design);
  if (!tool) return null;
  const { head, handle, binding } = saved.design;
  const legacyCapacity = saved.capacity ?? Math.max(3, Math.round(Math.min(
    MATERIALS[ITEMS[(head ?? handle)!].mat].toughness,
    handle ? MATERIALS[ITEMS[handle].mat].toughness : 10,
  ) * (head && handle ? (binding ? 1.6 : 0.7) : 1) * 3));
  tool.uses = Math.max(1, Math.min(tool.stats.durability, Math.ceil(tool.stats.durability * saved.uses / legacyCapacity)));
  return tool;
}

/** A harder contact surface increases edge wear. Toughness is accounted for in capacity. */
export function toolWear(tool: Tool, contactHardness: number) {
  const part = ITEMS[(tool.design.head ?? tool.design.handle)!];
  const excess = contactHardness - MATERIALS[part.mat].hardness;
  return 1 + Math.max(0, Math.ceil(excess / 3));
}

export function craftFromInventory(d: ToolDesign, inventory: Record<string, number>, tools: Tool[]) {
  const tool = makeTool(d);
  const need = Object.entries(partsNeeded(d));
  if (!tool || need.some(([id, n]) => (inventory[id] ?? 0) < n)) return null;
  for (const [id, n] of need) inventory[id] -= n;
  tools.push(tool);
  return tool;
}

/** simple 3D look of a tool, built from its parts (swap for real models later) */
export function weaponDimensions(d: ToolDesign) {
  const profile = WEAPONS[d.kind ?? 'club'];
  const h = d.handle ? ITEMS[d.handle] : undefined;
  const a = d.head ? ITEMS[d.head] : undefined;
  const shaft = profile.length * (0.49 + (h?.length ?? 0.91) * 0.18);
  const blade = profile.length * (0.23 + (a?.length ?? 0.24) * 0.35);
  const width = profile.thickness * (0.074 + Math.min(2, a?.mass ?? 0.6) * 0.021);
  return { shaft, blade, width, tip: shaft + blade + 0.02 };
}

function weaponMesh(d: ToolDesign) {
  const g = new THREE.Group();
  const { shaft, blade, width, tip } = weaponDimensions(d);
  const mat = (id: string | null, fallback: number) => new THREE.MeshStandardMaterial({
    color: id ? ITEMS[id]?.color ?? fallback : fallback, roughness: 0.67,
    ...(id === 'cave_lantern' ? { emissive: 0x94bf54, emissiveIntensity: 0.55 } : {}),
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.36, width * 0.46, shaft + 0.08, 8), mat(d.handle, 0x927456));
  handle.position.y = shaft / 2 - 0.04;
  g.add(handle);
  const form = d.kind!;
  let geometry: THREE.BufferGeometry;
  if (form === 'hammer') geometry = new THREE.BoxGeometry(width * 3.5, blade * 0.6, width * 2);
  else if (form === 'club') geometry = new THREE.CylinderGeometry(width * 0.9, width * 0.48, blade, 8);
  else {
    const outline = new THREE.Shape();
    if (form === 'axe') {
      outline.moveTo(-0.32 * width, -0.35 * blade);
      outline.lineTo(1.45 * width, -0.5 * blade);
      outline.quadraticCurveTo(2.15 * width, 0, 1.45 * width, 0.5 * blade);
      outline.lineTo(-0.32 * width, 0.29 * blade);
    } else {
      const taper = form === 'spear' ? 0.10 : 0.24;
      outline.moveTo(-width * 0.64, -0.5 * blade);
      outline.lineTo(-width, taper * blade);
      outline.lineTo(0, 0.5 * blade);
      outline.lineTo(width, taper * blade);
      outline.lineTo(width * 0.64, -0.5 * blade);
    }
    outline.closePath();
    geometry = new THREE.ExtrudeGeometry(outline, { depth: width * 0.27, bevelEnabled: false, curveSegments: 5 });
    geometry.translate(0, 0, -width * 0.135);
  }
  const head = new THREE.Mesh(geometry, mat(d.head, 0xbbc5c8));
  head.position.y = tip - (form === 'hammer' ? blade * 0.30 : blade / 2);
  g.add(head);
  for (const offset of [0, 0.05]) {
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.55, width * 0.55, 0.029, 9), mat(d.binding, 0xb5a18c));
    thread.position.y = shaft - offset;
    g.add(thread);
  }
  g.userData.attackTip = new THREE.Vector3(0, tip, 0);
  g.rotation.x = Math.PI / 2;
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

const worldGrip = new THREE.Vector3(), worldTip = new THREE.Vector3(), localAim = new THREE.Vector3();
const inverseGrip = new THREE.Quaternion();
const shaftAxis = new THREE.Vector3(0, 1, 0);
/** Keep the grip attached and raise the tip if an animation would swing it through the floor. */
export function adjustWeaponCarry(mesh: THREE.Object3D | null, floor: (x: number, z: number) => number) {
  const tip = mesh?.userData.attackTip as THREE.Vector3 | undefined;
  if (!mesh?.parent || !tip) return;
  mesh.rotation.set(Math.PI / 2, 0, 0);
  mesh.getWorldPosition(worldGrip);
  mesh.localToWorld(worldTip.copy(tip));
  const minY = Math.min(floor(worldTip.x, worldTip.z) + 0.035, worldGrip.y);
  if (worldTip.y >= minY) return;
  const length = worldGrip.distanceTo(worldTip);
  const lift = minY - worldGrip.y;
  localAim.copy(worldTip).sub(worldGrip).setY(0).normalize()
    .multiplyScalar(Math.sqrt(Math.max(0, length * length - lift * lift))).setY(lift);
  if (localAim.lengthSq() < 1e-6) return;
  mesh.parent.getWorldQuaternion(inverseGrip).invert();
  mesh.quaternion.setFromUnitVectors(shaftAxis, localAim.applyQuaternion(inverseGrip).normalize());
}

export function toolMesh(d: ToolDesign) {
  if (d.kind) return weaponMesh(d);
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
