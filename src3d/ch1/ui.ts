// DOM user interface for chapter 1: dialogue, captions, area names, mission, toasts and panels.
import { ELEMENTS, ITEMS, MATERIALS, type ElementSymbol } from './game/materials';
import { scanView, elementLabel, discoveredCount, type KnowledgeState } from './game/knowledge';
import { toolStats, toolName, toolMesh, partsNeeded, type ToolDesign, type Tool } from './game/craft';
import { WEAPONS, PART_SLOTS, eligiblePart, type WeaponKind, type PartSlot } from '../gameplay/weaponTypes';
import { mount, unmount, thumbnail, displayKind, mountPreview, zoomPreview, type Subject } from './itemViewer';

const $ = (id: string) => document.getElementById(id)!;

export const ui = {
  /** true while any blocking panel or dialogue is open */
  busy() {
    return sayOpen || ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap', 'gotWrap'].some((id) => $(id).style.display === 'flex');
  },
  fade(black: boolean, ms = 900) {
    const f = $('fade');
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = black ? '1' : '0';
    return wait(ms);
  },
  async caption(text: string, ms = 2200) {
    const c = $('caption');
    c.textContent = text;
    c.classList.add('on');
    await wait(ms);
    c.classList.remove('on');
    await wait(600);
  },
  area(name: string, sub: string) {
    const a = $('area');
    (a.querySelector('.n') as HTMLElement).textContent = name;
    (a.querySelector('.s') as HTMLElement).textContent = sub;
    a.classList.remove('on');
    void a.offsetWidth;
    a.classList.add('on');
    clearTimeout(areaT);
    areaT = window.setTimeout(() => a.classList.remove('on'), 3200);
  },
  mission(t: string, s = '') {
    const m = $('mission');
    m.style.display = 'block';
    (m.querySelector('.t') as HTMLElement).textContent = t;
    (m.querySelector('.s') as HTMLElement).textContent = s;
  },
  toast(text: string, big = false, ms = 2600) {
    const d = document.createElement('div');
    d.innerHTML = text;
    if (big) d.className = 'big';
    $('toast').appendChild(d);
    setTimeout(() => d.remove(), ms);
  },
  prompt(text: string | null) {
    const p = $('prompt');
    p.style.display = text && !sayOpen ? 'block' : 'none';
    if (text) p.textContent = text;
  },
  /** one line of dialogue; resolves when the player taps / presses E */
  say(who: string, text: string): Promise<void> {
    const s = $('say');
    sayOpen = true;
    s.style.display = 'block';
    (s.querySelector('.who') as HTMLElement).textContent = who;
    (s.querySelector('.txt') as HTMLElement).textContent = text;
    $('prompt').style.display = 'none';
    return new Promise((res) => {
      sayResolve = () => {
        sayOpen = false;
        s.style.display = 'none';
        res();
      };
      if (autoAdvance) setTimeout(() => ui.advance(), 30);
    });
  },
  advance() {
    const r = sayResolve;
    sayResolve = null;
    r?.();
  },
  get sayOpen() { return sayOpen; },
  async titleCard() {
    const t = $('titleCard');
    t.style.display = 'flex';
    t.style.opacity = '0';
    t.style.transition = 'opacity 1.2s';
    await wait(50);
    t.style.opacity = '1';
    await wait(autoAdvance ? 100 : 3200);
    t.style.opacity = '0';
    await wait(autoAdvance ? 50 : 1300);
    t.style.display = 'none';
  },
  close(id: string) {
    $(id).style.display = 'none';
    if (id === 'bagWrap' || id === 'codexWrap' || id === 'gotWrap') unmount(); // stop 3D rendering when hidden
  },
  open(id: string) {
    $(id).style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  },
};

let sayOpen = false;
let sayResolve: (() => void) | null = null;
let areaT = 0;
/** tests: dialogue advances by itself */
export let autoAdvance = false;
export function setAutoAdvance(v: boolean) { autoAdvance = v; }

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, autoAdvance ? Math.min(ms, 40) : ms));

$('say').addEventListener('click', () => ui.advance());
$('gotWrap').addEventListener('click', (e) => { if (e.target === $('gotWrap')) dismissGot(); });
$('say').addEventListener('touchstart', (e) => { e.preventDefault(); ui.advance(); }, { passive: false });
for (const id of ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap']) {
  $(id).addEventListener('click', (e) => { if (e.target === $(id)) ui.close(id); });
}

