# Changelog

## 2026-03-22 -- 무기 드롭 시스템: 시간 기반 스케줄에서 맵 탐색 배치 방식으로 전환

### 추가
- `js/config.js`에 `WEAPON_DROP_MARGIN`(100px), `WEAPON_DROP_MIN_DIST_FROM_PLAYER`(300px) 상수 추가
- `js/scenes/GameScene.js`에 `_placeWeaponOnMap()` 메서드 추가: create() 완료 시 맵 랜덤 위치에 스테이지 무기 단일 배치 (permanent=true)

### 변경
- `js/data/stages.js`에서 `WEAPON_DROP_SCHEDULE` 상수 및 JSDoc 완전 제거
- `js/scenes/GameScene.js`에서 `_checkWeaponDropSchedule()`, `_spawnWeaponDrop()` 메서드 제거, update() 내 호출 제거, `_weaponDropIndex` 상태 변수 제거
- `js/entities/WeaponDropItem.js` spawn() 내 +-80px 랜덤 오프셋 제거, `setPosition(x, y)` 직접 사용
- `js/config.js` AUTO_HUNT.weaponDropSearchRadius 400 -> 3000 (맵 전체 탐색 커버)

### 참고
- 스펙: `.claude/specs/2026-03-22-neon-exodus-map-weapon-drop.md`
- 구현 리포트: `.claude/specs/2026-03-22-neon-exodus-map-weapon-drop-report.md`
- QA: `.claude/specs/2026-03-22-neon-exodus-map-weapon-drop-qa.md`
- QA 결과: 수용기준 11/11 충족, 예외 시나리오 10/10 PASS, Playwright 24/24 전체 통과
- 변경 파일: `js/data/stages.js`, `js/config.js`, `js/entities/WeaponDropItem.js`, `js/scenes/GameScene.js` 총 4개
- 스펙 대비 차이: 없음. 스펙과 동일하게 구현됨
- 배치 위치: (100,100)~(1900,1900) 범위, 플레이어 시작 위치(1000,1000)에서 300px 이상 이격
- 폴백 위치: (100,100) -- 20회 재시도 초과 시 사용 (~1273px 이격으로 유효)
- AutoPilot 긴급 수집: permanent=true 드롭은 `_evaluateWeaponDropUrgent`에서 자동 스킵됨 (코드 미제거, 자연 비활성화)

## 2026-03-21 -- 진화 무기 전용 이펙트 비주얼

### 추가
- `js/scenes/BootScene.js`에 `_generateEvolvedEffectTextures()` 메서드 추가: 진화 전용 코드 생성 텍스처 10종 (effect_precision_cannon, effect_guardian_sphere, effect_nuke_missile, effect_nuke_explosion, effect_hivemind, effect_perpetual_emp, effect_phantom_strike, effect_bioplasma, effect_event_horizon, effect_death_blossom)
- `js/systems/WeaponSystem.js`에 `EVOLVED_TEXTURE_MAP` (9종), `EVOLVED_EXPLOSION_MAP` (1종), `EVOLVED_BEAM_COLOR` (2종) 상수 추가
- `js/systems/WeaponSystem.js`에 `_applyEvolvedTextures(weapon)` 메서드 추가: 진화 직후 활성 오브/블레이드/드론 스프라이트 즉시 텍스처 교체

### 변경
- `js/systems/WeaponSystem.js` 이펙트 스폰 함수 8곳에 진화 텍스처 분기 추가: `_rebuildOrbs`, `_fireMissile`, `_detonateMissile`, `_spawnDrones`, `_showSlashEffect`, `_spawnCloud`, `_spawnVortex`, `_rebuildBlades`, Projectile fire
- `js/systems/WeaponSystem.js` `_drawBeams()`/`_drawChainBeam()`에 EVOLVED_BEAM_COLOR 분기 추가 (ion_cannon: 0x6666FF, plasma_storm: 0xAA44FF)
- `js/systems/VFXSystem.js` `empRing()`/`empBurst()`에 evolvedId 파라미터 추가, perpetual_emp 시 보라(0xBB44FF) 텍스처/tint 분기

### 참고
- 스펙: `.claude/specs/2026-03-21-evolved-weapon-visuals.md`
- 목적 정의서: `.claude/specs/2026-03-21-evolved-weapon-visuals-purpose.md`
- 변경 파일: `js/scenes/BootScene.js`, `js/systems/WeaponSystem.js`, `js/systems/VFXSystem.js` 총 3개
- PNG 에셋 추가 없음. 전체 진화 이펙트를 BootScene 코드 생성 텍스처로 처리
- 스펙 대비 차이: 스펙에서 12행 계획(미사일 폭발 별도) -> 구현 시 10종 텍스처 + 2종 빔 색상 = 11종 진화 무기 전체 커버. EVOLVED_EXPLOSION_MAP 별도 상수로 nuke_missile 폭발 텍스처 관리

## 2026-03-20 -- 진화 무기 DPS + 후반 적 HP 리밸런스

### 변경
- `js/data/weapons.js` EVOLVED_WEAPONS 11종 스탯 하향:
  - Death Blossom: bladeCount 6->5, damage 110->60, tickInterval 130->210 (DPS 5,077->1,429)
  - Guardian Sphere: orbCount 5->4, tickDamage 38->28, tickInterval 250->280 (DPS 760->400)
  - Hivemind: droneCount 5->4, damage 55->40, cooldown 500->600 (DPS 550->267)
  - Plasma Storm: damage 80->60 (DPS 114->86)
  - Precision Cannon: damage 50->40 (DPS 357->286)
  - Phantom Strike: damage 165->110 (DPS 344->229)
  - Ion Cannon: tickDamage 40->30
  - Nuke Missile: damage 130->100
  - Bioplasma: tickDamage 35->25
  - Event Horizon: damage 115->85, pullDamage 35->25
  - Perpetual EMP: damage 95->70
- `js/data/enemies.js` 잡몹 10종 HP 2~3.3배 상향 (nano_drone 10->20, scout_bot 20->40, spark_drone 15->30, battle_robot 60->150, shield_drone 30->70, rush_bot 40->100, repair_bot 25->55, heavy_bot 120->400, teleport_drone 35->90, suicide_bot 50->150)
- `js/data/enemies.js` 미니보스 2종 HP 상향 (guardian_drone 300->1000, assault_mech 500->2000)
- `js/data/enemies.js` 보스 6종 HP 상향 (commander_drone 800->3000, siege_titan 1500->8000, core_processor 3000->30000, siege_titan_mk2 2000->12000, data_phantom 2500->16000, omega_core 5000->30000)

### 참고
- 스펙: `.claude/specs/2026-03-20-evolved-weapon-rebalance.md`
- 구현 리포트: `.claude/specs/2026-03-20-evolved-weapon-rebalance-report.md`
- QA: `.claude/specs/2026-03-20-evolved-weapon-rebalance-qa.md`
- QA 결과: 수용기준 5/5 충족, 예외 시나리오 10/10 PASS, Playwright 67/67 전체 통과
- 변경 파일: `js/data/weapons.js`, `js/data/enemies.js` 총 2개
- 상위 6종 합산 DPS: ~2,695 (기존 ~7,767에서 65% 하향)
- t=15분 core_processor(S1) 생존 시간: ~30.6초 (기존 ~1.5초), omega_core(S4): ~61.2초
- 스펙 대비 차이: core_processor HP 25,000->30,000 (QA에서 보스 half-scaling 고려 시 30초 미달 발견하여 상향)
- 불변 항목: config.js BASE_DIFFICULTY/ENEMY_SCALE_PER_MINUTE, 기본 무기(비진화) 스탯, 보스 specialAttacks 패턴, 스폰 타이밍

## 2026-03-20 -- 설정 메뉴: BGM/SFX/햅틱 ON/OFF 토글

### 추가
- `js/scenes/SettingsScene.js` 신규 생성: BGM/SFX/햅틱 세 항목 ON/OFF 토글 UI, 뒤로가기 버튼, ESC 키 리스너
- `js/main.js`에 SettingsScene import 및 scene 배열 등록
- `js/systems/SoundSystem.js`에 _bgmEnabled/_sfxEnabled/_lastBgmId static 필드, setBgmEnabled/setSfxEnabled/isBgmEnabled/isSfxEnabled 메서드 추가
- `js/managers/HapticManager.js`에 _enabled 모듈 변수, setHapticEnabled/isHapticEnabled export 함수 추가
- `js/i18n.js`에 settings.title/bgm/sfx/haptic/on/off 6키 ko/en 추가
- `js/managers/SaveManager.js` DEFAULT_SAVE.settings에 hapticEnabled/bgmEnabled/sfxEnabled 필드 추가 (기본값 true)
- `js/managers/SaveManager.js` _migrate()에 v5->v6 마이그레이션 블록 추가

### 변경
- `js/config.js` SAVE_DATA_VERSION 5 -> 6
- `js/scenes/MenuScene.js` 버튼 Y좌표 재배치 (출격 280, 업그레이드 330, 도전과제 380, 도감 430, 자동사냥 480, 설정 530), "설정" 버튼 추가
- `js/scenes/BootScene.js` SoundSystem.init() 후 저장된 bgmEnabled/sfxEnabled 반영, initHaptics() 후 hapticEnabled 반영, setHapticEnabled import 추가
- `js/systems/SoundSystem.js` play()에 _sfxEnabled 체크 추가, playBgm()에 _lastBgmId 갱신 + _bgmEnabled 체크 추가

### 참고
- 스펙: `.claude/specs/2026-03-20-settings-menu.md`
- 구현 리포트: `.claude/specs/2026-03-20-settings-menu-report.md`
- QA: `.claude/specs/2026-03-20-settings-menu-qa.md`
- QA 결과: 수용기준 11/11 충족, 예외 시나리오 10/10 PASS, Playwright 20/20 전체 통과
- 변경 파일: `js/scenes/SettingsScene.js`(신규), `js/config.js`, `js/managers/SaveManager.js`, `js/systems/SoundSystem.js`, `js/managers/HapticManager.js`, `js/scenes/MenuScene.js`, `js/main.js`, `js/i18n.js`, `js/scenes/BootScene.js` 총 9개
- 스펙 대비 차이: MenuScene 자동사냥 y=490->480, 설정 y=545->530. 시각적으로 균일한 간격 확보, 크레딧 텍스트와 미겹침
- BGM/SFX 볼륨값(_sfxVol/_bgmVol)을 0으로 변경하지 않고 enabled boolean 플래그로만 ON/OFF 처리. OFF->ON 복귀 시 원래 볼륨 보존

## 2026-03-20 -- 난이도 상향: 3구간 선형 스케일링 재설계

### 추가
- `config.js`에 `BASE_DIFFICULTY = 1.5` 상수 추가 (t=0 시점 기저 난이도 배수)

### 변경
- `config.js` `ENEMY_SCALE_PER_MINUTE` 0.05 -> 0.1111 (분당 +5% -> +11.11%)
- `WaveSystem.js` 스케일링 공식 5곳에 `BASE_DIFFICULTY` 곱셈 적용: `spawnBatch`, `spawnMiniBoss`(HP/DMG), `spawnBoss`(HP/DMG), `spawnEndlessMiniboss`(HP/DMG)
- `WaveSystem.js` 엔들리스 즉시 배율: HP x3.0 -> x2.5, DMG x2.0 -> x2.5 (t=15 기저 4.0 x 2.5 = 10.0배)
- `waves.js` SPAWN_TABLE 후반 구간 밀도 하향 조정:
  - 2~4분: countMin 5->4, countMax 8->7
  - 4~6분: countMin 8->6, countMax 12->10
  - 6~9분: countMin 12->8, countMax 16->12
  - 9~12분: interval 0.6->0.7, countMin 16->10, countMax 22->15
  - 12~15분: interval 0.4->0.6, countMin 22->12, countMax 30->20
- `WaveSystem.js` `enterEndlessMode`, `applyEndlessScale` JSDoc 주석 갱신

### 참고
- 스펙: `.claude/specs/2026-03-20-difficulty-rebalance.md`
- 구현 리포트: `.claude/specs/2026-03-20-difficulty-rebalance-report.md`
- QA: `.claude/specs/2026-03-20-difficulty-rebalance-qa.md`
- QA 결과: 수용기준 10/10 충족, 예외 시나리오 4/4 PASS, 코드 정적 검증
- 배율 검증: t=0 1.50배, t=15 4.00배, 엔들리스 진입 10.00배 (오차 0.005% 이내)
- 변경 파일: `js/config.js`, `js/systems/WaveSystem.js`, `js/data/waves.js` 3개
- `applyEndlessScale` 분당 증가율(HP +15%, DMG +12%) 변경 없음
- 보스 0.5 감쇄 계수 유지, BOSS_SCHEDULE/MINI_BOSS_SCHEDULE 변경 없음
- ObjectPool은 자동 확장 방식이므로 60개 초과 시에도 크래시 없음. 모바일 실기기 성능 테스트 권장

