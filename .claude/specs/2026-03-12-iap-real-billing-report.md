# Implementation Report: IAP 실제 Google Play Billing 연동

## 작업 요약
`@capgo/native-purchases` v8 플러그인을 도입하여 IAPManager.js의 인앱결제 로직을 실제 Google Play Billing으로 교체하였다. 번들러 미사용 환경에 맞게 `window.Capacitor.Plugins.NativePurchases` 전역 접근 방식을 적용하고, CI 워크플로우의 중복 Billing Library 주입 단계를 제거하였다.

## 변경된 파일
| 파일 경로 | 작업 유형 | 변경 내용 |
|---|---|---|
| `neon-exodus/package.json` | 수정 | `@capgo/native-purchases: ^8.2.2` dependencies에 추가 |
| `neon-exodus/js/managers/IAPManager.js` | 수정 | InAppPurchase -> NativePurchases 전역 플러그인 참조로 전환, isBillingSupported/getProduct 프리로드, purchaseProduct API 사용, 취소 감지(/cancel/i), getLocalizedPrice() 메서드 추가, _productInfo 필드 추가 |
| `neon-exodus/js/scenes/MenuScene.js` | 수정 | QA FAIL 수정: 구매 취소 시 실패 메시지 표시 방지 (`else` → `else if (result.error !== 'cancelled')`) |
| `neon-exodus/.github/workflows/build-apk.yml` | 수정 | "Add Play Billing Library dependency" 단계 완전 제거 (플러그인 내부 포함으로 중복 방지) |
| `neon-exodus/package-lock.json` | 자동 갱신 | npm install에 의해 자동 갱신 |

## 스펙 대비 구현 상태
- [x] `@capgo/native-purchases` v8 설치 (npm install 완료)
- [x] `initialize()`: NativePurchases를 `window.Capacitor.Plugins`에서 전역 접근, `isBillingSupported()` 확인, `getProduct()`로 상품 프리로드
- [x] `purchase()`: `purchaseProduct({ productIdentifier, productType: 'inapp', quantity: 1 })` API 사용
- [x] 사용자 취소 감지: `/cancel/i` 정규식으로 에러 메시지 확인, `{ purchased: false, error: 'cancelled' }` 반환
- [x] `restorePurchases()`: `getPurchases({ productType: 'inapp' })` 사용, `purchase.productIdentifier`로 비교
- [x] `getLocalizedPrice()` 신규 메서드 추가
- [x] `_productInfo` 필드 추가 (constructor)
- [x] Mock 모드 폴백 로직 유지
- [x] CI build-apk.yml에서 Play Billing Library 중복 주입 단계 제거
- [x] 한국어 주석/JSDoc 유지

## 스펙과 다른 구현 사항
- 스펙에서는 `PURCHASE_TYPE` enum을 `await import('@capgo/native-purchases')`로 동적 import하고 `this._PURCHASE_TYPE`에 저장하도록 명시했으나, 사용자의 핵심 주의사항에 따라 ESM 동적 import 대신 **문자열 상수 `'inapp'`을 직접 사용**하였다. 번들러 미사용 프로젝트에서 ESM import는 동작하지 않으므로 이 변경은 필수적이다.
- `this._PURCHASE_TYPE` 필드는 불필요하게 되어 제거하였다.

## 빌드/린트 결과
- 빌드: PASS (`npm run build` -> `www/` 생성 성공)
- 린트: N/A (린트 설정 없음)

## 알려진 이슈
- 없음

## QA 참고사항
- 실제 Google Play 결제 테스트는 네이티브 Android 앱에서만 가능하며, Play Console 라이선스 테스터 계정이 필요하다.
- 웹/Playwright 환경에서는 Mock 모드로 동작하므로, Mock 모드 폴백이 정상 작동하는지 확인 가능하다.
- CI 빌드 성공 여부는 push 후 GitHub Actions에서 확인해야 한다.
- `getLocalizedPrice()`는 네이티브 환경에서 상품 정보 로드 성공 시에만 실제 가격을 반환하고, 그 외에는 `'$ 0.99'` 폴백을 반환한다.