// ── scan panel ──
export function showScan(k: KnowledgeState, matId: string, label?: string) {
  const m = MATERIALS[matId];
  const v = scanView(k, m);
  const title = !k.scan ? 'UNKNOWN' : m.mystery ? `${label ?? m.nameJa}（UNKNOWN）` : label && label !== m.nameJa ? `${label}（${m.nameJa}）` : m.nameJa;
  const parts = v.parts.map((p) => `<span class="el l${p.lv}">${p.label}</span>`).join('') || '<span class="el l0">???</span>';
  const props = k.scan && !v.unknown ? v.props.map((p) => `<div class="bar"><span>${p.label}</span><i style="width:${p.v * 14}px"></i></div>`).join('') : '<div class="note">性質：？？？</div>';
  $('scanPanel').innerHTML = `<button class="small close" id="scanX">とじる</button>
    <div class="kind">${k.scan ? 'MATERIAL SCAN' : 'しらべる'}</div><h2>${title}</h2><div class="kind">${v.kind}${v.formula ? '　' + v.formula : ''}</div>
    ${k.scan ? `<div style="margin-top:8px">${parts}</div>${v.bonds.length ? `<div class="note">見えるつながり：${v.bonds.join('　')}</div>` : ''}` : ''}
    <div class="cols"><div class="col real"><h3>わかったこと（本物の科学）</h3><ul>${v.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div>
    <div class="col"><h3>性質（ゲーム用のめやす）</h3>${props}${v.note ? `<div class="note" style="color:#9fe0b8">ゲームの設定：${v.note}</div>` : ''}</div></div>`;
  $('scanX').onclick = () => ui.close('scanWrap');
  ui.open('scanWrap');
}

// ── "got it" card: big 3D on first find / first understanding ──
export interface GotCard {
  subject: Subject;
  tag: 'NEW' | 'UNDERSTOOD';
  title: string; // CARBON / 石英のかけら
  line2?: string; // C / 6
  line3?: string; // 炭素
  count?: number;
  note?: string;
}
const gotQueue: { card: GotCard; done: () => void }[] = [];
let gotOpen = false;
export function showGot(card: GotCard): Promise<void> {
  return new Promise((res) => {
    gotQueue.push({ card, done: res });
    if (!gotOpen) nextGot();
  });
}
function nextGot() {
  const it = gotQueue.shift();
  if (!it) { gotOpen = false; return; }
  gotOpen = true;
  const c = it.card;
  const el = c.tag === 'UNDERSTOOD';
  $('gotPanel').className = 'got' + (el ? ' el' : '');
  $('gotPanel').innerHTML = `<div class="gv" id="gotView"></div><div class="tag">${c.tag}</div><div class="tt">${c.title}</div>
    ${c.line2 ? `<div class="l2">${c.line2}</div>` : ''}${c.line3 ? `<div class="l3">${c.line3}</div>` : ''}${c.count ? `<div class="cnt">×${c.count}</div>` : ''}
    ${c.note ? `<div class="note">${c.note}</div>` : ''}<button class="bigbtn" id="gotOk">OK</button>`;
  const view = $('gotView');
  void mount(view, c.subject, true);
  if (displayKind(c.subject) === 'text') view.style.display = 'none';
  ui.open('gotWrap');
  const close = () => {
    unmount();
    ui.close('gotWrap');
    it.done();
    setTimeout(nextGot, 60);
  };
  gotClose = close;
  $('gotOk').onclick = close;
  if (autoAdvance) setTimeout(close, 120);
}
let gotClose: (() => void) | null = null;
/** close the top card (OK / A / E) */
export function dismissGot() { if (gotOpen && gotClose) { const c = gotClose; gotClose = null; c(); } }
export const gotIsOpen = () => gotOpen;

