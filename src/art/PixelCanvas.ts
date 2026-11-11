/**
 * 인덱스 컬러 픽셀 버퍼 — 코드 기반 도트 생성 파이프라인의 핵심.
 * 모든 도형은 "픽셀 중심 샘플링"으로 래스터화되어 안티앨리어싱 없는 깔끔한 도트가 된다.
 * 0 = 투명, 1..n = 팔레트 인덱스.
 */
export type Palette = readonly string[];
type Pt = readonly [number, number];

export class PixelCanvas {
  readonly px: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  /** bbox 안의 픽셀 중심 (x+.5, y+.5) 이 test 를 만족하면 c 로 칠한다 */
  fillWhere(x0: number, y0: number, x1: number, y1: number, c: number, test: (x: number, y: number) => boolean): void {
    const xa = Math.max(0, Math.floor(x0));
    const ya = Math.max(0, Math.floor(y0));
    const xb = Math.min(this.w - 1, Math.ceil(x1));
    const yb = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        if (test(x + 0.5, y + 0.5)) this.px[y * this.w + x] = c;
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    this.fillWhere(x, y, x + w, y + h, c, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    if (rx <= 0 || ry <= 0) return;
    this.fillWhere(cx - rx, cy - ry, cx + rx, cy + ry, c, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  }

  /** 두께 r 의 선분 (끝이 둥근 캡슐) — 다리, 꼬리, 무기 등 */
  capsule(x0: number, y0: number, x1: number, y1: number, r: number, c: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-6;
    this.fillWhere(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, c, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      const ex = x0 + dx * t - x;
      const ey = y0 + dy * t - y;
      return ex * ex + ey * ey <= r * r;
    });
  }

  /** 다각형 (짝홀 규칙) */
  poly(pts: readonly Pt[], c: number): void {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.fillWhere(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), c, (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  /**
   * 렌즈(양끝이 가는 칼날) 모양 선분 — 베기 궤적·섬광용.
   * T: 중앙 반두께, cols: [중심, 중간, 가장자리] 색, reveal: 0~1 (시작점부터 그려지는 비율)
   */
  lens(x0: number, y0: number, x1: number, y1: number, T: number, cols: readonly [number, number, number], reveal = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-6;
    const len = Math.sqrt(len2);
    const xa = Math.max(0, Math.floor(Math.min(x0, x1) - T));
    const xb = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + T));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1) - T));
    const yb = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + T));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5 - x0;
        const py = y + 0.5 - y0;
        const u = (px * dx + py * dy) / len2;
        if (u < 0 || u > reveal) continue;
        const t = T * Math.pow(Math.sin(Math.PI * u), 0.6);
        const d = Math.abs(px * dy - py * dx) / len;
        if (t <= 0 || d > t) continue;
        const k = d / t;
        this.px[y * this.w + x] = k < 0.4 ? cols[0] : k < 0.75 ? cols[1] : cols[2];
      }
    }
  }

  /** 다른 픽셀 버퍼의 불투명 픽셀을 (ox, oy) 에 덮어 찍는다 */
  stamp(src: PixelCanvas, ox = 0, oy = 0): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x];
        if (c) this.set(ox + x, oy + y, c);
      }
    }
  }

  /** 체크무늬로 절반을 지워 페이드아웃 느낌을 낸다 */
  ditherOut(phase = 0): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if ((x + y + phase) % 2) this.px[y * this.w + x] = 0;
  }

  /**
   * 광원(좌상단) 기반 자동 음영.
   * ramps: 기본색 → [하이라이트, 그림자]. 위/왼쪽이 비어 있으면 하이라이트, 아래/오른쪽이 비어 있으면 그림자.
   */
  autoShade(ramps: ReadonlyMap<number, readonly [hi: number, lo: number]>): void {
    const src = this.px.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ramp = ramps.get(src[y * this.w + x]);
        if (!ramp) continue;
        if (at(x, y - 1) === 0 || (at(x - 1, y) === 0 && at(x, y - 2) === 0)) this.px[y * this.w + x] = ramp[0];
        else if (at(x, y + 1) === 0 || at(x + 1, y) === 0 || at(x, y + 2) === 0) this.px[y * this.w + x] = ramp[1];
      }
    }
  }

  /** 셀아웃(selective outline): 빈 픽셀 중 4방향 이웃이 채워진 곳에 이웃 색에 맞는 외곽선 색을 칠한다 */
  outline(pick: (neighbor: number) => number): void {
    const src = this.px.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== 0) continue;
        const n = at(x, y - 1) || at(x - 1, y) || at(x + 1, y) || at(x, y + 1);
        if (n) this.px[y * this.w + x] = pick(n);
      }
    }
  }

  /** 다른 캔버스 2D 컨텍스트의 (ox, oy) 위치에 팔레트로 합성한다 (투명 픽셀은 아래를 보존) */
  blit(ctx: CanvasRenderingContext2D, ox: number, oy: number, palette: Palette): void {
    const tmp = document.createElement('canvas');
    tmp.width = this.w;
    tmp.height = this.h;
    tmp.getContext('2d')!.putImageData(this.toImageData(palette), 0, 0);
    ctx.drawImage(tmp, ox, oy);
  }

  toImageData(palette: Palette): ImageData {
    const img = new ImageData(this.w, this.h);
    const rgb = palette.map(hexToRgb);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (c === 0) continue;
      const [r, g, b] = rgb[c];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    return img;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 시트 최대 폭 — 저사양/모바일 GPU 의 최대 텍스처 크기(4096) 안에 들도록 줄바꿈 */
export const MAX_SHEET_W = 4096;

/** i 번째 프레임의 시트 내 위치 (makeSheet 와 같은 배치) */
export function framePos(i: number, fw: number, fh: number, n: number): [x: number, y: number] {
  const cols = Math.max(1, Math.min(n, Math.floor(MAX_SHEET_W / fw)));
  return [(i % cols) * fw, Math.floor(i / cols) * fh];
}

/** 프레임들을 격자로 이어 붙인 스프라이트 시트 캔버스 생성 */
export function makeSheet(frames: readonly PixelCanvas[], palette: Palette): HTMLCanvasElement {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const n = frames.length;
  const cols = Math.max(1, Math.min(n, Math.floor(MAX_SHEET_W / fw)));
  const canvas = document.createElement('canvas');
  canvas.width = fw * cols;
  canvas.height = fh * Math.ceil(n / cols);
  const ctx = canvas.getContext('2d')!;
  frames.forEach((f, i) => {
    const [x, y] = framePos(i, fw, fh, n);
    ctx.putImageData(f.toImageData(palette), x, y);
  });
  return canvas;
}
