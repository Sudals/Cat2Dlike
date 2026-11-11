/**
 * 마법사 (먹물의 방울) 스킬 — docs/GAME_PLAN.md §6.2
 * 단축키: Z 불꽃 털뭉치 / X 꼬리 낙뢰 / C 서리 발자국 / V 달빛 낙하
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { beam, burst, flare, glowPulse, playFx, ringBurst, screenFlash, sparkles } from '../fx/fx';
import type { HitTarget } from '../combat/Target';
import type { SkillDef, SkillHost } from './types';

const FIRE = 0xff7a2e;
const BOLT = 0xfff27a;
const MOON = 0xfff3c4;
const CYAN = 0x7ff0ff;
const ICE = 0xbfefff;
const WHITE = 0xffffff;
const ADD = Phaser.BlendModes.ADD;
const UPDATE = Phaser.Scenes.Events.UPDATE;

/** 지팡이 끝 위치 (공격 포즈 기준) */
function staffTip(h: SkillHost): { x: number; y: number } {
  return { x: h.hero.x + h.dir() * 26, y: h.hero.y - 18 };
}

/** Z — 불꽃 털뭉치: 큼직한 화염구가 세 번 튀며 터지고, 마지막에 불기둥과 함께 대폭발 + 화상 */
export const FIREBALL: SkillDef = {
  id: 'mage_fire',
  name: '불꽃 털뭉치',
  slot: 'skill1',
  cooldown: 4,
  icon: 'mage_skill1',
  desc: '3번 튀는 거대 화염구 (튈 때 80%) → 불기둥 대폭발 (150%, 띄우기) + 화상',
  cast(h) {
    const { scene, hero, combat } = h;
    const dir = h.dir();
    h.lock(400);
    hero.play('hero_mage_attack');
    h.callout('불꽃 털뭉치!', '#ffb43a');

    scene.time.delayedCall(140, () => {
      let { x, y } = staffTip(h);
      let vx = dir * 250;
      let vy = -170;
      let bounces = 0;
      let done = false;
      glowPulse(scene, x, y, FIRE, 0.4, 1.8, 220, 0.85);
      flare(scene, x, y, FIRE, 1);
      const ball = scene.add.sprite(x, y, 'fx_fireball').play('fx_fireball').setScale(2).setFlipX(dir < 0).setDepth(DEPTH.fxTop);
      const halo = scene.add.image(x, y, 'fx_glow').setBlendMode(ADD).setTint(FIRE).setScale(1.4).setAlpha(0.8).setDepth(DEPTH.fx);
      const trail = scene.add
        .particles(0, 0, 'fx_ember', { follow: ball, speed: { min: 10, max: 60 }, gravityY: -90, lifespan: 520, frequency: 8, scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 } })
        .setDepth(DEPTH.fx);

      const explode = () => {
        done = true;
        scene.events.off(UPDATE, step);
        ball.destroy();
        halo.destroy();
        trail.stop();
        scene.time.delayedCall(600, () => trail.destroy());
        const gy = h.groundY;
        playFx(scene, 'fx_explosion', x, y - 22, { scale: 2.6, depth: DEPTH.fxTop });
        [-1, 1, 0].forEach((o, i) =>
          scene.time.delayedCall(70 + i * 70, () => playFx(scene, 'fx_explosion', x + o * 36, y - 8 - (o === 0 ? 44 : 0), { scale: 1.3, depth: DEPTH.fxTop })),
        );
        beam(scene, x, gy + 2, FIRE, 2.4, 0.95);
        ringBurst(scene, x, y - 12, FIRE, 2.6);
        flare(scene, x, y - 16, 0xffd36e, 2.4);
        glowPulse(scene, x, y - 10, FIRE, 1.5, 6.5, 520, 0.95);
        burst(scene, 'fx_ember', x, y - 8, 90, { angle: { min: 190, max: 350 }, speed: { min: 80, max: 340 }, gravityY: 480, lifespan: { min: 450, max: 1000 }, alpha: { start: 1, end: 0 } }, DEPTH.fxTop);
        screenFlash(scene, 0xff9a4a, 0.22, 150);
        const v = combat.hitCircle(x, y - 14, 84, { coef: 1.5, element: 'fire', status: 'burn', power: 2.6, launch: 260, hitstop: 110, shake: [280, 0.016], spark: null, gauge: 5 });
        if (v.length) combat.slowmo(0.45, 200);
      };

      const step = (_t: number, deltaMs: number) => {
        if (done || combat.isStopped()) return;
        const dt = Math.min(deltaMs, 50) / 1000;
        vy += 900 * dt;
        x += vx * dt;
        y += vy * dt;
        const floor = h.groundY - 12;
        if (y >= floor) {
          y = floor;
          bounces++;
          if (bounces >= 3) return explode();
          vy = -300 * Math.pow(0.85, bounces);
          playFx(scene, 'fx_explosion', x, y - 8, { scale: 1, depth: DEPTH.fxTop });
          ringBurst(scene, x, y, FIRE, 0.9);
          glowPulse(scene, x, y, FIRE, 0.6, 2.2, 240, 0.85);
          scene.cameras.main.shake(90, 0.006);
          combat.hitCircle(x, y - 8, 34, { coef: 0.8, element: 'fire', status: 'burn', power: 1.2, hitstop: 40, spark: null, gauge: 2 });
        }
        if (x < 8 || x > h.worldW - 8) return explode();
        if (bounces > 0 && combat.alive().some((d: HitTarget) => Math.abs(d.x - x) < 16 && y > d.top - 6 && y < d.bottom)) return explode();
        ball.setPosition(x, y).setAngle(ball.angle + dir * 14);
        halo.setPosition(x, y);
      };
      scene.events.on(UPDATE, step);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(UPDATE, step));
    });
  },
};

