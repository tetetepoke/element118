// Quick look at the 3D prototype (screenshots only): field views, Carbon from the front,
// the BOND sequence frame by frame, SiC FORM, and BREAK.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('test-output', { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4173/element118/3d/?debug');
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('element118.3d.')) localStorage.removeItem(k); });
await p.goto('http://localhost:4173/element118/3d/?debug');
await p.waitForTimeout(4000);
await p.evaluate(() => { document.getElementById('msg').style.display = 'none'; });
const P = (fn, a) => p.evaluate((x) => (new Function('P', 'a', 'return (' + x.fn + ')(P, a)'))(window.__proto3d, x.a), { fn: fn.toString(), a });
const shot = async (name, ms = 1200) => { await p.waitForTimeout(ms); await p.evaluate(() => { document.getElementById('msg').style.display = 'none'; document.getElementById('banner').style.display = 'none'; }); await p.screenshot({ path: `test-output/${name}.png` }); };
const view = (x, z, yaw, pitch = 0.25, facing) => P((P, a) => { P.player.teleport(a.x, a.z); if (a.facing !== undefined) P.player.facing = a.facing; P.cam.setView(a.yaw, a.pitch); }, { x, z, yaw, pitch, facing });

await shot('3d-start', 300);
// Carbon from the front (camera north of him, looking south): mask, C/6, crystal
await view(0, 60, 0, 0.12, 0);
await shot('3d-carbon-front');
await view(-30, 20, 0.3, 0.3);
await shot('3d-pond-stream');
await view(20, 8, -0.8, 0.22);
await shot('3d-shelves');
await view(-45, -18, 0, 0.3);
await shot('3d-ruins');

// BOND sequence, camera in front of Carbon with Silica beside him; the loop is paused and the
// effect stepped by hand so each frame is captured exactly
const F = Math.PI / 2 + 0.4;
await P((P, F) => { P.player.teleport(3.2, -9.2); P.player.facing = F; P.player.visual.root.rotation.y = F; P.cam.setView(F + 0.8, 0.12); }, F);
await p.waitForTimeout(1500);
await p.evaluate(() => { document.getElementById('msg').style.display = 'none'; document.getElementById('banner').style.display = 'none'; });
await p.screenshot({ path: 'test-output/3d-bond-0.png' });
await P((P) => { P.dbg.paused = true; P.doBond(); });
const bondTimes = [0.1, 0.35, 0.6, 0.85, 1.1, 1.35, 1.7];
let tt = 0;
for (let i = 0; i < bondTimes.length; i++) {
  await P((P, d) => { for (let k = 0; k < 6; k++) P.stepFx(d / 6); }, bondTimes[i] - tt);
  tt = bondTimes[i];
  await p.screenshot({ path: `test-output/3d-bond-${i + 1}.png` });
}
await P((P) => { P.fx.finish(); P.dbg.paused = false; });
await shot('3d-sic-front', 1500);
await P((P) => { P.dbg.paused = true; P.doBreak(); });
tt = 0;
for (const [i, at] of [0.3, 0.55, 0.8].entries()) {
  await P((P, d) => { for (let k = 0; k < 6; k++) P.stepFx(d / 6); }, at - tt);
  tt = at;
  await p.screenshot({ path: `test-output/3d-break-${i + 1}.png` });
}
await P((P) => { P.fx.finish(); P.dbg.paused = false; });
await shot('3d-break-done', 800);
console.log(errs.length ? errs : 'no errors', await p.evaluate(() => document.getElementById('debug').textContent));
await b.close();
