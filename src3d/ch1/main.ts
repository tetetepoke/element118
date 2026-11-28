// ELEMENT 118 — Chapter 1 「根は、上から来る」
// The playable first chapter, built on the 3D prototype's movement, camera and character code.
// Saves only under element118.ch1.* (the 2D game and the 3D prototype keep their own keys).
import * as THREE from 'three';
import { setGround } from '../world/ground';
import { caveGround, ceilAt, heightAt, waterAt, zoneAt, SPOTS, RIVER, ZONES, type Zone } from './world/cavern';
setGround(caveGround);
import { buildWorld, type Thing } from './world/build';
import { input, endFrame, initKeyboardMouse, initTouch, bindButton, bindAction, pollInput, onDeviceChange, onGamepad, getLastDevice, padLabel, applySettings, settings as inputSettings } from '../core/input';
import type { ActionName } from '../core/inputConfig';
import { ThirdPersonCamera, CAMERA_TUNING } from '../core/camera';
import { CHAPTER_CAMERA, CHAPTER_CARBON_SCALE, CHAPTER_MOVE_SPEED } from '../core/chapterPresentation';
// chapter 1 framing: a little lower, over Carbon's shoulder, Carbon a bit below the centre, more world ahead
Object.assign(CAMERA_TUNING, CHAPTER_CAMERA);
import { PlayerController } from '../player/controller';
import { ProceduralCarbon, ProceduralSilica } from '../player/visual';
import { CollisionDebug } from '../world/collisionDebug';
import { TUNING as MOVE } from '../player/controller';
import { BondFx } from '../fx/bondFx';
import { ui, wait, showScan, showBag, showCodex, setAutoAdvance, autoAdvance, showGot, dismissGot, gotIsOpen } from './ui';
import { viewerStats } from './itemViewer';
import { sfx, startAudio } from './audio';
import { ITEMS, MATERIALS, ELEMENTS, type ElementSymbol } from './game/materials';
import { newKnowledge, unlockScan, noteScan, level, type KnowledgeState } from './game/knowledge';
import { makeTool, toolMesh, type Tool, type ToolDesign } from './game/craft';
import { canBreak, canHarvest, HANDS, STAT_JA, type Power } from './game/interact';

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch'); // device class (for performance choices only)
if (params.has('auto')) setAutoAdvance(true);

// ── renderer: no sky, no sun. Only the roots, fungi, lanterns and lamps give light ──
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
} catch {
  $('fail').style.display = 'flex';
  throw new Error('WebGL not available');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
$('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const FOG = { color: 0x060a14, near: 14, far: 110 };
scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
const hemi = new THREE.HemisphereLight(0x6a86b8, 0x241c14, 0.95);
/** per-area air and fill light (visual only). The dump: warm haze, lamp-lit, not crushed to black */
const ATMOS: Record<string, { fog: number; near: number; far: number; sky: number; ground: number; hemi: number; exp?: number }> = {
  default: { fog: FOG.color, near: FOG.near, far: FOG.far, sky: 0x6a86b8, ground: 0x241c14, hemi: 0.95 },
  dump: { fog: 0x241b20, near: 8, far: 72, sky: 0x9a8cc0, ground: 0x5a3418, hemi: 1.55, exp: 1.55 },
  cave: { fog: 0x120e10, near: 5, far: 40, sky: 0x6a6a88, ground: 0x2a1a10, hemi: 1.0 },
};
let fogLocked = false; // the ending opens the fog itself
const atmosFog = new THREE.Color(), atmosSky = new THREE.Color(), atmosGround = new THREE.Color();
scene.add(hemi);

const world = buildWorld();
scene.add(world.root);
// distance culling (visual only): objects past the fog are not drawn at all. Caves have no sky, so the
// fog hides everything beyond it anyway; this keeps draw calls low on phones.
const cullList: { o: THREE.Object3D; c: THREE.Vector3; r: number }[] = [];
{
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  world.root.updateMatrixWorld(true);
  for (const o of world.root.children) {
    if (o.name === 'floor' || o.name === 'ceiling') continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sph);
    if (sph.radius > 70) continue; // huge things (instanced spreads, long roots) stay; the GPU culls their parts
    cullList.push({ o, c: sph.center.clone(), r: sph.radius });
  }
}
let cullT = 0;
function cullFar(dt: number) {
  cullT -= dt;
  if (cullT > 0) return;
  cullT = 0.2;
  const far = (scene.fog as THREE.Fog).far; // past the fog's far end everything is the fog colour anyway
  const cp = camera.position;
  for (const k of cullList) k.o.visible = !k.o.userData.gone && k.c.distanceTo(cp) - k.r < far;
}

// a small pool of point lights, moved each frame to the light spots nearest to the camera
const POOL = isTouch ? 5 : 7;
const pool: THREE.PointLight[] = [];
for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 34, 1.3); scene.add(l); pool.push(l); }
const crystalLight = new THREE.PointLight(0x5ab8ff, 6, 7, 1.6);
scene.add(crystalLight);

// ── characters ──
const carbon = new ProceduralCarbon({ smooth: true, scale: CHAPTER_CARBON_SCALE });
scene.add(carbon.root);
const player = new PlayerController(carbon, world.colliders);
player.speedMul = CHAPTER_MOVE_SPEED;
const silica = new ProceduralSilica({ smooth: true, scale: CHAPTER_CARBON_SCALE });
silica.root.visible = false;
scene.add(silica.root);
const fx = new BondFx();
scene.add(fx.root);
const cam = new ThirdPersonCamera(camera, world.colliders);
// developer view: collision shapes (settings → 衝突判定表示); off in normal play, its own key
const colDebug = new CollisionDebug(scene, world.colliders);
const DEV_KEY = 'element118.ch1.dev';
try { colDebug.visible = JSON.parse(localStorage.getItem(DEV_KEY) ?? '{}').collision === true; } catch { /* off */ }
cam.extraSolid = (x, y, z) => y > ceilAt(x, z) - 0.35 || y < heightAt(x, z);
const blob = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grd;
  c.fillRect(0, 0, 64, 64);
  const shadowSize = 1.2 * CHAPTER_CARBON_SCALE;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(shadowSize, shadowSize).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  scene.add(m);
  return m;
})();

