import Phaser from 'phaser';
import { makeAllPlaceholders, CARBON_ANIMS, CARBON_COLS } from '../assets/placeholders';
import { AssetManifest, queueOverrides, spriteDirections } from '../assets/manifest';
import { txt } from '../ui/widgets';
import { GAME_W, GAME_H } from '../config';

/** Loads optional real sprites, generates placeholders for the rest, and builds animations. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    txt(this, GAME_W / 2, GAME_H / 2, 'よみこみ中…', 32).setOrigin(0.5);
    // the single-file HTML build embeds its manifest (with data: URLs) instead of fetching it
    if (!(window as unknown as { __E118_MANIFEST?: unknown }).__E118_MANIFEST) this.load.json('assetManifest', 'assets/manifest.json');
  }

  create() {
    const embedded = (window as unknown as { __E118_MANIFEST?: AssetManifest }).__E118_MANIFEST;
    const manifest = (embedded ?? this.cache.json.get('assetManifest') ?? {}) as AssetManifest;
    const real = queueOverrides(this, manifest);
    const finish = () => {
      makeAllPlaceholders(this, real);
      this.buildAnims();
      this.scene.start('Title');
    };
    if (real.size) {
      this.load.once(Phaser.Loader.Events.COMPLETE, finish);
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => {
        console.warn('asset failed, using placeholder:', f.key);
        real.delete(f.key);
      });
      this.load.start();
    } else finish();
  }

  private buildAnims() {
    const a = this.anims;
    const rows8 = ['down', 'up', 'side', 'down_side', 'up_side'];
    const dirs = spriteDirections.carbon ?? 4;
    const rates: Record<string, number> = { idle: 2.5, walk: 9, attack: 16, dodge: 10, guard: 1, hurt: 1, bond: 4 };
    // 'carbon' = face showing, 'carbonm' = mask on (falls back to 'carbon' if not provided).
    // A 4-direction sheet may carry a 4th row 'side_left' so text on the mask is never mirrored.
    for (const [prefix, tex] of [['carbon', 'carbon'], ['carbonm', this.textures.exists('carbonm') ? 'carbonm' : 'carbon']]) {
      const rowCount = Math.floor((this.textures.get(tex).frameTotal - 1) / CARBON_COLS);
      const rows = dirs === 8 ? rows8 : rowCount >= 4 ? ['down', 'up', 'side', 'side_left'] : ['down', 'up', 'side'];
      rows.forEach((row, ri) => {
        for (const [name, cols] of Object.entries(CARBON_ANIMS)) {
          const key = `${prefix}_${name}_${row}`;
          if (a.exists(key)) a.remove(key);
          a.create({
            key,
            frames: cols.map((c) => ({ key: tex, frame: ri * CARBON_COLS + c })),
            frameRate: rates[name],
            repeat: name === 'attack' || name === 'hurt' ? 0 : -1,
          });
        }
      });
    }
    for (const k of ['hyde', 'oxy', 'elder', 'villager']) {
      // 4 frames = one row (down only); 12 frames = rows down / up / side
      const total = this.textures.get(k).frameTotal - 1;
      const dirRows = total >= 12 ? ['down', 'up', 'side'] : ['down'];
      dirRows.forEach((row, ri) => {
        a.create({ key: `${k}_idle_${row}`, frames: a.generateFrameNumbers(k, { frames: [ri * 4, ri * 4 + 1] }), frameRate: 2, repeat: -1 });
        a.create({ key: `${k}_walk_${row}`, frames: a.generateFrameNumbers(k, { frames: [ri * 4 + 2, ri * 4 + 3] }), frameRate: 6, repeat: -1 });
      });
      for (const row of ['up', 'side']) {
        if (!a.exists(`${k}_idle_${row}`)) {
          a.create({ key: `${k}_idle_${row}`, frames: a.generateFrameNumbers(k, { frames: [0, 1] }), frameRate: 2, repeat: -1 });
          a.create({ key: `${k}_walk_${row}`, frames: a.generateFrameNumbers(k, { frames: [2, 3] }), frameRate: 6, repeat: -1 });
        }
      }
      a.create({ key: `${k}_idle`, frames: a.generateFrameNumbers(k, { frames: [0, 1] }), frameRate: 2, repeat: -1 });
      a.create({ key: `${k}_walk`, frames: a.generateFrameNumbers(k, { frames: [2, 3] }), frameRate: 6, repeat: -1 });
    }
    a.create({ key: 'breakling_move', frames: a.generateFrameNumbers('breakling', { frames: [0, 1] }), frameRate: 4, repeat: -1 });
    a.create({ key: 'crystal_H_shine', frames: a.generateFrameNumbers('crystal_H', { frames: [0, 0, 0, 1] }), frameRate: 4, repeat: -1 });
    a.create({ key: 'crystal_O_shine', frames: a.generateFrameNumbers('crystal_O', { frames: [0, 0, 0, 1] }), frameRate: 4, repeat: -1 });
    a.create({ key: 'torch_lit', frames: a.generateFrameNumbers('torch', { frames: [1, 2, 3, 2] }), frameRate: 8, repeat: -1 });
    a.create({ key: 'flame_burn', frames: a.generateFrameNumbers('flame', { frames: [0, 1, 2, 3] }), frameRate: 9, repeat: -1 });
    a.create({ key: 'fog_drift', frames: a.generateFrameNumbers('fog', { frames: [0, 1, 2, 3] }), frameRate: 4, repeat: -1 });
    a.create({ key: 'savestone_glow', frames: a.generateFrameNumbers('savestone', { frames: [0, 1] }), frameRate: 2, repeat: -1 });
    a.create({ key: 'goal_bob', frames: a.generateFrameNumbers('goal', { frames: [0, 1] }), frameRate: 3, repeat: -1 });
    a.create({ key: 'slash_fx', frames: a.generateFrameNumbers('slash', { frames: [0, 1, 2] }), frameRate: 24, repeat: 0 });
  }
}
