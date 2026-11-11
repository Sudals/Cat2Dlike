import Phaser from 'phaser';
import './style.css';
import { MOVE, VIEW_H, VIEW_W } from './config/game';
import { BootScene } from './scenes/BootScene';
import { SandboxScene } from './scenes/SandboxScene';
import { SpriteViewerScene } from './scenes/SpriteViewerScene';
import { HudScene } from './scenes/HudScene';
import { TitleScene } from './scenes/TitleScene';
import { loadFonts } from './art/fonts';

await loadFonts();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#0d0b14',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: MOVE.gravity }, debug: false },
  },
  input: { gamepad: true },
  scene: [BootScene, TitleScene, SandboxScene, HudScene, SpriteViewerScene],
});
