// Chapter 2 playthrough test. Walks the chapter with the real movement code (stepped deterministically),
// checks every story point, the furnace chemistry, both BOND partners, the two ways through the bugs,
// the power puzzle, the ending, save/continue, and that other save keys are untouched.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('test-output', { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4173/element118/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const shot = (n) => page.screenshot({ path: `test-output/ch2-${n}.png` });

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('element118.save', '{"probe":2}'); localStorage.setItem('element118.ch1.save', '{"probe":1}'); localStorage.removeItem('element118.ch2.save'); });
await page.goto(BASE + 'chapter2/?auto&debug');
await page.waitForTimeout(2500);
await page.click('#bNew');

const G = (fn, a) => page.evaluate(async (x) => await (new Function('G', 'a', `return (async () => (${x.fn})(G, a))()`))(window.__ch2, x.a), { fn: fn.toString(), a });
const waitFor = async (fn, ms = 30000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await G(fn, a)) return true; await page.waitForTimeout(150); } return false; };
const idle = () => waitFor((G) => !G.cutscene && !G.fx.active && !G.ui.sayOpen && !G.gotIsOpen());
const closePanels = () => page.evaluate(() => ['scanWrap', 'bagWrap', 'codexWrap'].forEach((id) => (document.getElementById(id).style.display = 'none')));
const walk = (pts, o = {}) => G(async (G, a) => {
  const pl = G.player, V = pl.pos.constructor;
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false };
  let n = 0;
  for (const [x, z] of a.pts) {
    let tries = 0;
    while (tries++ < (a.o.max ?? 2400)) {
      while (G.cutscene || G.fx.active || G.ui.sayOpen || G.gotIsOpen()) { if (G.gotIsOpen()) G.dismissGot(); await new Promise((r) => setTimeout(r, 50)); }
      const dx = x - pl.pos.x, dz = z - pl.pos.z, l = Math.hypot(dx, dz);
      if (l < (a.o.tol ?? 0.9)) break;
      inp.run = l > 3 && !a.o.walk;
      inp.jump = !!a.o.jump && tries % 18 === 0;
      pl.update(1 / 30, inp, new V(dx / l, 0, dz / l), new V(-dz / l, 0, dx / l));
      if (++n % 45 === 0) await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }
  const last = a.pts[a.pts.length - 1];
  return { x: +pl.pos.x.toFixed(1), y: +pl.pos.y.toFixed(1), z: +pl.pos.z.toFixed(1), d: Math.hypot(last[0] - pl.pos.x, last[1] - pl.pos.z) };
}, { pts, o });
const tp = (x, z) => G((G, a) => G.player.teleport(a.x, a.z), { x, z });
const dismiss = async () => { for (let i = 0; i < 20; i++) { const open = await G((G) => G.gotIsOpen()); if (!open) break; await G((G) => G.dismissGot()); await page.waitForTimeout(80); } };
const act = async () => { await G((G) => G.onAction()); await page.waitForTimeout(150); await idle(); await dismiss(); await idle(); await closePanels(); };
const pick = async (text) => {
  for (let i = 0; i < 10 && !(await G((G) => G.choiceOpen)); i++) { await dismiss(); await idle(); await G((G) => G.onAction()); await page.waitForTimeout(250); }
  if (!(await G((G) => G.choiceOpen))) console.log('    (no choice panel)', JSON.stringify(await G((G) => ({ busy: G.ui.busy(), say: G.ui.sayOpen, cut: G.cutscene, got: G.gotIsOpen(), p: [G.player.pos.x, G.player.pos.z] }))));
  const ok = await page.evaluate((t) => { const bt = [...document.querySelectorAll('#choicePanel button.opt')].find((x) => x.textContent.includes(t) && !x.disabled); if (bt) { bt.click(); return true; } return false; }, text);
  await page.waitForTimeout(150); await idle(); await dismiss(); await idle(); await closePanels();
  return ok;
};
const S = () => G((G) => ({ flags: G.S.flags, inv: G.S.inv, form: G.S.form, partners: G.S.partners, el: G.S.k.el, gaps: G.S.gaps }));
const mission = () => page.textContent('#mission .t');
const sp = await G((G) => Object.fromEntries(Object.entries(G.spots).map(([k, v]) => [k, [v.x, v.y]])));

