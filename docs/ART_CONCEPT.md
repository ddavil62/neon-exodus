# NEON EXODUS 아트 컨셉 문서

## 아트 방향: GPT Image API 벡터 아트

**스타일 키워드**: GPT Image API + 클린 벡터 + 네온 발광(Glow) + 사이버펑크

OpenAI gpt-image-1 모델을 활용하여 클린 벡터 스타일의 사이버펑크 스프라이트를 생성한다. 매끄러운 외곽선과 네온 글로우 효과로 세련된 2D 게임 분위기를 극대화한다.

### 이전 방식 (폐기)
1. DALL-E 3 API + sharp 후처리 → 미니멀 픽셀아트 PNG (`pixelArt: true`)
2. Node.js SVG 코드 생성 → sharp PNG 변환 (기하학적 도형 조합)

### 현재 방식
- **OpenAI GPT Image API (gpt-image-1) → 투명 배경 PNG → sharp 리사이즈**
- `pixelArt: false`, `antialias: true`, `SPRITE_SCALE = 1`
- API에서 1024x1024 고품질 이미지 생성 후 목표 크기로 축소
- 투명 배경 지원 (background: 'transparent'), 미지원 시 자동 폴백 투명화

---

## 디자인 원칙

### 1. 실루엣 우선
- 각 엔티티는 축소해도 구분 가능한 고유 실루엣을 가진다
- 잡몹 vs 미니보스 vs 보스는 크기 + 글로우 강도로 위협도 전달

### 2. 네온 컬러 코드
- 아군 = 시안/그린 계열, 적 = 레드/오렌지 계열, 보스 = 마젠타
- 모든 엔티티에 네온 글로우 효과 적용 (프롬프트에서 지시)

### 3. 글로우 레이어 구조
모든 에셋은 시각적으로 3개 레이어를 포함:
1. **코어 (Core)**: 밝은 중심부 — 주 색상
2. **바디 (Body)**: 중간 톤 — 그라데이션
3. **글로우 (Glow)**: 외곽 발광 — 네온 글로우 효과

### 4. 애니메이션 전략
- 프레임 기반 스프라이트시트 **제거** → **정적 이미지 1장**
- 생동감은 Phaser 코드 애니메이션으로 부여:
  - 아이들: `tween { scaleX/Y: ±0.05, yoyo, repeat: -1 }` (미세한 맥동)
  - 이동: 약간의 rotation oscillation
  - 보스: 글로우 레이어 alpha 깜빡임 (pulse)
- 장점: 에셋 용량 절감, 코드로 다양한 효과 제어 가능

### 5. 해상도 기준 (표시 크기 = 에셋 크기)

| 엔티티 | 에셋 크기 | 비고 |
|--------|----------|------|
| 플레이어 | 48x48px | 기존 24x24 × SCALE 2 = 48px |
| 잡몹 (소형) | 32x32px | nano_drone, scout_bot, spark_drone, shield_drone, repair_bot, teleport_drone |
| 잡몹 (중형) | 40x40px | rush_bot, suicide_bot |
| 잡몹 (대형) | 48x48px | battle_robot, heavy_bot |
| 미니보스 | 80x80px | guardian_drone, assault_mech |
| 보스 | 128x128px | commander, titan, core_processor |
| 투사체 | 12x12px | 기존 6x6 × SCALE 2 = 12px |
| XP 보석 | 12/20/28px | 소/중/대 |
| 조이스틱 | 128x128 / 64x64 | 반투명 UI 오버레이 |

---

## 색상 팔레트

기존 네온 팔레트를 유지하고, 벡터용 그라데이션 쌍을 추가한다.

```
배경층     #0A0A1A (BG)        #060612 (BG_DARK)    #1A1A2E (UI_PANEL)

네온 주색  #00FFFF (CYAN)      #FF00FF (MAGENTA)    #39FF14 (GREEN)
네온 부색  #FF6600 (ORANGE)    #FF3333 (RED)        #FFDD00 (YELLOW)

그라데이션 쌍 (벡터 전용)
  시안:    #00FFFF → #006688 (코어 → 엣지)
  마젠타:  #FF00FF → #660066 (코어 → 엣지)
  그린:    #39FF14 → #0A6600 (코어 → 엣지)
  오렌지:  #FF6600 → #663300 (코어 → 엣지)
  레드:    #FF3333 → #661414 (코어 → 엣지)

하이라이트 #FFFFFF (WHITE)     #CCCCCC (LIGHT)
섀도우     #222244 (SHADOW)    #333344 (DISABLED)
```

