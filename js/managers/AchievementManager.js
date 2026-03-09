/**
 * @fileoverview 도전과제 추적 및 보상 지급 매니저.
 * 런 종료 시 또는 특정 이벤트 발생 시 도전과제 조건을 검사하고,
 * 달성 시 보상을 지급하며 알림 큐에 추가한다.
 */

import { ACHIEVEMENTS, getAchievementById } from '../data/achievements.js';
import { SaveManager } from './SaveManager.js';

// ── AchievementManager 클래스 ──

/**
 * 도전과제 추적 및 알림 매니저.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */
export class AchievementManager {
  /** @type {Array<Object>} 달성 알림 큐 (UI에서 하나씩 꺼내어 표시) */
  static pendingNotifications = [];

  /**
   * 모든 도전과제의 조건을 검사한다.
   * 이미 달성된 도전과제는 건너뛴다.
   * @param {Object} stats - 현재 통계 데이터 (SaveManager.getStats() 형태)
   * @param {Object} [runData={}] - 현재 런의 추가 데이터 (런 중 특수 조건 체크용)
   * @param {number} [runData.weaponSlotsFilled] - 장착된 무기 슬롯 수
   * @param {number} [runData.weaponEvolutions] - 달성한 무기 진화 수
   * @param {boolean} [runData.allUpgradesMaxed] - 전체 업그레이드 최대 여부
   */
  static checkAll(stats, runData = {}) {
    for (const achievement of ACHIEVEMENTS) {
      // 이미 달성된 도전과제는 건너뛴다
      if (SaveManager.isAchievementComplete(achievement.id)) continue;

      const fulfilled = AchievementManager._checkCondition(achievement, stats, runData);
      if (fulfilled) {
        AchievementManager._complete(achievement);
      }
    }
  }

  /**
   * 킬 관련 업적을 체크한다.
   * @param {number} totalKills - 누적 처치 수
   */
  static checkKills(totalKills) {
    for (const achievement of ACHIEVEMENTS) {
      if (SaveManager.isAchievementComplete(achievement.id)) continue;
      if (achievement.condition.type !== 'totalKills') continue;

      if (totalKills >= achievement.condition.value) {
        AchievementManager._complete(achievement);
      }
    }
  }

  /**
   * 생존 관련 업적을 체크한다.
   * @param {number} survivalMinutes - 생존 시간 (분)
   */
  static checkSurvival(survivalMinutes) {
    for (const achievement of ACHIEVEMENTS) {
      if (SaveManager.isAchievementComplete(achievement.id)) continue;
      if (achievement.condition.type !== 'surviveMinutes') continue;

      if (survivalMinutes >= achievement.condition.value) {
        AchievementManager._complete(achievement);
      }
    }
  }

  /**
   * 클리어 관련 업적을 체크한다.
   * @param {number} totalClears - 총 클리어 횟수
   * @param {number} consecutiveClears - 연속 클리어 횟수
   */
  static checkClears(totalClears, consecutiveClears) {
    for (const achievement of ACHIEVEMENTS) {
      if (SaveManager.isAchievementComplete(achievement.id)) continue;

      const { type, value } = achievement.condition;

      if (type === 'totalClears' && totalClears >= value) {
        AchievementManager._complete(achievement);
      } else if (type === 'consecutiveClears' && consecutiveClears >= value) {
        AchievementManager._complete(achievement);
      }
    }
  }

  /**
   * 대기 중인 알림을 하나 꺼내어 반환한다.
   * 알림 큐가 비어있으면 null을 반환한다.
   * @returns {Object|null} 달성 도전과제 데이터 또는 null
   */
  static getNextNotification() {
    if (AchievementManager.pendingNotifications.length === 0) return null;
    return AchievementManager.pendingNotifications.shift();
  }

  /**
   * 대기 중인 알림이 있는지 확인한다.
   * @returns {boolean} 알림 존재 여부
   */
  static hasPendingNotifications() {
    return AchievementManager.pendingNotifications.length > 0;
  }

