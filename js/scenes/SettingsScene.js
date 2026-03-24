/**
 * @fileoverview 설정 씬. 메인 메뉴에서 진입하여 BGM/SFX/햅틱 ON/OFF 토글을 제공한다.
 * 변경 즉시 반영되며 SaveManager를 통해 영구 저장된다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import SoundSystem from '../systems/SoundSystem.js';
import { setHapticEnabled, isHapticEnabled } from '../managers/HapticManager.js';

// ── SettingsScene 클래스 ──

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  /**
   * 설정 UI를 생성한다.
   */
  create() {
    // ── 씬 진입 페이드 ──
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // ── 타이틀 ──
    this.add.text(centerX, 110, t('settings.title'), {
      fontSize: '24px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 토글 행 ──
    this._createToggleRow(220, t('settings.bgm'), () => SoundSystem.isBgmEnabled(), (val) => {
      SoundSystem.setBgmEnabled(val);
      SaveManager.setSetting('bgmEnabled', val);
    });

    this._createToggleRow(310, t('settings.sfx'), () => SoundSystem.isSfxEnabled(), (val) => {
      SoundSystem.setSfxEnabled(val);
      SaveManager.setSetting('sfxEnabled', val);
    });

    this._createToggleRow(400, t('settings.haptic'), () => isHapticEnabled(), (val) => {
      setHapticEnabled(val);
      SaveManager.setSetting('hapticEnabled', val);
    });

    // ── 궁극기 버튼 위치 (좌/우) ──
    this._createSideToggleRow(490);

    // ── 뒤로가기 버튼 ──
    this._createBackButton(centerX, 590);

    // ── ESC 키 리스너 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 씬 전환 ──

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

  // ── 뒤로가기 ──

  /**
   * MenuScene으로 복귀한다.
   */
  _onBack() {
    this._fadeToScene('MenuScene');
  }

  // ── 토글 행 생성 ──

  /**
   * 설정 항목의 토글 행을 생성한다.
   * @param {number} y - 행 중심 Y 좌표
   * @param {string} label - 항목 레이블 텍스트
   * @param {Function} getState - 현재 ON/OFF 상태를 반환하는 함수
   * @param {Function} onToggle - 새 상태(boolean)를 받아 처리하는 콜백
   * @private
   */
  _createToggleRow(y, label, getState, onToggle) {
    const centerX = GAME_WIDTH / 2;

    // 레이블 텍스트 (좌측)
    this.add.text(centerX - 80, y, label, {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0, 0.5);

    // 상태 텍스트 (우측)
    const isOn = getState();
    const stateText = this.add.text(centerX + 80, y, isOn ? t('settings.on') : t('settings.off'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: isOn ? UI_COLORS.neonGreen : UI_COLORS.textSecondary,
    }).setOrigin(0, 0.5);

    // 터치 영역 (투명 Zone)
    const zone = this.add.zone(centerX, y, 280, 60).setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      const current = getState();
      const newVal = !current;
      onToggle(newVal);

      // 상태 텍스트 갱신
      stateText.setText(newVal ? t('settings.on') : t('settings.off'));
      stateText.setColor(newVal ? UI_COLORS.neonGreen : UI_COLORS.textSecondary);
    });
  }

  // ── 궁극기 버튼 좌우 토글 ──

  /**
   * 궁극기 버튼 위치(좌/우) 토글 행을 생성한다.
   * @param {number} y - 행 중심 Y 좌표
   * @private
   */
  _createSideToggleRow(y) {
    const centerX = GAME_WIDTH / 2;
    const isLeft = (SaveManager.getSetting('ultBtnSide') || 'left') === 'left';

    // 레이블 텍스트 (좌측)
    this.add.text(centerX - 80, y, t('settings.ultSide'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0, 0.5);

    // 상태 텍스트 (우측)
    const stateText = this.add.text(centerX + 80, y,
      isLeft ? t('settings.ultLeft') : t('settings.ultRight'), {
        fontSize: '18px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }).setOrigin(0, 0.5);

    // 터치 영역
    const zone = this.add.zone(centerX, y, 280, 60).setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      const current = SaveManager.getSetting('ultBtnSide') || 'left';
      const newVal = current === 'left' ? 'right' : 'left';
      SaveManager.setSetting('ultBtnSide', newVal);
      stateText.setText(newVal === 'left' ? t('settings.ultLeft') : t('settings.ultRight'));
    });
  }

  // ── 뒤로가기 버튼 생성 ──

  /**
   * 뒤로가기 버튼을 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @private
   */
  _createBackButton(x, y) {
    const btnWidth = 200;
    const btnHeight = 44;

    // 배경 사각형
    const bg = this.add.graphics();
    bg.fillStyle(UI_COLORS.btnSecondary, 0.8);
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
    bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);

    // 텍스트
    const text = this.add.text(x, y, t('ui.back'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    // 터치 영역
    const zone = this.add.zone(x, y, btnWidth, btnHeight).setInteractive({ useHandCursor: true });

    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; text.setAlpha(0.6); });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (pressed) this._onBack();
      pressed = false;
    });
    zone.on('pointerout', () => { pressed = false; text.setAlpha(1); });
  }
}
