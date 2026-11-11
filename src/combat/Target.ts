import type Phaser from 'phaser';

export type StatusKind = 'burn' | 'shock' | 'chill';

/** Combat 이 때릴 수 있는 모든 것 (허수아비, 적) */
export interface HitTarget {
  readonly alive: boolean;
  /** 죽음 연출까지 끝나서 목록에서 빼도 되는지 */
  readonly gone: boolean;
  readonly x: number;
  readonly cy: number;
  readonly top: number;
  readonly bottom: number;
  burnTick: number;
  bounds(): Phaser.Geom.Rectangle;
  /** power: 타격 세기, launch: 띄우기 초속(px/s, 0 = 없음) */
  hit(dmg: number, dir: number, power: number, launch?: number): void;
  applyStatus(kind: StatusKind, ms?: number): void;
  has(kind: StatusKind): boolean;
  update(dt: number): void;
}
