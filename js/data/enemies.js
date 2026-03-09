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
    hp: 10,
    speed: 120,
    contactDamage: 3,
    xp: 1,
    spawnFrom: 0,
    traits: ['swarm'],
    size: 24,
  },
  {
    id: 'scout_bot',
    nameKey: 'enemy.scout_bot.name',
    descKey: 'enemy.scout_bot.desc',
    hp: 20,
    speed: 80,
    contactDamage: 5,
    xp: 2,
    spawnFrom: 0,
    traits: ['linear_chase'],
    size: 24,
  },
  {
    id: 'spark_drone',
    nameKey: 'enemy.spark_drone.name',
    descKey: 'enemy.spark_drone.desc',
    hp: 15,
    speed: 110,
    contactDamage: 4,
    xp: 2,
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
    hp: 60,
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
    hp: 30,
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
    hp: 40,
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
    hp: 25,
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
    hp: 120,
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
    hp: 35,
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
    hp: 50,
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
    hp: 300,
    speed: 40,
    contactDamage: 15,
    xp: 30,
    spawnAt: [180, 420],  // 3분, 7분
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
    hp: 500,
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
    hp: 800,
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
    hp: 1500,
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
    hp: 3000,
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