## 2026-03-13 -- ResultScene 하단 UI 요소 겹침 수정

### 변경
- `ResultScene.js` 버튼 Y좌표 계산 전면 교체: 기존 `btnGap`/`maxAdBtnY` 지역 변수 제거, `BTN_GAP(44)`, `MAX_AD_BTN_Y(524)`, `BTN_CONTENT_GAP(12)`, `MIN_CONTENT_SCALE(0.78)` 상수로 교체
- `ResultScene.js` `_renderWeaponReport()` 시그니처에 `scale=1.0` 파라미터 추가, titleY/curY/rowHeight/trail에 `Math.round(... * scale)` 적용
- `ResultScene.js` `_renderWeaponUnlockBanner()` 시그니처에 `scale=1.0` 파라미터 추가, stageCleared Y/bannerY/return trail에 `Math.round(... * scale)` 적용
- `ResultScene.js` 보상 섹션 간격(rewardY +6, rewardEndY +24/+44)에 contentScale 적용
- `ResultScene.js` 하단 버튼 Y좌표를 `contentEndY + BTN_CONTENT_GAP` 기반으로 동적 계산, `MAX_AD_BTN_Y` 상한 유지

### 추가
- `ResultScene.js` `_calcRawScalable(statsCount)` 메서드 신규: scale=1.0 기준 스케일 가능 구간 픽셀 합계 계산
- `ResultScene.js` `contentScale` 계산 로직: `rawScalable > scalableTarget` 시 압축 배율 산출 (최소 0.78)

### 수정
- 무기 7개 + 스테이지 클리어 + 무기 해금 배너 동시 표시 시 해금 배너와 광고 버튼이 24px 겹치는 레이아웃 버그 해소
- 수정 후: 배너-버튼 간격 19px (겹침 없음), 메뉴 버튼 하단 632px (640px 이내)
- 엔들리스 4행 통계 최악 케이스에서도 배너-버튼 간격 7px 유지 (MIN_CONTENT_SCALE=0.78 적용)

### 참고
- 스펙: `.claude/specs/2026-03-13-result-ui-overlap.md`
- 구현 리포트: `.claude/specs/2026-03-13-result-ui-overlap-report.md`
- QA: `.claude/specs/2026-03-13-result-ui-overlap-qa.md`
- QA 결과: 수용기준 7/7 충족, 예외 시나리오 6/6 PASS (10무기 극한 케이스 INFO), Playwright 15/15 전체 통과
- 변경 파일: `js/scenes/ResultScene.js` 1개
- 10개 무기 + 배너 극한 케이스에서 MIN_CONTENT_SCALE 클램프로 배너-버튼 18px 겹침 발생하나, WEAPON_SLOTS=6 기준 정상 플레이에서는 도달 불가

## 2026-03-12 -- IAP 실제 Google Play Billing 연동

### 변경
- `IAPManager.js` 플러그인 교체: `window.Capacitor.Plugins.InAppPurchase` (미등록 상태) -> `@capgo/native-purchases` v8 (`window.Capacitor.Plugins.NativePurchases` 전역 참조)
- `IAPManager.js` initialize(): `isBillingSupported()` 확인 + `getProduct()` 상품 정보 프리로드 추가
- `IAPManager.js` purchase(): `purchaseProduct({ productIdentifier, productType: 'inapp', quantity: 1 })` API로 전환. 실제 Google Play 결제 다이얼로그 표시
- `IAPManager.js` 취소 감지: `/cancel/i.test(e.message)` -> `{ purchased: false, error: 'cancelled' }` 반환
- `IAPManager.js` restorePurchases(): `getPurchases({ productType: 'inapp' })` -> `purchase.productIdentifier` 비교
- `MenuScene.js` _showAutoHuntPurchase(): `} else {` -> `} else if (result.error !== 'cancelled') {` (취소 시 실패 메시지 미표시)
- `build-apk.yml`: "Add Play Billing Library dependency" 단계 완전 제거 (플러그인이 Billing Library 7.x 내장)

### 추가
- `IAPManager.js` getLocalizedPrice(): 프리로드된 상품의 현지화 가격 문자열 반환, 폴백 `'$ 0.99'`
- `IAPManager.js` `_productInfo` 필드: 스토어 상품 정보 캐싱
- `package.json` dependencies: `@capgo/native-purchases: ^8.2.2`
- `tests/iap-real-billing.spec.js`: IAP Billing 연동 Playwright 테스트 16개

### 참고
- 스펙: `.claude/specs/2026-03-12-iap-real-billing.md`
- 구현 리포트: `.claude/specs/2026-03-12-iap-real-billing-report.md`
- QA: `.claude/specs/2026-03-12-iap-real-billing-qa.md`
- QA 결과: 수용기준 7/7 충족 (네이티브 결제 다이얼로그는 N/A, 코드 구조 검증), Playwright 16/16 PASS
- 스펙 대비 구현 차이: `PURCHASE_TYPE` enum 동적 import 대신 문자열 `'inapp'` 직접 사용 (번들러 미사용 환경 대응). `this._PURCHASE_TYPE` 필드 제거
- FAIL-1 수정: 취소 시 실패 메시지 표시 방지 (MenuScene.js L169)
- `getLocalizedPrice()`는 현재 호출되지 않으나 향후 구매 버튼에 가격 표시 시 활용 가능
- 서버사이드 영수증 검증 미구현 (클라이언트 측 트랜잭션 확인만)

## 2026-03-12 -- AdMob 보상형 광고 실 연동

### 변경
- `AdManager.js` initialize(): 플러그인 로드 방식을 `window.Capacitor.Plugins.AdMob` 직접 참조에서 `await import('@capacitor-community/admob')` 동적 import로 전환
- `AdManager.js` showRewarded(): 보상 판단을 순차 await(`showRewardVideoAd()` 반환값)에서 이벤트 기반(`onRewardedVideoAdReward` / `onRewardedVideoAdDismissed` / `onRewardedVideoAdFailedToShow`)으로 전환
- `AdManager.js` 에러 메시지: "Capacitor에 등록되지 않음" -> "플러그인 로드 실패"

### 참고
- 스펙: `.claude/specs/2026-03-12-admob-integration.md`
- 구현 리포트: `.claude/specs/2026-03-12-admob-integration-report.md`
- QA: `.claude/specs/2026-03-12-admob-integration-qa.md`
- QA 결과: 수용기준 6/6 충족, QA 전용 32/32 PASS, 기존 테스트 26/27 통과 (C2 실패는 기존 테스트 좌표 하드코딩 이슈로 이번 변경과 무관)
- 변경 파일: `js/managers/AdManager.js` 1개. GameScene, ResultScene, config.js 미수정
- Mock 모드/BGM 제어/isBusy/일일 제한 등 기존 로직 변경 없음
- 네이티브 모드 이벤트 기반 로직은 실제 Android 기기에서만 검증 가능. Playwright에서는 Mock 경로만 실행되므로 코드 정적 분석으로 대체

## 2026-03-11 -- 인게임 알림 모달 전환

### 변경
- `_showEvolutionPopup(nameKey)` 모달 방식으로 전면 교체 (`js/scenes/GameScene.js` L883-977): 기존 카메라 플래시 + 자동 소멸 텍스트 제거. 게임 일시정지(isPaused=true, physics.pause()) + 반투명 오버레이(0x000000 alpha 0.6, depth 350) + NEON_ORANGE 테두리 패널(220x160, depth 351) + 무기 이름(20px neonOrange, depth 352) + "EVOLVED!" 부제목(14px textSecondary, depth 352) + 확인 버튼(NEON_ORANGE 0.8, depth 352-353). 확인 pointerup 시 모달 destroy + 게임 재개
- `_onEnterEndless()` 내 호출 변경 (`js/scenes/GameScene.js` L1287): `_showWarning(t('game.endlessMode'))` -> `_showEndlessModal()`
- `_togglePause()` 모달 가드 추가 (`js/scenes/GameScene.js` L1843): `if (this._modalOpen) return;` -- ESC 키(_onBack)도 _togglePause 경유이므로 자동 차단

### 추가
- `_showEndlessModal()` 신규 함수 (`js/scenes/GameScene.js` L1319-1412): 게임 일시정지 + 반투명 오버레이(depth 350) + NEON_MAGENTA 테두리 패널(220x160, depth 351) + 제목 t('game.endlessMode')(20px neonMagenta, depth 352) + 설명 t('game.endlessModeDesc')(12px textSecondary, wordWrap 200px, depth 352) + 확인 버튼(NEON_CYAN 0.8, depth 352-353)
- `this._modalOpen` 상태 변수 (`js/scenes/GameScene.js` L311): create()에서 false로 초기화. 모달 열림 시 true, 닫힘 시 false. _togglePause 차단용 플래그
- `_showEvolutionPopup` 중복 호출 가드 (`js/scenes/GameScene.js` L885): `if (this._modalOpen) return;` -- 동시 다중 진화 시 모달 중첩 방지
- i18n `game.endlessModeDesc` 키 (`js/i18n.js`): ko L422 '적이 끝없이 밀려온다.\n60초마다 더욱 강해진다.' / en L965 'Enemies surge endlessly.\nThey grow stronger every 60 seconds.'
- Playwright 테스트 (`tests/modal-notification.spec.js`): 32개 테스트 (i18n 4 + 코드 구조 6 + 진화 모달 6 + 엔들리스 모달 6 + 엣지케이스 6 + 런타임 3 + scrollFactor 1)

### 참고
- 스펙: `.claude/specs/2026-03-11-modal-notification.md`
- 구현 리포트: `.claude/specs/2026-03-11-modal-notification-report.md`
- QA: `.claude/specs/2026-03-11-modal-notification-qa.md`
- QA 결과: 수용기준 21/21 PASS, 예외 시나리오 8/8 PASS, Playwright 32/32 전체 통과. 시각적 검증 스크린샷 2건 확인
- `_showWarning()` 함수 보존됨: game.revived(L429, L809), hud.minibossWarning(L600), hud.bossWarning(L612) 등에서 정상 사용
- `_showEvolutionHint()` 토스트 변경 없음 (L982-1011)
- 모달 depth 350~353: 일시정지 오버레이(300-301) < 모달 < 광고 부활 팝업(400-403)
- `_showEvolutionPopup` 중복 호출 가드는 스펙에 미명시였으나 구현 시 추가됨 (QA에서 LOW 잠재 위험으로 지적한 항목의 선제 해결)

## 2026-03-11 -- 폰트 크기 가독성 개선

### 변경
- GameScene HUD 무기 레벨 라벨 fontSize 9px -> 10px (`js/scenes/GameScene.js` L.1508)
- GameScene HUD 패시브 레벨 라벨 fontSize 8px -> 11px (`js/scenes/GameScene.js` L.1551)
- UpgradeScene 탭 버튼 fontSize 9px -> 10px (`js/scenes/UpgradeScene.js` L.144)
- UpgradeScene 잠금 힌트 fontSize 8px -> 10px (`js/scenes/UpgradeScene.js` L.247)
- UpgradeScene 효과 설명 fontSize 9px -> 10px (`js/scenes/UpgradeScene.js` L.284)
- CollectionScene 탭 버튼 fontSize 9px -> 10px (`js/scenes/CollectionScene.js` L.124)
- CollectionScene 아이템 설명 fontSize 10px -> 11px (`js/scenes/CollectionScene.js` L.365)
- CollectionScene CARD_H 56 -> 60 (`js/scenes/CollectionScene.js` L.39)
- CharacterScene 고유 패시브 설명 fontSize 10px -> 11px (`js/scenes/CharacterScene.js` L.213)
- CharacterScene 캐릭터 설명 fontSize 9px -> 11px (`js/scenes/CharacterScene.js` L.222)
- CharacterScene CARD_H 80 -> 88 (`js/scenes/CharacterScene.js` L.16)
- ResultScene 무기별 킬/DPS fontSize 9px -> 10px (`js/scenes/ResultScene.js` L.432)
- ResultScene 데미지 수치 fontSize 9px -> 10px (`js/scenes/ResultScene.js` L.456)
- StageSelectScene 스테이지 설명 fontSize 9px -> 11px (`js/scenes/StageSelectScene.js` L.153)
- StageSelectScene CARD_H 85 -> 92 (`js/scenes/StageSelectScene.js` L.17)
- AchievementScene 도전과제 설명 fontSize 9px -> 10px (`js/scenes/AchievementScene.js` L.144)
- AchievementScene 진행도 텍스트 fontSize 9px -> 10px (`js/scenes/AchievementScene.js` L.164)
- AchievementScene CARD_H 60 -> 64 (`js/scenes/AchievementScene.js` L.16)
- LevelUpScene 카드 라벨 fontSize -> 10px (`js/scenes/LevelUpScene.js` L.503)
- LevelUpScene 레벨 표시 fontSize -> 10px (`js/scenes/LevelUpScene.js` L.544)
- LevelUpScene 효과 설명 fontSize -> 10px (`js/scenes/LevelUpScene.js` L.552)

