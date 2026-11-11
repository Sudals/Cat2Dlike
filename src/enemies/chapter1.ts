/**
 * 1장 회색 뒷골목 적 (docs/GAME_PLAN.md §10.1). 체력·피해는 ×10 스케일.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { burst, glowPulse, playFx } from '../fx/fx';
import { ENEMY_SIZES } from '../art/sprites/enemies';
import { Enemy, type EnemyWorld } from './Enemy';

/** 시궁쥐: 무리로 몰려와 짧은 돌진 물기 */
export class Rat extends Enemy {
  private readonly speed = 85 + Math.random() * 30;

  constructor(world: EnemyWorld, x: number, y: number) {
    const s = ENEMY_SIZES.rat;
    super(world, x, y, { texture: 'enemy_rat', hp: 220, body: [18, 11], frameW: s.w, frameH: s.h, footY: s.foot, chip: 0x8a7a7a });
  }

  protected think(): void {
    const { dx, dist } = this.toPlayer();
    const b = this.sprite.body;
    switch (this.state) {
      case 'chase':
        this.face(dx);
        if (dist < 80 && this.cd <= 0 && this.grounded()) {
          b.setVelocityX(0);
          this.setState('tele', 0.32);
          this.telegraph(320);
          this.anim('tele');
          break;
        }
        b.setVelocityX(dist > 26 ? Math.sign(dx) * this.speed * this.speedMul() : 0);
        this.anim(Math.abs(b.velocity.x) > 5 ? 'run' : 'idle');
        break;
      case 'tele':
        if (this.stateT <= 0) {
          this.setState('lunge', 0.32);
          b.setVelocity(this.dir * 270, -150);
          this.anim('bite');
        }
        break;
      case 'lunge':
        this.strike(20, 14, 2, 2, 60);
        if (this.stateT <= 0) this.setState('recover', 0.5);
        break;
      case 'recover':
        if (this.grounded()) b.setVelocityX(b.velocity.x * 0.85);
        this.anim('idle');
        if (this.stateT <= 0) {
          this.cd = 1.1 + Math.random() * 0.7;
          this.setState('chase');
        }
        break;
    }
  }
}

/** 칼잡이 쥐: 다가와서 예고 후 단검 2연타 → 뒤로 물러남 */
export class RatThug extends Enemy {
  constructor(world: EnemyWorld, x: number, y: number) {
    const s = ENEMY_SIZES.thug;
    super(world, x, y, { texture: 'enemy_thug', hp: 480, body: [14, 30], frameW: s.w, frameH: s.h, footY: s.foot, chip: 0x8a8398 });
  }

  private slashFx(flipY: boolean): void {
    playFx(this.world.scene, 'fx_slash', this.x + this.dir * 8, this.bottom - 22, {
      flip: this.dir < 0,
      origin: [0.5, 26 / 48],
      tint: 0xff7a7a,
      scale: 0.8,
      depth: DEPTH.fx,
    }).setFlipY(flipY);
  }

  protected think(): void {
    const { dx, dist } = this.toPlayer();
    const b = this.sprite.body;
    switch (this.state) {
      case 'chase':
        this.face(dx);
        if (dist < 46 && this.cd <= 0 && this.grounded()) {
          b.setVelocityX(0);
          this.setState('tele', 0.45);
          this.telegraph(450);
          this.sprite.anims.stop();
          this.sprite.setFrame('attack_1');
          playFx(this.world.scene, 'fx_glint', this.x - this.dir * 4, this.bottom - 44, { add: true, depth: DEPTH.fxTop, tint: 0xff9090 });
          break;
        }
        b.setVelocityX(dist > 34 ? Math.sign(dx) * 70 * this.speedMul() : 0);
        this.anim(Math.abs(b.velocity.x) > 5 ? 'walk' : 'idle');
        break;
      case 'tele':
        if (this.stateT <= 0) {
          this.setState('slash1', 0.3);
          this.anim('attack', false);
          b.setVelocityX(this.dir * 60);
        }
        break;
      case 'slash1':
      case 'slash2':
        if (this.stateT < 0.2 && !this.hitDone) {
          if (this.stateT > 0.17) this.slashFx(this.state === 'slash2');
          this.strike(34, 30, -4, 6, 80);
        }
        if (this.stateT <= 0) {
          if (this.state === 'slash1') {
            this.setState('slash2', 0.3);
            this.anim('attack2', false);
            b.setVelocityX(this.dir * 60);
          } else {
            this.setState('recover', 0.45);
          }
        }
        break;
      case 'recover':
        b.setVelocityX(b.velocity.x * 0.85);
        if (this.stateT <= 0) {
          this.setState('back', 0.4);
          b.setVelocity(-this.dir * 170, -170);
          this.anim('jump');
        }
        break;
      case 'back':
        if (this.stateT <= 0 && this.grounded()) {
          this.cd = 1.3 + Math.random() * 0.6;
          this.setState('chase');
        }
        break;
    }
  }
}