  /**
   * 전체 도전과제 목록을 달성 여부와 함께 반환한다.
   * CollectionScene/AchievementScene에서 사용한다.
   * @returns {Array<Object>} 도전과제 데이터 + 달성 여부 배열
   */
  static getAllAchievements() {
    return ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      completed: SaveManager.isAchievementComplete(achievement.id),
    }));
  }

  /**
   * 특정 도전과제의 달성 여부를 반환한다.
   * @param {string} id - 도전과제 ID
   * @returns {boolean} 달성 여부
   */
  static isCompleted(id) {
    return SaveManager.isAchievementComplete(id);
  }

  // ── 내부 메서드 ──

  /**
   * 도전과제 조건 충족 여부를 확인한다.
   * @param {Object} achievement - 도전과제 데이터
   * @param {Object} stats - 통계 데이터
   * @param {Object} runData - 런 추가 데이터
   * @returns {boolean} 조건 충족 여부
   * @private
   */
  static _checkCondition(achievement, stats, runData) {
    const { condition } = achievement;

    switch (condition.type) {
      case 'totalKills':
        return (stats.totalKills || 0) >= condition.value;

      case 'totalClears':
        return (stats.totalClears || 0) >= condition.value;

      case 'consecutiveClears':
        return (stats.consecutiveClears || 0) >= condition.value;

      case 'surviveMinutes':
        // longestSurvival은 초 단위로 저장, 분 단위로 비교
        return ((stats.longestSurvival || 0) / 60) >= condition.value;

      case 'lowHpClear':
        // 특수 조건: 런 데이터에서 직접 확인 필요
        return runData.lowHpClear === true;

      case 'noDamageSurvive':
        // 특수 조건: 런 데이터에서 직접 확인 필요
        return runData.noDamageSurvive === true;

      case 'fillWeaponSlots':
        return (runData.weaponSlotsFilled || 0) >= condition.value;

      case 'weaponEvolution':
        return (runData.weaponEvolutions || 0) >= condition.value;

      case 'allUpgradesMaxed':
        return runData.allUpgradesMaxed === true;

      default:
        return false;
    }
  }

  /**
   * 도전과제를 달성 처리한다.
   * SaveManager에 기록하고, 보상을 지급하고, 알림 큐에 추가한다.
   * @param {Object} achievement - 도전과제 데이터
   * @private
   */
  static _complete(achievement) {
    // 중복 방지: 이미 달성되었으면 무시
    if (SaveManager.isAchievementComplete(achievement.id)) return;

    // 달성 기록
    SaveManager.completeAchievement(achievement.id);

    // 보상 지급
    AchievementManager._grantReward(achievement);

    // 알림 큐에 추가
    AchievementManager.pendingNotifications.push({
      id: achievement.id,
      nameKey: achievement.nameKey,
      descKey: achievement.descKey,
      reward: achievement.reward,
    });
  }

  /**
   * 도전과제 보상을 지급한다.
   * @param {Object} achievement - 도전과제 데이터
   * @private
   */
  static _grantReward(achievement) {
    const { reward } = achievement;
    if (!reward) return;

    switch (reward.type) {
      case 'credits':
        SaveManager.addCredits(reward.amount);
        break;

      case 'dataCore':
        SaveManager.addDataCores(reward.amount);
        break;

      case 'dataCoreAndTitle':
        // 데이터 코어 지급 (칭호는 UI에서 별도 처리)
        SaveManager.addDataCores(reward.amount);
        break;

      case 'characterHint':
        // 캐릭터 해금 힌트: 별도 UI 표시용, 데이터 변경 없음
        break;

      case 'hiddenCharacterUnlock':
        // 숨겨진 캐릭터 해금
        SaveManager.unlockCharacter('hidden');
        break;

      default:
        break;
    }
  }
}
