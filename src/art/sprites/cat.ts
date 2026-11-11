/**
 * 주인공 — 두 발로 서는 의인화 고양이 (2.5등신 치비) 파라메트릭 도트 리그 v0
 * 포즈 파라미터 → 부위별 도형 래스터화 → 자동 음영 → 디테일 → 셀아웃 외곽선.
 * 직업 = 로드아웃(팔레트 스왑 + 의상/무기/모자 레이어). 같은 포즈 데이터를 모든 직업이 공유한다.
 */
import { PixelCanvas, type Palette } from '../PixelCanvas';

export const HERO_FRAME_W = 64;
export const HERO_FRAME_H = 64;
/** 발바닥이 닿는 y (스프라이트 origin) */
export const HERO_FOOT_Y = 60;

// 팔레트 인덱스 (모든 직업 팔레트가 같은 인덱스 구조를 공유 → 팔레트 스왑)
const OUT = 1, FUR_HI = 2, FUR = 3, FUR_LO = 4, STRIPE = 5, FAR = 6;
const WHT_HI = 7, WHT = 8, WHT_LO = 9, PINK = 10, IRIS = 11, PUPIL = 12, SHINE = 13;
const CLOTH_HI = 14, CLOTH = 15, CLOTH_LO = 16, ACC = 17, ACC_LO = 18;
const METAL_HI = 19, METAL = 20, HILT = 21, GOLD = 22, WOOD = 23, GEM = 24, GEM_HI = 25;
const HAT_HI = 26, HAT = 27, HAT_LO = 28;

export interface Loadout {
  key: string;
  /** 같은 직립 리그로 고양이·쥐(적) 모두 그린다 */
  species: 'cat' | 'rat';
  palette: Palette;
  weapon: 'katana' | 'staff' | 'dagger';
  outfit: 'scarf' | 'cloak';
  hat: boolean;
  stripes: boolean;
}

/** 검객 — 치즈 태비, 남색 도복 + 빨간 목도리, 카타나 */
export const LOADOUT_BLADE: Loadout = {
  key: 'blade',
  species: 'cat',
  weapon: 'katana',
  outfit: 'scarf',
  hat: false,
  stripes: true,
  palette: [
    '#000000', '#2a1620', '#ffd08a', '#f29a3a', '#c4652a', '#a8461f', '#b45a28',
    '#fffaf0', '#efe2d2', '#c8b2a4', '#f58c9b', '#8fdc5a', '#1a1220', '#ffffff',
    '#6a7fc8', '#46559e', '#2e3870', '#e04848', '#a02838',
    '#ffffff', '#b8c8e0', '#3a2a40', '#ffc94a', '#8a5a3a', '#7ff0ff', '#ffffff',
    '#7a52b0', '#553490', '#3a2068',
  ],
};

/** 마법사 — 검은 고양이 먹물, 보라 망토 + 마녀 모자, 별 지팡이 */
export const LOADOUT_MAGE: Loadout = {
  key: 'mage',
  species: 'cat',
  weapon: 'staff',
  outfit: 'cloak',
  hat: true,
  stripes: false,
  palette: [
    '#000000', '#120c18', '#5a5470', '#37324a', '#241f33', '#37324a', '#221d30',
    '#6a6480', '#4a4460', '#322c46', '#e87a94', '#ffd23a', '#120c18', '#ffffff',
    '#a77ae0', '#7a4cc0', '#4e2a88', '#3ad0c0', '#1f9088',
    '#ffffff', '#b8c8e0', '#3a2a40', '#ffc94a', '#7a4a2e', '#7ff0ff', '#ffffff',
    '#6a44a8', '#4a2a80', '#2e1858',
  ],
};

export const LOADOUTS: readonly Loadout[] = [LOADOUT_BLADE, LOADOUT_MAGE];

/** 적: 칼잡이 쥐 — 회색 쥐, 가죽 조끼 + 빨간 두건, 단검 */
export const LOADOUT_THUG: Loadout = {
  key: 'thug',
  species: 'rat',
  weapon: 'dagger',
  outfit: 'scarf',
  hat: false,
  stripes: false,
  palette: [
    '#000000', '#1a1018', '#b4adc0', '#8a8398', '#5e5870', '#8a8398', '#544e64',
    '#d8d0dc', '#b0a6b8', '#857a8e', '#e89aa6', '#ff3a3a', '#1a1018', '#ffd0d0',
    '#8a6448', '#64442e', '#422a1c', '#d83a3a', '#8a1e26',
    '#ffffff', '#b8c0cc', '#2a1a14', '#c8a040', '#7a4a2e', '#7ff0ff', '#ffffff',
    '#553490', '#553490', '#553490',
  ],
};

interface Vec { x: number; y: number }

