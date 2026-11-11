/**
 * 이펙트 재생 헬퍼. M1 에서 오브젝트 풀 기반 FxManager 로 교체 예정 (인터페이스는 유지).
 */
import Phaser from 'phaser';
import { DEPTH, VIEW_H, VIEW_W } from '../config/game';

export interface FxOpts {
  flip?: boolean;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  depth?: number;
  /** 가산 블렌드 (빛나는 이펙트) */
  add?: boolean;
  tint?: number;
  angle?: number;
  origin?: [number, number];
  alpha?: number;
}

/** 프레임 애니 이펙트를 한 번 재생하고 자동 삭제 */
export function playFx(scene: Phaser.Scene, key: string, x: number, y: number, o: FxOpts = {}): Phaser.GameObjects.Sprite {
  const s = scene.add.sprite(x, y, key, '0').setDepth(o.depth ?? DEPTH.fx);
  if (o.origin) s.setOrigin(o.origin[0], o.origin[1]);
  if (o.flip) s.setFlipX(true);
  s.setScale(o.scaleX ?? o.scale ?? 1, o.scaleY ?? o.scale ?? 1);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  if (o.tint !== undefined) s.setTint(o.tint);
  if (o.angle) s.setAngle(o.angle);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);
  s.play(key).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  return s;
}

/** 일회성 파티클 폭발 */
export function burst(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  y: number,
  count: number,
  cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  depth: number = DEPTH.fx,
  add = false,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(x, y, texture, { ...cfg, emitting: false }).setDepth(depth);
  if (add) e.setBlendMode(Phaser.BlendModes.ADD);
  e.explode(count);
  scene.time.delayedCall(1800, () => e.destroy());
  return e;
}

/** 원형 글로우가 커지며 사라짐 */
export function glowPulse(scene: Phaser.Scene, x: number, y: number, tint: number, from: number, to: number, ms: number, alpha = 0.9, depth: number = DEPTH.fx): void {
  const g = scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(from).setAlpha(alpha).setDepth(depth);
  scene.tweens.add({ targets: g, scale: to, alpha: 0, duration: ms, ease: 'Quad.Out', onComplete: () => g.destroy() });
}

/** 화면 전체가 순간 밝아짐 (번개·강타) */
export function screenFlash(scene: Phaser.Scene, color = 0xffffff, alpha = 0.35, ms = 140): void {
  const r = scene.add
    .rectangle(0, 0, VIEW_W, VIEW_H, color, alpha)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH.flash)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
}

/** 8갈래 빛 폭발 */
export function flare(scene: Phaser.Scene, x: number, y: number, tint: number, scale = 1, depth: number = DEPTH.fxTop): void {
  playFx(scene, 'fx_flare', x, y, { add: true, tint, scale, depth });
}

/** 원형 충격파 고리 */
export function ringBurst(scene: Phaser.Scene, x: number, y: number, tint: number, scale = 1, depth: number = DEPTH.fxTop): void {
  playFx(scene, 'fx_ring_big', x, y, { add: true, tint, scale, depth });
}

/** 바닥에서 하늘로 솟는 빛기둥 */
export function beam(scene: Phaser.Scene, x: number, groundY: number, tint: number, sx = 1, sy = 1, depth: number = DEPTH.fx): void {
  playFx(scene, 'fx_beam', x, groundY, { add: true, tint, scaleX: sx, scaleY: sy, origin: [0.5, 1], depth });
}

/** 반짝이 방사 (빛 입자) */
export function sparkles(scene: Phaser.Scene, x: number, y: number, n: number, tint: number | number[], speed = 180, depth: number = DEPTH.fxTop): void {
  burst(
    scene,
    'fx_sparkle',
    x,
    y,
    n,
    { speed: { min: speed * 0.35, max: speed }, lifespan: { min: 220, max: 520 }, alpha: { start: 1, end: 0 }, tint },
    depth,
    true,
  );
}
