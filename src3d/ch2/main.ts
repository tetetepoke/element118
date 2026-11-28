// ELEMENT 118 — Chapter 2 「銅の灯、天の脈」
// Starts right after chapter 1: Carbon and Silica slip through the stuck upper gate.
// Shared systems (movement, collision, camera, input, character visuals, BOND effect) are used as they
// are; everything chapter-2 specific lives under src3d/ch2/. Saves only under element118.ch2.*.
import * as THREE from 'three';
import { registerChapter2Data, SMELT, SN } from './data';
registerChapter2Data();
import { setGround } from '../world/ground';
import { mineGround, ceilAt, heightAt, waterAt, zoneAt, SPOTS, ZONES, type Zone } from './world/mine';
setGround(mineGround);
import { buildWorld, type Thing } from './world/build';
import { input, endFrame, initKeyboardMouse, initTouch, bindButton, bindAction, pollInput, onDeviceChange, onGamepad, getLastDevice, padLabel, applySettings, settings as inputSettings } from '../core/input';
import type { ActionName } from '../core/inputConfig';
import { ThirdPersonCamera, CAMERA_TUNING } from '../core/camera';
import { CHAPTER_CAMERA, CHAPTER_CARBON_SCALE, CHAPTER_MOVE_SPEED } from '../core/chapterPresentation';
Object.assign(CAMERA_TUNING, CHAPTER_CAMERA);
import { PlayerController, TUNING as MOVE } from '../player/controller';
import { ProceduralCarbon, ProceduralSilica } from '../player/visual';
import { CollisionDebug } from '../world/collisionDebug';
import { BondFx } from '../fx/bondFx';
import { ui, wait, showScan, showBag, showCodex, setAutoAdvance, autoAdvance, showGot, dismissGot, gotIsOpen } from '../ch1/ui';
import { viewerStats } from '../ch1/itemViewer';
import { sfx, startAudio } from '../ch1/audio';
import { ITEMS, MATERIALS, ELEMENTS, type ElementSymbol } from '../ch1/game/materials';
import { newKnowledge, noteScan, level, type KnowledgeState } from '../ch1/game/knowledge';
import { makeTool, toolMesh, type Tool, type ToolDesign } from '../ch1/game/craft';
import { canBreak, canHarvest, HANDS, STAT_JA, type Power } from '../ch1/game/interact';
import { ProceduralCupra, buildCuOverlay } from './world/actors';

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
if (params.has('auto')) setAutoAdvance(true);

// ── renderer (no sky: only roots, lamps, the furnace and copper glow give light) ──
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' }); } catch { $('fail').style.display = 'flex'; throw new Error('WebGL not available'); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
$('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const FOG = { color: 0x0a0c12, near: 12, far: 100 };
scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
scene.background = new THREE.Color(FOG.color);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
const hemi = new THREE.HemisphereLight(0x7a8ab0, 0x2a2016, 1.05);
scene.add(hemi);
const ATMOS: Record<string, { fog: number; near: number; far: number; sky: number; ground: number; hemi: number }> = {
  default: { fog: FOG.color, near: FOG.near, far: FOG.far, sky: 0x7a8ab0, ground: 0x2a2016, hemi: 1.05 },
  village: { fog: 0x1e1612, near: 10, far: 85, sky: 0xb09070, ground: 0x4a3018, hemi: 1.35 },
  green: { fog: 0x0c1a14, near: 8, far: 60, sky: 0x6aa890, ground: 0x1a3020, hemi: 1.1 },
  deep: { fog: 0x0a1612, near: 6, far: 50, sky: 0x5a9a80, ground: 0x18281e, hemi: 1.0 },
  stream: { fog: 0x10141a, near: 9, far: 70, sky: 0x8090b0, ground: 0x2a2a24, hemi: 1.1 },
  shaft: { fog: 0x080a12, near: 16, far: 160, sky: 0x6a86c8, ground: 0x1a1a24, hemi: 1.0 },
};
let fogLocked = false;
const atmosFog = new THREE.Color(), atmosSky = new THREE.Color(), atmosGround = new THREE.Color();

const world = buildWorld();
scene.add(world.root);
// distance culling (visual only): things past the fog are not drawn (keeps draw calls low on phones)
const cullList: { o: THREE.Object3D; c: THREE.Vector3; r: number }[] = [];
{
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  world.root.updateMatrixWorld(true);
  for (const o of world.root.children) {
    if (o.name === 'floor' || o.name === 'ceiling') continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sph);
    if (sph.radius > 70) continue;
    cullList.push({ o, c: sph.center.clone(), r: sph.radius });
  }
}
let cullT = 0;
function cullFar(dt: number) {
  cullT -= dt;
  if (cullT > 0) return;
  cullT = 0.2;
  const far = (scene.fog as THREE.Fog).far, cp = camera.position;
  for (const k of cullList) {
    if (k.o === world.parts.liftG) { k.o.visible = true; continue; } // it moves during the ending
    k.o.visible = !k.o.userData.gone && k.c.distanceTo(cp) - k.r < far;
  }
}
const POOL = isTouch ? 5 : 7;
const pool: THREE.PointLight[] = [];
for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 34, 1.3); scene.add(l); pool.push(l); }
const crystalLight = new THREE.PointLight(0x5ab8ff, 6, 7, 1.6);
scene.add(crystalLight);

// ── characters ──
const carbon = new ProceduralCarbon({ smooth: true, scale: CHAPTER_CARBON_SCALE });
scene.add(carbon.root);
const cuOverlay = buildCuOverlay();
carbon.root.add(cuOverlay);
const player = new PlayerController(carbon, world.colliders);
player.speedMul = CHAPTER_MOVE_SPEED;
const silica = new ProceduralSilica({ smooth: true, scale: CHAPTER_CARBON_SCALE });
scene.add(silica.root);
const cupra = new ProceduralCupra(CHAPTER_CARBON_SCALE);
cupra.root.visible = false;
scene.add(cupra.root);
const fx = new BondFx();
scene.add(fx.root);
const cam = new ThirdPersonCamera(camera, world.colliders);
cam.extraSolid = (x, y, z) => y > ceilAt(x, z) - 0.35 || y < heightAt(x, z);
const colDebug = new CollisionDebug(scene, world.colliders);
const DEV_KEY = 'element118.ch2.dev';
try { colDebug.visible = JSON.parse(localStorage.getItem(DEV_KEY) ?? '{}').collision === true; } catch { /* off */ }
const blob = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d')!; const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
  const shadowSize = 1.2 * CHAPTER_CARBON_SCALE;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(shadowSize, shadowSize).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  scene.add(m); return m;
})();

