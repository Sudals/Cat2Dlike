/** 내부 렌더 해상도: 720p=2x, 1080p=3x, 1440p=4x, 4K=6x 정수 배율 */
export const VIEW_W = 640;
export const VIEW_H = 360;
export const TILE = 16;

/** 렌더 순서. dim(암전)은 배경만 어둡게 하고 캐릭터·이펙트는 그 위에 남긴다 */
export const DEPTH = {
  sky: 0, bgFar: 1, rain: 2, bgNear: 3, ground: 6, splash: 7,
  dim: 20, enemy: 30, hero: 40, fx: 50, fxTop: 55, number: 80, flash: 90, hud: 100, cutin: 110,
} as const;

/** 전투 수치 (기획서 수치 × 10 스케일 — 큰 숫자가 주는 손맛) */
export const COMBAT = {
  atk: 120,
  critChance: 0.15,
  critMul: 1.6,
  dummyHp: 4000,
} as const;

/** 플레이어 이동 튜닝 (px, 초 단위) — M1 에서 데이터 테이블로 이전 예정 */
export const MOVE = {
  gravity: 1500,
  /** 기본 이동 속도 (달리기 없음) */
  runSpeed: 160,
  /** 관성: 출발 가속 / 손 뗐을 때 감속(미끄러짐) / 반대 방향 전환 브레이크 */
  accelGround: 1150,
  decelGround: 820,
  turnGround: 2300,
  accelAir: 900,
  decelAir: 260,
  jumpVelocity: 500,
  doubleJumpVelocity: 430,
  jumpCutMultiplier: 0.45, // 점프 키를 일찍 떼면 상승 속도 감쇠 (가변 점프)
  coyoteTime: 0.1,
  jumpBuffer: 0.1,
  dashSpeed: 420,
  dashTime: 0.16,
  dashCooldown: 0.5,
  maxFall: 520,
} as const;
