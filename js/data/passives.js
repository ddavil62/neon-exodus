/**
 * @fileoverview 패시브 아이템 데이터 테이블.
 * 런 중 레벨업으로 획득하는 패시브 아이템 11종을 정의한다.
 */

/**
 * 패시브 아이템 전체 데이터.
 * @type {Array<{id: string, nameKey: string, descKey: string, detailKey: string, maxLevel: number, stat: string, effectPerLevel: number, icon: string}>}
 */
export const PASSIVES = [
  {
    id: 'booster',
    nameKey: 'passive.booster.name',
    descKey: 'passive.booster.desc',
    detailKey: 'passive.booster.detail',
    maxLevel: 5,
    stat: 'moveSpeed',
    effectPerLevel: 0.08,
    icon: '\u{1F680}', // rocket
  },
  {
    id: 'armor_plate',
    nameKey: 'passive.armor_plate.name',
    descKey: 'passive.armor_plate.desc',
    detailKey: 'passive.armor_plate.detail',
    maxLevel: 5,
    stat: 'defense',
    effectPerLevel: 3,
    icon: '\u{1F6E1}\uFE0F', // shield
  },
  {
    id: 'battery_pack',
    nameKey: 'passive.battery_pack.name',
    descKey: 'passive.battery_pack.desc',
    detailKey: 'passive.battery_pack.detail',
    maxLevel: 5,
    stat: 'maxHp',
    effectPerLevel: 20,
    icon: '\u{1F50B}', // battery
  },
  {
    id: 'overclock',
    nameKey: 'passive.overclock.name',
    descKey: 'passive.overclock.desc',
    detailKey: 'passive.overclock.detail',
    maxLevel: 5,
    stat: 'attackSpeed',
    effectPerLevel: 0.10,
    icon: '\u26A1', // lightning
  },
  {
    id: 'magnet_module',
    nameKey: 'passive.magnet_module.name',
    descKey: 'passive.magnet_module.desc',
    detailKey: 'passive.magnet_module.detail',
    maxLevel: 5,
    stat: 'xpMagnetRadius',
    effectPerLevel: 0.20,
    icon: '\u{1F9F2}', // magnet
  },
  {
    id: 'regen_module',
    nameKey: 'passive.regen_module.name',
    descKey: 'passive.regen_module.desc',
    detailKey: 'passive.regen_module.detail',
    maxLevel: 5,
    stat: 'hpRegen',
    effectPerLevel: 0.5,
    icon: '\u{1FA78}', // drop of blood (regen)
  },
  {
    id: 'aim_module',
    nameKey: 'passive.aim_module.name',
    descKey: 'passive.aim_module.desc',
    detailKey: 'passive.aim_module.detail',
    maxLevel: 5,
    stat: 'projectileRange',
    effectPerLevel: 0.15,
    icon: '\u{1F3AF}', // target
  },
  {
    id: 'critical_chip',
    nameKey: 'passive.critical_chip.name',
    descKey: 'passive.critical_chip.desc',
    detailKey: 'passive.critical_chip.detail',
    maxLevel: 5,
    stat: 'critChance',
    effectPerLevel: 0.05,
    critDamageMultiplier: 1.5,
    icon: '\u2728', // sparkles
  },
  {
    id: 'cooldown_chip',
    nameKey: 'passive.cooldown_chip.name',
    descKey: 'passive.cooldown_chip.desc',
    detailKey: 'passive.cooldown_chip.detail',
    maxLevel: 5,
    stat: 'cooldownReduction',
    effectPerLevel: 0.06,
    icon: '\u23F0', // alarm clock
  },
  {
    id: 'luck_module',
    nameKey: 'passive.luck_module.name',
    descKey: 'passive.luck_module.desc',
    detailKey: 'passive.luck_module.detail',
    maxLevel: 5,
    stat: 'creditDropBonus',
    effectPerLevel: 0.10,
    icon: '\u{1F340}', // four leaf clover
  },
  {
    id: 'damage_amp',
    nameKey: 'passive.damage_amp.name',
    descKey: 'passive.damage_amp.desc',
    detailKey: 'passive.damage_amp.detail',
    maxLevel: 5,
    stat: 'attackDamage',
    effectPerLevel: 0.08,
    icon: '\u{1F4A2}', // anger symbol (💢)
  },
];

/**
 * ID로 패시브 데이터를 조회한다.
 * @param {string} id - 패시브 ID
 * @returns {Object|undefined} 패시브 데이터
 */
export function getPassiveById(id) {
  return PASSIVES.find(p => p.id === id);
}