### 글로우 필터 표준 정의

```svg
<filter id="neon-glow">
  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
  <feComposite in="SourceGraphic" in2="blur" operator="over" />
</filter>
```

- 소형 엔티티: `stdDeviation="1.5"`
- 중/대형 엔티티: `stdDeviation="2"`
- 보스: `stdDeviation="3"` (강한 글로우)

---

## 에셋 총 목록 (벡터 교체 대상)

### 캐릭터 + 적 스프라이트 (20종 — 전부 교체)

| # | 텍스처 키 | 이전 (픽셀) | 목표 (벡터) | 에셋 크기 | Phase |
|---|-----------|------------|------------|----------|-------|
| 1 | `player` | DALL-E 3 스프라이트시트 48x24 | 시안 글로우 전사, 둥근 헬멧+바이저, 어깨 패드 | 48x48 정적 | Phase 1 |
| 2 | `projectile` | DALL-E 3 정적 6x6 | 시안 에너지탄, 원형 코어 + 글로우 후광 | 12x12 정적 | Phase 1 |
| 3 | `enemy_nano_drone` | DALL-E 3 스프라이트시트 | 작은 삼각형 드론, 레드 코어, 2개 날개 | 32x32 정적 | Phase 1 |
| 4 | `enemy_scout_bot` | DALL-E 3 스프라이트시트 | 원형 바디 + 안테나, 오렌지 센서 아이 | 32x32 정적 | Phase 1 |
| 5 | `enemy_spark_drone` | DALL-E 3 스프라이트시트 | 전기 아크 장식, 옐로우 코어 + 글로우 스파크 | 32x32 정적 | Phase 1 |
| 6 | `enemy_battle_robot` | DALL-E 3 스프라이트시트 | 사각 바디 + 팔 2개, 레드 글로우 눈, 중장감 | 48x48 정적 | Phase 1 |
| 7 | `enemy_shield_drone` | DALL-E 3 스프라이트시트 | 육각형 실드 패널, 시안-레드 이중 글로우 | 32x32 정적 | Phase 1 |
| 8 | `enemy_rush_bot` | DALL-E 3 스프라이트시트 | 삼각 쐐기형, 오렌지 부스터 글로우, 날카로운 전면 | 40x40 정적 | Phase 1 |
| 9 | `enemy_repair_bot` | DALL-E 3 스프라이트시트 | 둥근 바디 + 십자 마크, 그린 힐링 글로우 | 32x32 정적 | Phase 1 |
| 10 | `enemy_heavy_bot` | DALL-E 3 스프라이트시트 | 넓은 직사각형, 두꺼운 장갑, 오렌지-레드 듀얼 코어 | 48x48 정적 | Phase 1 |
| 11 | `enemy_teleport_drone` | DALL-E 3 스프라이트시트 | 다이아몬드 형태, 마젠타 점멸 코어, 잔상 효과선 | 32x32 정적 | Phase 1 |
| 12 | `enemy_suicide_bot` | DALL-E 3 스프라이트시트 | 구형 바디 + 경고 삼각형, 레드-옐로우 맥동 코어 | 40x40 정적 | Phase 1 |
| 13 | `enemy_guardian_drone` | DALL-E 3 스프라이트시트 80x40 | 육각형 가디언, 회전 링 아머, 오렌지-레드 강한 글로우 | 80x80 정적 | Phase 1 |
| 14 | `enemy_assault_mech` | DALL-E 3 스프라이트시트 80x40 | 이족 메카, 넓은 어깨장갑, 다크레드 미사일 포드 | 80x80 정적 | Phase 1 |
| 15 | `enemy_commander_drone` | DALL-E 3 스프라이트시트 256x64 | 모선 드론, 왕관 안테나, 마젠타 코어, 궤도 링 | 128x128 정적 | Phase 1 |
| 16 | `enemy_siege_titan` | DALL-E 3 스프라이트시트 256x64 | 시즈 워커, 캐터필러, 포 팔, 오렌지-옐로우 포구 | 128x128 정적 | Phase 1 |
| 17 | `enemy_core_processor` | DALL-E 3 스프라이트시트 256x64 | AI 크리스탈 코어, 궤도 링 3중, 마젠타-화이트 맥동 | 128x128 정적 | Phase 1 |
| 18 | `xp_gem_s` | DALL-E 3 정적 6x6 | 작은 다이아몬드, 시안 글로우 | 12x12 정적 | Phase 1 |
| 19 | `xp_gem_m` | DALL-E 3 정적 10x10 | 중간 다이아몬드, 시안-그린 그라데이션 | 20x20 정적 | Phase 1 |
| 20 | `xp_gem_l` | DALL-E 3 정적 14x14 | 큰 다이아몬드, 다중 글로우 레이어 | 28x28 정적 | Phase 1 |

