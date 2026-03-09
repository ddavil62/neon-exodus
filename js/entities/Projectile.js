/**
 * @fileoverview 투사체 엔티티.
 *
 * WeaponSystem이 발사한 투사체를 나타내며, 오브젝트 풀에서 관리된다.
 * 방향/속도를 받아 직선 이동하며, 적에게 적중하면 데미지를 주고
 * 관통 횟수에 따라 비활성화된다.
 */

import { WORLD_WIDTH, WORLD_HEIGHT, SPRITE_SCALE } from '../config.js';

// ── Projectile 클래스 ──

export default class Projectile extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {number} x - 초기 X 좌표
   * @param {number} y - 초기 Y 좌표
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'projectile');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    /** 투사체 데미지 */
    this.damage = 0;

    /** 치명타 여부 (WeaponSystem에서 발사 시점에 결정) */
    this.isCrit = false;

    /** 발사한 무기 ID (통계 추적용) */
    this.weaponId = null;

    /** 투사체 이동 속도 (px/s) */
    this.speed = 0;

    /** 최대 관통 횟수 */
    this.pierce = 1;

    /** 현재까지 관통한 횟수 */
    this.piercedCount = 0;

    /** 이동 방향 벡터 (정규화) */
    this.direction = { x: 0, y: 0 };

    /** 투사체 수명 (ms) */
    this.lifespan = 2000;

    /** 생존 시간 누적 (ms) */
    this.aliveTime = 0;

    // 스프라이트 스케일 적용
    this.setScale(SPRITE_SCALE);

    // 충돌체 설정: 원형 (반경 4px)
    // SPRITE_SCALE=1이면 offset = frameW/2 - radius (scale 나눗셈 없음)
    const projBodyOff = Math.max(0, 12 / 2 - 4); // =2
    this.body.setCircle(4, projBodyOff, projBodyOff);

    // 초기 비활성 상태
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
  }

  // ── 공개 메서드 ──

  /**
   * 투사체를 지정 위치에서 발사한다.
   * @param {number} x - 발사 X 좌표
   * @param {number} y - 발사 Y 좌표
   * @param {number} dirX - 방향 벡터 X (정규화)
   * @param {number} dirY - 방향 벡터 Y (정규화)
   * @param {number} damage - 데미지
   * @param {number} speed - 이동 속도 (px/s)
   * @param {number} [pierce=1] - 관통 횟수
   */
  fire(x, y, dirX, dirY, damage, speed, pierce = 1) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;

    this.damage = damage;
    this.speed = speed;
    this.pierce = pierce;
    this.piercedCount = 0;
    this.isCrit = false;
    this.weaponId = null;
    this.direction.x = dirX;
    this.direction.y = dirY;
    this.aliveTime = 0;

    // 속도 설정
    this.body.setVelocity(dirX * speed, dirY * speed);

    // 방향에 따른 회전 (라디안)
    this.setRotation(Math.atan2(dirY, dirX));
  }

  /**
   * 매 프레임 호출. 수명 초과나 월드 밖이면 비활성화한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.active) return;

    this.aliveTime += delta;

    // 수명 초과
    if (this.aliveTime > this.lifespan) {
      this._deactivate();
      return;
    }

    // 월드 바운드 밖 체크
    const margin = 50;
    if (
      this.x < -margin || this.x > WORLD_WIDTH + margin ||
      this.y < -margin || this.y > WORLD_HEIGHT + margin
    ) {
      this._deactivate();
    }
  }

  /**
   * 적에게 적중했을 때 호출한다.
   * 관통 횟수를 소모하고 소진 시 비활성화한다.
   * @param {Phaser.Physics.Arcade.Sprite} enemy - 적중한 적
   */
  onHitEnemy(enemy) {
    this.piercedCount++;
    if (this.piercedCount >= this.pierce) {
      this._deactivate();
    }
  }

  // ── 내부 메서드 ──

  /**
   * 투사체를 비활성화하여 풀로 반환 준비한다.
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
