/**
 * @fileoverview 도전과제(업적) 데이터 테이블.
 * 킬, 생존, 클리어, 특수 카테고리로 총 12종+의 도전과제를 정의한다.
 */

/**
 * 전체 도전과제 데이터.
 * @type {Array<{id: string, nameKey: string, descKey: string, category: string, condition: Object, reward: Object}>}
 */
export const ACHIEVEMENTS = [
  // ── 킬 업적 (4종) ──
  {
    id: 'first_kill',
    nameKey: 'achievement.first_kill.name',
    descKey: 'achievement.first_kill.desc',
    category: 'kill',
    condition: {
      type: 'totalKills',
      value: 1,
    },
    reward: {
      type: 'credits',
      amount: 50,
    },
  },
  {
    id: 'slayer',
    nameKey: 'achievement.slayer.name',
    descKey: 'achievement.slayer.desc',
    category: 'kill',
    condition: {
      type: 'totalKills',
      value: 1000,
    },
    reward: {
      type: 'credits',
      amount: 200,
    },
  },
  {
    id: 'machine_breaker',
    nameKey: 'achievement.machine_breaker.name',
    descKey: 'achievement.machine_breaker.desc',
    category: 'kill',
    condition: {
      type: 'totalKills',
      value: 10000,
    },
    reward: {
      type: 'dataCore',
      amount: 1,
    },
  },
  {
    id: 'legendary_warrior',
    nameKey: 'achievement.legendary_warrior.name',
    descKey: 'achievement.legendary_warrior.desc',
    category: 'kill',
    condition: {
      type: 'totalKills',
      value: 100000,
    },
    reward: {
      type: 'dataCoreAndTitle',
      amount: 3,
      title: '전설의 전사',
    },
  },

  // ── 생존 업적 (3종) ──
  {
    id: 'first_survive',
    nameKey: 'achievement.first_survive.name',
    descKey: 'achievement.first_survive.desc',
    category: 'survive',
    condition: {
      type: 'surviveMinutes',
      value: 5,
    },
    reward: {
      type: 'credits',
      amount: 100,
    },
  },
  {
    id: 'tenacious',
    nameKey: 'achievement.tenacious.name',
    descKey: 'achievement.tenacious.desc',
    category: 'survive',
    condition: {
      type: 'lowHpClear',
      hpThreshold: 0.10,
      remainingTimeMax: 60,
    },
    reward: {
      type: 'dataCore',
      amount: 1,
    },
  },
  {
    id: 'invincible',
    nameKey: 'achievement.invincible.name',
    descKey: 'achievement.invincible.desc',
    category: 'survive',
    condition: {
      type: 'noDamageSurvive',
      durationMinutes: 3,
    },
    reward: {
      type: 'dataCore',
      amount: 2,
    },
  },

  // ── 클리어 업적 (3종) ──
  {
    id: 'first_clear',
    nameKey: 'achievement.first_clear.name',
    descKey: 'achievement.first_clear.desc',
    category: 'clear',
    condition: {
      type: 'totalClears',
      value: 1,
    },
    reward: {
      type: 'dataCore',
      amount: 2,
    },
  },
  {
    id: 'five_streak',
    nameKey: 'achievement.five_streak.name',
    descKey: 'achievement.five_streak.desc',
    category: 'clear',
    condition: {
      type: 'consecutiveClears',
      value: 5,
    },
    reward: {
      type: 'dataCore',
      amount: 3,
    },
  },
  {
    id: 'ten_clears',
    nameKey: 'achievement.ten_clears.name',
    descKey: 'achievement.ten_clears.desc',
    category: 'clear',
    condition: {
      type: 'totalClears',
      value: 10,
    },
    reward: {
      type: 'characterHint',
    },
  },

  // ── 특수 업적 (3종) ──
  {
    id: 'overload',
    nameKey: 'achievement.overload.name',
    descKey: 'achievement.overload.desc',
    category: 'special',
    condition: {
      type: 'fillWeaponSlots',
      value: 6,
    },
    reward: {
      type: 'dataCore',
      amount: 1,
    },
  },
  {
    id: 'evolution',
    nameKey: 'achievement.evolution.name',
    descKey: 'achievement.evolution.desc',
    category: 'special',
    condition: {
      type: 'weaponEvolution',
      value: 1,
    },
    reward: {
      type: 'dataCore',
      amount: 2,
    },
  },
  {
    id: 'full_upgrade',
    nameKey: 'achievement.full_upgrade.name',
    descKey: 'achievement.full_upgrade.desc',
    category: 'special',
    condition: {
      type: 'allUpgradesMaxed',
    },
    reward: {
      type: 'hiddenCharacterUnlock',
    },
  },
];

/**
 * ID로 도전과제 데이터를 조회한다.
 * @param {string} id - 도전과제 ID
 * @returns {Object|undefined} 도전과제 데이터
 */
export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * 카테고리별 도전과제 목록을 반환한다.
 * @param {string} category - 'kill' | 'survive' | 'clear' | 'special'
 * @returns {Array} 해당 카테고리의 도전과제 배열
 */
export function getAchievementsByCategory(category) {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