### UI + 배경 에셋 (Phase 2)

| # | 텍스처 키 | 현재 | 목표 (벡터) | 에셋 크기 |
|---|-----------|------|------------|----------|
| 21 | `bg_tile` | 프로시저럴 그리드 64x64 | 사이버 바닥 타일, 미세 그리드 + 네온 라인 | 128x128 |
| 22 | `particle` | 흰색 사각 4x4 | 유지 (색상은 코드에서 제어) | 4x4 |
| 23 | `joystick_base` | 프로시저럴 원 64x64 | 홀로그램 원, 동심원 글로우 | 128x128 |
| 24 | `joystick_thumb` | 프로시저럴 원 32x32 | 글로우 엄지, 시안 코어 | 64x64 |

### 무기 이펙트 (Phase 3 — 코드 기반)

| # | 무기 | 현재 | 목표 |
|---|------|------|------|
| 25 | 블래스터 | 6px 원 투사체 | 에너지 탄환 SVG |
| 26 | 레이저건 | Graphics 직선 | 빔 SVG (타일링) |
| 27 | 플라즈마 오브 | Graphics 원 | 에너지 구체 SVG + 회전 tween |
| 28 | 전기 체인 | Graphics 선+점 | 번개 SVG (세그먼트) |
| 29 | 미사일 | 임시 스프라이트 | 미사일 SVG + 연기 파티클 |
| 30 | 드론 | Graphics 원 | 소형 드론 SVG |
| 31 | EMP | 파티클 폭발 | EMP 파동 SVG + 스케일 tween |

### UI 에셋 (Phase 2)

| # | 요소 | 현재 | 목표 |
|---|------|------|------|
| 32 | 메뉴 배경 | 단색 | 사이버 도시 실루엣 SVG |
| 33 | 버튼 | Graphics 사각형 | 네온 테두리 버튼 SVG (9-slice) |
| 34 | 카드 배경 | Graphics 패널 | UI 카드 SVG (9-slice) |
| 35 | 아이콘 (무기 7종) | 이모지 텍스트 | 16x16 무기 아이콘 SVG |
| 36 | 아이콘 (패시브 10종) | 이모지 텍스트 | 16x16 패시브 아이콘 SVG |
| 37 | 아이콘 (업그레이드) | 없음 | 16x16 업그레이드 아이콘 SVG |

---

## 엔티티별 SVG 디자인 가이드

### 플레이어 (player)
- **형태**: 둥근 헬멧(원) + 어깨 패드(타원 2개) + 바이저(가로 직사각형)
- **코어 색**: `#00FFFF` (시안)
- **글로우**: 헬멧 주변 시안 글로우 `stdDeviation="2"`
- **특징**: 바이저에 밝은 화이트 하이라이트, 어깨에 그라데이션

### 잡몹 공통
- **코어 색**: `#FF3333` (레드) 또는 `#FF6600` (오렌지)
- **글로우**: `stdDeviation="1.5"` (소형), `"2"` (대형)
- **특징**: 각 잡몹마다 고유한 기본 도형 (삼각형, 원, 사각형, 육각형, 다이아몬드)

### 미니보스
- **코어 색**: `#FF6600` (오렌지)
- **글로우**: `stdDeviation="2.5"`, 이중 글로우 레이어
- **특징**: 잡몹보다 복잡한 도형 조합, 디테일 추가 (장갑판, 무기 마운트 등)

### 보스
- **코어 색**: `#FF00FF` (마젠타) + `#FFFFFF` 하이라이트
- **글로우**: `stdDeviation="3"`, 삼중 글로우 레이어 (코어 + 중간 + 외곽)
- **특징**: 가장 복잡한 구조, 궤도 링/크리스탈/에너지 필드 등 고유 장식 요소

