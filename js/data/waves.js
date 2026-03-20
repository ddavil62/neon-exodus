/**
 * @fileoverview 스폰 시스템 데이터.
 * 시간대별 스폰 간격, 동시 스폰 수, 등장 적 종류를 정의한다.
 * 미니보스와 보스 스케줄도 포함한다.
 */

// ── 시간대별 스폰 테이블 ──

/**
 * 시간대별 스폰 규칙.
 * fromMin/toMin: 시간 범위(분), interval: 스폰 간격(초),
 * countMin/countMax: 동시 스폰 수 범위, enemies: 해당 시간에 등장하는 적 ID 목록.
 * @type {Array<{fromMin: number, toMin: number, interval: number, countMin: number, countMax: number, enemies: string[]}>}
 */
export const SPAWN_TABLE = [
  {
    fromMin: 0,
    toMin: 2,
    interval: 1.5,
    countMin: 3,
    countMax: 5,
    enemies: ['nano_drone', 'scout_bot'],
  },
  {
    fromMin: 2,
    toMin: 4,
    interval: 1.2,
    countMin: 4,
    countMax: 7,
    enemies: ['nano_drone', 'scout_bot', 'spark_drone'],
  },
  {
    fromMin: 4,
    toMin: 6,
    interval: 1.0,
    countMin: 6,
    countMax: 10,
    enemies: ['nano_drone', 'scout_bot', 'spark_drone', 'battle_robot', 'shield_drone'],
  },
  {
    fromMin: 6,
    toMin: 9,
    interval: 0.8,
    countMin: 8,
    countMax: 12,
    enemies: ['nano_drone', 'scout_bot', 'spark_drone', 'battle_robot', 'shield_drone', 'rush_bot', 'repair_bot'],
  },
  {
    fromMin: 9,
    toMin: 12,
    interval: 0.7,
    countMin: 10,
    countMax: 15,
    enemies: ['nano_drone', 'scout_bot', 'spark_drone', 'battle_robot', 'shield_drone', 'rush_bot', 'repair_bot', 'heavy_bot', 'teleport_drone'],
  },
  {
    fromMin: 12,
    toMin: 15,
    interval: 0.6,
    countMin: 12,
    countMax: 20,
    enemies: ['nano_drone', 'scout_bot', 'spark_drone', 'battle_robot', 'shield_drone', 'rush_bot', 'repair_bot', 'heavy_bot', 'teleport_drone', 'suicide_bot'],
  },
];

// ── 미니보스 스케줄 ──

/**
 * 미니보스 등장 스케줄.
 * @type {Array<{time: number, enemyId: string}>}
 */
export const MINI_BOSS_SCHEDULE = [
  { time: 180, enemyId: 'guardian_drone' },  // 3분
  { time: 360, enemyId: 'assault_mech' },    // 6분
  { time: 420, enemyId: 'guardian_drone' },   // 7분
  { time: 720, enemyId: 'assault_mech' },     // 12분
];

// ── 보스 스케줄 ──

/**
 * 보스 등장 스케줄.
 * @type {Array<{time: number, enemyId: string}>}
 */
export const BOSS_SCHEDULE = [
  { time: 300, enemyId: 'commander_drone' },  // 5분
  { time: 600, enemyId: 'siege_titan' },       // 10분
  { time: 900, enemyId: 'core_processor' },    // 15분 (최종)
];

/**
 * 주어진 경과 시간(분)에 해당하는 스폰 규칙을 반환한다.
 * @param {number} minuteElapsed - 경과 시간 (분)
 * @returns {Object|undefined} 해당 시간대의 스폰 규칙
 */
export function getSpawnRule(minuteElapsed) {
  return SPAWN_TABLE.find(
    rule => minuteElapsed >= rule.fromMin && minuteElapsed < rule.toMin
  );
}

/**
 * 주어진 시간(초)에 등장해야 할 미니보스/보스를 반환한다.
 * @param {number} elapsedSeconds - 경과 시간 (초)
 * @returns {{miniBosses: Array, bosses: Array}} 해당 시점의 미니보스와 보스
 */
export function getScheduledSpawns(elapsedSeconds) {
  return {
    miniBosses: MINI_BOSS_SCHEDULE.filter(s => s.time === elapsedSeconds),
    bosses: BOSS_SCHEDULE.filter(s => s.time === elapsedSeconds),
  };
}
