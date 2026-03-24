/**
 * @fileoverview 메타 드론 동반자 시스템.
 *
 * 스테이지 2 해금 후 모든 런에서 플레이어를 따라다니는 영구 드론을 관리한다.
 * 인런 레벨업 없이 메타 업그레이드 수치만 적용된다.
 * WeaponSystem과 독립적으로 동작하며, projectilePool을 공유한다.
 *
 * 칩 시스템: 드론별로 장착된 칩에 따라 전략(Strategy) 패턴으로 행동이 교체된다.
 */

import { SaveManager } from '../managers/SaveManager.js';
import {
  DRONE_BASE_DAMAGE,
  DRONE_BASE_COOLDOWN,
  DRONE_BASE_RANGE,
  DRONE_BASE_MOVE_SPEED,
  DRONE_BASE_COUNT,
} from '../data/droneUpgrades.js';
import { createStrategy } from './chipStrategies/index.js';
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
    this._assignChipStrategies();
  }

  // ── 스탯 계산 ──

  /**
   * 현재 메타 업그레이드 + 캐릭터 보너스를 적용한 드론 스탯을 반환한다.
   * 레이더 칩이 장착된 드론이 있으면 탐지 범위에 배율을 적용한다.
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

    let shootRange = DRONE_BASE_RANGE + rangeLv * 15;

    // 레이더 칩 패시브: 탐지 범위 확장
    const radarMultiplier = this._getRadarMultiplier();
    shootRange = Math.floor(shootRange * radarMultiplier);

    return {
      damage,
      cooldown: DRONE_BASE_COOLDOWN - fireLv * 50,
      shootRange,
      moveSpeed: DRONE_BASE_MOVE_SPEED,
      droneCount: DRONE_BASE_COUNT + reinforceLv,
      hivemind: hivemindLv > 0,
    };
  }

  /**
   * 장착된 레이더 칩의 범위 배율을 반환한다.
   * @returns {number} 배율 (레이더 미장착 시 1.0)
   * @private
   */
  _getRadarMultiplier() {
    let multiplier = 1.0;
    for (const drone of this._drones) {
      if (drone.chipStrategy && drone.chipStrategy.rangeMultiplier) {
        multiplier = Math.max(multiplier, drone.chipStrategy.rangeMultiplier);
      }
    }
    return multiplier;
  }

  // ── 칩 전략 할당 ──

  /**
   * SaveManager에서 장착된 칩을 읽어 각 드론에 전략 인스턴스를 할당한다.
   * @private
   */
  _assignChipStrategies() {
    const equippedChips = SaveManager.getEquippedChips();
    const inventory = SaveManager.getDroneChipInventory();

    for (let i = 0; i < this._drones.length; i++) {
      const drone = this._drones[i];
      const chipUid = equippedChips[i];

      if (chipUid) {
        const chipItem = inventory.find(c => c.uid === chipUid);
        if (chipItem) {
          drone.chipStrategy = createStrategy(this, chipItem.chipId, chipItem.grade);
          drone.chipStrategy.onSpawn(drone);
          continue;
        }
      }

      // 칩 미장착 또는 칩 누락 시 기본 전략
      drone.chipStrategy = createStrategy(this, null, null);
      drone.chipStrategy.onSpawn(drone);
    }

    // 레이더 칩 적용 후 스탯 재계산
    this._stats = this.getDroneStats();
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
        chipStrategy: null,
      };

      this._drones.push(drone);
    }
  }

  // ── 매 프레임 업데이트 ──

  /**
   * 드론 AI를 매 프레임 업데이트한다.
   * 각 드론의 chipStrategy.execute()를 호출하여 행동을 위임한다.
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

      // 칩 전략에 행동 위임
      if (drone.chipStrategy) {
        drone.chipStrategy.execute(drone, stats, this.scene, delta);
      }

      // 호버링 미세 회전 (모든 전략 공통)
      drone.gfx.rotation = Math.sin(time * 0.003 + drone.hoverOffset) * 0.2;
    }
  }

  // ── 드론 발사 (public) ──

  /**
   * 드론이 투사체를 발사한다. 전략 클래스에서 호출한다.
   * @param {Object} drone - 드론 데이터
   * @param {Object} target - 타겟 적
   * @param {Object} [options={}] - 발사 옵션
   * @param {number} [options.pierceCount] - 관통 횟수
   * @param {{x: number, y: number}} [options.overrideDir] - 방향 오버라이드
   * @param {number} [options.damageMultiplier=1] - 데미지 배율
   * @param {boolean} [options.skipSound=false] - 사운드 스킵 여부
   */
  fireDrone(drone, target, options = {}) {
    const stats = this._stats;
    const gfx = drone.gfx;

    let dirX, dirY;

    if (options.overrideDir) {
      dirX = options.overrideDir.x;
      dirY = options.overrideDir.y;
    } else {
      const dx = target.x - gfx.x;
      const dy = target.y - gfx.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;
      dirX = dx / dist;
      dirY = dy / dist;
    }

    // attackMultiplier 적용
    const atkMult = this.player.getEffectiveAttackMultiplier
      ? this.player.getEffectiveAttackMultiplier()
      : (this.player.attackMultiplier || 1);
    const dmgMult = options.damageMultiplier || 1;
    const baseDamage = Math.floor(stats.damage * atkMult * dmgMult);
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    // 투사체 발사
    const proj = this.projectilePool.get(gfx.x, gfx.y);
    if (proj) {
      const pierceCount = options.pierceCount || 1;
      proj.fire(gfx.x, gfx.y, dirX, dirY, finalDamage, 350, pierceCount);
      proj.isCrit = isCrit;
      proj.weaponId = 'meta_drone';

      // 하이브마인드: 체인 번개 속성
      if (stats.hivemind) {
        proj.chainCount = 3;
        proj.chainRange = 120;
        proj.chainDecay = 0.8;
      }
    }

    if (!options.skipSound) {
      SoundSystem.play('shoot');
    }
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
   * 전략 클래스에서 호출 가능하도록 public 메서드로 제공한다.
   * @param {number} x - 기준 X
   * @param {number} y - 기준 Y
   * @param {number} range - 탐색 사거리 (px)
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  findClosestEnemy(x, y, range) {
    let closest = null;
    let minDist = range;

    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;

    if (!enemyPool) return null;

    enemyPool.getActive().forEach((enemy) => {
      if (!enemy.active || enemy.currentHp <= 0) return;
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
      // 전략 정리
      if (drone.chipStrategy && drone.chipStrategy.onDestroy) {
        drone.chipStrategy.onDestroy(drone);
      }
      if (drone.gfx) drone.gfx.destroy();
    }
    this._drones = [];
  }
}
