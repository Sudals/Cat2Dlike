/**
 * 적 공통 베이스: 상태 머신, 공격 예고(!), 공격 판정, 피격 경직·넉백·띄우기, 상태이상, 처치 연출
 * 규칙 (기획서 §10): 모든 공격은 예고한다 / 무거운 적은 공격 중 슈퍼아머
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { burst, glowPulse, playFx, sparkles } from '../fx/fx';
import type { Combat } from '../combat/Combat';
import type { HitTarget, StatusKind } from '../combat/Target';

export interface PlayerView {
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  bounds(): Phaser.Geom.Rectangle;
}

export interface DamageOpts {
  /** 이동 느려짐 (ms) */
  slow?: number;
  /** 약한 피해: 넉백·경직 없이 깜빡임만 (장판 등) */
  weak?: boolean;
}

/** 적이 바깥 세계와 주고받는 것 */
export interface EnemyWorld {
  readonly scene: Phaser.Scene;
  readonly combat: Combat;
  readonly groundY: number;
  readonly worldW: number;
  readonly player: PlayerView;
  damagePlayer(dmg: number, fromX: number, o?: DamageOpts): boolean;
  addColliders(sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): Phaser.Physics.Arcade.Collider[];
  /** 보스가 졸개를 부름 */
  spawnMinion(kind: 'rat', x: number, y: number, vx?: number, vy?: number): void;
  /** 아이템 떨어뜨리기 (kind 없으면 무작위) */
  dropItem(x: number, y: number, kind?: string): void;
  /** 화면 중앙 큰 글씨 알림 */
  announce(text: string, color?: string): void;
  onBossDefeated(boss: Enemy): void;
}

export interface EnemyConfig {
  texture: string;
  hp: number;
  body: [w: number, h: number];
  frameW: number;
  frameH: number;
  footY: number;
  flying?: boolean;
  /** 넉백 저항 */
  heavy?: boolean;
  /** 처치 시 파편 색 */
  chip: number;
  /** 보스: 경직·넉백 없음, 처치 시 연쇄 폭발 연출 */
  boss?: boolean;
  /** 이름 (보스 체력바 등) */
  name?: string;
}

const STATUS_TINT: Record<StatusKind, number> = { burn: 0xffa070, shock: 0xe0c0ff, chill: 0x9fe8ff };
const STATUS_ORDER: readonly StatusKind[] = ['burn', 'shock', 'chill'];

export abstract class Enemy implements HitTarget {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  maxHp: number;
  hp: number;
  alive = true;
  gone = false;
  burnTick = 0;
  elite = false;
  /** 공격 피해 배율 (엘리트 1.5) */
  protected dmgMul = 1;
  /** 기본 크기 (엘리트 1.25) — 찌그러짐 연출이 이 값으로 돌아온다 */
  protected baseScale = 1;
  private aura?: Phaser.GameObjects.Image;
  protected state = 'chase';
  protected stateT = 0;
  protected cd = 0;
  protected hitDone = false;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly status: Record<StatusKind, number> = { burn: 0, shock: 0, chill: 0 };
  private embers?: Phaser.GameObjects.Particles.ParticleEmitter;
  private alert?: Phaser.GameObjects.Image;
  private flashT = 0;
  private barT = 0;
  private shownHp: number;

  constructor(
    protected readonly world: EnemyWorld,
    x: number,
    y: number,
    protected readonly cfg: EnemyConfig,
  ) {
    const s = world.scene;
    this.sprite = s.physics.add.sprite(x, y, cfg.texture, 'hurt_0').setOrigin(0.5, cfg.footY / cfg.frameH).setDepth(DEPTH.enemy);
    const [bw, bh] = cfg.body;
    this.sprite.body.setSize(bw, bh, false).setOffset((cfg.frameW - bw) / 2, cfg.footY - bh);
    this.sprite.setCollideWorldBounds(true);
    if (cfg.flying) this.sprite.body.setAllowGravity(false);
    else this.colliders.push(...world.addColliders(this.sprite));
    this.hp = this.maxHp = this.shownHp = cfg.hp;
    this.bar = s.add.graphics().setDepth(DEPTH.enemy + 1);
    this.cd = 0.6 + Math.random() * 0.8;

    // 등장 연출: 보라 연기 + 쭉 솟아오름
    this.sprite.setScale(1, 0);
    s.tweens.add({ targets: this.sprite, scaleY: 1, duration: 280, ease: 'Back.Out' });
    playFx(s, 'fx_dust', x, y, { scale: 2, depth: DEPTH.fx });
    glowPulse(s, x, y - 14, 0xb98bff, 0.4, 1.8, 360, 0.8);
    this.anim('idle');
  }

