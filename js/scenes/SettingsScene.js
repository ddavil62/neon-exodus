/**
 * @fileoverview 설정 씬. 메인 메뉴에서 진입하여 [설정] / [통계] 탭을 제공한다.
 * 설정 탭: BGM/SFX/햅틱/자동 레벨업/궁극기 버튼 위치 ON/OFF 토글.
 * 통계 탭: SaveManager 데이터 기반 전체 통계, 스테이지별/캐릭터별 클리어 현황.
 * 변경 즉시 반영되며 SaveManager를 통해 영구 저장된다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import SoundSystem from '../systems/SoundSystem.js';
import { setHapticEnabled, isHapticEnabled } from '../managers/HapticManager.js';
import { STAGES, STAGE_ORDER } from '../data/stages.js';

// ── 상수 ──

/** 탭 헤더 Y 좌표 */
const TAB_Y = 110;

/** 활성 탭 밑줄 두께 */
const UNDERLINE_THICKNESS = 3;

/** 통계 콘텐츠 시작 Y (마스크 영역 상단) */
const STATS_START_Y = 160;

/** 통계 콘텐츠 마스크 하단 여유 */
const STATS_BOTTOM_MARGIN = 20;

/** 난이도 키 배열 */
const DIFFICULTIES = ['normal', 'hard', 'nightmare'];

/** 난이도 표시 레이블 */
const DIFF_LABELS = { normal: 'N', hard: 'H', nightmare: 'NM' };

/** 캐릭터 ID 배열 (표시 순서) */
const CHARACTER_IDS = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];

