import Phaser from 'phaser';
import './style.css';
import { MOVE, VIEW_H, VIEW_W } from './config/game';
import { BootScene } from './scenes/BootScene';
import { SandboxScene } from './scenes/SandboxScene';
import { SpriteViewerScene } from './scenes/SpriteViewerScene';
import { HudScene } from './scenes/HudScene';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { loadFonts } from './art/fonts';
import { loadBindings } from './input/bindings';
import { installRawInput } from './input/RawInput';

// 폰트 + 저장된 키 설정을 먼저 불러온다
await Promise.all([loadFonts(), loadBindings()]);

const game = new Phaser.Game({
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
  disableContextMenu: true, // 우클릭 = 대시
  // MenuScene 은 맨 뒤 → 다른 씬 위에 그려진다
  scene: [BootScene, TitleScene, SandboxScene, HudScene, SpriteViewerScene, MenuScene],
});

// Phaser 의 키보드·마우스 리스너(BOOT 때 붙음)보다 뒤에 붙여야 Phaser 가 먼저 이벤트를 처리한다
game.events.once(Phaser.Core.Events.READY, () => installRawInput());
