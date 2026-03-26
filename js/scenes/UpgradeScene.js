/**
 * @fileoverview 영구 업그레이드 구매 씬.
 *
 * 5개 탭(기본 스탯/성장 가속/특수/드론/한계돌파)으로 구성된 카드 그리드 방식 UI.
 * MetaManager를 통해 크레딧을 소모하여 업그레이드를 구매한다.
 * 360x640 화면에서 스크롤 없이 최대 4행 x 2열 표시.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { MetaManager } from '../managers/MetaManager.js';
import { SaveManager } from '../managers/SaveManager.js';


// ── 카테고리 탭 정의 ──

/** @type {Array<{key: string, labelKey: string}>} */
const TABS = [
  { key: 'basic', labelKey: 'upgrade.category.basic' },
  { key: 'growth', labelKey: 'upgrade.category.growth' },
  { key: 'special', labelKey: 'upgrade.category.special' },
  { key: 'drone', labelKey: 'upgrade.category.drone' },
  { key: 'limitBreak', labelKey: 'upgrade.category.limitBreak' },
];

// ── 카드 레이아웃 상수 ──

const CARD_W = 155;
const CARD_H = 100;
const CARD_GAP_X = 10;
const CARD_GAP_Y = 8;
const GRID_COLS = 2;
const GRID_START_Y = 120;

// ── UpgradeScene 클래스 ──

export default class UpgradeScene extends Phaser.Scene {
  constructor() {
    super('UpgradeScene');
  }

