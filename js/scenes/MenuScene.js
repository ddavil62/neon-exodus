/**
 * @fileoverview 메인 메뉴 씬.
 *
 * 게임 타이틀, 2열 그리드 메인 버튼, 보조 버튼 행, CTA 출격 버튼,
 * 리소스 표시, 언어 토글을 제공한다.
 * 네온 사이버펑크 분위기의 텍스트와 UI를 렌더링한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS, IAP_PRODUCTS } from '../config.js';
import { t, toggleLocale } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { IAPManager } from '../managers/IAPManager.js';
import { DailyMissionManager } from '../managers/DailyMissionManager.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── MenuScene 클래스 ──

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  /**
   * 메뉴 UI를 생성한다.
   * 2열 그리드 + CTA + 보조 버튼 레이아웃으로 시각적 계층을 제공한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── BGM: 메뉴 BGM 시작 ──
    SoundSystem.playBgm('bgm_menu');

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // 메뉴 배경 이미지 렌더링 (프로시저럴 생성 또는 PNG 폴백)
    if (this.textures.exists('menu_bg')) {
      this.add.image(centerX, GAME_HEIGHT / 2, 'menu_bg')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setDepth(-1);
    }

    // 하단 그라디언트 오버레이 (버튼 영역 가독성 확보)
    const overlay = this.add.graphics().setDepth(0);
    for (let y = 300; y < GAME_HEIGHT; y++) {
      const alpha = Math.min(((y - 300) / (GAME_HEIGHT - 300)) * 0.85, 0.85);
      overlay.fillStyle(COLORS.BG, alpha);
      overlay.fillRect(0, y, GAME_WIDTH, 1);
    }

    // ── 타이틀 영역 ──
    this.add.text(centerX, 52, t('menu.title'), {
      fontSize: '36px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.neonMagenta,
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 부제
    this.add.text(centerX, 88, t('menu.subtitle'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    // ── 2열 그리드 (메인 버튼 4개) ──
    // 좌표: col0=96, col1=264, row0=370, row1=434

    // 캐릭터 버튼 (0,0)
    this._createButton(96, 370, t('menu.character'), {
      width: 156,
      height: 52,
      fontSize: '14px',
      bgColor: UI_COLORS.btnPrimary,
      borderColor: COLORS.NEON_CYAN,
      borderAlpha: 0.5,
      borderWidth: 1,
      textColor: UI_COLORS.textPrimary,
      radius: 8,
      callback: () => {
        this.scene.start('CharacterScene', { fromScene: 'MenuScene' });
      },
    });

    // 업그레이드 버튼 (1,0) — 조건부 비활성
    const upgradeUnlocked = SaveManager.isUpgradeUnlocked();
    this._createButton(264, 370, t('menu.upgrade'), {
      width: 156,
      height: 52,
      fontSize: '14px',
      bgColor: upgradeUnlocked ? UI_COLORS.btnPrimary : UI_COLORS.btnDisabled,
      borderColor: COLORS.NEON_CYAN,
      borderAlpha: 0.5,
      borderWidth: 1,
      textColor: upgradeUnlocked ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
      radius: 8,
      disabled: !upgradeUnlocked,
      callback: () => {
        this.scene.start('UpgradeScene');
      },
    });

    // 도전과제 버튼 (0,1)
    this._createButton(96, 434, t('menu.achievements'), {
      width: 156,
      height: 52,
      fontSize: '14px',
      bgColor: UI_COLORS.btnPrimary,
      borderColor: COLORS.NEON_CYAN,
      borderAlpha: 0.5,
      borderWidth: 1,
      textColor: UI_COLORS.textPrimary,
      radius: 8,
      callback: () => {
        this.scene.start('AchievementScene');
      },
    });

    // 일일 미션 버튼 (1,1) — 미완료 시 (!) 표시
    DailyMissionManager.init();
    const dailyLabel = DailyMissionManager.hasUnclaimedMissions()
      ? `${t('menu.dailyMission')} (!)`
      : t('menu.dailyMission');
    this._createButton(264, 434, dailyLabel, {
      width: 156,
      height: 52,
      fontSize: '14px',
      bgColor: UI_COLORS.btnPrimary,
      borderColor: COLORS.NEON_CYAN,
      borderAlpha: 0.5,
      borderWidth: 1,
      textColor: UI_COLORS.textPrimary,
      radius: 8,
      callback: () => {
        this.scene.start('DailyMissionScene');
      },
    });

    // ── 보조 버튼 행 ──
    const autoHuntUnlocked = IAPManager.isAutoHuntUnlocked();

    if (autoHuntUnlocked) {
      // 자동사냥 해금됨: 도감/설정 2개만 + 자동사냥 ON 텍스트
      this._createButton(120, 498, t('menu.collection'), {
        width: 96,
        height: 36,
        fontSize: '12px',
        bgColor: UI_COLORS.btnSecondary,
        borderColor: COLORS.UI_BORDER,
        borderAlpha: 0.5,
        borderWidth: 1,
        textColor: UI_COLORS.textSecondary,
        radius: 6,
        callback: () => {
          this.scene.start('CollectionScene');
        },
      });

      // 자동사냥 ON 텍스트 (버튼 없이)
      this.add.text(centerX, 498, t('autoHunt.on'), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
      }).setOrigin(0.5);

      this._createButton(240, 498, t('menu.settings'), {
        width: 96,
        height: 36,
        fontSize: '12px',
        bgColor: UI_COLORS.btnSecondary,
        borderColor: COLORS.UI_BORDER,
        borderAlpha: 0.5,
        borderWidth: 1,
        textColor: UI_COLORS.textSecondary,
        radius: 6,
        callback: () => {
          this.scene.start('SettingsScene');
        },
      });
    } else {
      // 자동사냥 미해금: 3개 버튼 (도감, 자동사냥 구매, 설정)
      this._createButton(56, 498, t('menu.collection'), {
        width: 96,
        height: 36,
        fontSize: '12px',
        bgColor: UI_COLORS.btnSecondary,
        borderColor: COLORS.UI_BORDER,
        borderAlpha: 0.5,
        borderWidth: 1,
        textColor: UI_COLORS.textSecondary,
        radius: 6,
        callback: () => {
          this.scene.start('CollectionScene');
        },
      });

      // 자동사냥 구매 버튼
      const price = IAPManager.getLocalizedPrice();
      const btnLabel = `${t('autoHunt.purchase')} (${price})`;
      this._createButton(180, 498, btnLabel, {
        width: 120,
        height: 36,
        fontSize: '12px',
        bgColor: COLORS.NEON_ORANGE,
        borderColor: COLORS.UI_BORDER,
        borderAlpha: 0.5,
        borderWidth: 1,
        textColor: UI_COLORS.textPrimary,
        radius: 6,
        callback: () => {
          this._showAutoHuntPurchase();
        },
      });

      this._createButton(304, 498, t('menu.settings'), {
        width: 96,
        height: 36,
        fontSize: '12px',
        bgColor: UI_COLORS.btnSecondary,
        borderColor: COLORS.UI_BORDER,
        borderAlpha: 0.5,
        borderWidth: 1,
        textColor: UI_COLORS.textSecondary,
        radius: 6,
        callback: () => {
          this.scene.start('SettingsScene');
        },
      });
    }

    // ── CTA 출격 버튼 ──
    this._createButton(centerX, 560, t('menu.start'), {
      width: 310,
      height: 56,
      fontSize: '20px',
      bgColor: UI_COLORS.btnPrimary,
      bgAlpha: 0.9,
      borderColor: COLORS.NEON_CYAN,
      borderAlpha: 0.8,
      borderWidth: 2,
      textColor: UI_COLORS.neonCyan,
      textStroke: UI_COLORS.neonMagenta,
      textStrokeThickness: 1,
      radius: 10,
      glowColor: COLORS.NEON_CYAN,
      glowPadding: 4,
      callback: () => {
        SoundSystem.resume();
        if (!SaveManager.isCutsceneViewed('prologue')) {
          this.scene.start('CutsceneScene', {
            cutsceneId: 'prologue',
            nextScene: 'StageSelectScene',
            nextSceneData: {},
          });
        } else {
          this.scene.start('StageSelectScene');
        }
      },
    });

    // ── 하단: 크레딧/데이터코어 보유량 (한 줄로 표시) ──
    /** @type {Phaser.GameObjects.Text} 크레딧 표시 텍스트 */
    this._creditText = this.add.text(
      60, 604,
      t('menu.credits', SaveManager.getCredits()),
      {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5);

    /** @type {Phaser.GameObjects.Text} 데이터코어 표시 텍스트 */
    this._dataCoreText = this.add.text(
      300, 604,
      t('menu.dataCores', SaveManager.getDataCores()),
      {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonMagenta,
      }
    ).setOrigin(0.5);

    // ── 씬 재개 시 크레딧 갱신 ──
    this.events.on('wake', this._refreshCredits, this);
    this.events.on('resume', this._refreshCredits, this);

    // ── 언어 토글 버튼 ──
    const langBtn = this.add.text(GAME_WIDTH - 30, GAME_HEIGHT - 12, t('menu.lang'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
      backgroundColor: UI_COLORS.panelBgStr,
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
          stroke: UI_COLORS.strokeBlack,
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
          stroke: UI_COLORS.strokeBlack,
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
   * options 객체 패턴으로 다양한 크기/스타일의 버튼을 유연하게 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {string} label - 버튼 텍스트
   * @param {Object} [options={}] - 버튼 옵션
   * @param {number} [options.width=156] - 버튼 너비
   * @param {number} [options.height=52] - 버튼 높이
   * @param {string} [options.fontSize='14px'] - 폰트 크기
   * @param {number} [options.bgColor=UI_COLORS.btnPrimary] - 배경 색상
   * @param {number} [options.bgAlpha=0.8] - 배경 투명도
   * @param {number} [options.borderColor=COLORS.NEON_CYAN] - 테두리 색상
   * @param {number} [options.borderAlpha=0.5] - 테두리 투명도
   * @param {number} [options.borderWidth=1] - 테두리 두께
   * @param {string} [options.textColor=UI_COLORS.textPrimary] - 텍스트 색상
   * @param {string} [options.textStroke=null] - 텍스트 스트로크 색상
   * @param {number} [options.textStrokeThickness=0] - 텍스트 스트로크 두께
   * @param {number} [options.radius=8] - 모서리 반경
   * @param {boolean} [options.disabled=false] - 비활성 상태
   * @param {Function|null} [options.callback=null] - 클릭 콜백
   * @param {number|null} [options.glowColor=null] - CTA용 글로우 색상
   * @param {number} [options.glowPadding=4] - 글로우 패딩
   * @private
   */
  _createButton(x, y, label, options = {}) {
    const {
      width = 156,
      height = 52,
      fontSize = '14px',
      bgColor = UI_COLORS.btnPrimary,
      bgAlpha = 0.8,
      borderColor = COLORS.NEON_CYAN,
      borderAlpha = 0.5,
      borderWidth = 1,
      textColor = UI_COLORS.textPrimary,
      textStroke = null,
      textStrokeThickness = 0,
      radius = 8,
      disabled = false,
      callback = null,
      glowColor = null,
      glowPadding = 4,
    } = options;

    const bg = this.add.graphics();

    // 글로우 효과 (CTA 버튼용)
    if (glowColor !== null) {
      const glowW = width + glowPadding * 2;
      const glowH = height + glowPadding * 2;
      bg.fillStyle(glowColor, 0.15);
      bg.fillRoundedRect(
        x - glowW / 2, y - glowH / 2,
        glowW, glowH, radius + 2
      );
    }

    // 배경 사각형
    bg.fillStyle(bgColor, disabled ? 0.4 : bgAlpha);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);

    // 테두리 (비활성 시 생략)
    if (!disabled) {
      bg.lineStyle(borderWidth, borderColor, borderAlpha);
      bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    }

    // 텍스트 스타일 구성
    const textStyle = {
      fontSize,
      fontFamily: 'Galmuri11, monospace',
      color: disabled ? UI_COLORS.textSecondary : textColor,
    };

    // 텍스트 스트로크 (CTA 버튼용)
    if (textStroke) {
      textStyle.stroke = textStroke;
      textStyle.strokeThickness = textStrokeThickness;
    }

    const text = this.add.text(x, y, label, textStyle).setOrigin(0.5);

    if (disabled) return;

    // 터치 영역 (투명 Zone)
    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });

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