console.log('prologue: through the gate');
check(await waitFor((G) => G.S.flags.start, 60000), 'prologue plays, control starts');
await idle();
await shot('01-start');
check((await mission()) === '上へ', 'mission: 上へ');
check((await S()).partners.silica === 'follow', 'Silica is along');

console.log('the lift has no power');
let r = await walk([[6, 93], [14, 91], [19, 90.3]]);
check(r.d < 1.2, `walked into the big shaft (${r.x}, ${r.z})`);
await act();
check((await S()).flags.lift_seen, 'lift examined: something does not flow (Cu ?)');
await shot('02-lift');

console.log('the adit → the village');
r = await walk([[8, 92], [0, 85], [0, 72], [0, 58], [0, 44], [0, 34], [0, 24]]);
check(r.d < 1.5, `walked the rails to the village (${r.x}, ${r.y}, ${r.z})`);
await idle();
check((await S()).flags.village, 'arrived at カンテラ村');
await shot('03-village');
r = await walk([[sp.chief[0], sp.chief[1] + 1.8]]);
await act();
check((await S()).flags.chief, 'talked to the chief: the lift ran on copper lines');
r = await walk([[sp.smelter[0] + 1.2, sp.smelter[1] + 1.2]]);
await act();
check((await S()).flags.smelter, 'talked to the smelter: malachite + charcoal');

console.log('charcoal');
r = await walk([[sp.timber2[0] - 1, sp.timber2[1] + 1]]);
await act(); await act();
check(((await S()).inv.stick ?? 0) >= 2, 'took old pit props (sticks)');
r = await walk([[sp.kiln[0] + 1.6, sp.kiln[1] + 1.6]]);
await G((G) => G.onAction()); await page.waitForTimeout(200);
check(await pick('坑木を焼いて'), 'kiln: burn wood into charcoal');
check(((await S()).inv.charcoal ?? 0) >= 2, 'got charcoal');

console.log('malachite (west)');
r = await walk([[-20, 6], [-31, 7], [-38, 3], [-50, 0], [sp.malachite[0] + 1.5, sp.malachite[1]]], { jump: true });
check(r.d < 1.6, `walked to 緑の坑 (${r.x}, ${r.y}, ${r.z})`);
await act();
check(((await S()).inv.malachite ?? 0) >= 1, 'harvested malachite');
await G((G) => G.onScan()); await idle(); await closePanels();

console.log('the furnace: copper and wire');
r = await walk([[-50, 0], [-38, 3], [-31, 7], [sp.furnace[0] + 1.5, sp.furnace[1] + 2.4]]);
await G((G) => G.onAction()); await page.waitForTimeout(200);
check(await pick('銅を取り出す'), 'furnace: smelt copper');
let st = await S();
check(st.flags.copper && (st.inv.copper ?? 0) === 1, 'copper made (malachite + charcoal)');
check(st.el.Cu === 1, 'Cu still only sensed (Cu ?)');
await G((G) => G.onAction()); await page.waitForTimeout(200);
check(await pick('線にする'), 'furnace: draw copper into wire');
check((await S()).inv.copper_wire === 2, 'two copper wires');

console.log('the legend');
r = await walk([[sp.keeper[0] - 1.5, sp.keeper[1] + 1.5]]);
await act();
check((await S()).flags.legend, 'keeper: the copper child sleeps in the deep vein');

