/**
 * @fileoverview 도전과제 목록 화면 씬.
 *
 * 13개 도전과제를 세로 스크롤 리스트로 표시한다.
 * 달성 여부, 진행률, 보상 정보를 각 항목에 표시한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { AchievementManager } from '../managers/AchievementManager.js';
import { SaveManager } from '../managers/SaveManager.js';

// ── 레이아웃 상수 ──

const CARD_W = 320;
const CARD_H = 60;
const CARD_GAP = 6;
const LIST_START_Y = 70;

// ── AchievementScene 클래스 ──

export default class AchievementScene extends Phaser.Scene {
  constructor() {
    super('AchievementScene');
  }

  /**
   * 도전과제 화면 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 제목 ──
    this.add.text(centerX, 25, t('collection.achievements'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 도전과제 목록 (스크롤 컨테이너) ──
    const achievements = AchievementManager.getAllAchievements();
    const stats = SaveManager.getStats();

    const listHeight = GAME_HEIGHT - 150;
    const contentHeight = achievements.length * (CARD_H + CARD_GAP);

    this._container = this.add.container(0, 0);

    // 마스크 설정
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(centerX - CARD_W / 2 - 5, LIST_START_Y, CARD_W + 10, listHeight);
    const mask = maskShape.createGeometryMask();
    this._container.setMask(mask);

    // 각 도전과제 카드 생성
    achievements.forEach((ach, i) => {
      const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      this._createAchievementCard(centerX, cardY, ach, stats);
    });

    // ── 스크롤 처리 ──
    if (contentHeight > listHeight) {
      this._scrollMin = LIST_START_Y - (contentHeight - listHeight);
      this._scrollMax = 0;
      this._scrollOffset = 0;

      this.input.on('pointermove', (pointer) => {
        if (pointer.isDown) {
          const dy = pointer.y - pointer.prevPosition.y;
          this._scrollOffset = Phaser.Math.Clamp(
            this._scrollOffset + dy,
            this._scrollMin,
            this._scrollMax
          );
          this._container.setY(this._scrollOffset);
        }
      });
    }

    // ── 뒤로가기 버튼 ──
    this._createButton(centerX, GAME_HEIGHT - 50, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this._onBack();
    });

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('MenuScene');
  }

  // ── 도전과제 카드 ──

  /**
   * 도전과제 카드 하나를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} achievement - 도전과제 데이터 (completed 포함)
   * @param {Object} stats - 현재 통계
   * @private
   */
  _createAchievementCard(x, y, achievement, stats) {
    const completed = achievement.completed;

    // 카드 배경
    const bg = this.add.graphics();
    if (completed) {
      bg.fillStyle(0x003300, 0.15); // neonGreen alpha 0.15
    }
    bg.fillStyle(COLORS.UI_PANEL, completed ? 0.75 : 0.9);
    bg.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);

    if (completed) {
      bg.lineStyle(1, COLORS.NEON_GREEN, 0.4);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.3);
    }
    bg.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
    this._container.add(bg);

    // 달성 여부 아이콘
    const iconStr = completed ? '\u2705' : '\u2B1C';
    const icon = this.add.text(x - CARD_W / 2 + 12, y - 8, iconStr, {
      fontSize: '16px',
    });
    this._container.add(icon);

    // 제목
    const nameText = this.add.text(x - CARD_W / 2 + 38, y - 18, t(achievement.nameKey), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: completed ? UI_COLORS.neonGreen : UI_COLORS.textPrimary,
    });
    this._container.add(nameText);

    // 설명
    const descText = this.add.text(x - CARD_W / 2 + 38, y, t(achievement.descKey), {
      fontSize: '9px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: CARD_W - 80 },
    });
    this._container.add(descText);

    // 진행률 또는 완료 표시
    if (completed) {
      const completeText = this.add.text(x + CARD_W / 2 - 12, y, t('achievement.completed'), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
      }).setOrigin(1, 0.5);
      this._container.add(completeText);
    } else {
      // 진행률 계산 (가능한 경우)
      const progress = this._getProgress(achievement, stats);
      if (progress) {
        const progressText = this.add.text(x + CARD_W / 2 - 12, y, progress, {
          fontSize: '9px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
        }).setOrigin(1, 0.5);
        this._container.add(progressText);
      }
    }
  }

  /**
   * 도전과제 진행률 텍스트를 반환한다.
   * @param {Object} achievement - 도전과제 데이터
   * @param {Object} stats - 통계 데이터
   * @returns {string|null} 진행률 텍스트 또는 null
   * @private
   */
  _getProgress(achievement, stats) {
    const cond = achievement.condition;
    if (!cond || !cond.value) return null;

    let current = 0;
    switch (cond.type) {
      case 'totalKills':
        current = stats.totalKills || 0;
        break;
      case 'totalClears':
        current = stats.totalClears || 0;
        break;
      case 'consecutiveClears':
        current = stats.consecutiveClears || 0;
        break;
      case 'surviveMinutes':
        current = Math.floor((stats.longestSurvival || 0) / 60);
        break;
      default:
        return null;
    }

    return t('achievement.inProgress', current, cond.value);
  }

  // ── 버튼 ──

  /**
   * 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function} callback - 클릭 콜백
   * @private
   */
  _createButton(x, y, label, bgColor, callback) {
    const btnW = 160;
    const btnH = 36;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);

    const text = this.add.text(x, y, label, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, btnW, btnH)
      .setInteractive({ useHandCursor: true });

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
