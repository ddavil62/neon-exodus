# NEON EXODUS (네온 엑소더스) 기획서

> 최종 업데이트: 2026-03-11 (AutoPilot 아이템 수집 가중치 강화)

## 프로젝트 개요

NEON EXODUS는 SF/사이버펑크 세계관의 뱀서라이크(Vampire Survivors류) 자동 공격 서바이벌 게임이다. 기계 군단의 침공에 맞서 홀로 생존하며, 적을 처치하고 레벨업하여 15분간 생존 후 최종 보스를 격파하는 것이 목표다.

- **게임명**: NEON EXODUS
- **장르**: 뱀서라이크 자동 공격 서바이벌
- **세계관**: SF / 사이버펑크 (기계 군단 vs 전투원)
- **플랫폼**: Android (Capacitor APK/AAB)
- **해상도**: 360x640 (세로 모드)

### 핵심 게임 루프

```
이동(조이스틱) → 자동 공격 → 적 처치 → XP 보석 획득 → 레벨업(3택 1) → 반복
                                                              ↓
                                                        15분 후 최종 보스
                                                              ↓
                                                    엔들리스 모드 (무한 서바이벌)
                                                              ↓
                                                    결과 화면 → 크레딧 획득
                                                              ↓
                                                    메타 업그레이드 → 다시 런
```

## 기술 스택

| 항목 | 내용 |
|---|---|
| 언어 | JavaScript (ES Modules) |
| 게임 엔진 | Phaser 3.87.0 (CDN) |
| 물리 | Phaser Arcade Physics |
| 모바일 패키징 | Capacitor 8 |
| 폰트 | Galmuri11 (woff2) |
| 테스트 | Playwright |
| 데이터 저장 | localStorage |
| 빌드 | `node scripts/build.js` (www/ 디렉토리 생성) |

## 아키텍처

### 디렉토리 구조

```
neon-exodus/
├── index.html                     # Phaser 3.87.0 CDN, 풀스크린 CSS
├── package.json                   # 의존성 (Capacitor, Playwright)
├── capacitor.config.json          # Android 패키징 설정
├── js/
│   ├── config.js                  # 게임 상수, 밸런스 수치, SPRITE_SCALE
│   ├── i18n.js                    # 한국어/영어 번역
│   ├── main.js                    # Phaser 게임 인스턴스 생성
│   ├── scenes/
│   │   ├── BootScene.js           # 에셋 로드(벡터 PNG 20종 image + 6종 캐릭터 idle/walk 12개 spritesheet + Phase 2 아트 에셋 24종 + Phase 4 이펙트 10종), 플레이스홀더 폴백, 6종x5방향=30개 걷기 anim 등록, SoundSystem 초기화
│   │   ├── MenuScene.js           # 메인 메뉴 (출격, 업그레이드, 도전과제, 도감, BGM, 자동 사냥 구매)
│   │   ├── StageSelectScene.js    # 스테이지 선택 화면 (4개 스테이지 카드, 잠금/해금/클리어 상태)
│   │   ├── CharacterScene.js      # 캐릭터 선택 화면 (해금/잠금, 고유 패시브)
│   │   ├── GameScene.js           # 핵심 게임플레이 (전투, HUD, 일시정지, 부활, 진화, 엔들리스 모드, SFX/VFX, AutoPilot, 보스/미니보스 등장 카메라 연출, 무기 드롭)
│   │   ├── LevelUpScene.js        # 레벨업 3택 오버레이 (리롤, 새 무기 획득, weaponChoiceBias, 전체 완료 시 스킵)
│   │   ├── ResultScene.js         # 결과/보상 화면 (크레딧/통계 저장, 엔들리스 모드 결과)
│   │   ├── UpgradeScene.js        # 영구 업그레이드 구매 UI (4탭 카드 그리드, 카테고리 아이콘)
│   │   ├── AchievementScene.js    # 도전과제 목록 화면 (13개, 진행률)
│   │   └── CollectionScene.js     # 도감 화면 (4탭: 무기/패시브/적/도전과제)
│   ├── entities/
│   │   ├── Player.js              # 플레이어 (이동, 캐릭터별 고유 스프라이트, 8방향 걷기 애니메이션, HP/XP, 레벨업, 메타 업그레이드)
│   │   ├── Enemy.js               # 적 기본 클래스 (초기화, 이동, 데미지, 사망)
│   │   ├── EnemyTypes.js          # 적 유형별 AI 15종
│   │   ├── Projectile.js          # 투사체 (발사, 피격, 관통)
│   │   ├── Consumable.js          # 소모성 아이템 (6종, ObjectPool, 10초 수명, 직접 밟아 수집)
│   │   ├── WeaponDropItem.js      # 스테이지 무기 드롭 아이템 (ObjectPool, 영구/비영구 소멸, 깜빡임)
│   │   └── XPGem.js               # XP 보석 (소/중/대, 자석 흡수, 소멸)
│   ├── systems/
│   │   ├── ObjectPool.js          # Phaser Group 기반 오브젝트 풀
│   │   ├── VirtualJoystick.js     # 가상 조이스틱 (데드존 8px, 최대반경 50px)
│   │   ├── WeaponSystem.js        # 무기 관리, 자동 발사 (11종 타입: projectile/beam/orbital/chain/homing/summon/aoe/melee/cloud/gravity/rotating_blade)
│   │   ├── WaveSystem.js          # 적 스폰 웨이브 관리, 엔들리스 모드 스케일링
│   │   ├── SoundSystem.js         # AudioContext 프로그래매틱 SFX 9종 + BGM 2곡
│   │   ├── VFXSystem.js           # Phaser Particles 기반 VFX 6종
│   │   ├── VirtualJoystick.js     # 가상 조이스틱 (Image 텍스처 방식, Graphics 폴백)
│   │   └── AutoPilotSystem.js     # 자동 사냥 AI 이동 시스템 (긴급 무기 수집 > 위험 회피 > 무기 드롭 > 소모품 > XP 보석 > 적 접근 > 방랑)
│   ├── managers/
│   │   ├── SaveManager.js         # 로컬스토리지 세이브/로드
│   │   ├── MetaManager.js         # 영구 업그레이드 관리
│   │   ├── AchievementManager.js  # 도전과제 추적/보상
│   │   └── IAPManager.js          # Google Play IAP 관리 (구매/복원, Mock 모드)
│   └── data/
│       ├── weapons.js             # 무기 11종 (기본 7종 + 스테이지 해금 4종 각 Lv1~8) + 진화 무기 3종
│       ├── enemies.js             # 잡몹 10종 + 미니보스 2종 + 보스 6종
│       ├── stages.js              # 스테이지 4종 정의 (STAGES, STAGE_ORDER, WEAPON_DROP_SCHEDULE)
│       ├── passives.js            # 패시브 아이템 10종
│       ├── waves.js               # 스폰 테이블 6구간 + 미니보스/보스 스케줄
│       ├── upgrades.js            # 영구 업그레이드 22종
│       ├── consumables.js          # 소모성 아이템 6종 (드롭률, 텍스처, 색상)
│       ├── characters.js          # 캐릭터 6종 (spriteKey 필드로 텍스처 매핑)
│       └── achievements.js        # 도전과제 13종
├── assets/
│   ├── backgrounds/               # 배경 에셋 (Phase 2/3 아트)
│   │   ├── bg_tile.png            # 128x128 사이버 메탈 바닥 seamless 타일 (S1 기본, GPT Image API)
│   │   ├── bg_tile_s2.png         # 128x128 산업 지구 바닥 seamless 타일 (S2, GPT Image API, Phase 3)
│   │   ├── bg_tile_s3.png         # 128x128 서버 팜 바닥 seamless 타일 (S3, GPT Image API, Phase 3)
│   │   ├── bg_tile_s4.png         # 128x128 에너지 코어 바닥 타일 (S4, GPT Image API, Phase 3)
│   │   └── menu_bg.png            # 360x640 사이버 도시 실루엣 배경 (GPT Image API)
│   ├── ui/
│   │   ├── joystick/              # 조이스틱 UI 이미지 (SVG 직접 생성)
│   │   │   ├── base.png           # 128x128 홀로그램 동심원 베이스
│   │   │   └── thumb.png          # 64x64 시안 글로우 엄지
│   │   └── icons/                 # 무기/패시브/업그레이드 아이콘 (SVG 직접 생성, 32x32)
│   │       ├── weapon_*.png       # 무기 아이콘 11종 (기존 7종 + Phase 3 스테이지 해금 4종)
│   │       ├── passive_*.png      # 패시브 아이콘 10종
│   │       └── upgrade_*.png      # 업그레이드 아이콘 4종
│   └── sprites/                   # 벡터 PNG 에셋 (GPT Image API 17종 + SVG 직접 생성 3종) + 캐릭터 6종 idle/walk 스프라이트
│       ├── player.png             # agent idle 정적 이미지 (48x48)
│       ├── player_walk.png        # agent 걷기 스프라이트시트 (240x192, 5방향x4프레임, 48x48/프레임)
│       ├── sniper.png             # sniper idle (48x48, 네온 그린 #39FF14)
│       ├── sniper_walk.png        # sniper 걷기 스프라이트시트 (240x192)
│       ├── engineer.png           # engineer idle (48x48, 옐로우 #FFD700)
│       ├── engineer_walk.png      # engineer 걷기 스프라이트시트 (240x192)
│       ├── berserker.png          # berserker idle (48x48, 레드 #FF3333)
│       ├── berserker_walk.png     # berserker 걷기 스프라이트시트 (240x192)
│       ├── medic.png              # medic idle (48x48, 화이트+그린 #00FF88)
│       ├── medic_walk.png         # medic 걷기 스프라이트시트 (240x192)
│       ├── hidden.png             # hidden idle (48x48, 퍼플 #AA00FF)
│       ├── hidden_walk.png        # hidden 걷기 스프라이트시트 (240x192)
│       ├── walk_frames/           # 걷기 개별 프레임 PNG (캐릭터별 서브폴더, 디버깅용)
│       ├── projectile.png         # 투사체 정적 이미지 (12x12)
│       ├── enemies/               # 잡몹 10종 정적 이미지
│       │   ├── nano_drone.png     # 32x32
│       │   ├── scout_bot.png      # 32x32
│       │   ├── spark_drone.png    # 32x32
│       │   ├── battle_robot.png   # 48x48
│       │   ├── shield_drone.png   # 32x32
│       │   ├── rush_bot.png       # 40x40
│       │   ├── repair_bot.png     # 32x32
│       │   ├── heavy_bot.png      # 48x48
│       │   ├── teleport_drone.png # 32x32
│       │   └── suicide_bot.png    # 40x40
│       ├── bosses/                # 미니보스 2종 + 보스 6종 정적 이미지
│       │   ├── guardian_drone.png # 80x80  (미니보스)
│       │   ├── assault_mech.png   # 80x80  (미니보스)
│       │   ├── commander_drone.png# 128x128 (보스, S1)
│       │   ├── siege_titan.png    # 128x128 (보스, S1)
│       │   ├── core_processor.png # 128x128 (보스, S1)
│       │   ├── siege_titan_mk2.png# 128x128 (보스, S2, Phase 3)
│       │   ├── data_phantom.png   # 128x128 (보스, S3, Phase 3)
│       │   └── omega_core.png     # 128x128 (보스, S4, Phase 3)
│       ├── effects/               # 무기 이펙트 SVG 스프라이트 10종 (Phase 4 아트)
│       │   ├── projectile.png    # 16x16 (시안 에너지 탄환, 블래스터)
│       │   ├── plasma_orb.png    # 24x24 (마젠타 오브, 플라즈마 오브)
│       │   ├── missile.png       # 20x20 (오렌지 로켓, 미사일)
│       │   ├── explosion.png     # 64x64 (폭발 링, 미사일 폭발)
│       │   ├── drone.png         # 24x24 (시안 미니 드론, 드론)
│       │   ├── emp_ring.png      # 64x64 (블루 EMP 링, EMP 폭발)
│       │   ├── force_slash.png   # 48x48 (시안 호 슬래시, 포스 블레이드)
│       │   ├── nano_cloud.png    # 48x48 (그린 나노 구름, 나노스웜)
│       │   ├── vortex.png        # 48x48 (마젠타-시안 소용돌이, 볼텍스 캐넌)
│       │   └── reaper_blade.png  # 32x32 (레드 초승달 낫, 리퍼 필드)
│       └── items/                 # XP 보석 3종 + 소모성 아이템 6종 정적 이미지
│           ├── xp_gem_s.png       # 12x12
│           ├── xp_gem_m.png       # 20x20
│           ├── xp_gem_l.png       # 28x28
│           ├── nano_repair.png               # 48x48 (녹색 십자, Phase 2 업스케일)
│           ├── magnetic_pulse.png           # 48x48 (시안 자석, Phase 2 업스케일)
│           ├── emp_bomb.png                 # 48x48 (블루 원형, Phase 2 업스케일)
│           ├── credit_chip.png              # 48x48 (골드 칩, Phase 2 업스케일)
│           ├── overclock.png                # 48x48 (오렌지 번개, Phase 2 업스케일)
│           └── shield_battery.png           # 48x48 (퍼플 방패, Phase 2 업스케일)
├── scripts/
│   ├── build.js                   # www/ 디렉토리 빌드 스크립트
│   ├── generate-sprites.js        # (레거시) Phase 1 DALL-E 3 스프라이트 생성 스크립트
│   ├── generate-sprites-phase2.js # (레거시) Phase 2 보스/미니보스 스프라이트 생성 스크립트
│   ├── generate-vector-sprites.js # 하이브리드 20종 벡터 PNG 생성 스크립트 (GPT Image API 17종 + SVG 직접 생성 3종, 현행)
│   ├── generate-walk-anim.js      # 캐릭터별 idle + 걷기 애니메이션 스프라이트시트 생성 스크립트 (GPT Image API, --char 옵션, 현행)
│   ├── generate-consumable-sprites.js # (레거시) 소모성 아이템 6종 24x24 아이콘 생성 스크립트 (GPT Image API)
│   ├── generate-phase2-assets.js  # Phase 2 아트 에셋 31종 생성 스크립트 (GPT Image API 8종 + SVG 직접 생성 23종, 현행)
│   └── generate-phase4-assets.js  # Phase 4 무기 이펙트 에셋 10종 생성 스크립트 (SVG 직접 생성, 현행)
├── tests/
│   ├── phase1-integration.spec.js # Phase 1 통합 테스트
│   ├── phase2-qa.spec.js          # Phase 2 QA 테스트
│   ├── phase3.spec.js             # Phase 3 QA 테스트 (12개)
│   ├── phase3-crit.spec.js        # Phase 3 치명타 시스템 전용 테스트 (7개)
│   ├── phase4.spec.js             # Phase 4 QA 테스트 (27개)
│   ├── auto-hunt.spec.js          # 자동 사냥 QA 테스트 (29개)
│   ├── phase1-art-qa.spec.js     # Phase 1 아트 QA 테스트 (22개)
│   ├── weapon-report.spec.js     # 무기별 결과 리포트 테스트 (28개)
│   ├── weapon-report-layout.spec.js # 무기 리포트 레이아웃 테스트 (11개)
│   ├── sprite-scale.spec.js       # 스프라이트 2x 스케일 테스트 (21개)
│   ├── walk-anim.spec.js          # 걷기 애니메이션 테스트 (24개)
│   ├── consumables.spec.js        # 소모성 아이템 테스트 (34개)
│   ├── char-sprites.spec.js       # 캐릭터별 고유 스프라이트 테스트 (46개)
│   ├── art-phase2.spec.js         # 아트 Phase 2 UI/배경/아이콘 테스트 (36개)
│   ├── art-phase4-weapons.spec.js # 아트 Phase 4 무기 이펙트 테스트 (18개)
│   └── auto-move-item-weight.spec.js # AutoPilot 아이템 수집 가중치 테스트 (29개)
└── docs/
    ├── PROJECT.md                 # 이 문서
    ├── CHANGELOG.md               # 변경 이력
    └── ART_CONCEPT.md             # 아트 컨셉/에셋 목록/Phase 계획
```

