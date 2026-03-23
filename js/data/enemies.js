/**
 * @fileoverview 적 데이터 테이블.
 * 잡몹 10종, 미니보스 2종, 보스 3종의 전체 스탯과 특성을 정의한다.
 * 시간 경과에 따른 스케일링은 config.js의 ENEMY_SCALE_PER_MINUTE을 사용한다.
 */

// ── 잡몹 10종 ──

/**
 * 잡몹 데이터 배열.
 * @type {Array<{id: string, nameKey: string, descKey: string, hp: number, speed: number, contactDamage: number, xp: number, spawnFrom: number, traits: string[]}>}
 */
export const ENEMIES = [
  // ── 초반 (0~4분) ──
  {
    id: 'nano_drone',
    nameKey: 'enemy.nano_drone.name',
    descKey: 'enemy.nano_drone.desc',
    hp: 18,
    speed: 120,
    contactDamage: 3,
    xp: 2,
    spawnFrom: 0,
    traits: ['swarm'],
    size: 24,
  },
  {
    id: 'scout_bot',
    nameKey: 'enemy.scout_bot.name',
    descKey: 'enemy.scout_bot.desc',
    hp: 34,
    speed: 80,
    contactDamage: 5,
    xp: 3,
    spawnFrom: 0,
    traits: ['linear_chase'],
    size: 24,
  },
  {
    id: 'spark_drone',
    nameKey: 'enemy.spark_drone.name',
    descKey: 'enemy.spark_drone.desc',
    hp: 24,
    speed: 110,
    contactDamage: 4,
    xp: 3,
    spawnFrom: 2,
    traits: ['death_explosion'],
    deathExplosionRadius: 30,
    deathExplosionDamage: 3,
    size: 24,
  },

  // ── 중반 (4~9분) ──
  {
    id: 'battle_robot',
    nameKey: 'enemy.battle_robot.name',
    descKey: 'enemy.battle_robot.desc',
    hp: 150,
    speed: 50,
    contactDamage: 12,
    xp: 4,
    spawnFrom: 4,
    traits: ['tank'],
    size: 32,
  },
  {
    id: 'shield_drone',
    nameKey: 'enemy.shield_drone.name',
    descKey: 'enemy.shield_drone.desc',
    hp: 70,
    speed: 70,
    contactDamage: 6,
    xp: 3,
    spawnFrom: 4,
    traits: ['front_shield'],
    frontShieldReduction: 0.5,
    size: 24,
  },
  {
    id: 'rush_bot',
    nameKey: 'enemy.rush_bot.name',
    descKey: 'enemy.rush_bot.desc',
    hp: 100,
    speed: 150,
    contactDamage: 10,
    xp: 3,
    spawnFrom: 6,
    traits: ['charge', 'wall_stun'],
    size: 28,
  },
  {
    id: 'repair_bot',
    nameKey: 'enemy.repair_bot.name',
    descKey: 'enemy.repair_bot.desc',
    hp: 55,
    speed: 60,
    contactDamage: 2,
    xp: 5,
    spawnFrom: 6,
    traits: ['heal_aura'],
    healPerSecond: 5,
    healRadius: 80,
    size: 24,
  },

  // ── 후반 (9~15분) ──
  {
    id: 'heavy_bot',
    nameKey: 'enemy.heavy_bot.name',
    descKey: 'enemy.heavy_bot.desc',
    hp: 400,
    speed: 35,
    contactDamage: 20,
    xp: 6,
    spawnFrom: 9,
    traits: ['tank', 'knockback_resist'],
    size: 36,
  },
  {
    id: 'teleport_drone',
    nameKey: 'enemy.teleport_drone.name',
    descKey: 'enemy.teleport_drone.desc',
    hp: 90,
    speed: 80,
    contactDamage: 8,
    xp: 5,
    spawnFrom: 9,
    traits: ['teleport'],
    teleportInterval: 3,
    teleportRange: 80,
    size: 24,
  },
  {
    id: 'suicide_bot',
    nameKey: 'enemy.suicide_bot.name',
    descKey: 'enemy.suicide_bot.desc',
    hp: 150,
    speed: 130,
    contactDamage: 0,
    xp: 4,
    spawnFrom: 12,
    traits: ['self_destruct'],
    selfDestructRadius: 60,
    selfDestructDamage: 25,
    size: 28,
  },
];

// ── 미니보스 2종 ──

/**
 * 미니보스 데이터.
 * @type {Array<{id: string, nameKey: string, descKey: string, hp: number, speed: number, contactDamage: number, xp: number, spawnAt: number[], specialAttacks: string[], drops: Object}>}
 */
export const MINI_BOSSES = [
  {
    id: 'guardian_drone',
    nameKey: 'enemy.guardian_drone.name',
    descKey: 'enemy.guardian_drone.desc',
    hp: 500,
    speed: 40,
    contactDamage: 15,
    xp: 30,
    spawnAt: [240, 420],  // 4분, 7분
    specialAttacks: ['spinning_laser'],
    spinningLaserDamage: 8,
    spinningLaserRange: 60,
    drops: { bonusXpGems: 5 },
    size: 40,
  },
  {
    id: 'assault_mech',
    nameKey: 'enemy.assault_mech.name',
    descKey: 'enemy.assault_mech.desc',
    hp: 1000,
    speed: 60,
    contactDamage: 20,
    xp: 50,
    spawnAt: [360, 720],  // 6분, 12분
    specialAttacks: ['triple_missile'],
    missileDamage: 12,
    missileSpeed: 200,
    drops: { bonusXpGems: 8 },
    size: 48,
  },
];