// ── SettingsScene 클래스 ──

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  /**
   * 설정/통계 UI를 생성한다.
   */
  create() {
    // ── 씬 진입 페이드 ──
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 (중복 전환 방지) */
    this._transitioning = false;

    /** @type {string} 현재 활성 탭 ('settings' | 'stats') */
    this._activeTab = 'settings';

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // ── 탭 헤더 ──
    this._createTabHeader(centerX);

    // ── 설정 탭 콘텐츠 (토글 행들) ──
    this._settingsGroup = [];
    this._createSettingsContent();

    // ── 통계 탭 콘텐츠 ──
    /** @type {Phaser.GameObjects.Container|null} 통계 스크롤 컨테이너 */
    this._statsContainer = null;
    /** @type {Phaser.Display.Masks.GeometryMask|null} 통계 마스크 */
    this._statsMask = null;
    this._createStatsContent();

    // ── 초기 탭 표시: 설정 탭 활성 ──
    this._showTab('settings');

    // ── 뒤로가기 (상단 좌측) ──
    this._createBackArrow(30, 30);

    // ── ESC 키 리스너 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 탭 헤더 생성 ──

  /**
   * [설정] / [통계] 탭 헤더를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createTabHeader(centerX) {
    const tabGap = 80;
    const settingsX = centerX - tabGap;
    const statsX = centerX + tabGap;

    // 설정 탭 텍스트
    this._tabSettingsText = this.add.text(settingsX, TAB_Y, t('settings.tabSettings'), {
      fontSize: '22px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // 통계 탭 텍스트
    this._tabStatsText = this.add.text(statsX, TAB_Y, t('settings.tabStats'), {
      fontSize: '22px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    // 밑줄 그래픽
    this._tabUnderline = this.add.graphics();
    this._drawTabUnderline(settingsX, this._tabSettingsText.width);

    // 탭 터치 영역
    const tabZoneW = 140;
    const tabZoneH = 50;

    const settingsZone = this.add.zone(settingsX, TAB_Y, tabZoneW, tabZoneH)
      .setInteractive({ useHandCursor: true });
    settingsZone.on('pointerdown', () => this._showTab('settings'));

    const statsZone = this.add.zone(statsX, TAB_Y, tabZoneW, tabZoneH)
      .setInteractive({ useHandCursor: true });
    statsZone.on('pointerdown', () => this._showTab('stats'));
  }

  /**
   * 활성 탭 밑줄을 그린다.
   * @param {number} x - 밑줄 중심 X
   * @param {number} width - 밑줄 너비
   * @private
   */
  _drawTabUnderline(x, width) {
    this._tabUnderline.clear();
    this._tabUnderline.fillStyle(0x00FFFF, 1);
    this._tabUnderline.fillRect(
      x - width / 2,
      TAB_Y + 16,
      width,
      UNDERLINE_THICKNESS
    );
  }

  // ── 탭 전환 ──

  /**
   * 탭을 전환하고 해당 콘텐츠를 보여준다.
   * @param {'settings'|'stats'} tab - 전환할 탭
   * @private
   */
  _showTab(tab) {
    this._activeTab = tab;

    const isSettings = tab === 'settings';
    const tabGap = 80;
    const centerX = GAME_WIDTH / 2;

    // 탭 텍스트 색상 갱신
    this._tabSettingsText.setColor(isSettings ? UI_COLORS.neonCyan : UI_COLORS.textSecondary);
    this._tabStatsText.setColor(isSettings ? UI_COLORS.textSecondary : UI_COLORS.neonCyan);

    // 밑줄 갱신
    if (isSettings) {
      this._drawTabUnderline(centerX - tabGap, this._tabSettingsText.width);
    } else {
      this._drawTabUnderline(centerX + tabGap, this._tabStatsText.width);
    }

    // 설정 그룹 표시/숨기기
    this._settingsGroup.forEach(obj => obj.setVisible(isSettings));

    // 통계 컨테이너 표시/숨기기
    if (this._statsContainer) {
      this._statsContainer.setVisible(!isSettings);
    }
  }

  // ── 설정 탭 콘텐츠 ──

  /**
   * 설정 탭의 토글 행 5개를 생성한다.
   * @private
   */
  _createSettingsContent() {
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

    // 자동 레벨업 토글
    this._createToggleRow(490, t('settings.autoLevelUp'),
      () => !!SaveManager.getSetting('autoLevelUp'),
      (val) => { SaveManager.setSetting('autoLevelUp', val); }
    );

    // 궁극기 버튼 위치 (좌/우)
    this._createSideToggleRow(580);
  }

  // ── 통계 탭 콘텐츠 ──

  /**
   * 통계 탭의 콘텐츠를 생성한다.
   * SaveManager에서 데이터를 읽어 텍스트로 표시하고, 스크롤이 필요하면 마스크+드래그를 적용한다.
   * @private
   */
  _createStatsContent() {
    // 기존 컨테이너 정리
    if (this._statsContainer) {
      this._statsContainer.removeAll(true);
      this._statsContainer.destroy();
    }

    this._statsContainer = this.add.container(0, 0);

    // 마스크 영역
    const centerX = GAME_WIDTH / 2;
    const maskH = GAME_HEIGHT - STATS_START_Y - STATS_BOTTOM_MARGIN;
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, STATS_START_Y, GAME_WIDTH, maskH);
    this._statsMask = maskShape.createGeometryMask();
    this._statsContainer.setMask(this._statsMask);

    const stats = SaveManager.getStats();
    const data = SaveManager.getData();
    const hasAnyData = stats.totalRuns > 0;

    let curY = STATS_START_Y + 10;
    const leftX = 30;
    const rightX = GAME_WIDTH - 30;

    if (!hasAnyData) {
      // 데이터 없음 표시
      const noData = this.add.text(centerX, STATS_START_Y + 100, t('stats.noData'), {
        fontSize: '16px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setOrigin(0.5);
      this._statsContainer.add(noData);
      return;
    }

    // ── 전체 통계 섹션 ──
    const generalItems = [
      { key: 'stats.totalRuns',     value: stats.totalRuns || 0 },
      { key: 'stats.totalClears',   value: stats.totalClears || 0 },
      { key: 'stats.totalKills',    value: stats.totalKills || 0 },
      { key: 'stats.longestSurvival', value: this._formatSeconds(stats.longestSurvival || 0) },
      { key: 'stats.maxLevel',      value: stats.maxLevel || 0 },
      { key: 'stats.maxKillsInRun', value: stats.maxKillsInRun || 0 },
      { key: 'stats.totalBossKills', value: stats.totalBossKills || 0 },
    ];

    generalItems.forEach(item => {
      const label = this.add.text(leftX, curY, t(item.key), {
        fontSize: '15px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      }).setOrigin(0, 0.5);
      this._statsContainer.add(label);

      const val = this.add.text(rightX, curY, String(item.value), {
        fontSize: '15px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }).setOrigin(1, 0.5);
      this._statsContainer.add(val);

      curY += 30;
    });

    // ── 구분선 ──
    curY += 5;
    const sep1 = this.add.graphics();
    sep1.lineStyle(1, 0x2A2A4E, 0.6);
    sep1.lineBetween(leftX, curY, rightX, curY);
    this._statsContainer.add(sep1);
    curY += 15;

    // ── 스테이지별 클리어 섹션 ──
    const stageSectionLabel = this.add.text(leftX, curY, t('stats.stageClears'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(0, 0.5);
    this._statsContainer.add(stageSectionLabel);
    curY += 30;

    STAGE_ORDER.forEach(stageId => {
      const stageData = STAGES[stageId];
      if (!stageData) return;

      const stageName = t(stageData.nameKey);
      const nameText = this.add.text(leftX + 10, curY, stageName, {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      }).setOrigin(0, 0.5);
      this._statsContainer.add(nameText);

      // 난이도별 클리어 횟수
      const counts = DIFFICULTIES.map(d => {
        const count = SaveManager.getStageClearCount(stageId, d);
        return `${DIFF_LABELS[d]}:${count}`;
      }).join('  ');

      const countsText = this.add.text(rightX, curY, counts, {
        fontSize: '13px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setOrigin(1, 0.5);
      this._statsContainer.add(countsText);

      curY += 26;
    });

    // ── 구분선 ──
    curY += 5;
    const sep2 = this.add.graphics();
    sep2.lineStyle(1, 0x2A2A4E, 0.6);
    sep2.lineBetween(leftX, curY, rightX, curY);
    this._statsContainer.add(sep2);
    curY += 15;

    // ── 캐릭터별 클리어 섹션 ──
    const charSectionLabel = this.add.text(leftX, curY, t('stats.characterClears'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(0, 0.5);
    this._statsContainer.add(charSectionLabel);
    curY += 30;

    const characterClears = data.characterClears || {};
    CHARACTER_IDS.forEach(charId => {
      const charName = t(`character.${charId}.name`);
      const clearCount = characterClears[charId] || 0;

      const nameText = this.add.text(leftX + 10, curY, charName, {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      }).setOrigin(0, 0.5);
      this._statsContainer.add(nameText);

      const countText = this.add.text(rightX, curY, String(clearCount), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: clearCount > 0 ? UI_COLORS.neonCyan : UI_COLORS.textSecondary,
      }).setOrigin(1, 0.5);
      this._statsContainer.add(countText);

      curY += 26;
    });

    // ── 스크롤 처리 ──
    const contentHeight = curY - STATS_START_Y + 20;
    if (contentHeight > maskH) {
      this._scrollMin = -(contentHeight - maskH);
      this._scrollMax = 0;
      this._scrollOffset = 0;

      this.input.off('pointermove', this._onStatsPointerMove, this);
      this._onStatsPointerMove = (pointer) => {
        if (!this._statsContainer.visible) return;
        if (pointer.isDown) {
          const dy = pointer.y - pointer.prevPosition.y;
          this._scrollOffset = Phaser.Math.Clamp(
            this._scrollOffset + dy,
            this._scrollMin,
            this._scrollMax
          );
          this._statsContainer.setY(this._scrollOffset);
        }
      };
      this.input.on('pointermove', this._onStatsPointerMove, this);
    }
  }

  /**
   * 초(seconds)를 '분:초' 형식으로 변환한다.
   * @param {number} seconds - 초 단위 시간
   * @returns {string} '분:초' 포맷 문자열
   * @private
   */
  _formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    const labelText = this.add.text(centerX - 80, y, label, {
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

    // 설정 그룹에 등록 (탭 전환 시 표시/숨김용)
    this._settingsGroup.push(labelText, stateText, zone);
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
    const labelText = this.add.text(centerX - 80, y, t('settings.ultSide'), {
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

    // 설정 그룹에 등록
    this._settingsGroup.push(labelText, stateText, zone);
  }

  // ── 뒤로 화살표 ──

  /**
   * 상단 좌측 뒤로 화살표 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createBackArrow(x, y) {
    const size = 36;
    const text = this.add.text(x, y, '\u2190', {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, size, size)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => { text.setAlpha(0.5); });
    zone.on('pointerup', () => { text.setAlpha(1); this._onBack(); });
    zone.on('pointerout', () => { text.setAlpha(1); });
  }
}
