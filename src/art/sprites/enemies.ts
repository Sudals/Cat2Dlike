/**
 * 1장 뒷골목 적 도트 (docs/GAME_PLAN.md §10.1)
 * - 네발 리그: 시궁쥐, 떠돌이 들개 (부위 파라미터 + 포즈)
 * - 비둘기 폭격기: 전용 드로잉
 * - 칼잡이 쥐: 주인공 직립 리그(cat.ts) 재사용 (species: 'rat')
 * 텍스처 키 enemy_<종류>, 애니 키 enemy_<종류>_<동작>
 */
import type Phaser from 'phaser';
import { PixelCanvas, framePos, makeSheet, type Palette } from '../PixelCanvas';
import { TAU } from '../rng';
import { buildHeroFrames, HERO_ANIMS, HERO_FRAME_H, HERO_FRAME_W, LOADOUT_THUG } from './cat';

// 네발 리그 팔레트 인덱스
const OUT = 1, FUR_HI = 2, FUR = 3, FUR_LO = 4, FAR = 5, BELLY = 6, PINK = 7, EYE = 8, DARK = 9, WHITE = 10, ACC = 11, MARK = 12;

interface Leg { dx: number; lift: number }

interface QuadSpec {
  w: number;
  h: number;
  foot: number;
  body: { x: number; y: number; rx: number; ry: number };
  head: { dx: number; dy: number; r: number };
  snout: { dx: number; dy: number; rx: number; ry: number };
  ear: 'round' | 'floppy';
  earR: number;
  legR: number;
  tail: { n: number; seg: number; r0: number; r1: number; pink: boolean };
  collar: boolean;
  mark: boolean;
}

interface QuadPose {
  bob: number;
  stretch: number;
  tilt: number; // + 앞(머리) 올라감
  headDY: number;
  mouth: number; // 0~1
  crouch: number;
  legs: [Leg, Leg, Leg, Leg]; // 뒤-먼, 앞-먼, 뒤-가까운, 앞-가까운
  tailA: number;
  tailCurl: number;
  tailSway: number;
  eye: 'angry' | 'closed';
}

const STAND: QuadPose['legs'] = [{ dx: -1, lift: 0 }, { dx: 1, lift: 0 }, { dx: 0, lift: 0 }, { dx: 0, lift: 0 }];
const QBASE: QuadPose = {
  bob: 0, stretch: 1, tilt: 0, headDY: 0, mouth: 0, crouch: 0, legs: STAND,
  tailA: Math.PI + 0.3, tailCurl: 0.12, tailSway: 0, eye: 'angry',
};

