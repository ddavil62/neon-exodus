/**
 * @fileoverview 일일 미션 전용 UI 씬.
 * 미션 카드 3개 + 전체 완료 보너스 + streak 정보 + 리셋 타이머를 표시한다.
 * 360x640 모바일 뷰포트 기준 레이아웃.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { DailyMissionManager } from '../managers/DailyMissionManager.js';
import { DAILY_BONUS_REWARD, STREAK_BONUS, STREAK_CYCLE } from '../data/dailyMissions.js';

// ── 레이아웃 상수 ──

/** 미션 카드 너비 (px) */
const CARD_W = 320;

/** 미션 카드 높이 (px) */
const CARD_H = 100;

/** 미션 카드 간격 (px) */
const CARD_GAP = 10;

/** 미션 카드 시작 Y 좌표 */
const CARD_START_Y = 70;

/** 진행바 너비 (px) */
const PROGRESS_BAR_W = 200;

/** 진행바 높이 (px) */
const PROGRESS_BAR_H = 12;

/** 수령 버튼 너비 (px) */
const BTN_W = 60;

/** 수령 버튼 높이 (px) — 모바일 터치 타겟 36px 기준 */
const BTN_H = 36;

/** 전체 완료 보너스 Y 좌표 */
const BONUS_Y = 420;

// ── DailyMissionScene 클래스 ──

export default class DailyMissionScene extends Phaser.Scene {
  constructor() {
    super('DailyMissionScene');
  }

