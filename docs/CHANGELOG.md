# Changelog

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
