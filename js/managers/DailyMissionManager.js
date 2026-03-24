/**
 * @fileoverview 일일 미션 매니저.
 * UTC 자정 기준 리셋, 날짜 기반 결정론적 시드로 미션 선택,
 * 런 결과 기반 진행도 추적, 보상 수령을 관리한다.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */

import { DAILY_MISSION_POOL, DAILY_BONUS_REWARD, STREAK_BONUS, STREAK_CYCLE } from '../data/dailyMissions.js';
import { SaveManager } from './SaveManager.js';
import { AchievementManager } from './AchievementManager.js';

// ── 카테고리 목록 ──

/** 미션 풀의 고유 카테고리 목록 */
const CATEGORIES = ['kill', 'survival', 'collection', 'weapon', 'special'];

// ── DailyMissionManager 클래스 ──

/**
 * 일일 미션 추적 및 보상 매니저.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */
export class DailyMissionManager {
  // ── 초기화 ──

  /**
   * 일일 미션 시스템을 초기화한다.
   * 날짜가 변경되었으면 새 미션을 생성하고, streak를 갱신한다.
   */
  static init() {
    const today = DailyMissionManager._getToday();
    const dm = SaveManager.getDailyMissions();

    if (dm.date !== today) {
      // streak 갱신: 어제 날짜와 비교
      const yesterday = DailyMissionManager._getYesterday();
      if (dm.date === yesterday && dm.missions.length > 0) {
        // 어제 미션이 있었으면 streak 유지/증가
        dm.streak = (dm.streak || 0) + 1;
      } else if (dm.date === '') {
        // 첫 사용: streak 1로 시작
        dm.streak = 1;
      } else {
        // 연속 끊김: streak 1로 리셋
        dm.streak = 1;
      }

      // 새 미션 생성
      const seed = DailyMissionManager._generateSeed(today);
      const selectedMissions = DailyMissionManager._selectMissions(seed);

      dm.date = today;
      dm.seed = seed;
      dm.missions = selectedMissions.map(m => ({
        id: m.id,
        progress: 0,
        completed: false,
        claimed: false,
      }));
      dm.bonusClaimed = false;
      dm.charsUsedToday = [];

      SaveManager.setDailyMissions(dm);
    }
  }

  // ── 날짜 유틸리티 ──

  /**
   * UTC 기준 오늘 날짜를 'YYYY-MM-DD' 형식 문자열로 반환한다.
   * @returns {string} 날짜 문자열
   * @private
   */
  static _getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * UTC 기준 어제 날짜를 'YYYY-MM-DD' 형식 문자열로 반환한다.
   * @returns {string} 날짜 문자열
   * @private
   */
  static _getYesterday() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // ── 시드 생성 ──

  /**
   * 날짜 문자열에서 결정론적 시드를 생성한다.
   * @param {string} dateStr - 'YYYY-MM-DD' 형식
   * @returns {number} 시드 값
   * @private
   */
  static _generateSeed(dateStr) {
    return parseInt(dateStr.split('-').join(''), 10);
  }

