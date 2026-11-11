/**
 * 스킬·타격 이펙트 도트 생성 (docs/GAME_PLAN.md §9)
 * 대부분 ADD(가산) 블렌드로 써서 밤 배경 위에서 빛나도록 밝은 색 위주로 만든다.
 */
import Phaser from 'phaser';
import { PixelCanvas, framePos, makeSheet, type Palette } from './PixelCanvas';
import { BAYER4, mulberry32, TAU } from './rng';
import { VIEW_H, VIEW_W } from '../config/game';

export function addAnimSheet(scene: Phaser.Scene, key: string, frames: PixelCanvas[], palette: Palette, fps: number, repeat = 0): void {
  const w = frames[0].w;
  const h = frames[0].h;
  const tex = scene.textures.addCanvas(key, makeSheet(frames, palette));
  if (!tex) throw new Error(`texture ${key} failed`);
  frames.forEach((_, i) => tex.add(String(i), 0, ...framePos(i, w, h, frames.length), w, h));
  scene.anims.create({ key, frames: frames.map((_, i) => ({ key, frame: String(i) })), frameRate: fps, repeat });
}

function addStatic(scene: Phaser.Scene, key: string, c: PixelCanvas, palette: Palette): void {
  scene.textures.addCanvas(key, makeSheet([c], palette));
}

const SLASH_PAL: Palette = ['#000000', '#ffffff', '#fff1c8', '#ff9a4a'];
const CUT: readonly [number, number, number] = [1, 2, 3];

/** fx_iai_line: 발도 일섬 수평 섬광선 (160x12, 늘려서 사용) */
function iaiLine(): PixelCanvas[] {
  return [0.9, 3.4, 2.4, 1.4].map((T, k) => {
    const c = new PixelCanvas(160, 12);
    for (let x = 0; x < 160; x++) {
      const t = T * Math.pow(Math.sin((Math.PI * (x + 0.5)) / 160), 0.5);
      for (let y = 0; y < 12; y++) {
        const d = Math.abs(y + 0.5 - 6);
        if (d > t || (k === 3 && (x + y) % 2)) continue;
        const r = d / Math.max(t, 0.01);
        c.set(x, y, r < 0.45 ? 1 : r < 0.8 ? 2 : 3);
      }
    }
    return c;
  });
}

/** fx_cross: X자 베기 (48x48) — 첫 획 → 둘째 획 → 사라짐 */
function crossSlash(): PixelCanvas[] {
  const steps: [number, number, number, number][] = [
    [1.6, 0.6, 0, 0], [3.2, 1, 1.6, 0.6], [3.4, 1, 3.4, 1], [2, 1, 2, 1], [1.3, 1, 1.3, 1],
  ];
  return steps.map(([ta, ra, tb, rb], k) => {
    const c = new PixelCanvas(48, 48);
    if (ta) c.lens(5, 5, 43, 43, ta, CUT, ra);
    if (tb) c.lens(43, 5, 5, 43, tb, CUT, rb);
    if (k === 4) c.ditherOut();
    return c;
  });
}

/** fx_whirl: 회오리 할퀴기 회전 고리 (96x56, 루프) */
function whirl(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  const cx = 48, cy = 28, rx = 42, ry = 20;
  for (let k = 0; k < 6; k++) {
    const c = new PixelCanvas(96, 56);
    const a0 = (k * Math.PI) / 3;
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const r = Math.hypot(nx, ny);
        const th = Math.atan2(ny, nx);
        const dd = Math.abs(r - 1);
        if (dd < 0.035 && (x + y + k) % 3 === 0) c.set(x, y, 3);
        for (const base of [a0, a0 + Math.PI]) {
          const phi = (((th - base) % TAU) + TAU) % TAU;
          if (phi > 1.7) continue;
          const s = phi / 1.7; // 0 꼬리 → 1 머리
          const w = 0.025 + 0.12 * s;
          if (dd > w) continue;
          c.set(x, y, dd < w * 0.45 ? 1 : s > 0.5 ? 2 : 3);
        }
      }
    }
    frames.push(c);
  }
  return frames;
}

