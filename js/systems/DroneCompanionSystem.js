/**
 * @fileoverview 메타 드론 동반자 시스템.
 *
 * 스테이지 2 해금 후 모든 런에서 플레이어를 따라다니는 영구 드론을 관리한다.
 * 인런 레벨업 없이 메타 업그레이드 수치만 적용된다.
 * WeaponSystem과 독립적으로 동작하며, projectilePool을 공유한다.
 */

import { SaveManager } from '../managers/SaveManager.js';
import {
  DRONE_BASE_DAMAGE,
  DRONE_BASE_COOLDOWN,
  DRONE_BASE_RANGE,
  DRONE_BASE_MOVE_SPEED,
  DRONE_BASE_COUNT,
} from '../data/droneUpgrades.js';
import SoundSystem from './SoundSystem.js';

// ── DroneCompanionSystem 클래스 ──

export default class DroneCompanionSystem {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {import('../entities/Player.js').default} player - 플레이어 참조
   * @param {import('./ObjectPool.js').default} projectilePool - 투사체 풀 (WeaponSystem 공유)
   */
  constructor(scene, player, projectilePool) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {import('../entities/Player.js').default} */
    this.player = player;

    /** @type {import('./ObjectPool.js').default} */
    this.projectilePool = projectilePool;

    /** 활성 드론 배열 */
    this._drones = [];

    /** 드론 호버링 각도 오프셋 */
    this._droneHoverAngle = 0;

