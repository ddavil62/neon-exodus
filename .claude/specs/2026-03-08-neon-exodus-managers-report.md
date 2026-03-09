# Implementation Report: NEON EXODUS Phase 1 - Manager Layer

## 작업 요약
NEON EXODUS 게임의 매니저 계층 3개(SaveManager, MetaManager, AchievementManager)를 구현했다. 로컬스토리지 기반 세이브/로드, 영구 업그레이드 구매/보너스 계산, 도전과제 추적/보상 지급 기능을 담당한다.

## 변경된 파일
| 파일 경로 | 작업 유형 | 변경 내용 |
|---|---|---|
| `neon-exodus/js/managers/SaveManager.js` | 신규 | 로컬스토리지 세이브/로드, 기본 세이브 구조(DEFAULT_SAVE), 재화/업그레이드/캐릭터/도전과제/통계/도감/설정 접근 메서드, 데이터 병합 및 마이그레이션 골격 |
| `neon-exodus/js/managers/MetaManager.js` | 신규 | 영구 업그레이드 구매 가능 여부 확인, 비용 계산(costFormula), 구매 처리, 통합 플레이어 보너스(getPlayerBonuses) 22종 계산, limitBreak 해금 조건 처리 |
| `neon-exodus/js/managers/AchievementManager.js` | 신규 | 도전과제 13종 조건 검사(킬/생존/클리어/특수), 보상 지급(크레딧/데이터코어/캐릭터해금), 알림 큐 관리 |

## 스펙 대비 구현 상태
- [x] SaveManager.init() - 로드 또는 기본값 생성 + 마이그레이션 체크
- [x] SaveManager.save() / load() - 로컬스토리지 읽기/쓰기
- [x] SaveManager.getData() - 현재 세이브 객체 반환
- [x] SaveManager 크레딧/데이터코어 접근 메서드
- [x] SaveManager 업그레이드 레벨 접근 메서드
- [x] SaveManager 캐릭터 해금/선택 메서드
- [x] SaveManager 도전과제 달성 메서드
- [x] SaveManager 통계 갱신 메서드 (누적형 vs 최대값형 구분)
- [x] SaveManager 도감(컬렉션) 추가 메서드
- [x] SaveManager resetAll() - 전체 초기화
- [x] DEFAULT_SAVE 구조 (version, credits, dataCores, upgrades, characters, achievements, stats, collection, settings)
- [x] MetaManager.getUpgradeLevel() / canUpgrade() / getUpgradeCost()
- [x] MetaManager.purchaseUpgrade() - 비용 차감 + 레벨 증가
- [x] MetaManager.getPlayerBonuses() - 22종 보너스 통합 계산
- [x] MetaManager.getAllUpgrades() - UI용 전체 업그레이드 + 상태 정보
- [x] MetaManager.isUnlocked() - limitBreak 해금 조건 확인
- [x] AchievementManager.checkAll() - 전체 도전과제 조건 검사
- [x] AchievementManager.checkKills() / checkSurvival() / checkClears() - 카테고리별 체크
- [x] AchievementManager.getNextNotification() - 알림 큐
- [x] AchievementManager.getAllAchievements() - 전체 목록 + 달성 여부
- [x] AchievementManager._grantReward() - 보상 지급 (credits, dataCore, dataCoreAndTitle, hiddenCharacterUnlock)

## 빌드/린트 결과
- 빌드: PASS (node --check 문법 검증 통과)
- 린트: N/A (프로젝트에 ESLint 미설정)

## 알려진 이슈
- `characters.js`의 `getUnlockedCharacters()` 함수는 `saveData.unlockedCharacters` 배열을 기대하지만, SaveManager의 DEFAULT_SAVE는 `characters: { agent: true }` 객체 형태를 사용한다. 이후 씬 구현 시 `getUnlockedCharacters`를 사용할 경우 어댑터가 필요하거나 해당 함수를 수정해야 한다.
- 마이그레이션 체인은 골격만 구현. 실제 버전업 시 마이그레이션 로직 추가 필요.

## QA 참고사항
- SaveManager는 `localStorage` API를 사용하므로 브라우저 환경에서만 동작한다. 테스트 시 Playwright 브라우저 컨텍스트 필요.
- MetaManager.getPlayerBonuses()의 각 보너스 수치가 스펙 문서(영구 업그레이드 22종)의 effectPerLevel과 일치하는지 검증 필요.
- AchievementManager의 특수 조건(lowHpClear, noDamageSurvive)은 런 데이터에서 직접 전달받는 구조이므로, GameScene 구현 시 해당 값을 계산하여 전달해야 한다.
- `import` 경로가 상대 경로이므로 실제 브라우저에서 ES Module 로드 시 정상 동작하는지 확인 필요.
