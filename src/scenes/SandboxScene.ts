/**
 * 샌드박스 — 1장 뒷골목 전투 프로토타입
 * - 이동: 관성 걷기, 점프(코요테·버퍼·가변·2단), 대시(Shift·우클릭·이동키 두 번, 무적), 발판 통과
 * - 전투: 좌클릭 연타 3타 콤보(W+공격 = 위 공격), Q E R 스킬, F 궁극기 — 키는 키 설정(Esc 메뉴)에서 변경
 * - 목숨은 하나: 쓰러지면 게임 오버 → 처음부터
 * - 적: 1장 4종 웨이브 + 오른쪽 끝 연습용 허수아비
 * 1/2 키로 직업 전환. URL 해시: #autoplay(-mage) 자동 이동, #showcase(-mage) 스킬 시연 (스모크 테스트용)
 */
import Phaser from 'phaser';
import { Controls, type Action } from '../input/Controls';
import { raw } from '../input/RawInput';
import type { MenuData } from './MenuScene';
import { DEPTH, MOVE, TILE, VIEW_H, VIEW_W } from '../config/game';
import { ACTIVE_FRAME, COMBO_ANIMS, HERO_FOOT_Y, HERO_FRAME_H } from '../art/sprites/cat';
import { Combat, type HitTag } from '../combat/Combat';
import type { HitTarget } from '../combat/Target';
import { HERO_NAMES, SKILLS, type HeroKey, type SkillHost, type SkillSlot } from '../skills';
import { callout } from '../ui/announce';
import { burst, flare, glowPulse, playFx, ringBurst, screenFlash, sparkles } from '../fx/fx';
import type { HudScene, HudSource, HudState } from './HudScene';
import type { DamageOpts, Enemy, EnemyWorld } from '../enemies/Enemy';
import { eliteChance, isBossWave, spawnEnemy, waveAt } from '../enemies/waves';
import { RatKing } from '../enemies/RatKing';
import { Rat } from '../enemies/chapter1';
import { baseStats, type PlayerStats } from '../augments/stats';
import { rollAugments, type AugmentDef } from '../augments/augments';
import { ITEM_INFO, Pickup, randomItem, type ItemKind } from '../items/Pickup';

const WORLD_W = 1920;
const GROUND_Y = 328;
/** [x, y, 타일 수] 한 방향(위에서만) 충돌하는 발판 */
const PLATFORMS: readonly [number, number, number][] = [
  [200, 280, 5], [330, 240, 4], [480, 200, 3], [640, 270, 6], [860, 230, 4],
  [1040, 190, 5], [1260, 260, 4], [1450, 220, 5], [1660, 270, 6],
];
const DUMMY_X = [1730, 1810];
const SLOTS: readonly SkillSlot[] = ['skill1', 'skill2', 'skill3', 'ult'];
const MAX_HP: Record<HeroKey, number> = { blade: 1100, mage: 850 };
type ComboAnim = (typeof COMBO_ANIMS)[number];

/** 스킬 시연 타임라인 (초, 동작) */
const SHOWCASE: readonly [number, Action | 'mage' | 'blade'][] = [
  [1.6, 'skill1'], [2.6, 'attack'], [2.85, 'attack'], [3.1, 'attack'], [3.6, 'up'], [3.6, 'attack'], [4.6, 'skill3'], [5.2, 'attack'], [5.5, 'attack'],
  [6.3, 'skill2'], [7.6, 'ult'],
  [11.4, 'mage'], [11.8, 'skill1'], [13.0, 'up'], [13.0, 'attack'], [13.6, 'skill3'], [14.6, 'skill2'], [15.8, 'attack'], [16.1, 'attack'], [16.4, 'attack'], [17.0, 'ult'],
];

export class SandboxScene extends Phaser.Scene implements HudSource {
  private controls!: Controls;
  private cat!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private combat!: Combat;
  private host!: SkillHost;
  private world!: EnemyWorld;
  private ground!: Phaser.GameObjects.Zone;
  private readonly platforms: Phaser.GameObjects.Zone[] = [];
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private dimRect!: Phaser.GameObjects.Rectangle;
  private readonly platformTops: { x0: number; x1: number; y: number }[] = [];

  private hero: HeroKey = location.hash.includes('mage') ? 'mage' : 'blade';
  private readonly cd: Record<HeroKey, Record<SkillSlot, number>> = {
    blade: { skill1: 0, skill2: 0, skill3: 0, ult: 0 },
    mage: { skill1: 0, skill2: 0, skill3: 0, ult: 0 },
  };
  // 체력·피격
  private hp = MAX_HP[this.hero];
  private kills = 0;
  private gameOver = false;
  private dead = false;
  private invulnUntil = 0;
  private stunUntil = 0;
  private slowUntil = 0;
  // 콤보
  private attacking = false;
  private combo = 0;
  private comboQueued = false;
  private comboWindow = 0;
  private upUsed = false;
  private moveFxUntil = 0;
  // 증강·아이템·보스
  private stats: PlayerStats = baseStats();
  private readonly taken = new Set<string>();
  private pickups: Pickup[] = [];
  private itemT = 5;
  private frenzyUntil = 0;
  private augmentFor = 0;
  private boss?: RatKing;
  // 이동
  private lockUntil = 0;
  private wasLocked = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private airJumps = 1;
  private jumpCut = true;
  private dashT = 0;
  private dashCd = 0;
  private dashDir = 1;
  private afterimageT = 0;
  private dropT = 0;
  private wasGrounded = true;
  private fallPeak = 0;
  private runDustT = 0;
  // 웨이브
  private wave = 0;
  private waveEnemies: Enemy[] = [];
  private pendingSpawns = 0;
  private nextWaveT = 1.2;

  private readonly autoplay = location.hash.includes('autoplay');
  private readonly showcase = location.hash.includes('showcase');
  private autoT = 0;
  private autoDir = 1;
  private showcaseIdx = 0;
  private release: Action[] = [];
  /** Esc 를 눌렀음 → 다음 update 에서 일시정지 메뉴 */
  private wantMenu = false;

  constructor() {
    super('sandbox');
  }

  /** 시작·재시작(scene.restart) 때마다 호출 — 같은 씬 객체를 재사용하므로 상태를 처음으로 되돌린다 */
  init(): void {
    for (const h of ['blade', 'mage'] as const) for (const s of SLOTS) this.cd[h][s] = 0;
    this.hp = MAX_HP[this.hero];
    this.kills = 0;
    this.dead = false;
    this.gameOver = false;
    this.invulnUntil = 0;
    this.stunUntil = 0;
    this.slowUntil = 0;
    this.attacking = false;
    this.combo = 0;
    this.comboQueued = false;
    this.comboWindow = 0;
    this.upUsed = false;
    this.lockUntil = 0;
    this.wasLocked = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumps = 1;
    this.jumpCut = true;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.afterimageT = 0;
    this.dropT = 0;
    this.wasGrounded = true;
    this.fallPeak = 0;
    this.runDustT = 0;
    this.wave = 0;
    this.waveEnemies = [];
    this.pendingSpawns = 0;
    this.nextWaveT = 1.2;
    this.autoT = 0;
    this.autoDir = 1;
    this.showcaseIdx = 0;
    this.release = [];
    this.platforms.length = 0;
    this.platformTops.length = 0;
    this.stats = baseStats();
    this.taken.clear();
    this.pickups = [];
    this.itemT = 5;
    this.frenzyUntil = 0;
    this.augmentFor = 0;
    this.boss = undefined;
    this.wantMenu = false;
  }

