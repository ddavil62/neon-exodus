# NEON EXODUS 아트 컨셉 문서

## 아트 방향: 네온 미니멀 픽셀

**스타일 키워드**: 미니멀 픽셀아트 + 네온 글로우 + 사이버펑크 기하학

현재 네온 팔레트와 Galmuri 픽셀 폰트의 감성을 살려, 최소한의 도트로 실루엣과 개성을 전달하는 **미니멀 픽셀아트** 스타일로 통일한다. 복잡한 디테일보다 깔끔한 형태 + 네온 발광 효과로 사이버펑크 분위기를 극대화한다.

---

## 디자인 원칙

### 1. 실루엣 우선
- 각 엔티티는 축소(8px)해도 구분 가능한 고유 실루엣을 가진다
- 잡몹 vs 미니보스 vs 보스는 크기 차이로 위협도를 직관적으로 전달

### 2. 네온 컬러 코드
- 기존 12색 팔레트를 유지하되, 스프라이트 외곽에 1px 글로우(밝은색) 적용
- 아군 = 시안/그린 계열, 적 = 레드/오렌지 계열, 보스 = 마젠타

### 3. 애니메이션 최소화
- 아이들 2프레임, 이동/공격 2~4프레임 이내
- 프레임 수를 줄이되 네온 깜빡임(flicker)으로 생동감 부여

### 4. 해상도 기준
| 엔티티 | 스프라이트 크기 | 비고 |
|--------|----------------|------|
| 플레이어 | 24x24px | 방향 표시 포함 |
| 잡몹 (소형) | 16x16px | nano_drone, spark_drone, shield_drone |
| 잡몹 (중형) | 20x20px | scout_bot, repair_bot, teleport_drone |
| 잡몹 (대형) | 24~32px | battle_robot, heavy_bot, rush_bot, suicide_bot |
| 미니보스 | 40x40px | guardian_drone, assault_mech |
| 보스 | 64x64px | commander, titan, core_processor |
| 투사체 | 6x6px ~ 8x8px | 무기별 차별화 |
| XP 보석 | 6/10/14px | 현재 다이아몬드 형태 유지 |
| 조이스틱 | 64x64 / 32x32 | 반투명 UI 오버레이 |

---

## 색상 팔레트

기존 네온 팔레트를 기반으로 스프라이트용 중간톤을 추가한다.

```
배경층     ██ #0A0A1A (BG)        ██ #060612 (BG_DARK)    ██ #1A1A2E (UI_PANEL)

네온 주색  ██ #00FFFF (CYAN)      ██ #FF00FF (MAGENTA)    ██ #39FF14 (GREEN)
네온 부색  ██ #FF6600 (ORANGE)    ██ #FF3333 (RED)        ██ #FFDD00 (YELLOW)

스프라이트  ██ #008888 (CYAN MID)   ██ #880088 (MAG MID)    ██ #1A8800 (GREEN MID)
중간톤     ██ #884400 (ORG MID)   ██ #881A1A (RED MID)    ██ #888800 (YLW MID)

하이라이트 ██ #FFFFFF (WHITE)     ██ #CCCCCC (LIGHT)
섀도우     ██ #222244 (SHADOW)    ██ #333344 (DISABLED)
```

---

## 에셋 총 목록 (교체 대상)

### 스프라이트 (27종)

