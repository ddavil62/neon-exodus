/**
 * @fileoverview IAPManager - Google Play 인앱결제(IAP) 관리자.
 * @nicegram/capacitor-iap 또는 기본 Capacitor 인앱결제 플러그인을 래핑한다.
 * 웹(브라우저/Playwright) 환경에서는 Mock 모드로 동작하여 오류 없이 실행된다.
 * 구매 상태는 SaveManager를 통해 로컬스토리지에도 이중 저장한다.
 */

import { IAP_PRODUCTS } from '../config.js';
import { SaveManager } from './SaveManager.js';

// ── IAPManagerClass 클래스 ──

/**
 * Google Play 인앱결제 생명주기 관리자.
 * 네이티브(Capacitor) 환경에서는 실제 IAP 플러그인을 호출하고,
 * 웹 환경에서는 Mock 모드로 즉시 resolve한다.
 * 싱글톤 인스턴스로 export된다.
 */
class IAPManagerClass {
  /**
   * IAPManager 인스턴스를 생성한다.
   * Capacitor 네이티브 플랫폼 여부를 감지하여 Mock 모드를 결정한다.
   */
  constructor() {
    /** @type {boolean} Mock 모드 여부 (웹 환경이면 true) */
    this.isMock = true;

    /** @type {object|null} InAppPurchase 플러그인 참조 */
    this._iap = null;

    /** @type {boolean} 구매 진행 중 여부 (중복 호출 차단용) */
    this.isBusy = false;

    /** @type {boolean} 초기화 완료 여부 */
    this._initialized = false;

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
   * IAP 플러그인을 초기화한다.
   * Mock 모드에서는 즉시 resolve한다.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    if (this.isMock) {
      console.log('[IAPManager] Mock 모드로 초기화 (웹 환경)');
      this._initialized = true;
      return;
    }

    try {
      // Capacitor 전역 플러그인 브리지에서 InAppPurchase 참조 (번들러 없이 동작)
      const InAppPurchase = window.Capacitor?.Plugins?.InAppPurchase;
      if (!InAppPurchase) {
        throw new Error('InAppPurchase 플러그인이 Capacitor에 등록되지 않음');
      }
      this._iap = InAppPurchase;

      this._initialized = true;
      console.log('[IAPManager] IAP 초기화 완료');
    } catch (e) {
      // 초기화 실패 시 Mock 모드로 폴백
      console.warn('[IAPManager] IAP 초기화 실패, Mock 모드로 폴백:', e.message);
      this.isMock = true;
      this._initialized = true;
    }
  }

  // ── 구매 ──

  /**
   * 영구 상품을 구매한다.
   * Mock 모드에서는 즉시 `{ purchased: true }` resolve한다.
   * 실패 시 reject하지 않고 `{ purchased: false, error }` resolve한다.
   * @param {string} productId - Google Play 상품 ID
   * @returns {Promise<{purchased: boolean, error?: string}>} 구매 결과
   */
  async purchase(productId) {
    // 중복 호출 방지
    if (this.isBusy) {
      return { purchased: false, error: 'busy' };
    }

    this.isBusy = true;

    if (this.isMock) {
      console.log(`[IAPManager] Mock: 구매 스킵 (purchased: true) - ${productId}`);
      this.isBusy = false;
      return { purchased: true };
    }

    try {
      // Google Play Billing 구매 요청
      const result = await this._iap.purchase({ productId, productType: 'inapp' });
      console.log('[IAPManager] 구매 완료:', result);

      // 구매 확인(acknowledge) — 소모형이 아닌 영구 상품
      if (result && result.purchaseToken) {
        await this._iap.acknowledgePurchase({
          purchaseToken: result.purchaseToken,
        });
      }

      return { purchased: true };
    } catch (e) {
      console.warn('[IAPManager] 구매 실패:', e.message);
      return { purchased: false, error: e.message };
    } finally {
      this.isBusy = false;
    }
  }

  // ── 구매 복원 ──

  /**
   * 이전 구매 내역을 복원한다.
   * Google Play에서 소유한 인앱 상품 목록을 조회하고,
   * 자동 사냥 상품이 있으면 SaveManager에 기록한다.
   * @returns {Promise<{restored: boolean, error?: string}>} 복원 결과
   */
  async restorePurchases() {
    if (this.isMock) {
      console.log('[IAPManager] Mock: 복원 스킵');
      return { restored: false };
    }

    try {
      const result = await this._iap.getPurchases({ productType: 'inapp' });
      const purchases = result?.purchases || [];

      let autoHuntRestored = false;

      for (const purchase of purchases) {
        if (purchase.productId === IAP_PRODUCTS.autoHunt) {
          autoHuntRestored = true;
        }
      }

      if (autoHuntRestored) {
        // SaveManager에 해금 상태 기록
        const data = SaveManager.getData();
        data.autoHuntUnlocked = true;
        SaveManager.save();
      }

      return { restored: autoHuntRestored };
    } catch (e) {
      console.warn('[IAPManager] 복원 실패:', e.message);
      return { restored: false, error: e.message };
    }
  }

  // ── 해금 상태 확인 ──

  /**
   * 자동 사냥 기능이 해금되었는지 확인한다.
   * SaveManager에서 영구 저장된 상태를 읽는다.
   * @returns {boolean} 해금 여부
   */
  isAutoHuntUnlocked() {
    return SaveManager.getData().autoHuntUnlocked === true;
  }

  /**
   * 자동 사냥 기능을 해금 처리하고 세이브한다.
   */
  unlockAutoHunt() {
    const data = SaveManager.getData();
    data.autoHuntUnlocked = true;
    SaveManager.save();
  }
}

/** 싱글톤 IAPManager 인스턴스 */
export const IAPManager = new IAPManagerClass();
