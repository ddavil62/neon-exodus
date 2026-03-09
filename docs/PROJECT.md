# NEON EXODUS (네온 엑소더스) 기획서

> 최종 업데이트: 2026-03-09 (무기별 결과 리포트)

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
│   ├── config.js                  # 게임 상수, 밸런스 수치
│   ├── i18n.js                    # 한국어/영어 번역
│   ├── main.js                    # Phaser 게임 인스턴스 생성
│   ├── scenes/
│   │   ├── BootScene.js           # 에셋 로드(Phase 1 스프라이트 15종), 플레이스홀더 폴백, 애니메이션 등록, SoundSystem 초기화
│   │   ├── MenuScene.js           # 메인 메뉴 (출격, 업그레이드, 도전과제, 도감, BGM, 자동 사냥 구매)
│   │   ├── CharacterScene.js      # 캐릭터 선택 화면 (해금/잠금, 고유 패시브)
│   │   ├── GameScene.js           # 핵심 게임플레이 (전투, HUD, 일시정지, 부활, 진화, 엔들리스 모드, SFX/VFX, AutoPilot)
│   │   ├── LevelUpScene.js        # 레벨업 3택 오버레이 (리롤, 새 무기 획득, weaponChoiceBias)
│   │   ├── ResultScene.js         # 결과/보상 화면 (크레딧/통계 저장, 엔들리스 모드 결과)
│   │   ├── UpgradeScene.js        # 영구 업그레이드 구매 UI (4탭 카드 그리드)
│   │   ├── AchievementScene.js    # 도전과제 목록 화면 (13개, 진행률)
│   │   └── CollectionScene.js     # 도감 화면 (4탭: 무기/패시브/적/도전과제)
│   ├── entities/
│   │   ├── Player.js              # 플레이어 (이동, HP/XP, 레벨업, 메타 업그레이드)
│   │   ├── Enemy.js               # 적 기본 클래스 (초기화, 이동, 데미지, 사망)
│   │   ├── EnemyTypes.js          # 적 유형별 AI 15종
│   │   ├── Projectile.js          # 투사체 (발사, 피격, 관통)
│   │   └── XPGem.js               # XP 보석 (소/중/대, 자석 흡수, 소멸)
│   ├── systems/
│   │   ├── ObjectPool.js          # Phaser Group 기반 오브젝트 풀
│   │   ├── VirtualJoystick.js     # 가상 조이스틱 (데드존 8px, 최대반경 50px)
│   │   ├── WeaponSystem.js        # 무기 관리, 자동 발사 (7종 타입: projectile/beam/orbital/chain/homing/summon/aoe)
│   │   ├── WaveSystem.js          # 적 스폰 웨이브 관리, 엔들리스 모드 스케일링
│   │   ├── SoundSystem.js         # AudioContext 프로그래매틱 SFX 9종 + BGM 2곡
│   │   ├── VFXSystem.js           # Phaser Particles 기반 VFX 6종
│   │   └── AutoPilotSystem.js     # 자동 사냥 AI 이동 시스템 (위험 회피 > XP 수집 > 적 접근 > 방랑)
│   ├── managers/
│   │   ├── SaveManager.js         # 로컬스토리지 세이브/로드
│   │   ├── MetaManager.js         # 영구 업그레이드 관리
│   │   ├── AchievementManager.js  # 도전과제 추적/보상
│   │   └── IAPManager.js          # Google Play IAP 관리 (구매/복원, Mock 모드)
│   └── data/
│       ├── weapons.js             # 무기 7종 (블래스터/레이저건/플라즈마 오브/전기 체인/미사일/드론/EMP 각 Lv1~8) + 진화 무기 3종
│       ├── enemies.js             # 잡몹 10종 + 미니보스 2종 + 보스 3종
│       ├── passives.js            # 패시브 아이템 10종
│       ├── waves.js               # 스폰 테이블 6구간 + 미니보스/보스 스케줄
│       ├── upgrades.js            # 영구 업그레이드 22종
│       ├── characters.js          # 캐릭터 6종
│       └── achievements.js        # 도전과제 13종
├── assets/
│   └── sprites/                   # Phase 1 스프라이트 에셋 (DALL-E 3 생성)
│       ├── player.png             # 플레이어 스프라이트시트 (48x24, 2F)
│       ├── projectile.png         # 투사체 정적 이미지 (6x6)
│       ├── enemies/               # 잡몹 10종 스프라이트시트 (각 2F 가로배치)
│       │   ├── nano_drone.png     # 32x16
│       │   ├── scout_bot.png      # 40x20
│       │   ├── spark_drone.png    # 32x16
│       │   ├── battle_robot.png   # 56x28
│       │   ├── shield_drone.png   # 40x20
│       │   ├── rush_bot.png       # 48x24
│       │   ├── repair_bot.png     # 40x20
│       │   ├── heavy_bot.png      # 64x32
│       │   ├── teleport_drone.png # 40x20
│       │   └── suicide_bot.png    # 48x24
│       └── items/                 # XP 보석 3종 정적 이미지
│           ├── xp_gem_s.png       # 6x6
│           ├── xp_gem_m.png       # 10x10
│           └── xp_gem_l.png       # 14x14
├── scripts/
│   ├── build.js                   # www/ 디렉토리 빌드 스크립트
│   └── generate-sprites.js        # DALL-E 3 API 스프라이트 생성 스크립트
├── tests/
│   ├── phase1-integration.spec.js # Phase 1 통합 테스트
│   ├── phase2-qa.spec.js          # Phase 2 QA 테스트
│   ├── phase3.spec.js             # Phase 3 QA 테스트 (12개)
│   ├── phase3-crit.spec.js        # Phase 3 치명타 시스템 전용 테스트 (7개)
│   ├── phase4.spec.js             # Phase 4 QA 테스트 (27개)
│   ├── auto-hunt.spec.js          # 자동 사냥 QA 테스트 (29개)
│   ├── phase1-art-qa.spec.js     # Phase 1 아트 QA 테스트 (22개)
│   ├── weapon-report.spec.js     # 무기별 결과 리포트 테스트 (28개)
│   └── weapon-report-layout.spec.js # 무기 리포트 레이아웃 테스트 (11개)
└── docs/
    ├── PROJECT.md                 # 이 문서
    ├── CHANGELOG.md               # 변경 이력
    └── ART_CONCEPT.md             # 아트 컨셉/에셋 목록/Phase 계획
