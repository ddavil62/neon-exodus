/**
 * @fileoverview 무기 드롭 아이템 엔티티.
 *
 * 스테이지별 고유 무기를 필드에 드롭하며, 플레이어가 자석 반경에 들어오면
 * 끌려와 자동 수집된다. Consumable.js 패턴을 참고하여 구현.
 * permanent=false: 10초 후 소멸 (마지막 5초 깜빡임)
 * permanent=true: 소멸 없음 (런 종료까지 유지)
 */

import {
  XP_MAGNET_RADIUS,
  SPRITE_SCALE,
} from '../config.js';

/** 자석 흡수 시 이동 속도 (px/s) */
const MAGNET_SPEED = 350;

/** 비영구 드롭의 수명 (ms) */
const DROP_LIFETIME = 10000;

/** 소멸 전 깜빡임 구간 (ms) */
const BLINK_DURATION = 5000;

// ── WeaponDropItem 클래스 ──

export default class WeaponDropItem extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    // 기본 텍스처 (spawn에서 교체됨)
    super(scene, x, y, 'projectile');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    /** @type {string} 무기 ID */
    this.weaponId = '';

    /** @type {boolean} 자석 흡수 중 여부 */
    this.beingMagnetized = false;

    /** @type {boolean} 영구 드롭 여부 */
    this.permanent = false;

    /** @type {number} 남은 수명 (ms) */
    this.lifetime = DROP_LIFETIME;

    /** @type {Phaser.GameObjects.Text|null} 이모지 폴백 텍스트 */
    this._emojiText = null;

    this.setScale(SPRITE_SCALE);
    this.body.setCircle(16, 8, 8);
    this.setDepth(5);

    // 초기 비활성 상태
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
  }

  // ── 공개 메서드 ──

  /**
   * 무기 드롭 아이템을 지정 위치에 스폰한다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} weaponId - 무기 ID
   * @param {boolean} [permanent=false] - 영구 드롭 여부
   */
  spawn(x, y, weaponId, permanent = false) {
    this.weaponId = weaponId;
    this.beingMagnetized = false;
    this.permanent = permanent;
    this.lifetime = DROP_LIFETIME;

    // 랜덤 분산 (+-80px)
    const offsetX = Phaser.Math.Between(-80, 80);
    const offsetY = Phaser.Math.Between(-80, 80);

    this.setPosition(x + offsetX, y + offsetY);

    // 무기 아이콘 텍스처 전환
    const iconKey = `icon_weapon_${weaponId}`;
    if (this.scene.textures.exists(iconKey)) {
      this.setTexture(iconKey);
      this.setDisplaySize(32, 32);
      if (this._emojiText) {
        this._emojiText.destroy();
        this._emojiText = null;
      }
    } else {
      // 이모지 폴백: 스프라이트를 투명으로 하고 텍스트 오버레이
      this.setTexture('projectile');
      this.setAlpha(0);

      if (this._emojiText) {
        this._emojiText.destroy();
      }
      this._emojiText = this.scene.add.text(this.x, this.y, '\u2694\uFE0F', {
        fontSize: '24px',
      }).setOrigin(0.5).setDepth(6);
    }

    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);

    // 글로우 효과 (펄스 트윈)
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      yoyo: true,
      repeat: -1,
      duration: 600,
    });
  }

  /**
   * 매 프레임 호출. 자석 흡수 및 수명 관리를 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.active) return;

    // 이모지 텍스트 위치 동기화
    if (this._emojiText) {
      this._emojiText.setPosition(this.x, this.y);
    }

    // 자석 흡수 중이면 플레이어 방향으로 이동
    if (this.beingMagnetized) {
      this._moveToPlayer(delta);
      return;
    }

    // 자석 반경 체크
    this._checkMagnet();

    // 수명 관리 (영구 드롭은 건너뜀)
    if (!this.permanent) {
      this.lifetime -= delta;

      // 깜빡임 처리 (마지막 5초)
      if (this.lifetime <= BLINK_DURATION && this.lifetime > 0) {
        const blinkRate = 200;
        const visible = Math.floor(this.lifetime / blinkRate) % 2 === 0;
        this.setVisible(visible);
        if (this._emojiText) this._emojiText.setVisible(visible);
      }

      // 수명 만료
      if (this.lifetime <= 0) {
        this._deactivate();
      }
    }
  }

  /**
   * 플레이어가 아이템을 수집했을 때 호출한다.
   * @returns {string} 수집된 무기 ID
   */
  collect() {
    const id = this.weaponId;
    this._deactivate();
    return id;
  }

  // ── 내부 메서드 ──

  /**
   * 플레이어와의 거리를 체크하여 자석 반경 안이면 흡수를 시작한다.
   * @private
   */
  _checkMagnet() {
    const player = this.scene.player;
    if (!player || !player.active) return;

    const magnetRadius = XP_MAGNET_RADIUS * (player.magnetMultiplier || 1);
    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, player.x, player.y
    );

    if (dist < magnetRadius) {
      this.beingMagnetized = true;
    }
  }

  /**
   * 자석 흡수: 플레이어 방향으로 가속 이동한다.
   * @param {number} delta - 프레임 간격 (ms)
   * @private
   */
  _moveToPlayer(delta) {
    const player = this.scene.player;
    if (!player || !player.active) {
      this.beingMagnetized = false;
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.setPosition(player.x, player.y);
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    this.body.setVelocity(nx * MAGNET_SPEED, ny * MAGNET_SPEED);
  }

  /**
   * 아이템을 비활성화하여 풀로 반환 준비한다.
   * @private
   */
  _deactivate() {
    // 트윈 정리
    this.scene.tweens.killTweensOf(this);

    this.setActive(false);
    this.setVisible(false);

    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }

    // 이모지 텍스트 제거
    if (this._emojiText) {
      this._emojiText.destroy();
      this._emojiText = null;
    }
  }
}
