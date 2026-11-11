/**
 * 전투 판정 + 타격감 처리 (docs/GAME_PLAN.md §5.4)
 * 한 번의 타격 = 피해 계산 → 대상 반응 → 데미지 숫자 → 스파크/충격선/방향성 불꽃 → 히트스톱 → 화면 흔들림
 */
import Phaser from 'phaser';
import { COMBAT, DEPTH } from '../config/game';
import { burst, playFx } from '../fx/fx';
import { Dummy } from './Dummy';
import type { HitTarget, StatusKind } from './Target';
import { baseStats, type PlayerStats } from '../augments/stats';

/** 공격 출처 — 증강 효과가 어떤 공격에 붙는지 구분 (예: 천둥 발톱은 기본 공격에만) */
export type HitTag = 'basic' | 'skill' | 'blast' | 'thunder' | 'thorns';

export type Element = 'physical' | 'fire' | 'lightning' | 'moon' | 'ice';
const NUM_COLOR: Record<Element, number> = { physical: 0xffffff, fire: 0xffa24a, lightning: 0xf0d8ff, moon: 0xaee8ff, ice: 0x9fe8ff };
const SPARK_TINT: Record<Element, number> = { physical: 0xfff1c8, fire: 0xffa24a, lightning: 0xfff27a, moon: 0x7ff0ff, ice: 0xbfefff };

export interface HitOpts {
  coef: number;
  element?: Element;
  /** 넉백·파편 방향. 없으면 공격 지점 기준으로 자동 */
  dir?: number;
  /** 타격 세기 0.5~3 → 흔들림·넉백·파편·숫자 크기 */
  power?: number;
  /** 띄우기 초속 (적을 공중으로) */
  launch?: number;
  /** 넉백 대신 공격 지점 쪽으로 끌어당김 (회오리) */
  pull?: boolean;
  hitstop?: number;
  shake?: [ms: number, intensity: number];
  /** null 이면 스파크 생략 */
  spark?: string | null;
  sparkScale?: number;
  status?: StatusKind;
  critBonus?: number;
  /** 궁극기 게이지 충전량 */
  gauge?: number;
  tag?: HitTag;
}

export class Combat {
  readonly targets: HitTarget[] = [];
  atk: number = COMBAT.atk;
  gauge = 100;
  /** 플레이어 능력치 (증강) — 씬이 자기 stats 객체로 교체 */
  stats: PlayerStats = baseStats();
  /** 일시 버프 배율 (개다래 등) */
  buffMul = 1;
  onHit?: (t: HitTarget, dmg: number, o: HitOpts) => void;
  onKill?: (t: HitTarget, o: HitOpts) => void;
  private stopUntil = 0;
  private stopTimer = 0;
  private slowTimer = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  add<T extends HitTarget>(t: T): T {
    this.targets.push(t);
    return t;
  }

  addDummy(x: number, groundY: number): Dummy {
    return this.add(new Dummy(this.scene, x, groundY));
  }

  alive(): HitTarget[] {
    return this.targets.filter((t) => t.alive);
  }

  inView(): HitTarget[] {
    const v = this.scene.cameras.main.worldView;
    return this.alive().filter((t) => t.x > v.x - 8 && t.x < v.right + 8);
  }