/** fx_glint: 칼날 반짝임 (24x24) */
function glint(): PixelCanvas[] {
  return [3, 10, 7, 3].map((L, k) => {
    const c = new PixelCanvas(24, 24);
    c.capsule(12 - L, 12, 12 + L, 12, 0.6, k < 2 ? 1 : 2);
    c.capsule(12, 12 - L * 0.6, 12, 12 + L * 0.6, 0.6, 2);
    if (k === 1) for (const [x, y] of [[10, 10], [14, 10], [10, 14], [14, 14]]) c.set(x, y, 3);
    c.ellipse(12, 12, 1.3, 1.3, 1);
    return c;
  });
}

/** fx_impact: 타격 순간 방사형 충격선 (32x32) — 모든 강타에 공통으로 얹는 '손맛' 이펙트 */
function impactLines(): PixelCanvas[] {
  const spans: [number, number, number][] = [[3, 9, 0.9], [6, 14, 0.8], [10, 16, 0.6], [13, 16, 0.5]];
  return spans.map(([r0, r1, w], k) => {
    const c = new PixelCanvas(32, 32);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (i % 2 ? 0.2 : 0);
      const len = i % 2 ? 0.75 : 1;
      c.capsule(16 + Math.cos(a) * r0, 16 + Math.sin(a) * r0, 16 + Math.cos(a) * r1 * len, 16 + Math.sin(a) * r1 * len, w, k < 2 ? 1 : 2);
    }
    if (k === 3) c.ditherOut();
    return c;
  });
}

/** fx_fireball: 불꽃 털뭉치 (16x16, 루프). 꼬리 불꽃은 왼쪽 → 진행 방향으로 뒤집어 사용 */
function fireball(): PixelCanvas[] {
  return [0, 1, 2, 3].map((k) => {
    const rnd = mulberry32(300 + k);
    const c = new PixelCanvas(16, 16);
    for (let i = 0; i < 5; i++) c.ellipse(4 - rnd() * 3, 8 + (rnd() - 0.5) * 6, 1.5 + rnd() * 1.5, 1 + rnd(), rnd() < 0.5 ? 3 : 4);
    c.ellipse(9, 8, 5, 5, 3);
    c.ellipse(9, 8, 3.8, 3.8, 2);
    c.ellipse(8.5, 7.5, 2, 2, 1);
    c.capsule(6.5, 5.5 + k * 0.5, 12, 9 + k * 0.3, 0.5, 5); // 털실 줄
    c.capsule(7, 10.5 - k * 0.3, 11, 4.5 + k * 0.4, 0.5, 5);
    return c;
  });
}

/** fx_explosion: 화염 폭발 (64x64) — 섬광 → 불덩이 → 연기 고리 → 흩어짐 */
function explosion(): PixelCanvas[] {
  const R = [7, 13, 19, 24, 25, 26, 27, 27];
  return R.map((radius, k) => {
    const rnd = mulberry32(400 + k);
    const n = Array.from({ length: 12 }, () => rnd() * 2 - 1);
    const cx = 32;
    const cy = 34 - k * 1.2;
    const rAt = (th: number) => {
      const f = ((th + Math.PI) / TAU) * 12;
      const i = Math.floor(f) % 12;
      const t = f - Math.floor(f);
      return radius * (1 + 0.16 * (n[i] * (1 - t) + n[(i + 1) % 12] * t));
    };
    const c = new PixelCanvas(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const rr = rAt(Math.atan2(dy, dx));
        const q = Math.hypot(dx, dy) / rr;
        if (q > 1) continue;
        let col: number;
        if (k <= 1) col = q < 0.55 ? 1 : 2;
        else if (k <= 3) col = k === 2 && q < 0.3 ? 1 : q < 0.55 ? 2 : q < 0.8 ? 3 : 4;
        else if (k <= 5) {
          if (q < 0.45) {
            if (k === 5) continue;
            col = 4;
          } else col = q < 0.75 ? 5 : 6;
        } else {
          if (q < 0.55) continue;
          if (k === 6 && BAYER4[(y % 4) * 4 + (x % 4)] < 5) continue;
          if (k === 7 && (x + y) % 2) continue;
          col = q < 0.8 ? 5 : 6;
        }
        c.set(x, y, col);
      }
    }
    if (k >= 3) for (let i = 0; i < 8; i++) c.set(Math.floor(8 + rnd() * 48), Math.floor(6 + rnd() * 40), 2);
    return c;
  });
}

