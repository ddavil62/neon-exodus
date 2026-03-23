/**
 * @fileoverview 도전과제 추적 및 보상 지급 매니저.
 * 런 종료 시 또는 특정 이벤트 발생 시 도전과제 조건을 검사하고,
 * 달성 시 보상을 지급하며 알림 큐에 추가한다.
 *
 * 지원하는 condition 타입:
 * - totalKills, maxKillsInRun, totalBossKills, totalMinibossKills
 * - surviveMinutes, totalSurviveMinutes, lowHpClear, noDamageSurvive, noDamageRun
 * - totalClears, consecutiveClears, totalRuns
 * - fillWeaponSlots, weaponEvolution, specificEvolution, allEvolutionsSeen
 * - weaponCollectionComplete, passiveCollectionComplete, enemyCollectionComplete
 * - allUpgradesMaxed
 * - characterClear, characterClearCount, allCharacterClears
 * - maxLevel, stageClear, allStagesClear, totalPlayTime
 * - hardClear, hardAllClear, nightmareClear, nightmareAllClear, nightmareNoDamage
 */

import { ACHIEVEMENTS, getAchievementById } from '../data/achievements.js';
import { SaveManager } from './SaveManager.js';
import { STAGE_ORDER } from '../data/stages.js';

// ── 상수 ──

/** 전체 진화 무기 ID 목록 */
const ALL_EVOLVED_IDS = [
  'precision_cannon', 'plasma_storm', 'nuke_missile', 'ion_cannon',
  'guardian_sphere', 'hivemind', 'perpetual_emp', 'phantom_strike',
  'bioplasma', 'event_horizon', 'death_blossom',
];

/** 전체 캐릭터 ID 목록 */
const ALL_CHARACTER_IDS = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];

/** 전체 스테이지 ID 목록 */
const ALL_STAGE_IDS = ['stage_1', 'stage_2', 'stage_3', 'stage_4'];

/** 전체 무기 수 (기본 11 + 진화 11) */
const TOTAL_WEAPON_COUNT = 22;

/** 전체 패시브 수 */
const TOTAL_PASSIVE_COUNT = 11;