  create(): void {
    // 슬로모션 도중 재시작돼도 시간 배율은 정상으로
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    this.physics.world.timeScale = 1;
    this.controls = new Controls(this);
    // Esc: 일시정지 메뉴 (메뉴가 열려 있으면 메뉴 쪽이 먼저 가져간다)
    const offEsc = raw.onPress((b) => {
      if (b !== 'Escape' || !this.sys.isActive() || this.dead) return false;
      this.wantMenu = true;
      return true;
    });
    // 메뉴·증강 선택에서 돌아오면 그동안 누른 키는 '새로 누름'으로 치지 않는다
    const onResume = () => this.controls.reset();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offEsc();
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });
    if (location.hash.includes('keys')) this.time.delayedCall(600, () => this.openMenu('keys')); // 테스트용
    this.combat = new Combat(this);
    this.combat.stats = this.stats;
    this.combat.onHit = (t, dmg, o) => this.onCombatHit(t, dmg, o.tag);
    this.combat.onKill = (t) => this.onCombatKill(t);
    if (location.hash.includes('augtest')) this.time.delayedCall(800, () => this.openAugments()); // 테스트용

    // --- 배경 (패럴랙스) ---
    this.add.image(0, 0, 'bg_sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    this.bgFar = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'bg_city_far').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bgFar);
    this.add
      .particles(0, 0, 'fx_rain', {
        x: { min: 0, max: VIEW_W + 120 },
        y: -8,
        speedY: { min: 380, max: 460 },
        speedX: { min: -70, max: -50 },
        rotate: 8,
        lifespan: 1000,
        quantity: 2,
        frequency: 16,
        alpha: { min: 0.25, max: 0.6 },
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.rain);
    this.bgNear = this.add.tileSprite(0, 24, VIEW_W, VIEW_H, 'bg_city_near').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bgNear);

    // --- 지형 ---
    this.physics.world.setBounds(0, -200, WORLD_W, VIEW_H + 200);
    this.add.tileSprite(0, GROUND_Y, WORLD_W, TILE, 'tile_brick_top').setOrigin(0).setDepth(DEPTH.ground);
    this.add.tileSprite(0, GROUND_Y + TILE, WORLD_W, VIEW_H - GROUND_Y - TILE, 'tile_brick_fill').setOrigin(0).setDepth(DEPTH.ground);
    this.ground = this.add.zone(WORLD_W / 2, (GROUND_Y + VIEW_H) / 2, WORLD_W, VIEW_H - GROUND_Y);
    this.physics.add.existing(this.ground, true);
    for (const [x, y, n] of PLATFORMS) {
      const w = n * TILE;
      this.add.tileSprite(x, y, w, TILE, 'tile_plank').setOrigin(0).setDepth(DEPTH.ground);
      const zone = this.add.zone(x + w / 2, y + 3, w, 6);
      this.physics.add.existing(zone, true);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.platforms.push(zone);
      this.platformTops.push({ x0: x, x1: x + w, y });
    }
    this.add
      .particles(0, GROUND_Y, 'fx_dot', {
        x: { min: 0, max: WORLD_W },
        speedY: { min: -70, max: -25 },
        speedX: { min: -30, max: 30 },
        gravityY: 400,
        lifespan: 280,
        quantity: 2,
        frequency: 30,
        alpha: { start: 0.8, end: 0 },
      })
      .setDepth(DEPTH.splash);

    // 암전 레이어 (배경만 어둡게). 카메라 줌 중에도 화면을 덮도록 크게
    this.dimRect = this.add
      .rectangle(-VIEW_W / 2, -VIEW_H / 2, VIEW_W * 2, VIEW_H * 2, 0x05030a, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(DEPTH.dim);

    for (const x of DUMMY_X) this.combat.addDummy(x, GROUND_Y);
    // #wave=N : N번째 웨이브부터 시작 (테스트용)
    // #hp=N : 시작 체력 지정 (테스트용)
    const hpTest = /hp=(\d+)/.exec(location.hash);
    if (hpTest) this.hp = Number(hpTest[1]);
    const startWave = Number(/wave=(\d+)/.exec(location.hash)?.[1] ?? 1);
    this.wave = Math.max(0, startWave - 1);

    // --- 주인공 ---
    this.cat = this.physics.add.sprite(this.showcase ? 236 : 160, GROUND_Y, `hero_${this.hero}`, 'idle_0');
    this.cat.setOrigin(0.5, HERO_FOOT_Y / HERO_FRAME_H).setDepth(DEPTH.hero);
    this.cat.body.setSize(14, 30, false).setOffset(25, HERO_FOOT_Y - 30);
    this.cat.body.setMaxVelocityY(MOVE.maxFall);
    this.cat.setCollideWorldBounds(true);
    this.physics.add.collider(this.cat, this.ground);
    this.physics.add.collider(this.cat, this.platforms, undefined, () => this.dropT <= 0);

    const animKey = (anim: Phaser.Animations.Animation) => anim.key.slice(`hero_${this.hero}_`.length);
    this.cat.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (!this.attacking) return;
      const k = animKey(anim);
      if (frame.textureFrame !== ACTIVE_FRAME[k]) return;
      if (k === 'upatk') this.onUpAttack();
      else this.onAttackActive(COMBO_ANIMS.indexOf(k as ComboAnim));
    });
    this.cat.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (!this.attacking) return;
      const k = animKey(anim);
      if (k === 'upatk') this.attacking = false;
      else if (COMBO_ANIMS.includes(k as ComboAnim)) this.onComboAnimEnd();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.setHero('blade'));
    kb.on('keydown-TWO', () => this.setHero('mage'));

    this.host = this.createHost();
    this.world = this.createWorld();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, VIEW_H);
    cam.startFollow(this.cat, true, 0.15, 0.15);
    cam.setDeadzone(60, 40);
    cam.fadeIn(400, 5, 3, 10);

    this.scene.launch('hud');
  }

  // ---------------------------------------------------------------------------
  // 연결부
  // ---------------------------------------------------------------------------
  private hud(): HudScene {
    return this.scene.get('hud') as HudScene;
  }

  hudState(): HudState {
    const cd = this.cd[this.hero];
    const sk = SKILLS[this.hero];
    return {
      hero: this.hero,
      bar: {
        cd: { attack: 0, skill1: cd.skill1, skill2: cd.skill2, skill3: cd.skill3, ult: 0, dash: Math.max(0, this.dashCd) },
        maxCd: {
          attack: 0,
          skill1: sk.skill1.cooldown * this.stats.cdMul,
          skill2: sk.skill2.cooldown * this.stats.cdMul,
          skill3: sk.skill3.cooldown * this.stats.cdMul,
          ult: 0,
          dash: MOVE.dashCooldown * this.stats.dashCdMul,
        },
        gauge: this.combat.gauge,
      },
      hp: this.hp,
      maxHp: this.maxHp(),
      kills: this.kills,
      boss: this.boss?.alive ? { name: this.boss.bossName, hp: this.boss.hp, maxHp: this.boss.maxHp, phase: this.boss.phase } : undefined,
      wave: this.wave,
      enemies: this.waveEnemies.filter((e) => e.alive).length + this.pendingSpawns,
    };
  }

  private createHost(): SkillHost {
    return {
      scene: this,
      hero: this.cat,
      combat: this.combat,
      groundY: GROUND_Y,
      worldW: WORLD_W,
      dir: () => (this.cat.flipX ? -1 : 1),
      lock: (ms) => this.lock(ms),
      afterimage: (x, y, tint) => this.afterimage(x, y, tint),
      callout: (text, color) => callout(this, this.cat.x, this.cat.y - 50, text, color),
      cutIn: (text, color) => this.hud().cutIn(text, color, `hero_${this.hero}`),
      speedlines: (ms, tint) => this.hud().speedlines(ms, tint),
      dim: (alpha, ms) => {
        this.tweens.killTweensOf(this.dimRect);
        this.tweens.add({ targets: this.dimRect, alpha, duration: ms });
      },
    };
  }

  private createWorld(): EnemyWorld {
    const cat = this.cat;
    const scene = this;
    return {
      scene: this,
      combat: this.combat,
      groundY: GROUND_Y,
      worldW: WORLD_W,
      player: {
        get x() {
          return cat.x;
        },
        get y() {
          return cat.y;
        },
        get alive() {
          return !scene.dead;
        },
        bounds: () => new Phaser.Geom.Rectangle(cat.body.x, cat.body.y, cat.body.width, cat.body.height),
      },
      damagePlayer: (dmg, fromX, o) => this.damagePlayer(dmg, fromX, o),
      addColliders: (s) => [this.physics.add.collider(s, this.ground), this.physics.add.collider(s, this.platforms)],
      spawnMinion: (_kind, x, y, vx = 0, vy = 0) => {
        if (this.waveEnemies.filter((e) => e.alive && !(e instanceof RatKing)).length >= 9) return;
        const e = this.combat.add(new Rat(this.world, Phaser.Math.Clamp(x, 30, WORLD_W - 30), y));
        e.sprite.body.setVelocity(vx, vy);
        this.waveEnemies.push(e);
      },
      dropItem: (x, y, kind) => this.spawnItem((kind as ItemKind | undefined) ?? randomItem(), x, true, y),
      announce: (text, color) => this.hud().banner(text, color),
      onBossDefeated: () => this.onBossDefeated(),
    };
  }

  // ---------------------------------------------------------------------------
  // 메인 루프
  // ---------------------------------------------------------------------------
  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (this.wantMenu) {
      this.wantMenu = false;
      this.openMenu();
      return;
    }
    if (this.autoplay) this.runAutoplay(dt);
    if (this.showcase) this.runShowcase(dt);

    const c = this.controls;
    c.update();
    const body = this.cat.body;
    const grounded = body.blocked.down || body.touching.down;
    const now = this.time.now;

    for (const h of ['blade', 'mage'] as const) for (const s of SLOTS) this.cd[h][s] = Math.max(0, this.cd[h][s] - dt);
    this.dashCd -= dt;
    this.dropT -= dt;
    this.comboWindow -= dt;
    this.combat.update(dt);
    this.updateBuffs(dt);
    this.updateItems(dt);
    this.updateWaves(dt);

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.15;
    this.bgNear.tilePositionX = cam.scrollX * 0.35;
    if (this.dead) {
      body.setVelocityX(body.velocity.x * 0.9);
      if (this.gameOver && c.pressed('jump')) this.scene.restart(); // Space: 처음부터 다시
      return;
    }

    const locked = now < this.lockUntil;
    const stunned = now < this.stunUntil;
    if (!locked && this.wasLocked) body.setAllowGravity(true);
    this.wasLocked = locked;
    this.cat.setAlpha(!locked && now < this.invulnUntil && Math.floor(now / 60) % 2 ? 0.4 : 1);

    if (grounded) {
      this.coyote = MOVE.coyoteTime;
      this.airJumps = 1 + this.stats.extraJumps;
      this.upUsed = false;
    } else {
      this.coyote -= dt;
    }
    this.jumpBuffer = c.pressed('jump') ? MOVE.jumpBuffer : this.jumpBuffer - dt;
    if (grounded && !this.wasGrounded) this.onLand(this.fallPeak);
    this.fallPeak = grounded ? 0 : Math.max(this.fallPeak, body.velocity.y);
    this.wasGrounded = grounded;

    if (locked) body.setVelocity(0, 0);
    else if (!stunned) for (const slot of SLOTS) if (c.pressed(slot)) this.tryCast(slot);

    if (this.time.now < this.lockUntil) {
      // 스킬이 위치·프레임을 직접 제어
    } else if (stunned) {
      if (grounded) body.setVelocityX(body.velocity.x * 0.85);
    } else if (this.dashT > 0) {
      this.dashT -= dt;
      body.setVelocity(this.dashDir * MOVE.dashSpeed, 0);
      this.afterimageT -= dt;
      if (this.afterimageT <= 0) {
        this.afterimage();
        this.afterimageT = 0.03;
      }
      if (this.dashT <= 0) {
        body.setAllowGravity(true);
        body.setVelocityX(this.dashDir * MOVE.runSpeed);
      }
      this.cat.setFlipX(this.dashDir < 0);
    } else {
      this.updateMovement(dt, grounded, now);
    }

    // 달리기 먼지
    if (grounded && Math.abs(body.velocity.x) > 150) {
      this.runDustT -= dt;
      if (this.runDustT <= 0) {
        this.puff(this.cat.x - Math.sign(body.velocity.x) * 6, this.cat.y, body.velocity.x > 0);
        this.runDustT = 0.16;
      }
    }

    if (stunned) this.cat.anims.play(`hero_${this.hero}_hurt`, true);
    else if (!this.attacking && this.time.now >= this.lockUntil) this.updateAnimation(grounded);
  }

  private updateMovement(dt: number, grounded: boolean, now: number): void {
    const c = this.controls;
    const body = this.cat.body;
    // 관성 이동: 출발은 밀어내듯 가속, 손을 떼면 미끄러지며 감속, 반대로 꺾으면 끼익 브레이크
    const speed = MOVE.runSpeed * this.stats.moveMul * (now < this.frenzyUntil ? 1.2 : 1) * (now < this.slowUntil ? 0.6 : 1);
    const target = this.attacking && grounded ? 0 : c.axisX * speed;
    const vx = body.velocity.x;
    const reversing = target !== 0 && vx !== 0 && Math.sign(target) !== Math.sign(vx);
    const rate = grounded
      ? target === 0
        ? MOVE.decelGround
        : reversing
          ? MOVE.turnGround
          : MOVE.accelGround
      : target === 0
        ? MOVE.decelAir
        : MOVE.accelAir;
    const step = rate * dt;
    const diff = target - vx;
    body.setVelocityX(Math.abs(diff) <= step ? target : vx + Math.sign(diff) * step);
    if (grounded && !this.attacking) this.moveFeel(vx, target, reversing);

    if (grounded && c.isDown('down') && this.jumpBuffer > 0 && this.isOnPlatform()) {
      this.dropT = 0.25;
      this.jumpBuffer = 0;
    } else if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.doJump(MOVE.jumpVelocity);
      this.puff(this.cat.x, this.cat.y);
    } else if (this.jumpBuffer > 0 && !grounded && this.airJumps > 0) {
      this.airJumps--;
      this.doJump(MOVE.doubleJumpVelocity);
      playFx(this, 'fx_ring', this.cat.x, this.cat.y, { depth: DEPTH.hero - 1 });
    }

    if (!this.jumpCut && !c.isDown('jump') && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * MOVE.jumpCutMultiplier);
      this.jumpCut = true;
    }

    // 기본 공격: 연타하면 3타 콤보 (공격 중 입력은 예약)
    if (c.pressed('attack')) {
      if (!this.attacking && c.isDown('up') && (grounded || !this.upUsed)) this.startUpAttack();
      else if (!this.attacking) this.startCombo(this.comboWindow > 0 ? (this.combo + 1) % 3 : 0);
      else this.comboQueued = true;
    }

    // 대시: Shift·우클릭 또는 같은 이동키 두 번
    if ((c.pressed('dash') || c.dashTap !== 0) && this.dashCd <= 0) {
      this.attacking = false;
      this.dashDir = c.dashTap !== 0 ? c.dashTap : c.axisX !== 0 ? Math.sign(c.axisX) : this.cat.flipX ? -1 : 1;
      this.dashT = MOVE.dashTime;
      this.dashCd = MOVE.dashCooldown * this.stats.dashCdMul;
      this.afterimageT = 0;
      this.invulnUntil = Math.max(this.invulnUntil, now + 140);
      body.setAllowGravity(false);
      this.cameras.main.shake(60, 0.002);
      this.hud().pulse('dash');
    }

    if (c.axisX !== 0 && !this.attacking) this.cat.setFlipX(c.axisX < 0);
  }

  /**
   * 이동 손맛: 출발할 때 뒤로 먼지를 차고 몸이 앞으로 쏠림, 멈출 때 미끄러지며 먼지 + 반동(찌그러졌다 복원),
   * 반대로 꺾을 때 끼익 먼지 + 찌그러짐. 같은 연출이 연달아 나지 않게 짧은 쿨타임.
   */
  private moveFeel(vx: number, target: number, reversing: boolean): void {
    const now = this.time.now;
    if (now < this.moveFxUntil) return;
    const fast = Math.abs(vx) > MOVE.runSpeed * 0.6;
    if (reversing && fast) {
      this.puff(this.cat.x + Math.sign(vx) * 6, this.cat.y, vx < 0);
      this.puff(this.cat.x + Math.sign(vx) * 12, this.cat.y, vx < 0);
      this.squash(1.18, 0.84);
      this.moveFxUntil = now + 220;
    } else if (target === 0 && fast) {
      this.puff(this.cat.x + Math.sign(vx) * 8, this.cat.y, vx < 0);
      this.squash(1.14, 0.88);
      this.moveFxUntil = now + 260;
    } else if (target !== 0 && Math.abs(vx) < 20) {
      this.puff(this.cat.x - Math.sign(target) * 8, this.cat.y, target > 0);
      this.squash(0.9, 1.1);
      this.moveFxUntil = now + 200;
    }
  }

  // ---------------------------------------------------------------------------
  // 기본 공격 콤보
  // ---------------------------------------------------------------------------
  private startCombo(step: number): void {
    const c = this.controls;
    if (c.axisX !== 0) this.cat.setFlipX(c.axisX < 0);
    this.attacking = true;
    this.combo = step;
    this.comboQueued = false;
    this.cat.play(`hero_${this.hero}_${COMBO_ANIMS[step]}`);
    this.hud().pulse('attack');
  }

  /** ↑+공격 시작 (검객 솟구쳐 찌르기는 공중에서 한 번만) */
  private startUpAttack(): void {
    const c = this.controls;
    if (c.axisX !== 0) this.cat.setFlipX(c.axisX < 0);
    this.attacking = true;
    this.comboWindow = 0;
    this.comboQueued = false;
    this.cat.play(`hero_${this.hero}_upatk`);
    this.hud().pulse('attack');
  }

  /** ↑+공격 타격 프레임: 검객 = 솟구치며 위로 찌르기 / 마법사 = 위로 별빛 탄 부채꼴 */
  private onUpAttack(): void {
    const dir = this.cat.flipX ? -1 : 1;
    const { x, y } = this.cat;
    const body = this.cat.body;
    if (this.hero === 'blade') {
      if (!(body.blocked.down || body.touching.down)) this.upUsed = true;
      body.setVelocity(dir * 50, -470);
      this.squash(0.8, 1.25);
      playFx(this, 'fx_thrust', x + dir * 2, y - 72, { add: true, angle: -90, depth: DEPTH.fxTop });
      playFx(this, 'fx_iai_line', x, y - 64, { add: true, angle: 90, scaleX: 0.7, scaleY: 1.5, tint: 0xffd08a, depth: DEPTH.fx });
      flare(this, x, y - 108, 0xffd08a, 1.1);
      glowPulse(this, x, y - 50, 0xffd08a, 0.5, 2, 260, 0.7);
      this.puff(x - 6, y, true);
      this.puff(x + 6, y);
      sparkles(this, x, y - 40, 20, [0xffffff, 0xffd08a], 220);
      const r = new Phaser.Geom.Rectangle(x - 22, y - 124, 44, 116);
      this.combat.hitRect(r, { coef: 1.3, dir, power: 1.8, launch: 430, hitstop: 70, shake: [90, 0.005], sparkScale: 1.3, gauge: 5 });
      return;
    }
    const ox = x + dir * 4;
    const oy = y - 58;
    playFx(this, 'fx_spark_magic', ox, oy, { add: true, scale: 1.6, depth: DEPTH.fxTop });
    flare(this, ox, oy, 0x7ff0ff, 0.9);
    for (const deg of [-90, -68, -112]) this.fireBolt(Phaser.Math.DegToRad(deg), false, ox, oy);
  }

  private onComboAnimEnd(): void {
    this.attacking = false;
    if (this.comboQueued && this.combo < 2) {
      this.startCombo(this.combo + 1);
      return;
    }
    this.comboWindow = this.combo < 2 ? 0.35 : 0;
  }

  /** 콤보 각 타의 타격 프레임 */
  private onAttackActive(step: number): void {
    const dir = this.cat.flipX ? -1 : 1;
    const { x, y } = this.cat;
    const body = this.cat.body;
    const grounded = body.blocked.down || body.touching.down;
    if (!grounded) body.setVelocityY(Math.min(body.velocity.y, -70)); // 공중 콤보: 살짝 떠 있기

    if (this.hero === 'blade') {
      if (step < 2) {
        // 1·2타: 크게 휘두르는 초승달 베기 (본 궤적 + 금빛 잔광 2겹), 범위 78x62
        const sx = x + dir * 16;
        playFx(this, 'fx_slash', sx, y - 26, { flip: dir < 0, origin: [0.5, 26 / 48], scale: 1.6, add: true, depth: DEPTH.fxTop }).setFlipY(step === 1);
        playFx(this, 'fx_slash', sx, y - 26, { flip: dir < 0, origin: [0.5, 26 / 48], scale: 2.1, alpha: 0.4, tint: 0xffd08a, add: true, depth: DEPTH.fx }).setFlipY(step === 1);
        burst(this, 'fx_sparkle', sx + dir * 14, y - 30, 10, { angle: dir > 0 ? { min: -60, max: 40 } : { min: 140, max: 240 }, speed: { min: 80, max: 220 }, lifespan: { min: 150, max: 320 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffd08a] }, DEPTH.fxTop, true);
        if (grounded) body.setVelocityX(dir * 130);
        const r = new Phaser.Geom.Rectangle(dir > 0 ? x - 8 : x - 70, y - 60, 78, 62);
        const hit = this.combat.hitRect(r, { coef: step ? 1.0 : 0.9, tag: 'basic', dir, power: step ? 1.5 : 1.3, hitstop: step ? 70 : 62, shake: [90, 0.005], sparkScale: 1.3, gauge: 4 });
        if (hit.length) flare(this, hit[0].x, hit[0].cy, 0xffd08a, 0.7);
      } else {
        // 3타: 길게 뻗는 돌진 찌르기 (120px), 끝에서 빛 폭발 + 짧은 슬로모션
        playFx(this, 'fx_thrust', x + dir * 62, y - 22, { flip: dir < 0, scaleX: 1.4, scaleY: 1.7, add: true, depth: DEPTH.fxTop });
        playFx(this, 'fx_thrust', x + dir * 62, y - 22, { flip: dir < 0, scaleX: 1.5, scaleY: 3.4, alpha: 0.35, tint: 0xffd08a, add: true, depth: DEPTH.fx });
        flare(this, x + dir * 122, y - 22, 0xffd08a, 1.2);
        glowPulse(this, x + dir * 40, y - 22, 0xffd08a, 0.6, 2.4, 260, 0.75);
        if (grounded) body.setVelocityX(dir * 320);
        const r = new Phaser.Geom.Rectangle(dir > 0 ? x : x - 124, y - 48, 124, 44);
        const hit = this.combat.hitRect(r, { coef: 1.6, tag: 'basic', dir, power: 2.6, hitstop: 110, shake: [150, 0.01], sparkScale: 1.6, gauge: 6 });
        if (hit.length) {
          ringBurst(this, hit[0].x, hit[0].cy, 0xffd08a, 1);
          this.combat.slowmo(0.5, 110);
        }
      }
      return;
    }
    this.fireBolt(dir > 0 ? 0 : Math.PI, step === 2);
  }

  /** 마법사 별빛 탄 (angle 방향으로 비행). big = 3타: 관통하는 큰 별 */
  private fireBolt(angle: number, big: boolean, ox?: number, oy?: number): void {
    const facing = this.cat.flipX ? -1 : 1;
    const dir = Math.abs(Math.cos(angle)) > 0.3 ? Math.sign(Math.cos(angle)) : facing;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    const bx = ox ?? this.cat.x + dir * 26;
    const by = oy ?? this.cat.y - 18;
    playFx(this, 'fx_spark_magic', bx, by, { add: true, scale: big ? 2 : 1, depth: DEPTH.fxTop });
    const bolt = this.add.sprite(bx, by, 'fx_bolt').setDepth(DEPTH.fxTop).setBlendMode(Phaser.BlendModes.ADD).setScale(big ? 2.5 : 1.5).play('fx_bolt');
    const halo = this.add.image(bx, by, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7ff0ff).setScale(big ? 0.8 : 0.4).setAlpha(0.8).setDepth(DEPTH.fx);
    const trail = this.add
      .particles(0, 0, 'fx_sparkle', { follow: bolt, speed: { min: 4, max: big ? 50 : 24 }, lifespan: 360, frequency: big ? 10 : 20, alpha: { start: 1, end: 0 } })
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.fx);
    const hitSet = new Set<HitTarget>();
    let traveled = 0;
    const range = big ? 320 : 260;
    const step = (_t: number, ms: number) => {
      if (this.combat.isStopped()) return;
      const d = (big ? 300 : 360) * (Math.min(ms, 50) / 1000);
      bolt.x += vx * d;
      bolt.y += vy * d;
      halo?.setPosition(bolt.x, bolt.y);
      traveled += d;
      const r = big ? 12 : 8;
      const target = this.combat.alive().find((t) => {
        if (hitSet.has(t)) return false;
        const b = t.bounds();
        return bolt.x > b.x - r && bolt.x < b.right + r && bolt.y > b.y - r && bolt.y < b.bottom + r;
      });
      if (target) {
        hitSet.add(target);
        this.combat.hit(target, { coef: big ? 1.6 : 0.8, tag: 'basic', element: 'moon', dir, power: big ? 2 : 1.2, hitstop: big ? 80 : 55, shake: [80, 0.004], spark: null, gauge: 4 });
        playFx(this, 'fx_spark_magic', bolt.x, bolt.y, { add: true, scale: big ? 2.4 : 1.8, depth: DEPTH.fxTop });
        ringBurst(this, bolt.x, bolt.y, 0x7ff0ff, big ? 1.2 : 0.7);
        // 터지면서 주변 적에게 튀김 피해
        for (const o of this.combat.alive()) {
          if (hitSet.has(o) || Math.hypot(o.x - bolt.x, o.cy - bolt.y) > (big ? 48 : 34)) continue;
          hitSet.add(o);
          this.combat.hit(o, { coef: big ? 0.8 : 0.4, tag: 'basic', element: 'moon', power: 0.9, spark: null, gauge: 1 }, bolt.x);
        }
        if (!big) traveled = range; // 작은 탄은 첫 대상에서 터짐
      }
      if (traveled < range) return;
      this.events.off(Phaser.Scenes.Events.UPDATE, step);
      if (big) {
        sparkles(this, bolt.x, bolt.y, 26, [0xffffff, 0x7ff0ff], 240);
        flare(this, bolt.x, bolt.y, 0x7ff0ff, 1.4);
        ringBurst(this, bolt.x, bolt.y, 0x7ff0ff, 1.4);
        this.combat.hitCircle(bolt.x, bolt.y, 50, { coef: 0.8, tag: 'basic', element: 'moon', power: 1.6, hitstop: 50, spark: null, gauge: 2 });
      }
      bolt.destroy();
      halo.destroy();
      trail.stop();
      this.time.delayedCall(400, () => trail.destroy());
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, step);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, step));
  }

  // ---------------------------------------------------------------------------
  // 스킬
  // ---------------------------------------------------------------------------
  private tryCast(slot: SkillSlot): void {
    if (this.dashT > 0) return;
    const skill = SKILLS[this.hero][slot];
    const ready = slot === 'ult' ? this.combat.gauge >= 100 : this.cd[this.hero][slot] <= 0;
    if (!ready) {
      this.hud().deny(slot);
      return;
    }
    if (slot === 'ult') this.combat.gauge = 0;
    else this.cd[this.hero][slot] = skill.cooldown * this.stats.cdMul;
    this.hud().pulse(slot);
    const c = this.controls;
    if (c.axisX !== 0) this.cat.setFlipX(c.axisX < 0);
    skill.cast(this.host);
    if (slot !== 'ult' && Math.random() < this.stats.skillReset) {
      this.time.delayedCall(250, () => {
        this.cd[this.hero][slot] = 0;
        this.hud().pulse(slot);
        callout(this, this.cat.x, this.cat.y - 64, '냥력 폭주! 쿨타임 초기화', '#efb8ff');
      });
    }
  }

  /** 스킬 시전 중: 조작·중력 잠금 + 무적 */
  private lock(ms: number): void {
    const now = this.time.now;
    this.lockUntil = Math.max(this.lockUntil, now + ms);
    this.invulnUntil = Math.max(this.invulnUntil, now + ms);
    this.attacking = false;
    this.dashT = 0;
    this.wasLocked = true;
    this.cat.setAlpha(1);
    this.cat.body.setAllowGravity(false);
    this.cat.body.setVelocity(0, 0);
  }

  // ---------------------------------------------------------------------------
  // 피격·사망
  // ---------------------------------------------------------------------------
  private damagePlayer(dmg: number, fromX: number, o: DamageOpts = {}): boolean {
    const now = this.time.now;
    if (this.dead || now < this.invulnUntil) return false;
    dmg = Math.max(1, Math.round(dmg * this.stats.dmgTakenMul));
    if (this.stats.thorns > 0) {
      const src = this.combat.nearest(fromX, this.cat.y - 22, 1, 80)[0];
      if (src) this.combat.hit(src, { coef: (dmg * this.stats.thorns) / this.combat.atk, tag: 'thorns', power: 0.8, gauge: 0 }, this.cat.x);
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.combat.popup(this.cat.x, this.cat.y - 48, dmg, 0xff5a5a, dmg >= 80);
    this.cat.setTintMode(Phaser.TintModes.FILL).setTint(0xff5050);
    this.time.delayedCall(90, () => this.cat.setTintMode(Phaser.TintModes.MULTIPLY).clearTint());
    if (o.slow) {
      this.slowUntil = now + o.slow;
      playFx(this, 'fx_ring', this.cat.x, this.cat.y - 2, { add: true, scale: 1.5, tint: 0x7fb0ff, depth: DEPTH.fxTop });
    }
    if (o.weak) {
      this.invulnUntil = now + 450;
    } else {
      const dir = Math.sign(this.cat.x - fromX) || 1;
      this.attacking = false;
      this.dashT = 0;
      this.stunUntil = now + 260;
      this.invulnUntil = now + 900;
      this.cat.body.setAllowGravity(true);
      this.cat.body.setVelocity(dir * 170, -170);
      this.cat.setFlipX(dir > 0);
      this.combat.hitstop(70);
      this.cameras.main.shake(150, 0.007);
      screenFlash(this, 0xff2020, 0.2, 180);
      playFx(this, 'fx_spark', this.cat.x - dir * 6, this.cat.y - 24, { add: true, tint: 0xff7070, scale: 1.4, depth: DEPTH.fxTop });
      playFx(this, 'fx_impact', this.cat.x - dir * 6, this.cat.y - 24, { add: true, tint: 0xff9090, depth: DEPTH.fxTop });
    }
    if (this.hp <= 0) {
      if (this.stats.revives > 0) this.revive();
      else this.die();
    }
    return true;
  }

  /** 쓰러짐 (목숨은 하나): 슬로모션 속에 영혼 고양이가 빠져나가고 게임 오버 → Space 로 처음부터 재도전 */
  private die(): void {
    this.dead = true;
    this.attacking = false;
    const { x, y } = this.cat;
    this.cat.anims.play(`hero_${this.hero}_hurt`, true);
    this.cameras.main.flash(300, 255, 255, 255);
    this.cameras.main.shake(300, 0.012);
    this.combat.slowmo(0.35, 900);
    this.tweens.add({ targets: this.cat, alpha: 0.25, duration: 500 });
    this.tweens.add({ targets: this.dimRect, alpha: 0.6, duration: 800 });
    const soul = this.add.image(x, y, this.cat.texture.key, 'idle_0').setOrigin(this.cat.originX, this.cat.originY).setFlipX(this.cat.flipX);
    soul.setTint(0xbfe9ff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxTop);
    this.tweens.add({ targets: soul, y: y - 70, alpha: 0, duration: 1200, ease: 'Quad.Out', onComplete: () => soul.destroy() });
    sparkles(this, x, y - 24, 20, [0xffffff, 0xbfe9ff], 120);
    callout(this, x, y - 56, '쓰러졌다…', '#bfe9ff');
    this.time.delayedCall(900, () => {
      this.gameOver = true;
      if (location.hash.includes('autorestart')) this.time.delayedCall(1200, () => this.scene.restart()); // 테스트용
      this.hud().gameOver(this.wave, this.kills);
    });
  }

  // ---------------------------------------------------------------------------
  // 웨이브
  // ---------------------------------------------------------------------------
  private updateWaves(dt: number): void {
    const before = this.waveEnemies.length;
    this.waveEnemies = this.waveEnemies.filter((e) => !e.gone);
    this.kills += before - this.waveEnemies.length;
    if (this.dead || this.pendingSpawns > 0 || this.waveEnemies.some((e) => e.alive)) return;
    // 5웨이브마다 증강 선택
    if (this.wave > 0 && this.wave % 5 === 0 && this.augmentFor !== this.wave) {
      this.augmentFor = this.wave;
      this.openAugments();
      return;
    }
    this.nextWaveT -= dt;
    if (this.nextWaveT > 0) return;
    this.nextWaveT = 2.2;
    this.wave++;
    if (isBossWave(this.wave)) {
      this.spawnBoss();
      return;
    }
    const view = this.cameras.main.worldView;
    const elite = eliteChance(this.wave);
    let order = 0;
    for (const [kind, n] of waveAt(this.wave)) {
      for (let i = 0; i < n; i++) {
        let x = 0;
        for (let tries = 0; tries < 12; tries++) {
          x = Phaser.Math.Between(Math.max(30, view.x + 30), Math.min(WORLD_W - 30, view.right - 30));
          if (Math.abs(x - this.cat.x) > 120) break;
        }
        this.pendingSpawns++;
        this.time.delayedCall(500 + order++ * 200, () => {
          this.pendingSpawns--;
          const e = spawnEnemy(kind, this.world, x);
          if (Math.random() < elite) e.makeElite();
          this.waveEnemies.push(this.combat.add(e));
        });
      }
    }
  }

  /** 보스 웨이브: 경고 배너 → 보스 등장 (10웨이브마다, 회차마다 체력 +60%) */
  private spawnBoss(): void {
    const round = this.wave / 10 - 1;
    this.hud().banner('BOSS — 쥐왕 찍찍대제', '#ff6a5a');
    this.cameras.main.shake(700, 0.01);
    screenFlash(this, 0xff3a2a, 0.18, 300);
    this.pendingSpawns++;
    this.time.delayedCall(1000, () => {
      this.pendingSpawns--;
      const x = Phaser.Math.Clamp(this.cat.x + (this.cat.x < WORLD_W / 2 ? 230 : -230), 110, WORLD_W - 110);
      const boss = new RatKing(this.world, x, GROUND_Y, 1 + round * 0.6);
      this.boss = boss;
      this.waveEnemies.push(this.combat.add(boss));
    });
  }

  private onBossDefeated(): void {
    this.hud().banner('BOSS CLEAR!', '#ffd36e');
    for (const e of this.waveEnemies) if (e.alive && e !== this.boss) e.hit(e.hp, 1, 2);
    const x = this.boss?.x ?? this.cat.x;
    (['potion_l', 'snack', 'mana'] as ItemKind[]).forEach((k, i) => this.spawnItem(k, x + (i - 1) * 34, true, GROUND_Y - 60));
    this.boss = undefined;
  }

  // ---------------------------------------------------------------------------
  // 메뉴 / 증강
  // ---------------------------------------------------------------------------
  private openMenu(panel: MenuData['panel'] = 'pause'): void {
    if (this.dead || this.scene.isActive('menu')) return;
    this.scene.pause();
    this.scene.launch('menu', { from: 'sandbox', panel } satisfies MenuData);
  }

  private openAugments(): void {
    const choices = rollAugments(3, this.taken);
    if (!choices.length) return;
    this.scene.pause();
    this.hud().showAugments(choices, this.wave, (a) => this.applyAugment(a));
  }

  private applyAugment(a: AugmentDef): void {
    const ratio = this.hp / this.maxHp();
    a.apply(this.stats);
    this.taken.add(a.id);
    // 체력 비율 유지 + 선택 보상으로 15% 회복
    this.hp = Math.min(this.maxHp(), this.maxHp() * (ratio + 0.15));
    this.scene.resume();
    this.controls.reset();
    this.nextWaveT = 1.6;
    glowPulse(this, this.cat.x, this.cat.y - 22, 0xffd36e, 0.6, 3, 500, 0.9);
    ringBurst(this, this.cat.x, this.cat.y - 22, 0xffd36e, 1.6);
    sparkles(this, this.cat.x, this.cat.y - 22, 30, [0xffffff, 0xffd36e], 220);
    callout(this, this.cat.x, this.cat.y - 56, a.name, '#ffd36e');
  }

  private maxHp(): number {
    return Math.round(MAX_HP[this.hero] * this.stats.maxHpMul);
  }

  private heal(amount: number, show = true): void {
    if (this.dead) return;
    const v = Math.min(amount, this.maxHp() - this.hp);
    if (v <= 0) return;
    this.hp += v;
    if (!show) return;
    this.combat.popup(this.cat.x, this.cat.y - 48, Math.round(v), 0x7aff8a, v >= 200);
    glowPulse(this, this.cat.x, this.cat.y - 22, 0x7aff8a, 0.5, 2, 300, 0.7);
    sparkles(this, this.cat.x, this.cat.y - 20, 12, [0xffffff, 0x7aff8a], 120);
  }

  /** 증강 효과: 흡혈, 천둥 발톱 */
  private onCombatHit(t: HitTarget, dmg: number, tag?: HitTag): void {
    const st = this.stats;
    if (st.lifesteal > 0 && tag !== 'thorns') this.heal(dmg * st.lifesteal, false);
    if (tag === 'basic' && st.thunderClaw > 0 && t.alive && Math.random() < st.thunderClaw) {
      const x = t.x;
      playFx(this, 'fx_lightning', x, t.bottom, { add: true, origin: [0.5, 1], scaleX: 1.4, depth: DEPTH.fxTop });
      flare(this, x, t.cy, 0xfff27a, 1.2);
      screenFlash(this, 0xd8c8ff, 0.08, 80);
      this.time.delayedCall(30, () => {
        if (t.alive) this.combat.hit(t, { coef: 1.2, element: 'lightning', status: 'shock', tag: 'thunder', power: 1.4, spark: null, gauge: 1 });
      });
    }
  }

  /** 증강 효과: 연쇄 폭발 */
  private onCombatKill(t: HitTarget): void {
    if (this.stats.killBlast <= 0) return;
    const { x, cy } = t;
    this.time.delayedCall(70, () => {
      playFx(this, 'fx_explosion', x, cy, { scale: 1.1, depth: DEPTH.fxTop });
      ringBurst(this, x, cy, 0xff9a4a, 1);
      this.combat.hitCircle(x, cy, 48, { coef: this.stats.killBlast, element: 'fire', tag: 'blast', power: 1.6, spark: null, gauge: 1 });
    });
  }

  /** 구사일생: 쓰러지는 순간 체력 50%로 부활 */
  private revive(): void {
    this.stats.revives--;
    this.hp = Math.round(this.maxHp() * 0.5);
    this.invulnUntil = this.time.now + 2500;
    this.cameras.main.flash(400, 255, 250, 220);
    this.combat.slowmo(0.4, 500);
    glowPulse(this, this.cat.x, this.cat.y - 22, 0xffd8ff, 1, 5, 700, 0.9);
    ringBurst(this, this.cat.x, this.cat.y - 22, 0xd88aff, 2.5);
    sparkles(this, this.cat.x, this.cat.y - 22, 40, [0xffffff, 0xefb8ff], 260);
    this.hud().banner('구사일생!', '#efb8ff');
  }

  // ---------------------------------------------------------------------------
  // 아이템
  // ---------------------------------------------------------------------------
  private updateBuffs(dt: number): void {
    if (this.dead) return;
    if (this.stats.regen > 0) this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * this.stats.regen * dt);
    const frenzy = this.time.now < this.frenzyUntil;
    this.combat.buffMul = frenzy ? 1.5 : 1;
    if (frenzy && Math.random() < dt * 25) {
      burst(this, 'fx_sparkle', this.cat.x, this.cat.y - 20, 1, { speed: { min: 20, max: 70 }, lifespan: 450, alpha: { start: 1, end: 0 }, tint: 0x8af07a }, DEPTH.fxTop, true);
    }
  }

  private updateItems(dt: number): void {
    if (this.dead) return;
    this.itemT -= dt;
    if (this.itemT <= 0) {
      this.itemT = (8 + Math.random() * 6) / this.stats.itemLuck;
      if (this.pickups.length < 4) this.spawnRandomItem();
    }
    const px = this.cat.x;
    const py = this.cat.y - 18;
    for (const p of this.pickups) {
      const r = p.update(dt, px, py);
      if (r === 'collect') {
        this.applyItem(p.kind);
        p.destroy(true);
      } else if (r === 'expire') p.destroy(false);
    }
    this.pickups = this.pickups.filter((p) => !p.done);
  }

  /** 맵 곳곳(화면 안의 땅·발판 위)에 아이템이 빛과 함께 내려온다 */
  private spawnRandomItem(): void {
    const kind = randomItem();
    const view = this.cameras.main.worldView;
    const plats = this.platformTops.filter((p) => p.x1 > view.x + 20 && p.x0 < view.right - 20);
    if (plats.length && Math.random() < 0.45) {
      const p = plats[Math.floor(Math.random() * plats.length)];
      this.pickups.push(new Pickup(this, kind, Phaser.Math.Between(p.x0 + 8, p.x1 - 8), p.y - 10, false));
    } else {
      const x = Phaser.Math.Clamp(Phaser.Math.Between(view.x + 40, view.right - 40), 30, WORLD_W - 30);
      this.pickups.push(new Pickup(this, kind, x, GROUND_Y - 10, false));
    }
  }

  private spawnItem(kind: ItemKind, x: number, dropped: boolean, fromY?: number): void {
    this.pickups.push(new Pickup(this, kind, Phaser.Math.Clamp(x, 20, WORLD_W - 20), GROUND_Y - 10, dropped, fromY));
  }

  private applyItem(kind: ItemKind): void {
    const luck = this.stats.itemLuck;
    const max = this.maxHp();
    const info = ITEM_INFO[kind];
    switch (kind) {
      case 'potion_s':
        this.heal(max * 0.2 * luck);
        break;
      case 'potion_l':
        this.heal(max * 0.5 * luck);
        break;
      case 'tuna':
        this.heal(max * 0.3 * luck);
        break;
      case 'mana':
        this.combat.gauge = Math.min(100, this.combat.gauge + 40 * luck);
        break;
      case 'snack':
        for (const sl of SLOTS) if (sl !== 'ult') this.cd[this.hero][sl] = 0;
        this.dashCd = 0;
        break;
      case 'catnip':
        this.frenzyUntil = this.time.now + 10000 * luck;
        break;
    }
    callout(this, this.cat.x, this.cat.y - 52, info.name, info.css);
  }

  // ---------------------------------------------------------------------------
  // 공용
  // ---------------------------------------------------------------------------
  private setHero(k: HeroKey): void {
    if (k === this.hero || this.time.now < this.lockUntil || this.dead) return;
    this.hp = Math.round((this.hp / this.maxHp()) * MAX_HP[k] * this.stats.maxHpMul);
    this.hero = k;
    this.attacking = false;
    this.cat.setTexture(`hero_${k}`, 'idle_0');
    this.cat.play(`hero_${k}_idle`);
    playFx(this, k === 'mage' ? 'fx_spark_magic' : 'fx_spark', this.cat.x, this.cat.y - 22, { add: true, scale: 2, depth: DEPTH.fxTop });
    glowPulse(this, this.cat.x, this.cat.y - 22, k === 'mage' ? 0x7ff0ff : 0xffd08a, 0.5, 2, 300, 0.8);
    callout(this, this.cat.x, this.cat.y - 50, HERO_NAMES[k], k === 'mage' ? '#bfe9ff' : '#ffd08a');
  }

  private doJump(v: number): void {
    this.cat.body.setVelocityY(-v);
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpCut = false;
    this.squash(0.88, 1.12);
  }

  private onLand(fallSpeed: number): void {
    if (fallSpeed > 320) {
      for (const dir of [-1, 1]) {
        const p = this.puff(this.cat.x + dir * 4, this.cat.y, dir < 0);
        this.tweens.add({ targets: p, x: p.x + dir * 12, duration: 300, ease: 'Quad.Out' });
      }
      this.squash(1.2, 0.8);
    } else if (fallSpeed > 120) {
      this.puff(this.cat.x, this.cat.y);
      this.squash(1.1, 0.9);
    }
  }

  private squash(sx: number, sy: number): void {
    this.tweens.killTweensOf(this.cat);
    this.tweens.add({ targets: this.cat, scaleX: { from: sx, to: 1 }, scaleY: { from: sy, to: 1 }, duration: 160, ease: 'Quad.Out' });
  }

  private puff(x: number, y: number, flip = false): Phaser.GameObjects.Sprite {
    return playFx(this, 'fx_dust', x, y, { flip, origin: [0.5, 0.8], depth: DEPTH.hero + 1 });
  }

  private afterimage(x = this.cat.x, y = this.cat.y, tint?: number): void {
    const g = this.add
      .image(x, y, this.cat.texture.key, this.cat.frame.name)
      .setOrigin(this.cat.originX, this.cat.originY)
      .setFlipX(this.cat.flipX)
      .setTint(tint ?? (this.hero === 'mage' ? 0xb98bff : 0x7fd4ff))
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.55)
      .setDepth(DEPTH.hero - 1);
    this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
  }

  private isOnPlatform(): boolean {
    const b = this.cat.body;
    return this.platformTops.some((p) => Math.abs(b.bottom - p.y) < 3 && b.right > p.x0 && b.left < p.x1);
  }

  private updateAnimation(grounded: boolean): void {
    const body = this.cat.body;
    const vx = Math.abs(body.velocity.x);
    let anim = 'idle';
    if (this.dashT > 0) anim = 'dash';
    else if (!grounded) anim = body.velocity.y < 0 ? 'jump' : 'fall';
    else if (this.controls.axisX === 0) anim = 'idle'; // 손을 떼면 자세를 잡은 채 미끄러짐
    else if (vx > 110) anim = 'run';
    else if (vx > 12) anim = 'walk';
    this.cat.anims.play(`hero_${this.hero}_${anim}`, true);
    this.cat.anims.timeScale = anim === 'run' ? Math.max(0.7, vx / MOVE.runSpeed) : anim === 'walk' ? Math.max(0.6, vx / 110) : 1;
  }

  private runAutoplay(dt: number): void {
    this.autoT += dt;
    const v = this.controls.virtual;
    if (this.cat.x > WORLD_W - 120) this.autoDir = -1;
    if (this.cat.x < 120) this.autoDir = 1;
    v.delete('left');
    v.delete('right');
    v.add(this.autoDir > 0 ? 'right' : 'left');
    const jp = this.autoT % 1.6;
    if (jp < 0.25 || (jp > 0.45 && jp < 0.6)) v.add('jump');
    else v.delete('jump');
    if (this.autoT % 1.3 > 0.9 && this.autoT % 1.3 < 0.95) v.add('attack');
    else v.delete('attack');
  }

  /** 스킬 시연: 타임라인대로 한 프레임씩 가상 입력 (가까운 적을 바라봄) */
  private runShowcase(dt: number): void {
    const v = this.controls.virtual;
    for (const a of this.release) v.delete(a);
    this.release = [];
    this.autoT += dt;
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 100);
    const near = this.combat.nearest(this.cat.x, this.cat.y, 1, 400)[0];
    if (near && this.time.now >= this.lockUntil && !this.attacking) this.cat.setFlipX(near.x < this.cat.x);
    while (this.showcaseIdx < SHOWCASE.length && SHOWCASE[this.showcaseIdx][0] <= this.autoT) {
      const act = SHOWCASE[this.showcaseIdx++][1];
      if (act === 'mage' || act === 'blade') {
        this.lockUntil = 0;
        this.setHero(act);
        this.combat.gauge = 100;
        continue;
      }
      v.add(act);
      this.release.push(act);
    }
  }
}
