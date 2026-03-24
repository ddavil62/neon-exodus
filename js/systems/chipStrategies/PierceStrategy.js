/**
 * @fileoverview 관통 칩 전략.
 * DefaultStrategy와 동일한 선회 공격을 하되, 투사체에 관통 속성을 부여한다.
 */

import DefaultStrategy from './DefaultStrategy.js';
import { getChipGradeValues } from '../../data/droneChips.js';

// ── PierceStrategy 클래스 ──

export default class PierceStrategy extends DefaultStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    super(droneSystem, grade);
    const vals = getChipGradeValues('pierce', grade);
    /** @type {number} 관통 횟수 */
    this.pierceCount = vals ? vals.pierceCount : 2;
  }

  /**
   * 선회 공격 + 관통 투사체 발사.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    drone.targetEnemy = this.system.findClosestEnemy(
      player.x, player.y, stats.shootRange * 2
    );

    if (drone.targetEnemy && drone.targetEnemy.active) {
      const dx = drone.targetEnemy.x - gfx.x;
      const dy = drone.targetEnemy.y - gfx.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const orbitRadius = stats.shootRange * 0.6;

      if (dist > orbitRadius + 30) {
        const moveX = (dx / dist) * stats.moveSpeed * deltaSec;
        const moveY = (dy / dist) * stats.moveSpeed * deltaSec;
        gfx.setPosition(gfx.x + moveX, gfx.y + moveY);
      } else {
        const orbitSpeed = 1.8;
        drone.orbitPhase += orbitSpeed * deltaSec;
        const targetX = drone.targetEnemy.x + Math.cos(drone.orbitPhase) * orbitRadius;
        const targetY = drone.targetEnemy.y + Math.sin(drone.orbitPhase) * orbitRadius;

        const toDx = targetX - gfx.x;
        const toDy = targetY - gfx.y;
        const toDist = Math.sqrt(toDx * toDx + toDy * toDy);
        if (toDist > 1) {
          const speed = Math.min(stats.moveSpeed * deltaSec, toDist);
          gfx.setPosition(gfx.x + (toDx / toDist) * speed, gfx.y + (toDy / toDist) * speed);
        }
      }

      if (dist <= stats.shootRange) {
        drone.lastFired += delta;
        const effectiveCooldown = stats.cooldown * (player.cooldownMultiplier || 1);
        if (drone.lastFired >= effectiveCooldown) {
          drone.lastFired = 0;
          // 관통 옵션 전달
          this.system.fireDrone(drone, drone.targetEnemy, { pierceCount: this.pierceCount });
        }
      }
    } else {
      // 호버링
      const angle = this.system._droneHoverAngle + drone.hoverOffset;
      const targetX = player.x + Math.cos(angle) * 60;
      const targetY = player.y + Math.sin(angle) * 60;

      const hDx = targetX - gfx.x;
      const hDy = targetY - gfx.y;
      const hDist = Math.sqrt(hDx * hDx + hDy * hDy);

      if (hDist > 2) {
        const speed = Math.min(stats.moveSpeed * deltaSec, hDist);
        gfx.setPosition(gfx.x + (hDx / hDist) * speed, gfx.y + (hDy / hDist) * speed);
      }
      drone.lastFired = 0;
    }
  }
}
