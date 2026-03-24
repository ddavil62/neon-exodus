# NEON EXODUS (네온 엑소더스)

> 최종 업데이트: 2026-03-24

## 개요

SF/사이버펑크 세계관의 뱀서라이크 자동 공격 서바이벌 게임. 조이스틱으로 이동하며 자동 공격으로 적을 처치하고, 레벨업 3택으로 무기/패시브를 강화하여 15분간 생존 후 최종 보스를 격파한다.

- **플랫폼**: Android (Capacitor APK/AAB), 세로 360x640
- **세이브**: localStorage v14 (마이그레이션 체인 v1~v14)

## 기술 스택

| 항목 | 내용 |
|---|---|
| 언어 | JavaScript (ES Modules) |
| 엔진 | Phaser 3.87.0 (CDN), Arcade Physics |
| 패키징 | Capacitor 8 |
| 폰트 | Galmuri11 (woff2, 현재 monospace 폴백) |
| 테스트 | Playwright |
| 빌드 | `node scripts/build.js` (www/ 생성) |

## 빌드/실행 명령어

```bash
node scripts/build.js          # www/ 빌드
npx cap sync android           # Android 동기화
npx playwright test             # 전체 테스트
```

## 디렉토리 구조

```
neon-exodus/
├── index.html                  # 엔트리 (Phaser CDN)
├── js/
│   ├── config.js               # 게임 상수, 밸런스, COLORS, UI_COLORS
│   ├── i18n.js                 # ko/en 다국어 (~390키)
│   ├── main.js                 # Phaser 인스턴스 생성
│   ├── scenes/                 # 10개 씬 (아래 씬 흐름 참조)
│   ├── entities/               # Player, Enemy, EnemyTypes, Projectile, Consumable, WeaponDropItem, XPGem
│   ├── systems/                # ObjectPool, VirtualJoystick, WeaponSystem, DroneCompanionSystem, WaveSystem, SoundSystem, VFXSystem, AutoPilotSystem
│   ├── managers/               # SaveManager, MetaManager, AchievementManager, DailyMissionManager, HapticManager, AdManager, IAPManager
│   └── data/                   # weapons, enemies, stages, passives, waves, upgrades, consumables, characters, characterSkills, dailyMissions, achievements, droneUpgrades
├── assets/                     # sprites/, backgrounds/, ui/ (GPT Image API + SVG 생성)
├── scripts/                    # 에셋 생성 스크립트, 빌드 스크립트
├── tests/                      # Playwright E2E 테스트
└── docs/                       # PROJECT.md, CHANGELOG.md, ART_CONCEPT.md
```

## 씬 흐름

```
BootScene → MenuScene ─→ StageSelectScene ─→ CharacterScene ─→ GameScene ↔ LevelUpScene
               │                                                    ↓
               ├── CharacterScene (직접)                       ResultScene
               ├── UpgradeScene
               ├── AchievementScene
               ├── DailyMissionScene
               ├── CollectionScene
               └── SettingsScene
```

## 핵심 모듈

