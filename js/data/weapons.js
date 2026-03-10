/**
 * @fileoverview 무기 데이터 테이블.
 * 블래스터(Lv1~8) 전체 데이터와 나머지 6종 무기의 데이터 구조를 정의한다.
 * 무기 진화 레시피도 구조만 준비한다.
 */

// ── 블래스터: MVP 무기 (Lv1~Lv8) ──

/**
 * 블래스터 레벨별 데이터.
 * 데미지: +5/Lv (10~45), 쿨다운: 500→250ms, 투사체 속도: 400→500, 관통: 1→2(Lv8)
 * @type {Array<{level: number, damage: number, cooldown: number, projectileSpeed: number, pierce: number, range: number}>}
 */
export const BLASTER_LEVELS = [
  { level: 1, damage: 10, cooldown: 500,  projectileSpeed: 400, pierce: 1, range: 320 },
  { level: 2, damage: 15, cooldown: 464,  projectileSpeed: 414, pierce: 1, range: 320 },
  { level: 3, damage: 20, cooldown: 428,  projectileSpeed: 428, pierce: 1, range: 320 },
  { level: 4, damage: 25, cooldown: 392,  projectileSpeed: 443, pierce: 1, range: 320 },
  { level: 5, damage: 30, cooldown: 357,  projectileSpeed: 457, pierce: 1, range: 320 },
  { level: 6, damage: 35, cooldown: 321,  projectileSpeed: 471, pierce: 1, range: 320 },
  { level: 7, damage: 40, cooldown: 285,  projectileSpeed: 486, pierce: 1, range: 320 },
  { level: 8, damage: 45, cooldown: 250,  projectileSpeed: 500, pierce: 2, range: 320 },
];

// ── 레이저건: Phase 2 빔 무기 (Lv1~Lv8) ──

/**
 * 레이저건 레벨별 데이터.
 * tickDamage: 빔 활성 동안 1회 데미지 (attackMultiplier 적용)
 * cooldown: 빔 비활성 대기 시간 (ms)
 * duration: 빔 활성 지속 시간 (ms)
 * range: 빔 길이 (px)
 * @type {Array<{level: number, tickDamage: number, cooldown: number, duration: number, range: number}>}
 */
export const LASER_GUN_LEVELS = [
  { level: 1, tickDamage: 8,  cooldown: 2000, duration: 300, range: 300 },
  { level: 2, tickDamage: 11, cooldown: 1900, duration: 320, range: 310 },
  { level: 3, tickDamage: 14, cooldown: 1800, duration: 340, range: 320 },
  { level: 4, tickDamage: 17, cooldown: 1700, duration: 360, range: 330 },
  { level: 5, tickDamage: 20, cooldown: 1600, duration: 380, range: 360 },
  { level: 6, tickDamage: 24, cooldown: 1500, duration: 420, range: 390 },
  { level: 7, tickDamage: 29, cooldown: 1350, duration: 460, range: 420 },
  { level: 8, tickDamage: 35, cooldown: 1200, duration: 500, range: 450 },
];

// ── 플라즈마 오브: Phase 2 오비탈 무기 (Lv1~Lv8) ──

/**
 * 플라즈마 오브 레벨별 데이터.
 * orbCount: 공전 오브 개수
 * tickDamage: 오브 충돌 시 1회 데미지 (attackMultiplier 적용)
 * orbRadius: 오브 충돌 반경 (px)
 * angularSpeed: 초당 공전 속도 (라디안)
 * tickInterval: 데미지 적용 간격 (ms)
 * @type {Array<{level: number, orbCount: number, tickDamage: number, orbRadius: number, angularSpeed: number, tickInterval: number}>}
 */
export const PLASMA_ORB_LEVELS = [
  { level: 1, orbCount: 1, tickDamage: 6,  orbRadius: 55, angularSpeed: 4.0,  tickInterval: 500 },
  { level: 2, orbCount: 1, tickDamage: 9,  orbRadius: 58, angularSpeed: 5.4,  tickInterval: 480 },
  { level: 3, orbCount: 2, tickDamage: 12, orbRadius: 60, angularSpeed: 6.9,  tickInterval: 460 },
  { level: 4, orbCount: 2, tickDamage: 15, orbRadius: 63, angularSpeed: 8.3,  tickInterval: 440 },
  { level: 5, orbCount: 2, tickDamage: 18, orbRadius: 66, angularSpeed: 9.7,  tickInterval: 420 },
  { level: 6, orbCount: 3, tickDamage: 22, orbRadius: 70, angularSpeed: 11.1, tickInterval: 390 },
  { level: 7, orbCount: 3, tickDamage: 27, orbRadius: 78, angularSpeed: 12.6, tickInterval: 350 },
  { level: 8, orbCount: 4, tickDamage: 32, orbRadius: 90, angularSpeed: 14.0, tickInterval: 300 },
];

