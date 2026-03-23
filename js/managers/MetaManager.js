/**
 * @fileoverview 영구 업그레이드 관리 매니저.
 * 크레딧을 소모하여 영구 업그레이드를 구매하고,
 * 런 시작 시 적용할 통합 보너스를 계산한다.
 * 기본 업그레이드(UPGRADES)와 드론 업그레이드(DRONE_UPGRADES)를 통합 관리한다.
 */

import { UPGRADES, getUpgradeById, areAllBasicMaxed } from '../data/upgrades.js';
import { DRONE_UPGRADES, getDroneUpgradeById, areAllDroneMaxed } from '../data/droneUpgrades.js';
import { SaveManager } from './SaveManager.js';

// ── MetaManager 클래스 ──

/**
 * 영구 업그레이드 관리 매니저.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */
export class MetaManager {

  // ── 내부 유틸 ──

  /**
   * UPGRADES 또는 DRONE_UPGRADES에서 업그레이드를 찾는다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {Object|undefined}
   * @private
   */
  static _findUpgrade(upgradeId) {
    return getUpgradeById(upgradeId) || getDroneUpgradeById(upgradeId);
  }

  /**
   * 드론 업그레이드인지 확인한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean}
   * @private
   */
  static _isDroneUpgrade(upgradeId) {
    return !!getDroneUpgradeById(upgradeId);
  }

  // ── 레벨 조회/설정 ──

  /**
   * 특정 업그레이드의 현재 레벨을 반환한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {number} 현재 레벨 (미구매 시 0)
   */
  static getUpgradeLevel(upgradeId) {
    if (MetaManager._isDroneUpgrade(upgradeId)) {
      return SaveManager.getDroneUpgradeLevel(upgradeId);
    }
    return SaveManager.getUpgradeLevel(upgradeId);
  }

  /**
   * 특정 업그레이드의 레벨을 설정한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @param {number} level - 설정할 레벨
   * @private
   */
  static _setUpgradeLevel(upgradeId, level) {
    if (MetaManager._isDroneUpgrade(upgradeId)) {
      SaveManager.setDroneUpgradeLevel(upgradeId, level);
    } else {
      SaveManager.setUpgradeLevel(upgradeId, level);
    }
  }

  // ── 구매 ──

  /**
   * 업그레이드 구매 가능 여부를 확인한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 구매 가능 여부
   */
  static canUpgrade(upgradeId) {
    const upgrade = MetaManager._findUpgrade(upgradeId);
    if (!upgrade) return false;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);

    // 최대 레벨 도달 시 불가
    if (currentLevel >= upgrade.maxLevel) return false;

    // 비용 확인
    const cost = MetaManager.getUpgradeCost(upgradeId);
    if (SaveManager.getCredits() < cost) return false;

    // 해금 조건 확인
    if (!MetaManager.isUnlocked(upgradeId)) return false;

    return true;
  }

  /**
   * 업그레이드 해금 조건이 충족되었는지 확인한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 해금 여부
   */
  static isUnlocked(upgradeId) {
    const upgrade = MetaManager._findUpgrade(upgradeId);
    if (!upgrade) return false;

    if (!upgrade.unlockCondition) return true;

    if (upgrade.unlockCondition === 'allBasicMaxed') {
      const upgradeLevels = SaveManager.getData().upgrades;
      return areAllBasicMaxed(upgradeLevels);
    }

    if (upgrade.unlockCondition === 'allDroneMaxed') {
      const droneLevels = SaveManager.getData().droneUpgrades || {};
      return areAllDroneMaxed(droneLevels);
    }

    return true;
  }

  /**
   * 특정 업그레이드의 현재 비용을 계산한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {number} 구매 비용 (업그레이드가 없거나 최대 레벨이면 Infinity)
   */
  static getUpgradeCost(upgradeId) {
    const upgrade = MetaManager._findUpgrade(upgradeId);
    if (!upgrade) return Infinity;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);
    if (currentLevel >= upgrade.maxLevel) return Infinity;

    // costFormula 인자: 구매할 레벨 (1-indexed)
    return upgrade.costFormula(currentLevel + 1);
  }

  /**
   * 업그레이드를 구매한다.
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
    MetaManager._setUpgradeLevel(upgradeId, currentLevel + 1);

    return true;
  }

  // ── 다운그레이드 ──

  /**
   * 업그레이드 다운그레이드 가능 여부를 확인한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 다운그레이드 가능 여부
   */
  static canDowngrade(upgradeId) {
    const upgrade = MetaManager._findUpgrade(upgradeId);
    if (!upgrade) return false;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);
    return currentLevel > 0;
  }

  /**
   * 업그레이드 다운그레이드 시 환불액을 계산한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {number} 환불액
   */
  static getDowngradeRefund(upgradeId) {
    const upgrade = MetaManager._findUpgrade(upgradeId);
    if (!upgrade) return 0;

    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);
    if (currentLevel <= 0) return 0;

    return upgrade.costFormula(currentLevel);
  }

  /**
   * 업그레이드를 1레벨 다운그레이드하고 크레딧을 전액 환불한다.
   * @param {string} upgradeId - 업그레이드 ID
   * @returns {boolean} 다운그레이드 성공 여부
   */
  static downgradeUpgrade(upgradeId) {
    if (!MetaManager.canDowngrade(upgradeId)) return false;

    const refund = MetaManager.getDowngradeRefund(upgradeId);
    const currentLevel = MetaManager.getUpgradeLevel(upgradeId);

    // 크레딧 환불
    SaveManager.addCredits(refund);

    // 레벨 감소
    MetaManager._setUpgradeLevel(upgradeId, currentLevel - 1);

    return true;
  }

  // ── 보너스 계산 ──

  /**
   * 모든 영구 업그레이드의 현재 레벨을 기반으로 통합 플레이어 보너스를 계산한다.
   * @returns {Object} 통합 보너스 객체
   */
  static getPlayerBonuses() {
    const lv = (id) => MetaManager.getUpgradeLevel(id);

    return {
      // 기본 스탯
      attackMultiplier: 1 + (lv('attack') * 0.05),
      maxHpMultiplier: 1 + (lv('maxHp') * 0.10),
      regenPerSec: lv('hpRegen') * 0.1,
      armorRate: lv('defense') * 0.01,
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

  // ── 업그레이드 목록 ──

  /**
   * 전체 업그레이드 목록을 현재 레벨/비용 정보와 함께 반환한다.
   * UpgradeScene UI에서 사용하기 위한 데이터.
   * @param {string} [category] - 특정 카테고리만 필터 (생략 시 전체)
   * @returns {Array<Object>} 업그레이드 데이터 + 현재 상태 배열
   */
  static getAllUpgrades(category) {
    // 기본 + 드론 업그레이드를 합침
    const all = [...UPGRADES, ...DRONE_UPGRADES];
    const filtered = category ? all.filter(u => u.category === category) : all;

    return filtered.map(upgrade => {
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
        canDowngrade: MetaManager.canDowngrade(upgrade.id),
        downgradeRefund: MetaManager.getDowngradeRefund(upgrade.id),
      };
    });
  }

  /**
   * 모든 기본 영구 업그레이드가 최대 레벨인지 확인한다.
   * @returns {boolean}
   */
  static areAllMaxed() {
    return UPGRADES.every(u => MetaManager.getUpgradeLevel(u.id) >= u.maxLevel);
  }
}
