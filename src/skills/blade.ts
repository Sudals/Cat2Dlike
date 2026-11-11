/**
 * 검객 (치즈의 방울) 스킬 — docs/GAME_PLAN.md §6.1
 * 단축키: Z 발도 일섬 / X 회오리 할퀴기 / C 승천 송곳니 / V 천냥 난무
 * 공통 연출 재료: 집중선, 빛 폭발(flare), 원형 충격파(ringBurst), 빛기둥(beam), 슬로모션
 */
import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { beam, burst, flare, glowPulse, playFx, ringBurst, screenFlash, sparkles } from '../fx/fx';
import type { HitTarget } from '../combat/Target';
import type { SkillDef } from './types';

const GOLD = 0xffd08a;
const EMBER = 0xffb46a;
const FLAME = 0xff7a2e;
const CRIMSON = 0xff4a3a;
const WHITE = 0xffffff;
const ADD = Phaser.BlendModes.ADD;
const UPDATE = Phaser.Scenes.Events.UPDATE;

/** Z — 발도 일섬: 기를 모았다가 230px 을 꿰뚫는 섬광 돌진 → 잔상이 X자로 다시 벤다 */
export const IAI: SkillDef = {
  id: 'blade_iai',
  name: '발도 일섬',
  slot: 'skill1',
  cooldown: 6,
  icon: 'blade_skill1',
  desc: '전방 230px 관통 섬광 돌진 (250%) → 잔상 X자 베기 (120%)',
  cast(h) {
    const { scene, hero, combat } = h;
    const cam = scene.cameras.main;
    const dir = h.dir();
    h.lock(820);
    hero.anims.stop();
    hero.setFrame('attack_1');
    h.callout('발도 일섬!', '#ffd08a');
    playFx(scene, 'fx_glint', hero.x - dir * 6, hero.y - 44, { add: true, scale: 2, depth: DEPTH.fxTop });
    glowPulse(scene, hero.x, hero.y - 24, GOLD, 0.5, 2.4, 320, 0.7);
    cam.zoomTo(1.1, 200, 'Quad.easeOut');
    h.speedlines(440, GOLD);

    scene.time.delayedCall(220, () => {
      const x0 = hero.x;
      const x1 = Phaser.Math.Clamp(x0 + dir * 230, 24, h.worldW - 24);
      const y = hero.y - 22;
      const len = Math.abs(x1 - x0) + 80;
      const mid = (x0 + x1) / 2;
      for (let i = 0; i < 8; i++) h.afterimage(x0 + (x1 - x0) * (i / 8), hero.y, 0xffe0a0);
      hero.setX(x1);
      hero.setFrame('attack_3');

      playFx(scene, 'fx_iai_line', mid, y, { add: true, scaleX: len / 160, scaleY: 2, depth: DEPTH.fxTop });
      playFx(scene, 'fx_iai_line', mid, y, { add: true, scaleX: (len / 160) * 1.15, scaleY: 6, alpha: 0.35, tint: GOLD });
      flare(scene, x1 + dir * 12, y, GOLD, 1.6);
      for (let i = 0; i <= 5; i++) {
        scene.time.delayedCall(i * 25, () => playFx(scene, 'fx_dust', x0 + ((x1 - x0) * i) / 5, hero.y, { scale: 2, depth: DEPTH.fx }));
      }
      burst(
        scene,
        'fx_sparkle',
        mid,
        y,
        44,
        { x: { min: -len / 2, max: len / 2 }, speedX: { min: dir * 30, max: dir * 220 }, speedY: { min: -50, max: 50 }, lifespan: { min: 300, max: 650 }, alpha: { start: 1, end: 0 }, tint: [WHITE, GOLD] },
        DEPTH.fxTop,
        true,
      );
      screenFlash(scene, WHITE, 0.3, 140);
      cam.zoomTo(1, 360, 'Quad.easeOut');

      const rect = new Phaser.Geom.Rectangle(Math.min(x0, x1) - 16, y - 36, Math.abs(x1 - x0) + 32, 72);
      const victims = combat.hitRect(rect, { coef: 2.5, dir, power: 2.2, hitstop: 120, shake: [220, 0.012], sparkScale: 2, gauge: 6 });
      if (victims.length) combat.slowmo(0.35, 260);

      // 잔상 X자 베기
      scene.time.delayedCall(480, () => {
        const marks: { x: number; y: number; d?: HitTarget }[] = victims.filter((d) => d.alive).map((d) => ({ x: d.x, y: d.cy, d }));
        if (!marks.length) marks.push({ x: x1 - dir * 60, y });
        marks.forEach(({ x, y: my, d }, i) =>
          scene.time.delayedCall(i * 50, () => {
            playFx(scene, 'fx_cross', x, my, { add: true, scale: 2.4, depth: DEPTH.fxTop });
            flare(scene, x, my, EMBER, 1.3);
            ringBurst(scene, x, my, GOLD, 0.8);
            glowPulse(scene, x, my, EMBER, 0.6, 2.4, 300, 0.8);
            if (d) combat.hit(d, { coef: 1.2, dir, power: 2, hitstop: 80, shake: [120, 0.008], critBonus: 0.3, sparkScale: 1.6, gauge: 4 });
          }),
        );
      });
    });
  },
};

