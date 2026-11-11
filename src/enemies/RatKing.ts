/**
 * 1장 보스 — 쥐왕 '찍찍대제' (docs/GAME_PLAN.md §10.1)
 * 1페이즈: 굴러오기 / 쥐 분출 / 왕관 부메랑
 * 2페이즈 (체력 60%↓, 분노): + 점프 내려찍기(충격파·쥐 비)
 * 3페이즈 (체력 25%↓, 광폭): 더 빠르고 커짐, 내려찍기 자리에 독 웅덩이
 * 경직·넉백 없음. 모든 공격은 빨간 ! 로 예고.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { burst, glowPulse, playFx, ringBurst, screenFlash, sparkles } from '../fx/fx';
import { RATKING_FRAME } from '../art/sprites/boss';
import { Enemy, type EnemyWorld } from './Enemy';
import { spawnPuddle } from './chapter1';

type Pattern = 'roll' | 'spew' | 'crown' | 'slam';
const UPDATE = Phaser.Scenes.Events.UPDATE;

export class RatKing extends Enemy {
  phase = 1;
  readonly bossName = '쥐왕 찍찍대제';
  private queue: Pattern[] = [];
  private rollDir = 1;
  private rollDist = 0;
  private dustT = 0;
  private leftGround = false;

  constructor(world: EnemyWorld, x: number, y: number, hpMul = 1) {
    const f = RATKING_FRAME;
    super(world, x, y, { texture: 'enemy_ratking', hp: Math.round(18000 * hpMul), body: [96, 70], frameW: f.w, frameH: f.h, footY: f.foot, heavy: true, boss: true, chip: 0x8a7a7a, name: '쥐왕 찍찍대제' });
    this.setState('intro', 1.5);
    this.anim('roar');
    world.scene.cameras.main.shake(500, 0.01);
  }

  protected superArmor(): boolean {
    return true;
  }

  private get fast(): number {
    return this.phase >= 3 ? 1.35 : this.phase === 2 ? 1.12 : 1;
  }

  private pick(): Pattern {
    if (!this.queue.length) {
      const pool: Pattern[] = ['roll', 'spew', 'crown'];
      if (this.phase >= 2) pool.push('slam', 'roll');
      if (this.phase >= 3) pool.push('slam', 'spew');
      this.queue = Phaser.Utils.Array.Shuffle(pool);
    }
    return this.queue.pop()!;
  }

  private begin(p: Pattern): void {
    const b = this.sprite.body;
    b.setVelocityX(0);
    const t = (s: number) => s / this.fast;
    switch (p) {
      case 'roll':
        this.rollDir = Math.sign(this.toPlayer().dx) || 1;
        this.setState('tele_roll', t(0.75));
        this.telegraph(t(750));
        this.anim('tele');
        break;
      case 'spew':
        this.setState('tele_spew', t(0.55));
        this.telegraph(t(550));
        this.anim('tele');
        break;
      case 'crown':
        this.setState('tele_crown', t(0.55));
        this.telegraph(t(550));
        this.anim('roar');
        break;
      case 'slam':
        this.setState('tele_slam', t(0.65));
        this.telegraph(t(650));
        this.anim('tele');
        break;
    }
  }

  protected think(dt: number): void {
    const { dx, dist } = this.toPlayer();
    const b = this.sprite.body;
    const s = this.world.scene;

    // 페이즈 전환
    const ratio = this.hp / this.maxHp;
    if (this.state !== 'roar' && this.state !== 'air' && this.state !== 'roll' && ((this.phase === 1 && ratio < 0.6) || (this.phase === 2 && ratio < 0.25))) {
      this.phase++;
      this.roar();
      return;
    }

    switch (this.state) {
      case 'intro':
        if (this.stateT <= 0) {
          this.cd = 0.8;
          this.setState('chase');
        }
        break;
      case 'chase':
        b.setVelocityX(dist > 70 ? Math.sign(dx) * 40 * this.fast : 0);
        this.anim('idle');
        if (this.cd <= 0 && this.grounded()) this.begin(this.pick());
        break;

      // --- 굴러오기 ---
      case 'tele_roll':
        if (this.stateT <= 0) {
          this.setState('roll');
          this.rollDist = 0;
          playFx(s, 'fx_dust', this.x - this.rollDir * 40, this.bottom, { scale: 3, flip: this.rollDir > 0, depth: DEPTH.fx });
        }
        break;
      case 'roll': {
        const v = 280 * this.fast;
        b.setVelocityX(this.rollDir * v);
        this.sprite.angle += this.rollDir * 520 * this.fast * dt;
        this.rollDist += v * dt;
        this.dustT -= dt;
        if (this.dustT <= 0) {
          this.dustT = 0.07;
          playFx(s, 'fx_dust', this.x - this.rollDir * 30, this.bottom, { scale: 2, flip: this.rollDir > 0, depth: DEPTH.fx });
        }
        if (Phaser.Geom.Intersects.RectangleToRectangle(this.bounds(), this.world.player.bounds())) this.world.damagePlayer(Math.round(120 * this.dmgMul), this.x);
        const atWall = (this.rollDir < 0 && this.x < 80) || (this.rollDir > 0 && this.x > this.world.worldW - 80);
        if (atWall || this.rollDist > 470) {
          b.setVelocityX(0);
          s.tweens.add({ targets: this.sprite, angle: 0, duration: 260, ease: 'Back.Out' });
          if (atWall) {
            s.cameras.main.shake(260, 0.014);
            ringBurst(s, this.x + this.rollDir * 50, this.cy, 0xffb46a, 1.6);
            for (let i = 0; i < 2 + this.phase; i++) this.world.spawnMinion('rat', this.x + (Math.random() - 0.5) * 160, this.world.groundY - 200, 0, 0);
          }
          this.setState('recover', 1.0 / this.fast);
        }
        break;
      }

      // --- 쥐 분출 ---
      case 'tele_spew':
        if (this.stateT <= 0) {
          this.anim('roar');
          const n = 2 + this.phase;
          for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            this.world.spawnMinion('rat', this.x, this.top + 24, side * (90 + Math.random() * 160), -220 - Math.random() * 120);
          }
          burst(s, 'fx_chip', this.x, this.top + 26, 24, { speed: { min: 80, max: 240 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 700, tint: 0x8a7a7a });
          glowPulse(s, this.x, this.top + 26, 0xff6a5a, 0.6, 2.4, 300, 0.7);
          s.cameras.main.shake(200, 0.008);
          this.setState('recover', 0.9 / this.fast);
        }
        break;

      // --- 왕관 부메랑 ---
      case 'tele_crown':
        if (this.stateT <= 0) {
          this.throwCrown(Math.sign(dx) || 1);
          this.setState('crownwait', 2.6);
        }
        break;
      case 'crownwait':
        if (this.stateT <= 0) this.setState('recover', 0.5);
        break;

      // --- 점프 내려찍기 ---
      case 'tele_slam':
        if (this.stateT <= 0) {
          b.setVelocity(Phaser.Math.Clamp(dx * 1.6, -320, 320), -640);
          this.leftGround = false;
          this.setState('air', 3);
          playFx(s, 'fx_dust', this.x, this.bottom, { scale: 3, depth: DEPTH.fx });
        }
        break;
      case 'air':
        if (!this.grounded()) this.leftGround = true;
        else if (this.leftGround) this.slamImpact();
        if (this.stateT <= 0) this.setState('recover', 0.5);
        break;

      case 'recover':
        b.setVelocityX(b.velocity.x * 0.88);
        this.anim('idle');
        if (this.stateT <= 0) {
          this.cd = [1.5, 1.15, 0.8][this.phase - 1];
          this.setState('chase');
        }
        break;
      case 'roar':
        b.setVelocityX(0);
        if (this.stateT <= 0) this.setState('recover', 0.3);
        break;
    }
  }

  private slamImpact(): void {
    const s = this.world.scene;
    const x = this.x;
    const gy = this.bottom;
    this.sprite.body.setVelocityX(0);
    s.cameras.main.shake(380, 0.022);
    playFx(s, 'fx_shockwave', x, gy - 2, { add: true, scale: 2.8, tint: 0xff8a6a, depth: DEPTH.fxTop });
    ringBurst(s, x, gy - 20, 0xff8a6a, 2.4);
    glowPulse(s, x, gy - 10, 0xff6a5a, 1, 4, 400, 0.8);
    for (let i = -3; i <= 3; i++) playFx(s, 'fx_dust', x + i * 26, gy, { scale: 2.5, depth: DEPTH.fx });
    const { dist } = this.toPlayer();
    const p = this.world.player;
    const playerGrounded = p.bounds().bottom >= gy - 6;
    if (dist < 190 && playerGrounded) this.world.damagePlayer(Math.round(140 * this.dmgMul), x);
    for (let i = 0; i < this.phase - 1; i++) this.world.spawnMinion('rat', x + (Math.random() - 0.5) * 260, this.world.groundY - 220, 0, 0);
    if (this.phase >= 3) for (const o of [-70, 70]) spawnPuddle(this.world, x + o);
    this.setState('recover', 1.1 / this.fast);
  }

  /** 왕관 부메랑: 플레이어 쪽으로 날아갔다가 되돌아온다. 갈 때·올 때 한 번씩 맞을 수 있음 */
  private throwCrown(dir: number): void {
    const s = this.world.scene;
    const crown = s.add.image(this.x, this.top + 6, 'fx_crown').setDepth(DEPTH.fxTop).setScale(1.5);
    const glow = s.add.image(crown.x, crown.y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc94a).setScale(0.8).setAlpha(0.6).setDepth(DEPTH.fx);
    let t = 0;
    let hitOut = false;
    let hitBack = false;
    const sx = crown.x;
    const range = 330;
    const step = (_t: number, ms: number) => {
      if (this.world.combat.isStopped()) return;
      const dt = Math.min(ms, 50) / 1000;
      t += dt * this.fast;
      const out = t < 0.8;
      // 0~0.8초: 나감 (감속), 0.8~1.8초: 돌아옴 (가속)
      const k = out ? Math.sin((t / 0.8) * (Math.PI / 2)) : 1 - Math.sin(((t - 0.8) / 1.0) * (Math.PI / 2));
      crown.x = (out ? sx : this.alive ? this.x : sx) + dir * range * Math.max(0, k);
      crown.angle += dir * 900 * dt;
      glow.setPosition(crown.x, crown.y);
      const r = new Phaser.Geom.Rectangle(crown.x - 18, crown.y - 12, 36, 24);
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.world.player.bounds())) {
        if (out && !hitOut) hitOut = this.world.damagePlayer(Math.round(90 * this.dmgMul), crown.x);
        if (!out && !hitBack) hitBack = this.world.damagePlayer(Math.round(90 * this.dmgMul), crown.x);
      }
      if (t >= 1.8 || !this.alive) {
        s.events.off(UPDATE, step);
        sparkles(s, crown.x, crown.y, 12, [0xffffff, 0xffc94a], 160);
        crown.destroy();
        glow.destroy();
        if (this.alive && this.state === 'crownwait') this.setState('recover', 0.4);
      }
    };
    s.events.on(UPDATE, step);
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => s.events.off(UPDATE, step));
  }

  /** 페이즈 전환 포효 */
  private roar(): void {
    const s = this.world.scene;
    this.clearTeleAlert();
    this.setState('roar', 1.3);
    this.anim('roar');
    this.sprite.setAngle(0);
    this.world.announce(this.phase === 2 ? '찍찍대제가 분노했다!' : '찍찍대제가 광폭해졌다!', '#ff6a5a');
    screenFlash(s, 0xff3a2a, 0.25, 220);
    s.cameras.main.shake(900, 0.016);
    for (let i = 0; i < 3; i++) s.time.delayedCall(i * 180, () => ringBurst(s, this.x, this.cy, 0xff6a5a, 2 + i));
    sparkles(s, this.x, this.cy, 40, [0xffffff, 0xff6a5a], 300);
    if (this.phase >= 3) {
      this.baseScale = 1.15;
      s.tweens.add({ targets: this.sprite, scaleX: 1.15, scaleY: 1.15, duration: 400, ease: 'Back.Out' });
    }
    for (let i = 0; i < 2; i++) this.world.spawnMinion('rat', this.x + (i ? 80 : -80), this.world.groundY - 200, 0, 0);
  }

  private clearTeleAlert(): void {
    // 예고 중이던 공격은 취소 (telegraph 의 ! 는 시간이 지나면 스스로 사라짐)
    this.sprite.body.setVelocityX(0);
  }
}
