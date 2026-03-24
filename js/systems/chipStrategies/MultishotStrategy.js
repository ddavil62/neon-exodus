/**
 * @fileoverview 멀티샷 칩 전략.
 * N방향 부채꼴로 동시 발사한다. 등급에 따라 발사 수가 증가한다.
 */

import DefaultStrategy from './DefaultStrategy.js';
import { getChipGradeValues } from '../../data/droneChips.js';

// ── MultishotStrategy 클래스 ──

export default class MultishotStrategy extends DefaultStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    super(droneSystem, grade);
    const vals = getChipGradeValues('multishot', grade);
    /** @type {number} 동시 발사 수 */
    this.shotCount = vals ? vals.shotCount : 2;
  }

  /**
   * 선회 공격 + N방향 부채꼴 발사.
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
          this._fireMultishot(drone, drone.targetEnemy, stats);
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

  /**
   * N방향 부채꼴 발사를 수행한다.
   * @param {Object} drone - 드론 데이터
   * @param {Object} target - 타겟 적
   * @param {Object} stats - 드론 스탯
   * @private
   */
  _fireMultishot(drone, target, stats) {
    const gfx = drone.gfx;
    const dx = target.x - gfx.x;
    const dy = target.y - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const baseAngle = Math.atan2(dy, dx);
    // 부채꼴 총 각도 (shot 수에 비례, 최대 60도)
    const spreadAngle = Math.min(Math.PI / 3, (this.shotCount - 1) * (Math.PI / 12));
    const step = this.shotCount > 1 ? spreadAngle / (this.shotCount - 1) : 0;
    const startAngle = baseAngle - spreadAngle / 2;

    for (let i = 0; i < this.shotCount; i++) {
      const angle = this.shotCount > 1 ? startAngle + step * i : baseAngle;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      // 첫 발만 사운드 재생, 나머지는 스킵
      this.system.fireDrone(drone, target, {
        overrideDir: { x: dirX, y: dirY },
        skipSound: i > 0,
      });
    }
  }
}
