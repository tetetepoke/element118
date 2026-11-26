import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://localhost:4173/element118/chapter1/?skip&debug');
await p.evaluate(() => localStorage.removeItem('element118.ch1.save'));
await p.waitForTimeout(2500);
await p.evaluate(() => document.getElementById('bNew').click());
await p.waitForTimeout(3000);
const views = [['b', 17, 105, 0.9, 0.1], ['c', 20, 108, -2.2, 0.12]];
for (const [n, x, z, yaw, pitch] of views) {
  await p.evaluate(([x, z, yaw, pitch]) => { const G = window.__ch1; G.player.teleport(x, z); G.player.facing = yaw + Math.PI; G.cam.setView(yaw, pitch); }, [x, z, yaw, pitch]);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `/tmp/dump-${n}.png` });
  console.log(n, JSON.stringify(await p.evaluate(() => window.__ch1.renderInfo)));
}
// dialogue look
await p.evaluate(() => { window.__ch1.player.teleport(12.6, 108.2); window.__ch1.cam.setView(0.9, 0.1); });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__ch1.onAction());
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/dump-talk.png' });
console.log(await p.evaluate(() => document.getElementById('debug').textContent));
await b.close();
