/**
 * @fileoverview 결과/보상 화면 씬.
 *
 * 런 종료 후 승리/패배 결과, 통계, 보상을 표시한다.
 * 다시 도전 또는 메인 메뉴로 이동할 수 있다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS, ADMOB_UNITS, AD_LIMITS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { AchievementManager } from '../managers/AchievementManager.js';
import { MetaManager } from '../managers/MetaManager.js';
import { AdManager } from '../managers/AdManager.js';
import { getWeaponById } from '../data/weapons.js';
import { STAGES } from '../data/stages.js';

// ── ResultScene 클래스 ──

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  /**
   * 초기 데이터를 전달받는다.
   * @param {{ victory: boolean, killCount: number, runTime: number, creditsEarned: number, level: number, weaponSlotsFilled: number, weaponEvolutions: number, stageId: string, newWeaponUnlocked: string|null }} data
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

    /**
     * 무기별 통계 리포트 배열.
     * 각 항목: { id, nameKey, kills, damage, dps }
     * @type {Array<{ id: string, nameKey: string, kills: number, damage: number, dps: number }>}
     */
    this.weaponReport = data.weaponReport || [];

    /** 플레이한 스테이지 ID */
    this.stageId = data.stageId || null;

    /** 이번 런에서 영구 해금된 무기 ID (클리어 시에만 값 존재) */
    this.newWeaponUnlocked = data.newWeaponUnlocked || null;
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

    const title = this.add.text(centerX, 80, t(titleKey), {
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
      y: { from: 50, to: 80 },
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ── 통계 섹션 ──
    const statsY = 160;
    const lineHeight = 26;

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

    // ── 버튼 레이아웃 상수 ──
    /** 버튼 간 간격 (px) */
    const BTN_GAP = 44;
    /**
     * 광고 버튼 중심의 최대 Y 좌표.
     * menuBtn 하단(adBtnY + BTN_GAP*2 + 20) + 8px 여백 <= GAME_HEIGHT 를 만족하는 상한.
     * 계산: 640 - 44*2 - 20 - 8 = 524
     */
    const MAX_AD_BTN_Y = GAME_HEIGHT - BTN_GAP * 2 - 28; // 524
    /** 콘텐츠 끝과 광고버튼 간 최소 여백 (px) */
    const BTN_CONTENT_GAP = 12;
    /** 콘텐츠 압축 최솟값 (텍스트 가독성 유지) */
    const MIN_CONTENT_SCALE = 0.78;

    // ── 콘텐츠 압축 스케일 계산 ──
    // 통계 구간 끝 Y (고정: statsY=160 + lines*26)
    const fixedStatsEnd = 160 + stats.length * 26;
    // 배너 자체 반높이 (고정, 배너 크기는 압축하지 않음)
    const bannerHalf = 16;
    // 허용 스케일 가능 픽셀 = MAX_AD_BTN_Y - BTN_CONTENT_GAP - fixedStatsEnd - bannerHalf
    const scalableTarget = MAX_AD_BTN_Y - BTN_CONTENT_GAP - fixedStatsEnd - bannerHalf;
    const rawScalable = this._calcRawScalable(stats.length);
    /**
     * 레이아웃 압축 배율.
     * rawScalable이 scalableTarget 초과 시 1.0 미만으로 설정된다.
     * MIN_CONTENT_SCALE으로 하한이 보장된다.
     */
    const contentScale = rawScalable > scalableTarget
      ? Math.max(MIN_CONTENT_SCALE, scalableTarget / rawScalable)
      : 1.0;

    // ── 무기별 리포트 섹션 ──
    const weaponReportStartY = statsY + stats.length * lineHeight + 10;
    const weaponReportEndY = this._renderWeaponReport(centerX, weaponReportStartY, stats.length, contentScale);

    // ── 보상 섹션 ──
    const rewardY = weaponReportEndY + Math.round(6 * contentScale);

    // 구분선
    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.UI_BORDER, 0.5);
    divider.lineBetween(centerX - 100, rewardY - 4, centerX + 100, rewardY - 4);

    // 획득 크레딧
    this._creditText = this.add.text(
      centerX, rewardY + 8,
      t('result.creditsEarned', this.creditsEarned),
      {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this._creditText,
      alpha: 1,
      duration: 500,
      delay: 800,
    });

    // 클리어 보너스 (승리 시) -- 크레딧 옆에 인라인 표시
    /** 보상 섹션 끝 Y 좌표 */
    let rewardEndY = rewardY + Math.round(24 * contentScale);
    if (this.victory) {
      const bonusText = this.add.text(
        centerX, rewardY + 28,
        t('result.bonusCredit', 100),
        {
          fontSize: '12px',
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
      rewardEndY = rewardY + Math.round(44 * contentScale);
    }

    // ── 무기 해금 배너 (스테이지 클리어 시) ──
    if (this.newWeaponUnlocked) {
      rewardEndY = this._renderWeaponUnlockBanner(centerX, rewardEndY, contentScale);
    }

    // ── 하단 버튼 Y좌표 동적 계산 ──
    // contentScale 적용으로 contentEndY <= MAX_AD_BTN_Y - BTN_CONTENT_GAP 가 보장된다.
    const contentEndY = rewardEndY + Math.round(20 * contentScale);
    // 콘텐츠 끝 + 여백 기준 배치, 최소 화면 하단 180px 구간 활용, MAX_AD_BTN_Y 상한 적용
    const adBtnY = Math.min(
      Math.max(contentEndY + BTN_CONTENT_GAP, GAME_HEIGHT - 180),
      MAX_AD_BTN_Y
    );
    const retryBtnY = adBtnY + BTN_GAP;
    const menuBtnY = retryBtnY + BTN_GAP;

    // ── 광고 보고 2배 버튼 ──
    this._createAdDoubleButton(centerX, adBtnY, 1000);

    // ── 버튼 ──
    // 다시 도전 버튼
    this._createButton(centerX, retryBtnY, t('result.retry'), UI_COLORS.btnPrimary, () => {
      this.scene.start('GameScene');
    }, 1200);

    // 메인 메뉴 버튼
    this._createButton(centerX, menuBtnY, t('result.toMenu'), UI_COLORS.btnSecondary, () => {
      this.scene.start('MenuScene');
    }, 1400);

    // ── 입력 잠금 플래그 (광고 로딩 중 다른 버튼 차단) ──
    /** @type {boolean} 광고 로딩 중 입력 잠금 여부 */
    this._inputLocked = false;

    // ── ESC 키로 메뉴 복귀 ──
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._inputLocked) return;
      this._onBack();
    });
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('MenuScene');
  }

  // ── 광고 2배 버튼 ──

  /**
   * 크레딧 2배 광고 버튼을 생성한다.
   * 일일 제한에 도달하지 않았으면 활성, 도달했으면 비활성(회색) 상태로 표시한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {number} delay - 등장 딜레이 (ms)
   * @private
   */
  _createAdDoubleButton(x, y, delay) {
    const btnWidth = 200;
    const btnHeight = 36;
    const limitReached = AdManager.isAdLimitReached('creditDouble');
    const remaining = AdManager.getRemainingAdCount('creditDouble');
    const limit = AD_LIMITS.creditDouble;
    const used = limit - remaining;

    // 버튼 배경
    this._adBtnBg = this.add.graphics();
    const bgColor = limitReached ? UI_COLORS.btnDisabled : COLORS.NEON_ORANGE;
    this._adBtnBg.fillStyle(bgColor, 0.8);
    this._adBtnBg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    this._adBtnBg.lineStyle(1, COLORS.NEON_CYAN, 0.3);
    this._adBtnBg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6);
    this._adBtnBg.setAlpha(0);

    // 버튼 텍스트
    const labelText = limitReached
      ? `${t('ad.creditDouble')} ${t('ad.creditDoubleUsed')}`
      : `${t('ad.creditDouble')} ${t('ad.creditDoubleCount', used, limit)}`;

    this._adBtnText = this.add.text(x, y, labelText, {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: limitReached ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
    }).setOrigin(0.5).setAlpha(0);

    // 등장 애니메이션
    this.tweens.add({
      targets: [this._adBtnBg, this._adBtnText],
      alpha: 1,
      duration: 400,
      delay: delay,
    });

    // 비활성 상태면 인터랙션 없음
    if (limitReached || this.creditsEarned <= 0) return;

    // 터치 영역
    const zone = this.add.zone(x, y, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    /** @type {boolean} 광고 사용 완료 여부 */
    this._adUsed = false;

    let pressed = false;
    zone.on('pointerdown', () => {
      if (this._adUsed) return;
      pressed = true;
      this._adBtnText.setAlpha(0.6);
    });
    zone.on('pointerup', async () => {
      this._adBtnText.setAlpha(1);
      if (!pressed || this._adUsed || this._inputLocked) return;
      pressed = false;

      // 광고 로딩 중 전체 입력 잠금
      this._inputLocked = true;

      // 광고 시청
      const result = await AdManager.showRewarded(ADMOB_UNITS.creditDouble);
      if (result.rewarded) {
        // 크레딧 2배 지급 (원래 지급분 + 동일량 추가)
        SaveManager.addCredits(this.creditsEarned);
        AdManager.incrementDailyAdCount('creditDouble');

        // 크레딧 텍스트 갱신 (2배 금액)
        const doubledCredits = this.creditsEarned * 2;
        this._creditText.setText(t('result.creditsEarned', doubledCredits));

        // 버튼 비활성화
        this._adUsed = true;
        this._adBtnBg.clear();
        this._adBtnBg.fillStyle(UI_COLORS.btnDisabled, 0.8);
        this._adBtnBg.fillRoundedRect(
          x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 6
        );
        this._adBtnText.setText(
          `${t('ad.creditDouble')} ${t('ad.creditDoubleUsed')}`
        );
        this._adBtnText.setColor(UI_COLORS.textSecondary);
        zone.disableInteractive();
      } else if (result.error !== 'busy') {
        // 광고 로드/표시 실패 — 안내 메시지 표시 (2.5초 후 자동 제거)
        this._adBtnText.setText(t('ad.loadFailed'));
        this._adBtnText.setColor(UI_COLORS.hpRed);
        this.time.delayedCall(2500, () => {
          if (this._adUsed) return;
          const remaining = AdManager.getRemainingAdCount('creditDouble');
          const used = AD_LIMITS.creditDouble - remaining;
          this._adBtnText.setText(
            `${t('ad.creditDouble')} ${t('ad.creditDoubleCount', used, AD_LIMITS.creditDouble)}`
          );
          this._adBtnText.setColor(UI_COLORS.textPrimary);
        });
      }

      // 광고 완료 후 입력 잠금 해제
      this._inputLocked = false;
    });
    zone.on('pointerout', () => {
      pressed = false;
      if (!this._adUsed) this._adBtnText.setAlpha(1);
    });
  }

  // ── 콘텐츠 스케일 계산 ──

  /**
   * scale=1.0 기준 콘텐츠의 스케일 가능한 구간 픽셀 합계를 계산한다.
   * create()에서 contentScale을 결정하기 위해 실제 렌더링 전에 호출한다.
   * 통계 구간(fixedStatsEnd)과 배너 자체 반높이(16px)는 고정값이므로 제외한다.
   * @param {number} statsCount - 통계 항목 수
   * @returns {number} 스케일 가능한 총 픽셀
   * @private
   */
  _calcRawScalable(statsCount) {
    const totalWeapons = this.weaponReport ? this.weaponReport.length : 0;
    const rowHeight = totalWeapons > 6 ? 22 : 28;
    const displayCount = Math.min(totalWeapons, 10);
    // 무기 리포트: stat_gap + title + gap + rows + trail
    const weaponSection = totalWeapons > 0
      ? (10 + 12 + 18 + displayCount * rowHeight + 4)
      : 10;
    // 보상 구간: reward_gap + height
    const rewardSection = this.victory ? (6 + 44) : (6 + 24);
    // 해금 배너 구간 (있을 때만)
    let bannerSection = 0;
    if (this.newWeaponUnlocked) {
      const stageData = this.stageId ? STAGES[this.stageId] : null;
      bannerSection = stageData ? (8 + 32 + 20) : (8 + 20);
    }
    return weaponSection + rewardSection + bannerSection;
  }

  // ── 무기별 리포트 렌더링 ──

  /**
   * 무기별 통계 리포트를 렌더링한다.
   * 각 무기의 킬 수, 총 데미지, DPS, 데미지 비율 바를 표시한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {number} startY - 시작 Y 좌표
   * @param {number} statsCount - 상단 통계 항목 수 (애니메이션 딜레이 계산용)
   * @param {number} [scale=1.0] - 레이아웃 압축 배율 (간격·행높이에 적용)
   * @returns {number} 렌더링 후 다음 Y 좌표
   * @private
   */
  _renderWeaponReport(centerX, startY, statsCount, scale = 1.0) {
    if (!this.weaponReport || this.weaponReport.length === 0) {
      return startY;
    }

    // 구분선
    const divGfx = this.add.graphics();
    divGfx.lineStyle(1, COLORS.UI_BORDER, 0.4);
    divGfx.lineBetween(centerX - 100, startY, centerX + 100, startY);

    // 섹션 타이틀
    const titleY = startY + Math.round(12 * scale);
    const sectionTitle = this.add.text(centerX, titleY, t('result.weaponReport'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setAlpha(0);

    const baseDelay = 300 + statsCount * 150;
    this.tweens.add({
      targets: sectionTitle,
      alpha: 1,
      duration: 300,
      delay: baseDelay,
    });

    // 총 데미지 합산 (비율 바 계산용)
    const maxDamage = Math.max(1, ...this.weaponReport.map(w => w.damage));

    // 무기 수에 따라 표시 개수·행 높이를 동적으로 조절 (최대 10개 수용)
    const totalWeapons = this.weaponReport.length;
    const maxDisplay = Math.min(totalWeapons, 10);
    const displayWeapons = this.weaponReport.slice(0, maxDisplay);

    let curY = titleY + Math.round(18 * scale);
    const rowHeight = Math.round((totalWeapons > 6 ? 22 : 28) * scale);
    const barWidth = 160;
    const barHeight = 6;
    const leftX = centerX - 110;

    displayWeapons.forEach((weapon, idx) => {
      const rowDelay = baseDelay + 100 + idx * 100;
      const rowY = curY + idx * rowHeight;

      // 무기 이름
      const nameText = this.add.text(leftX, rowY, t(weapon.nameKey), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      }).setOrigin(0, 0).setAlpha(0);

      // 킬 수 / DPS 텍스트 (오른쪽)
      const infoStr = t('result.weaponKills', weapon.kills) + '  ' + t('result.weaponDps', weapon.dps);
      const infoText = this.add.text(centerX + 110, rowY, infoStr, {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setOrigin(1, 0).setAlpha(0);

      // 데미지 비율 바 배경
      const barY = rowY + 14;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x333333, 0.6);
      barBg.fillRect(leftX, barY, barWidth, barHeight);
      barBg.setAlpha(0);

      // 데미지 비율 바 (채움)
      const damageRatio = weapon.damage / maxDamage;
      const barFill = this.add.graphics();
      barFill.fillStyle(COLORS.NEON_CYAN, 0.8);
      barFill.fillRect(leftX, barY, barWidth * damageRatio, barHeight);
      barFill.setAlpha(0);

      // 데미지 수치 텍스트 (바 오른쪽)
      const dmgText = this.add.text(
        leftX + barWidth + 6, barY - 1,
        this._formatNumber(weapon.damage),
        {
          fontSize: '10px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonOrange,
        }
      ).setOrigin(0, 0).setAlpha(0);

      // 등장 애니메이션
      this.tweens.add({
        targets: [nameText, infoText, barBg, barFill, dmgText],
        alpha: 1,
        duration: 300,
        delay: rowDelay,
      });
    });

    return curY + displayWeapons.length * rowHeight + Math.round(4 * scale);
  }

  // ── 무기 해금 배너 ──

  /**
   * 스테이지 클리어 시 무기 해금 배너를 렌더링한다.
   * 네온 시안 글로우 텍스트로 해금된 무기명을 표시한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {number} startY - 시작 Y 좌표
   * @param {number} [scale=1.0] - 레이아웃 압축 배율 (Y 오프셋에 적용)
   * @returns {number} 렌더링 후 다음 Y 좌표
   * @private
   */
  _renderWeaponUnlockBanner(centerX, startY, scale = 1.0) {
    const weaponData = getWeaponById(this.newWeaponUnlocked);
    const weaponName = weaponData ? t(weaponData.nameKey) : this.newWeaponUnlocked;

    // 스테이지 클리어 텍스트
    const stageData = this.stageId ? STAGES[this.stageId] : null;
    if (stageData) {
      const stageName = t(stageData.nameKey);
      const clearText = this.add.text(centerX, startY + Math.round(8 * scale), t('result.stageCleared', stageName), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: clearText,
        alpha: 1,
        duration: 500,
        delay: 1100,
      });
    }

    // 무기 해금 배너 배경 (네온 글로우 효과)
    const bannerY = startY + Math.round((stageData ? 32 : 8) * scale);
    const bannerWidth = 220;
    const bannerHeight = 32;

    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(COLORS.NEON_CYAN, 0.15);
    bannerBg.fillRoundedRect(
      centerX - bannerWidth / 2, bannerY - bannerHeight / 2,
      bannerWidth, bannerHeight, 6
    );
    bannerBg.lineStyle(2, COLORS.NEON_CYAN, 0.8);
    bannerBg.strokeRoundedRect(
      centerX - bannerWidth / 2, bannerY - bannerHeight / 2,
      bannerWidth, bannerHeight, 6
    );
    bannerBg.setAlpha(0);

    // 무기 해금 텍스트 (네온 시안 + 글로우)
    const unlockText = this.add.text(
      centerX, bannerY,
      t('result.weaponUnlock', weaponName),
      {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
        stroke: UI_COLORS.neonCyan,
        strokeThickness: 1,
      }
    ).setOrigin(0.5).setAlpha(0);

    // 등장 애니메이션 + 글로우 펄스
    this.tweens.add({
      targets: [bannerBg, unlockText],
      alpha: 1,
      duration: 600,
      delay: 1200,
      ease: 'Back.easeOut',
    });

    // 글로우 펄스 (배너 테두리 깜빡임)
    this.tweens.add({
      targets: bannerBg,
      alpha: { from: 0.7, to: 1 },
      duration: 800,
      delay: 1800,
      yoyo: true,
      repeat: 2,
    });

    return bannerY + bannerHeight / 2 + Math.round(20 * scale);
  }

  /**
   * 숫자를 읽기 쉬운 형식으로 변환한다 (1000 이상이면 K 단위).
   * @param {number} num - 숫자
   * @returns {string} 포맷된 문자열
   * @private
   */
  _formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return String(num);
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

    let pressed = false;
    zone.on('pointerdown', () => {
      if (this._inputLocked) return;
      pressed = true;
      text.setAlpha(0.6);
    });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (pressed && callback && !this._inputLocked) callback();
      pressed = false;
    });
    zone.on('pointerout', () => { pressed = false; text.setAlpha(1); });
  }
}
