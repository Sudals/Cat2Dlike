/**
 * 타이틀 화면 (웹 버전) — Space·Enter 또는 클릭으로 시작, Esc 또는 [키 설정] 버튼으로 키 설정
 * 웹에서는 페이지에 키보드 포커스가 잡히고 (향후) 오디오 재생 허가를 받는 관문 역할도 한다.
 */
import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../config/game';
import { IS_DEMO, VERSION } from '../config/build';
import { FONT } from '../art/fonts';
import { HERO_FOOT_Y, HERO_FRAME_H } from '../art/sprites/cat';
import { controlsHint } from '../input/bindings';
import { raw } from '../input/RawInput';
import type { MenuData } from './MenuScene';

const GROUND_Y = 328;

export class TitleScene extends Phaser.Scene {
  private started = false;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private heroes: Phaser.GameObjects.Sprite[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  /** 메뉴를 닫은 직후 그 키/클릭이 곧바로 게임 시작으로 이어지지 않게 */
  private blockUntil = 0;

  constructor() {
    super('title');
  }

  create(): void {
    this.started = false;
    this.add.image(0, 0, 'bg_sky').setOrigin(0);
    this.far = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'bg_city_far').setOrigin(0);
    this.add.particles(0, 0, 'fx_rain', {
      x: { min: 0, max: VIEW_W + 120 },
      y: -8,
      speedY: { min: 380, max: 460 },
      speedX: { min: -70, max: -50 },
      rotate: 8,
      lifespan: 1000,
      quantity: 2,
      frequency: 16,
      alpha: { min: 0.25, max: 0.6 },
    });
    this.near = this.add.tileSprite(0, 24, VIEW_W, VIEW_H, 'bg_city_near').setOrigin(0);
    this.add.tileSprite(0, GROUND_Y, VIEW_W, 16, 'tile_brick_top').setOrigin(0);
    this.add.tileSprite(0, GROUND_Y + 16, VIEW_W, VIEW_H - GROUND_Y - 16, 'tile_brick_fill').setOrigin(0);

    // 떠오르는 반짝이
    this.add
      .particles(0, VIEW_H, 'fx_sparkle', {
        x: { min: 0, max: VIEW_W },
        speedY: { min: -40, max: -15 },
        speedX: { min: -8, max: 8 },
        lifespan: 4000,
        frequency: 90,
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0xffd08a, 0x7ff0ff],
      })
      .setBlendMode(Phaser.BlendModes.ADD);

    // 두 주인공
    const origin = HERO_FOOT_Y / HERO_FRAME_H;
    this.heroes = [
      this.add.sprite(VIEW_W / 2 - 74, GROUND_Y, 'hero_blade').setOrigin(0.5, origin).setScale(2).play('hero_blade_idle'),
      this.add.sprite(VIEW_W / 2 + 74, GROUND_Y, 'hero_mage').setOrigin(0.5, origin).setScale(2).setFlipX(true).play('hero_mage_idle'),
    ];

    // 로고
    const glow = this.add.image(VIEW_W / 2, 92, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb46a).setScale(7, 2).setAlpha(0.3);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const logo = this.add
      .text(VIEW_W / 2, 88, '냥생은 한 번뿐', { fontFamily: FONT.body, fontSize: '44px', fontStyle: 'bold', color: '#ffd08a', stroke: '#140c1c', strokeThickness: 8 })
      .setOrigin(0.5);
    const sub = this.add
      .text(VIEW_W / 2, 128, 'NYAN ONLY LIVES ONCE', { fontFamily: FONT.body, fontSize: '22px', color: '#fff1c8', stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5);
    this.tweens.add({ targets: [logo, sub], y: '-=3', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.prompt = this.add
      .text(VIEW_W / 2, 178, 'SPACE 를 눌러 시작', { fontFamily: FONT.body, fontSize: '22px', color: '#ffffff', stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5);
    this.tweens.add({ targets: this.prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const small = { fontFamily: FONT.small, fontSize: '9px', color: '#e8e0ff', stroke: '#140c1c', strokeThickness: 3 };
    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 14, controlsHint(), small).setOrigin(0.5);

    const keysBtn = this.add
      .text(VIEW_W / 2, 210, '[ 키 설정 · Esc ]', { fontFamily: FONT.body, fontSize: '11px', color: '#e8e0ff', stroke: '#140c1c', strokeThickness: 3 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    keysBtn.on('pointerover', () => keysBtn.setColor('#ffd08a'));
    keysBtn.on('pointerout', () => keysBtn.setColor('#e8e0ff'));
    keysBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 0) this.time.delayedCall(0, () => this.openKeys());
    });
    this.add.text(VIEW_W - 8, 6, `v${VERSION}${IS_DEMO ? '  WEB DEMO' : ''}`, { ...small, color: '#ffd08a' }).setOrigin(1, 0);

    const off = raw.onPress((b) => {
      if (!this.sys.isActive() || this.started) return false;
      if (b === 'Escape') this.time.delayedCall(0, () => this.openKeys());
      else if (b === 'Space' || b === 'Enter' || b === 'NumpadEnter') this.start();
      else return false;
      return true;
    });
    const onResume = () => {
      this.blockUntil = performance.now() + 200;
      this.hint.setText(controlsHint());
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.button === 0 && over.length === 0) this.start();
    });
    if (location.hash.includes('keys')) this.time.delayedCall(500, () => this.openKeys()); // 테스트용
    this.cameras.main.fadeIn(400, 5, 3, 10);
  }

  private openKeys(): void {
    if (this.started || this.scene.isActive('menu') || !this.sys.isActive()) return;
    this.scene.pause();
    this.scene.launch('menu', { from: 'title', panel: 'keys' } satisfies MenuData);
  }

  private start(): void {
    if (this.started || performance.now() < this.blockUntil || !this.sys.isActive()) return;
    this.started = true;
    this.tweens.killTweensOf(this.prompt);
    this.prompt.setAlpha(1).setText('시작!').setColor('#ffd08a');
    this.heroes[0].play('hero_blade_attack3');
    this.heroes[1].play('hero_mage_upatk');
    const cam = this.cameras.main;
    cam.flash(250, 255, 240, 200);
    cam.shake(200, 0.006);
    cam.fadeOut(500, 5, 3, 10);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('sandbox'));
  }

  update(): void {
    this.far.tilePositionX += 0.08;
    this.near.tilePositionX += 0.2;
  }
}
