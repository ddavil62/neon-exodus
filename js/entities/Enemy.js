/**
 * @fileoverview 적 기본 클래스.
 *
 * 모든 적(잡몹, 미니보스, 보스)의 공통 로직을 담당한다.
 * ENEMY_DATA에서 typeId로 스탯을 조회하여 초기화하며,
 * EnemyTypes의 행동 함수를 매 프레임 호출한다.
 * 오브젝트 풀에서 관리된다.
 */

import { COLORS, CREDIT_DROP_CHANCE, CREDIT_DROP_AMOUNT, SPRITE_SCALE } from '../config.js';
import { ENEMIES, MINI_BOSSES, BOSSES } from '../data/enemies.js';
import { ENEMY_BEHAVIORS } from './EnemyTypes.js';
import { CONSUMABLES } from '../data/consumables.js';

// ── 데이터 조회용 인덱스 (배열 → ID 맵 변환) ──

/** @type {Object.<string, Object>} 잡몹 ID → 데이터 맵 */
const ENEMY_MAP = {};
ENEMIES.forEach((e) => { ENEMY_MAP[e.id] = e; });

/** @type {Object.<string, Object>} 미니보스 ID → 데이터 맵 */
const MINI_BOSS_MAP = {};
MINI_BOSSES.forEach((e) => { MINI_BOSS_MAP[e.id] = e; });

/** @type {Object.<string, Object>} 보스 ID → 데이터 맵 */
const BOSS_MAP = {};
BOSSES.forEach((e) => { BOSS_MAP[e.id] = e; });

// ── 적 크기 매핑 (임시 도형 렌더링용) ──

const ENEMY_RADIUS = {
  default: 10,
  miniBoss: 18,
  boss: 26,
};