/** 두 지점 사이 지그재그 전기 줄 (굵은 보라 테두리 + 흰 심) */
function chainArc(scene: Phaser.Scene, x0: number, y0: number, x1: number, y1: number): void {
  const g = scene.add.graphics().setDepth(DEPTH.fxTop).setBlendMode(ADD);
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 12));
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 18;
    return new Phaser.Math.Vector2(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + j);
  });
  g.lineStyle(6, 0x9b6bff, 0.6).strokePoints(pts);
  g.lineStyle(3, BOLT, 0.9).strokePoints(pts);
  g.lineStyle(1, WHITE, 1).strokePoints(pts);
  scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
}

/** X — 꼬리 낙뢰: 가까운 적 5명에게 차례로 굵은 낙뢰 + 전기 사슬, 마지막에 첫 대상에 대낙뢰 */
export const THUNDER: SkillDef = {
  id: 'mage_thunder',
  name: '꼬리 낙뢰',
  slot: 'skill2',
  cooldown: 7,
  icon: 'mage_skill2',
  desc: '가까운 적 5명에게 낙뢰 (160%) → 대낙뢰 (120%, 띄우기) + 감전',
  cast(h) {
    const { scene, hero, combat } = h;
    const dir = h.dir();
    h.lock(500);
    hero.play('hero_mage_attack');
    h.callout('꼬리 낙뢰!', '#fff27a');
    const tip = staffTip(h);
    playFx(scene, 'fx_spark_magic', tip.x, tip.y, { add: true, scale: 2, depth: DEPTH.fxTop });
    flare(scene, tip.x, tip.y, BOLT, 1.2);
    h.speedlines(900, 0xd8c8ff);

    const found = combat.nearest(hero.x, hero.y - 22, 5, 400);
    const points: { x: number; d?: HitTarget }[] = found.length ? found.map((d) => ({ x: d.x, d })) : [80, 140, 200, 260, 320].map((o) => ({ x: hero.x + dir * o }));
    const gy = h.groundY;

    points.forEach((p, i) =>
      scene.time.delayedCall(170 + i * 110, () => {
        const x = p.d?.alive ? p.d.x : p.x;
        playFx(scene, 'fx_lightning', x, gy, { add: true, origin: [0.5, 1], scaleX: 1.6, depth: DEPTH.fxTop });
        playFx(scene, 'fx_lightning', x + 2, gy, { add: true, origin: [0.5, 1], scaleX: 3.2, alpha: 0.35, depth: DEPTH.fx });
        screenFlash(scene, 0xd8c8ff, i === 0 ? 0.24 : 0.1, 110);
        glowPulse(scene, x, gy - 12, BOLT, 1, 3.6, 320, 0.9);
        ringBurst(scene, x, gy - 20, BOLT, 1.6);
        flare(scene, x, gy - 24, BOLT, 1.6);
        playFx(scene, 'fx_ring', x, gy - 2, { add: true, scale: 4, tint: BOLT, depth: DEPTH.fxTop });
        burst(
          scene,
          'fx_sparkle',
          x,
          gy - 8,
          34,
          { angle: { min: 200, max: 340 }, speed: { min: 80, max: 280 }, gravityY: 520, lifespan: { min: 300, max: 650 }, alpha: { start: 1, end: 0 }, tint: [BOLT, WHITE, 0xb98bff] },
          DEPTH.fxTop,
          true,
        );
        scene.cameras.main.shake(140, 0.009);
        if (p.d?.alive) combat.hit(p.d, { coef: 1.6, element: 'lightning', status: 'shock', power: 2, hitstop: 80, spark: null, gauge: 5 });
        else combat.hitCircle(x, gy - 22, 30, { coef: 1.6, element: 'lightning', status: 'shock', power: 2, hitstop: 50, spark: null, gauge: 5 });
        const next = points[i + 1];
        if (next) chainArc(scene, x, gy - 26, next.d?.alive ? next.d.x : next.x, gy - 26);
      }),
    );

    // 대낙뢰
    scene.time.delayedCall(170 + points.length * 110 + 140, () => {
      const first = points[0];
      const x = first.d?.alive ? first.d.x : first.x;
      playFx(scene, 'fx_lightning', x, gy, { add: true, origin: [0.5, 1], scaleX: 4, depth: DEPTH.fxTop });
      playFx(scene, 'fx_lightning', x, gy, { add: true, origin: [0.5, 1], scaleX: 7, alpha: 0.3, depth: DEPTH.fx });
      beam(scene, x, gy + 2, 0xd8c8ff, 3, 1.3);
      ringBurst(scene, x, gy - 24, BOLT, 3);
      flare(scene, x, gy - 28, WHITE, 3);
      glowPulse(scene, x, gy - 20, BOLT, 1.5, 7, 560, 0.95);
      screenFlash(scene, 0xe8e0ff, 0.3, 160);
      scene.cameras.main.shake(300, 0.016);
      const v = combat.hitCircle(x, gy - 24, 72, { coef: 1.2, element: 'lightning', status: 'shock', power: 2.6, launch: 280, hitstop: 120, spark: null, gauge: 4 });
      if (v.length) combat.slowmo(0.5, 170);
    });
  },
};

