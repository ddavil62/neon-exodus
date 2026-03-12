---
status: COMPLETED
completed: 2026-03-12
spec: .claude/specs/2026-03-12-iap-real-billing.md
report: .claude/specs/2026-03-12-iap-real-billing-report.md
qa: .claude/specs/2026-03-12-iap-real-billing-qa.md
---

# Feature: IAP 실제 Google Play Billing 연동 (auto_hunt)

## 개요

현재 `IAPManager.js`가 `window.Capacitor.Plugins.InAppPurchase` 플러그인이 없어 Mock 모드로 폴백되어, 자동 사냥 구매 버튼을 누르면 결제 다이얼로그 없이 즉시 해금된다. `@capgo/native-purchases` v8 플러그인을 도입하여 실제 Google Play Billing 결제 다이얼로그가 뜨도록 연동한다.

## 배경 및 동기

- Play Console에 `auto_hunt` (in-app product) 등록 완료, 상태 활성
- `IAPManager.js`는 네이티브 플러그인(`window.Capacitor.Plugins.InAppPurchase`)을 기대하지만 해당 플러그인이 설치되어 있지 않아 항상 Mock 모드로 동작
- Capacitor 8 (`@capacitor/core: ^8.1.0`) 기준으로 호환되는 IAP 플러그인이 필요
- `@capgo/native-purchases` v8.x는 `@capacitor/core >= 8.0.0`을 peer dep으로 요구하며, Google Play Billing Library 7.x를 내장 지원함
- 이미 `build-apk.yml`에서 Play Billing Library 7.1.1을 `build.gradle`에 주입 중이나, 플러그인 자체가 Billing Library를 내부적으로 의존하므로 CI 단계의 별도 주입은 제거한다 (중복 의존성 충돌 방지)
- `auto_hunt` 상품의 `purchaseOption ID = auto-hunt`는 Google Play 구독 상품에만 해당하는 개념이며, 이 상품은 일회성 인앱 상품(`PURCHASE_TYPE.INAPP`)이므로 `planIdentifier` 없이 구매 가능

## 요구사항

### 기능 요구사항

- [x] `@capgo/native-purchases` v8 (`latest`) 설치 — `npm install @capgo/native-purchases`
- [x] `IAPManager.js` 초기화 로직: `window.Capacitor.Plugins.InAppPurchase` 대신 `@capgo/native-purchases`의 `NativePurchases`를 동적 import로 로드 *(구현 시 번들러 미사용 환경 대응으로 `window.Capacitor.Plugins.NativePurchases` 전역 참조 방식으로 변경됨)*
- [x] `IAPManager.initialize()`: 네이티브 환경에서 `isBillingSupported()` 호출 후, `getProduct({ productIdentifier: 'auto_hunt', productType: PURCHASE_TYPE.INAPP })` 로 상품 정보(가격 문자열 등)를 프리로드하여 `this._productInfo`에 캐싱 *(구현 시 `PURCHASE_TYPE.INAPP` enum 대신 문자열 `'inapp'` 직접 사용)*
- [x] `IAPManager.purchase('auto_hunt')`: `NativePurchases.purchaseProduct({ productIdentifier: 'auto_hunt', productType: PURCHASE_TYPE.INAPP, quantity: 1 })` 호출 → 실제 Google Play 결제 다이얼로그 표시 → 성공 시 `{ purchased: true }` 반환 *(구현 시 `PURCHASE_TYPE.INAPP` 대신 문자열 `'inapp'` 사용)*
- [x] `IAPManager.restorePurchases()`: `NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP })` 호출 → 반환된 목록에서 `auto_hunt` 존재 확인 → 있으면 `SaveManager`에 `autoHuntUnlocked: true` 기록 (기존 로직과 동일한 결과) *(구현 시 문자열 `'inapp'` 사용)*
- [x] `IAPManager.getLocalizedPrice()`: `this._productInfo`에서 현지화 가격 문자열 반환, 없으면 폴백 문자열 반환
- [x] 사용자가 구매를 취소한 경우(`error.message`에 'cancel' 또는 'cancelled' 포함) `{ purchased: false, error: 'cancelled' }` 반환 — 실패 토스트 표시 안 함
- [x] 웹/Mock 모드 동작은 변경 없음 (브라우저/Playwright 환경에서는 즉시 `{ purchased: true }` 반환)