// ── 보스 3종 ──

/**
 * 보스 데이터.
 * @type {Array<{id: string, nameKey: string, descKey: string, hp: number, speed: number, contactDamage: number, xp: number, spawnAt: number, specialAttacks: string[], drops: Object}>}
 */
export const BOSSES = [
  {
    id: 'commander_drone',
    nameKey: 'enemy.commander_drone.name',
    descKey: 'enemy.commander_drone.desc',
    hp: 1250,
    speed: 50,
    contactDamage: 25,
    xp: 100,
    spawnAt: 300,  // 5분
    specialAttacks: ['summon_mobs', 'charge'],
    summonCount: 4,
    summonInterval: 10,
    summonEnemyId: 'scout_bot',
    drops: { treasureChest: true, contents: 'weapon_or_passive' },
    size: 64,
  },
  {
    id: 'siege_titan',
    nameKey: 'enemy.siege_titan.name',
    descKey: 'enemy.siege_titan.desc',
    hp: 4000,
    speed: 40,
    contactDamage: 30,
    xp: 200,
    spawnAt: 600,  // 10분
    specialAttacks: ['area_bombardment', 'charge'],
    bombardmentRadius: 80,
    bombardmentDelay: 2,
    bombardmentDamage: 35,
    drops: { treasureChest: true, contents: 'weapon_or_passive', bonusCredits: 50 },
    size: 64,
  },
  {
    id: 'core_processor',
    nameKey: 'enemy.core_processor.name',
    descKey: 'enemy.core_processor.desc',
    hp: 15000,
    speed: 30,
    contactDamage: 40,
    xp: 500,
    spawnAt: 900,  // 15분 (최종)
    specialAttacks: ['spinning_laser', 'summon_mobs', 'area_emp'],
    spinningLaserDamage: 15,
    spinningLaserRange: 100,
    summonCount: 6,
    summonInterval: 8,
    summonEnemyId: 'nano_drone',
    empRadius: 150,
    empDamage: 20,
    empInterval: 12,
    drops: { runClearReward: true },
    size: 80,
  },

  // ── 스테이지 2~4 보스 3종 ──

  {
    id: 'siege_titan_mk2',
    nameKey: 'enemy.siege_titan_mk2.name',
    descKey: 'enemy.siege_titan_mk2.desc',
    hp: 6000,
    speed: 50,
    contactDamage: 38,
    xp: 250,
    spawnAt: 900,  // 15분
    specialAttacks: ['area_bombardment', 'charge'],
    bombardmentRadius: 180,   // 기존 siege_titan 80 + 100 증가
    bombardmentDelay: 2,
    bombardmentDamage: 35,
    drops: { runClearReward: true },
    size: 64,
  },
  {
    id: 'data_phantom',
    nameKey: 'enemy.data_phantom.name',
    descKey: 'enemy.data_phantom.desc',
    hp: 8000,
    speed: 60,
    contactDamage: 35,
    xp: 400,
    spawnAt: 900,  // 15분
    specialAttacks: ['phase_shift', 'data_burst', 'clone'],
    // phase_shift: 4초마다 랜덤 순간이동 (화면 내)
    phaseShiftInterval: 4,
    // data_burst: 8방향 투사체 발사
    dataBurstDamage: 20,
    dataBurstCooldown: 5,
    dataBurstDirections: 8,
    // clone: HP 50% 이하 시 분신 2체 (HP 500)
    cloneCount: 2,
    cloneHp: 250,
    cloneThreshold: 0.5,
    drops: { runClearReward: true },
    size: 72,
  },
  {
    id: 'omega_core',
    nameKey: 'enemy.omega_core.name',
    descKey: 'enemy.omega_core.desc',
    hp: 15000,
    speed: 40,
    contactDamage: 50,
    xp: 1000,
    spawnAt: 900,  // 15분
    specialAttacks: ['spinning_laser', 'summon_mobs', 'area_emp', 'overload'],
    spinningLaserDamage: 20,
    summonCount: 8,
    summonInterval: 6,
    summonEnemyId: 'nano_drone',
    empRadius: 200,
    empDamage: 30,
    empInterval: 12,
    // overload: HP 30% 이하 시 모든 공격 주기 40% 단축
    overloadThreshold: 0.3,
    overloadSpeedMult: 0.6,
    drops: { runClearReward: true },
    size: 96,
  },
];

// ── 스케일링 설정 ──

/**
 * 분당 HP/데미지 스케일링 비율.
 * 1분 경과 시 HP와 데미지가 각각 5%씩 증가한다.
 */
export const SCALING = {
  hpScale: 0.05,
  dmgScale: 0.05,
};

/**
 * ID로 적 데이터를 조회한다 (잡몹, 미니보스, 보스 전체 검색).
 * @param {string} id - 적 ID
 * @returns {Object|undefined} 적 데이터
 */
export function getEnemyById(id) {
  return ENEMIES.find(e => e.id === id)
    || MINI_BOSSES.find(e => e.id === id)
    || BOSSES.find(e => e.id === id);
}

/**
 * 주어진 시간(분)에 스폰 가능한 잡몹 목록을 반환한다.
 * @param {number} minuteElapsed - 경과 시간 (분)
 * @returns {Array} 스폰 가능한 적 배열
 */
export function getAvailableEnemies(minuteElapsed) {
  return ENEMIES.filter(e => e.spawnFrom <= minuteElapsed);
}
