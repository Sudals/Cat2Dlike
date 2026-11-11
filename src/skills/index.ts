import { IAI, RISING, THOUSAND, WHIRL } from './blade';
import { FIREBALL, FROST, MOONFALL, THUNDER } from './mage';
import type { HeroKey, SkillDef, SkillSlot } from './types';

/** 직업별 장착 스킬 (단축키 Z = skill1, X = skill2, C = skill3, V = ult) */
export const SKILLS: Record<HeroKey, Record<SkillSlot, SkillDef>> = {
  blade: { skill1: IAI, skill2: WHIRL, skill3: RISING, ult: THOUSAND },
  mage: { skill1: FIREBALL, skill2: THUNDER, skill3: FROST, ult: MOONFALL },
};

export const SKILL_KEYS: Record<SkillSlot, string> = { skill1: 'Z', skill2: 'X', skill3: 'C', ult: 'V' };

export const HERO_NAMES: Record<HeroKey, string> = { blade: '검객', mage: '마법사' };

export type { HeroKey, SkillDef, SkillHost, SkillSlot } from './types';
