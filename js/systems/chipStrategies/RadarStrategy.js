/**
 * @fileoverview 레이더 칩 전략.
 * 패시브 효과로 적 탐지 범위를 확장한다. 드론은 공격하지 않고 호버링한다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';

// ── RadarStrategy 클래스 ──

export default class RadarStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('radar', grade);
    /** @type {number} 탐지 범위 배율 */
    this.rangeMultiplier = vals ? vals.rangeMultiplier : 1.3;
  }

  /**
   * 패시브 호버링. 탐지 범위 확장은 DroneCompanionSystem에서 참조.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    // 플레이어 주변 호버링
    const angle = this.system._droneHoverAngle + drone.hoverOffset;
    const targetX = player.x + Math.cos(angle) * 55;
    const targetY = player.y + Math.sin(angle) * 55;

    const dx = targetX - gfx.x;
    const dy = targetY - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = Math.min(stats.moveSpeed * deltaSec, dist);
      gfx.setPosition(gfx.x + (dx / dist) * speed, gfx.y + (dy / dist) * speed);
    }
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    // 패시브 효과이므로 추가 초기화 없음
  }

  /**
   * 드론 파괴 시 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    // 패시브 효과이므로 추가 정리 없음
  }
}
