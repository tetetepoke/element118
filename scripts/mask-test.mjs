import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs=[]; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:4173/element118/');
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.clear());
await p.reload(); await p.waitForTimeout(1500);
const st = () => p.evaluate(() => { const w = window.__game.scene.getScene('World'); return w ? { m: w.player.masked, a: w.player.anims.currentAnim?.key } : null; });
await p.mouse.click(1110, 590); await p.waitForTimeout(1500);
for (let i=0;i<12;i++){ await p.keyboard.press('Space'); await p.waitForTimeout(250);} 
console.log('start', await st());
// teleport next to elder NPC and away
const pos = await p.evaluate(() => { const w = window.__game.scene.getScene('World'); const n=[...w.npcs.entries()]; return n.map(([k,s])=>[k,Math.round(s.x),Math.round(s.y)]); });
console.log(pos);
const [id,x,y]=pos.find(e=>e[0]==='elder')||pos[0];
await p.evaluate(([x,y])=>{const w=window.__game.scene.getScene('World'); w.player.setPosition(x+30,y+10);},[x,y]);
await p.waitForTimeout(400); console.log('near', id, await st());
await p.screenshot({ path: 'test-output/mask-near.png' });
await p.evaluate(([x,y])=>{const w=window.__game.scene.getScene('World'); w.player.setPosition(x+200,y+40);},[x,y]);
await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(500); console.log('far+left', await st()); await p.screenshot({ path: 'test-output/mask-far.png' }); await p.keyboard.up('ArrowLeft');
console.log(errs.length ? errs : 'no errors');
await b.close();