/**
 * X — 회오리 할퀴기: 낮게 웅크려 실제로 몸을 회전시키며 베고, 금빛→주황→진홍 3겹 불꽃 회오리를 두른다.
 * 회전하는 동안 주변 적을 끌어당기고, 마지막에 화염 회오리가 폭발하며 적을 띄운다.
 */
export const WHIRL: SkillDef = {
  id: 'blade_whirl',
  name: '회오리 할퀴기',
  slot: 'skill2',
  cooldown: 8,
  icon: 'blade_skill2',
  desc: '불꽃 회오리를 두르고 3회전 베기 (80% ×3, 끌어당김) → 화염 회오리 폭발 (150%, 띄우기)',
  cast(h) {
    const { scene, hero, combat } = h;
    const facing = hero.flipX;
    const cy = () => hero.y - 22;
    h.lock(1120);
    h.callout('회오리 할퀴기!', '#ffb46a');
    h.speedlines(980, EMBER);
    hero.setFlipX(false);
    hero.play('hero_blade_spin');
    playFx(scene, 'fx_dust', hero.x - 10, hero.y, { scale: 2, flip: true });
    playFx(scene, 'fx_dust', hero.x + 10, hero.y, { scale: 2 });

    // 3겹 색 고리 (안: 흰빛 / 중간: 주황 / 바깥: 진홍), 서로 다른 속도로 회전
    const rings = [
      { scale: 1.7, alpha: 1, tint: WHITE, depth: DEPTH.fxTop, speed: 1.25 },
      { scale: 2.3, alpha: 0.75, tint: 0xffa040, depth: DEPTH.fxTop, speed: 0.95 },
      { scale: 2.9, alpha: 0.5, tint: CRIMSON, depth: DEPTH.fx, speed: 0.7 },
    ].map((r) => {
      const s = scene.add.sprite(hero.x, cy(), 'fx_whirl', '0').setBlendMode(ADD).setScale(r.scale).setAlpha(r.alpha).setTint(r.tint).setDepth(r.depth).play('fx_whirl');
      s.anims.timeScale = r.speed;
      return s;
    });
    // 화염 회오리 기둥 + 바닥 빛
    // 회오리 기둥·바닥 빛은 캐릭터 뒤에 (회전 동작이 가려지지 않게)
    const vortex = scene.add.sprite(hero.x, hero.y + 4, 'fx_vortex', '0').setOrigin(0.5, 1).setBlendMode(ADD).setScale(1.7, 1.5).setAlpha(0).setDepth(DEPTH.hero - 1).play('fx_vortex');
    scene.tweens.add({ targets: vortex, alpha: 0.85, duration: 160 });
    const floor = scene.add.image(hero.x, hero.y, 'fx_glow').setBlendMode(ADD).setTint(FLAME).setScale(2.6, 0.4).setAlpha(0.5).setDepth(DEPTH.hero - 2);
    // 휘몰아치는 바람 조각 + 불씨
    const wind = scene.add
      .particles(0, 0, 'fx_sparkle', {
        x: { min: -80, max: 80 },
        y: { min: -14, max: 8 },
        speedY: { min: -240, max: -70 },
        speedX: { min: -70, max: 70 },
        lifespan: 620,
        frequency: 7,
        alpha: { start: 1, end: 0 },
        tint: [WHITE, GOLD, 0xffa040, CRIMSON],
      })
      .setBlendMode(ADD)
      .setDepth(DEPTH.fxTop);
    const embers = scene.add
      .particles(0, 0, 'fx_ember', { x: { min: -60, max: 60 }, speedY: { min: -170, max: -40 }, speedX: { min: -50, max: 50 }, lifespan: 700, frequency: 12, alpha: { start: 1, end: 0 } })
      .setDepth(DEPTH.fxTop);
    const follow = () => {
      rings.forEach((r) => r.setPosition(hero.x, cy()));
      vortex.setPosition(hero.x, hero.y + 4);
      floor.setPosition(hero.x, hero.y);
      wind.setPosition(hero.x, hero.y - 6);
      embers.setPosition(hero.x, hero.y - 10);
    };
    follow();
    scene.events.on(UPDATE, follow);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(UPDATE, follow));

    const colors = [GOLD, 0xffa040, CRIMSON];
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(80 + i * 250, () => {
        combat.hitCircle(hero.x, cy(), 86, { coef: 0.8, power: 1.2, pull: true, hitstop: 55, shake: [90, 0.005], gauge: 3 });
        ringBurst(scene, hero.x, cy(), colors[i], 1.3 + i * 0.35);
        flare(scene, hero.x, cy(), colors[i], 0.9 + i * 0.2);
        sparkles(scene, hero.x, cy(), 26, [WHITE, colors[i]], 260);
      });
    }

    scene.time.delayedCall(900, () => {
      scene.events.off(UPDATE, follow);
      rings.forEach((r) => r.destroy());
      wind.stop();
      embers.stop();
      scene.time.delayedCall(700, () => {
        wind.destroy();
        embers.destroy();
      });
      scene.tweens.add({ targets: vortex, scaleX: 3.4, scaleY: 2.2, alpha: 0, duration: 320, ease: 'Quad.Out', onComplete: () => vortex.destroy() });
      scene.tweens.add({ targets: floor, alpha: 0, duration: 300, onComplete: () => floor.destroy() });
      hero.anims.stop();
      hero.setFlipX(facing);
      hero.setFrame('attack_3');

      // 화염 회오리 폭발
      const x = hero.x;
      const y = cy();
      beam(scene, x, hero.y + 2, FLAME, 2.6, 1.3);
      playFx(scene, 'fx_explosion', x, y - 6, { scale: 2, depth: DEPTH.fxTop });
      playFx(scene, 'fx_shockwave', x, hero.y - 2, { add: true, scale: 2.2, tint: 0xffc070, depth: DEPTH.fxTop });
      playFx(scene, 'fx_cross', x, y, { add: true, scale: 3.4, depth: DEPTH.fxTop });
      flare(scene, x, y, 0xffd36e, 2.8);
      ringBurst(scene, x, y, FLAME, 2.8);
      scene.time.delayedCall(90, () => ringBurst(scene, x, y, GOLD, 1.8));
      glowPulse(scene, x, y, FLAME, 1, 6, 520, 0.9);
      sparkles(scene, x, y, 70, [WHITE, GOLD, 0xffa040, CRIMSON], 380);
      burst(scene, 'fx_ember', x, y, 60, { speed: { min: 80, max: 300 }, angle: { min: 190, max: 350 }, gravityY: 420, lifespan: { min: 400, max: 900 }, alpha: { start: 1, end: 0 } }, DEPTH.fxTop);
      screenFlash(scene, 0xffb46a, 0.26, 170);
      const v = combat.hitCircle(x, y, 110, { coef: 1.5, power: 2.6, launch: 340, hitstop: 130, shake: [280, 0.015], sparkScale: 1.8, gauge: 5 });
      if (v.length) combat.slowmo(0.4, 240);
    });
  },
};

