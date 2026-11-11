import type { Enemy, EnemyWorld } from './Enemy';
import { Hound, Pigeon, Rat, RatThug } from './chapter1';

export type EnemyKind = 'rat' | 'thug' | 'pigeon' | 'hound';

/** 1장 웨이브 구성 (9개 반복). 4웨이브마다 종류별 +1, 10의 배수 웨이브는 보스 */
const WAVES: Partial<Record<EnemyKind, number>>[] = [
  { rat: 4 },
  { rat: 3, thug: 1 },
  { pigeon: 2, rat: 3 },
  { thug: 2, pigeon: 1, rat: 2 },
  { hound: 1, rat: 3, pigeon: 1 },
  { thug: 3, pigeon: 2, rat: 2 },
  { hound: 1, thug: 2, pigeon: 2 },
  { rat: 6, thug: 2 },
  { hound: 2, pigeon: 2, rat: 2 },
];

/** wave: 1부터 시작하는 웨이브 번호 */
export function waveAt(wave: number): [EnemyKind, number][] {
  const n = wave - 1;
  const extra = Math.floor(n / 4);
  return (Object.entries(WAVES[n % WAVES.length]) as [EnemyKind, number][]).map(([k, v]) => [k, v + extra]);
}

export const isBossWave = (wave: number) => wave > 0 && wave % 10 === 0;

/** 엘리트 등장 확률 (3웨이브부터, 최대 35%) */
export const eliteChance = (wave: number) => (wave < 3 ? 0 : Math.min(0.35, 0.06 + wave * 0.015));

export function spawnEnemy(kind: EnemyKind, world: EnemyWorld, x: number): Enemy {
  const gy = world.groundY;
  switch (kind) {
    case 'rat':
      return new Rat(world, x, gy);
    case 'thug':
      return new RatThug(world, x, gy);
    case 'pigeon':
      return new Pigeon(world, x, gy - 150);
    case 'hound':
      return new Hound(world, x, gy);
  }
}
