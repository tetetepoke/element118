import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Vector3 } from 'three';
import { adjustWeaponCarry, craftFromInventory, makeTool, toolMesh, type Tool, type ToolDesign } from '../src3d/ch1/game/craft';
import { WEAPONS, type WeaponKind } from '../src3d/gameplay/weaponTypes';
import { registerWildlifeMaterials } from '../src3d/gameplay/wildlifeData';

registerWildlifeMaterials();

test('all six profiles craft with compatible parts and leave a visible tip', () => {
  for (const kind of Object.keys(WEAPONS) as WeaponKind[]) {
    const design = { kind, head: 'cave_shell', handle: 'stick', binding: 'fiber' };
    const inv = { cave_shell: 2, stick: 2, fiber: 2 };
    const tools: Tool[] = [];
    const weapon = craftFromInventory(design, inv, tools);
    assert.ok(weapon && weapon.stats.attack > 0 && weapon.stats.attackSpeed > 0 && weapon.stats.reach > 0, kind);
    assert.deepEqual(inv, { cave_shell: 1, stick: 1, fiber: 1 });
    assert.equal(tools[0], weapon);
    const mesh = toolMesh(design);
    assert.ok(mesh.userData.attackTip.y > 0);
  }
});

test('craft refuses insufficient and incompatible inputs atomically; old workshop saves still load', () => {
  const d: ToolDesign = { kind: 'spear', head: 'cave_fang', handle: 'stick', binding: 'fiber' };
  const inv = { cave_fang: 1, stick: 1, fiber: 0 };
  const tools: Tool[] = [];
  assert.equal(craftFromInventory(d, inv, tools), null);
  assert.equal(craftFromInventory({ ...d, head: 'heavy_stone' }, { ...inv, heavy_stone: 1, fiber: 1 }, tools), null);
  assert.deepEqual(inv, { cave_fang: 1, stick: 1, fiber: 0 });
  assert.equal(tools.length, 0);
  assert.ok(makeTool({ head: 'heavy_stone', handle: 'stick', binding: null }));
});

test('holding a spear down raises its tip without detaching from the glove', () => {
  const glove = new Group();
  glove.position.y = 0.2;
  glove.rotation.x = Math.PI / 4;
  glove.scale.setScalar(0.39);
  const mesh = toolMesh({ kind: 'spear', handle: 'stick', head: 'cave_fang', binding: 'fiber' });
  glove.add(mesh);
  adjustWeaponCarry(mesh, () => 0);
  const tip = mesh.localToWorld(new Vector3().copy(mesh.userData.attackTip));
  assert.ok(tip.y > 0.03);
  assert.equal(mesh.parent, glove);
  assert.equal(mesh.position.lengthSq(), 0);
});
