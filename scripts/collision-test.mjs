// Collision system tests (3D prototype /3d/ and chapter 1 /chapter1/).
// A small test arena is added next to the spawn on /3d/ (walls, corner, rocks, a narrow gap, a thin
// wall, steps, a ceiling, a breakable block); the player is driven frame by frame and after every
// step the body is checked to be outside every solid. Chapter 1 gets a long random run through the real
// world, save-load inside a wall, the camera all the way round, and a cost measurement.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// ── shared in-page helpers (string so both pages can use them) ──
const HELP = `
  const M = { radius: 0.34, height: 1.45, step: 0.45 };
  const V = H.player.pos.constructor;
  const inp = (o = {}) => ({ moveX: 0, moveY: 1, lookX: 0, lookY: 0, run: false, jump: false, action: false, ...o });
  let worst = 0, worstAt = null;
  const probe = () => { const p = H.player.pos, d = C.penetration(p.x, p.z, p.y, M.radius, M.height, M.step); if (d > worst) { worst = d; worstAt = [p.x, p.y, p.z]; } return d; };
  // drive toward a direction for n frames of dt (game style: frames split into 1/30 s steps)
  const drive = (dx, dz, n, o = {}, dt = 1 / 30) => {
    const l = Math.hypot(dx, dz) || 1, f = new V(dx / l, 0, dz / l), r = new V(-dz / l, 0, dx / l);
    for (let i = 0; i < n; i++) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
      const I = inp({ run: !!o.run, jump: !!o.jump && i % (o.every ?? 20) === 0, moveX: o.mx ?? 0, moveY: o.my ?? 1 });
      for (let k = 0; k < steps; k++) { H.player.update(dt / steps, I, f, r); I.jump = false; probe(); }
    }
  };
`;

