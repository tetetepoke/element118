// Exports the code-drawn placeholder tileset as PNG (used as the base when patching in real tiles).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
await p.goto(process.argv[2] ?? 'http://localhost:4173/element118/');
await p.waitForTimeout(2500);
const data = await p.evaluate(() => window.__game.textures.get('tiles').getSourceImage().toDataURL('image/png'));
writeFileSync(process.argv[3] ?? '/home/claude/sheet/placeholder_tiles.png', Buffer.from(data.split(',')[1], 'base64'));
await b.close();
console.log('exported');
