# NEON EXODUS 아트 컨셉 문서

## 아트 방향: GPT Image API 벡터 아트

**스타일 키워드**: GPT Image API + 클린 벡터 + 네온 발광(Glow) + 사이버펑크

OpenAI gpt-image-1 모델을 활용하여 클린 벡터 스타일의 사이버펑크 스프라이트를 생성한다. 매끄러운 외곽선과 네온 글로우 효과로 세련된 2D 게임 분위기를 극대화한다.

### 이전 방식 (폐기)
1. DALL-E 3 API + sharp 후처리 → 미니멀 픽셀아트 PNG (`pixelArt: true`)
2. Node.js SVG 코드 생성 → sharp PNG 변환 (기하학적 도형 조합)

### 현재 방식 (하이브리드)
- **대형 에셋 (32px+, 17+6종)**: OpenAI GPT Image API (gpt-image-1) → 투명 배경 PNG → sharp 리사이즈
- **소형 에셋 (12~28px XP 보석 3종)**: SVG 코드 직접 생성 → sharp → PNG 변환
  - GPT Image API 1024x1024 이미지를 12~28px로 다운스케일하면 디테일이 소실되어 거의 투명해지는 문제 해결
  - `svgOverride: true` 플래그로 GPT API 호출과 SVG 직접 생성을 분기
  - `createGemSVG(size)`: 다이아몬드형 폴리곤 + 시안 코어 + 흰색 하이라이트 + feGaussianBlur 글로우
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
- 적/보스/투사체/XP 보석: 프레임 기반 스프라이트시트 **제거** → **정적 이미지 1장**
- 플레이어: 정지 시 정적 이미지 + tween 맥동, 이동 시 **8방향 걷기 스프라이트시트** (5방향 프레임 + 3방향 flipX 미러링)
- 생동감은 Phaser 코드 애니메이션으로 부여:
  - 아이들: `tween { scaleX/Y: ±0.05, yoyo, repeat: -1 }` (미세한 맥동)
  - 이동: 8방향 걷기 애니메이션 (spritesheet 프레임 기반, 8fps)
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
| 18 | `xp_gem_s` | DALL-E 3 정적 6x6 | 작은 다이아몬드, 시안 글로우 | 12x12 정적 | Phase 1 (SVG 직접 생성) |
| 19 | `xp_gem_m` | DALL-E 3 정적 10x10 | 중간 다이아몬드, 시안-그린 그라데이션 | 20x20 정적 | Phase 1 (SVG 직접 생성) |
| 20 | `xp_gem_l` | DALL-E 3 정적 14x14 | 큰 다이아몬드, 다중 글로우 레이어 | 28x28 정적 | Phase 1 (SVG 직접 생성) |

### UI + 배경 에셋 (Phase 2)

| # | 텍스처 키 | 현재 | 목표 (벡터) | 에셋 크기 |
|---|-----------|------|------------|----------|
| 21 | `bg_tile` | 프로시저럴 그리드 64x64 | 사이버 바닥 타일, 미세 그리드 + 네온 라인 | 128x128 |
| 22 | `particle` | 흰색 사각 4x4 | 유지 (색상은 코드에서 제어) | 4x4 |
| 23 | `joystick_base` | 프로시저럴 원 64x64 | 홀로그램 원, 동심원 글로우 | 128x128 |
| 24 | `joystick_thumb` | 프로시저럴 원 32x32 | 글로우 엄지, 시안 코어 | 64x64 |
| 38 | `consumable_nano_repair` | 24x24 PNG | 네온 그린 의료 십자 + 나노봇 | 48x48 |
| 39 | `consumable_mag_pulse` | 24x24 PNG | 시안 전자기 펄스 링 | 48x48 |
| 40 | `consumable_emp_bomb` | 24x24 PNG | 블루 EMP 폭발 | 48x48 |
| 41 | `consumable_credit_chip` | 24x24 PNG | 골드 육각형 크레딧 칩 | 48x48 |
| 42 | `consumable_overclock` | 24x24 PNG | 오렌지 번개+기어 | 48x48 |
| 43 | `consumable_shield_battery` | 24x24 PNG | 퍼플 에너지 쉴드 | 48x48 |

