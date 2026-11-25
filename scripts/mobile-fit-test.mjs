import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:4173/element118/'); await p.waitForTimeout(1500);
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height, vw: innerWidth, vh: innerHeight }; });
console.log('canvas', JSON.stringify(r), r.x >= 0 && r.y >= 0 && r.x + r.w <= r.vw + 0.5 && r.y + r.h <= r.vh + 0.5 ? 'FITS' : 'OVERFLOW');
// double-tap quickly on the canvas: page zoom must stay 1
await p.touchscreen.tap(400, 200); await p.waitForTimeout(80); await p.touchscreen.tap(400, 200); await p.waitForTimeout(400);
console.log('zoom', await p.evaluate(() => window.visualViewport?.scale));
await p.screenshot({ path: 'test-output/mobile-fit.png' });
console.log(errs.length ? errs : 'no errors'); await b.close();
