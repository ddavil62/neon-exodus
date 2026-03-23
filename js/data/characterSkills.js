/**
 * @fileoverview 캐릭터 레벨 & 스킬 시스템 데이터 정의.
 * 6 캐릭터 x 4 스킬(Q/W/E/R), 레벨업 경험치 테이블, 유틸리티 함수를 포함한다.
 * Q/W/E는 영구 패시브, R은 액티브 궁극기이다.
 */

// ── 레벨 시스템 상수 ──

/**
 * 캐릭터 레벨업에 필요한 데이터코어(XP) 테이블.
 * 인덱스 0 = Lv.1 (기본, 해금 시 자동). 인덱스 1~17 = 다음 레벨까지 필요 DC.
 * 누적: 0, 3, 6, 10, 14, 19, 24, 30, 36, 43, 51, 59, 68, 78, 89, 101, 114, 128
 * @type {number[]}
 */
export const CHAR_LEVEL_XP = [
  0,    // Lv.1 (기본, 해금 시 자동)
  3, 3, 4, 4, 5, 5, 6, 6, 7,  // Lv.1->2 ~ Lv.9->10
  8, 8, 9, 10, 11, 12, 13, 14  // Lv.10->11 ~ Lv.17->18
];

/** 캐릭터 최대 레벨 */
export const MAX_CHAR_LEVEL = 18;

/** R 스킬 투자 가능 캐릭터 레벨 게이트 (Lv.6, 11, 16에서 R Lv.1, 2, 3 투자 가능) */
export const ULT_LEVEL_GATES = [6, 11, 16];

// ── 캐릭터 컬러 맵 (HUD 표시용) ──

/** @type {Object.<string, number>} 캐릭터 ID -> 대표 색상 */
export const CHARACTER_COLORS = {
  agent:     0x00FFFF,   // 시안
  sniper:    0xFF6600,   // 오렌지
  engineer:  0x39FF14,   // 그린
  berserker: 0xFF3333,   // 레드
  medic:     0xFFDD00,   // 옐로우
  hidden:    0xFF00FF,   // 마젠타
};

// ── 캐릭터별 스킬 정의 ──

/**
 * 6 캐릭터의 Q/W/E/R 스킬 데이터.
 * Q/W/E: 영구 패시브 (최대 Lv.5), R: 액티브 궁극기 (최대 Lv.3, 게이트 제한)
 * @type {Object}
 */
