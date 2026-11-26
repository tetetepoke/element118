// DOM user interface for chapter 1: dialogue, captions, area names, mission, toasts and panels.
import { ELEMENTS, ITEMS, MATERIALS, type ElementSymbol } from './game/materials';
import { scanView, elementLabel, discoveredCount, type KnowledgeState } from './game/knowledge';
import { toolStats, toolName, type ToolDesign, type Tool } from './game/craft';
import { mount, unmount, thumbnail, displayKind, type Subject } from './itemViewer';

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
  onMake(d: ToolDesign): void;
  onEquip(i: number | null): void;
  tools: Tool[];
}
let design: ToolDesign = { handle: null, head: null, binding: null };
let slotSel: keyof ToolDesign = 'handle';
let bagSel: string | null = null;
export function showBag(cb: BagCallbacks) {
  const render = () => {
    const inv = cb.inv;
    const ids = Object.entries(inv).filter(([, n]) => n > 0).map(([id]) => id);
    if (bagSel && !ids.includes(bagSel)) bagSel = null;
    const itemsHtml = ids.map((id) => `<div class="card ${bagSel === id ? 'sel' : ''}" data-id="${id}"><div class="th" data-th="${id}"></div><div class="nm">${ITEMS[id].nameJa}</div><div class="n">×${inv[id]}</div></div>`).join('') || '<span class="note">まだ何も持っていない。</span>';
    const st = toolStats(design);
    const nm = st ? toolName(design, st) : '';
    const slot = (k: keyof ToolDesign, label: string) => `<div class="slot ${slotSel === k ? 'sel' : ''}" data-slot="${k}"><div class="k">${label}</div><div class="v">${design[k] ? ITEMS[design[k]!].nameJa : '―'}</div></div>`;
    const selIt = bagSel ? ITEMS[bagSel] : null;
    $('bagPanel').innerHTML = `<button class="small close" id="bagX">とじる</button><h2>持ち物</h2>
      <div class="bagTop"><div class="grid">${itemsHtml}</div>
      ${selIt ? `<div class="preview"><div class="pv" id="bagView"></div><div class="pn">${selIt.nameJa}</div><div class="note">${MATERIALS[selIt.mat]?.nameJa ?? ''}　×${inv[bagSel!]}</div>
        ${displayKind({ kind: 'item', id: bagSel! }) === 'proc' || displayKind({ kind: 'item', id: bagSel! }) === 'model' ? '<div class="note">指・マウスで回せる</div>' : ''}
        ${cb.canCreate ? '<button class="small" id="bToSlot">枠に入れる</button>' : ''}</div>` : ''}</div>
      <div class="note">持っている道具：${cb.tools.length ? cb.tools.map((t, i) => `<span class="item" data-eq="${i}">${t.name}${cb.tool === t ? ' ✔' : ''}（のこり${t.uses}回）</span>`).join(' ') : 'なし'} <span class="item" data-eq="-1">素手にする</span></div>
      ${cb.canCreate ? `<h2 style="margin-top:14px">CREATE　つくる</h2><div class="note">枠をえらんで、持ち物をえらび「枠に入れる」。形と材料から、道具の力がきまる（決まった作り方はない）。</div>
      <div class="slots" style="margin-top:8px">${slot('handle', '柄（え）：長いもの')}${slot('head', '先端：たたく・切る・突く部分')}${slot('binding', 'しばる：あると長もち')}</div>
      ${st ? `<div class="stats"><div>リーチ <b>${st.reach}</b>m</div><div>切る <b>${st.cut}</b></div><div>突く <b>${st.pierce}</b></div><div>たたく <b>${st.impact}</b></div><div>重さ <b>${st.weight}</b>kg</div><div>耐久 <b>${st.durability}</b>回</div></div>
      <div class="note">できるもの：<b style="color:#fff">${nm}</b></div>` : '<div class="note">部品を入れると、力の見こみが出る。</div>'}
      <button class="bigbtn" id="bMake" ${st ? '' : 'disabled'}>つくる</button> <button class="small" id="bClear">枠を空にする</button>` : ''}`;
    $('bagX').onclick = () => ui.close('bagWrap');
    // thumbnails: rendered once per item, then reused
    void (async () => {
      for (const id of ids) {
        const url = await thumbnail({ kind: 'item', id });
        const th = document.querySelector<HTMLElement>(`#bagPanel [data-th="${id}"]`);
        if (th && url) th.innerHTML = `<img src="${url}" alt="">`;
        else if (th) th.textContent = ITEMS[id].nameJa.slice(0, 2);
      }
      if (bagSel) { const v = document.getElementById('bagView'); if (v) void mount(v, { kind: 'item', id: bagSel }, true); }
    })();
    document.querySelectorAll<HTMLElement>('#bagPanel .slot').forEach((el) => (el.onclick = () => { const k = el.dataset.slot as keyof ToolDesign; if (design[k]) design[k] = null; slotSel = k; render(); }));
    document.querySelectorAll<HTMLElement>('#bagPanel .card[data-id]').forEach((el) => (el.onclick = () => { bagSel = el.dataset.id!; render(); }));
    const ts = document.getElementById('bToSlot');
    if (ts) ts.onclick = () => {
      const id = bagSel!;
      const used = Object.values(design).filter((v) => v === id).length;
      if (used >= (cb.inv[id] ?? 0)) return;
      if (slotSel === 'binding' && !ITEMS[id].binding) return;
      design[slotSel] = id;
      slotSel = slotSel === 'handle' ? 'head' : 'binding';
      render();
    };
    document.querySelectorAll<HTMLElement>('#bagPanel .item[data-eq]').forEach((el) => (el.onclick = () => { const i = Number(el.dataset.eq); cb.onEquip(i < 0 ? null : i); render(); }));
    const mk = document.getElementById('bMake');
    if (mk) mk.onclick = () => { cb.onMake({ ...design }); design = { handle: null, head: null, binding: null }; slotSel = 'handle'; render(); };
    const cl = document.getElementById('bClear');
    if (cl) cl.onclick = () => { design = { handle: null, head: null, binding: null }; slotSel = 'handle'; render(); };
  };
  unmount();
  render();
  ui.open('bagWrap');
}

