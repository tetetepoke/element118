// 3D prototype acceptance test: field shows → walk / run / jump (no air jump) → climb a ledge →
// hills → cliffs block → find Silica → BOND → SiC FORM → HARD BREAK the rock → up the gorge → BREAK.
// Also checks the 2D save and other projects' keys are untouched.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:4173/element118/';
mkdirSync('test-output', { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const P = (fn, a) => page.evaluate((x) => (new Function('P', 'a', 'return (' + x.fn + ')(P, a)'))(window.__proto3d, x.a), { fn: fn.toString(), a });
const check = (c, m) => { if (!c) throw new Error('CHECK FAILED: ' + m + ' | ' + errors.join(' | ')); console.log('  ok', m); };
const st = () => P((P) => ({ s: P.player.state, x: P.player.pos.x, y: P.player.pos.y, z: P.player.pos.z, vy: P.player.vel.y, g: P.player.onGround, form: P.state.form }));
async function hold(keys, ms, sample) {
  for (const k of keys) await page.keyboard.down(k);
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (sample) seen.push(await st()); await wait(60); }
  for (const k of keys) await page.keyboard.up(k);
  return seen;
}
const face = (dx, dz) => P((P, a) => { P.cam.setView(Math.atan2(-a.dx, -a.dz), 0.3); }, { dx, dz });
const fxDone = async (ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!(await P((P) => P.fx.active))) return true; await wait(150); } return false; };

await page.goto(base);
await page.evaluate(() => {
  localStorage.setItem('element118.save.slot1', '{"version":2,"marker":"2d-save"}');
  localStorage.setItem('rain.save', 'untouched');
  for (const k of Object.keys(localStorage)) if (k.startsWith('element118.3d.')) localStorage.removeItem(k);
});
await page.goto(base + '3d/?debug');
await wait(3500);
check(await page.evaluate(() => !!document.querySelector('#view canvas')), '3D canvas shown');
check((await st()).s === 'Idle', 'starts Idle');
await page.screenshot({ path: 'test-output/3d-t01-start.png' });

// walk / run (camera relative: W = away from the camera)
const s0 = await st();
const walk = await hold(['KeyW'], 900, true);
const s1 = await st();
check(walk.some((x) => x.s === 'Walk') && s1.z < s0.z - 1.5, 'walks forward (Walk)');
const r0 = await st();
const run = await hold(['KeyW', 'ShiftLeft'], 1000, true);
const r1 = await st();
check(run.some((x) => x.s === 'Run') && Math.hypot(r1.x - r0.x, r1.z - r0.z) > (s0.z - s1.z) * 1.4, 'runs faster (Run)');

// camera: mouse drag turns it 360°
const yaw0 = await P((P) => P.cam.yaw);
await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(900, 360, { steps: 8 }); await page.mouse.up();
await wait(500);
check(Math.abs((await P((P) => P.cam.yaw)) - yaw0) > 0.3, 'camera turns with the mouse');
await face(0, -1);

// jump, then no jump in the air — stepped directly so the result does not depend on the frame rate
const jumpRun = await P((P) => {
  const pl = P.player;
  pl.teleport(0, 64);
  const y0 = pl.pos.y;
  const f = { x: 0, y: 0, z: -1 }, r = { x: 1, y: 0, z: 0 };
  const F = new pl.pos.constructor(0, 0, -1), R = new pl.pos.constructor(1, 0, 0);
  const inp = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, jump: true, action: false, breakForm: false, codex: false };
  const seen = [];
  const phases = new Set();
  let peak = y0, airJumped = false;
  for (let i = 0; i < 120; i++) {
    pl.update(1 / 60, inp, F, R);
    inp.jump = false;
    seen.push(pl.state);
    phases.add(pl.info.phase);
    peak = Math.max(peak, pl.pos.y);
    // try to jump again in the air on the way down
    if (pl.state === 'Fall' && pl.pos.y > y0 + 0.5 && !airJumped) {
      airJumped = true;
      const vyBefore = pl.vel.y;
      inp.jump = true;
      pl.update(1 / 60, inp, F, R);
      inp.jump = false;
      if (pl.vel.y > vyBefore + 1) return { airJump: true };
    }
  }
  void f; void r;
  return { y0, peak, seen: [...new Set(seen)], phases: [...phases], landed: pl.onGround, airJump: false };
});
check(jumpRun.seen.includes('Jump') && jumpRun.peak > jumpRun.y0 + 1, `jumps (Jump), peak +${(jumpRun.peak - jumpRun.y0).toFixed(2)} m`);
check(jumpRun.seen.includes('Fall'), 'falls (Fall)');
check(!jumpRun.airJump, 'no jumping in the air');
check(jumpRun.landed, 'lands on the ground');
check(['takeoff', 'rise', 'apex', 'fall', 'land'].every((ph) => jumpRun.phases.includes(ph)), `jump phases takeoff→rise→apex→fall→land (${jumpRun.phases.join(',')})`);
// acceleration: speed builds up over several frames rather than jumping to full
const accel = await P((P) => {
  const pl = P.player;
  pl.teleport(0, 64);
  for (let i = 0; i < 30; i++) pl.update(1 / 60, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false }, new pl.pos.constructor(0, 0, -1), new pl.pos.constructor(1, 0, 0));
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: true, jump: false, action: false, breakForm: false, codex: false };
  const sp = [];
  for (let i = 0; i < 40; i++) { pl.update(1 / 60, inp, new pl.pos.constructor(0, 0, -1), new pl.pos.constructor(1, 0, 0)); sp.push(pl.horizontalSpeed); }
  return { first: sp[1], later: sp[39] };
});
check(accel.first < accel.later * 0.5 && accel.later > 5, `accelerates smoothly (${accel.first.toFixed(2)} → ${accel.later.toFixed(2)} m/s)`);
// the real key works too
await P((P) => P.player.teleport(0, 64));
await wait(400);
const ky = (await st()).y;
await page.keyboard.press('Space');
let kmax = ky;
for (let i = 0; i < 14; i++) { kmax = Math.max(kmax, (await st()).y); await wait(60); }
check(kmax > ky + 0.4, 'Space key jumps');
await wait(800);