/** fx_lightning: 낙뢰 (48x240, 바닥 기준) */
function lightning(): PixelCanvas[] {
  return [0, 1, 2, 3].map((k) => {
    const rnd = mulberry32(500 + k);
    const c = new PixelCanvas(48, 240);
    const pts: [number, number][] = [[24, 0]];
    let x = 24;
    for (let y = 14; y < 236; y += 14) {
      x = Math.max(8, Math.min(40, x + (rnd() - 0.5) * 16));
      pts.push([x, y]);
    }
    pts.push([24, 239]);
    const seg = (r: number, col: number) => {
      for (let i = 0; i < pts.length - 1; i++) c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, col);
    };
    if (k < 3) {
      seg(3, 3);
      seg(2, 2);
      for (let b = 0; b < 3; b++) {
        let [bx, by] = pts[2 + Math.floor(rnd() * (pts.length - 5))];
        const dir = rnd() < 0.5 ? -1 : 1;
        for (let s = 0; s < 3; s++) {
          const nx = bx + dir * (4 + rnd() * 6);
          const ny = by + 6 + rnd() * 6;
          c.capsule(bx, by, nx, ny, 0.7, 2);
          bx = nx;
          by = ny;
        }
      }
    }
    seg(k === 3 ? 0.6 : 1.3, 1);
    if (k === 3) c.ditherOut();
    return c;
  });
}

/** fx_glow: 디더 원형 광원 (64x64, ADD + 틴트로 색 입혀 사용) */
function glow(): PixelCanvas {
  const c = new PixelCanvas(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = 1 - Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
      if (i <= 0) continue;
      const lv = i * 3;
      const base = Math.floor(lv);
      const level = (lv - base) * 16 > BAYER4[(y % 4) * 4 + (x % 4)] ? base + 1 : base;
      if (level > 0) c.set(x, y, 4 - Math.min(level, 3)); // 3단계: 1 가장 밝음
    }
  }
  return c;
}

/** fx_moon: 달빛 낙하용 거대 달 (112x112) */
function bigMoon(): PixelCanvas {
  const c = new PixelCanvas(112, 112);
  c.ellipse(56, 56, 46, 46, 3);
  c.ellipse(53, 53, 43, 43, 2);
  c.ellipse(45, 43, 24, 21, 1);
  for (const [x, y, rx, ry] of [[40, 38, 7, 6], [66, 60, 9, 8], [50, 74, 6, 5], [73, 36, 5, 4], [33, 62, 4, 4], [60, 45, 3, 3], [78, 76, 5, 4]]) {
    c.ellipse(x, y, rx, ry, 4);
    c.ellipse(x - 1, y - 1, rx - 1.2, ry - 1.2, 3);
  }
  c.outline(() => 5);
  return c;
}

/** fx_shockwave: 바닥 충격파 고리 (160x48) */
function shockwave(): PixelCanvas[] {
  return [0, 1, 2, 3, 4, 5].map((k) => {
    const c = new PixelCanvas(160, 48);
    const rx = 18 + k * 12.5;
    const w = Math.max(1.2, 5 - k * 0.7);
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 160; x++) {
        const dist = Math.hypot(x + 0.5 - 80, (y + 0.5 - 24) / 0.3);
        const q = Math.abs(dist - rx) / w;
        if (q > 1 || (k >= 4 && (x + y) % 2)) continue;
        c.set(x, y, q < 0.4 ? 1 : q < 0.75 ? 2 : 3);
      }
    }
    return c;
  });
}

