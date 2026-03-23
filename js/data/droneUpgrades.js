/**
 * @fileoverview 메타 드론 동반자 업그레이드 데이터 테이블.
 * 스테이지 2 해금 후 연구소에서 크레딧으로 구매하는 드론 전용 업그레이드 5종을 정의한다.
 */

// ── 드론 기본 스탯 ──

/** 메타 드론 기본 데미지 (업그레이드 Lv 0 상태) */
export const DRONE_BASE_DAMAGE = 10;

/** 메타 드론 기본 발사 간격 (ms) */
export const DRONE_BASE_COOLDOWN = 1200;

/** 메타 드론 기본 사거리 (px) */
export const DRONE_BASE_RANGE = 120;

/** 메타 드론 기본 이동 속도 (px/s) */
export const DRONE_BASE_MOVE_SPEED = 450;

/** 메타 드론 기본 수량 */
export const DRONE_BASE_COUNT = 1;

// ── 드론 업그레이드 정의 ──

/**
 * 메타 드론 업그레이드 전체 데이터.
 * costFormula: 레벨에 따른 비용 계산 함수 (level은 1-indexed: 구매할 레벨).
 * @type {Array<{id: string, nameKey: string, descKey: string, maxLevel: number, costFormula: function(number): number, stat: string, effectPerLevel: number, category: string, unlockCondition: string|null}>}
 */
export const DRONE_UPGRADES = [
  {
    id: 'droneDamage',
    nameKey: 'drone.upgrade.damage.name',
    descKey: 'drone.upgrade.damage.desc',
    maxLevel: 8,
    costFormula: (lv) => 120 * lv,
    stat: 'droneDamage',
    effectPerLevel: 5,
    category: 'drone',
    unlockCondition: null,
  },
  {
    id: 'droneFireRate',
    nameKey: 'drone.upgrade.fireRate.name',
    descKey: 'drone.upgrade.fireRate.desc',
    maxLevel: 6,
    costFormula: (lv) => 150 * lv,
    stat: 'droneFireRate',
    effectPerLevel: 50,
    category: 'drone',
    unlockCondition: null,
  },
  {
    id: 'droneRange',
    nameKey: 'drone.upgrade.range.name',
    descKey: 'drone.upgrade.range.desc',
    maxLevel: 5,
    costFormula: (lv) => 130 * lv,
    stat: 'droneRange',
    effectPerLevel: 15,
    category: 'drone',
    unlockCondition: null,
  },
  {
    id: 'droneReinforcement',
    nameKey: 'drone.upgrade.reinforcement.name',
    descKey: 'drone.upgrade.reinforcement.desc',
    maxLevel: 2,
    costFormula: (lv) => 500 * lv,
    stat: 'droneCount',
    effectPerLevel: 1,
    category: 'drone',
    unlockCondition: null,
  },
  {
    id: 'droneHivemind',
    nameKey: 'drone.upgrade.hivemind.name',
    descKey: 'drone.upgrade.hivemind.desc',
    maxLevel: 1,
    costFormula: () => 1500,
    stat: 'droneHivemind',
    effectPerLevel: 1,
    category: 'drone',
    unlockCondition: 'allDroneMaxed',
  },
];

// ── 조회 함수 ──

/**
 * ID로 드론 업그레이드 데이터를 조회한다.
 * @param {string} id - 업그레이드 ID
 * @returns {Object|undefined}
 */
export function getDroneUpgradeById(id) {
  return DRONE_UPGRADES.find(u => u.id === id);
}

/**
 * 하이브마인드 외 드론 업그레이드가 모두 최대 레벨인지 확인한다.
 * @param {Object} droneLevels - { upgradeId: currentLevel }
 * @returns {boolean}
 */
export function areAllDroneMaxed(droneLevels) {
  return DRONE_UPGRADES
    .filter(u => u.id !== 'droneHivemind')
    .every(u => (droneLevels[u.id] || 0) >= u.maxLevel);
}
