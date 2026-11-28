// Chapter 1 playthrough test. Walks the whole chapter with the real movement code (stepped
// deterministically, because headless Chrome only draws ~4 fps), checks every story point,
// several alternative routes, return visits, save/continue, and that other save keys are untouched.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('test-output', { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4173/element118/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage(process.env.SKIP_SCREENSHOTS
  ? { viewport: { width: 800, height: 500 }, deviceScaleFactor: 0.65 }
  : { viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const shot = (n) => process.env.SKIP_SCREENSHOTS ? Promise.resolve() : page.screenshot({ path: `test-output/ch1-${n}.png` });

// other games' saves must survive
await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('element118.save', '{"probe":2}'); localStorage.setItem('element118.3d.state', '{"probe":3}'); localStorage.removeItem('element118.ch1.save'); });
await page.goto(BASE + 'chapter1/?auto&debug');
await page.waitForTimeout(2500);
await page.click('#bNew');

const G = (fn, a) => page.evaluate(async (x) => await (new Function('G', 'a', `return (async () => (${x.fn})(G, a))()`))(window.__ch1, x.a), { fn: fn.toString(), a });
const waitFor = async (fn, ms = 30000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await G(fn, a)) return true; await page.waitForTimeout(200); } return false; };
const idle = () => waitFor((G) => !G.cutscene && !G.fx.active && !G.ui.sayOpen && !G.gotIsOpen());
const closePanels = () => page.evaluate(() => ['scanWrap', 'bagWrap', 'codexWrap'].forEach((id) => (document.getElementById(id).style.display = 'none')));

// walk through points with the real controller; jumps now and then (to mantle ledges)
const walk = (pts, o = {}) => G(async (G, a) => {
  const pl = G.player;
  const V = pl.pos.constructor;
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false };
  let n = 0;
  for (const [x, z] of a.pts) {
    let tries = 0;
    while (tries++ < (a.o.max ?? 2400)) {
      while (G.cutscene || G.fx.active || G.ui.sayOpen) await new Promise((r) => setTimeout(r, 50));
      const dx = x - pl.pos.x, dz = z - pl.pos.z, l = Math.hypot(dx, dz);
      if (l < (a.o.tol ?? 0.9)) break;
      inp.run = l > 3 && !a.o.walk;
      inp.jump = !!a.o.jump && tries % 18 === 0;
      pl.update(1 / 30, inp, new V(dx / l, 0, dz / l), new V(-dz / l, 0, dx / l));
      if (++n % 45 === 0) await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }
  const last = a.pts[a.pts.length - 1];
  return { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, d: Math.hypot(last[0] - pl.pos.x, last[1] - pl.pos.z) };
}, { pts, o });
const tp = (x, z) => G((G, a) => G.player.teleport(a.x, a.z), { x, z });
const act = async () => { await G((G) => G.onAction()); await idle(); await closePanels(); };
const S = () => G((G) => ({ flags: G.S.flags, k: G.S.k, inv: G.S.inv, form: G.S.form, partner: G.S.partner, broken: G.S.broken }));

console.log('prologue → awakening');
check(await waitFor((G) => G.S.flags.wake, 60000), 'prologue and awakening play, control starts');
await idle();
await shot('01-wake');
check((await page.textContent('#mission .t')) === 'ここを出る', 'mission: ここを出る');

console.log('everything is UNKNOWN at first');
await tp(5, 107);
await G((G) => G.onAction());
await page.waitForTimeout(300);
check((await page.textContent('#scanPanel h2')) === 'UNKNOWN', 'looking at the puddle before SCAN → UNKNOWN');
await closePanels();
await tp(12.5, 102);
await G((G) => G.onAction());
await page.waitForTimeout(200);
check((await S()).inv.stick === undefined, 'cannot harvest yet (no HARVEST)');
await closePanels();

console.log('leave the dump: climb the junk heap');
const heap = await walk([[16.6, 102], [16.4, 99.6], [17.6, 98.4], [20, 97.6], [20, 94], [20, 80]], { jump: true });
check(heap.z < 90, `climbed the junk heap and went up the tunnel (z=${heap.z.toFixed(1)})`);
await walk([[20, 70]]);
check(await waitFor((G) => G.S.flags.city_seen), 'city reveal from the ledge');
await idle();
await shot('02-city');

console.log('city: "外って何？", the elder, the title');
const cityWalk = await walk([[22, 60], [27, 50], [31, 40], [33, 33], [33, 25], [26, 18], [12, 15]]);
check(cityWalk.d < 2, `walked down the ramp and over the bridge to the plaza (${cityWalk.d.toFixed(1)}m left)`);
check(await waitFor((G) => G.S.flags.city_talk), 'plaza conversation (外？ / 外って何？)');
await idle();
// Go around the vendor and the market stall before approaching the elder.
await walk([[13, 12], [19, 11], [28, 11], [35, 9]], { tol: 0.4 });
await act();
check((await S()).flags.elder, 'elder: 根は、上から来る → MISSION 青い根を追う + title');

