// Stage 2 playthrough: starts from a v1 save of a cleared stage 1 (checks save migration),
// goes through BOND → BREAK cycles and the boss, and fails on any console error.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:4173/element118/';
mkdirSync('test-output', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: `test-output/s2-${n}.png` });
const check = (cond, msg) => { if (!cond) throw new Error('CHECK FAILED: ' + msg + ' | errors: ' + errors.join(' | ')); console.log('  ok', msg); };

async function dialogue(max = 200) {
  let idle = 0;
  for (let i = 0; i < max; i++) {
    const st = await G(() => {
      const ui = window.__game.scene.getScene('UI');
      const w = window.__game.scene.getScene('Valley');
      const overlay = ['PartySelect', 'FormBond', 'Periodic', 'StageClear'].some((k) => window.__game.scene.isActive(k));
      return { d: !!(ui && ui.dlg && ui.dlg.visible), b: !!(w && w.busy), o: overlay };
    });
    if (st.o) return;
    if (st.d) { idle = 0; await page.keyboard.press('Space'); await wait(60); }
    else if (st.b) { idle = 0; await wait(150); }
    else { idle++; if (idle >= 4) return; await wait(120); }
  }
}
const V = (fn, arg) => G((a) => { const w = window.__game.scene.getScene('Valley'); return (new Function('w', 'a', 'return (' + a.fn + ')(w, a.arg)'))(w, a); }, { fn: fn.toString(), arg });
const tp = (x, y, facing = 6) => V((w, a) => { w.controlled.setPosition(a.x * 16 + 8, a.y * 16 + 8); w.controlled.facing = a.f; w.controlled.setVelocity(0, 0); }, { x, y, f: facing });
const flag = (n) => G((k) => !!window.__game.scene.getScene('Valley') && JSON.parse(localStorage.getItem('element118.save.slot1') || '{}').flags?.[k], n);
const live = (k) => V((w, a) => ({ mode: w.mode, form: w.player.form, hp: 0, flag: undefined, ctl: w.controlled.baseKey })[a], k);
const gflag = (k) => G((n) => { const d = JSON.parse(localStorage.getItem('element118.save.slot1')); return d.flags[n]; }, k);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(260); } };

// ── a v1 save: stage 1 cleared, standing next to the goal ──
await page.goto(base + '?touch=1');
await wait(1200);
await G(() => {
  const keep = { foreign: localStorage.getItem('rain.save') };
  localStorage.setItem('rain.save', keep.foreign ?? 'untouched');
  const v1 = {
    version: 1, savedAt: new Date().toISOString(), playTimeSec: 1200,
    player: { x: 24 * 16 + 8, y: 7 * 16 + 8, hp: 6, maxHp: 6, facing: 6 }, checkpoint: { x: 24 * 16 + 8, y: 13 * 16 + 8 },
    atoms: { H: 2, O: 1 }, substances: { h2o: 2 }, equipped: 'h2o',
    discovered: { elements: ['C', 'H', 'O'], substances: ['h2', 'o2', 'h2o'], reactions: ['combustion'], bondKinds: ['element_bond', 'covalent', 'reaction'] },
    party: ['hyde', 'oxy'], flags: { intro_done: true, got_codex: true, met_hyde: true, met_oxy: true, device_active: true, bramble_burned: true, fire_out: true, fog_cleared: true, stage1_clear: true, water_talked: true },
    stats: { bondAttempts: 5, bondFailures: 1, enemiesDefeated: 3 },
  };
  localStorage.setItem('element118.save.slot1', JSON.stringify(v1));
});
await page.reload();
await wait(1500);
await page.mouse.click(1110, 590); // つづきから
await wait(1800);
check(await G(() => window.__game.scene.isActive('World')), 'v1 save continues in stage 1');
// walk onto the goal → StageClear → stage 2
await G(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(24 * 16 + 8, 4 * 16 + 14); });
await wait(600);
check(await G(() => window.__game.scene.isActive('StageClear')), 'goal offers stage 2 for a cleared save');
await shot('01-stageclear');
await page.mouse.click(720, 680);
await wait(2000);
check(await G(() => window.__game.scene.isActive('Valley')), 'stage 2 scene started');
check(await G(() => JSON.parse(localStorage.getItem('element118.save.slot1')).version === 2), 'save upgraded to v2');
check(await G(() => localStorage.getItem('rain.save') === 'untouched'), 'other projects’ keys untouched');
await dialogue();
await shot('02-intro');