// ═════════ /3d/ arena ═════════
{
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:4173/element118/3d/?debug');
  await p.waitForFunction(() => window.__proto3d?.player, null, { timeout: 60000 });
  const R = await p.evaluate(`(async () => {
    const H = window.__proto3d, C = H.field.colliders;
    ${HELP}
    H.dbg.paused = true; // the game loop must not move the player between our steps
    // a flat spot: search near the spawn for low terrain variation
    const g = (x, z) => C.groundAt(x, z, 1e9, 0, 0) ;
    let ox = 0, oz = 0, best = 1e9;
    const sp = H.player.pos.clone();
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = sp.x + i * 6, z = sp.z + j * 6; let lo = 1e9, hi = -1e9;
      if (Math.abs(x) > 60 || Math.abs(z) > 60) continue; // inside the playable square, with room for the arena
      for (let a = -10; a <= 10; a += 2) for (let c = -10; c <= 10; c += 2) { const h = g(x + a, z + c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const near = C.near(x - 12, x + 12, z - 12, z + 12, []).filter((k) => k.enabled).length;
      const s = hi - lo + near * 5; if (s < best) { best = s; ox = x; oz = z; }
    }
    // a flat test floor (a big box) a little above the highest terrain of the area
    let y0 = -1e9;
    for (let a = -22; a <= 22; a += 1) for (let c = -22; c <= 22; c += 1) y0 = Math.max(y0, g(ox + a, oz + c));
    y0 += 0.05;
    C.add({ id: 't_floor', kind: 'box', x: ox, z: oz, hx: 24, hz: 24, rot: 0, bottom: y0 - 30, top: y0 });
    const add = (o) => C.add({ bottom: y0 - 2, ...o, top: y0 + (o.h ?? 3), id: 't_' + o.id });
    // arena (local coords around ox, oz)
    add({ id: 'wall', kind: 'box', x: ox, z: oz + 4, hx: 4, hz: 0.25, rot: 0 });                 // wall north
    add({ id: 'cornerA', kind: 'box', x: ox + 6, z: oz - 2, hx: 0.25, hz: 3, rot: 0 });          // corner east/south
    add({ id: 'cornerB', kind: 'box', x: ox + 3.25, z: oz - 5, hx: 3, hz: 0.25, rot: 0 });
    add({ id: 'rock', kind: 'cyl', x: ox - 5, z: oz, r: 1.2 });
    add({ id: 'tree', kind: 'cyl', x: ox - 5, z: oz - 4, r: 0.4, h: 6 });
    add({ id: 'gapL', kind: 'box', x: ox - 1.0, z: oz - 9, hx: 0.5, hz: 1.5, rot: 0.3 });        // narrow gap 0.8 m (body 0.68)
    add({ id: 'gapR', kind: 'box', x: ox + 0.8, z: oz - 9, hx: 0.5, hz: 1.5, rot: 0.3 });
    add({ id: 'thin', kind: 'box', x: ox + 12, z: oz, hx: 0.04, hz: 3, rot: 0 });                // 8 cm wall
    add({ id: 'step1', kind: 'box', x: ox - 10, z: oz + 0.5, hx: 1, hz: 0.5, rot: 0, h: 0.3 });  // stairs
    add({ id: 'step2', kind: 'box', x: ox - 10, z: oz + 1.5, hx: 1, hz: 0.5, rot: 0, h: 0.6 });
    add({ id: 'step3', kind: 'box', x: ox - 10, z: oz + 2.5, hx: 1, hz: 0.5, rot: 0, h: 0.9 });
    add({ id: 'high', kind: 'box', x: ox - 14, z: oz, hx: 1, hz: 1, rot: 0, h: 1.0 });           // too high to step
    const roof = C.add({ id: 't_roof', kind: 'box', x: ox + 3, z: oz + 10, hx: 1.5, hz: 1.5, rot: 0, bottom: y0 + 2.2, top: y0 + 2.6 }); // ceiling
    const brk = add({ id: 'brk', kind: 'box', x: ox, z: oz - 14, hx: 2, hz: 0.4, rot: 0, breakable: true });
    const out = {};
    const at = (x, z) => H.player.teleport(ox + x, oz + z, y0);
    const P = () => H.player.pos;

    // 1 wall head-on (walk / run)
    at(0, 1); worst = 0; drive(0, 1, 90); out.wallFront = { z: P().z - oz, worst };
    at(0, 1); worst = 0; drive(0, 1, 90, { run: true }); out.wallRun = { z: P().z - oz, worst };
    // 2 wall at 40°: slides along it
    at(-2, 2); worst = 0; const x0 = P().x; drive(Math.sin(0.7), Math.cos(0.7), 60, { run: true }); out.wallSlide = { slid: P().x - x0, z: P().z - oz, worst };
    // 3 into the corner
    at(3, -2); worst = 0; drive(1, -1, 120, { run: true }); out.corner = { worst, x: P().x - ox, z: P().z - oz };
    // 4 rock and tree
    at(-2, 0); worst = 0; drive(-1, 0, 90, { run: true }); out.rock = { worst, x: P().x - ox };
    at(-2, -4); worst = 0; drive(-1, 0, 90, { run: true }); out.tree = { worst };
    // 5 narrow gap: the body (0.68) fits through 0.8 m
    at(-0.1, -6); worst = 0; drive(0.05, -1, 150); out.gap = { worst, z: P().z - oz };
    // 6 dash into the thin wall at the lowest frame rate (dt capped at 1/20 per update): never through
    at(9, 0); worst = 0; drive(1, 0, 80, { run: true }, 1 / 12); out.thin = { x: P().x - ox, worst };
    // 7 jumping into walls (from the side, while rising and falling)
    at(0, 2.5); worst = 0; drive(0, 1, 160, { run: true, jump: true, every: 12 }); out.jumpWall = { worst, z: P().z - oz };
    at(4.5, -3.5); worst = 0; drive(1, -1, 160, { run: true, jump: true, every: 12 }); out.jumpCorner = { worst };
    // 8 stairs: 0.3 m steps walk up; a 1.0 m block needs a jump/climb
    at(-10, -1.5); worst = 0; let topY = 0; for (let i = 0; i < 40; i++) { drive(0, 1, 1); topY = Math.max(topY, P().y - y0); } out.stairs = { y: topY, worst };
    at(-11.6, 0); worst = 0; drive(-1, 0, 60); out.high = { y: P().y - y0, x: P().x - ox, worst };
    // 9 ceiling: jump under the roof stops at it
    H.player.teleport(ox + 3, oz + 10, y0); let maxY = 0; for (let i = 0; i < 40; i++) { drive(0, 1, 1, { my: 0, jump: i === 0, every: 1000 }); maxY = Math.max(maxY, P().y - y0); }
    out.ceiling = { maxHead: maxY + M.height };
    // 10 breakable: solid before, open after BREAK
    at(0, -11.5); drive(0, -1, 60); const before = P().z - oz;
    brk.enabled = false; drive(0, -1, 60); out.breakable = { before, after: P().z - oz };
    // 11 loading a save inside a solid: put back outside
    at(-5, 0); out.loadInRock = { pen: C.penetration(P().x, P().z, P().y, M.radius, M.height, M.step), x: P().x - ox };
    // 12 camera all the way round next to the wall: lens never inside a solid
    at(0, 3.3); let camIn = 0;
    for (let a = 0; a < 72; a++) {
      H.cam.setView((a / 72) * Math.PI * 2, 0.15);
      for (let k = 0; k < 4; k++) H.cam.update(1 / 30, H.player.pos, false, 0);
      const c = H.cam.cam.position;
      for (const k of C.near(c.x - 1, c.x + 1, c.z - 1, c.z + 1, [])) if (k.enabled && !k.cameraIgnore && c.y < k.top && c.y > k.bottom && C.contains(k, c.x, c.z, 0.05)) { camIn++; (out.camWhere ??= []).push([k.id, a, +(c.x - ox).toFixed(2), +(c.y - y0).toFixed(2), +(c.z - oz).toFixed(2), +H.cam.distance.toFixed(2)]); }
    }
    out.camera = { inside: camIn };
    out.rescues = H.player.rescues; out.origin = [ox, oz, y0, best];
    H.dbg.paused = false;
    return out;
  })()`);
  console.log("/3d/ arena", JSON.stringify(R));
  const W = 0.02;
  check(R.wallFront.worst < W && R.wallFront.z < 4 - 0.25 - 0.3, `wall head-on: stops at the wall (inside ${R.wallFront.worst.toFixed(3)} m)`);
  check(R.wallRun.worst < W && R.wallRun.z < 3.5, `wall while running (inside ${R.wallRun.worst.toFixed(3)} m)`);
  check(R.wallSlide.worst < W && R.wallSlide.slid > 1.5, `wall at an angle: slides along it (${R.wallSlide.slid.toFixed(1)} m along, inside ${R.wallSlide.worst.toFixed(3)} m)`);
  check(R.corner.worst < W, `into a corner (inside ${R.corner.worst.toFixed(3)} m)`);
  check(R.rock.worst < W && R.tree.worst < W, `rock and tree (inside ${R.rock.worst.toFixed(3)} / ${R.tree.worst.toFixed(3)} m)`);
  check(R.gap.worst < W && R.gap.z < -10, `narrow gap: through without sinking into either side (z ${R.gap.z.toFixed(1)}, inside ${R.gap.worst.toFixed(3)} m)`);
  check(R.thin.x < 12 && R.thin.worst < W, `dash into an 8 cm wall at 12 fps: not through (x ${R.thin.x.toFixed(2)}, inside ${R.thin.worst.toFixed(3)} m)`);
  check(R.jumpWall.worst < W && R.jumpCorner.worst < W, `jumping into a wall / corner (inside ${R.jumpWall.worst.toFixed(3)} / ${R.jumpCorner.worst.toFixed(3)} m)`);
  check(R.stairs.y > 0.85 && R.stairs.worst < W, `stairs: walked up 3 steps (y +${R.stairs.y.toFixed(2)} m)`);
  check(R.high.y < 0.1 && R.high.worst < W, `1 m block: not walked onto, no sinking in (inside ${R.high.worst.toFixed(3)} m)`);
  check(R.ceiling.maxHead <= 2.21, `jump under a 2.2 m roof: head stops at it (${R.ceiling.maxHead.toFixed(2)} m)`);
  check(R.breakable.before > -13.6 && R.breakable.after < -14.5, `breakable: blocks before, open after (z ${R.breakable.before.toFixed(1)} → ${R.breakable.after.toFixed(1)})`);
  check(R.loadInRock.pen < 0.01, `save loaded inside a rock: put on or next to it, not inside (x ${R.loadInRock.x.toFixed(2)})`);
  check(R.camera.inside === 0, `camera 360° next to a wall: never inside a solid (${R.camera.inside}) ${JSON.stringify(R.camWhere ?? '')}`);
  check(R.rescues === 0, `no safe-spot rescues were needed (${R.rescues})`);
  check(!errs.length, `no page errors ${errs.join(' ')}`);
  await p.close();
}