### XP 보석
- **형태**: 다이아몬드(마름모) 형태 유지
- **코어 색**: `#00FFFF` → `#39FF14` 그라데이션 (크기에 따라 강도 증가)
- **글로우**: 소 `stdDeviation="1"`, 중 `"1.5"`, 대 `"2"`

### 투사체
- **형태**: 원형 코어 + 방사형 글로우
- **코어 색**: `#00FFFF` (시안)
- **글로우**: 강한 발광 `stdDeviation="2"` (작지만 밝게)

---

## 제작 Phase

### Phase 1: 전체 캐릭터 + 적 + 수집물 (20종 — GPT Image API로 재생성) -- 완료 (2026-03-10)
> **완료** — 기존 SVG 기하학 에셋 20종을 GPT Image API(gpt-image-1) 생성 벡터 아트로 교체

- [x] 플레이어 스프라이트 (48x48, 정적 PNG)
- [x] 잡몹 10종 스프라이트 (32~48px, 정적 PNG)
- [x] 미니보스 2종 (80x80, 정적 PNG)
- [x] 보스 3종 (128x128, 정적 PNG)
- [x] 투사체 스프라이트 (12x12, 정적 PNG)
- [x] XP 보석 3종 (12/20/28px, 정적 PNG)
- [x] Phaser config 변경: `pixelArt: false`, `antialias: true`
- [x] SPRITE_SCALE = 1로 변경 + 관련 코드 수정
- [x] BootScene 수정: 스프라이트시트 -> 정적 이미지 로드 전환
- [x] BootScene 수정: 프레임 animation -> Phaser tween 애니메이션 전환
- [x] Enemy.js, Player.js 등: 스케일/바디 오프셋 재계산

**산출물**: `assets/sprites/` 전체 PNG 교체 (20종), `scripts/generate-vector-sprites.js`
**생성 방식**: OpenAI GPT Image API (gpt-image-1) -> sharp 리사이즈 -> PNG 저장

### Phase 2: UI + 배경 (폴리싱)
> 전체적인 완성도를 높이는 단계

- [ ] 배경 타일 (128x128 사이버 바닥)
- [ ] 메뉴 배경 (사이버 도시 실루엣)
- [ ] 조이스틱 UI (홀로그램 스타일)
- [ ] 버튼 / 카드 / 패널 UI 스프라이트
- [ ] 무기 아이콘 7종 (16x16)
- [ ] 패시브 아이콘 10종 (16x16)
- [ ] 업그레이드 아이콘 (카테고리별)

**산출물**: UI 벡터 에셋, 배경 에셋
**예상 에셋 수**: ~25종

### Phase 3: 무기 이펙트 (최종 폴리싱)
> Graphics 코드를 SVG 스프라이트 기반으로 교체

- [ ] 블래스터 탄환 SVG
- [ ] 레이저 빔 SVG (타일링)
- [ ] 플라즈마 오브 SVG + 회전 tween
- [ ] 전기 체인 번개 SVG
- [ ] 미사일 SVG + 연기 파티클
- [ ] 드론 SVG (미니 비행체)
- [ ] EMP 파동 SVG + 스케일 tween
- [ ] VFX 파티클 개선

**산출물**: 무기 이펙트 벡터 에셋
**예상 에셋 수**: ~10종

---

## 기술 통합 계획

### Phaser Config 변경

```javascript
// main.js — 변경 전
pixelArt: true,
antialias: false,

// main.js — 변경 후
pixelArt: false,
antialias: true,
```

### SPRITE_SCALE 전환

```javascript
// config.js — 변경 전
export const SPRITE_SCALE = 2;

// config.js — 변경 후
export const SPRITE_SCALE = 1;
```

> 벡터 에셋은 최종 표시 크기로 직접 생성하므로 스케일 배율이 불필요하다.
> SPRITE_SCALE = 1로 변경하면 모든 엔티티의 body offset이 자동으로 정확해진다.

### 에셋 로드 방식 전환

```
변경 전 (스프라이트시트):
  this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 24, frameHeight: 24 })

변경 후 (정적 이미지):
  this.load.image('player', 'assets/sprites/player.png')
```

### 애니메이션 전환