/** C — 승천 송곳니: 빛기둥과 함께 솟구치며 올려베기, 적을 높이 띄운다 → 공중 콤보 연계 */
export const RISING: SkillDef = {
  id: 'blade_rising',
  name: '승천 송곳니',
  slot: 'skill3',
  cooldown: 7,
  icon: 'blade_skill3',
  desc: '빛기둥 올려베기 (180%) + 적을 높이 띄움, 함께 솟구쳐 공중 콤보 연계',
  cast(h) {
    const { scene, hero, combat } = h;
    const dir = h.dir();
    h.lock(580);
    hero.anims.stop();
    hero.setFrame('attack2_0');
    h.callout('승천 송곳니!', '#ffe14a');
    playFx(scene, 'fx_glint', hero.x + dir * 10, hero.y - 8, { add: true, scale: 1.6, depth: DEPTH.fxTop });
    glowPulse(scene, hero.x, hero.y - 10, 0xffe14a, 0.4, 1.6, 200, 0.7);
    scene.time.delayedCall(110, () => {
      const x = hero.x;
      const y0 = hero.y;
      const fx = x + dir * 16;
      hero.setFrame('attack2_2');
      scene.tweens.add({ targets: hero, y: y0 - 110, duration: 280, ease: 'Quad.Out' });
      scene.time.delayedCall(90, () => hero.setFrame('attack2_3'));
      scene.time.addEvent({ delay: 35, repeat: 6, callback: () => h.afterimage(undefined, undefined, 0xffe0a0) });
      h.speedlines(380, 0xffe14a);

      beam(scene, fx, y0 + 2, 0xffe14a, 1.8, 1.15);
      playFx(scene, 'fx_slash', x + dir * 14, y0 - 36, { add: true, flip: dir < 0, scale: 2.4, origin: [0.5, 26 / 48], depth: DEPTH.fxTop }).setFlipY(true);
      playFx(scene, 'fx_iai_line', fx, y0 - 72, { add: true, angle: dir > 0 ? -78 : -102, scaleX: 1.1, scaleY: 2, depth: DEPTH.fxTop });
      flare(scene, fx, y0 - 40, 0xffe14a, 1.9);
      ringBurst(scene, fx, y0 - 6, GOLD, 1.1);
      playFx(scene, 'fx_dust', x, y0, { scale: 3, depth: DEPTH.fx });
      glowPulse(scene, fx, y0 - 30, 0xffe14a, 0.7, 3, 360, 0.85);
      burst(
        scene,
        'fx_sparkle',
        fx,
        y0 - 20,
        50,
        { angle: { min: 245, max: 295 }, speed: { min: 150, max: 420 }, lifespan: { min: 300, max: 650 }, alpha: { start: 1, end: 0 }, tint: [WHITE, 0xffe14a, GOLD] },
        DEPTH.fxTop,
        true,
      );
      screenFlash(scene, 0xfff1c8, 0.18, 120);
      const rect = new Phaser.Geom.Rectangle(dir > 0 ? x - 10 : x - 62, y0 - 140, 72, 140);
      const v = combat.hitRect(rect, { coef: 1.8, dir, power: 2, launch: 520, hitstop: 100, shake: [170, 0.01], sparkScale: 1.6, gauge: 5 }, x);
      if (v.length) combat.slowmo(0.5, 160);
    });
  },
};

