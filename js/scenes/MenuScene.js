/**
 * @fileoverview 메인 메뉴 씬.
 *
 * 게임 타이틀, 시작 버튼, 업그레이드/도감 버튼(비활성), 언어 토글을 제공한다.
 * 네온 사이버펑크 분위기의 텍스트와 UI를 렌더링한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t, toggleLocale } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
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

    // ── 출격 버튼 (CharacterScene으로 이동) ──
    this._createButton(centerX, 310, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SoundSystem.resume();
      this.scene.start('CharacterScene');
    });

    // ── 업그레이드 버튼 (활성화) ──
    this._createButton(centerX, 370, t('menu.upgrade'), UI_COLORS.btnPrimary, () => {
      this.scene.start('UpgradeScene');
    });

    // ── 도전과제 버튼 (활성화) ──
    this._createButton(centerX, 430, t('menu.achievements'), UI_COLORS.btnPrimary, () => {
      this.scene.start('AchievementScene');
    });

    // ── 도감 버튼 (활성화) ──
    this._createButton(centerX, 490, t('menu.collection'), UI_COLORS.btnPrimary, () => {
      this.scene.start('CollectionScene');
    });

    // ── 하단: 크레딧/데이터코어 보유량 ──
    /** @type {Phaser.GameObjects.Text} 크레딧 표시 텍스트 */
    this._creditText = this.add.text(
      centerX, GAME_HEIGHT - 70,
      t('menu.credits', SaveManager.getCredits()),
      {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5);

    this._dataCoreText = this.add.text(
      centerX, GAME_HEIGHT - 50,
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
