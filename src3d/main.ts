// ELEMENT 118 — 3D prototype (separate page from the 2D game; shares nothing at runtime).
// Goal of this prototype: run around a field in third person, find Silica, BOND into SiC FORM,
// HARD BREAK a rock to open a new path, and BREAK back into Carbon + Silica.
import * as THREE from 'three';
import { buildField } from './world/field';
import { heightAt, PLACES, WATER_Y } from './world/terrain';
import { ThirdPersonCamera } from './core/camera';
import { input, initKeyboardMouse, initTouch, pollInput, endFrame, bindButton } from './core/input';
import { load3d, save3d } from './core/storage';
import { PlayerController } from './player/controller';
import { ProceduralCarbon, ProceduralSilica } from './player/visual';
import { ABILITIES, ELEMENTS, FORMS, OBSTACLE_SOLUTIONS, PROPERTIES, recipeFor, type BondForm } from './chem/bondData';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ── renderer ──
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
} catch {
  $('fail').style.display = 'flex';
  throw new Error('WebGL not available');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.6 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('view').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showMsg('画面の描画が止まりました。ページを再読み込みしてください。', 0);
});

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9ccff0);
scene.background = SKY;
scene.fog = new THREE.Fog(0xb8dcf2, 70, 430);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

// sky dome with a gradient
{
  const g = new THREE.SphereGeometry(800, 24, 12);
  const top = new THREE.Color(0x4f9ae0), mid = new THREE.Color(0xa8d8f4), low = new THREE.Color(0xe8f2f8);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 800;
    if (h > 0.15) c.copy(mid).lerp(top, Math.min(1, (h - 0.15) / 0.6));
    else c.copy(low).lerp(mid, Math.max(0, (h + 0.05) / 0.2));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
}

// light
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -34;
sc.right = sc.top = 34;
sc.near = 1;
sc.far = 160;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.35).normalize();

// ── world ──
const field = buildField();
scene.add(field.root);

// ── characters ──
const carbonVisual = new ProceduralCarbon();
scene.add(carbonVisual.root);
const player = new PlayerController(carbonVisual, field.colliders);
const silica = new ProceduralSilica();
scene.add(silica.root);
const silicaPos = new THREE.Vector3(PLACES.silica.x, heightAt(PLACES.silica.x, PLACES.silica.y), PLACES.silica.y);
silica.root.position.copy(silicaPos);
let silicaMode: 'waiting' | 'merged' | 'following' = 'waiting';

const cam = new ThirdPersonCamera(camera, field.colliders);
initKeyboardMouse(renderer.domElement);
initTouch($('view'), $('stickBase'), $('stickKnob'));
bindButton($('bJump'), () => (input.jump = true));
bindButton($('bAct'), () => (input.action = true));
bindButton($('bBreak'), () => (input.breakForm = true));
$('bCodex').addEventListener('click', () => toggleCodex());

// ── game state (saved under element118.3d.*, never touching the 2D save) ──
interface State3D { silicaFound: boolean; sicFound: boolean; rocksBroken: string[]; spireReached: boolean; form: string | null }
const state: State3D = { silicaFound: false, sicFound: false, rocksBroken: [], spireReached: false, form: null, ...(load3d<State3D>('state') ?? {}) };
const persist = () => save3d('state', state);
for (const id of state.rocksBroken) {
  const b = field.breakables.find((x) => x.id === id);
  if (b) { b.broken = true; b.collider.enabled = false; b.mesh.visible = false; }
}
if (state.form) {
  // resume in the form (Silica merged)
  silicaMode = 'merged';
  silica.root.visible = false;
  carbonVisual.setForm(FORMS[state.form]?.visual ?? 'normal');
} else if (state.sicFound) {
  silicaMode = 'following';
  silicaPos.set(player.pos.x + 1.5, player.pos.y, player.pos.z + 1);
}

// ── HUD helpers ──
let bannerTimer = 0, msgTimer = 0;
function banner(big: string, sub = '', secs = 2.6) {
  const el = $('banner');
  (el.querySelector('.big') as HTMLElement).textContent = big;
  (el.querySelector('.sub') as HTMLElement).textContent = sub;
  el.style.display = 'block';
  bannerTimer = secs;
}
function showMsg(text: string, secs = 4) {
  const el = $('msg');
  el.innerHTML = text;
  el.style.display = 'block';
  msgTimer = secs || 9999;
}
function currentForm(): BondForm | null {
  return state.form ? FORMS[state.form] ?? null : null;
}