// ── game state (saved) ──
type PartnerMode = 'none' | 'merged' | 'follow' | 'wait';
interface Save {
  v: 1;
  flags: Record<string, boolean>;
  inv: Record<string, number>;
  tools: { design: ToolDesign; uses: number }[];
  equipped: number | null;
  k: KnowledgeState;
  form: 'normal' | 'sic';
  partner: PartnerMode;
  waitAt?: [number, number];
  broken: string[];
  notes: string[];
  pos?: [number, number, number];
  hakobiSide: 'south' | 'north';
  /** items / elements already shown with the big card (added later: missing in old saves) */
  seen?: string[];
  seenEl?: string[];
}
const SAVE_KEY = 'element118.ch1.save';
const fresh = (): Save => ({ v: 1, flags: {}, inv: {}, tools: [], equipped: null, k: newKnowledge(), form: 'normal', partner: 'none', broken: [], notes: [], hakobiSide: 'south', seen: [], seenEl: [] });
let S: Save = fresh();
let tools: Tool[] = [];
function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}
function persist() {
  try {
    S.pos = [player.pos.x, player.pos.y, player.pos.z];
    S.tools = tools.map((t) => ({ design: t.design, uses: t.uses }));
    S.equipped = equipped ? tools.indexOf(equipped) : null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch { /* storage full or blocked: the game still runs */ }
}
const flag = (f: string) => !!S.flags[f];
function setFlag(f: string) {
  if (S.flags[f]) return;
  S.flags[f] = true;
  updateMission();
  persist();
}
function note(n: string) {
  if (!S.notes.includes(n)) S.notes.push(n);
}
/** old saves have no first-find record: count what they already own / understand as seen */
function upgradeSave(s: Save) {
  if (!s.seen) s.seen = Object.keys(s.inv).filter((id) => (s.inv[id] ?? 0) > 0);
  if (!s.seenEl) s.seenEl = (Object.keys(s.k.el) as ElementSymbol[]).filter((e) => (s.k.el[e] ?? 0) >= 2);
}
/** first time: big 3D card. after that: a small notice */
async function gotItem(id: string, n = 1) {
  upgradeSave(S);
  if (S.seen!.includes(id)) { ui.toast(`＋ ${ITEMS[id].nameJa} ×${n}`); return; }
  S.seen!.push(id);
  persist();
  await showGot({ subject: { kind: 'item', id }, tag: 'NEW', title: ITEMS[id].nameJa, count: n });
}
/** an element is understood (never "picked up") */
async function understood(sym: ElementSymbol, text?: string) {
  upgradeSave(S);
  if (S.seenEl!.includes(sym)) return;
  S.seenEl!.push(sym);
  persist();
  const e = ELEMENTS[sym];
  sfx.chime(true);
  await showGot({ subject: { kind: 'element', symbol: sym }, tag: 'UNDERSTOOD', title: sym, line2: String(e.z), line3: `${e.en}<br>${e.nameJa}`, note: text });
}

// ── tools in the hand ──
let equipped: Tool | null = null;
let handMesh: THREE.Object3D | null = null;
function equip(t: Tool | null) {
  equipped = t;
  if (handMesh) carbon.rightHand.remove(handMesh);
  handMesh = null;
  if (t) {
    handMesh = toolMesh(t.design);
    carbon.rightHand.add(handMesh);
  }
  const tag = $('toolTag');
  tag.style.display = t ? 'inline-block' : 'none';
  if (t) tag.textContent = `${t.name}（${t.uses}）`;
}
function addItem(id: string, n = 1) {
  S.inv[id] = (S.inv[id] ?? 0) + n;
}
function power(): Power {
  let p: Power = { ...HANDS };
  if (equipped) p = { cut: equipped.stats.cut, impact: equipped.stats.impact, pierce: equipped.stats.pierce, source: equipped.name };
  if (S.form === 'sic') {
    // HARD BREAK: a game ability inspired by how hard real SiC is
    if (9 > p.impact) p = { ...p, impact: 9, source: 'SiC FORM（HARD BREAK）' };
  }
  return p;
}
function useTool() {
  if (!equipped || power().source.startsWith('SiC')) return;
  equipped.uses--;
  if (equipped.uses <= 0) {
    const t = equipped;
    ui.toast(`${t.name}がこわれた。部品はもどってきた。`);
    for (const id of Object.values(t.design)) if (id && !ITEMS[id].binding) addItem(id);
    tools.splice(tools.indexOf(t), 1);
    equip(null);
  } else equip(equipped);
}

// ── missions ──
function updateMission() {
  const f = flag;
  const k = S.k;
  if (!f('wake')) return;
  if (!f('city_seen')) return ui.mission('ここを出る', '北の出口へ。ゴミの山はジャンプでよじ登れる');
  if (!f('city_talk')) return ui.mission('地下都市を歩く', '橋をわたって、ひろばへ');
  if (!f('elder')) return ui.mission('根のそばの老人に会う', 'いちばん明るい青い根のところ');
  if (!k.scan) return ui.mission('青い根を追う', '目的：上へ　／　まずは西の研究所へ');
  if (!f('scan3')) return ui.mission('まわりの物をスキャンする', `R / SCAN ボタン（${Math.min(3, k.scanned.length)}/3）`);
  if (!k.harvest) return ui.mission('研究者のところへ戻る', '');
  if (!f('got2')) return ui.mission('材料を集める', 'くずの山で E（2種類）');
  if (!k.create) return ui.mission('研究者のところへ戻る', '');
  if (!f('made_tool')) return ui.mission('道具をつくる', '「持ち物・つくる」（B）で、部品を組み合わせる');
  if (!f('river_crossed')) return ui.mission('青い根を追う：西の地下水脈へ', '川をわたる（方法は自由）');
  if (!f('mineral')) return ui.mission('上へ', '菌類の森をぬけて、さらに上へ');
  if (!k.bond) return ui.mission('上へ', '鉱物層の奥へ');
  if (!f('hard_wall')) return ui.mission('硬い岩盤をこえる', 'SiC FORM の HARD BREAK（E）' + (f('cave') ? '' : '　／　寄り道：ほかにも硬い岩があった'));
  if (!f('door_open')) return ui.mission('扉をひらく', k.breakSkill ? '二つの台座を同時に。BREAK（Q）で分かれる' : '古い部屋をしらべる');
  if (!f('reveal')) return ui.mission('上へ', '結晶層へ');
  if (!f('ending')) return ui.mission('根を追って、上層へ', '結晶層 → 古代施設 → 上層門');
  ui.mission('第1章クリア', '自由に探索できる');
}

// ── interaction targets ──
const tmp = new THREE.Vector3();
function nearest(filter: (t: Thing) => boolean, extra = 0.6) {
  let best: Thing | null = null, bd = Infinity;
  for (const t of world.things) {
    if (t.broken || !filter(t)) continue;
    const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
    const verticalReach = t.kind === 'pick' ? 1.2 : 5 + t.r * 0.5;
    if (d > t.r + extra || Math.abs(t.pos.y - player.pos.y) > verticalReach) continue;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
const isActionable = (t: Thing) => t.kind !== 'scan' || !S.k.scan || t.id === 'hakobi';
const isScannable = (t: Thing) => t.kind !== 'npc' && t.kind !== 'pick';
function actionLabel(t: Thing): string {
  switch (t.kind) {
    case 'npc': return '話す';
    case 'pick': return '素材を拾う';
    case 'node': return `取る（${S.k.scan ? t.label : '???'}）`;
    case 'obstacle': {
      const c = canBreak(t.mat, power());
      return c.ok ? `${c.stat ? STAT_JA[c.stat] : 'こわす'}（${t.label}）` : `しらべる（${t.label}）`;
    }
    case 'plate': return S.partner === 'follow' ? 'シリカ、ここに立って' : 'しらべる（台座）';
    case 'device': return 'しらべる';
    default: return t.id === 'hakobi' && flag('ferry_ok') ? 'ハコビに乗る' : 'しらべる';
  }
}

// ── cutscene camera ──
let cine: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
let cutscene = false;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function setCine(px: number, py: number, pz: number, lx: number, ly: number, lz: number, snap = false) {
  cine = { pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz) };
  if (snap) { camPos.copy(cine.pos); camLook.copy(cine.look); }
}
async function scene_(fn: () => Promise<void>) {
  cutscene = true;
  player.locked = true;
  try { await fn(); } finally {
    cutscene = false;
    player.locked = false;
    cine = null;
  }
}

// ── story pieces ──
async function prologue() {
  await scene_(async () => {
    ui.fade(true, 10);
    hideCarbon(true);
    sfx.ambience(true);
    await wait(800);
    sfx.drip(); await ui.caption('……ぽた。', 1400);
    sfx.drip(); await wait(500); sfx.drip();
    sfx.clank(0.6); await ui.caption('ガコン……　ギギ……', 1600);
    await ui.caption('「おーい、そっちの山、くずすぞー」', 1900);
    // fade in on the dump: the collector machine working
    setCine(10, 9, 100, 26, 2, 118, true);
    await ui.fade(false, 1600);
    for (let i = 0; i < 3; i++) { sfx.clank(0.8 + i * 0.1); await wait(700); }
    setCine(14, 5, 106, 22, 1.5, 116);
    sfx.rumble(2);
    collapse();
    await wait(1600);
    // a boy in a white mask comes out of the heap
    hideCarbon(false);
    carbon.root.position.set(SPOTS.pileTop.x, heightAt(SPOTS.pileTop.x, SPOTS.pileTop.y) - 1.2, SPOTS.pileTop.y);
    carbon.root.rotation.set(-1.1, 2.6, 0);
    emerge = 0;
    setCine(17, 3.2, 111, 22, 1.2, 116);
    await wait(1800);
    workerTo('worker_a', 19, 113); workerTo('worker_b', 21, 112.5);
    await wait(900);
    await ui.say('作業員', '生きてる。');
    await ui.say('もう一人の作業員', '見たことないな。');
    await wait(1500);
    await ui.say('作業員', '…………また降ってきた。');
    await ui.fade(true, 1400);
    await wait(900);
  });
}

let emerge = -1;
const debris: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
function collapse() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(i % 2 ? new THREE.BoxGeometry(0.6, 0.4, 0.5) : new THREE.DodecahedronGeometry(0.35, 0), mat);
    m.position.set(SPOTS.pileTop.x + (Math.random() - 0.5) * 2, heightAt(SPOTS.pileTop.x, SPOTS.pileTop.y) + 2 + Math.random() * 2, SPOTS.pileTop.y + (Math.random() - 0.5) * 2);
    scene.add(m);
    debris.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6), w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0) });
  }
}
function hideCarbon(h: boolean) { carbon.root.visible = !h; }
function workerTo(id: string, x: number, z: number) {
  const n = world.npcs.find((k) => k.id === id)!;
  n.walkTo(new THREE.Vector3(x, 0, z));
}

