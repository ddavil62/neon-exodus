/**
 * @fileoverview 영구 업그레이드 데이터 테이블.
 * 4 카테고리(basic, growth, special, limitBreak) 22종의 영구 업그레이드를 정의한다.
 * 크레딧을 소모하여 구매하며, 런 시작 시 효과가 적용된다.
 */

/**
 * 영구 업그레이드 전체 데이터.
 * costFormula: 레벨에 따른 비용 계산 함수 (level은 1-indexed: 구매할 레벨).
 * @type {Array<{id: string, nameKey: string, descKey: string, maxLevel: number, costFormula: function(number): number, stat: string, effectPerLevel: number, category: string, unlockCondition: string|null}>}
 */
export const UPGRADES = [
  // ── 기본 스탯 (8종) ──
  {
    id: 'attack',
    nameKey: 'meta.attack.name',
    descKey: 'meta.attack.desc',
    maxLevel: 10,
    costFormula: (lv) => 100 * lv,
    stat: 'attackMultiplier',
    effectPerLevel: 0.05,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'maxHp',
    nameKey: 'meta.maxHp.name',
    descKey: 'meta.maxHp.desc',
    maxLevel: 10,
    costFormula: (lv) => 100 * lv,
    stat: 'maxHpMultiplier',
    effectPerLevel: 0.10,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'hpRegen',
    nameKey: 'meta.hpRegen.name',
    descKey: 'meta.hpRegen.desc',
    maxLevel: 10,
    costFormula: (lv) => 80 * lv,
    stat: 'hpRegenFlat',
    effectPerLevel: 0.1,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'defense',
    nameKey: 'meta.defense.name',
    descKey: 'meta.defense.desc',
    maxLevel: 10,
    costFormula: (lv) => 120 * lv,
    stat: 'defenseFlat',
    effectPerLevel: 1,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'moveSpeed',
    nameKey: 'meta.moveSpeed.name',
    descKey: 'meta.moveSpeed.desc',
    maxLevel: 10,
    costFormula: (lv) => 80 * lv,
    stat: 'moveSpeedMultiplier',
    effectPerLevel: 0.03,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'cooldown',
    nameKey: 'meta.cooldown.name',
    descKey: 'meta.cooldown.desc',
    maxLevel: 10,
    costFormula: (lv) => 120 * lv,
    stat: 'cooldownReduction',
    effectPerLevel: 0.02,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'projectileSpeed',
    nameKey: 'meta.projectileSpeed.name',
    descKey: 'meta.projectileSpeed.desc',
    maxLevel: 10,
    costFormula: (lv) => 90 * lv,
    stat: 'projectileSpeedMultiplier',
    effectPerLevel: 0.05,
    category: 'basic',
    unlockCondition: null,
  },
  {
    id: 'areaOfEffect',
    nameKey: 'meta.areaOfEffect.name',
    descKey: 'meta.areaOfEffect.desc',
    maxLevel: 10,
    costFormula: (lv) => 110 * lv,
    stat: 'areaMultiplier',
    effectPerLevel: 0.04,
    category: 'basic',
    unlockCondition: null,
  },

  // ── 성장 가속 (6종) ──
  {
    id: 'xpGain',
    nameKey: 'meta.xpGain.name',
    descKey: 'meta.xpGain.desc',
    maxLevel: 10,
    costFormula: (lv) => 120 * lv,
    stat: 'xpGainMultiplier',
    effectPerLevel: 0.05,
    category: 'growth',
    unlockCondition: null,
  },
  {
    id: 'creditGain',
    nameKey: 'meta.creditGain.name',
    descKey: 'meta.creditGain.desc',
    maxLevel: 10,
    costFormula: (lv) => 150 * lv,
    stat: 'creditGainMultiplier',
    effectPerLevel: 0.08,
    category: 'growth',
    unlockCondition: null,
  },
  {
    id: 'xpMagnet',
    nameKey: 'meta.xpMagnet.name',
    descKey: 'meta.xpMagnet.desc',
    maxLevel: 10,
    costFormula: (lv) => 100 * lv,
    stat: 'xpMagnetMultiplier',
    effectPerLevel: 0.05,
    category: 'growth',
    unlockCondition: null,
  },
  {
    id: 'luck',
    nameKey: 'meta.luck.name',
    descKey: 'meta.luck.desc',
    maxLevel: 10,
    costFormula: (lv) => 130 * lv,
    stat: 'luckMultiplier',
    effectPerLevel: 0.03,
    category: 'growth',
    unlockCondition: null,
  },
  {
    id: 'levelupChoices',
    nameKey: 'meta.levelupChoices.name',
    descKey: 'meta.levelupChoices.desc',
    maxLevel: 2,
    costFormula: (lv) => 500 * lv,
    stat: 'levelupChoicesBonus',
    effectPerLevel: 1,
    category: 'growth',
    unlockCondition: null,
  },
  {
    id: 'rerolls',
    nameKey: 'meta.rerolls.name',
    descKey: 'meta.rerolls.desc',
    maxLevel: 3,
    costFormula: (lv) => 400 * lv,
    stat: 'rerollsBonus',
    effectPerLevel: 1,
    category: 'growth',
    unlockCondition: null,
  },

  // ── 특수 (5종) ──
  {
    id: 'revive',
    nameKey: 'meta.revive.name',
    descKey: 'meta.revive.desc',
    maxLevel: 3,
    costFormula: (lv) => 500 * lv,
    stat: 'reviveCount',
    effectPerLevel: 1,
    category: 'special',
    unlockCondition: null,
  },
  {
    id: 'startWeaponLevel',
    nameKey: 'meta.startWeaponLevel.name',
    descKey: 'meta.startWeaponLevel.desc',
    maxLevel: 3,
    costFormula: (lv) => 400 * lv,
    stat: 'startWeaponLevelBonus',
    effectPerLevel: 1,
    category: 'special',
    unlockCondition: null,
  },
  {
    id: 'startPassive',
    nameKey: 'meta.startPassive.name',
    descKey: 'meta.startPassive.desc',
    maxLevel: 2,
    costFormula: (lv) => 600 * lv,
    stat: 'startPassiveCount',
    effectPerLevel: 1,
    category: 'special',
    unlockCondition: null,
  },
  {
    id: 'vanish',
    nameKey: 'meta.vanish.name',
    descKey: 'meta.vanish.desc',
    maxLevel: 5,
    costFormula: (lv) => 200 * lv,
    stat: 'invincibilityBonus',
    effectPerLevel: 0.2,
    category: 'special',
    unlockCondition: null,
  },
  {
    id: 'knockback',
    nameKey: 'meta.knockback.name',
    descKey: 'meta.knockback.desc',
    maxLevel: 5,
    costFormula: (lv) => 150 * lv,
    stat: 'knockbackMultiplier',
    effectPerLevel: 0.10,
    category: 'special',
    unlockCondition: null,
  },

  // ── 한도 돌파 (3종) — 기본 스탯 전부 최대 업그레이드 후 해금 ──
  {
    id: 'weaponSlots',
    nameKey: 'meta.weaponSlots.name',
    descKey: 'meta.weaponSlots.desc',
    maxLevel: 2,
    costFormula: (lv) => 1000 * lv,
    stat: 'weaponSlotsBonus',
    effectPerLevel: 1,
    category: 'limitBreak',
    unlockCondition: 'allBasicMaxed',
  },
  {
    id: 'passiveSlots',
    nameKey: 'meta.passiveSlots.name',
    descKey: 'meta.passiveSlots.desc',
    maxLevel: 2,
    costFormula: (lv) => 1000 * lv,
    stat: 'passiveSlotsBonus',
    effectPerLevel: 1,
    category: 'limitBreak',
    unlockCondition: 'allBasicMaxed',
  },
  {
    id: 'goldRush',
    nameKey: 'meta.goldRush.name',
    descKey: 'meta.goldRush.desc',
    maxLevel: 1,
    costFormula: () => 2000,
    stat: 'goldRushEnabled',
    effectPerLevel: 1,
    category: 'limitBreak',
    unlockCondition: 'allBasicMaxed',
  },
];

/**
 * 카테고리별 업그레이드 목록을 반환한다.
 * @param {string} category - 'basic' | 'growth' | 'special' | 'limitBreak'
 * @returns {Array} 해당 카테고리의 업그레이드 배열
 */
export function getUpgradesByCategory(category) {
  return UPGRADES.filter(u => u.category === category);
}

/**
 * ID로 업그레이드 데이터를 조회한다.
 * @param {string} id - 업그레이드 ID
 * @returns {Object|undefined} 업그레이드 데이터
 */
export function getUpgradeById(id) {
  return UPGRADES.find(u => u.id === id);
}

/**
 * 기본(basic) 카테고리의 모든 업그레이드가 최대 레벨인지 확인한다.
 * @param {Object} upgradeLevels - { upgradeId: currentLevel } 형태의 레벨 정보
 * @returns {boolean} 모든 basic 업그레이드가 maxLevel인지 여부
 */
export function areAllBasicMaxed(upgradeLevels) {
  const basics = getUpgradesByCategory('basic');
  return basics.every(u => (upgradeLevels[u.id] || 0) >= u.maxLevel);
}
