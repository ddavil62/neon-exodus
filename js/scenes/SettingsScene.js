/**
 * @fileoverview 설정 씬. 메인 메뉴에서 진입하여 [설정] / [통계] 탭을 제공한다.
 * 설정 탭: 섹션 카드 3개(사운드/게임플레이/시스템)에 네온 토글 스위치, 배경 도트 그리드.
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

/** 탭 간 좌우 간격 (중앙 기준 ±) */
const TAB_GAP = 80;

/** 활성 탭 밑줄 두께 */
const UNDERLINE_THICKNESS = 3;

/** 통계 콘텐츠 시작 Y (마스크 영역 상단) */
const STATS_START_Y = 155;

/** 통계 콘텐츠 마스크 하단 여유 */
const STATS_BOTTOM_MARGIN = 20;

/** 난이도 키 배열 */
const DIFFICULTIES = ['normal', 'hard', 'nightmare'];

/** 난이도 표시 레이블 */
const DIFF_LABELS = { normal: 'N', hard: 'H', nightmare: 'NM' };

/** 캐릭터 ID 배열 (표시 순서) */
const CHARACTER_IDS = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];

/** 섹션 카드 너비 (px) */
const CARD_WIDTH = 320;

/** 섹션 카드 좌우 마진 (px) */
const CARD_MARGIN = (GAME_WIDTH - CARD_WIDTH) / 2;

/** 카드 모서리 반지름 */
const CARD_RADIUS = 10;

/** 카드 배경색 */
const CARD_BG = 0x1A1A2E;

/** 카드 배경 투명도 */
const CARD_ALPHA = 0.85;

/** 카드 보더색 */
const CARD_BORDER = 0x2A2A4E;

/** 카드 보더 투명도 */
const CARD_BORDER_ALPHA = 0.6;

/** 토글 트랙 너비 */
const TOGGLE_TRACK_W = 44;

/** 토글 트랙 높이 */
const TOGGLE_TRACK_H = 22;

/** 토글 썸 직경 */
const TOGGLE_THUMB_R = 8;

/** 토글 ON 색상 */
const TOGGLE_ON_COLOR = 0x00AAAA;

/** 토글 OFF 색상 */
const TOGGLE_OFF_COLOR = 0x333344;

/** 토글 글로우 색상 */
const TOGGLE_GLOW_COLOR = 0x00FFFF;

/** 토글 애니메이션 시간 (ms) */
const TOGGLE_TWEEN_MS = 150;