| 모듈 | 파일 | 역할 |
|---|---|---|
| 게임 설정 | `config.js` | 해상도, 월드, 밸런스 상수, SPRITE_SCALE=1 |
| 다국어 | `i18n.js` | ko/en ~390키, `t()` 함수 |
| 플레이어 | `entities/Player.js` | 캐릭터별 스프라이트, 8방향 걷기, HP/XP, 메타 보너스, 버프 |
| 적 | `entities/Enemy.js` + `EnemyTypes.js` | 잡몹 10종 + 미니보스 2종 + 보스 6종, 15종 AI 패턴 |
| 무기 | `systems/WeaponSystem.js` | 10종 무기 타입, 자동 발사, 진화, 킬/데미지 추적 |
| 드론 | `systems/DroneCompanionSystem.js` | 메타 드론 동반자 (스테이지 2 해금) |
| 스폰 | `systems/WaveSystem.js` | 시간대별 스폰, 보스 스케줄, 난이도 배율 |
| 사운드 | `systems/SoundSystem.js` | AudioContext SFX 10종 + BGM 2곡 |
| VFX | `systems/VFXSystem.js` | Phaser Particles 9종 |
| AI 이동 | `systems/AutoPilotSystem.js` | 자동 사냥 AI (위험 회피 > 아이템 수집 > 적 접근) |
| 세이브 | `managers/SaveManager.js` | localStorage v14, 전체 진행 상태 영구 저장 |
| 메타 | `managers/MetaManager.js` | 영구 업그레이드 구매/다운그레이드/보너스 계산 |
| 도전과제 | `managers/AchievementManager.js` | 114종 달성 조건 검사/보상 |
| 일일 미션 | `managers/DailyMissionManager.js` | UTC 자정 리셋, 시드 PRNG 미션 선택, streak |
| 광고 | `managers/AdManager.js` | AdMob 보상형 광고, Mock 모드 |
| IAP | `managers/IAPManager.js` | Google Play IAP (@capgo/native-purchases), Mock 모드 |

## 기능 목록

### 코어 게임플레이

| 기능 | 설명 | 상태 |
|---|---|---|
| 가상 조이스틱 | 터치 기반 이동, 데드존 8px, 최대 50px | 완료 |
| 자동 공격 | 사거리 내 가장 가까운 적 자동 발사 | 완료 |
| 무기 10종 | blaster/laser/plasma_orb/chain/missile/drone/emp/force_blade/nanoswarm/vortex_cannon | 완료 |
| 무기 진화 11종 | 무기 Lv8 + 패시브 Lv5 조합으로 상위 무기 진화 | 완료 |
| 패시브 11종 | 이속/방어/HP/공속/자석/재생/사거리/크리/쿨다운/행운/데미지앰프 | 완료 |
| 적 15종 AI | 잡몹 10종 + 미니보스 2종 + 보스 6종 | 완료 |
| 소모성 아이템 6종 | 수리킷/자기펄스/EMP/크레딧칩/오버클럭/쉴드, 적 드롭 | 완료 |
| 스테이지 4종 | 배경/보스/해금무기가 다른 4개 스테이지 | 완료 |
| 무기 드롭 | 스테이지 고유 무기를 맵에 1개 배치, 탐색 수집 | 완료 |
| 엔들리스 모드 | 최종 보스 처치 후 무한 생존, 누적 스케일링 | 완료 |
| 난이도 3단계 | Normal/Hard/Nightmare, HP/ATK/SPD 배율, 보상 증가 | 완료 |

### 캐릭터

| 기능 | 설명 | 상태 |
|---|---|---|
| 캐릭터 6종 | Agent/Sniper/Engineer/Berserker/Medic/Hidden, 고유 패시브 | 완료 |
| 캐릭터 스프라이트 | GPT Image API 48x48 idle + 240x192 walk 스프라이트시트 | 완료 |
| 캐릭터 레벨 & 스킬 | 최대 Lv18, 4스킬(Q/W/E/R), 데이터코어로 성장 | 완료 |
| 궁극기(R) | 우하단 수동 발동 버튼, 쿨다운/레벨 게이트 | 완료 |
| DC 자동 분배 | 런 종료 시 플레이 캐릭터에 자동 투입 + 연출 | 완료 |
| 캐릭터 상세 뷰 | 스와이프/화살표/도트 탭 전환, 스킬 투자, 롱탭 툴팁 | 완료 |

### 메타 시스템

