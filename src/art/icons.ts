/**
 * 스킬 아이콘 (20x20 도트). 텍스처 'icons', 프레임 이름 = 아이콘 id
 * 배경(직업/스킬 고유색 그라데이션) + 심볼(셀아웃 외곽선) 2레이어.
 */
import type Phaser from 'phaser';
import { PixelCanvas } from './PixelCanvas';

const S = 20;
// 공용 인덱스 (17~19 = 아이콘별 배경 밝음/기본/어두움)
const OUT = 1, WHITE = 2, PALE = 3, YELLOW = 4, ORANGE = 5, RED = 6, DARKRED = 7, STEEL = 8;
const CYAN = 10, BLUE = 11, BROWN = 14, GOLD = 15, PINK = 16, BG_HI = 17, BG = 18, BG_LO = 19;
const BASE_PAL = [
  '#000000', '#140c1c', '#ffffff', '#fff1c8', '#ffd23a', '#ff8a3a', '#d8383a', '#7a1a2a', '#b8c8e0', '#6a7896',
  '#7ff0ff', '#3a6ad8', '#a77ae0', '#4e2a88', '#7a4a2e', '#ffc94a', '#f58c9b',
];

interface IconDef {
  id: string;
  bg: [hi: string, base: string, lo: string];
  draw(c: PixelCanvas): void;
}

const ICONS: IconDef[] = [
  {
    id: 'blade_attack',
    bg: ['#4a5680', '#2e3858', '#1c2238'],
    draw(c) {
      c.capsule(7, 13, 16.5, 3.5, 0.9, STEEL);
      c.capsule(9, 11, 15.5, 4.5, 0.3, WHITE);
      c.capsule(3.5, 16.5, 6.5, 13.5, 1, BROWN);
      c.ellipse(7, 13, 1.6, 1.6, GOLD);
    },
  },
  {
    id: 'blade_skill1', // 발도 일섬
    bg: ['#3a6ad8', '#24408a', '#142456'],
    draw(c) {
      c.lens(0.5, 8.5, 19.5, 8.5, 2.6, [WHITE, PALE, ORANGE]);
      c.capsule(6, 14.5, 16, 14.5, 0.7, STEEL);
      c.capsule(2.5, 14.5, 5.5, 14.5, 1, BROWN);
      c.rect(5, 13, 1, 3, GOLD);
      c.capsule(16, 5, 16, 12, 0.5, WHITE);
    },
  },
  {
    id: 'blade_skill2', // 회오리 할퀴기
    bg: ['#c8642a', '#8a3a18', '#561e0e'],
    draw(c) {
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - 10;
          const dy = y + 0.5 - 10;
          const r = Math.hypot(dx, dy);
          const th = Math.atan2(dy, dx);
          const phi = ((th % Math.PI) + Math.PI) % Math.PI;
          if (Math.abs(r - 7.5) < 1.3 && phi < 2.3) c.set(x, y, phi > 1.4 ? WHITE : PALE);
        }
      }
      c.lens(6, 6, 9, 14, 1.1, [WHITE, PALE, YELLOW]);
      c.lens(9, 5, 12, 13, 1.1, [WHITE, PALE, YELLOW]);
      c.lens(12, 6, 15, 14, 1.1, [WHITE, PALE, YELLOW]);
    },
  },
  {
    id: 'blade_ult', // 천냥 난무
    bg: ['#c8283a', '#7a1a2a', '#3e0a16'],
    draw(c) {
      const cols = [WHITE, PALE, GOLD] as const;
      c.lens(2, 2, 18, 18, 1.7, cols);
      c.lens(18, 2, 2, 18, 1.7, cols);
      c.lens(10, 0.5, 10, 19.5, 1.4, cols);
      c.lens(0.5, 10, 19.5, 10, 1.4, cols);
      c.ellipse(10, 10, 1.8, 1.8, WHITE);
      for (const [x, y] of [[3, 15], [16, 4], [15, 16]]) c.set(x, y, GOLD);
    },
  },
  {
    id: 'mage_attack', // 별빛 탄
    bg: ['#6a44a8', '#3e2468', '#221040'],
    draw(c) {
      c.lens(10, 1.5, 10, 18.5, 2.3, [WHITE, CYAN, BLUE]);
      c.lens(1.5, 10, 18.5, 10, 2.3, [WHITE, CYAN, BLUE]);
      c.ellipse(10, 10, 2, 2, WHITE);
      for (const [x, y] of [[4, 4], [16, 15], [15, 4]]) c.set(x, y, CYAN);
    },
  },
  {
    id: 'mage_skill1', // 불꽃 털뭉치
    bg: ['#a8321e', '#6a1a10', '#380a06'],
    draw(c) {
      c.poly([[4, 13], [6, 4], [8.5, 8], [10.5, 1.5], [12.5, 7], [14.5, 3.5], [16, 13]], RED);
      c.poly([[6, 13], [7.5, 7], [9.5, 10], [11, 5], [13, 10], [14, 13]], YELLOW);
      c.ellipse(10, 13, 5.2, 5.2, ORANGE);
      c.capsule(6.5, 11, 13, 16, 0.5, DARKRED);
      c.capsule(7, 16, 13.5, 10, 0.5, DARKRED);
      c.set(8, 10, PALE);
    },
  },
  {
    id: 'mage_skill2', // 꼬리 낙뢰
    bg: ['#5a34a8', '#34186a', '#1a0a3a'],
    draw(c) {
      c.poly([[12.5, 0.5], [4.5, 11], [9.5, 11], [6.5, 19.5], [15.5, 8], [10.5, 8], [14.5, 0.5]], YELLOW);
      c.autoShade(new Map([[YELLOW, [WHITE, ORANGE]]]));
    },
  },
  {
    id: 'mage_ult', // 달빛 낙하
    bg: ['#2a3a8a', '#18205a', '#0a0e30'],
    draw(c) {
      c.capsule(13, 1, 18, -1, 0.5, CYAN);
      c.capsule(15, 4, 19, 2, 0.5, CYAN);
      c.ellipse(9.5, 11.5, 7, 7, GOLD);
      c.ellipse(8.5, 10.5, 6, 6, PALE);
      c.ellipse(11, 13, 1.3, 1.3, GOLD);
      c.ellipse(7, 9, 1, 1, GOLD);
      for (const [x, y] of [[3, 3], [17, 9]]) {
        c.set(x, y, WHITE);
        c.set(x - 1, y, CYAN);
        c.set(x + 1, y, CYAN);
        c.set(x, y - 1, CYAN);
        c.set(x, y + 1, CYAN);
      }
    },
  },
  {
    id: 'blade_skill3', // 승천 송곳니
    bg: ['#e0a030', '#9a6018', '#5a3008'],
    draw(c) {
      c.lens(3, 18, 16, 2, 2.4, [WHITE, PALE, YELLOW]);
      c.capsule(12, 7, 15, 3.5, 0.6, WHITE);
      c.capsule(15, 3.5, 18, 7, 0.6, WHITE);
      for (const x of [5, 9]) c.capsule(x, 17, x, 12, 0.4, PALE);
    },
  },
  {
    id: 'mage_skill3', // 서리 발자국
    bg: ['#3a8ad8', '#1c4a8a', '#0a2450'],
    draw(c) {
      c.poly([[2, 18.5], [6, 8], [10, 18.5]], CYAN);
      c.poly([[7, 18.5], [11, 2], [15, 18.5]], CYAN);
      c.poly([[12, 18.5], [16, 9], [19.5, 18.5]], CYAN);
      c.autoShade(new Map([[CYAN, [WHITE, BLUE]]]));
    },
  },
  {
    id: 'dash',
    bg: ['#2a8a8a', '#18585a', '#0a3032'],
    draw(c) {
      c.ellipse(12, 13.5, 3.8, 3.2, PINK);
      c.ellipse(8, 9.5, 1.5, 1.8, PINK);
      c.ellipse(11, 7, 1.5, 1.8, PINK);
      c.ellipse(14.5, 7.3, 1.5, 1.8, PINK);
      c.ellipse(16.6, 10.5, 1.4, 1.7, PINK);
      c.capsule(1, 8, 4, 8, 0.5, WHITE);
      c.capsule(1, 12, 5, 12, 0.5, WHITE);
      c.capsule(2, 16, 6, 16, 0.5, WHITE);
    },
  },
];

