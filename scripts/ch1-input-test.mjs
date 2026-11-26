// Controls test for chapter 1: one InputManager for touch / keyboard+mouse / gamepad.
// - touch: left stick moves while the right stick turns the camera (two fingers at once)
// - movement is camera relative; Carbon turns toward where he moves
// - camera: free 360° yaw, clamped pitch, keeps its angle when released, no auto-follow
// - dead zones; gamepad via a simulated Web Gamepad (Nintendo Pro Controller id) mapped to Actions
// - last input device switches the on-screen controls; camera never inside walls/ceilings
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok' : 'FAIL'} ${m}`); if (!c) fails++; };
const errs = [];

// ───────── phone ─────────
{
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:4173/element118/chapter1/?skip');
  await p.evaluate(() => localStorage.removeItem('element118.ch1.save'));
  await p.waitForTimeout(2500);
  await p.touchscreen.tap(422, 200).catch(() => {});
  await p.evaluate(() => document.getElementById('bNew').click());
  await p.waitForTimeout(2000);
  const G = (fn, a) => p.evaluate((x) => (new Function('G', 'a', `return (${x.fn})(G, a)`))(window.__ch1, x.a), { fn: fn.toString(), a });
  // two fingers in one event: left = move, right = camera
  const touches = (type, list, changed) => p.evaluate(([type, list, changed]) => {
    const el = document.querySelector('#view canvas');
    const mk = ([id, x, y]) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent(type, { touches: list.map(mk), changedTouches: changed.map(mk), bubbles: true, cancelable: true }));
  }, [type, list, changed]);
  console.log('phone: two thumbs at once');
  await G((G) => { G.player.teleport(0, 70); G.cam.setView(0, 0.25); });
  await p.waitForTimeout(500);
  check(await p.evaluate(() => document.body.classList.contains('input-touch')), 'touch UI is active');
  const a0 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.cam.yaw }));
  await touches('touchstart', [[1, 150, 260], [2, 640, 220]], [[1, 150, 260], [2, 640, 220]]);
  await touches('touchmove', [[1, 150, 200], [2, 700, 220]], [[1, 150, 200], [2, 700, 220]]);
  await p.waitForTimeout(1600);
  const a1 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.cam.yaw }));
  check(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 1, `left thumb moved Carbon (${Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(1)} m)`);
  check(Math.abs(a1.yaw - a0.yaw) > 0.4, `right thumb turned the camera at the same time (Δyaw ${(a1.yaw - a0.yaw).toFixed(2)})`);
  check(await p.evaluate(() => getComputedStyle(document.getElementById('camKnob')).display !== 'none'), 'camera stick is drawn under the right thumb');
  await touches('touchend', [[1, 150, 200]], [[2, 700, 220]]);
  const yawRel = await G((G) => G.cam.yaw);
  await p.waitForTimeout(1200);
  check(Math.abs((await G((G) => G.cam.yaw)) - yawRel) < 0.05, 'releasing the right thumb keeps the camera angle (no auto-follow)');
  await touches('touchend', [], [[1, 150, 200]]);
  // pitch is clamped
  await touches('touchstart', [[3, 640, 200]], [[3, 640, 200]]);
  await touches('touchmove', [[3, 640, 120]], [[3, 640, 120]]);
  await p.waitForTimeout(2500);
  await touches('touchend', [], [[3, 640, 120]]);
  const pitch = await G((G) => G.cam.pitch);
  check(pitch >= -0.46 && pitch <= 1.26, `pitch stays inside its limits (${pitch.toFixed(2)})`);
  // camera-relative: camera looking south (+z) → stick up moves Carbon +z
  await G((G) => { G.player.teleport(0, 70); G.cam.setView(Math.PI, 0.25); });
  await p.waitForTimeout(400);
  const s0 = await G((G) => G.player.pos.z);
  await touches('touchstart', [[4, 150, 260]], [[4, 150, 260]]);
  await touches('touchmove', [[4, 150, 205]], [[4, 150, 205]]);
  await p.waitForTimeout(1200);
  await touches('touchend', [], [[4, 150, 205]]);
  const s1 = await G((G) => ({ z: G.player.pos.z, f: G.player.facing }));
  check(s1.z > s0 + 0.8, `camera turned around → stick up runs into the screen (+z, ${(s1.z - s0).toFixed(1)} m)`);
  check(Math.abs(Math.atan2(Math.sin(s1.f), Math.cos(s1.f))) < 0.6, 'Carbon turned to face where he runs');
  // dead zone: a tiny drag does nothing
  await p.waitForTimeout(1200); // let him come to a stop first
  const d0 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z }));
  await touches('touchstart', [[5, 150, 260]], [[5, 150, 260]]);
  await touches('touchmove', [[5, 153, 258]], [[5, 153, 258]]);
  await p.waitForTimeout(900);
  await touches('touchend', [], [[5, 153, 258]]);
  const d1 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z }));
  check(Math.hypot(d1.x - d0.x, d1.z - d0.z) < 0.1, 'touch dead zone: a tiny movement of the thumb does not walk');
  await p.screenshot({ path: 'test-output/ch1-touch-sticks.png' });
  await ctx.close();
}