/** 플라즈마 오브 공전 반경 (플레이어 중심으로부터의 거리, px) */
export const ORBIT_RADIUS = 70;

// ── 전기 체인: Phase 3 체인 무기 (Lv1~Lv8) ──

/**
 * 전기 체인 레벨별 데이터.
 * damage: 초기 타격 데미지 (attackMultiplier 적용)
 * cooldown: 발사 간격 (ms)
 * chainCount: 연쇄 타격 횟수
 * chainRange: 체인이 연결될 수 있는 최대 거리 (px)
 * chainDecay: 체인마다 피해 감소 비율 (0~1, 높을수록 감소 적음)
 * @type {Array<{level: number, damage: number, cooldown: number, chainCount: number, chainRange: number, chainDecay: number}>}
 */
export const ELECTRIC_CHAIN_LEVELS = [
  { level: 1, damage: 20, cooldown: 1200, chainCount: 2, chainRange: 120, chainDecay: 0.80 },
  { level: 2, damage: 25, cooldown: 1150, chainCount: 2, chainRange: 130, chainDecay: 0.81 },
  { level: 3, damage: 30, cooldown: 1100, chainCount: 3, chainRange: 140, chainDecay: 0.82 },
  { level: 4, damage: 37, cooldown: 1050, chainCount: 3, chainRange: 150, chainDecay: 0.83 },
  { level: 5, damage: 44, cooldown: 1000, chainCount: 4, chainRange: 160, chainDecay: 0.84 },
  { level: 6, damage: 52, cooldown: 950,  chainCount: 5, chainRange: 175, chainDecay: 0.85 },
  { level: 7, damage: 60, cooldown: 900,  chainCount: 5, chainRange: 190, chainDecay: 0.85 },
  { level: 8, damage: 68, cooldown: 800,  chainCount: 6, chainRange: 200, chainDecay: 0.86 },
];

// ── 미사일: Phase 3 호밍 무기 (Lv1~Lv8) ──

/**
 * 미사일 레벨별 데이터.
 * damage: 폭발 데미지 (attackMultiplier 적용)
 * cooldown: 발사 간격 (ms)
 * speed: 미사일 이동 속도 (px/s)
 * turnSpeed: 매 프레임 방향 보정 속도 (rad/s)
 * explosionRadius: 폭발 범위 반경 (px)
 * range: 최대 비행 거리 (px). 초과 시 자폭
 * @type {Array<{level: number, damage: number, cooldown: number, speed: number, turnSpeed: number, explosionRadius: number, range: number}>}
 */
export const MISSILE_LEVELS = [
  { level: 1, damage: 25,  cooldown: 2500, speed: 200, turnSpeed: 1.5, explosionRadius: 50, range: 400 },
  { level: 2, damage: 32,  cooldown: 2400, speed: 210, turnSpeed: 1.7, explosionRadius: 55, range: 420 },
  { level: 3, damage: 40,  cooldown: 2300, speed: 220, turnSpeed: 1.9, explosionRadius: 60, range: 440 },
  { level: 4, damage: 50,  cooldown: 2100, speed: 235, turnSpeed: 2.1, explosionRadius: 65, range: 460 },
  { level: 5, damage: 60,  cooldown: 2000, speed: 250, turnSpeed: 2.3, explosionRadius: 70, range: 480 },
  { level: 6, damage: 72,  cooldown: 1800, speed: 260, turnSpeed: 2.5, explosionRadius: 80, range: 500 },
  { level: 7, damage: 85,  cooldown: 1600, speed: 275, turnSpeed: 2.7, explosionRadius: 88, range: 525 },
  { level: 8, damage: 100, cooldown: 1400, speed: 290, turnSpeed: 2.8, explosionRadius: 95, range: 550 },
];

// ── 드론: Phase 4 소환 무기 (Lv1~Lv8) ──