/** 항목 행 높이 (px) */
const ROW_HEIGHT = 38;

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

    /** @type {boolean} 데이터 초기화 1단계 확인 상태 */
    this._resetConfirmStep = false;

    /** @type {Phaser.Time.TimerEvent|null} 초기화 확인 타이머 */
    this._resetTimer = null;

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this._drawBackgroundGrid();

    // ── 탭 헤더 ──
    this._createTabHeader(centerX);

    // ── 설정 탭 콘텐츠 (섹션 카드들) ──
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

  // ── 배경 장식 ──

  /**
   * 미세한 도트 그리드와 수평 구분선을 그린다.
   * @private
   */
  _drawBackgroundGrid() {
    const gfx = this.add.graphics();

    // 도트 그리드: 20px 간격, 0x112233, alpha 0.15
    gfx.fillStyle(0x112233, 0.15);
    for (let x = 0; x < GAME_WIDTH; x += 20) {
      for (let y = 0; y < GAME_HEIGHT; y += 20) {
        gfx.fillCircle(x, y, 1);
      }
    }

    // 수평 구분선 2개
    gfx.lineStyle(1, 0x1A2A3A, 0.3);
    gfx.lineBetween(0, 140, GAME_WIDTH, 140);
    gfx.lineBetween(0, 500, GAME_WIDTH, 500);
  }

  // ── 탭 헤더 생성 ──

  /**
   * [설정] / [통계] 탭 헤더를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createTabHeader(centerX) {
    const settingsX = centerX - TAB_GAP;
    const statsX = centerX + TAB_GAP;

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
    const centerX = GAME_WIDTH / 2;

    // 탭 텍스트 색상 갱신
    this._tabSettingsText.setColor(isSettings ? UI_COLORS.neonCyan : UI_COLORS.textSecondary);
    this._tabStatsText.setColor(isSettings ? UI_COLORS.textSecondary : UI_COLORS.neonCyan);

    // 밑줄 갱신
    if (isSettings) {
      this._drawTabUnderline(centerX - TAB_GAP, this._tabSettingsText.width);
    } else {
      this._drawTabUnderline(centerX + TAB_GAP, this._tabStatsText.width);
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
   * 설정 탭의 섹션 카드 3개와 하단 영역을 생성한다.
   * @private
   */
  _createSettingsContent() {
    const centerX = GAME_WIDTH / 2;

    // ── 사운드 섹션 카드 (Y=148~268, 높이 120) ──
    this._drawSectionCard(148, 120, t('settings.sectionSound'));
    this._createToggleRow(148 + 42, '\u266A', t('settings.bgm'),
      () => SoundSystem.isBgmEnabled(),
      (val) => { SoundSystem.setBgmEnabled(val); SaveManager.setSetting('bgmEnabled', val); }
    );
    this._createToggleRow(148 + 42 + ROW_HEIGHT, '\u266B', t('settings.sfx'),
      () => SoundSystem.isSfxEnabled(),
      (val) => { SoundSystem.setSfxEnabled(val); SaveManager.setSetting('sfxEnabled', val); }
    );

    // ── 게임플레이 섹션 카드 (Y=278~398, 높이 120) ──
    this._drawSectionCard(278, 120, t('settings.sectionGameplay'));
    this._createToggleRow(278 + 42, '>>', t('settings.autoLevelUp'),
      () => !!SaveManager.getSetting('autoLevelUp'),
      (val) => { SaveManager.setSetting('autoLevelUp', val); }
    );
    this._createUltSideRow(278 + 42 + ROW_HEIGHT);

    // ── 시스템 섹션 카드 (Y=408~488, 높이 80) ──
    this._drawSectionCard(408, 80, t('settings.sectionSystem'));
    this._createToggleRow(408 + 42, '~', t('settings.haptic'),
      () => isHapticEnabled(),
      (val) => { setHapticEnabled(val); SaveManager.setSetting('hapticEnabled', val); }
    );

    // ── 하단 영역: 버전 텍스트 ──
    const versionText = this.add.text(centerX, 510, 'v0.1.0', {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);
    this._settingsGroup.push(versionText);

    // ── 하단 영역: 데이터 초기화 버튼 ──
    this._createResetButton(centerX, 548);
  }

  // ── 섹션 카드 패널 ──

  /**
   * 섹션 카드 배경 패널(둥근 사각형 + 보더 + 제목)을 그린다.
   * @param {number} y - 카드 상단 Y 좌표
   * @param {number} height - 카드 높이 (px)
   * @param {string} title - 섹션 제목 텍스트
   * @private
   */
  _drawSectionCard(y, height, title) {
    const x = CARD_MARGIN;
    const gfx = this.add.graphics();

    // 카드 배경
    gfx.fillStyle(CARD_BG, CARD_ALPHA);
    gfx.fillRoundedRect(x, y, CARD_WIDTH, height, CARD_RADIUS);

    // 카드 보더
    gfx.lineStyle(1, CARD_BORDER, CARD_BORDER_ALPHA);
    gfx.strokeRoundedRect(x, y, CARD_WIDTH, height, CARD_RADIUS);

    // 섹션 제목
    const titleText = this.add.text(x + 12, y + 14, title, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0, 0.5);

    this._settingsGroup.push(gfx, titleText);
  }

  // ── 토글 스위치 행 ──

  /**
   * 네온 슬라이드 토글 행을 생성한다. 아이콘 + 레이블 + 토글 스위치.
   * @param {number} y - 행 중심 Y 좌표
   * @param {string} icon - 아이콘 심볼 문자
   * @param {string} label - 항목 레이블 텍스트
   * @param {Function} getState - 현재 ON/OFF 상태를 반환하는 함수
   * @param {Function} onToggle - 새 상태(boolean)를 받아 처리하는 콜백
   * @private
   */
  _createToggleRow(y, icon, label, getState, onToggle) {
    const leftX = CARD_MARGIN + 12;
    const rightX = CARD_MARGIN + CARD_WIDTH - 16;

    // 아이콘 심볼
    const iconText = this.add.text(leftX, y, icon, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0, 0.5);

    // 레이블 텍스트
    const labelText = this.add.text(leftX + 24, y, label, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0, 0.5);

    // 토글 스위치 생성
    const isOn = getState();
    const toggleGfx = this.add.graphics();
    const trackX = rightX - TOGGLE_TRACK_W;
    const trackY = y - TOGGLE_TRACK_H / 2;

    // 썸 위치 계산
    const thumbLeftX = trackX + TOGGLE_THUMB_R + 3;
    const thumbRightX = trackX + TOGGLE_TRACK_W - TOGGLE_THUMB_R - 3;
    const thumbY = y;

    // 썸 (원형)
    const thumb = this.add.graphics();

    /** @type {{ on: boolean }} 토글 상태 참조 객체 */
    const state = { on: isOn };

    // 초기 렌더링
    this._drawToggle(toggleGfx, trackX, trackY, state.on);
    this._drawThumb(thumb, state.on ? thumbRightX : thumbLeftX, thumbY, state.on);

    // 터치 영역
    const zone = this.add.zone(trackX + TOGGLE_TRACK_W / 2, y, TOGGLE_TRACK_W + 20, ROW_HEIGHT)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      const newVal = !state.on;
      state.on = newVal;
      onToggle(newVal);

      // 트랙 즉시 갱신
      this._drawToggle(toggleGfx, trackX, trackY, newVal);

      // 썸 애니메이션
      const targetX = newVal ? thumbRightX : thumbLeftX;
      this.tweens.add({
        targets: { x: newVal ? thumbLeftX : thumbRightX },
        x: targetX,
        duration: TOGGLE_TWEEN_MS,
        ease: 'Power2',
        onUpdate: (tween, target) => {
          this._drawThumb(thumb, target.x, thumbY, newVal);
        },
      });
    });

    this._settingsGroup.push(iconText, labelText, toggleGfx, thumb, zone);
  }

  /**
   * 토글 트랙(둥근 사각형)을 그린다.
   * @param {Phaser.GameObjects.Graphics} gfx - 그래픽 오브젝트
   * @param {number} x - 트랙 좌측 X
   * @param {number} y - 트랙 상단 Y
   * @param {boolean} isOn - ON 상태 여부
   * @private
   */
  _drawToggle(gfx, x, y, isOn) {
    gfx.clear();
    gfx.fillStyle(isOn ? TOGGLE_ON_COLOR : TOGGLE_OFF_COLOR, 1);
    gfx.fillRoundedRect(x, y, TOGGLE_TRACK_W, TOGGLE_TRACK_H, TOGGLE_TRACK_H / 2);
  }

  /**
   * 토글 썸(원형)을 그린다. ON 상태 시 시안 글로우를 추가한다.
   * @param {Phaser.GameObjects.Graphics} gfx - 그래픽 오브젝트
   * @param {number} x - 썸 중심 X
   * @param {number} y - 썸 중심 Y
   * @param {boolean} isOn - ON 상태 여부
   * @private
   */
  _drawThumb(gfx, x, y, isOn) {
    gfx.clear();
    if (isOn) {
      // 글로우 효과
      gfx.lineStyle(2, TOGGLE_GLOW_COLOR, 0.5);
      gfx.strokeCircle(x, y, TOGGLE_THUMB_R + 1);
    }
    gfx.fillStyle(0xFFFFFF, 1);
    gfx.fillCircle(x, y, TOGGLE_THUMB_R);
  }

  // ── 궁극기 버튼 좌우 선택 ──

  /**
   * 궁극기 버튼 위치(좌/우) 캡슐 버튼 행을 생성한다.
   * @param {number} y - 행 중심 Y 좌표
   * @private
   */
  _createUltSideRow(y) {
    const leftX = CARD_MARGIN + 12;
    const rightX = CARD_MARGIN + CARD_WIDTH - 16;

    // 아이콘
    const iconText = this.add.text(leftX, y, '\u25C8', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0, 0.5);

    // 레이블
    const labelText = this.add.text(leftX + 24, y, t('settings.ultSide'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0, 0.5);

    // 현재 값
    const currentSide = SaveManager.getSetting('ultBtnSide') || 'left';

    // 좌측 캡슐 버튼
    const leftBtnX = rightX - 100;
    const leftBtnGfx = this.add.graphics();
    const rightBtnGfx = this.add.graphics();

    /** @type {{ side: string }} 궁극기 버튼 위치 상태 참조 객체 */
    const sideState = { side: currentSide };

    // 좌측 버튼 텍스트
    const leftBtnText = this.add.text(leftBtnX + 24, y, t('settings.ultLeft'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    // 우측 버튼 텍스트
    const rightBtnText = this.add.text(rightX - 24, y, t('settings.ultRight'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    /** 캡슐 버튼 렌더링 함수 */
    const drawButtons = () => {
      const isLeft = sideState.side === 'left';

      // 좌측 캡슐
      leftBtnGfx.clear();
      leftBtnGfx.fillStyle(isLeft ? 0x00AAAA : 0x1A1A2E, isLeft ? 0.8 : 0.5);
      leftBtnGfx.fillRoundedRect(leftBtnX, y - 12, 48, 24, 12);
      leftBtnGfx.lineStyle(1, isLeft ? 0x00FFFF : 0x2A2A4E, isLeft ? 0.8 : 0.4);
      leftBtnGfx.strokeRoundedRect(leftBtnX, y - 12, 48, 24, 12);

      // 우측 캡슐
      rightBtnGfx.clear();
      rightBtnGfx.fillStyle(!isLeft ? 0x00AAAA : 0x1A1A2E, !isLeft ? 0.8 : 0.5);
      rightBtnGfx.fillRoundedRect(rightX - 48, y - 12, 48, 24, 12);
      rightBtnGfx.lineStyle(1, !isLeft ? 0x00FFFF : 0x2A2A4E, !isLeft ? 0.8 : 0.4);
      rightBtnGfx.strokeRoundedRect(rightX - 48, y - 12, 48, 24, 12);
    };

    drawButtons();

    // 좌측 캡슐 터치 영역
    const leftZone = this.add.zone(leftBtnX + 24, y, 48, 24)
      .setInteractive({ useHandCursor: true });
    leftZone.on('pointerdown', () => {
      if (sideState.side === 'left') return;
      sideState.side = 'left';
      SaveManager.setSetting('ultBtnSide', 'left');
      drawButtons();
    });

    // 우측 캡슐 터치 영역
    const rightZone = this.add.zone(rightX - 24, y, 48, 24)
      .setInteractive({ useHandCursor: true });
    rightZone.on('pointerdown', () => {
      if (sideState.side === 'right') return;
      sideState.side = 'right';
      SaveManager.setSetting('ultBtnSide', 'right');
      drawButtons();
    });

    this._settingsGroup.push(
      iconText, labelText, leftBtnGfx, rightBtnGfx,
      leftBtnText, rightBtnText, leftZone, rightZone
    );
  }

  // ── 데이터 초기화 버튼 ──

  /**
   * 데이터 초기화 버튼을 생성한다. 2단계 확인 후 실행.
   * 첫 탭: 텍스트가 "정말 초기화?"로 변경 + 빨간 배경, 3초 후 복구.
   * 두 번째 탭: SaveManager.resetAll() 실행 후 MenuScene으로 이동.
   * @param {number} centerX - 버튼 중심 X
   * @param {number} y - 버튼 중심 Y
   * @private
   */
  _createResetButton(centerX, y) {
    const btnW = 200;
    const btnH = 32;
    const btnGfx = this.add.graphics();

    const btnText = this.add.text(centerX, y, t('settings.resetData'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: '#FF3333',
    }).setOrigin(0.5);

    /** 기본 상태 렌더링 */
    const drawNormal = () => {
      btnGfx.clear();
      btnGfx.lineStyle(1, 0xFF3333, 0.8);
      btnGfx.strokeRoundedRect(centerX - btnW / 2, y - btnH / 2, btnW, btnH, btnH / 2);
      btnText.setText(t('settings.resetData'));
      btnText.setColor('#FF3333');
      this._resetConfirmStep = false;
    };

    /** 확인 상태 렌더링 (빨간 배경) */
    const drawConfirm = () => {
      btnGfx.clear();
      btnGfx.fillStyle(0xFF3333, 0.8);
      btnGfx.fillRoundedRect(centerX - btnW / 2, y - btnH / 2, btnW, btnH, btnH / 2);
      btnGfx.lineStyle(1, 0xFF3333, 1);
      btnGfx.strokeRoundedRect(centerX - btnW / 2, y - btnH / 2, btnW, btnH, btnH / 2);
      btnText.setText(t('settings.resetConfirm'));
      btnText.setColor('#FFFFFF');
      this._resetConfirmStep = true;
    };

    drawNormal();

    // 터치 영역
    const zone = this.add.zone(centerX, y, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      if (!this._resetConfirmStep) {
        // 1단계: 확인 모드 진입
        drawConfirm();

        // 3초 후 원래 상태로 복구
        if (this._resetTimer) this._resetTimer.remove(false);
        this._resetTimer = this.time.delayedCall(3000, () => {
          drawNormal();
        });
      } else {
        // 2단계: 실제 초기화 실행
        if (this._resetTimer) {
          this._resetTimer.remove(false);
          this._resetTimer = null;
        }
        SaveManager.resetAll();
        this._fadeToScene('MenuScene');
      }
    });

    this._settingsGroup.push(btnGfx, btnText, zone);
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

    let curY = STATS_START_Y + 20;
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
    sep1.lineStyle(1, 0x3A3A6E, 1.0);
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

      const fullStageName = t(stageData.nameKey);
      const stageName = fullStageName.length > 12 ? fullStageName.substring(0, 11) + '\u2026' : fullStageName;
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
    sep2.lineStyle(1, 0x3A3A6E, 1.0);
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

  // ── 뒤로 화살표 ──

  /**
   * 상단 좌측 뒤로 화살표 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createBackArrow(x, y) {
    const size = 44;
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
