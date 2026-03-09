/**
 * @fileoverview XP 경험치 보석 엔티티.
 *
 * 적 처치 시 드랍되며 플레이어가 일정 반경 안에 들어오면 자석처럼 흡수된다.
 * 소/중/대 세 가지 크기가 있으며, 일정 시간이 지나면 깜빡이다가 소멸한다.
 * 오브젝트 풀에서 관리된다.
 */

import {
  XP_GEM_VALUES,
  XP_GEM_LIFETIME,
  XP_GEM_BLINK_DURATION,
  XP_MAGNET_RADIUS,
  SPRITE_SCALE,
} from '../config.js';

/** 자석 흡수 시 가속 속도 (px/s) */
const MAGNET_SPEED = 350;

// ── XPGem 클래스 ──

export default class XPGem extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'xp_gem_s');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    /** 보석이 주는 XP 양 */
    this.xpValue = 1;

    /** 바닥 유지 시간 (ms) */
    this.lifetime = XP_GEM_LIFETIME * 1000;

    /** 깜빡임 시작 시점 (ms) */
    this.blinkStart = XP_GEM_LIFETIME * 1000;

    /** 깜빡임 지속 시간 (ms) */
    this.blinkDuration = XP_GEM_BLINK_DURATION * 1000;

    /** 생존 시간 누적 (ms) */
    this.aliveTime = 0;

    /** 자석 흡수 중 여부 */
    this.beingMagnetized = false;

    /** 보석 타입 */
    this.gemType = 'small';

    // 스프라이트 스케일 적용
    this.setScale(SPRITE_SCALE);

    // 충돌체: 원형 — 중심 정렬: offset = frameW/2 - radius/scale
    const gemBodyOff0 = Math.max(0, 6 / 2 - 3 / SPRITE_SCALE);
    this.body.setCircle(3, gemBodyOff0, gemBodyOff0);

    // 초기 비활성 상태
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
  }

  // ── 공개 메서드 ──

  /**
   * 보석을 지정 위치에 스폰한다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} [type='small'] - 보석 타입 ('small'|'medium'|'large')
   */
  spawn(x, y, type = 'small') {
    this.gemType = type;
    this.xpValue = XP_GEM_VALUES[type] || 1;
    this.aliveTime = 0;
    this.beingMagnetized = false;
    this.setAlpha(1);

    // 약간의 랜덤 분산 (+-10px)
    const offsetX = Phaser.Math.Between(-10, 10);
    const offsetY = Phaser.Math.Between(-10, 10);

    this.setPosition(x + offsetX, y + offsetY);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(0, 0);

    // 텍스처 키 직접 전환 + 충돌체 크기 타입별 조정
    const texMap = { small: 'xp_gem_s', medium: 'xp_gem_m', large: 'xp_gem_l' };
    this.setTexture(texMap[type] || 'xp_gem_s');
    this.setScale(SPRITE_SCALE);
    this.clearTint();
    const radii = { small: 3, medium: 5, large: 7 };
    const r = radii[type] || 3;
    // 중심 정렬: offset = frameW/2 - radius/scale
    const texSizes = { small: 6, medium: 10, large: 14 };
    const texW = texSizes[type] || 6;
    const gemBodyOff = Math.max(0, (texW / 2) - r / SPRITE_SCALE);
    this.body.setCircle(r, gemBodyOff, gemBodyOff);
  }

  /**
   * 매 프레임 호출. 깜빡임, 소멸, 자석 흡수를 처리한다.
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
  }

  /**
   * 플레이어가 보석을 수집했을 때 호출한다.
   */
  collect() {
    const player = this.scene.player;
    if (player && player.active) {
      player.addXP(this.xpValue);
    }

    this._deactivate();
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
   * 플레이어와 충분히 가까우면 수집 처리한다.
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

    // 플레이어에 충분히 가까우면 수집
    if (dist < 10) {
      this.collect();
      return;
    }

    // 플레이어 방향으로 가속 이동
    const nx = dx / dist;
    const ny = dy / dist;
    this.body.setVelocity(nx * MAGNET_SPEED, ny * MAGNET_SPEED);
  }

  /**
   * 보석을 비활성화하여 풀로 반환 준비한다.
   * @private
   */
  _deactivate() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }
  }
}