/** C — 서리 발자국: 고양이 발자국을 따라 큰 얼음 가시가 연달아 솟고, 마지막 거대 빙정이 산산조각 (냉기 → 이동속도 -50%) */
export const FROST: SkillDef = {
  id: 'mage_frost',
  name: '서리 발자국',
  slot: 'skill3',
  cooldown: 6,
  icon: 'mage_skill3',
  desc: '전방으로 얼음 가시 5개 (70%) → 거대 빙정 폭발 (140%, 띄우기) + 냉기',
  cast(h) {
    const { scene, hero, combat } = h;
    const dir = h.dir();
    h.lock(500);
    hero.play('hero_mage_attack');
    h.callout('서리 발자국!', '#bfefff');
    const x0 = hero.x;
    const gy = h.groundY;
    for (let i = 0; i < 6; i++) {
      scene.time.delayedCall(150 + i * 70, () => {
        const big = i === 5;
        const x = Phaser.Math.Clamp(x0 + dir * (36 + i * 34), 10, h.worldW - 10);
        const paw = scene.add.image(x - dir * 6, gy - 2, 'fx_pawprint').setFlipX(dir < 0).setScale(1.5).setDepth(DEPTH.splash + 1).setBlendMode(ADD);
        scene.tweens.add({ targets: paw, alpha: 0, delay: 1000, duration: 500, onComplete: () => paw.destroy() });
        playFx(scene, 'fx_icespike', x, gy + 1, { origin: [0.5, 1], depth: DEPTH.fxTop, scale: big ? 3 : 1.5 });
        glowPulse(scene, x, gy - 16, CYAN, 0.6, big ? 4 : 2.2, 300, 0.8);
        burst(
          scene,
          'fx_shard',
          x,
          gy - 14,
          big ? 50 : 14,
          { angle: { min: 200, max: 340 }, speed: { min: 70, max: big ? 340 : 200 }, gravityY: 520, lifespan: { min: 300, max: 700 }, alpha: { start: 1, end: 0.2 } },
          DEPTH.fxTop,
        );
        sparkles(scene, x, gy - 20, big ? 40 : 12, [WHITE, ICE, CYAN], big ? 300 : 180);
        scene.cameras.main.shake(big ? 200 : 70, big ? 0.012 : 0.004);
        const hgt = big ? 110 : 60;
        const w = big ? 56 : 30;
        const v = combat.hitRect(
          new Phaser.Geom.Rectangle(x - w / 2, gy - hgt, w, hgt),
          { coef: big ? 1.4 : 0.7, element: 'ice', status: 'chill', dir, power: big ? 2.2 : 1, launch: big ? 360 : 0, hitstop: big ? 100 : 40, spark: null, gauge: 3 },
          x0,
        );
        if (big) {
          ringBurst(scene, x, gy - 30, CYAN, 2.6);
          flare(scene, x, gy - 40, ICE, 2.4);
          playFx(scene, 'fx_shockwave', x, gy - 2, { add: true, scale: 1.8, tint: ICE, depth: DEPTH.fxTop });
          beam(scene, x, gy + 2, CYAN, 2, 0.9);
          screenFlash(scene, 0xbfefff, 0.2, 140);
          if (v.length) combat.slowmo(0.45, 180);
        }
      });
    }
  },
};