/** 훈련용 허수아비 (쥐 모양 자루 머리, 32x48, 발 기준 하단 중앙) */
function dummy(): PixelCanvas {
  const OUT = 1, WOOD = 3, BUR = 6, ROPE = 8, RED = 9, WHITE = 10, PINK = 11, DARK = 12;
  const c = new PixelCanvas(32, 48);
  c.rect(14, 26, 4, 22, WOOD);
  c.rect(5, 22, 22, 3, WOOD);
  c.ellipse(16, 30, 8.5, 9, BUR);
  c.ellipse(9, 7.5, 3.2, 3.2, BUR);
  c.ellipse(23, 7.5, 3.2, 3.2, BUR);
  c.ellipse(16, 13, 7.5, 6.5, BUR);
  c.autoShade(new Map([[WOOD, [2, 4]], [BUR, [5, 7]]]));
  c.ellipse(9, 7.5, 1.5, 1.5, PINK);
  c.ellipse(23, 7.5, 1.5, 1.5, PINK);
  for (const ex of [12, 20]) for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1], [0, 0]]) c.set(ex + dx, 12 + dy, DARK);
  c.set(16, 15, PINK);
  c.rect(14, 17, 5, 1, DARK);
  c.capsule(9.5, 20.5, 22.5, 20.5, 0.7, ROPE);
  c.ellipse(16, 30, 4.5, 4.5, RED);
  c.ellipse(16, 30, 3, 3, WHITE);
  c.ellipse(16, 30, 1.5, 1.5, RED);
  for (let y = 24; y <= 36; y += 3) c.set(22, y, DARK);
  c.outline(() => OUT);
  return c;
}
const DUMMY_PAL: Palette = [
  '#000000', '#2a1a14', '#b07a4a', '#8a5a34', '#5e3a22', '#ead09a', '#c9a46a', '#9a7646',
  '#6b4a2a', '#d8383a', '#f6efe0', '#f58c9b', '#2a1a14',
];

/** 데미지 숫자용 굵은 도트 숫자 (5x7 글리프를 가로로 굵게 → 8x9 셀, 흰 글자 + 어두운 외곽선, 틴트로 색 변경) */
const DIGITS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

function registerDamageFont(scene: Phaser.Scene): void {
  const chars = '0123456789';
  const cw = 8;
  const ch = 9;
  const c = new PixelCanvas(cw * chars.length, ch);
  [...chars].forEach((chr, i) =>
    DIGITS[chr].forEach((row, y) =>
      [...row].forEach((p, x) => {
        if (p !== '#') return;
        c.set(i * cw + 1 + x, 1 + y, 1);
        c.set(i * cw + 2 + x, 1 + y, 1);
      }),
    ),
  );
  c.outline(() => 2);
  scene.textures.addCanvas('dmgfont', makeSheet([c], ['#000000', '#ffffff', '#1a0f1f']));
  const font = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'dmgfont', width: cw, height: ch, chars, charsPerRow: chars.length, lineSpacing: 0,
    'offset.x': 0, 'offset.y': 0, 'spacing.x': 0, 'spacing.y': 0,
  });
  scene.cache.bitmapFont.add('dmg', font);
}

function pixel(scene: Phaser.Scene, key: string, w: number, h: number, colors: string[]): void {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  colors.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i % w, Math.floor(i / w), 1, 1);
  });
  scene.textures.addCanvas(key, cv);
}

/** fx_thrust: 콤보 3타 찌르기 섬광 (96x24) */
function thrust(): PixelCanvas[] {
  const steps: [number, number][] = [[1.4, 0.5], [3, 1], [3.6, 1], [2.2, 1], [1.4, 1]];
  return steps.map(([T, r], k) => {
    const c = new PixelCanvas(96, 24);
    c.lens(2, 12, 94, 12, T, CUT, r);
    if (k >= 1 && k <= 3) for (const dy of [-6, 6]) c.lens(20 + k * 6, 12 + dy, 70 + k * 6, 12 + dy * 0.7, 0.8, CUT);
    if (k === 2) {
      c.capsule(88, 4, 88, 20, 0.6, 1);
      c.capsule(82, 12, 95, 12, 0.8, 1);
    }
    if (k === 4) c.ditherOut();
    return c;
  });
}

/** fx_icespike: 서리 발자국 얼음 가시 (24x40, 바닥 기준) — 솟음 → 유지 → 산산조각 */
function iceSpike(): PixelCanvas[] {
  return [8, 22, 34, 34, 30, 0].map((h, k) => {
    const c = new PixelCanvas(24, 40);
    if (h > 0) {
      c.poly([[5, 40], [12, 40 - h], [19, 40]], 3);
      c.poly([[2, 40], [6, 40 - h * 0.45], [9, 40]], 3);
      c.poly([[15, 40], [19, 40 - h * 0.55], [23, 40]], 3);
      c.autoShade(new Map<number, readonly [number, number]>([[3, [1, 4]]]));
      c.capsule(11, 40 - h * 0.25, 13, 40 - h * 0.7, 0.5, 2);
      c.outline(() => 5);
    } else {
      const rnd = mulberry32(700 + k);
      for (let i = 0; i < 9; i++) {
        const x = 2 + rnd() * 20;
        const y = 8 + rnd() * 28;
        c.poly([[x, y], [x + 2 + rnd() * 2, y + 1], [x + 1, y + 3]], rnd() < 0.5 ? 2 : 3);
      }
    }
    return c;
  });
}

