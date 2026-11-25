// Walks Carbon right and left and saves a close-up so the facing can be checked.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4173/element118/?touch=1'); await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
await p.mouse.click(1110, 590); await p.waitForTimeout(2500);
for (let i = 0, idle = 0; i < 200 && idle < 4; i++) {
  const st = await p.evaluate(() => { const u = window.__game.scene.getScene('UI'); const w = window.__game.scene.getScene('World'); return { d: !!(u && u.dlg && u.dlg.visible), b: !!(w && w.busy) }; });
  if (st.d) { idle = 0; await p.keyboard.press('Space'); await p.waitForTimeout(70); }
  else if (st.b) { idle = 0; await p.waitForTimeout(200); }
  else { idle++; await p.waitForTimeout(150); }
}
await p.waitForTimeout(600);
await p.evaluate(() => { const w = window.__game.scene.getScene('World'); w.player.setPosition(w.player.x, w.player.y + 60); });
for (const [k, n] of [['KeyD', 'right'], ['KeyA', 'left'], ['KeyS', 'down'], ['KeyW', 'up']]) {
  await p.keyboard.down(k); await p.waitForTimeout(450);
  const st = await p.evaluate(() => { const w = window.__game.scene.getScene('World'); const pl = w.player; const c = w.cameras.main; return { a: pl.anims.currentAnim?.key, flip: pl.flipX, vx: Math.round(pl.body.velocity.x), sx: (pl.x - c.worldView.x) * c.zoom, sy: (pl.y - c.worldView.y) * c.zoom }; });
  await p.screenshot({ path: `test-output/facing-${n}.png`, clip: { x: Math.max(0, st.sx - 100), y: Math.max(0, st.sy - 140), width: 200, height: 200 }, scale: 'css' });
  await p.keyboard.up(k); console.log(n, st);
}
console.log(errs.length ? errs : 'no errors'); await b.close();