| # | 텍스처 키 | 현재 | 목표 | Phase |
|---|-----------|------|------|-------|
| 1 | `player` | 시안 원+삼각 24x24 | 사이버 전사 정면/이동 24x24 | Phase 1 |
| 2 | `projectile` | 그린 원 6x6 | 에너지탄 도트 6x6 | Phase 1 |
| 3 | `enemy_nano_drone` | 빨강 원 16x16 | 작은 비행 드론 16x16 | Phase 1 |
| 4 | `enemy_scout_bot` | 주황 원 20x20 | 정찰 로봇 20x20 | Phase 1 |
| 5 | `enemy_spark_drone` | 노랑 원 16x16 | 전기 드론 16x16 | Phase 1 |
| 6 | `enemy_battle_robot` | 암적 원 28x28 | 전투 로봇 28x28 | Phase 1 |
| 7 | `enemy_shield_drone` | 파랑 원 20x20 | 방패 드론 20x20 | Phase 1 |
| 8 | `enemy_rush_bot` | 주황 원 24x24 | 돌격봇 24x24 | Phase 1 |
| 9 | `enemy_repair_bot` | 초록 원 20x20 | 수리 로봇 20x20 | Phase 1 |
| 10 | `enemy_heavy_bot` | 회색 원 32x32 | 중장갑봇 32x32 | Phase 1 |
| 11 | `enemy_teleport_drone` | 보라 원 20x20 | 순간이동 드론 20x20 | Phase 1 |
| 12 | `enemy_suicide_bot` | 빨강 원 24x24 | 자폭봇 (깜빡임) 24x24 | Phase 1 |
| 13 | `enemy_guardian_drone` | 오렌지 원 40x40 | 가디언 미니보스 40x40 | Phase 2 |
| 14 | `enemy_assault_mech` | 오렌지 원 40x40 | 어썰트 메카 40x40 | Phase 2 |
| 15 | `enemy_commander_drone` | 마젠타 원 64x64 | 커맨더 보스 64x64 | Phase 2 |
| 16 | `enemy_siege_titan` | 오렌지 원 64x64 | 시즈 타이탄 보스 64x64 | Phase 2 |
| 17 | `enemy_core_processor` | 마젠타 원 64x64 | 코어 프로세서 최종보스 64x64 | Phase 2 |
| 18 | `xp_gem_s` | 그린 다이아 6x6 | 데이터 파편 (소) 6x6 | Phase 1 |
| 19 | `xp_gem_m` | 시안 다이아 10x10 | 데이터 파편 (중) 10x10 | Phase 1 |
| 20 | `xp_gem_l` | 마젠타 다이아 14x14 | 데이터 파편 (대) 14x14 | Phase 1 |
| 21 | `bg_tile` | 그리드+리벳 64x64 | 사이버 바닥 타일 64x64 | Phase 3 |
| 22 | `particle` | 흰색 사각 4x4 | 유지 (색상은 코드에서 제어) | - |
| 23 | `joystick_base` | 반투명 원 64x64 | 홀로그램 원 UI 64x64 | Phase 3 |
| 24 | `joystick_thumb` | 시안 원 32x32 | 홀로그램 엄지 32x32 | Phase 3 |

### 무기 이펙트 (코드 기반, Phase 4)

| # | 무기 | 현재 | 목표 |
|---|------|------|------|
| 25 | 블래스터 | 6px 원 투사체 | 에너지 탄환 스프라이트 |
| 26 | 레이저건 | Graphics 직선 | 빔 스프라이트 (타일링) |
| 27 | 플라즈마 오브 | Graphics 원 | 에너지 구체 애니메이션 |
| 28 | 전기 체인 | Graphics 선+점 | 번개 스프라이트시트 |
| 29 | 미사일 | 임시 스프라이트 | 미사일 + 연기 트레일 |
| 30 | 드론 | Graphics 원 | 소형 드론 스프라이트 |
| 31 | EMP | 파티클 폭발 | EMP 파동 애니메이션 |

### UI 에셋 (Phase 3)

| # | 요소 | 현재 | 목표 |
|---|------|------|------|
| 32 | 메뉴 배경 | 단색 | 사이버 도시 실루엣 배경 |
| 33 | 버튼 | Graphics 사각형 | 네온 테두리 버튼 스프라이트 |
| 34 | 카드 배경 | Graphics 패널 | UI 카드 9-slice 스프라이트 |
| 35 | 아이콘 (무기 7종) | 없음 | 16x16 무기 아이콘 |
| 36 | 아이콘 (패시브 10종) | 이모지 텍스트 | 16x16 패시브 아이콘 |
| 37 | 아이콘 (업그레이드) | 없음 | 16x16 업그레이드 아이콘 |

---

## 제작 Phase

### Phase 1: 플레이어 + 잡몹 + 수집물 (핵심 게임플레이)
> **우선순위 최고** — 가장 많이 보이는 요소

- [ ] 플레이어 스프라이트 (24x24, 아이들 2F + 이동 2F)
- [ ] 잡몹 10종 스프라이트 (각 크기별, 아이들 2F)
- [ ] 투사체 스프라이트 (6x6)
- [ ] XP 보석 3종 (데이터 파편)
- [ ] BootScene 텍스처 생성 → 이미지 로드 방식 전환

**산출물**: `assets/sprites/` 디렉토리, BootScene의 preload() 수정
**예상 에셋 수**: 16종

### Phase 2: 보스 + 미니보스 (위협감 연출)
> 보스전의 임팩트를 높이는 단계

- [ ] 미니보스 2종 (40x40, 아이들 2F)
- [ ] 보스 3종 (64x64, 아이들 2F + 특수 패턴 2F)
- [ ] 보스 등장 연출 효과

**산출물**: 보스 스프라이트 5종
**예상 에셋 수**: 5종

