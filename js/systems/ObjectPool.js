/**
 * @fileoverview 오브젝트 풀 시스템 -- 투사체, 적, XP보석 재활용으로 GC 최소화.
 *
 * Phaser.GameObjects.Group 기반으로 active/visible 플래그를 사용하여
 * 풀 내 오브젝트를 관리한다. 풀이 소진되면 자동으로 새 인스턴스를 생성한다.
 */

// ── ObjectPool 클래스 ──

export default class ObjectPool {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {Function} classRef - 풀에서 관리할 클래스 생성자
   * @param {number} [initialSize=20] - 초기 풀 크기
   */
  constructor(scene, classRef, initialSize = 20) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Function} */
    this.classRef = classRef;

    /**
     * Phaser Group으로 풀 오브젝트를 관리한다.
     * runChildUpdate=false: 풀이 자체적으로 update를 호출하지 않는다.
     * @type {Phaser.GameObjects.Group}
     */
    this.group = scene.add.group({
      runChildUpdate: false,
    });

    // 초기 풀 확보
    this._populate(initialSize);
  }

  // ── 내부 메서드 ──

  /**
   * 풀에 비활성 오브젝트를 미리 채운다.
   * @param {number} count - 생성할 오브젝트 수
   * @private
   */
  _populate(count) {
    for (let i = 0; i < count; i++) {
      const obj = new this.classRef(this.scene, 0, 0);
      obj.setActive(false);
      obj.setVisible(false);
      this.group.add(obj);
    }
  }

  // ── 공개 메서드 ──

  /**
   * 풀에서 비활성 오브젝트를 꺼내 활성화한다.
   * 비활성 오브젝트가 없으면 새 인스턴스를 생성한다.
   * @param {number} x - 활성화할 X 좌표
   * @param {number} y - 활성화할 Y 좌표
   * @param {...*} args - 오브젝트 init/spawn 메서드에 전달할 추가 인자
   * @returns {Phaser.GameObjects.GameObject} 활성화된 오브젝트
   */
  get(x, y, ...args) {
    let obj = this.group.getFirstDead(false);

    if (!obj) {
      // 풀 소진 -- 새 인스턴스 자동 확장
      obj = new this.classRef(this.scene, 0, 0);
      this.group.add(obj);
    }

    obj.setActive(true);
    obj.setVisible(true);
    obj.setPosition(x, y);

    // body가 있으면 물리 바디도 활성화
    if (obj.body) {
      obj.body.enable = true;
    }

    return obj;
  }

  /**
   * 오브젝트를 비활성화하여 풀로 반환한다.
   * @param {Phaser.GameObjects.GameObject} obj - 반환할 오브젝트
   */
  release(obj) {
    obj.setActive(false);
    obj.setVisible(false);

    // 물리 바디 비활성화
    if (obj.body) {
      obj.body.enable = false;
      obj.body.setVelocity(0, 0);
    }
  }

  /**
   * 풀 내 모든 활성 오브젝트를 비활성화한다.
   */
  releaseAll() {
    this.group.getChildren().forEach((obj) => {
      if (obj.active) {
        this.release(obj);
      }
    });
  }

  /**
   * 현재 활성 상태인 오브젝트 수를 반환한다.
   * @returns {number}
   */
  getActiveCount() {
    return this.group.countActive(true);
  }

  /**
   * 활성 오브젝트만 대상으로 콜백을 순회한다.
   * @param {function(Phaser.GameObjects.GameObject): void} callback - 각 활성 오브젝트에 호출할 함수
   */
  forEach(callback) {
    this.group.getChildren().forEach((obj) => {
      if (obj.active) {
        callback(obj);
      }
    });
  }

  /**
   * 활성 오브젝트 배열을 반환한다.
   * @returns {Phaser.GameObjects.GameObject[]}
   */
  getActive() {
    return this.group.getChildren().filter((obj) => obj.active);
  }

  /**
   * 풀과 모든 오브젝트를 정리한다.
   */
  destroy() {
    this.group.destroy(true);
  }
}
