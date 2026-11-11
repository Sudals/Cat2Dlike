/**
 * 1장 보스 — 쥐왕 '찍찍대제' (128x112, 정면)
 * 꼬리가 엉킨 쥐 무리가 한 덩어리가 되고, 그 한가운데 왕관을 쓴 거대한 쥐 얼굴.
 * 애니: idle(꿈틀) · tele(입 벌림·웅크림) · roar(포효) · hurt
 */
import type Phaser from 'phaser';
import { PixelCanvas, makeSheet, framePos, type Palette } from '../PixelCanvas';
import { mulberry32, TAU } from '../rng';

const OUT = 1, FUR_HI = 2, FUR = 3, FUR_LO = 4, PINK = 5, EYE = 6, DARK = 7, WHITE = 8;
const GOLD_HI = 9, GOLD = 10, GOLD_LO = 11, RUBY = 12, GEM = 13, FAR = 14, BELLY = 15;

const PAL: Palette = [
  '#000000', '#140c14', '#a89aa0', '#7e7076', '#564a52', '#f0a0a8', '#ff2a2a', '#1e1218', '#ffffff',
  '#fff0a0', '#ffc94a', '#c8882a', '#e8384a', '#7ff0ff', '#4a3e46', '#c8b8b4',
];

export const RATKING_FRAME = { w: 128, h: 112, foot: 108 } as const;

interface KingPose {
  t: number; // 꿈틀거림 위상
  squash: number; // + 납작
  mouth: number; // 0~1
  eyesClosed: boolean;
  crownTilt: number;
}

function drawKing(p: KingPose): PixelCanvas {
  const c = new PixelCanvas(RATKING_FRAME.w, RATKING_FRAME.h);
  const rnd = mulberry32(77);
  const cx = 64;
  const by = 74 + p.squash * 3;
  const rx = 50 + p.squash * 4;
  const ry = 32 - p.squash * 3;

  // 엉킨 분홍 꼬리 (바닥)
  for (let k = 0; k < 9; k++) {
    let x = 20 + rnd() * 88;
    let y = 100 + rnd() * 6;
    let a = rnd() * TAU;
    for (let s = 0; s < 8; s++) {
      a += (rnd() - 0.5) * 1.4 + Math.sin(p.t + k) * 0.1;
      const nx = x + Math.cos(a) * 4;
      const ny = Math.min(107, Math.max(92, y + Math.sin(a) * 3));
      c.capsule(x, y, nx, ny, 1.1, PINK);
      x = nx;
      y = ny;
    }
  }

  // 몸통 덩어리 + 둘레의 작은 쥐들
  c.ellipse(cx, by, rx, ry, FUR);
  const small: [number, number, number][] = [];
  for (let k = 0; k < 11; k++) {
    const a = Math.PI * 1.02 + (k / 10) * Math.PI * 0.96 + Math.sin(p.t * 2 + k * 1.7) * 0.05;
    const r = 1 + Math.sin(p.t * 3 + k) * 0.04;
    const x = cx + Math.cos(a) * rx * 0.92 * r;
    const y = by + Math.sin(a) * ry * 0.9 * r;
    small.push([x, y, a]);
    c.ellipse(x, y, 7, 5.5, k % 2 ? FAR : FUR);
  }
  // 아래쪽 양옆으로 비어져 나온 쥐
  for (const side of [-1, 1]) {
    const x = cx + side * (rx - 4);
    c.ellipse(x, by + 14, 8, 6, FUR);
    small.push([x + side * 5, by + 12, side > 0 ? 0 : Math.PI]);
  }
  c.ellipse(cx, by + 16, rx * 0.55, ry * 0.32, BELLY);

  // 왕 얼굴: 귀 → 머리 → 주둥이
  const hy = 52 + p.squash * 3;
  for (const side of [-1, 1]) c.ellipse(cx + side * 19, hy - 13, 10, 10, FUR);
  c.ellipse(cx, hy, 23, 19, FUR);
  c.ellipse(cx, hy + 11, 12, 8, FUR);

  c.autoShade(new Map<number, readonly [number, number]>([[FUR, [FUR_HI, FUR_LO]]]));

  // 작은 쥐들 얼굴 (빨간 눈 + 분홍 코)
  for (const [x, y, a] of small) {
    const fx = x + Math.cos(a) * 5;
    const fy = y + Math.sin(a) * 4;
    c.ellipse(fx, fy, 3, 2.4, FUR_LO);
    c.set(Math.round(fx + Math.cos(a) * 2.5), Math.round(fy + Math.sin(a) * 2), PINK);
    c.set(Math.round(fx - Math.sin(a) * 1.5), Math.round(fy + Math.cos(a) * 1.2 - 1), EYE);
  }

  // 왕 얼굴 디테일
  for (const side of [-1, 1]) c.ellipse(cx + side * 19, hy - 13, 6, 6, PINK);
  if (p.eyesClosed) {
    for (const side of [-1, 1]) c.capsule(cx + side * 6, hy - 2, cx + side * 11, hy - 2, 0.7, DARK);
  } else {
    for (const side of [-1, 1]) {
      c.ellipse(cx + side * 8.5, hy - 2, 3.2, 3.6, EYE);
      c.set(cx + side * 8 - (side > 0 ? 1 : 0), hy - 4, WHITE);
      c.capsule(cx + side * 4, hy - 6, cx + side * 13, hy - 9, 0.9, DARK); // 찌푸린 눈썹
    }
  }
  c.ellipse(cx, hy + 6, 3, 2.2, PINK); // 코
  if (p.mouth > 0) {
    c.ellipse(cx, hy + 13, 7 + p.mouth * 2, 2 + p.mouth * 4, DARK);
    c.rect(cx - 3, hy + 9, 2, 3 + p.mouth, WHITE);
    c.rect(cx + 1, hy + 9, 2, 3 + p.mouth, WHITE);
  } else {
    c.rect(cx - 3, hy + 10, 2, 4, WHITE);
    c.rect(cx + 1, hy + 10, 2, 4, WHITE);
  }
  for (const side of [-1, 1]) {
    for (const dy of [-1, 2]) c.capsule(cx + side * 9, hy + 8 + dy, cx + side * 22, hy + 6 + dy * 2, 0.4, DARK); // 수염
  }

  // 왕관
  const tilt = p.crownTilt;
  const cy = hy - 20;
  const pts: [number, number][] = [[cx - 15, cy + 8], [cx - 15, cy - 3], [cx - 9, cy + 2], [cx - 5, cy - 8], [cx, cy], [cx + 5, cy - 8], [cx + 9, cy + 2], [cx + 15, cy - 3], [cx + 15, cy + 8]];
  c.poly(pts.map(([x, y]) => [x, y + (x - cx) * tilt] as [number, number]), GOLD);
  c.autoShade(new Map<number, readonly [number, number]>([[GOLD, [GOLD_HI, GOLD_LO]]]));
  c.ellipse(cx, cy + 5, 2.2, 2.2, RUBY);
  for (const side of [-1, 1]) c.ellipse(cx + side * 9, cy + 5 + side * 9 * tilt, 1.5, 1.5, GEM);

  c.outline(() => OUT);
  return c;
}

