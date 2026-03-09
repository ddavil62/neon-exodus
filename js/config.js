/**
 * @fileoverview 게임 상수 및 밸런스 수치를 한 곳에서 관리한다.
 * 해상도, 월드, 조이스틱, 경험치, 런 설정, 네온 컬러 팔레트 등 모든 매직넘버를 이 파일에 집중한다.
 */

// ── 게임 화면 설정 ──

/** 게임 화면 너비 (px) */
export const GAME_WIDTH = 360;

/** 게임 화면 높이 (px) */
export const GAME_HEIGHT = 640;

// ── 월드 설정 ──

/** 월드 전체 너비 (px) */
export const WORLD_WIDTH = 2000;

/** 월드 전체 높이 (px) */
export const WORLD_HEIGHT = 2000;

// ── 스프라이트 설정 ──

/** 스프라이트 렌더링 배율 (벡터 에셋은 표시 크기로 직접 생성하므로 1 사용) */
export const SPRITE_SCALE = 1;

// ── 플레이어 설정 ──

/** 플레이어 기본 이동 속도 (px/s) */
export const PLAYER_BASE_SPEED = 200;

/** 플레이어 기본 최대 HP */
export const PLAYER_BASE_HP = 100;

/** 플레이어 기본 방어력 */
export const PLAYER_BASE_DEFENSE = 0;

/** 피격 후 무적 시간 (초) */
export const PLAYER_INVINCIBLE_DURATION = 0.5;

// ── 가상 조이스틱 설정 ──

/** 조이스틱 데드존 (px): 이 거리 이내 이동 무시 (떨림 방지) */
export const JOYSTICK_DEAD_ZONE = 8;

/** 조이스틱 최대 반경 (px): 이 이상 드래그해도 최대 속도 */
export const JOYSTICK_MAX_RADIUS = 50;

// ── 경험치 (XP) 설정 ──

/** XP 보석 자동 흡수 반경 (px) */
export const XP_MAGNET_RADIUS = 50;

/**
 * 레벨업에 필요한 XP 공식.
 * @param {number} level - 현재 레벨
 * @returns {number} 다음 레벨까지 필요한 XP
 */
export const XP_FORMULA = (level) => 10 + level * 5;

/** XP 보석 크기별 경험치량 */
export const XP_GEM_VALUES = {
  small: 1,
  medium: 3,
  large: 10,
};

/** XP 보석 바닥 유지 시간 (초) */
export const XP_GEM_LIFETIME = 5;

/** XP 보석 소멸 전 깜빡임 시간 (초) */
export const XP_GEM_BLINK_DURATION = 3;

// ── 런 설정 ──

/** 런 지속 시간 (초). 15분 = 900초 */
export const RUN_DURATION = 900;

/** 레벨업 시 기본 선택지 수 */
export const LEVELUP_CHOICES = 3;

/** 기본 무기 슬롯 수 */
export const WEAPON_SLOTS = 6;

/** 기본 패시브 슬롯 수 */
export const PASSIVE_SLOTS = 6;

// ── 스폰 설정 ──

/** 적 스폰 위치: 화면 경계에서 최소 이 거리 밖 (px) */
export const SPAWN_OFFSET_MIN = 50;

/** 적 스폰 위치: 화면 경계에서 최대 이 거리 밖 (px) */
export const SPAWN_OFFSET_MAX = 100;

/** 적 HP/데미지 분당 스케일링 비율 (+5%/분) */
export const ENEMY_SCALE_PER_MINUTE = 0.05;

// ── 크레딧 (메타 재화) 설정 ──

/** 적 처치 시 크레딧 드랍 기본 확률 (0~1) */
export const CREDIT_DROP_CHANCE = 0.1;

/** 크레딧 드랍 기본 량 */
export const CREDIT_DROP_AMOUNT = 1;

// ── 세이브 설정 ──

/** 로컬스토리지 세이브 키 */
export const SAVE_KEY = 'neon-exodus-save';

/** 세이브 데이터 버전 */
export const SAVE_DATA_VERSION = 4;

/** 엔들리스 모드 스케일링 간격 (ms). 60초마다 적 HP/데미지 +10% */
export const ENDLESS_SCALE_INTERVAL = 60000;

// ── 네온 컬러 팔레트 ──

export const COLORS = {
  /** 기본 배경색 (진한 남색) */
  BG: 0x0A0A1A,
  /** 어두운 배경색 */
  BG_DARK: 0x060612,

  /** 네온 시안 */
  NEON_CYAN: 0x00FFFF,
  /** 네온 마젠타 */
  NEON_MAGENTA: 0xFF00FF,
  /** 네온 그린 */
  NEON_GREEN: 0x39FF14,
  /** 네온 오렌지 */
  NEON_ORANGE: 0xFF6600,

  /** HP 바 빨강 */
  HP_RED: 0xFF3333,
  /** XP 바 노랑 */
  XP_YELLOW: 0xFFDD00,

  /** UI 패널 배경 */
  UI_PANEL: 0x1A1A2E,
  /** UI 패널 테두리 */
  UI_BORDER: 0x2A2A4E,

  /** 기본 텍스트 (흰색) */
  TEXT_WHITE: 0xFFFFFF,
  /** 보조 텍스트 (회색) */
  TEXT_GRAY: 0x888888,
};

// ── UI 문자열 색상 (CSS hex) ──

export const UI_COLORS = {
  textPrimary:   '#FFFFFF',
  textSecondary: '#888888',
  neonCyan:      '#00FFFF',
  neonMagenta:   '#FF00FF',
  neonGreen:     '#39FF14',
  neonOrange:    '#FF6600',
  hpRed:         '#FF3333',
  xpYellow:      '#FFDD00',
  panelBg:       0x1A1A2E,
  panelAlpha:    0.9,
  panelBorder:   0x2A2A4E,
  btnPrimary:    0x00AAAA,
  btnSecondary:  0x1A1A2E,
  btnDanger:     0xAA3333,
  btnDisabled:   0x333344,
};

// ── 배경 타일 설정 ──

/** 배경 타일 크기 (px) */
export const BG_TILE_SIZE = 64;

// ── 카메라 설정 ──

/** 카메라 추적 감속 (lerp). 1에 가까울수록 즉시 추적 */
export const CAMERA_LERP = 0.1;

// ── AdMob 설정 ──

/** AdMob 앱 ID */
export const ADMOB_APP_ID = 'ca-app-pub-9149509805250873~5179575681';

/** 광고 단위 ID 맵 */
export const ADMOB_UNITS = {
  /** 크레딧 2배 보상형 광고 */
  creditDouble: 'ca-app-pub-9149509805250873/8105121927',
  /** 광고 부활 보상형 광고 */
  adRevive:     'ca-app-pub-9149509805250873/6373567427',
};

/** 광고 일일 시청 횟수 제한 */
export const AD_LIMITS = {
  creditDouble: 3,  // 크레딧 2배: 하루 3회
  adRevive:     2,  // 광고 부활: 하루 2회
};

// ── IAP (인앱결제) 설정 ──

/** Google Play 인앱 상품 ID 맵 */
export const IAP_PRODUCTS = {
  /** 자동 사냥 영구 해금 */
  autoHunt: 'com.antigravity.neonexodus.auto_hunt',
};

// ── 자동 사냥 (Auto Hunt) 설정 ──

export const AUTO_HUNT = {
  /** AI 방향 갱신 간격 (ms) */
  directionInterval: 150,
  /** 위험 감지 반경 (px) */
  dangerRadius: 120,
  /** XP 보석 탐색 반경 (px) */
  xpSearchRadius: 200,
};
