/**
 * @fileoverview 어그로(taunt) 칩 전략.
 * 적의 이동 타겟을 드론으로 유인한다. 드론 자체는 공격하지 않는다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';

// ── TauntStrategy 클래스 ──

export default class TauntStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('taunt', grade);
    /** @type {number} 어그로 반경 (px) */
    this.tauntRadius = vals ? vals.tauntRadius : 80;

    /** @type {Set} 현재 어그로 중인 적 참조 (정리용) */
    this._tauntedEnemies = new Set();
  }

  /**
   * 플레이어 전방 호버링 + 반경 내 적 어그로 설정.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    // 플레이어 전방(적이 많은 방향) 호버링
    const angle = this.system._droneHoverAngle + drone.hoverOffset;
    const targetX = player.x + Math.cos(angle) * 70;
    const targetY = player.y + Math.sin(angle) * 70;

    const dx = targetX - gfx.x;
    const dy = targetY - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = Math.min(stats.moveSpeed * deltaSec, dist);
      gfx.setPosition(gfx.x + (dx / dist) * speed, gfx.y + (dy / dist) * speed);
    }

    // 반경 내 적의 tauntTarget을 드론으로 설정
    const enemyPool = scene.waveSystem ? scene.waveSystem.enemyPool : null;
    if (!enemyPool) return;

    // 기존 어그로 해제 (범위 밖으로 나간 적)
    for (const enemy of this._tauntedEnemies) {
      if (!enemy.active || enemy.currentHp <= 0) {
        this._tauntedEnemies.delete(enemy);
        continue;
      }
      const eDx = enemy.x - gfx.x;
      const eDy = enemy.y - gfx.y;
      const eDist = Math.sqrt(eDx * eDx + eDy * eDy);
      // 어그로 해제 거리: 반경 * 1.5 (히스테리시스)
      if (eDist > this.tauntRadius * 1.5) {
        if (enemy.tauntTarget === gfx) {
          enemy.tauntTarget = null;
        }
        this._tauntedEnemies.delete(enemy);
      }
    }

    // 새 적에 어그로 설정
    enemyPool.getActive().forEach((enemy) => {
      if (!enemy.active || enemy.currentHp <= 0) return;
      if (this._tauntedEnemies.has(enemy)) return;

      const eDx = enemy.x - gfx.x;
      const eDy = enemy.y - gfx.y;
      const eDist = Math.sqrt(eDx * eDx + eDy * eDy);

      if (eDist <= this.tauntRadius) {
        enemy.tauntTarget = gfx;
        this._tauntedEnemies.add(enemy);
      }
    });
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    this._tauntedEnemies.clear();
  }

  /**
   * 드론 파괴 시 어그로 해제.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    for (const enemy of this._tauntedEnemies) {
      if (enemy.active && enemy.tauntTarget === drone.gfx) {
        enemy.tauntTarget = null;
      }
    }
    this._tauntedEnemies.clear();
  }
}
