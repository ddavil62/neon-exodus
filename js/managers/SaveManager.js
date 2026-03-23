/**
 * @fileoverview 로컬스토리지 기반 세이브/로드 매니저.
 * 게임 진행 데이터(크레딧, 업그레이드, 도전과제 등)를 로컬스토리지에 저장/복원한다.
 * 모든 데이터 접근은 static 메서드를 통해 이루어진다.
 */

import { SAVE_KEY, SAVE_DATA_VERSION } from '../config.js';

// ── 기본 세이브 데이터 구조 ──

/**
 * 초기 세이브 데이터. 새 게임 시작 또는 데이터 누락 시 기본값으로 사용된다.
 * @type {Object}
 */
const DEFAULT_SAVE = {
  version: SAVE_DATA_VERSION,
  credits: 0,
  dataCores: 0,
  upgrades: {},             // { upgradeId: level }
  characters: { agent: true }, // 해금된 캐릭터 (key: id, value: true)
  selectedCharacter: 'agent',
  achievements: {},         // { achievementId: true }
  autoHuntUnlocked: false,  // 자동 사냥 IAP 구매 여부
  autoHuntEnabled: false,   // 마지막 런의 자동 사냥 토글 상태 (다음 런에 자동 적용)
  upgradeUnlocked: false,   // 메타 업그레이드(연구소) 해금 여부
  droneUnlocked: false,     // 메타 드론 동반자 해금 여부
  droneUpgrades: {},        // { droneUpgradeId: level }
  cutscenesSeen: {},        // { cutsceneId: true }
  stageClears: {},          // { stageId: 클리어 횟수 }
  unlockedWeapons: [],      // 스테이지 해금 무기 ID 배열
  selectedStage: 'stage_1', // 선택된 스테이지 ID
  characterClears: {},      // { characterId: 클리어 횟수 }
  stats: {
    totalKills: 0,
    totalRuns: 0,
    totalClears: 0,
    totalPlayTime: 0,
    maxLevel: 0,
    maxKillsInRun: 0,
    longestSurvival: 0,
    consecutiveClears: 0,
    totalBossKills: 0,
    totalSurviveMinutes: 0,
    totalMinibossKills: 0,
  },
  collection: {
    weaponsSeen: ['blaster'],
    passivesSeen: [],
    enemiesSeen: [],
  },
  settings: {
    locale: 'en',
    sfxVolume: 1,
    bgmVolume: 0.7,
    hapticEnabled: true,
    bgmEnabled: true,
    sfxEnabled: true,
  },
};

// ── 내부 상태 ──

/** @type {Object|null} 현재 메모리에 로드된 세이브 데이터 */
let _data = null;

// ── SaveManager 클래스 ──

/**
 * 로컬스토리지 세이브/로드 매니저.
 * 싱글톤처럼 static 메서드로만 동작한다.
 */
export class SaveManager {
  /**
   * 세이브 시스템을 초기화한다.
   * 로컬스토리지에서 데이터를 불러오거나, 없으면 기본값을 생성한다.
   * 버전 마이그레이션이 필요하면 수행한다.
   */
  static init() {
    _data = SaveManager.load();

    // 마이그레이션 체크: 저장된 버전이 현재 버전보다 낮으면 마이그레이션 수행
    if (_data.version < SAVE_DATA_VERSION) {
      _data = SaveManager._migrate(_data);
    }

    SaveManager.save();
  }

