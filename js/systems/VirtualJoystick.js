/**
 * @fileoverview 터치 기반 가상 조이스틱 시스템.
 *
 * 화면 아무 곳 터치 시 시작 지점에 조이스틱 원점을 생성하고,
 * 드래그 방향/거리로 이동 방향과 속도를 결정한다.
 * 터치 종료 시 조이스틱이 사라지고 캐릭터가 정지한다.
 */

import { JOYSTICK_DEAD_ZONE, JOYSTICK_MAX_RADIUS, COLORS } from '../config.js';

// ── VirtualJoystick 클래스 ──

export default class VirtualJoystick {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /**
     * 정규화된 방향 벡터. { x: 0, y: 0 }은 정지 상태.
     * @type {{ x: number, y: number }}
     */
    this.direction = { x: 0, y: 0 };

    /** 조이스틱 활성 여부 */
    this.isActive = false;

    /**
     * 입력 세기 (0~1). 데드존 이하이면 0, 최대 반경 이상이면 1.
     * @type {number}
     */
    this.force = 0;

    // ── 시각 요소 생성 ──

    /** 조이스틱 바탕 원 (반투명 흰색) */
    this.base = scene.add.graphics();
    this.base.fillStyle(0xFFFFFF, 0.15);
    this.base.fillCircle(0, 0, JOYSTICK_MAX_RADIUS);
    this.base.setDepth(1000);
    this.base.setScrollFactor(0);
    this.base.setVisible(false);

    /** 조이스틱 엄지 원 (네온 시안) */
    this.thumb = scene.add.graphics();
    this.thumb.fillStyle(COLORS.NEON_CYAN, 0.7);
    this.thumb.fillCircle(0, 0, 20);
    this.thumb.setDepth(1000);
    this.thumb.setScrollFactor(0);
    this.thumb.setVisible(false);

    /** 터치 시작 좌표 */
    this._startX = 0;
    this._startY = 0;

    /** 현재 추적 중인 포인터 ID */
    this._pointerId = null;

    // ── 입력 이벤트 바인딩 ──
    this._bindInput();
  }

  // ── 내부 메서드 ──

  /**
   * Phaser 입력 이벤트를 등록한다.
   * @private
   */
  _bindInput() {
    const { input } = this.scene;

    input.on('pointerdown', this._onPointerDown, this);
    input.on('pointermove', this._onPointerMove, this);
    input.on('pointerup', this._onPointerUp, this);
  }

  /**
   * 터치 시작: 조이스틱 원점을 터치 위치에 표시한다.
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _onPointerDown(pointer) {
    // 이미 다른 포인터가 조이스틱을 제어 중이면 무시
    if (this._pointerId !== null) return;

    this._pointerId = pointer.id;
    this._startX = pointer.x;
    this._startY = pointer.y;

    this.base.setPosition(pointer.x, pointer.y);
    this.thumb.setPosition(pointer.x, pointer.y);

    this.base.setVisible(true);
    this.thumb.setVisible(true);

    this.isActive = true;
  }

  /**
   * 터치 이동: 방향 벡터와 세기를 갱신한다.
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _onPointerMove(pointer) {
    if (pointer.id !== this._pointerId) return;
    if (!this.isActive) return;

    const dx = pointer.x - this._startX;
    const dy = pointer.y - this._startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < JOYSTICK_DEAD_ZONE) {
      // 데드존 이내 -- 이동 무시
      this.direction.x = 0;
      this.direction.y = 0;
      this.force = 0;
      this.thumb.setPosition(this._startX, this._startY);
      return;
    }

    // 방향 정규화
    this.direction.x = dx / distance;
    this.direction.y = dy / distance;

    // 세기 계산 (0~1)
    this.force = Math.min(distance / JOYSTICK_MAX_RADIUS, 1);

    // 엄지 위치 제한 (최대 반경 이내)
    const clampedDist = Math.min(distance, JOYSTICK_MAX_RADIUS);
    this.thumb.setPosition(
      this._startX + this.direction.x * clampedDist,
      this._startY + this.direction.y * clampedDist
    );
  }

  /**
   * 터치 종료: 조이스틱 숨기고 방향 리셋한다.
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _onPointerUp(pointer) {
    if (pointer.id !== this._pointerId) return;

    this._pointerId = null;
    this.isActive = false;
    this.direction.x = 0;
    this.direction.y = 0;
    this.force = 0;

    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  // ── 정리 ──

  /**
   * 조이스틱 리소스를 정리한다.
   */
  destroy() {
    const { input } = this.scene;
    input.off('pointerdown', this._onPointerDown, this);
    input.off('pointermove', this._onPointerMove, this);
    input.off('pointerup', this._onPointerUp, this);

    this.base.destroy();
    this.thumb.destroy();
  }
}
