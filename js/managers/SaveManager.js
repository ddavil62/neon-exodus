/**
 * @fileoverview 로컬스토리지 기반 세이브/로드 매니저.
 * 게임 진행 데이터(크레딧, 업그레이드, 도전과제 등)를 로컬스토리지에 저장/복원한다.
 * 모든 데이터 접근은 static 메서드를 통해 이루어진다.
 */

import { SAVE_KEY, SAVE_DATA_VERSION, CHIP_MAX_INVENTORY } from '../config.js';
import { MAX_CHAR_LEVEL, getXpForNextLevel, canInvestUlt, CHARACTER_SKILLS } from '../data/characterSkills.js';
import { CHIP_GRADES, CHIP_DEFINITIONS, getChipDef, getGradeInfo, getNextGrade } from '../data/droneChips.js';

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
  stageClears: {},          // { stageId: { normal: n, hard: n, nightmare: n } }
  selectedDifficulty: 'normal',  // 선택된 난이도
  unlockedWeapons: [],      // 스테이지 해금 무기 ID 배열
  selectedStage: 'stage_1', // 선택된 스테이지 ID
  characterClears: {},      // { characterId: 클리어 횟수 }
  characterProgression: {   // 캐릭터 레벨 & 스킬 시스템
    agent:     { xp: 0, level: 1, sp: 0, skills: { Q: 1, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
    sniper:    { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
    engineer:  { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
    berserker: { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
    medic:     { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
    hidden:    { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 }, totalDcEarned: 0 },
  },
  droneChipUnlocked: false, // 드론 칩 시스템 해금 여부
  droneChipInventory: [],   // 보유 칩 배열 [{ uid, chipId, grade }]
  droneChipDust: 0,         // 칩 가루 (합성/변환 재화)
  equippedChips: {           // 드론별 장착 칩 { 드론인덱스: uid 또는 null }
    0: null,
    1: null,
    2: null,
  },
  scrap: 0,                 // 스크랩 (상점 구매용 연화)
  crystal: 0,               // 크리스탈 (프리미엄 경화, 향후 용도)
  shopRotation: {            // 상점 로테이션 상태
    lastRotationTime: 0,
    slots: [],
  },
  dailyMissions: {          // 일일 미션 시스템
    date: '',
    seed: 0,
    missions: [],
    bonusClaimed: false,
    streak: 0,
    totalCompleted: 0,
    charsUsedToday: [],
  },
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
    // 캐릭터 레벨/스킬 시스템 초기화
    SaveManager.initCharacterOnUnlock(id);
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
   * 개별 설정 값을 반환한다.
   * @param {string} key - 설정 키
   * @returns {*} 설정 값 (없으면 undefined)
   */
  static getSetting(key) {
    return SaveManager.getData().settings[key];
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
   * 스테이지 클리어를 등록한다. 해당 난이도의 클리어 횟수를 1 증가시킨다.
   * @param {string} stageId - 스테이지 ID
   * @param {string} [difficulty='normal'] - 난이도 ('normal' | 'hard' | 'nightmare')
   */
  static clearStage(stageId, difficulty = 'normal') {
    const data = SaveManager.getData();
    if (!data.stageClears) data.stageClears = {};
    if (!data.stageClears[stageId]) {
      data.stageClears[stageId] = { normal: 0, hard: 0, nightmare: 0 };
    }
    // 구버전 호환: 숫자면 객체로 변환
    if (typeof data.stageClears[stageId] === 'number') {
      const old = data.stageClears[stageId];
      data.stageClears[stageId] = { normal: old, hard: 0, nightmare: 0 };
    }
    data.stageClears[stageId][difficulty] = (data.stageClears[stageId][difficulty] || 0) + 1;
    SaveManager.save();
  }

  /**
   * 스테이지 클리어 여부를 반환한다.
   * @param {string} stageId - 스테이지 ID
   * @param {string} [difficulty='normal'] - 난이도 ('normal' | 'hard' | 'nightmare')
   * @returns {boolean} 클리어 여부
   */
  static isStageClear(stageId, difficulty = 'normal') {
    const data = SaveManager.getData();
    if (!data.stageClears || !data.stageClears[stageId]) return false;
    const entry = data.stageClears[stageId];
    // 구버전 호환: 숫자면 normal 기준
    if (typeof entry === 'number') return difficulty === 'normal' ? entry > 0 : false;
    return (entry[difficulty] || 0) > 0;
  }

  /**
   * 스테이지 클리어 횟수를 반환한다.
   * difficulty가 null이면 전 난이도 합산값을 반환한다.
   * @param {string} stageId - 스테이지 ID
   * @param {string|null} [difficulty=null] - 난이도 (null이면 전 난이도 합산)
   * @returns {number} 클리어 횟수
   */
  static getStageClearCount(stageId, difficulty = null) {
    const data = SaveManager.getData();
    if (!data.stageClears || !data.stageClears[stageId]) return 0;
    const entry = data.stageClears[stageId];
    // 구버전 호환: 숫자면 그대로 반환
    if (typeof entry === 'number') {
      return difficulty === null || difficulty === 'normal' ? entry : 0;
    }
    if (difficulty === null) {
      return (entry.normal || 0) + (entry.hard || 0) + (entry.nightmare || 0);
    }
    return entry[difficulty] || 0;
  }

  // ── 난이도 ──

  /**
   * 현재 선택된 난이도를 반환한다.
   * @returns {string} 난이도 문자열 ('normal' | 'hard' | 'nightmare')
   */
  static getSelectedDifficulty() {
    return SaveManager.getData().selectedDifficulty || 'normal';
  }

  /**
   * 선택된 난이도를 저장한다.
   * @param {string} diff - 난이도 문자열 ('normal' | 'hard' | 'nightmare')
   */
  static setSelectedDifficulty(diff) {
    const data = SaveManager.getData();
    data.selectedDifficulty = diff;
    SaveManager.save();
  }

  /**
   * 해당 스테이지에서 특정 난이도가 해금되었는지 확인한다.
   * normal은 항상 해금, hard는 normal 클리어 시, nightmare는 hard 클리어 시 해금.
   * @param {string} stageId - 스테이지 ID
   * @param {string} difficulty - 난이도 ('normal' | 'hard' | 'nightmare')
   * @returns {boolean} 해금 여부
   */
  static isDifficultyUnlocked(stageId, difficulty) {
    if (difficulty === 'normal') return true;
    if (difficulty === 'hard') return SaveManager.isStageClear(stageId, 'normal');
    if (difficulty === 'nightmare') return SaveManager.isStageClear(stageId, 'hard');
    return false;
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

  // ── 드론 칩 시스템 ──

  /**
   * 드론 칩 시스템이 해금되었는지 확인한다.
   * @returns {boolean}
   */
  static isDroneChipUnlocked() {
    return SaveManager.getData().droneChipUnlocked === true;
  }

  /**
   * 드론 칩 시스템을 해금 처리하고 세이브한다.
   */
  static setDroneChipUnlocked() {
    const data = SaveManager.getData();
    data.droneChipUnlocked = true;
    SaveManager.save();
  }

  /**
   * 드론 칩 인벤토리를 반환한다.
   * @returns {Array<{uid: string, chipId: string, grade: string}>}
   */
  static getDroneChipInventory() {
    const data = SaveManager.getData();
    if (!data.droneChipInventory) data.droneChipInventory = [];
    return data.droneChipInventory;
  }

  /**
   * 인벤토리에 칩을 추가한다. uid를 자동 생성한다.
   * @param {string} chipId - 칩 ID
   * @param {string} grade - 등급 ('C'|'B'|'A'|'S')
   * @returns {string|null} 생성된 uid (인벤토리 초과 시 null)
   */
  static addChip(chipId, grade) {
    const data = SaveManager.getData();
    if (!data.droneChipInventory) data.droneChipInventory = [];
    if (data.droneChipInventory.length >= CHIP_MAX_INVENTORY) return null;

    const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    data.droneChipInventory.push({ uid, chipId, grade });
    SaveManager.save();
    return uid;
  }

  /**
   * 인벤토리에서 칩을 제거한다.
   * @param {string} uid - 칩 고유 ID
   * @returns {boolean} 성공 여부
   */
  static removeChip(uid) {
    const data = SaveManager.getData();
    if (!data.droneChipInventory) return false;
    const idx = data.droneChipInventory.findIndex(c => c.uid === uid);
    if (idx < 0) return false;
    data.droneChipInventory.splice(idx, 1);
    SaveManager.save();
    return true;
  }

  /**
   * 장착 상태를 반환한다.
   * @returns {{0: string|null, 1: string|null, 2: string|null}}
   */
  static getEquippedChips() {
    const data = SaveManager.getData();
    if (!data.equippedChips) data.equippedChips = { 0: null, 1: null, 2: null };
    return data.equippedChips;
  }

  /**
   * 드론에 칩을 장착한다.
   * @param {number} droneIndex - 드론 인덱스 (0~2)
   * @param {string} uid - 칩 uid
   * @returns {boolean} 성공 여부
   */
  static equipChip(droneIndex, uid) {
    const data = SaveManager.getData();
    if (!data.equippedChips) data.equippedChips = { 0: null, 1: null, 2: null };

    // 다른 드론에 이미 장착된 칩이면 실패
    for (const key of Object.keys(data.equippedChips)) {
      if (data.equippedChips[key] === uid) return false;
    }

    // 인벤토리에 존재하는지 확인
    const inv = SaveManager.getDroneChipInventory();
    if (!inv.find(c => c.uid === uid)) return false;

    data.equippedChips[droneIndex] = uid;
    SaveManager.save();
    return true;
  }

  /**
   * 드론에서 칩을 해제한다.
   * @param {number} droneIndex - 드론 인덱스 (0~2)
   */
  static unequipChip(droneIndex) {
    const data = SaveManager.getData();
    if (!data.equippedChips) data.equippedChips = { 0: null, 1: null, 2: null };
    data.equippedChips[droneIndex] = null;
    SaveManager.save();
  }

  /**
   * 칩 가루 수량을 반환한다.
   * @returns {number}
   */
  static getDroneChipDust() {
    const data = SaveManager.getData();
    return data.droneChipDust || 0;
  }

  /**
   * 칩 가루를 추가(또는 차감)한다.
   * @param {number} amount - 추가할 양 (음수면 차감)
   */
  static addDroneChipDust(amount) {
    const data = SaveManager.getData();
    data.droneChipDust = Math.max(0, (data.droneChipDust || 0) + amount);
    SaveManager.save();
  }

  /**
   * 칩을 분해하여 가루를 획득한다. 장착 중인 칩은 분해 불가.
   * @param {string} uid - 칩 uid
   * @returns {number} 획득 가루량 (실패 시 0)
   */
  static dismantleChip(uid) {
    const data = SaveManager.getData();
    const inv = SaveManager.getDroneChipInventory();
    const chip = inv.find(c => c.uid === uid);
    if (!chip) return 0;

    // 장착 중인지 확인
    const equipped = SaveManager.getEquippedChips();
    for (const key of Object.keys(equipped)) {
      if (equipped[key] === uid) return 0;
    }

    const gradeInfo = getGradeInfo(chip.grade);
    if (!gradeInfo) return 0;

    const dustGain = gradeInfo.dustOnDismantle;
    SaveManager.removeChip(uid);
    SaveManager.addDroneChipDust(dustGain);
    return dustGain;
  }

  /**
   * 동일 종류+등급 칩 3개를 합성하여 상위 등급 칩 1개를 생성한다.
   * @param {string} uid1 - 칩 1 uid
   * @param {string} uid2 - 칩 2 uid
   * @param {string} uid3 - 칩 3 uid
   * @returns {string|null} 생성된 칩 uid (실패 시 null)
   */
  static synthesizeChips(uid1, uid2, uid3) {
    const inv = SaveManager.getDroneChipInventory();
    const c1 = inv.find(c => c.uid === uid1);
    const c2 = inv.find(c => c.uid === uid2);
    const c3 = inv.find(c => c.uid === uid3);
    if (!c1 || !c2 || !c3) return null;

    // 동일 종류+등급 검증
    if (c1.chipId !== c2.chipId || c1.chipId !== c3.chipId) return null;
    if (c1.grade !== c2.grade || c1.grade !== c3.grade) return null;

    // 장착 중 검증
    const equipped = SaveManager.getEquippedChips();
    const equippedUids = Object.values(equipped);
    if (equippedUids.includes(uid1) || equippedUids.includes(uid2) || equippedUids.includes(uid3)) return null;

    // 다음 등급 존재 확인
    const nextGrade = getNextGrade(c1.grade);
    if (!nextGrade) return null;

    // 합성 비용 확인
    const nextGradeInfo = getGradeInfo(nextGrade);
    if (!nextGradeInfo || nextGradeInfo.synthesizeCost === null) return null;

    const cost = nextGradeInfo.synthesizeCost;
    if (SaveManager.getDroneChipDust() < cost) return null;

    // 재료 제거 + 비용 차감 + 결과물 생성
    SaveManager.removeChip(uid1);
    SaveManager.removeChip(uid2);
    SaveManager.removeChip(uid3);
    SaveManager.addDroneChipDust(-cost);
    return SaveManager.addChip(c1.chipId, nextGrade);
  }

  /**
   * 칩을 동일 등급 랜덤 다른 종류로 변환한다. 장착 중 불가.
   * @param {string} uid - 칩 uid
   * @returns {string|null} 변환된 칩 uid (실패 시 null)
   */
  static convertChip(uid) {
    const inv = SaveManager.getDroneChipInventory();
    const chip = inv.find(c => c.uid === uid);
    if (!chip) return null;

    // 장착 중 검증
    const equipped = SaveManager.getEquippedChips();
    for (const key of Object.keys(equipped)) {
      if (equipped[key] === uid) return null;
    }

    const gradeInfo = getGradeInfo(chip.grade);
    if (!gradeInfo) return null;

    const cost = gradeInfo.convertCost;
    if (SaveManager.getDroneChipDust() < cost) return null;

    // 자기 종류 제외 랜덤 선택
    const otherChips = CHIP_DEFINITIONS.filter(c => c.id !== chip.chipId);
    if (otherChips.length === 0) return null;
    const newChipDef = otherChips[Math.floor(Math.random() * otherChips.length)];

    // 원본 제거 + 비용 차감 + 새 칩 생성
    SaveManager.removeChip(uid);
    SaveManager.addDroneChipDust(-cost);
    return SaveManager.addChip(newChipDef.id, chip.grade);
  }

  // ── 스크랩 (상점 재화) ──

  /**
   * 현재 스크랩을 반환한다.
   * @returns {number} 스크랩 수량
   */
  static getScrap() {
    return SaveManager.getData().scrap || 0;
  }

  /**
   * 스크랩을 추가(또는 차감)한다.
   * @param {number} amount - 추가할 양 (음수면 차감)
   */
  static addScrap(amount) {
    const data = SaveManager.getData();
    data.scrap = Math.max(0, (data.scrap || 0) + amount);
    SaveManager.save();
  }

  /**
   * 스크랩을 소비한다. 잔액 부족 시 실패.
   * @param {number} amount - 소비할 양
   * @returns {boolean} 성공 여부
   */
  static spendScrap(amount) {
    const data = SaveManager.getData();
    const current = data.scrap || 0;
    if (amount > current) return false;
    data.scrap = current - amount;
    SaveManager.save();
    return true;
  }

  // ── 크리스탈 (프리미엄 재화) ──

  /**
   * 현재 크리스탈을 반환한다.
   * @returns {number} 크리스탈 수량
   */
  static getCrystal() {
    return SaveManager.getData().crystal || 0;
  }

  /**
   * 크리스탈을 추가(또는 차감)한다.
   * @param {number} amount - 추가할 양 (음수면 차감)
   */
  static addCrystal(amount) {
    const data = SaveManager.getData();
    data.crystal = Math.max(0, (data.crystal || 0) + amount);
    SaveManager.save();
  }

  // ── 상점 로테이션 ──

  /**
   * 상점 로테이션 데이터를 반환한다.
   * @returns {{ lastRotationTime: number, slots: Array }} 로테이션 데이터
   */
  static getShopRotation() {
    const data = SaveManager.getData();
    if (!data.shopRotation) {
      data.shopRotation = { lastRotationTime: 0, slots: [] };
    }
    return data.shopRotation;
  }

  /**
   * 상점 로테이션 데이터를 저장한다.
   * @param {Object} rotation - 로테이션 데이터
   */
  static setShopRotation(rotation) {
    const data = SaveManager.getData();
    data.shopRotation = rotation;
    SaveManager.save();
  }

  // ── 캐릭터 레벨 & 스킬 ──

  /**
   * 캐릭터의 레벨/XP/스킬 진행 데이터를 반환한다.
   * @param {string} charId - 캐릭터 ID
   * @returns {{ xp: number, level: number, sp: number, skills: { Q: number, W: number, E: number, R: number } }}
   */
  static getCharacterProgression(charId) {
    const data = SaveManager.getData();
    if (!data.characterProgression) data.characterProgression = {};
    if (!data.characterProgression[charId]) {
      data.characterProgression[charId] = { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 } };
    }
    return data.characterProgression[charId];
  }

  /**
   * 캐릭터에 XP(데이터코어)를 추가한다. 자동 레벨업 + SP 부여.
   * @param {string} charId - 캐릭터 ID
   * @param {number} amount - 추가할 XP 양
   * @returns {number} 발생한 레벨업 횟수
   */
  static addCharacterXP(charId, amount) {
    const prog = SaveManager.getCharacterProgression(charId);
    if (prog.level <= 0) return 0; // 미해금 캐릭터
    prog.xp += amount;
    let levelUps = 0;

    while (prog.level < MAX_CHAR_LEVEL) {
      const needed = getXpForNextLevel(prog.level);
      if (needed <= 0) break;
      if (prog.xp >= needed) {
        prog.xp -= needed;
        prog.level++;
        prog.sp++;
        levelUps++;
      } else {
        break;
      }
    }

    // 만렙이면 초과 XP 0으로 고정
    if (prog.level >= MAX_CHAR_LEVEL) {
      prog.xp = 0;
    }

    SaveManager.save();
    return levelUps;
  }

  /**
   * 캐릭터의 누적 DC 획득량을 증가시킨다.
   * @param {string} charId - 캐릭터 ID
   * @param {number} amount - 추가할 DC 양
   */
  static addCharacterDcEarned(charId, amount) {
    const prog = SaveManager.getCharacterProgression(charId);
    prog.totalDcEarned = (prog.totalDcEarned || 0) + amount;
    SaveManager.save();
  }

  /**
   * 스킬포인트 1개를 소비하여 해당 스킬을 1레벨 올린다.
   * @param {string} charId - 캐릭터 ID
   * @param {string} slot - 스킬 슬롯 ('Q' | 'W' | 'E' | 'R')
   * @returns {boolean} 성공 여부
   */
  static allocateSkillPoint(charId, slot) {
    const prog = SaveManager.getCharacterProgression(charId);
    if (prog.sp < 1) return false;

    const skillDef = CHARACTER_SKILLS[charId]?.[slot];
    if (!skillDef) return false;

    const currentLv = prog.skills[slot] || 0;
    if (currentLv >= skillDef.maxLevel) return false;

    // R 슬롯 게이트 체크
    if (slot === 'R' && !canInvestUlt(prog.level, currentLv)) return false;

    prog.skills[slot] = currentLv + 1;
    prog.sp--;
    SaveManager.save();
    return true;
  }

  /**
   * 미사용 스킬포인트를 반환한다.
   * @param {string} charId - 캐릭터 ID
   * @returns {number} 미사용 SP
   */
  static getAvailableSkillPoints(charId) {
    return SaveManager.getCharacterProgression(charId).sp;
  }

  /**
   * 특정 스킬의 현재 레벨을 반환한다.
   * @param {string} charId - 캐릭터 ID
   * @param {string} slot - 스킬 슬롯 ('Q' | 'W' | 'E' | 'R')
   * @returns {number} 스킬 레벨
   */
  static getSkillLevel(charId, slot) {
    return SaveManager.getCharacterProgression(charId).skills[slot] || 0;
  }

  /**
   * 캐릭터 해금 시 레벨/스킬 시스템을 초기화한다 (level:1, Q:1).
   * 이미 초기화된 경우(level>=1) 무시한다.
   * @param {string} charId - 캐릭터 ID
   */
  static initCharacterOnUnlock(charId) {
    const prog = SaveManager.getCharacterProgression(charId);
    if (prog.level >= 1) return; // 이미 초기화됨
    prog.level = 1;
    prog.skills.Q = 1;
  }

  // ── 일일 미션 ──

  /**
   * 일일 미션 데이터를 반환한다.
   * @returns {Object} dailyMissions 객체
   */
  static getDailyMissions() {
    const data = SaveManager.getData();
    if (!data.dailyMissions) {
      data.dailyMissions = {
        date: '', seed: 0, missions: [],
        bonusClaimed: false, streak: 0,
        totalCompleted: 0, charsUsedToday: [],
      };
    }
    return data.dailyMissions;
  }

  /**
   * 일일 미션 데이터를 저장한다.
   * @param {Object} missions - dailyMissions 객체
   */
  static setDailyMissions(missions) {
    const data = SaveManager.getData();
    data.dailyMissions = missions;
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

    // v10 → v11: 난이도 모드 — stageClears 구조 변환 + selectedDifficulty 추가
    if (data.version < 11) {
      // stageClears 구조 변환: { stage_1: 3 } → { stage_1: { normal: 3, hard: 0, nightmare: 0 } }
      if (data.stageClears) {
        const old = data.stageClears;
        const converted = {};
        for (const [stageId, count] of Object.entries(old)) {
          if (typeof count === 'number') {
            converted[stageId] = { normal: count, hard: 0, nightmare: 0 };
          } else {
            converted[stageId] = count; // 이미 변환됨
          }
        }
        data.stageClears = converted;
      }
      if (!data.selectedDifficulty) data.selectedDifficulty = 'normal';
      data.version = 11;
    }

    // v11 -> v12: 캐릭터 레벨 & 스킬 시스템 — characterProgression 추가
    if (data.version < 12) {
      data.characterProgression = {};
      const chars = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];
      chars.forEach(id => {
        const isUnlocked = data.characters?.[id] === true;
        data.characterProgression[id] = {
          xp: 0,
          level: isUnlocked ? 1 : 0,
          sp: 0,
          skills: { Q: isUnlocked ? 1 : 0, W: 0, E: 0, R: 0 },
        };
      });
      data.version = 12;
    }

    // v12 -> v13: 일일 미션 시스템 — dailyMissions 필드 추가
    if (data.version < 13) {
      data.dailyMissions = {
        date: '',
        seed: 0,
        missions: [],
        bonusClaimed: false,
        streak: 0,
        totalCompleted: 0,
        charsUsedToday: [],
      };
      data.version = 13;
    }

    // v13 -> v14: 캐릭터별 DC 누적 통계 — totalDcEarned 추가
    if (data.version < 14) {
      const chars = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];
      chars.forEach(id => {
        if (data.characterProgression?.[id]) {
          if (data.characterProgression[id].totalDcEarned === undefined) {
            data.characterProgression[id].totalDcEarned = 0;
          }
        }
      });
      data.version = 14;
    }

    // v14 -> v15: 드론 칩 시스템 필드 추가
    if (data.version < 15) {
      // 기존 유저: 3스테이지 클리어 이력이 있으면 자동 해금
      const hasStage3 = data.stageClears && data.stageClears['stage_3'] &&
        (data.stageClears['stage_3'].normal > 0 ||
         data.stageClears['stage_3'].hard > 0 ||
         data.stageClears['stage_3'].nightmare > 0);
      data.droneChipUnlocked = !!hasStage3;
      if (!data.droneChipInventory) data.droneChipInventory = [];
      if (data.droneChipDust === undefined) data.droneChipDust = 0;
      if (!data.equippedChips) data.equippedChips = { 0: null, 1: null, 2: null };
      data.version = 15;
    }

    // v15 -> v16: stats.totalClears를 stageClears 합산과 동기화
    // GameScene에서 clearStage()는 호출되었으나 ResultScene까지 도달하지 못해
    // stats.totalClears가 실제 클리어 수보다 적을 수 있는 문제 보정
    if (data.version < 16) {
      if (data.stageClears && data.stats) {
        let sumClears = 0;
        for (const entry of Object.values(data.stageClears)) {
          if (typeof entry === 'number') {
            sumClears += entry;
          } else if (entry && typeof entry === 'object') {
            sumClears += (entry.normal || 0) + (entry.hard || 0) + (entry.nightmare || 0);
          }
        }
        if ((data.stats.totalClears || 0) < sumClears) {
          data.stats.totalClears = sumClears;
        }
      }
      data.version = 16;
    }

    // v16 -> v17: 상점 시스템 — scrap, crystal, shopRotation 추가
    if (data.version < 17) {
      if (data.scrap === undefined) data.scrap = 0;
      if (data.crystal === undefined) data.crystal = 0;
      if (!data.shopRotation) {
        data.shopRotation = { lastRotationTime: 0, slots: [] };
      }
      data.version = 17;
    }

    data.version = SAVE_DATA_VERSION;
    return data;
  }
}