function drawQuad(S: QuadSpec, p: QuadPose): PixelCanvas {
  const c = new PixelCanvas(S.w, S.h);
  const { rx, ry } = S.body;
  const sp = (p.stretch - 1) * rx;
  const by = S.body.y + p.bob + p.crouch;
  const rearX = S.body.x - rx * 0.55 - sp * 0.5;
  const frontX = S.body.x + rx * 0.55 + sp * 0.5;
  const rearY = by + p.tilt * 0.5;
  const frontY = by - p.tilt * 0.5;
  const hips = [
    [rearX - 1, rearY + ry * 0.5],
    [frontX - 1, frontY + ry * 0.5],
    [rearX + 1, rearY + ry * 0.6],
    [frontX + 1, frontY + ry * 0.6],
  ] as const;
  const leg = (i: number, col: number, paw: number) => {
    const [x0, y0] = hips[i];
    const x1 = x0 + p.legs[i].dx;
    const y1 = S.foot - 1 - p.legs[i].lift;
    c.capsule(x0, y0, x1, y1, S.legR, col);
    c.ellipse(x1 + 0.6, y1 + 0.2, S.legR + 0.6, S.legR * 0.7, paw);
  };

  leg(0, FAR, FAR);
  leg(1, FAR, FAR);

  // 꼬리
  let tx = rearX - rx * 0.4;
  let ty = rearY - ry * 0.3;
  let a = p.tailA;
  const tailPts: [number, number][] = [[tx, ty]];
  for (let i = 0; i < S.tail.n; i++) {
    a += p.tailCurl + p.tailSway * (i / S.tail.n);
    tx += Math.cos(a) * S.tail.seg;
    ty += Math.sin(a) * S.tail.seg;
    tailPts.push([tx, ty]);
  }
  for (let i = 0; i < S.tail.n; i++) {
    const r = S.tail.r0 + (S.tail.r1 - S.tail.r0) * (i / S.tail.n);
    c.capsule(tailPts[i][0], tailPts[i][1], tailPts[i + 1][0], tailPts[i + 1][1], r, S.tail.pink ? PINK : FUR);
  }

  // 몸통
  c.ellipse(rearX, rearY, ry * 1.1, ry, FUR);
  c.ellipse((rearX + frontX) / 2, by, (frontX - rearX) / 2 + ry * 0.6, ry * 0.95, FUR);
  c.ellipse(frontX, frontY - 0.5, ry * 1.05, ry * 1.05, FUR);

  // 머리 + 주둥이 (+ 벌린 아래턱)
  const hx = frontX + S.head.dx;
  const hy = frontY + S.head.dy + p.headDY;
  const sx = hx + S.snout.dx;
  const sy = hy + S.snout.dy;
  if (S.ear === 'round') c.ellipse(hx - S.head.r * 0.3, hy - S.head.r * 0.9, S.earR, S.earR, FUR);
  c.ellipse(hx, hy, S.head.r, S.head.r, FUR);
  c.ellipse(sx, sy - p.mouth * 0.8, S.snout.rx, S.snout.ry, FUR);
  if (p.mouth > 0) {
    c.ellipse(sx - 0.5, sy + S.snout.ry * 0.6 + p.mouth * 1.6, S.snout.rx * 0.85, S.snout.ry * 0.55, FUR);
  }

  // 가까운 다리, 배
  leg(2, FUR, FUR);
  leg(3, FUR, FUR);
  c.ellipse((rearX + frontX) / 2 + 1, by + ry * 0.55, rx * 0.65, ry * 0.32, BELLY);

  c.autoShade(new Map<number, readonly [number, number]>([[FUR, [FUR_HI, FUR_LO]]]));

  // 디테일
  if (S.mark) c.ellipse((rearX + frontX) / 2 - 2, by - ry * 0.55, rx * 0.55, ry * 0.4, MARK);
  if (S.ear === 'round') c.ellipse(hx - S.head.r * 0.3, hy - S.head.r * 0.9, S.earR * 0.55, S.earR * 0.55, PINK);
  else c.capsule(hx - S.head.r * 0.2, hy - S.head.r * 0.75, hx - S.head.r * 0.75, hy + S.head.r * 0.35, S.earR, MARK);
  if (p.mouth > 0) {
    // 입 안 + 이빨
    const my = sy + S.snout.ry * 0.25;
    c.capsule(sx - S.snout.rx * 0.6, my, sx + S.snout.rx * 0.8, my + p.mouth * 1.2, 0.6 + p.mouth * 0.5, DARK);
    c.set(Math.round(sx + S.snout.rx * 0.5), Math.round(my - 0.5), WHITE);
    c.set(Math.round(sx - S.snout.rx * 0.1), Math.round(my - 0.5), WHITE);
  }
  c.set(Math.round(sx + S.snout.rx - 0.5), Math.round(sy - p.mouth * 0.8 - 0.5), S.tail.pink ? PINK : DARK);
  const ex = Math.round(hx + S.head.r * 0.25);
  const ey = Math.round(hy - S.head.r * 0.2);
  if (p.eye === 'closed') {
    c.set(ex - 1, ey, DARK);
    c.set(ex, ey, DARK);
  } else {
    c.set(ex, ey, EYE);
    c.set(ex + 1, ey, EYE);
    c.set(ex - 1, ey - 1, DARK);
    c.set(ex, ey - 1, DARK);
  }
  if (S.collar) {
    c.capsule(frontX + 1.5, frontY - ry * 0.95, frontX + 3, frontY + ry * 0.15, 1.3, ACC);
    c.set(Math.round(frontX + 3.5), Math.round(frontY + ry * 0.35), WHITE);
  }
  c.outline(() => OUT);
  return c;
}

