// Checks that party members face the same way as Carbon while walking.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4173/element118/');
await p.evaluate(() => localStorage.setItem('element118.save.slot1', JSON.stringify({ version: 1, savedAt: '', playTimeSec: 10, player: { x: 24 * 16 + 8, y: 47 * 16, hp: 6, maxHp: 6, facing: 2 }, checkpoint: { x: 24 * 16 + 8, y: 47 * 16 }, atoms: { H: 2 }, substances: {}, equipped: null, discovered: { elements: ['C', 'H'], substances: [], reactions: [], bondKinds: [] }, party: ['hyde', 'oxy'], flags: { intro_done: true, got_codex: true, met_hyde: true, met_oxy: true, fog_cleared: true }, stats: { bondAttempts: 0, bondFailures: 0, enemiesDefeated: 3 } })));
await p.reload();
await p.waitForTimeout(1500);
await p.mouse.click(1110, 590);
await p.waitForTimeout(2500);
const state = () => p.evaluate(() => { const w = window.__game.scene.getScene('World'); return [w.player.anims.currentAnim?.key, w.player.flipX, ...w.followers.map((f) => [f.sprite.anims.currentAnim?.key, f.sprite.flipX])]; });
for (const [key, name] of [['KeyA', 'left'], ['KeyD', 'right'], ['KeyS', 'down'], ['KeyW', 'up']]) {
  await p.keyboard.down(key);
  await p.waitForTimeout(900);
  console.log(name, JSON.stringify(await state()));
  await p.screenshot({ path: `test-output/follow-${name}.png` });
  await p.keyboard.up(key);
  await p.waitForTimeout(200);
}
console.log(errs.length ? errs : 'no errors');
await b.close();