// ── codex: real science and game fiction are kept apart ──
function toggleCodex(force?: boolean) {
  const el = $('codex');
  const open = force ?? el.style.display !== 'flex';
  el.style.display = open ? 'flex' : 'none';
  if (!open) return;
  const si = ELEMENTS.Si;
  const recipe = recipeFor('Si')!;
  const form = FORMS[recipe.form];
  const parts: string[] = [];
  parts.push('<h2>図鑑（3D試作）</h2>');
  if (!state.silicaFound) parts.push('<p>まだ何も記録されていない。フィールドを探索しよう。</p>');
  else {
    parts.push(`<div class="cols"><div class="col real"><h3>${si.symbol}　${si.nameJa}（${si.nameEn}）　原子番号${si.number}</h3><ul>${si.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div></div>`);
  }
  if (state.sicFound) {
    const s = recipe.substance;
    parts.push(`<h2 style="margin-top:14px">${s.formula}　${s.nameJa}（${s.nameEn}） ／ ${form.name}</h2>`);
    parts.push('<div class="cols">');
    parts.push(`<div class="col real"><h3>本物の科学</h3><ul>${s.facts.map((f) => `<li>${f}</li>`).join('')}</ul><h3 style="margin-top:10px">実際の性質</h3><ul>${s.properties.map((p) => `<li>${PROPERTIES[p].label}</li>`).join('')}</ul></div>`);
    parts.push(`<div class="col fic"><h3>ゲームの中の能力（フィクション）</h3><ul>${form.abilities.map((a) => `<li><b>${ABILITIES[a].name}</b>：${ABILITIES[a].description}<br><span style="color:#8fa5c8">モチーフ：${ABILITIES[a].motif.map((m) => PROPERTIES[m].label).join('、')}</span></li>`).join('')}</ul><ul style="margin-top:8px">${form.gameNotes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`);
    parts.push('</div>');
  }
  parts.push('<p class="note">タップ／クリックでとじる</p>');
  $('codexPanel').innerHTML = parts.join('');
}
$('codex').addEventListener('click', () => toggleCodex(false));

// ── BOND / HARD BREAK / BREAK ──
let busy = 0; // seconds of locked control
const fxPieces: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
const pieceMat = new THREE.MeshStandardMaterial({ color: 0x6a6272, roughness: 0.7, flatShading: true });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });

function burst(at: THREE.Vector3, n: number, big: boolean, mat: THREE.Material) {
  for (let i = 0; i < n; i++) {
    const s = big ? 0.3 + Math.random() * 0.7 : 0.06 + Math.random() * 0.08;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
    m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2));
    m.castShadow = big;
    scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 8, (Math.random() - 0.5) * 10).multiplyScalar(big ? 1 : 0.6);
    fxPieces.push({ m, v, life: big ? 2.4 : 0.9 });
  }
}

function nearSilica() {
  return silicaMode !== 'merged' && silica.root.position.distanceTo(player.pos) < 3.2;
}

function nearestBreakable(maxDist: number) {
  const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  let best: (typeof field.breakables)[number] | null = null, bd = Infinity;
  for (const b of field.breakables) {
    if (b.broken) continue;
    const to = new THREE.Vector3(b.collider.x - player.pos.x, 0, b.collider.z - player.pos.z);
    const d = to.length() - (b.collider.r ?? 0);
    if (d > maxDist || d >= bd) continue;
    if (d > 0.8 && to.normalize().dot(fwd) < 0.2) continue;
    best = b;
    bd = d;
  }
  return best;
}

function doBond() {
  const recipe = recipeFor('Si');
  if (!recipe) return;
  const form = FORMS[recipe.form];
  busy = 1.3;
  player.locked = true;
  carbonVisual.playAction('bond');
  silica.playAction('bond');
  banner(`C ＋ ${recipe.inputs[0]}`, 'BOND！', 1.2);
  setTimeout(() => {
    burst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 26, false, sparkMat);
    silica.root.visible = false;
    silicaMode = 'merged';
    state.form = form.id;
    carbonVisual.setForm(form.visual);
    const first = !state.sicFound;
    state.sicFound = true;
    persist();
    banner(form.name, `${recipe.substance.formula}　${recipe.substance.nameJa} ── ${first ? 'NEW FORM DISCOVERED' : 'BOND'}`, 3);
    if (first) setTimeout(() => showMsg(`<b>${form.name}</b>：${form.abilities.map((a) => ABILITIES[a].name).join('・')} が使える。<br>硬い岩の前で E（アクション）。もどるときは Q（BREAK）。<br><span style="color:#9fe0b8">※ 本物のSiCの「硬さ」をモチーフにしたゲームの能力。図鑑で本物の科学と見くらべられる。</span>`, 7), 1600);
  }, 650);
}

