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
import { DailyMissionManager } from '../managers/DailyMissionManager.js';
import { MetaManager } from '../managers/MetaManager.js';
import { AdManager } from '../managers/AdManager.js';
import { getWeaponById } from '../data/weapons.js';
import { STAGES, DIFFICULTY_MODES, DC_REWARD_BASE, STAGE_DC_BONUS } from '../data/stages.js';
import { CHARACTERS } from '../data/characters.js';
import { CHARACTER_COLORS, getXpForNextLevel, MAX_CHAR_LEVEL } from '../data/characterSkills.js';
import { createNineSliceButton } from '../ui/NineSliceButton.js';

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

    /** 사용 캐릭터 ID */
    this.characterId = data.characterId || 'agent';

    /** 최대 무피격 연속 시간 (초) */
    this.maxNoDamageStreak = data.maxNoDamageStreak || 0;

    /** 총 피격 횟수 */
    this.totalHitsTaken = data.totalHitsTaken || 0;

    /** 런 종료 시 HP 비율 (0~1) */
    this.finalHpPercent = data.finalHpPercent !== undefined ? data.finalHpPercent : 1;

    /** 플레이한 난이도 */
    this.difficulty = data.difficulty || 'normal';

    /** 피격 여부 */
    this.tookDamage = data.tookDamage || false;

    /** 보스 처치 수 */
    this.bossKills = data.bossKills || 0;

    /** 미니보스 처치 수 */
    this.minibossKills = data.minibossKills || 0;

    /** 소모품 사용 수 */
    this.consumablesUsed = data.consumablesUsed || 0;

    /** 궁극기 사용 수 */
    this.ultimateUses = data.ultimateUses || 0;

    /** 만렙 무기 수 */
    this.maxedWeapons = data.maxedWeapons || 0;

    /** 패시브 보유 수 */
    this.passiveCount = data.passiveCount || 0;
  }

  /**
   * 결과 화면 UI를 생성한다.
   */
  create() {
    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

    const centerX = GAME_WIDTH / 2;

    // ── 1페이지 요소 저장 배열 (2페이지 전환 시 숨김/표시) ──
    /** @type {Phaser.GameObjects.GameObject[]} */
    this._page1Elements = [];

    // ── SaveManager 크레딧/통계 저장 (난이도 배율 적용) ──
    const creditMult = DIFFICULTY_MODES[this.difficulty]?.creditMult || 1.0;
    /** @type {number} 난이도 배율 적용 후 크레딧 */
    this._adjustedCredits = Math.floor(this.creditsEarned * creditMult);
    const adjustedCredits = this._adjustedCredits;
    SaveManager.addCredits(adjustedCredits);

    // 데이터코어 보상 — 승리 시에만 지급, 스테이지/난이도별 보너스 가산
    const dcReward = this.victory
      ? DC_REWARD_BASE + (STAGE_DC_BONUS[this.stageId] || 0) + (DIFFICULTY_MODES[this.difficulty]?.dcBonus || 0)
      : 0;
    if (dcReward > 0) SaveManager.addDataCores(dcReward);

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

    // 총 플레이 시간 누적 (초 단위)
    SaveManager.updateStats('totalPlayTime', this.runTime);

    if (this.victory) {
      SaveManager.updateStats('totalClears', 1);
      // 연속 클리어 갱신 (현재 값 + 1)
      const currentConsecutive = (SaveManager.getStats().consecutiveClears || 0) + 1;
      const data = SaveManager.getData();
      data.stats.consecutiveClears = currentConsecutive;
      SaveManager.save();

      // 캐릭터별 클리어 기록
      SaveManager.addCharacterClear(this.characterId);
    } else {
      // 패배 시 연속 클리어 초기화
      const data = SaveManager.getData();
      data.stats.consecutiveClears = 0;
      SaveManager.save();
    }

    // lowHpClear 판정: 클리어 시 HP 10% 이하
    const isLowHpClear = this.victory && this.finalHpPercent <= 0.10;

    // noDamageRun 판정: 클리어 + 피격 0회
    const isNoDamageRun = this.victory && this.totalHitsTaken === 0;

    // ── AchievementManager 도전과제 체크 ──
    const savedStats = SaveManager.getStats();
    AchievementManager.checkAll(savedStats, {
      weaponSlotsFilled: this.weaponSlotsFilled,
      weaponEvolutions: this.weaponEvolutions,
      allUpgradesMaxed: MetaManager.areAllMaxed(),
      lowHpClear: isLowHpClear,
      maxNoDamageStreak: this.maxNoDamageStreak,
      noDamageRun: isNoDamageRun,
      characterId: this.characterId,
      stageId: this.stageId,
      victory: this.victory,
      difficulty: this.difficulty,
      tookDamage: this.tookDamage,
    });

    // ── 일일 미션 진행도 갱신 ──
    const newlyCompletedMissions = DailyMissionManager.updateProgress({
      killCount: this.killCount,
      bossKills: this.bossKills,
      minibossKills: this.minibossKills,
      runTime: this.runTime,
      victory: this.victory,
      creditsEarned: adjustedCredits,
      level: this.playerLevel,
      consumablesUsed: this.consumablesUsed,
      weaponSlotsFilled: this.weaponSlotsFilled,
      weaponEvolutions: this.weaponEvolutions,
      maxedWeapons: this.maxedWeapons,
      passiveCount: this.passiveCount,
      maxNoDamageStreak: this.maxNoDamageStreak,
      ultimateUses: this.ultimateUses,
      difficulty: this.difficulty,
      characterId: this.characterId,
      dcReward: dcReward,
    });

    // 새로 완료된 일일 미션 알림
    if (newlyCompletedMissions && newlyCompletedMissions.length > 0) {
      this._dailyMissionCompleted = newlyCompletedMissions;
    }

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 승리/패배 타이틀 (AI 생성 텍스트 이미지) ──
    const titleTexture = this.isEndless
      ? 'text_endless'
      : (this.victory ? 'text_victory' : 'text_defeated');

    let title;
    if (titleTexture && this.textures.exists(titleTexture)) {
      title = this.add.image(centerX, 80, titleTexture)
        .setOrigin(0.5).setScale(0.5).setAlpha(0);
    } else {
      // 폴백: 엔드리스 또는 이미지 미존재 시 텍스트
      let titleKey = this.victory ? 'result.victory' : 'result.defeat';
      if (this.isEndless) titleKey = 'result.endlessOver';
      const titleColor = this.victory ? UI_COLORS.neonGreen : UI_COLORS.hpRed;
      title = this.add.text(centerX, 80, t(titleKey), {
        fontSize: '32px',
        fontFamily: 'Galmuri11, monospace',
        color: titleColor,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
    }
    this._page1Elements.push(title);

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
      this._page1Elements.push(statText);

      this.tweens.add({
        targets: statText,
        alpha: 1,
        y: { from: statsY + i * lineHeight + 20, to: statsY + i * lineHeight },
        duration: 400,
        delay: 300 + i * 150,
      });
    });

    // ── 보상 섹션 (무기 리포트 없이 바로 배치) ──
    const rewardY = statsY + stats.length * lineHeight + 20;

    // 구분선
    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.UI_BORDER, 0.5);
    divider.lineBetween(centerX - 100, rewardY - 4, centerX + 100, rewardY - 4);
    this._page1Elements.push(divider);

    // 획득 크레딧 (난이도 배율 적용 시 배율 표시)
    const creditDisplayStr = creditMult > 1.0
      ? t('result.creditMult', adjustedCredits, creditMult)
      : t('result.creditsEarned', adjustedCredits);

    this._creditText = this.add.text(
      centerX, rewardY + 8,
      creditDisplayStr,
      {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }
    ).setOrigin(0.5).setAlpha(0);
    this._page1Elements.push(this._creditText);

    this.tweens.add({
      targets: this._creditText,
      alpha: 1,
      duration: 500,
      delay: 800,
    });

    // 데이터코어 보상 표시
    const dcText = this.add.text(
      centerX, rewardY + 26,
      t('result.dataCores', dcReward),
      {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }
    ).setOrigin(0.5).setAlpha(0);
    this._page1Elements.push(dcText);

    this.tweens.add({
      targets: dcText,
      alpha: 1,
      duration: 500,
      delay: 900,
    });

    // 클리어 보너스 (승리 시)
    let rewardEndY = rewardY + 42;
    if (this.victory) {
      const bonusText = this.add.text(
        centerX, rewardY + 44,
        t('result.bonusCredit', 100),
        {
          fontSize: '12px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonMagenta,
        }
      ).setOrigin(0.5).setAlpha(0);
      this._page1Elements.push(bonusText);

      this.tweens.add({
        targets: bonusText,
        alpha: 1,
        duration: 500,
        delay: 1000,
      });
      rewardEndY = rewardY + 60;
    }

    // ── 무기 해금 배너 (스테이지 클리어 시) ──
    if (this.newWeaponUnlocked) {
      rewardEndY = this._renderWeaponUnlockBanner(centerX, rewardEndY);
    }

    // ── 무기 리포트 탭 버튼 ──
    if (this.weaponReport && this.weaponReport.length > 0) {
      const tabY = rewardEndY + 20;
      this._createReportTabButton(centerX, tabY);
      rewardEndY = tabY + 20;
    }

    // ── 하단 버튼 Y좌표 ──
    const BTN_GAP = 44;
    const adBtnY = Math.max(rewardEndY + 16, GAME_HEIGHT - 180);
    const retryBtnY = adBtnY + BTN_GAP;
    const menuBtnY = retryBtnY + BTN_GAP;

    // ── 광고 보고 2배 버튼 ──
    this._createAdDoubleButton(centerX, adBtnY, 1000);

    // ── 버튼 (NineSlice) ──
    // 다시 도전 버튼
    const retryBtn = createNineSliceButton(this, centerX, retryBtnY, t('result.retry'), {
      width: 180, height: 40, fontSize: '14px',
      frameType: 'retry',
      callback: () => {
        this._fadeToScene('GameScene', {
          stageId: this.stageId,
          characterId: this.characterId,
          difficulty: this.difficulty,
        });
      },
    });
    retryBtn.bg.setAlpha(0); retryBtn.text.setAlpha(0);
    this.tweens.add({ targets: [retryBtn.bg, retryBtn.text], alpha: 1, duration: 400, delay: 1200 });

    // 메인 메뉴 버튼 — 클리어 컷신 미시청 시 컷신 재생 후 메뉴로
    const menuBtn = createNineSliceButton(this, centerX, menuBtnY, t('result.toMenu'), {
      width: 180, height: 40, fontSize: '14px',
      frameType: 'menu',
      callback: () => { this._goToMenu(); },
    });
    menuBtn.bg.setAlpha(0); menuBtn.text.setAlpha(0);
    this.tweens.add({ targets: [menuBtn.bg, menuBtn.text], alpha: 1, duration: 400, delay: 1400 });

    // ── 컷신 판정 (upgrade_unlock > drone_unlock > 클리어 컷신 순) ──
    /** @type {string|null} 대기 중인 컷신 ID */
    this._pendingCutscene = null;

    // 1스테이지 첫 도전 종료 시 연구소 해금 컷신 (클리어/사망 무관)
    if (this.stageId === 'stage_1' && !SaveManager.isCutsceneViewed('upgrade_unlock')) {
      this._pendingCutscene = 'upgrade_unlock';
      // 컷신 발동 전에 해금 상태를 먼저 저장 (컷신 후 메뉴에서 버튼 표시)
      SaveManager.setUpgradeUnlocked();
    // 2스테이지 첫 도전 종료 시 드론 해금 컷신 (클리어/사망 무관)
    } else if (this.stageId === 'stage_2' && !SaveManager.isCutsceneViewed('drone_unlock')) {
      this._pendingCutscene = 'drone_unlock';
      SaveManager.setDroneUnlocked();
    // 3스테이지 첫 도전 종료 시 드론 칩 해금 컷신 (클리어/사망 무관)
    } else if (this.stageId === 'stage_3' && !SaveManager.isCutsceneViewed('drone_chip_unlock')) {
      this._pendingCutscene = 'drone_chip_unlock';
      SaveManager.setDroneChipUnlocked();
    } else if (this.victory && this.stageId) {
      // 클리어 컷신 판정
      const stageNum = this.stageId.replace('stage_', '');
      const clearId = `stage_${stageNum}_clear`;
      if (!SaveManager.isCutsceneViewed(clearId)) {
        this._pendingCutscene = clearId;
      }
    }

    // ── 입력 잠금 플래그 (광고 로딩 중 다른 버튼 차단) ──
    /** @type {boolean} 광고 로딩 중 입력 잠금 여부 */
    this._inputLocked = false;

    // ── DC 자동 분배 (플레이한 캐릭터에게 투입) ──
    if (dcReward > 0) {
      const levelUps = SaveManager.addCharacterXP(this.characterId, dcReward);
      SaveManager.addCharacterDcEarned(this.characterId, dcReward);
      this._autoLevelUps = levelUps;

      // 도전과제 재체크 (캐릭터 레벨 업적)
      const savedStats2 = SaveManager.getStats();
      AchievementManager.checkAll(savedStats2, {
        characterId: this.characterId,
        victory: this.victory,
      });

      this.time.delayedCall(1500, () => {
        this._showAutoDistributionUI(dcReward, this._autoLevelUps);
      });
    }

    // ── 일일 미션 완료 알림 표시 ──
    if (this._dailyMissionCompleted && this._dailyMissionCompleted.length > 0) {
      const missionText = this.add.text(
        centerX, 40,
        t('daily.missionComplete'),
        {
          fontSize: '14px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonGreen,
          stroke: '#000000',
          strokeThickness: 2,
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(200);

      this.tweens.add({
        targets: missionText,
        alpha: 1,
        duration: 400,
        delay: 1500,
        onComplete: () => {
          this.tweens.add({
            targets: missionText,
            alpha: 0,
            duration: 500,
            delay: 2000,
            onComplete: () => missionText.destroy(),
          });
        },
      });
    }

    // ── ESC 키로 메뉴 복귀 ──
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._inputLocked) return;
      this._onBack();
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
   * 메뉴로 이동한다. 대기 중인 클리어 컷신이 있으면 먼저 재생한다.
   * @private
   */
  _goToMenu() {
    if (this._pendingCutscene) {
      this._fadeToScene('CutsceneScene', {
        cutsceneId: this._pendingCutscene,
        nextScene: 'MenuScene',
        nextSceneData: {},
      });
      return;
    }
    this._fadeToScene('MenuScene');
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this._goToMenu();
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

    // 버튼 배경 (NineSlice 앰버 프레임)
    const adSlice = { texture: 'ui_btn_ad', left: 16, right: 16, top: 14, bottom: 14 };
    this._adBtnBg = this.add.nineslice(
      x, y, adSlice.texture, null,
      btnWidth, btnHeight,
      adSlice.left, adSlice.right, adSlice.top, adSlice.bottom
    ).setOrigin(0.5).setAlpha(0);
    if (limitReached) {
      this._adBtnBg.setTint(0x333344);
      this._adBtnBg.setAlpha(0);
    }

    // 버튼 텍스트
    const labelText = limitReached
      ? `${t('ad.creditDouble')} ${t('ad.creditDoubleUsed')}`
      : `${t('ad.creditDouble')} ${t('ad.creditDoubleCount', remaining, limit)}`;

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

    // 페이지 전환 시 숨기기 위해 추적
    if (this._page1Elements) {
      this._page1Elements.push(this._adBtnBg, this._adBtnText);
    }

    // 비활성 상태면 인터랙션 없음
    if (limitReached || (this._adjustedCredits || this.creditsEarned) <= 0) return;

    // 터치 영역
    const zone = this.add.zone(x, y, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    /** @type {boolean} 광고 사용 완료 여부 */
    this._adUsed = false;
    if (this._page1Elements) this._page1Elements.push(zone);

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
        // 크레딧 2배 지급 (난이도 배율 적용 후 금액 + 동일량 추가)
        const adCredits = this._adjustedCredits || this.creditsEarned;
        SaveManager.addCredits(adCredits);
        AdManager.incrementDailyAdCount('creditDouble');

        // 크레딧 텍스트 갱신 (2배 금액)
        const doubledCredits = adCredits * 2;
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

  // ── 무기 리포트 탭 버튼 ──

  /**
   * "무기 리포트 ▶" 탭 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createReportTabButton(x, y) {
    const btnW = 180;
    const btnH = 32;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, 0.8);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
    this._page1Elements.push(bg);

    const text = this.add.text(x, y, t('result.viewReport'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);
    this._page1Elements.push(text);

    const zone = this.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });
    this._page1Elements.push(zone);

    zone.on('pointerdown', () => {
      this._showWeaponReportPage();
    });
  }

  // ── 2페이지: 무기 리포트 ──

  /**
   * 무기 리포트 페이지를 표시한다. 1페이지 요소를 숨기고 전체 화면으로 렌더링.
   * @private
   */
  _showWeaponReportPage() {
    // 1페이지 숨기기 (인터랙티브 비활성화 포함)
    this._page1Elements.forEach(el => {
      if (el && el.setVisible) el.setVisible(false);
      if (el && el.disableInteractive) el.disableInteractive();
    });

    const centerX = GAME_WIDTH / 2;
    /** @type {Phaser.GameObjects.GameObject[]} */
    this._page2Elements = [];

    // 섹션 타이틀
    const titleText = this.add.text(centerX, 60, t('result.weaponReport'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);
    this._page2Elements.push(titleText);

    // 구분선
    const div = this.add.graphics();
    div.lineStyle(1, COLORS.UI_BORDER, 0.4);
    div.lineBetween(centerX - 120, 80, centerX + 120, 80);
    this._page2Elements.push(div);

    // 총 데미지 합산
    const maxDamage = Math.max(1, ...this.weaponReport.map(w => w.damage));
    const totalDamage = Math.max(1, this.weaponReport.reduce((sum, w) => sum + w.damage, 0));
    const displayWeapons = this.weaponReport.slice(0, 10);

    // 무기 수에 따라 행 높이 조절
    const rowHeight = displayWeapons.length > 7 ? 48 : 56;
    let curY = 96;
    const barWidth = 220;
    const barHeight = 8;
    const leftX = centerX - 130;

    displayWeapons.forEach((weapon, idx) => {
      const rowY = curY + idx * rowHeight;

      // 진화 무기 마커
      const isEvolved = weapon.evolved;
      const namePrefix = isEvolved ? '★ ' : '';
      const nameColor = isEvolved ? UI_COLORS.neonMagenta : UI_COLORS.textPrimary;
      const barColor = isEvolved ? 0xFF00FF : COLORS.NEON_CYAN;

      // 줄 1: 무기 이름 (좌) + 킬/DPS/% (우)
      const nameText = this.add.text(leftX, rowY, namePrefix + t(weapon.nameKey), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: nameColor,
        wordWrap: { width: 140 },
        maxLines: 1,
      }).setOrigin(0, 0);
      this._page2Elements.push(nameText);

      const pct = Math.round((weapon.damage / totalDamage) * 100);
      const infoStr = t('result.weaponKills', weapon.kills) + '  ' + t('result.weaponDps', weapon.dps) + '  ' + pct + '%';
      const infoText = this.add.text(centerX + 130, rowY, infoStr, {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setOrigin(1, 0);
      this._page2Elements.push(infoText);

      // 줄 2: 데미지 바 + 수치
      const barY = rowY + 18;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x333333, 0.6);
      barBg.fillRect(leftX, barY, barWidth, barHeight);
      this._page2Elements.push(barBg);

      const damageRatio = weapon.damage / maxDamage;
      const barFill = this.add.graphics();
      barFill.fillStyle(barColor, 0.8);
      barFill.fillRect(leftX, barY, barWidth * damageRatio, barHeight);
      this._page2Elements.push(barFill);

      const dmgText = this.add.text(leftX + barWidth + 6, barY - 2, this._formatNumber(weapon.damage), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
      }).setOrigin(0, 0);
      this._page2Elements.push(dmgText);
    });

    // 돌아가기 버튼
    const backY = Math.min(curY + displayWeapons.length * rowHeight + 20, GAME_HEIGHT - 40);
    const backBtnW = 160;
    const backBtnH = 36;

    const backBg = this.add.graphics();
    backBg.fillStyle(UI_COLORS.btnSecondary, 0.8);
    backBg.fillRoundedRect(centerX - backBtnW / 2, backY - backBtnH / 2, backBtnW, backBtnH, 6);
    backBg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    backBg.strokeRoundedRect(centerX - backBtnW / 2, backY - backBtnH / 2, backBtnW, backBtnH, 6);
    this._page2Elements.push(backBg);

    const backText = this.add.text(centerX, backY, t('result.backToResult'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);
    this._page2Elements.push(backText);

    const backZone = this.add.zone(centerX, backY, backBtnW, backBtnH).setInteractive({ useHandCursor: true });
    this._page2Elements.push(backZone);

    backZone.on('pointerdown', () => {
      this._hideWeaponReportPage();
    });
  }

  /**
   * 무기 리포트 페이지를 닫고 1페이지로 복귀한다.
   * @private
   */
  _hideWeaponReportPage() {
    if (this._page2Elements) {
      this._page2Elements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._page2Elements = null;
    }
    // 1페이지 복원 (인터랙티브 재활성화 포함)
    this._page1Elements.forEach(el => {
      if (el && el.setVisible) el.setVisible(true);
      if (el && el.input && el.setInteractive) el.setInteractive();
    });
  }

  // ── 무기 해금 배너 ──

  /**
   * 스테이지 클리어 시 무기 해금 배너를 렌더링한다.
   * 네온 시안 글로우 텍스트로 해금된 무기명을 표시한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {number} startY - 시작 Y 좌표
   * @returns {number} 렌더링 후 다음 Y 좌표
   * @private
   */
  _renderWeaponUnlockBanner(centerX, startY) {
    const scale = 1.0;
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
      if (this._page1Elements) this._page1Elements.push(clearText);

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
    if (this._page1Elements) this._page1Elements.push(bannerBg, unlockText);

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

  // ── DC 자동 분배 연출 ──

  /**
   * DC 자동 분배 결과를 표시하는 패널.
   * 플레이한 캐릭터에게 자동으로 DC가 투입된 결과를 보여준다.
   * @param {number} dcReward - 투입 DC 양
   * @param {number} levelUps - 발생한 레벨업 횟수
   * @private
   */
  _showAutoDistributionUI(dcReward, levelUps) {
    const centerX = GAME_WIDTH / 2;
    const panelW = 280;
    const panelH = levelUps > 0 ? 148 : 98;
    const panelX = centerX - panelW / 2;
    const panelY = 200;

    /** @type {Array} 자동 분배 UI 요소 */
    this._autoDistElements = [];

    // 반투명 오버레이
    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this._autoDistElements.push(overlay);

    // 탭으로 닫기 zone
    const closeZone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setDepth(301).setInteractive();
    closeZone.on('pointerdown', () => this._closeAutoDistribution());
    this._autoDistElements.push(closeZone);

    // 패널 배경
    const panel = this.add.graphics().setDepth(302);
    panel.fillStyle(COLORS.UI_PANEL, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panel.lineStyle(2, COLORS.NEON_CYAN, 0.6);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    this._autoDistElements.push(panel);

    // 제목
    const titleText = this.add.text(centerX, panelY + 20, t('charLevel.autoTitle'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setDepth(303);
    this._autoDistElements.push(titleText);

    // 캐릭터명 + DC 투입
    const charData = CHARACTERS.find(c => c.id === this.characterId);
    const nameStr = charData ? t(charData.nameKey) : this.characterId;
    const charColor = CHARACTER_COLORS[this.characterId] || COLORS.NEON_CYAN;
    const charColorStr = '#' + charColor.toString(16).padStart(6, '0');

    const charText = this.add.text(centerX, panelY + 50, `${nameStr}  +${dcReward} DC`, {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: charColorStr,
    }).setOrigin(0.5).setDepth(303);
    this._autoDistElements.push(charText);

    // XP 바
    const newProg = SaveManager.getCharacterProgression(this.characterId);
    const barX = centerX - 110;
    const barW = 220;
    const barH = 8;
    const barY = panelY + 70;
    const needed = getXpForNextLevel(newProg.level);
    const xpRatio = needed > 0 ? Math.min(1, newProg.xp / needed) : 1;

    const barBg = this.add.graphics().setDepth(303);
    barBg.fillStyle(COLORS.DARK_GRAY, 0.8);
    barBg.fillRect(barX, barY, barW, barH);
    this._autoDistElements.push(barBg);

    const barFill = this.add.graphics().setDepth(304);
    barFill.fillStyle(charColor, 0.8);
    barFill.fillRect(barX, barY, barW * xpRatio, barH);
    this._autoDistElements.push(barFill);

    // XP 수치
    const xpStr = needed > 0 ? `${newProg.xp}/${needed}` : 'MAX';
    const xpText = this.add.text(barX + barW + 6, barY - 1, xpStr, {
      fontSize: '9px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0, 0).setDepth(303);
    this._autoDistElements.push(xpText);

    // 레벨업 연출
    if (levelUps > 0) {
      const lvUpText = this.add.text(centerX, panelY + 100, t('charLevel.levelUp', newProg.level), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonGreen,
        stroke: UI_COLORS.strokeBlack,
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(305).setAlpha(0);
      this._autoDistElements.push(lvUpText);

      this.tweens.add({
        targets: lvUpText,
        alpha: 1,
        duration: 500,
        ease: 'Back.easeOut',
      });

      const spText = this.add.text(centerX, panelY + 120, t('charLevel.spGained', levelUps), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.xpYellow,
        stroke: UI_COLORS.strokeBlack,
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(305).setAlpha(0);
      this._autoDistElements.push(spText);

      this.tweens.add({
        targets: spText,
        alpha: 1,
        duration: 400,
        delay: 400,
      });
    }

    // 자동 닫기 (레벨업 시 3.5초, 아니면 2.5초)
    const autoCloseDelay = levelUps > 0 ? 3500 : 2500;
    this._autoCloseTimer = this.time.delayedCall(autoCloseDelay, () => {
      this._closeAutoDistribution();
    });
  }

  /**
   * 자동 분배 연출 UI를 닫는다.
   * @private
   */
  _closeAutoDistribution() {
    if (this._autoCloseTimer) {
      this._autoCloseTimer.remove(false);
      this._autoCloseTimer = null;
    }
    if (this._autoDistElements) {
      this._autoDistElements.forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this._autoDistElements = null;
    }
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

    // 페이지 전환 시 숨기기 위해 추적
    if (this._page1Elements) {
      this._page1Elements.push(bg, text, zone);
    }
  }
}