async function awaken() {
  await scene_(async () => {
    // Carbon lies by the wall; the first thing he sees is the blue root
    const w = SPOTS.wake;
    player.teleport(w.x, w.y);
    hideCarbon(false);
    carbon.root.position.set(w.x, heightAt(w.x, w.y) + 0.15, w.y);
    carbon.root.rotation.set(-Math.PI / 2, 0.4, 0);
    world.npcs.find((n) => n.id === 'worker_a')!.root.position.set(12, heightAt(12, 108), 108);
    world.npcs.find((n) => n.id === 'worker_b')!.root.position.set(14.5, heightAt(14.5, 110), 110);
    const rp = world.wakeRoot.getPoint(0.45);
    setCine(w.x + 1.2, heightAt(w.x, w.y) + 0.6, w.y + 1.5, rp.x, rp.y, rp.z, true);
    await ui.fade(false, 2200);
    await wait(900);
    carbon.flashCrystal(1.4);
    sfx.chime(true);
    await wait(1600);
    standUp = 0;
    setCine(w.x + 3.5, heightAt(w.x, w.y) + 2.2, w.y + 4, w.x, heightAt(w.x, w.y) + 1, w.y);
    await wait(1300);
    await ui.say('カーボン', '……ここは？');
    await ui.say('作業員', '第七廃棄区。');
    await ui.say('カーボン', 'そうじゃなくて……。');
    await ui.say('カーボン', '上に行きたい。');
    await ui.say('作業員', '上層なら、あっちだ。');
    await ui.say('カーボン', '違う……。');
    await ui.say('もう一人の作業員', 'お前、名前は？');
    await ui.say('カーボン', '……わからない。');
    await ui.say('もう一人の作業員', '仮面に「C」と書いてあるな。……カーボン、とでも呼ぶか。');
    setFlag('wake');
    persist();
  });
  carbon.root.rotation.set(0, player.facing, 0);
  ui.toast('WASD / スティックで移動　Space / JUMP でジャンプ');
}
let standUp = -1;

async function cityReveal() {
  await scene_(async () => {
    setFlag('city_seen');
    const p = player.pos;
    setCine(p.x + 2, p.y + 3, p.z + 3, p.x, p.y + 1.4, p.z - 4, true);
    await wait(400);
    setCine(22, 26, 74, 8, 6, 10);
    ui.area('地下都市', 'アトミア');
    sfx.chime(true);
    await wait(3400);
    setCine(-10, 20, 46, 40, 20, 0);
    await wait(2800);
    await ui.say('カーボン', 'すごい……。');
    await ui.say('カーボン', 'でも、なんだろう。何かが……足りない。');
  });
}

async function cityTalk() {
  await scene_(async () => {
    setFlag('city_talk');
    const a = world.npcs.find((n) => n.id === 'res_a')!, b = world.npcs.find((n) => n.id === 'res_b')!;
    a.lookAt(player.pos); b.lookAt(player.pos);
    setCine(player.pos.x + 4, player.pos.y + 2.4, player.pos.z + 2, a.root.position.x, a.root.position.y + 0.6, a.root.position.z);
    await ui.say('カーボン', '外は？');
    await ui.say('住民', '外？');
    await ui.say('住民の子', '外って何？');
    await ui.say('住民', '見ない顔だね。上層の生まれかい？');
    await ui.say('カーボン', '……わからない。');
    await ui.say('住民', '根の光がいちばん明るいのは、あっちのじいさんの所だよ。いつも根の話をしてる。');
  });
}

async function elderTalk() {
  const e = world.npcs.find((n) => n.id === 'elder')!;
  e.lookAt(player.pos);
  if (!flag('elder')) {
    await scene_(async () => {
      setCine(player.pos.x - 3, player.pos.y + 2.2, player.pos.z + 3, e.root.position.x, e.root.position.y + 0.7, e.root.position.z);
      await ui.say('老人', '上へ行きたいのか。');
      await ui.say('カーボン', 'うん。');
      const rp = new THREE.Vector3(44, 20, 1);
      setCine(e.root.position.x - 4, e.root.position.y + 2, e.root.position.z + 6, rp.x, rp.y, rp.z);
      carbon.flashCrystal(1.2);
      await ui.say('老人', 'だったら、それを追ってみろ。');
      await ui.say('老人', 'どこまで続いているのか、誰も知らん。');
      await ui.say('老人', '昔から言うんだ。');
      setCine(44, 10, 24, 46, 46, -6);
      await wait(800);
      await ui.say('老人', '根は、上から来る。');
      ui.toast('MISSION UPDATE　「青い根を追う」　目的：上へ', true, 4000);
      sfx.chime(true);
      await wait(autoAdvance ? 50 : 1400);
      await ui.fade(true, 900);
      await ui.titleCard();
      await ui.fade(false, 900);
      await ui.say('老人', '根のことなら、西の研究所の娘が調べておる。会ってみるといい。');
      setFlag('elder');
      note('なぜ、根は「上から来る」と言われているのか');
    });
  } else {
    await ui.say('老人', S.flags.reveal ? '根の先まで行ったのか……。わしらは、ずっとこの光の下で生きてきた。' : '根は、上から来る。……わしが知っとるのは、それだけだ。');
    if (S.k.bond && !flag('cave')) await ui.say('老人', 'そういえば、廃棄区の奥に、誰にも割れん岩があってな。奥に何かあるらしいが……。');
  }
}

async function researcherTalk() {
  const r = world.npcs.find((n) => n.id === 'researcher')!;
  r.lookAt(player.pos);
  const k = S.k;
  if (!flag('elder')) { await ui.say('研究者', 'ん？ 根の光を見に来たの？ まずは、ひろばの奥の長老に会ってきなよ。'); return; }
  if (!k.scan) {
    await scene_(async () => {
      setCine(player.pos.x + 2.5, player.pos.y + 1.8, player.pos.z + 2.5, r.root.position.x, r.root.position.y + 0.65, r.root.position.z);
      await ui.say('研究者', 'あんたが「降ってきた」子？ ……その胸の結晶、根と同じ色だね。');
      await ui.say('研究者', 'ちょっと、この石にさわってみて。');
      carbon.playAction('bond');
      carbon.flashCrystal(1.4);
      sfx.scan();
      await wait(900);
      await ui.say('カーボン', '……つながってる。小さいものが、手をつないでる。');
      await ui.say('研究者', '見えるの？ 物の中の「つながり」が？');
      await ui.say('研究者', '……すごい。あたしたちには、機械を使っても少ししか見えないのに。');
      unlockScan(k);
      ui.toast('MATERIAL SCAN 解放　（R / SCAN ボタン）', true, 4000);
      await understood('C', 'じぶん自身の元素。');
      await ui.say('研究者', 'いろんな物を見てごらん。石、木、金属、水……。3つ見たら、また話そう。');
      persist();
      updateMission();
    });
    return;
  }
  if (!flag('scan3')) { await ui.say('研究者', 'まだ見てない物がたくさんあるよ。石、木くず、水……'); return; }
  if (!k.harvest) {
    await ui.say('研究者', '見えたかい？ 水にも石にも、同じ「何か」が入ってたでしょ。それが元素。');
    await ui.say('研究者', 'でも、見えるだけじゃ使えない。必要な物は、自分で取るんだ。');
    await ui.say('研究者', 'まずはそこのくずの山から。どこまで取れるかは、あんたがどれだけ物を「わかってるか」で変わるよ。');
    k.harvest = true;
    ui.toast('HARVEST 解放　（E で取る）', true, 3600);
    sfx.chime(true);
    updateMission(); persist();
    return;
  }
  if (!flag('got2')) { await ui.say('研究者', 'くずの山から、2種類くらい集めてみて。'); return; }
  if (!k.create) {
    await ui.say('研究者', 'いいね。じゃあ、それを組み合わせてごらん。');
    await ui.say('研究者', '棒に、重い石をくくりつけたら？ とがった石なら？ 決まった作り方なんてないよ。');
    await ui.say('研究者', '長さ、重さ、先の形、材料。それで「できること」が変わる。');
    k.create = true;
    $('bBagTop').classList.remove('hide');
    ui.toast('CREATE 解放　（B / 持ち物・つくる）', true, 3600);
    sfx.chime(true);
    updateMission(); persist();
    return;
  }
  if (!flag('made_tool')) { await ui.say('研究者', '「持ち物・つくる」で、部品を枠に入れてみな。'); return; }
  await ui.say('研究者', '根は西の地下水脈の天井にも走ってる。上に続く道があるとしたら、そっちだね。');
  await ui.say('研究者', '川はわたれないって言われてるけど……やり方は、ひとつじゃないさ。');
  if (S.k.bond) await ui.say('研究者', '……その鎧、ケイ素と炭素？ SiC――炭化ケイ素はとても硬い物質だよ。あんたたち、何者なの……。');
}