function pawPrint(): PixelCanvas {
  const c = new PixelCanvas(16, 8);
  c.ellipse(8, 5.5, 3.2, 2.1, 2);
  for (const [x, y] of [[3.5, 2.8], [6.3, 1.6], [9.7, 1.6], [12.5, 2.8]]) c.ellipse(x, y, 1.2, 1.2, 1);
  return c;
}

function alertMark(): PixelCanvas {
  const c = new PixelCanvas(9, 16);
  c.rect(3, 2, 3, 8, 1);
  c.rect(3, 12, 3, 2, 1);
  c.outline(() => 2);
  c.outline(() => 3);
  return c;
}

function poop(): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  c.ellipse(3.5, 3.5, 2.6, 2.6, 1);
  c.set(3, 3, 2);
  c.set(4, 2, 2);
  c.outline(() => 3);
  return c;
}

function puddle(): PixelCanvas[] {
  return [0, 1, 2].map((k) => {
    const c = new PixelCanvas(36, 8);
    c.ellipse(18, 5.5, 16, 2.4, 3);
    c.ellipse(17, 5, 12, 1.6, 2);
    for (const [x, y] of [[8 + k * 3, 4], [22 - k * 2, 5], [28 - k, 4]]) c.ellipse(x, y, 1.3, 1.3, 1);
    c.outline(() => 4);
    return c;
  });
}

const GRAY_PAL: Palette = ['#000000', '#ffffff', '#c8c8c8', '#808080']; // 회색조 → ADD + 틴트로 색 입힘
const GRAY: readonly [number, number, number] = [1, 2, 3];

/** fx_flare: 8갈래 빛 폭발 (64x64) */
function flareFrames(): PixelCanvas[] {
  const L = [10, 28, 30, 22, 12];
  const core = [5, 7, 5, 3, 1.5];
  return L.map((len, k) => {
    const c = new PixelCanvas(64, 64);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const l = i % 2 ? len * 0.55 : len;
      c.lens(32, 32, 32 + Math.cos(a) * l, 32 + Math.sin(a) * l, i % 2 ? 1.3 : 2.4, GRAY);
    }
    c.ellipse(32, 32, core[k] + 2, core[k] + 2, 3);
    c.ellipse(32, 32, core[k] + 1, core[k] + 1, 2);
    c.ellipse(32, 32, core[k], core[k], 1);
    if (k === 4) c.ditherOut();
    return c;
  });
}

/** fx_beam: 하늘로 솟는 빛기둥 (32x160, 바닥 기준) — 위로 갈수록 디더로 흐려짐 */
function beamFrames(): PixelCanvas[] {
  return [3, 10, 13, 9, 5].map((w, k) => {
    const c = new PixelCanvas(32, 160);
    for (let y = 0; y < 160; y++) {
      const u = y / 160; // 0 꼭대기 → 1 바닥
      const half = w * (0.55 + 0.45 * u);
      for (let x = 0; x < 32; x++) {
        const d = Math.abs(x + 0.5 - 16);
        if (d > half) continue;
        if (u < 0.3 && BAYER4[(y % 4) * 4 + (x % 4)] > u * 53) continue;
        if (k === 4 && (x + y) % 2) continue;
        const q = d / half;
        c.set(x, y, q < 0.35 ? 1 : q < 0.7 ? 2 : 3);
      }
    }
    return c;
  });
}

/** fx_ring_big: 원형 충격파 고리 (128x128) */
function ringBigFrames(): PixelCanvas[] {
  return [0, 1, 2, 3, 4, 5].map((k) => {
    const c = new PixelCanvas(128, 128);
    const r = 12 + k * 10;
    const w = Math.max(1.2, 7 - k * 1.1);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const d = Math.abs(Math.hypot(x + 0.5 - 64, y + 0.5 - 64) - r);
        if (d > w || (k >= 4 && (x + y) % 2)) continue;
        const q = d / w;
        c.set(x, y, q < 0.4 ? 1 : q < 0.75 ? 2 : 3);
      }
    }
    return c;
  });
}