/**
 * 드론 레벨별 데이터.
 * droneCount: 동시 활성 드론 수
 * damage: 드론 한 발당 데미지 (attackMultiplier 적용)
 * cooldown: 드론 발사 간격 (ms)
 * shootRange: 발사 사거리 (px)
 * moveSpeed: 드론 이동 속도 (px/s)
 * @type {Array<{level: number, droneCount: number, damage: number, cooldown: number, shootRange: number, moveSpeed: number}>}
 */
export const DRONE_LEVELS = [
  { level: 1, droneCount: 1, damage: 12, cooldown: 1000, shootRange: 120, moveSpeed: 450 },
  { level: 2, droneCount: 1, damage: 18, cooldown: 950,  shootRange: 125, moveSpeed: 474 },
  { level: 3, droneCount: 2, damage: 22, cooldown: 900,  shootRange: 130, moveSpeed: 495 },
  { level: 4, droneCount: 2, damage: 28, cooldown: 850,  shootRange: 135, moveSpeed: 516 },
  { level: 5, droneCount: 3, damage: 34, cooldown: 800,  shootRange: 140, moveSpeed: 540 },
  { level: 6, droneCount: 3, damage: 40, cooldown: 750,  shootRange: 145, moveSpeed: 564 },
  { level: 7, droneCount: 4, damage: 46, cooldown: 700,  shootRange: 150, moveSpeed: 585 },
  { level: 8, droneCount: 4, damage: 50, cooldown: 600,  shootRange: 160, moveSpeed: 600 },
];

// ── EMP 폭발: Phase 4 범위 무기 (Lv1~Lv8) ──

/**
 * EMP 폭발 레벨별 데이터.
 * damage: 폭발 데미지 (attackMultiplier 적용)
 * cooldown: 발동 간격 (ms)
 * radius: 폭발 반경 (px)
 * slowFactor: 둔화 시 적 속도 비율 (0.35 = 원래의 35%)
 * slowDuration: 둔화 지속 시간 (ms)
 * @type {Array<{level: number, damage: number, cooldown: number, radius: number, slowFactor: number, slowDuration: number}>}
 */
export const EMP_BLAST_LEVELS = [
  { level: 1, damage: 15, cooldown: 5000, radius: 100, slowFactor: 0.35, slowDuration: 2000 },
  { level: 2, damage: 20, cooldown: 4800, radius: 110, slowFactor: 0.37, slowDuration: 2100 },
  { level: 3, damage: 25, cooldown: 4600, radius: 120, slowFactor: 0.39, slowDuration: 2200 },
  { level: 4, damage: 32, cooldown: 4300, radius: 130, slowFactor: 0.41, slowDuration: 2300 },
  { level: 5, damage: 40, cooldown: 4000, radius: 145, slowFactor: 0.43, slowDuration: 2400 },
  { level: 6, damage: 50, cooldown: 3700, radius: 160, slowFactor: 0.45, slowDuration: 2500 },
  { level: 7, damage: 62, cooldown: 3400, radius: 175, slowFactor: 0.48, slowDuration: 2600 },
  { level: 8, damage: 75, cooldown: 3000, radius: 185, slowFactor: 0.50, slowDuration: 2800 },
];

// ── 무기 정의 ──

/**
 * 전체 무기 데이터.
 * @type {Array<{id: string, nameKey: string, descKey: string, type: string, maxLevel: number, levels: Array, phase: number}>}
 */
export const WEAPONS = [
  {
    id: 'blaster',
    nameKey: 'weapon.blaster.name',
    descKey: 'weapon.blaster.desc',
    type: 'projectile',
    maxLevel: 8,
    levels: BLASTER_LEVELS,
    phase: 1,
  },
  {
    id: 'laser_gun',
    nameKey: 'weapon.laser_gun.name',
    descKey: 'weapon.laser_gun.desc',
    type: 'beam',
    maxLevel: 8,
    levels: LASER_GUN_LEVELS,
    phase: 2,
  },
  {
    id: 'plasma_orb',
    nameKey: 'weapon.plasma_orb.name',
    descKey: 'weapon.plasma_orb.desc',
    type: 'orbital',
    maxLevel: 8,
    levels: PLASMA_ORB_LEVELS,
    phase: 2,
  },
  {
    id: 'electric_chain',
    nameKey: 'weapon.electric_chain.name',
    descKey: 'weapon.electric_chain.desc',
    type: 'chain',
    maxLevel: 8,
    levels: ELECTRIC_CHAIN_LEVELS,
    phase: 3,
  },
  {
    id: 'missile',
    nameKey: 'weapon.missile.name',
    descKey: 'weapon.missile.desc',
    type: 'homing',
    maxLevel: 8,
    levels: MISSILE_LEVELS,
    phase: 3,
  },
  {
    id: 'drone',
    nameKey: 'weapon.drone.name',
    descKey: 'weapon.drone.desc',
    type: 'summon',
    maxLevel: 8,
    levels: DRONE_LEVELS,
    phase: 4,
  },
  {
    id: 'emp_blast',
    nameKey: 'weapon.emp_blast.name',
    descKey: 'weapon.emp_blast.desc',
    type: 'aoe',
    maxLevel: 8,
    levels: EMP_BLAST_LEVELS,
    phase: 4,
  },
];