export const CHARACTER_SKILLS = {
  agent: {
    Q: {
      id: 'agent_q', nameKey: 'skill.agent.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.agent.q.lv1', effect: { atkSpeed: 0.08 } },
        { descKey: 'skill.agent.q.lv2', effect: { atkSpeed: 0.16 } },
        { descKey: 'skill.agent.q.lv3', effect: { atkSpeed: 0.24 } },
        { descKey: 'skill.agent.q.lv4', effect: { atkSpeed: 0.32 } },
        { descKey: 'skill.agent.q.lv5', effect: { atkSpeed: 0.40 } },
      ],
    },
    W: {
      id: 'agent_w', nameKey: 'skill.agent.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.agent.w.lv1', effect: { maxHpMult: 0.10 } },
        { descKey: 'skill.agent.w.lv2', effect: { maxHpMult: 0.20 } },
        { descKey: 'skill.agent.w.lv3', effect: { maxHpMult: 0.30 } },
        { descKey: 'skill.agent.w.lv4', effect: { maxHpMult: 0.40 } },
        { descKey: 'skill.agent.w.lv5', effect: { maxHpMult: 0.50 } },
      ],
    },
    E: {
      id: 'agent_e', nameKey: 'skill.agent.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.agent.e.lv1', effect: { xpMult: 0.10 } },
        { descKey: 'skill.agent.e.lv2', effect: { xpMult: 0.20 } },
        { descKey: 'skill.agent.e.lv3', effect: { xpMult: 0.30 } },
        { descKey: 'skill.agent.e.lv4', effect: { xpMult: 0.40 } },
        { descKey: 'skill.agent.e.lv5', effect: { xpMult: 0.50 } },
      ],
    },
    R: {
      id: 'agent_r', nameKey: 'skill.agent.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.agent.r.lv1', effect: { tacticalBomb: { cd: 60, mult: 2.0, stunDur: 1 } } },
        { descKey: 'skill.agent.r.lv2', effect: { tacticalBomb: { cd: 50, mult: 3.0, stunDur: 2 } } },
        { descKey: 'skill.agent.r.lv3', effect: { tacticalBomb: { cd: 40, mult: 4.0, stunDur: 3, slowDur: 3 } } },
      ],
    },
  },
  sniper: {
    Q: {
      id: 'sniper_q', nameKey: 'skill.sniper.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.sniper.q.lv1', effect: { critChance: 0.06 } },
        { descKey: 'skill.sniper.q.lv2', effect: { critChance: 0.12 } },
        { descKey: 'skill.sniper.q.lv3', effect: { critChance: 0.18 } },
        { descKey: 'skill.sniper.q.lv4', effect: { critChance: 0.24 } },
        { descKey: 'skill.sniper.q.lv5', effect: { critChance: 0.30 } },
      ],
    },
    W: {
      id: 'sniper_w', nameKey: 'skill.sniper.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.sniper.w.lv1', effect: { critPierce: 1 } },
        { descKey: 'skill.sniper.w.lv2', effect: { critPierce: 2 } },
        { descKey: 'skill.sniper.w.lv3', effect: { critPierce: 2, noPierceDecay: true } },
        { descKey: 'skill.sniper.w.lv4', effect: { critPierce: 3, noPierceDecay: true } },
        { descKey: 'skill.sniper.w.lv5', effect: { critPierce: 3, noPierceDecay: true, critDmgBonus: 0.30 } },
      ],
    },
    E: {
      id: 'sniper_e', nameKey: 'skill.sniper.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.sniper.e.lv1', effect: { dodgeChance: 0.08 } },
        { descKey: 'skill.sniper.e.lv2', effect: { dodgeChance: 0.12 } },
        { descKey: 'skill.sniper.e.lv3', effect: { dodgeChance: 0.16 } },
        { descKey: 'skill.sniper.e.lv4', effect: { dodgeChance: 0.20 } },
        { descKey: 'skill.sniper.e.lv5', effect: { dodgeChance: 0.20, dodgeStealth: 2 } },
      ],
    },
    R: {
      id: 'sniper_r', nameKey: 'skill.sniper.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.sniper.r.lv1', effect: { deathShot: { cd: 60, dur: 5, critMult: 2.0 } } },
        { descKey: 'skill.sniper.r.lv2', effect: { deathShot: { cd: 50, dur: 6, critMult: 2.5, pierce: true } } },
        { descKey: 'skill.sniper.r.lv3', effect: { deathShot: { cd: 45, dur: 8, critMult: 3.0, pierce: true, killExplode: true } } },
      ],
    },
  },
  engineer: {
    Q: {
      id: 'engineer_q', nameKey: 'skill.engineer.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.engineer.q.lv1', effect: { droneDmg: 0.15 } },
        { descKey: 'skill.engineer.q.lv2', effect: { droneDmg: 0.30 } },
        { descKey: 'skill.engineer.q.lv3', effect: { droneDmg: 0.45 } },
        { descKey: 'skill.engineer.q.lv4', effect: { droneDmg: 0.60 } },
        { descKey: 'skill.engineer.q.lv5', effect: { droneDmg: 0.80 } },
      ],
    },
    W: {
      id: 'engineer_w', nameKey: 'skill.engineer.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.engineer.w.lv1', effect: { autoHeal: { interval: 10, percent: 0.03 } } },
        { descKey: 'skill.engineer.w.lv2', effect: { autoHeal: { interval: 8, percent: 0.03 } } },
        { descKey: 'skill.engineer.w.lv3', effect: { autoHeal: { interval: 6, percent: 0.03 } } },
        { descKey: 'skill.engineer.w.lv4', effect: { autoHeal: { interval: 5, percent: 0.03 } } },
        { descKey: 'skill.engineer.w.lv5', effect: { autoHeal: { interval: 4, percent: 0.04 } } },
      ],
    },
    E: {
      id: 'engineer_e', nameKey: 'skill.engineer.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.engineer.e.lv1', effect: { turret: { count: 1, redeployCD: 120, atkMult: 1.0 } } },
        { descKey: 'skill.engineer.e.lv2', effect: { turret: { count: 1, redeployCD: 120, atkMult: 1.30 } } },
        { descKey: 'skill.engineer.e.lv3', effect: { turret: { count: 1, redeployCD: 90, atkMult: 1.30 } } },
        { descKey: 'skill.engineer.e.lv4', effect: { turret: { count: 2, redeployCD: 90, atkMult: 1.30 } } },
        { descKey: 'skill.engineer.e.lv5', effect: { turret: { count: 2, redeployCD: 60, atkMult: 1.30, pierce: true } } },
      ],
    },
    R: {
      id: 'engineer_r', nameKey: 'skill.engineer.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.engineer.r.lv1', effect: { overdrive: { cd: 75, dur: 8, atkMult: 2, spdMult: 2 } } },
        { descKey: 'skill.engineer.r.lv2', effect: { overdrive: { cd: 60, dur: 10, atkMult: 2.5, spdMult: 2.5, tempDrone: 1 } } },
        { descKey: 'skill.engineer.r.lv3', effect: { overdrive: { cd: 50, dur: 12, atkMult: 3, spdMult: 3, tempDrone: 2, empStun: 2 } } },
      ],
    },
  },
  berserker: {
    Q: {
      id: 'berserker_q', nameKey: 'skill.berserker.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.berserker.q.lv1', effect: { lowHpAtk: 0.20, hpThreshold: 0.50 } },
        { descKey: 'skill.berserker.q.lv2', effect: { lowHpAtk: 0.30, hpThreshold: 0.50 } },
        { descKey: 'skill.berserker.q.lv3', effect: { lowHpAtk: 0.40, hpThreshold: 0.50 } },
        { descKey: 'skill.berserker.q.lv4', effect: { lowHpAtk: 0.40, hpThreshold: 0.60 } },
        { descKey: 'skill.berserker.q.lv5', effect: { lowHpAtk: 0.50, hpThreshold: 0.60, spdBonus: 0.10 } },
      ],
    },
    W: {
      id: 'berserker_w', nameKey: 'skill.berserker.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.berserker.w.lv1', effect: { lifeSteal: { chance: 0.01, heal: 3 } } },
        { descKey: 'skill.berserker.w.lv2', effect: { lifeSteal: { chance: 0.02, heal: 3 } } },
        { descKey: 'skill.berserker.w.lv3', effect: { lifeSteal: { chance: 0.03, heal: 5 } } },
        { descKey: 'skill.berserker.w.lv4', effect: { lifeSteal: { chance: 0.04, heal: 5 } } },
        { descKey: 'skill.berserker.w.lv5', effect: { lifeSteal: { chance: 0.05, heal: 8 } } },
      ],
    },
    E: {
      id: 'berserker_e', nameKey: 'skill.berserker.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.berserker.e.lv1', effect: { moveSpeed: 0.10 } },
        { descKey: 'skill.berserker.e.lv2', effect: { moveSpeed: 0.15 } },
        { descKey: 'skill.berserker.e.lv3', effect: { moveSpeed: 0.20 } },
        { descKey: 'skill.berserker.e.lv4', effect: { moveSpeed: 0.25 } },
        { descKey: 'skill.berserker.e.lv5', effect: { moveSpeed: 0.30, contactDmg: 0.50 } },
      ],
    },
    R: {
      id: 'berserker_r', nameKey: 'skill.berserker.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.berserker.r.lv1', effect: { berserkRage: { cd: 90, dur: 4, atkMult: 2, invincible: true, contactDmg: true } } },
        { descKey: 'skill.berserker.r.lv2', effect: { berserkRage: { cd: 75, dur: 6, atkMult: 3, invincible: true, contactDmg: true, spdBonus: 0.30 } } },
        { descKey: 'skill.berserker.r.lv3', effect: { berserkRage: { cd: 60, dur: 8, atkMult: 4, invincible: true, contactDmg: true, spdBonus: 0.50, endExplosion: true } } },
      ],
    },
  },
  medic: {
    Q: {
      id: 'medic_q', nameKey: 'skill.medic.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.medic.q.lv1', effect: { regenMult: 1.5, maxHpPenalty: 0.30 } },
        { descKey: 'skill.medic.q.lv2', effect: { regenMult: 2.0, maxHpPenalty: 0.30 } },
        { descKey: 'skill.medic.q.lv3', effect: { regenMult: 2.5, maxHpPenalty: 0.30 } },
        { descKey: 'skill.medic.q.lv4', effect: { regenMult: 3.0, maxHpPenalty: 0.30 } },
        { descKey: 'skill.medic.q.lv5', effect: { regenMult: 3.5, maxHpPenalty: 0 } },
      ],
    },
    W: {
      id: 'medic_w', nameKey: 'skill.medic.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.medic.w.lv1', effect: { healAura: { interval: 8, heal: 3, radius: 60 } } },
        { descKey: 'skill.medic.w.lv2', effect: { healAura: { interval: 8, heal: 5, radius: 60 } } },
        { descKey: 'skill.medic.w.lv3', effect: { healAura: { interval: 6, heal: 5, radius: 60 } } },
        { descKey: 'skill.medic.w.lv4', effect: { healAura: { interval: 6, heal: 8, radius: 60 } } },
        { descKey: 'skill.medic.w.lv5', effect: { healAura: { interval: 5, heal: 10, radius: 60, slow: true } } },
      ],
    },
    E: {
      id: 'medic_e', nameKey: 'skill.medic.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.medic.e.lv1', effect: { poison: { dur: 3, dps: 0.20 } } },
        { descKey: 'skill.medic.e.lv2', effect: { poison: { dur: 3, dps: 0.30 } } },
        { descKey: 'skill.medic.e.lv3', effect: { poison: { dur: 4, dps: 0.30 } } },
        { descKey: 'skill.medic.e.lv4', effect: { poison: { dur: 4, dps: 0.40 } } },
        { descKey: 'skill.medic.e.lv5', effect: { poison: { dur: 5, dps: 0.40, slow: 0.20 } } },
      ],
    },
    R: {
      id: 'medic_r', nameKey: 'skill.medic.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.medic.r.lv1', effect: { lifeWave: { cd: 90, healPercent: 0.50, dmgReduce: 0.30, dur: 5 } } },
        { descKey: 'skill.medic.r.lv2', effect: { lifeWave: { cd: 75, healPercent: 0.75, dmgReduce: 0.40, dur: 6, cleanse: true } } },
        { descKey: 'skill.medic.r.lv3', effect: { lifeWave: { cd: 60, healPercent: 1.0, dmgReduce: 0.50, dur: 8, cleanse: true, invincible: 3, knockback: true } } },
      ],
    },
  },
  hidden: {
    Q: {
      id: 'hidden_q', nameKey: 'skill.hidden.q.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.hidden.q.lv1', effect: { weaponDmg: 0.08 } },
        { descKey: 'skill.hidden.q.lv2', effect: { weaponDmg: 0.16 } },
        { descKey: 'skill.hidden.q.lv3', effect: { weaponDmg: 0.24 } },
        { descKey: 'skill.hidden.q.lv4', effect: { weaponDmg: 0.32 } },
        { descKey: 'skill.hidden.q.lv5', effect: { weaponDmg: 0.40 } },
      ],
    },
    W: {
      id: 'hidden_w', nameKey: 'skill.hidden.w.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.hidden.w.lv1', effect: { evoBonus: { passiveLevelReduce: 1 } } },
        { descKey: 'skill.hidden.w.lv2', effect: { evoBonus: { weaponLevelReduce: 1 } } },
        { descKey: 'skill.hidden.w.lv3', effect: { evoBonus: { weaponLevelReduce: 1, evoAtkBonus: 0.10 } } },
        { descKey: 'skill.hidden.w.lv4', effect: { evoBonus: { weaponLevelReduce: 2, evoAtkBonus: 0.10 } } },
        { descKey: 'skill.hidden.w.lv5', effect: { evoBonus: { weaponLevelReduce: 2, evoAtkBonus: 0.25 } } },
      ],
    },
    E: {
      id: 'hidden_e', nameKey: 'skill.hidden.e.name', maxLevel: 5,
      levels: [
        { descKey: 'skill.hidden.e.lv1', effect: { dropRate: 0.10 } },
        { descKey: 'skill.hidden.e.lv2', effect: { dropRate: 0.20 } },
        { descKey: 'skill.hidden.e.lv3', effect: { dropRate: 0.20, extraChoices: 1 } },
        { descKey: 'skill.hidden.e.lv4', effect: { dropRate: 0.30, extraChoices: 1 } },
        { descKey: 'skill.hidden.e.lv5', effect: { dropRate: 0.30, extraChoices: 1, rareDropMult: 2.0 } },
      ],
    },
    R: {
      id: 'hidden_r', nameKey: 'skill.hidden.r.name', maxLevel: 3, isUltimate: true,
      levels: [
        { descKey: 'skill.hidden.r.lv1', effect: { omegaProtocol: { cd: 90, dur: 8, atkMult: 1.5 } } },
        { descKey: 'skill.hidden.r.lv2', effect: { omegaProtocol: { cd: 75, dur: 10, atkMult: 2.0, fireRateMult: 1.5 } } },
        { descKey: 'skill.hidden.r.lv3', effect: { omegaProtocol: { cd: 60, dur: 12, atkMult: 2.5, fireRateMult: 2.0, bulletSize: 1.5 } } },
      ],
    },
  },
};