/** fx_speedlines: 화면 가장자리에서 중앙으로 몰리는 집중선 (화면 크기, 2프레임 교대) */
function speedlineFrames(): PixelCanvas[] {
  return [0, 1].map((k) => {
    const rnd = mulberry32(900 + k);
    const c = new PixelCanvas(VIEW_W, VIEW_H);
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    for (let i = 0; i < 64; i++) {
      const a = rnd() * TAU;
      const rIn = 150 + rnd() * 70;
      c.lens(cx + Math.cos(a) * 420, cy + Math.sin(a) * 420, cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn, 1 + rnd() * 2.2, GRAY);
    }
    return c;
  });
}

/** fx_vortex: 회오리 기둥 (96x96, 루프, 바닥 기준) — 아래는 흰·금빛, 위로 갈수록 주황·진홍 */
function vortexFrames(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  for (let k = 0; k < 6; k++) {
    const c = new PixelCanvas(96, 96);
    for (let j = 0; j < 8; j++) {
      const cy = 90 - j * 11;
      const rx = 12 + j * 4.5;
      const ry = 3 + j * 0.5;
      const phase = (k * Math.PI) / 3 + j * 0.55;
      const col = j < 2 ? 1 : j < 4 ? 2 : j < 6 ? 3 : 4;
      for (let sgm = 0; sgm < 2; sgm++) {
        const a0 = phase + sgm * Math.PI;
        let px = 48 + Math.cos(a0) * rx;
        let py = cy + Math.sin(a0) * ry;
        for (let t = 0.05; t <= 1.001; t += 0.05) {
          const a = a0 + t * 2.0;
          const x = 48 + Math.cos(a) * rx;
          const y = cy + Math.sin(a) * ry;
          c.capsule(px, py, x, y, 0.5 + 1.3 * Math.sin(Math.PI * t), col);
          px = x;
          py = y;
        }
      }
    }
    frames.push(c);
  }
  return frames;
}

/**
 * fx_wave: 초승달 참격 검기 (64x96, 오른쪽으로 볼록 = 진행 방향, 루프).
 * 두 원의 차집합으로 초승달을 만들고, 앞날(볼록면)은 흰색 → 안쪽으로 갈수록 금빛·주황.
 * 뒤쪽엔 디더로 흩어지는 잔광 + 프레임마다 흘러가는 속도선.
 */
function crescentWave(): PixelCanvas[] {
  const R = 42;
  const cy = 48;
  return [0, 1, 2, 3].map((k) => {
    const c = new PixelCanvas(64, 96);
    const ox = 20; // 바깥 원 중심
    const ix = 7 + (k % 2); // 안쪽 원 중심 (두께가 살짝 일렁임)
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 64; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const dOut = R - Math.hypot(px - ox, py - cy);
        const dIn = Math.hypot(px - ix, py - cy) - R;
        if (dOut < 0) continue;
        if (dIn >= 0) {
          const q = dOut / (dOut + dIn); // 0 앞날 → 1 안쪽
          c.set(x, y, q < 0.28 ? 1 : q < 0.55 ? 2 : q < 0.8 ? 3 : 4);
        } else if (dIn > -9) {
          // 뒤로 흩어지는 잔광 (멀수록 성기게)
          const fade = 1 + dIn / 9; // 1 → 0
          if (BAYER4[((y + k) % 4) * 4 + (x % 4)] < fade * 10) c.set(x, y, 4);
        }
      }
    }
    // 속도선: 검기 뒤쪽으로 흘러가는 가는 줄
    for (const [ly, len] of [[22, 12], [36, 18], [48, 22], [60, 18], [74, 12]] as const) {
      const yy = ly + (k % 2 ? 1 : -1);
      const back = ix + Math.sqrt(Math.max(0, R * R - (yy + 0.5 - cy) ** 2)); // 초승달 뒤쪽(안쪽 원) 경계
      const end = Math.floor(back) - 3 - ((k * 3) % 5);
      for (let x = Math.max(0, end - len); x < end; x++) if (!c.get(x, yy)) c.set(x, yy, x > end - len / 2 ? 3 : 4);
    }
    return c;
  });
}