### 참고
- 스펙: `.claude/specs/2026-03-11-font-readability.md`
- 구현 리포트: `.claude/specs/2026-03-11-font-readability-report.md`
- QA: `.claude/specs/2026-03-11-font-readability-qa.md`
- QA 결과: 수용기준 20/20 PASS, 예외 시나리오 10/10 PASS, Playwright 11/11 전체 통과. 시각적 검증 스크린샷 8건 확인
- 8개 씬 전체에서 10px 미만 fontSize 완전 제거 확인 (grep 검증)
- LevelUpScene 기존 값이 스펙(9px)과 다르게 일부 8px/7px이었으나, 최종 10px 적용으로 스펙 요구사항 충족

## 2026-03-11 -- 시각적 인지성 개선 (Visual Clarity)

### 추가
- 적 탄환 3레이어 글로우 (`js/entities/EnemyTypes.js` _spawnEnemyProjectile): 기존 단색 주황(0xFF6600 r4) -> 외곽(0xFF4400 r8 a0.3) + 중간(0xFF5500 r6 a0.7) + 코어(0xFF2200 r5 a1.0)
- 적 탄환 트레일 잔상 (`js/entities/EnemyTypes.js`): 67ms 간격 Graphics 생성(r3 0xFF4400 a0.4), 120ms tween fadeout 후 destroy. trailTimer 필드 추가
- 플레이어 탄환 글로우 오버레이 (`js/entities/Projectile.js`): _glowGfx Graphics(0x39FF14 a0.35 r8, depth 7). 풀 인스턴스별 1개 생성, fire/update/_deactivate에서 visible 토글 + 위치 동기화
- Projectile.preDestroy() (`js/entities/Projectile.js`): 씬 종료 시 _glowGfx 명시적 destroy + null 처리
- 플레이어 발밑 글로우 서클 (`js/scenes/GameScene.js`): 0x00FFFF r22, depth 9, alpha 0.35. create에서 생성 + player.glowCircle 참조 주입, update에서 위치 동기화, _cleanup에서 destroy
- Player 글로우 펄스 (`js/entities/Player.js`): _updateGlowPulse() sin파 alpha 0.25~0.40, 주기 1500ms
- Player 피격 글로우 플래시 (`js/entities/Player.js`): takeDamage에서 alpha 0.9, 150ms 후 _glowFlashing=false로 정상 펄스 복귀
- Player 글로우 필드 3개 (`js/entities/Player.js`): glowCircle, _glowPulseTime, _glowFlashing
- Playwright 테스트 (`tests/visual-clarity.spec.js`): 29개 테스트

### 변경
- projectile 플레이스홀더 텍스처 (`js/scenes/BootScene.js`): 12x12 -> 16x16 확대, 외곽 글로우(NEON_GREEN r7 a0.4) + 코어(r4 a1.0) 2레이어
- effect_projectile 텍스처 (`js/scenes/BootScene.js`): effectFallbacks 루프에서 분리, 별도 글로우 레이어 처리 (16x16)
- Projectile body offset (`js/entities/Projectile.js`): 하드코딩(offset=2) -> `Math.max(0, this.frame.width / 2 - 4)` 동적 계산. 16x16=offset 4, 12x12=offset 2

### 참고
- 스펙: `.claude/specs/2026-03-11-visual-clarity.md`
- 구현 리포트: `.claude/specs/2026-03-11-visual-clarity-report.md`
- 수정 리포트: `.claude/specs/2026-03-11-visual-clarity-fix-report.md`
- QA: `.claude/specs/2026-03-11-visual-clarity-qa.md`
- QA 결과: 수용기준 13/13 PASS, 예외 시나리오 10/10 PASS, Playwright 29/29 전체 통과. 시각적 검증 스크린샷 4건 확인
- QA 이슈 2건 수정 완료: ISSUE-1(body offset 동적 계산), ISSUE-2(preDestroy 추가)

## 2026-03-11 -- 진화 조합표 UI + 인게임 힌트

### 추가
- CollectionScene 5번째 "진화" 탭 (`js/scenes/CollectionScene.js`): TABS 배열에 evolutions 추가, `_getEvolutionItems()` 메서드로 11개 진화 레시피 카드 생성. 조합식(`[무기명] Lv8 + [패시브명] Lv5`)은 발견 여부 무관하게 항상 공개. 미발견 시 이름 `★ ???` 마스킹, 발견 시 `★ [실제이름]` 표시
- GameScene `_showEvolutionHint()` (`js/scenes/GameScene.js`): 무기 Max + 패시브 Lv1~4 상태에서 진화 힌트 토스트 표시. neonOrange 12px, 화면 상단(y=30) 고정, 1.5초 후 fade out(500ms). `_shownHints` Set으로 동일 진화 중복 힌트 방지. 패시브 미보유(Lv0) 시 미표시
- i18n 5개 키 ko/en (`js/i18n.js`): collection.evolutions, collection.evoRecipe, collection.discovered, collection.notDiscovered, hint.evolutionReady
- Playwright 테스트 (`tests/evolution-recipe-ui.spec.js`, `tests/evolution-recipe-visual.spec.js`): 34개 테스트

### 변경
- CollectionScene tabW 78 -> 62 축소 (5개 탭 수용)
- GameScene._tryEvolutionCheck()에 패시브 부족 시 힌트 분기(`else if (passiveLv > 0)`) 추가

### 참고
- 스펙: `.claude/specs/2026-03-11-evolution-recipe-ui.md`
- 구현 리포트: `.claude/specs/2026-03-11-evolution-recipe-ui-report.md`
- QA: `.claude/specs/2026-03-11-evolution-recipe-ui-qa.md`
- QA 결과: 수용기준 11/11 PASS, 예외 시나리오 10/10 PASS, Playwright 34/34 전체 통과. 시각적 검증 스크린샷 6건 확인
- `collection.discovered`와 `collection.notDiscovered` 키는 향후 확장용으로 준비됨 (현재 카드 UI에서 직접 사용하지 않음)

## 2026-03-11 -- 전체 무기 진화 11종 완성

### 추가
- WEAPON_EVOLUTIONS 8개 신규 레시피 (`js/data/weapons.js`): laser_gun+battery_pack=ion_cannon, plasma_orb+armor_plate=guardian_sphere, drone+magnet_module=hivemind, emp_blast+cooldown_chip=perpetual_emp, force_blade+booster=phantom_strike, nano_swarm+regen_module=bioplasma, vortex_cannon+luck_module=event_horizon, reaper_field+damage_amp=death_blossom
- EVOLVED_WEAPONS 8개 진화 무기 데이터 (`js/data/weapons.js`): 각 진화 무기별 타입-specific 스탯 정의 (총 11종)
- damage_amp 패시브 (`js/data/passives.js`): id=damage_amp, stat=attackDamage, effectPerLevel=0.08, maxLevel=5, icon=anger symbol. Lv5 시 damageMultiplier 1.40 (40% 증가)
- LevelUpScene._applyPassiveEffect() attackDamage 케이스 (`js/scenes/LevelUpScene.js`): `p.damageMultiplier = 1 + totalEffect`
- Player.getEffectiveAttackMultiplier() damageMultiplier 반영 (`js/entities/Player.js`): `mult *= this.damageMultiplier` (undefined 안전 체크 포함)
- WeaponSystem.findClosestEnemies() (`js/systems/WeaponSystem.js`): 거리순 정렬 + N개 반환 유틸 메서드 (beamCount 다중 타겟팅용)
- _updateBeam() 다중 빔 로직 (`js/systems/WeaponSystem.js`): beamCount >= 2 시 가장 가까운 적 N명에게 각각 빔 발사. 적 부족 시 부채꼴 기본 방향 fallback
- renderBeams() 다중 빔 렌더링 (`js/systems/WeaponSystem.js`): beamCount 수만큼 빔 시각화
- i18n ko/en 확장 (`js/i18n.js`): 8개 진화 무기 name/desc + 1개 패시브 name/desc/detail
- Playwright 테스트 (`tests/weapon-evolution-all.spec.js`): 35개 테스트

### 변경
- getWeaponStats() 리팩토링 (`js/systems/WeaponSystem.js`): 최상단에 `_evolvedStats` 공통 체크 추가. 기존 chain/homing 타입 개별 처리를 공통 로직으로 통합하여 모든 무기 타입(beam, orbital, summon, aoe, melee, cloud, gravity, rotating_blade 포함)이 자동으로 진화 스탯 사용

### 참고
- 스펙: `.claude/specs/2026-03-11-weapon-evolution-all.md`
- 구현 리포트: `.claude/specs/2026-03-11-weapon-evolution-all-report.md`
- QA: `.claude/specs/2026-03-11-weapon-evolution-all-qa.md`
- QA 결과: 수용기준 13/13 PASS, 예외 시나리오 8/8 PASS, Playwright 35/35 전체 통과
- LOW 이슈 3건: Player.damageMultiplier 미초기화, Player._applyPassiveEffects() attackDamage case 누락, 리셋 블록 damageMultiplier 미포함. 모두 런타임 영향 없음 (dead code 경로)
- 기존 3개 진화 (precision_cannon, plasma_storm, nuke_missile) 회귀 테스트 PASS

## 2026-03-11 -- AutoPilot 아이템 수집 가중치 강화

### 추가
- config.js AUTO_HUNT 블록 신규 설정값 6개 (`js/config.js`): consumableSearchRadius(300), weaponDropSearchRadius(400), weaponDropUrgentLifetime(4000), weaponDropScoreMultiplier(10), consumableScoreMultiplier(5), xpGemScoreMultiplier(1)
- AutoPilotSystem 신규 메서드 4개 (`js/systems/AutoPilotSystem.js`): _evaluateWeaponDropUrgent()(수명 임박 무기 긴급 수집, x3 보정), _evaluateWeaponDrop()(무기 드롭 일반 수집), _evaluateConsumable()(소모품 수집), _hasCriticalDanger()(CRITICAL 위험 판별)
- Playwright 테스트 (`tests/auto-move-item-weight.spec.js`): 29개 테스트

### 변경
- AutoPilotSystem AI 행동 우선순위 재편 (`js/systems/AutoPilotSystem.js` update()): 기존 4단계(위험 회피 > XP 수집 > 적 접근 > 방랑)에서 7단계(긴급 무기 수집 > 위험 회피 > 무기 드롭 > 소모품 > XP 보석 > 적 접근 > 방랑)로 확장
- AutoPilotSystem 하드코딩 상수 제거 (`js/systems/AutoPilotSystem.js`): DANGER_RADIUS(120), XP_SEARCH_RADIUS(200), DIRECTION_CHANGE_INTERVAL(150), CRITICAL_DANGER_RADIUS(60) 4개 로컬 상수 삭제. config.js AUTO_HUNT 객체에서 런타임 참조로 전환
- AutoPilotSystem CRITICAL_DANGER_RADIUS 동적 계산 (`js/systems/AutoPilotSystem.js`): 하드코딩 60px에서 `AUTO_HUNT.dangerRadius / 2`(=60px)로 변경. config 변경 시 연동
- AutoPilotSystem _evaluateXPCollection() 리팩토링 (`js/systems/AutoPilotSystem.js`): 하드코딩 XP_SEARCH_RADIUS -> AUTO_HUNT.xpSearchRadius, 점수 공식에 AUTO_HUNT.xpGemScoreMultiplier 가중치 적용
- AutoPilotSystem _evaluateDanger() config 연동 (`js/systems/AutoPilotSystem.js`): 하드코딩 DANGER_RADIUS -> AUTO_HUNT.dangerRadius

