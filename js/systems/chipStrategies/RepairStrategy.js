/**
 * @fileoverview 수리 칩 전략.
 * 주기적으로 플레이어 HP를 회복한다. 드론은 공격하지 않고 호버링한다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';
import { CHIP_REPAIR_INTERVAL } from '../../config.js';
import VFXSystem from '../VFXSystem.js';

// ── RepairStrategy 클래스 ──

export default class RepairStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('repair', grade);
    /** @type {number} 회복량 */
    this.healAmount = vals ? vals.healAmount : 2;

    /** @type {number} 회복 타이머 (ms) */
    this._healTimer = 0;
  }

  /**
   * 플레이어 주변 호버링 + 주기적 HP 회복.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    // 플레이어 가까이 호버링
    const angle = this.system._droneHoverAngle + drone.hoverOffset;
    const targetX = player.x + Math.cos(angle) * 35;
    const targetY = player.y + Math.sin(angle) * 35;

    const dx = targetX - gfx.x;
    const dy = targetY - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = Math.min(stats.moveSpeed * deltaSec, dist);
      gfx.setPosition(gfx.x + (dx / dist) * speed, gfx.y + (dy / dist) * speed);
    }

    // 주기적 HP 회복
    this._healTimer += delta;
    if (this._healTimer >= CHIP_REPAIR_INTERVAL) {
      this._healTimer -= CHIP_REPAIR_INTERVAL;

      if (player && player.active && player.currentHp < player.maxHp) {
        player.currentHp = Math.min(player.maxHp, player.currentHp + this.healAmount);

        // 회복 VFX (간단한 히트 스파크 초록색)
        VFXSystem.hitSpark(scene, player.x, player.y - 10);
      }
    }
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    this._healTimer = 0;
  }

  /**
   * 드론 파괴 시 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    // 추가 정리 없음
  }
}