interface HeroPose {
  bob: number;      // 전체 y 오프셋 (+ 아래)
  lean: number;     // 앞으로 숙임 (머리가 엉덩이보다 앞으로 나가는 px)
  squash: number;   // 몸통 두께 증감
  headBob: number;
  feet: [far: Vec, near: Vec];   // 엉덩이 기준 발 위치 x, 들어올림 y
  hands: [far: Vec, near: Vec];  // 어깨 기준 손 위치
  weapon: number;   // 무기 각도 (rad, 0 = 앞, -π/2 = 위)
  tail: number; tailCurl: number; tailSway: number;
  cape: number;     // 목도리/망토 각도 (π = 뒤로 수평, π-1.3 ≈ 아래로 늘어짐)
  capeSway: number;
  earsBack: number;
  blink: boolean;
  airborne: boolean;
  /** 칼날 반짝임 위치 0~1 (없으면 생략) */
  shine?: number;
  /** 프레임을 좌우 반전 (회전 동작에서 뒤돌아선 프레임) */
  mirror?: boolean;
  /** 휘두름 잔상: 칼이 [이전 각도 → 현재 각도] 로 지나간 부채꼴을 빛으로 채움 */
  smear?: readonly [from: number, to: number];
  /** 찌르기 속도선: 칼 뒤로 뻗는 가로 잔상 */
  streak?: boolean;
}

const GROUND = HERO_FOOT_Y - 0.5;

function chain(x: number, y: number, angle: number, curl: number, sway: number, n: number, seg: number): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  let a = angle;
  for (let i = 0; i < n; i++) {
    a += curl + sway * (i / n);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    pts.push([x, y]);
  }
  return pts;
}

function drawChain(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, col: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const r = r0 + (r1 - r0) * (i / (pts.length - 1));
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, col);
  }
}

