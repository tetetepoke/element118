import Phaser from 'phaser';

/** ブレイクリング: a lump of matter whose bonds came undone during THE BREAK. */
export class Breakling extends Phaser.Physics.Arcade.Sprite {
  hp = 3;
  dead = false;
  id: string;
  homeX: number;
  homeY: number;
  stunnedUntil = 0;
  hitUntil = 0;
  lastSwingHit = -1;
  private wanderUntil = 0;
  private wanderVec = { x: 0, y: 0 };
  private lungeUntil = 0;
  private lungeCooldown = 0;
  /** Telegraph: the enemy flashes before it lunges, so phone players can react. */
  telegraphUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string) {
    super(scene, x, y, 'breakling', 0);
    this.id = id;
    this.homeX = x;
    this.homeY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 9);
    body.setOffset(9, 19);
    body.setCollideWorldBounds(true);
    this.play('breakling_move');
  }

  update(now: number, px: number, py: number) {
    if (this.dead) return;
    this.setDepth(this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (now < this.stunnedUntil) {
      body.velocity.scale(0.85);
      this.setFrame(3);
      return;
    }
    if (now < this.hitUntil) {
      body.velocity.scale(0.85);
      return;
    }
    if (this.anims.currentAnim?.key !== 'breakling_move' || !this.anims.isPlaying) this.play('breakling_move');
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const homeDist = Math.hypot(this.x - this.homeX, this.y - this.homeY);

    if (now < this.lungeUntil) return; // keep lunge velocity
    if (this.telegraphUntil && now < this.telegraphUntil) {
      body.velocity.scale(0.8);
      this.setTint(Math.floor(now / 60) % 2 ? 0xffffff : 0xff9a9a);
      return;
    }
    if (this.telegraphUntil && now >= this.telegraphUntil) {
      this.telegraphUntil = 0;
      this.clearTint();
      const len = dist || 1;
      this.setVelocity((dx / len) * 150, (dy / len) * 150);
      this.lungeUntil = now + 300;
      this.lungeCooldown = now + 1400;
      return;
    }
    if (dist < 110 && homeDist < 150) {
      if (dist < 46 && now > this.lungeCooldown) {
        this.telegraphUntil = now + 420;
        this.setVelocity(0, 0);
        return;
      }
      const len = dist || 1;
      this.setVelocity((dx / len) * 42, (dy / len) * 42);
      this.setFlipX(dx < 0);
    } else {
      if (now > this.wanderUntil) {
        this.wanderUntil = now + 900 + Math.random() * 1200;
        const back = homeDist > 60;
        const a = back ? Math.atan2(this.homeY - this.y, this.homeX - this.x) : Math.random() * Math.PI * 2;
        const sp = Math.random() < 0.3 && !back ? 0 : 22;
        this.wanderVec = { x: Math.cos(a) * sp, y: Math.sin(a) * sp };
      }
      this.setVelocity(this.wanderVec.x, this.wanderVec.y);
    }
  }

  takeHit(fromX: number, fromY: number, now: number, dmg: number): boolean {
    this.hp -= dmg;
    this.hitUntil = now + 220;
    this.telegraphUntil = 0;
    this.clearTint();
    this.setFrame(2);
    this.anims.stop();
    const dx = this.x - fromX, dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * 190, (dy / len) * 190);
    return this.hp <= 0;
  }

  stun(fromX: number, fromY: number, now: number) {
    this.stunnedUntil = now + 1200;
    this.telegraphUntil = 0;
    this.lungeUntil = 0;
    this.clearTint();
    const dx = this.x - fromX, dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * 240, (dy / len) * 240);
  }

  /** Only a lunging (or touching) enemy deals damage. */
  get dangerous() {
    return !this.dead && this.scene.time.now >= this.stunnedUntil && this.scene.time.now >= this.hitUntil;
  }
}