### Phase 3: UI + 배경 (폴리싱)
> 전체적인 완성도를 높이는 단계

- [ ] 배경 타일 (64x64 사이버 바닥)
- [ ] 메뉴 배경 (사이버 도시 실루엣)
- [ ] 조이스틱 UI (홀로그램 스타일)
- [ ] 버튼 / 카드 / 패널 UI 스프라이트
- [ ] 무기 아이콘 7종 (16x16)
- [ ] 패시브 아이콘 10종 (16x16)
- [ ] 업그레이드 아이콘 (카테고리별)

**산출물**: UI 스프라이트시트, 배경 에셋
**예상 에셋 수**: ~25종

### Phase 4: 무기 이펙트 + 애니메이션 (최종 폴리싱)
> Graphics 코드를 스프라이트 기반으로 교체

- [ ] 블래스터 탄환 애니메이션
- [ ] 레이저 빔 스프라이트
- [ ] 플라즈마 오브 회전 애니메이션
- [ ] 전기 체인 번개 스프라이트
- [ ] 미사일 + 연기 트레일
- [ ] 드론 스프라이트 (미니 비행체)
- [ ] EMP 파동 애니메이션
- [ ] VFX 파티클 개선

**산출물**: 무기 이펙트 스프라이트시트
**예상 에셋 수**: ~10종

---

## 기술 통합 계획

### 현재 (프로시저럴)
```
BootScene.create() → Graphics API → generateTexture('player', 24, 24)
```

### 목표 (에셋 로드)
```
BootScene.preload() → this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 24, frameHeight: 24 })
BootScene.create() → this.anims.create({ key: 'player_idle', ... })
```

### 전환 전략
1. `assets/sprites/` 디렉토리에 PNG 파일 배치
2. `BootScene.preload()`에서 `this.load.image()` 또는 `this.load.spritesheet()` 추가
3. 기존 `_generatePlaceholderTextures()`에서 해당 텍스처 키가 이미 로드되었으면 스킵 (`this.textures.exists()` 이미 적용됨)
4. 점진적 교체 — 에셋이 준비된 것부터 하나씩 교체 가능

### 파일 구조
```
assets/
├── sprites/
│   ├── player.png              (24x24, 스프라이트시트)
│   ├── enemies/
│   │   ├── nano_drone.png      (16x16)
│   │   ├── scout_bot.png       (20x20)
│   │   └── ...
│   ├── bosses/
│   │   ├── commander_drone.png (64x64)
│   │   └── ...
│   ├── items/
│   │   ├── xp_gem_s.png        (6x6)
│   │   └── ...
│   └── weapons/
│       ├── blaster_projectile.png
│       └── ...
├── ui/
│   ├── button.png              (9-slice)
│   ├── card.png                (9-slice)
│   ├── icons/
│   │   ├── weapon_blaster.png  (16x16)
│   │   ├── passive_booster.png (16x16)
│   │   └── ...
│   └── joystick/
│       ├── base.png            (64x64)
│       └── thumb.png           (32x32)
└── backgrounds/
    ├── bg_tile.png             (64x64)
    └── menu_bg.png             (360x640)
```

---

## 참고: 캐릭터 6종 시각적 차별화 방안

| 캐릭터 | 기본색 | 실루엣 특징 | 구분 포인트 |
|--------|--------|------------|------------|
| Agent | 시안 | 기본 전사 | 밸런스형 체형 |
| Sniper | 그린 | 가늘고 긴 체형 | 스코프/조준기 |
| Engineer | 오렌지 | 둥근 체형 + 공구 | 렌치/장비 |
| Berserker | 레드 | 큰 체형 + 장갑 | 붉은 글로우 |
| Medic | 화이트/그린 | 십자 마크 | 회복 심볼 |
| Weapon Master | 마젠타 | 다수 무기 실루엣 | 복합 장비 |

> 캐릭터별 전용 스프라이트는 Phase 1 이후 별도 논의.
> 초기에는 색상 틴트(tint)로 캐릭터를 구분하는 것도 가능.

---

## 일정 추정

| Phase | 에셋 수 | 예상 소요 | 누적 |
|-------|---------|----------|------|
| Phase 1 | 16종 | 제작 방식에 따라 상이 | - |
| Phase 2 | 5종 | - | - |
| Phase 3 | ~25종 | - | - |
| Phase 4 | ~10종 | - | - |
| **합계** | **~56종** | - | - |

> 일정은 제작 방식(직접 도트 작업 / AI 생성 / 외주)에 따라 크게 달라짐.

---

*최종 수정: 2026-03-09*