```

### 씬 흐름

```
BootScene → MenuScene ─→ CharacterScene ─→ GameScene ↔ LevelUpScene
               │                               ↓
               ├── UpgradeScene           ← ResultScene
               ├── AchievementScene
               └── CollectionScene
```

### 핵심 모듈

| 모듈 | 파일 | 역할 |
|---|---|---|
| 게임 설정 | `js/config.js` | 해상도, 월드, 밸런스 상수 일괄 관리 |
| 다국어 | `js/i18n.js` | ko/en 351키, `t()` 함수로 참조 |
| 게임 씬 | `js/scenes/GameScene.js` | 월드/카메라/물리, 시스템 연동, HUD, 일시정지 |
| 플레이어 | `js/entities/Player.js` | 조이스틱 이동, HP/XP/레벨업, 메타 업그레이드 반영 |
| 적 시스템 | `js/entities/Enemy.js` + `EnemyTypes.js` | 15종 적 행동 패턴 |
| 무기 | `js/systems/WeaponSystem.js` | 자동 발사(투사체/빔/오비탈/체인/호밍/소환/범위), 치명타 판정, 무기 진화, 드론 AI |
| 스폰 | `js/systems/WaveSystem.js` | 시간대별 스폰, 미니보스/보스 스케줄, 엔들리스 모드 스케일링 |
| 사운드 | `js/systems/SoundSystem.js` | AudioContext 프로그래매틱 SFX 9종 + BGM 2곡 |
| VFX | `js/systems/VFXSystem.js` | Phaser Particles 기반 시각 효과 6종 |
| 세이브 | `js/managers/SaveManager.js` | 로컬스토리지 영구 저장, 크레딧/통계/도감 관리 |
| 업그레이드 | `js/scenes/UpgradeScene.js` | 4탭 카드 그리드 영구 업그레이드 구매/다운그레이드 UI |
| 캐릭터 선택 | `js/scenes/CharacterScene.js` | 캐릭터 선택, 해금 조건 검사 |
| 도전과제 | `js/scenes/AchievementScene.js` | 13개 도전과제 목록, 진행률 표시 |
| 도감 | `js/scenes/CollectionScene.js` | 4탭 도감 (무기/패시브/적/도전과제) |
| 자동 사냥 AI | `js/systems/AutoPilotSystem.js` | AI 자동 이동 (위험 회피 > XP 수집 > 적 접근 > 방랑) |
| IAP 관리 | `js/managers/IAPManager.js` | Google Play IAP 구매/복원, Mock 모드 |

## 기능 명세

### 조작 시스템

#### 가상 조이스틱
- 화면 아무 곳 터치 시 조이스틱 원점 생성
- 드래그 방향/거리로 이동 방향/속도 결정
- 데드존: 8px 이내 이동 무시
- 최대 반경: 50px
- 터치 종료 시 조이스틱 사라짐, 캐릭터 정지
- 관련 파일: `js/systems/VirtualJoystick.js`
- 구현 일자: 2026-03-08

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

- 빔은 Phaser Graphics 선분으로 렌더링 (매 프레임 clear + 재그리기)
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

- 오브는 Phaser Graphics 원으로 렌더링, 플레이어 중심으로 공전 (ORBIT_RADIUS = 70px 고정)
- tickInterval마다 orbRadius 내 적에게 tickDamage 적용 (attackMultiplier 반영)
- 레벨업으로 orbCount 증가 시 오브 배열 재구성
- 시각적 오브 크기는 8px 고정 (orbRadius는 데미지 판정 범위)
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
- 시각 효과: Phaser Graphics 지그재그 번개 선 (150ms 후 자동 파괴)
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
- 시각 효과: Phaser Graphics 원형 섬광 (200ms)
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
- 관련 파일: `js/data/enemies.js`, `js/entities/Enemy.js`, `js/entities/EnemyTypes.js`
- 구현 일자: 2026-03-08

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
- 관련 파일: `js/entities/XPGem.js`, `js/scenes/LevelUpScene.js`
- 구현 일자: 2026-03-08 (Phase 2 확장: 2026-03-09)

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
| 캐릭터 | 시작 무기 | 고유 패시브 | 해금 조건 | Phase |
|---|---|---|---|---|
| 에이전트 | blaster | 없음 | 기본 제공 | 1 |
| 스나이퍼 | laser_gun | critDamageMultiplier +0.30 | totalKills >= 5000 | 3 |
| 엔지니어 | drone | droneSummonBonus +1 (드론 수 +1) | totalClears >= 10 | 3 |
| 버서커 | electric_chain | HP 50% 이하 시 공격력 +40% | totalBossKills >= 10 | 3 |
| 메딕 | blaster | hpRegenMultiplier x2.0, maxHp -30% | totalSurviveMinutes >= 500 | 4 |
| ??? (Weapon Master) | blaster | 무기 슬롯 +2, 무기 등장 확률 x2 | sniper+engineer+berserker 모두 해금 | 4 |

- CharacterScene: MenuScene에서 출격 버튼 클릭 시 이동. 캐릭터 목록을 세로 스크롤로 표시
- 잠금 캐릭터는 alpha 0.4, 선택 캐릭터는 neonCyan 테두리 하이라이트
- 선택 후 출격 버튼으로 GameScene 시작 (characterId 전달)
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
1. **위험 회피** (evade): 반경 120px 내 적이 3마리 이상이거나, 60px 내 적이 있으면 반대 방향으로 회피. 거리 기반 가중 반발 벡터 사용.
2. **XP 보석 수집** (collect): 200px 이내 XP 보석 중 (xpValue/거리) 점수가 가장 높은 보석 방향으로 이동. 자석 반경 내 보석은 무시.
3. **적 접근** (approach): 가장 가까운 적이 150px 이상 떨어져 있으면 접근하여 무기 사거리를 유지.
4. **방랑** (idle): 위 행동이 불필요하면 월드 중앙 경향 + 랜덤 방향 혼합 이동.

#### AI 파라미터 (소스 코드 검증 기준)
| 파라미터 | 값 | 위치 |
|---|---|---|
| 위험 감지 반경 | 120px | `AutoPilotSystem.js` DANGER_RADIUS |
| 심각한 위험 반경 | 60px | `AutoPilotSystem.js` CRITICAL_DANGER_RADIUS |
| XP 보석 탐색 반경 | 200px | `AutoPilotSystem.js` XP_SEARCH_RADIUS |
| 적 접근 유지 거리 | 150px | `AutoPilotSystem.js` PREFERRED_ENEMY_DISTANCE |
| 벽 회피 마진 | 80px | `AutoPilotSystem.js` WALL_MARGIN |
| 방향 전환 간격 | 150ms | `AutoPilotSystem.js` DIRECTION_CHANGE_INTERVAL |
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

- 관련 파일: `js/systems/AutoPilotSystem.js`, `js/scenes/GameScene.js`, `js/entities/Player.js`
- 구현 일자: 2026-03-09
- 스펙 문서: `.claude/specs/2026-03-09-auto-hunt.md`

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

#### 일시정지 오버레이
- 반투명 배경, 계속/포기 버튼

#### 레벨업 오버레이
- 3택 카드 (아이콘 + 이름 + 효과 + 레벨)
- 무기 레벨업 / 패시브 획득 / 패시브 레벨업 / 새 무기 획득 카드
- 리롤 버튼 (메타 업그레이드 연동, rerollsLeft 기반)

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
3. **BootScene 플레이스홀더 텍스처**: Phase 1에서 player/projectile/잡몹 10종/XP 보석 3종은 정식 PNG로 전환 완료. 미니보스/보스/UI 등은 여전히 플레이스홀더 텍스처 사용. `_temp` 텍스처 코드는 전부 제거됨.
4. **체인 무기 초기 타겟 탐색 범위 하드코딩**: `WeaponSystem.js` findClosestEnemy에 300px 하드코딩. chainRange(120~200px)는 체인 연결 거리이고 초기 타겟 탐색은 별도 범위. 기능 문제 없으나 상수화 권장.
5. **부활 시 HP 직접 대입**: 스펙은 `player.heal(maxHp * 0.5)`이나, 실제 구현은 `player.currentHp = Math.floor(maxHp * 0.5)` 직접 대입. 동작에 문제 없으나 스펙과 불일치.
6. **CollectionScene ENEMY_IDS 하드코딩**: 적 ID 15개가 하드코딩. 신규 적 추가 시 수동 업데이트 필요.
6. **MetaManager/Player 이중 경로**: GameScene에서 MetaManager.getPlayerBonuses()와 SaveManager.getUpgradeLevel()을 별도로 호출. 동일 데이터 소스이므로 현재 문제 없으나, 보너스 계산 공식 변경 시 불일치 위험.
7. **consecutiveClears 직접 조작**: SaveManager.updateStats() 로직에 맞지 않아 data.stats를 직접 조작. SaveManager에 setStats() 메서드 추가 권장.
8. **오브 시각적 크기 고정**: 플라즈마 오브의 시각적 크기가 8px로 고정되어 orbRadius(55~90px)와 불일치. orbRadius는 데미지 판정 범위.
9. **AutoPilotSystem AUTO_HUNT import 미사용**: config.js에서 AUTO_HUNT를 import하지만 내부 로컬 상수(DANGER_RADIUS 등)를 사용. 값은 동일하므로 기능 문제 없으나, config 변경 시 반영이 안 되는 리스크. import 제거 또는 로컬 상수 제거 권장.
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

### 무기별 결과 리포트 -- 완료 (2026-03-09)
- [x] WeaponSystem.weaponStats Map으로 무기별 킬/데미지 추적
- [x] recordDamage() / recordKill() 메서드 구현
- [x] 7개 데미지 경로(projectile/beam/orbital/chain/homing/summon/aoe)에서 weaponId 전달 및 recordDamage 호출
- [x] Projectile.weaponId / Enemy._lastHitWeaponId 필드 추가
- [x] GameScene._buildWeaponReport() 구현 (DPS 계산, 진화 무기 nameKey, 데미지 순 정렬)
- [x] ResultScene._renderWeaponReport() 구현 (무기명, 킬 수, DPS, 데미지 비율 바, 최대 6개)
- [x] 하단 버튼 동적 Y좌표 계산 (레이아웃 겹침 수정)
- [x] _goToResult(), 일시정지 포기 (일반/엔들리스) 3개 경로에서 weaponReport 전달
- [x] i18n 3키 추가 (result.weaponReport/weaponKills/weaponDps, ko/en 총 351키)

### 아트 Phase 1: 스프라이트 에셋 전환 -- 완료 (2026-03-09)
- [x] DALL-E 3 API 에셋 생성 스크립트 (`scripts/generate-sprites.js`)
- [x] 스프라이트 에셋 15종 생성 및 `assets/sprites/` 배치 (player, projectile, 잡몹 10종, XP 보석 3종)
- [x] BootScene.preload()에 스프라이트/이미지 로드 추가
- [x] BootScene._createAnimations() 신규 추가 (player_idle 4fps, 잡몹 10종 idle 3fps, 각 2프레임)
- [x] Player.js: player_temp 제거, 'player' 키 + player_idle 애니메이션 재생
- [x] Projectile.js: projectile_temp 제거, 'projectile' 키 사용, COLORS import 정리
- [x] XPGem.js: xpgem_temp/GEM_COLORS/GEM_SIZES 제거, spawn()에서 setTexture 전환 방식
- [x] Enemy.js: enemy_temp 제거, init()에서 textures.exists 체크 후 setTexture/애니메이션, 폴백 분기 유지
- [x] 에셋 미존재 시 플레이스홀더 폴백 동작 유지 (textures.exists 가드)
- [x] package.json devDependencies 추가 (dotenv, openai, sharp)