// ── 무기 진화 레시피 (Phase 3부터 활성화) ──

/**
 * 무기 진화(합성) 레시피.
 * 무기 최대 레벨 + 특정 패시브 최대 레벨 = 진화 무기.
 * @type {Array<{weaponId: string, passiveId: string, resultId: string, resultNameKey: string, resultDescKey: string}>}
 */
export const WEAPON_EVOLUTIONS = [
  {
    weaponId: 'blaster',
    passiveId: 'aim_module',
    resultId: 'precision_cannon',
    resultNameKey: 'weapon.evolution.precisionCannon.name',
    resultDescKey: 'weapon.evolution.precisionCannon.desc',
  },
  {
    weaponId: 'electric_chain',
    passiveId: 'overclock',
    resultId: 'plasma_storm',
    resultNameKey: 'weapon.evolution.plasmaStorm.name',
    resultDescKey: 'weapon.evolution.plasmaStorm.desc',
  },
  {
    weaponId: 'missile',
    passiveId: 'critical_chip',
    resultId: 'nuke_missile',
    resultNameKey: 'weapon.evolution.nukeMissile.name',
    resultDescKey: 'weapon.evolution.nukeMissile.desc',
  },
];

// ── 진화 무기 데이터 ──

/**
 * 진화 무기 스탯 데이터.
 * 진화 성공 시 기존 무기를 이 데이터로 교체한다.
 * @type {Array<{id: string, nameKey: string, descKey: string, type: string, stats: Object}>}
 */
export const EVOLVED_WEAPONS = [
  {
    id: 'precision_cannon',
    nameKey: 'weapon.evolution.precisionCannon.name',
    descKey: 'weapon.evolution.precisionCannon.desc',
    type: 'projectile',
    stats: {
      damage: 60, cooldown: 200, projectileSpeed: 550, pierce: 99, range: 400,
      multiShot: 3,
    },
  },
  {
    id: 'plasma_storm',
    nameKey: 'weapon.evolution.plasmaStorm.name',
    descKey: 'weapon.evolution.plasmaStorm.desc',
    type: 'chain',
    stats: {
      damage: 90, cooldown: 600, chainCount: 10, chainRange: 250, chainDecay: 0.92,
    },
  },
  {
    id: 'nuke_missile',
    nameKey: 'weapon.evolution.nukeMissile.name',
    descKey: 'weapon.evolution.nukeMissile.desc',
    type: 'homing',
    stats: {
      damage: 150, cooldown: 1000, speed: 320, turnSpeed: 3.5, explosionRadius: 140, range: 600,
    },
  },
];

/**
 * ID로 무기 데이터를 조회한다.
 * @param {string} id - 무기 ID
 * @returns {Object|undefined} 무기 데이터
 */
export function getWeaponById(id) {
  return WEAPONS.find(w => w.id === id);
}

/**
 * 현재 Phase에서 사용 가능한 무기만 반환한다.
 * @param {number} phase - 현재 Phase
 * @returns {Array} 사용 가능한 무기 배열
 */
export function getAvailableWeapons(phase = 1) {
  return WEAPONS.filter(w => w.phase <= phase);
}

/**
 * 진화 무기 ID로 진화 무기 데이터를 조회한다.
 * @param {string} id - 진화 무기 ID
 * @returns {Object|undefined} 진화 무기 데이터
 */
export function getEvolvedWeaponById(id) {
  return EVOLVED_WEAPONS.find(w => w.id === id);
}
