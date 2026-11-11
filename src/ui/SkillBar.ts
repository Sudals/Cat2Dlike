/**
 * 하단 스킬바: [X 공격] [Q] [W] [E] [R 궁극기] [Shift 대시]
 * 아이콘 + 단축키 + 쿨타임 커튼/초 + 궁극기 게이지(가득 차면 금빛 점멸) + 사용/거부 피드백
 */
import type Phaser from 'phaser';
import { DEPTH, VIEW_H } from '../config/game';
import { FONT } from '../art/fonts';
import type { HeroKey } from '../skills';

export type BarSlot = 'attack' | 'skill1' | 'skill2' | 'skill3' | 'ult' | 'dash';
const ORDER: readonly { slot: BarSlot; key: string }[] = [
  { slot: 'attack', key: 'Ctrl' },
  { slot: 'skill1', key: 'Z' },
  { slot: 'skill2', key: 'X' },
  { slot: 'skill3', key: 'C' },
  { slot: 'ult', key: 'V' },
  { slot: 'dash', key: 'Sft' },
];

export interface BarState {
  cd: Record<BarSlot, number>;
  maxCd: Record<BarSlot, number>;
  gauge: number;
}

interface SlotView {
  slot: BarSlot;
  x: number;
  y: number;
  size: number;
  icon: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Graphics;
  overlay: Phaser.GameObjects.Graphics;
  cdText: Phaser.GameObjects.Text;
  keyText: Phaser.GameObjects.Text;
  flashT: number;
  shakeT: number;
  wasReady: boolean;
}

export class SkillBar {
  private readonly views: SlotView[] = [];

  constructor(scene: Phaser.Scene) {
    let x = 10;
    for (const { slot, key } of ORDER) {
      // 땅 띠(y 328~360) 안에 들어가도록 — 캐릭터 발(y 328)을 가리지 않는다
      const size = slot === 'ult' ? 26 : 24;
      const y = VIEW_H - 4 - size;
      const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d: number) =>
        o.setScrollFactor(0).setDepth(DEPTH.hud + d);
      this.views.push({
        slot,
        x,
        y,
        size,
        frame: fixed(scene.add.graphics(), 0),
        icon: fixed(scene.add.image(x + size / 2, y + size / 2, 'icons', 'dash'), 1),
        overlay: fixed(scene.add.graphics(), 2),
        cdText: fixed(
          scene.add.text(0, 0, '', { fontFamily: FONT.body, fontSize: '11px', color: '#ffffff', stroke: '#140c1c', strokeThickness: 3 }).setOrigin(0.5),
          3,
        ),
        keyText: fixed(
          scene.add.text(x - 3, y - 4, key, { fontFamily: FONT.small, fontSize: '9px', color: '#fff1c8', stroke: '#140c1c', strokeThickness: 3 }),
          3,
        ),
        flashT: 0,
        shakeT: 0,
        wasReady: true,
      });
      x += size + 6;
    }
  }

  setHero(hero: HeroKey): void {
    for (const v of this.views) v.icon.setFrame(v.slot === 'dash' ? 'dash' : `${hero}_${v.slot}`);
  }

  /** 사용 성공: 테두리 하얗게 번쩍 */
  pulse(slot: BarSlot): void {
    const v = this.views.find((e) => e.slot === slot);
    if (v) v.flashT = 0.22;
  }

  /** 쿨타임/게이지 부족: 좌우로 흔들림 */
  deny(slot: BarSlot): void {
    const v = this.views.find((e) => e.slot === slot);
    if (v) v.shakeT = 0.25;
  }

  update(dt: number, s: BarState, time: number): void {
    for (const v of this.views) {
      v.flashT -= dt;
      v.shakeT -= dt;
      const ox = v.shakeT > 0 ? Math.round(Math.sin(time * 0.09) * 2) : 0;
      const ready = v.slot === 'ult' ? s.gauge >= 100 : s.cd[v.slot] <= 0;
      if (ready && !v.wasReady) v.flashT = 0.18; // 쿨타임 종료 반짝
      v.wasReady = ready;

      const x = v.x + ox;
      const { y, size } = v;
      let border = ready ? 0xbfb3d9 : 0x4a4060;
      if (v.slot === 'ult') border = ready ? (Math.floor(time / 140) % 2 ? 0xffe14a : 0xff9a3a) : 0x8a6a2a;
      if (v.flashT > 0) border = 0xffffff;

      v.frame
        .clear()
        .fillStyle(0x140c1c, 0.9)
        .fillRect(x - 1, y - 1, size + 2, size + 2)
        .fillStyle(border, 1)
        .fillRect(x, y, size, size)
        .fillStyle(0x140c1c, 1)
        .fillRect(x + 1, y + 1, size - 2, size - 2);
      v.icon.setPosition(x + size / 2, y + size / 2);
      v.keyText.setX(v.x - 3 + ox);
      v.cdText.setPosition(x + size / 2, y + size / 2);

      const ix = x + (size - 20) / 2;
      const iy = y + (size - 20) / 2;
      const o = v.overlay.clear();
      if (v.slot === 'ult') {
        const frac = Math.min(1, s.gauge / 100);
        if (frac < 1) o.fillStyle(0x0a0612, 0.72).fillRect(ix, iy, 20, Math.round(20 * (1 - frac)));
        o.fillStyle(0x140c1c, 1).fillRect(x + 1, y + size - 4, size - 2, 3);
        o.fillStyle(ready ? 0xffe14a : 0xff9a3a, 1).fillRect(x + 1, y + size - 3, Math.round((size - 2) * frac), 2);
        v.cdText.setText('');
      } else {
        const cd = s.cd[v.slot];
        const max = s.maxCd[v.slot];
        if (cd > 0 && max > 0) {
          const frac = Math.min(1, cd / max);
          o.fillStyle(0x0a0612, 0.72).fillRect(ix, iy, 20, Math.round(20 * frac));
          v.cdText.setText(max >= 1 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '');
        } else {
          v.cdText.setText('');
        }
      }
    }
  }
}