// --- 시궁쥐 (32x24) ---
const RAT_SPEC: QuadSpec = {
  w: 32, h: 24, foot: 22,
  body: { x: 14, y: 16, rx: 7.5, ry: 4.3 },
  head: { dx: 4, dy: -2.5, r: 3.6 },
  snout: { dx: 3.5, dy: 1, rx: 3, ry: 1.8 },
  ear: 'round', earR: 2.3, legR: 1.1,
  tail: { n: 7, seg: 1.9, r0: 1.0, r1: 0.5, pink: true },
  collar: false, mark: false,
};
const RAT_PAL: Palette = ['#000000', '#1e1418', '#a89a96', '#7e7072', '#564a50', '#4a3e44', '#b8aaa6', '#f0a0a8', '#ff3a3a', '#1e1418', '#ffffff', '#c8383a', '#5e5054'];

const gallop = (t: number, amp: number, lift: number): QuadPose['legs'] => {
  const g = (ph: number): Leg => ({ dx: amp * Math.cos(ph), lift: lift * Math.max(0, -Math.sin(ph)) });
  return [g(t + 0.5), g(t + Math.PI + 0.5), g(t), g(t + Math.PI)];
};

const RAT_ANIMS: Record<string, { fps: number; loop: boolean; poses: QuadPose[] }> = {
  idle: { fps: 6, loop: true, poses: [0, 1, 2, 3].map((i) => ({ ...QBASE, headDY: [0, -0.5, 0, 0.5][i], tailSway: 0.3 * Math.sin((i / 4) * TAU) })) },
  run: { fps: 14, loop: true, poses: [0, 1, 2, 3].map((i) => {
    const t = (i / 4) * TAU;
    return { ...QBASE, bob: -0.8 * Math.max(0, Math.cos(t)), stretch: 1 - 0.08 * Math.cos(t), legs: gallop(t, 2.5, 2), tailA: Math.PI + 0.1, tailCurl: 0.05, tailSway: 0.2 * Math.sin(t) };
  }) },
  tele: { fps: 12, loop: true, poses: [0, 1].map((i) => ({ ...QBASE, crouch: 1.2, tilt: -1, headDY: 1, mouth: 0.4, tailA: Math.PI - 0.9, tailSway: i ? 0.4 : -0.4 })) },
  bite: { fps: 12, loop: false, poses: [0, 1, 2].map((i) => ({ ...QBASE, stretch: 1.2, tilt: 0.5, mouth: [0.6, 1, 0.3][i], legs: [{ dx: -3, lift: 1 }, { dx: 3, lift: 1.5 }, { dx: -2.5, lift: 1 }, { dx: 3.5, lift: 1.5 }] as QuadPose['legs'], tailA: Math.PI })) },
  hurt: { fps: 1, loop: false, poses: [{ ...QBASE, tilt: 1.5, mouth: 0.6, eye: 'closed', tailA: Math.PI - 0.6 }] },
};

// --- 떠돌이 들개 (64x48) ---
const HOUND_SPEC: QuadSpec = {
  w: 64, h: 48, foot: 45,
  body: { x: 28, y: 30, rx: 13, ry: 6.5 },
  head: { dx: 7, dy: -7, r: 6.2 },
  snout: { dx: 6, dy: 2, rx: 5, ry: 3.2 },
  ear: 'floppy', earR: 2, legR: 2.3,
  tail: { n: 6, seg: 2.5, r0: 2, r1: 1.2, pink: false },
  collar: true, mark: true,
};
const HOUND_PAL: Palette = ['#000000', '#1e120c', '#c8985e', '#a8784a', '#7a5232', '#6a4428', '#e8d0a8', '#d87a7a', '#ff4a2a', '#2a160e', '#ffffff', '#c8383a', '#5a3820'];