async function npcTalk(id: string) {
  const n = world.npcs.find((k) => k.id === id);
  n?.lookAt(player.pos);
  const lines: Record<string, [string, string][]> = {
    worker_a: [['作業員', '上から落ちてきた物は、全部この第七廃棄区に集まる。'], ['作業員', '出口は北だ。ゴミの山は、よじ登れば越えられる。']],
    worker_b: [['もう一人の作業員', '「また」ってのは……いや、何でもない。昔の話だ。']],
    res_a: [['住民', '根の光が少し暗くなったら、寝る時間さ。毎日そうだろ？']],
    res_b: [['住民の子', '外って、根のもっと奥のこと？']],
    child: [['子ども', '根ってね、ちょっとずつ明るくなったり暗くなったりするんだよ。息してるみたいでしょ。']],
    vendor: [['商人', '光る菌はいかが？ 根の光をたくさん浴びたやつは、よく光るよ。']],
    res_c: [['住民', '研究所の娘は変わり者だが、腕はたしかだ。']],
    res_d: [['住民', '廃棄区の奥の穴？ 底は誰も見たことがないよ。']],
    ferryman: [['渡し守', 'この川は流れが速い。泳いじゃだめだよ。'], ['渡し守', 'ハコビに乗せてやろうか？ この子は目がないけど、川の流れを体で感じて歩くんだ。']],
    gatherer: [['菌を採る人', 'その先の枯れ根、刃物で断てれば通れるんだがねえ。'], ['菌を採る人', '身の軽い若いのは、大きな菌のかさを跳んで、上の割れ目から行くらしいよ。']],
  };
  if (id === 'elder') return elderTalk();
  if (id === 'researcher') return researcherTalk();
  for (const [w, t] of lines[id] ?? [['住民', '……']]) await ui.say(w, t);
  if (id === 'ferryman') { S.flags.ferry_ok = true; ui.toast('ハコビの所で E：乗る'); }
}

async function rideHakobi() {
  await scene_(async () => {
    await ui.fade(true, 600);
    const toNorth = player.pos.z > RIVER.z;
    const dst = toNorth ? SPOTS.riverFar : SPOTS.riverDock;
    player.teleport(dst.x, dst.y + (toNorth ? -1.5 : 1.5));
    world.hakobi.root.position.set(dst.x, RIVER.level - 1.1, dst.y + (toNorth ? 3.8 : -3.8));
    S.hakobiSide = toNorth ? 'north' : 'south';
    const th = world.things.find((t) => t.id === 'hakobi')!;
    th.pos = world.hakobi.root.position;
    await wait(300);
    await ui.fade(false, 600);
    ui.toast('ハコビは、ゆっくり川をわたった。');
  });
}

async function meetSilica() {
  await scene_(async () => {
    setFlag('silica_met');
    const sp = silica.root.position;
    silica.root.rotation.y = Math.atan2(player.pos.x - sp.x, player.pos.z - sp.z);
    setCine(player.pos.x + 3, player.pos.y + 2, player.pos.z + 3, sp.x, sp.y + 1, sp.z);
    await ui.say('？？？', '……だれ？');
    await ui.say('カーボン', 'カーボン……たぶん。');
    await ui.say('シリカ', 'わたしはシリカ。気づいたら、ここにいた。砂の中で。');
    await ui.say('カーボン', 'ぼくも、上から……落ちてきたらしい。');
    await ui.say('シリカ', '上？');
    await ui.say('カーボン', '青い根を追ってるんだ。上へ行きたい。');
    await ui.say('シリカ', 'この先は、硬い岩でふさがってる。だれにも割れない。');
    // something happens between them
    carbon.flashCrystal(1.4);
    sfx.chime(true);
    await wait(1100);
    await ui.say('カーボン', '……？ なんだろう。胸が……。');
    await doBond(true);
    await wait(autoAdvance ? 20 : 800);
    await ui.say('カーボン', '……いま、なにが？');
    await ui.say('シリカ（声）', 'わたしたち……つながってる？');
    await ui.say('カーボン', 'なんで、こんなことができるんだろう。');
    S.k.el.Si = 2;
    S.k.bond = true;
    await understood('Si', 'シリカとつながって、わかった。');
    ui.toast('BOND：Si ＋ C → SiC（炭化ケイ素）', true, 3400);
    note('なぜカーボンは BOND できるのか');
    note('胸の結晶は、なぜ根と同じ色なのか');
    await ui.say('', '本物のSiC（炭化ケイ素）は、モース硬度9以上のとても硬い物質。SiC FORM の力は、それをモチーフにしたゲームの能力（フィクション）。');
    updateMission(); persist();
  });
}

function doBond(first = false): Promise<void> {
  return new Promise((res) => {
    player.locked = true;
    carbon.playAction('bond');
    silica.playAction('bond');
    sfx.chime(true);
    fx.playBond({
      from: () => silica.root.position,
      to: () => carbon.anchor(new THREE.Vector3()),
      setProgress: (p) => carbon.setFormProgress('sic', p),
      silica: silica.root,
      onCommit: () => { S.form = 'sic'; S.partner = 'merged'; persist(); },
      onDone: () => {
        silica.root.visible = false;
        carbon.setForm('sic');
        $('form').style.display = 'inline-block';
        if (!cutscene) player.locked = false;
        if (!first) ui.toast('BOND　SiC FORM');
        res();
      },
    });
  });
}
function doBreak(): Promise<void> {
  return new Promise((res) => {
    player.locked = true;
    const side = new THREE.Vector3(Math.cos(player.facing), 0, -Math.sin(player.facing)).multiplyScalar(1.4);
    const at = player.pos.clone().add(side);
    at.y = world.colliders.topAt(at.x, at.z);
    silica.root.position.copy(at);
    silica.root.visible = false;
    sfx.chime(false);
    fx.playBreak({
      from: () => carbon.anchor(new THREE.Vector3()).setY(player.pos.y + 0.2),
      to: () => new THREE.Vector3(at.x, at.y + 0.8 * CHAPTER_CARBON_SCALE, at.z),
      setProgress: (p) => carbon.setFormProgress('sic', p),
      silica: silica.root,
      onCommit: () => { S.form = 'normal'; S.partner = 'follow'; persist(); },
      onDone: () => {
        carbon.setForm('normal');
        silica.root.visible = true;
        $('form').style.display = 'none';
        player.locked = false;
        ui.toast('BREAK　C ＋ Si');
        res();
      },
    });
  });
}

async function teachBreak() {
  await scene_(async () => {
    setCine(70, 42, -64, 70, 36, -73);
    await ui.say('シリカ（声）', '台座が二つある……。ふたつ同時に押さないと、扉は開かないみたい。');
    await ui.say('カーボン', 'ぼくたち、今はひとつだ。');
    await ui.say('シリカ（声）', 'じゃあ……いったん、離れてみる？');
    await ui.say('カーボン', '離れる……。');
    S.k.breakSkill = true;
    ui.toast('BREAK 解放（Q / BREAK ボタン）', true, 3600);
    await ui.say('', 'BREAK で二人に分かれる。シリカのそばで台座をしらべると「ここに立って」とたのめる。もう一度つながるときは、シリカのそばで BOND。');
    updateMission(); persist();
  });
}

async function crystalReveal() {
  await scene_(async () => {
    setFlag('reveal');
    const r = SPOTS.rootShaft;
    setCine(player.pos.x, player.pos.y + 1.6, player.pos.z + 3, r.x, 52, r.y, true);
    await wait(500);
    carbon.flashCrystal(1.4);
    sfx.chime(true);
    setCine(r.x - 14, 47, r.y - 14, r.x, 110, r.y);
    revealPulse = 0;
    await wait(3600);
    await ui.say('カーボン', '……つながってる。');
    await ui.say('シリカ', '根が……上に、ずっと続いてる。');
    await ui.say('カーボン', 'やっぱりだ。根は、上から来てる。');
    await ui.say('カーボン', 'この根を追えば、上へ行ける。');
    note('青い根の中を流れる光は、どこから来るのか');
    ui.toast('MISSION UPDATE　「根を追って、上層へ」', true, 3600);
  });
}
let revealPulse = -1;

