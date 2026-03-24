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
import { STAGES, STAGE_ORDER, DIFFICULTY_MODES, DIFFICULTY_ORDER } from '../data/stages.js';

// ── 레이아웃 상수 ──

const CARD_W = 300;
const CARD_H = 92;
/** 선택된 스테이지 카드 확장 높이 (난이도 버튼 영역 +30px) */
const CARD_H_EXPANDED = 136;
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
    // ── 씬 진입 페이드 ──
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

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

    // 현재 선택된 난이도 (SaveManager에서 복원)
    this._selectedDifficulty = SaveManager.getSelectedDifficulty() || 'normal';

    // ── 스테이지 카드 생성 ──
    this._cardElements = [];
    this._container = this.add.container(0, 0);

    this._renderCards(centerX);

    // ── 하단 버튼 ──
    const btnY = GAME_HEIGHT - 60;

    // 뒤로가기 버튼 (좌)
    this._createBtn(centerX - 60, btnY, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this._onBack();
    });

    // 출격 버튼 (우)
    this._createBtn(centerX + 60, btnY, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SaveManager.setSelectedStage(this._selectedId);
      this._fadeToScene('CharacterScene', { stageId: this._selectedId, fromScene: 'StageSelectScene' });
    });

    // ── ESC 키로 뒤로가기 ──
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

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this._fadeToScene('MenuScene');
  }

  // ── 카드 렌더링 ──

  /**
   * 전체 스테이지 카드를 렌더링한다.
   * 선택된 스테이지 카드는 확장(+30px)하여 난이도 버튼을 표시한다.
   * @param {number} centerX - 화면 중심 X
   * @private
   */
  _renderCards(centerX) {
    let curY = LIST_START_Y;
    STAGE_ORDER.forEach((stageId) => {
      const stageData = STAGES[stageId];
      const isSelected = this._selectedId === stageId;
      const isUnlocked = this._isStageUnlocked(stageData);
      const h = (isSelected && isUnlocked) ? CARD_H_EXPANDED : CARD_H;
      const cardCenterY = curY + h / 2;
      this._createStageCard(centerX, cardCenterY, stageData, h);
      curY += h + CARD_GAP;
    });
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

    // 이전 스테이지 클리어 여부 확인 (normal 기준)
    return SaveManager.isStageClear(stageData.unlocksAfter, 'normal');
  }

  // ── 스테이지 카드 ──

  /**
   * 스테이지 카드를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} stageData - 스테이지 데이터
   * @param {number} cardH - 카드 높이 (선택 시 확장)
   * @private
   */
  _createStageCard(x, y, stageData, cardH) {
    const isUnlocked = this._isStageUnlocked(stageData);
    const clearCount = SaveManager.getStageClearCount(stageData.id);
    const isCleared = clearCount > 0;
    const isSelected = this._selectedId === stageData.id;

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, isUnlocked ? 0.9 : 0.3);
    bg.fillRoundedRect(x - CARD_W / 2, y - cardH / 2, CARD_W, cardH, 8);

    // 테두리 색상 결정
    if (isSelected && isUnlocked) {
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
    bg.strokeRoundedRect(x - CARD_W / 2, y - cardH / 2, CARD_W, cardH, 8);

    this._container.add(bg);

    // 콘텐츠 기준 Y (카드 상단 기준 — 확장 여부와 무관하게 상단 92px 영역에 콘텐츠 배치)
    const contentCenterY = y - cardH / 2 + CARD_H / 2;

    // 액센트 컬러 바 (좌측)
    const accentBar = this.add.graphics();
    accentBar.fillStyle(stageData.accentColor, isUnlocked ? 0.8 : 0.2);
    accentBar.fillRect(x - CARD_W / 2 + 4, y - cardH / 2 + 8, 4, CARD_H - 16);
    this._container.add(accentBar);

    if (isUnlocked) {
      // 스테이지 이름
      const nameColor = isSelected ? UI_COLORS.neonCyan : UI_COLORS.textPrimary;
      const nameText = this.add.text(x - CARD_W / 2 + 20, contentCenterY - 28, t(stageData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: nameColor,
      });
      this._container.add(nameText);

      // 설명
      const descText = this.add.text(x - CARD_W / 2 + 20, contentCenterY - 4, t(stageData.descKey), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: CARD_W - 40 },
      });
      this._container.add(descText);

      // 난이도 배수 표시
      const diffText = this.add.text(
        x + CARD_W / 2 - 16, contentCenterY - 28,
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
          x + CARD_W / 2 - 16, contentCenterY + 16,
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
          x + CARD_W / 2 - 16, contentCenterY + 16,
          t('stage.new'),
          {
            fontSize: '10px',
            fontFamily: 'Galmuri11, monospace',
            color: UI_COLORS.neonGreen,
          }
        ).setOrigin(1, 0);
        this._container.add(newText);

        this.tweens.add({
          targets: newText,
          alpha: { from: 1, to: 0.3 },
          yoyo: true,
          repeat: -1,
          duration: 500,
        });
      }

      // ── 난이도 버튼 (선택된 스테이지에만 표시) ──
      if (isSelected) {
        this._createDifficultyButtons(x, y, cardH, stageData);
      }

      // 터치 영역 (상단 92px 영역만)
      const zone = this.add.zone(x, contentCenterY, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true });
      this._container.add(zone);

      zone.on('pointerdown', () => {
        if (this._selectedId !== stageData.id) {
          this._selectedId = stageData.id;
          // 해당 스테이지에서 선택 난이도가 해금 안 됐으면 normal로 초기화
          if (!SaveManager.isDifficultyUnlocked(stageData.id, this._selectedDifficulty)) {
            this._selectedDifficulty = 'normal';
          }
          // 전체 UI 재생성
          this._container.removeAll(true);
          this._renderCards(GAME_WIDTH / 2);
        }
      });
    } else {
      // 잠금 상태: 반투명 + 잠금 아이콘 + 잠금 조건
      const lockIcon = this.add.text(x - CARD_W / 2 + 20, contentCenterY - 20, '\uD83D\uDD12', {
        fontSize: '20px',
      });
      this._container.add(lockIcon);

      const lockName = this.add.text(x - CARD_W / 2 + 50, contentCenterY - 18, t(stageData.nameKey), {
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
        x - CARD_W / 2 + 20, contentCenterY + 10,
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

  // ── 난이도 버튼 ──

  /**
   * 선택된 스테이지 카드의 하단에 난이도 버튼 3개를 배치한다.
   * @param {number} cardCenterX - 카드 중심 X
   * @param {number} cardCenterY - 카드 중심 Y
   * @param {number} cardH - 카드 높이
   * @param {Object} stageData - 스테이지 데이터
   * @private
   */
  _createDifficultyButtons(cardCenterX, cardCenterY, cardH, stageData) {
    const btnW = 80;
    const btnH = 36;
    const btnGap = 10;
    const cardBottom = cardCenterY + cardH / 2;
    const btnY = cardBottom - 23;

    // 버튼 X 좌표: 3개 중앙 정렬
    const btnXPositions = [
      cardCenterX - (btnW + btnGap),   // 일반
      cardCenterX,                      // 하드
      cardCenterX + (btnW + btnGap),   // 나이트메어
    ];

    DIFFICULTY_ORDER.forEach((diffId, i) => {
      const mode = DIFFICULTY_MODES[diffId];
      const isUnlocked = SaveManager.isDifficultyUnlocked(stageData.id, diffId);
      const isActive = this._selectedDifficulty === diffId;
      const bx = btnXPositions[i];

      const btnBg = this.add.graphics();

      if (!isUnlocked) {
        // 잠금: 회색 배경
        btnBg.fillStyle(0x333344, 0.8);
        btnBg.fillRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
      } else if (isActive) {
        // 해금 + 선택: 해당 난이도 color 배경
        btnBg.fillStyle(mode.colorHex, 0.9);
        btnBg.fillRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
      } else {
        // 해금 + 미선택: 투명 배경 + 테두리
        btnBg.fillStyle(0x000000, 0.1);
        btnBg.fillRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
        btnBg.lineStyle(1, mode.colorHex, 0.8);
        btnBg.strokeRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
      }
      this._container.add(btnBg);

      // 버튼 텍스트
      let labelStr = t(mode.labelKey);
      let labelColor = mode.color;

      if (!isUnlocked) {
        labelStr = '\uD83D\uDD12 ' + t(mode.labelKey);
        labelColor = UI_COLORS.textSecondary;
      } else if (isActive) {
        labelColor = '#FFFFFF';
        // 클리어 체크마크
        if (SaveManager.isStageClear(stageData.id, diffId)) {
          labelStr = t(mode.labelKey) + ' \u2713';
        }
      } else {
        // 클리어 체크마크
        if (SaveManager.isStageClear(stageData.id, diffId)) {
          labelStr = t(mode.labelKey) + ' \u2713';
        }
      }

      const btnText = this.add.text(bx, btnY, labelStr, {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: labelColor,
      }).setOrigin(0.5);
      this._container.add(btnText);

      // 인터랙션 (해금된 경우만)
      if (isUnlocked) {
        const zone = this.add.zone(bx, btnY, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        this._container.add(zone);

        zone.on('pointerdown', () => {
          if (this._selectedDifficulty !== diffId) {
            this._selectedDifficulty = diffId;
            SaveManager.setSelectedDifficulty(diffId);
            // 전체 UI 재생성
            this._container.removeAll(true);
            this._renderCards(GAME_WIDTH / 2);
          }
        });
      }
    });

    // ── 보상 정보 텍스트 (선택된 난이도 기준) ──
    const selMode = DIFFICULTY_MODES[this._selectedDifficulty];
    if (selMode && this._selectedDifficulty !== 'normal') {
      const rewardStr = t('difficulty.reward', selMode.creditMult, selMode.dcReward);
      const rewardText = this.add.text(cardCenterX, btnY + btnH / 2 + 6, rewardStr, {
        fontSize: '9px',
        fontFamily: 'Galmuri11, monospace',
        color: selMode.color,
      }).setOrigin(0.5);
      this._container.add(rewardText);
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