const HOUND_ANIMS: Record<string, { fps: number; loop: boolean; poses: QuadPose[] }> = {
  idle: { fps: 6, loop: true, poses: [0, 1, 2, 3].map((i) => ({ ...QBASE, bob: [0, 0.4, 0.6, 0.4][i], mouth: 0.25, tailA: Math.PI - 0.8, tailCurl: 0.15, tailSway: 0.3 * Math.sin((i / 4) * TAU) })) },
  run: { fps: 14, loop: true, poses: [0, 1, 2, 3, 4, 5].map((i) => {
    const t = (i / 6) * TAU;
    return { ...QBASE, bob: -1.5 * Math.max(0, Math.cos(t)), stretch: 1 - 0.08 * Math.cos(t), tilt: 0.8 * Math.sin(t), legs: gallop(t, 5, 3.5), mouth: 0.3, tailA: Math.PI - 0.3, tailCurl: 0.05, tailSway: 0.2 * Math.sin(t) };
  }) },
  growl: { fps: 12, loop: true, poses: [0, 1].map((i) => ({ ...QBASE, crouch: 2, headDY: 2 + i * 0.5, mouth: 0.6, tilt: -1.2, tailA: Math.PI + 0.4, tailSway: 0 })) },
  bite: { fps: 14, loop: false, poses: [0, 1, 2].map((i) => ({ ...QBASE, stretch: 1.15, tilt: 1, mouth: [0.7, 1, 0.4][i], legs: [{ dx: -6, lift: 1 }, { dx: 6, lift: 3 }, { dx: -5, lift: 1 }, { dx: 6.5, lift: 3 }] as QuadPose['legs'], tailA: Math.PI - 0.2 })) },
  bark: { fps: 10, loop: true, poses: [0, 1].map((i) => ({ ...QBASE, headDY: -2.5, tilt: 1.2, mouth: i ? 1 : 0.6, tailA: Math.PI - 0.9 })) },
  hurt: { fps: 1, loop: false, poses: [{ ...QBASE, tilt: 2, mouth: 0.5, eye: 'closed', tailA: Math.PI + 0.6 }] },
};

// --- 비둘기 폭격기 (32x24) ---
const PIG_PAL: Palette = ['#000000', '#1a1420', '#c8cede', '#9aa2b8', '#6a7290', '#4a5068', '#3aa88a', '#8a5aa8', '#ff8a3a', '#e8a07a', '#2a2030'];
function drawPigeon(wing: number, bob: number, hurt: boolean): PixelCanvas {
  const OUTL = 1, HI = 2, BASE = 3, LO = 4, DK = 5, GREEN = 6, PURP = 7, EYEC = 8, FEET = 9, BEAK = 10;
  const c = new PixelCanvas(32, 24);
  const y = 13 + bob;
  // 먼 날개 (위로 들렸을 때 몸 위로 보임)
  c.poly([[16, y - 2], [12, y - 2], [7, y - 6 + wing * 9], [11, y + 1 + wing * 3]], DK);
  c.poly([[9, y - 1], [3, y - 3], [3, y + 2], [9, y + 2]], DK); // 꼬리
  c.ellipse(15, y, 7, 4.5, BASE);
  c.ellipse(19.5, y - 1, 4.2, 4, BASE);
  c.ellipse(21, y - 2.5, 2.6, 2.2, GREEN);
  c.ellipse(23, y - 5, 3.2, 3.2, LO);
  c.poly([[25.5, y - 5.5], [29, y - 4.3], [25.5, y - 3.6]], BEAK);
  c.autoShade(new Map<number, readonly [number, number]>([[BASE, [HI, LO]]]));
  c.set(20, y - 1, PURP);
  c.set(21, y - 1, PURP);
  // 가까운 날개 (회색 + 검은 띠 두 줄)
  const wy = y - 1;
  c.poly([[18, wy - 1], [12, wy - 1], [4, wy - 2 + wing * 9], [9, wy + 3 + wing * 4], [17, wy + 2]], HI);
  c.capsule(9, wy + 0.5 + wing * 3, 14, wy + wing * 1.2, 0.5, DK);
  c.capsule(7, wy + 2 + wing * 5, 11, wy + 1.5 + wing * 3, 0.5, DK);
  if (hurt) {
    c.set(23, y - 6, DK);
    c.set(24, y - 6, DK);
  } else {
    c.set(24, y - 6, EYEC);
    c.set(23, y - 7, DK);
  }
  c.set(15, y + 5, FEET);
  c.set(17, y + 5, FEET);
  c.outline(() => OUTL);
  return c;
}
const PIG_ANIMS: Record<string, { fps: number; loop: boolean; frames: PixelCanvas[] }> = {
  idle: { fps: 12, loop: true, frames: [-1, -0.3, 0.7, 0.2].map((w, i) => drawPigeon(w, [0, -0.5, 0.5, 0][i], false)) },
  fly: { fps: 12, loop: true, frames: [-1, -0.3, 0.7, 0.2].map((w, i) => drawPigeon(w, [0, -0.5, 0.5, 0][i], false)) },
  tele: { fps: 20, loop: true, frames: [-0.6, 0.5].map((w) => drawPigeon(w, 0, false)) },
  hurt: { fps: 1, loop: false, frames: [drawPigeon(-0.8, 0, true)] },
};