### 참고
- 스펙: `.claude/specs/2026-03-11-auto-move-item-weight.md`
- 구현 리포트: `.claude/specs/2026-03-11-auto-move-item-weight-report.md`
- QA: `.claude/specs/2026-03-11-auto-move-item-weight-qa.md`
- QA 결과: 수용기준 6/6 PASS, 예외 시나리오 11/11 PASS, Playwright 29/29 전체 통과. 시각적 검증 스크린샷 5건 확인
- 기존 제약사항 #9(AUTO_HUNT import 미사용) 해결됨
- REACTION_MISS_CHANCE(0.05), IMPERFECTION_ANGLE(0.3) 미변경 (의도적 불완전성 보존)

## 2026-03-10 -- 캐릭터별 고유 스프라이트 + 8방향 걷기 애니메이션

### 추가
- characters.js `spriteKey` 필드 (`js/data/characters.js`): 6종 캐릭터에 idle 텍스처 키 매핑 추가. agent='player'(기존 에셋 호환), sniper='sniper', engineer='engineer', berserker='berserker', medic='medic', hidden='hidden'. walk 텍스처 키는 `spriteKey + '_walk'` 규칙
- 5종 캐릭터 idle 스프라이트 (`assets/sprites/`): sniper.png(48x48, 2.8KB), engineer.png(48x48, 3.1KB), berserker.png(48x48, 4.3KB), medic.png(48x48, 4.0KB), hidden.png(48x48, 3.3KB). GPT Image API(gpt-image-1) 생성
- 5종 캐릭터 walk 스프라이트시트 (`assets/sprites/`): sniper_walk.png(240x192, 54KB), engineer_walk.png(240x192, 64KB), berserker_walk.png(240x192, 71KB), medic_walk.png(240x192, 61KB), hidden_walk.png(240x192, 60KB). GPT Image API 5방향x4프레임 생성
- 5종 캐릭터 walk 개별 프레임 (`assets/sprites/walk_frames/{charId}/`): 캐릭터당 20개 x 5종 = 100개 임시 프레임 PNG
- BootScene 캐릭터 5종 에셋 로드 (`js/scenes/BootScene.js` preload): CHAR_SPRITE_KEYS 루프로 idle image + walk spritesheet 로드 (총 12개 에셋)
- BootScene 캐릭터 5종 플레이스홀더 (`js/scenes/BootScene.js` _generatePlaceholderTextures): CHAR_PLACEHOLDER_COLORS 맵으로 캐릭터별 고유 색상(sniper=0x39FF14, engineer=0xFFD700, berserker=0xFF3333, medic=0x00FF88, hidden=0xAA00FF) idle(48x48 원+삼각형) + walk(240x192 원 격자) 생성
- Player characterId 파라미터 (`js/entities/Player.js` constructor): 기본값 'agent'. _idleTextureKey, _walkTextureKey, _walkAnimPrefix를 characterId 기반으로 동적 결정
- Playwright 테스트 (`tests/char-sprites.spec.js`): 46개 테스트 (정상 34 + 예외 12)

### 변경
- BootScene `_registerPlayerWalkAnims()` -> `_registerWalkAnims()` (`js/scenes/BootScene.js`): 함수명 변경. agent 전용에서 6종 캐릭터 일괄 처리로 확장. CHAR_ANIM_DEFS 배열로 6종 walkTexture/animPrefix 정의, 6종x5방향=30개 애니메이션 등록. 텍스처 미존재 캐릭터는 스킵
- Player._playWalkAnim() (`js/entities/Player.js`): 하드코딩된 'walk_' 접두사를 `this._walkAnimPrefix + '_'` 패턴으로 변경. 텍스처 존재 확인도 `this._walkTextureKey` 기반
- Player._setIdleState() (`js/entities/Player.js`): `setTexture('player')` -> `setTexture(this._idleTextureKey)`
- GameScene Player 생성 (`js/scenes/GameScene.js` L108): `new Player(this, x, y)` -> `new Player(this, x, y, this.characterId)`
- generate-walk-anim.js (`scripts/generate-walk-anim.js`): 단일 agent 전용에서 5종 캐릭터 다중 생성으로 확장. CHARACTER_DEFS 맵(idlePrompt, walkStylePrompt, color) 추가, --char 옵션, generateIdleSprite() 함수 추가, 캐릭터별 walk_frames 서브폴더 사용

### 참고
- 스펙: `.claude/specs/2026-03-10-neon-exodus-char-sprites.md`
- 구현 리포트: `.claude/specs/2026-03-10-neon-exodus-char-sprites-report.md`
- QA: `.claude/specs/2026-03-10-neon-exodus-char-sprites-qa.md`
- QA 결과: 수용기준 9/9 PASS, 예외 시나리오 12/12 PASS, Playwright 46/46 전체 통과. 시각적 검증 스크린샷 8건 확인
- agent는 기존 player.png/player_walk.png 재사용 (하위 호환 완벽 유지)
- 에셋 용량 추가: 약 320KB (10개 파일)
- 잠재적 이슈(LOW): Player.js에서 `characterId === 'agent'` 하드코딩 3곳. 향후 spriteKey 참조 방식 리팩토링 가능하나 현재 구조에서 문제 없음

## 2026-03-10 -- 소모성 아이템(Consumable) 6종

### 추가
- 소모성 아이템 데이터 파일 (`js/data/consumables.js`): CONSUMABLES 배열 6종, CONSUMABLE_MAP ID 맵. 아이템별 dropChance(normal/normalLowHp/miniboss/boss), textureKey, tintColor 정의
- 소모성 아이템 엔티티 (`js/entities/Consumable.js`): Phaser.Physics.Arcade.Sprite 상속, ObjectPool 패턴. spawn/update/collect/_deactivate 생명주기. 수명 10초, 마지막 3초 깜빡임(alpha 1->0.3, 150ms yoyo tween). 자석 흡수 없음(직접 밟아서 수집)
- 스프라이트 생성 스크립트 (`scripts/generate-consumable-sprites.js`): GPT Image API(gpt-image-1)로 6종 24x24 아이콘 PNG 생성
- 소모성 아이템 스프라이트 6종 (`assets/sprites/items/`): consumable_nano_repair.png, consumable_mag_pulse.png, consumable_emp_bomb.png, consumable_credit_chip.png, consumable_overclock.png, consumable_shield_battery.png (각 24x24)
- config.js 소모성 아이템 상수 12개: CONSUMABLE_LIFETIME(10), CONSUMABLE_BLINK_DURATION(3), CONSUMABLE_HEAL_AMOUNT(30), CONSUMABLE_CREDIT_MIN(5)/MAX(15), OVERCLOCK_DURATION(5000ms)/SPEED_MULT(1.5)/COOLDOWN_MULT(0.7), SHIELD_DURATION(30000ms)/REFLECT_DAMAGE(5), EMP_BOSS_DAMAGE_RATIO(0.2)/SCREEN_MARGIN(50)
- GameScene consumablePool(초기 20개), overlap 충돌, spawnConsumable(), _onCollectConsumable()(6종 효과 핸들러), _applyEMPEffect(), 쉴드 접촉 반사 로직, consumablePool update/destroy (`js/scenes/GameScene.js`)
- Enemy._dropConsumable(): 적 사망 시 CONSUMABLES 배열 순서대로 드롭 판정. 등급별(잡몹/미니보스/보스) 확률 분기, 잡몹 HP<=50% 시 nano_repair 확률 상승(3%->8%), 한 적에서 최대 1개만 드롭 (`js/entities/Enemy.js`)
- Player 버프 관리: _overclockTimer, _shieldTimer, shieldActive 필드, applyOverclock()(이속x1.5 쿨다운x0.7, 5초), applyShield()(30초 무적 + 보라색 틴트), reflectShieldDamage()(접촉 적에게 5 대미지), _updateBuffs()(매 프레임 타이머 갱신, 만료 시 복원) (`js/entities/Player.js`)
- VFXSystem.consumableCollect(): 아이템별 색상 파티클 수집 이펙트. VFXSystem.empBlast(): EMP 화면 클리어 파티클 + 카메라 플래시 (`js/systems/VFXSystem.js`)
- BootScene: 6종 스프라이트 preload(load.image) + 6종 플레이스홀더 텍스처 생성 (`js/scenes/BootScene.js`)
- i18n: 6종 아이템 이름+설명 ko/en 24키 추가 (`js/i18n.js`)
- Playwright 테스트 (`tests/consumables.spec.js`): 34개 테스트

### 참고
- 스펙: `.claude/specs/2026-03-10-neon-exodus-consumables.md`
- 구현 리포트: `.claude/specs/2026-03-10-neon-exodus-consumables-report.md`
- QA: `.claude/specs/2026-03-10-neon-exodus-consumables-qa.md`
- QA 결과: 수용기준 19/19 PASS, 예외 시나리오 12/12 PASS, Playwright 34/34 전체 통과. 시각적 검증 스크린샷 3건 확인
- 버프 중복 방지: 오버클럭/쉴드 활성 중 재수집 시 스탯 이중 적용 없이 타이머만 리셋 (연장 불허)
- 드롭 순서: CONSUMABLES 배열 순서대로 판정 (nano_repair 우선). 하나 성공 시 나머지 스킵
- 잠재적 이슈(MEDIUM): 오버클럭 활성 중 _applyPassiveEffects() 호출(레벨업 등) 시 _preOverclockSpeed/_preOverclockCooldown 값이 무효화될 수 있음. 현재는 레벨업 UI에서 게임 일시정지되므로 실질적 영향 없음

## 2026-03-10 -- 플레이어 8방향 걷기 애니메이션

### 추가
- 걷기 애니메이션 스프라이트시트 생성 스크립트 (`scripts/generate-walk-anim.js`): GPT Image API(gpt-image-1)로 5방향 x 4프레임 = 20개 PNG 개별 생성 후 sharp composite로 240x192 스프라이트시트 합성. 기존 generate-vector-sprites.js 유틸리티(removeBackground, hasTransparentBackground, sleep) 패턴 재활용. 실패 프레임 시안 반투명 fallback PNG 생성. API rate limit 1초 대기
- 걷기 애니메이션 스프라이트시트 (`assets/sprites/player_walk.png`): 240x192, 5열(방향) x 4행(프레임), 프레임 48x48. 레이아웃: col0=down, col1=down-right, col2=right, col3=up-right, col4=up. Phaser 프레임 번호 = row * 5 + col
- 걷기 프레임 개별 파일 (`assets/sprites/walk_frames/`): 20개 PNG (디버깅용 보존)
- BootScene.preload() player_walk spritesheet 로드 (`js/scenes/BootScene.js` L65-68): `load.spritesheet('player_walk', ..., { frameWidth: 48, frameHeight: 48 })`
- BootScene._registerPlayerWalkAnims() 신규 메서드 (`js/scenes/BootScene.js` L219-243): 5방향 걷기 애니메이션 등록 (walk_down, walk_down_right, walk_right, walk_up_right, walk_up). frameRate 8fps, repeat -1. player_walk 텍스처 미존재 시 early return
- BootScene._generatePlaceholderTextures() player_walk 플레이스홀더 (`js/scenes/BootScene.js` L311-321): 240x192, 20프레임 시안 원 격자
- Player._playWalkAnim(dirX, dirY) 신규 메서드 (`js/entities/Player.js` L432-483): atan2 기반 0~360도 변환 후 22.5도 오프셋 8방향 분류. left 계열 3방향(SW/W/NW)은 flipX=true + 미러 방향 animKey(walk_down_right/walk_right/walk_up_right). 동일 animKey 재생 중이면 play() 미호출(끊김 방지). player_walk 텍스처 존재 시에만 play()
- Player._setIdleState() 신규 메서드 (`js/entities/Player.js` L490-503): anims.stop() -> setTexture('player') -> setFlipX(false) -> setScale(SPRITE_SCALE) -> idle tween resume. _isMoving guard로 중복 호출 방지
- Player._isMoving 상태 변수 (`js/entities/Player.js` L166): 걷기/idle 전환 판단용
- Playwright 테스트 (`tests/walk-anim.spec.js`): 24개 테스트 (에셋/등록 4 + 동작 7 + 엣지케이스 5 + 기존 유지 3 + 시각적 4 + 경계값 1)

### 변경
- Player._idleTween 참조 저장 (`js/entities/Player.js` L38-46): 기존 `scene.tweens.add({...})` 반환값을 `this._idleTween`에 저장. 이동 시 pause(), 정지 시 resume() 호출
- Player._handleMovement() (`js/entities/Player.js` L394-423): 정지 시 `_setIdleState()`, 이동 시 `_playWalkAnim(dirX, dirY)` 호출 추가
- BootScene.create() (`js/scenes/BootScene.js` L122): `_generatePlaceholderTextures()` 이후 `_registerPlayerWalkAnims()` 호출 추가

