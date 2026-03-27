/**
 * @fileoverview 상점 UI 씬 (스텁).
 * Phase 2에서 본격 구현 예정. 현재는 씬 등록을 위한 빈 껍데기만 제공한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { t } from '../i18n.js';

// ── ShopScene 클래스 ──

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  /**
   * 상점 UI를 생성한다. (Phase 2에서 구현 예정)
   */
  create() {
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t('shop.title'), {
      fontSize: '24px',
      fontFamily: 'Galmuri11, monospace',
      color: '#FF6600',
    }).setOrigin(0.5);

    // 뒤로가기 — 터치/클릭으로 메뉴 복귀
    this.input.once('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }
}
