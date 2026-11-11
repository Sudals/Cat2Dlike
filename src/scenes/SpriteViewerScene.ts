/**
 * 도트 검수용 뷰어 (URL 해시 #viewer)
 * 직업별 애니메이션 2배 미리보기 + 검객 공격 프레임 원본 + 이펙트
 */
import Phaser from 'phaser';
import { HERO_FOOT_Y, HERO_FRAME_H, HERO_FRAME_W, LOADOUTS } from '../art/sprites/cat';

const PREVIEW = ['idle', 'run', 'attack', 'jump', 'dash'] as const;

export class SpriteViewerScene extends Phaser.Scene {
  constructor() {
    super('viewer');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#5a5470');
    // #viewer-enemies: 1장 적 애니메이션 2배
    if (location.hash.includes('enemies')) {
      const rows: [string, string[], number][] = [
        ['enemy_rat', ['idle', 'run', 'tele', 'bite', 'hurt'], 58],
        ['enemy_pigeon', ['fly', 'tele', 'hurt'], 112],
        ['enemy_hound', ['idle', 'run', 'growl', 'bite', 'bark'], 222],
        ['enemy_thug', ['idle', 'walk', 'attack', 'attack2', 'hurt'], 352],
      ];
      for (const [tex, anims, baseY] of rows) {
        const src = this.textures.get(tex).get('hurt_0');
        const foot = tex === 'enemy_thug' ? 60 : tex === 'enemy_hound' ? 45 : tex === 'enemy_pigeon' ? 19 : 22;
        anims.forEach((a, i) => {
          const s = this.add.sprite(i * 128 + 64, baseY, tex).setOrigin(0.5, foot / src.height).setScale(2);
          this.loop(s, `${tex}_${a}`);
        });
      }
      return;
    }
    // #viewer-zoom: 대표 프레임 5배 확대 (픽셀 단위 검수)
    if (location.hash.includes('zoom')) {
      const frames = ['attack_1', 'attack_2', 'attack_3', 'attack2_2', 'attack2_3', 'attack3_2'];
      LOADOUTS.forEach((L, r) =>
        frames.forEach((f, c) => this.add.image(c * 106 + 53, r * 180 + 90, `hero_${L.key}`, f).setScale(2)),
      );
      return;
    }
    const label = (x: number, y: number, t: string) =>
      this.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' });

    // 직업별 애니메이션 (2x, 공격은 반복 재생)
    LOADOUTS.forEach((L, row) => {
      const top = row * 132;
      PREVIEW.forEach((anim, col) => {
        const key = `hero_${L.key}_${anim}`;
        label(col * 128 + 4, top + 2, `${L.key} ${anim}`);
        const s = this.add.sprite(col * 128 + 64, top + 10 + HERO_FOOT_Y * 2, `hero_${L.key}`).setOrigin(0.5, HERO_FOOT_Y / HERO_FRAME_H).setScale(2);
        this.loop(s, key);
      });
    });

    // 검객 공격 프레임 (1x)
    const y0 = 268;
    for (let i = 0; i < 6; i++) this.add.image(i * HERO_FRAME_W, y0, 'hero_blade', `attack_${i}`).setOrigin(0);

    // 이펙트 (1x)
    label(390, y0 - 2, 'slash / spark / magic / bolt');
    this.loop(this.add.sprite(420, y0 + 34, 'fx_slash'), 'fx_slash');
    this.loop(this.add.sprite(480, y0 + 34, 'fx_spark'), 'fx_spark');
    this.loop(this.add.sprite(520, y0 + 34, 'fx_spark_magic'), 'fx_spark_magic');
    this.add.sprite(560, y0 + 34, 'fx_bolt').setScale(2).play('fx_bolt');
  }

  /** 비반복 애니도 간격을 두고 계속 재생 */
  private loop(s: Phaser.GameObjects.Sprite, key: string): void {
    const replay = () => {
      s.play(key);
      if (!this.anims.get(key)?.repeat) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(300, replay));
    };
    replay();
  }
}
