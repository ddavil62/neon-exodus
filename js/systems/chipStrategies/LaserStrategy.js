/**
 * @fileoverview 레이저 칩 전략.
 * 드론이 이동하지 않고 가장 가까운 적에게 빔을 발사하여 연속 데미지를 준다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';
import { CHIP_LASER_TICK_INTERVAL, CHIP_LASER_BEAM_LENGTH, COLORS } from '../../config.js';

// ── LaserStrategy 클래스 ──

export default class LaserStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('laser', grade);
    /** @type {number} DPS (초당 데미지) */
    this.dps = vals ? vals.dps : 15;

    /** @type {number} 틱 타이머 (ms) */
    this._tickTimer = 0;
  }

  /**
   * 고정 위치에서 빔 발사 + 연속 데미지.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    // 플레이어 주변 호버링 (이동 안 함, 가까이 따라다님)
    const hoverAngle = this.system._droneHoverAngle + drone.hoverOffset;
    const targetX = player.x + Math.cos(hoverAngle) * 45;
    const targetY = player.y + Math.sin(hoverAngle) * 45;

    const hDx = targetX - gfx.x;
    const hDy = targetY - gfx.y;
    const hDist = Math.sqrt(hDx * hDx + hDy * hDy);

    if (hDist > 2) {
      const speed = Math.min(stats.moveSpeed * deltaSec, hDist);
      gfx.setPosition(gfx.x + (hDx / hDist) * speed, gfx.y + (hDy / hDist) * speed);
    }

    // 가장 가까운 적 탐색
    const target = this.system.findClosestEnemy(gfx.x, gfx.y, CHIP_LASER_BEAM_LENGTH);

    // 레이저 빔 그래픽 업데이트
    if (!drone._laserBeamGfx) {
      drone._laserBeamGfx = scene.add.graphics().setDepth(5);
    }
    drone._laserBeamGfx.clear();

    if (target && target.active) {
      // 빔 그리기
      const beamColor = this._getBeamColor();
      drone._laserBeamGfx.lineStyle(2, beamColor, 0.8);
      drone._laserBeamGfx.beginPath();
      drone._laserBeamGfx.moveTo(gfx.x, gfx.y);
      drone._laserBeamGfx.lineTo(target.x, target.y);
      drone._laserBeamGfx.strokePath();

      // 틱 데미지
      this._tickTimer += delta;
      if (this._tickTimer >= CHIP_LASER_TICK_INTERVAL) {
        this._tickTimer -= CHIP_LASER_TICK_INTERVAL;
        const tickDamage = Math.floor(this.dps * (CHIP_LASER_TICK_INTERVAL / 1000));
        if (tickDamage > 0 && target.takeDamage) {
          target.takeDamage(Math.max(1, tickDamage), false, null, 'meta_drone');
        }
      }
    } else {
      this._tickTimer = 0;
    }
  }

  /**
   * 등급에 따른 빔 색상을 반환한다.
   * @returns {number} Phaser 색상 코드
   * @private
   */
  _getBeamColor() {
    switch (this.grade) {
      case 'S': return 0xFFD700;
      case 'A': return 0xFF00FF;
      case 'B': return 0x00FFFF;
      default:  return 0xAAFFAA;
    }
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    this._tickTimer = 0;
  }

  /**
   * 드론 파괴 시 레이저 그래픽 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    if (drone._laserBeamGfx) {
      drone._laserBeamGfx.destroy();
      drone._laserBeamGfx = null;
    }
  }
}
