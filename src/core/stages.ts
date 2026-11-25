// Moving between stages. Stage 1 lives in the World scene, stage 2 in Valley.
import Phaser from 'phaser';
import { game } from './state';
import { VP } from '../data/valleyMap';

export function enterStage2(scene: Phaser.Scene, from: string) {
  const d = game.data;
  d.stage = 2;
  d.form = 'normal';
  const x = VP.start.x * 16 + 8, y = VP.start.y * 16 + 8;
  d.player.x = x;
  d.player.y = y;
  d.player.facing = 6;
  d.checkpoint = { x, y };
  d.player.hp = d.player.maxHp;
  game.save();
  scene.scene.stop('UI');
  scene.scene.stop(from);
  scene.scene.stop();
  scene.scene.start('Valley', { fresh: true });
}
