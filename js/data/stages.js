/**
 * @fileoverview 멀티 스테이지 정의 데이터.
 * 각 스테이지의 배경, 난이도, 보스, 해금 무기, 잠금 조건을 정의한다.
 */

// ── 스테이지 정의 ──

/**
 * 전체 스테이지 데이터.
 * @type {Object.<string, Object>}
 */
export const STAGES = {
  stage_1: {
    id: 'stage_1',
    nameKey: 'stage.city_outskirts.name',
    descKey: 'stage.city_outskirts.desc',
    bgTileKey: 'bg_tile',
    bgColor: 0x0A0A1A,
    accentColor: 0x00FFFF,
    unlockWeaponId: 'force_blade',
    unlocksAfter: null,
    difficultyMult: 1.0,
    bossId: 'core_processor',
    miniBossOverride: null,
    spawnTableOverride: null,
    decoTypes: ['deco_s1_lamppost', 'deco_s1_car', 'deco_s1_manhole', 'deco_s1_debris'],
    decoTint: 0x7777BB,
    /** 파괴 가능 데코 드롭 테이블 */
    decoDropTable: {
      destructibleRatio: 0.4,
      drops: [
        { type: 'xp', gem: 'small', weight: 60 },
        { type: 'xp', gem: 'medium', weight: 20 },
        { type: 'consumable', id: 'nano_repair', weight: 10 },
        { type: 'consumable', id: 'credit_chip', weight: 10 },
      ],
    },
  },
  stage_2: {
    id: 'stage_2',
    nameKey: 'stage.industrial_zone.name',
    descKey: 'stage.industrial_zone.desc',
    bgTileKey: 'bg_tile_s2',
    bgColor: 0x1A0800,
    accentColor: 0xFF6600,
    unlockWeaponId: 'nano_swarm',
    unlocksAfter: 'stage_1',
    difficultyMult: 1.2,
    bossId: 'siege_titan_mk2',
    miniBossOverride: [
      { time: 180, enemyId: 'assault_mech' },
      { time: 360, enemyId: 'guardian_drone' },
      { time: 540, enemyId: 'assault_mech' },
      { time: 720, enemyId: 'assault_mech' },
    ],
    spawnTableOverride: { earlySpawnBoost: { enemyId: 'repair_bot', fromMinute: 1 } },
    decoTypes: ['deco_s2_drum', 'deco_s2_pipe', 'deco_s2_crane', 'deco_s2_sign'],
    decoTint: 0x8B6633,
    /** 파괴 가능 데코 드롭 테이블 */
    decoDropTable: {
      destructibleRatio: 0.4,
      drops: [
        { type: 'xp', gem: 'small', weight: 60 },
        { type: 'xp', gem: 'medium', weight: 20 },
        { type: 'consumable', id: 'nano_repair', weight: 10 },
        { type: 'consumable', id: 'credit_chip', weight: 10 },
      ],
    },
  },
  stage_3: {
    id: 'stage_3',
    nameKey: 'stage.underground_server.name',
    descKey: 'stage.underground_server.desc',
    bgTileKey: 'bg_tile_s3',
    bgColor: 0x050510,
    accentColor: 0x8800FF,
    unlockWeaponId: 'vortex_cannon',
    unlocksAfter: 'stage_2',
    difficultyMult: 1.5,
    bossId: 'data_phantom',
    miniBossOverride: [
      { time: 120, enemyId: 'assault_mech' },
      { time: 300, enemyId: 'guardian_drone' },
      { time: 480, enemyId: 'assault_mech' },
      { time: 660, enemyId: 'guardian_drone' },
    ],
    spawnTableOverride: { earlySpawnBoost: { enemyId: 'teleport_drone', fromMinute: 5 } },
    decoTypes: ['deco_s3_rack', 'deco_s3_cable', 'deco_s3_fan', 'deco_s3_terminal'],
    decoTint: 0x6644AA,
    /** 파괴 가능 데코 드롭 테이블 */
    decoDropTable: {
      destructibleRatio: 0.4,
      drops: [
        { type: 'xp', gem: 'small', weight: 60 },
        { type: 'xp', gem: 'medium', weight: 20 },
        { type: 'consumable', id: 'nano_repair', weight: 10 },
        { type: 'consumable', id: 'credit_chip', weight: 10 },
      ],
    },
  },
  stage_4: {
    id: 'stage_4',
    nameKey: 'stage.the_core.name',
    descKey: 'stage.the_core.desc',
    bgTileKey: 'bg_tile_s4',
    bgColor: 0x000000,
    accentColor: 0x00FF44,
    unlockWeaponId: 'reaper_field',
    unlocksAfter: 'stage_3',
    difficultyMult: 2.0,
    bossId: 'omega_core',
    miniBossOverride: [
      { time: 120, enemyId: 'assault_mech' },
      { time: 240, enemyId: 'guardian_drone' },
      { time: 420, enemyId: 'assault_mech' },
      { time: 600, enemyId: 'guardian_drone' },
      { time: 780, enemyId: 'assault_mech' },
    ],
    spawnTableOverride: {
      earlySpawnBoost: [
        { enemyId: 'suicide_bot', fromMinute: 6 },
        { enemyId: 'heavy_bot', fromMinute: 4 },
      ],
    },
    decoTypes: ['deco_s4_node', 'deco_s4_pillar', 'deco_s4_core', 'deco_s4_shard'],
    decoTint: 0x448844,
    /** 파괴 가능 데코 드롭 테이블 */
    decoDropTable: {
      destructibleRatio: 0.4,
      drops: [
        { type: 'xp', gem: 'small', weight: 60 },
        { type: 'xp', gem: 'medium', weight: 20 },
        { type: 'consumable', id: 'nano_repair', weight: 10 },
        { type: 'consumable', id: 'credit_chip', weight: 10 },
      ],
    },
  },
};

/** 스테이지 진행 순서 */
export const STAGE_ORDER = ['stage_1', 'stage_2', 'stage_3', 'stage_4'];

// ── 난이도 모드 정의 ──

/**
 * 난이도 모드별 배율 및 보상 데이터.
 * @type {Object.<string, {id: string, labelKey: string, hpMult: number, atkMult: number, spdMult: number, creditMult: number, dcReward: number, color: string, colorHex: number}>}
 */
export const DIFFICULTY_MODES = {
  normal:    { id: 'normal',    labelKey: 'difficulty.normal',    hpMult: 1.0, atkMult: 1.0, spdMult: 1.0, creditMult: 1.0, dcReward: 3, color: '#4FC3F7', colorHex: 0x4FC3F7 },
  hard:      { id: 'hard',      labelKey: 'difficulty.hard',      hpMult: 1.8, atkMult: 1.5, spdMult: 1.1, creditMult: 1.5, dcReward: 5, color: '#FF8A65', colorHex: 0xFF8A65 },
  nightmare: { id: 'nightmare', labelKey: 'difficulty.nightmare', hpMult: 3.0, atkMult: 2.0, spdMult: 1.2, creditMult: 2.5, dcReward: 8, color: '#EF5350', colorHex: 0xEF5350 },
};

/** 난이도 진행 순서 */
export const DIFFICULTY_ORDER = ['normal', 'hard', 'nightmare'];

/** 사망 시 데이터코어 보상 */
export const DC_REWARD_DEATH = 1;

/**
 * 스테이지 ID로 스테이지 데이터를 조회한다.
 * @param {string} stageId - 스테이지 ID
 * @returns {Object|undefined} 스테이지 데이터
 */
export function getStageById(stageId) {
  return STAGES[stageId];
}