/** 비둘기 폭격기: 머리 위로 날아와 폭탄 투하 → 독 웅덩이 */
export class Pigeon extends Enemy {
  private readonly hoverY: number;
  private readonly offset = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 30);
  private t = Math.random() * 10;

  constructor(world: EnemyWorld, x: number, y: number) {
    const s = ENEMY_SIZES.pigeon;
    super(world, x, y, { texture: 'enemy_pigeon', hp: 260, body: [18, 12], frameW: s.w, frameH: s.h, footY: s.foot, flying: true, chip: 0x9aa2b8 });
    this.hoverY = world.groundY - 140 - Math.random() * 40;
  }

  protected think(dt: number): void {
    this.t += dt;
    const p = this.world.player;
    const b = this.sprite.body;
    switch (this.state) {
      case 'chase': {
        const tx = p.x + this.offset * Math.cos(this.t * 0.7);
        const ty = this.hoverY + Math.sin(this.t * 3) * 8;
        b.setVelocity(Phaser.Math.Clamp((tx - this.x) * 2, -120, 120) * this.speedMul(), (ty - this.sprite.y) * 3);
        this.face(b.velocity.x);
        this.anim('fly');
        if (Math.abs(p.x - this.x) < 24 && this.cd <= 0) {
          b.setVelocity(0, 0);
          this.setState('tele', 0.4);
          this.telegraph(400);
          this.anim('tele');
        }
        break;
      }
      case 'tele':
        b.setVelocity(0, 0);
        if (this.stateT <= 0) {
          dropBomb(this.world, this.x, this.bottom + 2);
          this.cd = 2.4 + Math.random();
          this.setState('chase');
        }
        break;
    }
  }
}

/** 비둘기 폭탄: 떨어지며 직격 50, 바닥에 닿으면 2.6초 독 웅덩이 (0.45초마다 25) */
function dropBomb(world: EnemyWorld, x: number, y: number): void {
  const s = world.scene;
  const bomb = s.add.image(x, y, 'fx_poop').setDepth(DEPTH.enemy + 3);
  let vy = 40;
  const splat = () => {
    s.events.off(Phaser.Scenes.Events.UPDATE, step);
    bomb.destroy();
    spawnPuddle(world, x);
  };
  const step = (_t: number, ms: number) => {
    if (world.combat.isStopped()) return;
    const dt = Math.min(ms, 50) / 1000;
    vy += 700 * dt;
    bomb.y += vy * dt;
    if (Phaser.Geom.Intersects.RectangleToRectangle(new Phaser.Geom.Rectangle(x - 3, bomb.y - 3, 6, 6), world.player.bounds())) {
      world.damagePlayer(50, x);
      splat();
    } else if (bomb.y >= world.groundY - 2) splat();
  };
  s.events.on(Phaser.Scenes.Events.UPDATE, step);
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => s.events.off(Phaser.Scenes.Events.UPDATE, step));
}

export function spawnPuddle(world: EnemyWorld, x: number): void {
  const s = world.scene;
  const gy = world.groundY;
  const pud = s.add.sprite(x, gy + 1, 'fx_puddle', '0').setOrigin(0.5, 1).setDepth(DEPTH.splash + 1).play('fx_puddle');
  burst(s, 'fx_bubble', x, gy - 3, 12, { speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, gravityY: 300, lifespan: 400 }, DEPTH.fx);
  const bubbles = s.add
    .particles(x, gy - 2, 'fx_bubble', { x: { min: -12, max: 12 }, speedY: { min: -22, max: -8 }, lifespan: 500, frequency: 110, alpha: { start: 1, end: 0 } })
    .setDepth(DEPTH.fx);
  const zone = new Phaser.Geom.Rectangle(x - 15, gy - 8, 30, 8);
  let life = 2.6;
  let tick = 0;
  const step = (_t: number, ms: number) => {
    const dt = Math.min(ms, 50) / 1000;
    life -= dt;
    tick -= dt;
    if (tick <= 0 && Phaser.Geom.Intersects.RectangleToRectangle(zone, world.player.bounds())) {
      world.damagePlayer(25, x, { weak: true });
      tick = 0.45;
    }
    if (life <= 0) {
      s.events.off(Phaser.Scenes.Events.UPDATE, step);
      bubbles.stop();
      s.tweens.add({ targets: pud, alpha: 0, duration: 300, onComplete: () => pud.destroy() });
      s.time.delayedCall(600, () => bubbles.destroy());
    }
  };
  s.events.on(Phaser.Scenes.Events.UPDATE, step);
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => s.events.off(Phaser.Scenes.Events.UPDATE, step));
}