```
변경 전 (프레임 기반):
  this.anims.create({ key: 'player_idle', frames: [...], frameRate: 3, repeat: -1 })
  entity.play('player_idle')

변경 후 (Phaser tween):
  this.tweens.add({
    targets: entity,
    scaleX: { from: 1.0, to: 1.05 },
    scaleY: { from: 1.0, to: 0.95 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  })
```

### 폴백 전략
- `_generatePlaceholderTextures()` 유지 — 벡터 PNG 미존재 시 기존 Graphics 폴백 동작
- `this.textures.exists(key)` 가드 그대로 유지

### GPT Image API → PNG 생성 파이프라인

```
scripts/generate-vector-sprites.js
  │
  ├── OpenAI GPT Image API 호출 (gpt-image-1, 1024x1024, 투명 배경)
  │   ├── 공통 스타일 프롬프트 + 개별 에셋 프롬프트 조합
  │   └── base64 응답 디코딩 → Buffer
  │
  ├── 투명 배경 확인 (폴백: 어두운 픽셀 임계값 투명화)
  │
  ├── sharp 리사이즈 (목표 크기, fit: contain, 투명 배경)
  │   └── sharp(imgBuffer).resize(finalW, finalH).png().toFile(outputPath)
  │
  └── assets/sprites/ 디렉토리에 저장
```

### 파일 구조

```
assets/
├── sprites/
│   ├── player.png              (48x48, 정적)
│   ├── projectile.png          (12x12, 정적)
│   ├── enemies/
│   │   ├── nano_drone.png      (32x32)
│   │   ├── scout_bot.png       (32x32)
│   │   ├── spark_drone.png     (32x32)
│   │   ├── battle_robot.png    (48x48)
│   │   ├── shield_drone.png    (32x32)
│   │   ├── rush_bot.png        (40x40)
│   │   ├── repair_bot.png      (32x32)
│   │   ├── heavy_bot.png       (48x48)
│   │   ├── teleport_drone.png  (32x32)
│   │   └── suicide_bot.png     (40x40)
│   ├── bosses/
│   │   ├── guardian_drone.png  (80x80)
│   │   ├── assault_mech.png    (80x80)
│   │   ├── commander_drone.png (128x128)
│   │   ├── siege_titan.png     (128x128)
│   │   └── core_processor.png  (128x128)
│   └── items/
│       ├── xp_gem_s.png        (12x12)
│       ├── xp_gem_m.png        (20x20)
│       └── xp_gem_l.png        (28x28)
├── ui/
│   ├── button.png              (9-slice)
│   ├── card.png                (9-slice)
│   ├── icons/
│   │   ├── weapon_blaster.png  (16x16)
│   │   ├── passive_booster.png (16x16)
│   │   └── ...
│   └── joystick/
│       ├── base.png            (128x128)
│       └── thumb.png           (64x64)
└── backgrounds/
    ├── bg_tile.png             (128x128)
    └── menu_bg.png             (360x640)
```

---

## 참고: 캐릭터 6종 시각적 차별화 방안

| 캐릭터 | 기본색 | 실루엣 특징 | 벡터 글로우 포인트 |
|--------|--------|------------|-------------------|
| Agent | 시안 | 기본 전사 | 헬멧 바이저 글로우 |
| Sniper | 그린 | 가늘고 긴 체형 | 스코프 발광 |
| Engineer | 오렌지 | 둥근 체형 + 공구 | 렌치/장비 글로우 |
| Berserker | 레드 | 큰 체형 + 장갑 | 전신 붉은 아우라 |
| Medic | 화이트/그린 | 십자 마크 | 회복 심볼 맥동 |
| Weapon Master | 마젠타 | 다수 무기 실루엣 | 복합 무기 글로우 |

> 초기에는 색상 틴트(tint)로 캐릭터를 구분하는 것도 가능.

---

## 일정 추정

| Phase | 에셋 수 | 상태 | 비고 |
|-------|---------|------|------|
| Phase 1 | 20종 | **완료** (2026-03-10) | 전체 캐릭터/적/수집물 벡터 교체 |
| Phase 2 | ~25종 | 미착수 | UI + 배경 |
| Phase 3 | ~10종 | 미착수 | 무기 이펙트 |
| **합계** | **~55종** | - | GPT Image API로 고품질 생성 가능 |

---

*최종 수정: 2026-03-10*
