/**
 * @fileoverview 무기 자동 발사 시스템.
 *
 * 장착된 무기 목록을 관리하며, 매 프레임마다 각 무기의 쿨다운을 체크하고
 * 사거리 내 가장 가까운 적을 찾아 자동 발사한다.
 * 투사체는 ObjectPool을 통해 관리되어 GC를 최소화한다.
 */

import { WEAPONS, ORBIT_RADIUS, EVOLVED_WEAPONS } from '../data/weapons.js';
import { SaveManager } from '../managers/SaveManager.js';
import ObjectPool from './ObjectPool.js';
import Projectile from '../entities/Projectile.js';
import SoundSystem from './SoundSystem.js';
import VFXSystem from './VFXSystem.js';

// ── 무기 ID → 데이터 맵 변환 ──

/** @type {Object.<string, Object>} 무기 ID로 빠르게 조회하기 위한 맵 */
const WEAPON_MAP = {};
WEAPONS.forEach((w) => { WEAPON_MAP[w.id] = w; });

// ── WeaponSystem 클래스 ──

export default class WeaponSystem {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {import('../entities/Player.js').default} player - 플레이어 참조
   */
  constructor(scene, player) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {import('../entities/Player.js').default} */
    this.player = player;

    /**
     * 장착된 무기 배열.
     * 각 요소: { id, level, cooldownTimer, data }
     * @type {Array.<{ id: string, level: number, cooldownTimer: number, data: Object }>}
     */
    this.weapons = [];

    /** 투사체 오브젝트 풀 */
    this.projectilePool = new ObjectPool(scene, Projectile, 50);

    /** 빔 렌더링용 Graphics 객체 (beam 타입 무기 공유) */
    this._beamGraphics = null;

    /** 빔 상태 관리 맵 (weaponId → { active, timer, dirX, dirY }) */
    this._beamStates = new Map();

    /** 오브 데이터 관리 맵 (weaponId → { graphics: Graphics[], angle: number, tickTimer: number }) */
    this._orbData = new Map();

    /** 미사일 활성 목록 (homing 타입) */
    this._missiles = [];

    /** 체인 번개 시각 효과 Graphics 객체 */
    this._chainGraphics = null;

    /** 드론 GameObject 배열 (summon 타입) */
    this._drones = [];

    /** 드론 호버링 각도 오프셋 */
    this._droneHoverAngle = 0;

    /**
     * 무기별 통계 맵 (weaponId → { kills, damage }).
     * 런 동안 각 무기의 킬 수와 총 데미지를 추적한다.
     * @type {Map<string, { kills: number, damage: number }>}
     */
    this.weaponStats = new Map();

    /** 나노스웜 구름 활성 목록 (cloud 타입) */
    this._clouds = [];

    /** 볼텍스 캐넌 소용돌이 활성 목록 (gravity 타입) */
    this._vortexes = [];

