import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Group, Vector3 } from 'three';
import { Npc } from '../src3d/ch1/world/actors';
import type { InputState } from '../src3d/core/input';
import { PlayerController, TUNING } from '../src3d/player/controller';
import { ColliderWorld } from '../src3d/world/colliders';
import { setGround } from '../src3d/world/ground';

const heightAt = () => 0;
const forward = new Vector3(0, 0, 1);
const right = new Vector3(1, 0, 0);
const input: InputState = {
  moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, jump: false, action: false,
  bond: false, breakForm: false, form: false, scan: false, menu: false, codex: false,
  toolPrev: false, toolNext: false, actionL: false, actionR: false, stickL: false, stickR: false,
};

beforeEach(() => {
  setGround({ heightAt, waterAt: () => null, spawn: { x: 0, z: 0 }, half: 80 });
});

function makePlayer(world: ColliderWorld) {
  return new PlayerController({
    root: new Group(),
    setState() {},
    setForm() {},
    playAction: () => 0,
    update() {},
  }, world);
}

test('jumping into the edge of an overhang resolves during the same frame', () => {
  const world = new ColliderWorld();
  world.add({ id: 'overhang', kind: 'box', x: 0.65, z: 0, hx: 0.5, hz: 1, bottom: 2, top: 3 });
  const player = makePlayer(world);

  for (let frame = 0; frame < 15; frame++) {
    player.update(1 / 30, { ...input, jump: frame === 0 }, forward, right);
    const { x, y, z } = player.pos;
    assert.ok(world.penetration(x, z, y, TUNING.radius, TUNING.height, 0) < 1e-6, `frame ${frame}`);
  }
  assert.ok(player.pos.x < -0.1);
});

test('player and NPC block one another, and the collider follows the walking NPC', () => {
  const world = new ColliderWorld();
  const npc = new Npc('test', 'resident');
  npc.root.position.z = 2;
  npc.addCollider(world);
  const player = makePlayer(world);
  const run = { ...input, moveY: 1, run: true };

  for (let frame = 0; frame < 60; frame++) player.update(1 / 30, run, forward, right);
  const [shape] = world.list;
  assert.ok(Math.abs(player.pos.z - (2 - shape.r! - TUNING.radius)) < 0.01);

  npc.walkTo(new Vector3());
  for (let frame = 0; frame < 30; frame++) npc.update(1 / 30, heightAt, player.pos);
  assert.equal(npc.root.position.z, 2);

  npc.walkTo(new Vector3(2, 0, 2));
  for (let frame = 0; frame < 30; frame++) npc.update(1 / 30, heightAt, player.pos);
  assert.equal(shape.x, npc.root.position.x);
  for (let frame = 0; frame < 60; frame++) player.update(1 / 30, run, forward, right);
  assert.ok(player.pos.z > 3);
});
