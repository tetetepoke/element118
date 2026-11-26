// Item / element visuals in chapter 1: first-find 3D card, small notice afterwards, UNDERSTOOD card,
// inventory thumbnails + rotatable preview, codex element view, one shared viewer that stops when hidden,
// old saves (no first-find record) still load, new saves record it.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
let fails = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok' : 'FAIL'} ${m}`); if (!c) fails++; };
const URL = 'http://localhost:4173/element118/chapter1/?skip';
const G = (fn, a) => p.evaluate(async (x) => await (new Function('G', 'a', `return (async () => (${x.fn})(G, a))()`))(window.__ch1, x.a), { fn: fn.toString(), a });
const start = async (cont = false) => {
  await p.goto(URL);
  await p.waitForTimeout(2500);
  await p.evaluate((c) => document.getElementById(c ? 'bCont' : 'bNew').click(), cont);
  await p.waitForTimeout(1800);
};
/** how much of the viewer canvas is drawn (non-transparent pixels) */
const drawn = () => p.evaluate(() => {
  const c = window.__ch1.viewerStats.canvas;
  if (!c || !c.isConnected) return 0;
  const t = document.createElement('canvas');
  t.width = 64; t.height = 64;
  const x = t.getContext('2d');
  x.drawImage(c, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
  return n;
});

await p.goto(URL);
await p.evaluate(() => localStorage.removeItem('element118.ch1.save'));
await start();

console.log('first find → big 3D card; second → small notice');
await G((G) => { G.S.k.harvest = true; G.player.teleport(13, 102.6); });
await p.waitForTimeout(300);
await G((G) => { void G.onAction(); });
await p.waitForTimeout(900);
check(await p.isVisible('#gotWrap'), 'first stick → big card');
check((await p.textContent('#gotPanel')).includes('NEW') && (await p.textContent('#gotPanel')).includes('木の棒') && (await p.textContent('#gotPanel')).includes('×1'), 'card: NEW / 木の棒 / ×1');
check(await G((G) => G.viewerStats.rendering), 'the viewer renders while the card is shown');
await p.screenshot({ path: 'test-output/ch1-got-stick.png' });
await p.tap('#gotOk');
await p.waitForTimeout(400);
check(!(await p.isVisible('#gotWrap')) && !(await G((G) => G.viewerStats.rendering)), 'closing the card stops 3D rendering');
const f0 = await G((G) => G.viewerStats.frames);
await p.waitForTimeout(600);
check((await G((G) => G.viewerStats.frames)) === f0, 'no viewer frames are drawn while hidden');
await G((G) => { void G.onAction(); });
await p.waitForTimeout(700);
check(!(await p.isVisible('#gotWrap')) && (await p.textContent('#toast')).includes('＋ 木の棒 ×1'), 'second stick → small "＋ 木の棒 ×1" only');

console.log('quartz and iron ore in 3D');
for (const [id, name] of [['quartz', '石英のかけら'], ['ore', '鉄鉱石']]) {
  await G((G, id) => { G.S.inv[id] = (G.S.inv[id] ?? 0) + 1; void G.gotItem(id); }, id);
  await p.waitForTimeout(1500);
  const px = await drawn();
  check(await p.isVisible('#gotWrap') && px > 250, `${name}: 3D model drawn on the card (${px} px)`);
  await p.screenshot({ path: `test-output/ch1-got-${id}.png` });
  await G((G) => G.dismissGot());
  await p.waitForTimeout(300);
}

console.log('element understood → UNDERSTOOD card');
await G((G) => { G.S.k.el.Si = 2; void G.understood('Si'); });
await p.waitForTimeout(1500);
const card = await p.textContent('#gotPanel');
check(card.includes('UNDERSTOOD') && card.includes('Si') && card.includes('14') && card.includes('SILICON') && card.includes('ケイ素'), 'UNDERSTOOD / Si / 14 / SILICON / ケイ素');
check((await drawn()) > 250, 'element image drawn');
await p.screenshot({ path: 'test-output/ch1-got-si.png' });
await G((G) => G.dismissGot());
await p.waitForTimeout(300);
await G((G) => { void G.understood('Si'); });
await p.waitForTimeout(500);
check(!(await p.isVisible('#gotWrap')), 'the same element does not show the card twice');

console.log('inventory: thumbnails + preview');
await G((G) => { G.S.inv.sharp_stone = 1; G.openBag(); });
await p.waitForTimeout(2500);
const thumbs = await p.evaluate(() => document.querySelectorAll('#bagPanel .card .th img').length);
const cards = await p.evaluate(() => document.querySelectorAll('#bagPanel .card').length);
check(thumbs === cards && cards >= 4, `every item has a thumbnail image (${thumbs}/${cards})`);
check(await p.evaluate(() => document.querySelectorAll('canvas').length) <= 2, 'only one extra canvas in the page (no canvas per item)');
check(!(await G((G) => G.viewerStats.rendering)), 'the viewer is idle while only thumbnails are shown');
await p.tap('#bagPanel .card[data-id="quartz"]');
await p.waitForTimeout(1500);
check(await G((G) => G.viewerStats.rendering) && (await drawn()) > 200, 'tapping quartz → large 3D preview');
const s0 = await G((G) => G.viewerStats.spin);
const box = await p.evaluate(() => { const r = document.getElementById('bagView').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.evaluate(([x, y]) => {
  const c = window.__ch1.viewerStats.canvas;
  const ev = (type, cx) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: y, bubbles: true, cancelable: true }));
  ev('pointerdown', x);
  for (let i = 1; i <= 6; i++) ev('pointermove', x + i * 15);
  ev('pointerup', x + 90);
}, box);
const s1 = await G((G) => G.viewerStats.spin);
check(Math.abs(s1 - s0) > 0.8, `one finger turns the model (Δ ${(s1 - s0).toFixed(2)} rad)`);
const fit = await p.evaluate(() => { const r = document.getElementById('bagPanel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
check(fit, 'the bag panel stays inside the screen');
check(await p.evaluate(() => getComputedStyle(window.__ch1.viewerStats.canvas).touchAction === 'none'), 'touching the preview never scrolls the page');
await p.screenshot({ path: 'test-output/ch1-bag.png' });
await p.tap('#bagX');
await p.waitForTimeout(300);
check(!(await G((G) => G.viewerStats.rendering)), 'closing the bag stops rendering');

console.log('codex uses the same viewer');
await G((G) => { G.S.k.scan = true; });
await p.evaluate(() => document.getElementById('bCodex').click());
await p.waitForTimeout(600);
await p.tap('#codexPanel .elrow[data-el="Si"]');
await p.waitForTimeout(1500);
const cx = await p.textContent('#codexPanel');
check(await G((G) => G.viewerStats.rendering) && (await drawn()) > 200, 'Si in the codex → 3D image');
check(cx.includes('14') && cx.includes('SILICON') && cx.includes('本物の科学') && cx.includes('フィクション') && cx.includes('イメージ表現'), 'codex: number, name, science, game ability, "image only" note');
await p.screenshot({ path: 'test-output/ch1-codex-si.png' });
await p.tap('#codexX');
await p.waitForTimeout(300);
check(!(await G((G) => G.viewerStats.rendering)), 'closing the codex stops rendering');

console.log('BOND / BREAK still work');
await G((G) => { const S = G.S; S.flags.silica_met = true; S.k.bond = true; S.k.breakSkill = true; S.partner = 'follow'; G.silica.root.visible = true; G.silica.root.position.copy(G.player.pos).add({ x: 1.2, y: 0, z: 0 }); });
await G((G) => G.onForm());
await p.waitForTimeout(2600);
check((await G((G) => G.S.form)) === 'sic', 'BOND');
await G((G) => G.onForm());
await p.waitForTimeout(2300);
check((await G((G) => G.S.form)) === 'normal', 'BREAK');

console.log('saves');
await G((G) => G.persist());
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('element118.ch1.save')));
check(Array.isArray(saved.seen) && saved.seen.includes('stick') && saved.seenEl.includes('Si'), 'new save records first finds');
// an old save from before this change (no seen / seenEl)
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('element118.ch1.save'));
  delete s.seen; delete s.seenEl;
  s.inv = { stick: 1 }; s.k.el = { C: 2, Si: 1 };
  localStorage.setItem('element118.ch1.save', JSON.stringify(s));
});
await start(true);
check((await G((G) => G.S.inv.stick)) === 1, 'old save loads');
await G((G) => { G.player.teleport(13, 102.6); });
await p.waitForTimeout(300);
await G((G) => { void G.onAction(); });
await p.waitForTimeout(800);
check(!(await p.isVisible('#gotWrap')), 'old save: items already owned do not show the big card again');
await G((G) => { void G.understood('C'); });
await p.waitForTimeout(500);
check(!(await p.isVisible('#gotWrap')), 'old save: elements already understood do not show it again');
const keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('element118.')));
check(keys.length === 0, 'no storage keys outside element118.*');
console.log(errs.length ? errs : 'no errors');
await b.close();
process.exit(fails || errs.length ? 1 : 0);
