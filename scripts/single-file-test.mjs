// Opens the one-file build straight from disk and checks it reaches the world with real sprites.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' || m.text().includes('asset failed')) errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/dist-single/element118.html?touch=1');
await p.waitForTimeout(2500);
await p.screenshot({ path: 'test-output/single-title.png' });
await p.mouse.click(1110, 590);
await p.waitForTimeout(2500);
for (let i = 0; i < 12; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(200); }
await p.waitForTimeout(1500);
await p.screenshot({ path: 'test-output/single-world.png' });
const real = await p.evaluate(() => ['carbon', 'tiles', 'hyde', 'keyart', 'house_a'].map((k) => [k, window.__game.textures.get(k).source[0].image.constructor.name]));
console.log(real, errs.length ? errs : 'no errors');
await b.close();