export function registerSkillFx(scene: Phaser.Scene): void {
  addAnimSheet(scene, 'fx_wave', crescentWave(), ['#000000', '#ffffff', '#fff1c8', '#ffd08a', '#ff9a4a'], 20, -1);
  addAnimSheet(scene, 'fx_vortex', vortexFrames(), ['#000000', '#ffffff', '#ffe08a', '#ff9a3a', '#e8452a'], 20, -1);
  addAnimSheet(scene, 'fx_flare', flareFrames(), GRAY_PAL, 26);
  addAnimSheet(scene, 'fx_beam', beamFrames(), GRAY_PAL, 18);
  addAnimSheet(scene, 'fx_ring_big', ringBigFrames(), GRAY_PAL, 22);
  addAnimSheet(scene, 'fx_speedlines', speedlineFrames(), GRAY_PAL, 14, -1);
  pixel(scene, 'fx_shard', 2, 2, ['#ffffff', '#bfefff', '#7fd4ff', '#ffffff']);
  addAnimSheet(scene, 'fx_thrust', thrust(), SLASH_PAL, 24);
  addAnimSheet(scene, 'fx_icespike', iceSpike(), ['#000000', '#ffffff', '#bfefff', '#7fd4ff', '#3a8ad8', '#1c3a78'], 16);
  addAnimSheet(scene, 'fx_puddle', puddle(), ['#000000', '#d8ff8a', '#8ad84a', '#4a8a2e', '#1e3a18'], 6, -1);
  addStatic(scene, 'fx_pawprint', pawPrint(), ['#000000', '#e8fbff', '#7fd4ff']);
  addStatic(scene, 'fx_alert', alertMark(), ['#000000', '#ff3a3a', '#ffffff', '#1a1018']);
  addStatic(scene, 'fx_poop', poop(), ['#000000', '#f0f0e8', '#9aa2b8', '#2a2030']);
  pixel(scene, 'fx_bubble', 2, 2, ['#d8ff8a', '#8ad84a', '#8ad84a', '#4a8a2e']);
  addAnimSheet(scene, 'fx_iai_line', iaiLine(), SLASH_PAL, 26);
  addAnimSheet(scene, 'fx_cross', crossSlash(), SLASH_PAL, 22);
  addAnimSheet(scene, 'fx_whirl', whirl(), ['#000000', '#ffffff', '#ffe0a0', '#ff9a4a'], 24, -1);
  addAnimSheet(scene, 'fx_glint', glint(), ['#000000', '#ffffff', '#fff27a', '#ffd08a'], 20);
  addAnimSheet(scene, 'fx_impact', impactLines(), ['#000000', '#ffffff', '#fff1c8'], 28);
  addAnimSheet(scene, 'fx_fireball', fireball(), ['#000000', '#fff3b0', '#ffc23a', '#ff6a2a', '#c8321e', '#b8421e'], 16, -1);
  addAnimSheet(scene, 'fx_explosion', explosion(), ['#000000', '#ffffff', '#fff27a', '#ffa23a', '#e8452a', '#6a5a6a', '#3a3040'], 18);
  addAnimSheet(scene, 'fx_lightning', lightning(), ['#000000', '#ffffff', '#fff27a', '#9b6bff'], 22);
  addAnimSheet(scene, 'fx_shockwave', shockwave(), ['#000000', '#ffffff', '#bfe9ff', '#7fd4ff'], 20);
  addStatic(scene, 'fx_glow', glow(), ['#000000', '#ffffff', '#9a9a9a', '#4a4a4a']);
  addStatic(scene, 'fx_moon', bigMoon(), ['#000000', '#fffbe8', '#f6e9c8', '#e2d1a8', '#c9b27a', '#fff8d8']);
  addStatic(scene, 'dummy', dummy(), DUMMY_PAL);
  pixel(scene, 'fx_ember', 2, 2, ['#fff27a', '#ffa23a', '#ff6a2a', '#e8452a']);
  pixel(scene, 'fx_straw', 3, 1, ['#ead09a', '#c9a46a', '#ead09a']);
  pixel(scene, 'fx_chip', 2, 2, ['#c9a46a', '#9a7646', '#9a7646', '#6b4a2a']);
  pixel(scene, 'fx_streak', 4, 1, ['#ffffff', '#ffffff', '#fff1c8', '#ff9a4a']);
  registerDamageFont(scene);
}