// climb a ledge (rock playground: the 1.2 m rock at (11, 58)) — stepped directly
const climbRun = await P((P) => {
  const pl = P.player;
  pl.teleport(8.6, 60.2);
  const dx = 11 - 8.6, dz = 58 - 60.2, l = Math.hypot(dx, dz);
  const F = new pl.pos.constructor(dx / l, 0, dz / l), R = new pl.pos.constructor(-dz / l, 0, dx / l);
  pl.facing = Math.atan2(dx, dz);
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false };
  const seen = [];
  for (let i = 0; i < 150; i++) {
    inp.jump = i > 0 && i % 20 === 0 && !seen.includes("Climb");
    pl.update(1 / 60, inp, F, R);
    seen.push(pl.state);
    if (pl.onGround && Math.hypot(pl.pos.x - 11, pl.pos.z - 58) < 1 && pl.pos.y > P.field.colliders.topAt(11, 58) - 0.3) break;
  }
  return { seen: [...new Set(seen)], y: pl.pos.y, top: P.field.colliders.topAt(11, 58) };
});
check(climbRun.y > climbRun.top - 0.3, `stands on top of the rock (y=${climbRun.y.toFixed(2)}, top=${climbRun.top.toFixed(2)})`);

// hills: walk up toward the ruins
await P((P) => P.player.teleport(-45, -10));
await face(0, -1);
const h0 = (await st()).y;
await hold(['KeyW', 'ShiftLeft'], 2200);
check((await st()).y > h0 + 2, 'walks up a hill');
await page.screenshot({ path: 'test-output/3d-t02-ruins.png' });

// cliffs of the plateau block the way
await P((P) => P.player.teleport(12, -60));
await face(1, 0);
await hold(['KeyW', 'ShiftLeft'], 1600);
const c1 = await st();
check(c1.x < 19 && c1.y < 6, 'the plateau cliff blocks walking');

// the other way up: climb the rock shelves along the south cliff, tread by tread
const shelves = await P((P) => {
  const pl = P.player;
  pl.teleport(28.6, -14.5);
  const F = new pl.pos.constructor(1, 0, 0), R = new pl.pos.constructor(0, 0, 1);
  pl.facing = Math.PI / 2;
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false };
  let climbs = 0, prev = '';
  for (let i = 0; i < 1500; i++) {
    inp.jump = i % 24 === 0;
    pl.update(1 / 60, inp, F, R);
    if (pl.state === 'Climb' && prev !== 'Climb') climbs++;
    prev = pl.state;
    if (pl.pos.x > 51 && pl.pos.y > 15.8 && pl.onGround) break;
  }
  // step north onto the plateau
  const N = new pl.pos.constructor(0, 0, -1), E = new pl.pos.constructor(1, 0, 0);
  for (let i = 0; i < 240; i++) { inp.jump = i % 24 === 0; pl.update(1 / 60, inp, N, E); }
  return { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, climbs };
});
check(shelves.climbs > 0, `ledge climbs (Climb) on the shelves: ${shelves.climbs}`);
check(shelves.y > 13 && shelves.z < -19, `climbs the rock shelves onto the plateau (${shelves.climbs} climbs, y=${shelves.y.toFixed(1)})`);

