/**
 * @fileoverview 스테이지 선택 화면 씬.
 *
 * 4개 스테이지를 세로 카드 리스트로 표시하고,
 * 잠금/해금/클리어 상태별 디자인을 적용한다.
 * 선택한 스테이지 ID를 CharacterScene에 전달한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { STAGES, STAGE_ORDER } from '../data/stages.js';

// ── 레이아웃 상수 ──

const CARD_W = 300;
const CARD_H = 85;
const CARD_GAP = 10;
const LIST_START_Y = 90;

// ── StageSelectScene 클래스 ──

export default class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelectScene');
  }

  /**
   * 스테이지 선택 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 제목 ──
    this.add.text(centerX, 30, t('stage.select'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // 현재 선택된 스테이지
    this._selectedId = SaveManager.getSelectedStage() || 'stage_1';

    // ── 스테이지 카드 생성 ──
    this._cardElements = [];
    this._container = this.add.container(0, 0);

    STAGE_ORDER.forEach((stageId, i) => {
      const stageData = STAGES[stageId];
      const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      this._createStageCard(centerX, cardY, stageData);
    });

    // ── 하단 버튼 ──
    const btnY = GAME_HEIGHT - 60;

    // 출격 버튼
    this._createBtn(centerX - 60, btnY, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SaveManager.setSelectedStage(this._selectedId);
      this.scene.start('CharacterScene', { stageId: this._selectedId });
    });

    // 뒤로가기 버튼
    this._createBtn(centerX + 60, btnY, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this._onBack();
    });

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 뒤로가기 ──

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('MenuScene');
  }

  // ── 스테이지 잠금 해제 판별 ──

  /**
   * 스테이지의 잠금 해제 여부를 확인한다.
   * @param {Object} stageData - 스테이지 데이터
   * @returns {boolean} 해금 여부
   * @private
   */
  _isStageUnlocked(stageData) {
    // 잠금 조건 없음 → 항상 해금
    if (!stageData.unlocksAfter) return true;

    // 이전 스테이지 클리어 여부 확인
    return SaveManager.isStageClear(stageData.unlocksAfter);
  }

  // ── 스테이지 카드 ──

  /**
   * 스테이지 카드를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} stageData - 스테이지 데이터
   * @private
   */
  _createStageCard(x, y, stageData) {
    const isUnlocked = this._isStageUnlocked(stageData);
    const clearCount = SaveManager.getStageClearCount(stageData.id);
    const isCleared = clearCount > 0;
    const isSelected = this._selectedId === stageData.id;

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, isUnlocked ? 0.9 : 0.3);
    bg.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 8);

    // 테두리 색상 결정
    if (isSelected && isUnlocked) {
      // 선택됨
      if (isCleared) {
        bg.lineStyle(2, COLORS.NEON_CYAN, 1);
      } else {
        bg.lineStyle(2, COLORS.NEON_GREEN, 1);
      }
    } else if (isUnlocked) {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.5);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.2);
    }
    bg.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 8);

    this._container.add(bg);

    // 액센트 컬러 바 (좌측)
    const accentBar = this.add.graphics();
    accentBar.fillStyle(stageData.accentColor, isUnlocked ? 0.8 : 0.2);
    accentBar.fillRect(x - CARD_W / 2 + 4, y - CARD_H / 2 + 8, 4, CARD_H - 16);
    this._container.add(accentBar);

    if (isUnlocked) {
      // 스테이지 이름
      const nameColor = isSelected ? UI_COLORS.neonCyan : UI_COLORS.textPrimary;
      const nameText = this.add.text(x - CARD_W / 2 + 20, y - 28, t(stageData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: nameColor,
      });
      this._container.add(nameText);

      // 설명
      const descText = this.add.text(x - CARD_W / 2 + 20, y - 4, t(stageData.descKey), {
        fontSize: '9px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: CARD_W - 40 },
      });
      this._container.add(descText);

      // 난이도 배수 표시
      const diffText = this.add.text(
        x + CARD_W / 2 - 16, y - 28,
        `x${stageData.difficultyMult}`,
        {
          fontSize: '11px',
          fontFamily: 'Galmuri11, monospace',
          color: stageData.difficultyMult >= 2.0 ? UI_COLORS.hpRed : UI_COLORS.neonOrange,
        }
      ).setOrigin(1, 0);
      this._container.add(diffText);

      // 클리어 횟수 표시
      if (isCleared) {
        const clearText = this.add.text(
          x + CARD_W / 2 - 16, y + 16,
          t('stage.clearCount', clearCount),
          {
            fontSize: '10px',
            fontFamily: 'Galmuri11, monospace',
            color: UI_COLORS.neonGreen,
          }
        ).setOrigin(1, 0);
        this._container.add(clearText);
      } else {
        // 첫 도전 표시 (깜빡임)
        const newText = this.add.text(
          x + CARD_W / 2 - 16, y + 16,
          t('stage.new'),
          {
            fontSize: '10px',
            fontFamily: 'Galmuri11, monospace',
            color: UI_COLORS.neonGreen,
          }
        ).setOrigin(1, 0);
        this._container.add(newText);

        // 깜빡임 효과
        this.tweens.add({
          targets: newText,
          alpha: { from: 1, to: 0.3 },
          yoyo: true,
          repeat: -1,
          duration: 500,
        });
      }

      // 터치 영역
      const zone = this.add.zone(x, y, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true });
      this._container.add(zone);

      zone.on('pointerdown', () => {
        this._selectedId = stageData.id;
        // 전체 UI 재생성
        this._container.removeAll(true);
        STAGE_ORDER.forEach((sid, i) => {
          const sd = STAGES[sid];
          const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;
          this._createStageCard(GAME_WIDTH / 2, cardY, sd);
        });
      });
    } else {
      // 잠금 상태: 반투명 + 잠금 아이콘 + 잠금 조건
      const lockIcon = this.add.text(x - CARD_W / 2 + 20, y - 20, '\uD83D\uDD12', {
        fontSize: '20px',
      });
      this._container.add(lockIcon);

      const lockName = this.add.text(x - CARD_W / 2 + 50, y - 18, t(stageData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setAlpha(0.4);
      this._container.add(lockName);

      // 잠금 조건 텍스트
      const prevStageName = stageData.unlocksAfter
        ? t(STAGES[stageData.unlocksAfter].nameKey)
        : '';
      const condText = this.add.text(
        x - CARD_W / 2 + 20, y + 10,
        t('stage.lockCondition', prevStageName),
        {
          fontSize: '10px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
        }
      ).setAlpha(0.4);
      this._container.add(condText);
    }
  }

  // ── 버튼 ──

  /**
   * 하단 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function} callback - 클릭 콜백
   * @private
   */
  _createBtn(x, y, label, bgColor, callback) {
    const btnW = 100;
    const btnH = 36;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);

    const text = this.add.text(x, y, label, {
      fontSize: '13px',
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
