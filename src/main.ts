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

// iOS Safari ignores user-scalable=no: block pinch / double-tap zoom so the screen never grows
// past the buttons, and re-fit the canvas whenever the visible area changes.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// Re-fit only when the page was zoomed (pinch that slipped through) or the phone was rotated.
// Phaser already follows normal window resizes.
let refitTimer = 0;
const refit = () => {
  clearTimeout(refitTimer);
  refitTimer = window.setTimeout(() => {
    if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01) window.scrollTo(0, 0);
    game.scale.refresh();
  }, 150);
};
window.visualViewport?.addEventListener('resize', () => {
  if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01) refit();
});
window.addEventListener('orientationchange', refit);

// for automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;
