/**
 * @fileoverview 상점 로테이션 및 구매 처리 매니저.
 * 시간 기반 로테이션으로 진열 칩을 갱신하고, 스크랩 소비를 통한 칩 구매를 처리한다.
 */

import {
  SHOP_ROTATION_INTERVAL,
  SHOP_SLOT_COUNT,
  SHOP_CHIP_PRICES,
  SHOP_GRADE_WEIGHTS,
  CHIP_MAX_INVENTORY,
} from '../config.js';
import { SaveManager } from './SaveManager.js';
import { CHIP_DEFINITIONS } from '../data/droneChips.js';

// ── ShopManager 클래스 ──

/**
 * 상점 로테이션 및 구매 로직을 담당하는 정적 클래스.
 * 1시간마다 6개 칩을 등급 확률에 따라 랜덤 진열한다.
 */
export class ShopManager {
  /**
   * 현재 진열 슬롯을 반환한다. 로테이션 시간이 경과했으면 자동 갱신 후 반환.
   * @returns {Array<{chipId: string, grade: string, price: number}>} 진열 슬롯 배열
   */
  static getSlots() {
    const rotation = SaveManager.getShopRotation();
    const now = Date.now();

    // 로테이션 시간 경과 또는 슬롯이 비어있으면 갱신
    if (
      rotation.slots.length === 0 ||
      now - rotation.lastRotationTime >= SHOP_ROTATION_INTERVAL
    ) {
      ShopManager._rotate();
    }

    return SaveManager.getShopRotation().slots;
  }

  /**
   * 칩을 구매한다. 잔액과 인벤토리 한도를 체크한다.
   * @param {number} slotIndex - 구매할 슬롯 인덱스 (0~SHOP_SLOT_COUNT-1)
   * @returns {{ success: boolean, reason?: string }} 구매 결과
   */
  static purchase(slotIndex) {
    const slots = ShopManager.getSlots();
    if (slotIndex < 0 || slotIndex >= slots.length) {
      return { success: false, reason: 'invalidSlot' };
    }

    const slot = slots[slotIndex];

    // 인벤토리 한도 체크
    const inv = SaveManager.getDroneChipInventory();
    if (inv.length >= CHIP_MAX_INVENTORY) {
      return { success: false, reason: 'inventoryFull' };
    }

    // 잔액 체크
    if (SaveManager.getScrap() < slot.price) {
      return { success: false, reason: 'insufficientScrap' };
    }

    // 스크랩 차감
    SaveManager.spendScrap(slot.price);

    // 칩 인벤토리에 추가
    SaveManager.addChip(slot.chipId, slot.grade);

    return { success: true };
  }

  /**
   * 다음 로테이션까지 남은 시간(ms)을 반환한다.
   * @returns {number} 남은 시간 (ms). 0 이하면 즉시 갱신 가능.
   */
  static getTimeUntilNextRotation() {
    const rotation = SaveManager.getShopRotation();
    const elapsed = Date.now() - rotation.lastRotationTime;
    return Math.max(0, SHOP_ROTATION_INTERVAL - elapsed);
  }

  /**
   * 강제로 로테이션을 갱신한다. 디버그/테스트 용도.
   */
  static forceRotate() {
    ShopManager._rotate();
  }

  // ── private ──

  /**
   * 로테이션을 실행하여 새 슬롯을 생성한다.
   * @private
   */
  static _rotate() {
    const slots = [];
    for (let i = 0; i < SHOP_SLOT_COUNT; i++) {
      const grade = ShopManager._pickGrade();
      const chipId = ShopManager._pickChip(grade);
      const price = SHOP_CHIP_PRICES[grade];
      slots.push({ chipId, grade, price });
    }

    SaveManager.setShopRotation({
      lastRotationTime: Date.now(),
      slots,
    });
  }

  /**
   * 등급 가중치 기반으로 랜덤 등급을 선택한다.
   * @returns {string} 선택된 등급 ('C'|'B'|'A'|'S')
   * @private
   */
  static _pickGrade() {
    const entries = Object.entries(SHOP_GRADE_WEIGHTS);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [grade, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return grade;
    }

    // 안전 폴백
    return 'C';
  }

  /**
   * 해당 등급의 칩 중 랜덤으로 하나를 선택한다.
   * CHIP_DEFINITIONS는 등급 필드가 없으므로 모든 칩이 모든 등급에 대응 가능하다.
   * @param {string} grade - 등급
   * @returns {string} 칩 ID
   * @private
   */
  static _pickChip(grade) {
    // CHIP_DEFINITIONS의 모든 칩은 gradeValues에 각 등급별 수치를 가지므로
    // 해당 등급의 gradeValues가 존재하는 칩만 필터링
    const eligible = CHIP_DEFINITIONS.filter(
      def => def.gradeValues && def.gradeValues[grade]
    );

    if (eligible.length === 0) {
      // 안전 폴백: 전체 칩 중 랜덤
      return CHIP_DEFINITIONS[Math.floor(Math.random() * CHIP_DEFINITIONS.length)].id;
    }

    return eligible[Math.floor(Math.random() * eligible.length)].id;
  }
}