  // ---- HitTarget ----
  get x(): number {
    return this.sprite.x;
  }
  get bottom(): number {
    return this.sprite.body.bottom;
  }
  get top(): number {
    return this.sprite.body.top - 2;
  }
  get cy(): number {
    return this.sprite.body.center.y;
  }

  bounds(): Phaser.Geom.Rectangle {
    const b = this.sprite.body;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  applyStatus(kind: StatusKind, ms = 3000): void {
    if (this.alive) this.status[kind] = this.world.scene.time.now + ms;
  }

  has(kind: StatusKind): boolean {
    return this.status[kind] > this.world.scene.time.now;
  }

  hit(dmg: number, dir: number, power: number, launch = 0): void {
    if (!this.alive) return;
    const s = this.world.scene;
    this.hp = Math.max(0, this.hp - dmg);
    this.barT = 4;
    if (power >= 0.4) {
      this.flashT = 0.06 + Math.min(power, 3) * 0.02;
      this.sprite.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
      const k = this.baseScale;
      const sq = this.cfg.boss ? 0.3 : 1;
      if (!this.cfg.boss) {
        s.tweens.killTweensOf(this.sprite);
        this.sprite.setAngle(0);
      }
      this.sprite.setScale(k * (1 + 0.1 * power * sq), k * (1 - 0.12 * Math.min(power, 2.5) * sq));
      s.tweens.add({ targets: this.sprite, scaleX: k, scaleY: k, duration: 200, ease: 'Back.Out' });
    }
    if (this.hp <= 0) {
      this.die(dir, power);
      return;
    }
    if (this.cfg.boss) return; // 보스는 밀리거나 경직되지 않는다
    const armored = this.superArmor() && power < 2.5 && !launch;
    if (armored || power < 0.4) return;
    const b = this.sprite.body;
    const kb = (70 + power * 80) * (this.cfg.heavy ? 0.35 : 1);
    b.setVelocityX((dir || 1) * kb);
    if (this.cfg.flying) b.setVelocityY(-40 * power);
    else if (launch) b.setVelocityY(-launch * (this.cfg.heavy ? 0.45 : 1));
    else if (power >= 2 && !this.cfg.heavy) b.setVelocityY(-150);
    this.clearAlert();
    this.setState('hurt', 0.2 + power * 0.08 + (launch ? 0.35 : 0));
    this.anim('hurt', false);
  }

  /** 슈퍼아머 (true 면 약한 타격에 경직되지 않음) */
  protected superArmor(): boolean {
    return false;
  }

  // ---- 하위 클래스용 도구 ----
  protected abstract think(dt: number): void;

  protected get dir(): number {
    return this.sprite.flipX ? -1 : 1;
  }

  protected face(dx: number): void {
    if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
  }

  protected toPlayer(): { dx: number; dy: number; dist: number } {
    const p = this.world.player;
    const dx = p.x - this.x;
    return { dx, dy: p.y - this.bottom, dist: Math.abs(dx) };
  }

  protected grounded(): boolean {
    const b = this.sprite.body;
    return b.blocked.down || b.touching.down;
  }

  protected anim(key: string, ignoreIfPlaying = true): void {
    this.sprite.anims.play(`${this.cfg.texture}_${key}`, ignoreIfPlaying);
  }

  protected setState(state: string, t = 0): void {
    this.state = state;
    this.stateT = t;
    this.hitDone = false;
  }

  protected speedMul(): number {
    return this.has('chill') ? 0.5 : 1;
  }

  /** 공격 예고: 머리 위 빨간 ! + 몸이 붉게 깜빡 */
  protected telegraph(ms: number): void {
    this.clearAlert();
    const s = this.world.scene;
    const a = s.add.image(this.x, this.top - 8, 'fx_alert').setOrigin(0.5, 1).setDepth(DEPTH.fxTop).setScale(2, 0.5);
    s.tweens.add({ targets: a, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.Out' });
    this.alert = a;
    s.time.delayedCall(ms, () => {
      if (this.alert === a) this.clearAlert();
    });
    this.flashT = 0;
  }

  private clearAlert(): void {
    this.alert?.destroy();
    this.alert = undefined;
  }

  /** 정면 사각형 공격 판정 (상태당 1회만 맞힘) */
  protected strike(w: number, h: number, ox: number, oy: number, dmg: number, o?: { slow?: number }): boolean {
    if (this.hitDone || !this.world.player.alive) return false;
    const r = new Phaser.Geom.Rectangle(this.dir > 0 ? this.x + ox : this.x - ox - w, this.bottom - oy - h, w, h);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(r, this.world.player.bounds())) return false;
    if (this.world.damagePlayer(Math.round(dmg * this.dmgMul), this.x, o)) this.hitDone = true;
    return this.hitDone;
  }

  /** 엘리트: 1.25배 크기, 체력 2.5배, 공격 1.5배, 금빛 기운 + 처치 시 아이템 */
  makeElite(): this {
    this.elite = true;
    this.baseScale = 1.25;
    this.maxHp = this.hp = this.shownHp = Math.round(this.maxHp * 2.5);
    this.dmgMul = 1.5;
    const s = this.world.scene;
    this.aura = s.add.image(this.x, this.cy, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc94a).setScale(1.2).setAlpha(0.5).setDepth(DEPTH.enemy - 1);
    s.tweens.add({ targets: this.aura, alpha: 0.25, scale: 1.4, duration: 600, yoyo: true, repeat: -1 });
    s.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(this.baseScale, 0);
    s.tweens.add({ targets: this.sprite, scaleY: this.baseScale, duration: 280, ease: 'Back.Out' });
    return this;
  }

  private die(dir: number, power: number): void {
    this.alive = false;
    this.clearAlert();
    this.bar.clear();
    this.embers?.stop();
    if (this.aura) {
      this.world.scene.tweens.killTweensOf(this.aura);
      this.aura.destroy();
    }
    if (this.elite) this.world.dropItem(this.x, this.cy);
    if (this.cfg.boss) {
      this.bossDeath();
      return;
    }
    const s = this.world.scene;
    const b = this.sprite.body;
    this.sprite.anims.stop();
    this.sprite.setFrame('hurt_0');
    this.colliders.forEach((c) => c.destroy());
    this.sprite.setCollideWorldBounds(false);
    b.setAllowGravity(true);
    b.setVelocity((dir || 1) * (170 + power * 50) * (this.cfg.heavy ? 0.6 : 1), -230 - power * 40);
    s.tweens.add({ targets: this.sprite, angle: (dir || 1) * 540, duration: 520 });
    s.time.delayedCall(460, () => {
      const x = this.sprite.x;
      const y = this.sprite.y - this.cfg.body[1] / 2;
      const big = this.cfg.heavy ? 2 : 1;
      for (const [dx, dy] of [[0, 0], [-8, 4], [8, 3]]) playFx(s, 'fx_dust', x + dx * big, y + dy, { scale: 2, depth: DEPTH.fx });
      playFx(s, 'fx_impact', x, y, { scale: 2, add: true, depth: DEPTH.fxTop });
      glowPulse(s, x, y, 0xb98bff, 0.6, 2 + big, 360, 0.7);
      sparkles(s, x, y, 14 * big, [0xffffff, 0xb98bff], 200);
      burst(s, 'fx_chip', x, y, 10 * big, {
        speed: { min: 60, max: 220 },
        angle: { min: 200, max: 340 },
        gravityY: 500,
        lifespan: { min: 400, max: 800 },
        rotate: { min: 0, max: 360 },
        tint: this.cfg.chip,
      });
      this.sprite.destroy();
      this.bar.destroy();
      this.embers?.destroy();
      this.gone = true;
    });
  }

  /** 보스 처치: 슬로모션 속에 몸 곳곳이 연달아 터지고 마지막에 대폭발 */
  private bossDeath(): void {
    const s = this.world.scene;
    const b = this.sprite.body;
    this.sprite.anims.play(`${this.cfg.texture}_hurt`);
    b.setVelocity(0, 0);
    this.world.combat.slowmo(0.3, 1400);
    s.cameras.main.shake(1600, 0.012);
    for (let i = 0; i < 9; i++) {
      s.time.delayedCall(i * 110, () => {
        const x = b.x + Math.random() * b.width;
        const y = b.y + Math.random() * b.height;
        playFx(s, 'fx_explosion', x, y, { scale: 1 + Math.random() * 0.8, depth: DEPTH.fxTop });
        playFx(s, 'fx_impact', x, y, { add: true, scale: 2, depth: DEPTH.fxTop });
        this.sprite.setTintMode(Phaser.TintModes.FILL).setTint(i % 2 ? 0xffffff : 0xff6a5a);
      });
    }
    s.time.delayedCall(1050, () => {
      const x = this.sprite.x;
      const y = this.cy;
      s.cameras.main.flash(500, 255, 255, 240);
      glowPulse(s, x, y, 0xffd08a, 2, 10, 900, 1, DEPTH.fxTop);
      sparkles(s, x, y, 80, [0xffffff, 0xffd08a, 0xb98bff], 420);
      burst(s, 'fx_chip', x, y, 50, { speed: { min: 100, max: 380 }, angle: { min: 190, max: 350 }, gravityY: 500, lifespan: { min: 600, max: 1200 }, rotate: { min: 0, max: 360 }, tint: this.cfg.chip });
      for (let i = -3; i <= 3; i++) playFx(s, 'fx_dust', x + i * 22, this.bottom, { scale: 3, depth: DEPTH.fx });
      this.world.onBossDefeated(this);
      this.sprite.destroy();
      this.bar.destroy();
      this.embers?.destroy();
      this.gone = true;
    });
  }

  update(dt: number): void {
    if (!this.alive) return;
    const s = this.world.scene;
    const now = s.time.now;
    this.aura?.setPosition(this.x, this.cy);

    // 상태이상 표시
    if (this.has('burn') && !this.embers) {
      this.embers = s.add
        .particles(0, 0, 'fx_ember', { x: { min: -8, max: 8 }, speedY: { min: -55, max: -20 }, lifespan: 500, frequency: 40, alpha: { start: 1, end: 0 } })
        .setDepth(DEPTH.enemy + 2);
    }
    if (this.embers) {
      this.embers.setPosition(this.x, this.cy);
      this.embers.emitting = this.has('burn');
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    } else if (this.alert) {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (Math.floor(now / 70) % 2) this.sprite.setTint(0xff7070);
      else this.sprite.clearTint();
    } else {
      const active = STATUS_ORDER.find((k) => this.has(k));
      if (active && Math.floor(now / (active === 'shock' ? 60 : 120)) % 2 === 0) this.sprite.setTint(STATUS_TINT[active]);
      else this.sprite.clearTint();
    }
    this.alert?.setPosition(this.x, this.top - 8);

    // 체력바
    this.shownHp += (this.hp - this.shownHp) * Math.min(1, dt * 4);
    this.barT -= dt;
    this.bar.clear();
    if (this.barT > 0 && !this.cfg.boss) {
      const w = Math.max(20, this.cfg.body[0] + 6);
      const bx = Math.round(this.x - w / 2);
      const by = Math.round(this.top - 5);
      this.bar.fillStyle(0x140c1c, 1).fillRect(bx - 1, by - 1, w + 2, 4);
      this.bar.fillStyle(0xffffff, 1).fillRect(bx, by, Math.round((w * this.shownHp) / this.maxHp), 2);
      this.bar.fillStyle(0xe8452a, 1).fillRect(bx, by, Math.round((w * this.hp) / this.maxHp), 2);
    }

    if (this.world.combat.isStopped()) return; // 히트스톱 중엔 생각도 멈춤
    this.stateT -= dt;
    this.cd -= dt;
    if (this.state === 'hurt') {
      const b = this.sprite.body;
      if (this.grounded() || this.cfg.flying) b.setVelocityX(b.velocity.x * 0.88);
      if (this.cfg.flying) b.setVelocityY(b.velocity.y * 0.9);
      if (this.stateT <= 0 && (this.grounded() || this.cfg.flying)) this.setState('chase');
      return;
    }
    this.think(dt);
  }
}