// ── Enemy 클래스 ──

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy_nano_drone');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // ── 기본 스탯 ──

    /** @type {string} 적 타입 ID */
    this.typeId = '';

    /** @type {number} 최대 HP */
    this.maxHp = 10;

    /** @type {number} 현재 HP */
    this.currentHp = 10;

    /** @type {number} 이동 속도 (px/s) */
    this.speed = 80;

    /** @type {number} 접촉 데미지 */
    this.contactDamage = 5;

    /** @type {number} 드랍 XP */
    this.xpDrop = 1;

    /**
     * 특수 행동 플래그.
     * - knockbackResist: 넉백 저항 (true이면 넉백 안 받음)
     * @type {Object}
     */
    this.traits = {};

    /** 미니보스 여부 */
    this.isMiniBoss = false;

    /** 보스 여부 */
    this.isBoss = false;

    // 충돌체: 원형 (반경 10px 기본, init에서 조정)
    this.body.setCircle(10, 2, 2);
    this.body.setCollideWorldBounds(true);

    // 초기 비활성
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
  }

  // ── 공개 메서드 ──

  /**
   * 적을 특정 타입으로 초기화한다.
   * ENEMY_DATA / MINI_BOSS_DATA / BOSS_DATA에서 데이터를 조회한다.
   * @param {string} typeId - 적 타입 ID
   * @param {number} [hpMultiplier=1] - HP 배수 (시간 경과 스케일링)
   * @param {number} [dmgMultiplier=1] - 데미지 배수
   */
  init(typeId, hpMultiplier = 1, dmgMultiplier = 1) {
    this.typeId = typeId;

    // 데이터 소스 선택
    let data = null;
    this.isMiniBoss = false;
    this.isBoss = false;

    if (ENEMY_MAP[typeId]) {
      data = ENEMY_MAP[typeId];
    } else if (MINI_BOSS_MAP[typeId]) {
      data = MINI_BOSS_MAP[typeId];
      this.isMiniBoss = true;
    } else if (BOSS_MAP[typeId]) {
      data = BOSS_MAP[typeId];
      this.isBoss = true;
    }

    if (!data) {
      console.warn(`[Enemy] 알 수 없는 적 타입: ${typeId}`);
      data = { hp: 10, speed: 80, contactDamage: 5, xp: 1 };
    }

    // 스탯 설정 (multiplier 적용)
    this.maxHp = Math.floor(data.hp * hpMultiplier);
    this.currentHp = this.maxHp;
    this.speed = data.speed || 80;
    this.contactDamage = Math.floor((data.contactDamage || 5) * dmgMultiplier);
    this.xpDrop = data.xp || 1;

    // traits: 배열 형태를 객체 플래그로 변환
    this.traits = {};
    if (Array.isArray(data.traits)) {
      data.traits.forEach((t) => { this.traits[t] = true; });
    }
    // 넉백 저항 플래그 변환 (knockback_resist → knockbackResist)
    if (this.traits['knockback_resist']) {
      this.traits.knockbackResist = true;
    }

    // 크기/색상 설정
    let radius = ENEMY_RADIUS.default;
    let tintColor = COLORS.HP_RED;

    if (this.isMiniBoss) {
      radius = ENEMY_RADIUS.miniBoss;
      tintColor = COLORS.NEON_ORANGE;
    } else if (this.isBoss) {
      radius = ENEMY_RADIUS.boss;
      tintColor = COLORS.NEON_MAGENTA;
    }

    // 정식 텍스처가 로드된 경우 사용, 없으면 placeholder로 폴백
    const texKey = 'enemy_' + typeId;
    if (this.scene.textures.exists(texKey)) {
      this.setTexture(texKey);
      this.setScale(SPRITE_SCALE);
      this.clearTint();

      // 가독성을 위한 외곽 글로우 (풀 재사용 시 기존 FX 제거 후 재적용)
      if (this.preFX) {
        this.preFX.clear();
        const glowStrength = this.isBoss ? 6 : (this.isMiniBoss ? 4 : 2);
        this.preFX.addGlow(0xFFFFFF, glowStrength, 0, false, 0.1, 12);
      }

      // 풀 재사용 시 기존 tween 정리 후 새 맥동 tween 추가
      this.scene.tweens.killTweensOf(this);
      const tweenDuration = this.isBoss ? 600 : (this.isMiniBoss ? 700 : 900);
      this.scene.tweens.add({
        targets: this,
        scaleX: { from: SPRITE_SCALE * 1.0, to: SPRITE_SCALE * 1.05 },
        scaleY: { from: SPRITE_SCALE * 1.0, to: SPRITE_SCALE * 0.95 },
        duration: tweenDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // 폴백: 플레이스홀더 텍스처도 SPRITE_SCALE 적용
      this.setScale(SPRITE_SCALE * radius / 12);
      this.setTint(tintColor);
    }

    // 충돌체 크기 재설정
    // SPRITE_SCALE=1이면 offset = frameW/2 - bodyRadius (scale 나눗셈 없음)
    const bodyRadius = radius;
    const texFrame = this.texture.get(this.frame?.name || '__BASE');
    const frameW = texFrame ? texFrame.width : 32;
    const bodyOffset = Math.max(0, (frameW / 2) - bodyRadius);
    this.body.setCircle(bodyRadius, bodyOffset, bodyOffset);

    // 활성화
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.setAlpha(1);

    // 행동 상태 초기화 (EnemyTypes에서 사용하는 내부 타이머 리셋)
    this._resetBehaviorState();
  }

  /**
   * 매 프레임 호출. 기본 AI + 타입별 특수 행동을 실행한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.active) return;

    const behavior = ENEMY_BEHAVIORS[this.typeId];

    // 타입별 특수 update가 있으면 호출
    if (behavior && behavior.update) {
      behavior.update(this, this.scene, delta);

      // 돌격봇, 커맨더 등은 자체적으로 velocity를 설정하므로
      // charging/stunned 상태에서는 기본 이동 건너뜀
      if (this._chargeState === 'charging' || this._chargeState === 'stunned') return;
      if (this._bossState === 'charging') return;
      if (this._suicideState === 'warning') return;
    }

    // 기본 AI: 플레이어 방향으로 이동
    this.moveToPlayer();
  }

  /**
   * 플레이어 방향으로 이동한다.
   */
  moveToPlayer() {
    const player = this.scene.player;
    if (!player || !player.active) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    this.body.setVelocity(
      (dx / dist) * this.speed,
      (dy / dist) * this.speed
    );
  }

  /**
   * 적에게 데미지를 준다.
   * @param {number} amount - 데미지 양
   * @param {boolean} [knockback=true] - 넉백 적용 여부
   * @param {Phaser.Physics.Arcade.Sprite} [projectile=null] - 데미지를 준 투사체 (실드 드론 판정용)
   * @param {string|null} [weaponId=null] - 데미지를 준 무기 ID (통계 추적용)
   */
  takeDamage(amount, knockback = true, projectile = null, weaponId = null) {
    if (!this.active) return;

    let finalDamage = amount;

    // 타입별 데미지 보정 (실드 드론 등)
    const behavior = ENEMY_BEHAVIORS[this.typeId];
    if (behavior && behavior.modifyDamage) {
      finalDamage = behavior.modifyDamage(this, finalDamage, projectile);
    }

    this.currentHp -= finalDamage;

    // 마지막으로 데미지를 준 무기 ID 저장 (킬 귀속용)
    if (weaponId) {
      this._lastHitWeaponId = weaponId;
    }

    // 피격 플래시 (흰색 틴트 100ms)
    this.setTint(0xFFFFFF);
    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        const texKey = 'enemy_' + this.typeId;
        if (this.scene.textures.exists(texKey)) {
          // 정식 스프라이트 사용 시: 틴트 제거로 원래 색상 복원
          this.clearTint();
        } else {
          // 플레이스홀더 사용 시: 기존 색상 복원
          if (this.isBoss) this.setTint(COLORS.NEON_MAGENTA);
          else if (this.isMiniBoss) this.setTint(COLORS.NEON_ORANGE);
          else this.setTint(COLORS.HP_RED);
        }
      }
    });

    // 넉백 처리
    if (knockback && !this.traits.knockbackResist) {
      const player = this.scene.player;
      if (player) {
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const knockbackForce = 100;
          this.body.setVelocity(
            (dx / dist) * knockbackForce,
            (dy / dist) * knockbackForce
          );
          // 200ms 후 속도 복원 (moveToPlayer가 다시 덮어쓸 것)
        }
      }
    }

    // 사망 판정
    if (this.currentHp <= 0) {
      this.die();
    }
  }

  /**
   * 적 사망 처리. XP 보석 드랍, 크레딧 드랍, 비활성화.
   */
  die() {
    if (!this.active) return;

    // 타입별 사망 처리
    const behavior = ENEMY_BEHAVIORS[this.typeId];
    if (behavior && behavior.onDeath) {
      behavior.onDeath(this, this.scene);
    }

    // XP 보석 드랍
    if (this.scene.spawnXPGem) {
      this._dropXPGems();
    }

    // 크레딧 드랍 (확률)
    if (Math.random() < CREDIT_DROP_CHANCE && this.scene.addCredits) {
      this.scene.addCredits(CREDIT_DROP_AMOUNT);
    }

    // 소모성 아이템 드랍 (확률)
    this._dropConsumable();

    // 킬 카운트 증가
    if (this.scene.player) {
      this.scene.player.kills++;
    }
    if (this.scene.onEnemyKilled) {
      this.scene.onEnemyKilled(this, this._lastHitWeaponId || null);
    }

    // 비활성화 (풀로 반환)
    this._deactivate();
  }

  /**
   * 플레이어와 접촉했을 때 호출한다.
   */
  onContactWithPlayer() {
    const player = this.scene.player;
    if (player && player.active) {
      player.takeDamage(this.contactDamage);
    }
  }

  // ── 내부 메서드 ──

  /**
   * XP 보석을 드랍한다. 보스/미니보스는 추가 보석.
   * @private
   */
  _dropXPGems() {
    if (this.isBoss) {
      // 보스: 대형 보석 + 추가 보석
      this.scene.spawnXPGem(this.x, this.y, 'large');
      for (let i = 0; i < 5; i++) {
        this.scene.spawnXPGem(this.x, this.y, 'medium');
      }
    } else if (this.isMiniBoss) {
      // 미니보스: 중형 보석 여러 개
      const count = this.typeId === 'assault_mech' ? 8 : 5;
      for (let i = 0; i < count; i++) {
        this.scene.spawnXPGem(this.x, this.y, 'medium');
      }
    } else {
      // 잡몹: XP값에 따라 소/중/대
      if (this.xpDrop >= 10) {
        this.scene.spawnXPGem(this.x, this.y, 'large');
      } else if (this.xpDrop >= 3) {
        this.scene.spawnXPGem(this.x, this.y, 'medium');
      } else {
        this.scene.spawnXPGem(this.x, this.y, 'small');
      }
    }
  }

  /**
   * 소모성 아이템 드랍을 시도한다.
   * 적 등급(잡몹/미니보스/보스)에 따라 각 아이템별 드롭 확률을 판정하고,
   * 성공 시 scene.spawnConsumable()을 호출한다.
   * @private
   */
  _dropConsumable() {
    if (!this.scene || !this.scene.spawnConsumable) return;

    // 플레이어 HP 비율 확인 (저체력 시 나노 수리킷 확률 상승)
    const player = this.scene.player;
    const isLowHp = player && player.active && (player.currentHp / player.maxHp) <= 0.5;

    const pool = this.scene.consumablePool;

    for (const item of CONSUMABLES) {
      // 아이템별 동시 존재 상한 체크
      if (pool && item.maxOnField != null) {
        let count = 0;
        pool.forEach((c) => { if (c.itemId === item.id) count++; });
        if (count >= item.maxOnField) continue;
      }

      let chance = 0;

      if (this.isBoss) {
        chance = item.dropChance.boss;
      } else if (this.isMiniBoss) {
        chance = item.dropChance.miniboss;
      } else {
        // 잡몹: 저체력 시 나노 수리킷만 확률 상승
        if (isLowHp && item.id === 'nano_repair') {
          chance = item.dropChance.normalLowHp;
        } else {
          chance = item.dropChance.normal;
        }
      }

      if (chance > 0 && Math.random() < chance) {
        this.scene.spawnConsumable(this.x, this.y, item.id);
        // 한 번에 하나의 아이템만 드랍 (보스/미니보스도 동일)
        return;
      }
    }
  }

  /**
   * 행동 상태 변수를 초기화한다 (오브젝트 풀 재사용 시).
   * @private
   */
  _resetBehaviorState() {
    this._chargeTimer = 0;
    this._chargeState = null;
    this._stateTimer = 0;
    this._chargeDir = null;
    this._teleportTimer = 0;
    this._suicideState = null;
    this._warnTimer = 0;
    this._laserAngle = 0;
    this._laserDmgTimer = 0;
    this._laserGfx = null;
    this._missileTimer = 0;
    this._summonTimer = 0;
    this._bombTimer = 0;
    this._empTimer = 0;
    this._bossState = null;
    this._lastHitWeaponId = null;
  }

  /**
   * 적을 비활성화하여 풀로 반환 준비한다.
   * @private
   */
  _deactivate() {
    // tween 정리 (풀 재사용 시 비활성 적에 tween이 남지 않도록)
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }

    // 레이저 그래픽 정리
    if (this._laserGfx) {
      this._laserGfx.destroy();
      this._laserGfx = null;
    }

    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }
  }
}