function drawHero(p: HeroPose, L: Loadout): PixelCanvas {
  const c = new PixelCanvas(HERO_FRAME_W, HERO_FRAME_H);
  const bx = 31 + p.lean * 0.3;
  const by = 46 + p.bob;
  const hipY = by + 3.5;
  const hx = 33 + p.lean;
  const hy = 31 + p.bob + p.headBob;

  const hips: Vec[] = [{ x: bx - 1.5, y: hipY }, { x: bx + 1.5, y: hipY }];
  const shoulders: Vec[] = [
    { x: bx - 2 + p.lean * 0.25, y: by - 4 },
    { x: bx + 2 + p.lean * 0.25, y: by - 3.5 },
  ];
  const feet = hips.map((h, i) => ({
    x: h.x + p.feet[i].x,
    y: p.airborne ? h.y + 9 - p.feet[i].y : GROUND - 1.2 - p.feet[i].y,
  }));
  const hands = shoulders.map((s, i) => ({ x: s.x + p.hands[i].x, y: s.y + p.hands[i].y }));

  const drawLeg = (i: number, col: number, paw: number) => {
    c.capsule(hips[i].x, hips[i].y, feet[i].x, feet[i].y, 1.9, col);
    c.ellipse(feet[i].x + 1, feet[i].y + 0.4, 2.4, 1.4, paw);
  };
  const drawArm = (i: number, col: number, paw: number) => {
    c.capsule(shoulders[i].x, shoulders[i].y, hands[i].x, hands[i].y, 1.6, col);
    c.ellipse(hands[i].x, hands[i].y, 1.8, 1.8, paw);
  };

  // 1) 뒤쪽 팔 (어두운 털)
  drawArm(0, FAR, FAR);

  // 2) 꼬리
  const rat = L.species === 'rat';
  const tail = chain(bx - 5, hipY - 1.5, p.tail, p.tailCurl * (rat ? 0.6 : 1), p.tailSway, rat ? 9 : 7, 2.3);
  drawChain(c, tail, rat ? 1.0 : 1.9, rat ? 0.5 : 1.2, rat ? PINK : FUR);

  // 3) 목도리 꼬리 / 망토 (몸 뒤)
  if (L.outfit === 'scarf') {
    drawChain(c, chain(bx - 2, by - 5, p.cape, 0.12, p.capeSway, 5, 2.6), 1.4, 1.1, ACC);
  } else {
    drawChain(c, chain(bx - 1, by - 4.5, p.cape, 0.08, p.capeSway, 5, 2.6), 3.2, 3.8, CLOTH_LO);
  }

  // 4) 다리 (뒤 → 앞)
  drawLeg(0, FAR, FAR);
  drawLeg(1, FUR, WHT);

  // 5) 몸통 (옷) + 아랫단
  c.ellipse(bx, by, 5.5, 5.5 + p.squash, CLOTH);
  const hem = L.outfit === 'cloak' ? 4.5 : 3.2;
  c.poly([[bx - 5.3, by + 0.5], [bx + 5.3, by + 0.5], [bx + 6.4, hipY + hem], [bx - 6.4, hipY + hem]], CLOTH_LO);
  if (L.outfit === 'scarf') c.poly([[bx + 0.5, by - 5.6], [bx + 4.6, by - 4.6], [bx + 2.2, by - 1]], WHT); // 앞섶 사이 흰 가슴털

  // 6) 머리 + 귀
  const eb = p.earsBack;
  if (rat) {
    c.ellipse(hx - 1, hy + 1, 7.5, 6.8, FUR);
    c.ellipse(hx + 6, hy + 3, 5.5, 3.2, FUR); // 뾰족한 주둥이
    c.ellipse(hx - 4.5, hy - 5.5, 3.6, 3.6, FUR);
    c.ellipse(hx + 0.5, hy - 7, 4, 4, FUR);
    c.ellipse(hx + 6.5, hy + 4.4, 3.6, 1.5, WHT);
  } else {
    c.ellipse(hx, hy, 9.5, 8.5, FUR);
    c.ellipse(hx + 0.6, hy + 2.2, 9, 6.2, FUR); // 볼살
  }
  if (!L.hat && !rat) {
    c.poly([[hx - 8.2, hy - 2.5], [hx - 6.8 - eb * 2, hy - 13 + eb * 3], [hx - 1.8, hy - 7.2]], FUR);
    c.poly([[hx - 1.5, hy - 7.6], [hx + 3.4 - eb * 3, hy - 14.2 + eb * 4], [hx + 7.4, hy - 4.2]], FUR);
  }
  if (!rat) c.ellipse(hx + 5, hy + 3.2, 4, 2.8, WHT); // 주둥이

  // 7) 목도리 매듭 / 모자
  if (L.outfit === 'scarf') c.ellipse(bx + 0.5, by - 5.2, 5.2, 1.7, ACC);
  else c.ellipse(bx + 0.5, by - 5, 5, 1.6, ACC_LO);
  if (L.hat) {
    const flop = eb * 2 + p.lean * 0.4;
    c.poly([[hx - 6, hy - 6.5], [hx - 1.5 - flop, hy - 20], [hx + 6, hy - 6.5]], HAT);
    c.capsule(hx - 1.5 - flop, hy - 20, hx - 5 - flop * 1.4, hy - 17.5, 1.1, HAT);
    c.ellipse(hx + 0.5, hy - 6.2, 10.5, 2.3, HAT);
  }

  // 8) 무기 + 앞쪽 팔 (손이 손잡이를 덮도록 무기 먼저)
  const hand = hands[1];
  const ca = Math.cos(p.weapon);
  const sa = Math.sin(p.weapon);
  if (L.weapon === 'katana') {
    c.capsule(hand.x - ca * 4, hand.y - sa * 4, hand.x, hand.y, 0.9, HILT);
    c.capsule(hand.x + ca * 2.4, hand.y + sa * 2.4, hand.x + ca * 18, hand.y + sa * 18, 0.75, METAL);
    c.ellipse(hand.x + ca * 1.8, hand.y + sa * 1.8, 1.4, 1.4, GOLD);
  } else if (L.weapon === 'dagger') {
    c.capsule(hand.x - ca * 2.5, hand.y - sa * 2.5, hand.x, hand.y, 0.9, HILT);
    c.capsule(hand.x + ca * 1.5, hand.y + sa * 1.5, hand.x + ca * 9, hand.y + sa * 9, 0.8, METAL);
  } else {
    c.capsule(hand.x - ca * 7, hand.y - sa * 7, hand.x + ca * 15, hand.y + sa * 15, 0.85, WOOD);
    c.ellipse(hand.x + ca * 17, hand.y + sa * 17, 2.5, 2.5, GEM);
  }
  drawArm(1, FUR, WHT);

  // 9) 자동 음영
  c.autoShade(
    new Map<number, readonly [number, number]>([
      [FUR, [FUR_HI, FUR_LO]], [WHT, [WHT_HI, WHT_LO]], [CLOTH, [CLOTH_HI, CLOTH_LO]],
      [HAT, [HAT_HI, HAT_LO]], [ACC, [ACC, ACC_LO]], [METAL, [METAL_HI, METAL]], [GEM, [GEM_HI, GEM]],
    ]),
  );

  // 10) 디테일: 줄무늬, 귓속, 모자 띠, 허리띠, 얼굴
  if (L.stripes) {
    for (const ox of [-3, -0.5, 2]) c.capsule(hx + ox, hy - 8, hx + ox + 0.3, hy - 5.6, 0.55, STRIPE);
    for (let i = 2; i <= 6; i += 2) {
      const [x0, y0] = tail[i];
      const [x1, y1] = tail[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len;
      const ny = (x1 - x0) / len;
      c.capsule(x0 - nx * 1.6, y0 - ny * 1.6, x0 + nx * 1.6, y0 + ny * 1.6, 0.6, STRIPE);
    }
  }
  if (rat) {
    // 쥐 얼굴: 분홍 귓속, 붉은 눈 + 찌푸린 눈썹, 분홍 코, 앞니
    c.ellipse(hx - 4.5, hy - 5.5, 2, 2, PINK);
    c.ellipse(hx + 0.5, hy - 7, 2.3, 2.3, PINK);
    const rx = Math.round(hx + 2);
    const ry = Math.round(hy - 0.5);
    c.set(rx, ry, IRIS);
    c.set(rx + 1, ry, IRIS);
    c.set(rx, ry + 1, IRIS);
    c.set(rx + 1, ry + 1, SHINE);
    c.set(rx - 1, ry - 2, PUPIL);
    c.set(rx, ry - 1, PUPIL);
    c.set(rx + 1, ry - 1, PUPIL);
    c.set(Math.round(hx + 11), Math.round(hy + 2.5), PINK);
    c.set(Math.round(hx + 11), Math.round(hy + 3.5), PINK);
    c.set(Math.round(hx + 8.5), Math.round(hy + 5.5), SHINE);
  } else if (!L.hat) {
    c.poly([[hx + 0.4, hy - 7.4], [hx + 3.2 - eb * 3, hy - 11.8 + eb * 4], [hx + 5.4, hy - 5]], PINK);
    c.poly([[hx - 7.2, hy - 3.6], [hx - 6.4 - eb * 2, hy - 10 + eb * 3], [hx - 3.6, hy - 6.6]], PINK);
  } else {
    c.capsule(hx - 5, hy - 8.4, hx + 5, hy - 8.4, 0.7, ACC);
  }
  c.capsule(bx - 5, by + 1, bx + 5, by + 1, 0.6, L.outfit === 'scarf' ? GOLD : ACC);

  const ex = Math.round(hx + 0.8);
  const ey = Math.round(hy - 1.8);
  if (p.blink) {
    c.set(ex, ey + 1, PUPIL);
    c.set(ex + 1, ey + 1, PUPIL);
    c.set(ex + 5, ey + 1, PUPIL);
  } else {
    c.set(ex, ey, SHINE);
    c.set(ex + 1, ey, PUPIL);
    c.set(ex, ey + 1, PUPIL);
    c.set(ex + 1, ey + 1, PUPIL);
    c.set(ex, ey + 2, IRIS);
    c.set(ex + 1, ey + 2, IRIS);
    c.set(ex + 5, ey, PUPIL);
    c.set(ex + 5, ey + 1, PUPIL);
    c.set(ex + 5, ey + 2, IRIS);
  }
  c.set(Math.round(hx + 8.6), Math.round(hy + 1.4), PINK);
  c.set(Math.round(hx + 6.6), Math.round(hy + 4.4), WHT_LO);

  // 11) 셀아웃 외곽선
  c.outline(() => OUT);

  // 12) 휘두름 잔상 / 찌르기 속도선 (외곽선 없이, 빈 공간에만 그려 몸을 가리지 않음)
  if (L.weapon !== 'staff' && (p.smear || p.streak)) {
    const reach = L.weapon === 'dagger' ? 10 : 19;
    const free = (x: number, y: number) => {
      const v = c.get(x, y);
      return v === 0 || v === OUT;
    };
    if (p.smear) {
      const [a0, a1] = p.smear;
      const sweep = a1 - a0;
      const x0 = Math.floor(hand.x - reach - 1);
      const y0 = Math.floor(hand.y - reach - 1);
      for (let y = y0; y <= y0 + reach * 2 + 2; y++) {
        for (let x = x0; x <= x0 + reach * 2 + 2; x++) {
          const dx = x + 0.5 - hand.x;
          const dy = y + 0.5 - hand.y;
          const r = Math.hypot(dx, dy);
          if (r < 5 || r > reach || !free(x, y)) continue;
          let d = Math.atan2(dy, dx) - a0;
          if (sweep > 0) while (d < 0) d += Math.PI * 2;
          else while (d > 0) d -= Math.PI * 2;
          const t = d / sweep; // 0 = 오래된 쪽 → 1 = 칼날
          if (t < 0 || t > 1) continue;
          if (t < 0.45 && (x + y) % 2) continue; // 꼬리는 디더로 흐려짐
          const outer = (r - 5) / (reach - 5);
          c.set(x, y, t > 0.6 || outer > 0.85 ? SHINE : METAL);
        }
      }
    }
    if (p.streak) {
      for (const [oy, len] of [[-2, 12], [0, 16], [2, 10]] as const) {
        for (let k = 2; k < len; k++) {
          const x = Math.round(hand.x - ca * k);
          const y = Math.round(hand.y + oy - sa * k);
          if ((k > len * 0.5 && (x + y) % 2) || !free(x, y)) continue;
          c.set(x, y, k < len * 0.4 ? SHINE : METAL);
        }
      }
    }
  }

  // 13) 칼날을 따라 지나가는 반짝임 (외곽선 없이 빛나게)
  if (L.weapon === 'katana' && p.shine !== undefined && p.shine >= 0) {
    const d = 4 + p.shine * 13;
    const sx = Math.round(hand.x + ca * d);
    const sy = Math.round(hand.y + sa * d);
    c.set(sx, sy, SHINE);
    if (p.shine > 0.3 && p.shine < 0.8) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.set(sx + dx, sy + dy, SHINE);
  }

  if (p.mirror) {
    const m = new PixelCanvas(c.w, c.h);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) m.px[y * c.w + (c.w - 1 - x)] = c.px[y * c.w + x];
    return m;
  }
  return c;
}

