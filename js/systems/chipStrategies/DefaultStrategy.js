/**
 * @fileoverview 기본 드론 전략 (칩 미장착 시).
 * 기존 DroneCompanionSystem의 선회 공격 로직을 그대로 유지한다.
 */

// ── DefaultStrategy 클래스 ──

export default class DefaultStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem - 드론 시스템 참조
   * @param {string|null} grade - 등급 (기본 전략은 null)
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string|null} */
    this.grade = grade;
  }

  /**
   * 기본 행동: 적 선회 공격 + 플레이어 호버링.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    // 1. 가장 가까운 적 탐색
    drone.targetEnemy = this.system.findClosestEnemy(
      player.x, player.y, stats.shootRange * 2
    );

    if (drone.targetEnemy && drone.targetEnemy.active) {
      // 2. 타겟 주변을 선회하며 공격
      const dx = drone.targetEnemy.x - gfx.x;
      const dy = drone.targetEnemy.y - gfx.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const orbitRadius = stats.shootRange * 0.6;

      if (dist > orbitRadius + 30) {
        // 궤도 밖이면 접근
        const moveX = (dx / dist) * stats.moveSpeed * deltaSec;
        const moveY = (dy / dist) * stats.moveSpeed * deltaSec;
        gfx.setPosition(gfx.x + moveX, gfx.y + moveY);
      } else {
        // 궤도 선회
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

      // 사거리 내이면 공격
      if (dist <= stats.shootRange) {
        drone.lastFired += delta;
        const effectiveCooldown = stats.cooldown * (player.cooldownMultiplier || 1);
        if (drone.lastFired >= effectiveCooldown) {
          drone.lastFired = 0;
          this.system.fireDrone(drone, drone.targetEnemy);
        }
      }
    } else {
      // 3. 타겟 없으면 플레이어 주변 호버링
      const angle = this.system._droneHoverAngle + drone.hoverOffset;
      const targetX = player.x + Math.cos(angle) * 60;
      const targetY = player.y + Math.sin(angle) * 60;

      const dx = targetX - gfx.x;
      const dy = targetY - gfx.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        const speed = Math.min(stats.moveSpeed * deltaSec, dist);
        gfx.setPosition(
          gfx.x + (dx / dist) * speed,
          gfx.y + (dy / dist) * speed
        );
      }

      drone.lastFired = 0;
    }
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    // 기본 전략은 추가 초기화 없음
  }

  /**
   * 드론 파괴 시 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    // 기본 전략은 추가 정리 없음
  }
}
