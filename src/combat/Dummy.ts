/**
 * 훈련용 허수아비. 피격 반응(흰 섬광·흔들림·찌그러짐·지푸라기 파편), 상태이상 표시, 처치·부활 연출.
 */
import Phaser from 'phaser';
import { COMBAT, DEPTH } from '../config/game';
import { burst, playFx } from '../fx/fx';
import type { HitTarget, StatusKind } from './Target';

const STATUS_TINT: Record<StatusKind, number> = { burn: 0xffa070, shock: 0xe0c0ff, chill: 0x9fe8ff };
const STATUS_ORDER: readonly StatusKind[] = ['burn', 'shock', 'chill'];

export class Dummy implements HitTarget {
  readonly sprite: Phaser.GameObjects.Image;
  readonly gone = false; // 허수아비는 부활하므로 목록에서 빠지지 않는다
  readonly maxHp: number = COMBAT.dummyHp;
  hp: number = COMBAT.dummyHp;
  alive = true;
  burnTick = 0;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly status: Record<StatusKind, number> = { burn: 0, shock: 0, chill: 0 }; // 종료 시각(ms)
  private flashT = 0;
  private barT = 0;
  private shownHp: number = COMBAT.dummyHp; // 천천히 줄어드는 흰 잔상 바

  constructor(
    private readonly scene: Phaser.Scene,
    readonly homeX: number,
    readonly groundY: number,
  ) {
    this.sprite = scene.add.image(homeX, groundY, 'dummy').setOrigin(0.5, 1).setDepth(DEPTH.enemy);
    this.bar = scene.add.graphics().setDepth(DEPTH.enemy + 1);
    this.embers = scene.add
      .particles(0, 0, 'fx_ember', {
        x: { min: -8, max: 8 },
        y: { min: -12, max: 12 },
        speedY: { min: -55, max: -20 },
        speedX: { min: -12, max: 12 },
        lifespan: 520,
        frequency: 40,
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.enemy + 2);
  }

  get x(): number {
    return this.sprite.x;
  }
  get cy(): number {
    return this.sprite.y - 24;
  }
  get top(): number {
    return this.sprite.y - 46;
  }
  get bottom(): number {
    return this.sprite.y;
  }

  bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 11, this.top, 22, 46);
  }

  /** power: 타격 세기 (0.2 도트 피해 ~ 3 궁극기) */
  hit(dmg: number, dir: number, power: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.barT = 3;
    if (power >= 0.4) {
      this.flashT = 0.06 + Math.min(power, 3) * 0.02;
      this.sprite.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
      const tw = this.scene.tweens;
      tw.killTweensOf(this.sprite);
      this.sprite.setAngle(dir * Math.min(26, 8 + power * 6)).setScale(1 + 0.08 * power, 1 - 0.1 * Math.min(power, 2.5));
      tw.add({ targets: this.sprite, angle: 0, duration: 700, ease: 'Elastic.Out' });
      tw.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 240, ease: 'Back.Out' });
      burst(this.scene, Math.random() < 0.5 ? 'fx_straw' : 'fx_chip', this.x, this.cy, 3 + Math.round(power * 3), {
        angle: dir >= 0 ? { min: -70, max: 10 } : { min: 170, max: 250 },
        speed: { min: 60, max: 140 + power * 50 },
        gravityY: 520,
        lifespan: { min: 300, max: 650 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0.2 },
      });
    }
    if (this.hp <= 0) this.die();
  }

  applyStatus(kind: StatusKind, ms = 3000): void {
    if (this.alive) this.status[kind] = this.scene.time.now + ms;
  }

  has(kind: StatusKind): boolean {
    return this.status[kind] > this.scene.time.now;
  }

  private die(): void {
    this.alive = false;
    this.status.burn = this.status.shock = this.status.chill = 0;
    this.embers.emitting = false;
    this.bar.clear();
    const { x, cy } = this;
    for (const [dx, dy, s] of [[0, 10, 2], [-9, 16, 1], [9, 14, 1], [0, -4, 1]] as const) {
      playFx(this.scene, 'fx_dust', x + dx, cy + dy, { scale: s, depth: DEPTH.fx });
    }
    playFx(this.scene, 'fx_impact', x, cy, { scale: 2, add: true, depth: DEPTH.fxTop });
    for (const tex of ['fx_straw', 'fx_chip']) {
      burst(this.scene, tex, x, cy, 18, {
        angle: { min: 200, max: 340 },
        speed: { min: 80, max: 260 },
        gravityY: 520,
        lifespan: { min: 500, max: 1100 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0.2 },
      });
    }
    this.sprite.setVisible(false);
    this.scene.time.delayedCall(1600, () => this.respawn());
  }

  private respawn(): void {
    this.hp = this.shownHp = this.maxHp;
    this.alive = true;
    this.sprite.setVisible(true).setAngle(0).setScale(1, 0).setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    this.scene.tweens.add({ targets: this.sprite, scaleY: 1, duration: 320, ease: 'Back.Out' });
    playFx(this.scene, 'fx_dust', this.x, this.groundY, { scale: 2 });
  }

  update(dt: number): void {
    if (!this.alive) return;
    const now = this.scene.time.now;
    this.embers.setPosition(this.x, this.cy);
    this.embers.emitting = this.has('burn');

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    } else {
      const active = STATUS_ORDER.find((k) => this.has(k));
      if (active && Math.floor(now / (active === 'shock' ? 60 : 120)) % 2 === 0) this.sprite.setTint(STATUS_TINT[active]);
      else this.sprite.clearTint();
    }

    this.shownHp += (this.hp - this.shownHp) * Math.min(1, dt * 4);
    this.barT -= dt;
    this.bar.clear();
    if (this.barT > 0) {
      const w = 26;
      const bx = Math.round(this.x - w / 2);
      const by = Math.round(this.top - 6);
      this.bar.fillStyle(0x140c1c, 1).fillRect(bx - 1, by - 1, w + 2, 5);
      this.bar.fillStyle(0xffffff, 1).fillRect(bx, by, Math.round((w * this.shownHp) / this.maxHp), 3);
      this.bar.fillStyle(0xe8452a, 1).fillRect(bx, by, Math.round((w * this.hp) / this.maxHp), 3);
    }
  }
}
