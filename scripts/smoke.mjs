// Headless smoke test: plays through stage 1 with a mix of real input and state shortcuts,
// takes screenshots, and fails on any console error.
// usage: node scripts/smoke.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/element118/';
const out = 'test-output';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

// a foreign key that must survive (stands in for Rain's save)
await page.goto(base + '?touch=1');
await page.evaluate(() => localStorage.setItem('rain.save', 'DO-NOT-TOUCH'));
await page.reload();

const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
const active = () => G(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
async function tapCanvas(x, y) { await page.mouse.click(x, y); }
async function advanceDialogue(max = 120) {
  let idle = 0;
  for (let i = 0; i < max; i++) {
    const st = await G(() => {
      const ui = window.__game.scene.getScene('UI');
      const w = window.__game.scene.getScene('World');
      return { d: !!(ui && ui.dlg && ui.dlg.visible), b: !!(w && w.busy) };
    });
    if (st.d) { idle = 0; await page.keyboard.press('Space'); await wait(70); }
    else if (st.b) { idle = 0; await wait(200); }
    else { idle++; if (idle >= 4) return; await wait(150); }
  }
}
async function openBond(label) {
  await page.keyboard.press('KeyU');
  for (let i = 0; i < 20; i++) {
    await wait(100);
    if ((await active()).includes('BondPanel')) return;
  }
  const st = await G(() => { const w = window.__game.scene.getScene('World'); const u = window.__game.scene.getScene('UI'); return { busy: w.busy, dlg: u.dlg.visible, scenes: window.__game.scene.getScenes(true).map((s) => s.scene.key), flags: w && JSON.stringify(Object.keys(window.__game.scene.getScene('World').sys.game ? {} : {})) }; });
  throw new Error('BondPanel did not open at ' + label + ' ' + JSON.stringify(st) + ' errors: ' + errors.join(' | '));
}
async function hold(key, ms) { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); }

await wait(1500);
await shot('01-title');
await tapCanvas(840, 470); // はじめる
await wait(1200);
await shot('02-intro');
await advanceDialogue();
await wait(400);
await shot('03-village');

// walk east a bit with the keyboard
await hold('KeyD', 600);
await hold('KeyS', 200);
await shot('04-walk');

// teleport near the elder and talk
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(35 * 16 + 8, 87 * 16 + 4); w.player.facing = 6; });
await wait(200);
await page.keyboard.press('KeyJ');
await wait(400);
if (!(await G(() => window.__game.scene.getScene('UI').dlg.visible))) { console.log('note: elder talk via direct call'); await G(() => window.__game.scene.getScene('World').talkTo('elder')); await wait(300); }
await shot('05-elder');
await advanceDialogue(60);
await wait(2000);
await advanceDialogue(60);
await shot('06-after-elder');

// grassland combat: go fight
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 70 * 16); });
await wait(300);
for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await wait(250); }
await shot('07-combat');
// force-clear the three grassland enemies
await G(() => { const w = window.__game.scene.getScene('World'); for (const e of w.enemies.filter((e) => ['b1','b2','b3'].includes(e.id) && !e.dead)) w.killEnemy(e); });
await wait(2200);
await advanceDialogue();

// river: meet Hyde, pick up H
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(28 * 16 + 8, 60 * 16); });
await wait(600);
await shot('08-hyde');
await advanceDialogue(40);
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(15 * 16 + 8, 57 * 16 + 8); });
await wait(500);
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(18 * 16 + 8, 56 * 16 + 8); });
await wait(3200);
await shot('09-h-found');

// open BOND: H+H -> H2
await openBond('H2');
await shot('10-bond-panel');
const bp = () => window.__game.scene.getScene('BondPanel');
await G(() => { const p = window.__game.scene.getScene('BondPanel'); p.addToSlot('H'); p.addToSlot('H'); });
await wait(200);
await shot('11-bond-hh');
await G(() => window.__game.scene.getScene('BondPanel').tryBond());
await wait(2600);
await shot('12-h2-ceremony');
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await wait(900); }
await shot('13-h2-info');
await page.keyboard.press('Space');
await wait(800);
await shot('14-back-to-panel');
await G(() => window.__game.scene.getScene('BondPanel').close());
await wait(300);

// device: fill with H2 and ride up
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 43 * 16); w.player.facing = 6; });
await wait(200);
await page.keyboard.press('KeyJ');
await wait(500);
await advanceDialogue();
await wait(2500);
await shot('15-device-top');
await advanceDialogue();

