/**
 * @fileoverview IAPManager - Google Play 인앱결제(IAP) 관리자.
 * @capgo/native-purchases 플러그인을 통해 실제 Google Play Billing을 처리한다.
 * 웹(브라우저/Playwright) 환경에서는 Mock 모드로 동작하여 오류 없이 실행된다.
 * 구매 상태는 SaveManager를 통해 로컬스토리지에도 이중 저장한다.
 */

import { IAP_PRODUCTS } from '../config.js';
import { SaveManager } from './SaveManager.js';

// ── IAPManagerClass 클래스 ──

/**
 * Google Play 인앱결제 생명주기 관리자.
 * 네이티브(Capacitor) 환경에서는 @capgo/native-purchases 플러그인을 호출하고,
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

    /** @type {object|null} NativePurchases 플러그인 참조 */
    this._iap = null;

    /** @type {boolean} 구매 진행 중 여부 (중복 호출 차단용) */
    this.isBusy = false;

    /** @type {boolean} 초기화 완료 여부 */
    this._initialized = false;

    /** @type {object|null} 스토어에서 로드한 상품 정보 */
    this._productInfo = null;

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
   * NativePurchases 플러그인을 전역 Capacitor 브리지에서 가져오고,
   * isBillingSupported 확인 후 상품 정보를 프리로드한다.
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
      // Capacitor 전역 플러그인 브리지에서 NativePurchases 참조 (번들러 없이 동작)
      const NativePurchases = window.Capacitor?.Plugins?.NativePurchases;
      if (!NativePurchases) {
        throw new Error('NativePurchases 플러그인이 Capacitor에 등록되지 않음');
      }
      this._iap = NativePurchases;

      // Google Play Billing 지원 여부 확인
      const { isBillingSupported } = await this._iap.isBillingSupported();
      if (!isBillingSupported) {
        throw new Error('Google Play Billing 미지원 기기');
      }

      // 상품 정보 프리로드
      try {
        const { product } = await this._iap.getProduct({
          productIdentifier: IAP_PRODUCTS.autoHunt,
          productType: 'inapp',
        });
        this._productInfo = product; // { title, priceString, price, ... }
        console.log('[IAPManager] 상품 정보 로드 완료:', this._productInfo?.priceString);
      } catch {
        // 상품 로드 실패 시 무시 (구매 시도는 허용)
        console.warn('[IAPManager] 상품 정보 프리로드 실패 (구매는 계속 가능)');
        this._productInfo = null;
      }

      this._initialized = true;
      console.log('[IAPManager] IAP 초기화 완료 (NativePurchases)');
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
   * 사용자 취소 시 `{ purchased: false, error: 'cancelled' }` 반환한다.
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
      // Google Play Billing 구매 요청 (@capgo/native-purchases API)
      const result = await this._iap.purchaseProduct({
        productIdentifier: productId,
        productType: 'inapp',
        quantity: 1,
      });
      console.log('[IAPManager] 구매 완료:', result);

      // acknowledgePurchase 별도 호출 불필요 — 플러그인이 내부 처리
      return { purchased: true };
    } catch (e) {
      // 취소 감지: 에러 메시지에 'cancel' 포함 여부 확인
      const isCancel = /cancel/i.test(e.message || '');
      if (isCancel) {
        console.log('[IAPManager] 사용자가 구매를 취소함');
        return { purchased: false, error: 'cancelled' };
      }

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
      const { purchases } = await this._iap.getPurchases({
        productType: 'inapp',
      });

      let autoHuntRestored = false;

      for (const purchase of (purchases || [])) {
        // @capgo/native-purchases는 productIdentifier 필드를 사용
        if (purchase.productIdentifier === IAP_PRODUCTS.autoHunt) {
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

  // ── 가격 정보 ──

  /**
   * 스토어에서 가져온 현지화 가격 문자열을 반환한다.
   * 상품 정보가 없으면 폴백 문자열을 반환한다.
   * @returns {string} 현지화 가격 (예: "₩1,100", "$0.99")
   */
  getLocalizedPrice() {
    return this._productInfo?.priceString ?? '$ 0.99';
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
