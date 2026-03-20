/**
 * @fileoverview 메인 메뉴 씬.
 *
 * 게임 타이틀, 시작 버튼, 업그레이드/도감 버튼(비활성), 언어 토글을 제공한다.
 * 네온 사이버펑크 분위기의 텍스트와 UI를 렌더링한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS, IAP_PRODUCTS } from '../config.js';
import { t, toggleLocale } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { IAPManager } from '../managers/IAPManager.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── MenuScene 클래스 ──

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  /**
   * 메뉴 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── BGM: 메뉴 BGM 시작 ──
    SoundSystem.playBgm('bgm_menu');

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // menu_bg 텍스처 존재 시 배경 이미지 렌더링 (Group B)
    if (this.textures.exists('menu_bg')) {
      this.add.image(centerX, GAME_HEIGHT / 2, 'menu_bg')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.85)
        .setDepth(-1);
    }

    // ── 타이틀 ──
    this.add.text(centerX, 150, t('menu.title'), {
      fontSize: '36px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.neonMagenta,
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 부제
    this.add.text(centerX, 195, t('menu.subtitle'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    // ── 출격 버튼 (StageSelectScene으로 이동) ──
    this._createButton(centerX, 280, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SoundSystem.resume();
      this.scene.start('StageSelectScene');
    });

    // ── 업그레이드 버튼 (활성화) ──
    this._createButton(centerX, 330, t('menu.upgrade'), UI_COLORS.btnPrimary, () => {
      this.scene.start('UpgradeScene');
    });

    // ── 도전과제 버튼 (활성화) ──
    this._createButton(centerX, 380, t('menu.achievements'), UI_COLORS.btnPrimary, () => {
      this.scene.start('AchievementScene');
    });

    // ── 도감 버튼 (활성화) ──
    this._createButton(centerX, 430, t('menu.collection'), UI_COLORS.btnPrimary, () => {
      this.scene.start('CollectionScene');
    });

    // ── 자동 사냥 구매 버튼 (미해금 시 표시) ──
    if (!IAPManager.isAutoHuntUnlocked()) {
      const price = IAPManager.getLocalizedPrice();
      const btnLabel = `${t('autoHunt.purchase')} (${price})`;
      this._createButton(centerX, 480, btnLabel, COLORS.NEON_ORANGE, () => {
        this._showAutoHuntPurchase();
      });
    } else {
      // 해금 완료 표시
      this.add.text(centerX, 480, t('autoHunt.on'), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
      }).setOrigin(0.5);
    }

    // ── 설정 버튼 ──
    this._createButton(centerX, 530, t('menu.settings'), UI_COLORS.btnSecondary, () => {
      this.scene.start('SettingsScene');
    });

    // ── 하단: 크레딧/데이터코어 보유량 ──
    /** @type {Phaser.GameObjects.Text} 크레딧 표시 텍스트 */
    this._creditText = this.add.text(
      centerX, GAME_HEIGHT - 72,
      t('menu.credits', SaveManager.getCredits()),
      {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5);

    this._dataCoreText = this.add.text(
      centerX, GAME_HEIGHT - 55,
      t('menu.dataCores', SaveManager.getDataCores()),
      {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonMagenta,
      }
    ).setOrigin(0.5);

    // ── 씬 재개 시 크레딧 갱신 ──
    this.events.on('wake', this._refreshCredits, this);
    this.events.on('resume', this._refreshCredits, this);

    // ── 언어 토글 버튼 ──
    const langBtn = this.add.text(GAME_WIDTH - 40, GAME_HEIGHT - 30, t('menu.lang'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
      backgroundColor: '#1A1A2E',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    langBtn.on('pointerdown', () => {
      toggleLocale();
      // 씬 재시작으로 언어 변경 반영
      this.scene.restart();
    });

    // ── ESC 키로 앱 종료 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 자동 사냥 구매 팝업 ──

  /**
   * 자동 사냥 구매 팝업을 표시한다.
   * IAP 구매 완료 시 SaveManager에 해금 상태를 저장하고 씬을 새로고침한다.
   * @private
   */
  async _showAutoHuntPurchase() {
    const result = await IAPManager.purchase(IAP_PRODUCTS.autoHunt);

    if (result.purchased) {
      // 해금 처리
      IAPManager.unlockAutoHunt();

      // 성공 메시지 표시
      const msg = this.add.text(
        GAME_WIDTH / 2, GAME_HEIGHT / 2,
        t('autoHunt.purchaseSuccess'),
        {
          fontSize: '16px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonGreen,
          stroke: '#000000',
          strokeThickness: 2,
        }
      ).setOrigin(0.5).setDepth(500);

      // 1.5초 후 씬 새로고침
      this.time.delayedCall(1500, () => {
        msg.destroy();
        this.scene.restart();
      });
    } else if (result.error !== 'cancelled') {
      // 실패 메시지 표시 (사용자 취소 시에는 표시하지 않음)
      const msg = this.add.text(
        GAME_WIDTH / 2, GAME_HEIGHT / 2,
        t('autoHunt.purchaseFail'),
        {
          fontSize: '14px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.hpRed,
          stroke: '#000000',
          strokeThickness: 2,
        }
      ).setOrigin(0.5).setDepth(500);

      this.time.delayedCall(2000, () => {
        msg.destroy();
      });
    }
  }

  // ── 뒤로가기 ──

  /**
   * 메뉴에서 뒤로가기 시 앱을 종료한다.
   */
  _onBack() {
    try {
      const Capacitor = window.Capacitor;
      if (Capacitor && Capacitor.isNativePlatform()) {
        Capacitor.Plugins.App.exitApp();
      }
    } catch (e) { /* 브라우저 환경 무시 */ }
  }

  // ── 내부 메서드 ──

  /**
   * 크레딧/데이터코어 표시를 갱신한다 (씬 재개 시 호출).
   * @private
   */
  _refreshCredits() {
    if (this._creditText) {
      this._creditText.setText(t('menu.credits', SaveManager.getCredits()));
    }
    if (this._dataCoreText) {
      this._dataCoreText.setText(t('menu.dataCores', SaveManager.getDataCores()));
    }
  }

  /**
   * 버튼(사각형 배경 + 텍스트)을 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function|null} callback - 클릭 콜백 (null이면 비활성)
   * @param {boolean} [disabled=false] - 비활성 상태
   * @private
   */
  _createButton(x, y, label, bgColor, callback, disabled = false) {
    const btnWidth = 200;
    const btnHeight = 44;

    // 배경 사각형
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, disabled ? 0.4 : 0.8);
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);

    if (!disabled) {
      bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
      bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    }

    // 텍스트
    const text = this.add.text(x, y, label, {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: disabled ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    if (disabled) return;

    // 터치 영역 (투명 Zone)
    const zone = this.add.zone(x, y, btnWidth, btnHeight).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      text.setAlpha(0.8);
    });
    zone.on('pointerout', () => {
      text.setAlpha(1);
    });
    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; text.setAlpha(0.6); });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (pressed && callback) callback();
      pressed = false;
    });
    zone.on('pointerout', () => { pressed = false; text.setAlpha(1); });
  }
}
