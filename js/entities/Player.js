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
  SPRITE_SCALE,
  OVERCLOCK_DURATION,
  OVERCLOCK_SPEED_MULT,
  OVERCLOCK_COOLDOWN_MULT,
  SHIELD_DURATION,
  SHIELD_REFLECT_DAMAGE,
} from '../config.js';
import { getPassiveById } from '../data/passives.js';

// ── Player 클래스 ──

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   * @param {string} [characterId="agent"] - 캐릭터 ID (텍스처 키 결정에 사용)
   */
  constructor(scene, x, y, characterId = 'agent') {
    // characterId로 idle 텍스처 키 결정
    const idleKey = characterId === 'agent' ? 'player' : characterId;
    super(scene, x, y, idleKey);

    /** 선택된 캐릭터 ID */
    this.characterId = characterId;

    /** idle 텍스처 키 (정지 시 복귀용) */
    this._idleTextureKey = idleKey;

    /** walk 스프라이트시트 텍스처 키 */
    this._walkTextureKey = characterId === 'agent' ? 'player_walk' : `${characterId}_walk`;

    /** walk 애니메이션 키 접두사 (예: 'walk' 또는 'sniper_walk') */
    this._walkAnimPrefix = characterId === 'agent' ? 'walk' : `${characterId}_walk`;

    /** 이전 걷기 방향 섹터 인덱스 (0~7, 히스테리시스용) — -1이면 미설정 */
    this._lastWalkSector = -1;

    /** 방향 벡터 스무딩용 EMA 값 (미세 진동 필터링) */
    this._smoothDirX = 0;
    this._smoothDirY = 0;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 아이들 맥동 tween 애니메이션 (정지 시에만 재생, 이동 시 일시 정지)
    this._idleTween = scene.tweens.add({
      targets: this,
      scaleX: { from: 1.0, to: 1.05 },
      scaleY: { from: 1.0, to: 0.95 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

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

    /** 피해 감소율 (0~1, 예: 0.25 = 25% 감소) */
    this.armorRate = PLAYER_BASE_DEFENSE;

    /** 초당 HP 회복 */
    this.regen = 0;

    /** 쿨다운 감소 배수 (0~1, 예: 0.9 = 10% 감소) */
    this.cooldownMultiplier = 1.0;

    /** 투사체 속도 배수 */
    this.projectileSpeedMultiplier = 1.0;

    /** 효과 범위 배수 */
    this.areaMultiplier = 1.0;

    /** 공격력 배율 (데미지 앰프 패시브) */
    this.damageMultiplier = 1.0;

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

    // ── 소모성 아이템 버프 상태 ──

    /** 오버클럭 잔여 시간 (ms). 0이면 비활성 */
    this._overclockTimer = 0;

    /** 오버클럭 적용 전 원래 speedMultiplier */
    this._preOverclockSpeed = 1.0;

    /** 오버클럭 적용 전 원래 cooldownMultiplier */
    this._preOverclockCooldown = 1.0;

    /** 쉴드 배터리 잔여 시간 (ms). 0이면 비활성 */
    this._shieldTimer = 0;

    /** 쉴드 활성 여부 */
    this.shieldActive = false;

    // ── 패시브 아이템 ──

    /** 보유 패시브 목록 { passiveId: level } */
    this._passives = {};

    // ── 물리 설정 ──

    // 스프라이트 스케일 적용 (픽셀아트 선명 유지)
    this.setScale(SPRITE_SCALE);

    // 원형 충돌체 (반경 12px)
    // SPRITE_SCALE=1이면 offset = frameW/2 - radius (scale 나눗셈 없음)
    const bodyOff = Math.max(0, 48 / 2 - 12); // =12
    this.body.setCircle(12, bodyOff, bodyOff);
    this.body.setCollideWorldBounds(false);

    // depth 설정 (적 위에 표시)
    this.setDepth(10);

    /** 발밑 글로우 서클 (GameScene에서 주입) */
    this.glowCircle = null;

    /** 글로우 펄스 시간 누적 (ms) */
    this._glowPulseTime = 0;

    /** 글로우 피격 플래시 진행 중 여부 */
    this._glowFlashing = false;

    // ── 걷기 애니메이션 상태 ──

    /** 현재 이동 중 여부 (걷기/idle 전환 판단용) */
    this._isMoving = false;
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

    // 4. 소모성 아이템 버프 타이머 갱신
    this._updateBuffs(delta);

    // 5. 글로우 서클 펄스
    this._updateGlowPulse(delta);
  }

  /**
   * 플레이어에게 데미지를 입힌다.
   * 무적 상태이면 무시. 방어력만큼 고정 감소. HP가 0 이하이면 사망 처리.
   * @param {number} amount - 원래 데미지 양
   */
  takeDamage(amount) {
    if (this.invincible || !this.active) return;

    // 방어력 적용 — 퍼센트 감소 (최소 1 데미지 보장)
    const actualDamage = Math.max(1, Math.floor(amount * (1 - this.armorRate)));
    this.currentHp -= actualDamage;

    // 무적 활성화
    this.invincible = true;
    this.invincibleTimer = this.invincibleDuration;

    // 피격 플래시 (빨간 틴트)
    this.setTint(COLORS.HP_RED);
    this.scene.time.delayedCall(150, () => {
      if (this.active) this.clearTint();
    });

    // 글로우 서클 피격 플래시
    if (this.glowCircle) {
      this._glowFlashing = true;
      this.glowCircle.setAlpha(0.9);
      this.scene.time.delayedCall(150, () => {
        if (this.active) this._glowFlashing = false;
      });
    }

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

    // 방어력: +1% / 레벨 (퍼센트 감소)
    this.armorRate = PLAYER_BASE_DEFENSE + (upgrades.defenseLevel || 0) * 0.01;

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

    // 데미지 앰프 패시브 배율 적용
    if (this.damageMultiplier && this.damageMultiplier > 1) {
      mult *= this.damageMultiplier;
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
    this.armorRate = PLAYER_BASE_DEFENSE;
    this.cooldownMultiplier = 1.0;
    this.magnetMultiplier = 1.0;
    this.regen = 0;
    this.critChance = 0;
    this.damageMultiplier = 1.0;

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
          this.armorRate = PLAYER_BASE_DEFENSE + totalEffect;
          break;
        case 'maxHp': {
          const newMaxHp = PLAYER_BASE_HP + totalEffect;
          // maxHp 증가분만큼 currentHp도 함께 상승 (체력이 줄어드는 느낌 방지)
          const hpDiff = newMaxHp - this.maxHp;
          this.maxHp = newMaxHp;
          if (hpDiff > 0) this.currentHp = Math.min(this.currentHp + hpDiff, this.maxHp);
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
        case 'attackDamage':
          this.damageMultiplier = 1 + totalEffect;
          break;
        // projectileRange, creditDropBonus: 외부 시스템에서 처리
      }
    }
  }

  // ── 글로우 서클 펄스 ──

  /**
   * 발밑 글로우 서클의 알파를 사인파로 진동시킨다.
   * 피격 플래시 중에는 동작하지 않는다.
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateGlowPulse(delta) {
    if (!this.glowCircle || this._glowFlashing) return;
    this._glowPulseTime += delta;
    // 주기 1500ms, alpha 범위 0.25 ~ 0.40
    const alpha = 0.325 + 0.075 * Math.sin(this._glowPulseTime / 1500 * Math.PI * 2);
    this.glowCircle.setAlpha(alpha);
  }

  // ── 소모성 아이템 버프 ──

  /**
   * 오버클럭 버프를 적용한다.
   * 이미 활성 중이면 타이머만 리셋한다 (중복 연장 불허).
   */
  applyOverclock() {
    if (this._overclockTimer <= 0) {
      // 최초 적용: 현재 값 저장 후 버프 적용
      this._preOverclockSpeed = this.speedMultiplier;
      this._preOverclockCooldown = this.cooldownMultiplier;
      this.speedMultiplier *= OVERCLOCK_SPEED_MULT;
      this.cooldownMultiplier *= OVERCLOCK_COOLDOWN_MULT;
    }
    // 타이머 리셋 (활성 중 재수집 시에도 타이머만 초기화)
    this._overclockTimer = OVERCLOCK_DURATION;
  }

  /**
   * 쉴드 배터리 버프를 적용한다.
   * 이미 활성 중이면 타이머만 리셋한다 (중복 연장 불허).
   */
  applyShield() {
    this.shieldActive = true;
    this.invincible = true;
    // 타이머 리셋 (쉴드는 전용 타이머로 무적 관리)
    this._shieldTimer = SHIELD_DURATION;
    // 시각 표시: 보라색 틴트
    this.setTint(0xAA44FF);
  }

  /**
   * 쉴드 활성 시 접촉한 적에게 반사 대미지를 가한다.
   * @param {import('./Enemy.js').default} enemy - 접촉한 적
   */
  reflectShieldDamage(enemy) {
    if (this.shieldActive && enemy && enemy.active) {
      enemy.takeDamage(SHIELD_REFLECT_DAMAGE, false);
    }
  }

  /**
   * 소모성 아이템 버프 타이머를 갱신한다.
   * 만료 시 원래 값으로 복원한다.
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _updateBuffs(delta) {
    // ── 오버클럭 타이머 ──
    if (this._overclockTimer > 0) {
      this._overclockTimer -= delta;
      if (this._overclockTimer <= 0) {
        this._overclockTimer = 0;
        // 원래 값 복원
        this.speedMultiplier = this._preOverclockSpeed;
        this.cooldownMultiplier = this._preOverclockCooldown;
      }
    }

    // ── 쉴드 타이머 ──
    if (this._shieldTimer > 0) {
      this._shieldTimer -= delta;
      // 쉴드 중에는 무적 유지 (피격 무적 타이머와 별개)
      this.invincible = true;
      if (this._shieldTimer <= 0) {
        this._shieldTimer = 0;
        this.shieldActive = false;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.clearTint();
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
      // 정지: idle 상태로 전환 (걷기 애니메이션 중단, idle tween 재개)
      this._setIdleState();
    } else {
      this.body.setVelocity(dirX * speed, dirY * speed);
      // 이동: 방향에 맞는 걷기 애니메이션 재생
      this._playWalkAnim(dirX, dirY);
    }
  }

  /**
   * 이동 방향(dirX, dirY)을 8방향으로 매핑하여 해당 걷기 애니메이션을 재생한다.
   * left 계열 3방향(down-left, left, up-left)은 flipX=true + 미러 방향 애니메이션으로 처리한다.
   * @param {number} dirX - X 방향 성분 (-1~1)
   * @param {number} dirY - Y 방향 성분 (-1~1)
   * @private
   */
  _playWalkAnim(dirX, dirY) {
    // 처음 이동 시작: idle tween 일시 정지 + 스케일 정상화 + 스무딩 초기화
    if (!this._isMoving) {
      this._isMoving = true;
      this._lastWalkSector = -1;
      this._smoothDirX = dirX;
      this._smoothDirY = dirY;
      if (this._idleTween) this._idleTween.pause();
      this.setScale(SPRITE_SCALE);
    }

    // 방향 벡터 지수이동평균(EMA) 스무딩 — 미세 진동 필터링
    // 계수 0.65: 이전 값 65% + 현재 값 35%, 약 2~3프레임 지연 (60fps 기준 ~40ms)
    const SMOOTH = 0.65;
    this._smoothDirX = this._smoothDirX * SMOOTH + dirX * (1 - SMOOTH);
    this._smoothDirY = this._smoothDirY * SMOOTH + dirY * (1 - SMOOTH);

    // 스무딩된 방향 벡터로 각도 계산
    // atan2(y, x): 0=오른쪽(East), Phaser Y축 아래 양수 기준 시계방향 증가
    const angle = Math.atan2(this._smoothDirY, this._smoothDirX);
    const deg = (angle * 180 / Math.PI + 360) % 360;

    // 8방향 섹터 중심 각도 (인덱스 0~7)
    // 0=E(0°), 1=SE(45°), 2=S(90°), 3=SW(135°), 4=W(180°), 5=NW(225°), 6=N(270°), 7=NE(315°)
    const SECTOR_CENTERS = [0, 45, 90, 135, 180, 225, 270, 315];

    // 현재 각도에 가장 가까운 섹터 인덱스 계산
    let bestSector = 0;
    let bestDist = 360;
    for (let i = 0; i < 8; i++) {
      let diff = Math.abs(deg - SECTOR_CENTERS[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDist) {
        bestDist = diff;
        bestSector = i;
      }
    }

    // 히스테리시스: 이전 섹터 중심에서 38도 이상 벗어나야 방향 전환 (경계 진동 방지)
    // 스무딩과 함께 이중 방어: 스무딩이 미세 진동을 필터링하고,
    // 히스테리시스가 잔여 경계 진동을 방지한다
    if (this._lastWalkSector >= 0 && this._lastWalkSector !== bestSector) {
      const lastCenter = SECTOR_CENTERS[this._lastWalkSector];
      let distFromLast = Math.abs(deg - lastCenter);
      if (distFromLast > 180) distFromLast = 360 - distFromLast;
      if (distFromLast < 38) {
        bestSector = this._lastWalkSector;
      }
    }
    this._lastWalkSector = bestSector;

    // 섹터 → 애니메이션 키 + flipX 매핑
    const prefix = this._walkAnimPrefix;
    let animKey;
    let flip = false;

    switch (bestSector) {
      case 0: animKey = `${prefix}_right`; break;                         // E (0°)
      case 1: animKey = `${prefix}_down_right`; break;                    // SE (45°)
      case 2: animKey = `${prefix}_down`; break;                          // S (90°)
      case 3: animKey = `${prefix}_down_right`; flip = true; break;       // SW (135°) flipX
      case 4: animKey = `${prefix}_right`; flip = true; break;            // W (180°) flipX
      case 5: animKey = `${prefix}_up_right`; flip = true; break;         // NW (225°) flipX
      case 6: animKey = `${prefix}_up`; break;                            // N (270°)
      default: animKey = `${prefix}_up_right`; break;                     // NE (315°)
    }

    this.setFlipX(flip);

    // 동일 애니메이션이 이미 재생 중이면 재시작하지 않음 (방향 유지 중 끊김 방지)
    if (this.anims.currentAnim && this.anims.currentAnim.key === animKey && this.anims.isPlaying) {
      return;
    }

    // 해당 캐릭터의 walk 텍스처가 로드된 경우에만 애니메이션 재생
    if (this.scene.textures.exists(this._walkTextureKey)) {
      this.play(animKey);
    }
  }

  /**
   * 이동 정지 시 idle 상태로 복귀한다.
   * 걷기 애니메이션을 중단하고 정적 player 텍스처로 전환하며, idle tween을 재개한다.
   * @private
   */
  _setIdleState() {
    if (!this._isMoving) return; // 이미 idle 상태면 중복 처리 방지

    this._isMoving = false;

    // 걷기 애니메이션 중단 후 idle 정적 텍스처로 복귀
    this.anims.stop();
    this.setTexture(this._idleTextureKey);
    this.setFlipX(false);
    this.setScale(SPRITE_SCALE);

    // idle tween 재개
    if (this._idleTween) this._idleTween.resume();
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
