/**
 * 아이템 도트 (16x16, 텍스처 'items' / 프레임 = 아이템 종류)
 * 증강 아이콘 (24x24, 텍스처 'aug_icons' / 프레임 = 아이콘 id)
 * 쥐왕 왕관 투사체 ('fx_crown')
 */
import type Phaser from 'phaser';
import { PixelCanvas, makeSheet, framePos, type Palette } from './PixelCanvas';

// ---------------------------------------------------------------------------
// 아이템
// ---------------------------------------------------------------------------
const IP = {
  OUT: 1, GLASS: 2, GLASS_HI: 3, RED: 4, RED_HI: 5, BLUE: 6, BLUE_HI: 7, CORK: 8, GOLD: 9, SILVER: 10, SILVER_LO: 11,
  LABEL: 12, FISH: 13, STICK: 14, STICK_LO: 15, LEAF: 16, LEAF_HI: 17, WHITE: 18, PINK: 19,
} as const;
const ITEM_PAL: Palette = [
  '#000000', '#1a1020', '#c8e0f0', '#ffffff', '#e8384a', '#ff8a8a', '#3a7ae8', '#8ad0ff', '#a8784a', '#ffc94a', '#d8dce8', '#8a90a8',
  '#3a5ad8', '#ff9a4a', '#ffd36e', '#d88a2a', '#4ac85a', '#a8f07a', '#ffffff', '#f58c9b',
];

function flask(liquid: number, hi: number, big: boolean): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  const r = big ? 6 : 5;
  c.ellipse(8, 10.5, r, r - 0.5, IP.GLASS);
  c.rect(6, big ? 1.5 : 2.5, 4, 4, IP.GLASS);
  c.ellipse(8, 11.2, r - 1, r - 1.6, liquid);
  c.rect(5, 10, 6, 1, hi);
  c.rect(5.5, big ? 0.5 : 1.5, 5, 2, big ? IP.GOLD : IP.CORK);
  c.set(5, 9, IP.GLASS_HI);
  c.set(5, 10, IP.GLASS_HI);
  c.set(6, 8, IP.GLASS_HI);
  if (big) {
    c.ellipse(6.6, 12, 1.2, 1.2, IP.WHITE);
    c.ellipse(9.4, 12, 1.2, 1.2, IP.WHITE);
    c.poly([[5.5, 12.4], [10.5, 12.4], [8, 15]], IP.WHITE);
  }
  c.outline(() => IP.OUT);
  return c;
}

function tuna(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  c.rect(2, 6, 12, 7, IP.SILVER);
  c.ellipse(8, 6, 6, 1.6, IP.SILVER);
  c.ellipse(8, 13, 6, 1.6, IP.SILVER_LO);
  c.rect(2, 8, 12, 3, IP.LABEL);
  c.ellipse(7.5, 9.5, 3, 1.2, IP.FISH);
  c.poly([[10, 9.5], [12, 8.3], [12, 10.7]], IP.FISH);
  c.set(6, 9, IP.WHITE);
  c.ellipse(8, 5.6, 4, 0.8, IP.SILVER_LO);
  c.outline(() => IP.OUT);
  return c;
}

function snack(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  c.capsule(3, 13, 12, 3, 2, IP.STICK);
  c.capsule(3, 13, 12, 3, 0.8, IP.STICK_LO);
  c.capsule(10.5, 4.5, 12.5, 2.5, 2.2, IP.PINK);
  c.set(11, 3, IP.WHITE);
  c.outline(() => IP.OUT);
  return c;
}

function catnip(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  c.capsule(8, 15, 8, 6, 0.6, IP.LEAF);
  c.ellipse(5, 8, 3.2, 2, IP.LEAF);
  c.ellipse(11, 8, 3.2, 2, IP.LEAF);
  c.ellipse(8, 4.5, 2.2, 3.2, IP.LEAF);
  c.ellipse(5, 7.5, 1.6, 0.8, IP.LEAF_HI);
  c.ellipse(11, 7.5, 1.6, 0.8, IP.LEAF_HI);
  c.ellipse(8, 3.5, 1, 1.6, IP.LEAF_HI);
  c.outline(() => IP.OUT);
  return c;
}

export const ITEM_FRAMES = ['potion_s', 'potion_l', 'mana', 'tuna', 'snack', 'catnip'] as const;