console.log('researcher: SCAN → HARVEST → CREATE');
await walk([[29, 5], [14, 2], [3, 1], [-11, 2], [-24, 1.5]], { tol: 0.55 });
await act();
check((await S()).k.scan, 'MATERIAL SCAN unlocked');
for (const [x, z] of [[-20, 9.5], [-30, 11.5], [-27, 0]]) {
  await tp(x, z);
  await G((G) => G.onScan());
  await page.waitForTimeout(150);
  await closePanels();
}
const sc = await S();
check(sc.flags.scan3, `scanned 3 things (${sc.k.scanned.join(', ')})`);
const scanText = await G((G) => { const k = G.S.k; return ['C', 'O', 'Si', 'Fe'].map((s) => `${s}:${k.el[s] ?? 0}`).join(' '); });
check(scanText.includes('C:2') && scanText.includes('Si:1'), `knowledge after SCAN: ${scanText} (Si still "Si ?")`);
await tp(-24, 1.5);
await act();
check((await S()).k.harvest, 'HARVEST unlocked');
await tp(-20, 9.5); await act(); await act();
await tp(-30, 11.5); await act(); await act(); await act();
const inv1 = (await S()).inv;
check(inv1.stick >= 2 && inv1.heavy_stone >= 1 && inv1.sharp_stone >= 1, `harvested from the piles: ${JSON.stringify(inv1)}`);
await tp(-24, 1.5);
await act();
check((await S()).k.create, 'CREATE unlocked');
const tool = await G((G) => { G.makeFromDesign({ handle: 'stick', head: 'heavy_stone', binding: null }); const t = G.tools[0]; return { name: t.name, s: t.stats }; });
check(tool.name.includes('ハンマー') && tool.s.impact > 4, `free craft: stick + heavy stone → ${tool.name} (impact ${tool.s.impact})`);
const spear = await G((G) => { G.makeFromDesign({ handle: 'stick', head: 'sharp_stone', binding: null }); return G.tools[1].name; });
check(spear.includes('槍'), `stick + sharp stone → ${spear}`);
await G((G) => G.equip(G.tools[0]));
await page.click('#bBagTop');
await page.waitForTimeout(300);
await shot('03-bag');
await closePanels();

console.log('to the underground river; cross it (one of several ways)');
const toRiver = await walk([[-40, 14], [-52, 2], [-64, -10], [-74, -16.5]]);
check(toRiver.d < 2, `walked the tunnel west to the river (${toRiver.d.toFixed(1)}m left)`);
await walk([[-80, -18.4]], { tol: 0.5 });
await act();
check((await S()).broken.includes('stalk'), 'knocked the tall fungus down with the hammer (environment changed)');
await page.waitForTimeout(1500);
await shot('04-bridge');
const cross = await walk([[-80, -21], [-80, -28], [-80, -36], [-82, -40]], { walk: true });
check(cross.z < -36, `walked across the fallen stalk (z=${cross.z.toFixed(1)})`);
check((await S()).flags.river_crossed, 'river_crossed');

console.log('fungus forest: the root tangle (hammer is not enough) → the cap route');
await walk([[-84, -40], [-77, -54], [-70, -70], [-50, -86], [-40, -87.4]]);
await G((G) => G.onAction());
await page.waitForTimeout(200);
check(!(await S()).broken.includes('tangle'), 'the hammer cannot break the dead root tangle');
await tp(-60, -89);
const caps = await walk([[-58, -92], [-56.2, -95.6], [-54.6, -99.2], [-53, -102.4], [-50, -104], [-30, -104], [-8, -104]], { jump: true, max: 900 });
check(caps.x > -12 && caps.y > 30, `hopped up the mushroom caps and through the high crack (y=${caps.y.toFixed(1)})`);

console.log('mineral layer: Silica, BOND');
await walk([[8, -102], [12, -101]]);
check(await waitFor((G) => G.S.k.bond && !G.cutscene, 30000), 'met Silica → BOND emerges');
const sb = await S();
check(sb.form === 'sic' && sb.k.el.Si === 2, 'SiC FORM, Si understood');
await shot('05-sic');
await tp(1.6, -85.4);
await G((G) => G.equip(null));
await act();
check(!((await S()).inv.ore >= 1), 'iron ore: strong enough now, but Fe is not understood yet → cannot take it');

