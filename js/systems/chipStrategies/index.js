/**
 * @fileoverview 칩 전략 레지스트리.
 * 칩 ID로 전략 클래스를 매핑하고, 전략 인스턴스를 생성하는 팩토리 함수를 제공한다.
 */

import DefaultStrategy from './DefaultStrategy.js';
import PierceStrategy from './PierceStrategy.js';
import MultishotStrategy from './MultishotStrategy.js';
import LaserStrategy from './LaserStrategy.js';
import KamikazeStrategy from './KamikazeStrategy.js';
import XpMagnetStrategy from './XpMagnetStrategy.js';
import TauntStrategy from './TauntStrategy.js';
import RepairStrategy from './RepairStrategy.js';
import RadarStrategy from './RadarStrategy.js';

// ── 전략 매핑 ──

/** @type {Object.<string, Function>} 칩 ID → 전략 클래스 맵 */
const STRATEGY_MAP = {
  pierce:    PierceStrategy,
  multishot: MultishotStrategy,
  laser:     LaserStrategy,
  kamikaze:  KamikazeStrategy,
  xp_magnet: XpMagnetStrategy,
  taunt:     TauntStrategy,
  repair:    RepairStrategy,
  radar:     RadarStrategy,
};

// ── 팩토리 함수 ──

/**
 * 칩 ID와 등급으로 전략 인스턴스를 생성한다.
 * 알 수 없는 칩 ID이면 DefaultStrategy를 반환한다.
 * @param {import('../DroneCompanionSystem.js').default} droneSystem - 드론 시스템 참조
 * @param {string|null} chipId - 칩 ID (null이면 기본 전략)
 * @param {string|null} grade - 등급
 * @returns {DefaultStrategy} 전략 인스턴스
 */
export function createStrategy(droneSystem, chipId, grade) {
  if (!chipId) {
    return new DefaultStrategy(droneSystem, null);
  }
  const Cls = STRATEGY_MAP[chipId] || DefaultStrategy;
  return new Cls(droneSystem, grade);
}

export { DefaultStrategy };