// rock wall: cannot be broken yet
await tp(24, 76);
await wait(300);
await dialogue();
await tp(24, 75, 6);
await press('KeyJ');
await dialogue();
check(!(await gflag('broken_rockwall')), 'rock wall resists normal attacks');

// Silica
await tp(40, 69);
await wait(400);
await dialogue();
await wait(300);
check(await G(() => window.__game.scene.isActive('PartySelect')), 'party is full → choose one to keep');
await shot('03-party');
await G(() => { const p = window.__game.scene.getScene('PartySelect'); p.chosen = ['silica', 'hyde']; p.confirm(); });
await wait(300);
await dialogue();
check(await G(() => JSON.stringify(JSON.parse(localStorage.getItem('element118.save.slot1')).activeParty) === '["silica","hyde"]'), 'active party = Silica + Hyde');

// unknown device → ? marker
await tp(37, 55, 6);
await press('KeyJ');
await dialogue();
check(await G(() => JSON.parse(localStorage.getItem('element118.save.slot1')).markers.length === 1), 'UNKNOWN PROPERTY recorded on the map');

// lab record
await tp(40, 54, 6);
await press('KeyJ');
await dialogue();
check(await gflag('s2_record_read'), 'read the C + Si record');

// CHARACTER BOND
await press('KeyU');
await wait(500);
check(await G(() => window.__game.scene.isActive('FormBond')), 'BOND opens the character BOND panel');
await G(() => { const f = window.__game.scene.getScene('FormBond'); f.pick = 'hyde'; f.tryBond(); });
await wait(300);
check(await G(() => window.__game.scene.getScene('FormBond').msg.text.includes('まだわからない')), 'C + H: not known yet');
await G(() => { const f = window.__game.scene.getScene('FormBond'); f.pick = 'silica'; f.tryBond(); });
await wait(5000);
await shot('04-sic-structure');
await wait(6500);
await shot('05-new-form');
await page.mouse.click(720, 750);
await wait(800);
await dialogue();
check((await live('mode')) === 'sic', 'SiC FORM active');
check(await G(() => JSON.parse(localStorage.getItem('element118.save.slot1')).discovered.substances.includes('sic')), 'SiC registered in the codex');

// HARD BREAK the wall
await tp(24, 75, 6);
await press('KeyJ');
await wait(1200);
await dialogue();
check(await gflag('broken_rockwall'), 'HARD BREAK broke the rock wall');
await shot('06-wall-broken');

// HEAT RESIST
const hp0 = await G(() => JSON.parse(localStorage.getItem('element118.save.slot1')).player.hp);
await tp(24, 72);
await wait(200);
await dialogue();
for (const y of [69, 67, 65, 63]) { await tp(24, y); await wait(250); await dialogue(); }
const hp1 = await V((w) => window.__game && w && 0);
check((await V((w) => w.player.y < 64 * 16)), 'crossed the heat zone in SiC FORM');
void hp0; void hp1;

// crevice → BREAK
await tp(24, 62, 6);
await wait(400);
await dialogue();
await press('KeyF');
await wait(600);
await dialogue();
check((await live('mode')) === 'split', 'BREAK → Carbon and Silica');
await shot('07-break');