### 스테이지 에셋 (Phase 3 — 멀티 스테이지 시스템)

#### 스테이지별 배경 타일 (3종, 128x128 — S2~S4)

| # | 텍스처 키 | 현재 | 목표 (벡터) | 에셋 크기 |
|---|-----------|------|------------|----------|
| 44 | `bg_tile_s2` | 프로시저럴 그리드 (오렌지 계열) | 산업 지구 바닥 타일, 녹슨 금속 + 오렌지 네온 그리드 | 128x128 |
| 45 | `bg_tile_s3` | 프로시저럴 그리드 (퍼플 계열) | 서버 팜 바닥 타일, 데이터 회로 패턴 + 퍼플 네온 라인 | 128x128 |
| 46 | `bg_tile_s4` | 프로시저럴 그리드 (그린 계열) | 코어 바닥 타일, 에너지 그리드 + 그린 네온 맥동 | 128x128 |

#### 신규 보스 3종 (128x128)

| # | 텍스처 키 | 현재 | 목표 (벡터) | 에셋 크기 |
|---|-----------|------|------------|----------|
| 47 | `enemy_siege_titan_mk2` | 프로시저럴 원형 (오렌지) | 시즈 타이탄 Mk2, 강화 장갑 + 대형 캐넌, 오렌지-레드 글로우 | 128x128 |
| 48 | `enemy_data_phantom` | 프로시저럴 원형 (퍼플) | 데이터 팬텀, 반투명 유령체 + 디지털 글리치, 퍼플 잔상 효과 | 128x128 |
| 49 | `enemy_omega_core` | 프로시저럴 원형 (그린) | 오메가 코어, 다중 궤도 링 + 에너지 코어, 그린-화이트 맥동 | 128x128 |

#### 신규 무기 아이콘 4종 (32x32)

| # | 텍스처 키 | 현재 | 목표 (벡터) | 에셋 크기 |
|---|-----------|------|------------|----------|
| 50 | `icon_weapon_force_blade` | 미생성 (이모지 폴백) | 에너지 검 실루엣, 시안 글로우 블레이드 | 32x32 |
| 51 | `icon_weapon_nano_swarm` | 미생성 (이모지 폴백) | 나노봇 구름, 그린 입자 클러스터 | 32x32 |
| 52 | `icon_weapon_vortex_cannon` | 미생성 (이모지 폴백) | 블랙홀 소용돌이, 마젠타-시안 나선형 | 32x32 |
| 53 | `icon_weapon_reaper_field` | 미생성 (이모지 폴백) | 에너지 낫, 레드-퍼플 회전 글로우 | 32x32 |

### 무기 이펙트 (Phase 4 — SVG 직접 생성 + Graphics 개선)

| # | 텍스처 키 | 출력 경로 | 크기 | 설명 | 적용 무기 |
|---|-----------|----------|------|------|----------|
| 25 | `effect_projectile` | `assets/sprites/effects/projectile.png` | 16x16 | 시안 에너지 탄환 | 블래스터 |
| 26 | `effect_plasma_orb` | `assets/sprites/effects/plasma_orb.png` | 24x24 | 마젠타 오브 + 궤도 링 | 플라즈마 오브 |
| 27 | `effect_missile` | `assets/sprites/effects/missile.png` | 20x20 | 오렌지 로켓 미사일 | 미사일 |
| 28 | `effect_explosion` | `assets/sprites/effects/explosion.png` | 64x64 | 오렌지-옐로우 폭발 링 | 미사일 폭발 |
| 29 | `effect_drone` | `assets/sprites/effects/drone.png` | 24x24 | 시안 미니 드론 | 드론 |
| 30 | `effect_emp_ring` | `assets/sprites/effects/emp_ring.png` | 64x64 | 블루 EMP 파동 링 | EMP 폭발 |
| 31 | `effect_force_slash` | `assets/sprites/effects/force_slash.png` | 48x48 | 시안 호(arc) 슬래시 | 포스 블레이드 |
| 32 | `effect_nano_cloud` | `assets/sprites/effects/nano_cloud.png` | 48x48 | 그린 나노 구름 | 나노스웜 |
| 33 | `effect_vortex` | `assets/sprites/effects/vortex.png` | 48x48 | 마젠타-시안 나선 소용돌이 | 볼텍스 캐넌 |
| 34 | `effect_reaper_blade` | `assets/sprites/effects/reaper_blade.png` | 32x32 | 레드 초승달 낫 | 리퍼 필드 |