console.log('the deep vein: rubble (SiC), bugs, Cupra');
r = await walk([[-20, 6], [-31, 7], [-38, 3], [-56, -8], [-58, -16], [-58.5, -25]], { jump: true });
check(r.d < 1.5, `reached the rubble (${r.x}, ${r.y}, ${r.z})`);
await act();
check(!(await S()).flags.dummy && !(await G((G) => G.world.things.find((t) => t.id === 'rubble').broken)), 'bare hands cannot break the green rubble');
await G((G) => G.silica.root.position.copy(G.player.pos).add({ x: 1, y: 0, z: 1 }));
await G((G) => G.onForm()); await idle();
check((await S()).form === 'sic', 'BOND with Silica: SiC FORM');
await act();
check(await G((G) => G.world.things.find((t) => t.id === 'rubble').broken), 'HARD BREAK smashes the rubble');
r = await walk([[-59.5, -38], [-60, -47], [-62, -56], [sp.geode[0] + 2.4, sp.geode[1] + 2.4]], { jump: true });
check(r.d < 1.6, `walked through the bugs in SiC FORM (${r.x}, ${r.z})`);
await shot('04-deep');
await act();
st = await S();
check(st.flags.cupra && st.el.Cu === 2, 'met キュプラ; Cu understood');
check(st.form === 'cu', 'BOND with Cupra: Cu LINK');
await G((G) => G.onForm()); await idle();
check((await S()).form === 'normal' && (await S()).partners.cupra === 'follow', 'BREAK: Cupra follows');

console.log('the record room: 天晶脈');
await tp(0, -20);
r = await walk([[0, -30], [sp.plate[0], sp.plate[1] + 2.2]]);
await G((G) => { G.cupra.root.position.copy(G.player.pos).add({ x: 1, y: 0, z: 1 }); });
await act();
check((await S()).flags.record, 'Cupra reads the plate: 天晶脈');
await shot('05-record');

console.log('the power station');
await tp(30, 9);
r = await walk([[36, 6], [46, 8], [56, -6], [56, -10], [55, -30], [54, -47], [sp.gapA[0], sp.gapA[1] + 1.5]], { jump: true });
check(r.d < 1.6, `walked via the tin stream to the station (${r.x}, ${r.y}, ${r.z})`);
await G((G) => G.onAction()); await page.waitForTimeout(200);
check(await pick('銅線でつなぐ'), 'west joint: copper wire');
check((await S()).gaps.gapA === 'wire', 'west joint conducts');
r = await walk([[sp.gapB[0], sp.gapB[1] + 1.5]]);
await G((G) => { G.cupra.root.position.copy(G.player.pos).add({ x: 1, y: 0, z: 1 }); });
await G((G) => G.onAction()); await page.waitForTimeout(200);
check(await pick('キュプラ、ここに立って'), 'east joint: Cupra stands in it');
check(await waitFor((G) => G.S.flags.power, 20000), 'power flows: panels → line → lift');
await idle();
await shot('06-power');
check((await S()).partners.cupra === 'follow', 'after power the joint latches; Cupra follows again');

console.log('tin and bronze (optional)');
await tp(60, 9);
await G((G) => { const t = G.world.things.find((k) => k.id === 'tin_b'); G.player.teleport(t.pos.x + 1.2, t.pos.z + 1.2); });
await act(); await act();
check(((await S()).inv.cassiterite ?? 0) >= 2, 'panned heavy black sand (cassiterite)');

console.log('the lift: ending');
await tp(16, 90);
r = await walk([[sp.lift[0] - 3.2, sp.lift[1]]]);
await G((G) => G.onAction());
check(await waitFor(() => document.getElementById('end').style.display === 'flex', 60000), 'ending: the lift climbs the shaft, CHAPTER 2 COMPLETE');
await shot('07-end');
check((await page.textContent('#end')).includes('第2章'), 'end card shows chapter 2');

console.log('save / continue / other keys');
await G((G) => G.persist());
await page.goto(BASE + 'chapter2/?auto&debug');
await page.waitForTimeout(2500);
check(await page.isVisible('#bCont'), 'つづきから is offered');
await page.click('#bCont');
check(await waitFor((G) => G.S.flags.power && G.S.flags.cupra, 20000), 'continue restores progress');
const keys = await page.evaluate(() => ({ a: localStorage.getItem('element118.save'), c: localStorage.getItem('element118.ch1.save') }));
check(keys.a === '{"probe":2}' && keys.c === '{"probe":1}', 'the 2D and chapter-1 saves are untouched');
const ri = await G((G) => G.renderInfo);
check(ri.calls < 900, `draw calls ${ri.calls}`);

check(!errors.length, errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : 'no errors');
await b.close();
console.log(fails ? `${fails} FAILED` : 'chapter 2: all passed');
process.exit(fails ? 1 : 0);