/** 떠돌이 들개: 짖기(감속) / 웅크렸다 3연속 물기 돌진 → 지쳐서 헐떡임 (공격 중 슈퍼아머) */
export class Hound extends Enemy {
  private barkCd = 1.5;
  private lunges = 0;

  constructor(world: EnemyWorld, x: number, y: number) {
    const s = ENEMY_SIZES.hound;
    super(world, x, y, { texture: 'enemy_hound', hp: 1300, body: [34, 20], frameW: s.w, frameH: s.h, footY: s.foot, heavy: true, chip: 0xa8784a });
  }

  protected superArmor(): boolean {
    return ['growl', 'bark', 'crouch', 'lunge', 'gap'].includes(this.state);
  }

  protected think(dt: number): void {
    const { dx, dist } = this.toPlayer();
    const b = this.sprite.body;
    this.barkCd -= dt;
    switch (this.state) {
      case 'chase':
        this.face(dx);
        if (dist < 230 && dist > 80 && this.barkCd <= 0 && this.grounded()) {
          b.setVelocityX(0);
          this.setState('growl', 0.55);
          this.telegraph(550);
          this.anim('growl');
        } else if (dist < 110 && this.cd <= 0 && this.grounded()) {
          b.setVelocityX(0);
          this.setState('crouch', 0.5);
          this.telegraph(500);
          this.anim('growl');
        } else {
          b.setVelocityX(dist > 44 ? Math.sign(dx) * 115 * this.speedMul() : 0);
          this.anim(Math.abs(b.velocity.x) > 5 ? 'run' : 'idle');
        }
        break;
      case 'growl':
        if (this.stateT <= 0) {
          this.setState('bark', 0.45);
          this.anim('bark');
          this.bark();
        }
        break;
      case 'bark':
        if (this.stateT <= 0) {
          this.barkCd = 6.5;
          this.setState('chase');
        }
        break;
      case 'crouch':
        if (this.stateT <= 0) {
          this.lunges = 0;
          this.lunge();
        }
        break;
      case 'lunge':
        this.strike(30, 18, 8, 4, 90);
        if (this.stateT <= 0) {
          b.setVelocityX(b.velocity.x * 0.3);
          if (++this.lunges < 3) this.setState('gap', 0.14);
          else {
            this.setState('tired', 1.0);
            this.anim('idle');
          }
        }
        break;
      case 'gap':
        if (this.stateT <= 0) this.lunge();
        break;
      case 'tired':
        b.setVelocityX(b.velocity.x * 0.85);
        if (this.stateT <= 0) {
          this.cd = 2.4;
          this.setState('chase');
        }
        break;
    }
  }

  private lunge(): void {
    this.face(this.toPlayer().dx);
    this.setState('lunge', 0.24);
    this.sprite.body.setVelocityX(this.dir * 320);
    this.anim('bite', false);
    playFx(this.world.scene, 'fx_dust', this.x - this.dir * 14, this.bottom, { flip: this.dir > 0, depth: DEPTH.fx });
  }

  private bark(): void {
    const s = this.world.scene;
    const hx = this.x + this.dir * 22;
    const hy = this.bottom - 26;
    for (let i = 0; i < 3; i++) {
      s.time.delayedCall(i * 90, () => playFx(s, 'fx_ring', hx, hy, { add: true, scale: 2 + i, tint: 0xff6a6a, depth: DEPTH.fxTop }));
    }
    glowPulse(s, hx, hy, 0xff6a6a, 0.6, 2.4, 300, 0.6);
    s.cameras.main.shake(160, 0.004);
    if (this.toPlayer().dist < 150) this.world.damagePlayer(40, this.x, { slow: 2200, weak: true });
  }
}
