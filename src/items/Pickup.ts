/**
 * 맵에 떨어지는 아이템. 둥실둥실 떠 있다가 가까이 가면 빨려와서 먹힌다. 22초 뒤 깜빡이다 사라짐.
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { glowPulse, playFx, sparkles } from '../fx/fx';

export type ItemKind = 'potion_s' | 'potion_l' | 'mana' | 'tuna' | 'snack' | 'catnip';

export const ITEM_INFO: Record<ItemKind, { name: string; desc: string; color: number; css: string; weight: number }> = {
  potion_s: { name: '작은 물약', desc: '체력 20% 회복', color: 0xff6a6a, css: '#ff9a9a', weight: 34 },
  potion_l: { name: '큰 물약', desc: '체력 50% 회복', color: 0xff3a4a, css: '#ff7a7a', weight: 12 },
  tuna: { name: '참치캔', desc: '체력 30% 회복', color: 0x8ad0ff, css: '#bfe9ff', weight: 22 },
  mana: { name: '달빛 물약', desc: '궁극기 게이지 +40', color: 0x7ab0ff, css: '#a8c8ff', weight: 14 },
  snack: { name: '간식 스틱', desc: '스킬 쿨타임 초기화', color: 0xffd36e, css: '#ffe08a', weight: 10 },
  catnip: { name: '개다래', desc: '10초 광란: 공격력 +50%, 이동 +20%', color: 0x8af07a, css: '#b8f08a', weight: 8 },
};

export function randomItem(): ItemKind {
  const entries = Object.entries(ITEM_INFO) as [ItemKind, (typeof ITEM_INFO)[ItemKind]][];
  let n = Math.random() * entries.reduce((a, [, v]) => a + v.weight, 0);
  for (const [k, v] of entries) {
    n -= v.weight;
    if (n <= 0) return k;
  }
  return 'potion_s';
}

export class Pickup {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private life = 22;
  private t = Math.random() * 6;
  private vy = 0;
  private falling: boolean;
  private restY: number;
  done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly kind: ItemKind,
    x: number,
    restY: number,
    /** true: 적이 떨어뜨림 (튀어올랐다 떨어짐) / false: 하늘에서 빛과 함께 내려옴 */
    dropped: boolean,
    /** 떨어뜨린 높이 (적 위치) */
    fromY?: number,
  ) {
    const info = ITEM_INFO[kind];
    this.restY = restY;
    this.falling = dropped;
    const y = dropped ? Math.min(restY - 20, fromY ?? restY - 20) : restY;
    this.vy = dropped ? -200 : 0;
    this.glow = scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.color).setScale(0.45).setAlpha(0.7).setDepth(DEPTH.enemy - 2);
    this.sprite = scene.add.image(x, y, 'items', kind).setDepth(DEPTH.enemy - 1);
    if (!dropped) {
      playFx(scene, 'fx_beam', x, restY + 10, { add: true, tint: info.color, scaleX: 0.6, scaleY: 0.6, origin: [0.5, 1], depth: DEPTH.fx });
      sparkles(scene, x, restY, 10, [0xffffff, info.color], 120);
      this.sprite.setScale(0);
      scene.tweens.add({ targets: this.sprite, scale: 1, duration: 300, ease: 'Back.Out' });
    }
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** px, py: 플레이어 몸 중심. 'collect' 면 먹음 */
  update(dt: number, px: number, py: number): 'collect' | 'expire' | null {
    if (this.done) return null;
    this.t += dt;
    this.life -= dt;
    if (this.falling) {
      this.vy += 900 * dt;
      this.sprite.y += this.vy * dt;
      if (this.sprite.y >= this.restY) {
        this.sprite.y = this.restY;
        this.falling = false;
        playFx(this.scene, 'fx_dust', this.sprite.x, this.restY + 8, { depth: DEPTH.fx });
      }
    } else {
      this.sprite.y = this.restY + Math.sin(this.t * 3) * 2;
    }
    const d = Math.hypot(px - this.sprite.x, py - this.sprite.y);
    if (d < 46) {
      // 자석처럼 빨려옴
      const k = Math.min(1, dt * 10);
      this.sprite.x += (px - this.sprite.x) * k;
      this.sprite.y += (py - this.sprite.y) * k;
    }
    this.glow.setPosition(this.sprite.x, this.sprite.y);
    this.glow.setAlpha(0.5 + Math.sin(this.t * 5) * 0.2);
    if (this.life < 4) this.sprite.setVisible(Math.floor(this.t * 8) % 2 === 0);
    if (d < 14) return 'collect';
    if (this.life <= 0) return 'expire';
    return null;
  }

  destroy(collected: boolean): void {
    this.done = true;
    if (collected) {
      const info = ITEM_INFO[this.kind];
      glowPulse(this.scene, this.sprite.x, this.sprite.y, info.color, 0.4, 2, 300, 0.8);
      playFx(this.scene, 'fx_ring', this.sprite.x, this.sprite.y, { add: true, tint: info.color, scale: 1.5, depth: DEPTH.fxTop });
      sparkles(this.scene, this.sprite.x, this.sprite.y, 14, [0xffffff, info.color], 160);
    }
    this.sprite.destroy();
    this.glow.destroy();
  }
}
