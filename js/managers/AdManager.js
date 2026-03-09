/**
 * @fileoverview AdManager - Google AdMob 보상형 광고 관리자.
 * @capacitor-community/admob 플러그인을 래핑하여 보상형 광고를 관리한다.
 * 웹(브라우저/Playwright) 환경에서는 Mock 모드로 동작하여 오류 없이 실행된다.
 * 일일 광고 시청 제한 카운터를 localStorage에 별도 키로 관리한다.
 */

import { AD_LIMITS } from '../config.js';

// ── localStorage 키 ──
/** @const {string} 일일 광고 카운터 저장 키 */
const AD_DAILY_LIMIT_KEY = 'neonExodus_adLimits';

// ── AdManagerClass 클래스 ──

/**
 * AdMob 보상형 광고 생명주기 관리자.
 * 네이티브(Capacitor) 환경에서는 실제 AdMob 플러그인을 호출하고,
 * 웹 환경에서는 Mock 모드로 즉시 resolve한다.
 * 싱글톤 인스턴스로 export된다.
 */
class AdManagerClass {
  /**
   * AdManager 인스턴스를 생성한다.
   * Capacitor 네이티브 플랫폼 여부를 감지하여 Mock 모드를 결정한다.
   */
  constructor() {
    /** @type {boolean} Mock 모드 여부 (웹 환경이면 true) */
    this.isMock = true;

    /** @type {object|null} AdMob 플러그인 참조 */
    this._admob = null;

    /** @type {boolean} 광고 표시 진행 중 여부 (중복 호출 차단용) */
    this.isBusy = false;

    /** @type {boolean} 초기화 완료 여부 */
    this._initialized = false;

    /** @type {object} 일일 광고 카운터 데이터 */
    this._dailyLimits = {};

    // localStorage에서 일일 제한 데이터 로드
    this._loadDailyLimits();

    // 플랫폼 감지: Capacitor 전역 객체가 있고 네이티브 플랫폼이면 실제 모드
    try {
      if (typeof window !== 'undefined' &&
          window.Capacitor &&
          window.Capacitor.isNativePlatform &&
          window.Capacitor.isNativePlatform()) {
        this.isMock = false;
      }
    } catch {
      // Capacitor 감지 실패 시 Mock 모드 유지
      this.isMock = true;
    }
  }

  // ── 초기화 ──

  /**
   * AdMob 플러그인을 초기화한다.
   * Mock 모드에서는 즉시 resolve한다.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    if (this.isMock) {
      console.log('[AdManager] Mock 모드로 초기화 (웹 환경)');
      this._initialized = true;
      return;
    }

    try {
      // Capacitor 전역 플러그인 브리지에서 AdMob 참조 (번들러 없이 동작)
      const AdMob = window.Capacitor.Plugins.AdMob;
      if (!AdMob) {
        throw new Error('AdMob 플러그인이 Capacitor에 등록되지 않음');
      }
      this._admob = AdMob;

      await this._admob.initialize({
        initializeForTesting: false,
      });

      this._initialized = true;
      console.log('[AdManager] AdMob 초기화 완료');
    } catch (e) {
      // 초기화 실패 시 Mock 모드로 폴백
      console.warn('[AdManager] AdMob 초기화 실패, Mock 모드로 폴백:', e.message);
      this.isMock = true;
      this._initialized = true;
    }
  }

  // ── 보상형 광고 ──

  /**
   * 보상형 광고를 준비하고 표시한다.
   * Mock 모드에서는 즉시 `{ rewarded: true }` resolve한다.
   * 실패 시 reject하지 않고 `{ rewarded: false, error }` resolve한다.
   * @param {string} adUnitId - 보상형 광고 단위 ID
   * @returns {Promise<{rewarded: boolean, error?: string}>} 보상 결과
   */
  async showRewarded(adUnitId) {
    // 중복 호출 방지
    if (this.isBusy) {
      return { rewarded: false, error: 'busy' };
    }

    this.isBusy = true;

    if (this.isMock) {
      console.log('[AdManager] Mock: 보상형 광고 스킵 (rewarded: true)');
      this.isBusy = false;
      return { rewarded: true };
    }

    try {
      await this._admob.prepareRewardVideoAd({
        adId: adUnitId,
      });
      const result = await this._admob.showRewardVideoAd();
      console.log('[AdManager] 보상형 광고 표시 완료:', result);
      return { rewarded: true };
    } catch (e) {
      console.warn('[AdManager] 보상형 광고 표시 실패:', e.message);
      return { rewarded: false, error: e.message };
    } finally {
      this.isBusy = false;
    }
  }

  // ── 일일 제한 관리 ──

  /**
   * 오늘 해당 광고 유형의 사용 횟수를 반환한다.
   * @param {string} adType - 광고 유형 ('creditDouble' | 'adRevive')
   * @returns {number} 오늘 사용 횟수
   */
  getDailyAdCount(adType) {
    this._ensureTodayData();
    return this._dailyLimits.counts[adType] || 0;
  }

  /**
   * 해당 광고 유형의 사용 횟수를 1 증가시키고 저장한다.
   * @param {string} adType - 광고 유형 ('creditDouble' | 'adRevive')
   */
  incrementDailyAdCount(adType) {
    this._ensureTodayData();
    if (!this._dailyLimits.counts[adType]) {
      this._dailyLimits.counts[adType] = 0;
    }
    this._dailyLimits.counts[adType] += 1;
    this._saveDailyLimits();
  }

  /**
   * 해당 광고 유형의 일일 제한에 도달했는지 확인한다.
   * @param {string} adType - 광고 유형 ('creditDouble' | 'adRevive')
   * @returns {boolean} 제한 도달 시 true
   */
  isAdLimitReached(adType) {
    const limit = AD_LIMITS[adType];
    if (limit === undefined) return false;
    return this.getDailyAdCount(adType) >= limit;
  }

  /**
   * 해당 광고 유형의 오늘 남은 시청 횟수를 반환한다.
   * @param {string} adType - 광고 유형 ('creditDouble' | 'adRevive')
   * @returns {number} 남은 횟수
   */
  getRemainingAdCount(adType) {
    const limit = AD_LIMITS[adType];
    if (limit === undefined) return 0;
    return Math.max(0, limit - this.getDailyAdCount(adType));
  }

  // ── 내부 헬퍼 ──

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식 문자열로 반환한다.
   * @returns {string} 날짜 문자열
   * @private
   */
  _getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 오늘 날짜가 저장된 날짜와 다르면 카운터를 초기화한다.
   * @private
   */
  _ensureTodayData() {
    const today = this._getToday();
    if (this._dailyLimits.date !== today) {
      this._dailyLimits = { date: today, counts: {} };
      this._saveDailyLimits();
    }
  }

  /**
   * localStorage에서 일일 제한 데이터를 로드한다.
   * @private
   */
  _loadDailyLimits() {
    try {
      const raw = localStorage.getItem(AD_DAILY_LIMIT_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.date && data.counts) {
          this._dailyLimits = data;
          return;
        }
      }
    } catch {
      // 파싱 실패 시 기본값 사용
    }
    this._dailyLimits = { date: this._getToday(), counts: {} };
  }

  /**
   * 일일 제한 데이터를 localStorage에 저장한다.
   * @private
   */
  _saveDailyLimits() {
    try {
      localStorage.setItem(AD_DAILY_LIMIT_KEY, JSON.stringify(this._dailyLimits));
    } catch {
      // localStorage 저장 실패 시 무시 (용량 초과 등)
    }
  }
}

/** 싱글톤 AdManager 인스턴스 */
export const AdManager = new AdManagerClass();