**참고**: 레이저 빔(beam)과 전기 체인(chain)은 Graphics 코드 유지 + 시각 개선 (다중 레이어 글로우, 두께 변화, 스파크 원 추가). 스프라이트 에셋 없음.

### UI 에셋 (Phase 2)

| # | 요소 | 현재 | 목표 | 상태 |
|---|------|------|------|------|
| 32 | 메뉴 배경 (`menu_bg`) | 단색 | 사이버 도시 실루엣 (GPT Image) 360x640 | 완료 |
| 33 | 버튼 | Graphics 사각형 | SD 생성 회로 패널 버튼 (9-slice) → Phase 5 | 미착수 |
| 34 | 카드 배경 | Graphics 패널 | SD 생성 회로 패널 카드 (9-slice) → Phase 5 | 미착수 |
| 35 | 아이콘 (무기 7종) `icon_weapon_*` | 이모지 텍스트 | 32x32 무기 아이콘 SVG | 완료 |
| 36 | 아이콘 (패시브 10종) `icon_passive_*` | 이모지 텍스트 | 32x32 패시브 아이콘 SVG | 완료 |
| 37 | 아이콘 (업그레이드 4종) `icon_upgrade_*` | 없음 | 32x32 업그레이드 아이콘 SVG | 완료 |

### UI 버튼/카드/패널 (Phase 5 — SD 로컬 생성)

#### 아트 컨셉: Circuit Board / Tech Panel (회로 패널)

사이버펑크 세계관에 맞는 **PCB 회로 기판** 모티프의 UI 에셋을 로컬 Stable Diffusion으로 생성한다.

**컨셉 키워드**: 회로 트레이스 테두리, 미세 PCB 패턴 표면, 네온 시안 발광 라인, 다크 테크 패널