async function ending() {
  await scene_(async () => {
    setFlag('ending');
    const D = world.doors;
    const gx = SPOTS.gateDoor.x;
    setCine(gx - 16, 68, 78 + 6, gx, 70, 78, true);
    await wait(800);
    carbon.flashCrystal(1.4);
    await wait(700);
    gateGlow = 0;
    sfx.rumble(3);
    await wait(1500);
    gateOpen = 0;
    await wait(2600);
    sfx.clank(0.4);
    await ui.say('カーボン', '……開いた？');
    // look through the gap: a shaft going up, with faint lights far above (no sky)
    setCine(gx - 1.5, 63.4, 78, gx + 8, 150, 78);
    fogLocked = true;
    scene.fog = new THREE.Fog(FOG.color, 30, 420);
    farOn = 0;
    await wait(3200);
    await ui.say('シリカ', '光……？ 根の光じゃない。');
    await ui.say('カーボン', '……上が、ある。');
    setCine(gx - 9, 64.5, 82, gx, 70, 78);
    sfx.clank(0.35);
    gateOpen = -2; // stops with a grinding noise
    await wait(1200);
    await ui.say('カーボン', '……とまった。');
    showScan(S.k, 'ancient_alloy', '上層門');
    await wait(autoAdvance ? 50 : 900);
    ui.close('scanWrap');
    await ui.say('カーボン', '足りない。……何かが。　Cu ……？');
    await ui.say('シリカ', 'いまのわたしたちじゃ、まだ通れないね。');
    await ui.say('カーボン', 'うん。でも――');
    await ui.say('カーボン', '根は、上から来る。');
    note('門の向こうの光は何？');
    note('「また降ってきた」の「また」とは？');
    await ui.fade(true, 2000);
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
    fogLocked = false;
    showEnd();
    persist();
  });
}
let gateGlow = -1, gateOpen = -1, farOn = -1;

function showEnd() {
  const e = $('end');
  const d = Object.values(S.k.el).filter((v) => (v ?? 0) >= 2).length;
  e.innerHTML = `<div class="c">CHAPTER 1　COMPLETE</div><div class="t">第1章　根は、上から来る</div>
    <div class="d">DISCOVERED　${d} / 118</div>
    <div class="q">なぜ、カーボンは降ってきたのか。<br>「また」とは、どういう意味なのか。<br>胸の結晶は、なぜ根と同じ色なのか。<br>青い根は、何なのか。<br>――上には、何があるのか。</div>
    <div class="end-actions"><a class="bigbtn" href="../chapter2/">第2章へ進む</a><button class="bigbtn" id="bCont2">このまま探索する</button></div>`;
  e.style.display = 'flex';
  $('bCont2').onclick = async () => {
    e.style.display = 'none';
    await ui.fade(false, 900);
  };
}

async function fragment() {
  await scene_(async () => {
    setFlag('fragment');
    const th = world.things.find((t) => t.id === 'mask_fragment')!;
    th.broken = true; // stays where it is, but there is nothing more to do with it
    const p = th.pos;
    setCine(p.x + 2, p.y + 1.6, p.z + 2, p.x, p.y, p.z);
    await ui.say('カーボン', '白い……かけら。');
    await ui.say('カーボン', 'ぼくの仮面と、同じ？');
    await ui.say('カーボン', '……ここにも、誰かが降ってきたんだ。');
    note('白いかけらの持ち主は、だれ？');
    ui.toast('気になること が増えた（図鑑）');
  });
}

// ── actions ──
async function onAction() {
  if (cutscene || fx.active || ui.busy()) return;
  const t = nearest(isActionable);
  // partner commands
  if (S.partner === 'wait' && silica.root.position.distanceTo(player.pos) < 2.5 && (!t || t.kind !== 'plate')) {
    S.partner = 'follow';
    ui.toast('シリカ「ついていくね」');
    return;
  }
  if (!t) return;
  carbon.root.rotation.y = player.facing = Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
  if (t.kind === 'npc') return npcTalk(t.id);
  if (t.kind === 'pick') {
    const item = t.give![0];
    breakThing(t, true);
    addItem(item);
    persist();
    sfx.pick();
    void gotItem(item);
    return;
  }
  if (t.kind === 'plate') {
    if (S.partner === 'follow') {
      S.partner = 'wait';
      S.waitAt = [t.pos.x, t.pos.z];
      ui.toast('シリカ「ここに立ってればいい？」');
      return;
    }
    return showScan(S.k, t.mat, t.label);
  }
  if (t.kind === 'node') {
    const p = power();
    const c = canHarvest(S.k, t.mat, p);
    if (!c.ok) { ui.toast(c.why); return; }
    const give = t.give![(99 - (t.left ?? 99)) % t.give!.length];
    t.left = (t.left ?? 99) - 1;
    addItem(give);
    carbon.playAction('hard_break');
    sfx.pick();
    void gotItem(give);
    if (MATERIALS[t.mat].harvest?.tier === 2) useTool();
    if (Object.values(S.inv).filter((n) => n > 0).length >= 2 && S.k.harvest) setFlag('got2');
    persist();
    return;
  }
  if (t.kind === 'obstacle') {
    const p = power();
    const c = canBreak(t.mat, p);
    if (!S.k.scan) { showScan(S.k, t.mat, t.label); return; }
    if (!c.ok) {
      const m = MATERIALS[t.mat];
      const ways = Object.keys(m.weak).filter((k) => (m.weak as Record<string, number>)[k] >= 0.8).map((k) => STAT_JA[k as 'cut']).join('・');
      ui.toast(`${p.source}では無理だ。（${c.stat ? STAT_JA[c.stat] : '力'} ${c.value.toFixed(1)} ／ 必要 ${c.need}）`);
      ui.toast(`${t.label}は「${ways || '？'}」に弱そうだ。ほかの道もあるかもしれない。`);
      return;
    }
    carbon.playAction('hard_break');
    await wait(260);
    sfx.crunch();
    shake = 0.25;
    breakThing(t);
    useTool();
    ui.toast(`${c.stat ? STAT_JA[c.stat] : 'こわした'}！（${p.source}）`);
    persist();
    return;
  }
  if (t.kind === 'device') {
    if (t.onBreak === 'fragment') return fragment();
    return showScan(S.k, t.mat, t.label);
  }
  if (t.id === 'hakobi' && flag('ferry_ok')) return rideHakobi();
  // plain look (before SCAN everything is UNKNOWN)
  showScan(S.k, t.mat, t.label);
}

function onScan() {
  if (cutscene || fx.active || ui.busy()) return;
  if (!S.k.scan) { ui.toast('まだ、物の中は見えない。'); return; }
  const t = nearest(isScannable, 4);
  if (!t) { ui.toast('近くにスキャンできる物がない。'); return; }
  sfx.scan();
  carbon.flashCrystal(0.6);
  showScan(S.k, t.mat, t.label);
  const before = S.k.scanned.length;
  for (const u of noteScan(S.k, t.mat)) void understood(u.el, u.text);
  if (S.k.scanned.length !== before && S.k.scanned.length >= 3) setFlag('scan3');
  if (t.mat === 'blue_root') { carbon.flashCrystal(1.2); note('青い根の中を、何かが流れている'); }
  if (t.id === 'mural') note('壁画の、落ちてくる人。胸に光るもの');
  updateMission();
  persist();
}

function onForm() {
  if (cutscene || fx.active || ui.busy()) return;
  if (S.form === 'sic') {
    if (!S.k.breakSkill) { ui.toast('まだ、離れ方がわからない。'); return; }
    void doBreak();
    return;
  }
  if (S.partner === 'follow' || S.partner === 'wait') {
    if (silica.root.position.distanceTo(player.pos) > 3.2) { ui.toast('シリカのそばで BOND できる'); return; }
    void doBond();
    return;
  }
  ui.toast('つながる相手がいない。');
}

function makeFromDesign(d: ToolDesign) {
  // the parts must really be in the bag
  const need: Record<string, number> = {};
  for (const id of Object.values(d)) if (id) need[id] = (need[id] ?? 0) + 1;
  if (Object.entries(need).some(([id, n]) => (S.inv[id] ?? 0) < n)) { ui.toast('部品が足りない。'); return; }
  const t = makeTool(d);
  if (!t) return;
  for (const id of Object.values(d)) if (id) S.inv[id]--;
  tools.push(t);
  equip(t);
  sfx.chime(true);
  ui.toast(`CREATE　${t.name}　（切る ${t.stats.cut} / 突く ${t.stats.pierce} / たたく ${t.stats.impact}）`, true, 4000);
  setFlag('made_tool');
  persist();
}
function openBag() {
  if (cutscene || fx.active) return;
  showBag({ inv: S.inv, tool: equipped, canCreate: S.k.create, tools, onMake: makeFromDesign, onEquip: (i) => equip(i === null ? null : tools[i]) });
}

