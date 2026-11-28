import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/element118/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const chapter of [1, 2]) {
    const page = await browser.newPage({ ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 });
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const path = `${base}chapter${chapter}/?skip&auto&debug`;
    const evaluate = (fn, arg) => page.evaluate(({ chapter, source, arg }) => {
      // Use the same debug state hooks as the chapter playthrough fixtures.
      return new Function('game', 'arg', `return (${source})(game, arg)`)(window[`__ch${chapter}`], arg);
    }, { chapter, source: fn.toString(), arg });
    console.log(`Chapter ${chapter}: starting mobile checks`);
    await page.goto(path);
    await page.locator('#bNew').tap();
    assert.ok(await page.locator('#miniMap').isHidden());
    await evaluate((g, chapter) => {
      if (chapter === 1) Object.assign(g.S.flags, { city_seen: true, city_talk: true });
      else Object.assign(g.S.flags, { village: true, chief: true });
      const npc = g.world.npcs.find((n) => n.id === (chapter === 1 ? 'res_a' : 'miner_a'));
      g.player.teleport(npc.root.position.x, npc.root.position.z + 0.95);
    }, chapter);
    await evaluate((g) => g.onAction());
    await page.locator('#miniMap').waitFor();
    await page.locator('#miniMap').tap();
    assert.equal(await page.locator('.chapter-map select option').count(), 4);
    assert.match(await page.locator('.chapter-map p').innerText(), /目的地/);
    await page.locator('.chapter-map select').selectOption('2');
    await page.locator('.chapter-map button').tap();
    const mapped = await evaluate((g) => [...g.S.exploration.visited]);
    assert.ok(mapped.length > 0);
    await evaluate((g) => {
      g.S.k.create = true;
      Object.assign(g.S.inv, { cave_fang: 1, stick: 1, fiber: 1, heavy_stone: 1 });
      g.openBag();
    });
    await page.locator('#craftKind').selectOption('spear');
    assert.ok(await page.locator('#bMake').isDisabled());
    assert.ok((await page.locator('[data-id=heavy_stone]').getAttribute('class')).includes('incompatible'));
    await page.locator('[data-id=cave_fang]').tap();
    await page.locator('[data-id=stick]').tap();
    await page.locator('[data-id=fiber]').tap();
    await page.locator('#bagView canvas').waitFor();
    await page.locator('#previewIn').tap();
    assert.match(await page.locator('.craft-stats').innerText(), /攻撃力\s+17/);
    await page.locator('#bMake').tap();
    assert.deepEqual(await evaluate((g) => ({
      kind: g.tools[0].design.kind, source: [g.S.inv.cave_fang, g.S.inv.stick, g.S.inv.fiber],
      held: g.carbon.rightHand.children.some((child) => child.userData.attackTip),
    })), { kind: 'spear', source: [0, 0, 0], held: true });
    await page.locator('#bagX').tap();
    await evaluate((g, chapter) => {
      const encounter = g.world.colliders.list.find((c) => c.id === (chapter === 1 ? 'dump_guard' : 'green_guard'));
      if (!encounter.enabled) throw new Error('Encounter placement is obstructed');
      g.player.teleport(encounter.x, encounter.z - 0.86);
      g.world.colliders.add({
        id: 'test_wall', kind: 'box', x: encounter.x, z: encounter.z - 0.49,
        hx: 1.1, hz: 0.025, bottom: encounter.bottom - 0.25, top: encounter.top + 0.8,
      });
    }, chapter);
    const initialUses = await evaluate((g) => g.tools[0].uses);
    await page.locator('#bAttack').tap();
    const waitForAttack = async (attacking) => page.waitForFunction(
      ({ chapter, attacking }) => window[`__ch${chapter}`].combat.attacking === attacking, { chapter, attacking },
    );
    await waitForAttack(true);
    await waitForAttack(false);
    assert.equal(await evaluate((g) => g.tools[0].uses), initialUses, 'wall blocks the weapon');
    assert.ok(await evaluate((g) => (g.S.hp ?? 60) === 60), 'wall blocks the creature');
    await evaluate((g) => { g.world.colliders.list.find((c) => c.id === 'test_wall').enabled = false; });
    await page.waitForFunction(() => document.getElementById('encounterStatus').textContent.includes('攻撃予備動作'));
    const enemyId = chapter === 1 ? 'dump_guard' : 'green_guard';
    for (let attempt = 0; attempt < 7; attempt++) {
      if (await evaluate((g, id) => !!g.S.defeated?.[id], enemyId)) break;
      if (attempt % 2) await page.locator('#bAttack').tap();
      else await page.keyboard.press('KeyG');
      await page.waitForTimeout(1800);
      console.log(`  Attempt ${attempt + 1}: ${await page.locator('#encounterStatus').textContent()}`);
    }
    assert.ok(await evaluate((g, id) => g.S.defeated?.[id]?.drops.length > 0 &&
      !g.world.colliders.list.find((c) => c.id === id).enabled, enemyId), 'defeat disables the collider and produces loot');
    const drop = await evaluate((g, id) => g.S.defeated[id].drops[0], enemyId);
    const collect = page.locator('#bAct');
    await page.waitForFunction(() => document.getElementById('bAct').textContent === '拾う');
    if (await collect.isVisible()) await collect.tap();
    else await page.keyboard.press('KeyE');
    await page.waitForFunction(({ chapter, drop }) => window[`__ch${chapter}`].S.inv[drop] === 1, { chapter, drop });
    assert.equal(await evaluate((g, drop) => g.S.inv[drop], drop), 1);
    assert.ok(await evaluate((g, drop) => g.S.wildlifeMaterials.includes(drop) && !g.S.k.scanned.includes(drop), drop));
    await page.reload();
    await page.locator('#bCont').tap();
    await page.locator('#miniMap').waitFor();
    assert.ok((await evaluate((g) => g.S.exploration.visited)).includes(mapped[0]));
    assert.equal(await evaluate((g, drop) => g.S.inv[drop], drop), 1);
    assert.ok(await evaluate((g, id) => !!g.S.defeated[id] && !g.world.colliders.list.find((c) => c.id === id).enabled &&
      g.carbon.rightHand.children.some((child) => child.userData.attackTip), enemyId));
    assert.deepEqual(errors, []);
    console.log(`Chapter ${chapter}: map, craft, actual attack, wall, loot and reload passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
