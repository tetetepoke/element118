// Quick look at the 3D prototype (screenshots only).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4173/element118/3d/?debug'); await p.waitForTimeout(4000);
await p.screenshot({ path: 'test-output/3d-start.png' });
const P = (fn, a) => p.evaluate((x) => (new Function('P', 'a', 'return (' + x.fn + ')(P, a)'))(window.__proto3d, x.a), { fn: fn.toString(), a });
await P((P) => { P.player.teleport(4, -2); P.cam.yaw = 0; });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'test-output/3d-silica.png' });
await P((P) => { P.player.teleport(12, -14); P.cam.yaw = -0.6; P.cam.pitch = 0.25; });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'test-output/3d-rock.png' });
await P((P) => { P.player.teleport(-45, -24); P.cam.yaw = 0; P.cam.pitch = 0.35; });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'test-output/3d-ruins.png' });
console.log(errs.length ? errs : 'no errors', await p.evaluate(() => document.getElementById('debug').textContent));
await b.close();