// ═════════ chapter 1: the real world ═════════
{
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:4173/element118/chapter1/?auto&debug');
  await p.waitForTimeout(2500);
  await p.click('#bNew');
  await p.waitForFunction(() => window.__ch1?.player && window.__ch1.S.flags.wake, null, { timeout: 90000, polling: 500 });
  const R = await p.evaluate(`(async () => {
    const H = window.__ch1, C = H.world.colliders;
    ${HELP}
    const out = {};
    // a long random run through each zone: running, turning, jumping into whatever is there
    let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const spots = H.zones.map((z) => [z.c.x, z.c.y]).filter((q) => isFinite(q[0]) && isFinite(q[1]));
    let frames = 0, deep = 0; worst = 0;
    for (const [zx, zz] of spots.length ? spots : [[H.player.pos.x, H.player.pos.z]]) {
      H.player.teleport(zx, zz);
      for (let seg = 0; seg < 10; seg++) {
        const a = rnd() * Math.PI * 2;
        const before = worst; worst = 0;
        drive(Math.sin(a), Math.cos(a), 45, { run: rnd() > 0.3, jump: rnd() > 0.5, every: 15 }, rnd() > 0.7 ? 1 / 12 : 1 / 30);
        if (worst > 0.05) deep++;
        worst = Math.max(worst, before);
        frames += 45;
      }
    }
    out.run = { frames, worst, worstAt, deep, rescues: H.player.rescues, zones: spots.length };
    // save loaded inside a wall / object
    const big = C.list.find((k) => k.enabled && k.kind === 'box' && (k.hx ?? 0) > 1 && (k.hz ?? 0) > 1 && k.top - k.bottom > 3);
    if (big) { H.player.teleport(big.x, big.z, big.bottom + 2.1); out.load = { pen: C.penetration(H.player.pos.x, H.player.pos.z, H.player.pos.y, M.radius, M.height, M.step), id: big.id }; }
    // camera all the way round in a narrow tunnel: never inside rock or a solid
    H.player.teleport(H.zones[1].c.x, H.zones[1].c.y);
    let camIn = 0;
    for (let a = 0; a < 72; a++) {
      H.cam.setView((a / 72) * Math.PI * 2, -0.2 + (a % 6) * 0.25);
      for (let k = 0; k < 4; k++) H.cam.update(1 / 30, H.player.pos, false, 0);
      const c = H.cam.cam.position;
      if (c.y < H.heightAt(c.x, c.z) - 0.01 || c.y > H.ceilAt(c.x, c.z) + 0.01) { camIn++; (out.camWhere ??= []).push(['rock', a, +(c.y - H.heightAt(c.x, c.z)).toFixed(2), +(H.ceilAt(c.x, c.z) - c.y).toFixed(2), H.cam.distance]); }
      for (const k of C.near(c.x - 1, c.x + 1, c.z - 1, c.z + 1, [])) if (k.enabled && !k.cameraIgnore && c.y < k.top && c.y > k.bottom && C.contains(k, c.x, c.z, 0.02)) { camIn++; (out.camWhere ??= []).push([k.id, a, H.cam.distance]); }
    }
    out.camera = camIn;
    // cost: one player step among all of chapter 1's solids
    const t0 = performance.now(); drive(1, 0.3, 600, { run: true }); out.msPerStep = (performance.now() - t0) / 600;
    out.colliders = C.list.length;
    return out;
  })()`);
  console.log('chapter 1');
  check(R.run.deep === 0, `random run (${R.run.frames} frames over ${R.run.zones} zones, run/jump, 30 and 12 fps): never more than 5 cm inside anything (worst ${R.run.worst.toFixed(3)} m at ${R.run.worstAt?.map((v) => v.toFixed(1))})`);
  check(R.run.rescues < 3, `safe-spot rescues during the run: ${R.run.rescues}`);
  if (R.load) check(R.load.pen < 0.01, `save loaded inside "${R.load.id}": put back outside`);
  check(R.camera === 0, `camera 360° (pitch up and down): never inside rock or a solid (${R.camera}) ${JSON.stringify(R.camWhere ?? '')}`);
  check(R.msPerStep < 0.5, `cost per player step with ${R.colliders} solids: ${R.msPerStep.toFixed(3)} ms (swiftshader CPU)`);
  check(!errs.length, `no page errors ${errs.join(' ')}`);
  await p.close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'all collision tests passed');
process.exit(fails ? 1 : 0);
