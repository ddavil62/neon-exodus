/**
 * @fileoverview 캐릭터 데이터 테이블.
 * MVP 캐릭터(에이전트) + 이후 캐릭터 4명(Phase 3+)의 데이터를 정의한다.
 */

/**
 * 전체 캐릭터 데이터.
 * @type {Array<{id: string, spriteKey: string, nameKey: string, descKey: string, passiveKey: string, startWeapon: string, uniquePassive: Object|null, unlockCondition: Object|null, phase: number}>}
 */
export const CHARACTERS = [
  {
    id: 'agent',
    spriteKey: 'player',       // 기존 에셋 파일명 호환 (player.png / player_walk.png)
    nameKey: 'character.agent.name',
    descKey: 'character.agent.desc',
    passiveKey: 'character.agent.passive',
    startWeapon: 'blaster',
    uniquePassive: null,
    unlockCondition: null,  // 기본 제공
    phase: 1,
  },
  {
    id: 'sniper',
    spriteKey: 'sniper',
    nameKey: 'character.sniper.name',
    descKey: 'character.sniper.desc',
    passiveKey: 'character.sniper.passive',
    unlockKey: 'character.sniper.unlock',
    startWeapon: 'laser_gun',
    uniquePassive: {
      stat: 'critDamageMultiplier',
      value: 0.30,
    },
    unlockCondition: {
      type: 'totalKills',
      value: 5000,
    },
    phase: 3,
  },
  {
    id: 'engineer',
    spriteKey: 'engineer',
    nameKey: 'character.engineer.name',
    descKey: 'character.engineer.desc',
    passiveKey: 'character.engineer.passive',
    unlockKey: 'character.engineer.unlock',
    startWeapon: 'drone',
    uniquePassive: {
      stat: 'droneSummonBonus',
      value: 1,
    },
    unlockCondition: {
      type: 'totalClears',
      value: 10,
    },
    phase: 3,
  },
  {
    id: 'berserker',
    spriteKey: 'berserker',
    nameKey: 'character.berserker.name',
    descKey: 'character.berserker.desc',
    passiveKey: 'character.berserker.passive',
    unlockKey: 'character.berserker.unlock',
    startWeapon: 'electric_chain',
    uniquePassive: {
      stat: 'lowHpAttackBonus',
      value: 0.40,
      hpThreshold: 0.50,
    },
    unlockCondition: {
      type: 'totalBossKills',
      value: 10,
    },
    phase: 3,
  },
  {
    id: 'medic',
    spriteKey: 'medic',
    nameKey: 'character.medic.name',
    descKey: 'character.medic.desc',
    passiveKey: 'character.medic.passive',
    unlockKey: 'character.medic.unlock',
    startWeapon: 'blaster',
    uniquePassive: {
      stat: 'hpRegenMultiplier',
      value: 2.0,
      maxHpPenalty: 0.30,
    },
    unlockCondition: {
      type: 'totalSurviveMinutes',
      value: 500,
    },
    phase: 4,
  },
  {
    id: 'hidden',
    spriteKey: 'hidden',
    nameKey: 'character.hidden.name',
    descKey: 'character.hidden.desc',
    passiveKey: 'character.hidden.passive',
    unlockKey: 'character.hidden.unlock',
    startWeapon: 'blaster',
    uniquePassive: {
      stat: 'weaponMaster',
      extraWeaponSlots: 2,
      weaponChoiceBias: 2.0,
    },
    unlockCondition: {
      type: 'allCharactersUnlocked',
      characters: ['sniper', 'engineer', 'berserker'],
    },
    phase: 4,
  },
];

/**
 * ID로 캐릭터 데이터를 조회한다.
 * @param {string} id - 캐릭터 ID
 * @returns {Object|undefined} 캐릭터 데이터
 */
export function getCharacterById(id) {
  return CHARACTERS.find(c => c.id === id);
}

/**
 * 해금된 캐릭터만 반환한다.
 * @param {Object} saveData - 세이브 데이터 (unlockedCharacters 배열 포함)
 * @returns {Array} 해금된 캐릭터 배열
 */
export function getUnlockedCharacters(saveData) {
  const unlocked = saveData?.unlockedCharacters || ['agent'];
  return CHARACTERS.filter(c => unlocked.includes(c.id));
}
