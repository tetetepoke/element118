import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { World } from './scenes/World';
import { UI } from './scenes/UI';
import { BondPanel } from './scenes/BondPanel';
import { Ceremony } from './scenes/Ceremony';
import { Codex } from './scenes/Codex';
import { Menu } from './scenes/Menu';
import { StageClear } from './scenes/StageClear';
import { Valley } from './scenes/Valley';
import { FormBond } from './scenes/FormBond';
import { PartySelect } from './scenes/PartySelect';
import { MapView } from './scenes/MapView';
import { Periodic } from './scenes/Periodic';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#14182a',
  antialias: false,
  roundPixels: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },
  scene: [Boot, Title, World, Valley, UI, BondPanel, Ceremony, Codex, Menu, StageClear, FormBond, PartySelect, MapView, Periodic],
});

// for automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;
