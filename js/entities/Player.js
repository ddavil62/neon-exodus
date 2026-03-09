/**
 * @fileoverview 플레이어 캐릭터 엔티티.
 *
 * 가상 조이스틱 입력으로 이동하며, 피격/무적/레벨업/HP 리젠 등
 * 플레이어의 핵심 로직을 담당한다. XP 보석 자석 흡수,
 * 메타 업그레이드 반영도 이 클래스에서 처리한다.
 */

import {
  COLORS,
  PLAYER_BASE_SPEED,
  PLAYER_BASE_HP,
  PLAYER_BASE_DEFENSE,
  PLAYER_INVINCIBLE_DURATION,
  XP_MAGNET_RADIUS,
  XP_FORMULA,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SPRITE_SCALE,
} from '../config.js';
import { getPassiveById } from '../data/passives.js';

// ── Player 클래스 ──

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 아이들 애니메이션 재생 (스프라이트시트 로드된 경우에만)
    if (scene.anims.exists('player_idle')) {
      this.play('player_idle');
    }

    // ── 기본 스탯 ──

    /** 최대 HP */
    this.maxHp = PLAYER_BASE_HP;

    /** 현재 HP */
    this.currentHp = PLAYER_BASE_HP;

    /** 기본 이동 속도 (px/s) */
    this.baseSpeed = PLAYER_BASE_SPEED;

    /** 현재 레벨 */
    this.level = 1;

    /** 현재 경험치 */
    this.xp = 0;

    /** 다음 레벨까지 필요한 XP */
    this.xpToNext = XP_FORMULA(1);

    /** 총 킬 수 */
    this.kills = 0;

    /** 무적 상태 여부 */
    this.invincible = false;

    /** 무적 타이머 (ms, 남은 시간) */
    this.invincibleTimer = 0;

    /** 피격 후 무적 지속 시간 (ms) */
    this.invincibleDuration = PLAYER_INVINCIBLE_DURATION * 1000;

    // ── 메타 업그레이드 반영 스탯 ──

    /** 공격력 배수 */
    this.attackMultiplier = 1.0;

    /** 이동속도 배수 */
    this.speedMultiplier = 1.0;

    /** 최대 HP 배수 */
    this.maxHpMultiplier = 1.0;

    /** XP 획득 배수 */
    this.xpMultiplier = 1.0;

    /** 자석 반경 배수 */
    this.magnetMultiplier = 1.0;

    /** 방어력 (고정 피해 감소) */
    this.armor = PLAYER_BASE_DEFENSE;

    /** 초당 HP 회복 */
    this.regen = 0;

    /** 쿨다운 감소 배수 (0~1, 예: 0.9 = 10% 감소) */
    this.cooldownMultiplier = 1.0;

    /** 투사체 속도 배수 */
    this.projectileSpeedMultiplier = 1.0;

    /** 효과 범위 배수 */
    this.areaMultiplier = 1.0;

    /** 크리티컬 확률 (0~1) */
    this.critChance = 0;

    /** 크리티컬 데미지 배수 */
    this.critDamage = 1.5;

    /** 크리티컬 데미지 추가 배수 (캐릭터 고유 패시브에서 설정) */
    this.critDamageMultiplier = 0.0;

    /** 저체력 시 추가 공격력 보너스 (캐릭터 고유 패시브에서 설정) */
    this.lowHpAttackBonus = 0.0;

    /** 저체력 판단 기준 (HP 비율, 0~1) */
    this.hpThreshold = 0.5;

    // ── Phase 4 캐릭터 패시브 속성 ──

    /** HP 재생 배수 (메딕 패시브: x2.0) */
    this.regenMultiplier = 1.0;

    /** 드론 소환 보너스 (engineer: +1, 드론 droneCount에 더함) */
    this.droneSummonBonus = 0;

    /** 레벨업 무기 추천 가중치 (hidden: 2.0) */
    this.weaponChoiceBias = 1.0;

    /** 최대 HP 페널티 (메딕: 0.30 = maxHp * 0.70) */
    this.maxHpPenalty = 0;

    // ── 리젠 타이머 ──
    this._regenTimer = 0;

    // ── 패시브 아이템 ──

    /** 보유 패시브 목록 { passiveId: level } */
    this._passives = {};

    // ── 물리 설정 ──

    // 스프라이트 스케일 적용 (픽셀아트 선명 유지)
    this.setScale(SPRITE_SCALE);

    // 원형 충돌체 (반경 12px, 48x48 디스플레이 기준)
    const bodyOff = (24 * SPRITE_SCALE) / 2 - 12;
    this.body.setCircle(12, bodyOff, bodyOff);
    this.body.setCollideWorldBounds(true);

    // depth 설정 (적 위에 표시)
    this.setDepth(10);
  }

  // ── 공개 메서드 ──

  /**
   * 매 프레임 호출. 이동, 무적 타이머, HP 리젠을 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.active) return;

    // 1. 조이스틱 입력으로 이동
    this._handleMovement();

    // 2. 무적 타이머 갱신
    this._updateInvincibility(delta);

    // 3. HP 리젠 적용
    this._updateRegen(delta);
  }

  /**
   * 플레이어에게 데미지를 입힌다.
   * 무적 상태이면 무시. 방어력만큼 고정 감소. HP가 0 이하이면 사망 처리.
   * @param {number} amount - 원래 데미지 양
   */
  takeDamage(amount) {
    if (this.invincible || !this.active) return;

    // 방어력 적용 (최소 1 데미지 보장)
    const actualDamage = Math.max(1, amount - this.armor);
    this.currentHp -= actualDamage;

    // 무적 활성화
    this.invincible = true;
    this.invincibleTimer = this.invincibleDuration;

    // 피격 플래시 (빨간 틴트)
    this.setTint(COLORS.HP_RED);
    this.scene.time.delayedCall(150, () => {
      if (this.active) this.clearTint();
    });

    // 사망 판정
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      if (this.scene.onPlayerDeath) {
        this.scene.onPlayerDeath();
      }
    }
  }

  /**
   * XP를 획득한다. xpMultiplier를 반영한다.
   * @param {number} amount - 기본 XP 양
   */
  addXP(amount) {
    this.xp += Math.floor(amount * this.xpMultiplier);

    // 레벨업 연쇄 처리 (다단 레벨업 가능)
    while (this.xp >= this.xpToNext) {
      this._levelUp();
    }
  }

  /**
   * HP를 회복한다. 최대 HP를 초과하지 않는다.
   * @param {number} amount - 회복량
   */
  heal(amount) {
    this.currentHp = Math.min(this.currentHp + amount, this.maxHp);
  }

  /**
   * 메타 영구 업그레이드를 스탯에 반영한다.
   * @param {Object} upgrades - 영구 업그레이드 데이터
   * @param {number} [upgrades.attackLevel=0] - 공격력 업그레이드 레벨
   * @param {number} [upgrades.maxHpLevel=0] - 최대 체력 업그레이드 레벨
   * @param {number} [upgrades.regenLevel=0] - 체력 회복 업그레이드 레벨
   * @param {number} [upgrades.defenseLevel=0] - 방어력 업그레이드 레벨
   * @param {number} [upgrades.speedLevel=0] - 이동속도 업그레이드 레벨
   * @param {number} [upgrades.cooldownLevel=0] - 쿨다운 감소 업그레이드 레벨
   * @param {number} [upgrades.projSpeedLevel=0] - 투사체 속도 업그레이드 레벨
   * @param {number} [upgrades.areaLevel=0] - 효과 범위 업그레이드 레벨
   * @param {number} [upgrades.xpLevel=0] - XP 획득량 업그레이드 레벨
   * @param {number} [upgrades.magnetLevel=0] - 자석 반경 업그레이드 레벨
   * @param {number} [upgrades.invincibleLevel=0] - 무적 시간 업그레이드 레벨
   */
  applyMetaUpgrades(upgrades) {
    if (!upgrades) return;

    // 공격력: +5% / 레벨
    this.attackMultiplier = 1 + (upgrades.attackLevel || 0) * 0.05;

    // 최대 체력: +10% / 레벨
    this.maxHpMultiplier = 1 + (upgrades.maxHpLevel || 0) * 0.10;
    this.maxHp = Math.floor(PLAYER_BASE_HP * this.maxHpMultiplier);
    this.currentHp = this.maxHp;

    // 체력 회복: +0.1/초 / 레벨
    this.regen = (upgrades.regenLevel || 0) * 0.1;

    // 방어력: +1 / 레벨
    this.armor = PLAYER_BASE_DEFENSE + (upgrades.defenseLevel || 0);

    // 이동속도: +3% / 레벨
    this.speedMultiplier = 1 + (upgrades.speedLevel || 0) * 0.03;

    // 쿨다운 감소: -2% / 레벨 (곱연산, 낮을수록 빠름)
    this.cooldownMultiplier = 1 - (upgrades.cooldownLevel || 0) * 0.02;

    // 투사체 속도: +5% / 레벨
    this.projectileSpeedMultiplier = 1 + (upgrades.projSpeedLevel || 0) * 0.05;

    // 효과 범위: +4% / 레벨
    this.areaMultiplier = 1 + (upgrades.areaLevel || 0) * 0.04;

    // XP 획득량: +5% / 레벨
    this.xpMultiplier = 1 + (upgrades.xpLevel || 0) * 0.05;

    // 자석 반경: +5% / 레벨
    this.magnetMultiplier = 1 + (upgrades.magnetLevel || 0) * 0.05;

    // 무적 시간: +0.2초 / 레벨
    this.invincibleDuration =
      (PLAYER_INVINCIBLE_DURATION + (upgrades.invincibleLevel || 0) * 0.2) * 1000;
  }

  /**
   * 유효 공격력 배수를 반환한다.
   * 저체력 보너스(버서커 고유 패시브)를 포함한다.
   * @returns {number} 유효 공격력 배수
   */
  getEffectiveAttackMultiplier() {
    let mult = this.attackMultiplier;

    // 저체력 공격 보너스 (버서커 고유 패시브)
    if (this.lowHpAttackBonus > 0 && this.currentHp <= this.maxHp * this.hpThreshold) {
      mult += this.lowHpAttackBonus;
    }

    return mult;
  }

  // ── 패시브 아이템 관리 ──

  /**
   * 새 패시브 아이템을 추가한다.
   * @param {string} passiveId - 패시브 ID
   */
  addPassive(passiveId) {
    this._passives[passiveId] = 1;
    this._applyPassiveEffects();
  }

  /**
   * 보유 패시브 아이템을 레벨업한다.
   * @param {string} passiveId - 패시브 ID
   */
  upgradePassive(passiveId) {
    const currentLv = this._passives[passiveId] || 0;
    this._passives[passiveId] = currentLv + 1;
    this._applyPassiveEffects();
  }

  /**
   * 모든 패시브 효과를 스탯에 재계산하여 반영한다.
   * 패시브 추가/레벨업 시 내부적으로 호출된다.
   * @private
   */
  _applyPassiveEffects() {
    // 패시브 영향 스탯을 기본값으로 리셋
    this.speedMultiplier = 1.0;
    this.armor = PLAYER_BASE_DEFENSE;
    this.cooldownMultiplier = 1.0;
    this.magnetMultiplier = 1.0;
    this.regen = 0;
    this.critChance = 0;

    // 각 보유 패시브의 누적 효과 적용
    for (const [passiveId, level] of Object.entries(this._passives)) {
      const pData = getPassiveById(passiveId);
      if (!pData) continue;

      const totalEffect = pData.effectPerLevel * level;

      switch (pData.stat) {
        case 'moveSpeed':
          this.speedMultiplier = 1 + totalEffect;
          break;
        case 'defense':
          this.armor = PLAYER_BASE_DEFENSE + totalEffect;
          break;
        case 'maxHp': {
          const newMaxHp = PLAYER_BASE_HP + totalEffect;
          this.maxHp = newMaxHp;
          if (this.currentHp > this.maxHp) this.currentHp = this.maxHp;
          break;
        }
        case 'attackSpeed':
          this.cooldownMultiplier = 1 - totalEffect;
          break;
        case 'xpMagnetRadius':
          this.magnetMultiplier = 1 + totalEffect;
          break;
        case 'hpRegen':
          this.regen = totalEffect;
          break;
        case 'critChance':
          this.critChance = totalEffect;
          break;
        case 'cooldownReduction':
          this.cooldownMultiplier = Math.max(0.3, 1 - totalEffect);
          break;
        // projectileRange, creditDropBonus: 외부 시스템에서 처리
      }
    }
  }

  // ── 내부 메서드 ──

  /**
   * 조이스틱 입력 또는 AutoPilot AI 방향을 읽어 velocity를 설정한다.
   * 자동 사냥이 활성화된 경우에도 유저 조이스틱 입력이 있으면 유저 입력을 우선한다.
   * @private
   */
  _handleMovement() {
    const joystick = this.scene.joystick;
    const autoPilot = this.scene.autoPilot;

    let dirX = 0;
    let dirY = 0;

    // 1. 유저 조이스틱 입력 확인 (최우선)
    if (joystick && joystick.isActive && (joystick.direction.x !== 0 || joystick.direction.y !== 0)) {
      dirX = joystick.direction.x;
      dirY = joystick.direction.y;
    }
    // 2. AutoPilot AI 방향 사용 (유저 입력 없을 때)
    else if (autoPilot && autoPilot.enabled && (autoPilot.direction.x !== 0 || autoPilot.direction.y !== 0)) {
      dirX = autoPilot.direction.x;
      dirY = autoPilot.direction.y;
    }

    const speed = this.baseSpeed * this.speedMultiplier;

    if (dirX === 0 && dirY === 0) {
      this.body.setVelocity(0, 0);
    } else {
      this.body.setVelocity(dirX * speed, dirY * speed);
    }
  }

  /**
   * 무적 타이머를 갱신한다.
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateInvincibility(delta) {
    if (!this.invincible) return;

    this.invincibleTimer -= delta;

    // 무적 시각 표현 (깜빡임)
    const blinkPhase = Math.floor(this.invincibleTimer / 100) % 2;
    this.setAlpha(blinkPhase === 0 ? 1 : 0.5);

    if (this.invincibleTimer <= 0) {
      this.invincible = false;
      this.invincibleTimer = 0;
      this.setAlpha(1);
    }
  }

  /**
   * HP 자동 회복을 적용한다.
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateRegen(delta) {
    if (this.regen <= 0) return;
    if (this.currentHp >= this.maxHp) return;

    this._regenTimer += delta;

    // 1초마다 regen * regenMultiplier 양만큼 회복
    if (this._regenTimer >= 1000) {
      this._regenTimer -= 1000;
      this.heal(this.regen * this.regenMultiplier);
    }
  }

  /**
   * 레벨업 처리. XP를 소비하고 씬의 onLevelUp()을 호출한다.
   * @private
   */
  _levelUp() {
    this.xp -= this.xpToNext;
    this.level++;
    this.xpToNext = XP_FORMULA(this.level);

    // 씬의 레벨업 이벤트 트리거 (3택 선택 UI)
    if (this.scene.onLevelUp) {
      this.scene.onLevelUp();
    }
  }
}
