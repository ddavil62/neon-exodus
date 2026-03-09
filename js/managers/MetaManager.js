/**
 * @fileoverview 영구 업그레이드 관리 매니저.
 * 크레딧을 소모하여 영구 업그레이드를 구매하고,
 * 런 시작 시 적용할 통합 보너스를 계산한다.
 */

import { UPGRADES, getUpgradeById, areAllBasicMaxed } from '../data/upgrades.js';
import { SaveManager } from './SaveManager.js';

// ── MetaManager 클래스 ──

/**
 * 영구 업그레이드 관리 매니저.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */
export class MetaManager {
  /**
   * 특정 업그레이드의 현재 레벨을 반환한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {number} 현재 레벨 (미구매 시 0)
   */
  static getUpgradeLevel(upgradeId) {
    return SaveManager.getUpgradeLevel(upgradeId);
  }

  /**
   * 업그레이드 구매 가능 여부를 확인한다.
   * - 현재 레벨 < 최대 레벨
   * - 비용 충족 (크레딧)
   * - 해금 조건 충족 (limitBreak 카테고리: 기본 스탯 전부 최대 후 해금)
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 구매 가능 여부
   */
  static canUpgrade(upgradeId) {
    const upgrade = getUpgradeById(upgradeId);
    if (!upgrade) return false;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);

    // 최대 레벨 도달 시 불가
    if (currentLevel >= upgrade.maxLevel) return false;

    // 비용 확인
    const cost = MetaManager.getUpgradeCost(upgradeId);
    if (SaveManager.getCredits() < cost) return false;

    // 해금 조건 확인 (limitBreak 카테고리)
    if (upgrade.unlockCondition === 'allBasicMaxed') {
      const upgradeLevels = SaveManager.getData().upgrades;
      if (!areAllBasicMaxed(upgradeLevels)) return false;
    }

    return true;
  }

  /**
   * 업그레이드 해금 조건이 충족되었는지 확인한다.
   * 해금 조건이 없으면 true를 반환한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 해금 여부
   */
  static isUnlocked(upgradeId) {
    const upgrade = getUpgradeById(upgradeId);
    if (!upgrade) return false;

    if (!upgrade.unlockCondition) return true;

    if (upgrade.unlockCondition === 'allBasicMaxed') {
      const upgradeLevels = SaveManager.getData().upgrades;
      return areAllBasicMaxed(upgradeLevels);
    }

    return true;
  }

  /**
   * 특정 업그레이드의 현재 비용을 계산한다.
   * costFormula는 다음 레벨(1-indexed)을 인자로 받는다: cost x (currentLevel + 1).
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {number} 구매 비용 (업그레이드가 없거나 최대 레벨이면 Infinity)
   */
  static getUpgradeCost(upgradeId) {
    const upgrade = getUpgradeById(upgradeId);
    if (!upgrade) return Infinity;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);
    if (currentLevel >= upgrade.maxLevel) return Infinity;

    // costFormula 인자: 구매할 레벨 (1-indexed)
    return upgrade.costFormula(currentLevel + 1);
  }

  /**
   * 업그레이드를 구매한다.
   * 비용을 차감하고 레벨을 증가시킨 뒤 세이브한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 구매 성공 여부
   */
  static purchaseUpgrade(upgradeId) {
    if (!MetaManager.canUpgrade(upgradeId)) return false;

    const cost = MetaManager.getUpgradeCost(upgradeId);
    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);

    // 크레딧 차감
    SaveManager.addCredits(-cost);

    // 레벨 증가
    SaveManager.setUpgradeLevel(upgradeId, currentLevel + 1);

    return true;
  }

  /**
   * 모든 영구 업그레이드의 현재 레벨을 기반으로 통합 플레이어 보너스를 계산한다.
   * 런 시작 시 이 값을 적용하여 플레이어 능력치를 결정한다.
   * @returns {Object} 통합 보너스 객체
   */
  static getPlayerBonuses() {
    /**
     * 업그레이드 ID로 현재 레벨을 간편 조회한다.
     * @param {string} id - 업그레이드 ID
     * @returns {number} 현재 레벨
     */
    const lv = (id) => MetaManager.getUpgradeLevel(id);

    return {
      // 기본 스탯
      attackMultiplier: 1 + (lv('attack') * 0.05),
      maxHpMultiplier: 1 + (lv('maxHp') * 0.10),
      regenPerSec: lv('hpRegen') * 0.1,
      armor: lv('defense') * 1,
      speedMultiplier: 1 + (lv('moveSpeed') * 0.03),
      cooldownReduction: 1 - (lv('cooldown') * 0.02),
      projectileSpeedMul: 1 + (lv('projectileSpeed') * 0.05),
      areaMultiplier: 1 + (lv('areaOfEffect') * 0.04),

      // 성장 가속
      xpMultiplier: 1 + (lv('xpGain') * 0.05),
      creditMultiplier: 1 + (lv('creditGain') * 0.08),
      magnetMultiplier: 1 + (lv('xpMagnet') * 0.05),
      luck: lv('luck') * 0.03,
      extraChoices: lv('levelupChoices'),
      rerolls: lv('rerolls'),

      // 특수
      revives: lv('revive'),
      startWeaponLevel: lv('startWeaponLevel') + 1,
      startPassives: lv('startPassive'),
      invincibleBonus: lv('vanish') * 0.2,
      knockbackMultiplier: 1 + (lv('knockback') * 0.1),

      // 한도 돌파
      extraWeaponSlots: lv('weaponSlots'),
      extraPassiveSlots: lv('passiveSlots'),
      goldRush: lv('goldRush') > 0,
    };
  }

  /**
   * 전체 업그레이드 목록을 현재 레벨/비용 정보와 함께 반환한다.
   * UpgradeScene UI에서 사용하기 위한 데이터.
   * @returns {Array<Object>} 업그레이드 데이터 + 현재 상태 배열
   */
  static getAllUpgrades() {
    return UPGRADES.map(upgrade => {
      const currentLevel = MetaManager.getUpgradeLevel(upgrade.id);
      const isMaxed = currentLevel >= upgrade.maxLevel;
      const isLocked = !MetaManager.isUnlocked(upgrade.id);

      return {
        ...upgrade,
        currentLevel,
        isMaxed,
        isLocked,
        nextCost: isMaxed ? null : MetaManager.getUpgradeCost(upgrade.id),
        canBuy: MetaManager.canUpgrade(upgrade.id),
      };
    });
  }

  /**
   * 모든 영구 업그레이드가 최대 레벨인지 확인한다.
   * 풀 업그레이드 도전과제 확인용.
   * @returns {boolean} 모든 업그레이드가 최대 레벨인지 여부
   */
  static areAllMaxed() {
    return UPGRADES.every(u => MetaManager.getUpgradeLevel(u.id) >= u.maxLevel);
  }
}
