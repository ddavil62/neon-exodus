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

    // 조이스틱 베이스: PNG 텍스처 존재 시 Image, 없으면 Graphics 폴백
    if (scene.textures.exists('joystick_base')) {
      /** @type {Phaser.GameObjects.Image} 조이스틱 바탕 이미지 */
      this.base = scene.add.image(0, 0, 'joystick_base')
        .setDisplaySize(JOYSTICK_MAX_RADIUS * 2, JOYSTICK_MAX_RADIUS * 2)
        .setAlpha(0.7);
    } else {
      /** @type {Phaser.GameObjects.Graphics} 조이스틱 바탕 (폴백) */
      this.base = scene.add.graphics();
      this.base.fillStyle(0xFFFFFF, 0.15);
      this.base.fillCircle(0, 0, JOYSTICK_MAX_RADIUS);
    }
    this.base.setDepth(1000).setScrollFactor(0).setVisible(false);

    // 조이스틱 엄지: PNG 텍스처 존재 시 Image, 없으면 Graphics 폴백
    if (scene.textures.exists('joystick_thumb')) {
      /** @type {Phaser.GameObjects.Image} 조이스틱 엄지 이미지 */
      this.thumb = scene.add.image(0, 0, 'joystick_thumb')
        .setDisplaySize(40, 40)
        .setAlpha(0.85);
    } else {
      /** @type {Phaser.GameObjects.Graphics} 조이스틱 엄지 (폴백) */
      this.thumb = scene.add.graphics();
      this.thumb.fillStyle(COLORS.NEON_CYAN, 0.7);
      this.thumb.fillCircle(0, 0, 20);
    }
    this.thumb.setDepth(1000).setScrollFactor(0).setVisible(false);

    /** 터치 시작 좌표 */
    this._startX = 0;
    this._startY = 0;

    /** 현재 추적 중인 포인터 ID */
    this._pointerId = null;

    // ── 키보드 입력 상태 ──

    /** @type {{ up: boolean, down: boolean, left: boolean, right: boolean }} WASD/방향키 상태 */
    this._keys = { up: false, down: false, left: false, right: false };

    /** @type {boolean} 키보드로 이동 중인지 여부 */
    this._keyboardActive = false;

    /** @type {number} 입력 잠금 해제 시각 (ms). 이 시각 이전에는 포인터 입력을 무시한다. */
    this._lockUntil = 0;

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

    // ── WASD / 방향키 바인딩 ──
    if (input.keyboard) {
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      input.keyboard.on('keydown', this._onKeyDown);
      input.keyboard.on('keyup', this._onKeyUp);
    }
  }

  /**
   * 터치 시작: 조이스틱 원점을 터치 위치에 표시한다.
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _onPointerDown(pointer) {
    // 입력 잠금 중이면 무시 (씬 전환 직후 pointerdown 전파 방지)
    if (Date.now() < this._lockUntil) return;
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

    // 터치 해제 시 키보드 입력이 남아있으면 키보드 방향 복원
    this._updateKeyboardDirection();
  }

  /**
   * 조이스틱 상태를 초기화하고 일정 시간 포인터 입력을 잠근다.
   * 씬 전환 직후 pointerdown 이벤트가 조이스틱에 전파되는 것을 방지한다.
   * @param {number} lockMs - 잠금 시간 (밀리초)
   */
  resetAndLock(lockMs = 300) {
    this._pointerId = null;
    this.isActive = false;
    this.direction.x = 0;
    this.direction.y = 0;
    this.force = 0;
    this._keyboardActive = false;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
    this._lockUntil = Date.now() + lockMs;
  }

  // ── 키보드 입력 처리 ──

  /** @type {Object<string, string>} 키코드 → 방향 매핑 */
  static KEY_MAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  /**
   * 키 누름 처리. WASD/방향키를 방향 상태에 반영한다.
   * @param {KeyboardEvent} event
   * @private
   */
  _onKeyDown(event) {
    const dir = VirtualJoystick.KEY_MAP[event.code];
    if (!dir) return;
    this._keys[dir] = true;
    this._updateKeyboardDirection();
  }

  /**
   * 키 뗌 처리.
   * @param {KeyboardEvent} event
   * @private
   */
  _onKeyUp(event) {
    const dir = VirtualJoystick.KEY_MAP[event.code];
    if (!dir) return;
    this._keys[dir] = false;
    this._updateKeyboardDirection();
  }

  /**
   * 키보드 상태로부터 direction 벡터를 갱신한다.
   * 터치 조이스틱이 활성 상태이면 키보드를 무시한다.
   * @private
   */
  _updateKeyboardDirection() {
    // 터치 조이스틱이 활성 상태이면 터치 우선
    if (this._pointerId !== null) return;

    let dx = 0;
    let dy = 0;
    if (this._keys.left) dx -= 1;
    if (this._keys.right) dx += 1;
    if (this._keys.up) dy -= 1;
    if (this._keys.down) dy += 1;

    if (dx === 0 && dy === 0) {
      this.direction.x = 0;
      this.direction.y = 0;
      this.force = 0;
      this.isActive = false;
      this._keyboardActive = false;
    } else {
      // 대각선 이동 시 정규화
      const len = Math.sqrt(dx * dx + dy * dy);
      this.direction.x = dx / len;
      this.direction.y = dy / len;
      this.force = 1;
      this.isActive = true;
      this._keyboardActive = true;
    }
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

    if (input.keyboard) {
      input.keyboard.off('keydown', this._onKeyDown);
      input.keyboard.off('keyup', this._onKeyUp);
    }

    this.base.destroy();
    this.thumb.destroy();
  }
}