// ---------------------------------------------------------------------------
// 애니메이션 (포즈는 모든 직업 공통, 무기 각도만 무기 타입별로 다름)
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const W = (L: Loadout, katana: number, staff: number) => (L.weapon === 'katana' ? katana : staff);

const BASE: HeroPose = {
  bob: 0, lean: 0, squash: 0, headBob: 0,
  feet: [{ x: -1, y: 0 }, { x: 1.5, y: 0 }],
  hands: [{ x: -1.5, y: 7 }, { x: 3, y: 6.5 }],
  weapon: 1,
  tail: Math.PI + 0.6, tailCurl: 0.2, tailSway: 0,
  cape: Math.PI - 1.25, capeSway: 0,
  earsBack: 0, blink: false, airborne: false,
};

/** 대기 = 전투 태세. 다리를 벌리고 무게중심을 낮춰 숨 쉬듯 들썩인다 */
function idle(i: number, n: number, L: Loadout): HeroPose {
  const t = (i / n) * TAU;
  const br = Math.sin(t);
  const common = {
    ...BASE,
    squash: 0.25 * br,
    headBob: 0.4 * Math.sin(t + 0.5),
    tail: Math.PI + 0.9,
    tailCurl: 0.18,
    tailSway: 0.35 * br,
    cape: Math.PI - 0.7 + 0.12 * Math.sin(t * 2),
    capeSway: 0.2 * Math.sin(t + 1),
    blink: i === 11,
  };
  if (L.weapon === 'staff') {
    // 지팡이를 앞으로 기울여 쥐고, 다른 손은 앞으로 내밀어 시전 준비
    return {
      ...common,
      bob: 0.5 + 0.3 * br,
      lean: 1,
      feet: [{ x: -3, y: 0 }, { x: 2.5, y: 0 }],
      hands: [{ x: 9, y: -1 + 0.6 * Math.sin(t + 0.8) }, { x: 6, y: 4 + 0.4 * br }],
      weapon: -0.95 + 0.04 * br,
    };
  }
  // 검·단검: 두 손으로 칼끝을 앞-위로 겨누는 중단 자세 + 칼날 반짝임
  return {
    ...common,
    bob: 1.2 + 0.35 * br,
    lean: 1.8 + 0.25 * Math.sin(t + 0.4),
    feet: [{ x: -4.5, y: 0 }, { x: 3.5, y: 0 }],
    hands: [{ x: 7, y: 3 + 0.4 * br }, { x: 6, y: 0 + 0.4 * br }],
    weapon: -0.82 + 0.05 * Math.sin(t + 0.3),
    shine: i < 6 ? i / 5 : -1,
  };
}

