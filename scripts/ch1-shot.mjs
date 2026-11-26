// ad-hoc look at chapter 1: node scripts/ch1-shot.mjs out.png "<js using G (window.__ch1)>" [query]
import { chromium } from 'playwright-core';
const q = process.argv[4] ?? '?skip&debug&auto';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto('http://localhost:4173/element118/chapter1/' + q);
await page.evaluate(() => localStorage.removeItem('element118.ch1.save'));
await page.waitForTimeout(2500);
await page.click('#bNew');
await page.waitForTimeout(2500);
const r = await page.evaluate(async (code) => await (new Function('G', `return (async () => { ${code} })()`))(window.__ch1), process.argv[3] ?? '');
await page.waitForTimeout(2000);
await page.screenshot({ path: process.argv[2] });
if (r !== undefined) console.log(JSON.stringify(r));
console.log(await page.evaluate(() => document.getElementById('debug').textContent));
await b.close();
