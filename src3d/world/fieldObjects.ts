// One place to describe a field object: its drawn model and its collision, plus what the player
// can do with it. Hand-made props, GLB models made elsewhere and generated terrain pieces all go
// through here, so they all use the same collision system.
//
//   addFieldObject(colliders, { id: 'crate1', model: mesh, collider: 'box' })          // fit from the model
//   addFieldObject(colliders, { id: 'grass', model: tuft, collider: 'none' })          // no collision
//   addFieldObject(colliders, { id: 'gate', collider: { kind: 'box', x, z, hx, hz, bottom, top }, breakable: true })
//
// The model is only measured; it is not changed and is not used for collision tests at run time.
import * as THREE from 'three';
import type { Collider, ColliderWorld, ColliderLayer } from './colliders';

export type ColliderShape = Pick<Collider, 'kind' | 'x' | 'z' | 'r' | 'hx' | 'hz' | 'rot' | 'bottom' | 'top'>;

export interface FieldObjectDef {
  id: string;
  /** the drawn model (any Object3D: Mesh, Group, a loaded GLB scene) */
  model?: THREE.Object3D;
  /**
   * 'box' / 'cyl': fitted from the model's size; 'none': no collision (grass, small decorations);
   * or an explicit shape. Default 'box'.
   */
  collider?: 'box' | 'cyl' | 'none' | ColliderShape;
  /** shrink a fitted shape (0.9 = 10 % smaller), for round or uneven models. Default 1 */
  fit?: number;
  layer?: ColliderLayer;
  passable?: boolean;
  climbable?: boolean;
  breakable?: boolean;
  dynamic?: boolean;
  cameraIgnore?: boolean;
  tags?: string[];
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

/** Fit a collision shape to a model, in world space. Boxes follow the model's turn around Y. */
export function colliderFromObject(obj: THREE.Object3D, kind: 'box' | 'cyl', fit = 1): ColliderShape {
  const yaw = obj.rotation.y;
  // measure upright and unturned, so the box is tight on the model's own axes
  obj.rotation.y = 0;
  obj.updateMatrixWorld(true);
  _box.makeEmpty();
  obj.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) _box.expandByObject(o); });
  obj.rotation.y = yaw;
  obj.updateMatrixWorld(true);
  if (_box.isEmpty()) _box.setFromObject(obj);
  const size = _box.getSize(new THREE.Vector3()), c = _box.getCenter(new THREE.Vector3());
  // the centre measured unturned is offset from the pivot; turn that offset back
  const pivot = obj.getWorldPosition(_v);
  const ox = c.x - pivot.x, oz = c.z - pivot.z, s = Math.sin(yaw), co = Math.cos(yaw);
  const x = pivot.x + ox * co + oz * s, z = pivot.z - ox * s + oz * co;
  if (kind === 'cyl') return { kind, x, z, r: (Math.max(size.x, size.z) / 2) * fit, bottom: _box.min.y, top: _box.max.y };
  // colliders turn the other way round from three.js rotation.y
  return { kind, x, z, hx: (size.x / 2) * fit, hz: (size.z / 2) * fit, rot: -yaw, bottom: _box.min.y, top: _box.max.y };
}

/** Register one field object; returns its collider (null for 'none'). */
export function addFieldObject(world: ColliderWorld, def: FieldObjectDef): Collider | null {
  const spec = def.collider ?? 'box';
  if (spec === 'none') return null;
  let shape: ColliderShape;
  if (typeof spec === 'string') {
    if (!def.model) throw new Error(`field object ${def.id}: a fitted collider needs a model`);
    shape = colliderFromObject(def.model, spec, def.fit ?? 1);
  } else shape = spec;
  return world.add({
    id: def.id, ...shape,
    model: def.model, layer: def.layer, passable: def.passable, climbable: def.climbable,
    breakable: def.breakable, dynamic: def.dynamic, cameraIgnore: def.cameraIgnore, tags: def.tags,
  });
}

/** Breakable by the rules or by its tags (existing objects mark hard rock / walls with tags). */
export function isBreakable(c: Collider) {
  return c.breakable ?? !!c.tags?.some((t) => t === 'hard_rock' || t === 'breakable');
}