// ── obstacle results (environment changes) ──
let fallT = -1;
function breakThing(t: Thing, instant = false) {
  t.broken = true;
  if (!S.broken.includes(t.id)) S.broken.push(t.id);
  for (const id of t.colliders ?? []) { const c = world.colliders.list.find((k) => k.id === id); if (c) c.enabled = false; }
  if (t.onBreak === 'stalk_fall') {
    // the stalk falls across the river and becomes a bridge
    if (instant) fallT = 1; else fallT = 0;
    const st = SPOTS.riverStalk;
    const y = heightAt(st.x, st.y) + 0.35; // low enough to step onto
    world.colliders.add({ id: 'stalk_bridge', kind: 'box', x: st.x, z: st.y - 8.2, hx: 0.85, hz: 8.6, rot: 0, bottom: y - 1.2, top: y });
    if (!instant) { ui.toast('菌が倒れて、川に橋がかかった！'); sfx.rumble(1.2); }
    return;
  }
  if (t.obj) {
    if (instant) { t.obj.visible = false; t.obj.userData.gone = true; }
    else shatter(t.obj);
  }
  if (instant) return;
  if (t.onBreak === 'shortcut') { setFlag('shortcut'); ui.toast('地下都市への近道がひらいた'); }
  if (t.onBreak === 'cave') { setFlag('cave'); ui.toast('奥へ入れるようになった'); }
  if (t.onBreak === 'hard_wall') setFlag('hard_wall');
  if (t.onBreak === 'tangle') setFlag('tangle');
}
const shards: { m: THREE.Object3D; t: number }[] = [];
function shatter(o: THREE.Object3D) {
  shards.push({ m: o, t: 0 });
}

// ── triggers checked every frame ──
let lastZone: Zone | null = null;
const safe = new THREE.Vector3();
let safeT = 0, swept = false, waterWarned = false;
function triggers(dt: number) {
  const p = player.pos;
  const z = zoneAt(p.x, p.z);
  if (z.zone && z.w > 0.9 && z.zone !== lastZone) {
    lastZone = z.zone;
    if (flag('wake') && !(z.zone.id === 'city' && !flag('city_seen')) && z.zone.id !== 'beyond') ui.area(z.zone.name, z.zone.sub);
    if (z.zone.id === 'mineral') setFlag('mineral');
    if (z.zone.id === 'fungus') setFlag('fungus');
  }
  if (cutscene || fx.active) return;
  const near = (v: { x: number; y: number }, r: number) => Math.hypot(p.x - v.x, p.z - v.y) < r;
  if (flag('wake') && !flag('city_seen') && near(SPOTS.ledge, 5)) void cityReveal();
  else if (flag('city_seen') && !flag('city_talk') && near(SPOTS.plaza, 9)) void cityTalk();
  else if (S.k.create && flag('made_tool') && !flag('river_crossed') && zoneAt(p.x, p.z).zone?.id === 'river' && p.z < RIVER.z - RIVER.half - 1.5) {
    setFlag('river_crossed');
    ui.toast('川をわたれた！　……やり方は、ひとつじゃなかった。', true, 4000);
  } else if (!flag('silica_met') && near(SPOTS.silica, 9)) void meetSilica();
  else if (S.k.bond && !S.k.breakSkill && zoneAt(p.x, p.z).zone?.id === 'ante' && zoneAt(p.x, p.z).w > 0.8) void teachBreak();
  else if (flag('door_open') && !flag('reveal') && near(SPOTS.reveal, 9)) void crystalReveal();
  else if (flag('reveal') && !flag('ending') && near(SPOTS.gateStop, 9)) void ending();
  // river: the current is too strong to swim
  const w = waterAt(p.x, p.z);
  if (w !== null && p.y < w - 0.4) {
    player.pos.x += 3.2 * dt;
    if (!waterWarned) { waterWarned = true; ui.toast('流れが速い！ 泳いでわたるのは無理だ。'); }
    if (p.x > RIVER.x1 - 1 && !swept) {
      swept = true;
      ui.toast('流されて、岸に打ち上げられた……。');
      player.teleport(-70, RIVER.z + 9);
      setTimeout(() => (swept = false), 500);
    }
  }
  // falling into the chasm or the pit: back to the last safe spot
  safeT -= dt;
  if (player.onGround && w === null && safeT <= 0) { safe.copy(p); safeT = 1; }
  if (!player.onGround && player.vel.y < -14 && p.y < safe.y - 10) {
    ui.toast('……落ちた。気がつくと、もとの場所にいた。');
    player.teleport(safe.x, safe.z);
  }
  // plates
  const plates = world.things.filter((t) => t.kind === 'plate');
  let pressed = 0;
  for (const pl of plates) {
    const onC = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z) < 1.3 && Math.abs(p.y - pl.pos.y) < 1;
    const onS = silica.root.visible && Math.hypot(silica.root.position.x - pl.pos.x, silica.root.position.z - pl.pos.z) < 1.3;
    const on = onC || onS;
    ((pl.obj as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0x3a9aff : 0x0a1a2a);
    if (on) pressed++;
  }
  if (pressed === 2 && !flag('door_open')) {
    setFlag('door_open');
    const c = world.colliders.list.find((k) => k.id === 'ante_door');
    if (c) c.enabled = false;
    doorT = 0;
    sfx.rumble(2);
    ui.toast('扉が開いた！', true);
    setTimeout(() => ui.toast('ひとつでは届かない所も、ふたりなら届く。'), 1800);
  }
}
let doorT = -1;

// ── partner ──
function updatePartner(dt: number) {
  if (S.partner === 'merged' || S.partner === 'none') {
    if (S.partner === 'none' && !flag('silica_met')) {
      // waiting on the dune in the mineral layer
      silica.root.visible = true;
      const s = SPOTS.silica;
      silica.root.position.set(s.x, heightAt(s.x, s.y) + 0.1, s.y);
      silica.setState('Idle', 0);
      silica.update(dt);
    }
    return;
  }
  if (fx.active) return;
  const sp = silica.root.position;
  let target: THREE.Vector3;
  if (S.partner === 'wait' && S.waitAt) target = new THREE.Vector3(S.waitAt[0], 0, S.waitAt[1]);
  else {
    const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    target = player.pos.clone().addScaledVector(fwd, -1.4).addScaledVector(side, 1.3);
  }
  const to = target.sub(sp);
  to.y = 0;
  const d = to.length();
  if (d > (S.partner === 'wait' ? 0.15 : 0.4)) {
    const speed = Math.min(d * 3, d > 6 ? 9 : 5);
    sp.addScaledVector(to.normalize(), Math.min(d, speed * dt));
    silica.root.rotation.y = Math.atan2(to.x, to.z);
    silica.setState(speed > 6 ? 'Run' : 'Walk', speed / 9);
  } else silica.setState('Idle', 0);
  if (S.partner === 'follow' && d > 25) sp.copy(player.pos).add(new THREE.Vector3(1.5, 0, 1.5));
  sp.y = world.colliders.topAt(sp.x, sp.z);
  silica.update(dt);
}

// ── input wiring ──
initKeyboardMouse(renderer.domElement);
initTouch(renderer.domElement, $('stickBase'), $('stickKnob'), $('camBase'), $('camKnob'));
bindButton($('bJump'), () => { if (ui.sayOpen) ui.advance(); else input.jump = true; });
bindAction($('bAct'), 'Interact');
bindAction($('bScan'), 'Scan');
bindAction($('bForm'), 'Form');
let runToggle = false;
bindButton($('bRun'), () => { runToggle = !runToggle; $('bRun').classList.toggle('on', runToggle); });
$('bBagTop').onclick = () => openBag();
$('bCodex').onclick = () => showCodex(S.k, S.notes);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap'].forEach((id) => ui.close(id));
});
$('bSettings').onclick = () => openSettings();