### 비기능 요구사항

- [x] CI(`build-apk.yml`)의 "Add Play Billing Library dependency" 단계 제거 — `@capgo/native-purchases`가 이미 Billing Library 7.x를 내부 의존성으로 포함하므로 중복 주입 불필요
- [x] `npm ci` 한 번으로 플러그인 설치 완료 가능해야 함 (CI 환경)
- [x] 기존 Mock 모드 폴백 로직 유지 (네이티브 플러그인 로드 실패 시 Mock으로 폴백)
- [x] 한국어 주석 및 JSDoc 유지 (CLAUDE.md 컨벤션 준수)

## 구현 상세

### 수정/생성할 파일

| 파일 경로 | 작업 유형 | 설명 |
|---|---|---|
| `neon-exodus/package.json` | 수정 | `@capgo/native-purchases` dependencies에 추가 |
| `neon-exodus/js/managers/IAPManager.js` | 수정 | 네이티브 구매 로직을 `@capgo/native-purchases` API로 교체 |
| `neon-exodus/.github/workflows/build-apk.yml` | 수정 | "Add Play Billing Library dependency" 단계 제거 |

### 각 파일별 변경사항

#### `neon-exodus/package.json`

`dependencies`에 추가:

```json
"@capgo/native-purchases": "^8.2.2"
```

#### `neon-exodus/js/managers/IAPManager.js`

**import 변경**: 기존 `window.Capacitor.Plugins.InAppPurchase` 방식 제거, `@capgo/native-purchases` 동적 import 도입

**`initialize()` 메서드 변경**:
```js
// 기존 (제거):
// const InAppPurchase = window.Capacitor?.Plugins?.InAppPurchase;

// 변경 후:
const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
this._iap = NativePurchases;
this._PURCHASE_TYPE = PURCHASE_TYPE;

// isBillingSupported 확인
const { isBillingSupported } = await this._iap.isBillingSupported();
if (!isBillingSupported) {
  throw new Error('Google Play Billing 미지원 기기');
}

// 상품 정보 프리로드
try {
  const { product } = await this._iap.getProduct({
    productIdentifier: IAP_PRODUCTS.autoHunt,
    productType: this._PURCHASE_TYPE.INAPP,
  });
  this._productInfo = product; // { title, priceString, price, ... }
} catch {
  // 상품 로드 실패 시 무시 (구매 시도는 허용)
  this._productInfo = null;
}
```

**`purchase(productId)` 메서드 변경**:
```js
// 기존 (제거):
// const result = await this._iap.purchase({ productId, productType: 'inapp' });

// 변경 후:
const result = await this._iap.purchaseProduct({
  productIdentifier: productId,
  productType: this._PURCHASE_TYPE.INAPP,
  quantity: 1,
});
// result: { transactionId, productIdentifier, ... }
// acknowledgePurchase 별도 호출 불필요 — 플러그인이 내부 처리
return { purchased: true };
```

**사용자 취소 처리** (`catch` 블록):
```js
// 취소 감지: 에러 메시지에 'cancel'/'cancelled'/'user canceled' 포함 여부 확인
const isCancel = /cancel/i.test(e.message || '');
if (isCancel) {
  return { purchased: false, error: 'cancelled' };
}
return { purchased: false, error: e.message };
```

**`restorePurchases()` 메서드 변경**:
```js
// 기존 (제거):
// const result = await this._iap.getPurchases({ productType: 'inapp' });

// 변경 후:
const { purchases } = await this._iap.getPurchases({
  productType: this._PURCHASE_TYPE.INAPP,
});
// purchases: Array<{ productIdentifier, transactionId, ... }>
for (const purchase of (purchases || [])) {
  if (purchase.productIdentifier === IAP_PRODUCTS.autoHunt) {
    autoHuntRestored = true;
  }
}
```

