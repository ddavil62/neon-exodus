/**
 * @fileoverview Phaser Particles 기반 VFX 시스템.
 *
 * BootScene에서 생성한 4x4 흰색 particle 텍스처를 활용하여
 * 6종의 시각 효과를 1회 버스트(explode) 방식으로 표시한다.
 * 추가 에셋 로드 없이 동작한다.
 */

// ── VFXSystem 클래스 ──

export default class VFXSystem {
  /**
   * 적 피격 스파크. 시안, 8입자, 200ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   */
  static hitSpark(scene, x, y) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 40, max: 100 },
      scale: { start: 1.0, end: 0 },
      lifespan: 200,
      tint: 0x00FFFF,
      quantity: 8,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(8);
    scene.time.delayedCall(300, () => emitter.destroy());
  }

  /**
   * 플레이어 피격 효과. 빨강, 12입자, 300ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   */
  static playerHit(scene, x, y) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 120 },
      scale: { start: 1.2, end: 0 },
      lifespan: 300,
      tint: 0xFF3333,
      quantity: 12,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(12);
    scene.time.delayedCall(400, () => emitter.destroy());
  }

  /**
   * 적 사망 폭발. 화이트+오렌지, 20입자, 400ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   */
  static enemyDie(scene, x, y) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 150 },
      scale: { start: 1.5, end: 0 },
      lifespan: 400,
      tint: [0xFFFFFF, 0xFF6600],
      quantity: 20,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(20);
    scene.time.delayedCall(500, () => emitter.destroy());
  }

  /**
   * 레벨업 반지름 버스트. 골드, 40입자, 600ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - 플레이어 X 좌표
   * @param {number} y - 플레이어 Y 좌표
   */
  static levelUpBurst(scene, x, y) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 80, max: 200 },
      scale: { start: 1.8, end: 0 },
      lifespan: 600,
      tint: 0xFFDD00,
      quantity: 40,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(40);
    scene.time.delayedCall(700, () => emitter.destroy());
  }

  /**
   * EMP 파동. 일렉트릭 블루, 60입자, 500ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {number} radius - 폭발 반경
   */
  static empBurst(scene, x, y, radius) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: radius * 0.5, max: radius * 1.2 },
      scale: { start: 2.0, end: 0 },
      lifespan: 500,
      tint: 0x4488FF,
      quantity: 60,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(60);
    scene.time.delayedCall(600, () => emitter.destroy());
  }

  /**
   * XP 수집 반짝. 그린, 6입자, 150ms.
   * @param {Phaser.Scene} scene - 씬 참조
   * @param {number} x - 보석 X 좌표
   * @param {number} y - 보석 Y 좌표
   */
  static xpCollect(scene, x, y) {
    const emitter = scene.add.particles(x, y, 'particle', {
      speed: { min: 20, max: 60 },
      scale: { start: 0.8, end: 0 },
      lifespan: 150,
      tint: 0x39FF14,
      quantity: 6,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(6);
    scene.time.delayedCall(250, () => emitter.destroy());
  }
}