### 참고
- 스펙: `.claude/specs/2026-03-10-neon-exodus-walk-anim.md`
- 구현 리포트: `.claude/specs/2026-03-10-neon-exodus-walk-anim-report.md`
- QA: `.claude/specs/2026-03-10-neon-exodus-walk-anim-qa.md`
- QA 결과: 수용기준 10/10 PASS, 예외 시나리오 5/5 PASS, Playwright 24/24 전체 통과. 시각적 검증 스크린샷 5건 확인
- 8방향 각도 매핑: right(337.5~22.5), SE(22.5~67.5), down(67.5~112.5), SW(112.5~157.5), left(157.5~202.5), NW(202.5~247.5), up(247.5~292.5), NE(292.5~337.5). 경계값 테스트 전체 통과
- 걷기 사이클: neutral -> left-step -> neutral -> right-step (4프레임)
- AutoPilot 모드에서도 동일한 방향 감지/애니메이션 로직 적용 (Player._handleMovement()의 dirX/dirY 공유)
- 피격 틴트(setTint)와 무적 깜빡임(setAlpha)은 스프라이트 레벨 속성이므로 걷기 애니메이션과 독립적으로 동작

## 2026-03-10 -- XP 보석 가시성 수정: SVG 직접 생성 하이브리드 방식