function doBreak() {
  if (!state.form) return;
  busy = 0.6;
  player.locked = true;
  burst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 18, false, sparkMat);
  carbonVisual.setForm('normal');
  const side = new THREE.Vector3(Math.cos(player.facing), 0, -Math.sin(player.facing)).multiplyScalar(1.4);
  silicaPos.copy(player.pos).add(side);
  silicaPos.y = field.colliders.topAt(silicaPos.x, silicaPos.z);
  silica.root.position.copy(silicaPos);
  silica.root.visible = true;
  silicaMode = 'following';
  state.form = null;
  persist();
  banner('BREAK！', 'SiC FORM → C ＋ Si', 2);
}

function doHardBreak() {
  const form = currentForm();
  const ability = form?.abilities.map((a) => ABILITIES[a]).find((a) => a.breaks?.length);
  busy = 0.55;
  player.locked = true;
  carbonVisual.playAction('hard_break');
  setTimeout(() => {
    const b = nearestBreakable(2.6);
    if (!b || !ability) return;
    if (!b.tags.some((t) => ability.breaks!.includes(t))) return;
    b.broken = true;
    b.collider.enabled = false;
    const at = new THREE.Vector3(b.collider.x, b.collider.bottom + 3, b.collider.z);
    b.mesh.visible = false;
    burst(at, 22, true, pieceMat);
    burst(at, 30, false, sparkMat);
    shake = 0.5;
    state.rocksBroken.push(b.id);
    persist();
    banner('HARD BREAK！', '岩が砕けて、道が開いた', 2.8);
  }, 260);
}

function inspectRock(id: string) {
  const sols = OBSTACLE_SOLUTIONS[id] ?? [];
  showMsg(`びくともしない。とても硬い岩だ……。<br><span style="color:#8fa5c8">ここを越える方法：${sols.map((s) => `${s.available ? '' : '（今後）'}${s.note}`).join(' ／ ')}</span>`, 6);
}

// ── main loop ──
let shake = 0;
let last = performance.now();
let t = 0;
let fpsAcc = 0, fpsN = 0, fps = 60;
const debugOn = new URLSearchParams(location.search).has('debug');