/** V — 달빛 낙하: 암전·컷인 → 1.6배 거대 달이 떨어져 화면 전체 폭발, 원소 상태이상 무작위 부여 */
export const MOONFALL: SkillDef = {
  id: 'mage_ult',
  name: '달빛 낙하',
  slot: 'ult',
  cooldown: 0,
  icon: 'mage_ult',
  desc: '거대한 달 낙하 — 화면 전체 폭발 (800%) + 원소 상태이상',
  cast(h) {
    const { scene, hero, combat } = h;
    const cam = scene.cameras.main;
    const dir = h.dir();
    const gy = h.groundY;
    h.lock(2900);
    hero.anims.stop();
    hero.setFrame('attack_1');
    h.cutIn('달빛 낙하', 0x7fd4ff);
    h.dim(0.86, 300);

    const view = cam.worldView;
    const ix = Phaser.Math.Clamp(hero.x + dir * 120, view.x + 80, view.right - 80);
    const iy = gy - 46;

    scene.time.delayedCall(700, () => {
      hero.setFrame('upatk_2');
      const tip = { x: hero.x + dir * 2, y: hero.y - 58 };
      playFx(scene, 'fx_spark_magic', tip.x, tip.y, { add: true, scale: 3, depth: DEPTH.fxTop });
      flare(scene, tip.x, tip.y, CYAN, 2);
      glowPulse(scene, tip.x, tip.y, CYAN, 0.6, 3, 600, 0.9);
      beam(scene, hero.x, gy + 2, CYAN, 1.4, 1.2);
      h.speedlines(1150, MOON);

      const moon = scene.add.image(ix - dir * 180, view.y - 120, 'fx_moon').setScale(1.6).setDepth(DEPTH.fxTop);
      const halo = scene.add.image(moon.x, moon.y, 'fx_glow').setBlendMode(ADD).setTint(MOON).setScale(5.4).setAlpha(0.75).setDepth(DEPTH.fx);
      const stars = scene.add
        .particles(0, 0, 'fx_sparkle', {
          follow: moon,
          x: { min: -80, max: 80 },
          y: { min: -80, max: 80 },
          speed: { min: 10, max: 80 },
          lifespan: 800,
          frequency: 6,
          alpha: { start: 1, end: 0 },
          tint: [WHITE, MOON, CYAN],
        })
        .setBlendMode(ADD)
        .setDepth(DEPTH.fx);
      cam.shake(1050, 0.004);

      scene.tweens.add({
        targets: [moon, halo],
        x: ix,
        y: iy,
        duration: 1050,
        ease: 'Quad.In',
        onComplete: () => {
          moon.destroy();
          halo.destroy();
          stars.stop();
          scene.time.delayedCall(900, () => stars.destroy());
          impact();
        },
      });
    });

    const impact = () => {
      cam.flash(420, 255, 255, 240);
      cam.shake(720, 0.026);
      cam.zoomTo(1.15, 60);
      scene.time.delayedCall(80, () => cam.zoomTo(1, 700, 'Quad.easeOut'));
      beam(scene, ix, gy + 2, MOON, 5, 2.4, DEPTH.fxTop);
      playFx(scene, 'fx_shockwave', ix, gy - 4, { add: true, scale: 3.5, depth: DEPTH.fxTop });
      scene.time.delayedCall(130, () => playFx(scene, 'fx_shockwave', ix, gy - 4, { add: true, scale: 2.2, tint: CYAN, depth: DEPTH.fxTop }));
      ringBurst(scene, ix, iy, MOON, 5);
      scene.time.delayedCall(100, () => ringBurst(scene, ix, iy, CYAN, 3.5));
      flare(scene, ix, iy, MOON, 4);
      glowPulse(scene, ix, iy, MOON, 2, 11, 900, 1, DEPTH.fxTop);
      glowPulse(scene, ix, iy, CYAN, 1, 7, 700, 0.85);
      for (let i = -4; i <= 4; i++) scene.time.delayedCall(Math.abs(i) * 40, () => playFx(scene, 'fx_dust', ix + i * 40, gy, { scale: 3, depth: DEPTH.fx }));
      burst(
        scene,
        'fx_sparkle',
        ix,
        iy,
        160,
        { angle: { min: 180, max: 360 }, speed: { min: 120, max: 520 }, gravityY: 380, lifespan: { min: 600, max: 1400 }, alpha: { start: 1, end: 0 }, tint: [WHITE, MOON, CYAN] },
        DEPTH.fxTop,
        true,
      );
      const statuses = ['burn', 'shock', 'chill'] as const;
      for (const d of combat.inView()) {
        combat.hit(d, { coef: 8, element: 'moon', status: statuses[Math.floor(Math.random() * 3)], power: 3, critBonus: 0.3, spark: 'fx_spark_magic', sparkScale: 2.5, gauge: 0 }, ix);
      }
      combat.hitstop(160);
      scene.time.delayedCall(10, () => combat.slowmo(0.3, 600));
      sparkles(scene, hero.x, hero.y - 30, 14, CYAN);
      scene.time.delayedCall(800, () => h.dim(0, 700));
    };
  },
};