// ───────── desktop + gamepad ─────────
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  // a simulated controller (the page reads it through navigator.getGamepads like a real one)
  await p.addInitScript(() => {
    const pad = { id: 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__pad = pad;
    window.__padOn = false;
    navigator.getGamepads = () => [window.__padOn ? pad : null, null, null, null];
  });
  await p.goto('http://localhost:4173/element118/chapter1/?skip');
  await p.evaluate(() => localStorage.removeItem('element118.ch1.save'));
  await p.waitForTimeout(2500);
  await p.click('#bNew');
  await p.waitForTimeout(2000);
  const G = (fn, a) => p.evaluate((x) => (new Function('G', 'a', `return (${x.fn})(G, a)`))(window.__ch1, x.a), { fn: fn.toString(), a });
  console.log('keyboard + mouse');
  check(await p.evaluate(() => document.body.classList.contains('input-keyboard')), 'keyboard UI on desktop');
  await G((G) => { G.player.teleport(0, 70); G.cam.setView(Math.PI / 2, 0.25); });
  await p.waitForTimeout(300);
  const k0 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z }));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  const k1 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z }));
  check(k1.x < k0.x - 0.8, `camera facing west → W walks west (Δx ${(k1.x - k0.x).toFixed(1)})`);
  const y0 = await G((G) => G.cam.yaw);
  await p.mouse.move(640, 400); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(640 + i * 25, 400);
  await p.mouse.up();
  await p.waitForTimeout(300);
  check(Math.abs((await G((G) => G.cam.yaw)) - y0) > 0.3, 'mouse drag turns the camera');

  console.log('gamepad (Web Gamepad API)');
  await p.evaluate(() => { window.__padOn = true; const e = new Event('gamepadconnected'); Object.defineProperty(e, 'gamepad', { value: window.__pad }); window.dispatchEvent(e); });
  await p.waitForTimeout(400);
  check((await p.textContent('#toast')).includes('GAMEPAD CONNECTED'), '"GAMEPAD CONNECTED" shown');
  const setPad = (axes, btn = {}) => p.evaluate(([axes, btn]) => { const pad = window.__pad; pad.axes = axes; pad.buttons.forEach((b, i) => { b.pressed = !!btn[i]; b.value = btn[i] ? 1 : 0; }); pad.timestamp++; }, [axes, btn]);
  const press = async (i) => { await setPad([0, 0, 0, 0], { [i]: true }); await p.waitForTimeout(500); await setPad([0, 0, 0, 0]); await p.waitForTimeout(400); };
  // dead zone: a stick resting slightly off-centre does nothing
  await G((G) => { G.player.teleport(0, 70); G.cam.setView(0, 0.25); });
  const g0 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.cam.yaw }));
  await setPad([0.12, -0.1, 0.1, 0.12]);
  await p.waitForTimeout(1200);
  const g1 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.cam.yaw }));
  check(Math.hypot(g1.x - g0.x, g1.z - g0.z) < 0.05 && Math.abs(g1.yaw - g0.yaw) < 0.01, 'dead zone: resting sticks neither walk nor turn the camera');
  // left stick + right stick together
  await setPad([0, -1, 0.9, 0]);
  await p.waitForTimeout(1500);
  await setPad([0, 0, 0, 0]);
  const g2 = await G((G) => ({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.cam.yaw }));
  check(Math.hypot(g2.x - g1.x, g2.z - g1.z) > 1, 'left stick walks');
  check(Math.abs(g2.yaw - g1.yaw) > 0.4, 'right stick turns the camera');
  check(await p.evaluate(() => document.body.classList.contains('input-gamepad')), 'on-screen hints switched to the gamepad');
  const help = await p.textContent('#padHelp');
  check(/しらべるA/.test(help) && /ジャンプB/.test(help) && /BONDX/.test(help) && /BREAKY/.test(help), `Nintendo labels in the hints (${help.replace(/\s+/g, ' ').slice(0, 60)}…)`);
  // B jumps
  const jy0 = await G((G) => G.player.pos.y);
  await setPad([0, 0, 0, 0], { 0: true });
  let jy = jy0;
  for (let i = 0; i < 10; i++) { jy = Math.max(jy, await G((G) => G.player.pos.y)); await p.waitForTimeout(80); }
  await setPad([0, 0, 0, 0]);
  check(jy > jy0 + 0.3, 'B (bottom) jumps');
  // A talks to a worker
  await G((G) => { G.player.teleport(12.6, 108.2); });
  await p.waitForTimeout(500);
  await press(1);
  check(await p.isVisible('#say'), 'A (right) = interact: talks to the worker');
  for (let i = 0; i < 4 && (await p.isVisible('#say')); i++) await press(1);
  check(!(await p.isVisible('#say')), 'A advances the dialogue');
  // X = BOND, Y = BREAK (with Silica)
  await G((G) => { const S = G.S; S.flags.silica_met = true; S.k.bond = true; S.k.breakSkill = true; S.partner = 'follow'; G.silica.root.visible = true; G.silica.root.position.copy(G.player.pos).add({ x: 1.2, y: 0, z: 0 }); });
  await p.waitForTimeout(300);
  await press(3);
  await p.waitForTimeout(2500);
  check((await G((G) => G.S.form)) === 'sic', 'X (top) = BOND');
  await press(2);
  await p.waitForTimeout(2200);
  check((await G((G) => G.S.form)) === 'normal', 'Y (left) = BREAK');
  // − = codex (map), + = menu
  await G((G) => { G.S.k.scan = true; });
  await press(8);
  check(await p.isVisible('#codexWrap'), '− opens the codex');
  await press(8);
  check(!(await p.isVisible('#codexWrap')), '− closes it again');
  await press(9);
  check(await p.isVisible('#settingsWrap') || await p.isVisible('#bagWrap'), '＋ opens the menu');
  await press(9);
  // keyboard Q still does BOND / BREAK
  await G((G) => { G.silica.root.position.copy(G.player.pos).add({ x: 1.2, y: 0, z: 0 }); });
  await p.keyboard.press('KeyQ');
  await p.waitForTimeout(2500);
  check((await G((G) => G.S.form)) === 'sic', 'keyboard Q still does BOND');
  await p.keyboard.press('KeyQ');
  await p.waitForTimeout(2200);
  check((await G((G) => G.S.form)) === 'normal', 'and BREAK');
  // the last device decides the hints: a key press switches back
  await p.keyboard.press('KeyW');
  await p.waitForTimeout(300);
  check(await p.evaluate(() => document.body.classList.contains('input-keyboard')), 'pressing a key switches the hints back to keyboard');
  await p.screenshot({ path: 'test-output/ch1-gamepad.png' });

  console.log('camera and walls');
  // in the tunnel to the river, turn the camera into the tunnel wall
  await G((G) => { G.player.teleport(-49, 2); G.cam.setView(Math.atan2(0.68, -0.73), 0.15); }); // camera pushed into the side wall
  await p.waitForTimeout(1500);
  const w = await G((G) => { const c = G.cam.cam.position; return { d: G.cam.distance, y: c.y, floor: G.heightAt(c.x, c.z), ceil: G.ceilAt(c.x, c.z) }; });
  check(w.d < 4, `wall behind → camera pulled in toward Carbon (${w.d.toFixed(2)} m)`);
  check(w.y > w.floor && w.y < w.ceil, 'camera stays inside open space (not in rock, not above the ceiling)');
  // turn along the tunnel: it eases back out, not in one jump
  await G((G) => G.cam.setView(Math.atan2(0.73, 0.68), 0.15)); // along the tunnel
  await p.waitForTimeout(260);
  const back1 = await G((G) => G.cam.distance);
  await p.waitForTimeout(2500);
  const back2 = await G((G) => G.cam.distance);
  check(back2 > back1 && back2 > w.d, `clear again → eases back out (${w.d.toFixed(1)} → ${back1.toFixed(1)} → ${back2.toFixed(1)} m)`);
  // a big blue root between Carbon and the camera also pulls it in
  await G((G) => { G.player.teleport(36.5, 3.5); G.cam.setView(Math.atan2(41 - 36.5, 5 - 3.5), 0.2); });
  await p.waitForTimeout(1500);
  check((await G((G) => G.cam.distance)) < 4, 'the blue root counts as an obstacle for the camera');
  await p.close();
}
console.log(errs.length ? errs : 'no errors');
await b.close();
process.exit(fails || errs.length ? 1 : 0);