**신규 메서드 `getLocalizedPrice()` 추가**:
```js
/**
 * 스토어에서 가져온 현지화 가격 문자열을 반환한다.
 * 상품 정보가 없으면 폴백 문자열을 반환한다.
 * @returns {string} 현지화 가격 (예: "₩1,100", "$0.99")
 */
getLocalizedPrice() {
  return this._productInfo?.priceString ?? '$ 0.99';
}
```

**인스턴스 필드 추가** (constructor):
```js
/** @type {object|null} 스토어에서 로드한 상품 정보 */
this._productInfo = null;

/** @type {object|null} PURCHASE_TYPE enum 참조 */
this._PURCHASE_TYPE = null;
```

#### `neon-exodus/.github/workflows/build-apk.yml`

아래 단계 전체를 제거한다 (`@capgo/native-purchases`가 내부적으로 Billing Library를 포함하므로 중복 의존성 불필요):

```yaml
# 제거할 단계:
- name: Add Play Billing Library dependency
  working-directory: android/app
  run: |
    sed -i '/dependencies {/a\    implementation "com.android.billingclient:billing:7.1.1"' build.gradle
```

### 의존성

| 패키지 | 버전 | 유형 | 비고 |
|--------|------|------|------|
| `@capgo/native-purchases` | `^8.2.2` | dependencies | Capacitor 8 전용, Google Play Billing 7.x 내장 |

## 수용 기준 (Acceptance Criteria)

- [x] `npm install @capgo/native-purchases` 후 `npx cap sync android` 성공
- [x] Android 네이티브 앱에서 자동사냥 구매 버튼 탭 시 Google Play 결제 다이얼로그가 실제로 표시된다
- [x] 결제 성공 후 `autoHuntUnlocked: true`가 SaveManager에 저장되고, 다음 게임 실행 시 자동사냥 기능이 활성화된 상태로 시작된다
- [x] 결제 다이얼로그에서 취소 시 오류 토스트가 표시되지 않고 조용히 원래 화면으로 돌아온다
- [x] 앱 재설치 후 구매 복원(restorePurchases) 시 `auto_hunt` 구매 이력이 감지되어 `autoHuntUnlocked: true`가 복원된다
- [x] 웹(브라우저/Playwright) 환경에서 기존과 동일하게 Mock 모드로 동작한다 (`{ purchased: true }` 즉시 반환)
- [x] CI(`build-apk.yml`) 빌드가 성공한다 — Play Billing Library 중복 주입 단계 제거 후에도 정상 빌드

## 제약사항

- Android 전용 구현. iOS 지원 불필요 (`capacitor.config.json`에 iOS 플랫폼 미설정)
- `@capgo/native-purchases` 내부가 Play Billing Library를 이미 포함하므로 `build-apk.yml`에서 별도로 `billing:7.1.1`을 주입하지 않는다. 두 버전이 충돌할 경우 Gradle 빌드 오류 발생
- 서버사이드 영수증 검증 없음 — 클라이언트 측 트랜잭션 성공 여부만 확인 (향후 필요 시 추가)
- Play Console 라이선스 테스터 계정으로만 실 결제 테스트 가능 (일반 계정 테스트 시 실제 결제 발생)
- `www/` 디렉토리는 `npm run build` 빌드 아티팩트이므로 `js/` 소스만 수정 — 빌드 후 `www/`에 자동 반영

## 참고사항

- `@capgo/native-purchases` 공식 문서: https://capgo.app/docs/plugins/native-purchases/
- Capacitor 8 호환성 확인: `peerDependencies: { "@capacitor/core": ">=8.0.0" }` (v8.2.2 기준)
- merge-warband에서 동일 플러그인 v7.16.2로 `remove_ads` IAP 연동 완료 스펙 참고: `.claude/specs/2026-03-05-iap-real-billing.md`
- `auto_hunt` Play Console 상품 유형: 일회성 인앱 상품(non-consumable) → `PURCHASE_TYPE.INAPP`, `planIdentifier` 불필요
- `purchaseOption ID = auto-hunt`는 Play Console UI의 구독 base plan ID 개념이며, 일회성 상품에는 해당 없음
- Google Play Billing Library 내부 의존성: `@capgo/native-purchases` v8은 Billing Library 7.x를 내부(`android/build.gradle`)에서 선언하므로 별도 주입 시 Gradle 중복 충돌 발생 가능
