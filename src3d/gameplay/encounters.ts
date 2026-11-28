import * as THREE from 'three';
import { bestStat, type Tool } from '../ch1/game/craft';
import type { Ground } from '../world/ground';
import type { Collider, ColliderWorld } from '../world/colliders';
import { TUNING } from '../player/controller';
import { CREATURES, type Encounter } from './wildlifeData';
import { WEAPONS } from './weaponTypes';

export interface EncounterSave {
  hp?: number;
  wildlifeMaterials?: string[];
  defeated?: Record<string, { remaining: number; drops: string[]; x?: number; z?: number }>;
}
interface CombatHost {
  scene: THREE.Scene;
  colliders: ColliderWorld;
  ground: Ground;
  sites: readonly Encounter[];
  state(): EncounterSave;
  pos: THREE.Vector3;
  facing(): number;
  aim(yaw: number): void;
  form(): string;
  tool(): Tool | null;
  grip(): THREE.Object3D;
  held(): THREE.Object3D | null;
  animation(length: number): void;
  loot(item: string): void;
  wear(): void;
  retreat(): void;
  save(): void;
}
const MAX_HP = 60;

export function encounters(host: CombatHost) {
  const { colliders, ground, pos, scene } = host;
  const shellGeo = new THREE.SphereGeometry(1, 9, 6);
  const footGeo = new THREE.CylinderGeometry(0.025, 0.04, 1, 5);
  const markerGeo = new THREE.RingGeometry(0.17, 0.28, 14);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xe4cc75, side: THREE.DoubleSide, depthWrite: false });
  const ui = document.createElement('div');
  ui.id = 'encounterStatus';
  ui.hidden = true;
  document.body.append(ui);
  const swish = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffd891 }));
  swish.visible = false;
  scene.add(swish);
  const enemies = host.sites.map(([id, species, x, z]) => {
    const def = CREATURES[species];
    const y = ground.heightAt(x, z);
    const home = new THREE.Vector3(x, y, z);
    const model = new THREE.Group();
    model.name = id;
    model.position.copy(home);
    const shell = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.69 });
    const eyes = new THREE.MeshStandardMaterial({ color: def.glow, emissive: def.glow, emissiveIntensity: 0.5 });
    const abdomen = new THREE.Mesh(shellGeo, shell);
    abdomen.scale.set(def.radius * 0.81, def.height * 0.44, def.radius * 0.76);
    abdomen.position.y = def.height * 0.51;
    model.add(abdomen);
    const head = new THREE.Mesh(shellGeo, shell);
    head.scale.set(def.radius * 0.49, def.height * 0.28, def.radius * 0.35);
    head.position.set(0, def.height * 0.49, def.radius * 0.50);
    model.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(shellGeo, eyes);
      eye.scale.setScalar(0.046);
      eye.position.set(side * def.radius * 0.18, def.height * 0.57, def.radius * 0.81);
      model.add(eye);
    }
    const legs: THREE.Mesh[] = [];
    for (const side of [-1, 1]) for (const zz of [-0.21, 0, 0.21]) {
      const foot = new THREE.Mesh(footGeo, shell);
      foot.scale.y = def.height * 0.57;
      foot.position.set(side * def.radius * 0.69, def.height * 0.19, zz);
      model.add(foot);
      legs.push(foot);
    }
    const area = new THREE.Mesh(
      new THREE.CircleGeometry(def.range + TUNING.radius, 24, -Math.PI / 2 - def.aim, 2 * def.aim).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffa557, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide }),
    );
    area.visible = false;
    area.position.y = 0.045;
    model.add(area);
    scene.add(model);
    const lootMarker = new THREE.Mesh(markerGeo, markerMat);
    lootMarker.visible = false;
    lootMarker.rotation.x = -Math.PI / 2;
    scene.add(lootMarker);
    const collider = colliders.add({ id, kind: 'cyl', x, z, r: def.radius, bottom: y, top: y + def.height,
      dynamic: true, climbable: false, cameraIgnore: true, model });
    collider.enabled = false;
    const usable = validGround(home) && colliders.penetration(x, z, y, def.radius, def.height, 0) < 0.01;
    collider.enabled = model.visible = usable;
    return { id, def, home, model, legs, area, lootMarker, shell, collider, usable, hp: def.hp as number, phase: 'idle' as 'idle' | 'warn' | 'recover', timer: 0, yaw: 0, t: 0 };
  });
  function validGround(p: THREE.Vector3) {
    return ground.waterAt(p.x, p.z) === null && (ground.ceilingAt?.(p.x, p.z) ?? Infinity) > p.y + 1.1;
  }
  const candidate = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const aim = new THREE.Vector3(), segment = new THREE.Vector3(), torso = new THREE.Vector3();
  const worldToGrip = new THREE.Quaternion();
  const shaftAxis = new THREE.Vector3(0, 1, 0);
  let activeState: EncounterSave | undefined;
  let attackDelay = 0, swing = 0, elapsed = 0, swingLength = 1, immunity = 0, safeTime = 0;
  let swingTool: Tool | null = null, connected = false;
  let swingTarget: typeof enemies[number] | undefined;

  const defeated = () => (host.state().defeated ??= {});
  const fallen = (e: typeof enemies[number]) => defeated()[e.id];
  const visible = (e: typeof enemies[number]) => e.usable && !fallen(e);
  function line(from: THREE.Vector3, to: THREE.Vector3, ignored?: Collider) {
    return colliders.sweep(from.x, from.y, from.z, to.x, to.y, to.z, 0.055,
      (shape) => !shape.passable && shape !== ignored && !enemies.some((e) => e.collider === shape)) > 0.999;
  }
  function sync(e: typeof enemies[number]) {
    const p = e.model.position;
    e.collider.x = p.x; e.collider.z = p.z; e.collider.bottom = p.y; e.collider.top = p.y + e.def.height;
    e.collider.enabled = visible(e);
    e.model.visible = e.collider.enabled;
  }
  function reset(e: typeof enemies[number]) {
    e.model.position.copy(e.home);
    e.hp = e.def.hp;
    e.phase = 'idle';
    e.timer = 0;
    e.area.visible = false;
    e.shell.emissive.setHex(0);
    e.lootMarker.visible = false;
    sync(e);
  }
  function stepEnemy(e: typeof enemies[number], x: number, z: number, dt: number) {
    const p = e.model.position;
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.08) return;
    const step = Math.min(0.11, e.def.speed * dt, d);
    candidate.set(p.x + dx / d * step, p.y, p.z + dz / d * step);
    const y = ground.heightAt(candidate.x, candidate.z);
    if (Math.abs(y - p.y) > step * 1.28 + 0.035 || candidate.distanceToSquared(e.home) > (e.def.leash + 2) ** 2) return;
    if (Math.hypot(pos.x - candidate.x, pos.z - candidate.z) < e.def.radius + TUNING.radius &&
        Math.abs(pos.y - y) < TUNING.height) return;
    candidate.y = y;
    if (!validGround(candidate)) return;
    e.collider.enabled = false;
    const blocked = colliders.penetration(candidate.x, candidate.z, y, e.def.radius, e.def.height, 0) > 0.002;
    e.collider.enabled = true;
    if (!blocked) {
      p.copy(candidate);
      e.model.rotation.y = Math.atan2(dx, dz);
      sync(e);
    }
  }
  function hurts(e: typeof enemies[number]) {
    const p = e.model.position;
    if (immunity > 0 || pos.y > p.y + e.def.height || pos.y + TUNING.height < p.y + 0.1) return false;
    const dx = pos.x - p.x, dz = pos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > e.def.range + TUNING.radius || dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw) < d * Math.cos(e.def.aim)) return false;
    return line(a.copy(p).setY(p.y + 0.35), b.copy(pos).setY(pos.y + 0.38));
  }
  function tickEnemy(e: typeof enemies[number], dt: number) {
    const p = e.model.position;
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    const onLevel = Math.abs(pos.y - p.y) < 1.35;
    if (d > 22) { if (e.phase !== 'idle' || e.hp !== e.def.hp) reset(e); return; }
    e.t += dt;
    e.timer -= dt;
    for (const [i, leg] of e.legs.entries()) leg.rotation.z = (i < 3 ? -1 : 1) * (0.82 + 0.24 * Math.sin(e.t * 10 + i * 1.9));
    if (e.phase === 'warn') {
      e.area.visible = true;
      e.shell.emissive.setHex(0x702702);
      e.shell.emissiveIntensity = 0.38 + 0.45 * Math.sin(e.t * 18) ** 2;
      if (e.timer > 0) return;
      e.shell.emissive.setHex(0);
      e.area.visible = false;
      e.phase = 'recover';
      e.timer = e.def.recovery;
      if (hurts(e)) {
        const state = host.state();
        state.hp = Math.max(0, (state.hp ?? MAX_HP) - Math.ceil(e.def.damage * (host.form() === 'sic' ? 0.45 : 1)));
        immunity = 0.85;
        if (state.hp === 0) {
          state.hp = MAX_HP;
          reset(e);
          host.retreat();
        } else host.save();
      }
      return;
    }
    if (e.timer > 0) return;
    e.phase = 'idle';
    if (!onLevel || d > e.def.detection || p.distanceTo(e.home) > e.def.leash) {
      stepEnemy(e, e.home.x, e.home.z, dt);
      return;
    }
    if (!line(a.copy(p).setY(p.y + 0.33), b.copy(pos).setY(pos.y + 0.45))) return;
    if (d <= e.def.range + 0.18) {
      e.yaw = Math.atan2(pos.x - p.x, pos.z - p.z);
      e.model.rotation.y = e.yaw;
      e.phase = 'warn'; e.timer = e.def.windup;
      return;
    }
    const flank = e.def.pattern === 'circle' ? 0.75 : 0;
    const rush = e.def.pattern === 'rush' ? 1.16 : 1;
    stepEnemy(e, pos.x + (pos.z - p.z) * flank / d, pos.z - (pos.x - p.x) * flank / d, dt * rush);
  }
  function combatTarget(max = 4) {
    let nearest: typeof enemies[number] | undefined;
    let best = max;
    for (const e of enemies) {
      if (!visible(e)) continue;
      const p = e.model.position;
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < best && Math.abs(pos.y - p.y) < 1.35) { nearest = e; best = d; }
    }
    return nearest;
  }
  function lootTarget() {
    return enemies.find((e) => {
      const saved = fallen(e);
      return saved?.drops.length && Math.hypot(pos.x - (saved.x ?? e.home.x), pos.z - (saved.z ?? e.home.z)) < 1.8
        && Math.abs(pos.y - ground.heightAt(saved.x ?? e.home.x, saved.z ?? e.home.z)) < 1.1;
    });
  }

  return {
    get attacking() { return swing > 0; },
    nearby() { return !!combatTarget(); },
    hasLoot() { return !!lootTarget(); },
    collect() {
      const e = lootTarget();
      if (!e) return false;
      const id = fallen(e).drops.shift()!;
      host.loot(id);
      host.save();
      return true;
    },
    attack() {
      const e = combatTarget();
      if (!e || attackDelay > 0) return false;
      swingTool = host.tool();
      swingTarget = e;
      swingLength = 0.61 / Math.max(0.45, swingTool?.stats.attackSpeed ?? 1);
      attackDelay = swingLength + 0.13;
      swing = swingLength;
      elapsed = 0;
      connected = false;
      const p = e.model.position;
      host.aim(Math.atan2(p.x - pos.x, p.z - pos.z));
      host.animation(swingLength);
      return true;
    },
    update(dt: number, paused: boolean) {
      const state = host.state();
      if (activeState !== state) {
        activeState = state;
        for (const e of enemies) reset(e);
        swing = attackDelay = immunity = safeTime = 0;
      }
      ui.hidden = paused || !combatTarget(6) && !lootTarget() && (state.hp ?? MAX_HP) === MAX_HP;
      if (paused) { swish.visible = false; return; }
      immunity -= dt;
      attackDelay -= dt;
      for (const e of enemies) {
        e.lootMarker.visible = false;
        const dead = fallen(e);
        if (!dead) { if (e.usable) tickEnemy(e, dt); continue; }
        const x = dead.x ?? e.home.x, z = dead.z ?? e.home.z;
        if (dead.drops.length && Math.hypot(pos.x - x, pos.z - z) < 9) {
          e.lootMarker.position.set(x, ground.heightAt(x, z) + 0.08, z);
          e.lootMarker.visible = true;
        }
        if (dead.drops.length || pos.distanceTo(e.home) < 9) continue;
        dead.remaining -= dt;
        if (dead.remaining <= 0) { delete defeated()[e.id]; reset(e); host.save(); }
      }
      const target = combatTarget(6);
      safeTime = target ? 0 : safeTime + dt;
      if (safeTime > 9 && (state.hp ?? MAX_HP) < MAX_HP) { state.hp = MAX_HP; host.save(); }
      const status = lootTarget() ? 'E／調べる：素材を拾う' : target ? `${target.def.label} ${target.hp}/${target.def.hp}${target.phase === 'warn' ? `　攻撃予備動作！ ${target.def.attack}` : ''}` : '';
      const text = `HP ${state.hp ?? MAX_HP}/${MAX_HP}　${status}`;
      if (ui.textContent !== text) ui.textContent = text;
      swish.visible = false;
      if (swing <= 0) return;
      swing -= dt;
      elapsed += dt;
      const q = elapsed / swingLength;
      if (q < 0.37 || (elapsed - dt) / swingLength >= 0.78 || host.tool() !== swingTool) return;
      const hand = host.grip();
      const weapon = host.held();
      hand.getWorldPosition(a);
      const tip = weapon?.userData.attackTip as THREE.Vector3 | undefined;
      if (weapon?.parent && tip) {
        if (swingTarget && visible(swingTarget)) {
          const target = swingTarget.model.position;
          aim.copy(target).setY(target.y + swingTarget.def.height * 0.55).sub(a).normalize();
          if (aim.lengthSq() > 0.001) {
            weapon.parent.getWorldQuaternion(worldToGrip).invert();
            weapon.quaternion.setFromUnitVectors(shaftAxis, aim.applyQuaternion(worldToGrip));
          }
        }
        weapon.localToWorld(b.copy(tip));
      }
      else if (weapon) weapon.localToWorld(b.set(0, Math.min(1.05, (swingTool?.stats.reach ?? 1) * 0.55), 0));
      else {
        const yaw = host.facing();
        b.copy(a).add(aim.set(Math.sin(yaw) * 0.32, 0, Math.cos(yaw) * 0.32));
      }
      swish.position.copy(b);
      swish.visible = true;
      if (connected) return;
      segment.copy(b).sub(a);
      torso.copy(pos).setY(pos.y + 0.38);
      for (const e of enemies) {
        if (!visible(e)) continue;
        const p = e.model.position;
        if (p.distanceToSquared(pos) > 9) continue;
        const horizontalLength = segment.x ** 2 + segment.z ** 2;
        const on = THREE.MathUtils.clamp(((p.x - a.x) * segment.x + (p.z - a.z) * segment.z) / Math.max(horizontalLength, 1e-6), 0, 1);
        c.copy(a).addScaledVector(segment, on);
        if (Math.hypot(c.x - p.x, c.z - p.z) > e.def.radius + 0.16 || c.y < p.y - 0.09 || c.y > p.y + e.def.height + 0.12) continue;
        c.set(p.x, THREE.MathUtils.clamp(c.y, p.y + 0.12, p.y + e.def.height), p.z);
        if (!line(a, c, e.collider) || !line(torso, c, e.collider)) continue;
        connected = true;
        const style = swingTool?.design.kind ? WEAPONS[swingTool.design.kind].stat : swingTool ? bestStat(swingTool.stats) : 'impact';
        const power = Math.max(2, (swingTool?.stats.attack ?? (host.form() === 'sic' ? 10 : 5)) - e.def.armor);
        e.hp = Math.max(0, e.hp - Math.round(power * (e.def.weakness === style ? 1.45 : 1) + (swingTool?.design.head === 'cave_fang' && e.def.armor > 1 ? 2 : 0)));
        if (swingTool) host.wear();
        if (e.hp === 0) {
          defeated()[e.id] = { remaining: e.def.respawn, drops: e.def.drops.filter(([, odds]) => Math.random() < odds).map(([item]) => item), x: p.x, z: p.z };
          e.phase = 'idle'; e.timer = 0; e.area.visible = false;
          sync(e);
          host.save();
        }
        break;
      }
    },
  };
}