  /**
   * mulberry32 PRNG. 시드에서 결정론적 난수를 생성한다.
   * @param {number} seed - 시드 값
   * @returns {Function} 0~1 사이 난수를 반환하는 함수
   * @private
   */
  static _mulberry32(seed) {
    let s = seed;
    return () => {
      s |= 0;
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── 미션 선택 ──

  /**
   * 시드 기반 PRNG로 5개 카테고리에서 3개 미션을 선택한다.
   * 3개 미션은 모두 다른 카테고리에서 선택된다.
   * @param {number} seed - 시드 값
   * @returns {Array<Object>} 선택된 3개 미션 데이터
   * @private
   */
  static _selectMissions(seed) {
    const rng = DailyMissionManager._mulberry32(seed);

    // 카테고리별 미션 그룹화
    const grouped = {};
    for (const cat of CATEGORIES) {
      grouped[cat] = DAILY_MISSION_POOL.filter(m => m.category === cat);
    }

    // 셔플된 카테고리에서 3개 선택
    const shuffledCats = [...CATEGORIES];
    for (let i = shuffledCats.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledCats[i], shuffledCats[j]] = [shuffledCats[j], shuffledCats[i]];
    }
    const selectedCats = shuffledCats.slice(0, 3);

    // 각 카테고리에서 1개씩 랜덤 선택
    const result = [];
    for (const cat of selectedCats) {
      const pool = grouped[cat];
      const idx = Math.floor(rng() * pool.length);
      result.push(pool[idx]);
    }

    return result;
  }

  // ── 미션 조회 ──

  /**
   * 현재 3개 미션 + 메타데이터를 반환한다.
   * 각 미션에 풀 데이터(target, reward 등)를 병합하여 반환한다.
   * @returns {Array<Object>} 미션 데이터 배열
   */
  static getCurrentMissions() {
    const dm = SaveManager.getDailyMissions();
    return dm.missions.map(slot => {
      const poolData = DAILY_MISSION_POOL.find(m => m.id === slot.id);
      return {
        ...slot,
        ...(poolData || {}),
        progress: slot.progress,
        completed: slot.completed,
        claimed: slot.claimed,
      };
    });
  }

  // ── 진행도 갱신 ──

  /**
   * 런 종료 시 호출하여 미션 진행도를 갱신한다.
   * @param {Object} runData - 런 결과 데이터
   * @returns {Array<string>} 새로 완료된 미션 ID 배열
   */
  static updateProgress(runData) {
    // 날짜 체크 — 혹시 리셋이 안 된 경우
    DailyMissionManager.init();

    const dm = SaveManager.getDailyMissions();
    const newlyCompleted = [];

    // 캐릭터 사용 기록 (diff_char 미션용)
    if (runData.characterId && !dm.charsUsedToday.includes(runData.characterId)) {
      dm.charsUsedToday.push(runData.characterId);
    }

    for (const slot of dm.missions) {
      if (slot.completed) continue;

      const poolData = DAILY_MISSION_POOL.find(m => m.id === slot.id);
      if (!poolData) continue;

      const value = DailyMissionManager._getProgressValue(slot.id, runData);
      const isMaxType = DailyMissionManager._isMaxType(slot.id);

      if (isMaxType) {
        slot.progress = Math.max(slot.progress, value);
      } else {
        slot.progress += value;
      }

      // diff_char 미션은 charsUsedToday 배열 길이 기반
      if (slot.id.startsWith('diff_char_')) {
        slot.progress = dm.charsUsedToday.length;
      }

      // 완료 체크
      if (slot.progress >= poolData.target && !slot.completed) {
        slot.completed = true;
        newlyCompleted.push(slot.id);
      }
    }

    SaveManager.setDailyMissions(dm);
    return newlyCompleted;
  }

  /**
   * 미션 ID에 따라 runData에서 진행도 값을 추출한다.
   * @param {string} missionId - 미션 ID
   * @param {Object} runData - 런 결과 데이터
   * @returns {number} 진행도 값
   * @private
   */
  static _getProgressValue(missionId, runData) {
    // kill_boss_* 패턴 (kill_boss_ 보다 먼저 체크)
    if (missionId.startsWith('kill_boss_')) {
      return runData.bossKills || 0;
    }
    // kill_miniboss_* 패턴
    if (missionId.startsWith('kill_miniboss_')) {
      return runData.minibossKills || 0;
    }
    // kill_* 패턴 (일반 킬)
    if (missionId.startsWith('kill_')) {
      return runData.killCount || 0;
    }
    // survive_*min 패턴
    if (missionId.startsWith('survive_')) {
      return runData.runTime || 0;
    }
    // clear_* 패턴
    if (missionId.startsWith('clear_')) {
      return runData.victory ? 1 : 0;
    }
    // run_* 패턴
    if (missionId.startsWith('run_')) {
      return 1;
    }
    // earn_credits_* 패턴
    if (missionId.startsWith('earn_credits_')) {
      return runData.creditsEarned || 0;
    }
    // reach_lv_* 패턴
    if (missionId.startsWith('reach_lv_')) {
      return runData.level || 0;
    }
    // use_consumable_* 패턴
    if (missionId.startsWith('use_consumable_')) {
      return runData.consumablesUsed || 0;
    }
    // fill_slots_* 패턴
    if (missionId.startsWith('fill_slots_')) {
      return runData.weaponSlotsFilled || 0;
    }
    // evolve_* 패턴
    if (missionId.startsWith('evolve_')) {
      return runData.weaponEvolutions || 0;
    }
    // max_weapon_* 패턴
    if (missionId.startsWith('max_weapon_')) {
      return runData.maxedWeapons || 0;
    }
    // collect_passive_* 패턴
    if (missionId.startsWith('collect_passive_')) {
      return runData.passiveCount || 0;
    }
    // no_damage_*min 패턴
    if (missionId.startsWith('no_damage_')) {
      return runData.maxNoDamageStreak || 0;
    }
    // hard_clear
    if (missionId === 'hard_clear') {
      return (runData.victory && runData.difficulty === 'hard') ? 1 : 0;
    }
    // nightmare_clear
    if (missionId === 'nightmare_clear') {
      return (runData.victory && runData.difficulty === 'nightmare') ? 1 : 0;
    }
    // use_ultimate_* 패턴
    if (missionId.startsWith('use_ultimate_')) {
      return runData.ultimateUses || 0;
    }
    // diff_char_* — charsUsedToday 기반, updateProgress에서 별도 처리
    if (missionId.startsWith('diff_char_')) {
      return 0;
    }
    // earn_dc_* 패턴
    if (missionId.startsWith('earn_dc_')) {
      return runData.dcReward || 0;
    }

    return 0;
  }

  /**
   * 최대값형 미션인지 판별한다.
   * @param {string} missionId - 미션 ID
   * @returns {boolean} 최대값형이면 true
   * @private
   */
  static _isMaxType(missionId) {
    const maxPrefixes = [
      'survive_', 'reach_lv_', 'fill_slots_', 'max_weapon_',
      'collect_passive_', 'no_damage_',
    ];
    return maxPrefixes.some(p => missionId.startsWith(p));
  }

  // ── 보상 수령 ──

  /**
   * 완료된 미션의 보상을 수령한다.
   * @param {number} index - 미션 인덱스 (0~2)
   * @returns {boolean} 성공 여부
   */
  static claimReward(index) {
    const dm = SaveManager.getDailyMissions();
    if (index < 0 || index >= dm.missions.length) return false;

    const slot = dm.missions[index];
    if (!slot.completed || slot.claimed) return false;

    const poolData = DAILY_MISSION_POOL.find(m => m.id === slot.id);
    if (!poolData) return false;

    // 보상 지급
    if (poolData.reward.credits) {
      SaveManager.addCredits(poolData.reward.credits);
    }
    if (poolData.reward.dataCores) {
      SaveManager.addDataCores(poolData.reward.dataCores);
      // 선택된 캐릭터에 XP로 자동 투자
      const charId = SaveManager.getSelectedCharacter();
      SaveManager.addCharacterXP(charId, poolData.reward.dataCores);
      SaveManager.addCharacterDcEarned(charId, poolData.reward.dataCores);
    }

    slot.claimed = true;

    // 누적 완료 미션 수 증가
    dm.totalCompleted = (dm.totalCompleted || 0) + 1;

    SaveManager.setDailyMissions(dm);

    // 업적 체크 — 일일 미션 관련
    DailyMissionManager._checkAchievements(dm);

    return true;
  }

  /**
   * 전체 완료 보너스를 수령한다.
   * 3개 미션이 모두 claimed일 때만 수령 가능.
   * @returns {boolean} 성공 여부
   */
  static claimBonus() {
    const dm = SaveManager.getDailyMissions();

    // 3개 모두 claimed 확인
    if (dm.missions.length < 3) return false;
    if (!dm.missions.every(m => m.claimed)) return false;
    if (dm.bonusClaimed) return false;

    // 보너스 보상 지급
    if (DAILY_BONUS_REWARD.credits) {
      SaveManager.addCredits(DAILY_BONUS_REWARD.credits);
    }
    if (DAILY_BONUS_REWARD.dataCores) {
      SaveManager.addDataCores(DAILY_BONUS_REWARD.dataCores);
      const charId = SaveManager.getSelectedCharacter();
      SaveManager.addCharacterXP(charId, DAILY_BONUS_REWARD.dataCores);
      SaveManager.addCharacterDcEarned(charId, DAILY_BONUS_REWARD.dataCores);
    }

    // streak 보너스 (STREAK_CYCLE 배수일 때)
    if (dm.streak > 0 && dm.streak % STREAK_CYCLE === 0) {
      if (STREAK_BONUS.credits) {
        SaveManager.addCredits(STREAK_BONUS.credits);
      }
      if (STREAK_BONUS.dataCores) {
        SaveManager.addDataCores(STREAK_BONUS.dataCores);
        const charId2 = SaveManager.getSelectedCharacter();
        SaveManager.addCharacterXP(charId2, STREAK_BONUS.dataCores);
        SaveManager.addCharacterDcEarned(charId2, STREAK_BONUS.dataCores);
      }
    }

    dm.bonusClaimed = true;
    SaveManager.setDailyMissions(dm);

    return true;
  }

  // ── 조회 ──

  /**
   * 현재 연속 출석 수를 반환한다.
   * @returns {number} streak 값
   */
  static getStreak() {
    return SaveManager.getDailyMissions().streak || 0;
  }

  /**
   * 전체 완료 보너스가 수령 가능한지 확인한다.
   * @returns {boolean} 수령 가능 여부
   */
  static isBonusClaimable() {
    const dm = SaveManager.getDailyMissions();
    if (dm.missions.length < 3) return false;
    return dm.missions.every(m => m.claimed) && !dm.bonusClaimed;
  }

  /**
   * 미완료 미션이 있는지 확인한다.
   * @returns {boolean} 미완료 미션 존재 여부
   */
  static hasUnclaimedMissions() {
    const dm = SaveManager.getDailyMissions();
    return dm.missions.some(m => m.completed && !m.claimed) ||
           (dm.missions.every(m => m.claimed) && !dm.bonusClaimed);
  }

  /**
   * 다음 UTC 자정까지 남은 시간을 밀리초로 반환한다.
   * @returns {number} 남은 시간 (ms)
   */
  static getTimeUntilReset() {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return tomorrow.getTime() - now.getTime();
  }

  // ── 내부: 업적 연동 ──

  /**
   * 일일 미션 관련 업적을 체크한다.
   * @param {Object} dm - dailyMissions 데이터
   * @private
   */
  static _checkAchievements(dm) {
    const stats = SaveManager.getStats();
    AchievementManager.checkAll(stats, {
      dailyComplete: true,
      dailyStreak: dm.streak,
      dailyTotal: dm.totalCompleted,
    });
  }
}