function buildIcon(def: IconDef): PixelCanvas {
  const bg = new PixelCanvas(S, S);
  bg.rect(0, 0, S, S, BG);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (y < 5 || (y === 5 && (x % 2 === 0))) bg.set(x, y, BG_HI);
      if (y > 15 || (y === 15 && (x % 2 === 1))) bg.set(x, y, BG_LO);
    }
  }
  for (const [x, y] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]]) bg.set(x, y, 0);
  const sym = new PixelCanvas(S, S);
  def.draw(sym);
  sym.outline(() => OUT);
  for (let i = 0; i < sym.px.length; i++) {
    // 아이콘 테두리 밖으로 나간 외곽선은 버린다
    const x = i % S;
    const y = Math.floor(i / S);
    if (sym.px[i] && bg.get(x, y)) bg.px[i] = sym.px[i];
  }
  return bg;
}

export const ICON_IDS = ICONS.map((d) => d.id);

export function registerIcons(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = S * ICONS.length;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ICONS.forEach((def, i) => ctx.putImageData(buildIcon(def).toImageData([...BASE_PAL, ...def.bg]), i * S, 0));
  const tex = scene.textures.addCanvas('icons', canvas);
  if (!tex) throw new Error('icons texture failed');
  ICONS.forEach((def, i) => tex.add(def.id, 0, i * S, 0, S, S));
}