  /**
   * 현재 데이터를 로컬스토리지에 저장한다.
   */
  static save() {
    if (!_data) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(_data));
    } catch (e) {
      console.error('[SaveManager] 세이브 실패:', e);
    }
  }

  /**
   * 로컬스토리지에서 데이터를 불러와 기본값과 병합한다.
   * 저장된 데이터가 없으면 기본값 복사본을 반환한다.
   * @returns {Object} 세이브 데이터
   */
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return SaveManager._deepCopy(DEFAULT_SAVE);
      }

      const parsed = JSON.parse(raw);
      return SaveManager._mergeWithDefaults(parsed);
    } catch (e) {
      console.error('[SaveManager] 로드 실패, 기본값으로 초기화:', e);
      return SaveManager._deepCopy(DEFAULT_SAVE);
    }
  }

  /**
   * 현재 메모리에 로드된 세이브 데이터 객체를 반환한다.
   * @returns {Object} 세이브 데이터
   */
  static getData() {
    if (!_data) {
      SaveManager.init();
    }
    return _data;
  }

  // ── 크레딧 ──

  /**
   * 현재 크레딧을 반환한다.
   * @returns {number} 크레딧
   */
  static getCredits() {
    return SaveManager.getData().credits;
  }

  /**
   * 크레딧을 추가(또는 차감)한다.
   * @param {number} amount - 추가할 양 (음수면 차감)
   */
  static addCredits(amount) {
    const data = SaveManager.getData();
    data.credits = Math.max(0, data.credits + amount);
    SaveManager.save();
  }

  // ── 데이터 코어 ──

  /**
   * 현재 데이터 코어를 반환한다.
   * @returns {number} 데이터 코어 수
   */
  static getDataCores() {
    return SaveManager.getData().dataCores;
  }

  /**
   * 데이터 코어를 추가(또는 차감)한다.
   * @param {number} amount - 추가할 양 (음수면 차감)
   */
  static addDataCores(amount) {
    const data = SaveManager.getData();
    data.dataCores = Math.max(0, data.dataCores + amount);
    SaveManager.save();
  }

  // ── 업그레이드 ──

  /**
   * 특정 영구 업그레이드의 현재 레벨을 반환한다.
   * @param {string} id - 업그레이드 ID
   * @returns {number} 현재 레벨 (미구매 시 0)
   */
  static getUpgradeLevel(id) {
    return SaveManager.getData().upgrades[id] || 0;
  }

  /**
   * 특정 영구 업그레이드의 레벨을 설정한다.
   * @param {string} id - 업그레이드 ID
   * @param {number} level - 설정할 레벨
   */
  static setUpgradeLevel(id, level) {
    const data = SaveManager.getData();
    data.upgrades[id] = level;
    SaveManager.save();
  }

  // ── 캐릭터 ──

  /**
   * 특정 캐릭터가 해금되었는지 확인한다.
   * @param {string} id - 캐릭터 ID
   * @returns {boolean} 해금 여부
   */
  static isCharacterUnlocked(id) {
    return SaveManager.getData().characters[id] === true;
  }

  /**
   * 캐릭터를 해금한다.
   * @param {string} id - 캐릭터 ID
   */
  static unlockCharacter(id) {
    const data = SaveManager.getData();
    data.characters[id] = true;
    SaveManager.save();
  }

  /**
   * 선택된 캐릭터 ID를 반환한다.
   * @returns {string} 캐릭터 ID
   */
  static getSelectedCharacter() {
    return SaveManager.getData().selectedCharacter;
  }

  /**
   * 캐릭터를 선택한다.
   * @param {string} id - 캐릭터 ID
   */
  static setSelectedCharacter(id) {
    const data = SaveManager.getData();
    data.selectedCharacter = id;
    SaveManager.save();
  }

  // ── 도전과제 ──

  /**
   * 특정 도전과제가 달성되었는지 확인한다.
   * @param {string} id - 도전과제 ID
   * @returns {boolean} 달성 여부
   */
  static isAchievementComplete(id) {
    return SaveManager.getData().achievements[id] === true;
  }

  /**
   * 도전과제를 달성 처리한다.
   * @param {string} id - 도전과제 ID
   */
  static completeAchievement(id) {
    const data = SaveManager.getData();
    data.achievements[id] = true;
    SaveManager.save();
  }

  // ── 통계 ──

  /**
   * 전체 통계 객체를 반환한다.
   * @returns {Object} 통계 데이터
   */
  static getStats() {
    return SaveManager.getData().stats;
  }

  /**
   * 통계 값을 갱신한다.
   * 누적형(totalKills 등)은 기존 값과 비교하여 큰 값을 유지하거나 덧셈한다.
   * @param {string} key - 통계 키 (예: 'totalKills', 'maxLevel')
   * @param {number} value - 갱신할 값
   */
  static updateStats(key, value) {
    const data = SaveManager.getData();

    // 최대값 추적 통계: 기존 값보다 클 때만 갱신
    const maxKeys = ['maxLevel', 'maxKillsInRun', 'longestSurvival'];
    if (maxKeys.includes(key)) {
      data.stats[key] = Math.max(data.stats[key] || 0, value);
    } else {
      // 누적형 통계: 기존 값에 더한다
      data.stats[key] = (data.stats[key] || 0) + value;
    }

    SaveManager.save();
  }

  // ── 도감(컬렉션) ──

  /**
   * 도감에 항목을 추가한다. 이미 존재하면 무시한다.
   * @param {string} category - 카테고리 ('weaponsSeen' | 'passivesSeen' | 'enemiesSeen')
   * @param {string} id - 항목 ID
   */
  static addToCollection(category, id) {
    const data = SaveManager.getData();

    if (!data.collection[category]) {
      data.collection[category] = [];
    }

    if (!data.collection[category].includes(id)) {
      data.collection[category].push(id);
      SaveManager.save();
    }
  }

  /**
   * 도감 데이터를 반환한다.
   * @returns {Object} 컬렉션 데이터
   */
  static getCollection() {
    return SaveManager.getData().collection;
  }

  // ── 설정 ──

  /**
   * 설정 객체를 반환한다.
   * @returns {Object} 설정 데이터
   */
  static getSettings() {
    return SaveManager.getData().settings;
  }

  /**
   * 설정 값을 변경한다.
   * @param {string} key - 설정 키
   * @param {*} value - 설정 값
   */
  static setSetting(key, value) {
    const data = SaveManager.getData();
    data.settings[key] = value;
    SaveManager.save();
  }

  // ── 스테이지 ──

  /**
   * 스테이지 클리어를 등록한다. 클리어 횟수를 1 증가시킨다.
   * @param {string} stageId - 스테이지 ID
   */
  static clearStage(stageId) {
    const data = SaveManager.getData();
    if (!data.stageClears) data.stageClears = {};
    data.stageClears[stageId] = (data.stageClears[stageId] || 0) + 1;
    SaveManager.save();
  }

  /**
   * 스테이지 클리어 여부를 반환한다.
   * @param {string} stageId - 스테이지 ID
   * @returns {boolean} 클리어 여부
   */
  static isStageClear(stageId) {
    const data = SaveManager.getData();
    return (data.stageClears && data.stageClears[stageId] > 0) || false;
  }

  /**
   * 스테이지 클리어 횟수를 반환한다.
   * @param {string} stageId - 스테이지 ID
   * @returns {number} 클리어 횟수
   */
  static getStageClearCount(stageId) {
    const data = SaveManager.getData();
    return (data.stageClears && data.stageClears[stageId]) || 0;
  }

  /**
   * 신규 무기를 영구 해금한다. 이미 해금된 경우 무시.
   * @param {string} weaponId - 무기 ID
   */
  static unlockWeapon(weaponId) {
    const data = SaveManager.getData();
    if (!data.unlockedWeapons) data.unlockedWeapons = [];
    if (!data.unlockedWeapons.includes(weaponId)) {
      data.unlockedWeapons.push(weaponId);
      SaveManager.save();
    }
  }

  /**
   * 무기 해금 여부를 반환한다.
   * @param {string} weaponId - 무기 ID
   * @returns {boolean} 해금 여부
   */
  static isWeaponUnlocked(weaponId) {
    const data = SaveManager.getData();
    return data.unlockedWeapons && data.unlockedWeapons.includes(weaponId);
  }

  /**
   * 해금된 무기 ID 배열을 반환한다.
   * @returns {Array<string>} 해금 무기 ID 배열
   */
  static getUnlockedWeapons() {
    const data = SaveManager.getData();
    return data.unlockedWeapons || [];
  }

  /**
   * 선택된 스테이지 ID를 저장한다.
   * @param {string} stageId - 스테이지 ID
   */
  static setSelectedStage(stageId) {
    const data = SaveManager.getData();
    data.selectedStage = stageId;
    SaveManager.save();
  }

  /**
   * 선택된 스테이지 ID를 반환한다.
   * @returns {string} 스테이지 ID
   */
  static getSelectedStage() {
    return SaveManager.getData().selectedStage || 'stage_1';
  }

  // ── 캐릭터 클리어 ──

  /**
   * 캐릭터별 클리어를 기록한다.
   * @param {string} characterId - 캐릭터 ID
   */
  static addCharacterClear(characterId) {
    const data = SaveManager.getData();
    if (!data.characterClears) data.characterClears = {};
    data.characterClears[characterId] = (data.characterClears[characterId] || 0) + 1;
    SaveManager.save();
  }

  /**
   * 캐릭터별 클리어 횟수를 반환한다.
   * @param {string} characterId - 캐릭터 ID
   * @returns {number} 클리어 횟수
   */
  static getCharacterClearCount(characterId) {
    const data = SaveManager.getData();
    return (data.characterClears && data.characterClears[characterId]) || 0;
  }

  /**
   * 전체 캐릭터 클리어 데이터를 반환한다.
   * @returns {Object} { characterId: clearCount }
   */
  static getCharacterClears() {
    return SaveManager.getData().characterClears || {};
  }

  // ── 컷신 ──

  /**
   * 컷신을 시청 완료로 기록한다.
   * @param {string} cutsceneId - 컷신 ID
   */
  static viewCutscene(cutsceneId) {
    const data = SaveManager.getData();
    if (!data.cutscenesSeen) data.cutscenesSeen = {};
    data.cutscenesSeen[cutsceneId] = true;
    SaveManager.save();
  }

  /**
   * 특정 컷신을 이미 시청했는지 확인한다.
   * @param {string} cutsceneId - 컷신 ID
   * @returns {boolean}
   */
  static isCutsceneViewed(cutsceneId) {
    const data = SaveManager.getData();
    return !!(data.cutscenesSeen && data.cutscenesSeen[cutsceneId]);
  }

  // ── 메타 업그레이드 해금 ──

  /**
   * 메타 업그레이드(연구소)가 해금되었는지 확인한다.
   * @returns {boolean}
   */
  static isUpgradeUnlocked() {
    return SaveManager.getData().upgradeUnlocked === true;
  }

  /**
   * 메타 업그레이드(연구소)를 해금 처리하고 세이브한다.
   */
  static setUpgradeUnlocked() {
    const data = SaveManager.getData();
    data.upgradeUnlocked = true;
    SaveManager.save();
  }

  // ── 메타 드론 해금 ──

  /**
   * 메타 드론 동반자가 해금되었는지 확인한다.
   * @returns {boolean}
   */
  static isDroneUnlocked() {
    return SaveManager.getData().droneUnlocked === true;
  }

  /**
   * 메타 드론 동반자를 해금 처리하고 세이브한다.
   */
  static setDroneUnlocked() {
    const data = SaveManager.getData();
    data.droneUnlocked = true;
    SaveManager.save();
  }

  /**
   * 드론 업그레이드의 현재 레벨을 반환한다.
   * @param {string} id - 드론 업그레이드 ID
   * @returns {number} 현재 레벨 (미구매 시 0)
   */
  static getDroneUpgradeLevel(id) {
    const data = SaveManager.getData();
    return (data.droneUpgrades && data.droneUpgrades[id]) || 0;
  }

  /**
   * 드론 업그레이드의 레벨을 설정한다.
   * @param {string} id - 드론 업그레이드 ID
   * @param {number} level - 설정할 레벨
   */
  static setDroneUpgradeLevel(id, level) {
    const data = SaveManager.getData();
    if (!data.droneUpgrades) data.droneUpgrades = {};
    data.droneUpgrades[id] = level;
    SaveManager.save();
  }

  // ── 초기화 ──

  /**
   * 전체 세이브 데이터를 초기화한다.
   * 확인 절차 없이 즉시 초기화하므로, 호출 전 확인 UI를 반드시 표시해야 한다.
   */
  static resetAll() {
    _data = SaveManager._deepCopy(DEFAULT_SAVE);
    SaveManager.save();
  }

  // ── 내부 유틸리티 ──

  /**
   * 저장된 데이터를 기본값과 깊은 병합한다.
   * 저장 데이터에 누락된 필드가 있으면 기본값으로 채운다.
   * @param {Object} saved - 저장된 데이터
   * @returns {Object} 병합된 데이터
   * @private
   */
  static _mergeWithDefaults(saved) {
    const base = SaveManager._deepCopy(DEFAULT_SAVE);

    // 1차 필드 병합
    for (const key of Object.keys(base)) {
      if (saved[key] === undefined) continue;

      if (typeof base[key] === 'object' && !Array.isArray(base[key]) && base[key] !== null) {
        // 객체 필드: 내부 키도 병합
        base[key] = { ...base[key], ...saved[key] };
      } else {
        base[key] = saved[key];
      }
    }

    // collection 배열 필드는 저장 데이터 우선
    if (saved.collection) {
      for (const arrKey of Object.keys(DEFAULT_SAVE.collection)) {
        if (Array.isArray(saved.collection[arrKey])) {
          base.collection[arrKey] = saved.collection[arrKey];
        }
      }
    }

    return base;
  }

  /**
   * 객체를 깊은 복사한다.
   * @param {Object} obj - 복사할 객체
   * @returns {Object} 복사된 객체
   * @private
   */
  static _deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 데이터 버전 마이그레이션을 수행한다.
   * 현재 v1만 존재하므로 바로 반환. 이후 버전 추가 시 체인 방식으로 확장한다.
   * @param {Object} data - 마이그레이션할 데이터
   * @returns {Object} 마이그레이션 완료된 데이터
   * @private
   */
  static _migrate(data) {
    // v1 → v2: totalBossKills 추가
    if (data.version < 2) {
      if (!data.stats) data.stats = {};
      if (data.stats.totalBossKills === undefined) {
        data.stats.totalBossKills = 0;
      }
      data.version = 2;
    }

    // v2 → v3: totalSurviveMinutes 추가
    if (data.version < 3) {
      if (!data.stats) data.stats = {};
      if (data.stats.totalSurviveMinutes === undefined) {
        data.stats.totalSurviveMinutes = 0;
      }
      data.version = 3;
    }

    // v3 → v4: 자동 사냥(Auto Hunt) IAP 필드 추가
    if (data.version < 4) {
      if (data.autoHuntUnlocked === undefined) {
        data.autoHuntUnlocked = false;
      }
      if (data.autoHuntEnabled === undefined) {
        data.autoHuntEnabled = false;
      }
      data.version = 4;
    }

    // v4 → v5: 멀티 스테이지 + 무기 해금 필드 추가
    if (data.version < 5) {
      if (!data.stageClears) data.stageClears = {};
      if (!data.unlockedWeapons) data.unlockedWeapons = [];
      if (!data.selectedStage) data.selectedStage = 'stage_1';
      data.version = 5;
    }

    // v5 → v6: 설정 메뉴 (햅틱/BGM/SFX 토글) 필드 추가
    if (data.version < 6) {
      if (!data.settings) data.settings = {};
      if (data.settings.hapticEnabled === undefined) data.settings.hapticEnabled = true;
      if (data.settings.bgmEnabled === undefined) data.settings.bgmEnabled = true;
      if (data.settings.sfxEnabled === undefined) data.settings.sfxEnabled = true;
      data.version = 6;
    }

    // v6 → v7: 도전과제 100개 확장 — characterClears, totalMinibossKills 추가
    if (data.version < 7) {
      if (!data.characterClears) data.characterClears = {};
      if (!data.stats) data.stats = {};
      if (data.stats.totalMinibossKills === undefined) {
        data.stats.totalMinibossKills = 0;
      }
      data.version = 7;
    }

    // v7 → v8: 컷신 시청 기록 필드 추가
    if (data.version < 8) {
      if (!data.cutscenesSeen) data.cutscenesSeen = {};
      data.version = 8;
    }

    // v8 → v9: 메타 업그레이드 해금 상태 추가
    // 기존 유저는 1스테이지 플레이 이력이 있으면 자동 해금 (버튼 미표시 방지)
    if (data.version < 9) {
      const hasPlayed = (data.stageClears && Object.keys(data.stageClears).length > 0) ||
                        (data.stats && data.stats.totalRuns > 0);
      data.upgradeUnlocked = !!hasPlayed;
      data.version = 9;
    }

    // v9 → v10: 메타 드론 동반자 해금 + 드론 업그레이드 필드 추가
    // 기존 유저: 스테이지 2 이상 클리어 이력이 있으면 드론 자동 해금
    if (data.version < 10) {
      const hasStage2 = data.stageClears && (
        data.stageClears['stage_2'] > 0 ||
        data.stageClears['stage_3'] > 0 ||
        data.stageClears['stage_4'] > 0
      );
      data.droneUnlocked = !!hasStage2;
      if (!data.droneUpgrades) data.droneUpgrades = {};
      data.version = 10;
    }

    data.version = SAVE_DATA_VERSION;
    return data;
  }
}