    /** 리퍼 필드 블레이드 데이터 맵 (weaponId → { sprites, angle, tickTimer, currentBladeCount }) */
    this._bladeData = new Map();
  }

  // ── 공개 메서드 ──

  /**
   * 무기를 장착한다.
   * @param {string} weaponId - 무기 ID (WEAPON_DATA 키)
   * @param {number} [level=1] - 초기 레벨
   * @returns {boolean} 장착 성공 여부
   */
  addWeapon(weaponId, level = 1) {
    // 이미 보유 중인 무기인지 확인
    if (this.getWeapon(weaponId)) {
      console.warn(`[WeaponSystem] 이미 장착된 무기: ${weaponId}`);
      return false;
    }

    const baseData = WEAPON_MAP[weaponId];
    if (!baseData) {
      console.warn(`[WeaponSystem] 알 수 없는 무기 ID: ${weaponId}`);
      return false;
    }

    this.weapons.push({
      id: weaponId,
      level: level,
      cooldownTimer: 0,
      data: baseData,
    });

    // 무기별 통계 초기화
    if (!this.weaponStats.has(weaponId)) {
      this.weaponStats.set(weaponId, { kills: 0, damage: 0 });
    }

    // 도감에 무기 등록
    SaveManager.addToCollection('weaponsSeen', weaponId);

    // summon 타입이면 드론 스폰
    if (baseData.type === 'summon') {
      this._spawnDrones(weaponId);
    }

    return true;
  }

  /**
   * 무기를 레벨업한다.
   * @param {string} weaponId - 무기 ID
   * @returns {boolean} 레벨업 성공 여부
   */
  upgradeWeapon(weaponId) {
    const weapon = this.getWeapon(weaponId);
    if (!weapon) {
      console.warn(`[WeaponSystem] 미장착 무기 업그레이드 시도: ${weaponId}`);
      return false;
    }

    const maxLevel = weapon.data.maxLevel || 8;
    if (weapon.level >= maxLevel) {
      return false;
    }

    weapon.level++;

    // summon 타입 레벨업 시 드론 수 갱신
    if (weapon.data.type === 'summon') {
      this._spawnDrones(weapon.id);
    }

    return true;
  }

  /**
   * 장착된 무기 정보를 반환한다.
   * @param {string} weaponId - 무기 ID
   * @returns {{ id: string, level: number, cooldownTimer: number, data: Object }|null}
   */
  getWeapon(weaponId) {
    return this.weapons.find((w) => w.id === weaponId) || null;
  }

  /**
   * 현재 레벨의 무기 스탯을 계산하여 반환한다.
   * 무기 타입(projectile/beam/orbital)에 따라 반환 필드가 다르다.
   * @param {{ id: string, level: number, data: Object }} weapon - 무기 객체
   * @returns {Object} 무기 스탯 객체
   */
  getWeaponStats(weapon) {
    // 진화 무기인 경우 진화 스탯을 바로 반환 (모든 무기 타입 공통)
    if (weapon._evolvedStats) {
      return weapon._evolvedStats;
    }

    const { data, level } = weapon;
    const levels = data.levels;

    if (!levels || levels.length === 0) {
      // 레벨 데이터가 없는 미구현 무기 (Phase 3+ 무기)
      return {
        damage: 10,
        cooldown: 500,
        speed: 400,
        pierce: 1,
        range: 320,
      };
    }

    // levels 배열에서 현재 레벨 데이터 조회 (0-indexed: level-1)
    const lvData = levels[Math.min(level - 1, levels.length - 1)];

    // beam 타입 무기
    if (data.type === 'beam') {
      return {
        tickDamage: lvData.tickDamage || 8,
        cooldown: lvData.cooldown || 2000,
        duration: lvData.duration || 300,
        range: lvData.range || 300,
      };
    }

    // orbital 타입 무기
    if (data.type === 'orbital') {
      return {
        orbCount: lvData.orbCount || 1,
        tickDamage: lvData.tickDamage || 6,
        orbRadius: lvData.orbRadius || 55,
        angularSpeed: lvData.angularSpeed || 2.0,
        tickInterval: lvData.tickInterval || 500,
      };
    }

    // chain 타입 무기 (전기 체인)
    if (data.type === 'chain') {
      return {
        damage: lvData.damage || 20,
        cooldown: lvData.cooldown || 1200,
        chainCount: lvData.chainCount || 2,
        chainRange: lvData.chainRange || 120,
        chainDecay: lvData.chainDecay || 0.80,
      };
    }

    // summon 타입 무기 (드론)
    if (data.type === 'summon') {
      return {
        droneCount: lvData.droneCount || 1,
        damage: lvData.damage || 12,
        cooldown: lvData.cooldown || 1000,
        shootRange: lvData.shootRange || 120,
        moveSpeed: lvData.moveSpeed || 150,
      };
    }

    // aoe 타입 무기 (EMP 폭발)
    if (data.type === 'aoe') {
      return {
        damage: lvData.damage || 15,
        cooldown: lvData.cooldown || 5000,
        radius: lvData.radius || 100,
        slowFactor: lvData.slowFactor || 0.35,
        slowDuration: lvData.slowDuration || 2000,
      };
    }

    // melee 타입 무기 (포스 블레이드)
    if (data.type === 'melee') {
      return {
        damage: lvData.damage || 30,
        cooldown: lvData.cooldown || 800,
        range: lvData.range || 60,
        arcAngle: lvData.arcAngle || 60,
        knockback: lvData.knockback || 20,
      };
    }

    // cloud 타입 무기 (나노스웜)
    if (data.type === 'cloud') {
      return {
        cloudCount: lvData.cloudCount || 1,
        tickDamage: lvData.tickDamage || 5,
        radius: lvData.radius || 40,
        duration: lvData.duration || 4000,
        cooldown: lvData.cooldown || 1000,
        poisonStack: lvData.poisonStack || 1,
      };
    }

    // gravity 타입 무기 (볼텍스 캐넌)
    if (data.type === 'gravity') {
      return {
        damage: lvData.damage || 20,
        pullDamage: lvData.pullDamage || 4,
        pullRadius: lvData.pullRadius || 60,
        vortexDuration: lvData.vortexDuration || 3000,
        cooldown: lvData.cooldown || 3000,
        pullForce: lvData.pullForce || 80,
      };
    }

    // rotating_blade 타입 무기 (리퍼 필드)
    if (data.type === 'rotating_blade') {
      return {
        bladeCount: lvData.bladeCount || 3,
        damage: lvData.damage || 18,
        orbitRadius: lvData.orbitRadius || 65,
        angularSpeed: lvData.angularSpeed || 5.0,
        tickInterval: lvData.tickInterval || 300,
        curseDuration: lvData.curseDuration || 2000,
      };
    }

    // homing 타입 무기 (미사일)
    if (data.type === 'homing') {
      return {
        damage: lvData.damage || 25,
        cooldown: lvData.cooldown || 2500,
        speed: lvData.speed || 200,
        turnSpeed: lvData.turnSpeed || 1.5,
        explosionRadius: lvData.explosionRadius || 50,
        range: lvData.range || 400,
      };
    }

    // projectile 타입 무기 (기본)
    return {
      damage: lvData.damage || 10,
      cooldown: lvData.cooldown || 500,
      speed: lvData.projectileSpeed || 400,
      pierce: lvData.pierce || 1,
      range: lvData.range || 320,
    };
  }

  /**
   * 무기별 데미지를 기록한다.
   * @param {string} weaponId - 무기 ID
   * @param {number} amount - 데미지 양
   */
  recordDamage(weaponId, amount) {
    const stats = this.weaponStats.get(weaponId);
    if (stats) {
      stats.damage += amount;
    }
  }

  /**
   * 무기별 킬을 기록한다.
   * @param {string} weaponId - 무기 ID
   */
  recordKill(weaponId) {
    const stats = this.weaponStats.get(weaponId);
    if (stats) {
      stats.kills += 1;
    }
  }

  /**
   * 매 프레임 호출. 각 무기의 쿨다운과 발사를 처리한다.
   * 무기 타입(projectile/beam/orbital)에 따라 별도 로직을 실행한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.player || !this.player.active) return;

    // 활성 투사체 업데이트
    this.projectilePool.forEach((proj) => {
      proj.update(time, delta);
    });

    // 미사일 업데이트 (활성 미사일 매 프레임 추적)
    this._updateMissiles(time, delta);

    // 각 무기 처리
    for (const weapon of this.weapons) {
      const weaponType = weapon.data.type;

      if (weaponType === 'beam') {
        this._updateBeam(weapon, time, delta);
      } else if (weaponType === 'orbital') {
        this._updateOrbital(weapon, time, delta);
      } else if (weaponType === 'chain') {
        this._updateChain(weapon, time, delta);
      } else if (weaponType === 'homing') {
        this._updateHoming(weapon, time, delta);
      } else if (weaponType === 'summon') {
        this._updateDrones(weapon, time, delta);
      } else if (weaponType === 'aoe') {
        this._updateAoe(weapon, time, delta);
      } else if (weaponType === 'melee') {
        this._updateMelee(weapon, time, delta);
      } else if (weaponType === 'cloud') {
        this._updateCloud(weapon, time, delta);
      } else if (weaponType === 'gravity') {
        this._updateGravity(weapon, time, delta);
      } else if (weaponType === 'rotating_blade') {
        this._updateRotatingBlade(weapon, time, delta);
      } else {
        this._updateProjectile(weapon, time, delta);
      }
    }
  }

  // ── 투사체 타입 업데이트 ──

  /**
   * 투사체 타입 무기의 쿨다운과 발사를 처리한다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateProjectile(weapon, time, delta) {
    weapon.cooldownTimer -= delta;

    if (weapon.cooldownTimer <= 0) {
      const stats = this.getWeaponStats(weapon);

      // 쿨다운에 플레이어의 cooldownMultiplier 적용
      const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);

      // 사거리 내 가장 가까운 적 찾기
      const target = this.findClosestEnemy(
        this.player.x, this.player.y, stats.range
      );

      if (target) {
        // multiShot: 여러 발 동시 발사 (진화 무기 precision_cannon 등)
        const shotCount = stats.multiShot || 1;
        for (let i = 0; i < shotCount; i++) {
          this.fireProjectile(weapon, stats, target);
        }
        weapon.cooldownTimer = effectiveCooldown;
      } else {
        // 적이 없으면 쿨다운 리셋하지 않음 (다음 프레임에 재시도)
        weapon.cooldownTimer = 0;
      }
    }
  }

  // ── 빔 타입 업데이트 ──

  /**
   * 빔 타입 무기를 업데이트한다.
   * 빔은 Graphics 선분으로 렌더링하며, 가장 가까운 적 방향으로 자동 조준한다.
   * duration 동안 사거리 내 적에게 tickDamage를 입히고, cooldown 후 재발사한다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateBeam(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);
    const beamCount = stats.beamCount || 1;

    // 빔 상태 초기화
    if (!this._beamStates.has(weapon.id)) {
      // 빔 개수만큼 방향 배열 초기화
      const dirs = [];
      for (let i = 0; i < beamCount; i++) {
        dirs.push({ dirX: 0, dirY: -1 });
      }
      this._beamStates.set(weapon.id, {
        active: false,
        timer: 0,
        dirs,              // 빔 방향 배열 (beamCount 지원)
        dirX: 0,           // 하위 호환: 단일 빔 방향
        dirY: -1,
        damaged: false,
      });
    }

    // 빔 Graphics 초기화
    if (!this._beamGraphics) {
      this._beamGraphics = this.scene.add.graphics().setDepth(9);
    }

    const state = this._beamStates.get(weapon.id);

    // beamCount 변경 시 dirs 배열 갱신
    if (!state.dirs || state.dirs.length !== beamCount) {
      state.dirs = [];
      for (let i = 0; i < beamCount; i++) {
        state.dirs.push({ dirX: 0, dirY: -1 });
      }
    }

    state.timer -= delta;

    if (state.active) {
      // 빔 활성 상태: 다중 타겟 방향 갱신 + 데미지
      if (beamCount > 1) {
        // 다중 빔: 가장 가까운 적 N명에게 각각 방향 갱신
        const targets = this.findClosestEnemies(
          this.player.x, this.player.y, stats.range, beamCount
        );
        for (let i = 0; i < beamCount; i++) {
          const t = targets[i];
          if (t) {
            const dx = t.x - this.player.x;
            const dy = t.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              state.dirs[i].dirX = dx / dist;
              state.dirs[i].dirY = dy / dist;
            }
          }
        }
      } else {
        // 단일 빔 (기존 로직)
        const target = this.findClosestEnemy(
          this.player.x, this.player.y, stats.range
        );
        if (target) {
          const dx = target.x - this.player.x;
          const dy = target.y - this.player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            state.dirX = dx / dist;
            state.dirY = dy / dist;
            state.dirs[0].dirX = dx / dist;
            state.dirs[0].dirY = dy / dist;
          }
        }
      }

      // 데미지 적용 (duration 동안 1회)
      if (!state.damaged) {
        state.damaged = true;
        // 다중 빔: 각 빔별로 데미지 적용
        for (let i = 0; i < beamCount; i++) {
          const dirState = state.dirs[i];
          this._applyBeamDamage(stats, dirState, weapon.id);
        }
      }

      // duration 종료 시 비활성으로 전환
      if (state.timer <= 0) {
        state.active = false;
        const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);
        state.timer = effectiveCooldown;
      }
    } else {
      // 쿨다운 대기 상태
      if (state.timer <= 0) {
        // 발사 시작
        state.active = true;
        state.timer = stats.duration;
        state.damaged = false;

        // 발사 방향 결정
        if (beamCount > 1) {
          const targets = this.findClosestEnemies(
            this.player.x, this.player.y, stats.range, beamCount
          );
          for (let i = 0; i < beamCount; i++) {
            const t = targets[i];
            if (t) {
              const dx = t.x - this.player.x;
              const dy = t.y - this.player.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                state.dirs[i].dirX = dx / dist;
                state.dirs[i].dirY = dy / dist;
              }
            } else {
              // 적이 부족하면 기본 상향
              const spread = ((i - (beamCount - 1) / 2) * 0.4);
              state.dirs[i].dirX = Math.sin(spread);
              state.dirs[i].dirY = -Math.cos(spread);
            }
          }
        } else {
          const target = this.findClosestEnemy(
            this.player.x, this.player.y, stats.range
          );
          if (target) {
            const dx = target.x - this.player.x;
            const dy = target.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              state.dirX = dx / dist;
              state.dirY = dy / dist;
              state.dirs[0].dirX = dx / dist;
              state.dirs[0].dirY = dy / dist;
            }
          } else {
            state.dirX = 0;
            state.dirY = -1;
            state.dirs[0].dirX = 0;
            state.dirs[0].dirY = -1;
          }
        }
      }
    }
  }

  /**
   * 빔 사거리 내 모든 적에게 데미지를 입힌다.
   * @param {Object} stats - 빔 무기 스탯
   * @param {Object} state - 빔 상태
   * @param {string} weaponId - 무기 ID (통계 추적용)
   * @private
   */
  _applyBeamDamage(stats, state, weaponId) {
    const atkMult = this.player.getEffectiveAttackMultiplier ? this.player.getEffectiveAttackMultiplier() : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.tickDamage * atkMult);

    // 빔은 발사 단위로 치명타 판정 (한 빔 내 모든 적에게 동일 적용)
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    const px = this.player.x;
    const py = this.player.y;
    const range = stats.range;

    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;
    if (!enemyPool) return;

    // 빔 선분 위의 적 탐색 (빔 방향 벡터와의 거리가 가까운 적)
    const beamEndX = px + state.dirX * range;
    const beamEndY = py + state.dirY * range;

    enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      // 적이 빔 선분 근처(20px 이내)에 있는지 확인
      const dist = this._pointToSegmentDist(
        enemy.x, enemy.y, px, py, beamEndX, beamEndY
      );
      if (dist < 20) {
        enemy.takeDamage(finalDamage, true, null, weaponId);
        this.recordDamage(weaponId, finalDamage);
        if (isCrit) this._showCritEffect(enemy.x, enemy.y);
      }
    });
  }

  /**
   * 점에서 선분까지의 최단 거리를 계산한다.
   * @param {number} px - 점 X
   * @param {number} py - 점 Y
   * @param {number} ax - 선분 시작 X
   * @param {number} ay - 선분 시작 Y
   * @param {number} bx - 선분 끝 X
   * @param {number} by - 선분 끝 Y
   * @returns {number} 최단 거리
   * @private
   */
  _pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    }

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = ax + t * dx;
    const closestY = ay + t * dy;

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }

  /**
   * 빔 Graphics를 렌더링한다. 매 프레임 호출해야 한다.
   * GameScene.update()에서 weaponSystem.renderBeams()로 호출한다.
   */
  renderBeams() {
    if (!this._beamGraphics) return;
    this._beamGraphics.clear();

    for (const weapon of this.weapons) {
      if (weapon.data.type !== 'beam') continue;

      const state = this._beamStates.get(weapon.id);
      if (!state || !state.active) continue;

      const stats = this.getWeaponStats(weapon);
      const px = this.player.x;
      const py = this.player.y;
      const beamCount = stats.beamCount || 1;

      // 빔 잔여 시간 비율로 미세 맥동 (duration 내 +-1px 너비 변화)
      const progress = state.timer / stats.duration;
      const pulse = Math.sin(progress * Math.PI * 4) * 1;

      // 다중 빔 렌더링 (beamCount만큼 반복)
      for (let bi = 0; bi < beamCount; bi++) {
        const dir = state.dirs && state.dirs[bi] ? state.dirs[bi] : state;
        const endX = px + dir.dirX * stats.range;
        const endY = py + dir.dirY * stats.range;

        // 외곽 글로우: 8px cyan 20% opacity
        this._beamGraphics.lineStyle(8 + pulse, 0x00FFFF, 0.2);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 메인 빔: 4px cyan 80% opacity
        this._beamGraphics.lineStyle(4 + pulse * 0.5, 0x00FFFF, 0.8);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 코어: 2px white 90% opacity
        this._beamGraphics.lineStyle(2, 0xFFFFFF, 0.9);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 빔 끝점에 밝은 원형 글로우
        this._beamGraphics.fillStyle(0x00FFFF, 0.5);
        this._beamGraphics.fillCircle(endX, endY, 6);
        this._beamGraphics.fillStyle(0xFFFFFF, 0.4);
        this._beamGraphics.fillCircle(endX, endY, 3);
      }
    }
  }

  // ── 오비탈 타입 업데이트 ──

  /**
   * 오비탈 타입 무기를 업데이트한다.
   * 오브는 플레이어 중심으로 공전하며, tickInterval마다 범위 내 적에게 데미지를 입힌다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateOrbital(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);

    // 오브 데이터 초기화
    if (!this._orbData.has(weapon.id)) {
      this._orbData.set(weapon.id, {
        graphics: [],
        angle: 0,
        tickTimer: 0,
        currentOrbCount: 0,
      });
      this._rebuildOrbs(weapon, stats);
    }

    const orbInfo = this._orbData.get(weapon.id);

    // orbCount가 변경되면 오브 재구성 (레벨업으로 인한 변경)
    if (orbInfo.currentOrbCount !== stats.orbCount) {
      this._rebuildOrbs(weapon, stats);
    }

    // 각도 갱신
    const deltaSec = delta / 1000;
    orbInfo.angle += stats.angularSpeed * deltaSec;

    // 오브 위치 갱신
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < orbInfo.graphics.length; i++) {
      const sprite = orbInfo.graphics[i];
      const offsetAngle = orbInfo.angle + (i * (Math.PI * 2 / stats.orbCount));
      const orbX = px + Math.cos(offsetAngle) * ORBIT_RADIUS;
      const orbY = py + Math.sin(offsetAngle) * ORBIT_RADIUS;

      // 스프라이트 위치 + 자체 회전 갱신
      sprite.setPosition(orbX, orbY);
      sprite.rotation += stats.angularSpeed * deltaSec * 2;
    }

    // 데미지 틱 처리
    orbInfo.tickTimer -= delta;
    if (orbInfo.tickTimer <= 0) {
      orbInfo.tickTimer = stats.tickInterval;
      this._applyOrbDamage(weapon, stats, orbInfo);
    }
  }

  /**
   * 오브 Graphics 배열을 재구성한다.
   * orbCount 변경 시 (레벨업) 또는 최초 생성 시 호출된다.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _rebuildOrbs(weapon, stats) {
    const orbInfo = this._orbData.get(weapon.id);

    // 기존 오브 제거
    for (const sprite of orbInfo.graphics) {
      sprite.destroy();
    }
    orbInfo.graphics = [];

    // 새 오브 생성 (effect_plasma_orb 스프라이트 사용)
    for (let i = 0; i < stats.orbCount; i++) {
      const sprite = this.scene.add.image(0, 0, 'effect_plasma_orb').setDepth(9);
      sprite.setAlpha(0.85);
      orbInfo.graphics.push(sprite);
    }

    orbInfo.currentOrbCount = stats.orbCount;
  }

  /**
   * 오브 범위 내 적에게 데미지를 입힌다.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @param {Object} orbInfo - 오브 정보
   * @private
   */
  _applyOrbDamage(weapon, stats, orbInfo) {
    const atkMult = this.player.getEffectiveAttackMultiplier ? this.player.getEffectiveAttackMultiplier() : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.tickDamage * atkMult);

    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;
    if (!enemyPool) return;

    // 각 오브 위치에서 orbRadius 내 적에게 데미지
    for (const gfx of orbInfo.graphics) {
      const orbX = gfx.x;
      const orbY = gfx.y;

      enemyPool.forEach((enemy) => {
        if (!enemy.active) return;

        const dist = Phaser.Math.Distance.Between(orbX, orbY, enemy.x, enemy.y);
        if (dist <= stats.orbRadius) {
          // 오브 틱마다 적별로 치명타 판정
          const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);
          enemy.takeDamage(finalDamage, true, null, weapon.id);
          this.recordDamage(weapon.id, finalDamage);
          if (isCrit) this._showCritEffect(enemy.x, enemy.y);
        }
      });
    }
  }

  // ── 체인 타입 업데이트 ──

  /**
   * 체인 타입 무기를 업데이트한다.
   * 가장 가까운 적을 초기 타격하고, 체인 범위 내 다음 적으로 번개가 연쇄 전달된다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateChain(weapon, time, delta) {
    weapon.cooldownTimer -= delta;

    if (weapon.cooldownTimer <= 0) {
      const stats = this._getChainStats(weapon);
      const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);

      // 사거리 내 가장 가까운 적 찾기 (체인 시작)
      const target = this.findClosestEnemy(this.player.x, this.player.y, 300);

      if (target) {
        this._fireChain(stats, target, weapon.id);
        weapon.cooldownTimer = effectiveCooldown;
      } else {
        weapon.cooldownTimer = 0;
      }
    }
  }

  /**
   * 체인 무기 스탯을 반환한다. 진화 무기면 진화 스탯 사용.
   * @param {Object} weapon - 무기 객체
   * @returns {Object} 스탯
   * @private
   */
  _getChainStats(weapon) {
    // 진화 무기인 경우
    if (weapon._evolvedStats) {
      return weapon._evolvedStats;
    }
    return this.getWeaponStats(weapon);
  }

  /**
   * 체인 번개를 발사한다. 초기 대상에서 연쇄 공격.
   * @param {Object} stats - 체인 무기 스탯
   * @param {Object} firstTarget - 첫 번째 타겟
   * @param {string} weaponId - 무기 ID (통계 추적용)
   * @private
   */
  _fireChain(stats, firstTarget, weaponId) {
    const atkMult = this.player.getEffectiveAttackMultiplier ? this.player.getEffectiveAttackMultiplier() : (this.player.attackMultiplier || 1);
    let currentDamage = Math.floor(stats.damage * atkMult);

    const enemyPool = this.scene.waveSystem ? this.scene.waveSystem.enemyPool : null;
    if (!enemyPool) return;

    const hitEnemies = new Set();
    const chainPoints = [{ x: this.player.x, y: this.player.y }];

    let currentTarget = firstTarget;

    for (let i = 0; i <= stats.chainCount; i++) {
      if (!currentTarget || !currentTarget.active) break;

      // 체인 히트마다 치명타 판정
      const { damage: finalDamage, isCrit } = this._rollCrit(currentDamage);
      currentTarget.takeDamage(finalDamage, true, null, weaponId);
      this.recordDamage(weaponId, finalDamage);
      if (isCrit) this._showCritEffect(currentTarget.x, currentTarget.y);
      hitEnemies.add(currentTarget);
      chainPoints.push({ x: currentTarget.x, y: currentTarget.y });

      // 다음 체인 대상 찾기
      currentDamage = Math.floor(currentDamage * stats.chainDecay);
      let nextTarget = null;
      let minDist = stats.chainRange;

      enemyPool.forEach((enemy) => {
        if (!enemy.active) return;
        if (hitEnemies.has(enemy)) return;

        const dist = Phaser.Math.Distance.Between(
          currentTarget.x, currentTarget.y, enemy.x, enemy.y
        );
        if (dist < minDist) {
          minDist = dist;
          nextTarget = enemy;
        }
      });

      currentTarget = nextTarget;
    }

    // 번개 시각 효과
    this._drawLightning(chainPoints);
  }

  /**
   * 번개 지그재그 선을 그린다. 150ms 후 자동 제거.
   * @param {Array<{x: number, y: number}>} points - 체인 포인트 배열
   * @private
   */
  _drawLightning(points) {
    if (points.length < 2) return;

    const gfx = this.scene.add.graphics().setDepth(9);

    // 지그재그 중간점 3개를 미리 계산하여 저장
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const m1x = p1.x + (p2.x - p1.x) * 0.25 + (Math.random() - 0.5) * 24;
      const m1y = p1.y + (p2.y - p1.y) * 0.25 + (Math.random() - 0.5) * 24;
      const m2x = p1.x + (p2.x - p1.x) * 0.50 + (Math.random() - 0.5) * 20;
      const m2y = p1.y + (p2.y - p1.y) * 0.50 + (Math.random() - 0.5) * 20;
      const m3x = p1.x + (p2.x - p1.x) * 0.75 + (Math.random() - 0.5) * 24;
      const m3y = p1.y + (p2.y - p1.y) * 0.75 + (Math.random() - 0.5) * 24;
      segments.push({ p1, p2, mids: [{ x: m1x, y: m1y }, { x: m2x, y: m2y }, { x: m3x, y: m3y }] });
    }

    // 레이어 1: 외곽 글로우 (5px cyan 30% opacity)
    gfx.lineStyle(5, 0x00FFFF, 0.3);
    for (const seg of segments) {
      gfx.lineBetween(seg.p1.x, seg.p1.y, seg.mids[0].x, seg.mids[0].y);
      gfx.lineBetween(seg.mids[0].x, seg.mids[0].y, seg.mids[1].x, seg.mids[1].y);
      gfx.lineBetween(seg.mids[1].x, seg.mids[1].y, seg.mids[2].x, seg.mids[2].y);
      gfx.lineBetween(seg.mids[2].x, seg.mids[2].y, seg.p2.x, seg.p2.y);
    }

    // 레이어 2: 메인 번개 (3px cyan 90% opacity)
    gfx.lineStyle(3, 0x00FFFF, 0.9);
    for (const seg of segments) {
      gfx.lineBetween(seg.p1.x, seg.p1.y, seg.mids[0].x, seg.mids[0].y);
      gfx.lineBetween(seg.mids[0].x, seg.mids[0].y, seg.mids[1].x, seg.mids[1].y);
      gfx.lineBetween(seg.mids[1].x, seg.mids[1].y, seg.mids[2].x, seg.mids[2].y);
      gfx.lineBetween(seg.mids[2].x, seg.mids[2].y, seg.p2.x, seg.p2.y);
    }

    // 레이어 3: 코어 직선 (1.5px white 95% opacity)
    gfx.lineStyle(1.5, 0xFFFFFF, 0.95);
    for (let i = 0; i < points.length - 1; i++) {
      gfx.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // 체인 노드(적 위치)에 스파크 원 — 첫 번째 점(플레이어)은 제외
    for (let i = 1; i < points.length; i++) {
      gfx.fillStyle(0xFFFF00, 0.7);
      gfx.fillCircle(points[i].x, points[i].y, 4);
    }

    // 150ms 후 제거
    this.scene.time.delayedCall(150, () => {
      gfx.destroy();
    });
  }

  // ── 호밍 타입 업데이트 ──

  /**
   * 호밍 타입 무기의 발사를 처리한다 (쿨다운 체크 후 미사일 생성).
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateHoming(weapon, time, delta) {
    weapon.cooldownTimer -= delta;

    if (weapon.cooldownTimer <= 0) {
      const stats = weapon._evolvedStats || this.getWeaponStats(weapon);
      const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);

      // 사거리 내 가장 가까운 적 찾기
      const target = this.findClosestEnemy(this.player.x, this.player.y, stats.range);

      if (target) {
        this._fireMissile(stats, target, weapon.id);
        weapon.cooldownTimer = effectiveCooldown;
      } else {
        weapon.cooldownTimer = 0;
      }
    }
  }

  /**
   * 미사일을 발사한다.
   * @param {Object} stats - 미사일 무기 스탯
   * @param {Object} target - 초기 타겟
   * @param {string} weaponId - 무기 ID (통계 추적용)
   * @private
   */
  _fireMissile(stats, target, weaponId) {
    // 미사일 최대 30개 제한
    if (this._missiles.length >= 30) return;

    const px = this.player.x;
    const py = this.player.y;

    // 타겟 방향 계산
    const dx = target.x - px;
    const dy = target.y - py;
    const angle = Math.atan2(dy, dx);

    // 미사일 스프라이트 생성 (effect_missile 텍스처)
    const sprite = this.scene.add.image(px, py, 'effect_missile').setDepth(9);
    sprite.setRotation(angle);

    this._missiles.push({
      gfx: sprite,
      x: px,
      y: py,
      angle,
      speed: stats.speed,
      turnSpeed: stats.turnSpeed,
      damage: stats.damage,
      explosionRadius: stats.explosionRadius,
      range: stats.range,
      distanceTraveled: 0,
      target,
      weaponId,
    });
  }

  /**
   * 활성 미사일을 매 프레임 업데이트한다.
   * 적 추적, 충돌 판정, 범위 초과 시 폭발.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateMissiles(time, delta) {
    const deltaSec = delta / 1000;
    const toRemove = [];

    for (let i = 0; i < this._missiles.length; i++) {
      const m = this._missiles[i];

      // 타겟이 비활성이면 가장 가까운 적으로 재조준
      if (!m.target || !m.target.active) {
        m.target = this.findClosestEnemy(m.x, m.y, m.range);
      }

      // 타겟이 있으면 방향 보정
      if (m.target && m.target.active) {
        const desiredAngle = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        let angleDiff = desiredAngle - m.angle;

        // 각도 차이를 -PI ~ PI 범위로 정규화
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const maxTurn = m.turnSpeed * deltaSec;
        if (Math.abs(angleDiff) <= maxTurn) {
          m.angle = desiredAngle;
        } else {
          m.angle += Math.sign(angleDiff) * maxTurn;
        }
      }

      // 이동
      const moveX = Math.cos(m.angle) * m.speed * deltaSec;
      const moveY = Math.sin(m.angle) * m.speed * deltaSec;
      m.x += moveX;
      m.y += moveY;
      m.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
      m.gfx.setPosition(m.x, m.y);
      m.gfx.setRotation(m.angle);

      // 적 충돌 판정 (가장 가까운 적과 15px 이내)
      let exploded = false;
      const enemyPool = this.scene.waveSystem ? this.scene.waveSystem.enemyPool : null;

      if (enemyPool) {
        enemyPool.forEach((enemy) => {
          if (!enemy.active || exploded) return;
          const dist = Phaser.Math.Distance.Between(m.x, m.y, enemy.x, enemy.y);
          if (dist < 15) {
            exploded = true;
          }
        });
      }

      // 범위 초과 시에도 폭발
      if (m.distanceTraveled >= m.range) {
        exploded = true;
      }

      if (exploded) {
        this._explodeMissile(m);
        toRemove.push(i);
      }
    }

    // 제거 (역순)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this._missiles[idx].gfx.destroy();
      this._missiles.splice(idx, 1);
    }
  }

  /**
   * 미사일을 폭발시킨다. 범위 내 모든 적에게 데미지.
   * @param {Object} missile - 미사일 데이터
   * @private
   */
  _explodeMissile(missile) {
    const atkMult = this.player.getEffectiveAttackMultiplier ? this.player.getEffectiveAttackMultiplier() : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(missile.damage * atkMult);

    // 폭발 단위로 치명타 판정 (범위 내 모든 적에게 동일 적용)
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    const enemyPool = this.scene.waveSystem ? this.scene.waveSystem.enemyPool : null;
    if (enemyPool) {
      enemyPool.forEach((enemy) => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(missile.x, missile.y, enemy.x, enemy.y);
        if (dist <= missile.explosionRadius) {
          enemy.takeDamage(finalDamage, true, null, missile.weaponId);
          this.recordDamage(missile.weaponId, finalDamage);
          if (isCrit) this._showCritEffect(enemy.x, enemy.y);
        }
      });
    }

    // 폭발 시각 효과: effect_explosion 스프라이트 + scale tween
    const explSprite = this.scene.add.image(missile.x, missile.y, 'effect_explosion')
      .setScale(missile.explosionRadius / 32)
      .setAlpha(0.8)
      .setDepth(8);

    this.scene.tweens.add({
      targets: explSprite,
      alpha: 0,
      scaleX: explSprite.scaleX * 1.2,
      scaleY: explSprite.scaleY * 1.2,
      duration: 200,
      onComplete: () => explSprite.destroy(),
    });
  }

  // ── 소환(드론) 타입 업데이트 ──

  /**
   * 드론을 스폰한다. 부족한 수만큼 생성, 초과분은 제거한다.
   * @param {string} weaponId - 무기 ID
   * @private
   */
  _spawnDrones(weaponId) {
    const weapon = this.getWeapon(weaponId);
    if (!weapon) return;

    const stats = this.getWeaponStats(weapon);
    // engineer 패시브 droneSummonBonus 적용
    const targetCount = stats.droneCount + (this.player.droneSummonBonus || 0);

    // 현재 드론 수와 목표 드론 수 비교
    const currentCount = this._drones.filter(d => d.weaponId === weaponId && d.active).length;

    if (currentCount >= targetCount) return;

    const toSpawn = targetCount - currentCount;
    for (let i = 0; i < toSpawn; i++) {
      // effect_drone 스프라이트로 드론 시각화
      const offsetAngle = Math.random() * Math.PI * 2;
      const startX = this.player.x + Math.cos(offsetAngle) * 40;
      const startY = this.player.y + Math.sin(offsetAngle) * 40;

      const sprite = this.scene.add.image(startX, startY, 'effect_drone').setDepth(6);

      // Arcade Physics 동적 바디 등록
      this.scene.physics.add.existing(sprite);
      sprite.body.setCircle(8, 4, 4);

      // gfx를 sprite로 매핑 (기존 API 호환)
      const gfx = sprite;

      const drone = {
        gfx,
        weaponId,
        lastFired: 0,
        targetEnemy: null,
        active: true,
        hoverOffset: Math.random() * Math.PI * 2,
      };

      this._drones.push(drone);
    }
  }

  /**
   * 드론 AI를 매 프레임 업데이트한다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateDrones(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);
    const deltaSec = delta / 1000;
    this._droneHoverAngle += deltaSec * 2; // 호버링 회전

    for (const drone of this._drones) {
      if (!drone.active || drone.weaponId !== weapon.id) continue;

      const gfx = drone.gfx;

      // 1. 플레이어 기준 가장 가까운 활성 적을 타겟으로 설정
      drone.targetEnemy = this.findClosestEnemy(this.player.x, this.player.y, stats.shootRange * 2);

      if (drone.targetEnemy && drone.targetEnemy.active) {
        // 2. 타겟으로 이동
        const dx = drone.targetEnemy.x - gfx.x;
        const dy = drone.targetEnemy.y - gfx.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > stats.shootRange) {
          // shootRange 밖이면 접근
          const moveX = (dx / dist) * stats.moveSpeed * deltaSec;
          const moveY = (dy / dist) * stats.moveSpeed * deltaSec;
          gfx.setPosition(gfx.x + moveX, gfx.y + moveY);
        } else {
          // 3. shootRange 내이면 발사
          drone.lastFired += delta;
          const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);
          if (drone.lastFired >= effectiveCooldown) {
            drone.lastFired = 0;
            this._droneFire(drone, drone.targetEnemy, weapon);
          }
        }
      } else {
        // 4. 타겟 없으면 플레이어 주변 호버링 (반경 60px, 사인/코사인 자유 이동)
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

      // 호버링 미세 회전 (스프라이트 흔들림)
      gfx.rotation = Math.sin(time * 0.003 + drone.hoverOffset) * 0.2;
    }
  }

  /**
   * 드론이 투사체를 발사한다.
   * @param {Object} drone - 드론 데이터
   * @param {Object} target - 타겟 적
   * @param {Object} weapon - 무기 객체
   * @private
   */
  _droneFire(drone, target, weapon) {
    const stats = this.getWeaponStats(weapon);
    const gfx = drone.gfx;

    const dx = target.x - gfx.x;
    const dy = target.y - gfx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // 데미지에 attackMultiplier 적용
    const atkMult = this.player.getEffectiveAttackMultiplier
      ? this.player.getEffectiveAttackMultiplier()
      : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.damage * atkMult);
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    // 투사체 풀에서 가져와 발사
    const proj = this.projectilePool.get(gfx.x, gfx.y);
    if (proj) {
      proj.fire(gfx.x, gfx.y, dirX, dirY, finalDamage, 350, 1);
      proj.isCrit = isCrit;
      proj.weaponId = weapon.id;
    }

    SoundSystem.play('shoot');
  }

  // ── 범위(AoE) 타입 업데이트 ──

  /**
   * AoE 타입 무기(EMP 폭발)를 업데이트한다.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateAoe(weapon, time, delta) {
    weapon.cooldownTimer -= delta;

    if (weapon.cooldownTimer <= 0) {
      const stats = this.getWeaponStats(weapon);
      const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);
      this._triggerEmp(weapon.id, stats);
      weapon.cooldownTimer = effectiveCooldown;
    }
  }

  /**
   * EMP 폭발을 발동한다. 범위 내 적에게 데미지 + 둔화.
   * @param {string} weaponId - 무기 ID
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _triggerEmp(weaponId, stats) {
    const px = this.player.x;
    const py = this.player.y;

    const atkMult = this.player.getEffectiveAttackMultiplier
      ? this.player.getEffectiveAttackMultiplier()
      : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.damage * atkMult);

    const enemyPool = this.scene.waveSystem ? this.scene.waveSystem.enemyPool : null;
    if (!enemyPool) return;

    enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist <= stats.radius) {
        // 데미지 적용
        enemy.takeDamage(baseDamage, false, null, weaponId);
        this.recordDamage(weaponId, baseDamage);

        // 둔화 적용: 원래 속도를 저장 후 감속
        if (enemy._originalSpeed === undefined) {
          enemy._originalSpeed = enemy.speed;
        }
        enemy.speed = enemy._originalSpeed * stats.slowFactor;

        // slowDuration 후 속도 복구 (enemy.active 체크 필수)
        this.scene.time.delayedCall(stats.slowDuration, () => {
          if (enemy.active && enemy._originalSpeed !== undefined) {
            enemy.speed = enemy._originalSpeed;
            enemy._originalSpeed = undefined;
          }
        });
      }
    });

    // VFX/SFX — EMP 링 스프라이트 + 파티클
    VFXSystem.empRing(this.scene, px, py, stats.radius);
    VFXSystem.empBurst(this.scene, px, py, stats.radius);
    SoundSystem.play('emp_blast');
  }

  // ── 근접(melee) 타입 업데이트 ──

  /**
   * 근접 타입 무기(포스 블레이드)를 업데이트한다.
   * 주기적으로 플레이어 전방에 호(arc) 슬래시 → 범위 내 적 데미지 + 넉백.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateMelee(weapon, time, delta) {
    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      const stats = this.getWeaponStats(weapon);
      const effectiveCooldown = stats.cooldown * (this.player.cooldownMultiplier || 1);
      this._triggerMeleeSlash(weapon.id, stats);
      weapon.cooldownTimer = effectiveCooldown;
    }
  }

  /**
   * 근접 슬래시를 발동한다. 가장 가까운 적 방향으로 호 범위 데미지 + 넉백.
   * @param {string} weaponId - 무기 ID
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _triggerMeleeSlash(weaponId, stats) {
    const px = this.player.x;
    const py = this.player.y;

    // 가장 가까운 적 방향으로 슬래시 (적 없으면 마지막 이동 방향)
    const target = this.findClosestEnemy(px, py, stats.range * 1.5);
    let slashAngle;
    if (target) {
      slashAngle = Math.atan2(target.y - py, target.x - px);
    } else {
      slashAngle = Math.atan2(this.player._smoothDirY || 0, this.player._smoothDirX || 1);
    }

    // arcAngle 범위 내 적에게 데미지 + 넉백
    const halfArc = (stats.arcAngle * Math.PI / 180) / 2;
    const enemyPool = this.scene.waveSystem?.enemyPool;
    if (!enemyPool) return;

    const atkMult = this.player.getEffectiveAttackMultiplier?.() || (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.damage * atkMult);

    enemyPool.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist > stats.range) return;

      const angleToEnemy = Math.atan2(enemy.y - py, enemy.x - px);
      let angleDiff = angleToEnemy - slashAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) <= halfArc) {
        const { damage, isCrit } = this._rollCrit(baseDamage);
        enemy.takeDamage(damage, true, null, weaponId);
        this.recordDamage(weaponId, damage);
        if (isCrit) this._showCritEffect(enemy.x, enemy.y);

        // 넉백
        const kbAngle = Math.atan2(enemy.y - py, enemy.x - px);
        enemy.x += Math.cos(kbAngle) * stats.knockback;
        enemy.y += Math.sin(kbAngle) * stats.knockback;
      }
    });

    // 시각 효과: 슬래시 스프라이트
    this._showSlashEffect(px, py, slashAngle, stats.range);
    SoundSystem.play('shoot');
  }

  /**
   * 슬래시 시각 효과를 표시한다.
   * @param {number} px - 플레이어 X
   * @param {number} py - 플레이어 Y
   * @param {number} angle - 슬래시 방향 (라디안)
   * @param {number} range - 슬래시 사거리
   * @private
   */
  _showSlashEffect(px, py, angle, range) {
    const offsetX = Math.cos(angle) * range / 2;
    const offsetY = Math.sin(angle) * range / 2;

    const sprite = this.scene.add.image(px + offsetX, py + offsetY, 'effect_force_slash')
      .setRotation(angle)
      .setScale(range / 48)
      .setAlpha(0.9)
      .setDepth(9);

    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 200,
      onComplete: () => sprite.destroy(),
    });
  }

  // ── 구름(cloud) 타입 업데이트 ──

  /**
   * 구름 타입 무기(나노스웜)를 업데이트한다.
   * 주기적으로 적 위치에 독 구름 생성 → 영역 내 적에게 DoT.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateCloud(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);

    // 쿨다운 체크 → 새 구름 생성
    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      const activeCloudCount = this._clouds.filter(c => c.weaponId === weapon.id).length;
      if (activeCloudCount < stats.cloudCount) {
        const target = this.findClosestEnemy(this.player.x, this.player.y, 300);
        if (target) {
          this._spawnCloud(target.x, target.y, stats, weapon.id);
        }
      }
      weapon.cooldownTimer = stats.cooldown * (this.player.cooldownMultiplier || 1);
    }

    // 활성 구름 업데이트
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      const cloud = this._clouds[i];
      if (cloud.weaponId !== weapon.id) continue;

      cloud.lifetime -= delta;
      cloud.tickTimer -= delta;

      if (cloud.lifetime <= 0) {
        cloud.sprite.destroy();
        this._clouds.splice(i, 1);
        continue;
      }

      // DoT 틱 (0.5초마다)
      if (cloud.tickTimer <= 0) {
        cloud.tickTimer = 500;
        this._applyCloudDamage(cloud, weapon.id);
      }

      // alpha 맥동
      cloud.sprite.setAlpha(0.5 + Math.sin(time * 0.005) * 0.2);

      // 페이드 아웃 (마지막 1초)
      if (cloud.lifetime < 1000) {
        cloud.sprite.setAlpha(cloud.lifetime / 1000 * 0.7);
      }
    }
  }

  /**
   * 나노 구름을 생성한다.
   * @param {number} x - 배치 X
   * @param {number} y - 배치 Y
   * @param {Object} stats - 무기 스탯
   * @param {string} weaponId - 무기 ID
   * @private
   */
  _spawnCloud(x, y, stats, weaponId) {
    const sprite = this.scene.add.image(x, y, 'effect_nano_cloud')
      .setScale(stats.radius / 24)
      .setAlpha(0.6)
      .setDepth(5);

    this._clouds.push({
      sprite,
      x,
      y,
      radius: stats.radius,
      tickDamage: stats.tickDamage,
      tickTimer: 500,
      lifetime: stats.duration,
      weaponId,
      poisonStack: stats.poisonStack,
    });
  }

  /**
   * 구름 범위 내 적에게 독 데미지를 적용한다.
   * @param {Object} cloud - 구름 데이터
   * @param {string} weaponId - 무기 ID
   * @private
   */
  _applyCloudDamage(cloud, weaponId) {
    const enemyPool = this.scene.waveSystem?.enemyPool;
    if (!enemyPool) return;

    const atkMult = this.player.getEffectiveAttackMultiplier?.() || (this.player.attackMultiplier || 1);
    // 기본 틱 데미지 + 독 스택 보너스 (스택당 3 추가)
    const dmg = Math.floor((cloud.tickDamage + cloud.poisonStack * 3) * atkMult);

    enemyPool.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(cloud.x, cloud.y, enemy.x, enemy.y);
      if (dist <= cloud.radius) {
        enemy.takeDamage(dmg, false, null, weaponId);
        this.recordDamage(weaponId, dmg);
      }
    });
  }

  // ── 중력(gravity) 타입 업데이트 ──

  /**
   * 중력 타입 무기(볼텍스 캐넌)를 업데이트한다.
   * 적 위치에 소용돌이 발사 → 범위 내 적 끌어당기기 + DoT.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateGravity(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);

    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      const target = this.findClosestEnemy(this.player.x, this.player.y, 400);
      if (target) {
        this._spawnVortex(target.x, target.y, stats, weapon.id);
        weapon.cooldownTimer = stats.cooldown * (this.player.cooldownMultiplier || 1);
      } else {
        weapon.cooldownTimer = 0;
      }
    }

    // 활성 볼텍스 업데이트
    const deltaSec = delta / 1000;
    for (let i = this._vortexes.length - 1; i >= 0; i--) {
      const vortex = this._vortexes[i];
      if (vortex.weaponId !== weapon.id) continue;

      vortex.lifetime -= delta;
      vortex.tickTimer -= delta;

      if (vortex.lifetime <= 0) {
        vortex.sprite.destroy();
        this._vortexes.splice(i, 1);
        continue;
      }

      // 회전 애니메이션
      vortex.sprite.rotation += 3.0 * deltaSec;

      // 범위 내 적 끌어당기기 + DoT
      const enemyPool = this.scene.waveSystem?.enemyPool;
      if (enemyPool) {
        enemyPool.forEach(enemy => {
          if (!enemy.active) return;
          const dist = Phaser.Math.Distance.Between(vortex.x, vortex.y, enemy.x, enemy.y);
          if (dist > vortex.pullRadius || dist < 5) return;

          // 끌어당기기
          const angle = Math.atan2(vortex.y - enemy.y, vortex.x - enemy.x);
          const pull = vortex.pullForce * deltaSec * (1 - dist / vortex.pullRadius);
          enemy.x += Math.cos(angle) * pull;
          enemy.y += Math.sin(angle) * pull;
        });

        // 데미지 틱 (0.5초마다)
        if (vortex.tickTimer <= 0) {
          vortex.tickTimer = 500;
          const atkMult = this.player.getEffectiveAttackMultiplier?.() || 1;
          const dmg = Math.floor(vortex.pullDamage * atkMult);
          enemyPool.forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(vortex.x, vortex.y, enemy.x, enemy.y);
            if (dist <= vortex.pullRadius) {
              enemy.takeDamage(dmg, false, null, weapon.id);
              this.recordDamage(weapon.id, dmg);
            }
          });
        }
      }

      // 페이드 아웃 (마지막 0.5초)
      if (vortex.lifetime < 500) {
        vortex.sprite.setAlpha(vortex.lifetime / 500);
      }
    }
  }

  /**
   * 볼텍스를 생성한다.
   * @param {number} x - 배치 X
   * @param {number} y - 배치 Y
   * @param {Object} stats - 무기 스탯
   * @param {string} weaponId - 무기 ID
   * @private
   */
  _spawnVortex(x, y, stats, weaponId) {
    const sprite = this.scene.add.image(x, y, 'effect_vortex')
      .setScale(stats.pullRadius / 24)
      .setAlpha(0.8)
      .setDepth(5);

    this._vortexes.push({
      sprite,
      x,
      y,
      pullRadius: stats.pullRadius,
      pullDamage: stats.pullDamage,
      lifetime: stats.vortexDuration,
      tickTimer: 500,
      weaponId,
      pullForce: stats.pullForce,
    });
  }

  // ── 회전 낫(rotating_blade) 타입 업데이트 ──

  /**
   * 회전 낫 타입 무기(리퍼 필드)를 업데이트한다.
   * 플레이어 주위로 낫 날이 회전하며, 적 타격 시 저주 효과 부여.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateRotatingBlade(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);

    if (!this._bladeData.has(weapon.id)) {
      this._bladeData.set(weapon.id, {
        sprites: [],
        angle: 0,
        tickTimer: 0,
        currentBladeCount: 0,
      });
      this._rebuildBlades(weapon, stats);
    }

    const bladeInfo = this._bladeData.get(weapon.id);

    // bladeCount 변경 시 재구성 (레벨업)
    if (bladeInfo.currentBladeCount !== stats.bladeCount) {
      this._rebuildBlades(weapon, stats);
    }

    // 회전 업데이트
    const deltaSec = delta / 1000;
    bladeInfo.angle += stats.angularSpeed * deltaSec;

    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < bladeInfo.sprites.length; i++) {
      const sprite = bladeInfo.sprites[i];
      const offsetAngle = bladeInfo.angle + (i * (Math.PI * 2 / stats.bladeCount));
      const bx = px + Math.cos(offsetAngle) * stats.orbitRadius;
      const by = py + Math.sin(offsetAngle) * stats.orbitRadius;
      sprite.setPosition(bx, by);
      sprite.setRotation(offsetAngle + Math.PI / 2); // 접선 방향
    }

    // 데미지 틱
    bladeInfo.tickTimer -= delta;
    if (bladeInfo.tickTimer <= 0) {
      bladeInfo.tickTimer = stats.tickInterval;
      this._applyBladeDamage(weapon, stats, bladeInfo);
    }
  }

  /**
   * 블레이드 스프라이트를 재구성한다.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _rebuildBlades(weapon, stats) {
    const bladeInfo = this._bladeData.get(weapon.id);

    // 기존 블레이드 제거
    for (const sprite of bladeInfo.sprites) {
      sprite.destroy();
    }
    bladeInfo.sprites = [];

    // 새 블레이드 생성
    for (let i = 0; i < stats.bladeCount; i++) {
      const sprite = this.scene.add.image(0, 0, 'effect_reaper_blade').setDepth(9);
      sprite.setAlpha(0.9);
      bladeInfo.sprites.push(sprite);
    }

    bladeInfo.currentBladeCount = stats.bladeCount;
  }

  /**
   * 블레이드 근처 적에게 데미지 + 저주(속도 -30%)를 적용한다.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @param {Object} bladeInfo - 블레이드 정보
   * @private
   */
  _applyBladeDamage(weapon, stats, bladeInfo) {
    const atkMult = this.player.getEffectiveAttackMultiplier?.() || 1;
    const baseDamage = Math.floor(stats.damage * atkMult);
    const enemyPool = this.scene.waveSystem?.enemyPool;
    if (!enemyPool) return;

    for (const sprite of bladeInfo.sprites) {
      enemyPool.forEach(enemy => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y);
        if (dist <= 30) { // 블레이드 히트 범위
          const { damage, isCrit } = this._rollCrit(baseDamage);
          enemy.takeDamage(damage, true, null, weapon.id);
          this.recordDamage(weapon.id, damage);
          if (isCrit) this._showCritEffect(enemy.x, enemy.y);

          // 저주: 속도 -30%
          if (!enemy._reaperCursed) {
            enemy._reaperCursed = true;
            enemy._originalSpeed = enemy._originalSpeed || enemy.speed;
            enemy.speed *= 0.7;

            // 저주 시각 효과: 적 tint 변경
            enemy.setTint(0xFF3333);

            this.scene.time.delayedCall(stats.curseDuration, () => {
              if (enemy.active) {
                enemy.speed = enemy._originalSpeed || enemy.speed / 0.7;
                enemy._reaperCursed = false;
                enemy.clearTint();
              }
            });
          }
        }
      });
    }
  }

  // ── 치명타(크리티컬) 판정 ──

  /**
   * 치명타 판정을 수행하고 최종 데미지를 반환한다.
   * @param {number} baseDamage - 기본 데미지 (공격력 배수 적용 후)
   * @returns {{ damage: number, isCrit: boolean }} 최종 데미지와 치명타 여부
   * @private
   */
  _rollCrit(baseDamage) {
    if (this.player.critChance > 0 && Math.random() < this.player.critChance) {
      const critMultiplier = this.player.critDamage + this.player.critDamageMultiplier;
      return {
        damage: Math.floor(baseDamage * critMultiplier),
        isCrit: true,
      };
    }
    return { damage: baseDamage, isCrit: false };
  }

  /**
   * 치명타 발생 시 시각적 피드백을 표시한다.
   * 적 위치에 노란색 "CRIT!" 텍스트를 띄운다.
   * @param {number} x - 표시 X 좌표
   * @param {number} y - 표시 Y 좌표
   * @private
   */
  _showCritEffect(x, y) {
    const critText = this.scene.add.text(x, y - 10, 'CRIT!', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: '#FFDD00',
      stroke: '#FF6600',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: critText,
      alpha: 0,
      y: critText.y - 20,
      duration: 400,
      onComplete: () => critText.destroy(),
    });
  }

  // ── 무기 진화 ──

  /**
   * 무기를 진화시킨다. 기존 무기 데이터를 진화 무기 데이터로 교체한다.
   * @param {string} weaponId - 기존 무기 ID
   * @param {string} evolvedId - 진화 무기 ID
   * @returns {boolean} 진화 성공 여부
   */
  evolveWeapon(weaponId, evolvedId) {
    const weapon = this.getWeapon(weaponId);
    if (!weapon) return false;

    const evolvedData = EVOLVED_WEAPONS.find(w => w.id === evolvedId);
    if (!evolvedData) return false;

    // 진화 무기 스탯을 무기에 저장
    weapon._evolvedStats = { ...evolvedData.stats };
    weapon._evolvedId = evolvedId;
    weapon._evolvedNameKey = evolvedData.nameKey;

    // 도감에 진화 무기 등록
    SaveManager.addToCollection('weaponsSeen', evolvedId);

    return true;
  }

  /**
   * 지정 좌표에서 사거리 내 가장 가까운 활성 적을 찾는다.
   * @param {number} x - 기준 X 좌표
   * @param {number} y - 기준 Y 좌표
   * @param {number} range - 탐색 사거리 (px)
   * @returns {Phaser.Physics.Arcade.Sprite|null} 가장 가까운 적 또는 null
   */
  findClosestEnemy(x, y, range) {
    let closest = null;
    let minDist = range;

    // scene의 적 그룹에서 탐색
    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;

    if (!enemyPool) return null;

    enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    });

    return closest;
  }

  /**
   * 지정 좌표에서 사거리 내 가장 가까운 활성 적 N명을 찾는다.
   * beamCount 등 다중 타겟팅에 사용한다.
   * @param {number} x - 기준 X 좌표
   * @param {number} y - 기준 Y 좌표
   * @param {number} range - 탐색 사거리 (px)
   * @param {number} count - 최대 반환 수
   * @returns {Array<Phaser.Physics.Arcade.Sprite>} 가까운 순 정렬된 적 배열
   */
  findClosestEnemies(x, y, range, count) {
    const enemyPool = this.scene.waveSystem
      ? this.scene.waveSystem.enemyPool
      : null;
    if (!enemyPool) return [];

    const candidates = [];
    enemyPool.forEach((enemy) => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist < range) {
        candidates.push({ enemy, dist });
      }
    });

    // 거리순 정렬 후 상위 N개 반환
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, count).map(c => c.enemy);
  }

  /**
   * 투사체를 발사한다.
   * @param {{ id: string, level: number, data: Object }} weapon - 무기 객체
   * @param {{ damage: number, speed: number, pierce: number }} stats - 무기 스탯
   * @param {Phaser.Physics.Arcade.Sprite} targetEnemy - 타겟 적
   */
  fireProjectile(weapon, stats, targetEnemy) {
    // 플레이어 -> 적 방향 벡터
    const dx = targetEnemy.x - this.player.x;
    const dy = targetEnemy.y - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // 데미지에 플레이어 유효 공격력 배수 적용
    const baseDamage = Math.floor(stats.damage * (this.player.getEffectiveAttackMultiplier ? this.player.getEffectiveAttackMultiplier() : (this.player.attackMultiplier || 1)));

    // 치명타 판정 (투사체 발사 시점에 결정)
    const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);

    // 투사체 속도에 플레이어 투사체 속도 배수 적용 (진화 무기는 projectileSpeed 필드 사용)
    const finalSpeed = (stats.projectileSpeed || stats.speed) * (this.player.projectileSpeedMultiplier || 1);

    // 풀에서 투사체 획득
    const proj = this.projectilePool.get(this.player.x, this.player.y);
    proj.fire(this.player.x, this.player.y, dirX, dirY, finalDamage, finalSpeed, stats.pierce);

    // 투사체에 치명타 여부 저장 (적중 시 시각 효과 표시용)
    proj.isCrit = isCrit;

    // 투사체에 무기 ID 저장 (통계 추적용)
    proj.weaponId = weapon.id;

    // 발사 SFX
    SoundSystem.play('shoot');
  }

  /**
   * 시스템 리소스를 정리한다.
   */
  destroy() {
    this.projectilePool.destroy();

    // 빔 Graphics 제거
    if (this._beamGraphics) {
      this._beamGraphics.destroy();
      this._beamGraphics = null;
    }
    this._beamStates.clear();

    // 오브 Graphics 제거
    for (const [, orbInfo] of this._orbData) {
      for (const gfx of orbInfo.graphics) {
        gfx.destroy();
      }
    }
    this._orbData.clear();

    // 미사일 Graphics 제거
    for (const m of this._missiles) {
      if (m.gfx) m.gfx.destroy();
    }
    this._missiles = [];

    // 체인 Graphics 제거
    if (this._chainGraphics) {
      this._chainGraphics.destroy();
      this._chainGraphics = null;
    }

    // 드론 제거
    for (const drone of this._drones) {
      if (drone.gfx) drone.gfx.destroy();
    }
    this._drones = [];

    // 구름 제거
    for (const cloud of this._clouds) {
      if (cloud.sprite) cloud.sprite.destroy();
    }
    this._clouds = [];

    // 볼텍스 제거
    for (const vortex of this._vortexes) {
      if (vortex.sprite) vortex.sprite.destroy();
    }
    this._vortexes = [];

    // 블레이드 데이터 제거
    for (const [, bladeInfo] of this._bladeData) {
      for (const sprite of bladeInfo.sprites) {
        sprite.destroy();
      }
    }
    this._bladeData.clear();

    this.weapons = [];
  }
}