function registerFrames(scene: Phaser.Scene, key: string, anims: Record<string, { fps: number; loop: boolean; frames: PixelCanvas[] }>, palette: Palette): void {
  const all: { name: string; c: PixelCanvas }[] = [];
  for (const [anim, a] of Object.entries(anims)) a.frames.forEach((c, i) => all.push({ name: `${anim}_${i}`, c }));
  const w = all[0].c.w;
  const h = all[0].c.h;
  const tex = scene.textures.addCanvas(key, makeSheet(all.map((f) => f.c), palette));
  if (!tex) throw new Error(`texture ${key} failed`);
  all.forEach((f, i) => tex.add(f.name, 0, ...framePos(i, w, h, all.length), w, h));
  for (const [anim, a] of Object.entries(anims)) {
    scene.anims.create({
      key: `${key}_${anim}`,
      frames: a.frames.map((_, i) => ({ key, frame: `${anim}_${i}` })),
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    });
  }
}

const quadFrames = (S: QuadSpec, anims: Record<string, { fps: number; loop: boolean; poses: QuadPose[] }>) =>
  Object.fromEntries(Object.entries(anims).map(([k, a]) => [k, { fps: a.fps, loop: a.loop, frames: a.poses.map((p) => drawQuad(S, p)) }]));

export const ENEMY_SIZES = {
  rat: { w: RAT_SPEC.w, h: RAT_SPEC.h, foot: RAT_SPEC.foot },
  hound: { w: HOUND_SPEC.w, h: HOUND_SPEC.h, foot: HOUND_SPEC.foot },
  pigeon: { w: 32, h: 24, foot: 19 },
  thug: { w: HERO_FRAME_W, h: HERO_FRAME_H, foot: 60 },
} as const;

export function registerEnemies(scene: Phaser.Scene): void {
  registerFrames(scene, 'enemy_rat', quadFrames(RAT_SPEC, RAT_ANIMS), RAT_PAL);
  registerFrames(scene, 'enemy_hound', quadFrames(HOUND_SPEC, HOUND_ANIMS), HOUND_PAL);
  registerFrames(scene, 'enemy_pigeon', PIG_ANIMS, PIG_PAL);

  // 칼잡이 쥐: 직립 리그
  const frames = buildHeroFrames(LOADOUT_THUG);
  const tex = scene.textures.addCanvas('enemy_thug', makeSheet(frames.map((f) => f.canvas), LOADOUT_THUG.palette));
  if (!tex) throw new Error('enemy_thug failed');
  frames.forEach((f, i) => tex.add(f.name, 0, ...framePos(i, HERO_FRAME_W, HERO_FRAME_H, frames.length), HERO_FRAME_W, HERO_FRAME_H));
  for (const a of HERO_ANIMS) {
    scene.anims.create({
      key: `enemy_thug_${a.key}`,
      frames: Array.from({ length: a.frames }, (_, i) => ({ key: 'enemy_thug', frame: `${a.key}_${i}` })),
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    });
  }
}
