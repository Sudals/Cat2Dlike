/**
 * 증강 (5웨이브마다 3개 중 1개 선택)
 * 새 증강 추가 = AUGMENTS 배열에 한 줄 추가. icon 은 src/art/items.ts 의 증강 아이콘 프레임 이름.
 * unique: true 면 한 번만 얻을 수 있음 (나머지는 중첩 가능)
 */
import type { PlayerStats } from './stats';

export type Rarity = 'silver' | 'gold' | 'prism';

export interface AugmentDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  unique?: boolean;
  apply(s: PlayerStats): void;
}

export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string; weight: number }> = {
  silver: { label: '실버', color: 0xc8d0e0, css: '#d8e0ee', weight: 62 },
  gold: { label: '골드', color: 0xffc94a, css: '#ffd36e', weight: 30 },
  prism: { label: '프리즘', color: 0xd88aff, css: '#efb8ff', weight: 8 },
};

export const AUGMENTS: readonly AugmentDef[] = [
  // --- 실버 ---
  { id: 'claw', name: '날카로운 발톱', desc: '공격력 +15%', rarity: 'silver', icon: 'aug_claw', apply: (s) => void (s.atkMul *= 1.15) },
  { id: 'fur', name: '두툼한 털', desc: '최대 체력 +25%', rarity: 'silver', icon: 'aug_heart', apply: (s) => void (s.maxHpMul += 0.25) },
  { id: 'paws', name: '가벼운 발바닥', desc: '이동속도 +15%\n대시 쿨타임 -30%', rarity: 'silver', icon: 'aug_boot', apply: (s) => void ((s.moveMul *= 1.15), (s.dashCdMul *= 0.7)) },
  { id: 'focus', name: '냥냥 집중', desc: '스킬 쿨타임 -15%', rarity: 'silver', icon: 'aug_clock', apply: (s) => void (s.cdMul *= 0.85) },
  { id: 'eye', name: '사냥꾼의 눈빛', desc: '치명타 확률 +12%', rarity: 'silver', icon: 'aug_eye', apply: (s) => void (s.critChance += 0.12) },
  { id: 'groom', name: '그루밍', desc: '매초 최대 체력의\n1% 회복', rarity: 'silver', icon: 'aug_leaf', apply: (s) => void (s.regen += 0.01) },
  { id: 'combo', name: '연타의 달인', desc: '기본 공격 피해 +35%', rarity: 'silver', icon: 'aug_sword', apply: (s) => void (s.basicMul *= 1.35) },

  // --- 골드 ---
  { id: 'vampire', name: '피의 사냥꾼', desc: '입힌 피해의 3%만큼\n체력 회복', rarity: 'gold', icon: 'aug_fang', apply: (s) => void (s.lifesteal += 0.03) },
  { id: 'moon', name: '달빛 충전', desc: '궁극기 게이지\n충전 속도 +60%', rarity: 'gold', icon: 'aug_moon', apply: (s) => void (s.ultGain *= 1.6) },
  { id: 'wings', name: '고양이 균형감각', desc: '공중 점프 +1회', rarity: 'gold', icon: 'aug_wing', apply: (s) => void (s.extraJumps += 1) },
  { id: 'bomb', name: '연쇄 폭발', desc: '적 처치 시 폭발\n(공격력 80% 범위 피해)', rarity: 'gold', icon: 'aug_bomb', apply: (s) => void (s.killBlast += 0.8) },
  { id: 'thorn', name: '가시 털', desc: '받는 피해 -20%\n받은 피해 50% 반사', rarity: 'gold', icon: 'aug_shield', apply: (s) => void ((s.dmgTakenMul *= 0.8), (s.thorns += 0.5)) },
  { id: 'bell', name: '행운의 방울', desc: '아이템 등장 빈도와\n효과 +60%', rarity: 'gold', icon: 'aug_bell', apply: (s) => void (s.itemLuck *= 1.6) },
  { id: 'fishbone', name: '생선뼈 목걸이', desc: '치명타 피해 +50%', rarity: 'gold', icon: 'aug_fish', apply: (s) => void (s.critMul += 0.5) },

  // --- 프리즘 ---
  { id: 'revive', name: '구사일생', desc: '쓰러질 때 한 번\n체력 50%로 부활', rarity: 'prism', icon: 'aug_star', apply: (s) => void (s.revives += 1) },
  { id: 'frenzy', name: '냥력 폭주', desc: '스킬 사용 시 30% 확률로\n쿨타임 즉시 초기화', rarity: 'prism', icon: 'aug_clock', unique: true, apply: (s) => void (s.skillReset += 0.3) },
  { id: 'thunder', name: '천둥 발톱', desc: '기본 공격 적중 시\n25% 확률 낙뢰 (120%)', rarity: 'prism', icon: 'aug_bolt', unique: true, apply: (s) => void (s.thunderClaw += 0.25) },
  { id: 'pact', name: '아홉 꼬리의 계약', desc: '모든 피해 +40%\n받는 피해 +25%', rarity: 'prism', icon: 'aug_star', unique: true, apply: (s) => void ((s.atkMul *= 1.4), (s.dmgTakenMul *= 1.25)) },
];

function rollRarity(): Rarity {
  const total = Object.values(RARITY_INFO).reduce((a, r) => a + r.weight, 0);
  let n = Math.random() * total;
  for (const [k, r] of Object.entries(RARITY_INFO) as [Rarity, (typeof RARITY_INFO)[Rarity]][]) {
    n -= r.weight;
    if (n <= 0) return k;
  }
  return 'silver';
}

/** 서로 다른 증강 n개 뽑기 (이미 얻은 unique 증강 제외, 등급은 확률로) */
export function rollAugments(n: number, taken: ReadonlySet<string>): AugmentDef[] {
  const out: AugmentDef[] = [];
  const available = (a: AugmentDef) => !out.includes(a) && !(a.unique && taken.has(a.id));
  for (let i = 0; i < n; i++) {
    const want = rollRarity();
    let pool = AUGMENTS.filter((a) => a.rarity === want && available(a));
    if (!pool.length) pool = AUGMENTS.filter(available);
    if (!pool.length) break;
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}
