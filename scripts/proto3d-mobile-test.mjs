// 3D prototype on a phone-sized landscape touch screen: buttons shown, left stick moves, JUMP jumps, right swipe turns the camera.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4173/element118/3d/'); await p.waitForTimeout(3500);
const check = (c, m) => { if (!c) { console.log('FAIL', m, errs); process.exit(1); } console.log('  ok', m); };
check(await p.evaluate(() => getComputedStyle(document.getElementById('bJump')).display !== 'none'), 'touch buttons shown');
const touch = (type, id, x, y) => p.evaluate(([type, id, x, y]) => {
  const el = document.getElementById('view');
  const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
  el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
}, [type, id, x, y]);
const pos = () => p.evaluate(() => { const pl = window.__proto3d.player; return { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z }; });
const a = await pos();
await touch('touchstart', 1, 150, 260); await touch('touchmove', 1, 150, 190);
await p.waitForTimeout(1500);
await touch('touchend', 1, 150, 190);
const b2 = await pos();
check(b2.z < a.z - 1, 'left stick moves Carbon forward');
const yaw0 = await p.evaluate(() => window.__proto3d.cam.yaw);
await touch('touchstart', 2, 600, 200); for (let i = 1; i <= 6; i++) await touch('touchmove', 2, 600 + i * 25, 200); await touch('touchend', 2, 750, 200);
check(Math.abs((await p.evaluate(() => window.__proto3d.cam.yaw)) - yaw0) > 0.3, 'right swipe turns the camera');
const y0 = (await pos()).y;
const jb = await p.evaluate(() => { const r = document.getElementById('bJump').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.touchscreen.tap(jb[0], jb[1]);
let ym = y0; for (let i = 0; i < 12; i++) { ym = Math.max(ym, (await pos()).y); await p.waitForTimeout(60); }
check(ym > y0 + 0.3, 'JUMP button jumps');
const fit = await p.evaluate(() => { const c = document.querySelector('#view canvas').getBoundingClientRect(); return c.width <= innerWidth + 1 && c.height <= innerHeight + 1; });
check(fit, 'canvas fits the screen');
await p.screenshot({ path: 'test-output/3d-mobile.png' });
console.log(errs.length ? errs : 'no errors');
await b.close();
