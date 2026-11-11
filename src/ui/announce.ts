/**
 * 스킬명 콜아웃(머리 위) / 궁극기 컷인 배너
 */
import Phaser from 'phaser';
import { DEPTH, VIEW_W } from '../config/game';
import { FONT } from '../art/fonts';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function callout(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const t = scene.add
    .text(Math.round(x), Math.round(y), text, { fontFamily: FONT.body, fontSize: '11px', fontStyle: 'bold', color, stroke: '#140c1c', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.number + 1)
    .setScale(2);
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, y: t.y - 10, duration: 700, ease: 'Quad.Out' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 620, duration: 220, onComplete: () => t.destroy() });
}

/** 화면을 가로지르는 컷인: 띠 + 속도선 + 캐릭터 얼굴 확대 + 스킬명 */
export function cutIn(scene: Phaser.Scene, text: string, color: number, heroTexture: string): void {
  const cy = 118;
  const h = 64;
  const c = scene.add.container(VIEW_W, 0).setScrollFactor(0).setDepth(DEPTH.cutin);
  const band = scene.add.rectangle(0, cy, VIEW_W, h, 0x0a0612, 0.94).setOrigin(0, 0.5);
  const lines = Array.from({ length: 14 }, () => {
    const r = scene.add
      .rectangle(Math.random() * VIEW_W, cy - h / 2 + 4 + Math.random() * (h - 8), 30 + Math.random() * 90, 1, color, 0.25 + Math.random() * 0.4)
      .setOrigin(0, 0.5);
    scene.tweens.add({ targets: r, x: r.x - VIEW_W, duration: 300 + Math.random() * 200, repeat: -1 });
    return r;
  });
  const edgeTop = scene.add.rectangle(0, cy - h / 2, VIEW_W, 2, color).setOrigin(0, 0.5);
  const edgeBottom = scene.add.rectangle(0, cy + h / 2, VIEW_W, 2, color).setOrigin(0, 0.5);
  // 64x64 프레임 중 얼굴·어깨만 잘라 3배 확대
  const portrait = scene.add.image(150, cy + 4, heroTexture, 'attack_3').setScale(3).setCrop(14, 12, 44, 30);
  const sub = scene.add
    .text(VIEW_W - 40, cy - 18, 'ULTIMATE', { fontFamily: FONT.small, fontSize: '9px', color: hex(color) })
    .setOrigin(1, 0.5);
  const label = scene.add
    .text(VIEW_W - 40, cy + 6, text, { fontFamily: FONT.body, fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: hex(color), strokeThickness: 4 })
    .setOrigin(1, 0.5);
  c.add([band, ...lines, edgeTop, edgeBottom, portrait, sub, label]);

  scene.tweens.add({ targets: c, x: 0, duration: 170, ease: 'Cubic.Out' });
  scene.tweens.add({
    targets: c,
    x: -VIEW_W,
    delay: 720,
    duration: 170,
    ease: 'Cubic.In',
    onComplete: () => {
      lines.forEach((l) => scene.tweens.killTweensOf(l));
      c.destroy();
    },
  });
}
