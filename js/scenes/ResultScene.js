/**
 * @fileoverview 결과/보상 화면 씬.
 *
 * 런 종료 후 승리/패배 결과, 통계, 보상을 표시한다.
 * 다시 도전 또는 메인 메뉴로 이동할 수 있다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { AchievementManager } from '../managers/AchievementManager.js';
import { MetaManager } from '../managers/MetaManager.js';

// ── ResultScene 클래스 ──

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  /**
   * 초기 데이터를 전달받는다.
   * @param {{ victory: boolean, killCount: number, runTime: number, creditsEarned: number, level: number, weaponSlotsFilled: number, weaponEvolutions: number }} data
   */
  init(data) {
    /** 승리 여부 */
    this.victory = data.victory || false;

    /** 킬 카운트 */
    this.killCount = data.killCount || 0;

    /** 런 경과 시간 (초) */
    this.runTime = data.runTime || 0;

    /** 획득 크레딧 */
    this.creditsEarned = data.creditsEarned || 0;

    /** 도달 레벨 */
    this.playerLevel = data.level || 1;

    /** 장착된 무기 슬롯 수 */
    this.weaponSlotsFilled = data.weaponSlotsFilled || 0;

    /** 달성한 무기 진화 수 */
    this.weaponEvolutions = data.weaponEvolutions || 0;

    /** 엔들리스 모드 여부 */
    this.isEndless = data.isEndless || false;

    /** 엔들리스 경과 분 */
    this.endlessMinutes = data.endlessMinutes || 0;
  }

  /**
   * 결과 화면 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── SaveManager 크레딧/통계 저장 ──
    SaveManager.addCredits(this.creditsEarned);

    // 통계 갱신
    SaveManager.updateStats('totalRuns', 1);
    SaveManager.updateStats('totalKills', this.killCount);
    SaveManager.updateStats('longestSurvival', this.runTime);
    SaveManager.updateStats('maxKillsInRun', this.killCount);
    SaveManager.updateStats('maxLevel', this.playerLevel);

    // 런 경과 분만큼 totalSurviveMinutes 누적
    const surviveMin = Math.floor(this.runTime / 60);
    if (surviveMin > 0) {
      SaveManager.updateStats('totalSurviveMinutes', surviveMin);
    }

    if (this.victory) {
      SaveManager.updateStats('totalClears', 1);
      // 연속 클리어 갱신 (현재 값 + 1)
      const currentConsecutive = (SaveManager.getStats().consecutiveClears || 0) + 1;
      const data = SaveManager.getData();
      data.stats.consecutiveClears = currentConsecutive;
      SaveManager.save();
    } else {
      // 패배 시 연속 클리어 초기화
      const data = SaveManager.getData();
      data.stats.consecutiveClears = 0;
      SaveManager.save();
    }

    // ── AchievementManager 도전과제 체크 ──
    const savedStats = SaveManager.getStats();
    AchievementManager.checkAll(savedStats, {
      weaponSlotsFilled: this.weaponSlotsFilled,
      weaponEvolutions: this.weaponEvolutions,
      allUpgradesMaxed: MetaManager.areAllMaxed(),
    });

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 승리/패배 타이틀 ──
    let titleKey = this.victory ? 'result.victory' : 'result.defeat';
    if (this.isEndless) titleKey = 'result.endlessOver';
    const titleColor = this.victory ? UI_COLORS.neonGreen : UI_COLORS.hpRed;

    const title = this.add.text(centerX, 100, t(titleKey), {
      fontSize: '32px',
      fontFamily: 'Galmuri11, monospace',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    // 타이틀 등장 애니메이션
    this.tweens.add({
      targets: title,
      alpha: 1,
      y: { from: 70, to: 100 },
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ── 통계 섹션 ──
    const statsY = 200;
    const lineHeight = 30;

    // 생존 시간
    const min = Math.floor(this.runTime / 60);
    const sec = Math.floor(this.runTime % 60);
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    const stats = [
      { text: t('result.surviveTime', timeStr), color: UI_COLORS.textPrimary },
      { text: t('result.kills', this.killCount), color: UI_COLORS.textPrimary },
      { text: t('result.level', `Lv.${this.playerLevel}`), color: UI_COLORS.neonCyan },
    ];

    // 엔들리스 모드 추가 표시
    if (this.isEndless) {
      stats.push({
        text: t('result.endless', this.endlessMinutes),
        color: UI_COLORS.neonMagenta,
      });
    }

    stats.forEach((stat, i) => {
      const statText = this.add.text(centerX, statsY + i * lineHeight, stat.text, {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: stat.color,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: statText,
        alpha: 1,
        y: { from: statsY + i * lineHeight + 20, to: statsY + i * lineHeight },
        duration: 400,
        delay: 300 + i * 150,
      });
    });

    // ── 보상 섹션 ──
    const rewardY = statsY + stats.length * lineHeight + 30;

    // 구분선
    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.UI_BORDER, 0.5);
    divider.lineBetween(centerX - 100, rewardY - 10, centerX + 100, rewardY - 10);

    // 획득 크레딧
    const creditText = this.add.text(
      centerX, rewardY + 10,
      t('result.creditsEarned', this.creditsEarned),
      {
        fontSize: '16px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: creditText,
      alpha: 1,
      duration: 500,
      delay: 800,
    });

    // 클리어 보너스 (승리 시)
    if (this.victory) {
      const bonusText = this.add.text(
        centerX, rewardY + 40,
        t('result.bonusCredit', 100),
        {
          fontSize: '14px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonMagenta,
        }
      ).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: bonusText,
        alpha: 1,
        duration: 500,
        delay: 1000,
      });
    }

    // ── 버튼 ──
    const btnY = GAME_HEIGHT - 140;

    // 다시 도전 버튼
    this._createButton(centerX, btnY, t('result.retry'), UI_COLORS.btnPrimary, () => {
      this.scene.start('GameScene');
    }, 1200);

    // 메인 메뉴 버튼
    this._createButton(centerX, btnY + 60, t('result.toMenu'), UI_COLORS.btnSecondary, () => {
      this.scene.start('MenuScene');
    }, 1400);

    // ── ESC 키로 메뉴 복귀 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('MenuScene');
  }

  // ── 내부 메서드 ──

  /**
   * 버튼(사각형 배경 + 텍스트)을 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function} callback - 클릭 콜백
   * @param {number} [delay=0] - 등장 딜레이 (ms)
   * @private
   */
  _createButton(x, y, label, bgColor, callback, delay = 0) {
    const btnWidth = 180;
    const btnHeight = 40;

    // 배경
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    bg.setAlpha(0);

    // 텍스트
    const text = this.add.text(x, y, label, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5).setAlpha(0);

    // 등장 애니메이션
    this.tweens.add({
      targets: [bg, text],
      alpha: 1,
      duration: 400,
      delay: delay,
    });

    // 터치 영역
    const zone = this.add.zone(x, y, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      text.setAlpha(0.6);
    });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (callback) callback();
    });
  }
}
