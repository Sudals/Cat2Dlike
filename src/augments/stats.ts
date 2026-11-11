/**
 * 플레이어 능력치 — 증강·아이템이 바꾸는 값은 모두 여기에 모은다.
 * 전투(Combat)와 샌드박스(이동·쿨타임·피격)가 같은 객체를 참조한다.
 */
export interface PlayerStats {
  /** 모든 피해 배율 */
  atkMul: number;
  /** 기본 공격 피해 배율 */
  basicMul: number;
  /** 치명타 확률 (0~1) */
  critChance: number;
  /** 치명타 피해 배율 */
  critMul: number;
  /** 스킬 쿨타임 배율 (낮을수록 빠름) */
  cdMul: number;
  maxHpMul: number;
  moveMul: number;
  dashCdMul: number;
  /** 초당 최대 체력 대비 회복 비율 */
  regen: number;
  /** 입힌 피해 대비 회복 비율 */
  lifesteal: number;
  /** 궁극기 게이지 충전 배율 */
  ultGain: number;
  /** 추가 공중 점프 */
  extraJumps: number;
  /** 처치 시 폭발 (공격력 배율, 0 = 없음) */
  killBlast: number;
  /** 받는 피해 배율 */
  dmgTakenMul: number;
  /** 받은 피해 반사 비율 */
  thorns: number;
  /** 아이템 등장 빈도·효과 배율 */
  itemLuck: number;
  /** 남은 부활 횟수 (구사일생) */
  revives: number;
  /** 스킬 사용 시 쿨타임 즉시 초기화 확률 */
  skillReset: number;
  /** 기본 공격 적중 시 낙뢰 확률 */
  thunderClaw: number;
}

export function baseStats(): PlayerStats {
  return {
    atkMul: 1,
    basicMul: 1,
    critChance: 0.15,
    critMul: 1.6,
    cdMul: 1,
    maxHpMul: 1,
    moveMul: 1,
    dashCdMul: 1,
    regen: 0,
    lifesteal: 0,
    ultGain: 1,
    extraJumps: 0,
    killBlast: 0,
    dmgTakenMul: 1,
    thorns: 0,
    itemLuck: 1,
    revives: 0,
    skillReset: 0,
    thunderClaw: 0,
  };
}