function frame(now: number) {
  // real time, capped; the simulation catches up in small steps so slow frames don't slow the game down
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  t += dt;
  pollInput();
  const codexOpen = $('codex').style.display === 'flex';
  if (input.codex) toggleCodex();
  if (codexOpen) { endFrame(); renderer.render(scene, camera); requestAnimationFrame(frame); return; }

  cam.addLook(input.lookX, input.lookY);
  if (busy > 0) { busy -= dt; if (busy <= 0) { busy = 0; player.locked = false; } }

  // context action
  const form = currentForm();
  const breakable = nearestBreakable(2.6);
  let act: { label: string; run: () => void } | null = null;
  if (busy <= 0) {
    if (nearSilica() && !form) act = { label: 'BOND', run: doBond };
    else if (breakable && form?.abilities.some((a) => ABILITIES[a].breaks?.some((tag) => breakable.tags.includes(tag)))) act = { label: 'HARD\nBREAK', run: doHardBreak };
    else if (breakable) act = { label: 'しらべる', run: () => inspectRock(breakable.id) };
  }
  const bAct = $('bAct');
  bAct.classList.toggle('hide', !act);
  if (act && bAct.textContent !== act.label) bAct.innerText = act.label;
  $('bBreak').classList.toggle('hide', !form);
  const prompt = $('prompt');
  if (act) {
    prompt.style.display = isTouch ? 'none' : 'block';
    prompt.textContent = `E：${act.label.replace('\n', ' ')}`;
  } else prompt.style.display = 'none';
  if (input.action && act && busy <= 0) act.run();
  if (input.breakForm && form && busy <= 0) doBreak();

  // player (sub-stepped)
  const { forward, right } = cam.basis();
  const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
  for (let i = 0; i < steps; i++) {
    player.update(dt / steps, input, forward, right);
    if (i === 0) input.jump = false; // a jump press is used once
  }
  carbonVisual.update(dt);

  // silica: wait, then follow Carbon after the first BREAK
  if (silicaMode !== 'merged') {
    const sp = silica.root.position;
    if (silicaMode === 'waiting') {
      const d = sp.distanceTo(player.pos);
      if (!state.silicaFound && d < 14) {
        state.silicaFound = true;
        persist();
        banner('NEW ELEMENT', 'Si　Silicon　ケイ素　原子番号14', 3.2);
        setTimeout(() => showMsg('シリカ：「……キミのお面、C と 6。炭素だね。ぼくもキミも、結合の手は4本。」<br>近づいて BOND してみよう。', 6), 1200);
      }
      if (d < 10) silica.root.rotation.y = Math.atan2(player.pos.x - sp.x, player.pos.z - sp.z);
      silica.setState('Idle', 0);
    } else {
      // follow a point behind Carbon
      const fwdV = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
      const sideV = new THREE.Vector3(fwdV.z, 0, -fwdV.x);
      const behind = player.pos.clone().addScaledVector(fwdV, -1.4).addScaledVector(sideV, 1.3); // behind and to the side: not between camera and Carbon
      const to = behind.sub(sp);
      to.y = 0;
      const d = to.length();
      if (d > 0.4) {
        const speed = Math.min(d * 3, d > 6 ? 9 : 5);
        sp.addScaledVector(to.normalize(), speed * dt);
        silica.root.rotation.y = Math.atan2(to.x, to.z);
        silica.setState(speed > 6 ? 'Run' : 'Walk', speed / 9);
      } else silica.setState('Idle', 0);
      if (d > 25) sp.copy(player.pos).add(new THREE.Vector3(1.5, 0, 1.5)); // caught up after a climb
      sp.y = field.colliders.topAt(sp.x, sp.z);
      if (Math.hypot(sp.x - PLACES.pond.x, sp.z - PLACES.pond.y) < 17) sp.y = Math.max(sp.y, WATER_Y - 0.9);
    }
    silica.update(dt);
  }

  // landmark reached
  if (!state.spireReached && Math.hypot(player.pos.x - PLACES.landmark.x, player.pos.z - PLACES.landmark.y) < 20 && player.pos.y > 12) {
    state.spireReached = true;
    persist();
    banner('クリスタルの尖塔', 'たどり着いた！（3D試作のゴール）', 3.5);
  }

  // effects
  for (let i = fxPieces.length - 1; i >= 0; i--) {
    const p = fxPieces[i];
    p.life -= dt;
    p.v.y -= 22 * dt;
    p.m.position.addScaledVector(p.v, dt);
    const g = heightAt(p.m.position.x, p.m.position.z);
    if (p.m.position.y < g) { p.m.position.y = g; p.v.multiplyScalar(0.4); p.v.y = Math.abs(p.v.y) * 0.3; }
    p.m.rotation.x += dt * 4;
    if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); fxPieces.splice(i, 1); }
  }
  field.update(dt, t);

  // camera + sun follow
  cam.update(dt, player.pos);
  if (shake > 0) {
    shake -= dt;
    camera.position.x += (Math.random() - 0.5) * shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
  }
  sun.position.copy(player.pos).addScaledVector(SUN_DIR, 80);
  sun.target.position.copy(player.pos);

  // HUD
  const formEl = $('form');
  formEl.style.display = form ? 'inline-block' : 'none';
  if (form) formEl.textContent = form.name;
  if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) $('banner').style.display = 'none';
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) $('msg').style.display = 'none';
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  $('debug').textContent = `${player.state}${debugOn ? `  ${fps}fps  (${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)})` : ''}`;

  endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// iOS: no pinch / double-tap zoom
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

// for automated tests
(window as unknown as Record<string, unknown>).__proto3d = { player, state, field, cam, silica, input, doBond, doBreak, doHardBreak };

player.visual.root.position.copy(player.pos);
showMsg(isTouch ? '左側で移動、右側をスワイプでカメラ。遠くの光る尖塔をめざそう。' : 'WASDで移動、マウスでカメラ（クリックで固定）。遠くの光る尖塔をめざそう。', 6);
requestAnimationFrame(frame);
