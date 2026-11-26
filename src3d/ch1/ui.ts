// DOM user interface for chapter 1: dialogue, captions, area names, mission, toasts and panels.
import { ELEMENTS, ITEMS, MATERIALS, type ElementSymbol } from './game/materials';
import { scanView, elementLabel, discoveredCount, type KnowledgeState } from './game/knowledge';
import { toolStats, toolName, type ToolDesign, type Tool } from './game/craft';

const $ = (id: string) => document.getElementById(id)!;

export const ui = {
  /** true while any blocking panel or dialogue is open */
  busy() {
    return sayOpen || ['scanWrap', 'bagWrap', 'codexWrap', 'settingsWrap'].some((id) => $(id).style.display === 'flex');
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
  close(id: string) { $(id).style.display = 'none'; },
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

// ── bag + free crafting ──
export interface BagCallbacks {
  inv: Record<string, number>;
  tool: Tool | null;
  canCreate: boolean;
  onMake(d: ToolDesign): void;
  onEquip(i: number | null): void;
  tools: Tool[];
}
let design: ToolDesign = { handle: null, head: null, binding: null };
let slotSel: keyof ToolDesign = 'handle';
export function showBag(cb: BagCallbacks) {
  const render = () => {
    const inv = cb.inv;
    const itemsHtml = Object.entries(inv).filter(([, n]) => n > 0).map(([id, n]) => `<span class="item" data-id="${id}">${ITEMS[id].nameJa}<b>×${n}</b></span>`).join('') || '<span class="note">まだ何も持っていない。</span>';
    const st = toolStats(design);
    const nm = st ? toolName(design, st) : '';
    const slot = (k: keyof ToolDesign, label: string) => `<div class="slot ${slotSel === k ? 'sel' : ''}" data-slot="${k}"><div class="k">${label}</div><div class="v">${design[k] ? ITEMS[design[k]!].nameJa : '―'}</div></div>`;
    $('bagPanel').innerHTML = `<button class="small close" id="bagX">とじる</button><h2>持ち物</h2>
      <div class="items">${itemsHtml}</div>
      <div class="note">持っている道具：${cb.tools.length ? cb.tools.map((t, i) => `<span class="item" data-eq="${i}">${t.name}${cb.tool === t ? ' ✔' : ''}（のこり${t.uses}回）</span>`).join(' ') : 'なし'} <span class="item" data-eq="-1">素手にする</span></div>
      ${cb.canCreate ? `<h2 style="margin-top:14px">CREATE　つくる</h2><div class="note">枠をえらんで、持ち物をタップして入れる。形と材料から、道具の力がきまる（決まった作り方はない）。</div>
      <div class="slots" style="margin-top:8px">${slot('handle', '柄（え）：長いもの')}${slot('head', '先端：たたく・切る・突く部分')}${slot('binding', 'しばる：あると長もち')}</div>
      ${st ? `<div class="stats"><div>リーチ <b>${st.reach}</b>m</div><div>切る <b>${st.cut}</b></div><div>突く <b>${st.pierce}</b></div><div>たたく <b>${st.impact}</b></div><div>重さ <b>${st.weight}</b>kg</div><div>耐久 <b>${st.durability}</b>回</div></div>
      <div class="note">できるもの：<b style="color:#fff">${nm}</b></div>` : '<div class="note">部品を入れると、力の見こみが出る。</div>'}
      <button class="bigbtn" id="bMake" ${st ? '' : 'disabled'}>つくる</button> <button class="small" id="bClear">枠を空にする</button>` : ''}`;
    $('bagX').onclick = () => ui.close('bagWrap');
    document.querySelectorAll<HTMLElement>('#bagPanel .slot').forEach((el) => (el.onclick = () => { const k = el.dataset.slot as keyof ToolDesign; if (design[k]) design[k] = null; slotSel = k; render(); }));
    document.querySelectorAll<HTMLElement>('#bagPanel .item[data-id]').forEach((el) => (el.onclick = () => {
      if (!cb.canCreate) return;
      const id = el.dataset.id!;
      const used = Object.values(design).filter((v) => v === id).length;
      if (used >= (cb.inv[id] ?? 0)) return;
      if (slotSel === 'binding' && !ITEMS[id].binding) return;
      design[slotSel] = id;
      slotSel = slotSel === 'handle' ? 'head' : slotSel === 'head' ? 'binding' : 'binding';
      render();
    }));
    document.querySelectorAll<HTMLElement>('#bagPanel .item[data-eq]').forEach((el) => (el.onclick = () => { const i = Number(el.dataset.eq); cb.onEquip(i < 0 ? null : i); render(); }));
    const mk = document.getElementById('bMake');
    if (mk) mk.onclick = () => { cb.onMake({ ...design }); design = { handle: null, head: null, binding: null }; slotSel = 'handle'; render(); };
    const cl = document.getElementById('bClear');
    if (cl) cl.onclick = () => { design = { handle: null, head: null, binding: null }; slotSel = 'handle'; render(); };
  };
  render();
  ui.open('bagWrap');
}

// ── codex ──
export function showCodex(k: KnowledgeState, notes: string[]) {
  const els = (Object.keys(ELEMENTS) as ElementSymbol[]).filter((s) => (k.el[s] ?? 0) > 0);
  const mats = k.scanned.map((id) => MATERIALS[id]).filter(Boolean);
  $('codexPanel').innerHTML = `<button class="small close" id="codexX">とじる</button><h2>図鑑</h2><div class="kind">DISCOVERED ${discoveredCount(k)} / 118</div>
    <div class="cols"><div class="col real"><h3>元素</h3>${els.length ? els.map((s) => `<div style="margin:4px 0"><span class="el l${k.el[s]}">${elementLabel(k, s)}</span> ${(k.el[s] ?? 0) >= 2 ? `<span style="font-size:13px">${ELEMENTS[s].fact}</span>` : '<span class="note">まだよくわからない</span>'}</div>`).join('') : '<div class="note">まだ何もわからない。</div>'}</div>
    <div class="col"><h3>スキャンした物</h3><ul>${mats.map((m) => `<li>${m.mystery ? m.nameJa + '（UNKNOWN）' : m.nameJa}</li>`).join('') || '<li>なし</li>'}</ul>
    <h3 style="margin-top:12px">気になること</h3><ul>${notes.map((n) => `<li>${n}</li>`).join('') || '<li>……</li>'}</ul></div></div>
    <div class="note">白い字＝本物の科学。緑の字＝このゲームの中だけの能力・設定（フィクション）。</div>`;
  $('codexX').onclick = () => ui.close('codexWrap');
  ui.open('codexWrap');
}