// ---------------------------------------------------------------------------
// 증강 아이콘 (원형 보석 배경 + 흰 심볼)
// ---------------------------------------------------------------------------
const AP = { OUT: 1, BG_HI: 2, BG: 3, BG_LO: 4, S: 5, S_LO: 6, ACC: 7 } as const;
const AUG_ICONS: Record<string, { bg: [string, string, string]; acc: string; draw(c: PixelCanvas): void }> = {
  aug_claw: { bg: ['#ff8a6a', '#d8483a', '#8a1e26'], acc: '#ffd36e', draw: (c) => [7, 11, 15].forEach((x) => c.lens(x - 3, 6, x + 2, 18, 1.3, [AP.S, AP.S, AP.S_LO])) },
  aug_heart: { bg: ['#ff9aa8', '#e8485a', '#8a1e36'], acc: '#ffffff', draw: (c) => (c.ellipse(9, 10, 3.5, 3.5, AP.S), c.ellipse(15, 10, 3.5, 3.5, AP.S), c.poly([[5.6, 11], [18.4, 11], [12, 19]], AP.S)) },
  aug_boot: { bg: ['#8af0d8', '#2aa88a', '#105848'], acc: '#ffffff', draw: (c) => (c.ellipse(14, 14.5, 3.6, 3, AP.S), [[10.5, 10.5], [13.5, 8.5], [17, 9], [19, 12]].forEach(([x, y]) => c.ellipse(x, y, 1.4, 1.7, AP.S)), [9, 13, 17].forEach((y) => c.capsule(3, y, 7, y, 0.5, AP.S_LO))) },
  aug_clock: { bg: ['#a8c8ff', '#4a6ad8', '#1c2a6a'], acc: '#ffd36e', draw: (c) => (c.ellipse(12, 12, 7, 7, AP.S), c.ellipse(12, 12, 5.6, 5.6, AP.BG), c.capsule(12, 12, 12, 7.5, 0.7, AP.S), c.capsule(12, 12, 15.5, 13.5, 0.7, AP.S)) },
  aug_eye: { bg: ['#ffe08a', '#d8a02a', '#6a4a10'], acc: '#1a1020', draw: (c) => (c.lens(4, 12, 20, 12, 5, [AP.S, AP.S, AP.S_LO]), c.ellipse(12, 12, 1.4, 4, AP.ACC)) },
  aug_leaf: { bg: ['#b8f08a', '#4ab84a', '#1e5a28'], acc: '#ffffff', draw: (c) => (c.lens(6, 18, 18, 6, 4.2, [AP.S, AP.S, AP.S_LO]), c.capsule(7, 17, 16, 8, 0.5, AP.BG_LO)) },
  aug_sword: { bg: ['#d8dce8', '#7a84a8', '#2e3456'], acc: '#ffc94a', draw: (c) => (c.capsule(8, 16, 18, 6, 1, AP.S), c.capsule(5, 19, 8, 16, 1.1, AP.ACC), c.capsule(6, 14, 10, 18, 0.7, AP.ACC)) },
  aug_fang: { bg: ['#ff8a9a', '#c8283a', '#5a0a16'], acc: '#ff3a4a', draw: (c) => (c.poly([[6, 6], [11, 6], [8.5, 15]], AP.S), c.poly([[13, 6], [18, 6], [15.5, 15]], AP.S), c.ellipse(15.5, 18.5, 1.6, 2, AP.ACC)) },
  aug_moon: { bg: ['#a8b8ff', '#3a4ab8', '#141a50'], acc: '#ffffff', draw: (c) => (c.ellipse(12, 12, 7, 7, AP.S), c.ellipse(15, 10, 6, 6, AP.BG), c.set(18, 16, AP.ACC), c.set(6, 6, AP.ACC)) },
  aug_wing: { bg: ['#d8f0ff', '#6aa8d8', '#1e4a78'], acc: '#ffffff', draw: (c) => [0, 1, 2].forEach((k) => c.lens(5 + k * 2, 18 - k, 18, 5 + k * 3, 1.8 - k * 0.3, [AP.S, AP.S, AP.S_LO])) },
  aug_bomb: { bg: ['#ffb46a', '#e8582a', '#6a1a0a'], acc: '#ffe14a', draw: (c) => (c.ellipse(11, 14, 6, 6, AP.S_LO), c.ellipse(10, 13, 2, 2, AP.S), c.capsule(14, 9, 17, 5, 0.7, AP.S), c.ellipse(18, 4.5, 1.6, 1.6, AP.ACC)) },
  aug_shield: { bg: ['#c8d8f0', '#5a78a8', '#1e2e50'], acc: '#ff6a5a', draw: (c) => (c.poly([[5, 5], [19, 5], [18, 13], [12, 20], [6, 13]], AP.S), c.capsule(12, 7, 12, 16, 0.8, AP.ACC), c.capsule(8, 10.5, 16, 10.5, 0.8, AP.ACC)) },
  aug_bell: { bg: ['#ffe8a0', '#e8b02a', '#6a4a0a'], acc: '#a8784a', draw: (c) => (c.poly([[8, 7], [16, 7], [18, 16], [6, 16]], AP.S), c.ellipse(12, 7, 4, 2.5, AP.S), c.rect(5, 16, 14, 2, AP.S_LO), c.ellipse(12, 19, 1.6, 1.6, AP.ACC)) },
  aug_fish: { bg: ['#a8e8ff', '#3a98c8', '#10405a'], acc: '#ffffff', draw: (c) => (c.ellipse(11, 12, 6, 3.6, AP.S), c.poly([[16, 12], [20, 8], [20, 16]], AP.S), [8, 11, 14].forEach((x) => c.capsule(x, 10, x, 14, 0.4, AP.S_LO)), c.set(7, 11, AP.BG_LO)) },
  aug_star: { bg: ['#ffd8ff', '#c86ad8', '#4a1a6a'], acc: '#ffffff', draw: (c) => c.poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3.6 : 8.5; return [12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r] as [number, number]; }), AP.S) },
  aug_bolt: { bg: ['#fff08a', '#c8a82a', '#4a3a0a'], acc: '#ffffff', draw: (c) => c.poly([[14, 3], [6, 13], [11, 13], [9, 21], [18, 10], [13, 10], [16, 3]], AP.S) },
};