    /** 현재 계산된 드론 스탯 */
    this._stats = null;
  }

  // ── 초기화 ──

  /**
   * SaveManager에서 드론 업그레이드를 읽어 스탯을 계산하고 드론을 스폰한다.
   * GameScene.create()에서 droneUnlocked 확인 후 호출한다.
   */
  init() {
    this._stats = this.getDroneStats();
    this._spawnDrones();
  }

  // ── 스탯 계산 ──

  /**
   * 현재 메타 업그레이드 + 캐릭터 보너스를 적용한 드론 스탯을 반환한다.
   * @returns {{ damage: number, cooldown: number, shootRange: number, moveSpeed: number, droneCount: number, hivemind: boolean }}
   */
  getDroneStats() {
    const dmgLv = SaveManager.getDroneUpgradeLevel('droneDamage');
    const fireLv = SaveManager.getDroneUpgradeLevel('droneFireRate');
    const rangeLv = SaveManager.getDroneUpgradeLevel('droneRange');
    const reinforceLv = SaveManager.getDroneUpgradeLevel('droneReinforcement');
    const hivemindLv = SaveManager.getDroneUpgradeLevel('droneHivemind');

    // Engineer 패시브: droneDamageBonus (기본 0)
    const droneDamageBonus = this.player.droneDamageBonus || 0;

    // 기본 데미지 + 업그레이드 + 캐릭터 보너스
    const baseDamage = DRONE_BASE_DAMAGE + dmgLv * 5;
    const damage = Math.floor(baseDamage * (1 + droneDamageBonus));

    return {
      damage,
      cooldown: DRONE_BASE_COOLDOWN - fireLv * 50,
      shootRange: DRONE_BASE_RANGE + rangeLv * 15,
      moveSpeed: DRONE_BASE_MOVE_SPEED,
      droneCount: DRONE_BASE_COUNT + reinforceLv,
      hivemind: hivemindLv > 0,
    };
  }

  // ── 드론 스폰 ──

  /**
   * 목표 수량에 맞게 드론을 스폰한다.
   * @private
   */
  _spawnDrones() {
    const stats = this._stats;
    const currentCount = this._drones.filter(d => d.active).length;

    if (currentCount >= stats.droneCount) return;

    const toSpawn = stats.droneCount - currentCount;
    for (let i = 0; i < toSpawn; i++) {
      const offsetAngle = Math.random() * Math.PI * 2;
      const startX = this.player.x + Math.cos(offsetAngle) * 40;
      const startY = this.player.y + Math.sin(offsetAngle) * 40;

      const sprite = this.scene.add.image(startX, startY, 'effect_drone').setDepth(6);

      // Arcade Physics 동적 바디 등록
      this.scene.physics.add.existing(sprite);
      sprite.body.setCircle(8, 4, 4);

      const drone = {
        gfx: sprite,
        lastFired: 0,
        targetEnemy: null,
        active: true,
        hoverOffset: Math.random() * Math.PI * 2,
        orbitPhase: Math.random() * Math.PI * 2,
      };

      this._drones.push(drone);
    }
  }

  // ── 매 프레임 업데이트 ──

  /**
   * 드론 AI를 매 프레임 업데이트한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this._stats || this._drones.length === 0) return;

    const stats = this._stats;
    const deltaSec = delta / 1000;
    this._droneHoverAngle += deltaSec * 2;

    for (const drone of this._drones) {
      if (!drone.active) continue;

      const gfx = drone.gfx;

      // 1. 가장 가까운 적 탐색
      drone.targetEnemy = this._findClosestEnemy(
        this.player.x, this.player.y, stats.shootRange * 2
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
          const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);
          if (drone.lastFired >= effectiveCooldown) {
            drone.lastFired = 0;
            this._droneFire(drone, drone.targetEnemy);
          }
        }
      } else {
        // 3. 타겟 없으면 플레이어 주변 호버링
        const angle = this._droneHoverAngle + drone.hoverOffset;
        const targetX = this.player.x + Math.cos(angle) * 60;
        const targetY = this.player.y + Math.sin(angle) * 60;

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

      // 호버링 미세 회전
      gfx.rotation = Math.sin(time * 0.003 + drone.hoverOffset) * 0.2;
    }
  }

  // ── 드론 발사 ──

  /**
   * 드론이 투사체를 발사한다.
   * @param {Object} drone - 드론 데이터
   * @param {Object} target - 타겟 적
   * @private
   */
  _droneFire(drone, target) {
    const stats = this._stats;
    const gfx = drone.gfx;

    const dx = target.x - gfx.x;
    const dy = target.y - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // attackMultiplier 적용
    const atkMult = this.player.getEffectiveAttackMultiplier
      ? this.player.getEffectiveAttackMultiplier()
      : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.damage * atkMult);
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    // 투사체 발사
    const proj = this.projectilePool.get(gfx.x, gfx.y);
    if (proj) {
      proj.fire(gfx.x, gfx.y, dirX, dirY, finalDamage, 350, 1);
      proj.isCrit = isCrit;
      proj.weaponId = 'meta_drone';

      // 하이브마인드: 체인 번개 속성
      if (stats.hivemind) {
        proj.chainCount = 3;
        proj.chainRange = 120;
        proj.chainDecay = 0.8;
      }
    }

    SoundSystem.play('shoot');
  }

  // ── 유틸리티 ──

  /**
   * 크리티컬 판정을 수행한다.
   * @param {number} baseDamage - 기본 데미지
   * @returns {{ damage: number, isCrit: boolean }}
   * @private
   */
  _rollCrit(baseDamage) {
    const critChance = this.player.critChance || 0;
    const critMultiplier = 1.5 + (this.player.critDamageMultiplier || 0);
    const isCrit = Math.random() < critChance;
    return {
      damage: isCrit ? Math.floor(baseDamage * critMultiplier) : baseDamage,
      isCrit,
    };
  }

  /**
   * 지정 좌표에서 사거리 내 가장 가까운 활성 적을 찾는다.
   * @param {number} x - 기준 X
   * @param {number} y - 기준 Y
   * @param {number} range - 탐색 사거리 (px)
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   * @private
   */
  _findClosestEnemy(x, y, range) {
    let closest = null;
    let minDist = range;

    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;

    if (!enemyPool) return null;

    enemyPool.getActive().forEach((enemy) => {
      if (!enemy.active || enemy.hp <= 0) return;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    });

    return closest;
  }

  // ── 정리 ──

  /**
   * 모든 드론과 리소스를 정리한다.
   */
  destroy() {
    for (const drone of this._drones) {
      if (drone.gfx) drone.gfx.destroy();
    }
    this._drones = [];
  }
}
