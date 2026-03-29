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

// ── 진화 무기 전용 이펙트 텍스처 키 매핑 ──
/** @const {Object<string, string>} evolvedId → 진화 전용 텍스처 키 */
const EVOLVED_TEXTURE_MAP = {
  precision_cannon: 'effect_precision_cannon',
  guardian_sphere:  'effect_guardian_sphere',
  nuke_missile:     'effect_nuke_missile',
  perpetual_emp:    'effect_perpetual_emp',
  phantom_strike:   'effect_force_slash',
  bioplasma:        'effect_bioplasma',
  event_horizon:    'effect_event_horizon',
  death_blossom:    'effect_death_blossom',
};

/** @const {Object<string, string>} evolvedId → 폭발 전용 텍스처 키 */
const EVOLVED_EXPLOSION_MAP = {
  nuke_missile: 'effect_nuke_explosion',
};

/** @const {Object<string, number>} evolvedId → 빔 색상 (Graphics API용) */
const EVOLVED_BEAM_COLOR = {
  ion_cannon:    0x6666FF,
  plasma_storm:  0xAA44FF,
};

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

    /** 바이오플라즈마 트레일 세그먼트 배열 (evolved bioplasma 전용) */
    this._bioTrails = [];

    /** 바이오플라즈마용 마지막 트레일 생성 좌표 */
    this._bioLastTrailPos = null;

    /** 이벤트 호라이즌 균열 활성 목록 (evolved event_horizon 전용) */
    this._rifts = [];

    /** 데스 블룸 부메랑 상태 맵 (weaponId → { phase, scythes, cooldownTimer }) */
    this._blossomData = new Map();

    /** 진화 EMP 부채꼴 Graphics (evolved perpetual_emp 전용) */
    this._empConeGraphics = null;
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

    // 오메가 프로토콜 활성 시 모든 무기 쿨다운 즉시 리셋
    if (this.scene._omegaProtocolActive) {
      for (const w of this.weapons) {
        if (w.cooldownTimer > 0) w.cooldownTimer = 0;
      }
    }

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

      // 진화 시 빔 색상 변경
      const beamColor = weapon._evolvedId && EVOLVED_BEAM_COLOR[weapon._evolvedId]
        ? EVOLVED_BEAM_COLOR[weapon._evolvedId] : 0x00FFFF;

      // 다중 빔 렌더링 (beamCount만큼 반복)
      for (let bi = 0; bi < beamCount; bi++) {
        const dir = state.dirs && state.dirs[bi] ? state.dirs[bi] : state;
        const endX = px + dir.dirX * stats.range;
        const endY = py + dir.dirY * stats.range;

        // 외곽 글로우
        this._beamGraphics.lineStyle(8 + pulse, beamColor, 0.2);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 메인 빔
        this._beamGraphics.lineStyle(4 + pulse * 0.5, beamColor, 0.8);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 코어: white
        this._beamGraphics.lineStyle(2, 0xFFFFFF, 0.9);
        this._beamGraphics.lineBetween(px, py, endX, endY);

        // 빔 끝점에 밝은 원형 글로우
        this._beamGraphics.fillStyle(beamColor, 0.5);
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

    // 새 오브 생성 (진화 시 전용 텍스처 사용)
    const orbTex = weapon._evolvedId && EVOLVED_TEXTURE_MAP[weapon._evolvedId]
      ? EVOLVED_TEXTURE_MAP[weapon._evolvedId] : 'effect_plasma_orb';
    for (let i = 0; i < stats.orbCount; i++) {
      const sprite = this.scene.add.image(0, 0, orbTex).setDepth(9);
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
      let orbHit = false;

      enemyPool.forEach((enemy) => {
        if (!enemy.active) return;

        const dist = Phaser.Math.Distance.Between(orbX, orbY, enemy.x, enemy.y);
        if (dist <= stats.orbRadius) {
          // 오브 틱마다 적별로 치명타 판정
          const { damage: finalDamage, isCrit } = this._rollCrit(baseDamage);
          enemy.takeDamage(finalDamage, true, null, weapon.id);
          this.recordDamage(weapon.id, finalDamage);
          if (isCrit) this._showCritEffect(enemy.x, enemy.y);
          orbHit = true;
        }
      });

      // 오브별 독립 히트 이펙트 (enemy 쿨다운과 별개)
      if (orbHit) {
        VFXSystem.hitSpark(this.scene, orbX, orbY);
      }
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
        this._fireChain(stats, target, weapon);
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
  _fireChain(stats, firstTarget, weapon) {
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    const evolvedId = typeof weapon === 'object' ? weapon._evolvedId : null;
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

    // 번개 시각 효과 (진화 시 색상 변경)
    this._drawLightning(chainPoints, evolvedId);
  }

  /**
   * 번개 지그재그 선을 그린다. 150ms 후 자동 제거.
   * @param {Array<{x: number, y: number}>} points - 체인 포인트 배열
   * @private
   */
  _drawLightning(points, evolvedId) {
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

    // 진화 시 번개 색상 변경
    const chainColor = evolvedId && EVOLVED_BEAM_COLOR[evolvedId]
      ? EVOLVED_BEAM_COLOR[evolvedId] : 0x00FFFF;
    const sparkColor = evolvedId && EVOLVED_BEAM_COLOR[evolvedId] ? 0xDD88FF : 0xFFFF00;

    // 레이어 1: 외곽 글로우
    gfx.lineStyle(5, chainColor, 0.3);
    for (const seg of segments) {
      gfx.lineBetween(seg.p1.x, seg.p1.y, seg.mids[0].x, seg.mids[0].y);
      gfx.lineBetween(seg.mids[0].x, seg.mids[0].y, seg.mids[1].x, seg.mids[1].y);
      gfx.lineBetween(seg.mids[1].x, seg.mids[1].y, seg.mids[2].x, seg.mids[2].y);
      gfx.lineBetween(seg.mids[2].x, seg.mids[2].y, seg.p2.x, seg.p2.y);
    }

    // 레이어 2: 메인 번개
    gfx.lineStyle(3, chainColor, 0.9);
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
      gfx.fillStyle(sparkColor, 0.7);
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
        this._fireMissile(stats, target, weapon);
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
  _fireMissile(stats, target, weapon) {
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    const evolvedId = typeof weapon === 'object' ? weapon._evolvedId : null;

    // 미사일 최대 30개 제한
    if (this._missiles.length >= 30) return;

    const px = this.player.x;
    const py = this.player.y;

    // 타겟 방향 계산
    const dx = target.x - px;
    const dy = target.y - py;
    const angle = Math.atan2(dy, dx);

    // 미사일 스프라이트 생성 (진화 시 전용 텍스처 사용)
    const missileTex = evolvedId && EVOLVED_TEXTURE_MAP[evolvedId]
      ? EVOLVED_TEXTURE_MAP[evolvedId] : 'effect_missile';
    const sprite = this.scene.add.image(px, py, missileTex).setDepth(9);
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
      evolvedId,
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

    // 폭발 시각 효과 (진화 시 전용 폭발 텍스처)
    const explTex = missile.evolvedId && EVOLVED_EXPLOSION_MAP[missile.evolvedId]
      ? EVOLVED_EXPLOSION_MAP[missile.evolvedId] : 'effect_explosion';
    const explSprite = this.scene.add.image(missile.x, missile.y, explTex)
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
      this._triggerEmp(weapon, stats);
      weapon.cooldownTimer = effectiveCooldown;
    }
  }

  /**
   * EMP 폭발을 발동한다. 범위 내 적에게 데미지 + 둔화.
   * 진화(perpetual_emp) 시 전방 120도 부채꼴 충격파로 변경.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _triggerEmp(weapon, stats) {
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    const evolvedId = typeof weapon === 'object' ? weapon._evolvedId : null;
    const px = this.player.x;
    const py = this.player.y;

    const atkMult = this.player.getEffectiveAttackMultiplier
      ? this.player.getEffectiveAttackMultiplier()
      : (this.player.attackMultiplier || 1);
    const baseDamage = Math.floor(stats.damage * atkMult);

    const enemyPool = this.scene.waveSystem ? this.scene.waveSystem.enemyPool : null;
    if (!enemyPool) return;

    // ── 진화: 전방 120도 부채꼴 충격파 ──
    if (evolvedId === 'perpetual_emp') {
      // 가장 가까운 적 방향 계산
      const target = this.findClosestEnemy(px, py, stats.radius);
      let coneAngle;
      if (target) {
        coneAngle = Math.atan2(target.y - py, target.x - px);
      } else {
        coneAngle = Math.atan2(this.player._smoothDirY || 0, this.player._smoothDirX || 1);
      }
      const halfCone = Math.PI / 3; // 60도 = 120도의 절반

      enemyPool.forEach((enemy) => {
        if (!enemy.active) return;

        const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
        if (dist > stats.radius) return;

        // 부채꼴 각도 판정
        const angleToEnemy = Math.atan2(enemy.y - py, enemy.x - px);
        let angleDiff = angleToEnemy - coneAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= halfCone) {
          enemy.takeDamage(baseDamage, false, null, weaponId);
          this.recordDamage(weaponId, baseDamage);

          // 둔화 적용
          if (enemy._originalSpeed === undefined) {
            enemy._originalSpeed = enemy.speed;
          }
          enemy.speed = enemy._originalSpeed * stats.slowFactor;

          this.scene.time.delayedCall(stats.slowDuration, () => {
            if (enemy.active && enemy._originalSpeed !== undefined) {
              enemy.speed = enemy._originalSpeed;
              enemy._originalSpeed = undefined;
            }
          });
        }
      });

      // 부채꼴 VFX 렌더링
      this._showEmpConeEffect(px, py, coneAngle, stats.radius);
      SoundSystem.play('emp_blast');
      return;
    }

    // ── 기본 EMP: 원형 폭발 ──
    enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist <= stats.radius) {
        enemy.takeDamage(baseDamage, false, null, weaponId);
        this.recordDamage(weaponId, baseDamage);

        if (enemy._originalSpeed === undefined) {
          enemy._originalSpeed = enemy.speed;
        }
        enemy.speed = enemy._originalSpeed * stats.slowFactor;

        this.scene.time.delayedCall(stats.slowDuration, () => {
          if (enemy.active && enemy._originalSpeed !== undefined) {
            enemy.speed = enemy._originalSpeed;
            enemy._originalSpeed = undefined;
          }
        });
      }
    });

    VFXSystem.empRing(this.scene, px, py, stats.radius, evolvedId);
    VFXSystem.empBurst(this.scene, px, py, stats.radius, evolvedId);
    SoundSystem.play('emp_blast');
  }

  /**
   * 진화 EMP 부채꼴 충격파 이펙트를 렌더링한다.
   * @param {number} px - 플레이어 X
   * @param {number} py - 플레이어 Y
   * @param {number} angle - 충격파 방향 (라디안)
   * @param {number} radius - 충격파 반경
   * @private
   */
  _showEmpConeEffect(px, py, angle, radius) {
    const halfCone = Math.PI / 3;

    // ── 1. 외곽 보라 글로우 ──
    const glow = this.scene.add.graphics().setDepth(8);
    glow.fillStyle(0xBB44FF, 0.15);
    glow.beginPath();
    glow.moveTo(px, py);
    glow.arc(px, py, radius + 10, angle - halfCone, angle + halfCone, false);
    glow.closePath();
    glow.fillPath();

    this.scene.tweens.add({
      targets: glow,
      alpha: 0, duration: 400,
      onComplete: () => glow.destroy(),
    });

    // ── 2. 시안 코어 부채꼴 ──
    const core = this.scene.add.graphics().setDepth(9);
    core.fillStyle(0x00FFFF, 0.35);
    core.beginPath();
    core.moveTo(px, py);
    core.arc(px, py, radius * 0.8, angle - halfCone * 0.85, angle + halfCone * 0.85, false);
    core.closePath();
    core.fillPath();

    // 흰색 엣지 라인
    core.lineStyle(3, 0xFFFFFF, 0.7);
    core.beginPath();
    core.arc(px, py, radius * 0.7, angle - halfCone * 0.7, angle + halfCone * 0.7, false);
    core.strokePath();

    this.scene.tweens.add({
      targets: core,
      scaleX: 1.2, scaleY: 1.2, alpha: 0,
      duration: 300,
      onComplete: () => core.destroy(),
    });

    // ── 3. 파티클 스파크 ──
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const t = (i / (sparkCount - 1)) * 2 - 1;
      const a = angle + t * halfCone * 0.8;
      const dist = radius * (0.4 + Math.random() * 0.5);
      const sx = px + Math.cos(a) * dist;
      const sy = py + Math.sin(a) * dist;

      const spark = this.scene.add.graphics().setDepth(10);
      const sparkColor = Math.random() > 0.5 ? 0x00FFFF : 0xBB44FF;
      spark.fillStyle(sparkColor, 0.9);
      spark.fillCircle(0, 0, 2 + Math.random() * 2);
      spark.setPosition(sx, sy);

      this.scene.tweens.add({
        targets: spark,
        x: sx + Math.cos(a) * 20,
        y: sy + Math.sin(a) * 20,
        alpha: 0,
        duration: 200 + Math.random() * 150,
        onComplete: () => spark.destroy(),
      });
    }
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
      this._triggerMeleeSlash(weapon, stats);
      weapon.cooldownTimer = effectiveCooldown;
    }
  }

  /**
   * 근접 슬래시를 발동한다. 가장 가까운 적 방향으로 호 범위 데미지 + 넉백.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @private
   */
  _triggerMeleeSlash(weapon, stats) {
    const weaponId = weapon.id;
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

    // 시각 효과: 슬래시 스프라이트 (진화 시 전용 텍스처)
    this._showSlashEffect(px, py, slashAngle, stats.range, weapon._evolvedId);
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
  _showSlashEffect(px, py, angle, range, evolvedId) {
    // 진화 여부와 무관하게 force_slash 스프라이트 기반 렌더링
    const slashTex = evolvedId && EVOLVED_TEXTURE_MAP[evolvedId]
      ? EVOLVED_TEXTURE_MAP[evolvedId] : 'effect_force_slash';
    const offsetX = Math.cos(angle) * range / 2;
    const offsetY = Math.sin(angle) * range / 2;
    const scale = range / 48;

    // phantom_strike: 블레이드 스프라이트 확대 + 보라 글로우 레이어
    if (evolvedId === 'phantom_strike') {
      const glow = this.scene.add.image(px + offsetX, py + offsetY, 'effect_force_slash')
        .setRotation(angle)
        .setScale(scale * 1.4)
        .setAlpha(0.35)
        .setTint(0x8844FF)
        .setDepth(8);
      this.scene.tweens.add({
        targets: glow,
        alpha: 0, scaleX: scale * 1.6, scaleY: scale * 1.6,
        duration: 300,
        onComplete: () => glow.destroy(),
      });
    }

    const sprite = this.scene.add.image(px + offsetX, py + offsetY, slashTex)
      .setRotation(angle)
      .setScale(scale)
      .setAlpha(0.9)
      .setDepth(9);

    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 200,
      onComplete: () => sprite.destroy(),
    });
  }

  /**
   * 팬텀 스트라이크 전용 호(arc) 궤적 슬래시 이펙트.
   * 플레이어 중심에서 arcAngle(240°) 범위로 궤적을 그린다.
   * @param {number} px - 플레이어 X
   * @param {number} py - 플레이어 Y
   * @param {number} angle - 슬래시 방향 (라디안)
   * @param {number} range - 슬래시 사거리
   * @private
   */
  _showArcSlashEffect(px, py, angle, range) {
    const halfArc = (240 * Math.PI / 180) / 2;
    const r = range * 0.75;

    // ── 1. 외곽 글로우 (넓은 반투명 잔상) ──
    const glow = this.scene.add.graphics().setDepth(8);
    glow.lineStyle(18, 0x8844FF, 0.15);
    glow.beginPath();
    glow.arc(px, py, r + 6, angle - halfArc, angle + halfArc, false);
    glow.strokePath();

    this.scene.tweens.add({
      targets: glow,
      alpha: 0, duration: 350,
      onComplete: () => glow.destroy(),
    });

    // ── 2. 메인 슬래시 궤적 ──
    const g = this.scene.add.graphics().setDepth(9);

    // 보라 외곽 호
    g.lineStyle(8, 0x8844FF, 0.4);
    g.beginPath();
    g.arc(px, py, r, angle - halfArc, angle + halfArc, false);
    g.strokePath();

    // 시안 코어 호
    g.lineStyle(4, 0x00FFFF, 0.7);
    g.beginPath();
    g.arc(px, py, r, angle - halfArc * 0.92, angle + halfArc * 0.92, false);
    g.strokePath();

    // 흰색 하이라이트 중심선
    g.lineStyle(2, 0xFFFFFF, 0.9);
    g.beginPath();
    g.arc(px, py, r, angle - halfArc * 0.8, angle + halfArc * 0.8, false);
    g.strokePath();

    // 메인 궤적 확대+페이드 (칼바람 퍼지는 느낌)
    this.scene.tweens.add({
      targets: g,
      scaleX: 1.15, scaleY: 1.15, alpha: 0,
      duration: 250,
      onComplete: () => g.destroy(),
    });

    // ── 3. 파티클 스파크 (궤적 위에 흩뿌림) ──
    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const t = (i / (sparkCount - 1)) * 2 - 1;  // -1 ~ 1
      const a = angle + t * halfArc * 0.9;
      const dist = r + (Math.random() - 0.5) * 12;
      const sx = px + Math.cos(a) * dist;
      const sy = py + Math.sin(a) * dist;

      const spark = this.scene.add.graphics().setDepth(10);
      const sparkColor = Math.random() > 0.4 ? 0x00FFFF : 0xBB66FF;
      spark.fillStyle(sparkColor, 0.9);
      spark.fillCircle(0, 0, 2 + Math.random() * 2);
      spark.setPosition(sx, sy);

      this.scene.tweens.add({
        targets: spark,
        x: sx + Math.cos(a) * (15 + Math.random() * 10),
        y: sy + Math.sin(a) * (15 + Math.random() * 10),
        alpha: 0,
        scaleX: 0.3, scaleY: 0.3,
        duration: 200 + Math.random() * 150,
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ── 구름(cloud) 타입 업데이트 ──

  /**
   * 구름 타입 무기(나노스웜)를 업데이트한다.
   * 기본: 적 위치에 원형 독 구름 생성 → DoT.
   * 진화(bioplasma): 이동 경로에 독 궤적 세그먼트를 남김.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateCloud(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);
    const evolvedId = weapon._evolvedId;

    // ── 진화: 바이오 트레일 (이동 궤적 독) ──
    if (evolvedId === 'bioplasma') {
      this._updateBioTrail(weapon, stats, time, delta);
      return;
    }

    // ── 기본: 원형 독 구름 ──
    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      const activeCloudCount = this._clouds.filter(c => c.weaponId === weapon.id).length;
      if (activeCloudCount < stats.cloudCount) {
        const target = this.findClosestEnemy(this.player.x, this.player.y, 300);
        if (target) {
          this._spawnCloud(target.x, target.y, stats, weapon);
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
   * 바이오플라즈마 트레일을 업데이트한다 (진화 bioplasma 전용).
   * 플레이어 이동 경로에 독 세그먼트를 매 60px마다 배치.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateBioTrail(weapon, stats, time, delta) {
    const px = this.player.x;
    const py = this.player.y;

    // 마지막 트레일 생성 위치 초기화
    if (!this._bioLastTrailPos) {
      this._bioLastTrailPos = { x: px, y: py };
    }

    // 60px 이상 이동했을 때 세그먼트 생성
    const distFromLast = Phaser.Math.Distance.Between(
      this._bioLastTrailPos.x, this._bioLastTrailPos.y, px, py
    );

    if (distFromLast >= 60) {
      const activeTrailCount = this._bioTrails.filter(t => t.weaponId === weapon.id).length;

      // 최대 세그먼트(cloudCount) 초과 시 가장 오래된 것 제거
      if (activeTrailCount >= stats.cloudCount) {
        const oldest = this._bioTrails.find(t => t.weaponId === weapon.id);
        if (oldest) {
          oldest.lifetime = 0; // 다음 루프에서 제거
        }
      }

      // 이동 방향으로 회전하여 세그먼트 배치
      const moveAngle = Math.atan2(py - this._bioLastTrailPos.y, px - this._bioLastTrailPos.x);

      const trailTex = EVOLVED_TEXTURE_MAP['bioplasma'] || 'effect_bioplasma';
      const sprite = this.scene.add.image(px, py, trailTex)
        .setRotation(moveAngle)
        .setScale(stats.radius / 24)
        .setAlpha(0.7)
        .setDepth(5);

      this._bioTrails.push({
        sprite,
        x: px,
        y: py,
        radius: stats.radius,
        tickDamage: stats.tickDamage,
        poisonStack: stats.poisonStack,
        tickTimer: 500,
        lifetime: stats.duration,
        weaponId: weapon.id,
      });

      this._bioLastTrailPos = { x: px, y: py };
    }

    // 활성 트레일 세그먼트 업데이트
    for (let i = this._bioTrails.length - 1; i >= 0; i--) {
      const trail = this._bioTrails[i];
      if (trail.weaponId !== weapon.id) continue;

      trail.lifetime -= delta;
      trail.tickTimer -= delta;

      if (trail.lifetime <= 0) {
        trail.sprite.destroy();
        this._bioTrails.splice(i, 1);
        continue;
      }

      // DoT 틱 (0.5초마다)
      if (trail.tickTimer <= 0) {
        trail.tickTimer = 500;
        this._applyCloudDamage(trail, weapon.id);
      }

      // alpha 맥동
      trail.sprite.setAlpha(0.5 + Math.sin(time * 0.004) * 0.15);

      // 페이드 아웃 (마지막 1초)
      if (trail.lifetime < 1000) {
        trail.sprite.setAlpha(trail.lifetime / 1000 * 0.6);
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
  _spawnCloud(x, y, stats, weapon) {
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    const evolvedId = typeof weapon === 'object' ? weapon._evolvedId : null;
    const cloudTex = evolvedId && EVOLVED_TEXTURE_MAP[evolvedId]
      ? EVOLVED_TEXTURE_MAP[evolvedId] : 'effect_nano_cloud';
    const sprite = this.scene.add.image(x, y, cloudTex)
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

    let cloudHit = false;
    enemyPool.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(cloud.x, cloud.y, enemy.x, enemy.y);
      if (dist <= cloud.radius) {
        enemy.takeDamage(dmg, false, null, weaponId);
        this.recordDamage(weaponId, dmg);
        cloudHit = true;
      }
    });

    // 클라우드 히트 이펙트 (enemy 쿨다운과 별개로 구름 중심에 1회)
    if (cloudHit) {
      VFXSystem.hitSpark(this.scene, cloud.x, cloud.y);
    }
  }

  // ── 중력(gravity) 타입 업데이트 ──

  /**
   * 중력 타입 무기(볼텍스 캐넌)를 업데이트한다.
   * 기본: 적 위치에 원형 소용돌이 발사 → 흡인 + DoT.
   * 진화(event_horizon): 적 밀집 방향에 직선 균열 생성 → 수직 흡인 + DoT.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateGravity(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);
    const evolvedId = weapon._evolvedId;

    // ── 진화: 직선 중력 균열 ──
    if (evolvedId === 'event_horizon') {
      this._updateRift(weapon, stats, time, delta);
      return;
    }

    // ── 기본: 원형 소용돌이 ──
    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      const target = this.findClosestEnemy(this.player.x, this.player.y, 400);
      if (target) {
        this._spawnVortex(target.x, target.y, stats, weapon);
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
          let vortexHit = false;
          enemyPool.forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(vortex.x, vortex.y, enemy.x, enemy.y);
            if (dist <= vortex.pullRadius) {
              enemy.takeDamage(dmg, false, null, weapon.id);
              this.recordDamage(weapon.id, dmg);
              vortexHit = true;
            }
          });
          if (vortexHit) {
            VFXSystem.hitSpark(this.scene, vortex.x, vortex.y);
          }
        }
      }

      // 페이드 아웃 (마지막 0.5초)
      if (vortex.lifetime < 500) {
        vortex.sprite.setAlpha(vortex.lifetime / 500);
      }
    }
  }

  /**
   * 이벤트 호라이즌 균열을 업데이트한다 (진화 event_horizon 전용).
   * 적 밀집 방향에 직선 균열 생성, 수직 방향으로 끌어당기기 + DoT.
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateRift(weapon, stats, time, delta) {
    const px = this.player.x;
    const py = this.player.y;

    weapon.cooldownTimer -= delta;
    if (weapon.cooldownTimer <= 0) {
      // 적이 가장 밀집한 방향 계산
      const riftAngle = this._findDensestDirection(px, py, 400);
      if (riftAngle !== null) {
        this._spawnRift(px, py, riftAngle, stats, weapon);
        weapon.cooldownTimer = stats.cooldown * (this.player.cooldownMultiplier || 1);
      } else {
        weapon.cooldownTimer = 0;
      }
    }

    // 활성 균열 업데이트
    const deltaSec = delta / 1000;
    const riftLength = 280;
    const pullWidth = stats.pullRadius; // 수직 흡인 폭

    for (let i = this._rifts.length - 1; i >= 0; i--) {
      const rift = this._rifts[i];
      if (rift.weaponId !== weapon.id) continue;

      rift.lifetime -= delta;
      rift.tickTimer -= delta;

      if (rift.lifetime <= 0) {
        if (rift.gfx) rift.gfx.destroy();
        this._rifts.splice(i, 1);
        continue;
      }

      // 균열 렌더링 갱신
      this._renderRift(rift, time);

      // 범위 내 적 수직 방향 끌어당기기
      const enemyPool = this.scene.waveSystem?.enemyPool;
      if (enemyPool) {
        // 균열선의 시작/끝점
        const halfLen = riftLength / 2;
        const ax = rift.cx + Math.cos(rift.angle) * halfLen;
        const ay = rift.cy + Math.sin(rift.angle) * halfLen;
        const bx = rift.cx - Math.cos(rift.angle) * halfLen;
        const by = rift.cy - Math.sin(rift.angle) * halfLen;

        // 균열선의 수직(법선) 방향
        const nx = -Math.sin(rift.angle);
        const ny = Math.cos(rift.angle);

        enemyPool.forEach(enemy => {
          if (!enemy.active) return;

          // 점-선분 최단거리
          const dist = this._pointToSegmentDist(enemy.x, enemy.y, ax, ay, bx, by);
          if (dist > pullWidth || dist < 3) return;

          // 균열선 쪽으로 수직 끌어당기기
          const dotProduct = (enemy.x - rift.cx) * nx + (enemy.y - rift.cy) * ny;
          const pullDir = dotProduct > 0 ? -1 : 1;
          const pull = rift.pullForce * deltaSec * (1 - dist / pullWidth);
          enemy.x += nx * pullDir * pull;
          enemy.y += ny * pullDir * pull;
        });

        // 데미지 틱 (0.5초마다)
        if (rift.tickTimer <= 0) {
          rift.tickTimer = 500;
          const atkMult = this.player.getEffectiveAttackMultiplier?.() || 1;
          const dmg = Math.floor(rift.pullDamage * atkMult);
          let riftHit = false;

          enemyPool.forEach(enemy => {
            if (!enemy.active) return;
            const dist = this._pointToSegmentDist(enemy.x, enemy.y, ax, ay, bx, by);
            if (dist <= pullWidth) {
              enemy.takeDamage(dmg, false, null, weapon.id);
              this.recordDamage(weapon.id, dmg);
              riftHit = true;
            }
          });
          if (riftHit) {
            VFXSystem.hitSpark(this.scene, rift.cx, rift.cy);
          }
        }
      }

      // 페이드 아웃 (마지막 0.5초)
      if (rift.lifetime < 500 && rift.gfx) {
        rift.gfx.setAlpha(rift.lifetime / 500);
      }
    }
  }

  /**
   * 적이 가장 밀집한 방향(라디안)을 찾는다.
   * @param {number} px - 기준 X
   * @param {number} py - 기준 Y
   * @param {number} range - 탐색 범위
   * @returns {number|null} 밀집 방향 (라디안) 또는 적 없으면 null
   * @private
   */
  _findDensestDirection(px, py, range) {
    const enemyPool = this.scene.waveSystem?.enemyPool;
    if (!enemyPool) return null;

    // 8방향 섹터별 적 수 카운트
    const sectors = new Array(8).fill(0);
    let totalEnemies = 0;

    enemyPool.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist > range) return;

      const angle = Math.atan2(enemy.y - py, enemy.x - px);
      const sectorIdx = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
      sectors[sectorIdx]++;
      totalEnemies++;
    });

    if (totalEnemies === 0) return null;

    // 최대 밀집 섹터의 중앙 각도 반환
    let maxIdx = 0;
    for (let i = 1; i < 8; i++) {
      if (sectors[i] > sectors[maxIdx]) maxIdx = i;
    }
    return (maxIdx / 8) * Math.PI * 2 - Math.PI;
  }

  /**
   * 중력 균열을 생성한다.
   * @param {number} px - 플레이어 X
   * @param {number} py - 플레이어 Y
   * @param {number} angle - 균열 방향 (라디안)
   * @param {Object} stats - 무기 스탯
   * @param {Object} weapon - 무기 객체
   * @private
   */
  _spawnRift(px, py, angle, stats, weapon) {
    // 균열 중심을 플레이어에서 100px 떨어진 위치에 배치
    const cx = px + Math.cos(angle) * 100;
    const cy = py + Math.sin(angle) * 100;

    const gfx = this.scene.add.graphics().setDepth(9);

    this._rifts.push({
      gfx,
      cx,
      cy,
      angle,
      pullRadius: stats.pullRadius,
      pullDamage: stats.pullDamage,
      pullForce: stats.pullForce,
      lifetime: stats.vortexDuration,
      tickTimer: 500,
      weaponId: weapon.id,
    });
  }

  /**
   * 균열 Graphics를 렌더링한다.
   * @param {Object} rift - 균열 데이터
   * @param {number} time - 현재 시간
   * @private
   */
  _renderRift(rift, time) {
    if (!rift.gfx) return;
    rift.gfx.clear();

    const halfLen = 140; // 280 / 2
    const ax = rift.cx + Math.cos(rift.angle) * halfLen;
    const ay = rift.cy + Math.sin(rift.angle) * halfLen;
    const bx = rift.cx - Math.cos(rift.angle) * halfLen;
    const by = rift.cy - Math.sin(rift.angle) * halfLen;

    const pulse = Math.sin(time * 0.008) * 2;

    // 레이어 1: 넓은 보라 글로우
    rift.gfx.lineStyle(12 + pulse, 0x6600AA, 0.2);
    rift.gfx.lineBetween(ax, ay, bx, by);

    // 레이어 2: 중간 보라
    rift.gfx.lineStyle(6 + pulse * 0.5, 0x9933FF, 0.5);
    rift.gfx.lineBetween(ax, ay, bx, by);

    // 레이어 3: 코어 흰색
    rift.gfx.lineStyle(2, 0xFFFFFF, 0.8);
    rift.gfx.lineBetween(ax, ay, bx, by);

    // 양 끝 글로우 포인트
    rift.gfx.fillStyle(0xBB66FF, 0.6);
    rift.gfx.fillCircle(ax, ay, 5);
    rift.gfx.fillCircle(bx, by, 5);
  }

  /**
   * 볼텍스를 생성한다.
   * @param {number} x - 배치 X
   * @param {number} y - 배치 Y
   * @param {Object} stats - 무기 스탯
   * @param {string} weaponId - 무기 ID
   * @private
   */
  _spawnVortex(x, y, stats, weapon) {
    const weaponId = typeof weapon === 'string' ? weapon : weapon.id;
    const evolvedId = typeof weapon === 'object' ? weapon._evolvedId : null;
    const vortexTex = evolvedId && EVOLVED_TEXTURE_MAP[evolvedId]
      ? EVOLVED_TEXTURE_MAP[evolvedId] : 'effect_vortex';
    const sprite = this.scene.add.image(x, y, vortexTex)
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
   * 기본: 플레이어 주위 원형 공전, 접촉 데미지 + 저주.
   * 진화(death_blossom): 별 형태 방사 발사 + 부메랑 귀환.
   * @param {Object} weapon - 무기 객체
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateRotatingBlade(weapon, time, delta) {
    const stats = this.getWeaponStats(weapon);
    const evolvedId = weapon._evolvedId;

    // ── 진화: 별형 방사 + 부메랑 귀환 ──
    if (evolvedId === 'death_blossom') {
      this._updateDeathBlossom(weapon, stats, time, delta);
      return;
    }

    // ── 기본: 원형 공전 ──
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
   * 데스 블룸 부메랑 스테이트 머신을 업데이트한다 (진화 death_blossom 전용).
   * idle → burst (별형 방사) → return (부메랑 귀환) → idle
   * @param {Object} weapon - 무기 객체
   * @param {Object} stats - 무기 스탯
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateDeathBlossom(weapon, stats, time, delta) {
    if (!this._blossomData.has(weapon.id)) {
      this._blossomData.set(weapon.id, {
        phase: 'idle', // 'idle' | 'burst' | 'return'
        scythes: [],
        cooldownTimer: 0,
      });
    }

    const data = this._blossomData.get(weapon.id);
    const deltaSec = delta / 1000;
    const px = this.player.x;
    const py = this.player.y;
    const maxRange = 200;
    const scytheSpeed = 300;
    const bladeCount = stats.bladeCount || 5;
    // 쿨다운: tickInterval * bladeCount (약 1050ms)
    const burstCooldown = stats.tickInterval * bladeCount;

    if (data.phase === 'idle') {
      data.cooldownTimer -= delta;
      if (data.cooldownTimer <= 0) {
        // 5개 낫을 72도 간격으로 방사 발사
        data.scythes = [];
        const bladeTex = EVOLVED_TEXTURE_MAP['death_blossom'] || 'effect_death_blossom';
        for (let i = 0; i < bladeCount; i++) {
          const angle = (i / bladeCount) * Math.PI * 2;
          const sprite = this.scene.add.image(px, py, bladeTex).setDepth(9).setAlpha(0.9);
          sprite.setRotation(angle);
          data.scythes.push({
            sprite,
            x: px,
            y: py,
            angle,
            distTraveled: 0,
          });
        }
        data.phase = 'burst';
      }

      // idle 상태에서도 기존 블레이드 데이터 정리 (스프라이트 표시 안 함)
      return;
    }

    if (data.phase === 'burst') {
      // 직선 방사 이동
      let allReachedMax = true;
      for (const s of data.scythes) {
        const moveX = Math.cos(s.angle) * scytheSpeed * deltaSec;
        const moveY = Math.sin(s.angle) * scytheSpeed * deltaSec;
        s.x += moveX;
        s.y += moveY;
        s.distTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
        s.sprite.setPosition(s.x, s.y);
        s.sprite.setRotation(s.angle + (time * 0.01)); // 자동 회전

        if (s.distTraveled < maxRange) {
          allReachedMax = false;
        }

        // 진행 중 적 데미지
        this._applyScytheDamage(s, stats, weapon);
      }

      if (allReachedMax) {
        data.phase = 'return';
      }
      return;
    }

    if (data.phase === 'return') {
      // 커브하며 플레이어 위치로 귀환
      let allReturned = true;
      for (let i = data.scythes.length - 1; i >= 0; i--) {
        const s = data.scythes[i];
        const dx = px - s.x;
        const dy = py - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30) {
          // 플레이어 근접 — 제거
          s.sprite.destroy();
          data.scythes.splice(i, 1);
          continue;
        }

        allReturned = false;
        // 귀환 방향으로 회전 (커브 효과)
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - s.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        s.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 4.0 * deltaSec);

        const moveX = Math.cos(s.angle) * scytheSpeed * deltaSec;
        const moveY = Math.sin(s.angle) * scytheSpeed * deltaSec;
        s.x += moveX;
        s.y += moveY;
        s.sprite.setPosition(s.x, s.y);
        s.sprite.setRotation(s.angle + (time * 0.01));

        // 귀환 중에도 적 데미지
        this._applyScytheDamage(s, stats, weapon);
      }

      if (allReturned || data.scythes.length === 0) {
        data.phase = 'idle';
        data.cooldownTimer = burstCooldown;
        // 남은 스프라이트 정리
        for (const s of data.scythes) {
          s.sprite.destroy();
        }
        data.scythes = [];
      }
    }
  }

  /**
   * 단일 낫 근처 적에게 데미지 + 저주를 적용한다 (death_blossom 전용).
   * @param {Object} scythe - 낫 데이터 { x, y, ... }
   * @param {Object} stats - 무기 스탯
   * @param {Object} weapon - 무기 객체
   * @private
   */
  _applyScytheDamage(scythe, stats, weapon) {
    const atkMult = this.player.getEffectiveAttackMultiplier?.() || 1;
    const baseDamage = Math.floor(stats.damage * atkMult);
    const enemyPool = this.scene.waveSystem?.enemyPool;
    if (!enemyPool) return;

    enemyPool.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(scythe.x, scythe.y, enemy.x, enemy.y);
      if (dist > 25) return; // 낫 히트 범위

      // 프레임당 동일 적 다중 히트 방지 (쿨다운 태그)
      const hitTag = `_blossomHit_${weapon.id}`;
      if (enemy[hitTag]) return;
      enemy[hitTag] = true;
      this.scene.time.delayedCall(stats.tickInterval, () => {
        if (enemy.active) enemy[hitTag] = false;
      });

      const { damage, isCrit } = this._rollCrit(baseDamage);
      enemy.takeDamage(damage, true, null, weapon.id);
      this.recordDamage(weapon.id, damage);
      if (isCrit) this._showCritEffect(enemy.x, enemy.y);

      // 저주: 속도 -30%
      if (!enemy._reaperCursed) {
        enemy._reaperCursed = true;
        enemy._originalSpeed = enemy._originalSpeed || enemy.speed;
        enemy.speed *= 0.7;
        enemy.setTint(0xFF3333);
        this.scene.time.delayedCall(stats.curseDuration, () => {
          if (enemy.active) {
            enemy.speed = enemy._originalSpeed || enemy.speed / 0.7;
            enemy._reaperCursed = false;
            enemy.clearTint();
          }
        });
      }
    });
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

    // 새 블레이드 생성 (진화 시 전용 텍스처)
    const bladeTex = weapon._evolvedId && EVOLVED_TEXTURE_MAP[weapon._evolvedId]
      ? EVOLVED_TEXTURE_MAP[weapon._evolvedId] : 'effect_reaper_blade';
    for (let i = 0; i < stats.bladeCount; i++) {
      const sprite = this.scene.add.image(0, 0, bladeTex).setDepth(9);
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

    // 기존 활성 이펙트의 텍스처 즉시 교체
    this._applyEvolvedTextures(weapon);

    return true;
  }

  /**
   * 진화 직후 기존 활성 이펙트(오브, 드론, 블레이드)의 텍스처를 즉시 교체한다.
   * 진화로 동작 패턴이 바뀌는 무기는 기존 이펙트를 제거한다.
   * @param {Object} weapon - 진화된 무기 객체
   * @private
   */
  _applyEvolvedTextures(weapon) {
    const texKey = EVOLVED_TEXTURE_MAP[weapon._evolvedId];

    // 오브(orbital) — plasma_orb → guardian_sphere
    if (texKey && this.scene.textures.exists(texKey)) {
      const orbInfo = this._orbData.get(weapon.id);
      if (orbInfo) {
        for (const sprite of orbInfo.graphics) {
          sprite.setTexture(texKey);
        }
      }
    }

    // death_blossom: 기존 원형 공전 블레이드 제거 (부메랑 시스템으로 전환)
    if (weapon._evolvedId === 'death_blossom') {
      const bladeInfo = this._bladeData.get(weapon.id);
      if (bladeInfo) {
        for (const sprite of bladeInfo.sprites) {
          sprite.destroy();
        }
        bladeInfo.sprites = [];
      }
      this._bladeData.delete(weapon.id);
      return;
    }

    // event_horizon: 기존 원형 소용돌이 제거 (균열 시스템으로 전환)
    if (weapon._evolvedId === 'event_horizon') {
      for (let i = this._vortexes.length - 1; i >= 0; i--) {
        if (this._vortexes[i].weaponId === weapon.id) {
          this._vortexes[i].sprite.destroy();
          this._vortexes.splice(i, 1);
        }
      }
      return;
    }

    // bioplasma: 기존 구름 제거 (트레일 시스템으로 전환)
    if (weapon._evolvedId === 'bioplasma') {
      for (let i = this._clouds.length - 1; i >= 0; i--) {
        if (this._clouds[i].weaponId === weapon.id) {
          this._clouds[i].sprite.destroy();
          this._clouds.splice(i, 1);
        }
      }
      return;
    }

    // 블레이드(reaper) — 텍스처 교체 (진화했지만 패턴 동일한 경우)
    if (texKey && this.scene.textures.exists(texKey)) {
      const bladeInfo = this._bladeData.get(weapon.id);
      if (bladeInfo) {
        for (const sprite of bladeInfo.sprites) {
          sprite.setTexture(texKey);
        }
      }
    }
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

    // 진화 시 투사체 텍스처 교체
    if (weapon._evolvedId && EVOLVED_TEXTURE_MAP[weapon._evolvedId] &&
        this.scene.textures.exists(EVOLVED_TEXTURE_MAP[weapon._evolvedId])) {
      proj.setTexture(EVOLVED_TEXTURE_MAP[weapon._evolvedId]);
    } else {
      // 원본 텍스처로 복원 (풀 재사용 시 진화 텍스처 잔류 방지)
      const defaultTex = this.scene.textures.exists('effect_projectile') ? 'effect_projectile' : 'projectile';
      proj.setTexture(defaultTex);
    }

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

    // 바이오 트레일 제거
    for (const trail of this._bioTrails) {
      if (trail.sprite) trail.sprite.destroy();
    }
    this._bioTrails = [];
    this._bioLastTrailPos = null;

    // 균열 제거
    for (const rift of this._rifts) {
      if (rift.gfx) rift.gfx.destroy();
    }
    this._rifts = [];

    // 데스 블룸 부메랑 제거
    for (const [, data] of this._blossomData) {
      for (const s of data.scythes) {
        if (s.sprite) s.sprite.destroy();
      }
    }
    this._blossomData.clear();

    // 진화 EMP 부채꼴 Graphics 제거
    if (this._empConeGraphics) {
      this._empConeGraphics.destroy();
      this._empConeGraphics = null;
    }

    this.weapons = [];
  }
}