function run(i: number, n: number, L: Loadout): HeroPose {
  const t = (i / n) * TAU;
  // 발은 뒤로 미는 동안 지면, 앞으로 휘두를 때 들린다. 팔은 다리와 반대로 흔든다.
  const foot = (ph: number): Vec => ({ x: 4.5 * Math.sin(ph), y: 3 * Math.max(0, Math.cos(ph)) });
  return {
    ...BASE,
    bob: -0.9 * Math.abs(Math.cos(t)),
    lean: 2.5,
    headBob: 0.4 * Math.sin(2 * t),
    feet: [foot(t + Math.PI), foot(t)],
    hands: [{ x: -1 + 3 * Math.sin(t), y: 6 }, { x: 2 - 3 * Math.sin(t), y: 5.5 }],
    weapon: W(L, 2.95, -2.2),
    tail: Math.PI + 0.25, tailCurl: 0.12, tailSway: 0.25 * Math.sin(t),
    cape: Math.PI - 0.35, capeSway: 0.18 * Math.sin(2 * t),
    earsBack: 0.3,
  };
}

/** 걷기: 보폭 작고 덜 숙임 (기본 이동) */
function walk(i: number, n: number, L: Loadout): HeroPose {
  const t = (i / n) * TAU;
  const foot = (ph: number): Vec => ({ x: 3 * Math.sin(ph), y: 1.6 * Math.max(0, Math.cos(ph)) });
  return {
    ...BASE,
    lean: 1,
    headBob: 0.3 * Math.sin(2 * t),
    feet: [foot(t + Math.PI), foot(t)],
    hands: L.weapon === 'staff' ? [{ x: -1.5 + 1.8 * Math.sin(t), y: 6.5 }, { x: 5 - 1.2 * Math.sin(t), y: 4 }] : [{ x: 6.5, y: 4 }, { x: 5.5, y: 1.5 + 0.5 * Math.sin(2 * t) }],
    weapon: W(L, -0.55, -1.1),
    bob: 0.4 - 0.5 * Math.abs(Math.cos(t)),
    tailSway: 0.25 * Math.sin(t),
    capeSway: 0.12 * Math.sin(2 * t),
    cape: Math.PI - 1.0,
  };
}