/** 전체 적 수 (일반 10 + 미니보스 2 + 보스 6) */
const TOTAL_ENEMY_COUNT = 18;

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
   * @param {Object} [runData={}] - 현재 런의 추가 데이터
   * @param {number} [runData.weaponSlotsFilled] - 장착된 무기 슬롯 수
   * @param {number} [runData.weaponEvolutions] - 달성한 무기 진화 수
   * @param {boolean} [runData.allUpgradesMaxed] - 전체 업그레이드 최대 여부
   * @param {boolean} [runData.lowHpClear] - HP 10% 이하 + 1분 이내 클리어 여부
   * @param {number} [runData.maxNoDamageStreak] - 최대 무피격 연속 시간 (초)
   * @param {boolean} [runData.noDamageRun] - 전체 런 무피격 여부
   * @param {string} [runData.characterId] - 사용 캐릭터 ID
   * @param {string} [runData.stageId] - 플레이한 스테이지 ID
   * @param {boolean} [runData.victory] - 클리어 여부
   * @param {string} [runData.difficulty] - 플레이한 난이도 ('normal' | 'hard' | 'nightmare')
   * @param {boolean} [runData.tookDamage] - 런 중 피격 여부
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
      // ── 킬 관련 ──
      case 'totalKills':
        return (stats.totalKills || 0) >= condition.value;

      case 'maxKillsInRun':
        return (stats.maxKillsInRun || 0) >= condition.value;

      case 'totalBossKills':
        return (stats.totalBossKills || 0) >= condition.value;

      case 'totalMinibossKills':
        return (stats.totalMinibossKills || 0) >= condition.value;

      // ── 생존 관련 ──
      case 'surviveMinutes':
        // longestSurvival은 초 단위로 저장, 분 단위로 비교
        return ((stats.longestSurvival || 0) / 60) >= condition.value;

      case 'totalSurviveMinutes':
        return (stats.totalSurviveMinutes || 0) >= condition.value;

      case 'lowHpClear':
        // 런 종료 시 HP가 hpThreshold 이하이고, 남은 시간이 remainingTimeMax 이내
        return runData.lowHpClear === true;

      case 'noDamageSurvive':
        // 최대 무피격 연속 시간이 durationMinutes 이상
        if (runData.maxNoDamageStreak !== undefined) {
          return (runData.maxNoDamageStreak / 60) >= condition.durationMinutes;
        }
        return false;

      case 'noDamageRun':
        // 전체 런에서 피해 0으로 클리어
        return runData.noDamageRun === true;

      // ── 클리어 관련 ──
      case 'totalClears':
        return (stats.totalClears || 0) >= condition.value;

      case 'consecutiveClears':
        return (stats.consecutiveClears || 0) >= condition.value;

      case 'totalRuns':
        return (stats.totalRuns || 0) >= condition.value;

      // ── 무기/진화 관련 ──
      case 'fillWeaponSlots':
        return (runData.weaponSlotsFilled || 0) >= condition.value;

      case 'weaponEvolution':
        return (runData.weaponEvolutions || 0) >= condition.value;

      case 'specificEvolution': {
        // 도감에서 해당 진화 무기를 발견했는지 확인
        const collection = SaveManager.getCollection();
        return (collection.weaponsSeen || []).includes(condition.weaponId);
      }

      case 'allEvolutionsSeen': {
        const col = SaveManager.getCollection();
        const seen = col.weaponsSeen || [];
        return ALL_EVOLVED_IDS.every(id => seen.includes(id));
      }

      case 'weaponCollectionComplete': {
        const col = SaveManager.getCollection();
        return (col.weaponsSeen || []).length >= TOTAL_WEAPON_COUNT;
      }

      case 'passiveCollectionComplete': {
        const col = SaveManager.getCollection();
        return (col.passivesSeen || []).length >= TOTAL_PASSIVE_COUNT;
      }

      case 'enemyCollectionComplete': {
        const col = SaveManager.getCollection();
        return (col.enemiesSeen || []).length >= TOTAL_ENEMY_COUNT;
      }

      case 'allUpgradesMaxed':
        return runData.allUpgradesMaxed === true;

      // ── 캐릭터 관련 ──
      case 'characterClear': {
        const clears = SaveManager.getCharacterClears();
        return (clears[condition.characterId] || 0) >= 1;
      }

      case 'characterClearCount': {
        const clears = SaveManager.getCharacterClears();
        return (clears[condition.characterId] || 0) >= condition.value;
      }

      case 'allCharacterClears': {
        const clears = SaveManager.getCharacterClears();
        return ALL_CHARACTER_IDS.every(id => (clears[id] || 0) >= 1);
      }

      // ── 성장/탐험 관련 ──
      case 'maxLevel':
        return (stats.maxLevel || 0) >= condition.value;

      case 'stageClear':
        return SaveManager.getStageClearCount(condition.stageId) >= 1;

      case 'allStagesClear':
        return ALL_STAGE_IDS.every(id => SaveManager.getStageClearCount(id) >= 1);

      case 'totalPlayTime':
        // totalPlayTime은 초 단위로 저장
        return (stats.totalPlayTime || 0) >= condition.value;

      // ── 난이도 관련 ──
      case 'hardClear':
        return STAGE_ORDER.some(id => SaveManager.getStageClearCount(id, 'hard') >= condition.count);

      case 'hardAllClear':
        return STAGE_ORDER.every(id => SaveManager.getStageClearCount(id, 'hard') >= 1);

      case 'nightmareClear':
        return STAGE_ORDER.some(id => SaveManager.getStageClearCount(id, 'nightmare') >= condition.count);

      case 'nightmareAllClear':
        return STAGE_ORDER.every(id => SaveManager.getStageClearCount(id, 'nightmare') >= 1);

      case 'nightmareNoDamage':
        // 런 데이터에서 체크: 나이트메어 + 승리 + 무피격
        return runData?.victory && runData?.difficulty === 'nightmare' && !runData?.tookDamage;

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