const ANIMS: Record<string, { fps: number; loop: boolean; poses: KingPose[] }> = {
  idle: { fps: 8, loop: true, poses: [0, 1, 2, 3].map((i) => ({ t: (i / 4) * TAU, squash: [0, 0.3, 0.5, 0.3][i], mouth: 0, eyesClosed: false, crownTilt: [0, 0.03, 0, -0.03][i] })) },
  tele: { fps: 12, loop: true, poses: [0, 1].map((i) => ({ t: i * 1.5, squash: 1 + i * 0.3, mouth: 0.6, eyesClosed: false, crownTilt: 0.05 })) },
  roar: { fps: 12, loop: true, poses: [0, 1].map((i) => ({ t: i * 2, squash: -0.6, mouth: 1, eyesClosed: false, crownTilt: i ? 0.08 : -0.08 })) },
  hurt: { fps: 1, loop: false, poses: [{ t: 0, squash: 0.6, mouth: 0.4, eyesClosed: true, crownTilt: 0.12 }] },
};

export function registerBoss(scene: Phaser.Scene): void {
  const key = 'enemy_ratking';
  const all: { name: string; c: PixelCanvas }[] = [];
  for (const [anim, a] of Object.entries(ANIMS)) a.poses.forEach((p, i) => all.push({ name: `${anim}_${i}`, c: drawKing(p) }));
  const { w, h } = RATKING_FRAME;
  const tex = scene.textures.addCanvas(key, makeSheet(all.map((f) => f.c), PAL));
  if (!tex) throw new Error('ratking texture failed');
  all.forEach((f, i) => tex.add(f.name, 0, ...framePos(i, w, h, all.length), w, h));
  for (const [anim, a] of Object.entries(ANIMS)) {
    scene.anims.create({ key: `${key}_${anim}`, frames: a.poses.map((_, i) => ({ key, frame: `${anim}_${i}` })), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
  }
}
