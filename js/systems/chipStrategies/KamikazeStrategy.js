/**
 * @fileoverview 카미카제(자폭) 칩 전략.
 * 적에 접근하여 폭발한 후 일정 시간 후 리스폰하는 사이클을 반복한다.
 */

import { getChipGradeValues } from '../../data/droneChips.js';
import { CHIP_KAMIKAZE_RESPAWN_DELAY, CHIP_KAMIKAZE_RUSH_SPEED, COLORS } from '../../config.js';
import VFXSystem from '../VFXSystem.js';
import SoundSystem from '../SoundSystem.js';

// ── 상태 상수 ──

const STATE_IDLE = 'idle';       // 플레이어 주변 대기
const STATE_RUSH = 'rush';       // 적에게 돌진
const STATE_DEAD = 'dead';       // 폭발 후 대기 (리스폰 카운트다운)

// ── KamikazeStrategy 클래스 ──

export default class KamikazeStrategy {
  /**
   * @param {import('../DroneCompanionSystem.js').default} droneSystem
   * @param {string} grade - 등급
   */
  constructor(droneSystem, grade) {
    /** @type {import('../DroneCompanionSystem.js').default} */
    this.system = droneSystem;
    /** @type {string} */
    this.grade = grade;

    const vals = getChipGradeValues('kamikaze', grade);
    /** @type {number} 폭발 반경 (px) */
    this.explosionRadius = vals ? vals.explosionRadius : 60;

    /** @type {string} 현재 상태 */
    this._state = STATE_IDLE;

    /** @type {number} 리스폰 타이머 (ms) */
    this._respawnTimer = 0;

    /** @type {Object|null} 돌진 타겟 */
    this._rushTarget = null;
  }

  /**
   * 카미카제 행동 사이클: 대기 → 돌진 → 폭발 → 리스폰.
   * @param {Object} drone - 드론 데이터
   * @param {Object} stats - 드론 스탯
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} delta - 프레임 간격 (ms)
   */
  execute(drone, stats, scene, delta) {
    const deltaSec = delta / 1000;
    const gfx = drone.gfx;
    const player = this.system.player;

    switch (this._state) {
      case STATE_IDLE: {
        // 플레이어 주변 호버링 + 적 탐색
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

        // 사거리 내 적이 있으면 돌진 시작
        const enemy = this.system.findClosestEnemy(gfx.x, gfx.y, stats.shootRange * 2);
        if (enemy && enemy.active) {
          this._rushTarget = enemy;
          this._state = STATE_RUSH;
        }
        break;
      }

      case STATE_RUSH: {
        // 타겟이 사라지면 다시 대기
        if (!this._rushTarget || !this._rushTarget.active) {
          this._rushTarget = null;
          this._state = STATE_IDLE;
          break;
        }

        const dx = this._rushTarget.x - gfx.x;
        const dy = this._rushTarget.y - gfx.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 15) {
          // 폭발
          this._explode(drone, scene, stats);
        } else {
          // 돌진 이동
          const speed = CHIP_KAMIKAZE_RUSH_SPEED * deltaSec;
          gfx.setPosition(
            gfx.x + (dx / dist) * speed,
            gfx.y + (dy / dist) * speed
          );
        }
        break;
      }

      case STATE_DEAD: {
        // 리스폰 대기
        this._respawnTimer -= delta;
        if (this._respawnTimer <= 0) {
          // 리스폰: 플레이어 근처에 재출현
          gfx.setVisible(true);
          gfx.setAlpha(1);
          const angle = Math.random() * Math.PI * 2;
          gfx.setPosition(
            player.x + Math.cos(angle) * 40,
            player.y + Math.sin(angle) * 40
          );
          this._state = STATE_IDLE;
        }
        break;
      }
    }
  }

  /**
   * 폭발 처리: 범위 내 적에게 데미지 + VFX + 드론 숨김.
   * @param {Object} drone - 드론 데이터
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {Object} stats - 드론 스탯
   * @private
   */
  _explode(drone, scene, stats) {
    const gfx = drone.gfx;
    const x = gfx.x;
    const y = gfx.y;

    // VFX: 폭발 이펙트
    if (VFXSystem.explosion) {
      VFXSystem.explosion(scene, x, y);
    } else {
      VFXSystem.hitSpark(scene, x, y);
    }
    SoundSystem.play('explosion');

    // 범위 내 적에게 데미지
    const enemyPool = scene.waveSystem ? scene.waveSystem.enemyPool : null;
    if (enemyPool) {
      const atkMult = this.system.player.getEffectiveAttackMultiplier
        ? this.system.player.getEffectiveAttackMultiplier()
        : (this.system.player.attackMultiplier || 1);
      const damage = Math.floor(stats.damage * atkMult * 2);

      enemyPool.getActive().forEach((enemy) => {
        if (!enemy.active || enemy.currentHp <= 0) return;
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.explosionRadius) {
          enemy.takeDamage(damage, true, null, 'meta_drone');
        }
      });
    }

    // 드론 숨김 + 리스폰 대기
    gfx.setVisible(false);
    this._state = STATE_DEAD;
    this._respawnTimer = CHIP_KAMIKAZE_RESPAWN_DELAY;
    this._rushTarget = null;
  }

  /**
   * 드론 스폰 시 초기화.
   * @param {Object} drone - 드론 데이터
   */
  onSpawn(drone) {
    this._state = STATE_IDLE;
    this._respawnTimer = 0;
    this._rushTarget = null;
  }

  /**
   * 드론 파괴 시 정리.
   * @param {Object} drone - 드론 데이터
   */
  onDestroy(drone) {
    this._rushTarget = null;
  }
}