function augIcon(def: (typeof AUG_ICONS)[string]): { c: PixelCanvas; pal: Palette } {
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 12, 11.5, 11.5, AP.BG);
  c.autoShade(new Map<number, readonly [number, number]>([[AP.BG, [AP.BG_HI, AP.BG_LO]]]));
  const sym = new PixelCanvas(24, 24);
  def.draw(sym);
  sym.outline(() => AP.OUT);
  c.stamp(sym);
  c.outline(() => AP.OUT);
  return { c, pal: ['#000000', '#1a1020', def.bg[0], def.bg[1], def.bg[2], '#ffffff', '#c8c8d8', def.acc] };
}

// ---------------------------------------------------------------------------
// 왕관 (쥐왕 부메랑)
// ---------------------------------------------------------------------------
function crown(): PixelCanvas {
  const c = new PixelCanvas(28, 20);
  c.poly([[2, 18], [2, 6], [7, 11], [10, 3], [14, 10], [18, 3], [21, 11], [26, 6], [26, 18]], 3);
  c.autoShade(new Map<number, readonly [number, number]>([[3, [2, 4]]]));
  c.rect(2, 14, 24, 3, 4);
  c.ellipse(14, 15.5, 1.8, 1.8, 5);
  c.ellipse(7, 15.5, 1.3, 1.3, 6);
  c.ellipse(21, 15.5, 1.3, 1.3, 6);
  for (const x of [10, 18]) c.ellipse(x, 3, 1.4, 1.4, 5);
  c.outline(() => 1);
  return c;
}

export function registerItems(scene: Phaser.Scene): void {
  const items = [flask(IP.RED, IP.RED_HI, false), flask(IP.RED, IP.RED_HI, true), flask(IP.BLUE, IP.BLUE_HI, false), tuna(), snack(), catnip()];
  const tex = scene.textures.addCanvas('items', makeSheet(items, ITEM_PAL));
  if (!tex) throw new Error('items texture failed');
  ITEM_FRAMES.forEach((f, i) => tex.add(f, 0, ...framePos(i, 16, 16, items.length), 16, 16));

  const ids = Object.keys(AUG_ICONS);
  const canvas = document.createElement('canvas');
  canvas.width = 24 * ids.length;
  canvas.height = 24;
  const ctx = canvas.getContext('2d')!;
  ids.forEach((id, i) => {
    const { c, pal } = augIcon(AUG_ICONS[id]);
    ctx.putImageData(c.toImageData(pal), i * 24, 0);
  });
  const aug = scene.textures.addCanvas('aug_icons', canvas);
  if (!aug) throw new Error('aug_icons texture failed');
  ids.forEach((id, i) => aug.add(id, 0, i * 24, 0, 24, 24));

  scene.textures.addCanvas('fx_crown', makeSheet([crown()], ['#000000', '#3a2008', '#fff0a0', '#ffc94a', '#c8882a', '#e8384a', '#7ff0ff']));
}