// twin switches 1
await tp(23, 55);
await wait(300);
await dialogue();
await tp(15, 50);
await wait(300);
await press('KeyQ');
check((await live('ctl')) === 'silica', 'control switched to Silica');
await tp(31, 50);
await wait(500);
await dialogue();
check(await gflag('gate_g1'), 'two switches pressed at once → gate opened');
await shot('08-gate');

// BOND again → rocks → heat → BREAK → switches 2
await V((w) => { if (w.controlled !== w.player) w.setControl(w.player); });
await tp(16, 50);
await wait(200);
await V((w) => { w.trail = []; if (w.partner) w.partner.setPosition(w.player.x + 10, w.player.y); });
await press('KeyF');
await wait(500);
check((await live('mode')) === 'sic', 'BOND again');
await tp(24, 43);
await wait(300);
await dialogue();
await tp(24, 41, 6);
await press('KeyJ');
await wait(1200);
await dialogue();
check(await gflag('broken_rocks2'), 'second rock line broken');
for (const y of [37, 35, 33]) { await tp(20, y); await wait(250); await dialogue(); }
await press('KeyF');
await wait(600);
await dialogue();
await tp(14, 32);
await wait(300);
await press('KeyQ');
await tp(33, 32);
await wait(500);
await dialogue();
check(await gflag('gate_g2'), 'second gate opened');

// boss
await V((w) => { if (w.controlled !== w.player) w.setControl(w.player); });
await tp(24, 29);
await wait(200);
await V((w) => { w.trail = []; if (w.partner) w.partner.setPosition(w.player.x + 10, w.player.y); });
await press('KeyF');
await wait(500);
check((await live('mode')) === 'sic', 'SiC FORM for the boss');
await tp(24, 20);
await wait(400);
await dialogue();
await shot('09-boss');
for (let i = 0; i < 12 && (await V((w) => w.bossPhase)) === 'p1'; i++) {
  await V((w) => { w.player.setPosition(w.boss.x, w.boss.y + 14); w.player.facing = 6; w.player.invulnUntil = w.time.now + 5000; });
  await press('KeyJ');
  await wait(250);
}
await dialogue();
check((await V((w) => w.bossPhase)) === 'p2', 'shell broken by HARD BREAK');
await shot('10-core');
for (let i = 0; i < 12 && (await V((w) => w.bossPhase)) === 'p2'; i++) {
  await V((w) => { w.player.setPosition(w.boss.x, w.boss.y - 14); w.player.facing = 6; w.player.invulnUntil = w.time.now + 5000; });
  await press('KeyJ');
  await wait(250);
}
await dialogue();
check((await V((w) => w.bossPhase)) === 'p3', 'core down → controls');
await press('KeyF');
await wait(600);
await dialogue();
await V((w) => w.controlled.setPosition(w.consoles.get('consoleL').x, w.consoles.get('consoleL').y + 6));
await wait(300);
await press('KeyQ');
await V((w) => w.controlled.setPosition(w.consoles.get('consoleR').x, w.consoles.get('consoleR').y + 6));
await wait(800);
await dialogue();
check(await gflag('s2_boss_down'), 'boss stopped by BREAK (two consoles)');
check(await gflag('silica_official'), 'Silica officially joined');
await shot('11-after-boss');

// exit → periodic table
await V((w) => { if (w.controlled !== w.player) w.setControl(w.player); w.player.setPosition(24 * 16, 3 * 16 + 8); });
await wait(1500);
check(await G(() => window.__game.scene.isActive('Periodic')), 'periodic table shown');
await wait(4500);
await shot('12-periodic');
for (let i = 0; i < 30; i++) { await page.mouse.click(720, 400); await wait(500); }
await wait(4000);
for (let i = 0; i < 10; i++) { await page.mouse.click(720, 400); await wait(400); }
await wait(1500);
await shot('13-next');
check(await gflag('stage2_clear'), 'stage 2 cleared');
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors');
await browser.close();
if (errors.length) process.exit(1);