### 씬 흐름

```
BootScene → MenuScene ─→ StageSelectScene ─→ CharacterScene ─→ GameScene ↔ LevelUpScene
               │                                                    ↓
               ├── UpgradeScene                               ← ResultScene
               ├── AchievementScene
               └── CollectionScene
```

- StageSelectScene에서 선택한 stageId를 CharacterScene에 전달
- CharacterScene에서 { characterId, stageId }를 GameScene에 전달
- ESC 키: StageSelectScene -> MenuScene 뒤로가기

### 핵심 모듈

| 모듈 | 파일 | 역할 |
|---|---|---|
| 게임 설정 | `js/config.js` | 해상도, 월드, 밸런스 상수, SPRITE_SCALE=1 일괄 관리 |
| 다국어 | `js/i18n.js` | ko/en 375키, `t()` 함수로 참조 |
| 스테이지 선택 | `js/scenes/StageSelectScene.js` | 4개 스테이지 카드, 잠금/해금/클리어 상태 분기, stageId 전달 |
| 스테이지 데이터 | `js/data/stages.js` | 4개 스테이지 정의, 무기 드롭 스케줄, 난이도 배수 |
| 게임 씬 | `js/scenes/GameScene.js` | 월드/카메라/물리, 시스템 연동, HUD, 인벤토리 HUD, 일시정지, 소모성 아이템 풀/수집/효과, 무기 드롭 스케줄 |
| 플레이어 | `js/entities/Player.js` | 조이스틱 이동, 캐릭터별 고유 스프라이트, 8방향 걷기 애니메이션, HP/XP/레벨업, 메타 업그레이드 반영, 오버클럭/쉴드 버프 관리 |
| 적 시스템 | `js/entities/Enemy.js` + `EnemyTypes.js` | 15종 적 행동 패턴, 소모성 아이템 드롭 |
| 무기 | `js/systems/WeaponSystem.js` | 자동 발사(투사체/빔/오비탈/체인/호밍/소환/범위/근접/구름/중력/회전낫), 치명타 판정, 무기 진화, 드론 AI |
| 스폰 | `js/systems/WaveSystem.js` | 시간대별 스폰, 미니보스/보스 스케줄, 엔들리스 모드 스케일링 |
| 사운드 | `js/systems/SoundSystem.js` | AudioContext 프로그래매틱 SFX 9종 + BGM 2곡 |
| VFX | `js/systems/VFXSystem.js` | Phaser Particles 기반 시각 효과 8종 (기존 6종 + consumableCollect + empBlast) |
| 세이브 | `js/managers/SaveManager.js` | 로컬스토리지 영구 저장, 크레딧/통계/도감/스테이지 클리어/무기 해금 관리 |
| 업그레이드 | `js/scenes/UpgradeScene.js` | 4탭 카드 그리드 영구 업그레이드 구매/다운그레이드 UI, 카테고리 아이콘 표시 |
| 캐릭터 선택 | `js/scenes/CharacterScene.js` | 캐릭터 선택, 해금 조건 검사 |
| 도전과제 | `js/scenes/AchievementScene.js` | 13개 도전과제 목록, 진행률 표시 |
| 도감 | `js/scenes/CollectionScene.js` | 4탭 도감 (무기/패시브/적/도전과제) |
| 자동 사냥 AI | `js/systems/AutoPilotSystem.js` | AI 자동 이동 (긴급 무기 수집 > 위험 회피 > 무기 드롭 > 소모품 > XP 보석 > 적 접근 > 방랑) |
| IAP 관리 | `js/managers/IAPManager.js` | Google Play IAP 구매/복원, Mock 모드 |

## 기능 명세

### 아트 스타일 및 스프라이트 스케일

**아트 스타일**: GPT Image API(gpt-image-1) 벡터 아트 + 네온 글로우(Glow) + 사이버펑크. 하이브리드 생성 방식: 대형 에셋(32px 이상)은 OpenAI GPT Image API로 1024x1024 고품질 이미지 생성 후 sharp로 목표 크기 리사이즈. 소형 에셋(12~32px)은 GPT Image API 다운스케일 시 디테일 소실 문제로 SVG 코드 직접 생성 후 sharp로 PNG 변환. 투명 배경 지원(API `background: 'transparent'` + 폴백 투명화). 에셋을 최종 표시 크기로 직접 생성하므로 스케일 배율 불필요 (`SPRITE_SCALE = 1`).

**Phaser 렌더 설정**: `pixelArt: false`, `antialias: true` -- 벡터 에셋의 매끄러운 외곽선 렌더링.

**에셋 로드 방식**: 정적 엔티티는 `this.load.image()` 이미지 로드. 캐릭터 6종의 idle은 `this.load.image(charId, ...)`, walk는 `this.load.spritesheet(charId + '_walk', ...)` 스프라이트시트 로드. 정지 시에는 Phaser tween 아이들 맥동 애니메이션, 이동 시에는 해당 캐릭터의 spritesheet 프레임 기반 걷기 애니메이션 재생.

| 엔티티 | 에셋 크기 | 충돌체 | 아이들 tween |
|---|---|---|---|
| Player | 48x48 | circle(12, offset=12) | 800ms, scaleXY +-5% |
| Enemy (잡몹 소형 32px) | 32x32 | circle(10, offset=6) | 900ms |
| Enemy (잡몹 중형 40px) | 40x40 | circle(12, offset=8) | 900ms |
| Enemy (잡몹 대형 48px) | 48x48 | circle(14, offset=10) | 900ms |
| Enemy (미니보스) | 80x80 | circle(18, offset=22) | 700ms |
| Enemy (보스) | 128x128 | circle(26, offset=38) | 600ms |
| Projectile | 12x12 | circle(4, offset=2) | - |
| XP Gem (small) | 12x12 | circle(3, offset=3) | - |
| XP Gem (medium) | 20x20 | circle(5, offset=5) | - |
| XP Gem (large) | 28x28 | circle(7, offset=7) | - |
| Consumable | 48x48 | circle(16, offset=8) | - |

- 충돌체 오프셋 공식: `bodyOffset = frameW / 2 - bodyRadius` (SPRITE_SCALE=1이므로 scale 나눗셈 없음)
- tween 공통: `yoyo: true, repeat: -1, ease: 'Sine.easeInOut'`
- 오브젝트 풀 재사용: Enemy.init()에서 `killTweensOf(this)` 선행 호출 후 새 tween 부여. `_deactivate()`에서도 `killTweensOf(this)` 호출
- 에셋 미존재 시 Graphics 플레이스홀더 폴백 유지 (`textures.exists()` 가드)
- 에셋 생성 (정적): `node scripts/generate-vector-sprites.js` (GPT Image API 17종 + SVG 직접 생성 3종 = 20종 PNG 생성, API 키 필요)
- 에셋 생성 (캐릭터 스프라이트): `node scripts/generate-walk-anim.js` (5종 캐릭터 idle + walk 일괄 생성), `node scripts/generate-walk-anim.js --char sniper` (특정 캐릭터만), API 키 필요
- 에셋 생성 (UI/배경/아이콘): `node scripts/generate-phase2-assets.js` (GPT Image API 8종 + SVG 직접 생성 23종 = 31종 PNG 생성, API 키 필요)
- 아트 컨셉: `docs/ART_CONCEPT.md`
- 관련 파일: `js/config.js`, `js/main.js`, `js/scenes/BootScene.js`, `js/entities/Player.js`, `js/entities/Enemy.js`, `js/entities/Projectile.js`, `js/entities/XPGem.js`, `js/data/characters.js`, `scripts/generate-vector-sprites.js`, `scripts/generate-walk-anim.js`
- 구현 일자: 2026-03-10 (GPT Image API 벡터 전환 + XP 보석 SVG 직접 생성), 이전: 2026-03-10 (SVG 코드 벡터), 이전: 2026-03-09 (픽셀아트 SPRITE_SCALE=2)
- 스펙 문서: `.claude/specs/2026-03-10-neon-exodus-art-phase1.md`, `.claude/specs/2026-03-10-neon-exodus-gpt-image-art.md`
- XP 보석 수정 QA: `.claude/specs/2026-03-10-neon-exodus-gpt-image-art-qa-xpfix.md`

### 소모성 아이템 시스템

적 처치 시 확률적으로 드롭되는 소모성 아이템 6종. 플레이어가 직접 밟아 수집하면 즉시 효과가 발동된다. 자석 흡수 없음.

#### 아이템 6종

| ID | 이름(ko) | 효과 | 색상 | 텍스처 크기 |
|---|---|---|---|---|
| nano_repair | 나노 수리킷 | HP +30 즉시 회복 | 녹색(0x39FF14) | 48x48 |
| mag_pulse | 자기 펄스 | 맵 전체 XP 보석 즉시 흡수 | 시안(0x00FFFF) | 48x48 |
| emp_bomb | EMP 폭탄 | 화면 내 일반 적 즉사, 미니보스/보스 HP 20% 대미지 | 블루(0x4488FF) | 48x48 |
| credit_chip | 크레딧 칩 | 크레딧 5~15 즉시 획득 | 골드(0xFFDD00) | 48x48 |
| overclock | 오버클럭 모듈 | 5초간 이속 x1.5, 쿨다운 x0.7 | 오렌지(0xFF6600) | 48x48 |
| shield_battery | 쉴드 배터리 | 30초간 완전 무적 + 접촉 적에게 반사 대미지 5 | 퍼플(0xAA44FF) | 48x48 |