console.log('hard wall → old room → BREAK and the two plates');
await walk([[30, -95], [38, -90.6], [43.3, -87.5]]);
await act();
check((await S()).broken.includes('hard_wall'), 'HARD BREAK on the hard rock');
await walk([[50, -82], [60, -76], [66, -73]]);
check(await waitFor((G) => G.S.k.breakSkill && !G.cutscene), 'BREAK unlocked in the old room');
await G((G) => G.onForm());
await idle();
check((await S()).partner === 'follow', 'BREAK → Carbon and Silica separate');
await walk([[62, -74]]);
await G((G) => G.onAction());
check((await S()).partner === 'wait', 'asked Silica to stand on plate A');
await page.waitForTimeout(1500);
await walk([[78.6, -69.2]], { tol: 0.4 });
check(await waitFor((G) => G.S.flags.door_open), 'both plates pressed → the door opens');
await shot('06-plates');
await walk([[63.2, -73.6]], { tol: 0.4 });
await G((G) => G.onAction());
await page.waitForTimeout(300);
check((await S()).partner === 'follow', 'Silica follows again');
await G((G) => G.onForm());
await idle();
check((await S()).form === 'sic', 'BOND again');

console.log('crystal layer: the root goes up');
const toCrys = await walk([[74, -66], [80, -58], [95, -38], [98, -32]]);
check(await waitFor((G) => G.S.flags.reveal && !G.cutscene), `crystal layer revelation (walked to ${toCrys.x.toFixed(0)},${toCrys.z.toFixed(0)})`);
await shot('07-crystal');

console.log('ancient facility → upper gate → ending');
const toGate = await walk([[104, 0], [104, 10], [98, 31], [92, 52], [100, 64], [109, 70], [118, 76], [128, 78]]);
check(toGate.d < 6, `walked up through the facility to the gate (${toGate.d.toFixed(1)}m left)`);
check(await waitFor((G) => G.S.flags.ending, 30000), 'ending at the upper gate');
await waitFor(() => document.getElementById('end').style.display === 'flex', 20000);
await shot('08-end');
check((await page.textContent('#end')).includes('第1章'), 'chapter 1 end card');
const gateOpen = await G((G) => G.world.colliders.list.find((c) => c.id === 'gate_door_l').enabled);
check(gateOpen, 'the gate is still closed (cannot get through yet)');
await page.click('#bCont2');
await idle();

console.log('return visits: places that were closed before');
// understand Fe by scanning the dump's scrap metal and rusty plate, then the ore can be taken
await tp(25, 106); await G((G) => G.onScan()); await closePanels(); await idle();
await tp(33, 106.5); await G((G) => G.onScan()); await closePanels(); await idle();
check((await G((G) => G.S.k.el.Fe)) === 2, 'back in the dump: scrap metal + rusty plate → Fe understood');
// Start at the lower cave mouth, below the ledge above the boulder.
await tp(-12.3, 125.4);
await act();
check((await S()).broken.includes('cave_boulder'), "the dump's hard boulder breaks now (SiC)");
await walk([[-24, 127], [-28.5, 127.2]]);
await act();
check((await S()).flags.fragment, 'found the white fragment (someone fell before)');
await walk([[-33.2, 125.4]], { tol: 0.4 });
await act();
check((await S()).inv.ore >= 1, 'the cave ore can be harvested now (Fe understood + SiC)');
await tp(13, 102.5); await act();
const oreHammer = await G((G) => { G.makeFromDesign({ handle: 'stick', head: 'ore', binding: null }); return G.tools[G.tools.length - 1].stats.impact; });
check(oreHammer >= 8, `stick + iron ore → a much heavier hammer (impact ${oreHammer})`);
await tp(7, -66);
const sh = await walk([[8, -50], [9.4, -33]]);
await act();
check((await S()).broken.includes('city_crack'), `shortcut opened from above (${sh.z.toFixed(1)})`);
const down = await walk([[10, -24], [10, -10]]);
check(down.z > -14, 'walked down the shortcut into the city');

console.log('save / continue');
await G((G) => G.persist());
await page.reload();
await page.waitForTimeout(2500);
check(await page.isVisible('#bCont'), 'つづきから is offered');
await page.click('#bCont');
await page.waitForTimeout(1500);
const re = await S();
check(re.flags.ending && re.form === 'sic' && re.broken.includes('stalk') && re.k.el.Si === 2, 'progress restored after reload');
const others = await page.evaluate(() => [localStorage.getItem('element118.save'), localStorage.getItem('element118.3d.state'), Object.keys(localStorage).filter((k) => k.startsWith('element118.ch1.'))]);
check(others[0] === '{"probe":2}' && others[1] === '{"probe":3}', '2D and 3D-prototype saves untouched');
check(others[2].length === 1, `chapter 1 uses only element118.ch1.* (${others[2]})`);
console.log(errors.length ? errors : 'no errors');
await b.close();
process.exit(fails || errors.length ? 1 : 0);