  nearest(x: number, y: number, n: number, maxDist: number): HitTarget[] {
    return this.alive()
      .map((t) => ({ t, dist: Math.hypot(t.x - x, t.cy - y) }))
      .filter((e) => e.dist <= maxDist)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n)
      .map((e) => e.t);
  }

  hit(t: HitTarget, o: HitOpts, fromX?: number): number {
    if (!t.alive) return 0;
    const away = o.dir ?? (fromX === undefined ? 1 : Math.sign(t.x - fromX) || 1);
    const dir = o.pull ? -away : away;
    const st = this.stats;
    const crit = Math.random() < st.critChance + (o.critBonus ?? 0);
    const power = (o.power ?? 1) * (crit ? 1.4 : 1);
    const element = o.element ?? 'physical';
    const mul = st.atkMul * this.buffMul * (o.tag === 'basic' ? st.basicMul : 1) * (crit ? st.critMul : 1);
    const dmg = Math.round(this.atk * o.coef * mul * (0.92 + Math.random() * 0.16));
    const sx = t.x - dir * 4 + (Math.random() - 0.5) * 6;
    const sy = t.cy + (Math.random() - 0.5) * 10;
    const top = t.top;

    t.hit(dmg, dir, power, o.launch ?? 0);
    if (o.status && t.alive) t.applyStatus(o.status);
    this.popup(t.x + (Math.random() - 0.5) * 12, top - 4, dmg, crit ? 0xffe14a : NUM_COLOR[element], crit || power >= 2);

    if (o.spark !== null) {
      const scale = o.sparkScale ?? (crit ? 1.6 : 1);
      playFx(this.scene, o.spark ?? (element === 'physical' ? 'fx_spark' : 'fx_spark_magic'), sx, sy, { add: true, scale, depth: DEPTH.fxTop });
      if (power >= 1) playFx(this.scene, 'fx_impact', sx, sy, { add: true, scale: power >= 2 ? 2 : 1, depth: DEPTH.fxTop });
      burst(
        this.scene,
        'fx_sparkle',
        sx,
        sy,
        4 + Math.round(power * 4),
        {
          angle: dir > 0 ? { min: -40, max: 30 } : { min: 150, max: 220 },
          speed: { min: 120, max: 260 + power * 60 },
          gravityY: 300,
          lifespan: { min: 120, max: 300 },
          alpha: { start: 1, end: 0 },
          tint: SPARK_TINT[element],
        },
        DEPTH.fxTop,
        true,
      );
    }

    const stop = (o.hitstop ?? 0) * (crit ? 1.35 : 1);
    if (stop > 0) this.hitstop(stop);
    if (o.shake) this.scene.cameras.main.shake(o.shake[0], o.shake[1] * (crit ? 1.35 : 1));
    this.gauge = Math.min(100, this.gauge + (o.gauge ?? 2) * st.ultGain);
    this.onHit?.(t, dmg, o);
    if (!t.alive) this.onKill?.(t, o);
    return dmg;
  }

  /** 범위 안 모든 대상 타격. 히트스톱·흔들림은 한 번만 */
  hitRect(r: Phaser.Geom.Rectangle, o: HitOpts, fromX?: number): HitTarget[] {
    const targets = this.alive().filter((t) => Phaser.Geom.Intersects.RectangleToRectangle(r, t.bounds()));
    targets.forEach((t, i) => this.hit(t, i === 0 ? o : { ...o, hitstop: 0, shake: undefined }, fromX ?? r.centerX));
    return targets;
  }

  hitCircle(x: number, y: number, radius: number, o: HitOpts): HitTarget[] {
    const circle = new Phaser.Geom.Circle(x, y, radius);
    const targets = this.alive().filter((t) => Phaser.Geom.Intersects.CircleToRectangle(circle, t.bounds()));
    targets.forEach((t, i) => this.hit(t, i === 0 ? o : { ...o, hitstop: 0, shake: undefined }, x));
    return targets;
  }

  /** 히트스톱: 물리·애니·트윈을 잠깐 멈춰 칼이 '걸리는' 손맛을 만든다 */
  hitstop(ms: number): void {
    const now = performance.now();
    const until = now + ms;
    if (until <= this.stopUntil) return;
    if (this.stopUntil <= now) {
      this.scene.physics.world.pause();
      this.scene.anims.pauseAll();
      this.scene.tweens.pauseAll();
    }
    this.stopUntil = until;
    window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => {
      this.scene.physics.world.resume();
      this.scene.anims.resumeAll();
      this.scene.tweens.resumeAll();
      this.stopUntil = 0;
    }, ms);
  }

  /** 슬로모션: 큰 한 방 직후 잠깐 시간을 느리게 (factor 0.3 = 30% 속도, ms 는 실제 시간) */
  slowmo(factor: number, ms: number): void {
    const s = this.scene;
    s.time.timeScale = factor;
    s.tweens.timeScale = factor;
    s.anims.globalTimeScale = factor;
    s.physics.world.timeScale = 1 / factor; // 아케이드 물리는 값이 클수록 느림
    window.clearTimeout(this.slowTimer);
    this.slowTimer = window.setTimeout(() => {
      s.time.timeScale = 1;
      s.tweens.timeScale = 1;
      s.anims.globalTimeScale = 1;
      s.physics.world.timeScale = 1;
    }, ms);
  }

  isStopped(): boolean {
    return performance.now() < this.stopUntil;
  }

  /** 도트 숫자 팝업 (적·플레이어 공용) */
  popup(x: number, y: number, value: number, color: number, big: boolean): void {
    const s = big ? 2 : 1;
    const t = this.scene.add
      .bitmapText(Math.round(x), Math.round(y), 'dmg', String(value))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.number)
      .setLetterSpacing(-1)
      .setTint(color)
      .setScale(s * 2);
    const tw = this.scene.tweens;
    tw.add({ targets: t, scale: s, duration: 150, ease: 'Back.Out' });
    tw.add({ targets: t, y: t.y - (big ? 26 : 16), duration: 560, ease: 'Quad.Out' });
    tw.add({ targets: t, alpha: 0, delay: 520, duration: 220, onComplete: () => t.destroy() });
  }

  update(dt: number): void {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.gone) {
        this.targets.splice(i, 1);
        continue;
      }
      t.update(dt);
      if (!t.alive || !t.has('burn')) continue;
      t.burnTick -= dt;
      if (t.burnTick <= 0) {
        t.burnTick = 0.5;
        const dmg = Math.round(this.atk * 0.1);
        t.hit(dmg, 0, 0.2);
        this.popup(t.x + (Math.random() - 0.5) * 14, t.top + 8, dmg, NUM_COLOR.fire, false);
      }
    }
  }
}