// ── which controls to show: follows the last device used ──
const KEY_LABEL: Partial<Record<ActionName, string>> = { Interact: 'E', Scan: 'R', Form: 'Q', Bond: 'Q', Break: 'Q', Menu: 'B', Map: 'C', Jump: 'Space' };
/** "E：" / "Ⓐ：" / "" in front of a prompt, depending on the device in use */
function keyHint(a: ActionName) {
  const d = getLastDevice();
  if (d === 'gamepad') return `[${padLabel(a)}] `;
  if (d === 'keyboard') return `${KEY_LABEL[a] ?? ''}：`;
  return '';
}
function renderPadHelp() {
  const row = (a: ActionName, t: string) => `${t}<b>${padLabel(a)}</b>`;
  $('padHelp').innerHTML = [row('Interact', 'しらべる'), row('Jump', 'ジャンプ'), row('Bond', 'BOND'), row('Break', 'BREAK'), row('ToolNext', '道具'), row('Menu', 'メニュー'), row('Map', '図鑑')].join('<br>') + '<br><span style="font-size:11px;opacity:.7">左スティック 移動 ／ 右スティック カメラ</span>';
}
onDeviceChange((d) => {
  document.body.classList.remove('input-touch', 'input-keyboard', 'input-gamepad');
  document.body.classList.add(`input-${d}`);
  if (d === 'gamepad') renderPadHelp();
});
onGamepad((id, on) => {
  ui.toast(on ? `GAMEPAD CONNECTED<br><span style="font-size:11px">${id.slice(0, 40)}</span>` : 'GAMEPAD DISCONNECTED', on);
  renderPadHelp();
});

// ── settings: camera sensitivity per device, invert Y (kept under this game's own key) ──
const INPUT_KEY = 'element118.ch1.input';
try { const raw = localStorage.getItem(INPUT_KEY); if (raw) applySettings(JSON.parse(raw)); } catch { /* defaults */ }
function openSettings() {
  const s = inputSettings;
  const row = (k: 'mouse' | 'touch' | 'gamepad', t: string) => `<div class="setrow"><span>${t}</span><input type="range" min="0.3" max="2.5" step="0.1" value="${s[k]}" data-k="${k}"><b id="v_${k}">${s[k].toFixed(1)}</b></div>`;
  $('settingsPanel').innerHTML = `<button class="small close" id="setX">とじる</button><h2>設定</h2><div class="kind">カメラ感度</div>
    ${row('touch', 'タッチ（右スティック）')}${row('gamepad', 'ゲームパッド（右スティック）')}${row('mouse', 'マウス')}
    <div class="setrow"><span>上下反転（Invert Y）</span><input type="checkbox" id="setInv" ${s.invertY ? 'checked' : ''}></div>
    <div class="note">移動はいつもカメラの向きが基準（スティック上＝画面の奥）。</div>
    <div class="kind">開発者向け</div>
    <div class="setrow"><span>衝突判定表示</span><input type="checkbox" id="setCol" ${colDebug.visible ? 'checked' : ''}></div>
    <div class="note">緑＝プレイヤー　赤＝障害物　青＝地形　黄＝カメラ</div>`;
  $('setX').onclick = () => ui.close('settingsWrap');
  const save = () => { try { localStorage.setItem(INPUT_KEY, JSON.stringify(inputSettings)); } catch { /* ignore */ } };
  document.querySelectorAll<HTMLInputElement>('#settingsPanel input[type=range]').forEach((el) => (el.oninput = () => {
    const k = el.dataset.k as 'mouse' | 'touch' | 'gamepad';
    applySettings({ [k]: Number(el.value) });
    $(`v_${k}`).textContent = Number(el.value).toFixed(1);
    save();
  }));
  ($('setInv') as HTMLInputElement).onchange = (e) => { applySettings({ invertY: (e.target as HTMLInputElement).checked }); save(); };
  ($('setCol') as HTMLInputElement).onchange = (e) => {
    colDebug.visible = (e.target as HTMLInputElement).checked;
    try { localStorage.setItem(DEV_KEY, JSON.stringify({ collision: colDebug.visible })); } catch { /* ignore */ }
  };
  ui.open('settingsWrap');
}
function cycleTool(dir: 1 | -1) {
  if (!tools.length) { ui.toast('道具を持っていない'); return; }
  const i = equipped ? tools.indexOf(equipped) : -1;
  const n = (i + dir + tools.length + 1) % (tools.length + 1); // includes "bare hands"
  equip(n === tools.length ? null : tools[n]);
  ui.toast(equipped ? `持ちかえ：${equipped.name}` : '素手');
}
function onBondAction() {
  if (S.form === 'sic') { ui.toast('もう つながっている'); return; }
  onForm();
}
function onBreakAction() {
  if (S.form !== 'sic') { ui.toast('いまは ひとり'); return; }
  onForm();
}
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── restore a save into the world ──
function applySave() {
  tools = S.tools.map((t) => { const k = makeTool(t.design)!; k.uses = t.uses; return k; });
  equip(S.equipped !== null && tools[S.equipped] ? tools[S.equipped] : null);
  for (const id of S.broken) { const t = world.things.find((k) => k.id === id); if (t) breakThing(t, true); }
  if (S.flags.door_open) { const c = world.colliders.list.find((k) => k.id === 'ante_door'); if (c) c.enabled = false; world.doors.ante.position.y -= 6.3; }
  if (S.form === 'sic') { carbon.setForm('sic'); $('form').style.display = 'inline-block'; }
  if (S.partner === 'follow' || S.partner === 'wait') { silica.root.visible = true; silica.root.position.copy(player.pos).add(new THREE.Vector3(1.4, 0, 1.4)); }
  if (S.hakobiSide === 'north') { world.hakobi.root.position.set(SPOTS.riverFar.x, RIVER.level - 1.1, SPOTS.riverFar.y - 3.8); world.things.find((t) => t.id === 'hakobi')!.pos = world.hakobi.root.position; }
  if (S.k.create) $('bBagTop').classList.remove('hide');
  if (S.flags.fragment) world.things.find((t) => t.id === 'mask_fragment')!.broken = true;
  if (S.pos) player.teleport(S.pos[0], S.pos[2]);
  safe.copy(player.pos);
  updateMission();
}

