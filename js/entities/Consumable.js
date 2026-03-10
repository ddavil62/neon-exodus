/**
 * @fileoverview 소모성 아이템 엔티티.
 *
 * 적 처치 시 드롭되며, 플레이어가 자석 반경에 들어오면 끌려와 자동 수집된다.
 * XPGem과 동일한 자석 흡수 메커니즘을 사용한다.
 * 10초 수명, 마지막 3초 깜빡임 후 소멸. 오브젝트 풀에서 관리된다.
 */

import {
  CONSUMABLE_LIFETIME,
  CONSUMABLE_BLINK_DURATION,
  XP_MAGNET_RADIUS,
  SPRITE_SCALE,
} from '../config.js';
import { CONSUMABLE_MAP } from '../data/consumables.js';

/** 자석 흡수 시 이동 속도 (px/s) — XPGem과 동일 */
const MAGNET_SPEED = 350;

// ── Consumable 클래스 ──

export default class Consumable extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'consumable_nano_repair');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    /** @type {string} 아이템 ID (수집 시 효과 처리용) */
    this.itemId = '';

    /** @type {number} 스폰 후 경과 시간 (ms) */
    this.aliveTime = 0;

    /** @type {number} 수명 (ms) */
    this.lifetime = CONSUMABLE_LIFETIME * 1000;

    /** @type {number} 깜빡임 시작 시점 (ms) */
    this.blinkStart = (CONSUMABLE_LIFETIME - CONSUMABLE_BLINK_DURATION) * 1000;

    /** @type {Phaser.Tweens.Tween|null} 깜빡임 tween 참조 */
    this._blinkTween = null;

    /** @type {boolean} 자석 흡수 중 여부 */
    this.beingMagnetized = false;

    // 스프라이트 스케일 적용
    this.setScale(SPRITE_SCALE);

    // 충돌체: 원형 (24x24 텍스처 기준, 반경 8, offset = 12 - 8 = 4)
    this.body.setCircle(8, 4, 4);

    // 렌더링 깊이 (XP 보석 위, 플레이어 아래)
    this.setDepth(5);

    // 초기 비활성 상태
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
  }

  // ── 공개 메서드 ──

  /**
   * 아이템을 지정 위치에 스폰한다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} itemId - 아이템 타입 ID
   */
  spawn(x, y, itemId) {
    this.itemId = itemId;
    this.aliveTime = 0;
    this.beingMagnetized = false;
    this._blinkTween = null;

    // 약간의 랜덤 분산 (+-10px)
    const offsetX = Phaser.Math.Between(-10, 10);
    const offsetY = Phaser.Math.Between(-10, 10);

    this.setPosition(x + offsetX, y + offsetY);

    // 타입별 텍스처 전환
    const data = CONSUMABLE_MAP[itemId];
    if (data) {
      this.setTexture(data.textureKey);
    }

    this.setScale(SPRITE_SCALE);
    this.setAlpha(1);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);
  }

  /**
   * 매 프레임 호출. 수명 관리 및 깜빡임을 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.active) return;

    this.aliveTime += delta;

    // 자석 흡수 중이면 소멸 타이머 동작하지 않음
    if (this.beingMagnetized) {
      this._moveToPlayer(delta);
      return;
    }

    // 플레이어와의 거리 체크 (자석 반경)
    this._checkMagnet();

    // 수명 종료 시 비활성화
    if (this.aliveTime >= this.lifetime) {
      this._deactivate();
      return;
    }

    // 깜빡임 시작 (마지막 3초)
    if (this.aliveTime >= this.blinkStart && this._blinkTween === null) {
      this._blinkTween = this.scene.tweens.add({
        targets: this,
        alpha: { from: 1, to: 0.3 },
        duration: 150,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /**
   * 플레이어가 아이템을 수집했을 때 호출한다.
   * @returns {string} 수집된 아이템 ID
   */
  collect() {
    const id = this.itemId;
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

    // 자석 반경 계산 (플레이어의 magnetMultiplier 반영)
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
   * 플레이어와 충분히 가까우면 수집 처리(overlap 콜백)에 맡긴다.
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

    // 플레이어에 충분히 가까우면 velocity로 overlap이 자동 발동됨
    if (dist < 5) {
      this.setPosition(player.x, player.y);
      return;
    }

    // 플레이어 방향으로 이동
    const nx = dx / dist;
    const ny = dy / dist;
    this.body.setVelocity(nx * MAGNET_SPEED, ny * MAGNET_SPEED);
  }

  /**
   * 아이템을 비활성화하여 풀로 반환 준비한다.
   * @private
   */
  _deactivate() {
    // 깜빡임 tween 정리
    if (this._blinkTween) {
      this._blinkTween.stop();
      this._blinkTween = null;
    }

    this.setAlpha(1);
    this.setActive(false);
    this.setVisible(false);

    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }
  }
}
