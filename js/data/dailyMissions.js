/**
 * @fileoverview 일일 미션 풀 데이터 및 보상 상수.
 * 5개 카테고리(kill, survival, collection, weapon, special)에서 총 32종의 미션을 정의한다.
 */

// ── 미션 풀 ──

/**
 * 일일 미션 데이터 풀.
 * 매일 이 풀에서 시드 기반 PRNG로 3개 미션을 선택한다.
 * @type {Array<{id: string, category: string, nameKey: string, descKey: string, target: number, reward: Object}>}
 */
export const DAILY_MISSION_POOL = [
  // ── kill (8종) ──
  { id: 'kill_100',        category: 'kill',       nameKey: 'daily.kill100.name',        descKey: 'daily.kill100.desc',        target: 100,   reward: { credits: 150, scrap: 30 } },
  { id: 'kill_300',        category: 'kill',       nameKey: 'daily.kill300.name',        descKey: 'daily.kill300.desc',        target: 300,   reward: { credits: 300, scrap: 50 } },
  { id: 'kill_500',        category: 'kill',       nameKey: 'daily.kill500.name',        descKey: 'daily.kill500.desc',        target: 500,   reward: { credits: 600 } },
  { id: 'kill_1000',       category: 'kill',       nameKey: 'daily.kill1000.name',       descKey: 'daily.kill1000.desc',       target: 1000,  reward: { credits: 1000 } },
  { id: 'kill_boss_1',     category: 'kill',       nameKey: 'daily.killBoss1.name',      descKey: 'daily.killBoss1.desc',      target: 1,     reward: { credits: 300 } },
  { id: 'kill_boss_3',     category: 'kill',       nameKey: 'daily.killBoss3.name',      descKey: 'daily.killBoss3.desc',      target: 3,     reward: { credits: 500 } },
  { id: 'kill_miniboss_3', category: 'kill',       nameKey: 'daily.killMiniboss3.name',  descKey: 'daily.killMiniboss3.desc',  target: 3,     reward: { credits: 400 } },
  { id: 'kill_miniboss_5', category: 'kill',       nameKey: 'daily.killMiniboss5.name',  descKey: 'daily.killMiniboss5.desc',  target: 5,     reward: { credits: 600 } },

  // ── survival (6종) ──
  { id: 'survive_5min',    category: 'survival',   nameKey: 'daily.survive5.name',       descKey: 'daily.survive5.desc',       target: 300,   reward: { credits: 150, scrap: 25 } },
  { id: 'survive_10min',   category: 'survival',   nameKey: 'daily.survive10.name',      descKey: 'daily.survive10.desc',      target: 600,   reward: { credits: 300, scrap: 50 } },
  { id: 'survive_15min',   category: 'survival',   nameKey: 'daily.survive15.name',      descKey: 'daily.survive15.desc',      target: 900,   reward: { credits: 600 } },
  { id: 'clear_1',         category: 'survival',   nameKey: 'daily.clear1.name',         descKey: 'daily.clear1.desc',         target: 1,     reward: { credits: 400, scrap: 80 } },
  { id: 'clear_2',         category: 'survival',   nameKey: 'daily.clear2.name',         descKey: 'daily.clear2.desc',         target: 2,     reward: { credits: 600, scrap: 120 } },
  { id: 'run_3',           category: 'survival',   nameKey: 'daily.run3.name',           descKey: 'daily.run3.desc',           target: 3,     reward: { credits: 300, scrap: 50 } },

  // ── collection (6종) ──
  { id: 'earn_credits_500',  category: 'collection', nameKey: 'daily.earnCredits500.name',  descKey: 'daily.earnCredits500.desc',  target: 500,   reward: { credits: 200 } },
  { id: 'earn_credits_2000', category: 'collection', nameKey: 'daily.earnCredits2000.name', descKey: 'daily.earnCredits2000.desc', target: 2000,  reward: { credits: 500 } },
  { id: 'reach_lv_10',       category: 'collection', nameKey: 'daily.reachLv10.name',       descKey: 'daily.reachLv10.desc',       target: 10,    reward: { credits: 200 } },
  { id: 'reach_lv_20',       category: 'collection', nameKey: 'daily.reachLv20.name',       descKey: 'daily.reachLv20.desc',       target: 20,    reward: { credits: 400 } },
  { id: 'reach_lv_30',       category: 'collection', nameKey: 'daily.reachLv30.name',       descKey: 'daily.reachLv30.desc',       target: 30,    reward: { credits: 600 } },
  { id: 'use_consumable_5',  category: 'collection', nameKey: 'daily.useConsumable5.name',  descKey: 'daily.useConsumable5.desc',  target: 5,     reward: { credits: 300 } },

  // ── weapon (6종) ──
  { id: 'fill_slots_4',     category: 'weapon',    nameKey: 'daily.fillSlots4.name',     descKey: 'daily.fillSlots4.desc',     target: 4,  reward: { credits: 300 } },
  { id: 'fill_slots_6',     category: 'weapon',    nameKey: 'daily.fillSlots6.name',     descKey: 'daily.fillSlots6.desc',     target: 6,  reward: { credits: 500 } },
  { id: 'evolve_1',         category: 'weapon',    nameKey: 'daily.evolve1.name',        descKey: 'daily.evolve1.desc',        target: 1,  reward: { credits: 500 } },
  { id: 'evolve_2',         category: 'weapon',    nameKey: 'daily.evolve2.name',        descKey: 'daily.evolve2.desc',        target: 2,  reward: { credits: 800 } },
  { id: 'max_weapon_1',     category: 'weapon',    nameKey: 'daily.maxWeapon1.name',     descKey: 'daily.maxWeapon1.desc',     target: 1,  reward: { credits: 400 } },
  { id: 'collect_passive_3', category: 'weapon',   nameKey: 'daily.collectPassive3.name', descKey: 'daily.collectPassive3.desc', target: 3,  reward: { credits: 300 } },

  // ── special (6종) ──
  { id: 'no_damage_3min',   category: 'special',   nameKey: 'daily.noDamage3.name',       descKey: 'daily.noDamage3.desc',       target: 180, reward: { credits: 500 } },
  { id: 'hard_clear',       category: 'special',   nameKey: 'daily.hardClear.name',       descKey: 'daily.hardClear.desc',       target: 1,   reward: { dataCores: 1 } },
  { id: 'nightmare_clear',  category: 'special',   nameKey: 'daily.nightmareClear.name',  descKey: 'daily.nightmareClear.desc',  target: 1,   reward: { dataCores: 2 } },
  { id: 'use_ultimate_3',   category: 'special',   nameKey: 'daily.useUltimate3.name',    descKey: 'daily.useUltimate3.desc',    target: 3,   reward: { credits: 400 } },
  { id: 'diff_char_2',      category: 'special',   nameKey: 'daily.diffChar2.name',       descKey: 'daily.diffChar2.desc',       target: 2,   reward: { credits: 500 } },
  { id: 'earn_dc_3',        category: 'special',   nameKey: 'daily.earnDc3.name',         descKey: 'daily.earnDc3.desc',         target: 3,   reward: { dataCores: 1 } },
];

// ── 보상 상수 ──

/** 전체 완료 보너스 보상 */
export const DAILY_BONUS_REWARD = { dataCores: 2 };

/** streak 보너스 크레딧 (7일째마다 추가 보너스) */
export const STREAK_BONUS = { credits: 1000, dataCores: 3 };

/** streak 주기 */
export const STREAK_CYCLE = 7;