// ── bag + free crafting ──
export interface BagCallbacks {
  inv: Record<string, number>;
  tool: Tool | null;
  canCreate: boolean;
  onMake(d: ToolDesign): Tool | null;
  onEquip(i: number | null): void;
  tools: Tool[];
}
const emptyDesign = (kind?: WeaponKind): ToolDesign => ({ handle: null, head: null, binding: null, kind });
const slotName: Record<PartSlot, string> = { head: '攻撃部分', handle: '柄', binding: '接合素材' };
let design = emptyDesign();
let slotSel: PartSlot = 'head';
let bagSel: string | null = null;
export function showBag(cb: BagCallbacks) {
  const render = () => {
    unmount();
    const ids = Object.keys(cb.inv).filter((id) => cb.inv[id] > 0 && ITEMS[id]);
    if (bagSel && !ids.includes(bagSel)) bagSel = null;
    const needed = partsNeeded(design);
    const st = toolStats(design);
    const sufficient = Object.entries(needed).every(([id, n]) => (cb.inv[id] ?? 0) >= n);
    const compatible = (slot: PartSlot, id: string) =>
      eligiblePart(slot, id, design.kind) && (needed[id] ?? 0) - Number(design[slot] === id) < (cb.inv[id] ?? 0);
    const items = ids.map((id) => `<button type="button" draggable="true" class="card ${bagSel === id ? 'sel' : ''} ${cb.canCreate && !compatible(slotSel, id) ? 'incompatible' : ''}" data-id="${id}"><span class="th" data-th="${id}"></span><span class="nm">${ITEMS[id].nameJa}</span><span class="n">×${cb.inv[id]}</span></button>`).join('') || '<span class="note">まだ何も持っていない</span>';
    const slots = PART_SLOTS.map((slot) => `<button type="button" class="slot ${slotSel === slot ? 'sel' : ''}" data-slot="${slot}"><span class="k">${slotName[slot]}</span><span class="v">${design[slot] ? ITEMS[design[slot]!].nameJa : '選ぶ'}</span></button>`).join('');
    const selected = bagSel ? ITEMS[bagSel] : null;
    const canPreview = cb.canCreate && (!!design.kind || PART_SLOTS.some((slot) => design[slot] !== null));
    $('bagPanel').innerHTML = `<button class="small close" id="bagX">とじる</button><h2>${cb.canCreate ? '持ち物・CREATE' : '持ち物'}</h2>
      ${cb.canCreate ? `<label class="craft-type">種類 <select id="craftKind"><option value="">工具（自由に組み合わせる）</option>${Object.entries(WEAPONS).map(([kind, def]) => `<option value="${kind}" ${design.kind === kind ? 'selected' : ''}>${def.label}</option>`).join('')}</select></label>` : ''}
      <div class="craft-layout"><section class="craft-supplies"><h3>所持素材</h3><div class="grid">${items}</div></section>
      <section class="craft-preview"><h3>${canPreview ? '製作プレビュー' : selected?.nameJa ?? '3Dプレビュー'}</h3><div id="bagView" class="pv"></div><div class="craft-zoom"><button class="small" id="previewOut" aria-label="縮小">−</button><button class="small" id="previewIn" aria-label="拡大">＋</button></div>
      ${cb.canCreate ? `<div class="slots">${slots}</div><button class="small" id="bToSlot" ${bagSel && compatible(slotSel, bagSel) ? '' : 'disabled'}>選んだ素材を${slotName[slotSel]}に入れる</button>` : ''}</section>
      <section class="craft-stats"><h3>性能と必要素材</h3>
      ${st ? `<strong>${toolName(design, st)}</strong><dl><dt>攻撃力</dt><dd>${st.attack}</dd><dt>攻撃速度</dt><dd>${st.attackSpeed}</dd><dt>耐久</dt><dd>${st.durability}回</dd><dt>重量</dt><dd>${st.weight} kg</dd><dt>リーチ</dt><dd>${st.reach} m</dd><dt>破壊能力</dt><dd>切 ${st.cut}／突 ${st.pierce}／打 ${st.impact}</dd></dl>${st.effect ? `<p>${st.effect}</p>` : ''}` : '<p class="note">部品を組み合わせると性能が出ます。</p>'}
      <ul>${Object.entries(needed).map(([id, n]) => `<li class="${(cb.inv[id] ?? 0) < n ? 'shortage' : ''}">${ITEMS[id].nameJa} ${n} / ${cb.inv[id] ?? 0}</li>`).join('')}</ul>
      ${cb.canCreate ? `<button class="bigbtn" id="bMake" ${st && sufficient ? '' : 'disabled'}>つくる</button> <button class="small" id="bClear">枠を空にする</button>` : ''}</section></div>
      <div class="note">装備 ${cb.tools.map((t, i) => `<button class="item" data-eq="${i}">${t.name}${cb.tool === t ? ' ✔' : ''}（${t.uses}回）</button>`).join(' ')} <button class="item" data-eq="-1">素手</button></div>`;
    const panel = $('bagPanel');
    const preview = $('bagView');
    $('bagX').onclick = () => ui.close('bagWrap');
    if (canPreview) mountPreview(preview, toolMesh(design));
    else if (selected) void mount(preview, { kind: 'item', id: selected.id }, true);
    $('previewOut').onclick = () => zoomPreview(-1);
    $('previewIn').onclick = () => zoomPreview(1);
    const chooseKind = document.getElementById('craftKind') as HTMLSelectElement | null;
    if (chooseKind) chooseKind.onchange = () => {
      design = emptyDesign(chooseKind.value ? chooseKind.value as WeaponKind : undefined);
      slotSel = 'head';
      render();
    };
    const assign = (slot: PartSlot, id: string) => {
      if (!compatible(slot, id)) return;
      design[slot] = id;
      slotSel = PART_SLOTS.find((part) => !design[part]) ?? slot;
      render();
    };
    panel.querySelectorAll<HTMLElement>('.slot').forEach((button) => {
      const slot = button.dataset.slot as PartSlot;
      button.onclick = () => { slotSel = slot; render(); };
      button.ondragover = (event) => event.preventDefault();
      button.ondrop = (event) => { event.preventDefault(); assign(slot, event.dataTransfer?.getData('text/plain') ?? ''); };
    });
    panel.querySelectorAll<HTMLElement>('.card[data-id]').forEach((el) => {
      el.onclick = () => {
        bagSel = el.dataset.id!;
        if (cb.canCreate && design.kind && compatible(slotSel, bagSel)) assign(slotSel, bagSel);
        else render();
      };
      el.ondragstart = (event) => event.dataTransfer?.setData('text/plain', el.dataset.id!);
      const id = el.dataset.id!;
      const th = el.querySelector<HTMLElement>('.th')!;
      void thumbnail({ kind: 'item', id }).then((url) => {
        if (!el.isConnected) return;
        if (url) { const icon = document.createElement('img'); icon.src = url; icon.alt = ''; th.replaceChildren(icon); }
        else th.textContent = ITEMS[id].nameJa.slice(0, 2);
      });
    });
    const to = document.getElementById('bToSlot');
    if (to) to.onclick = () => { if (bagSel) assign(slotSel, bagSel); };
    panel.querySelectorAll<HTMLElement>('[data-eq]').forEach((el) => (el.onclick = () => { const i = Number(el.dataset.eq); cb.onEquip(i < 0 ? null : i); cb.tool = i < 0 ? null : cb.tools[i]; render(); }));
    const mk = document.getElementById('bMake');
    if (mk) mk.onclick = () => { const made = cb.onMake({ ...design }); if (!made) return; cb.tool = made; design = emptyDesign(design.kind); slotSel = 'head'; render(); };
    const cl = document.getElementById('bClear');
    if (cl) cl.onclick = () => { design = emptyDesign(design.kind); slotSel = 'head'; render(); };
  };
  render();
  ui.open('bagWrap');
}