  /**
   * 씬 UI를 생성한다.
   */
  create() {
    // ── 씬 진입 페이드 ──
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

    /** 현재 선택된 탭 인덱스 */
    this._currentTab = 0;

    /** 카드 UI 요소 참조 배열 (탭 전환 시 제거용) */
    this._cardElements = [];

    /** 탭 버튼 UI 참조 배열 */
    this._tabElements = [];

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 상단 HUD ──
    // 타이틀
    this.add.text(centerX, 20, t('upgrade.title'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // 크레딧 표시
    this._creditHud = this.add.text(centerX, 48, '', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5);
    this._updateCreditHud();

    // ── 뒤로가기 (상단 좌측 ←) ──
    this._createBackArrow(30, 25);

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // ── 탭 버튼 ──
    this._createTabs();

    // ── 초기 탭 카드 렌더링 ──
    this._renderCards();
  }

  /**
   * 페이드 아웃 후 씬을 전환한다.
   * @param {string} sceneName - 전환할 씬 이름
   * @param {Object} [data] - 씬에 전달할 데이터
   * @private
   */
  _fadeToScene(sceneName, data) {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneName, data);
    });
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this._fadeToScene('MenuScene');
  }

  // ── 뒤로 화살표 ──

  /**
   * 상단 좌측 뒤로 화살표 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createBackArrow(x, y) {
    const size = 36;
    const text = this.add.text(x, y, '\u2190', {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, size, size)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => { text.setAlpha(0.5); });
    zone.on('pointerup', () => { text.setAlpha(1); this._onBack(); });
    zone.on('pointerout', () => { text.setAlpha(1); });
  }

  // ── 크레딧 HUD ──

  /**
   * 크레딧 HUD 텍스트를 갱신한다.
   * @private
   */
  _updateCreditHud() {
    if (this._creditHud) {
      this._creditHud.setText(t('menu.credits', SaveManager.getCredits()));
    }
  }

  // ── 탭 ──

  /**
   * 탭 버튼 5개를 생성한다.
   * @private
   */
  _createTabs() {
    const tabY = 75;
    const tabW = 64;
    const tabH = 28;
    const totalW = TABS.length * tabW + (TABS.length - 1) * 4;
    const startX = (GAME_WIDTH - totalW) / 2 + tabW / 2;

    TABS.forEach((tab, i) => {
      const tabX = startX + i * (tabW + 4);
      const isActive = i === this._currentTab;

      const bg = this.add.graphics();
      const textColor = isActive ? UI_COLORS.neonCyan : UI_COLORS.textSecondary;
      const bgAlpha = isActive ? 0.9 : 0.5;

      bg.fillStyle(COLORS.UI_PANEL, bgAlpha);
      bg.fillRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 4);
      if (isActive) {
        bg.lineStyle(1, COLORS.NEON_CYAN, 0.7);
        bg.strokeRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 4);
      }

      const label = this.add.text(tabX, tabY, t(tab.labelKey), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: textColor,
      }).setOrigin(0.5);

      const zone = this.add.zone(tabX, tabY, tabW, tabH)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        this._currentTab = i;
        this._refreshTabs();
        this._renderCards();
      });

      this._tabElements.push(bg, label, zone);
    });
  }

  /**
   * 탭 버튼을 갱신한다 (현재 탭 하이라이트).
   * @private
   */
  _refreshTabs() {
    // 기존 탭 제거 후 재생성
    for (const el of this._tabElements) {
      el.destroy();
    }
    this._tabElements = [];
    this._createTabs();
  }

  // ── 카드 그리드 ──

  /**
   * 현재 탭의 업그레이드 카드를 2열 그리드로 렌더링한다.
   * @private
   */
  _renderCards() {
    // 기존 카드 제거
    for (const el of this._cardElements) {
      el.destroy();
    }
    this._cardElements = [];

    const tab = TABS[this._currentTab];

    // 드론 탭: 해금 전이면 전체 잠금 메시지 표시
    if (tab.key === 'drone' && !SaveManager.isDroneUnlocked()) {
      const centerX = GAME_WIDTH / 2;
      const centerY = GRID_START_Y + 120;

      const lockIcon = this.add.text(centerX, centerY - 20, '🔒', {
        fontSize: '28px',
      }).setOrigin(0.5);
      this._cardElements.push(lockIcon);

      const lockMsg = this.add.text(centerX, centerY + 16, t('upgrade.droneLockedHint'), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: 280 },
        align: 'center',
      }).setOrigin(0.5);
      this._cardElements.push(lockMsg);
      return;
    }

    const upgrades = MetaManager.getAllUpgrades().filter(u => u.category === tab.key);

    const gridStartX = (GAME_WIDTH - (GRID_COLS * CARD_W + (GRID_COLS - 1) * CARD_GAP_X)) / 2 + CARD_W / 2;

    upgrades.forEach((upgrade, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);

      const cardX = gridStartX + col * (CARD_W + CARD_GAP_X);
      const cardY = GRID_START_Y + row * (CARD_H + CARD_GAP_Y) + CARD_H / 2;

      this._createUpgradeCard(cardX, cardY, upgrade);
    });
  }

  /**
   * 업그레이드 카드 하나를 생성한다.
   * @param {number} x - 카드 중심 X
   * @param {number} y - 카드 중심 Y
   * @param {Object} upgrade - 업그레이드 데이터 (MetaManager.getAllUpgrades() 요소)
   * @private
   */
  _createUpgradeCard(x, y, upgrade) {
    const w = CARD_W;
    const h = CARD_H;

    const isLocked = upgrade.isLocked;
    const isMaxed = upgrade.isMaxed;
    const canBuy = upgrade.canBuy;

    // 카드 배경
    const bg = this.add.graphics();
    const bgColor = isLocked ? 0x222233 : COLORS.UI_PANEL;
    const bgAlpha = isLocked ? 0.6 : 0.95;
    bg.fillStyle(bgColor, bgAlpha);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);

    if (canBuy) {
      bg.lineStyle(1, COLORS.NEON_GREEN, 0.6);
    } else if (isMaxed) {
      bg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.3);
    }
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    this._cardElements.push(bg);

    // 잠금 상태 표시
    if (isLocked) {
      const lockText = this.add.text(x, y, t('upgrade.locked'), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setOrigin(0.5);
      this._cardElements.push(lockText);

      // 잠금 안내 텍스트 (해금 조건에 따라 다른 힌트)
      const hintKey = upgrade.unlockCondition === 'allDroneMaxed'
        ? 'upgrade.droneHivemindHint'
        : 'upgrade.limitBreakHint';
      const hintText = this.add.text(x, y + 18, t(hintKey), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: w - 12 },
        align: 'center',
      }).setOrigin(0.5);
      this._cardElements.push(hintText);
      return;
    }

    // 카드 좌측 상단 카테고리 아이콘 (16x16, textures.exists 가드)
    const iconKey = 'icon_upgrade_' + upgrade.category;
    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(x - w / 2 + 12, y - h / 2 + 12, iconKey)
        .setDisplaySize(16, 16);
      this._cardElements.push(icon);
    }

    // 이름
    const nameText = this.add.text(x, y - h / 2 + 14, t(upgrade.nameKey), {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);
    this._cardElements.push(nameText);

    // 레벨 표시
    const lvStr = t('upgrade.level', upgrade.currentLevel, upgrade.maxLevel);
    const lvColor = isMaxed ? UI_COLORS.neonCyan : UI_COLORS.neonGreen;
    const lvText = this.add.text(x, y - h / 2 + 30, lvStr, {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: lvColor,
    }).setOrigin(0.5);
    this._cardElements.push(lvText);

    // 효과 설명
    const descText = this.add.text(x, y + 2, t(upgrade.descKey), {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textMuted,
      wordWrap: { width: w - 16 },
      align: 'center',
    }).setOrigin(0.5);
    this._cardElements.push(descText);

    // 비용/구매 버튼 영역
    const totalBtnW = w - 20;   // 135px (양쪽 여백 10px)
    const btnH = 22;
    const btnY = y + h / 2 - 16;
    const canDown = upgrade.canDowngrade;

    if (isMaxed) {
      // ── MAX 도달 + 다운그레이드 버튼 ──
      const downBtnW = Math.floor(totalBtnW * 0.38);
      const upBtnW = totalBtnW - downBtnW - 4;
      const startX = x - totalBtnW / 2;

      const downBtnX = startX + downBtnW / 2;
      const upBtnX = startX + downBtnW + 4 + upBtnW / 2;

      // [-] 다운그레이드 버튼
      this._createDowngradeButton(downBtnX, btnY, downBtnW, btnH, canDown, upgrade);

      // MAX 레이블 (기존 구매 버튼 위치)
      const maxLabel = this.add.text(upBtnX, btnY, t('upgrade.maxed'), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }).setOrigin(0.5);
      this._cardElements.push(maxLabel);
    } else {
      // ── 구매 가능 상태 + 다운그레이드 버튼 ──
      const downBtnW = Math.floor(totalBtnW * 0.38);
      const upBtnW = totalBtnW - downBtnW - 4;
      const startX = x - totalBtnW / 2;

      const downBtnX = startX + downBtnW / 2;
      const upBtnX = startX + downBtnW + 4 + upBtnW / 2;

      // [-] 다운그레이드 버튼
      this._createDowngradeButton(downBtnX, btnY, downBtnW, btnH, canDown, upgrade);

      // [+] 구매 버튼 배경
      const costStr = t('upgrade.cost', upgrade.nextCost);
      const costColor = canBuy ? '#FFFFFF' : UI_COLORS.textSecondary;

      const btnBg = this.add.graphics();
      const btnBgColor = canBuy ? 0x00AAAA : 0x333344;
      btnBg.fillStyle(btnBgColor, canBuy ? 0.8 : 0.4);
      btnBg.fillRoundedRect(upBtnX - upBtnW / 2, btnY - btnH / 2, upBtnW, btnH, 4);
      this._cardElements.push(btnBg);

      const costText = this.add.text(upBtnX, btnY, costStr, {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: costColor,
      }).setOrigin(0.5);
      this._cardElements.push(costText);

      if (canBuy) {
        const btnZone = this.add.zone(upBtnX, btnY, upBtnW, btnH)
          .setInteractive({ useHandCursor: true });
        this._cardElements.push(btnZone);

        btnZone.on('pointerdown', () => {
          const success = MetaManager.purchaseUpgrade(upgrade.id);
          if (success) {
            this._updateCreditHud();
            this._renderCards();
          }
        });
      }
    }
  }

  /**
   * [-] 다운그레이드 버튼을 생성한다.
   * 활성 상태(currentLevel > 0)이면 클릭 가능, 비활성이면 회색 표시.
   * @param {number} btnX - 버튼 중심 X
   * @param {number} btnY - 버튼 중심 Y
   * @param {number} btnW - 버튼 너비
   * @param {number} btnH - 버튼 높이
   * @param {boolean} canDown - 다운그레이드 가능 여부
   * @param {Object} upgrade - 업그레이드 데이터
   * @private
   */
  _createDowngradeButton(btnX, btnY, btnW, btnH, canDown, upgrade) {
    // 다운그레이드 버튼 배경
    const downBg = this.add.graphics();
    const downBgColor = canDown ? 0xAA3300 : UI_COLORS.btnDisabled;
    downBg.fillStyle(downBgColor, canDown ? 0.8 : 0.4);
    downBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
    this._cardElements.push(downBg);

    // 다운그레이드 버튼 텍스트
    const downTextColor = canDown ? UI_COLORS.neonOrange : UI_COLORS.textSecondary;
    const downLabel = this.add.text(btnX, btnY, t('upgrade.downgrade'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: downTextColor,
    }).setOrigin(0.5);
    this._cardElements.push(downLabel);

    // 활성 상태일 때만 클릭 핸들러 등록
    if (canDown) {
      const btnDownZone = this.add.zone(btnX, btnY, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      this._cardElements.push(btnDownZone);

      btnDownZone.on('pointerdown', () => {
        const success = MetaManager.downgradeUpgrade(upgrade.id);
        if (success) {
          this._updateCreditHud();
          this._renderCards();
        }
      });
    }
  }
}