/** 피격: 뒤로 젖히며 눈 질끈 */
function hurt(i: number, _n: number, L: Loadout): HeroPose {
  return {
    ...BASE,
    lean: -2.5,
    bob: 0.5,
    headBob: -0.5,
    squash: 0.3,
    feet: [{ x: -3, y: 0 }, { x: 1, y: 1 }],
    hands: [{ x: -4, y: 2 }, { x: 1, y: 3 }],
    weapon: W(L, 2.2, -2.0),
    tail: Math.PI - 0.2,
    cape: Math.PI - 0.3 + i * 0.2,
    earsBack: 1,
    blink: true,
  };
}

/**
 * 회전베기: 한 바퀴 = 칼을 앞으로 쭉 뻗음 → 칼이 몸 앞을 쓸고 지나감 → (반전) 반대쪽으로 뻗음 → (반전) 쓸고 지나감.
 * 낮게 웅크린 채 망토·꼬리가 원심력으로 휘날린다. 8프레임 = 두 바퀴.
 */
function spin(i: number, _n: number, L: Loadout): HeroPose {
  const ph = i % 4;
  const extended = ph % 2 === 0;
  return {
    ...BASE,
    bob: 1.8,
    squash: extended ? -0.2 : 0.4,
    lean: extended ? 1.5 : 0,
    headBob: extended ? 0 : 0.5,
    feet: [{ x: -4.5, y: 0 }, { x: 4, y: 0 }],
    hands: extended ? [{ x: -4, y: 2 }, { x: 11, y: 1 }] : [{ x: 2, y: 3 }, { x: 4, y: 5 }],
    weapon: W(L, extended ? 0.04 : 1.25, extended ? -0.1 : 1.2),
    tail: Math.PI + (extended ? 0.1 : 0.6),
    tailCurl: 0.05,
    cape: extended ? Math.PI - 0.1 : Math.PI - 0.6,
    capeSway: 0.2,
    earsBack: 0.8,
    mirror: ph >= 2,
  };
}

/** ↑+공격: 웅크렸다가 무기를 머리 위로 곧게 찔러 올림 (검객은 솟구치며 찌르기, 마법사는 위로 시전) */
function upAttack(i: number, _n: number, L: Loadout): HeroPose {
  const K = [
    { bob: 1.5, squash: 0.5, near: { x: 4, y: 4 }, katana: -0.9, staff: -1.2 },
    { bob: -1, squash: -0.4, near: { x: 4, y: -9 }, katana: -1.45, staff: -1.5 },
    { bob: -1.5, squash: -0.5, near: { x: 4, y: -10 }, katana: -1.52, staff: -1.55 },
    { bob: -1, squash: -0.3, near: { x: 4, y: -8 }, katana: -1.45, staff: -1.5 },
    { bob: 0, squash: 0, near: { x: 5, y: -2 }, katana: -1.0, staff: -1.2 },
  ][i];
  return {
    ...BASE,
    bob: K.bob,
    squash: K.squash,
    lean: 0.5,
    feet: i === 0 ? [{ x: -2.5, y: 0 }, { x: 2.5, y: 0 }] : [{ x: -1.5, y: i === 2 ? 2 : 1 }, { x: 1.5, y: i === 2 ? 3 : 1 }],
    hands: [{ x: -2, y: i ? 2 : 5 }, K.near],
    weapon: W(L, K.katana, K.staff),
    cape: Math.PI - 1.5 + (i ? 0 : 0.3),
    earsBack: 0.3,
  };
}

function jump(i: number, _n: number, L: Loadout): HeroPose {
  return {
    ...BASE,
    airborne: true,
    lean: 1,
    feet: [{ x: -2, y: 1 }, { x: 2.5, y: 4 }],
    hands: [{ x: -3, y: 3 }, { x: 4, y: 2 }],
    weapon: W(L, -2.4, -1.8),
    tail: Math.PI - 0.4, tailCurl: 0.1, tailSway: i ? 0.2 : 0,
    cape: Math.PI - 1.5, capeSway: i ? 0.1 : 0,
  };
}