| 기능 | 설명 | 상태 |
|---|---|---|
| 재화 2종 | 크레딧(적 드롭/보상) + 데이터코어(난이도 보상/도전과제) | 완료 |
| 영구 업그레이드 22종 | 4탭(기본/성장/특수/한계돌파), 구매/다운그레이드 | 완료 |
| 부활 시스템 | 메타 업그레이드로 해금, HP 50% 회복 + 2초 무적 | 완료 |
| 도전과제 114종 | 7카테고리(kill/survive/clear/weapon/character/growth/explore) | 완료 |
| 일일 미션 | UTC 자정 리셋, 3개 미션, streak 보너스, 32종 풀 | 완료 |
| 도감 4탭 | 무기/패시브/적/진화, 자동 등록, 미발견 마스킹 | 완료 |
| 자동 사냥 | IAP 영구 해금, AI 자동 이동, 우선순위 기반 | 완료 |

### UI/HUD

| 기능 | 설명 | 상태 |
|---|---|---|
| 상단 HUD | 일시정지, HP/XP 바, 타이머, AUTO 토글, 난이도 배지 | 완료 |
| 인벤토리 HUD | 무기(32x32)/패시브(28x28) 슬롯, 탭 시 인포 모달 | 완료 |
| 레벨업 오버레이 | 3택 카드, 리롤, 전체 완료 시 스킵 | 완료 |
| 결과 화면 | 무기별 리포트, 난이도 보상, DC 분배 연출, 콘텐츠 압축 | 완료 |
| 진화/엔들리스 모달 | 게임 일시정지 + 정보 패널 | 완료 |
| 설정 | BGM/SFX/햅틱 ON/OFF 토글 | 완료 |

### 아트/비주얼

| 기능 | 설명 | 상태 |
|---|---|---|
| 글로우 벡터 아트 | GPT Image API 벡터 PNG 20종 + SVG 3종, SPRITE_SCALE=1 | 완료 |
| 시각적 인지성 | 적/플레이어 탄환 글로우, 플레이어 발밑 글로우, 피격 플래시 | 완료 |
| 배경 시스템 | 스테이지별 128x128 타일 + 장식 오브젝트 16종, 파괴 가능 데코 | 완료 |
| 무기 이펙트 | SVG 생성 10종 + 진화 전용 프로시저럴 10종 | 완료 |
| 사운드 | AudioContext SFX 10종 + BGM 2곡, 외부 파일 없음 | 완료 |

### 수익화/배포

| 기능 | 설명 | 상태 |
|---|---|---|
| AdMob 보상형 광고 | 동적 import, 이벤트 기반 보상, 일일 제한, Mock 모드 | 완료 |
| Google Play IAP | @capgo/native-purchases, 자동 사냥 영구 해금, 구매 복원 | 완료 |
| Capacitor 빌드 | APK/AAB 생성, CI/CD 파이프라인 | 완료 |

## 알려진 제약사항

1. **폰트 파일 누락**: `assets/fonts/Galmuri11.woff2` 미존재, monospace 폴백 사용 중
2. **Player._passives 미초기화**: LevelUpScene에서 lazy init으로 안전 처리됨
3. **UI/배경 플레이스홀더**: 캐릭터/적 스프라이트는 교체 완료, UI/조이스틍은 플레이스홀더 잔존
4. **체인 무기 탐색 범위 하드코딩**: findClosestEnemy 300px 하드코딩, 상수화 권장
5. **부활 HP 직접 대입**: 스펙은 `heal()` 호출이나 실제는 직접 대입, 동작 문제 없음
6. **CollectionScene ENEMY_IDS 하드코딩**: 적 ID 15개 하드코딩, 신규 적 추가 시 수동 갱신
7. **Player.damageMultiplier 미초기화**: undefined 안전 처리됨, 생성자 초기화 권장
8. **오브 시각적 크기 고정**: 플라즈마 오브 시각 8px vs 판정 orbRadius(55~90px) 불일치

## 향후 계획

- 스토리 컷신 확장
- 신규 스테이지/보스 추가
- 폰트 파일 적용 (Galmuri11)
- 플레이스홀더 에셋 교체 (UI/조이스틱)