// ── main loop ──
let last = performance.now();
let T = 0;
let shake = 0;
const fpsA: number[] = [];
const debugOn = params.has('debug');
const lightOrder = world.lights.map((l, i) => ({ i, d: 0 }));
let hideCarbonNearCamera = false;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  T += dt;
  fpsA.push(dt); if (fpsA.length > 30) fpsA.shift();
  pollInput(dt);
  if (runToggle) input.run = true;
  // actions (the same for touch, keyboard and gamepad)
  if (gotIsOpen() && (input.action || input.jump)) { dismissGot(); input.action = input.jump = false; }
  if (input.action || (input.jump && ui.sayOpen)) { if (ui.sayOpen) { ui.advance(); input.jump = false; } else void onAction(); }
  if (!cutscene && !ui.sayOpen) {
    if (input.scan) onScan();
    if (input.form) onForm();
    if (input.bond) onBondAction();
    if (input.breakForm) onBreakAction();
    if (input.toolPrev) cycleTool(-1);
    if (input.toolNext) cycleTool(1);
    if (input.menu) { if (ui.busy()) ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap'].forEach((id) => ui.close(id)); else if (S.k.create || Object.keys(S.inv).length) openBag(); else openSettings(); }
    if (input.codex) { if (ui.busy()) ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap'].forEach((id) => ui.close(id)); else if (S.k.scan) showCodex(S.k, S.notes); }
    if (input.action && ui.busy() && !ui.sayOpen) ['scanWrap', 'codexWrap'].forEach((id) => ui.close(id));
  }
  // the player turns the camera (not during cut-scenes or menus)
  if (!cutscene && !ui.busy()) cam.addLook(input.lookX, input.lookY);

  fx.update(dt);
  const { forward, right } = cam.basis();
  const free = !cutscene && !ui.busy() && !fx.frozen;
  if (!cutscene) {
    for (const n of world.npcs) n.syncCollider();
    if (!free) player.locked = true;
    else if (!fx.active) player.locked = false;
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    if (!fx.frozen) {
      for (let i = 0; i < steps; i++) {
        player.update(dt / steps, input, forward, right);
        if (i === 0) input.jump = false;
      }
    }
  }
  if (!fx.frozen) carbon.update(dt);
  triggers(dt);
  updatePartner(dt);

  // cutscene-only animation bits
  if (emerge >= 0 && emerge < 1) {
    emerge = Math.min(1, emerge + dt * 0.6);
    carbon.root.position.y = heightAt(SPOTS.pileTop.x, SPOTS.pileTop.y) - 1.2 + emerge * 1.3;
    carbon.root.rotation.x = -1.1 * (1 - emerge);
  }
  if (standUp >= 0 && standUp < 1) {
    standUp = Math.min(1, standUp + dt * 0.9);
    carbon.root.rotation.x = -Math.PI / 2 * (1 - standUp);
    carbon.root.position.y = heightAt(SPOTS.wake.x, SPOTS.wake.y) + 0.15 * (1 - standUp);
  }
  for (const d of debris) {
    if (d.v.lengthSq() < 0.01) continue;
    d.v.y -= 18 * dt;
    d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt;
    const gy = heightAt(d.m.position.x, d.m.position.z) + 0.2;
    if (d.m.position.y < gy) { d.m.position.y = gy; d.v.multiplyScalar(0.3); d.v.y = Math.abs(d.v.y) * 0.3; if (d.v.length() < 0.5) d.v.set(0, 0, 0); }
  }
  if (fallT >= 0 && fallT <= 1) {
    const st = world.things.find((t) => t.id === 'stalk')!.obj!;
    fallT = Math.min(1.01, fallT + dt * 0.9);
    const e = Math.min(1, fallT);
    st.rotation.x = -Math.PI / 2 * e * e;
    st.position.y = heightAt(SPOTS.riverStalk.x, SPOTS.riverStalk.y) - 0.35 * e;
  }
  if (doorT >= 0 && doorT < 1) { doorT = Math.min(1, doorT + dt * 0.4); world.doors.ante.position.y -= dt * 0.4 * 6.3; }
  for (const s of shards) {
    if (s.t >= 1) continue;
    s.t = Math.min(1, s.t + dt * 2.5);
    s.m.scale.setScalar(Math.max(0.001, 1 - s.t));
    s.m.position.y -= dt * 2;
    if (s.t >= 1) { s.m.visible = false; s.m.userData.gone = true; }
  }
  if (revealPulse >= 0) revealPulse += dt;
  if (gateGlow >= 0) {
    gateGlow = Math.min(1, gateGlow + dt * 0.6);
    (world.doors.emblem.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + gateGlow * 3;
    (world.doors.socket.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + gateGlow * 3;
  }
  if (gateOpen >= 0 && gateOpen < 1) {
    gateOpen = Math.min(1, gateOpen + dt * 0.35);
    world.doors.gateL.position.z = 76 - gateOpen * 0.7;
    world.doors.gateR.position.z = 80 + gateOpen * 0.7;
  }
  if (farOn >= 0) { farOn = Math.min(1, farOn + dt * 0.4); (world.doors.farLights.material as THREE.PointsMaterial).opacity = farOn * 0.9; }

  for (const n of world.npcs) n.update(dt, heightAt, cutscene ? undefined : player.pos);
  for (const c of world.crawlers) c.update(dt, heightAt, player.pos, player.horizontalSpeed);
  for (const s of world.snails) s.update(dt, heightAt);
  world.hakobi.update(dt, false);
  world.update(T, dt);
  if (T % 7 < dt) sfx.drip();

  // camera
  if (cine) {
    const k = 1 - Math.exp(-dt * 1.6);
    camPos.lerp(cine.pos, k);
    camLook.lerp(cine.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  } else {
    cam.update(dt, player.pos, player.moving, player.facing);
    camPos.copy(camera.position);
    colDebug.update(dt, { pos: player.pos, radius: MOVE.radius, height: MOVE.height }, { pivot: cam.pivotPoint, cam: camera.position, radius: CAMERA_TUNING.radius });
    camLook.copy(cam.pivotPoint);
  }
  // safety net (cut-scene cameras too): never above the cave ceiling
  const cy = ceilAt(camera.position.x, camera.position.z) - 0.6;
  if (camera.position.y > cy) camera.position.y = cy;
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }

  // lights: the nearest spots to the camera get the pool
  for (const o of lightOrder) o.d = world.lights[o.i].pos.distanceToSquared(camera.position);
  lightOrder.sort((a, b) => a.d - b.d);
  for (let i = 0; i < POOL; i++) {
    const L = world.lights[lightOrder[i].i];
    pool[i].position.copy(L.pos);
    pool[i].color.setHex(L.color);
    pool[i].intensity = L.power * 9;
  }
  crystalLight.position.copy(carbon.anchor(tmp));
  crystalLight.intensity = 3 + (S.form === 'sic' ? 2 : 0);
  // area air: ease fog and fill light toward the current area's look
  if (!fogLocked) {
    const zid = zoneAt(camera.position.x, camera.position.z).zone?.id ?? '';
    const A = ATMOS[zid] ?? ATMOS.default;
    const k = 1 - Math.exp(-dt * 1.5);
    const f = scene.fog as THREE.Fog;
    f.color.lerp(atmosFog.set(A.fog), k);
    f.near += (A.near - f.near) * k;
    f.far += (A.far - f.far) * k;
    scene.background = f.color;
    hemi.color.lerp(atmosSky.set(A.sky), k);
    hemi.groundColor.lerp(atmosGround.set(A.ground), k);
    hemi.intensity += (A.hemi - hemi.intensity) * k;
    renderer.toneMappingExposure += ((A.exp ?? 1.35) - renderer.toneMappingExposure) * k;
  }
  // contact shadow
  const gy = world.colliders.topAt(player.pos.x, player.pos.z, 0);
  blob.position.set(player.pos.x, Math.min(gy, player.pos.y) + 0.04, player.pos.z);
  // Tight walls still shorten the orbit. Keep Carbon out of the render while the lens is too close.
  // A small gap between thresholds avoids flickering as the camera moves along a wall.
  hideCarbonNearCamera = !cutscene && !cine && cam.distance < (hideCarbonNearCamera ? 1.15 : 0.95);
  blob.visible = carbon.root.visible && !cutscene && !hideCarbonNearCamera;

  // prompts and buttons
  const t = !cutscene && !ui.busy() ? nearest(isActionable) : null;
  const scanT = S.k.scan && !cutscene ? nearest(isScannable, 4) : null;
  const dev = getLastDevice();
  const scanHint = scanT && dev !== 'touch' ? `${keyHint('Scan')}スキャン` : '';
  const pr = t ? `${keyHint('Interact')}${actionLabel(t)}` : null;
  ui.prompt(pr ? pr + (scanHint ? '　　' + scanHint : '') : scanHint || null);
  $('bAct').classList.toggle('hide', !t);
  $('bAct').textContent = t ? actionLabel(t).replace(/（.*$/, '') : 'E';
  $('bScan').classList.toggle('hide', !S.k.scan);
  const canForm = S.form === 'sic' ? S.k.breakSkill : S.partner === 'follow' || S.partner === 'wait';
  $('bForm').classList.toggle('hide', !canForm);
  $('bForm').textContent = S.form === 'sic' ? 'BREAK' : 'BOND';
  $('bCodex').classList.toggle('hide', !S.k.scan);
  if (debugOn) { const fps = fpsA.length / fpsA.reduce((a, b) => a + b, 0); $('debug').textContent = `${fps.toFixed(0)}fps (${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}) ${lastZone?.id ?? ''}`; }

  // autosave now and then
  if (flag('wake') && T % 15 < dt) persist();
  cullFar(dt);
  const carbonVisible = carbon.root.visible;
  if (hideCarbonNearCamera) carbon.root.visible = false;
  try {
    renderer.render(scene, camera);
  } finally {
    carbon.root.visible = carbonVisible;
  }
  endFrame();
  requestAnimationFrame(frame);
}

// ── start ──
async function begin(cont: boolean) {
  startAudio();
  $('start').style.display = 'none';
  const sv = loadSave();
  if (cont && sv) {
    S = sv;
    upgradeSave(S);
    applySave();
    sfx.ambience(true);
    await ui.fade(false, 1200);
    return;
  }
  S = fresh();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  updateMission();
  if (params.has('skip')) {
    S.flags.prologue = true;
    S.flags.wake = true;
    player.teleport(SPOTS.wake.x, SPOTS.wake.y);
    safe.copy(player.pos);
    updateMission();
    await ui.fade(false, 300);
    return;
  }
  await prologue();
  S.flags.prologue = true;
  await awaken();
  safe.copy(player.pos);
}
if (loadSave()) $('bCont').style.display = 'block';
$('bNew').onclick = () => void begin(false);
$('bCont').onclick = () => void begin(true);
requestAnimationFrame(frame);

// test hooks
(window as unknown as { __ch1: unknown }).__ch1 = {
  get S() { return S; }, player, world, cam, silica, carbon, fx, ui, zones: ZONES, colDebug,
  begin, onAction, onScan, onForm, makeFromDesign, equip, input, viewerStats, gotIsOpen, dismissGot, gotItem, understood, openBag, get tools() { return tools; }, heightAt, ceilAt, zoneAt,
  get renderInfo() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }; },
  get cutscene() { return cutscene; }, level: (s: 'Si') => level(S.k, s), persist,
};