#### 드롭률

| ID | 잡몹 | 잡몹(HP<=50%) | 미니보스 | 보스 |
|---|---|---|---|---|
| nano_repair | 3% | 8% | 50% | 100% |
| mag_pulse | 0.5% | 0.5% | 100% | 100% |
| emp_bomb | 0.3% | 0.3% | 10% | 50% |
| credit_chip | 1% | 1% | 30% | 100% |
| overclock | 1.5% | 1.5% | 20% | 30% |
| shield_battery | 0.8% | 0.8% | 15% | 30% |

- 드롭 판정: CONSUMABLES 배열 순서대로 판정 (nano_repair 우선), 하나 성공 시 나머지 스킵
- 저체력 판정: 플레이어 HP 비율 <= 50% 시 nano_repair만 normalLowHp 확률 적용

#### Consumable 엔티티 생명주기

```
spawn() -> update() 루프 -> 깜빡임(@7초) -> 소멸(@10초) -> _deactivate()
                                    ↑
                          플레이어 overlap -> collect() -> _deactivate()
```

- 수명: 10초 (`CONSUMABLE_LIFETIME`)
- 깜빡임: 마지막 3초 (alpha 1->0.3, 150ms yoyo tween)
- 충돌체: circle(16, offset=8), depth=5
- ObjectPool 초기 크기: 20개, 자동 확장 지원
- 스폰 시 랜덤 분산: +-10px

#### 버프 시스템 (Player.js)

**오버클럭 모듈**:
- applyOverclock(): 비활성 시 현재 speedMultiplier/cooldownMultiplier 저장 후 x1.5/x0.7 적용, 타이머 5000ms 설정
- 활성 중 재수집: 스탯 이중 적용 없음, 타이머만 5000ms 리셋
- 만료 시: 저장된 원래 값으로 speedMultiplier/cooldownMultiplier 복원

**쉴드 배터리**:
- applyShield(): shieldActive=true, invincible=true, 타이머 30000ms, 보라색 틴트(0xAA44FF)
- 활성 중 재수집: 타이머만 30000ms 리셋
- 활성 중: 매 프레임 invincible=true 강제 (피격 무적 타이머와 독립)
- 만료 시: shieldActive=false, invincible=false, invincibleTimer=0, clearTint()
- reflectShieldDamage(enemy): shieldActive 시 접촉 적에게 SHIELD_REFLECT_DAMAGE(5) 대미지

**동시 활성**: 오버클럭과 쉴드는 독립적으로 관리. 오버클럭만 만료 시 속도 복원, 쉴드/무적은 유지.

#### EMP 폭탄 효과 (GameScene._applyEMPEffect)
- 카메라 뷰포트 + EMP_SCREEN_MARGIN(50px) 범위 내 적 판정
- 일반 적(isBoss/isMiniBoss 아님): 즉사 (enemy.takeDamage(enemy.maxHp))
- 미니보스/보스: maxHp * EMP_BOSS_DAMAGE_RATIO(0.2) 대미지

#### 수집 VFX
- consumableCollect(scene, x, y, color): 아이템별 tintColor 파티클 버스트
- empBlast(): 화면 클리어 파티클 + 카메라 플래시

#### 에셋 생성
- 실행: `node scripts/generate-phase2-assets.js` (루트 .env에 OPENAI_API_KEY 필요)
- GPT Image API(gpt-image-1)로 6종 1024x1024 생성 후 48x48 리사이즈 (Phase 2 아트에서 24x24 -> 48x48 업스케일)
- (레거시) `scripts/generate-consumable-sprites.js`는 24x24 생성 스크립트로 Phase 2에서 대체됨

- 관련 파일: `js/data/consumables.js`, `js/entities/Consumable.js`, `js/config.js`, `js/scenes/GameScene.js`, `js/entities/Enemy.js`, `js/entities/Player.js`, `js/systems/VFXSystem.js`, `js/scenes/BootScene.js`, `js/i18n.js`, `scripts/generate-phase2-assets.js`
- 구현 일자: 2026-03-10
- 스펙 문서: `.claude/specs/2026-03-10-neon-exodus-consumables.md`

### 캐릭터별 고유 스프라이트 + 8방향 걷기 애니메이션

캐릭터 6종 각각에 고유한 idle 스프라이트(48x48)와 걷기 애니메이션 스프라이트시트(240x192)를 적용한다. GPT Image API로 5종 캐릭터(agent 제외)의 스프라이트를 생성하고, 선택한 캐릭터에 맞는 스프라이트가 표시된다.

