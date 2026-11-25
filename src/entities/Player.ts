import Phaser from 'phaser';
import { Facing, facingFromVector, facingVector, spriteRowFor } from '../core/facing';
import { spriteDirections } from '../assets/manifest';
import { input } from '../core/state';
import { sfx } from '../core/audio';

export type PState = 'normal' | 'attack' | 'dodge' | 'hurt' | 'locked';

const SPEED = 92;
const GUARD_SPEED = 38;
const DODGE_SPEED = 230;
const DODGE_TIME = 260;
const DODGE_COOLDOWN = 420;
const SWING_TIME = 210;
const COMBO_WINDOW = 260;
export const PERFECT_GUARD_MS = 180;

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Facing = Facing.S;
  st: PState = 'normal';
  guarding = false;
  invulnUntil = 0;
  private stateUntil = 0;
  private dodgeReadyAt = 0;
  private comboStep = 0;
  private comboUntil = 0;
  private dodgeVec = { x: 0, y: 0 };
  private stepTimer = 0;
  /** Set by World each swing: called with the hit circle. */
  onSwing?: (x: number, y: number, r: number, step: number) => void;
  onDust?: (x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'carbon', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 7);
    body.setOffset(11, 21);
    body.setCollideWorldBounds(true);
  }

  get feetY() {
    return this.y;
  }

  /** Shy: puts the mask on when people or enemies are close (World decides). */
  masked = false;
  private lastAnim = 'idle';

  private play8(name: string) {
    this.lastAnim = name;
    let [row, flip] = spriteRowFor(this.facing, spriteDirections.carbon ?? 4);
    const prefix = this.masked ? 'carbonm' : 'carbon';
    if (row === 'side' && flip && this.scene.anims.exists(`${prefix}_${name}_side_left`)) {
      row = 'side_left' as typeof row;
      flip = false;
    }
    this.setFlipX(flip);
    const key = `${prefix}_${name}_${row}`;
    const cur = this.anims.currentAnim?.key;
    if (cur === key) return;
    // swapping mask on/off mid-animation keeps the frame position
    const sameAnim = cur && cur.replace(/^carbonm?_/, '') === key.replace(/^carbonm?_/, '');
    const progress = sameAnim ? this.anims.getProgress() : 0;
    this.play(key, true);
    if (sameAnim && progress > 0) this.anims.setProgress(progress);
  }

  setMasked(v: boolean) {
    if (v === this.masked) return;
    this.masked = v;
    this.play8(this.lastAnim);
  }

  lock(v: boolean) {
    if (v) {
      this.st = 'locked';
      this.setVelocity(0, 0);
      this.guarding = false;
      this.play8('idle');
    } else if (this.st === 'locked') this.st = 'normal';
  }

  playBondPose() {
    this.play8('bond');
  }

  hurt(fromX: number, fromY: number, now: number) {
    this.st = 'hurt';
    this.stateUntil = now + 280;
    this.invulnUntil = now + 1000;
    const dx = this.x - fromX, dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * 170, (dy / len) * 170);
    this.play8('hurt');
    this.setTint(0xff8080);
    this.scene.time.delayedCall(180, () => this.clearTint());
  }

  update(now: number, locked: boolean) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    // blink while invulnerable
    this.setAlpha(now < this.invulnUntil && this.st !== 'dodge' ? (Math.floor(now / 70) % 2 ? 0.45 : 1) : 1);

    if (this.st === 'locked' || locked) {
      if (this.st !== 'locked') {
        this.setVelocity(0, 0);
        this.play8('idle');
      }
      input.clearEdges();
      return;
    }

    if (this.st === 'hurt') {
      body.velocity.scale(0.86);
      if (now >= this.stateUntil) this.st = 'normal';
      return;
    }

    if (this.st === 'dodge') {
      this.setVelocity(this.dodgeVec.x * DODGE_SPEED, this.dodgeVec.y * DODGE_SPEED);
      if (now >= this.stateUntil) {
        this.st = 'normal';
        this.setVelocity(0, 0);
      }
      return;
    }

    if (this.st === 'attack') {
      body.velocity.scale(0.7);
      if (input.attack) {
        input.attack = false;
        if (this.comboStep < 3 && now < this.comboUntil) this.queuedNext = true;
      }
      if (now >= this.stateUntil) {
        if (this.queuedNext && this.comboStep < 3) {
          this.queuedNext = false;
          this.swing(now);
        } else {
          this.st = 'normal';
          this.queuedNext = false;
        }
      }
      return;
    }

    // ── normal ──
    const mx = input.moveX, my = input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    this.guarding = input.guard;
    if (mag > 0.15) this.facing = facingFromVector(mx, my, this.facing);
    const speed = (this.guarding ? GUARD_SPEED : SPEED) * mag;
    const nx = mag > 0 ? mx / Math.hypot(mx, my) : 0, ny = mag > 0 ? my / Math.hypot(mx, my) : 0;
    this.setVelocity(nx * speed, ny * speed);

    if (input.dodge) {
      input.dodge = false;
      if (now >= this.dodgeReadyAt) {
        const v = mag > 0.15 ? { x: nx, y: ny } : facingVector(this.facing);
        this.dodgeVec = v;
        this.st = 'dodge';
        this.stateUntil = now + DODGE_TIME;
        this.dodgeReadyAt = now + DODGE_COOLDOWN;
        this.invulnUntil = Math.max(this.invulnUntil, now + DODGE_TIME);
        this.guarding = false;
        this.play8('dodge');
        sfx('swing');
        this.onDust?.(this.x, this.y);
        return;
      }
    }
    if (input.attack && !this.guarding) {
      input.attack = false;
      this.comboStep = now < this.comboUntil ? this.comboStep : 0;
      this.swing(now);
      return;
    }
    input.attack = false;

    if (this.guarding) this.play8('guard');
    else if (speed > 4) {
      this.play8('walk');
      this.stepTimer -= this.scene.game.loop.delta;
      if (this.stepTimer <= 0) {
        this.stepTimer = 300;
        sfx('step');
        if (Math.random() < 0.5) this.onDust?.(this.x, this.y);
      }
    } else this.play8('idle');
  }

  private queuedNext = false;

  private swing(now: number) {
    this.comboStep = (this.comboStep % 3) + 1;
    this.st = 'attack';
    this.stateUntil = now + SWING_TIME;
    this.comboUntil = now + SWING_TIME + COMBO_WINDOW;
    // nudge facing toward the stick direction if the player is holding one
    if (Math.hypot(input.moveX, input.moveY) > 0.3) this.facing = facingFromVector(input.moveX, input.moveY, this.facing);
    const v = facingVector(this.facing);
    this.setVelocity(v.x * 40, v.y * 40);
    this.play8('attack');
    this.anims.restart();
    sfx('swing');
    const reach = this.comboStep === 3 ? 17 : 14;
    this.onSwing?.(this.x + v.x * reach, this.y - 6 + v.y * reach, this.comboStep === 3 ? 15 : 12, this.comboStep);
  }

  /** True when the hit comes from the front (within ~100°). */
  facesToward(x: number, y: number): boolean {
    const v = facingVector(this.facing);
    const dx = x - this.x, dy = y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    return (v.x * dx + v.y * dy) / len > 0.35;
  }
}