/** V — 천냥 난무: 암전·컷인 → 화면 안의 적 사이를 순간이동하며 16연속 베기 → 납도와 함께 화면을 가르는 거대 X자 */
export const THOUSAND: SkillDef = {
  id: 'blade_ult',
  name: '천냥 난무',
  slot: 'ult',
  cooldown: 0,
  icon: 'blade_ult',
  desc: '화면 내 적에게 순간이동 16연속 베기 (60% ×16) → 납도 일괄 폭발 (300%)',
  cast(h) {
    const { scene, hero, combat } = h;
    const cam = scene.cameras.main;
    const home = { x: hero.x, y: hero.y };
    const facing = hero.flipX;
    const START = 760;
    const CUTS = 16;
    const STEP = 58;
    h.lock(START + CUTS * STEP + 1150);
    hero.anims.stop();
    hero.setFrame('attack_1');
    h.cutIn('천냥 난무', 0xff9a4a);
    h.dim(0.84, 260);
    cam.zoomTo(1.1, 420, 'Quad.easeOut');
    playFx(scene, 'fx_glint', hero.x, hero.y - 44, { add: true, scale: 2, depth: DEPTH.fxTop });
    scene.time.delayedCall(START - 60, () => h.speedlines(CUTS * STEP + 420, GOLD));

    const targets = combat.inView();
    const victims = new Set<HitTarget>();
    for (let i = 0; i < CUTS; i++) {
      scene.time.delayedCall(START + i * STEP, () => {
        const t = targets.length ? targets[i % targets.length] : undefined;
        const side = i % 2 ? 1 : -1;
        const tx = t?.alive ? t.x : home.x + side * (24 + ((i * 17) % 70));
        const ty = t?.alive ? t.cy : home.y - 22;
        h.afterimage(undefined, undefined, 0xffe0a0);
        hero.setPosition(Phaser.Math.Clamp(tx + side * 24, 24, h.worldW - 24), t?.alive ? t.bottom : home.y);
        hero.setFlipX(side > 0);
        hero.setFrame(i % 2 ? 'attack_3' : 'attack_4');
        const angle = Phaser.Math.Between(-65, 65) + (Math.random() < 0.5 ? 0 : 180);
        playFx(scene, 'fx_iai_line', tx, ty, { add: true, angle, scaleX: 0.95, scaleY: 1.5, depth: DEPTH.fxTop });
        flare(scene, tx, ty, i % 3 ? GOLD : EMBER, 0.8);
        if (i % 4 === 3) ringBurst(scene, tx, ty, GOLD, 1);
        if (t?.alive) {
          combat.hit(t, { coef: 0.6, dir: -side, power: 1.3, hitstop: 24, shake: [40, 0.005], gauge: 0 });
          victims.add(t);
        } else {
          playFx(scene, 'fx_spark', tx, ty, { add: true, scale: 1.6, depth: DEPTH.fxTop });
        }
      });
    }

    // 납도: 원위치로 돌아와 칼을 거둔다 (정적)
    const sheathe = START + CUTS * STEP + 160;
    scene.time.delayedCall(sheathe, () => {
      h.afterimage(undefined, undefined, 0xffe0a0);
      hero.setPosition(home.x, home.y);
      hero.setFlipX(facing);
      hero.setFrame('attack_5');
      playFx(scene, 'fx_glint', hero.x + (facing ? -10 : 10), hero.y - 26, { add: true, scale: 2.5, depth: DEPTH.fxTop });
      h.callout('...찰칵', '#ffffff');
    });

    // 화면을 가르는 거대 X자 + 일괄 폭발
    scene.time.delayedCall(sheathe + 450, () => {
      const v = cam.worldView;
      cam.flash(320, 255, 250, 230);
      cam.shake(620, 0.02);
      cam.zoomTo(1, 620, 'Quad.easeOut');
      h.dim(0, 650);
      playFx(scene, 'fx_cross', v.centerX, v.centerY - 10, { add: true, scale: 7, alpha: 0.85, depth: DEPTH.fxTop });
      ringBurst(scene, v.centerX, v.centerY - 10, GOLD, 4);
      for (const d of victims) {
        if (!d.alive) continue;
        playFx(scene, 'fx_cross', d.x, d.cy, { add: true, scale: 2.6, depth: DEPTH.fxTop });
        flare(scene, d.x, d.cy, EMBER, 2.2);
        glowPulse(scene, d.x, d.cy, EMBER, 1, 4.5, 560, 0.9);
        sparkles(scene, d.x, d.cy, 36, [WHITE, GOLD, EMBER], 340);
        combat.hit(d, { coef: 3.0, power: 3, critBonus: 0.5, sparkScale: 2.5, gauge: 0 }, home.x);
      }
      combat.hitstop(180);
      scene.time.delayedCall(10, () => combat.slowmo(0.3, 520));
    });
  },
};
