import type Phaser from 'phaser';
import type { Combat } from '../combat/Combat';

export type HeroKey = 'blade' | 'mage';
export type SkillSlot = 'skill1' | 'skill2' | 'skill3' | 'ult';

/** 스킬이 플레이어/씬에 요청할 수 있는 것들 (씬이 구현) */
export interface SkillHost {
  readonly scene: Phaser.Scene;
  readonly hero: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  readonly combat: Combat;
  readonly groundY: number;
  readonly worldW: number;
  /** 바라보는 방향 1 / -1 */
  dir(): number;
  /** ms 동안 조작·중력 잠금 + 무적 (스킬이 직접 위치/프레임을 제어) */
  lock(ms: number): void;
  afterimage(x?: number, y?: number, tint?: number): void;
  /** 머리 위 스킬명 */
  callout(text: string, color: string): void;
  /** 궁극기 컷인 배너 */
  cutIn(text: string, color: number): void;
  /** 화면 집중선 */
  speedlines(ms: number, tint?: number): void;
  /** 배경 암전 (0 = 해제) */
  dim(alpha: number, ms: number): void;
}

export interface SkillDef {
  id: string;
  name: string;
  slot: SkillSlot;
  /** 초. 궁극기는 쿨 대신 게이지 100 소모 */
  cooldown: number;
  icon: string;
  desc: string;
  cast(h: SkillHost): void;
}