#### 캐릭터별 비주얼 컨셉
| 캐릭터 | spriteKey | 주색 | 외형 컨셉 |
|---|---|---|---|
| agent | `player` | 시안 (#00FFFF) | 헬멧+글로우 바이저, 사이버펑크 갑옷 (기존 에셋) |
| sniper | `sniper` | 네온 그린 (#39FF14) | 날렵한 체형, 스코프 헬멧, 롱코트 |
| engineer | `engineer` | 옐로우 (#FFD700) | 통통한 실루엣, 백팩+안테나, 기술자 고글 |
| berserker | `berserker` | 레드 (#FF3333) | 거대 체형, 두꺼운 갑옷, 뿔 달린 헬멧 |
| medic | `medic` | 화이트+그린 (#00FF88) | 십자 마크, 의료 백팩, 경량 갑옷 |
| hidden | `hidden` | 퍼플 (#AA00FF) | 망토/후드, 퍼플 글로우 실루엣, 미스터리 |

#### 텍스처 키 규칙 (characters.js spriteKey 기반)
- idle 텍스처 키: `spriteKey` (agent='player', 나머지=charId)
- walk 텍스처 키: `spriteKey + '_walk'` (agent='player_walk', 나머지=`charId_walk`)
- walk 애니메이션 키 접두사: agent='walk', 나머지=`charId_walk`
- Player 생성자에서 characterId를 받아 `_idleTextureKey`, `_walkTextureKey`, `_walkAnimPrefix` 동적 결정

#### 스프라이트시트 규격 (전 캐릭터 공통)
- 크기: 240x192 (5열 x 4행, 프레임 48x48)
- 레이아웃: col0=down, col1=down-right, col2=right, col3=up-right, col4=up
- 프레임 번호: row * 5 + col (Phaser 좌->우, 위->아래 순번)
- 걷기 사이클: neutral(0) -> left-step(1) -> neutral(2) -> right-step(3)

#### 방향 프레임 매핑 (agent 예시, 다른 캐릭터는 prefix가 `{charId}_walk`)
| 방향 | animKey (agent) | animKey (sniper) | 프레임 번호 | flipX |
|---|---|---|---|---|
| down (S) | walk_down | sniper_walk_down | 0, 5, 10, 15 | false |
| down-right (SE) | walk_down_right | sniper_walk_down_right | 1, 6, 11, 16 | false |
| right (E) | walk_right | sniper_walk_right | 2, 7, 12, 17 | false |
| up-right (NE) | walk_up_right | sniper_walk_up_right | 3, 8, 13, 18 | false |
| up (N) | walk_up | sniper_walk_up | 4, 9, 14, 19 | false |
| down-left (SW) | walk_down_right | sniper_walk_down_right | 1, 6, 11, 16 | true |
| left (W) | walk_right | sniper_walk_right | 2, 7, 12, 17 | true |
| up-left (NW) | walk_up_right | sniper_walk_up_right | 3, 8, 13, 18 | true |

#### 8방향 각도 분류 (atan2 기반)
- 수식: `deg = (Math.atan2(dirY, dirX) * 180 / Math.PI + 360) % 360`
- 분류: 22.5도 오프셋 적용, 각 방향 45도 범위
- right: 337.5~22.5, SE: 22.5~67.5, down: 67.5~112.5, SW: 112.5~157.5, left: 157.5~202.5, NW: 202.5~247.5, up: 247.5~292.5, NE: 292.5~337.5

#### 상태 전이
- **정지 -> 이동**: idle tween pause, setScale(SPRITE_SCALE) 정상화, _isMoving=true, 방향별 walk anim play
- **이동 -> 정지**: anims.stop(), setTexture(this._idleTextureKey), setFlipX(false), setScale(SPRITE_SCALE), idle tween resume, _isMoving=false
- **방향 전환 (이동 중)**: 동일 animKey면 play() 미호출(끊김 방지), 다른 animKey면 새 anim play + flipX 갱신
- **AutoPilot 모드**: Player._handleMovement()의 dirX/dirY를 공유하므로 동일 로직 적용

#### 애니메이션 파라미터
| 파라미터 | 값 |
|---|---|
| frameRate | 8 fps |
| repeat | -1 (무한 루프) |
| 프레임 크기 | 48x48 |
| 등록 방식 | BootScene._registerWalkAnims() |
| 총 애니메이션 수 | 6종 x 5방향 = 30개 |

#### 에셋 로드 (BootScene.preload)
- agent: `this.load.image('player', ...)` + `this.load.spritesheet('player_walk', ...)`
- 나머지 5종: 루프로 `this.load.image(charId, ...)` + `this.load.spritesheet(charId + '_walk', ...)`
- 총 12개 에셋 로드 (6종 x idle + walk)

#### 에셋 생성 스크립트 (generate-walk-anim.js)
- CHARACTER_DEFS 맵으로 5종 캐릭터(sniper/engineer/berserker/medic/hidden)의 idlePrompt, walkStylePrompt, color 정의
- `--char` 옵션: 특정 캐릭터만 단독 생성 (`node scripts/generate-walk-anim.js --char sniper`)
- 미지정 시: 5종 전체 순차 생성 (`node scripts/generate-walk-anim.js`)
- agent는 CHARACTER_DEFS에 미포함 (기존 player.png/player_walk.png 재사용)
- 캐릭터당: idle 1개 + walk 프레임 20개 = 21개 GPT Image API 호출
- idle: 1024x1024 생성 -> 48x48 리사이즈 -> `assets/sprites/{charId}.png`
- walk: 5방향 x 4프레임 = 20개 생성 -> 240x192 합성 -> `assets/sprites/{charId}_walk.png`
- 임시 프레임: `walk_frames/{charId}/` 서브폴더에 보존
- API rate limit: 호출 간 1초 대기, 캐릭터 간 2초 추가 대기
- 실행: `node scripts/generate-walk-anim.js` (루트 .env에 OPENAI_API_KEY 필요)

#### 플레이스홀더 폴백
- BootScene._generatePlaceholderTextures()에서 6종 캐릭터별 idle(48x48) + walk(240x192) 플레이스홀더 생성
- 캐릭터별 고유 색상 적용 (sniper=0x39FF14, engineer=0xFFD700, berserker=0xFF3333, medic=0x00FF88, hidden=0xAA00FF)
- _registerWalkAnims()에서 텍스처 미존재 캐릭터는 애니메이션 등록 스킵
- _playWalkAnim()에서 `this._walkTextureKey` 텍스처 존재 확인 후 play() 호출

- 관련 파일: `js/data/characters.js`, `js/entities/Player.js`, `js/scenes/BootScene.js`, `js/scenes/GameScene.js`, `scripts/generate-walk-anim.js`
- 구현 일자: 2026-03-10 (걷기 애니메이션 기반: 2026-03-10, 캐릭터별 고유 스프라이트 확장: 2026-03-10)
- 스펙 문서: `.claude/specs/2026-03-10-neon-exodus-walk-anim.md`, `.claude/specs/2026-03-10-neon-exodus-char-sprites.md`

### 조작 시스템

#### 가상 조이스틱
- 화면 아무 곳 터치 시 조이스틱 원점 생성
- 드래그 방향/거리로 이동 방향/속도 결정
- 데드존: 8px 이내 이동 무시
- 최대 반경: 50px (`JOYSTICK_MAX_RADIUS`)
- 터치 종료 시 조이스틱 사라짐, 캐릭터 정지
- 시각 표현: PNG 텍스처 존재 시 Image 오브젝트, 미존재 시 Graphics 폴백
  - base: `joystick_base` 텍스처(128x128 홀로그램 동심원), displaySize 100x100, alpha 0.7
  - thumb: `joystick_thumb` 텍스처(64x64 시안 글로우), displaySize 40x40, alpha 0.85
  - `textures.exists()` 가드로 Image/Graphics 분기, setPosition/setVisible/destroy 호환
- 관련 파일: `js/systems/VirtualJoystick.js`
- 구현 일자: 2026-03-08 (Image 텍스처 전환: 2026-03-10)

#### 자동 공격
- 사거리 내 가장 가까운 적 방향으로 자동 발사
- 적이 없으면 발사하지 않음
- 관련 파일: `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-08

### 무기 시스템

#### 블래스터 (MVP 무기, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 데미지 | 10 | 45 (+5/Lv) |
| 쿨다운 | 500ms | 250ms |
| 투사체 속도 | 400px/s | 500px/s |
| 관통 | 1 | 2 |
| 사거리 | 320px | 320px |

- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`, `js/entities/Projectile.js`
- 구현 일자: 2026-03-08
- 스펙 문서: `.claude/specs/2026-03-08-neon-exodus-initial-design.md`

#### 레이저건 (Beam 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| tickDamage | 8 | 35 |
| 쿨다운 | 2000ms | 1200ms |
| 지속시간 | 300ms | 500ms |
| 사거리 | 300px | 450px |

- 빔은 Phaser Graphics 3-레이어 글로우로 렌더링 (매 프레임 clear + 재그리기): 외곽 글로우(8px cyan 20% opacity) + 메인 빔(4px cyan 80% opacity) + 코어(2px white 90% opacity) + 끝점 원형 글로우 + duration 중 width 맥동(+-1px)
- 가장 가까운 적 방향으로 자동 조준 (적 없으면 상향)
- duration 동안 사거리 내 모든 적에게 tickDamage를 1회 적용 (attackMultiplier 반영)
- 빔 판정 범위: 선분으로부터 20px 이내
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-08-neon-exodus-phase2.md`

#### 플라즈마 오브 (Orbital 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 오브 수 | 1 | 4 |
| tickDamage | 6 | 32 |
| 충돌 반경 | 55px | 90px |
| 공전 속도 | 2.0 rad/s | 3.5 rad/s |
| 틱 간격 | 500ms | 300ms |

- 오브는 `effect_plasma_orb` Image 스프라이트로 렌더링 (Graphics 원에서 전환), 플레이어 중심으로 공전 (ORBIT_RADIUS = 70px 고정) + 자체 회전
- tickInterval마다 orbRadius 내 적에게 tickDamage 적용 (attackMultiplier 반영)
- 레벨업으로 orbCount 증가 시 오브 배열 재구성
- orbRadius는 데미지 판정 범위
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-08-neon-exodus-phase2.md`

#### 전기 체인 (Chain 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 데미지 | 20 | 68 |
| 쿨다운 | 1200ms | 800ms |
| 체인 수 | 2 | 6 |
| 체인 범위 | 120px | 200px |
| 체인 감쇠 | 0.80 | 0.86 |

- 가장 가까운 적을 초기 타격 후 체인 범위 내 다음 적으로 번개가 연쇄 전달
- 체인마다 피해가 chainDecay 비율로 감소. 동일 적 중복 타격 방지 (hitSet)
- 체인 히트마다 독립적 치명타 판정
- 시각 효과: Phaser Graphics 3-레이어 번개 선 (외곽 5px 글로우 + 메인 3px + 코어 1.5px, 체인 노드에 스파크 원 4px, 3개 중간점 지그재그, 150ms 후 자동 파괴)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase3.md`

#### 미사일 (Homing 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 데미지 | 25 | 100 |
| 쿨다운 | 2500ms | 1400ms |
| 속도 | 200px/s | 290px/s |
| 선회 속도 | 1.5 rad/s | 2.8 rad/s |
| 폭발 반경 | 50px | 95px |
| 사거리 | 400px | 550px |

- 가장 가까운 적 방향으로 발사, 매 프레임 turnSpeed로 방향 보정하여 유도 추적
- 적 충돌 또는 range 초과 시 explosionRadius 범위 내 전체 적에게 피해
- 폭발 단위로 치명타 판정 (범위 내 모든 적에게 동일 적용)
- 시각 효과: `effect_missile` Image 스프라이트(rotation 적용) + 폭발 시 `effect_explosion` Image 스프라이트(scale tween + alpha fade, 200ms)
- 오브젝트풀 최대 30개
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase3.md`

#### 무기 진화 시스템
| 진화 무기 | 조건 (무기 Lv8 + 패시브 Lv5) | 타입 | 주요 스탯 |
|---|---|---|---|
| 프리시전 캐논 | blaster + aim_module | projectile | dmg 60, cd 200ms, pierce 99, multiShot 3 |
| 플라즈마 스톰 | electric_chain + overclock | chain | dmg 90, cd 600ms, chain 10, range 250, decay 0.92 |
| 핵 미사일 | missile + critical_chip | homing | dmg 150, cd 1000ms, speed 320, radius 140 |

- 무기 최대 레벨 + 대응 패시브 Lv5 이상 시 즉시 자동 진화
- LevelUpScene에서 무기/패시브 업그레이드 후 GameScene._tryEvolutionCheck() 호출
- 진화 성공 시 카메라 금색 플래시(300ms) + "[무기명] EVOLVED!" 팝업 (2초 후 소멸)
- 이미 진화한 무기는 중복 진화 방지 (weapon._evolvedId 체크)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`, `js/scenes/GameScene.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase3.md`

#### 치명타 시스템
- `_rollCrit(baseDamage)`: critChance > 0이고 Math.random() < critChance일 때 치명타 발생
- 치명타 데미지 = `baseDamage * (critDamage + critDamageMultiplier)`
- 기본 critDamage = 1.5, critDamageMultiplier 기본 0.0 (스나이퍼 +0.30)
- 5개 데미지 계산 지점에 적용: projectile(발사 시), beam(발사 단위), orbital(적별), chain(히트별), homing(폭발 단위)
- 시각 효과: 노란색(#FFDD00) "CRIT!" 텍스트 + 주황색(#FF6600) 외곽선, 400ms 후 소멸
- 관련 파일: `js/systems/WeaponSystem.js`, `js/entities/Projectile.js`
- 구현 일자: 2026-03-09

#### 드론 (Summon 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 드론 수 | 1 | 4 |
| 데미지 | 12 | 50 |
| 쿨다운 | 1000ms | 600ms |
| 사거리 | 120px | 160px |
| 이동속도 | 150px/s | 200px/s |

- 드론은 독립 에이전트 AI로 동작: 적이 있으면 접근 후 사거리 내 자동 발사, 적이 없으면 플레이어 주변 호버링
- 드론 수 증가: Lv3=2대, Lv5=3대, Lv7=4대
- engineer 캐릭터의 droneSummonBonus +1 적용 시 droneCount가 추가 +1
- 투사체에 attackMultiplier 적용
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase4.md`

#### EMP 폭발 (AoE 타입, Lv1~8)
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 데미지 | 15 | 75 |
| 쿨다운 | 5000ms | 3000ms |
| 반경 | 100px | 185px |
| 둔화율 | 0.35 (65% 감속) | 0.50 (50% 감속) |
| 둔화 지속 | 2000ms | 2800ms |

- 플레이어 중심 radius 내 모든 적에게 데미지 + 둔화 효과
- slowFactor: 적 속도를 해당 비율로 감소 (0.35 = 원래의 35%)
- slowDuration 이후 속도 복구 (enemy.active 체크로 사망 적 안전 처리)
- attackMultiplier 적용
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase4.md`

#### 포스 블레이드 (Melee 타입, Lv1~8) -- 스테이지 1 해금
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 데미지 | 30 | 135 |
| 쿨다운 | 800ms | 530ms |
| 범위 | 60px | 115px |
| 부채꼴 각도 | 60도 | 120도 |
| 넉백 | 20px | 36px |

- 이동 방향 기준 부채꼴 범위 참격, 이동 없을 때 360도 전방위
- stageUnlock: true (스테이지 1 클리어 시 영구 해금)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-10
- 스펙 문서: `.claude/specs/2026-03-10-multi-stage.md`

#### 나노스웜 (Cloud 타입, Lv1~8) -- 스테이지 2 해금
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 구름 수 | 1 | 4 |
| 틱 데미지 | 5 | 30 |
| 반경 | 40px | 80px |
| 지속시간 | 4000ms | 5500ms |
| 쿨다운 | 1000ms | 650ms |
| 독 스택 | 1 | 5 |

- 플레이어 주변 나노봇 구름 소환, 반경 내 적에게 지속 피해 + 독 스택 부여
- 독 스택: 스택당 초당 3 추가 DoT, 5초 지속. 최대 5스택
- stageUnlock: true (스테이지 2 클리어 시 영구 해금)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-10
- 스펙 문서: `.claude/specs/2026-03-10-multi-stage.md`

#### 볼텍스 캐넌 (Gravity 타입, Lv1~8) -- 스테이지 3 해금
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 직격 데미지 | 20 | 95 |
| 흡인 데미지 | 4 | 30 |
| 흡인 반경 | 60px | 115px |
| 소용돌이 지속 | 3000ms | 4000ms |
| 쿨다운 | 3000ms | 1800ms |
| 흡인력 | 80 | 135 (px/s^2) |

- 블랙홀 투사체 발사 (300px/s), 착탄 지점에 소용돌이 형성
- 볼텍스 내 적 이동속도 50% 감소
- stageUnlock: true (스테이지 3 클리어 시 영구 해금)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-10
- 스펙 문서: `.claude/specs/2026-03-10-multi-stage.md`

#### 리퍼 필드 (Rotating Blade 타입, Lv1~8) -- 스테이지 4 해금
| 항목 | Lv1 | Lv8 |
|---|---|---|
| 낫 수 | 3 | 5 |
| 데미지 | 18 | 90 |
| 공전 반경 | 65px | 105px |
| 회전 속도 | 5.0 rad/s | 11.0 rad/s |
| 틱 간격 | 300ms | 150ms |
| 저주 지속 | 2000ms | 3500ms |

- 플레이어 주변 에너지 낫 고속 회전, 충돌 시 사신의 저주 부여
- 사신의 저주: 이동속도 -30%, 받는 피해 +20%
- orbitRadius 시작값(65px)이 플라즈마 오브 ORBIT_RADIUS(70px)보다 작아 시각적으로 구분
- stageUnlock: true (스테이지 4 클리어 시 영구 해금)
- 관련 파일: `js/data/weapons.js`, `js/systems/WeaponSystem.js`
- 구현 일자: 2026-03-10
- 스펙 문서: `.claude/specs/2026-03-10-multi-stage.md`

### 적 시스템

#### 잡몹 (10종)
| # | 이름 | HP | 이속 | 접촉 데미지 | XP | 등장 시점 | 특성 |
|---|---|---|---|---|---|---|---|
| 1 | 나노 드론 | 10 | 120 | 3 | 1 | 0분 | 대량 스폰 |
| 2 | 정찰봇 | 20 | 80 | 5 | 2 | 0분 | 직선 추적 |
| 3 | 스파크 드론 | 15 | 110 | 4 | 2 | 2분 | 사망 시 전기 폭발 (30px, 3dmg) |
| 4 | 전투 로봇 | 60 | 50 | 12 | 4 | 4분 | 탱커 |
| 5 | 실드 드론 | 30 | 70 | 6 | 3 | 4분 | 전면 실드 (50% 감소) |
| 6 | 돌격봇 | 40 | 150 | 10 | 3 | 6분 | 돌진 + 벽 기절 |
| 7 | 수리봇 | 25 | 60 | 2 | 5 | 6분 | 아군 초당 5HP 회복 (80px) |
| 8 | 중장갑 봇 | 120 | 35 | 20 | 6 | 9분 | 넉백 저항 |
| 9 | 텔레포트 드론 | 35 | 80 | 8 | 5 | 9분 | 3초마다 순간이동 (80px) |
| 10 | 자폭봇 | 50 | 130 | 0 | 4 | 12분 | 자폭 (60px, 25dmg) |

#### 미니보스 (2종)
| 이름 | HP | 이속 | 등장 시점 | 특수 공격 | 드랍 |
|---|---|---|---|---|---|
| 가디언 드론 | 300 | 40 | 3분, 7분 | 회전 레이저 빔 (8dmg, 60px) | XP 보석 x5 |
| 어썰트 메카 | 500 | 60 | 6분, 12분 | 3방향 미사일 (12dmg) | XP 보석 x8 |

#### 보스 (3종)
| 이름 | HP | 등장 | 특수 패턴 | 드랍 |
|---|---|---|---|---|
| 커맨더 드론 | 800 | 5분 | 잡몹 4마리 소환 (10초 주기) + 돌진 | 보물 상자 |
| 시즈 타이탄 | 1500 | 10분 | 광역 포격 (80px, 2초 딜레이, 35dmg) + 돌진 | 보물 상자 + 크레딧 x50 |
| 코어 프로세서 | 3000 | 15분 | 회전 레이저 + 잡몹 소환 + 광역 EMP (150px, 20dmg) | 런 클리어 보상 |

- 시간 경과에 따라 HP/데미지 +5%/분 스케일링

#### 보스/미니보스 등장 연출
| 연출 대상 | 카메라 플래시 | 카메라 흔들림 | SFX |
|---|---|---|---|
| 미니보스 | 오렌지(255,100,0) 300ms | 없음 | 없음 |
| 보스 | 마젠타(255,0,255) 500ms | 500ms, 강도 0.02 | boss_appear |

- `GameScene.onMiniBossSpawn()`: 오렌지 플래시 + 경고 텍스트 표시
- `GameScene.onBossSpawn()`: 마젠타 플래시 + 카메라 흔들림 + boss_appear SFX + 경고 텍스트 표시

#### 피격 플래시 복원
- 정식 스프라이트 사용 시: 흰색 틴트(100ms) 후 `clearTint()`로 원래 색상 복원
- 플레이스홀더 사용 시: 흰색 틴트(100ms) 후 `setTint()`로 기존 타입별 색상 복원 (보스=마젠타, 미니보스=오렌지, 잡몹=레드)
- 분기 로직: `Enemy.takeDamage()`에서 `textures.exists('enemy_' + typeId)` 체크

- 관련 파일: `js/data/enemies.js`, `js/entities/Enemy.js`, `js/entities/EnemyTypes.js`, `js/scenes/GameScene.js`
- 구현 일자: 2026-03-08 (보스/미니보스 등장 연출 및 피격 복원 로직: 2026-03-09)

### 스폰 시스템

| 시간대 | 스폰 간격 | 동시 스폰 수 |
|---|---|---|
| 0~2분 | 1.5초 | 3~5 |
| 2~4분 | 1.2초 | 5~8 |
| 4~6분 | 1.0초 | 8~12 |
| 6~9분 | 0.8초 | 12~16 |
| 9~12분 | 0.6초 | 16~22 |
| 12~15분 | 0.4초 | 22~30 |

- 화면 밖 50~100px 위치에서 스폰
- 관련 파일: `js/data/waves.js`, `js/systems/WaveSystem.js`
- 구현 일자: 2026-03-08

### 런 내 성장

#### XP / 레벨업
- XP 보석: 소(1), 중(3), 대(10)
- 보석 바닥 유지 5초, 소멸 전 깜빡임 3초
- 자석 반경: 50px (기본)
- 레벨업 필요 XP: `10 + (level * 5)`
- 레벨업 시 3택 카드 (무기 레벨업 / 패시브 획득 / 패시브 레벨업 / 새 무기 획득)
- 새 무기 카드: 미장착 Phase 4 이하 무기 중 선택 (슬롯 여유 시에만 생성, getAvailableWeapons(4))
- 리롤 버튼: 남은 리롤 횟수 > 0일 때 활성화, 클릭 시 선택지 재생성
- 스킵 처리: 모든 무기/패시브가 최대 레벨이고 무기 슬롯이 가득 찬 상태에서 레벨업 시, 선택지가 0개가 되면 "모든 업그레이드 완료!" 안내 메시지와 스킵 버튼을 표시. 스킵 클릭 시 `levelupDone` 이벤트 발행 후 GameScene 재개. 리롤 버튼은 숨김 (`_skipMode` 플래그). `create()` 시 `_skipMode = false`로 초기화하여 Phaser 씬 인스턴스 재사용 시 상태 잔존 방지.
- 관련 파일: `js/entities/XPGem.js`, `js/scenes/LevelUpScene.js`
- 구현 일자: 2026-03-08 (Phase 2 확장: 2026-03-09, 스킵 버그 수정: 2026-03-09)

#### 패시브 아이템 (10종)
| # | 아이템 | 효과/Lv | 최대 Lv |
|---|---|---|---|
| 1 | 부스터 | 이동속도 +8% | 5 |
| 2 | 아머 플레이트 | 방어력 +3 | 5 |
| 3 | 배터리팩 | 최대 HP +20 | 5 |
| 4 | 오버클럭 | 공격속도 +10% | 5 |
| 5 | 자석 모듈 | XP 흡수 반경 +20% | 5 |
| 6 | 재생 모듈 | HP 회복 +0.5/초 | 5 |
| 7 | 조준 모듈 | 투사체 사거리 +15% | 5 |
| 8 | 크리티컬 칩 | 크리티컬 확률 +5% (데미지 150%) | 5 |
| 9 | 쿨다운 칩 | 무기 쿨다운 -6% | 5 |
| 10 | 행운 모듈 | 크레딧 드랍량 +10% | 5 |

- 관련 파일: `js/data/passives.js`
- 구현 일자: 2026-03-08

### 메타 시스템

#### 재화
- **크레딧**: 적 드랍 (10% 확률, 1개), 보스 보상, 런 완료 보너스
- **데이터 코어**: 보스 처치, 도전과제 달성
- ResultScene에서 SaveManager.addCredits()로 영구 저장

#### 영구 업그레이드 (22종)
- 기본 스탯 8종 (공격력/최대 체력/체력 회복/방어력/이동속도/쿨다운 감소/투사체 속도/효과 범위, 각 최대 Lv10)
- 성장 가속 6종 (XP 획득량/크레딧 획득량/XP 자석 반경/행운/레벨업 선택지/리롤)
- 특수 5종 (부활/초기 무기 레벨/시작 패시브/바니시/넉백 파워)
- 한도 돌파 3종 (무기 슬롯/패시브 슬롯/골드 러시, 기본 스탯 전부 최대 후 해금)
- UpgradeScene에서 4탭(기본/성장/특수/한계돌파) 카드 그리드로 구매 가능
- MetaManager.purchaseUpgrade()로 크레딧 차감 및 레벨 갱신
- 다운그레이드: 각 카드의 [-] 버튼으로 1레벨 감소 + `costFormula(currentLevel)` 크레딧 100% 전액 환불
  - MetaManager.downgradeUpgrade()로 처리 (canDowngrade guard -> addCredits -> setUpgradeLevel)
  - Lv0일 때 [-] 버튼 비활성(회색 `0x333344`), Lv1 이상이면 활성(오렌지-레드 `0xAA3300`)
  - MAX 레벨 카드에서도 [-] 버튼 동작. 잠금 카드에는 [-] 버튼 미표시
  - 다운그레이드 후 크레딧 HUD 및 카드 UI 즉시 갱신
  - 한계돌파(weaponSlots, passiveSlots, goldRush)도 다운그레이드 허용
  - 환불 예시: attack Lv3 -> Lv2 = +300, goldRush Lv1 -> Lv0 = +2000
- 관련 파일: `js/data/upgrades.js`, `js/managers/MetaManager.js`, `js/scenes/UpgradeScene.js`

#### 런 시작 시 보너스 적용
- GameScene.create()에서 MetaManager.getPlayerBonuses() 호출
- 부활 횟수(revivesLeft), 리롤 횟수(rerollsLeft), 추가 무기 슬롯(maxWeaponSlots), 초기 무기 레벨(startWeaponLevel) 반영
- Player.applyMetaUpgrades()로 플레이어 스탯(공격력/체력/방어력 등) 반영

#### 부활 시스템
- 사망 시 revivesLeft > 0이면 부활 처리
- 부활: HP를 maxHp의 50%로 회복, 2초 무적, 화면 흰색 플래시 효과
- revivesLeft <= 0이면 ResultScene으로 전환

#### 통계 저장
- ResultScene.create()에서 1회 실행
- totalRuns, totalKills, longestSurvival, maxKillsInRun, maxLevel, totalClears, totalBossKills, totalSurviveMinutes 갱신
- 승리 시 consecutiveClears 증가, 패배 시 초기화 (직접 data.stats 조작)
- AchievementManager.checkAll()로 도전과제 체크

#### 캐릭터 (6종)
| 캐릭터 | spriteKey | 시작 무기 | 고유 패시브 | 해금 조건 | Phase |
|---|---|---|---|---|---|
| 에이전트 | `player` | blaster | 없음 | 기본 제공 | 1 |
| 스나이퍼 | `sniper` | laser_gun | critDamageMultiplier +0.30 | totalKills >= 5000 | 3 |
| 엔지니어 | `engineer` | drone | droneSummonBonus +1 (드론 수 +1) | totalClears >= 10 | 3 |
| 버서커 | `berserker` | electric_chain | HP 50% 이하 시 공격력 +40% | totalBossKills >= 10 | 3 |
| 메딕 | `medic` | blaster | hpRegenMultiplier x2.0, maxHp -30% | totalSurviveMinutes >= 500 | 4 |
| ??? (Weapon Master) | `hidden` | blaster | 무기 슬롯 +2, 무기 등장 확률 x2 | sniper+engineer+berserker 모두 해금 | 4 |

- CharacterScene: MenuScene에서 출격 버튼 클릭 시 이동. 캐릭터 목록을 세로 스크롤로 표시
- 잠금 캐릭터는 alpha 0.4, 선택 캐릭터는 neonCyan 테두리 하이라이트
- 선택 후 출격 버튼으로 GameScene 시작 (characterId 전달)
- GameScene.init()에서 characterId 수신, Player 생성 시 전달 -> 캐릭터별 고유 스프라이트/애니메이션 적용
- 관련 파일: `js/data/characters.js`, `js/scenes/CharacterScene.js`
- 구현 일자: 2026-03-09

#### 도전과제 (13종)
- 킬 업적 4종, 생존 업적 3종, 클리어 업적 3종, 특수 업적 3종
- AchievementScene: 13개 도전과제를 세로 스크롤 리스트로 표시
- 각 항목에 달성 여부 아이콘, 제목, 설명, 진행률 (현재값/목표값) 표시
- 달성 항목: neonGreen alpha 0.15 배경 + 체크 마크
- MenuScene 도전과제 버튼으로 진입
- 관련 파일: `js/data/achievements.js`, `js/managers/AchievementManager.js`, `js/scenes/AchievementScene.js`
- 구현 일자: 2026-03-09

#### 도감 (4탭)
- CollectionScene: 무기 / 패시브 / 적 / 도전과제 4개 탭
- 미발견 항목은 이름과 설명을 모두 ???로 마스킹
- 발견된 항목은 이름, 설명, 스탯 표시. 진화 무기도 별도 항목으로 포함 (진화 조건 표시)
- 자동 등록: WeaponSystem.addWeapon()에서 weaponsSeen, LevelUpScene._addPassive()에서 passivesSeen, GameScene.onEnemyKilled()에서 enemiesSeen, evolveWeapon()에서 진화 무기 weaponsSeen 등록
- MenuScene 도감 버튼으로 진입
- 관련 파일: `js/scenes/CollectionScene.js`
- 구현 일자: 2026-03-09

### 사운드 시스템

#### SFX (9종)
| sfxId | 실행 시점 | 파라미터 |
|---|---|---|
| shoot | 투사체 발사 | 880Hz->440Hz 사인파, 0.08초 |
| hit | 적 피격 | 220Hz 사인파, gain 0.3, 0.05초 |
| player_hit | 플레이어 피격 | 110Hz 사각파, gain 0.5, 0.1초 |
| levelup | 레벨업 | C4->E4->G4->C5 아르페지오, 0.1초씩 |
| evolution | 무기 진화 | C4->G4->C5->G5 아르페지오 |
| boss_appear | 보스 등장 | 55Hz 사각파, gain 0.8, 0.6초 |
| emp_blast | EMP 폭발 | 200Hz->20Hz 노이즈, 0.5초 |
| revive | 부활 | G4->C5->G5 상승, 0.15초씩 |
| xp_collect | XP 수집 | 1200Hz 사인파, gain 0.1, 0.03초 |

#### BGM (2곡)
| bgmId | 설명 | 파라미터 |
|---|---|---|
| bgm_game | 게임 중 | 80 BPM, 4/4 박자, 8바(24초) 루프. C2 사각파 베이스 + 노이즈 드럼 |
| bgm_menu | 메뉴 | 120 BPM, 사인 멜로디 8노트, 2바(4초) 루프 |

- 외부 오디오 파일 없이 100% AudioContext 오실레이터 합성
- 모바일 AudioContext unlock 패턴 (resume) 적용
- BootScene에서 SoundSystem.init(settings) 호출
- GameScene/MenuScene 터치 이벤트에서 SoundSystem.resume() 호출
- GameScene 사망/포기 시 SoundSystem.stopBgm() 호출
- 설정에서 sfxVolume/bgmVolume 실시간 변경 가능
- 관련 파일: `js/systems/SoundSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase4.md`

### VFX 시스템

| VFX | 파라미터 | 설명 |
|---|---|---|
| hitSpark | cyan, 8입자, 200ms | 적 피격 스파크 |
| playerHit | red, 12입자, 300ms | 플레이어 피격 |
| enemyDie | white+orange, 20입자, 400ms | 적 사망 폭발 |
| levelUpBurst | gold, 40입자, 600ms | 레벨업 버스트 |
| empBurst | electric blue, 60입자, 500ms | EMP 파동 |
| xpCollect | green, 6입자, 150ms | XP 수집 반짝 |
| consumableCollect | 아이템별 tintColor, 파티클 버스트 | 소모성 아이템 수집 |
| empBlast | electric blue, 파티클 + 카메라 플래시 | EMP 폭탄 화면 클리어 |

- BootScene에서 4x4 흰색 particle 텍스처 생성, 추가 에셋 로드 없음
- 모든 VFX는 emitter.explode() 방식 1회 버스트 후 자동 파괴
- 관련 파일: `js/systems/VFXSystem.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase4.md`

### 엔들리스 모드

- 코어 프로세서(최종 보스) 처치 시 게임이 종료되지 않고 엔들리스 모드로 진입
- "ENDLESS MODE!" 경고 메시지 표시
- HUD 타이머가 +MM:SS 형식으로 카운트업
- ENDLESS_SCALE_INTERVAL(60초)마다 적 HP/데미지 +10% 누적 스케일링 (WaveSystem._hpMultiplier, _dmgMultiplier)
- 5분(300초)마다 미니보스(guardian_drone 또는 assault_mech) 랜덤 스폰
- 포기 또는 사망 시 ResultScene에 엔들리스 모드 결과 표시 (경과 분)
- 관련 파일: `js/scenes/GameScene.js`, `js/systems/WaveSystem.js`, `js/config.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-neon-exodus-phase4.md`

### 자동 사냥 (AutoPilot) 시스템

AI가 플레이어 이동을 자동 제어하는 유료 편의 기능. Google Play IAP로 영구 해금한다.

#### AI 행동 우선순위
1. **무기 드롭 긴급 수집** (collect): 비영구 무기 드롭의 수명이 4000ms 이하이고 CRITICAL 위험(60px) 내 적이 없으면 위험 회피보다도 우선하여 수집. 탐색 반경 400px, 긴급 보정 x3 적용.
2. **위험 회피** (evade): 반경 120px 내 적이 3마리 이상이거나, 60px 내 적이 있으면 반대 방향으로 회피. 거리 기반 가중 반발 벡터 사용.
3. **무기 드롭 일반 수집** (collect): 400px 이내 무기 드롭 중 점수가 가장 높은 아이템 방향으로 이동.
4. **소모품 수집** (collect): 300px 이내 소모품 중 점수가 가장 높은 아이템 방향으로 이동.
5. **XP 보석 수집** (collect): 200px 이내 XP 보석 중 점수가 가장 높은 보석 방향으로 이동. 자석 반경 내 보석은 무시.
6. **적 접근** (approach): 가장 가까운 적이 150px 이상 떨어져 있으면 접근하여 무기 사거리를 유지.
7. **방랑** (idle): 위 행동이 불필요하면 월드 중앙 경향 + 랜덤 방향 혼합 이동.

#### 아이템 수집 점수 공식 (소스 코드 검증 기준)
| 대상 | 점수 공식 | 탐색 반경 |
|---|---|---|
| 무기 드롭 긴급 | `weaponDropScoreMultiplier(10) * 3 * 1000 / (dist + 1)` | 400px |
| 무기 드롭 일반 | `weaponDropScoreMultiplier(10) * 1000 / (dist + 1)` | 400px |
| 소모품 | `consumableScoreMultiplier(5) * 100 / (dist + 1)` | 300px |
| XP 보석 | `xpGemScoreMultiplier(1) * (xpValue \|\| 1) / (dist + 1)` | 200px |

#### AI 파라미터 (소스 코드 검증 기준)
| 파라미터 | 값 | 위치 |
|---|---|---|
| 위험 감지 반경 | 120px | `config.js` AUTO_HUNT.dangerRadius |
| 심각한 위험 반경 | 60px | `AUTO_HUNT.dangerRadius / 2` 동적 계산 |
| XP 보석 탐색 반경 | 200px | `config.js` AUTO_HUNT.xpSearchRadius |
| 소모품 탐색 반경 | 300px | `config.js` AUTO_HUNT.consumableSearchRadius |
| 무기 드롭 탐색 반경 | 400px | `config.js` AUTO_HUNT.weaponDropSearchRadius |
| 무기 드롭 긴급 임계 수명 | 4000ms | `config.js` AUTO_HUNT.weaponDropUrgentLifetime |
| 무기 드롭 점수 가중치 | 10 | `config.js` AUTO_HUNT.weaponDropScoreMultiplier |
| 소모품 점수 가중치 | 5 | `config.js` AUTO_HUNT.consumableScoreMultiplier |
| XP 보석 점수 가중치 | 1 | `config.js` AUTO_HUNT.xpGemScoreMultiplier |
| 적 접근 유지 거리 | 150px | `AutoPilotSystem.js` PREFERRED_ENEMY_DISTANCE |
| 벽 회피 마진 | 80px | `AutoPilotSystem.js` WALL_MARGIN |
| 방향 전환 간격 | 150ms | `config.js` AUTO_HUNT.directionInterval |
| 랜덤 각도 변동 (jitter) | 0.3 rad | `AutoPilotSystem.js` IMPERFECTION_ANGLE |
| 반응 누락 확률 | 5% (0.05) | `AutoPilotSystem.js` REACTION_MISS_CHANCE |

#### 의도적 불완전성
- 매 프레임 5% 확률로 AI가 반응하지 않고 이전 방향 유지 (REACTION_MISS_CHANCE)
- 방향 결정 시 최대 0.3rad 랜덤 각도 변동 (IMPERFECTION_ANGLE)
- 방향 전환 최소 간격 150ms로 과도한 지터 방지
- _wander() 모드에서 벽 회피(wall avoidance)가 _applyDirection() 경유가 아닌 중앙 경향으로 처리됨 (물리 레벨 setCollideWorldBounds로 보완)

#### 유저 입력 우선
- Player._handleMovement()에서 joystick.isActive가 true이면 AI 방향 무시
- 조이스틱 해제 시 자동으로 AI 이동 재개

#### HUD 토글 버튼
- 위치: 우상단 `(GAME_WIDTH-12, 48)`, 레벨 텍스트(y=12) 아래
- 해금 시에만 표시, "AUTO ON"(녹색) / "AUTO OFF"(회색) 토글
- 토글 상태를 SaveManager에 즉시 저장 (autoHuntEnabled)
- 다음 런 시작 시 저장된 상태 자동 복원

#### 일시정지/사망 시 동작
- GameScene.update()에서 isPaused 시 전체 return하므로 AutoPilot도 정지
- player.active === false이면 direction을 (0,0)으로 초기화
- 씬 정리 시 autoPilot.destroy() 호출

- 관련 파일: `js/systems/AutoPilotSystem.js`, `js/config.js`, `js/scenes/GameScene.js`, `js/entities/Player.js`
- 구현 일자: 2026-03-09 (아이템 수집 가중치 강화: 2026-03-11)
- 스펙 문서: `.claude/specs/2026-03-09-auto-hunt.md`, `.claude/specs/2026-03-11-auto-move-item-weight.md`

### IAP (인앱결제) 시스템

Google Play 인앱결제를 통한 유료 기능 해금. Capacitor 네이티브 환경에서는 실제 IAP, 웹 환경에서는 Mock 모드 동작.

#### IAPManager
- 싱글톤 패턴 (AdManager와 동일 구조)
- `initialize()`: Capacitor.Plugins.InAppPurchase 감지. 실패 시 Mock 모드 폴백
- `purchase(productId)`: 구매 요청. Mock 모드에서는 `{ purchased: true }` 즉시 반환. 실패 시 reject하지 않고 `{ purchased: false, error }` 반환. `isBusy` 플래그로 중복 호출 차단
- `restorePurchases()`: 이전 구매 복원. Mock 모드에서는 `{ restored: false }` 반환. 네이티브에서 autoHunt 상품 확인 시 SaveManager에 기록
- `isAutoHuntUnlocked()`: SaveManager에서 `autoHuntUnlocked` 읽기
- `unlockAutoHunt()`: SaveManager에 `autoHuntUnlocked = true` 저장

#### IAP 상품
| 상품 ID | 설명 | 타입 |
|---|---|---|
| `com.antigravity.neonexodus.auto_hunt` | 자동 사냥 영구 해금 | 비소모형 (inapp) |

#### 구매 흐름
1. MenuScene: 미해금 시 "자동 사냥 해금" 오렌지 버튼 표시, 해금 시 "AUTO ON" 녹색 텍스트
2. 구매 버튼 클릭 -> IAPManager.purchase() -> 성공 시 IAPManager.unlockAutoHunt() + 씬 새로고침
3. BootScene.create()에서 IAPManager.initialize() + restorePurchases() 호출 (기기 변경 시 자동 복원)

#### 세이브 데이터 (v4)
- `autoHuntUnlocked`: boolean, 자동 사냥 IAP 구매 여부 (기본: false)
- `autoHuntEnabled`: boolean, 마지막 런의 자동 사냥 토글 상태 (기본: false)
- v3->v4 마이그레이션: 두 필드가 undefined이면 false로 초기화

- 관련 파일: `js/managers/IAPManager.js`, `js/config.js`, `js/scenes/BootScene.js`, `js/scenes/MenuScene.js`, `js/managers/SaveManager.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-auto-hunt.md`

### UI/HUD

#### 상단 HUD
- 일시정지 버튼, HP 바, 레벨 표시
- XP 바, 타이머 (15:00 카운트다운 / 엔들리스 모드: +MM:SS 카운트업)
- AUTO ON/OFF 토글 버튼 (자동 사냥 해금 시에만 표시, 우상단 y=48)

#### 하단 HUD
- 크레딧, 킬 수

#### 인벤토리 HUD (Vampire Survivors 스타일)
HUD 하단에 보유 무기/패시브를 상시 표시하는 2행 인벤토리. 이벤트 기반 갱신으로 매 프레임 비용 없음.

| 행 | 중심 Y | 슬롯 크기 | stride | 최대 수 | 레벨 색상 |
|---|---|---|---|---|---|
| 무기 행 | 560 (GAME_HEIGHT-80) | 32x32, 반경 5 | 60px | 6 | xpYellow (#FFDD00) |
| 패시브 행 | 594 (GAME_HEIGHT-46) | 28x28, 반경 4 | 36px | 10 | neonCyan (#00FFFF) |

- 각 슬롯: 반투명 검정 둥근 사각형 배경(무기 55%, 패시브 50%) + 이모지 아이콘 + 우하단 레벨 숫자
- 무기 아이콘: WEAPON_ICON_MAP 상수로 매핑 (10종 + fallback), 진화 무기는 `w._evolvedId`로 진화 아이콘 자동 교체
- 패시브 아이콘: `getPassiveById(pid).icon` 필드 활용
- depth: bg=105, icon=106, level=107 (기존 HUD 100~102 위)
- setScrollFactor(0)으로 카메라 고정
- 갱신 시점: `_createHUD()` 초기화 시 1회 + `levelupDone` 이벤트 핸들러에서 `_tryEvolutionCheck()` 이후
- 빈 슬롯 표시 없음 (보유 아이템만 순회)
- 관련 파일: `js/scenes/GameScene.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-ingame-inventory-ui.md`

#### 일시정지 오버레이
- 반투명 배경, 계속/포기 버튼

#### 레벨업 오버레이
- 3택 카드 (아이콘 + 이름 + 효과 + 레벨)
- 무기 레벨업 / 패시브 획득 / 패시브 레벨업 / 새 무기 획득 카드
- 리롤 버튼 (메타 업그레이드 연동, rerollsLeft 기반)
- 스킵 모드: 선택지 0개 시 "모든 업그레이드 완료!" + 스킵 버튼 표시, 리롤 버튼 숨김

#### 결과 화면
- 승리/패배/엔들리스 분기, 생존 시간/처치 수/도달 레벨, 보상 표시
- 엔들리스 모드: "ENDLESS OVER!" + 경과 분 표시
- 재도전/메인 메뉴 버튼, 등장 애니메이션
- 무기별 결과 리포트 (아래 참조)
- 하단 버튼 동적 Y좌표 계산 (콘텐츠 끝 위치 기준, GAME_HEIGHT 640px 이내 보장)

- 관련 파일: `js/scenes/GameScene.js`, `js/scenes/LevelUpScene.js`, `js/scenes/ResultScene.js`
- 구현 일자: 2026-03-08

#### 무기별 결과 리포트
게임 종료(사망/승리/포기) 시 ResultScene에서 런 동안 장착한 무기별 통계를 표시한다.

- **데이터 수집**: WeaponSystem.weaponStats Map에 무기별 { kills, damage } 추적
  - `recordDamage(weaponId, amount)`: 7개 데미지 경로(projectile, beam, orbital, chain, homing, summon, aoe)에서 호출
  - `recordKill(weaponId)`: Enemy 처치 시 `GameScene.onEnemyKilled()`에서 호출
  - addWeapon() 시 weaponStats에 { kills: 0, damage: 0 } 자동 초기화
- **리포트 빌드**: GameScene._buildWeaponReport()
  - DPS = Math.round(damage / Math.max(1, runTimeSec)), 0 나누기 방지
  - 진화 무기는 `_evolvedNameKey` 사용
  - 데미지 높은 순 정렬
- **UI 렌더링**: ResultScene._renderWeaponReport()
  - 최대 6개 무기 표시 (`slice(0, 6)`)
  - 각 무기: 이름 (11px), 킬 수 + DPS (9px), 데미지 비율 바 (높이 6px, NEON_CYAN), 데미지 수치
  - 행 높이: 28px
  - 등장 애니메이션 (알파 페이드, 딜레이 100ms씩)
- **전달 경로**: _goToResult(), 일시정지 포기 (일반/엔들리스 모두) 3곳에서 weaponReport 전달
- **폴백**: weaponReport가 undefined이면 빈 배열, 길이 0이면 섹션 미렌더링
- i18n 키: `result.weaponReport`(무기별 리포트), `result.weaponKills`({0}킬), `result.weaponDps`(DPS {0}) ko/en
- 관련 파일: `js/systems/WeaponSystem.js`, `js/scenes/GameScene.js`, `js/scenes/ResultScene.js`, `js/i18n.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-weapon-report.md`

### 세이브/매니저 시스템

- SaveManager: 로컬스토리지 기반, 세이브 버전 v4. 크레딧/통계/도감/자동사냥 영구 저장 연동 완료. v1->v2 마이그레이션(totalBossKills), v2->v3 마이그레이션(totalSurviveMinutes), v3->v4 마이그레이션(autoHuntUnlocked, autoHuntEnabled) 구현.
- MetaManager: 영구 업그레이드 구매/다운그레이드/적용 계산. canDowngrade(), getDowngradeRefund(), downgradeUpgrade() 메서드 제공. GameScene에서 getPlayerBonuses() 호출하여 런 시작 시 보너스 적용.
- AchievementManager: 도전과제 조건 검사/보상 지급. ResultScene에서 checkAll() 호출.
- IAPManager: Google Play 인앱결제 구매/복원. 웹 환경 Mock 모드 지원. BootScene에서 초기화 및 구매 복원.
- 관련 파일: `js/managers/SaveManager.js`, `js/managers/MetaManager.js`, `js/managers/AchievementManager.js`, `js/managers/IAPManager.js`
- 구현 일자: 2026-03-08 (Phase 2 연동: 2026-03-09, IAP/AutoPilot: 2026-03-09)

## 알려진 제약사항

1. **폰트 파일 누락**: `assets/fonts/Galmuri11.woff2` 미존재. monospace 폴백 사용 중. 폰트 파일 추가 또는 @font-face 선언 제거 필요.
2. **Player._passives 미초기화**: constructor에 `this._passives` 미선언. LevelUpScene에서 lazy init으로 안전하게 처리됨.
3. **BootScene 플레이스홀더 텍스처**: 20종 캐릭터/적/수집물 스프라이트는 글로우 벡터 PNG로 전면 교체 완료. UI/배경/조이스틱 등은 여전히 플레이스홀더 텍스처 사용. `_temp` 텍스처 코드 및 `_createAnimations()` 메서드는 전부 제거됨.
4. **체인 무기 초기 타겟 탐색 범위 하드코딩**: `WeaponSystem.js` findClosestEnemy에 300px 하드코딩. chainRange(120~200px)는 체인 연결 거리이고 초기 타겟 탐색은 별도 범위. 기능 문제 없으나 상수화 권장.
5. **부활 시 HP 직접 대입**: 스펙은 `player.heal(maxHp * 0.5)`이나, 실제 구현은 `player.currentHp = Math.floor(maxHp * 0.5)` 직접 대입. 동작에 문제 없으나 스펙과 불일치.
6. **CollectionScene ENEMY_IDS 하드코딩**: 적 ID 15개가 하드코딩. 신규 적 추가 시 수동 업데이트 필요.
6. **MetaManager/Player 이중 경로**: GameScene에서 MetaManager.getPlayerBonuses()와 SaveManager.getUpgradeLevel()을 별도로 호출. 동일 데이터 소스이므로 현재 문제 없으나, 보너스 계산 공식 변경 시 불일치 위험.
7. **consecutiveClears 직접 조작**: SaveManager.updateStats() 로직에 맞지 않아 data.stats를 직접 조작. SaveManager에 setStats() 메서드 추가 권장.
8. **오브 시각적 크기 고정**: 플라즈마 오브의 시각적 크기가 8px로 고정되어 orbRadius(55~90px)와 불일치. orbRadius는 데미지 판정 범위.
9. ~~**AutoPilotSystem AUTO_HUNT import 미사용**~~: **해결됨 (2026-03-11)**. 하드코딩 상수(DANGER_RADIUS, XP_SEARCH_RADIUS, DIRECTION_CHANGE_INTERVAL, CRITICAL_DANGER_RADIUS) 완전 제거, AUTO_HUNT 객체에서 런타임 참조로 전환.
10. **AutoPilotSystem _wander() 벽 회피 미경유**: idle 모드에서 _applyDirection()을 거치지 않아 벽 회피와 jitter가 미적용. Phaser setCollideWorldBounds가 물리 레벨에서 보완하나, 벽 근처 AI 움직임이 부자연스러울 수 있음.
11. **IAP 플러그인 미등록**: InAppPurchase Capacitor 플러그인이 package.json에 미등록. 네이티브 빌드 전 `@nicegram/capacitor-iap` 등 설치 필요. 웹 환경에서는 Mock 모드로 정상 동작.

## 현재 구현 상태

### Phase 1: 코어 루프 (MVP) -- 완료 (2026-03-08)
- [x] 프로젝트 초기 셋업 (Phaser 3.87.0, Capacitor 8, ES Modules)
- [x] 가상 조이스틱 + 플레이어 이동
- [x] 블래스터 자동 공격 (Lv1~8)
- [x] 잡몹 10종 + 스폰 시스템
- [x] 미니보스 2종 + 보스 3종
- [x] XP 보석 + 레벨업 3택 선택
- [x] 패시브 아이템 10종
- [x] 15분 타이머 + 최종 보스 → 클리어/사망 판정
- [x] 기본 HUD (HP, XP, 타이머, 킬수, 크레딧)
- [x] 결과 화면 (킬수, 크레딧 획득, 재도전/메뉴)
- [x] 메인 메뉴 (출격, 업그레이드/도감 비활성, 언어 토글)
- [x] SaveManager / MetaManager / AchievementManager
- [x] 영구 업그레이드 22종 데이터
- [x] 도전과제 13종 데이터
- [x] i18n (한국어/영어 279키)

### Phase 2: 메타 루프 + 신규 무기 -- 완료 (2026-03-09)
- [x] ResultScene -> SaveManager 크레딧/통계 저장 연동
- [x] MenuScene 업그레이드 버튼 활성화 + 크레딧/데이터코어 실시간 표시
- [x] UpgradeScene 신규 구현 (4탭 카드 그리드: 기본/성장/특수/한계돌파)
- [x] GameScene 시작 시 MetaManager 보너스 적용 (부활/리롤/무기 슬롯/초기 무기 레벨/스탯)
- [x] 레이저건 (Beam 타입, Lv1~8) 구현
- [x] 플라즈마 오브 (Orbital 타입, Lv1~8) 구현
- [x] 레벨업 선택지에 새 무기 카드 추가 (다중 무기 슬롯)
- [x] 레벨업 리롤 기능 (MetaManager.rerolls 연동)
- [x] 부활(Revive) 기능 (HP 50% 회복, 2초 무적, 화면 플래시)

### Phase 3: 콘텐츠 확장 -- 완료 (2026-03-09)
- [x] 전기 체인 무기 (chain 타입, Lv1~8, 연쇄 번개)
- [x] 미사일 무기 (homing 타입, Lv1~8, 유도 추적 + 범위 폭발)
- [x] 무기 진화 시스템 활성화 (3종: precision_cannon, plasma_storm, nuke_missile)
- [x] 캐릭터 선택 화면 (CharacterScene) + 캐릭터 3명 (스나이퍼/엔지니어/버서커)
- [x] 캐릭터 고유 패시브 (스나이퍼 critDamage+30%, 버서커 저HP 공격+40%)
- [x] 치명타 시스템 전체 구현 (_rollCrit, 5개 데미지 지점 적용, CRIT! 시각 효과)
- [x] 도전과제 화면 (AchievementScene, 13개, 진행률 표시)
- [x] 도감 화면 (CollectionScene, 4탭: 무기/패시브/적/도전과제, 자동 등록)
- [x] 통계 확장 (totalBossKills, 세이브 v1->v2 마이그레이션)
- [x] 무기 풀 확장 (getAvailableWeapons(3), Phase 3 무기 레벨업 선택지)
- [x] 부활(Revive) 기능 (Phase 2 미완성분)

### Phase 4: 폴리싱 -- 완료 (2026-03-09)
- [x] 드론 무기 (summon 타입, Lv1~8, 독립 에이전트 AI, 자유이동 동반자)
- [x] EMP 폭발 무기 (aoe 타입, Lv1~8, 범위 데미지 + 둔화)
- [x] 메딕 캐릭터 패시브 적용 (hpRegenMultiplier x2.0, maxHp -30%, 해금: totalSurviveMinutes >= 500)
- [x] 히든 캐릭터 Weapon Master 패시브 (무기 슬롯 +2, weaponChoiceBias x2.0, 해금: 3캐릭 모두 해금)
- [x] SoundSystem (AudioContext 프로그래매틱 SFX 9종 + BGM 2곡)
- [x] VFXSystem (Phaser Particles VFX 6종)
- [x] 엔들리스 모드 (코어 프로세서 처치 후 계속, +10%/분 스케일링, 5분마다 미니보스)
- [x] SaveManager v2->v3 마이그레이션 (totalSurviveMinutes 통계 추가)
- [x] 엔지니어 drone 무기 실구현 (blaster 폴백 코드 제거)
- [x] 무기 풀 확장 (getAvailableWeapons(4), Phase 4 무기 레벨업 선택지)
- [x] i18n 확장 (드론/EMP Lv1~8, 메딕/히든 캐릭터, 엔들리스 모드 텍스트, ko/en 338키)

### 자동 사냥 (Auto Hunt) -- 완료 (2026-03-09)
- [x] AutoPilotSystem 신규 구현 (종합형 AI: 위험 회피 > XP 수집 > 적 접근 > 방랑)
- [x] 의도적 불완전성 (랜덤 각도 변동 0.3rad, 반응 누락 5%, 방향 전환 간격 150ms)
- [x] IAPManager 신규 구현 (Google Play IAP, Capacitor 플러그인 래핑, Mock 모드)
- [x] MenuScene 자동 사냥 구매 UI (미해금 시 구매 버튼, 해금 시 완료 표시)
- [x] GameScene HUD 토글 버튼 (AUTO ON/OFF, 해금 시에만 표시)
- [x] 유저 조이스틱 입력 우선 (joystick.isActive 시 AI 방향 무시)
- [x] 설정 기억 (autoHuntEnabled를 SaveManager에 저장, 다음 런 자동 적용)
- [x] 구매 복원 (BootScene에서 restorePurchases, 기기 변경 시 재구매 방지)
- [x] SaveManager v3->v4 마이그레이션 (autoHuntUnlocked, autoHuntEnabled 필드 추가)
- [x] i18n 확장 (autoHunt.* 10키 ko/en, 총 348키)

### AutoPilot 아이템 수집 가중치 강화 -- 완료 (2026-03-11)
- [x] 소모품(Consumable) AI 탐색 대상 추가 (scene.consumablePool, 탐색 반경 300px)
- [x] 무기 드롭(WeaponDropItem) AI 탐색 대상 추가 (scene.weaponDropPool, 탐색 반경 400px)
- [x] 아이템 우선순위 재편: 긴급 무기 수집 > 위험 회피 > 무기 드롭 > 소모품 > XP 보석 > 적 접근 > 방랑
- [x] 무기 드롭 긴급 수집: 비영구 드롭 수명 4000ms 이하 시 CRITICAL 위험(60px) 밖이면 위험 회피보다 우선
- [x] 종류별 점수 가중치: 무기 드롭 x10, 소모품 x5, XP 보석 x1
- [x] 하드코딩 상수 완전 제거: DANGER_RADIUS, XP_SEARCH_RADIUS, DIRECTION_CHANGE_INTERVAL, CRITICAL_DANGER_RADIUS -> config.js AUTO_HUNT 연동
- [x] CRITICAL_DANGER_RADIUS를 AUTO_HUNT.dangerRadius / 2로 동적 계산
- [x] config.js AUTO_HUNT 블록에 6개 신규 설정값 추가 (consumableSearchRadius, weaponDropSearchRadius, weaponDropUrgentLifetime, weaponDropScoreMultiplier, consumableScoreMultiplier, xpGemScoreMultiplier)
- [x] 신규 메서드 4개: _evaluateWeaponDropUrgent(), _evaluateWeaponDrop(), _evaluateConsumable(), _hasCriticalDanger()
- [x] 풀 undefined 시 null 반환으로 안전 처리 (4개 메서드 모두)
- [x] REACTION_MISS_CHANCE, IMPERFECTION_ANGLE 미변경 (제약사항 준수)
- [x] Playwright 29/29 테스트 전체 통과

### 무기별 결과 리포트 -- 완료 (2026-03-09)
- [x] WeaponSystem.weaponStats Map으로 무기별 킬/데미지 추적
- [x] recordDamage() / recordKill() 메서드 구현
- [x] 7개 데미지 경로(projectile/beam/orbital/chain/homing/summon/aoe)에서 weaponId 전달 및 recordDamage 호출
- [x] Projectile.weaponId / Enemy._lastHitWeaponId 필드 추가
- [x] GameScene._buildWeaponReport() 구현 (DPS 계산, 진화 무기 nameKey, 데미지 순 정렬)
- [x] ResultScene._renderWeaponReport() 구현 (무기명, 킬 수, DPS, 데미지 비율 바, 최대 6개)
- [x] 하단 버튼 동적 Y좌표 계산 (레이아웃 겹침 수정)
- [x] _goToResult(), 일시정지 포기 (일반/엔들리스) 3개 경로에서 weaponReport 전달
- [x] i18n 3키 추가 (result.weaponReport/weaponKills/weaponDps, ko/en 총 351키 -> 375키)

### 아트 Phase 1 (DALL-E 픽셀아트) -- 대체됨 (2026-03-10 글로우 벡터로 전면 교체)
- [x] *(대체됨)* DALL-E 3 픽셀아트 15종 -> 글로우 벡터 20종으로 전면 교체

### 스프라이트 스케일 -- 대체됨 (2026-03-10 SPRITE_SCALE=2 -> 1로 변경)
- [x] *(대체됨)* SPRITE_SCALE = 2 -> 벡터 에셋 전환으로 SPRITE_SCALE = 1

### 인게임 인벤토리 HUD -- 완료 (2026-03-09)
- [x] WEAPON_ICON_MAP 상수 추가 (10종 무기 ID -> 이모지 매핑 + WEAPON_ICON_FALLBACK)
- [x] getPassiveById import 추가
- [x] _createHUD() 내 _inventoryHUD 초기화 및 _refreshInventoryHUD() 초기 호출
- [x] onLevelUp() levelupDone 핸들러에 _refreshInventoryHUD() 호출 추가 (_tryEvolutionCheck 이후)
- [x] _refreshInventoryHUD() 신규 메서드 구현 (무기 행 Y=560 + 패시브 행 Y=594, destroy-rebuild 방식)
- [x] 무기 슬롯: 32x32, stride 60px, 최대 6개, 레벨 색상 xpYellow
- [x] 패시브 슬롯: 28x28, stride 36px, 최대 10개, 레벨 색상 neonCyan
- [x] 진화 무기 아이콘 자동 교체 (w._evolvedId 기반)
- [x] setScrollFactor(0) + depth 105~107로 카메라 고정
- [x] 이벤트 기반 갱신 (매 프레임 갱신 없음)

### 아트 Phase 2 (DALL-E 보스 픽셀아트) -- 대체됨 (2026-03-10 글로우 벡터로 전면 교체)
- [x] *(대체됨)* DALL-E 3 보스/미니보스 스프라이트시트 -> 글로우 벡터 정적 이미지로 전면 교체

### 글로우 벡터 아트 Phase 1: 20종 벡터 스프라이트 전면 교체 -- 완료 (2026-03-10)
- [x] GPT Image API(gpt-image-1) 스프라이트 생성 스크립트 (`scripts/generate-vector-sprites.js`) 재작성 *(초기 SVG 코드 생성 방식에서 GPT Image API 호출 방식으로 전환)*
- [x] 20종 엔티티 벡터 PNG 생성: player(48x48), projectile(12x12), 잡몹 10종(32~48px), 미니보스 2종(80x80), 보스 3종(128x128), XP 보석 3종(12/20/28px)
- [x] Phaser render 설정 변경: `pixelArt: false`, `antialias: true` (`js/main.js`)
- [x] `SPRITE_SCALE = 1`로 변경 (`js/config.js`)
- [x] BootScene: spritesheet -> `this.load.image()` 20종 정적 이미지 로드 전환
- [x] BootScene: `_createAnimations()` 메서드 및 호출 완전 제거
- [x] Player.js: tween 아이들 맥동(800ms, scaleXY +-5%), body offset 재계산 (circle 12, offset 12)
- [x] Enemy.js: tween 아이들 맥동(보스 600ms/미니보스 700ms/잡몹 900ms), body offset 재계산, `_deactivate()`에서 killTweensOf
- [x] Projectile.js: body offset 재계산 (circle 4, offset 2)
- [x] XPGem.js: texSizes 갱신 (12/20/28px), body offset 재계산
- [x] 에셋 미존재 시 Graphics 플레이스홀더 폴백 동작 유지
- [x] ART_CONCEPT.md 색상 팔레트 및 글로우 필터 표준 준수
- [x] GPT Image API 투명 배경 지원 (`background: 'transparent'`) + 미지원 시 폴백 투명화(밝기 임계값 40)
- [x] API 호출 간 1초 대기(Rate Limit 대응), 개별 에셋 실패 시 스킵(기존 PNG 보존)
- [x] XP 보석 3종 SVG 직접 생성으로 변경 *(GPT Image API 1024px -> 12~28px 다운스케일 시 디테일 소실 버그 수정, `svgOverride` 플래그로 분기)*

### 플레이어 8방향 걷기 애니메이션 -- 완료 (2026-03-10) -> 캐릭터별 스프라이트로 확장
- [x] 걷기 애니메이션 스프라이트시트 생성 스크립트 (`scripts/generate-walk-anim.js`)
- [x] GPT Image API(gpt-image-1)로 5방향 x 4프레임 = 20개 PNG 생성 + 240x192 스프라이트시트 합성
- [x] BootScene: player_walk spritesheet 로드 + 5방향 anim 등록 (8fps, repeat:-1)
- [x] BootScene: player_walk 플레이스홀더 텍스처 (240x192 시안 원 격자)
- [x] Player._playWalkAnim(): atan2 기반 8방향 매핑, left 계열 3방향 flipX 미러링
- [x] Player._setIdleState(): 걷기 중단 + idle 텍스처 복귀 + idle tween 재개
- [x] idle tween pause/resume 전환 (이동 시 정지, 정지 시 재개)
- [x] 동일 방향 유지 시 play() 재호출 방지 (끊김 방지)
- [x] player_walk 미존재 시 플레이스홀더 폴백 동작
- [x] AutoPilot 모드 호환 (dirX/dirY 공유)
- [x] Playwright 24/24 테스트 전체 통과

### 캐릭터별 고유 스프라이트 + 8방향 걷기 애니메이션 -- 완료 (2026-03-10)
- [x] characters.js에 spriteKey 필드 추가 (agent='player', sniper='sniper', engineer='engineer', berserker='berserker', medic='medic', hidden='hidden')
- [x] generate-walk-anim.js 다중 캐릭터 생성 지원 (CHARACTER_DEFS 맵, --char 옵션)
- [x] 5종 캐릭터 idle 스프라이트 GPT Image API 생성 (각 48x48)
- [x] 5종 캐릭터 walk 스프라이트시트 GPT Image API 생성 (각 240x192, 5방향x4프레임)
- [x] BootScene: 5종 캐릭터 idle + walk 에셋 로드 (총 12개 에셋)
- [x] BootScene: 5종 캐릭터별 고유 색상 플레이스홀더 생성
- [x] BootScene: _registerWalkAnims()로 6종x5방향=30개 애니메이션 등록 (CHAR_ANIM_DEFS 배열)
- [x] Player constructor: characterId 파라미터 추가, _idleTextureKey/_walkTextureKey/_walkAnimPrefix 동적 결정
- [x] Player._playWalkAnim(): this._walkAnimPrefix 기반 동적 animKey
- [x] Player._setIdleState(): this._idleTextureKey 기반 동적 idle 텍스처 복귀
- [x] GameScene: Player 생성 시 this.characterId 전달
- [x] agent 하위 호환 유지 (spriteKey='player', animPrefix='walk', 기존 에셋 재사용)
- [x] 에셋 미존재 시 캐릭터별 색상 플레이스홀더 폴백 동작
- [x] Playwright 46/46 테스트 전체 통과

### 소모성 아이템(Consumable) 6종 -- 완료 (2026-03-10)
- [x] 소모성 아이템 6종 데이터 정의 (`js/data/consumables.js`): CONSUMABLES 배열, CONSUMABLE_MAP
- [x] Consumable 엔티티 (`js/entities/Consumable.js`): ObjectPool 패턴, 10초 수명, 3초 깜빡임
- [x] config.js 소모성 아이템 상수 12개 추가
- [x] 적 사망 시 등급별(잡몹/미니보스/보스) 드롭률 적용 (`js/entities/Enemy.js`)
- [x] 잡몹 HP<=50% 시 나노 수리킷 드롭률 상승 (3%->8%)
- [x] 한 적에서 최대 1개만 드롭 (CONSUMABLES 배열 순서 판정, 성공 시 return)
- [x] nano_repair: HP +30 즉시 회복
- [x] mag_pulse: 맵 전체 XP 보석 즉시 흡수
- [x] emp_bomb: 화면 내(+50px 마진) 일반 적 즉사, 미니보스/보스 HP 20% 대미지
- [x] credit_chip: 크레딧 5~15 즉시 획득 (GameScene.addCredits + SaveManager.addCredits)
- [x] overclock: 5초간 이속 x1.5, 쿨다운 x0.7 (Player.applyOverclock)
- [x] shield_battery: 30초간 완전 무적 + 접촉 반사 대미지 5 (Player.applyShield)
- [x] 버프 중복 방지: 오버클럭/쉴드 활성 중 재수집 시 타이머만 리셋 (연장 불허, 스탯 이중 적용 없음)
- [x] 수집 VFX: 아이템별 색상 파티클 (VFXSystem.consumableCollect), EMP 화면 클리어 (VFXSystem.empBlast + 카메라 플래시)
- [x] BootScene: 6종 스프라이트 preload + 6종 플레이스홀더 텍스처
- [x] GameScene: consumablePool(초기 20개) 생성/overlap/update/destroy
- [x] i18n: 6종 이름+설명 ko/en 24키 추가 (총 375키)
- [x] 스프라이트 생성 스크립트 (`scripts/generate-consumable-sprites.js`) + 6종 PNG 생성 완료
- [x] Playwright 34/34 테스트 전체 통과