  /**
   * 씬 UI를 생성한다.
   */
  create() {
    // ── 씬 진입 페이드 ──
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

    const centerX = GAME_WIDTH / 2;

    // 날짜 체크 → 리셋 필요 시 새 미션 생성
    DailyMissionManager.init();

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 타이틀 ──
    this.add.text(centerX, 25, t('daily.title'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 리셋 타이머 ──
    this._timerText = this.add.text(centerX, 48, '', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    this._updateTimerText();

    // ── 미션 카드 3개 ──
    const missions = DailyMissionManager.getCurrentMissions();

    /** @type {Array<Object>} 미션 카드 UI 요소 배열 */
    this._cards = [];

    missions.forEach((mission, i) => {
      this._renderMissionCard(centerX, CARD_START_Y + i * (CARD_H + CARD_GAP), mission, i);
    });

    // ── 전체 완료 보너스 ──
    this._renderBonusPanel(centerX, BONUS_Y, missions);

    // ── streak 정보 ──
    const streak = DailyMissionManager.getStreak();
    const streakStr = t('daily.streak', streak);
    this.add.text(centerX, 490, streakStr, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5);

    // streak 주기 보너스 달성 시 강조
    if (streak > 0 && streak % STREAK_CYCLE === 0) {
      this.add.text(centerX, 510, t('daily.streakBonus', STREAK_CYCLE), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
      }).setOrigin(0.5);
    }

    // ── 뒤로가기 버튼 ──
    this._createButton(centerX, 560, t('daily.back'), UI_COLORS.btnSecondary, () => {
      this._fadeToScene('MenuScene');
    });

    // ── ESC 키로 메뉴 복귀 ──
    this.input.keyboard.on('keydown-ESC', () => {
      this._fadeToScene('MenuScene');
    });
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

  /**
   * 매 프레임 update — 리셋 타이머 갱신 (1초 간격).
   * @param {number} time - 경과 시간
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    // 약 1초마다 타이머 갱신
    if (!this._lastTimerUpdate || time - this._lastTimerUpdate > 1000) {
      this._updateTimerText();
      this._lastTimerUpdate = time;
    }
  }

  // ── 미션 카드 렌더링 ──

  /**
   * 미션 카드 하나를 렌더링한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {number} topY - 카드 상단 Y 좌표
   * @param {Object} mission - 미션 데이터
   * @param {number} index - 미션 인덱스 (0~2)
   * @private
   */
  _renderMissionCard(centerX, topY, mission, index) {
    const cardX = centerX - CARD_W / 2;

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, 0.9);
    bg.fillRoundedRect(cardX, topY, CARD_W, CARD_H, 6);
    bg.lineStyle(1, COLORS.UI_BORDER, 0.6);
    bg.strokeRoundedRect(cardX, topY, CARD_W, CARD_H, 6);

    // 카테고리 라벨
    const catKey = `daily.category.${mission.category || 'kill'}`;
    this.add.text(cardX + 8, topY + 8, t(catKey), {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(0, 0);

    // 미션 이름
    this.add.text(cardX + 8, topY + 22, t(mission.nameKey || mission.id), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0, 0);

    // 미션 설명
    this.add.text(cardX + 8, topY + 38, t(mission.descKey || mission.id), {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0, 0);

    // 진행바
    const barX = cardX + 8;
    const barY = topY + 53;
    const target = mission.target || 1;
    const progress = Math.min(mission.progress || 0, target);
    const ratio = progress / target;

    // 진행바 배경
    const barBg = this.add.graphics();
    barBg.fillStyle(COLORS.UI_BORDER, 0.8);
    barBg.fillRect(barX, barY, PROGRESS_BAR_W, PROGRESS_BAR_H);

    // 진행바 채움
    const barFill = this.add.graphics();
    barFill.fillStyle(mission.completed ? COLORS.NEON_GREEN : COLORS.NEON_CYAN, 0.8);
    barFill.fillRect(barX, barY, PROGRESS_BAR_W * ratio, PROGRESS_BAR_H);

    // 진행 텍스트
    this.add.text(barX + PROGRESS_BAR_W + 6, barY, `${progress}/${target}`, {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0, 0);

    // 보상 텍스트
    const rewardStr = mission.reward
      ? (mission.reward.credits
        ? t('daily.reward.credits', mission.reward.credits)
        : t('daily.reward.dataCores', mission.reward.dataCores))
      : '';
    this.add.text(cardX + 8, topY + CARD_H - 20, rewardStr, {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: mission.reward && mission.reward.dataCores ? UI_COLORS.neonMagenta : UI_COLORS.xpYellow,
    }).setOrigin(0, 0);

    // 수령 버튼
    const btnX = cardX + CARD_W - BTN_W - 8;
    const btnY = topY + CARD_H - BTN_H - 8;

    if (mission.claimed) {
      // 수령 완료
      this._renderSmallButton(btnX, btnY, t('daily.claimed'), UI_COLORS.btnDisabled, null);
    } else if (mission.completed) {
      // 완료 + 미수령
      this._renderSmallButton(btnX, btnY, t('daily.claim'), COLORS.NEON_GREEN, () => {
        DailyMissionManager.claimReward(index);
        this.scene.restart();
      });
    } else {
      // 미완료
      this._renderSmallButton(btnX, btnY, t('daily.incomplete'), UI_COLORS.btnDisabled, null);
    }

    this._cards.push({ mission, index });
  }

  // ── 전체 완료 보너스 ──

  /**
   * 전체 완료 보너스 패널을 렌더링한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {number} y - 패널 상단 Y 좌표
   * @param {Array<Object>} missions - 현재 미션 배열
   * @private
   */
  _renderBonusPanel(centerX, y, missions) {
    const panelW = 320;
    const panelH = 60;
    const panelX = centerX - panelW / 2;

    const allClaimed = missions.length >= 3 && missions.every(m => m.claimed);
    const dm = SaveManager.getDailyMissions();
    const bonusClaimed = dm.bonusClaimed;

    // 패널 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, 0.95);
    bg.fillRoundedRect(panelX, y, panelW, panelH, 8);

    if (allClaimed && !bonusClaimed) {
      bg.lineStyle(2, COLORS.NEON_GREEN, 0.8);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.5);
    }
    bg.strokeRoundedRect(panelX, y, panelW, panelH, 8);

    // 보너스 타이틀
    this.add.text(panelX + 12, y + 10, t('daily.bonus'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0, 0);

    // 보상 텍스트
    const bonusRewardStr = DAILY_BONUS_REWARD.dataCores
      ? t('daily.reward.dataCores', DAILY_BONUS_REWARD.dataCores)
      : t('daily.reward.credits', DAILY_BONUS_REWARD.credits);
    this.add.text(panelX + 12, y + 30, bonusRewardStr, {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(0, 0);

    // 수령/미완료 버튼
    const btnX = panelX + panelW - BTN_W - 12;
    const btnY2 = y + (panelH - BTN_H) / 2;

    if (bonusClaimed) {
      this._renderSmallButton(btnX, btnY2, t('daily.claimed'), UI_COLORS.btnDisabled, null);
    } else if (allClaimed) {
      this._renderSmallButton(btnX, btnY2, t('daily.claim'), COLORS.NEON_GREEN, () => {
        DailyMissionManager.claimBonus();
        this.scene.restart();
      });
    } else {
      this._renderSmallButton(btnX, btnY2, t('daily.incomplete'), UI_COLORS.btnDisabled, null);
    }
  }

  // ── 타이머 ──

  /**
   * 리셋 타이머 텍스트를 갱신한다.
   * @private
   */
  _updateTimerText() {
    const ms = DailyMissionManager.getTimeUntilReset();
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (this._timerText) {
      this._timerText.setText(t('daily.resetIn', timeStr));
    }
  }

  // ── 공통 UI ──

  /**
   * 소형 버튼을 렌더링한다.
   * @param {number} x - 좌상단 X 좌표
   * @param {number} y - 좌상단 Y 좌표
   * @param {string} label - 버튼 텍스트
   * @param {number} color - 배경 색상
   * @param {Function|null} callback - 클릭 콜백 (null이면 비활성)
   * @private
   */
  _renderSmallButton(x, y, label, color, callback) {
    const bg = this.add.graphics();
    bg.fillStyle(color, callback ? 0.8 : 0.4);
    bg.fillRoundedRect(x, y, BTN_W, BTN_H, 4);

    const text = this.add.text(x + BTN_W / 2, y + BTN_H / 2, label, {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: callback ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    if (!callback) return;

    const zone = this.add.zone(x + BTN_W / 2, y + BTN_H / 2, BTN_W, BTN_H)
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

  /**
   * 버튼(사각형 배경 + 텍스트)을 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function} callback - 클릭 콜백
   * @private
   */
  _createButton(x, y, label, bgColor, callback) {
    const btnWidth = 200;
    const btnHeight = 44;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
    bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);

    const text = this.add.text(x, y, label, {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => { text.setAlpha(0.8); });
    zone.on('pointerout', () => { text.setAlpha(1); });
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
