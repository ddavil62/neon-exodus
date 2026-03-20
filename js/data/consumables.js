/**
 * @fileoverview 소모성 아이템 6종 데이터 정의.
 *
 * 적 처치 시 확률적으로 드롭되는 소모성 아이템의 ID, i18n 키,
 * 등급별 드롭률, 텍스처 키, 테마 색상을 정의한다.
 */

// ── 소모성 아이템 데이터 배열 ──

/**
 * 소모성 아이템 6종 데이터.
 * @type {Array<{
 *   id: string,
 *   nameKey: string,
 *   descKey: string,
 *   dropChance: { normal: number, normalLowHp: number, miniboss: number, boss: number },
 *   textureKey: string,
 *   tintColor: number
 * }>}
 */
export const CONSUMABLES = [
  {
    id: 'nano_repair',
    nameKey: 'consumable.nano_repair.name',
    descKey: 'consumable.nano_repair.desc',
    dropChance: { normal: 0.008, normalLowHp: 0.025, miniboss: 0.30, boss: 0.80 },
    maxOnField: 2,  // 체력 회복만 2개 허용
    textureKey: 'consumable_nano_repair',
    tintColor: 0x39FF14,
  },
  {
    id: 'mag_pulse',
    nameKey: 'consumable.mag_pulse.name',
    descKey: 'consumable.mag_pulse.desc',
    dropChance: { normal: 0.001, normalLowHp: 0.001, miniboss: 0.50, boss: 1.00 },
    maxOnField: 1,
    textureKey: 'consumable_mag_pulse',
    tintColor: 0x00FFFF,
  },
  {
    id: 'emp_bomb',
    nameKey: 'consumable.emp_bomb.name',
    descKey: 'consumable.emp_bomb.desc',
    dropChance: { normal: 0.0005, normalLowHp: 0.0005, miniboss: 0.05, boss: 0.30 },
    maxOnField: 1,
    textureKey: 'consumable_emp_bomb',
    tintColor: 0x4488FF,
  },
  {
    id: 'credit_chip',
    nameKey: 'consumable.credit_chip.name',
    descKey: 'consumable.credit_chip.desc',
    dropChance: { normal: 0.003, normalLowHp: 0.003, miniboss: 0.15, boss: 0.50 },
    maxOnField: 1,
    textureKey: 'consumable_credit_chip',
    tintColor: 0xFFDD00,
  },
  {
    id: 'overclock',
    nameKey: 'consumable.overclock.name',
    descKey: 'consumable.overclock.desc',
    dropChance: { normal: 0.002, normalLowHp: 0.002, miniboss: 0.10, boss: 0.20 },
    maxOnField: 1,
    textureKey: 'consumable_overclock',
    tintColor: 0xFF6600,
  },
  {
    id: 'shield_battery',
    nameKey: 'consumable.shield_battery.name',
    descKey: 'consumable.shield_battery.desc',
    dropChance: { normal: 0.0015, normalLowHp: 0.0015, miniboss: 0.08, boss: 0.20 },
    maxOnField: 1,
    textureKey: 'consumable_shield_battery',
    tintColor: 0xAA44FF,
  },
];

// ── ID → 데이터 맵 ──

/**
 * 아이템 ID를 키로 하는 빠른 조회 맵.
 * @type {Object.<string, Object>}
 */
export const CONSUMABLE_MAP = {};
CONSUMABLES.forEach((c) => { CONSUMABLE_MAP[c.id] = c; });
