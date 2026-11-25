// ad-hoc: node scripts/debug3d-shot.mjs out.png "<js using P before the shot>"
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://localhost:4173/element118/3d/?debug');
await page.waitForTimeout(3000);
const r = await page.evaluate((code) => (new Function('P', code))(window.__proto3d), process.argv[3]);
await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('msg').style.display = 'none'; });
await page.screenshot({ path: process.argv[2] });
if (r !== undefined) console.log(JSON.stringify(r));
await b.close();