// ── codex ──
let codexSel: ElementSymbol | null = null;
export function showCodex(k: KnowledgeState, notes: string[], wildlifeMaterials: string[] = []) {
  const els = (Object.keys(ELEMENTS) as ElementSymbol[]).filter((s) => (k.el[s] ?? 0) > 0);
  const mats = [...new Set([...k.scanned, ...wildlifeMaterials])].map((id) => MATERIALS[id]).filter(Boolean);
  if (codexSel && (k.el[codexSel] ?? 0) < 2) codexSel = null;
  const sel = codexSel ? ELEMENTS[codexSel] : null;
  $('codexPanel').innerHTML = `<button class="small close" id="codexX">とじる</button><h2>図鑑</h2><div class="kind">DISCOVERED ${discoveredCount(k)} / 118</div>
    ${sel ? `<div class="eldetail"><div class="pv" id="codexView"></div><div class="info"><div class="sym">${sel.symbol}<span>${sel.z}</span></div><div class="pn">${sel.nameJa}　${sel.en}</div>
      <div class="real"><h3>本物の科学</h3><div>${sel.fact}</div></div>
      <div class="fic"><h3>ゲームの中の能力（フィクション）</h3><div>${sel.ability ?? 'まだわからない'}</div></div>
      <div class="note">3D はゲーム上のイメージ表現です（本物の原子がこの形・色をしているわけではありません）。</div></div></div>` : ''}
    <div class="cols"><div class="col real"><h3>元素</h3>${els.length ? els.map((s) => `<div style="margin:4px 0" ${(k.el[s] ?? 0) >= 2 ? `class="elrow" data-el="${s}"` : ''}><span class="el l${k.el[s]}">${elementLabel(k, s)}</span> ${(k.el[s] ?? 0) >= 2 ? `<span style="font-size:13px">${ELEMENTS[s].fact}</span> <b style="color:#8fc8ff">▶ 見る</b>` : '<span class="note">まだよくわからない</span>'}</div>`).join('') : '<div class="note">まだ何もわからない。</div>'}</div>
    <div class="col"><h3>見つけた物</h3><ul>${mats.map((m) => `<li>${m.mystery ? m.nameJa + '（UNKNOWN）' : m.nameJa + (m.id.startsWith('cave_') ? '（架空生物の素材）' : '')}</li>`).join('') || '<li>なし</li>'}</ul>
    <h3 style="margin-top:12px">気になること</h3><ul>${notes.map((n) => `<li>${n}</li>`).join('') || '<li>……</li>'}</ul></div></div>
    <div class="note">白い字＝本物の科学。緑の字＝このゲームの中だけの能力・設定（フィクション）。</div>`;
  $('codexX').onclick = () => ui.close('codexWrap');
  document.querySelectorAll<HTMLElement>('#codexPanel .elrow').forEach((el) => (el.onclick = () => { codexSel = el.dataset.el as ElementSymbol; showCodex(k, notes, wildlifeMaterials); }));
  unmount();
  if (sel) void mount($('codexView'), { kind: 'element', symbol: sel.symbol }, true);
  ui.open('codexWrap');
}