function fall(i: number, _n: number, L: Loadout): HeroPose {
  return {
    ...BASE,
    airborne: true,
    feet: [{ x: -1.5, y: 0.5 }, { x: 1.5, y: -1 }],
    hands: [{ x: -4, y: -1 }, { x: 4, y: -2 }],
    weapon: W(L, -0.6, -1.0),
    tail: Math.PI + 1.1, tailCurl: 0.15, tailSway: i ? 0.25 : 0,
    cape: Math.PI + 0.8, capeSway: i ? 0.2 : 0,
    earsBack: 0.4,
  };
}

function dash(i: number, _n: number, L: Loadout): HeroPose {
  return {
    ...BASE,
    airborne: true,
    bob: 1,
    lean: 5,
    feet: [{ x: -5, y: 1 }, { x: 3, y: 2 }],
    hands: [{ x: -5, y: 4 }, { x: 6, y: 3 }],
    weapon: W(L, 2.9, 2.9),
    tail: Math.PI + 0.05, tailCurl: 0.03, tailSway: i ? 0.1 : -0.1,
    cape: Math.PI - 0.05, capeSway: i ? 0.15 : -0.15,
    earsBack: 1,
  };
}


/** 휘두르기 키프레임 (검·단검은 katana 각도, 지팡이는 staff 각도) */
interface SwingKey {
  lean: number;
  bob: number;
  squash: number;
  near: Vec;
  far: Vec;
  katana: number;
  staff: number;
  feet: readonly [back: number, front: number];
  smear?: readonly [number, number];
}

function swingPose(K: SwingKey, L: Loadout, extra: Partial<HeroPose> = {}): HeroPose {
  return {
    ...BASE,
    lean: K.lean,
    bob: K.bob,
    squash: K.squash,
    feet: [{ x: K.feet[0], y: 0 }, { x: K.feet[1], y: 0 }],
    hands: [K.far, K.near],
    weapon: W(L, K.katana, K.staff),
    smear: K.smear,
    tail: Math.PI + 0.6 - K.lean * 0.08,
    tailSway: K.lean * 0.04,
    cape: Math.PI - 0.9 + K.lean * 0.14,
    ...extra,
  };
}

/**
 * 콤보 1타 — 높이 치켜든 칼을 몸을 던지며 사선으로 내려벤다.
 * 웅크려 힘 모으기(2) → 휘두름(잔상) → 낮게 파고든 타격(잔상) → 팔로스루 → 회복 → 자세 복귀
 */
const SLASH1: readonly SwingKey[] = [
  { lean: -2, bob: 1.5, squash: 0.5, near: { x: -2, y: -10 }, far: { x: -3, y: -7 }, katana: -2.05, staff: -2.0, feet: [-5, 3] },
  { lean: -2.5, bob: 1.9, squash: 0.6, near: { x: -3, y: -10.5 }, far: { x: -4, y: -7 }, katana: -2.3, staff: -2.2, feet: [-5, 3] },
  { lean: 3, bob: 0.2, squash: -0.3, near: { x: 7, y: -3 }, far: { x: 2, y: 2 }, katana: -0.3, staff: -1.0, feet: [-5, 5], smear: [-2.3, -0.3] },
  { lean: 4.5, bob: 1.2, squash: 0.2, near: { x: 9, y: 3 }, far: { x: -4, y: 4 }, katana: 0.9, staff: -0.15, feet: [-6, 6], smear: [-0.3, 0.9] },
  { lean: 4, bob: 1.4, squash: 0.3, near: { x: 6, y: 6 }, far: { x: -4, y: 4 }, katana: 1.5, staff: -0.25, feet: [-6, 6], smear: [0.9, 1.5] },
  { lean: 2.5, bob: 0.9, squash: 0.1, near: { x: 5, y: 4 }, far: { x: -2, y: 4 }, katana: 0.7, staff: -0.6, feet: [-5, 4] },
  { lean: 1.8, bob: 1.0, squash: 0, near: { x: 6, y: 0 }, far: { x: 7, y: 3 }, katana: -0.6, staff: -0.9, feet: [-4.5, 3.5] },
];

/** 콤보 2타 — 칼을 낮게 끌었다가 아래에서 위로 크게 올려벤다 (몸이 살짝 떠오름) */
const SLASH2: readonly SwingKey[] = [
  { lean: 1, bob: 2, squash: 0.5, near: { x: -2, y: 7 }, far: { x: -4, y: 5 }, katana: 2.4, staff: -0.3, feet: [-4.5, 3.5] },
  { lean: 2, bob: 2.2, squash: 0.6, near: { x: 3, y: 7 }, far: { x: 0, y: 6 }, katana: 1.7, staff: -0.2, feet: [-5, 4] },
  { lean: 3.5, bob: 0, squash: -0.4, near: { x: 8, y: -2 }, far: { x: -3, y: 3 }, katana: -0.6, staff: -0.9, feet: [-5, 5], smear: [1.7, -0.6] },
  { lean: 2.5, bob: -0.8, squash: -0.4, near: { x: 5, y: -8 }, far: { x: -4, y: 2 }, katana: -1.5, staff: -1.3, feet: [-4, 4], smear: [-0.6, -1.5] },
  { lean: 1.5, bob: 0, squash: 0, near: { x: 3, y: -7 }, far: { x: -3, y: 3 }, katana: -2.0, staff: -1.2, feet: [-4, 3.5] },
  { lean: 1.8, bob: 0.9, squash: 0, near: { x: 6, y: 0 }, far: { x: 7, y: 3 }, katana: -0.8, staff: -1.0, feet: [-4.5, 3.5] },
];

