// Chapter 1 on a phone-sized landscape touch screen: start by tapping, dialogue advances by tap,
// touch buttons appear, the left stick moves Carbon, JUMP jumps, SCAN appears once unlocked.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
let fails = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok' : 'FAIL'} ${m}`); if (!c) fails++; };
await p.goto('http://localhost:4173/element118/chapter1/?skip');
await p.evaluate(() => localStorage.removeItem('element118.ch1.save'));
await p.waitForTimeout(2500);
const tapEl = async (sel) => { const r = await p.evaluate((s) => { const e = document.querySelector(s).getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }, sel); await p.touchscreen.tap(r[0], r[1]); };
await tapEl('#bNew');
await p.waitForTimeout(2000);
check(await p.evaluate(() => getComputedStyle(document.getElementById('bJump')).display !== 'none'), 'touch buttons shown');
const touch = (type, id, x, y) => p.evaluate(([type, id, x, y]) => {
  const el = document.querySelector('#view canvas');
  const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
  el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
}, [type, id, x, y]);
const pos = () => p.evaluate(() => { const pl = window.__ch1.player; return { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z }; });
await p.evaluate(() => window.__ch1.cam.setView(0, 0.25));
await p.waitForTimeout(400);
const a = await pos();
await touch('touchstart', 1, 150, 260); await touch('touchmove', 1, 150, 190);
await p.waitForTimeout(1800);
await touch('touchend', 1, 150, 190);
const b2 = await pos();
check(Math.hypot(b2.x - a.x, b2.z - a.z) > 1, 'left stick moves Carbon');
const y0 = (await pos()).y;
await tapEl('#bJump');
let ym = y0; for (let i = 0; i < 12; i++) { ym = Math.max(ym, (await pos()).y); await p.waitForTimeout(60); }
check(ym > y0 + 0.3, 'JUMP button jumps');
// a dialogue line advances by tapping it
await p.evaluate(() => { window.__ch1.player.teleport(12.6, 108.2); });
await p.waitForTimeout(600);
check(await p.evaluate(() => !document.getElementById('bAct').classList.contains('hide')), 'action button appears next to a person');
await tapEl('#bAct');
await p.waitForTimeout(800);
check(await p.isVisible('#say'), 'tapping the action button starts a conversation');
await p.screenshot({ path: 'test-output/ch1-mobile-talk.png' });
for (let i = 0; i < 4 && (await p.isVisible('#say')); i++) { await tapEl('#say'); await p.waitForTimeout(400); }
check(!(await p.isVisible('#say')), 'dialogue advances and closes by tapping');
await p.evaluate(() => { const G = window.__ch1; G.S.k.scan = true; });
await p.waitForTimeout(500);
check(await p.evaluate(() => !document.getElementById('bScan').classList.contains('hide')), 'SCAN button appears once unlocked');
const fit = await p.evaluate(() => { const c = document.querySelector('#view canvas').getBoundingClientRect(); return c.width <= innerWidth + 1 && c.height <= innerHeight + 1; });
check(fit, 'canvas fits the screen');
const zoom = await p.evaluate(() => (window.visualViewport ? window.visualViewport.scale : 1));
check(zoom === 1, 'no page zoom');
await p.screenshot({ path: 'test-output/ch1-mobile.png' });
console.log(errs.length ? errs : 'no errors');
await b.close();
process.exit(fails || errs.length ? 1 : 0);