// plateau: meet Oxy, get O
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(28 * 16 + 8, 30 * 16); });
await wait(600);
await advanceDialogue(40);
await G(() => { const s = window.__game.scene.getScene('World'); s.player.setPosition(18 * 16 + 8, 27 * 16 + 8); });
await wait(400);
await G(() => { const s = window.__game.scene.getScene('World'); s.player.setPosition(20 * 16 + 8, 29 * 16 + 8); });
await wait(400);
await G(() => { const s = window.__game.scene.getScene('World'); s.player.setPosition(37 * 16 + 8, 30 * 16 + 8); });
await wait(3000);
await shot('16-o-found');

// O+O -> O2, then torch
await advanceDialogue();
await openBond('O2');
await G(() => { const p = window.__game.scene.getScene('BondPanel'); p.addToSlot('O'); p.addToSlot('O'); p.tryBond(); });
await wait(2600);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await wait(700); }
await G(() => window.__game.scene.getScene('BondPanel').close());
await wait(300);
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(21 * 16 + 4, 21 * 16 + 4); w.player.facing = 4; });
await wait(200);
await page.keyboard.press('KeyJ');
await wait(400);
await advanceDialogue();
await wait(3500);
await shot('17-bramble-burn');
await advanceDialogue(30);
await wait(400);

// fire road: H+O failure, then H+H+O
await G(() => { const s = window.__game.state; });
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 15 * 16); });
await wait(600);
await shot('18-fire');
await advanceDialogue(30);
// make sure enough atoms
await advanceDialogue();
for (const [x, y] of [[20, 16], [21, 14], [28, 16]]) {
  await G(([x, y]) => { const w = window.__game.scene.getScene('World'); w.player.setPosition(x * 16 + 8, y * 16 + 8); }, [x, y]);
  await wait(350);
}
await wait(9500);
for (const [x, y] of [[20, 16], [21, 14]]) {
  await G(([x, y]) => { const w = window.__game.scene.getScene('World'); w.player.setPosition(x * 16 + 8, y * 16 + 8); }, [x, y]);
  await wait(350);
}
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 15 * 16); });
await advanceDialogue();
await openBond('H2O');
await G(() => { const p = window.__game.scene.getScene('BondPanel'); p.addToSlot('H'); p.addToSlot('O'); });
await wait(200);
await shot('19-ho-preview');
await G(() => window.__game.scene.getScene('BondPanel').tryBond());
await wait(500);
await shot('20-ho-fail');
await G(() => { const p = window.__game.scene.getScene('BondPanel'); p.clearSlots(); p.addToSlot('H'); p.addToSlot('H'); p.addToSlot('O'); });
await wait(200);
await shot('21-hho-preview');
await G(() => window.__game.scene.getScene('BondPanel').tryBond());
await wait(1500);
await shot('22-h2o-bonding');
await wait(1800);
await shot('23-h2o-flash');
const names = ['24-h2o-name', '25-h2o-structure', '26-h2o-compare', '27-h2o-codex', '28-h2o-ability'];
for (const n of names) { await page.keyboard.press('Space'); await wait(1600); await shot(n); }
await page.keyboard.press('Space');
await wait(1200);
await advanceDialogue(30);
await shot('29-after-water');

// throw water at the fire
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 14 * 16 + 4); w.player.facing = 6; });
await wait(200);
await page.keyboard.press('KeyI');
await wait(600);
await shot('30-water-hit');
await wait(1200);
await advanceDialogue(30);
await shot('31-fire-out');

// codex
await page.keyboard.press('KeyC');
await wait(500);
await shot('32-codex-table');
await advanceDialogue();
if (!(await active()).includes('Codex')) { await page.keyboard.press('KeyC'); await wait(500); }
await G(() => { const c = window.__game.scene.getScene('Codex'); c.show('substances'); });
await wait(300);
await shot('33-codex-substances');
await G(() => { const c = window.__game.scene.getScene('Codex'); c.show('kinds'); });
await wait(300);
await shot('34-codex-kinds');
await G(() => window.__game.scene.getScene('Codex').close());
await wait(300);

// goal
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 6 * 16); });
await wait(300);
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 4 * 16 + 12); });
await wait(700);
await advanceDialogue(30);
await wait(800);
await shot('35-stage-clear');

// save state + storage isolation
const storageReport = await G(() => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  const save = JSON.parse(localStorage.getItem('element118.save.slot1') || 'null');
  return { keys, rain: localStorage.getItem('rain.save'), flags: save && save.flags, discovered: save && save.discovered, substances: save && save.substances };
});
console.log('storage:', JSON.stringify(storageReport, null, 1));
console.log('active scenes:', await active());

// reload → continue
await page.reload();
await wait(1500);
await shot('36-title-continue');
await tapCanvas(840, 470); // つづきから
await wait(1500);
await shot('37-continued');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