/** 콤보 3타 — 활시위처럼 몸을 뒤로 당겼다가 크게 내딛으며 찌르기 (속도선) */
const SLASH3: readonly SwingKey[] = [
  { lean: -3, bob: 1.5, squash: 0.5, near: { x: -5, y: 2 }, far: { x: 6, y: 0 }, katana: 0.05, staff: -0.1, feet: [-6, 3] },
  { lean: -3.5, bob: 2, squash: 0.6, near: { x: -6, y: 2 }, far: { x: 7, y: -1 }, katana: 0.05, staff: -0.1, feet: [-6, 3] },
  { lean: 6, bob: 0.6, squash: -0.3, near: { x: 9.5, y: 1 }, far: { x: -6, y: 3 }, katana: 0, staff: -0.05, feet: [-7, 6] },
  { lean: 6, bob: 0.8, squash: -0.2, near: { x: 9.5, y: 1 }, far: { x: -6, y: 3 }, katana: 0, staff: -0.05, feet: [-7, 6] },
  { lean: 5, bob: 1, squash: 0, near: { x: 8.5, y: 2 }, far: { x: -5, y: 3 }, katana: 0.1, staff: -0.1, feet: [-6.5, 5.5] },
  { lean: 3, bob: 0.8, squash: 0, near: { x: 6, y: 4 }, far: { x: -2, y: 4 }, katana: 0.6, staff: -0.6, feet: [-5, 4] },
  { lean: 1.8, bob: 1, squash: 0, near: { x: 6, y: 0 }, far: { x: 7, y: 3 }, katana: -0.6, staff: -0.9, feet: [-4.5, 3.5] },
];

function attack(i: number, _n: number, L: Loadout): HeroPose {
  return swingPose(SLASH1[i], L, { earsBack: i >= 1 && i <= 4 ? 0.6 : 0 });
}

function attack2(i: number, _n: number, L: Loadout): HeroPose {
  return swingPose(SLASH2[i], L, { earsBack: i >= 1 && i <= 3 ? 0.5 : 0 });
}

function attack3(i: number, _n: number, L: Loadout): HeroPose {
  return swingPose(SLASH3[i], L, { earsBack: i >= 2 && i <= 4 ? 0.8 : 0, streak: i === 2 || i === 3, ...(i >= 2 && i <= 4 ? { cape: Math.PI - 0.2 } : {}) });
}

export interface AnimSpec {
  key: string;
  frames: number;
  fps: number;
  loop: boolean;
  pose: (i: number, n: number, L: Loadout) => HeroPose;
}

export const HERO_ANIMS: readonly AnimSpec[] = [
  { key: 'idle', frames: 16, fps: 8, loop: true, pose: idle },
  { key: 'walk', frames: 8, fps: 10, loop: true, pose: walk },
  { key: 'run', frames: 8, fps: 14, loop: true, pose: run },
  { key: 'attack', frames: 7, fps: 22, loop: false, pose: attack },
  { key: 'attack2', frames: 6, fps: 22, loop: false, pose: attack2 },
  { key: 'attack3', frames: 7, fps: 20, loop: false, pose: attack3 },
  { key: 'hurt', frames: 2, fps: 10, loop: true, pose: hurt },
  { key: 'jump', frames: 2, fps: 8, loop: true, pose: jump },
  { key: 'fall', frames: 2, fps: 8, loop: true, pose: fall },
  { key: 'dash', frames: 2, fps: 16, loop: true, pose: dash },
  { key: 'spin', frames: 8, fps: 24, loop: true, pose: spin },
  { key: 'upatk', frames: 5, fps: 20, loop: false, pose: upAttack },
];

/** 기본 공격 3타 콤보 애니 순서와 각 타의 타격 프레임 */
export const COMBO_ANIMS = ['attack', 'attack2', 'attack3'] as const;
export const ACTIVE_FRAME: Record<string, string> = { attack: 'attack_2', attack2: 'attack2_2', attack3: 'attack3_2', upatk: 'upatk_1' };

export function buildHeroFrames(L: Loadout): { name: string; canvas: PixelCanvas }[] {
  return HERO_ANIMS.flatMap((a) =>
    Array.from({ length: a.frames }, (_, i) => ({ name: `${a.key}_${i}`, canvas: drawHero(a.pose(i, a.frames, L), L) })),
  );
}