### 수정
- XP 보석 3종(xp_gem_s/m/l) 생성 방식을 GPT Image API에서 SVG 직접 생성으로 변경 (`scripts/generate-vector-sprites.js`): GPT Image API 1024x1024 이미지를 12~28px로 다운스케일 시 디테일이 소실되어 거의 투명해지는 버그 수정. `svgOverride: true` 플래그로 GPT API 호출과 SVG 직접 생성을 분기
- `createGemSVG(size)` 함수 추가 (`scripts/generate-vector-sprites.js` L216~237): 다이아몬드형 폴리곤 + 시안(#00FFFF) 코어 + 흰색(#FFFFFF) 내부 하이라이트 + feGaussianBlur 글로우 필터(stdDeviation = `Math.max(1, size * 0.08)`)
- `generateGemSprite(asset)` 함수 추가 (`scripts/generate-vector-sprites.js` L248~268): SVG 문자열 -> sharp -> PNG 직접 변환. viewBox가 최종 크기이므로 리사이즈 불필요
- main() 루프에서 `asset.svgOverride` 여부에 따라 `generateGemSprite()` / `generateSprite()` 분기 (`scripts/generate-vector-sprites.js` L427~429). SVG 직접 생성 에셋은 API rate limit 대기(sleep) 불필요

### 참고
- 스펙: `.claude/specs/2026-03-10-neon-exodus-gpt-image-art.md`
- QA (XP 보석 수정): `.claude/specs/2026-03-10-neon-exodus-gpt-image-art-qa-xpfix.md`
- QA 결과: 수용기준 8/8 PASS, 예외 시나리오 7/7 PASS, Playwright 11/11 전체 통과. 시각적 검증 스크린샷 7건 확인
- XP 보석 PNG 상세: xp_gem_s.png(12x12, 244B, 비투명 72.2%), xp_gem_m.png(20x20, 410B, 비투명 79.0%), xp_gem_l.png(28x28, 596B, 비투명 81.6%)
- 나머지 17종은 기존 GPT Image API 방식 유지. 하이브리드 구조: 대형 에셋(32px+) = GPT Image API, 소형 에셋(12~28px XP 보석) = SVG 직접 생성

## 2026-03-10 -- GPT Image API 벡터 아트 전환: 20종 스프라이트 고품질 재생성

### 추가
- GPT Image API(gpt-image-1) 기반 스프라이트 생성 스크립트로 전면 재작성 (`scripts/generate-vector-sprites.js`): 기존 SVG 코드 생성 방식을 OpenAI GPT Image API 호출 방식으로 교체. 에셋별 개별 프롬프트 + 공통 사이버펑크 네온 스타일 프롬프트 조합. API 1024x1024 고품질 생성 후 sharp 리사이즈. dotenv/openai/sharp 의존성 사용. ESM 방식
- 투명 배경 폴백 시스템 (`scripts/generate-vector-sprites.js`): `hasTransparentBackground()` 함수로 투명 픽셀 비율 10% 기준 검증 + `removeBackground()` 함수로 밝기 임계값 40 이하 픽셀 투명화 폴백
- 벡터 PNG 에셋 20종 재생성 (`assets/sprites/`): player.png(48x48), projectile.png(12x12), 잡몹 10종(32~48px), 미니보스 2종(80x80), 보스 3종(128x128), XP 보석 3종(12/20/28px). GPT Image API로 생성된 클린 벡터 + 네온 글로우 스타일. 모든 에셋 투명 배경 RGBA 4채널
- Player.js tween 아이들 맥동 (`js/entities/Player.js` L38-46): scaleX 1.0->1.05, scaleY 1.0->0.95, duration 800ms, yoyo, repeat:-1, Sine.easeInOut
- Enemy.js tween 아이들 맥동 (`js/entities/Enemy.js` L161-172): 보스 600ms, 미니보스 700ms, 잡몹 900ms. init()에서 killTweensOf 선행 후 추가
- Playwright 테스트 (`tests/vector-art-phase1.spec.js`): 14개 테스트

### 변경
- Phaser render 설정 (`js/main.js` L43-46): `pixelArt: true, antialias: false` -> `pixelArt: false, antialias: true`. 벡터 에셋의 매끄러운 외곽선 렌더링을 위한 변경
- SPRITE_SCALE (`js/config.js` L25): `2` -> `1`. 벡터 에셋이 표시 크기로 직접 생성되므로 배율 불필요
- BootScene.preload() (`js/scenes/BootScene.js` L59-96): spritesheet 로드를 `this.load.image()` 20종 정적 이미지 로드로 전면 전환
- BootScene (`js/scenes/BootScene.js`): `_createAnimations()` 메서드 및 create()에서의 호출 구문 완전 제거. 프레임 애니메이션에서 tween 애니메이션으로 전환
- BootScene._generatePlaceholderTextures() (`js/scenes/BootScene.js`): 플레이스홀더 크기를 벡터 에셋 기준으로 갱신 (잡몹 32~48px, 미니보스 80px, 보스 128px, XP 보석 12/20/28px)
- Player.js body offset (`js/entities/Player.js` L155-157): `48 / 2 - 12 = 12`로 재계산. `setCircle(12, 12, 12)`
- Enemy.js body offset (`js/entities/Enemy.js` L180-185): `frameW / 2 - bodyRadius` 공식으로 재계산 (scale 나눗셈 없음). 소형(32px): offset=6, 중형(40px): offset=8, 대형(48px): offset=10, 미니보스(80px): offset=22, 보스(128px): offset=38
- Enemy._deactivate() (`js/entities/Enemy.js` L413-416): `scene.tweens.killTweensOf(this)` 호출 추가. 풀 반환 시 tween 잔존 방지
- Projectile.js body offset (`js/entities/Projectile.js` L57-58): `12 / 2 - 4 = 2`로 재계산. `setCircle(4, 2, 2)`
- XPGem.js (`js/entities/XPGem.js` L59-60, L101-103): constructor 초기 offset `12/2 - 3 = 3`, spawn() texSizes를 `{ small: 12, medium: 20, large: 28 }`로 갱신

### 참고
- 스펙 (SVG 벡터): `.claude/specs/2026-03-10-neon-exodus-art-phase1.md`
- QA (SVG 벡터): `.claude/specs/2026-03-10-neon-exodus-art-phase1-qa.md`
- 스펙 (GPT Image API 전환): `.claude/specs/2026-03-10-neon-exodus-gpt-image-art.md`
- 구현 리포트 (GPT Image API 전환): `.claude/specs/2026-03-10-neon-exodus-gpt-image-art-report.md`
- QA (GPT Image API 전환): `.claude/specs/2026-03-10-neon-exodus-gpt-image-art-qa.md`
- GPT Image API QA 결과: 수용기준 15/15 PASS, Playwright 15/15 전체 통과. 20종 PNG 크기/채널(RGBA)/투명배경 전수 검증 PASS. 시각적 검증 스크린샷 4건 확인
- SVG 벡터 QA 결과: 수용기준 14/14 PASS, 예외 시나리오 10/10 PASS, Playwright 14/14 전체 통과. 시각적 검증 스크린샷 11건 확인
- 에셋 생성 파이프라인: SVG 코드 생성 -> GPT Image API(gpt-image-1) 호출로 전환. 기존 SVG 생성 코드 전체 제거
- 게임 소스 코드 변경 없음 (BootScene, Player, Enemy, Projectile, XPGem 무변경)
- 기존 DALL-E 생성 스크립트(generate-sprites.js, generate-sprites-phase2.js)는 수정하지 않고 레거시로 유지
- 이번 변경으로 기존 "아트 Phase 1 스프라이트 에셋 전환", "스프라이트 2x 스케일 적용", "아트 Phase 2 보스/미니보스 스프라이트" 3개 항목이 모두 글로우 벡터로 대체됨

## 2026-03-09 -- 아트 Phase 2: 보스/미니보스 스프라이트

### 추가
- 에셋 생성 스크립트 (`scripts/generate-sprites-phase2.js`): Phase 2 전용 DALL-E 3 API 스크립트. ASSETS 배열 5종 정의. 미니보스(frames:2)는 DALL-E 1회 호출로 idle 2F 시트 조립, 보스(frames:4)는 DALL-E 2회 호출(idle + special)로 4F 시트 조립. sharp 배경 제거(밝기 임계값 40) + nearest-neighbor 리사이즈. API rate limit 대응 에셋 간 1초 딜레이. Phase 1 스크립트와 독립 실행
- 미니보스 스프라이트시트 2종 (`assets/sprites/bosses/`): guardian_drone.png (80x40, 2F idle), assault_mech.png (80x40, 2F idle)
- 보스 스프라이트시트 3종 (`assets/sprites/bosses/`): commander_drone.png (256x64, 4F: idle 2F + special 2F), siege_titan.png (256x64, 4F), core_processor.png (256x64, 4F)
- BootScene.preload() Phase 2 블록 (`js/scenes/BootScene.js` L93-116): miniBossAssets2(fw:40, fh:40) + bossAssets(fw:64, fh:64) spritesheet 로드
- BootScene._createAnimations() Phase 2 블록 (`js/scenes/BootScene.js` L260-294): 미니보스 2종 idle(frameRate:3, repeat:-1, frames 0~1) + 보스 3종 idle(frameRate:2, repeat:-1, frames 0~1) + 보스 3종 special(frameRate:8, repeat:3, frames 2~3) animation 등록
- Playwright 테스트 (`tests/phase2-art.spec.js`): 24개 테스트 (수용기준 12 + 예외 9 + 시각적 검증 3)

### 변경
- GameScene.onMiniBossSpawn() (`js/scenes/GameScene.js` L482-485): 카메라 오렌지 플래시(300ms, RGB 255,100,0) 추가. 기존 텍스트 경고와 함께 표시
- GameScene.onBossSpawn() (`js/scenes/GameScene.js` L492-497): 카메라 마젠타 플래시(500ms, RGB 255,0,255) + 카메라 흔들림(500ms, 강도 0.02) 추가. 기존 boss_appear SFX + 텍스트 경고와 함께 표시
- Enemy.takeDamage() (`js/entities/Enemy.js` L260-275): 피격 플래시 복원 로직에 `textures.exists('enemy_' + typeId)` 분기 추가. 정식 스프라이트 사용 시 `clearTint()`로 원래 색상 복원, 플레이스홀더 사용 시 기존 `setTint()` 유지. Phase 1 아트에서 발견된 정식 텍스처 피격 틴트 부작용 해결
- BootScene @fileoverview 주석 갱신 (`js/scenes/BootScene.js` L1-8): Phase 2 보스/미니보스 에셋 preload 내용 반영

### 참고
- 스펙: `.claude/specs/2026-03-09-phase2-art.md`
- 구현 리포트: `.claude/specs/2026-03-09-phase2-art-report.md`
- QA: `.claude/specs/2026-03-09-phase2-art-qa.md`
- QA 결과: 수용기준 12개 전체 PASS, 예외 시나리오 9개 PASS, Playwright 24/24 전체 통과. 시각적 검증 스크린샷 7건 확인
- Phase 1 스크립트(generate-sprites.js) 수정 없음 (git diff 0줄 확인)
- 보스 special animation은 anims 레지스트리 등록만 완료. 실제 재생 트리거(EnemyTypes.js 수정)는 별도 스펙에서 처리 예정
- 보스 special animation 파라미터: frameRate 8, repeat 3 (3회 반복 후 정지)

## 2026-03-09 -- 인게임 인벤토리 HUD

### 추가
- WEAPON_ICON_MAP 상수 (`js/scenes/GameScene.js` L48-59): 무기 ID -> 이모지 매핑 10종 (blaster, laser_gun, plasma_orb, electric_chain, missile, drone, emp_blast, precision_cannon, plasma_storm, nuke_missile). WEAPON_ICON_FALLBACK(L62) = 매핑 없는 무기 폴백 아이콘
- getPassiveById import (`js/scenes/GameScene.js` L40): passives.js에서 패시브 아이콘 조회용
- _inventoryHUD 초기화 (`js/scenes/GameScene.js` L1036): `{ weapons: [], passives: [] }` 컨테이너. _createHUD() 내에서 초기화 후 _refreshInventoryHUD() 호출
- _refreshInventoryHUD() 메서드 (`js/scenes/GameScene.js` L1105-1208): 무기 행(Y=560, 32x32, stride 60px, 폰트 18px/9px) + 패시브 행(Y=594, 28x28, stride 36px, 폰트 15px/8px) 렌더링. destroy-rebuild 방식. null guard(inv, weaponSystem, player) 포함
- Playwright 테스트 (`tests/inventory-hud.spec.js`): 25개 테스트

### 변경
- onLevelUp() levelupDone 핸들러 (`js/scenes/GameScene.js` L315): _tryEvolutionCheck() 이후 _refreshInventoryHUD() 호출 추가. 레벨업/진화 후 인벤토리 HUD 즉시 갱신

### 참고
- 스펙: `.claude/specs/2026-03-09-ingame-inventory-ui.md`
- 구현 리포트: `.claude/specs/2026-03-09-ingame-inventory-ui-report.md`
- QA: `.claude/specs/2026-03-09-ingame-inventory-ui-qa.md`
- QA 결과: 수용기준 10/10 PASS, 예외 시나리오 7/7 PASS, Playwright 25/25 전체 통과. 시각적 검증 스크린샷 7건 확인
- LOW 소견: _cleanup()에서 _inventoryHUD 요소 명시적 destroy 미구현. Phaser scene 생명주기 자동 정리로 실질적 문제 없음

## 2026-03-09 -- 스프라이트 2x 스케일 적용

### 추가
- SPRITE_SCALE = 2 상수 (`js/config.js:25`): 스프라이트 렌더링 배율. pixelArt: true 설정으로 nearest-neighbor 보간되어 선명 유지
- Playwright 테스트 (`tests/sprite-scale.spec.js`): 21개 테스트 (수용기준 9 + 예외 6 + 시각적 3 + 모바일 3)

### 변경
- Player.js (`js/entities/Player.js`): SPRITE_SCALE import 추가, `this.setScale(SPRITE_SCALE)` 적용 (displayWidth 48px), body offset을 `(24 * SPRITE_SCALE) / 2 - 12 = 12`로 계산하여 `setCircle(12, 12, 12)` 설정
- Enemy.js (`js/entities/Enemy.js`): SPRITE_SCALE import 추가, 실 텍스처 `setScale(SPRITE_SCALE)`, 플레이스홀더 `setScale(SPRITE_SCALE * radius / 12)`, body offset을 `frameW * scaleX` 기준으로 동적 계산
- Projectile.js (`js/entities/Projectile.js`): SPRITE_SCALE import 추가, `this.setScale(SPRITE_SCALE)` 적용 (displayWidth 12px), body offset을 `Math.max(0, (6 * SPRITE_SCALE) / 2 - 4) = 2`로 계산하여 `setCircle(4, 2, 2)` 설정
- XPGem.js (`js/entities/XPGem.js`): SPRITE_SCALE import 추가, constructor/spawn() 모두 `this.setScale(SPRITE_SCALE)` 적용, spawn()에서 타입별 텍스처 원본 크기(small:6, medium:10, large:14) x SPRITE_SCALE 기준 body offset 재계산

### 참고
- 스펙: `.claude/specs/2026-03-09-sprite-scale.md`
- 구현 리포트: `.claude/specs/2026-03-09-sprite-scale-report.md`
- QA: `.claude/specs/2026-03-09-sprite-scale-qa.md`
- QA 결과: 수용기준 6/6 PASS, 예외 시나리오 8/8 PASS, Playwright 21/21 전체 통과. 시각적 검증 스크린샷 5건 확인. 오브젝트 풀 재사용 시 스케일 유지 검증 완료

## 2026-03-09 -- 레벨업 스킵 버튼 (버그 수정)

### 수정
- 모든 업그레이드 완료 상태에서 레벨업 시 게임이 멈추는 치명적 버그 수정 (`js/scenes/LevelUpScene.js`)
  - `_renderCards()`에서 `choices.length === 0` 분기 추가, `_renderSkip()` 호출
  - `_renderSkip()` 신규 메서드: "모든 업그레이드 완료!" 안내 텍스트 + 네온 스타일 스킵 버튼 렌더링, `_skipMode = true` 설정으로 리롤 버튼 숨김
  - `_skipLevelUp()` 신규 메서드: `levelupDone` 이벤트 발행(rerollsLeft 유지) + GameScene resume + 씬 stop
  - `create()` 상단에 `this._skipMode = false;` 초기화 추가 (Phaser 씬 인스턴스 재사용 시 이전 스킵 상태 잔존 방지)
  - `_createRerollButton()`에서 기존 리롤 버튼 요소 제거 코드를 `_skipMode` 가드 앞으로 이동 (리롤 후 스킵 전환 시 잔존 버튼 정리)

### 추가
- i18n 2키 (`js/i18n.js`): `levelup.allMaxed`(ko: '모든 업그레이드 완료!', en: 'All Upgrades Maxed!'), `levelup.skip`(ko: '스킵', en: 'Skip')

### 참고
- 스펙: `.claude/specs/2026-03-09-levelup-skip.md`
- 구현 리포트: `.claude/specs/2026-03-09-levelup-skip-report.md`
- QA: `.claude/specs/2026-03-09-levelup-skip-qa.md`
- QA 결과: 수용기준 5개 전체 PASS, 예외 시나리오 6개 PASS, Playwright 14/14. 이전 QA 발견 2건(HIGH: _skipMode 초기화 누락, MEDIUM: 리롤 시 잔존 버튼 미정리) 모두 수정 확인 완료

## 2026-03-09 -- 무기별 결과 리포트

### 추가
- WeaponSystem.weaponStats Map (`js/systems/WeaponSystem.js`): 무기 장착 시 { kills: 0, damage: 0 } 초기화, 런 동안 무기별 킬 수 및 총 데미지 추적
- WeaponSystem.recordDamage(weaponId, amount) (`js/systems/WeaponSystem.js` L260-265): 7개 데미지 경로에서 호출. 미등록 weaponId 시 무시
- WeaponSystem.recordKill(weaponId) (`js/systems/WeaponSystem.js` L271-276): GameScene.onEnemyKilled()에서 호출. 미등록 weaponId 시 무시
- Projectile.weaponId 필드 (`js/entities/Projectile.js` L32): 투사체에 발사 무기 ID 저장. fire() 시 null 리셋, 풀 재사용 안전
- Enemy._lastHitWeaponId 필드 (`js/entities/Enemy.js` L239): takeDamage 4번째 인자로 weaponId 수신. _resetBehaviorState()에서 null 초기화
- GameScene._buildWeaponReport() (`js/scenes/GameScene.js` L340-365): 무기별 통계 스냅샷 생성. DPS = damage / Math.max(1, runTimeSec). 진화 무기 _evolvedNameKey 사용. 데미지 높은 순 정렬
- ResultScene._renderWeaponReport() (`js/scenes/ResultScene.js` L366-459): 무기별 리포트 UI 렌더링. 최대 6개 표시(slice(0, maxDisplay)). 무기명(11px), 킬/DPS(9px), 데미지 비율 바(높이 6px, NEON_CYAN), 데미지 수치(9px). 행 높이 28px. 등장 애니메이션 포함
- i18n 3키 (`js/i18n.js`): `result.weaponReport`(ko: '무기별 리포트', en: 'Weapon Report'), `result.weaponKills`(ko: '{0}킬', en: '{0} Kills'), `result.weaponDps`(ko: 'DPS {0}', en: 'DPS {0}')
- Playwright 테스트 (`tests/weapon-report.spec.js`): 28개 테스트 (26 PASS / 2 테스트 인프라 FAIL)
- Playwright 레이아웃 테스트 (`tests/weapon-report-layout.spec.js`): 11개 테스트 전체 PASS

### 변경
- GameScene._onProjectileHitEnemy() (`js/scenes/GameScene.js` L778-779): recordDamage(weaponId, dmg) 호출 추가
- GameScene.onEnemyKilled() (`js/scenes/GameScene.js` L410-412): weaponId 인자 추가, recordKill(weaponId) 호출
- GameScene._goToResult() (`js/scenes/GameScene.js` L381-394): _buildWeaponReport() 호출 후 weaponReport를 ResultScene에 전달
- GameScene 일시정지 포기 (`js/scenes/GameScene.js` L1139-1167): 일반/엔들리스 모드 모두 weaponReport 전달
- WeaponSystem 7개 데미지 경로: beam(L475-476), orbital(L660-661), chain(L735-736), homing(L970-971), summon(L1139 proj.weaponId), aoe(L1189-1190)에 weaponId 전달 및 recordDamage 호출 추가
- ResultScene.init() (`js/scenes/ResultScene.js` L59): weaponReport 수신 (|| [] 폴백)
- ResultScene 레이아웃 압축: 타이틀 Y 100->80, 통계 시작 Y 200->160, 통계 행 높이 30->26px, 보상 폰트 16->14px
- ResultScene 하단 버튼 동적 Y좌표 (`js/scenes/ResultScene.js` L223-232): contentEndY 기준 계산, maxAdBtnY 상한으로 GAME_HEIGHT(640) 초과 방지. 버튼 간격 60->44px

### 참고
- 스펙: `.claude/specs/2026-03-09-weapon-report.md`
- 구현 리포트: `.claude/specs/2026-03-09-weapon-report-layout-fix-report.md`
- QA: `.claude/specs/2026-03-09-weapon-report-qa.md`
- QA 결과: 수용기준 15개 전체 PASS, 예외 시나리오 15개 PASS, Playwright 기존 26/28 + 레이아웃 11/11. 시각적 검증 스크린샷 9건 확인. 최초 PARTIAL(레이아웃 겹침) -> 수정 후 PASS
- 승리+엔들리스+무기6개 최악 케이스에서 메뉴 버튼 하단이 GAME_HEIGHT(640)과 정확히 일치. 시각적으로 문제 없으나 간격이 매우 좁음(LOW 위험)

## 2026-03-09 -- 아트 Phase 1: 스프라이트 에셋 전환

### 추가
- 에셋 생성 스크립트 (`scripts/generate-sprites.js`): DALL-E 3 API 호출, sharp로 배경 제거(밝기 임계값 40 이하 투명화) + nearest-neighbor 리사이즈, 스프라이트시트 2프레임 가로 합성, PNG 저장. dotenv로 루트 `.env` API 키 로드
- 스프라이트 에셋 15종 (`assets/sprites/`): player.png(48x24), projectile.png(6x6), 잡몹 10종(32x16~64x32), xp_gem_s/m/l(6x6, 10x10, 14x14)
- BootScene._createAnimations() 신규 메서드 (`js/scenes/BootScene.js`): player_idle(2F, 4fps, 반복) + 잡몹 10종 idle(2F, 3fps, 반복) 애니메이션 등록. textures.exists/anims.exists 가드로 중복 방지
- Phase 1 아트 QA 테스트 (`tests/phase1-art-qa.spec.js`): 22개 테스트

### 변경
- BootScene.preload() (`js/scenes/BootScene.js`): player 스프라이트시트(frameWidth:24, frameHeight:24), projectile 이미지, 잡몹 10종 스프라이트시트, XP 보석 3종 이미지 로드 추가. @fileoverview 주석 갱신
- BootScene.create() (`js/scenes/BootScene.js`): _generateBackgroundTile() 이후 _createAnimations() 호출 추가
- Player.js (`js/entities/Player.js`): player_temp 생성 블록 제거, super에 'player' 키 사용, player_idle 애니메이션 재생, 충돌체 setCircle(10, 2, 2)
- Projectile.js (`js/entities/Projectile.js`): projectile_temp 생성 블록 제거, super에 'projectile' 키 사용, COLORS import 제거, 충돌체 setCircle(3)
- XPGem.js (`js/entities/XPGem.js`): xpgem_temp 생성 블록 + GEM_COLORS + GEM_SIZES 상수 제거, COLORS import 제거, super에 'xp_gem_s' 키 사용, spawn()에서 setTexture(texMap[type]) + setScale(1) + clearTint() + 타입별 충돌체 조정(small:3, medium:5, large:7)
- Enemy.js (`js/entities/Enemy.js`): enemy_temp 생성 블록 제거, super에 'enemy_nano_drone' 키 사용, init()에서 textures.exists(texKey) 체크 후 setTexture/play(idle) 전환 + 폴백(setScale/setTint) 유지, 충돌체 offset 음수 방지(Math.max(0, ...))
- package.json: devDependencies에 dotenv ^17.3.1, openai ^6.27.0, sharp ^0.34.5 추가

### 참고
- 스펙: `.claude/specs/2026-03-09-phase1-art.md`
- 구현 리포트: `.claude/specs/2026-03-09-phase1-art-report.md`
- QA: `.claude/specs/2026-03-09-phase1-art-qa.md`
- QA 결과: 수용기준 7개 전체 PASS, 예외 시나리오 10개 PASS, Playwright 21/22 (실패 1건은 모바일 뷰포트 테스트 인프라 이슈로 코드 결함 아님). 에셋 크기 15종 전수 검증 PASS
- 스펙 본문에 "16종"으로 기재되었으나 실제 에셋 목록은 15종 (player 1 + projectile 1 + enemy 10 + xp_gem 3). 스펙 수치 오류
- 스프라이트시트 frame2는 frame1과 동일 (단순화 처리). 추후 수작업 교체 가능
- Enemy.js takeDamage() 피격 플래시에서 정식 텍스처에도 setTint(HP_RED) 적용되는 부작용 있음. 스펙 범위 외로 미수정. 향후 별도 이슈 권장

## 2026-03-09 -- 자동 사냥 (Auto Hunt) 유료 기능

### 추가
- AutoPilotSystem 신규 생성 (`js/systems/AutoPilotSystem.js`): 종합형 AI 이동 시스템. 행동 우선순위: 위험 회피(120px) > XP 보석 수집(200px) > 적 접근(150px) > 방랑(중앙 경향). 의도적 불완전성 포함 (랜덤 각도 변동 0.3rad, 반응 누락 5%, 방향 전환 간격 150ms). 벽 회피 마진 80px, 심각한 위험 반경 60px
- IAPManager 신규 생성 (`js/managers/IAPManager.js`): Google Play 인앱결제 관리자. Capacitor.Plugins.InAppPurchase 래핑. 웹 환경 Mock 모드(즉시 purchased:true). purchase(), restorePurchases(), isAutoHuntUnlocked(), unlockAutoHunt() API 제공. isBusy 플래그로 중복 구매 차단. 싱글톤 패턴 (AdManager와 동일 구조)
- IAP 상수 (`js/config.js`): `IAP_PRODUCTS.autoHunt = 'com.antigravity.neonexodus.auto_hunt'`, `AUTO_HUNT = { directionInterval: 150, dangerRadius: 120, xpSearchRadius: 200 }`
- SaveManager v3->v4 마이그레이션 (`js/managers/SaveManager.js`): `autoHuntUnlocked`(boolean, 기본 false), `autoHuntEnabled`(boolean, 기본 false) 필드 추가. DEFAULT_SAVE 및 _migrate() 체인 확장
- GameScene HUD AUTO 토글 버튼 (`js/scenes/GameScene.js`): 해금 시에만 표시, 우상단(GAME_WIDTH-12, y=48), _toggleAutoHunt()로 활성/비활성 전환 및 SaveManager 즉시 저장
- MenuScene 자동 사냥 구매 UI (`js/scenes/MenuScene.js`): 미해금 시 오렌지 "자동 사냥 해금" 버튼, _showAutoHuntPurchase() 메서드(구매 성공/실패 메시지). 해금 후 "AUTO ON" 녹색 텍스트 표시
- i18n 자동 사냥 키 10개 (`js/i18n.js`): `autoHunt.label/on/off/locked/purchase/purchaseDesc/purchaseBtn/purchaseSuccess/purchaseFail/restored` ko/en 양쪽
- 자동 사냥 Playwright 테스트 (`tests/auto-hunt.spec.js`): 29개 테스트

### 변경
- config.js: `SAVE_DATA_VERSION` 3->4, `IAP_PRODUCTS` 상수 추가, `AUTO_HUNT` 설정 상수 추가
- BootScene (`js/scenes/BootScene.js`): IAPManager import, create()에서 IAPManager.initialize() + restorePurchases() 호출
- GameScene (`js/scenes/GameScene.js`): IAPManager/AutoPilotSystem import, create()에서 AutoPilotSystem 초기화 및 이전 런 설정 복원, update()에 autoPilot.update() 호출, _cleanup()에 autoPilot.destroy() 추가
- Player._handleMovement() (`js/entities/Player.js`): 조이스틱 입력 우선 + else if autoPilot AI 방향 사용 구조로 변경
- MenuScene (`js/scenes/MenuScene.js`): IAPManager import, IAP_PRODUCTS import, 자동 사냥 구매/해금 완료 UI 추가

### 참고
- 스펙: `.claude/specs/2026-03-09-auto-hunt.md`
- 구현 리포트: `.claude/specs/2026-03-09-auto-hunt-report.md`
- QA: `.claude/specs/2026-03-09-auto-hunt-qa.md`
- QA 결과: 수용기준 13개 + 예외 시나리오 12개 = 총 29개 전체 PASS, Playwright 29/29, 시각적 검증 스크린샷 10건 확인

## 2026-03-09 -- 업그레이드 다운그레이드 + 크레딧 환불

### 추가
- MetaManager 다운그레이드 메서드 3종 (`js/managers/MetaManager.js`): `canDowngrade(upgradeId)` 가능 여부 확인, `getDowngradeRefund(upgradeId)` 환불액 계산 (`costFormula(currentLevel)` 100% 전액), `downgradeUpgrade(upgradeId)` 실행 (addCredits + setUpgradeLevel)
- MetaManager.getAllUpgrades() 반환 객체에 `canDowngrade`, `downgradeRefund` 필드 추가 (`js/managers/MetaManager.js`)
- UpgradeScene `_createDowngradeButton()` 헬퍼 메서드 (`js/scenes/UpgradeScene.js`): [-] 다운그레이드 버튼 생성. 활성 색상 `0xAA3300`, 비활성 `0x333344`. 너비 51px ([+] 버튼 80px, 간격 4px)
- i18n 키 2개 (`js/i18n.js`): `upgrade.downgrade` ('-'), `upgrade.downgradeRefund` ('환불: {0}') ko/en 양쪽

### 변경
- UpgradeScene `_createUpgradeCard()` (`js/scenes/UpgradeScene.js`): 버튼 영역을 [-]/[+] 2열 레이아웃으로 변경. MAX 카드에서도 [-] 버튼 + MAX 레이블 나란히 배치. 잠금 카드에는 [-] 버튼 미표시

### 참고
- 스펙: `.claude/specs/2026-03-09-upgrade-downgrade.md`
- 구현 리포트: `.claude/specs/2026-03-09-upgrade-downgrade-report.md`
- QA: `.claude/specs/2026-03-09-upgrade-downgrade-qa.md`
- QA 결과: 수용기준 10개 + 예외 시나리오 8개 = 총 17개 전체 PASS, Playwright 17/17

## 2026-03-09 -- Phase 4: 폴리싱

### 추가
- 드론 무기 (`js/data/weapons.js`): DRONE_LEVELS Lv1~8, summon 타입. droneCount 1~4, damage 12~50, cooldown 1000~600ms, shootRange 120~160px, moveSpeed 150~200px/s
- EMP 폭발 무기 (`js/data/weapons.js`): EMP_BLAST_LEVELS Lv1~8, aoe 타입. damage 15~75, cooldown 5000~3000ms, radius 100~185px, slowFactor 0.35~0.50, slowDuration 2000~2800ms
- WeaponSystem summon/aoe 타입 처리 (`js/systems/WeaponSystem.js`): _drones 배열, _spawnDrones, _updateDrones, _droneFire, _updateAoe, _triggerEmp. 드론 독립 AI(적 추적/호버링), EMP 범위 데미지+둔화
- SoundSystem 신규 생성 (`js/systems/SoundSystem.js`): AudioContext 기반 프로그래매틱 SFX 9종(shoot, hit, player_hit, levelup, evolution, boss_appear, emp_blast, revive, xp_collect) + BGM 2곡(bgm_game 80BPM 8바 루프, bgm_menu 120BPM 2바 루프). 외부 오디오 파일 미사용
- VFXSystem 신규 생성 (`js/systems/VFXSystem.js`): Phaser Particles 기반 VFX 6종(hitSpark, playerHit, enemyDie, levelUpBurst, empBurst, xpCollect). 4x4 흰색 particle 텍스처 사용
- 엔들리스 모드 (`js/scenes/GameScene.js`): 코어 프로세서 처치 후 _onEnterEndless()로 엔들리스 진입, ENDLESS_SCALE_INTERVAL(60초)마다 적 HP/데미지 +10% 누적, 5분마다 미니보스 리스폰, HUD +MM:SS 카운트업
- WaveSystem 엔들리스 지원 (`js/systems/WaveSystem.js`): enterEndlessMode(), applyEndlessScale(), spawnEndlessMiniboss(). _hpMultiplier/_dmgMultiplier 누적 스케일링
- SaveManager v2->v3 마이그레이션 (`js/managers/SaveManager.js`): totalSurviveMinutes 통계 추가, DEFAULT_SAVE.stats에 반영
- Phase 4 Playwright 테스트 (`tests/phase4.spec.js`): 27개 테스트

### 변경
- GameScene (`js/scenes/GameScene.js`): 캐릭터 패시브 hpRegenMultiplier/weaponMaster/droneSummonBonus 적용 블록 추가, engineer blaster 폴백 코드 제거, _onRunClear() 데드 코드 제거, onPlayerDeath() 및 _quitText 핸들러에서 SoundSystem.stopBgm() 호출, ENDLESS_SCALE_INTERVAL import 및 상수 사용, SFX/VFX 연결 포인트 10개소
- LevelUpScene (`js/scenes/LevelUpScene.js`): getAvailableWeapons(3)->getAvailableWeapons(4) 변경, weaponChoiceBias 가중치 지원
- ResultScene (`js/scenes/ResultScene.js`): isEndless/endlessMinutes 수신, 엔들리스 모드 결과 표시, totalSurviveMinutes 통계 누적
- MenuScene (`js/scenes/MenuScene.js`): SoundSystem.playBgm('bgm_menu') 호출, 터치 시 SoundSystem.resume()
- BootScene (`js/scenes/BootScene.js`): SoundSystem.init(settings) 호출, particle 텍스처 생성
- Player (`js/entities/Player.js`): regenMultiplier, droneSummonBonus, weaponChoiceBias, maxHpPenalty 속성 추가, _updateRegen()에 regenMultiplier 적용
- characters.js: hidden 캐릭터 uniquePassive 실데이터(weaponMaster, extraWeaponSlots:2, weaponChoiceBias:2.0), medic 해금조건 totalSurviveMinutes>=500, engineer startWeapon을 drone으로 확정
- config.js: SAVE_DATA_VERSION 2->3, ENDLESS_SCALE_INTERVAL=60000 추가
- i18n.js: 드론 Lv1~8, EMP Lv1~8, 메딕/히든 캐릭터, 엔들리스 모드 텍스트 ko/en 추가 (총 336키)

### 수정
- ResultScene BGM 미정지: onPlayerDeath() L301, _quitText L802에서 SoundSystem.stopBgm() 호출 추가
- en 로케일 i18n 키 누락: game.endlessMode, result.endless, result.endlessOver 3개 키 en 사전에 추가
- ENDLESS_SCALE_INTERVAL 하드코딩: GameScene에서 config.js 상수 import 및 사용, 60000 리터럴 제거
- _onRunClear() 데드 코드: 엔들리스 모드 도입으로 불필요해진 메서드 완전 제거

### 참고
- 스펙: `.claude/specs/2026-03-09-neon-exodus-phase4.md`
- 수정 리포트: `.claude/specs/2026-03-09-neon-exodus-phase4-fix-report.md`
- QA: `.claude/specs/2026-03-09-neon-exodus-phase4-qa.md`
- QA 결과: 수용기준 A~I 전체 PASS, Playwright 25/27 (실패 2건은 테스트 인프라/설계 문제로 코드 결함 아님). 최초 조건부 PASS(4건 권장 수정) -> 수정 후 무조건 PASS

## 2026-03-09 -- Phase 3: 콘텐츠 확장

### 추가
- 전기 체인 무기 (`js/data/weapons.js`): ELECTRIC_CHAIN_LEVELS Lv1~8, chain 타입. damage 20~68, cooldown 1200~800ms, chainCount 2~6, chainRange 120~200px, chainDecay 0.80~0.86
- 미사일 무기 (`js/data/weapons.js`): MISSILE_LEVELS Lv1~8, homing 타입. damage 25~100, cooldown 2500~1400ms, speed 200~290, turnSpeed 1.5~2.8, explosionRadius 50~95, range 400~550
- 진화 무기 3종 (`js/data/weapons.js`): EVOLVED_WEAPONS(precision_cannon, plasma_storm, nuke_missile) + WEAPON_EVOLUTIONS 레시피 3개
- WeaponSystem chain/homing 타입 처리 (`js/systems/WeaponSystem.js`): _updateChain, _fireChain, _drawLightning, _updateHoming, _fireMissile, _updateMissiles, _explodeMissile
- 치명타 시스템 (`js/systems/WeaponSystem.js`): _rollCrit() 헬퍼, _showCritEffect() 시각 피드백. 5개 데미지 계산 지점(projectile/beam/orbital/chain/homing)에 적용
- Projectile.isCrit 속성 (`js/entities/Projectile.js`): 투사체 발사 시 치명타 여부 저장, 풀 재사용 시 리셋
- 무기 진화 자동 체크 (`js/scenes/GameScene.js`): _tryEvolutionCheck(), _showEvolutionPopup(). levelupDone 이벤트에서 호출
- CharacterScene 신규 생성 (`js/scenes/CharacterScene.js`): 캐릭터 선택 화면, 해금/잠금 표시, 세로 스크롤, 출격/뒤로 버튼
- AchievementScene 신규 생성 (`js/scenes/AchievementScene.js`): 도전과제 13개 목록, 진행률 표시, 세로 스크롤
- CollectionScene 신규 생성 (`js/scenes/CollectionScene.js`): 4탭(무기/패시브/적/도전과제) 도감, 미발견 항목 ??? 마스킹, 진화 무기 포함
- Player 치명타 관련 속성 (`js/entities/Player.js`): critDamageMultiplier(기본 0.0), lowHpAttackBonus(기본 0.0), hpThreshold(0.5), getEffectiveAttackMultiplier()
- SaveManager 통계 totalBossKills (`js/managers/SaveManager.js`): DEFAULT_SAVE.stats.totalBossKills: 0, collection 필드(weaponsSeen/passivesSeen/enemiesSeen) 추가
- SaveManager v1->v2 마이그레이션 (`js/managers/SaveManager.js`): totalBossKills 없으면 0 초기화
- Phase 3 Playwright 테스트 (`tests/phase3.spec.js`): 12개 테스트
- Phase 3 치명타 전용 테스트 (`tests/phase3-crit.spec.js`): 7개 테스트

### 변경
- GameScene (`js/scenes/GameScene.js`): init()에 characterId 수신, 캐릭터 고유 패시브 적용(critDamageMultiplier/lowHpAttackBonus), engineer drone->blaster 폴백, onEnemyKilled()에서 적 도감 등록 + 보스킬 통계, weaponEvolutions 카운트 + ResultScene 전달
- LevelUpScene (`js/scenes/LevelUpScene.js`): getAvailableWeapons(2)->getAvailableWeapons(3) 변경, _addPassive()에서 도감 등록
- ResultScene (`js/scenes/ResultScene.js`): weaponEvolutions 수신, AchievementManager.checkAll() 인자에 포함
- MenuScene (`js/scenes/MenuScene.js`): 출격 버튼 CharacterScene 전환, 도전과제/도감 버튼 활성화
- main.js: CharacterScene, AchievementScene, CollectionScene 씬 등록
- config.js: SAVE_DATA_VERSION 1->2
- i18n.js: Phase 3 신규 i18n 키 추가 (weapon.electric_chain.*, weapon.missile.*, weapon.evolution.*, character.*, collection.*, game.evolved, game.revived 등)
- weapons.js: WEAPONS 배열의 electric_chain/missile levels를 실 데이터로 교체

### 참고
- 스펙: `.claude/specs/2026-03-09-neon-exodus-phase3.md`
- 수정 리포트: `.claude/specs/2026-03-09-neon-exodus-phase3-fix-report.md`
- QA: `.claude/specs/2026-03-09-neon-exodus-phase3-qa.md`
- QA 결과: 수용기준 A~I + NF 27개 항목 전체 PASS, Playwright 19/19 (기존 12개 + 치명타 전용 7개). 최초 E-1 FAIL 후 치명타 시스템 수정하여 재검증 PASS

## 2026-03-09 -- Phase 2: 메타 루프 + 신규 무기

### 추가
- UpgradeScene 신규 구현 (`js/scenes/UpgradeScene.js`): 4탭(기본/성장/특수/한계돌파) 카드 그리드 방식 영구 업그레이드 구매 UI
- 레이저건 무기 (`js/data/weapons.js`): LASER_GUN_LEVELS Lv1~8, beam 타입. tickDamage 8~35, 쿨다운 2000~1200ms, 지속시간 300~500ms, 사거리 300~450px
- 플라즈마 오브 무기 (`js/data/weapons.js`): PLASMA_ORB_LEVELS Lv1~8, orbital 타입. orbCount 1~4, tickDamage 6~32, orbRadius 55~90px, 공전속도 2.0~3.5 rad/s, 틱간격 500~300ms
- ORBIT_RADIUS 상수 70px (`js/data/weapons.js`)
- WeaponSystem beam/orbital 타입 처리 분기 (`js/systems/WeaponSystem.js`): _beamGraphics, _beamStates, _orbData, renderBeams(), _updateBeam, _updateOrbital, _applyBeamDamage, _applyOrbDamage, _rebuildOrbs, _pointToSegmentDist
- 부활 기능 (`js/scenes/GameScene.js`): revivesLeft > 0이면 HP 50% 회복, 2초 무적, 화면 플래시
- 리롤 기능 (`js/scenes/LevelUpScene.js`): rerollsLeft 기반, 리롤 버튼 UI, 선택지 재생성
- 새 무기 획득 카드 (`js/scenes/LevelUpScene.js`): new_weapon 타입, Phase 2 이하 미장착 무기 선택
- Phase 2 QA 테스트 (`tests/phase2-qa.spec.js`)

### 변경
- GameScene (`js/scenes/GameScene.js`): MetaManager/SaveManager 임포트, create()에서 MetaManager.getPlayerBonuses() 호출하여 revivesLeft/rerollsLeft/maxWeaponSlots/startWeaponLevel 적용, Player.applyMetaUpgrades() 연결, update()에 renderBeams() 호출
- LevelUpScene (`js/scenes/LevelUpScene.js`): getAvailableWeapons 임포트, init()에 rerollsLeft/maxWeaponSlots 수신, create()를 _renderCards()/_createRerollButton()으로 분리, _generateChoices()에 new_weapon 후보 추가, _applyChoice()에 new_weapon 처리 및 levelupDone 이벤트 emit
- ResultScene (`js/scenes/ResultScene.js`): SaveManager/AchievementManager/MetaManager 임포트, init()에 weaponSlotsFilled 수신, create()에서 크레딧 저장 및 통계 갱신(totalRuns, totalKills, longestSurvival, maxKillsInRun, maxLevel, totalClears, consecutiveClears), AchievementManager.checkAll() 호출
- MenuScene (`js/scenes/MenuScene.js`): SaveManager 임포트, 업그레이드 버튼 활성화 (UpgradeScene 전환), 크레딧/데이터코어 실시간 표시, wake/resume 이벤트에 _refreshCredits 연결
- main.js: UpgradeScene 임포트 및 씬 목록에 추가
- i18n.js: 레이저건 lv1~8, 플라즈마 오브 lv1~8, limitBreakHint, 리롤, 부활 등 텍스트 ko/en 추가
- weapons.js: WEAPONS 배열의 laser_gun/plasma_orb levels를 빈 배열에서 실 데이터로 교체

### 참고
- 스펙: `.claude/specs/2026-03-08-neon-exodus-phase2.md`
- 구현 리포트: `.claude/specs/2026-03-08-neon-exodus-phase2-report.md`
- QA: `.claude/specs/2026-03-08-neon-exodus-phase2-qa.md`
- QA 결과: 수용기준 A~I 47개 세부 기준 전부 PASS, Playwright 34/39 (실패 5건은 테스트 환경 타이밍 이슈로 코드 결함 아님)

## 2026-03-08 — Phase 1: 코어 루프 MVP

### 추가
- 프로젝트 초기 셋업 (Phaser 3.87.0 CDN, Capacitor 8, ES Modules, `index.html`, `package.json`)
- 게임 설정 (`js/config.js`): 해상도 360x640, 월드 2000x2000, 조이스틱, XP 공식, 런 15분, 네온 컬러 팔레트
- i18n (`js/i18n.js`): 한국어/영어 279키 x 2 = 558 항목, `t()` 함수 번역 시스템
- 가상 조이스틱 이동 시스템 (`js/systems/VirtualJoystick.js`): 데드존 8px, 최대반경 50px
- 블래스터 자동 공격 Lv1~8 (`js/systems/WeaponSystem.js`, `js/entities/Projectile.js`): 데미지 10~45, 쿨다운 500~250ms, 관통 1~2
- 적 10종 + 미니보스 2종 + 보스 3종 (`js/data/enemies.js`, `js/entities/Enemy.js`, `js/entities/EnemyTypes.js`): 15종 행동 AI
- 스폰 시스템 (`js/data/waves.js`, `js/systems/WaveSystem.js`): 6구간 시간대별 스폰 테이블, 미니보스/보스 스케줄, HP/DMG +5%/분 스케일링
- XP 보석 시스템 (`js/entities/XPGem.js`): 소(1)/중(3)/대(10), 자석 흡수, 깜빡임 소멸
- 레벨업 3택 시스템 (`js/scenes/LevelUpScene.js`): 무기 레벨업, 패시브 획득/레벨업, 카드 UI
- 패시브 아이템 10종 (`js/data/passives.js`): 부스터/아머/배터리팩/오버클럭/자석/재생/조준/크리티컬/쿨다운/행운
- 15분 타이머 + 최종 보스 클리어/사망 판정
- HUD (`js/scenes/GameScene.js`): HP바, XP바, 레벨, 타이머, 크레딧, 킬수, 일시정지 버튼
- 메인 메뉴 (`js/scenes/MenuScene.js`): 타이틀(네온 효과), 출격 버튼, 업그레이드/도감 비활성, 언어 토글
- 결과 화면 (`js/scenes/ResultScene.js`): 승리/패배 분기, 통계, 보상, 재도전/메뉴 버튼, 등장 애니메이션
- SaveManager (`js/managers/SaveManager.js`): 로컬스토리지 세이브/로드, 세이브 버전 v1
- MetaManager (`js/managers/MetaManager.js`): 영구 업그레이드 구매/적용 계산
- AchievementManager (`js/managers/AchievementManager.js`): 도전과제 조건 검사/보상 지급
- 영구 업그레이드 22종 데이터 (`js/data/upgrades.js`): 기본 8종 + 성장 6종 + 특수 5종 + 한도돌파 3종
- 도전과제 13종 데이터 (`js/data/achievements.js`): 킬 4종 + 생존 3종 + 클리어 3종 + 특수 3종
- 캐릭터 6종 데이터 (`js/data/characters.js`): 에이전트(기본) + 5종(Phase 3~4)
- 무기 7종 데이터 구조 (`js/data/weapons.js`): 블래스터 Lv1~8 전체 + 6종 구조 + 진화 레시피 구조
- 오브젝트 풀 (`js/systems/ObjectPool.js`): Phaser Group 기반 재사용
- 빌드 스크립트 (`scripts/build.js`): www/ 디렉토리 생성

### 참고
- 스펙: `.claude/specs/2026-03-08-neon-exodus-initial-design.md`
- 구현 리포트 1: `.claude/specs/2026-03-08-neon-exodus-initial-design-report.md`
- 구현 리포트 2: `.claude/specs/2026-03-08-neon-exodus-core-systems-report.md`
- 구현 리포트 3: `.claude/specs/2026-03-08-neon-exodus-scenes-report.md`
- QA: `neon-exodus/.claude/specs/2026-03-08-neon-exodus-phase1-qa.md`
- QA 결과: 수용기준 13/13 PASS, Playwright 14/24 (실패 10건 중 게임 버그 0건: 폰트 404 5건 + 테스트 인프라 3건 + 씬 전환 타이밍 2건)
