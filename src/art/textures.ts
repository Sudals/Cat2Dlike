/**
 * 런타임 텍스처 생성 → Phaser 텍스처 매니저 등록.
 * M2 에서 tools/ 의 Node 스크립트로 PNG + atlas JSON 을 미리 굽는 방식으로 전환한다 (로딩 시간/수작업 보정용).
 */
import type Phaser from 'phaser';
import { PixelCanvas, framePos, makeSheet, hexToRgb, type Palette } from './PixelCanvas';
import { buildHeroFrames, HERO_ANIMS, HERO_FRAME_H, HERO_FRAME_W, LOADOUTS } from './sprites/cat';
import { VIEW_W, VIEW_H, TILE } from '../config/game';
import { BAYER4, mulberry32 } from './rng';
import { registerSkillFx } from './skillFx';
import { registerIcons } from './icons';
import { registerEnemies } from './sprites/enemies';
import { registerBoss } from './sprites/boss';
import { registerItems } from './items';

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, names: readonly string[], fw: number, fh: number) {
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) throw new Error(`texture ${key} failed`);
  names.forEach((n, i) => tex.add(n, 0, ...framePos(i, fw, fh, names.length), fw, fh));
}

// ---------------------------------------------------------------------------
// 주인공 (직업별 텍스처: hero_blade, hero_mage / 애니: hero_blade_run …)
// ---------------------------------------------------------------------------
function registerHeroes(scene: Phaser.Scene) {
  for (const L of LOADOUTS) {
    const key = `hero_${L.key}`;
    const frames = buildHeroFrames(L);
    addSheet(scene, key, makeSheet(frames.map((f) => f.canvas), L.palette), frames.map((f) => f.name), HERO_FRAME_W, HERO_FRAME_H);
    for (const a of HERO_ANIMS) {
      scene.anims.create({
        key: `${key}_${a.key}`,
        frames: Array.from({ length: a.frames }, (_, i) => ({ key, frame: `${a.key}_${i}` })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 1장 뒷골목 타일 (16x16)
// ---------------------------------------------------------------------------
const TILE_PAL: Palette = ['#000000', '#1b1526', '#3a3045', '#4b3f57', '#5f5170', '#8a7ca0', '#2a2234', '#6b4a3a', '#8c6448', '#a98060'];

function brickTile(top: boolean): PixelCanvas {
  const c = new PixelCanvas(TILE, TILE);
  const rnd = mulberry32(top ? 7 : 11);
  c.rect(0, 0, TILE, TILE, 1); // 모르타르
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 ? 4 : 0;
    for (let bx = -8; bx < TILE; bx += 8) {
      const x = bx + off;
      const base = rnd() < 0.2 ? 2 : 3;
      c.rect(x, y, 7, 3, base);
      c.rect(x, y, 7, 1, 4); // 윗면 하이라이트
      if (rnd() < 0.35) c.set(x + 1 + Math.floor(rnd() * 5), y + 2, 2); // 얼룩
    }
  }
  if (top) {
    c.rect(0, 0, TILE, 3, 4); // 연석
    c.rect(0, 0, TILE, 1, 5);
    c.rect(0, 3, TILE, 1, 1);
  }
  return c;
}

function plankTile(): PixelCanvas {
  const c = new PixelCanvas(TILE, TILE);
  c.rect(0, 0, TILE, 6, 7);
  c.rect(0, 0, TILE, 1, 9);
  c.rect(0, 1, TILE, 1, 8);
  c.rect(0, 5, TILE, 1, 1);
  c.set(3, 3, 1);
  c.set(12, 3, 1);
  c.rect(1, 6, 2, 4, 6); // 받침
  c.rect(13, 6, 2, 4, 6);
  return c;
}

function registerTiles(scene: Phaser.Scene) {
  const tiles = [brickTile(true), brickTile(false), plankTile()];
  const names = ['brick_top', 'brick_fill', 'plank'];
  const sheet = makeSheet(tiles, TILE_PAL);
  // TileSprite 는 개별 텍스처가 필요하므로 프레임마다 별도 캔버스로 분리
  names.forEach((n, i) => {
    const cv = document.createElement('canvas');
    cv.width = TILE;
    cv.height = TILE;
    cv.getContext('2d')!.drawImage(sheet, i * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
    scene.textures.addCanvas(`tile_${n}`, cv);
  });
}

// ---------------------------------------------------------------------------
// 패럴랙스 배경: 밤하늘 / 먼 빌딩 / 가까운 빌딩
// ---------------------------------------------------------------------------
function registerBackground(scene: Phaser.Scene) {
  const rnd = mulberry32(42);

  // 하늘 (Bayer 디더 그라데이션 + 달 + 별)
  const sky = document.createElement('canvas');
  sky.width = VIEW_W;
  sky.height = VIEW_H;
  const sctx = sky.getContext('2d')!;
  const bands = ['#0f0b1e', '#171230', '#211a42', '#2e2352', '#3d2c5c'].map(hexToRgb);
  const img = sctx.createImageData(VIEW_W, VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    const f = (y / VIEW_H) * (bands.length - 1);
    const b = Math.floor(f);
    const frac = f - b;
    for (let x = 0; x < VIEW_W; x++) {
      const pick = frac * 16 > BAYER4[(y % 4) * 4 + (x % 4)] ? Math.min(b + 1, bands.length - 1) : b;
      const [r, g, bl] = bands[pick];
      const i = (y * VIEW_W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = bl;
      img.data[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  for (let i = 0; i < 90; i++) {
    sctx.fillStyle = rnd() < 0.15 ? '#fff6d8' : '#8f86b8';
    sctx.fillRect(Math.floor(rnd() * VIEW_W), Math.floor(rnd() * VIEW_H * 0.6), 1, 1);
  }
  const moon = new PixelCanvas(64, 64);
  moon.ellipse(32, 32, 30, 30, 1); // 달무리 (디더)
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (moon.get(x, y) === 1 && (x + y) % 2) moon.set(x, y, 0);
  moon.ellipse(32, 32, 19, 19, 2);
  moon.ellipse(30, 30, 17, 17, 3);
  moon.ellipse(25, 27, 3, 2.5, 2);
  moon.ellipse(36, 37, 4, 3, 2);
  moon.ellipse(37, 25, 2, 2, 2);
  moon.blit(sctx, 470, 28, ['#000000', '#3a2f63', '#e2d1a8', '#f6e9c8']);
  scene.textures.addCanvas('bg_sky', sky);

  // 빌딩 실루엣 레이어 (가로로 반복되므로 양 끝이 이어지도록 폭 단위로 생성)
  const city = (key: string, body: string, win: string, minH: number, maxH: number, winChance: number) => {
    const cv = document.createElement('canvas');
    cv.width = VIEW_W;
    cv.height = VIEW_H;
    const ctx = cv.getContext('2d')!;
    let x = 0;
    while (x < VIEW_W) {
      const w = 28 + Math.floor(rnd() * 46);
      const bw = Math.min(w, VIEW_W - x);
      const h = minH + Math.floor(rnd() * (maxH - minH));
      const top = VIEW_H - h;
      ctx.fillStyle = body;
      ctx.fillRect(x, top, bw, h);
      if (rnd() < 0.4) ctx.fillRect(x + 4 + Math.floor(rnd() * Math.max(1, bw - 14)), top - 8, 8, 8); // 물탱크
      if (rnd() < 0.3) ctx.fillRect(x + Math.floor(bw / 2), top - 14, 1, 14); // 안테나
      ctx.fillStyle = win;
      for (let wy = top + 6; wy < VIEW_H - 8; wy += 7) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 6) {
          if (rnd() < winChance) ctx.fillRect(wx, wy, 2, 3);
        }
      }
      x += w;
    }
    scene.textures.addCanvas(key, cv);
  };
  city('bg_city_far', '#1c1633', '#5b4a7a', 120, 220, 0.12);
  city('bg_city_near', '#140f22', '#f2c76b', 70, 160, 0.08);
}

// ---------------------------------------------------------------------------
// 공통 이펙트 텍스처
// ---------------------------------------------------------------------------
const FX_PAL: Palette = ['#000000', '#f3eadf', '#c9bfb5', '#8f8790', '#bfe9ff', '#7fd4ff', '#ffffff'];

/** fx_dust: 착지/점프 먼지 퍼프 6프레임 (16x16) */
function dustFrames(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  for (let k = 0; k < 6; k++) {
    const c = new PixelCanvas(16, 16);
    const r = 2 + k * 1.1;
    c.ellipse(8, 12 - k * 0.6, r + 0.5, r * 0.75, k < 3 ? 2 : 3);
    c.ellipse(7.5, 11.5 - k * 0.7, r - 0.3, r * 0.6, k < 2 ? 1 : 2);
    if (k >= 3) c.ellipse(8, 12 - k * 0.4, r - 1.6, r * 0.45, 0); // 가운데가 비며 흩어짐
    if (k >= 4) for (let i = 0; i < c.px.length; i++) if ((i + (i >> 4)) % 2) c.px[i] = 0; // 디더 페이드
    frames.push(c);
  }
  return frames;
}

/** fx_ring: 2단 점프 고리 5프레임 (32x16) */
function ringFrames(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  for (let k = 0; k < 5; k++) {
    const c = new PixelCanvas(32, 16);
    const rx = 5 + k * 2.6;
    const ry = 2 + k * 0.9;
    c.ellipse(16, 8, rx, ry, k < 2 ? 6 : 5);
    c.ellipse(16, 8, rx - 1.5, ry - 1, 0);
    if (k === 4) for (let i = 0; i < c.px.length; i++) if (i % 2) c.px[i] = 0;
    frames.push(c);
  }
  return frames;
}

/** fx_slash: 초승달 베기 궤적 5프레임 (64x48) — 위-뒤에서 앞-아래로 휩쓸며 사라짐. 중심 x=32 라 좌우 반전 대칭 */
function slashFrames(): PixelCanvas[] {
  const cx = 32, cy = 26, rx = 26, ry = 21;
  const t0 = -2.2, t1 = 1.0;
  const reveal = [0.35, 0.75, 1, 1, 1];
  const fade = [0, 0, 0.15, 0.5, 0.8];
  const thickMul = [0.6, 0.9, 1, 0.7, 0.45];
  return reveal.map((rv, k) => {
    const c = new PixelCanvas(64, 48);
    const tEnd = t0 + (t1 - t0) * rv;
    const tStart = t0 + (t1 - t0) * fade[k];
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const r = Math.hypot(nx, ny);
        const th = Math.atan2(ny, nx);
        if (r > 1 || th < tStart || th > tEnd) continue;
        const thick = 0.32 * Math.sin(Math.PI * ((th - t0) / (t1 - t0))) * thickMul[k];
        if (r < 1 - thick) continue;
        const depth = (1 - r) / Math.max(thick, 1e-3); // 0 = 바깥 날 … 1 = 안쪽
        if (k === 4 && (x + y) % 2) continue;
        c.set(x, y, depth < 0.4 ? 1 : depth < 0.8 ? 2 : 3);
      }
    }
    return c;
  });
}

/** fx_spark: 히트 스파크 5프레임 (24x24) */
function sparkFrames(): PixelCanvas[] {
  const frames: PixelCanvas[] = [];
  const cx = 12, cy = 12;
  const rays = [4, 10, 11, 8, 0];
  const core = [2.5, 3, 2, 0, 0];
  for (let k = 0; k < 5; k++) {
    const c = new PixelCanvas(24, 24);
    if (k >= 2) {
      const rr = 5 + k * 1.6;
      c.ellipse(cx, cy, rr, rr, 3);
      c.ellipse(cx, cy, rr - 1, rr - 1, 0);
      if (k >= 3) for (let i = 0; i < c.px.length; i++) if ((i * 7) % 3 === 0) c.px[i] = 0;
    }
    if (rays[k]) {
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        c.capsule(cx, cy, cx + Math.cos(ang) * rays[k], cy + Math.sin(ang) * rays[k], k < 2 ? 1 : 0.6, k < 2 ? 1 : 2);
        const d = ang + Math.PI / 4;
        c.capsule(cx, cy, cx + Math.cos(d) * rays[k] * 0.5, cy + Math.sin(d) * rays[k] * 0.5, 0.6, 2);
      }
    }
    if (core[k]) c.ellipse(cx, cy, core[k], core[k], 1);
    if (k === 4) for (const [x, y] of [[3, 6], [20, 4], [5, 19], [19, 18], [12, 2]]) c.set(x, y, 3);
    frames.push(c);
  }
  return frames;
}

/** fx_bolt: 마법사 별빛 탄 2프레임 (12x12, + 와 x 가 번갈아 반짝) */
function boltFrames(): PixelCanvas[] {
  return [0, Math.PI / 4].map((rot) => {
    const c = new PixelCanvas(12, 12);
    for (let a = 0; a < 4; a++) {
      const ang = rot + (a * Math.PI) / 2;
      c.capsule(6, 6, 6 + Math.cos(ang) * 4.6, 6 + Math.sin(ang) * 4.6, 0.7, 2);
    }
    c.ellipse(6, 6, 2.2, 2.2, 1);
    c.outline(() => 3);
    return c;
  });
}

function registerFx(scene: Phaser.Scene) {
  const slash = slashFrames();
  addSheet(scene, 'fx_slash', makeSheet(slash, ['#000000', '#ffffff', '#fff1c8', '#ff9a4a']), slash.map((_, i) => `${i}`), 64, 48);
  scene.anims.create({ key: 'fx_slash', frames: slash.map((_, i) => ({ key: 'fx_slash', frame: `${i}` })), frameRate: 24, repeat: 0 });

  // 같은 프레임을 팔레트만 바꿔 두 벌 (물리 타격 / 마법 타격)
  const spark = sparkFrames();
  for (const [key, pal] of [
    ['fx_spark', ['#000000', '#ffffff', '#fff27a', '#ff9a3a']],
    ['fx_spark_magic', ['#000000', '#ffffff', '#7ff0ff', '#a77ae0']],
  ] as const) {
    addSheet(scene, key, makeSheet(spark, pal), spark.map((_, i) => `${i}`), 24, 24);
    scene.anims.create({ key, frames: spark.map((_, i) => ({ key, frame: `${i}` })), frameRate: 24, repeat: 0 });
  }

  const bolt = boltFrames();
  addSheet(scene, 'fx_bolt', makeSheet(bolt, ['#000000', '#ffffff', '#7ff0ff', '#7a4cc0']), ['0', '1'], 12, 12);
  scene.anims.create({ key: 'fx_bolt', frames: [{ key: 'fx_bolt', frame: '0' }, { key: 'fx_bolt', frame: '1' }], frameRate: 12, repeat: -1 });

  const sparkle = new PixelCanvas(3, 3);
  sparkle.rect(1, 0, 1, 3, 2);
  sparkle.rect(0, 1, 3, 1, 2);
  sparkle.set(1, 1, 1);
  const sp = document.createElement('canvas');
  sp.width = 3;
  sp.height = 3;
  sparkle.blit(sp.getContext('2d')!, 0, 0, ['#000000', '#ffffff', '#7ff0ff']);
  scene.textures.addCanvas('fx_sparkle', sp);

  const dust = dustFrames();
  addSheet(scene, 'fx_dust', makeSheet(dust, FX_PAL), dust.map((_, i) => `${i}`), 16, 16);
  scene.anims.create({ key: 'fx_dust', frames: dust.map((_, i) => ({ key: 'fx_dust', frame: `${i}` })), frameRate: 18, repeat: 0 });

  const ring = ringFrames();
  addSheet(scene, 'fx_ring', makeSheet(ring, FX_PAL), ring.map((_, i) => `${i}`), 32, 16);
  scene.anims.create({ key: 'fx_ring', frames: ring.map((_, i) => ({ key: 'fx_ring', frame: `${i}` })), frameRate: 20, repeat: 0 });

  // 빗줄기 (1x5) / 물방울 (1x1)
  const rain = document.createElement('canvas');
  rain.width = 1;
  rain.height = 5;
  const rctx = rain.getContext('2d')!;
  rctx.fillStyle = '#6d78b8';
  rctx.fillRect(0, 0, 1, 5);
  rctx.fillStyle = '#a9b4f0';
  rctx.fillRect(0, 3, 1, 2);
  scene.textures.addCanvas('fx_rain', rain);

  const dot = document.createElement('canvas');
  dot.width = 1;
  dot.height = 1;
  const dctx = dot.getContext('2d')!;
  dctx.fillStyle = '#a9b4f0';
  dctx.fillRect(0, 0, 1, 1);
  scene.textures.addCanvas('fx_dot', dot);
}

export function registerGeneratedTextures(scene: Phaser.Scene): void {
  registerHeroes(scene);
  registerTiles(scene);
  registerBackground(scene);
  registerFx(scene);
  registerSkillFx(scene);
  registerIcons(scene);
  registerEnemies(scene);
  registerBoss(scene);
  registerItems(scene);
}
