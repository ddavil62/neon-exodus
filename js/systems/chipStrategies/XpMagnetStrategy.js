/**
 * @fileoverview XP 자석 칩 전략.
 * 공격 없이 플레이어 주변을 호버링하며, 광범위하게 XP 젬을 흡수한다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';

// ── XpMagnetStrategy 클래스 ──

export default class XpMagnetStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('xp_magnet', grade);
    /** @type {number} 흡수 반경 (px) */
    this.magnetRadius = vals ? vals.magnetRadius : 150;
  }

  /**
   * 플레이어 주변 호버링 + XP 젬 광역 흡수.
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
    const targetX = player.x + Math.cos(angle) * 50;
    const targetY = player.y + Math.sin(angle) * 50;

    const dx = targetX - gfx.x;
    const dy = targetY - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = Math.min(stats.moveSpeed * deltaSec, dist);
      gfx.setPosition(gfx.x + (dx / dist) * speed, gfx.y + (dy / dist) * speed);
    }

    // XP 젬 흡수: 드론 위치 기준 반경 내 젬을 플레이어에게 끌어당김
    if (scene.xpGemPool) {
      const radius = this.magnetRadius;
      scene.xpGemPool.forEach((gem) => {
        if (!gem.active) return;
        const gemDx = gem.x - gfx.x;
        const gemDy = gem.y - gfx.y;
        const gemDist = Math.sqrt(gemDx * gemDx + gemDy * gemDy);

        if (gemDist < radius) {
          // 플레이어 방향으로 끌어당김
          const toDx = player.x - gem.x;
          const toDy = player.y - gem.y;
          const toDist = Math.sqrt(toDx * toDx + toDy * toDy);

          if (toDist > 5) {
            const pullSpeed = 300 * deltaSec;
            gem.x += (toDx / toDist) * pullSpeed;
            gem.y += (toDy / toDist) * pullSpeed;
          }
        }
      });
    }
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    // 추가 초기화 없음
  }

  /**
   * 드론 파괴 시 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    // 추가 정리 없음
  }
}