// ── codex ──
let codexSel: ElementSymbol | null = null;
export function showCodex(k: KnowledgeState, notes: string[]) {
  const els = (Object.keys(ELEMENTS) as ElementSymbol[]).filter((s) => (k.el[s] ?? 0) > 0);
  const mats = k.scanned.map((id) => MATERIALS[id]).filter(Boolean);
  if (codexSel && (k.el[codexSel] ?? 0) < 2) codexSel = null;
  const sel = codexSel ? ELEMENTS[codexSel] : null;
  $('codexPanel').innerHTML = `<button class="small close" id="codexX">とじる</button><h2>図鑑</h2><div class="kind">DISCOVERED ${discoveredCount(k)} / 118</div>
    ${sel ? `<div class="eldetail"><div class="pv" id="codexView"></div><div class="info"><div class="sym">${sel.symbol}<span>${sel.z}</span></div><div class="pn">${sel.nameJa}　${sel.en}</div>
      <div class="real"><h3>本物の科学</h3><div>${sel.fact}</div></div>
      <div class="fic"><h3>ゲームの中の能力（フィクション）</h3><div>${sel.ability ?? 'まだわからない'}</div></div>
      <div class="note">3D はゲーム上のイメージ表現です（本物の原子がこの形・色をしているわけではありません）。</div></div></div>` : ''}
    <div class="cols"><div class="col real"><h3>元素</h3>${els.length ? els.map((s) => `<div style="margin:4px 0" ${(k.el[s] ?? 0) >= 2 ? `class="elrow" data-el="${s}"` : ''}><span class="el l${k.el[s]}">${elementLabel(k, s)}</span> ${(k.el[s] ?? 0) >= 2 ? `<span style="font-size:13px">${ELEMENTS[s].fact}</span> <b style="color:#8fc8ff">▶ 見る</b>` : '<span class="note">まだよくわからない</span>'}</div>`).join('') : '<div class="note">まだ何もわからない。</div>'}</div>
    <div class="col"><h3>スキャンした物</h3><ul>${mats.map((m) => `<li>${m.mystery ? m.nameJa + '（UNKNOWN）' : m.nameJa}</li>`).join('') || '<li>なし</li>'}</ul>
    <h3 style="margin-top:12px">気になること</h3><ul>${notes.map((n) => `<li>${n}</li>`).join('') || '<li>……</li>'}</ul></div></div>
    <div class="note">白い字＝本物の科学。緑の字＝このゲームの中だけの能力・設定（フィクション）。</div>`;
  $('codexX').onclick = () => ui.close('codexWrap');
  document.querySelectorAll<HTMLElement>('#codexPanel .elrow').forEach((el) => (el.onclick = () => { codexSel = el.dataset.el as ElementSymbol; showCodex(k, notes); }));
  unmount();
  if (sel) void mount($('codexView'), { kind: 'element', symbol: sel.symbol }, true);
  ui.open('codexWrap');
}
