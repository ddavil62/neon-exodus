/**
 * @fileoverview 상점 UI 씬.
 * 드론 칩 탭에서 로테이션 기반으로 진열된 칩 카드를 구매할 수 있다.
 * 3열 x 2행 그리드, 로테이션 타이머, 구매 버튼을 제공한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { ShopManager } from '../managers/ShopManager.js';
import { getChipDef, getGradeInfo } from '../data/droneChips.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── 상수 ──

const CARD_W = 100;
const CARD_H = 130;
const CARD_GAP = 10;
const CARDS_PER_ROW = 3;

/** 등급별 테두리 색상 (hex number) */
const GRADE_BORDER_COLORS = {
  C: 0x888888,
  B: 0x39FF14,
  A: 0x00FFFF,
  S: 0xFF00FF,
};

/** 등급별 텍스트 색상 (CSS hex) */
const GRADE_TEXT_COLORS = {
  C: '#888888',
  B: '#39FF14',
  A: '#00FFFF',
  S: '#FFD700',
};

// ── ShopScene 클래스 ──

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  /**
   * 상점 UI를 생성한다.
   */
  create() {
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.cameras.main.setBackgroundColor(COLORS.BG);

    /** @type {boolean} 씬 전환 중 여부 */
    this._transitioning = false;

    /** @type {number|null} 선택된 슬롯 인덱스 */
    this._selectedSlotIndex = null;

    /** @type {Array<Object>} 카드 렌더링 오브젝트 참조 배열 */
    this._cardObjects = [];

    const centerX = GAME_WIDTH / 2;

    // ── 타이틀 바 ──
    this._createTitleBar(centerX);

    // ── 재화 표시 ──
    this._createCurrencyDisplay(centerX);

    // ── 탭 바 ──
    this._createTabBar(centerX);

    // ── 로테이션 타이머 ──
    this._createRotationTimer(centerX);

    // ── 칩 카드 그리드 ──
    this._renderCards();

    // ── 구매 버튼 ──
    this._createBuyButton(centerX);

    // ── 하단 안내 ──
    this._scrapBalanceText = this.add.text(centerX, 615, t('shop.scrapBalance', SaveManager.getScrap()), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5);

    // ── 타이머 업데이트 ──
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this._updateTimer(),
    });

    // ── ESC / 뒤로 ──
    this.input.keyboard.on('keydown-ESC', () => this._goBack());
  }

  // ── 타이틀 바 ──

  /**
   * 타이틀 바 (뒤로 화살표 + 상점 타이틀)를 생성한다.
   * @param {number} centerX
   * @private
   */
  _createTitleBar(centerX) {
    // 뒤로 화살표
    const backText = this.add.text(30, 25, '\u2190', {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const backZone = this.add.zone(30, 25, 50, 40)
      .setInteractive({ useHandCursor: true });

    backZone.on('pointerdown', () => { backText.setAlpha(0.5); });
    backZone.on('pointerup', () => { backText.setAlpha(1); this._goBack(); });
    backZone.on('pointerout', () => { backText.setAlpha(1); });

    // 타이틀
    this.add.text(centerX, 25, t('shop.title'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
  }

  // ── 재화 표시 ──

  /**
   * 상단 재화 표시줄 (스크랩 / 크리스탈)을 생성한다.
   * @param {number} centerX
   * @private
   */
  _createCurrencyDisplay(centerX) {
    this._scrapHeaderText = this.add.text(centerX - 60, 55, t('shop.scrapBalance', SaveManager.getScrap()), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5);

    this._crystalHeaderText = this.add.text(centerX + 60, 55, t('shop.crystalBalance', SaveManager.getCrystal()), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(0.5);
  }

  // ── 탭 바 ──

  /**
   * 탭 바를 생성한다. 현재는 드론 칩 탭 1개만 표시.
   * @param {number} centerX
   * @private
   */
  _createTabBar(centerX) {
    // 탭 배경
    const tabBg = this.add.graphics();
    tabBg.fillStyle(UI_COLORS.panelBg, 0.8);
    tabBg.fillRoundedRect(centerX - 80, 80, 160, 30, 6);
    tabBg.lineStyle(1, COLORS.NEON_ORANGE, 0.4);
    tabBg.strokeRoundedRect(centerX - 80, 80, 160, 30, 6);

    this.add.text(centerX, 95, t('shop.tabChip'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5);
  }

  // ── 로테이션 타이머 ──

  /**
   * 로테이션 타이머를 생성한다.
   * @param {number} centerX
   * @private
   */
  _createRotationTimer(centerX) {
    this._timerText = this.add.text(centerX, 130, '', {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    this._updateTimer();
  }

  /**
   * 타이머 텍스트를 갱신한다. 0 도달 시 슬롯 새로고침.
   * @private
   */
  _updateTimer() {
    const remaining = ShopManager.getTimeUntilNextRotation();

    if (remaining <= 0) {
      // 슬롯 새로고침
      this._selectedSlotIndex = null;
      this._renderCards();
      this._refreshBuyButton();
      this._refreshCurrencyDisplay();
    }

    const totalSecs = Math.ceil(remaining / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let timeStr;
    if (hrs > 0) {
      timeStr = `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (this._timerText) {
      this._timerText.setText(t('shop.nextRotation', timeStr));
    }
  }

  // ── 칩 카드 그리드 ──

  /**
   * 칩 카드 그리드를 렌더링한다.
   * @private
   */
  _renderCards() {
    // 기존 카드 오브젝트 정리
    this._cardObjects.forEach(obj => {
      if (obj.gfx) obj.gfx.destroy();
      if (obj.iconText) obj.iconText.destroy();
      if (obj.nameText) obj.nameText.destroy();
      if (obj.gradeText) obj.gradeText.destroy();
      if (obj.priceText) obj.priceText.destroy();
      if (obj.zone) obj.zone.destroy();
    });
    this._cardObjects = [];

    const slots = ShopManager.getSlots();
    const gridWidth = CARDS_PER_ROW * CARD_W + (CARDS_PER_ROW - 1) * CARD_GAP;
    const startX = (GAME_WIDTH - gridWidth) / 2 + CARD_W / 2;
    const gridStartY = 155;

    slots.forEach((slot, idx) => {
      const row = Math.floor(idx / CARDS_PER_ROW);
      const col = idx % CARDS_PER_ROW;
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = gridStartY + row * (CARD_H + CARD_GAP) + CARD_H / 2;

      const def = getChipDef(slot.chipId);
      const gradeInfo = getGradeInfo(slot.grade);
      const isSelected = this._selectedSlotIndex === idx;

      const borderColor = GRADE_BORDER_COLORS[slot.grade] || 0xAAAAAA;
      const gradeTextColor = GRADE_TEXT_COLORS[slot.grade] || '#AAAAAA';

      // 카드 배경
      const gfx = this.add.graphics();
      gfx.fillStyle(UI_COLORS.panelBg, 0.9);
      gfx.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);

      if (isSelected) {
        gfx.lineStyle(2, 0xFFFFFF, 0.9);
      } else {
        gfx.lineStyle(1, borderColor, 0.6);
      }
      gfx.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);

      // 칩 아이콘
      const icon = def ? def.icon : '?';
      const iconText = this.add.text(cx, cy - 30, icon, {
        fontSize: '28px',
        fontFamily: 'Galmuri11, monospace',
        color: gradeInfo ? gradeInfo.color : '#FFFFFF',
      }).setOrigin(0.5);

      // 칩 이름
      const nameKey = def ? def.nameKey : slot.chipId;
      const nameText = this.add.text(cx, cy + 10, t(nameKey), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
        wordWrap: { width: CARD_W - 10 },
        align: 'center',
      }).setOrigin(0.5);

      // 등급 뱃지
      const gradeText = this.add.text(cx, cy + 30, slot.grade, {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: gradeTextColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // 가격
      const priceText = this.add.text(cx, cy + 50, `${slot.price} ${t('shop.tabChip').charAt(0) === '드' ? '스크랩' : 'Scrap'}`, {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }).setOrigin(0.5);

      // 선택 시 스케일 업
      if (isSelected) {
        iconText.setScale(1.05);
        nameText.setScale(1.05);
        gradeText.setScale(1.05);
        priceText.setScale(1.05);
      }

      // 터치 영역
      const zone = this.add.zone(cx, cy, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        if (this._selectedSlotIndex === idx) {
          this._selectedSlotIndex = null;
        } else {
          this._selectedSlotIndex = idx;
        }
        this._renderCards();
        this._refreshBuyButton();
      });

      this._cardObjects.push({ gfx, iconText, nameText, gradeText, priceText, zone });
    });
  }

  // ── 구매 버튼 ──

  /**
   * 구매 버튼을 생성한다.
   * @param {number} centerX
   * @private
   */
  _createBuyButton(centerX) {
    this._buyBtnBg = this.add.graphics().setDepth(20);
    this._buyBtnText = this.add.text(centerX, 565, '', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(21);

    this._buyBtnZone = this.add.zone(centerX, 565, 260, 44)
      .setInteractive({ useHandCursor: true })
      .setDepth(22);

    this._buyBtnZone.on('pointerdown', () => this._onBuy());

    this._refreshBuyButton();
  }

  /**
   * 구매 버튼 상태를 갱신한다.
   * @private
   */
  _refreshBuyButton() {
    this._buyBtnBg.clear();

    if (this._selectedSlotIndex === null) {
      this._buyBtnText.setText('');
      this._buyBtnZone.input.enabled = false;
      return;
    }

    const slots = ShopManager.getSlots();
    const slot = slots[this._selectedSlotIndex];
    if (!slot) {
      this._buyBtnText.setText('');
      this._buyBtnZone.input.enabled = false;
      return;
    }

    const canAfford = SaveManager.getScrap() >= slot.price;
    const invFull = SaveManager.getDroneChipInventory().length >= 30;
    const enabled = canAfford && !invFull;

    const btnColor = enabled ? COLORS.NEON_ORANGE : UI_COLORS.btnDisabled;
    const centerX = GAME_WIDTH / 2;

    this._buyBtnBg.fillStyle(btnColor, enabled ? 0.8 : 0.5);
    this._buyBtnBg.fillRoundedRect(centerX - 130, 565 - 22, 260, 44, 8);

    if (enabled) {
      this._buyBtnBg.lineStyle(1, 0xFFFFFF, 0.3);
      this._buyBtnBg.strokeRoundedRect(centerX - 130, 565 - 22, 260, 44, 8);
    }

    this._buyBtnText.setText(t('shop.buy', slot.price));
    this._buyBtnText.setColor(enabled ? '#FFFFFF' : UI_COLORS.textSecondary);
    this._buyBtnZone.input.enabled = enabled;
  }

  /**
   * 구매 버튼 클릭 처리.
   * @private
   */
  _onBuy() {
    if (this._selectedSlotIndex === null) return;

    const result = ShopManager.purchase(this._selectedSlotIndex);

    if (result.success) {
      SoundSystem.play('select');
      this._showToast(t('shop.purchased'), UI_COLORS.neonGreen);
      this._selectedSlotIndex = null;
      this._renderCards();
      this._refreshBuyButton();
      this._refreshCurrencyDisplay();
    } else if (result.reason === 'insufficientScrap') {
      this._showToast(t('shop.insufficientScrap'), UI_COLORS.hpRed);
    } else if (result.reason === 'inventoryFull') {
      this._showToast(t('shop.inventoryFull'), UI_COLORS.hpRed);
    }
  }

  // ── 재화 표시 갱신 ──

  /**
   * 재화 텍스트를 갱신한다.
   * @private
   */
  _refreshCurrencyDisplay() {
    if (this._scrapHeaderText) {
      this._scrapHeaderText.setText(t('shop.scrapBalance', SaveManager.getScrap()));
    }
    if (this._crystalHeaderText) {
      this._crystalHeaderText.setText(t('shop.crystalBalance', SaveManager.getCrystal()));
    }
    if (this._scrapBalanceText) {
      this._scrapBalanceText.setText(t('shop.scrapBalance', SaveManager.getScrap()));
    }
  }

  // ── 토스트 ──

  /**
   * 화면 중앙에 토스트 메시지를 표시한다.
   * @param {string} message - 메시지 텍스트
   * @param {string} color - CSS hex 색상
   * @private
   */
  _showToast(message, color) {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: color,
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00224488',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 40,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => toast.destroy(),
    });
  }

  // ── 뒤로가기 ──

  /**
   * 뒤로가기 처리. 페이드 아웃 후 MenuScene으로 전환.
   * @private
   */
  _goBack() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * 하드웨어 뒤로가기 핸들러.
   * @private
   */
  _onBack() {
    this._goBack();
  }
}