// ── 유틸리티 함수 ──

/**
 * 레벨 N까지 필요한 총 XP (데이터코어)를 반환한다.
 * @param {number} level - 대상 레벨
 * @returns {number} 누적 필요 XP
 */
export function getTotalXpForLevel(level) {
  let sum = 0;
  for (let i = 1; i < level && i < CHAR_LEVEL_XP.length; i++) {
    sum += CHAR_LEVEL_XP[i];
  }
  return sum;
}

/**
 * 현재 레벨에서 다음 레벨까지 필요한 XP를 반환한다.
 * 만렙이면 0을 반환한다.
 * @param {number} level - 현재 레벨
 * @returns {number} 다음 레벨 필요 XP
 */
export function getXpForNextLevel(level) {
  return level < MAX_CHAR_LEVEL ? CHAR_LEVEL_XP[level] : 0;
}

/**
 * R 스킬(궁극기) 투자 가능 여부를 확인한다.
 * @param {number} charLevel - 캐릭터 현재 레벨
 * @param {number} currentRLevel - R 스킬 현재 레벨 (0~2)
 * @returns {boolean} 투자 가능 여부
 */
export function canInvestUlt(charLevel, currentRLevel) {
  const gateIndex = currentRLevel; // 0->gate[0]=6, 1->gate[1]=11, 2->gate[2]=16
  return gateIndex < ULT_LEVEL_GATES.length && charLevel >= ULT_LEVEL_GATES[gateIndex];
}