// ── state (saved) ──
type Who = 'silica' | 'cupra';
type Mode = 'none' | 'merged' | 'follow' | 'wait';
type Form = 'normal' | 'sic' | 'cu';
interface Save {
  v: 1;
  flags: Record<string, boolean>;
  inv: Record<string, number>;
  tools: { design: ToolDesign; uses: number }[];
  equipped: number | null;
  k: KnowledgeState;
  form: Form;
  partners: Record<Who, Mode>;
  waitAt: Partial<Record<Who, [number, number]>>;
  gaps: Record<string, 'wire' | undefined>;
  broken: string[];
  notes: string[];
  pos?: [number, number, number];
  seen: string[];
  seenEl: string[];
}
const SAVE_KEY = 'element118.ch2.save';
/** chapter 2 begins where chapter 1 ended: SCAN / HARVEST / CREATE / BOND / BREAK known, Silica along */
function fresh(): Save {
  const k = newKnowledge();
  Object.assign(k, { scan: true, harvest: true, create: true, bond: true, breakSkill: true });
  k.el = { C: 2, O: 2, Si: 2, Fe: 1, H: 1, Cu: 1 };
  k.scanned = ['stone', 'water', 'wood', 'quartz'];
  return {
    v: 1, flags: {}, inv: { stick: 1, fiber: 2, sharp_stone: 1 }, tools: [], equipped: null, k, form: 'normal',
    partners: { silica: 'follow', cupra: 'none' }, waitAt: {}, gaps: {}, broken: [],
    notes: ['なぜ、カーボンは降ってきたのか', '門の向こうの光は何？', '胸の結晶は、なぜ根と同じ色なのか'],
    seen: ['stick', 'fiber', 'sharp_stone'], seenEl: ['C', 'O', 'Si'],
  };
}
let S: Save = fresh();
let tools: Tool[] = [];
function loadSave(): Save | null {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const s = JSON.parse(raw) as Save; return s && s.v === 1 ? s : null; } catch { return null; }
}
function persist() {
  try {
    S.pos = [player.pos.x, player.pos.y, player.pos.z];
    S.tools = tools.map((t) => ({ design: t.design, uses: t.uses }));
    S.equipped = equipped ? tools.indexOf(equipped) : null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch { /* storage blocked: the game still runs */ }
}
const flag = (f: string) => !!S.flags[f];
function setFlag(f: string) { if (S.flags[f]) return; S.flags[f] = true; updateMission(); persist(); }
function note(n: string) { if (!S.notes.includes(n)) S.notes.push(n); }
async function gotItem(id: string, n = 1) {
  if (S.seen.includes(id)) { ui.toast(`＋ ${ITEMS[id].nameJa} ×${n}`); return; }
  S.seen.push(id); persist();
  await showGot({ subject: { kind: 'item', id }, tag: 'NEW', title: ITEMS[id].nameJa, count: n });
}
async function understood(sym: ElementSymbol, text?: string) {
  if (S.seenEl.includes(sym)) return;
  S.seenEl.push(sym); persist();
  const e = ELEMENTS[sym];
  sfx.chime(true);
  await showGot({ subject: { kind: 'element', symbol: sym }, tag: 'UNDERSTOOD', title: sym, line2: String(e.z), line3: `${e.en}<br>${e.nameJa}`, note: text });
}

// ── tools ──
let equipped: Tool | null = null;
let handMesh: THREE.Object3D | null = null;
function equip(t: Tool | null) {
  equipped = t;
  if (handMesh) carbon.rightHand.remove(handMesh);
  handMesh = null;
  if (t) { handMesh = toolMesh(t.design); carbon.rightHand.add(handMesh); }
  const tag = $('toolTag');
  tag.style.display = t ? 'inline-block' : 'none';
  if (t) tag.textContent = `${t.name}（${t.uses}）`;
}
const addItem = (id: string, n = 1) => { S.inv[id] = (S.inv[id] ?? 0) + n; };
const has = (id: string, n = 1) => (S.inv[id] ?? 0) >= n;
function power(): Power {
  let p: Power = { ...HANDS };
  if (equipped) p = { cut: equipped.stats.cut, impact: equipped.stats.impact, pierce: equipped.stats.pierce, source: equipped.name };
  if (S.form === 'sic' && 9 > p.impact) p = { ...p, impact: 9, source: 'SiC FORM（HARD BREAK）' };
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
  if (!f('start')) return;
  if (!f('lift_seen')) return ui.mission('上へ', '大縦穴（東）の昇降機をしらべる');
  if (!f('village')) return ui.mission('人をさがす', 'レールの続く坑道を北へ');
  if (!f('chief')) return ui.mission('村の人に話を聞く', '村のまん中の坑長');
  if (!f('smelter')) return ui.mission('銅をつくる', '炉のそばの炉番に話す');
  if (!f('copper')) {
    const need = [!has('malachite') && !has('copper') ? '孔雀石（西の緑の坑）' : '', !has('charcoal') && !has('copper') ? '炭（坑木を炭焼き窯で焼く）' : ''].filter(Boolean).join('　／　');
    return ui.mission('銅をつくる', need || '古い炉で、孔雀石と炭を熱する');
  }
  if (!f('wire')) return ui.mission('銅線をつくる', '古い炉で、銅を細くのばす');
  if (!f('legend')) return ui.mission('切れた線のこと', '記録守（村の東）に聞く');
  if (!f('cupra')) return ui.mission('緑青の洞へ', '緑の坑の奥（南）。ロクショウムシに気をつけて');
  if (!f('record')) return ui.mission('古い文字を読む', 'キュプラと、記録の間（村の北）へ');
  if (!f('power')) return ui.mission('根の光の発電所', '砂錫の沢の南。切れた線を二か所つなぐ');
  if (!f('ending')) return ui.mission('上へ', '大縦穴の昇降機へ');
  ui.mission('第2章クリア', '自由に探索できる');
}

// ── interaction targets ──
const tmp = new THREE.Vector3();
function nearest(filter: (t: Thing) => boolean, extra = 0.6) {
  let best: Thing | null = null, bd = Infinity;
  for (const t of world.things) {
    if (t.broken || !filter(t)) continue;
    const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
    if (d > t.r + extra || Math.abs(t.pos.y - player.pos.y) > 5 + t.r * 0.5) continue;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
const isActionable = (t: Thing) => t.kind !== 'scan' || t.id === 'gate';
function actionLabel(t: Thing): string {
  switch (t.kind) {
    case 'npc': return '話す';
    case 'node': return `取る（${t.label}）`;
    case 'obstacle': { const c = canBreak(t.mat, power()); return c.ok ? `${c.stat ? STAT_JA[c.stat] : 'こわす'}（${t.label}）` : `しらべる（${t.label}）`; }
    case 'gap': return gapConducted(t.id) ? `つながっている（${t.label}）` : `つなぐ（${t.label}）`;
    case 'device': return t.id === 'furnace' ? '炉をつかう' : t.id === 'kiln' ? '炭を焼く' : t.id === 'bait' ? '台をつかう' : t.id === 'lift' && flag('power') ? '昇降機に乗る' : 'しらべる';
    default: return 'しらべる';
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
  cutscene = true; player.locked = true;
  try { await fn(); } finally { cutscene = false; player.locked = false; cine = null; }
}
const npc = (id: string) => world.npcs.find((n) => n.id === id)!;
const P = () => player.pos;

// ── choice panel (furnace, kiln, gaps) ──
let choiceOpen = false;
function choose(title: string, opts: { label: string; sub?: string; ok: boolean; run: () => void | Promise<void> }[]) {
  choiceOpen = true;
  $('choicePanel').innerHTML = `<button class="small close" id="chX">とじる</button><h2>${title}</h2>` +
    opts.map((o, i) => `<button class="opt" data-i="${i}" ${o.ok ? '' : 'disabled'}>${o.label}${o.sub ? `<div class="need">${o.sub}</div>` : ''}</button>`).join('');
  const close = () => { ui.close('choiceWrap'); choiceOpen = false; };
  $('chX').onclick = close;
  document.querySelectorAll<HTMLButtonElement>('#choicePanel button.opt').forEach((b) => (b.onclick = () => { close(); void opts[Number(b.dataset.i)].run(); }));
  ui.open('choiceWrap');
}

// ══════════ story ══════════
async function prologue() {
  await scene_(async () => {
    ui.fade(true, 10);
    sfx.ambience(true);
    const gz = SPOTS.gateDoor.y;
    player.teleport(0, gz - 2.2);
    carbon.root.position.copy(P());
    silica.root.visible = true;
    silica.root.position.set(0.9, heightAt(0.9, gz - 1.4), gz - 1.4);
    setCine(3.5, 2.2, gz - 6, 0, 1.4, gz - 1, true);
    await wait(500);
    sfx.clank(0.5); await ui.caption('ギ……　ギギ……', 1500);
    await ui.fade(false, 1400);
    await ui.say('シリカ', '……通れた。カーボン、細いね。');
    await ui.say('カーボン', 'シリカもね。');
    sfx.rumble(2.5);
    gateClose = 0;
    setCine(-4, 3, gz - 7, 0, 3, gz);
    await wait(1800);
    sfx.clank(0.3);
    await ui.say('カーボン', '……閉まった。');
    await ui.say('シリカ', 'もう、戻れないね。');
    await ui.say('カーボン', '戻らないよ。上へ行くんだ。');
    const r = SPOTS.rootShaft;
    setCine(8, 4, 92, r.x, 60, r.y);
    carbon.flashCrystal(1.4);
    await wait(2600);
    await ui.say('カーボン', '根が……もっと太い。');
    await ui.say('シリカ', '下で見た根より、ずっと。');
    setFlag('start');
    persist();
  });
  ui.toast('前回までの力：SCAN / HARVEST / CREATE / BOND / BREAK');
}
let gateClose = -1;

async function liftTalk() {
  if (flag('power')) return ending();
  await scene_(async () => {
    const L = SPOTS.lift;
    setCine(L.x - 6, heightAt(L.x, L.y) + 3, L.y + 5, L.x, heightAt(L.x, L.y) + 1, L.y);
    await ui.say('カーボン', '動かない。……何かが、流れてない。');
    showScan(S.k, 'machine', '昇降機');
    await wait(autoAdvance ? 50 : 1200);
    ui.close('scanWrap');
    await ui.say('カーボン', '線が、切れてる。Cu ……？　門と、同じだ。');
    await ui.say('シリカ', 'レールがある。だれかが使ってた道だよ。');
    note('昇降機を動かしていた「力」は、どこから来ていた？');
  });
  setFlag('lift_seen');
}

async function villageArrive() {
  await scene_(async () => {
    setFlag('village');
    setCine(0, 16, 40, 0, 6, 8, true);
    ui.area('カンテラ村', '坑夫たちの集落');
    sfx.chime(true);
    await wait(3000);
    const m = npc('miner_a');
    m.lookAt(P());
    setCine(P().x + 3, P().y + 2.2, P().z + 2, m.root.position.x, m.root.position.y + 1.2, m.root.position.z);
    await ui.say('坑夫', '……子ども？　どこから来た。');
    await ui.say('カーボン', '門の、向こうから。');
    await ui.say('坑夫', '門の向こう……下からだって？　下から登ってきた奴なんて、聞いたことがない。');
    await ui.say('坑夫', '落ちていく奴なら、たまにいるがな。……坑長に会っていけ。まん中の家の前だ。');
  });
}

async function chiefTalk() {
  const c = npc('chief');
  c.lookAt(P());
  if (!flag('chief')) {
    await scene_(async () => {
      setCine(P().x - 3, P().y + 2.2, P().z + 3, c.root.position.x, c.root.position.y + 1.4, c.root.position.z);
      await ui.say('坑長', '下から来た、仮面の子か。……そんな仮面の奴は、この村にはいない。');
      await ui.say('カーボン', '上へ行きたいんだ。大縦穴の昇降機で。');
      await ui.say('坑長', 'あれは止まって長い。');
      await ui.say('坑長', '昔は、南の「発電所」から銅の線で力が来てた。ロクショウムシに線をかじられて、そのうえ銅も掘りつくした。');
      await ui.say('坑長', '今じゃ村の灯りも、炉の火も細る一方だ。……銅さえ、あればな。');
      await ui.say('シリカ', '銅……門にも足りなかったもの。');
      await ui.say('坑長', '銅をつくりたいなら、炉番のところへ行け。炉のそばにいる。');
    });
    setFlag('chief');
    return;
  }
  if (flag('power')) { await ui.say('坑長', 'やりやがったな！　昇降機の灯がついたって、村じゅう大さわぎだ。'); return; }
  if (flag('copper')) { await ui.say('坑長', '銅だ……！　この色を見るのは、何年ぶりだろうな。'); return; }
  await ui.say('坑長', '炉番は、炉のそばにいる。銅のことなら、あいつに聞け。');
}

async function smelterTalk() {
  const s = npc('smelter');
  s.lookAt(P());
  if (!flag('chief')) { await ui.say('炉番', '見ない顔だな。坑長にはもう会ったのか？'); return; }
  if (!flag('smelter')) {
    await scene_(async () => {
      setCine(P().x + 3, P().y + 2, P().z + 2, s.root.position.x, s.root.position.y + 1.3, s.root.position.z);
      await ui.say('炉番', '銅をつくる？　いいとも。いるのは二つだ。');
      await ui.say('炉番', 'ひとつ、孔雀石。西の「緑の坑」にある、しま模様の緑の石だ。');
      await ui.say('炉番', 'ふたつ、炭。坑道の古い坑木を、そこの炭焼き窯で焼けばいい。');
      await ui.say('炉番', '石と炭をいっしょに炉で熱すると、石の中から銅が出てくる。じいさんの代からのやり方さ。');
    });
    setFlag('smelter');
    return;
  }
  if (!flag('copper')) { await ui.say('炉番', '孔雀石と炭がそろったら、炉をつかいな。'); return; }
  if (!flag('tin_hint')) {
    S.flags.tin_hint = true;
    await ui.say('炉番', 'ついでに教えとこう。東の沢の黒い砂からは「すず」が取れる。銅にまぜると、ずっとかたくなるんだ。');
    return;
  }
  await ui.say('炉番', '銅はのびやすい。たたいて引きのばせば、線にもなる。');
}

async function keeperTalk() {
  const k = npc('keeper');
  k.lookAt(P());
  if (flag('record')) { await ui.say('記録守', '天晶脈……。根の本当の名が、そんな名だったとはな。'); await ui.say('記録守', '「天」とは、なんだろうな。わしらは、聞いたこともない。'); return; }
  if (!flag('copper')) { await ui.say('記録守', '北の「記録の間」の石板は、だれにも読めん。わしの祖父の祖父の代から、ずっとだ。'); return; }
  if (!flag('legend')) {
    await scene_(async () => {
      setCine(P().x - 2.5, P().y + 2, P().z + 2.5, k.root.position.x, k.root.position.y + 1.4, k.root.position.z);
      await ui.say('記録守', '銅線をつないで、発電所を動かす？　……ひとつ、昔話をしてやろう。');
      await ui.say('記録守', '発電所の線には、昔から長い切れ目があった。そこには「銅の子」が立って、力を通していたという。');
      await ui.say('記録守', '銅の子は、いまは緑青の洞の奥で眠っている。眠りながら、銅を食う虫を集めてな。');
      await ui.say('カーボン', '銅の……子。');
      await ui.say('記録守', '緑の坑の奥、南だ。岩くずでふさがって久しいが……。');
    });
    setFlag('legend');
    return;
  }
  await ui.say('記録守', '緑青の洞は、緑の坑の奥だ。ロクショウムシは、かたい物にぶつかるとはね返るそうだ。銅のにおいにも集まる。');
}

async function npcTalk(id: string) {
  const n = world.npcs.find((k) => k.id === id);
  n?.lookAt(P());
  if (id === 'chief') return chiefTalk();
  if (id === 'smelter') return smelterTalk();
  if (id === 'keeper') return keeperTalk();
  const lines: Record<string, [string, string][]> = {
    miner_a: [['坑夫', 'レールは昔、昇降機まで続いてた。上から、いろんな物をおろしてきたんだと。']],
    miner_b: [['坑夫', '門の向こうから？　冗談だろ。門はおれのじいさんの代から閉まってる。'], ['坑夫', 'ヒカリクイは灯りが好きでな。根の光にも、ランプにも集まる。']],
    kid: [['子ども', 'ねえ、下には何があるの？'], ['子ども', '村のこわれた物は、ぜんぶ「落とし穴」にすてるんだ。どこまで落ちるのかな。'], ['カーボン', '……第七廃棄区。']],
    weaver: [['機織り', '菌糸のひもも、銅の針がないと、うまく編めないのよ。']],
    panner: [['砂取り', 'この沢の黒い砂は重いんだ。水でゆすると、軽い砂だけ流れて、黒い粒が残る。'], ['砂取り', '炉番のじいさんは、こいつを「すず」って呼んでる。']],
  };
  for (const [w, t] of lines[id] ?? [['住民', '……']]) await ui.say(w, t);
  if (id === 'kid') note('村の「落とし穴」は、第七廃棄区につながっている？');
}

// ── the kiln and the furnace ──
async function useKiln() {
  if (!flag('smelter')) { await ui.say('カーボン', '石でできた、まるい窯。中は、すすで黒い。'); return; }
  choose('炭焼き窯', [{
    label: '坑木を焼いて炭にする', sub: `木の棒 ×1 → 炭 ×2　（持っている木の棒：${S.inv.stick ?? 0}）`, ok: has('stick'),
    run: async () => {
      S.inv.stick--;
      sfx.rumble(0.8);
      ui.toast('空気を少なくして、じっくり焼く……');
      await wait(autoAdvance ? 30 : 900);
      addItem('charcoal', 2);
      await gotItem('charcoal', 2);
      if (!flag('charcoal_seen')) {
        S.flags.charcoal_seen = true;
        showScan(S.k, 'charcoal', '炭');
        await wait(autoAdvance ? 30 : 600);
        await ui.say('カーボン', '……これ、ほとんど C だ。ぼくと、同じ。');
        note('炭は、ほとんど炭素でできている');
      }
      updateMission(); persist();
    },
  }]);
}
function useFurnace() {
  if (!flag('smelter')) { void ui.say('カーボン', '古い炉。火はまだ、かすかに残ってる。'); return; }
  const fmt = (r: Record<string, number>) => Object.entries(r).map(([id, n]) => `${ITEMS[id].nameJa} ×${n}`).join(' ＋ ');
  const visible = SMELT.filter((r) => r.id === 'copper' || r.id === 'wire' || flag('tin_hint') || has('cassiterite'));
  choose('古い炉', visible.map((r) => ({
    label: r.label, sub: `${fmt(r.need)} → ${fmt(r.give)}`, ok: Object.entries(r.need).every(([id, n]) => has(id, n)),
    run: () => smelt(r.id),
  })));
}
async function smelt(id: string) {
  const r = SMELT.find((k) => k.id === id)!;
  for (const [i, n] of Object.entries(r.need)) S.inv[i] -= n;
  sfx.rumble(1.2);
  shake = 0.2;
  await wait(autoAdvance ? 30 : 900);
  for (const [i, n] of Object.entries(r.give)) { addItem(i, n); await gotItem(i, n); }
  ui.toast(r.note, true, 4200);
  if (id === 'copper' && !flag('copper')) {
    await scene_(async () => {
      const F = SPOTS.furnace;
      setCine(F.x + 3, heightAt(F.x, F.y) + 2, F.y + 4, F.x, heightAt(F.x, F.y) + 1, F.y);
      await ui.say('炉番', '出たぞ……銅だ！');
      showScan(S.k, 'native_copper', '銅のかたまり');
      await wait(autoAdvance ? 50 : 1000);
      ui.close('scanWrap');
      await ui.say('カーボン', '炭の C が、石の中の O をつれていった。……だから、銅だけが残った。');
      await ui.say('カーボン', 'これが、Cu ……？　でも、まだよくわからない。何かが、足りない。');
      await ui.say('', '本物の化学：孔雀石を熱すると酸化銅になり、炭素が酸素をうばうと銅が残る（還元）。');
    });
    setFlag('copper');
  }
  if (id === 'wire') setFlag('wire');
  if (id === 'tin' && level(S.k, SN) < 2) { S.k.el[SN] = 2; await understood(SN, '黒い重い砂から出てきた、やわらかい金属。'); }
  updateMission(); persist();
}

// ── the deep vein: bait and Cupra ──
let lureT = 0;
async function useBait() {
  if (lureT > 0) { ui.toast('台の銅に、虫が集まっている。'); return; }
  const item = has('copper') ? 'copper' : has('copper_wire') ? 'copper_wire' : null;
  if (!item) { await ui.say('カーボン', '平らな石の台。……ここに何か置けそうだ。'); return; }
  choose('平らな石の台', [{
    label: `${ITEMS[item].nameJa}を置く（ロクショウムシをおびきよせる）`, sub: '銅のにおいに、虫が集まるかもしれない', ok: true,
    run: () => {
      S.inv[item]--;
      lureT = 45;
      const B = SPOTS.bait;
      for (const b of world.bugs) if (b.home.distanceTo(new THREE.Vector3(SPOTS.geode.x, 0, SPOTS.geode.y)) < 1) b.lure = new THREE.Vector3(B.x, 0, B.y);
      ui.toast('ロクショウムシが、台の銅へ集まっていく……！', true);
      persist();
    },
  }]);
}
async function meetCupra() {
  const near = world.bugs.filter((b) => b.root.position.distanceTo(world.parts.geode.position) < 3.5 && !b.lure).length;
  if (near > 2 && S.form !== 'sic') { ui.toast('ロクショウムシが多すぎて、近づけない。'); return; }
  await scene_(async () => {
    const G = world.parts.geode.position;
    setCine(G.x + 4, G.y + 2.4, G.z + 4, G.x, G.y + 1.2, G.z, true);
    if (S.form !== 'normal') await doBreak();
    carbon.flashCrystal(1.4);
    sfx.chime(true);
    await wait(1200);
    // the cocoon opens
    world.parts.geode.children.forEach((m, i) => { if (i < 18) m.position.multiplyScalar(1.6); });
    world.colliders.list.find((c) => c.id === 'geode')!.enabled = false;
    cupra.root.visible = true;
    cupra.root.position.set(G.x, G.y, G.z);
    cupra.root.rotation.y = Math.atan2(P().x - G.x, P().z - G.z);
    await wait(1200);
    await ui.say('？？？', '……あったかい。');
    await ui.say('？？？', 'だれ……？');
    await ui.say('カーボン', 'カーボン。こっちは、シリカ。');
    await ui.say('キュプラ', 'キュプラ。……たぶん。仮面に、そう書いてあるから。');
    await ui.say('カーボン', 'ぼくの仮面にも、C って。');
    await ui.say('シリカ', 'わたしは、砂の中で目がさめた。');
    await ui.say('キュプラ', 'わたしは……落ちてきた。上から。まわりの石がやさしくて、ずっと眠ってた。');
    await ui.say('カーボン', 'みんな、上から……。');
    carbon.flashCrystal(1.4);
    await wait(700);
    await ui.say('キュプラ', 'あなたの胸……光が、流れてる。');
    S.partners.cupra = 'follow';
    await doBond('cupra', true);
    await wait(autoAdvance ? 20 : 700);
    await ui.say('カーボン', 'ビリッとした……。体の中を、何かが走ってく。');
    await ui.say('キュプラ（声）', 'それが、わたしの得意なこと。流れを、通すの。');
    S.k.el.Cu = 2;
    await understood('Cu', 'キュプラとつながって、わかった。');
    ui.toast('BOND：Cu ＋ C → Cu LINK（電気の通り道）', true, 3600);
    await ui.say('', '本物の炭素も、黒鉛（グラファイト）という形では電気を通す。Cu LINK はそれをモチーフにしたゲームの能力（フィクション）。銅と炭素の化合物ができるわけではない。');
    await ui.say('シリカ', 'BOND する相手は、近くにいる方。わたしとなら SiC、キュプラとなら Cu LINK。');
    note('キュプラも、上から落ちてきた。仮面の文字は何？');
    for (const b of world.bugs) b.home.set(G.x - 6, 0, G.z + 6);
  });
  setFlag('cupra');
  persist();
}

async function readPlate() {
  const withCupra = S.partners.cupra === 'merged' || (S.partners.cupra !== 'none' && cupra.root.position.distanceTo(P()) < 6);
  if (!withCupra) { showScan(S.k, 'tensho_plate', '古い石板'); await ui.say('カーボン', '線の図と、文字。……読めない。'); return; }
  if (flag('record')) { await ui.say('キュプラ', '天晶脈。天の光を運ぶ、脈。……ほかは、まだ読めない。'); return; }
  await scene_(async () => {
    const p = SPOTS.plate;
    setCine(p.x + 2.5, heightAt(p.x, p.y) + 1.8, p.y + 4, p.x, heightAt(p.x, p.y) + 1.2, p.y, true);
    plateGlow = 0;
    sfx.chime(true);
    await wait(1600);
    await ui.say('キュプラ', '……この字、知ってる。どこで覚えたのか、わからないけど。');
    await ui.say('キュプラ', 'テン……ショウ……ミャク。');
    await ui.say('キュプラ', '天晶脈。天の、光を運ぶ、脈。');
    await ui.say('カーボン', 'てんしょうみゃく……。');
    await ui.say('シリカ', '「天」って、なに？');
    await ui.say('キュプラ', 'わからない。でも、この図を見て。');
    setCine(p.x + 0.6, heightAt(p.x, p.y) + 1.4, p.y + 2, p.x, heightAt(p.x, p.y) + 1.4, p.y);
    await wait(1400);
    await ui.say('カーボン', '上から一本……それが、枝分かれして、下へのびてる。');
    const r = world.things.find((t) => t.id === 'root_record')!.pos;
    setCine(p.x - 4, heightAt(p.x, p.y) + 3, p.y + 3, r.x, r.y, r.z);
    await wait(1400);
    await ui.say('カーボン', '見て。根にも、細い毛みたいなのが生えてる。');
    await ui.say('シリカ', '植物の……根みたい。');
    await ui.say('カーボン', '青い根は、天晶脈。天の光を運ぶ、植物の根……？');
    note('青い根は、植物の根のように枝分かれし、細い根毛がある');
    note('天晶脈：天の光を運ぶ脈。「天」とは何か');
    ui.toast('「青い根」の名前がわかった：天晶脈', true, 4000);
  });
  setFlag('record');
}

// ── the power station: two broken joints ──
function gapConducted(id: string) {
  if (S.gaps[id] === 'wire') return true;
  const g = world.things.find((t) => t.id === id)!;
  const at = S.waitAt.cupra;
  if (S.partners.cupra === 'wait' && at && Math.hypot(at[0] - g.pos.x, at[1] - g.pos.z) < 1.2) return true;
  if (S.form === 'cu' && Math.hypot(P().x - g.pos.x, P().z - g.pos.z) < 1.3) return true;
  return false;
}
function useGap(t: Thing) {
  if (gapConducted(t.id)) { ui.toast('ここは、もうつながっている。'); return; }
  const opts: { label: string; sub?: string; ok: boolean; run: () => void }[] = [];
  opts.push({ label: '銅線でつなぐ', sub: `銅線 ×1（持っている：${S.inv.copper_wire ?? 0}）`, ok: has('copper_wire'), run: () => { S.inv.copper_wire--; S.gaps[t.id] = 'wire'; sfx.pick(); ui.toast('銅線で、切れ目をつないだ。'); persist(); } });
  if (S.partners.cupra === 'follow') opts.push({ label: 'キュプラ、ここに立って', sub: 'キュプラが電気の通り道になる', ok: true, run: () => { S.partners.cupra = 'wait'; S.waitAt.cupra = [t.pos.x, t.pos.z]; ui.toast('キュプラ「ここで、流れを通すね」'); persist(); } });
  if (S.form === 'cu') opts.push({ label: 'Cu LINK のまま、ここに立つ', sub: 'カーボン自身が通り道になる（切れ目の上に立つ）', ok: true, run: () => ui.toast('切れ目の上に立てば、流れが通る。') });
  if (!S.flags.cupra) opts.push({ label: '……ほかに方法はないか', sub: '切れ目は長い。銅線がもっとあれば？', ok: false, run: () => {} });
  choose(t.label ?? '切れた線', opts);
}
async function powerOn() {
  await scene_(async () => {
    const releaseCupra = S.partners.cupra === 'wait';
    if (releaseCupra) {
      S.partners.cupra = 'follow';
      delete S.waitAt.cupra;
    }
    setFlag('power');
    const p = SPOTS.panels;
    setCine(p.x, heightAt(p.x, p.y - 12) + 6, p.y + 6, p.x, heightAt(p.x, p.y) + 2, p.y - 6, true);
    powerT = 0;
    sfx.rumble(2);
    await wait(2200);
    await ui.say('カーボン', '流れた……！');
    await ui.say('キュプラ', '根の光が、板で電気になって、線をはしってる。');
    await ui.say('シリカ', '板の中……わたしと同じ、Si が入ってる。');
    await ui.say('', '本物の科学：ケイ素は光を電気に変える部品（太陽電池）に、銅はその電気を運ぶ電線に使われる。根の光で動く板は、この世界の設定。');
    const L = SPOTS.lift;
    setCine(L.x - 8, 6, L.y + 6, L.x, 2, L.y);
    await wait(2000);
    await ui.say('カーボン', '昇降機の灯がついた。……上へ行ける。');
    // once powered, the joints latch: Cupra can leave her post
    if (releaseCupra) ui.toast('キュプラ「つながった線は、もう大丈夫」');
  });
  persist();
}
let powerT = -1, plateGlow = -1;

async function ending() {
  await scene_(async () => {
    setFlag('ending');
    if (S.form !== 'normal') await doBreak();
    const L = SPOTS.lift, y0 = heightAt(L.x, L.y);
    player.teleport(L.x + 0.6, L.y);
    for (const [v, dx] of [[silica, -1] as const, [cupra, 1.2] as const]) { v.root.visible = true; v.root.position.set(L.x + dx, y0 + 0.4, L.y + 1); }
    S.partners.silica = 'follow'; S.partners.cupra = 'follow';
    liftRide = 0;
    setCine(L.x + 9, y0 + 4, L.y + 9, L.x, y0 + 1.5, L.y, true);
    sfx.rumble(2.5);
    await wait(2200);
    await ui.say('キュプラ', '動いた……！');
    fogLocked = true;
    scene.fog = new THREE.Fog(0x080a14, 30, 260);
    await wait(2600);
    await ui.say('シリカ', '根の毛が、こんなにたくさん……。');
    await wait(1800);
    await ui.say('キュプラ', 'この根、どこまで続いてるの？');
    await ui.say('カーボン', '天晶脈。天の光を運ぶ、脈。');
    await ui.say('カーボン', 'だったら、この先に――「天」がある。');
    farOn = 0;
    await wait(2600);
    await ui.say('シリカ', '光……。門のすき間から見えた光と、同じ。');
    await ui.say('カーボン', '根は、上から来る。……なら、根のはじまりには、何があるんだろう。');
    await ui.fade(true, 2000);
    showEnd();
    persist();
  });
}
let liftRide = -1, farOn = -1;
function showEnd() {
  const e = $('end');
  const d = Object.values(S.k.el).filter((v) => (v ?? 0) >= 2).length;
  e.innerHTML = `<div class="c">CHAPTER 2　COMPLETE</div><div class="t">第2章　銅の灯、天の脈</div>
    <div class="d">DISCOVERED　${d} / 118</div>
    <div class="q">天晶脈の「天」とは、何なのか。<br>キュプラは、どこから落ちてきたのか。<br>仮面の文字は、何を意味しているのか。<br>根は、どこから始まっているのか。</div>
    <div class="d">つづく</div><div><button class="bigbtn" id="bCont2">このまま探索する</button></div>`;
  e.style.display = 'flex';
  $('bCont2').onclick = async () => {
    e.style.display = 'none';
    liftRide = -1;
    const L = SPOTS.lift;
    world.parts.liftG.position.y = heightAt(L.x, L.y);
    player.teleport(L.x - 4, L.y);
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
    fogLocked = false;
    farOn = -1;
    farLights.material.opacity = 0;
    await ui.fade(false, 900);
  };
}
// far warm lights above the shaft (no sky: just lights nobody can explain)
const farLights = (() => {
  const pos: number[] = [];
  for (let i = 0; i < 50; i++) pos.push(SPOTS.rootShaft.x + (Math.random() - 0.5) * 30, 140 + Math.random() * 90, SPOTS.rootShaft.y + (Math.random() - 0.5) * 30);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc890, size: 1.8, fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(m);
  return m;
})();

// ══════════ BOND / BREAK with two partners ══════════
const vis = (w: Who) => (w === 'silica' ? silica : cupra);
function setFormProgress(w: Who, p: number) {
  if (w === 'silica') carbon.setFormProgress('sic', p);
  else { cuOverlay.visible = p > 0.02; cuOverlay.scale.setScalar(0.3 + 0.7 * p); }
}
function doBond(w: Who, first = false): Promise<void> {
  return new Promise((res) => {
    player.locked = true;
    const v = vis(w);
    carbon.playAction('bond');
    v.playAction('bond');
    sfx.chime(true);
    fx.playBond({
      from: () => v.root.position,
      to: () => carbon.anchor(new THREE.Vector3()),
      setProgress: (p) => setFormProgress(w, p),
      silica: v.root,
      onCommit: () => { S.form = w === 'silica' ? 'sic' : 'cu'; S.partners[w] = 'merged'; persist(); },
      onDone: () => {
        v.root.visible = false;
        if (w === 'silica') carbon.setForm('sic'); else { cuOverlay.visible = true; cuOverlay.scale.setScalar(1); }
        $('form').textContent = w === 'silica' ? 'SiC FORM' : 'Cu LINK';
        $('form').style.display = 'inline-block';
        if (!cutscene) player.locked = false;
        if (!first) ui.toast(w === 'silica' ? 'BOND　SiC FORM' : 'BOND　Cu LINK');
        res();
      },
    });
  });
}
function doBreak(): Promise<void> {
  return new Promise((res) => {
    const w: Who = S.form === 'sic' ? 'silica' : 'cupra';
    const v = vis(w);
    player.locked = true;
    const side = new THREE.Vector3(Math.cos(player.facing), 0, -Math.sin(player.facing)).multiplyScalar(1.4);
    const at = P().clone().add(side);
    at.y = world.colliders.topAt(at.x, at.z);
    v.root.position.copy(at);
    v.root.visible = false;
    sfx.chime(false);
    fx.playBreak({
      from: () => carbon.anchor(new THREE.Vector3()).setY(P().y + 0.2),
      to: () => new THREE.Vector3(at.x, at.y + 0.8 * CHAPTER_CARBON_SCALE, at.z),
      setProgress: (p) => setFormProgress(w, p),
      silica: v.root,
      onCommit: () => { S.form = 'normal'; S.partners[w] = 'follow'; persist(); },
      onDone: () => {
        if (w === 'silica') carbon.setForm('normal'); else cuOverlay.visible = false;
        v.root.visible = true;
        $('form').style.display = 'none';
        if (!cutscene) player.locked = false;
        ui.toast(w === 'silica' ? 'BREAK　C ＋ Si' : 'BREAK　C ＋ Cu');
        res();
      },
    });
  });
}
function onForm() {
  if (cutscene || fx.active || ui.busy() || choiceOpen) return;
  if (S.form !== 'normal') { void doBreak(); return; }
  const cands = (['silica', 'cupra'] as Who[]).filter((w) => S.partners[w] === 'follow' || S.partners[w] === 'wait');
  if (!cands.length) { ui.toast('つながる相手がいない。'); return; }
  cands.sort((a, b) => vis(a).root.position.distanceTo(P()) - vis(b).root.position.distanceTo(P()));
  const w = cands[0];
  if (vis(w).root.position.distanceTo(P()) > 3.2) { ui.toast('仲間のそばで BOND できる'); return; }
  void doBond(w);
}

// ══════════ actions ══════════
async function onAction() {
  if (cutscene || fx.active || ui.busy() || choiceOpen) return;
  const t = nearest(isActionable);
  // a waiting partner close by: "come along"
  for (const w of ['silica', 'cupra'] as Who[]) {
    if (S.partners[w] === 'wait' && vis(w).root.position.distanceTo(P()) < 2.2 && (!t || t.kind !== 'gap')) {
      S.partners[w] = 'follow';
      ui.toast(w === 'silica' ? 'シリカ「ついていくね」' : 'キュプラ「いっしょに行く」');
      return;
    }
  }
  if (!t) return;
  carbon.root.rotation.y = player.facing = Math.atan2(t.pos.x - P().x, t.pos.z - P().z);
  if (t.kind === 'npc') return npcTalk(t.id);
  if (t.kind === 'gap') return useGap(t);
  if (t.kind === 'node') {
    const c = canHarvest(S.k, t.mat, power());
    if (!c.ok) { ui.toast(c.why); return; }
    const give = t.give![0];
    addItem(give);
    carbon.playAction('hard_break');
    sfx.pick();
    void gotItem(give);
    if (t.mat === 'cassiterite' && level(S.k, SN) < 1) S.k.el[SN] = 1;
    updateMission(); persist();
    return;
  }
  if (t.kind === 'obstacle') {
    const p = power();
    const c = canBreak(t.mat, p);
    if (!c.ok) {
      const m = MATERIALS[t.mat];
      const ways = Object.keys(m.weak).filter((k) => (m.weak as Record<string, number>)[k] >= 0.8).map((k) => STAT_JA[k as 'cut']).join('・');
      ui.toast(`${p.source}では無理だ。（${c.stat ? STAT_JA[c.stat] : '力'} ${c.value.toFixed(1)} ／ 必要 ${c.need}）`);
      ui.toast(`${t.label}は「${ways || '？'}」に弱そうだ。`);
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
    if (t.id === 'lift') return liftTalk();
    if (t.id === 'kiln') return useKiln();
    if (t.id === 'furnace') return useFurnace();
    if (t.id === 'bait') return useBait();
    if (t.id === 'geode') return flag('cupra') ? void ui.say('カーボン', 'からっぽの、緑のまゆ。') : meetCupra();
    if (t.id === 'plate') return readPlate();
  }
  showScan(S.k, t.mat, t.label);
}
function onScan() {
  if (cutscene || fx.active || ui.busy() || choiceOpen) return;
  const t = nearest((k) => k.kind !== 'npc', 4);
  if (!t) { ui.toast('近くにスキャンできる物がない。'); return; }
  sfx.scan();
  carbon.flashCrystal(0.6);
  showScan(S.k, t.mat, t.label);
  for (const u of noteScan(S.k, t.mat)) void understood(u.el, u.text);
  if (t.mat === 'cassiterite' && level(S.k, SN) < 1) S.k.el[SN] = 1;
  if (t.mat === 'blue_root') { carbon.flashCrystal(1.2); note('根の光は、ときどき上へ向かって流れる'); }
  if (t.mat === 'malachite') note('孔雀石の中にも、C がある');
  persist();
}
function makeFromDesign(d: ToolDesign) {
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
  persist();
}
function openBag() {
  if (cutscene || fx.active) return;
  showBag({ inv: S.inv, tool: equipped, canCreate: true, tools, onMake: makeFromDesign, onEquip: (i) => equip(i === null ? null : tools[i]) });
}
const shards: { m: THREE.Object3D; t: number }[] = [];
function breakThing(t: Thing, instant = false) {
  t.broken = true;
  if (!S.broken.includes(t.id)) S.broken.push(t.id);
  for (const id of t.colliders ?? []) { const c = world.colliders.list.find((k) => k.id === id); if (c) c.enabled = false; }
  if (t.obj) { t.obj.userData.gone = instant; if (instant) t.obj.visible = false; else shards.push({ m: t.obj, t: 0 }); }
  if (!instant && t.onBreak === 'rubble') ui.toast('緑青の洞への道がひらいた');
}

// ══════════ every frame ══════════
let lastZone: Zone | null = null;
const safe = new THREE.Vector3();
let safeT = 0, bumpT = 0;
function triggers(dt: number) {
  const p = P();
  const z = zoneAt(p.x, p.z);
  if (z.zone && z.w > 0.9 && z.zone !== lastZone) {
    lastZone = z.zone;
    if (flag('start') && !(z.zone.id === 'village' && !flag('village'))) ui.area(z.zone.name, z.zone.sub);
  }
  // bugs: they bump Carbon away, but bounce off SiC
  bumpT -= dt;
  for (const b of world.bugs) {
    const bp = b.root.position;
    const dx = p.x - bp.x, dz = p.z - bp.z, d = Math.hypot(dx, dz);
    if (d > 0.95 || Math.abs(p.y - bp.y) > 1.5) continue;
    if (S.form === 'sic') { bp.x -= (dx / (d || 1)) * 0.6; bp.z -= (dz / (d || 1)) * 0.6; continue; }
    if (cutscene) continue;
    player.pos.x += (dx / (d || 1)) * (1.0 - d + 0.3);
    player.pos.z += (dz / (d || 1)) * (1.0 - d + 0.3);
    if (bumpT <= 0) { bumpT = 3; sfx.clank(1.4); ui.toast(S.form === 'normal' ? 'ロクショウムシにはじき返された！　（かたい体なら……？）' : 'ロクショウムシにはじき返された！'); }
  }
  if (lureT > 0) { lureT -= dt; if (lureT <= 0) for (const b of world.bugs) b.lure = null; }
  if (cutscene || fx.active) return;
  const near = (v: { x: number; y: number }, r: number) => Math.hypot(p.x - v.x, p.z - v.y) < r;
  if (flag('start') && !flag('village') && near(SPOTS.village, 12)) void villageArrive();
  // power: both joints conducting
  if (!flag('power') && gapConducted('gapA') && gapConducted('gapB')) void powerOn();
  // falling off something high: back to the last safe spot
  const w = waterAt(p.x, p.z);
  safeT -= dt;
  if (player.onGround && w === null && safeT <= 0) { safe.copy(p); safeT = 1; }
  if (!player.onGround && player.vel.y < -14 && p.y < safe.y - 10) { ui.toast('……落ちた。気がつくと、もとの場所にいた。'); player.teleport(safe.x, safe.z); }
}
function updatePartners(dt: number) {
  if (fx.active) return;
  let side = 1.3;
  for (const w of ['silica', 'cupra'] as Who[]) {
    const v = vis(w), mode = S.partners[w];
    if (mode === 'none' || mode === 'merged') { if (mode === 'none' && w === 'cupra' && !flag('cupra')) v.root.visible = false; continue; }
    v.root.visible = true;
    const sp = v.root.position;
    let target: THREE.Vector3;
    const at = S.waitAt[w];
    if (mode === 'wait' && at) target = new THREE.Vector3(at[0], 0, at[1]);
    else {
      const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)), sd = new THREE.Vector3(fwd.z, 0, -fwd.x);
      target = P().clone().addScaledVector(fwd, -1.4).addScaledVector(sd, side);
      side = -side;
    }
    const to = target.sub(sp); to.y = 0;
    const d = to.length();
    if (d > (mode === 'wait' ? 0.15 : 0.4)) {
      const speed = Math.min(d * 3, d > 6 ? 9 : 5);
      sp.addScaledVector(to.normalize(), Math.min(d, speed * dt));
      v.root.rotation.y = Math.atan2(to.x, to.z);
      v.setState(speed > 6 ? 'Run' : 'Walk', speed / 9);
    } else v.setState('Idle', 0);
    if (mode === 'follow' && d > 25) sp.copy(P()).add(new THREE.Vector3(1.5, 0, 1.5));
    sp.y = world.colliders.topAt(sp.x, sp.z);
    v.update(dt);
  }
}

// ── input ──
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
$('bSettings').onclick = () => openSettings();
const PANELS = ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap', 'choiceWrap'];
const closeAll = () => { PANELS.forEach((id) => ui.close(id)); choiceOpen = false; };
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') closeAll(); });
$('choiceWrap').addEventListener('click', (e) => { if (e.target === $('choiceWrap')) closeAll(); });
const KEY_LABEL: Partial<Record<ActionName, string>> = { Interact: 'E', Scan: 'R', Form: 'Q', Bond: 'Q', Break: 'Q', Menu: 'B', Map: 'C', Jump: 'Space' };
function keyHint(a: ActionName) { const d = getLastDevice(); if (d === 'gamepad') return `[${padLabel(a)}] `; if (d === 'keyboard') return `${KEY_LABEL[a] ?? ''}：`; return ''; }
function renderPadHelp() {
  const row = (a: ActionName, t: string) => `${t}<b>${padLabel(a)}</b>`;
  $('padHelp').innerHTML = [row('Interact', 'しらべる'), row('Jump', 'ジャンプ'), row('Bond', 'BOND'), row('Break', 'BREAK'), row('ToolNext', '道具'), row('Menu', 'メニュー'), row('Map', '図鑑')].join('<br>');
}
onDeviceChange((d) => { document.body.classList.remove('input-touch', 'input-keyboard', 'input-gamepad'); document.body.classList.add(`input-${d}`); if (d === 'gamepad') renderPadHelp(); });
onGamepad((id, on) => { ui.toast(on ? `GAMEPAD CONNECTED<br><span style="font-size:11px">${id.slice(0, 40)}</span>` : 'GAMEPAD DISCONNECTED', on); renderPadHelp(); });
const INPUT_KEY = 'element118.ch2.input';
try { const raw = localStorage.getItem(INPUT_KEY); if (raw) applySettings(JSON.parse(raw)); } catch { /* defaults */ }
function openSettings() {
  const s = inputSettings;
  const row = (k: 'mouse' | 'touch' | 'gamepad', t: string) => `<div class="setrow"><span>${t}</span><input type="range" min="0.3" max="2.5" step="0.1" value="${s[k]}" data-k="${k}"><b id="v_${k}">${s[k].toFixed(1)}</b></div>`;
  $('settingsPanel').innerHTML = `<button class="small close" id="setX">とじる</button><h2>設定</h2><div class="kind">カメラ感度</div>
    ${row('touch', 'タッチ（右スティック）')}${row('gamepad', 'ゲームパッド（右スティック）')}${row('mouse', 'マウス')}
    <div class="setrow"><span>上下反転（Invert Y）</span><input type="checkbox" id="setInv" ${s.invertY ? 'checked' : ''}></div>
    <div class="kind">開発者向け</div>
    <div class="setrow"><span>衝突判定表示</span><input type="checkbox" id="setCol" ${colDebug.visible ? 'checked' : ''}></div>
    <div class="note">緑＝プレイヤー　赤＝障害物　青＝地形　黄＝カメラ</div>`;
  $('setX').onclick = () => ui.close('settingsWrap');
  const save = () => { try { localStorage.setItem(INPUT_KEY, JSON.stringify(inputSettings)); } catch { /* ignore */ } };
  document.querySelectorAll<HTMLInputElement>('#settingsPanel input[type=range]').forEach((el) => (el.oninput = () => { const k = el.dataset.k as 'mouse'; applySettings({ [k]: Number(el.value) }); $(`v_${k}`).textContent = Number(el.value).toFixed(1); save(); }));
  ($('setInv') as HTMLInputElement).onchange = (e) => { applySettings({ invertY: (e.target as HTMLInputElement).checked }); save(); };
  ($('setCol') as HTMLInputElement).onchange = (e) => { colDebug.visible = (e.target as HTMLInputElement).checked; try { localStorage.setItem(DEV_KEY, JSON.stringify({ collision: colDebug.visible })); } catch { /* ignore */ } };
  ui.open('settingsWrap');
}
function cycleTool(dir: 1 | -1) {
  if (!tools.length) { ui.toast('道具を持っていない'); return; }
  const i = equipped ? tools.indexOf(equipped) : -1;
  const n = (i + dir + tools.length + 1) % (tools.length + 1);
  equip(n === tools.length ? null : tools[n]);
  ui.toast(equipped ? `持ちかえ：${equipped.name}` : '素手');
}
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });

function applySave() {
  tools = S.tools.map((t) => { const k = makeTool(t.design)!; k.uses = t.uses; return k; });
  equip(S.equipped !== null && tools[S.equipped] ? tools[S.equipped] : null);
  for (const id of S.broken) { const t = world.things.find((k) => k.id === id); if (t) breakThing(t, true); }
  if (S.form === 'sic') { carbon.setForm('sic'); $('form').textContent = 'SiC FORM'; $('form').style.display = 'inline-block'; }
  if (S.form === 'cu') { cuOverlay.visible = true; $('form').textContent = 'Cu LINK'; $('form').style.display = 'inline-block'; }
  if (flag('cupra')) { world.colliders.list.find((c) => c.id === 'geode')!.enabled = false; world.parts.geode.children.forEach((m, i) => { if (i < 18) m.position.multiplyScalar(1.6); }); for (const b of world.bugs) b.home.set(SPOTS.geode.x - 6, 0, SPOTS.geode.y + 6); }
  if (flag('power')) {
    powerT = 1;
    // Older saves could record power before releasing Cupra from the joint.
    if (S.partners.cupra === 'wait') {
      S.partners.cupra = 'follow';
      delete S.waitAt.cupra;
    }
  }
  if (flag('record')) plateGlow = 1;
  gateClose = 1;
  if (S.pos) player.teleport(S.pos[0], S.pos[2]);
  for (const w of ['silica', 'cupra'] as Who[]) {
    const { root } = vis(w);
    const mode = S.partners[w];
    root.visible = mode === 'follow' || mode === 'wait';
    if (!root.visible) continue;
    const at = mode === 'wait' ? S.waitAt[w] : undefined;
    if (at) root.position.set(at[0], world.colliders.topAt(at[0], at[1]), at[1]);
    else {
      root.position.copy(player.pos).add(new THREE.Vector3(w === 'silica' ? 1.4 : -1.4, 0, 1.4));
      root.position.y = world.colliders.topAt(root.position.x, root.position.z);
    }
  }
  safe.copy(player.pos);
  bBagShow();
  updateMission();
}
const bBagShow = () => $('bBagTop').classList.remove('hide');

// ── main loop ──
let last = performance.now(), T = 0, shake = 0;
let hideCarbonNearCamera = false;
const fpsA: number[] = [];
const debugOn = params.has('debug');
const lightOrder = world.lights.map((_, i) => ({ i, d: 0 }));
const gateBaseL = world.parts.gateL.position.x, gateBaseR = world.parts.gateR.position.x;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now; T += dt;
  fpsA.push(dt); if (fpsA.length > 30) fpsA.shift();
  pollInput(dt);
  if (runToggle) input.run = true;
  if (gotIsOpen() && (input.action || input.jump)) { dismissGot(); input.action = input.jump = false; }
  if (input.action || (input.jump && ui.sayOpen)) { if (ui.sayOpen) { ui.advance(); input.jump = false; } else void onAction(); }
  if (!cutscene && !ui.sayOpen) {
    if (input.scan) onScan();
    if (input.form || input.bond || input.breakForm) onForm();
    if (input.toolPrev) cycleTool(-1);
    if (input.toolNext) cycleTool(1);
    if (input.menu) { if (ui.busy() || choiceOpen) closeAll(); else openBag(); }
    if (input.codex) { if (ui.busy() || choiceOpen) closeAll(); else showCodex(S.k, S.notes); }
  }
  const busy = ui.busy() || choiceOpen;
  if (!cutscene && !busy) cam.addLook(input.lookX, input.lookY);
  fx.update(dt);
  const { forward, right } = cam.basis();
  const free = !cutscene && !busy && !fx.frozen;
  if (!cutscene) {
    for (const n of world.npcs) n.syncCollider();
    if (!free) player.locked = true; else if (!fx.active) player.locked = false;
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    if (!fx.frozen) for (let i = 0; i < steps; i++) { player.update(dt / steps, input, forward, right); if (i === 0) input.jump = false; }
  }
  if (!fx.frozen) carbon.update(dt);
  triggers(dt);
  updatePartners(dt);

  // animation bits
  if (gateClose >= 0 && gateClose < 1) { gateClose = Math.min(1, gateClose + dt * 0.6); }
  world.parts.gateL.position.x = gateBaseL + 0.25 * Math.max(0, gateClose);
  world.parts.gateR.position.x = gateBaseR - 0.25 * Math.max(0, gateClose);
  for (const s of shards) { if (s.t >= 1) continue; s.t = Math.min(1, s.t + dt * 2.5); s.m.scale.setScalar(Math.max(0.001, 1 - s.t)); s.m.position.y -= dt * 2; if (s.t >= 1) { s.m.visible = false; s.m.userData.gone = true; } }
  if (powerT >= 0) {
    powerT = Math.min(1, powerT + dt * 0.5);
    const e = powerT;
    world.parts.panelM.emissive.setHex(0x3a7aff); world.parts.panelM.emissiveIntensity = 0.4 + e * 1.4;
    world.parts.lineM.emissive.setHex(0xff8a40); world.parts.lineM.emissiveIntensity = e * 1.5;
    world.parts.cableM.emissive.setHex(0xff8a40); world.parts.cableM.emissiveIntensity = e * 1.5;
    (world.parts.liftLamp.material as THREE.MeshStandardMaterial).emissive.setHex(0x40ff80);
    (world.parts.liftLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 * e;
  }
  for (const [id, m] of Object.entries(world.parts.gapMarks)) (m.material as THREE.MeshStandardMaterial).emissive.setHex(flag('power') || gapConducted(id) ? 0xff8a30 : 0x2a1004);
  if (plateGlow >= 0) { plateGlow = Math.min(1, plateGlow + dt * 0.5); (world.parts.plateFace.material as THREE.MeshStandardMaterial).emissiveIntensity = plateGlow * 1.2; }
  if (cuOverlay.visible) cuOverlay.children.forEach((c, i) => { if (c.userData.spin !== undefined) { c.rotation.z = T * (1 + i * 0.4); c.position.y = 0.3 + ((T * 0.8 + c.userData.spin * 0.4) % 1.2); } });
  if (liftRide >= 0) {
    // the lift climbs the shaft with everyone on it
    liftRide += dt;
    const L = SPOTS.lift, base = heightAt(L.x, L.y);
    const y = base + Math.min(160, liftRide * liftRide * 2.2);
    world.parts.liftG.position.y = y;
    player.pos.y = y + 0.4; carbon.root.position.y = y + 0.4;
    silica.root.position.y = y + 0.4; cupra.root.position.y = y + 0.4;
    silica.update(dt); cupra.update(dt);
    if (cine) { cine.pos.set(L.x + 9 + Math.sin(liftRide * 0.3) * 3, y + 3 + Math.min(4, liftRide * 0.4), L.y + 9); cine.look.set(L.x + 4, y + 6 + Math.min(30, liftRide * 3), L.y + 1); }
  }
  if (farOn >= 0) { farOn = Math.min(1, farOn + dt * 0.4); farLights.material.opacity = farOn * 0.9; }

  for (const n of world.npcs) n.update(dt, heightAt, cutscene ? undefined : player.pos);
  for (const b of world.bugs) b.update(dt, heightAt);
  world.update(T, dt);
  if (T % 7 < dt) sfx.drip();

  if (cine) {
    const k = 1 - Math.exp(-dt * (liftRide >= 0 ? 4 : 1.6));
    camPos.lerp(cine.pos, k); camLook.lerp(cine.look, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
  } else {
    cam.update(dt, player.pos, player.moving, player.facing);
    camPos.copy(camera.position);
    colDebug.update(dt, { pos: player.pos, radius: MOVE.radius, height: MOVE.height }, { pivot: cam.pivotPoint, cam: camera.position, radius: CAMERA_TUNING.radius });
    camLook.copy(cam.pivotPoint);
  }
  const cy = ceilAt(camera.position.x, camera.position.z) - 0.6;
  if (camera.position.y > cy) camera.position.y = cy;
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }

  for (const o of lightOrder) o.d = world.lights[o.i].pos.distanceToSquared(camera.position);
  lightOrder.sort((a, b) => a.d - b.d);
  for (let i = 0; i < POOL; i++) { const L = world.lights[lightOrder[i].i]; pool[i].position.copy(L.pos); pool[i].color.setHex(L.color); pool[i].intensity = L.power * 9; }
  crystalLight.position.copy(carbon.anchor(tmp));
  crystalLight.color.setHex(S.form === 'cu' ? 0xffa060 : 0x5ab8ff);
  crystalLight.intensity = 3 + (S.form !== 'normal' ? 2 : 0);
  if (!fogLocked) {
    const zid = zoneAt(camera.position.x, camera.position.z).zone?.id ?? '';
    const A = ATMOS[zid] ?? ATMOS.default;
    const k = 1 - Math.exp(-dt * 1.5);
    const f = scene.fog as THREE.Fog;
    f.color.lerp(atmosFog.set(A.fog), k); f.near += (A.near - f.near) * k; f.far += (A.far - f.far) * k;
    scene.background = f.color;
    hemi.color.lerp(atmosSky.set(A.sky), k); hemi.groundColor.lerp(atmosGround.set(A.ground), k); hemi.intensity += (A.hemi - hemi.intensity) * k;
  }
  const gy = world.colliders.topAt(player.pos.x, player.pos.z, 0);
  blob.position.set(player.pos.x, Math.min(gy, player.pos.y) + 0.04, player.pos.z);
  hideCarbonNearCamera = !cutscene && !cine && cam.distance < (hideCarbonNearCamera ? 1.15 : 0.95);
  blob.visible = carbon.root.visible && !cutscene && !hideCarbonNearCamera;

  const t = !cutscene && !busy ? nearest(isActionable) : null;
  const scanT = !cutscene ? nearest((k) => k.kind !== 'npc', 4) : null;
  const dev = getLastDevice();
  const scanHint = scanT && dev !== 'touch' ? `${keyHint('Scan')}スキャン` : '';
  const pr = t ? `${keyHint('Interact')}${actionLabel(t)}` : null;
  ui.prompt(pr ? pr + (scanHint ? '　　' + scanHint : '') : scanHint || null);
  $('bAct').classList.toggle('hide', !t);
  $('bAct').textContent = t ? actionLabel(t).replace(/（.*$/, '') : 'E';
  $('bScan').classList.remove('hide');
  const canForm = S.form !== 'normal' || (['silica', 'cupra'] as Who[]).some((w) => S.partners[w] === 'follow' || S.partners[w] === 'wait');
  $('bForm').classList.toggle('hide', !canForm);
  $('bForm').textContent = S.form !== 'normal' ? 'BREAK' : 'BOND';
  $('bCodex').classList.remove('hide');
  if (debugOn) { const fps = fpsA.length / fpsA.reduce((a, b) => a + b, 0); $('debug').textContent = `${fps.toFixed(0)}fps (${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}) ${lastZone?.id ?? ''}`; }
  if (!cutscene && !fx.active && flag('start') && T % 15 < dt) persist();
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

async function begin(cont: boolean) {
  startAudio();
  $('start').style.display = 'none';
  const sv = loadSave();
  if (cont && sv) { S = sv; applySave(); sfx.ambience(true); await ui.fade(false, 1200); return; }
  S = fresh();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  bBagShow();
  if (params.has('skip')) {
    S.flags.start = true;
    gateClose = 1;
    player.teleport(SPOTS.start.x, SPOTS.start.y);
    silica.root.position.copy(player.pos).add(new THREE.Vector3(1.4, 0, 1.4));
    safe.copy(player.pos);
    updateMission();
    await ui.fade(false, 300);
    return;
  }
  await prologue();
  safe.copy(player.pos);
}
if (loadSave()) $('bCont').style.display = 'block';
$('bNew').onclick = () => void begin(false);
$('bCont').onclick = () => void begin(true);
requestAnimationFrame(frame);

(window as unknown as { __ch2: unknown }).__ch2 = {
  get S() { return S; }, player, world, cam, silica, cupra, carbon, fx, ui, zones: ZONES, colDebug, spots: SPOTS,
  begin, onAction, onScan, onForm, makeFromDesign, equip, input, viewerStats, gotIsOpen, dismissGot, gotItem, openBag, smelt, useGap, gapConducted,
  get tools() { return tools; }, get choiceOpen() { return choiceOpen; }, closeAll, heightAt, ceilAt, zoneAt, persist,
  get cutscene() { return cutscene; }, level: (s: string) => level(S.k, s as ElementSymbol),
  get renderInfo() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
};