**디자인 원칙**:
1. **표면 질감**: 다크 네이비(#1A1A2E) 위에 미세한 회로 패턴/트레이스 라인이 반투명하게 보임
2. **테두리**: PCB 트레이스처럼 직각 + 45도 꺾임이 있는 각진 라인, 네온 시안(#00FFFF) 발광
3. **모서리**: 회로 노드/솔더 포인트처럼 작은 원형 점 장식
4. **내부**: 중앙은 단순하고 반복 가능한 미세 그리드 패턴 (9-slice 타일링 대응)
5. **상태 표현**: 활성=시안 발광, 비활성=어두운 회색, 위험=레드 발광, 특수=마젠타 발광

**SD 생성 설정**:
- 모델: DreamShaper 8 (512x512, 빠른 생성 + 게임 에셋 적합)
- 투명 배경 필수 (후처리로 배경 제거)
- 9-slice 대응: 모서리 장식이 명확하고 중앙이 단순 반복 가능한 구조

**공통 SD 프롬프트 (영어)**:
```
Positive: cyberpunk UI button, circuit board trace border, PCB pattern surface,
neon cyan glowing lines, dark navy background (#1A1A2E), solder point corners,
45-degree angle traces, tech panel, game UI asset, flat 2D, transparent background,
clean edges, digital interface element

Negative: blurry, low quality, 3D rendering, realistic photo, text, watermark,
complex center pattern, organic shapes, round borders
```

#### 버튼 유형별 에셋 목록

| # | 텍스처 키 | 용도 | 에셋 크기 (원본) | 9-slice |
|---|-----------|------|-----------------|---------|
| 54 | `ui_btn_cta` | 출격 등 대형 CTA | 512x128 | O |
| 55 | `ui_btn_primary` | 메뉴 그리드 버튼 | 512x128 | O |
| 56 | `ui_btn_secondary` | 보조 버튼 | 256x128 | O |
| 57 | `ui_btn_small` | 소형 버튼 (보상 수령 등) | 256x128 | O |
| 58 | `ui_btn_tab_active` | 활성 탭 | 256x128 | O |
| 59 | `ui_btn_tab_inactive` | 비활성 탭 | 256x128 | O |
| 60 | `ui_card` | 카드 배경 (업적, 미션 등) | 512x256 | O |
| 61 | `ui_panel` | 패널/팝업 배경 | 512x512 | O |
| 62 | `ui_btn_danger` | 위험/경고 버튼 (레드 발광) | 256x128 | O |
| 63 | `ui_btn_special` | 특수 버튼 (마젠타 발광) | 512x128 | O |

**색상 변형 전략**:
- CTA/Primary: 시안(#00FFFF) 회로 발광
- Secondary/Tab: 약한 시안 또는 회색(#2A2A4E) 회로
- Danger: 레드(#FF3333) 회로 발광
- Special: 마젠타(#FF00FF) 회로 발광
- Disabled: 회로 패턴만 보이고 발광 없음 (코드에서 tint/alpha 처리)

**9-slice 분할 규칙**:
- 모서리 영역: 회로 노드 장식 포함 (최소 16px)
- 테두리 영역: 회로 트레이스 라인 (타일링 가능)
- 중앙 영역: 미세 그리드 패턴만 (단순 반복)

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
**생성 방식**: 하이브리드 — GPT Image API 17종 (gpt-image-1 -> sharp 리사이즈 -> PNG) + SVG 직접 생성 3종 (XP 보석, createGemSVG -> sharp -> PNG)

### Phase 2: UI + 배경 + 소모품 아이콘 (폴리싱) -- 완료 (2026-03-10)
> **완료** — GPT Image API + SVG 직접 생성 하이브리드로 31종 에셋 추가/교체

- [x] 배경 타일 (128x128 사이버 바닥, GPT Image API)
- [x] 메뉴 배경 (사이버 도시 실루엣 360x640, GPT Image API)
- [x] 조이스틱 UI (홀로그램 스타일, SVG 직접 생성 128x128 + 64x64)
- [x] 소모품 아이콘 6종 (24x24 -> 48x48 업스케일, GPT Image API)
- [x] 무기 아이콘 7종 (32x32, SVG 직접 생성)
- [x] 패시브 아이콘 10종 (32x32, SVG 직접 생성)
- [x] 업그레이드 아이콘 4종 (32x32, SVG 직접 생성)
- [ ] 버튼 / 카드 / 패널 UI 스프라이트 (Phase 2b로 이동)

**산출물**: `assets/backgrounds/` 2종, `assets/ui/joystick/` 2종, `assets/ui/icons/` 21종, `assets/sprites/items/` 6종 교체, `scripts/generate-phase2-assets.js`
**에셋 수**: 31종 (GPT Image API 8종 + SVG 직접 생성 23종)

### Phase 3: 스테이지 에셋 (멀티 스테이지 시스템) -- 완료 (2026-03-10)
> **완료** — GPT Image API + SVG 직접 생성 하이브리드로 10종 스테이지 에셋 생성

- [x] 배경 타일 3종 (128x128, S2~S4 전용 바닥 타일, GPT Image API)
- [x] 신규 보스 3종 (128x128, siege_titan_mk2 / data_phantom / omega_core, GPT Image API)
- [x] 신규 무기 아이콘 4종 (32x32, force_blade / nano_swarm / vortex_cannon / reaper_field, SVG 직접 생성)

**산출물**: `assets/backgrounds/` 3종, `assets/sprites/bosses/` 3종, `assets/ui/icons/` 4종, `scripts/generate-phase3-assets.js`
**에셋 수**: 10종 (GPT Image API 6종 + SVG 직접 생성 4종)

### Phase 4: 무기 이펙트 (최종 폴리싱) -- 완료 (2026-03-10)
> **완료** — SVG 직접 생성 방식으로 10종 이펙트 스프라이트 생성 + 기존 7종 무기 시각 개선 + 신규 4종 무기 완전 구현

- [x] 블래스터 탄환 SVG (effect_projectile, 16x16 시안 에너지 탄환)
- [x] 레이저 빔 Graphics 개선 (3-레이어 글로우: 외곽 8px + 메인 4px + 코어 2px, 끝점 원형 글로우, 맥동)
- [x] 플라즈마 오브 SVG (effect_plasma_orb, 24x24 마젠타 오브, Graphics -> Image 스프라이트 전환 + 회전)
- [x] 전기 체인 Graphics 개선 (3-레이어 번개: 외곽 5px + 메인 3px + 코어 1.5px, 체인 노드 스파크 원, 3개 중간점)
- [x] 미사일 SVG (effect_missile 20x20 + effect_explosion 64x64, Graphics -> Image 스프라이트 전환 + rotation + scale tween 폭발)
- [x] 드론 SVG (effect_drone, 24x24 시안 미니 드론, Graphics -> Image + physics body + hover 미세 회전)
- [x] EMP 파동 SVG (effect_emp_ring, 64x64 블루 EMP 링, VFXSystem.empRing() scale tween + 기존 empBurst 파티클 유지)
- [x] Force Blade 슬래시 SVG (effect_force_slash, 48x48 시안 호 슬래시, 200ms fade)
- [x] Nano Swarm 구름 SVG (effect_nano_cloud, 48x48 그린 나노 구름, alpha 맥동 + 페이드 아웃)
- [x] Vortex Cannon 소용돌이 SVG (effect_vortex, 48x48 마젠타-시안 나선, 회전 애니메이션 + 페이드 아웃)
- [x] Reaper Field 낫 SVG (effect_reaper_blade, 32x32 레드 초승달, 접선 방향 회전)

**산출물**: `assets/sprites/effects/` 이펙트 PNG 10종, `scripts/generate-phase4-assets.js`
**에셋 수**: 10종 (SVG 직접 생성 10종)

### Phase 5: UI 버튼/카드/패널 (SD 로컬 생성 — 회로 패널 컨셉)

> **미착수** — 로컬 Stable Diffusion (DreamShaper 8)으로 회로 기판 모티프 UI 에셋 생성

- [ ] CTA 버튼 (`ui_btn_cta`, 512x128, 시안 회로 발광)
- [ ] Primary 버튼 (`ui_btn_primary`, 512x128, 시안 회로)
- [ ] Secondary 버튼 (`ui_btn_secondary`, 256x128, 약한 시안)
- [ ] Small 버튼 (`ui_btn_small`, 256x128, 약한 시안)
- [ ] Tab 활성 (`ui_btn_tab_active`, 256x128, 시안 발광)
- [ ] Tab 비활성 (`ui_btn_tab_inactive`, 256x128, 회색 회로)
- [ ] 카드 배경 (`ui_card`, 512x256, 9-slice)
- [ ] 패널 배경 (`ui_panel`, 512x512, 9-slice)
- [ ] Danger 버튼 (`ui_btn_danger`, 256x128, 레드 발광)
- [ ] Special 버튼 (`ui_btn_special`, 512x128, 마젠타 발광)
- [ ] 9-slice 분할 + Phaser NineSlice 적용
- [ ] 기존 Graphics 버튼 코드 → 스프라이트 버튼으로 전환

**생성 방식**: 로컬 SD Forge API (DreamShaper 8, 512x512) → 투명 배경 후처리 → 9-slice 분할
**산출물**: `assets/ui/buttons/` 버튼 PNG, `assets/ui/panels/` 카드/패널 PNG

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

### 하이브리드 PNG 생성 파이프라인

```
scripts/generate-vector-sprites.js
  │
  ├── [svgOverride: false — 17종] GPT Image API 경로
  │   ├── OpenAI GPT Image API 호출 (gpt-image-1, 1024x1024, 투명 배경)
  │   │   ├── 공통 스타일 프롬프트 + 개별 에셋 프롬프트 조합
  │   │   └── base64 응답 디코딩 → Buffer
  │   ├── 투명 배경 확인 (폴백: 어두운 픽셀 임계값 투명화)
  │   ├── sharp 리사이즈 (목표 크기, fit: contain, 투명 배경)
  │   └── assets/sprites/ 디렉토리에 저장
  │
  ├── [svgOverride: true — XP 보석 3종] SVG 직접 생성 경로
  │   ├── createGemSVG(size): 다이아몬드 폴리곤 + 글로우 필터 SVG 문자열 생성
  │   ├── sharp(svgBuffer).png().toFile(): SVG → PNG 직접 변환 (리사이즈 불필요)
  │   └── assets/sprites/items/ 디렉토리에 저장
  │
  └── API rate limit: GPT API 에셋만 1초 대기, SVG 에셋은 대기 없음
```

> **소형 에셋(12~28px)에 SVG를 사용하는 이유**: GPT Image API는 최소 1024x1024 이미지를 생성한다. 이를 12~28px로 85~99% 축소하면 디테일이 소실되어 거의 투명한 이미지가 된다. SVG는 목표 크기의 viewBox로 직접 렌더링하므로 이 문제가 없다.

### 걷기 애니메이션 스프라이트시트 생성 파이프라인

```
scripts/generate-walk-anim.js
  │
  ├── 5방향 x 4프레임 = 20개 GPT Image API 호출
  │   ├── 공통 스타일 프롬프트 (WALK_STYLE_PROMPT)
  │   │   └── player.png와 동일 캐릭터 외형 + 사이버펑크 네온 스타일
  │   ├── 방향별 프롬프트 (down, down-right, right, up-right, up)
  │   ├── 프레임별 포즈 프롬프트 (neutral, left-step, neutral, right-step)
  │   ├── gpt-image-1, 1024x1024, background: transparent
  │   ├── 투명 배경 확인 + 폴백 투명화 (밝기 임계값 40)
  │   ├── sharp 리사이즈 48x48 (fit: contain, 투명 배경)
  │   └── assets/sprites/walk_frames/{방향}_{프레임}.png 저장
  │
  ├── 실패 폴백: 시안 반투명(alpha 128) 48x48 PNG 생성
  │
  ├── 스프라이트시트 합성 (sharp composite)
  │   ├── 레이아웃: 5열(방향) x 4행(프레임) = 240x192
  │   ├── 배치: col=방향인덱스, row=프레임인덱스
  │   └── assets/sprites/player_walk.png 출력
  │
  ├── 3방향 미러링 (Player.js에서 런타임 처리)
  │   ├── down-left = walk_down_right + flipX
  │   ├── left = walk_right + flipX
  │   └── up-left = walk_up_right + flipX
  │
  └── API rate limit: 호출 간 1초 대기
```

> **5방향만 생성하는 이유**: 좌우 대칭 캐릭터이므로 left 계열 3방향(SW, W, NW)은 대응하는 right 계열 방향의 스프라이트를 Phaser setFlipX(true)로 수평 미러링하면 동일한 시각적 결과를 얻을 수 있다. 20개 프레임 대신 20개만 생성하여 API 호출 비용과 시간을 절약한다.

### 파일 구조

```
assets/
├── sprites/
│   ├── player.png              (48x48, 정적 idle용)
│   ├── player_walk.png         (240x192, 5방향x4프레임 걷기 스프라이트시트)
│   ├── walk_frames/            (20개 개별 프레임 PNG, 디버깅용)
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
│   │   ├── guardian_drone.png   (80x80)
│   │   ├── assault_mech.png     (80x80)
│   │   ├── commander_drone.png  (128x128)
│   │   ├── siege_titan.png      (128x128)
│   │   ├── core_processor.png   (128x128)
│   │   ├── siege_titan_mk2.png  (128x128, Phase 3 — S2 보스)
│   │   ├── data_phantom.png     (128x128, Phase 3 — S3 보스)
│   │   └── omega_core.png       (128x128, Phase 3 — S4 보스)
│   ├── effects/                    (Phase 4 — 무기 이펙트 SVG 스프라이트 10종)
│   │   ├── projectile.png     (16x16, 시안 에너지 탄환)
│   │   ├── plasma_orb.png     (24x24, 마젠타 오브)
│   │   ├── missile.png        (20x20, 오렌지 로켓)
│   │   ├── explosion.png      (64x64, 폭발 링)
│   │   ├── drone.png          (24x24, 시안 미니 드론)
│   │   ├── emp_ring.png       (64x64, 블루 EMP 링)
│   │   ├── force_slash.png    (48x48, 시안 호 슬래시)
│   │   ├── nano_cloud.png     (48x48, 그린 나노 구름)
│   │   ├── vortex.png         (48x48, 마젠타-시안 소용돌이)
│   │   └── reaper_blade.png   (32x32, 레드 초승달 낫)
│   └── items/
│       ├── xp_gem_s.png        (12x12)
│       ├── xp_gem_m.png        (20x20)
│       └── xp_gem_l.png        (28x28)
├── ui/
│   ├── icons/
│   │   ├── weapon_blaster.png        (32x32)
│   │   ├── weapon_laser_gun.png      (32x32)
│   │   ├── weapon_plasma_orb.png     (32x32)
│   │   ├── weapon_electric_chain.png (32x32)
│   │   ├── weapon_missile.png        (32x32)
│   │   ├── weapon_drone.png          (32x32)
│   │   ├── weapon_emp_blast.png      (32x32)
│   │   ├── passive_booster.png       (32x32)
│   │   ├── passive_armor_plate.png   (32x32)
│   │   ├── passive_battery_pack.png  (32x32)
│   │   ├── passive_overclock.png     (32x32)
│   │   ├── passive_magnet_module.png (32x32)
│   │   ├── passive_regen_module.png  (32x32)
│   │   ├── passive_aim_module.png    (32x32)
│   │   ├── passive_critical_chip.png (32x32)
│   │   ├── passive_cooldown_chip.png (32x32)
│   │   ├── passive_luck_module.png   (32x32)
│   │   ├── upgrade_basic.png         (32x32)
│   │   ├── upgrade_growth.png        (32x32)
│   │   ├── upgrade_special.png       (32x32)
│   │   ├── upgrade_limitBreak.png    (32x32)
│   │   ├── weapon_force_blade.png    (32x32, Phase 3)
│   │   ├── weapon_nano_swarm.png     (32x32, Phase 3)
│   │   ├── weapon_vortex_cannon.png  (32x32, Phase 3)
│   │   └── weapon_reaper_field.png   (32x32, Phase 3)
│   └── joystick/
│       ├── base.png            (128x128)
│       └── thumb.png           (64x64)
└── backgrounds/
    ├── bg_tile.png             (128x128, S1 기본)
    ├── bg_tile_s2.png          (128x128, Phase 3 — 산업 지구)
    ├── bg_tile_s3.png          (128x128, Phase 3 — 서버 팜)
    ├── bg_tile_s4.png          (128x128, Phase 3 — 코어)
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
| Phase 2 | 31종 | **완료** (2026-03-10) | UI + 배경 + 소모품 아이콘 |
| Phase 3 | 10종 | **완료** (2026-03-10) | 스테이지 에셋 (배경 3 + 보스 3 + 무기 아이콘 4) |
| Phase 4 | 10종 | **완료** (2026-03-10) | 무기 이펙트 SVG 스프라이트 10종 |
| Phase 5 | 10종 | **미착수** | UI 버튼/카드/패널 — SD 로컬 생성 (회로 패널 컨셉) |
| **합계** | **81종** | Phase 1~4 완료, Phase 5 대기 | GPT Image + SVG + SD 하이브리드 |

---

*최종 수정: 2026-03-27 (Phase 5 UI 버튼/카드/패널 회로 패널 컨셉 추가 — SD 로컬 생성 예정)*
