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
  },
  collection: {
    weaponsSeen: ['blaster'],
    passivesSeen: [],
    enemiesSeen: [],
  },
  settings: {
    locale: 'ko',
    sfxVolume: 1,
    bgmVolume: 0.7,
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

    // 이후 버전 추가 시 체인 패턴:
    // if (data.version < 4) { ... data.version = 4; }

    data.version = SAVE_DATA_VERSION;
    return data;
  }
}
