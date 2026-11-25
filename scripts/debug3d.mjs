// ad-hoc debugging helper for the 3D prototype: node scripts/debug3d.mjs "<js using P>"
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://localhost:4173/element118/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(base + '3d/?debug');
await page.waitForTimeout(3000);
const out = await page.evaluate((code) => (new Function('P', code))(window.__proto3d), process.argv[2]);
console.log(JSON.stringify(out, null, 1));
await b.close();