// the lookout crag over the ruins: spiral rock shelves to the top
const crag = await P((P) => {
  const pl = P.player;
  const list = P.field.colliders.list.filter((c) => c.id.startsWith('crag_shelf'));
  const first = list[0];
  pl.teleport(first.x + 2.2, first.z + 1.8);
  const inp = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false, breakForm: false, codex: false };
  const targets = [...list.map((c) => ({ x: c.x, z: c.z, top: c.top })), { x: -66, z: -52, top: null }];
  let reached = 0;
  for (const tg of targets) {
    for (let i = 0; i < 240; i++) {
      const dx = tg.x - pl.pos.x, dz = tg.z - pl.pos.z, l = Math.hypot(dx, dz) || 1;
      const F = new pl.pos.constructor(dx / l, 0, dz / l), R = new pl.pos.constructor(-dz / l, 0, dx / l);
      inp.moveY = l > 0.5 ? 1 : 0;
      inp.jump = i % 20 === 0;
      pl.update(1 / 60, inp, F, R);
      if (l < 0.9 && pl.onGround && (tg.top === null || Math.abs(pl.pos.y - tg.top) < 0.4)) { reached++; break; }
    }
  }
  return { reached, total: targets.length, y: pl.pos.y, top: P.field.colliders.topAt(-66, -52) };
});
check(crag.y > crag.top - 1, `climbs the lookout crag (${crag.reached}/${crag.total} shelves, y=${crag.y.toFixed(1)} top=${crag.top.toFixed(1)})`);
await P((P) => { P.player.teleport(-63, -49); P.cam.setView(Math.atan2(-(-45 + 63), -(-35 + 49)), 0.35); });
await wait(900);
await page.screenshot({ path: 'test-output/3d-t02b-lookout.png' });

// the hard rock: cannot pass, cannot break yet
await P((P) => P.player.teleport(13.5, -25));
await face(19.6 - 13.5, -31.6 + 25);
await hold(['KeyW'], 1600);
const blocked = await st();
check(Math.hypot(blocked.x - 19.6, blocked.z + 31.6) > 4.5, 'the hard rock blocks the gorge');
await page.keyboard.press('KeyE');
await wait(300);
check((await page.evaluate(() => document.getElementById('msg').textContent)).includes('びくともしない'), 'normal Carbon cannot break it');

// Silica → BOND → SiC FORM
await P((P) => P.player.teleport(2, -6.8));
await wait(500);
check(await P((P) => P.state.silicaFound), 'found Silica (NEW ELEMENT Si)');
await page.keyboard.press('KeyE');
await wait(250);
check(await P((P) => P.fx.active), 'BOND effect plays');
check(await fxDone(), 'BOND effect finishes');
check((await st()).form === 'sic', 'BOND → SiC FORM');
check(await P((P) => !P.silica.root.visible), 'Silica merged into Carbon');
await page.screenshot({ path: 'test-output/3d-t03-sic.png' });

// HARD BREAK
await P((P) => { P.player.teleport(14.6, -26.6); P.player.facing = Math.atan2(19.6 - 14.6, -31.6 + 26.6); });
await face(19.6 - 14.6, -31.6 + 26.6);
await wait(200);
await page.keyboard.press('KeyE');
await wait(900);
check(await P((P) => P.state.rocksBroken.includes('hard_rock_gorge')), 'HARD BREAK broke the rock');
await page.screenshot({ path: 'test-output/3d-t04-broken.png' });

// up the gorge to the plateau
const dir = { x: 36 - 8, z: -48 + 20 };
await face(dir.x, dir.z);
await hold(['KeyW', 'ShiftLeft'], 5500);
const up = await st();
check(up.y > 13, `reached the plateau through the opened gorge (y=${up.y.toFixed(1)})`);
await page.screenshot({ path: 'test-output/3d-t05-plateau.png' });

// BREAK
await page.keyboard.press('KeyQ');
await wait(250);
check(await fxDone(), 'BREAK effect finishes');
await wait(200);
check((await st()).form === null && (await P((P) => P.silica.root.visible)), 'BREAK → Carbon + Silica');
await hold(['KeyW'], 1200);
await wait(400);
await page.screenshot({ path: 'test-output/3d-t06-break.png' });

// codex keeps science and fiction apart
await page.keyboard.press('KeyC');
await wait(300);
const codex = await page.evaluate(() => document.getElementById('codexPanel').textContent);
check(codex.includes('本物の科学') && codex.includes('ゲームの中の能力（フィクション）'), 'codex separates real science from game fiction');
await page.screenshot({ path: 'test-output/3d-t07-codex.png' });

// 2D save untouched
check(await page.evaluate(() => localStorage.getItem('element118.save.slot1') === '{"version":2,"marker":"2d-save"}' && localStorage.getItem('rain.save') === 'untouched'), '2D save and other projects untouched');
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors');
await b.close();
if (errors.length) process.exit(1);
