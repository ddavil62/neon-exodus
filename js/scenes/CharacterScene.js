/**
 * @fileoverview 캐릭터 상세 뷰 씬.
 *
 * 단일 캐릭터의 초상화, 이름, 레벨, XP, 패시브, 스킬 요약을
 * 한 화면에 표시하고, 좌우 화살표로 캐릭터를 전환한다.
 * 씬 키('CharacterScene')를 유지하여 기존 라우팅과 호환한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { DIFFICULTY_MODES } from '../data/stages.js';
import { CHARACTERS, getCharacterById } from '../data/characters.js';
import { CHARACTER_SKILLS, CHARACTER_COLORS, canInvestUlt, getXpForNextLevel, MAX_CHAR_LEVEL } from '../data/characterSkills.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── CharacterScene 클래스 ──

export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  /**
   * 씬 초기화 데이터를 수신한다.
   * @param {{ stageId?: string, fromScene?: string }} data - 전달 데이터
   */
  init(data) {
    /** @type {string} 선택된 스테이지 ID */
    this._stageId = data?.stageId || 'stage_1';
    /** @type {string} 이전 씬 이름 (뒤로가기 분기용) */
    this._fromScene = data?.fromScene || 'MenuScene';
  }

  /**
   * 캐릭터 상세 뷰 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // 표시 가능한 캐릭터 (phase <= 3)
    const stats = SaveManager.getStats();
    /** @type {Array<Object>} 표시 가능한 캐릭터 배열 */
    this._visibleChars = CHARACTERS.filter(c => c.phase <= 3);

    // 해금 검사 + 신규 해금 추적
    /** @type {Array<Object>} 이번 진입에서 새로 해금된 캐릭터 목록 */
    this._newlyUnlocked = [];
    this._visibleChars.forEach(cd => this._isCharUnlocked(cd, stats));

    // 현재 선택된 캐릭터의 인덱스 결정
    const selectedId = SaveManager.getSelectedCharacter() || 'agent';
    /** @type {number} 현재 표시 중인 캐릭터 인덱스 */
    this._currentIndex = Math.max(0, this._visibleChars.findIndex(c => c.id === selectedId));

    // ── 동적 UI 요소 참조 ──
    /** @type {Array<Phaser.GameObjects.GameObject>} _refreshDisplay에서 재생성되는 요소들 */
    this._dynamicElements = [];

    // ── 상단 헤더 ──
    this._createBackArrow(30, 30);
    this.add.text(centerX, 30, t('menu.selectCharacter'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 좌우 화살표 ──
    this._createNavArrow(30, 140, '\u25C0', -1);
    this._createNavArrow(330, 140, '\u25B6', 1);

    // ── 하단 버튼 ──
    // 뒤로가기 버튼 (좌측)
    this._createBtn(90, 580, t('ui.back'), UI_COLORS.btnSecondary, 100, 40, () => {
      this._onBack();
    });

    // 출격 버튼 (우측) — 동적으로 활성/비활성 전환
    this._sortieBtn = this._createSortieBtn(270, 580);

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // ── 신규 해금 알림 ──
    if (this._newlyUnlocked.length > 0) {
      this._showUnlockNotifications();
    }

    // 초기 표시
    this._refreshDisplay();
  }

  // ── 동적 UI 갱신 ──

  /**
   * 현재 _currentIndex의 캐릭터 정보로 모든 동적 UI 요소를 갱신한다.
   * 정적 UI(헤더, 화살표, 하단 버튼)는 create()에서 한 번만 생성하고,
   * 동적 UI(초상화, 이름, 레벨, XP, 패시브, 스킬, 인디케이터 도트)는
   * 이 메서드에서 destroy + 재생성한다.
   * @private
   */
  _refreshDisplay() {
    // 기존 동적 요소 제거
    this._dynamicElements.forEach(el => {
      if (el && el.destroy) el.destroy();
    });
    this._dynamicElements = [];

    const centerX = GAME_WIDTH / 2;
    const charData = this._visibleChars[this._currentIndex];
    const isUnlocked = SaveManager.isCharacterUnlocked(charData.id) || !charData.unlockCondition;
    const charColor = CHARACTER_COLORS[charData.id] || COLORS.NEON_CYAN;
    const charColorStr = '#' + charColor.toString(16).padStart(6, '0');

    // ── 초상화 영역 ──
    this._renderPortrait(centerX, 140, charData, isUnlocked, charColor);

    if (isUnlocked) {
      this._renderUnlockedInfo(centerX, charData, charColor, charColorStr);
    } else {
      this._renderLockedInfo(centerX, charData, charColorStr);
    }

    // ── 캐릭터 인디케이터 도트 ──
    this._renderIndicatorDots(centerX, 520, charColor);

    // ── 출격 버튼 활성/비활성 갱신 ──
    this._updateSortieBtn(isUnlocked);
  }

  // ── 초상화 렌더링 ──

  /**
   * 캐릭터 초상화(글로우 배경 + 스프라이트)를 렌더링한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} charData - 캐릭터 데이터
   * @param {boolean} isUnlocked - 해금 여부
   * @param {number} charColor - 캐릭터 고유 색상 (hex number)
   * @private
   */
  _renderPortrait(x, y, charData, isUnlocked, charColor) {
    // 글로우 배경
    const bgKey = `char_portrait_bg_${charData.id}`;
    if (this.textures.exists(bgKey)) {
      const bgImg = this.add.image(x, y, bgKey).setOrigin(0.5);
      if (!isUnlocked) bgImg.setAlpha(0.3);
      this._dynamicElements.push(bgImg);
    }

    // 캐릭터 스프라이트
    const spriteKey = charData.spriteKey;
    if (this.textures.exists(spriteKey)) {
      const sprite = this.add.image(x, y, spriteKey).setOrigin(0.5).setScale(2.0);
      if (!isUnlocked) {
        sprite.setTint(COLORS.DARK_GRAY);
        sprite.setAlpha(0.5);
      }
      this._dynamicElements.push(sprite);
    }
  }

  // ── 해금 캐릭터 정보 표시 ──

  /**
   * 해금된 캐릭터의 이름, 레벨, XP, 패시브, 스킬 요약을 표시한다.
   * @param {number} centerX - 화면 중심 X
   * @param {Object} charData - 캐릭터 데이터
   * @param {number} charColor - 캐릭터 고유 색상 (hex number)
   * @param {string} charColorStr - 캐릭터 색상 CSS 문자열
   * @private
   */
  _renderUnlockedInfo(centerX, charData, charColor, charColorStr) {
    const prog = SaveManager.getCharacterProgression(charData.id);

    // ── 이름 ──
    const nameText = this.add.text(centerX, 236, t(charData.nameKey), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: charColorStr,
    }).setOrigin(0.5);
    this._dynamicElements.push(nameText);

    // ── 레벨 ──
    const lvStr = prog.level >= MAX_CHAR_LEVEL ? t('charLevel.maxLevel') : `Lv.${prog.level}`;
    const lvText = this.add.text(centerX, 263, lvStr, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);
    this._dynamicElements.push(lvText);

    // ── XP 바 ──
    const xpBarX = 50;
    const xpBarW = 260;
    const xpBarH = 8;
    const xpBarY = 285;
    const needed = getXpForNextLevel(prog.level);
    const xpRatio = needed > 0 ? Math.min(1, prog.xp / needed) : 1;

    // XP 바 배경
    const xpBarBg = this.add.graphics();
    xpBarBg.fillStyle(COLORS.DARK_GRAY, 0.6);
    xpBarBg.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    this._dynamicElements.push(xpBarBg);

    // XP 바 채움
    const xpBarFill = this.add.graphics();
    xpBarFill.fillStyle(charColor, 0.8);
    xpBarFill.fillRect(xpBarX, xpBarY, xpBarW * xpRatio, xpBarH);
    this._dynamicElements.push(xpBarFill);

    // XP 수치
    const xpStr = needed > 0 ? `${prog.xp}/${needed}` : 'MAX';
    const xpText = this.add.text(centerX, 302, xpStr, {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);
    this._dynamicElements.push(xpText);

    // ── 패시브 ──
    const passiveText = this.add.text(centerX, 330, t(charData.passiveKey), {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: 320 },
      align: 'center',
    }).setOrigin(0.5);
    this._dynamicElements.push(passiveText);

    // ── 스킬 요약 ──
    this._renderSkillSummary(centerX, charData.id, prog);
  }

  // ── 잠금 캐릭터 정보 표시 ──

  /**
   * 잠금된 캐릭터의 이름과 해금 조건을 표시한다.
   * @param {number} centerX - 화면 중심 X
   * @param {Object} charData - 캐릭터 데이터
   * @param {string} charColorStr - 캐릭터 색상 CSS 문자열
   * @private
   */
  _renderLockedInfo(centerX, charData, charColorStr) {
    // 이름 (dimmed)
    const nameText = this.add.text(centerX, 236, t(charData.nameKey), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5).setAlpha(0.5);
    this._dynamicElements.push(nameText);

    // 해금 조건 라벨
    const lockLabel = this.add.text(centerX, 330, t('charDetail.locked'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);
    this._dynamicElements.push(lockLabel);

    // 해금 조건 상세
    const condStr = charData.unlockKey ? t(charData.unlockKey) : t('menu.locked');
    const condText = this.add.text(centerX, 355, condStr, {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: 280 },
      align: 'center',
    }).setOrigin(0.5);
    this._dynamicElements.push(condText);
  }

  // ── 스킬 요약 영역 ──

  /**
   * 스킬 요약 영역(스킬 라벨 + SP 배지 + Q/W/E/R 행)을 렌더링한다.
   * @param {number} centerX - 화면 중심 X
   * @param {string} charId - 캐릭터 ID
   * @param {Object} prog - 캐릭터 진행 데이터
   * @private
   */
  _renderSkillSummary(centerX, charId, prog) {
    // "스킬" 라벨
    const skillLabel = this.add.text(30, 362, t('charDetail.skills'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    });
    this._dynamicElements.push(skillLabel);

    // SP 배지 (sp > 0일 때만)
    if (prog.sp > 0) {
      const spBadge = this.add.text(330, 362, t('charLevel.sp', prog.sp), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.gold,
        backgroundColor: UI_COLORS.goldBg,
        padding: { x: 4, y: 2 },
      }).setOrigin(1, 0);
      this._dynamicElements.push(spBadge);
    }

    // Q/W/E/R 행
    const skillDefs = CHARACTER_SKILLS[charId];
    if (!skillDefs) return;

    const slots = ['Q', 'W', 'E', 'R'];
    const rowYPositions = [384, 416, 448, 480];

    slots.forEach((slot, i) => {
      const skill = skillDefs[slot];
      if (!skill) return;

      const rowY = rowYPositions[i];
      const lv = prog.skills[slot] || 0;
      const isRLocked = slot === 'R' && lv < skill.maxLevel && !canInvestUlt(prog.level, lv);

      // 슬롯 라벨
      const slotLabel = this.add.text(30, rowY, `[${slot}]`, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      });
      this._dynamicElements.push(slotLabel);

      // 스킬명
      const skillName = this.add.text(60, rowY, t(skill.nameKey), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      });
      this._dynamicElements.push(skillName);

      // R 잠금 상태
      if (isRLocked) {
        const gate = lv < 3 ? [6, 11, 16][lv] : 16;
        const lockStr = '\uD83D\uDD12 ' + t('skill.locked', gate);
        const lockLabel = this.add.text(330, rowY, lockStr, {
          fontSize: '10px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
        }).setOrigin(1, 0).setAlpha(0.6);
        this._dynamicElements.push(lockLabel);
      } else {
        // 레벨 표시
        const lvStr = `Lv.${lv}/${skill.maxLevel}`;
        const lvColor = lv >= skill.maxLevel ? UI_COLORS.neonGreen : UI_COLORS.textPrimary;
        const lvLabel = this.add.text(330, rowY, lvStr, {
          fontSize: '11px',
          fontFamily: 'Galmuri11, monospace',
          color: lvColor,
        }).setOrigin(1, 0);
        this._dynamicElements.push(lvLabel);
      }
    });
  }

  // ── 인디케이터 도트 ──

  /**
   * 캐릭터 인디케이터 도트를 렌더링한다.
   * 현재 캐릭터는 밝은 원, 해금 캐릭터는 charColor, 미해금은 dimGray.
   * @param {number} centerX - 화면 중심 X
   * @param {number} y - Y 좌표
   * @param {number} currentCharColor - 현재 캐릭터 색상
   * @private
   */
  _renderIndicatorDots(centerX, y, currentCharColor) {
    const count = this._visibleChars.length;
    const dotGap = 20;
    const startX = centerX - ((count - 1) * dotGap) / 2;

    const gfx = this.add.graphics();
    this._dynamicElements.push(gfx);

    this._visibleChars.forEach((charData, i) => {
      const dotX = startX + i * dotGap;
      const isCurrent = i === this._currentIndex;
      const isUnlocked = SaveManager.isCharacterUnlocked(charData.id) || !charData.unlockCondition;
      const dotColor = CHARACTER_COLORS[charData.id] || 0x888888;

      if (isCurrent) {
        // 현재 캐릭터: 밝은 채움 원
        gfx.fillStyle(currentCharColor, 1);
        gfx.fillCircle(dotX, y, 5);
      } else if (isUnlocked) {
        // 해금: charColor 반투명
        gfx.fillStyle(dotColor, 0.5);
        gfx.fillCircle(dotX, y, 4);
      } else {
        // 미해금: dimGray
        gfx.fillStyle(COLORS.UI_BORDER, 0.5);
        gfx.fillCircle(dotX, y, 4);
      }
    });
  }

  // ── 네비게이션 ──

  /**
   * 뒤로 화살표 버튼을 생성한다.
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
    zone.on('pointerup', () => {
      text.setAlpha(1);
      this._onBack();
    });
    zone.on('pointerout', () => { text.setAlpha(1); });
  }

  /**
   * 좌우 네비게이션 화살표를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} symbol - 화살표 문자 ("◀" 또는 "▶")
   * @param {number} direction - 방향 (-1: 좌, +1: 우)
   * @private
   */
  _createNavArrow(x, y, symbol, direction) {
    const size = 36;
    const text = this.add.text(x, y, symbol, {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, size, size)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => { text.setAlpha(0.5); });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      const len = this._visibleChars.length;
      this._currentIndex = (this._currentIndex + direction + len) % len;
      this._refreshDisplay();
    });
    zone.on('pointerout', () => { text.setAlpha(1); });
  }

  // ── 뒤로가기 ──

  /**
   * 이전 씬으로 돌아간다.
   * MenuScene에서 진입 시 MenuScene으로, StageSelectScene에서 진입 시 StageSelectScene으로 복귀.
   */
  _onBack() {
    this.scene.start(this._fromScene);
  }

  // ── 출격 ──

  /**
   * 출격 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @returns {Object} 버튼 참조 객체 (bg, text, zone)
   * @private
   */
  _createSortieBtn(x, y) {
    const btnW = 140;
    const btnH = 40;

    const bg = this.add.graphics();
    const text = this.add.text(x, y, t('menu.start'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    let pressed = false;
    zone.on('pointerdown', () => {
      if (!this._sortieEnabled) return;
      pressed = true;
      text.setAlpha(0.6);
    });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (pressed && this._sortieEnabled) this._onSortie();
      pressed = false;
    });
    zone.on('pointerout', () => { pressed = false; text.setAlpha(1); });

    return { bg, text, zone, x, y, w: btnW, h: btnH };
  }

  /**
   * 출격 버튼의 활성/비활성 상태를 갱신한다.
   * @param {boolean} enabled - 활성 여부
   * @private
   */
  _updateSortieBtn(enabled) {
    this._sortieEnabled = enabled;
    const { bg, text, x, y, w, h } = this._sortieBtn;

    bg.clear();
    if (enabled) {
      bg.fillStyle(UI_COLORS.btnPrimary, 0.8);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      bg.lineStyle(2, COLORS.NEON_CYAN, 0.8);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      text.setAlpha(1);
      text.setColor(UI_COLORS.neonCyan);
    } else {
      bg.fillStyle(UI_COLORS.btnDisabled, 0.4);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      text.setAlpha(0.3);
      text.setColor(UI_COLORS.textSecondary);
    }
  }

  /**
   * 출격 로직을 실행한다. 기존 CharacterScene의 출격 로직과 동일.
   * @private
   */
  _onSortie() {
    const charData = this._visibleChars[this._currentIndex];
    SaveManager.setSelectedCharacter(charData.id);
    const stageNum = this._stageId.replace('stage_', '');
    const introId = `stage_${stageNum}_intro`;

    const selectedDifficulty = SaveManager.getSelectedDifficulty();
    if (!SaveManager.isCutsceneViewed(introId)) {
      this.scene.start('CutsceneScene', {
        cutsceneId: introId,
        nextScene: 'GameScene',
        nextSceneData: {
          characterId: charData.id,
          stageId: this._stageId,
          difficulty: selectedDifficulty,
        },
        characterId: charData.id,
      });
    } else {
      this.scene.start('GameScene', {
        characterId: charData.id,
        stageId: this._stageId,
        difficulty: selectedDifficulty,
      });
    }
  }

  // ── 신규 해금 알림 ──

  /**
   * 새로 해금된 캐릭터 알림을 순차적으로 표시한다.
   * @private
   */
  _showUnlockNotifications() {
    const centerX = GAME_WIDTH / 2;
    let delay = 300;

    for (const charData of this._newlyUnlocked) {
      this.time.delayedCall(delay, () => {
        SoundSystem.play('levelup');
        this._createUnlockToast(centerX, charData);
      });
      delay += 1500;
    }

    // 첫 번째 신규 해금 캐릭터로 자동 이동
    if (this._newlyUnlocked.length > 0) {
      const firstUnlockedIdx = this._visibleChars.findIndex(c => c.id === this._newlyUnlocked[0].id);
      if (firstUnlockedIdx >= 0) {
        this._currentIndex = firstUnlockedIdx;
        this._refreshDisplay();
      }
    }
  }

  /**
   * 캐릭터 해금 토스트 알림을 생성한다.
   * @param {number} centerX - 중심 X 좌표
   * @param {Object} charData - 캐릭터 데이터
   * @private
   */
  _createUnlockToast(centerX, charData) {
    const message = t('menu.characterUnlocked', t(charData.nameKey));
    const toastY = 65;

    // 배경 패널
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.TOAST_BG, 0.9);
    bg.fillRoundedRect(centerX - 130, toastY - 18, 260, 36, 8);
    bg.lineStyle(2, COLORS.NEON_CYAN, 0.8);
    bg.strokeRoundedRect(centerX - 130, toastY - 18, 260, 36, 8);
    bg.setDepth(500).setAlpha(0);

    // 텍스트
    const text = this.add.text(centerX, toastY, message, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.strokeBlack,
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(501).setAlpha(0);

    // 페이드인 → 유지 → 페이드아웃
    this.tweens.add({
      targets: [bg, text],
      alpha: 1,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: [bg, text],
          alpha: 0,
          duration: 500,
          delay: 2000,
          ease: 'Power2',
          onComplete: () => {
            bg.destroy();
            text.destroy();
          },
        });
      },
    });
  }

  // ── 캐릭터 잠금 해제 판별 ──

  /**
   * 캐릭터의 잠금 해제 여부를 확인한다.
   * @param {Object} charData - 캐릭터 데이터
   * @param {Object} stats - 현재 통계
   * @returns {boolean} 해금 여부
   * @private
   */
  _isCharUnlocked(charData, stats) {
    // 기본 캐릭터 또는 이미 해금된 캐릭터
    if (!charData.unlockCondition) return true;
    if (SaveManager.isCharacterUnlocked(charData.id)) return true;

    const cond = charData.unlockCondition;
    let unlocked = false;

    switch (cond.type) {
      case 'totalKills':
        unlocked = (stats.totalKills || 0) >= cond.value;
        break;
      case 'totalClears':
        unlocked = (stats.totalClears || 0) >= cond.value;
        break;
      case 'totalBossKills':
        unlocked = (stats.totalBossKills || 0) >= cond.value;
        break;
      default:
        unlocked = false;
    }

    // 해금되었으면 SaveManager에 기록 + 신규 해금 추적
    if (unlocked) {
      const wasAlreadyUnlocked = SaveManager.isCharacterUnlocked(charData.id);
      SaveManager.unlockCharacter(charData.id);
      if (!wasAlreadyUnlocked && this._newlyUnlocked) {
        this._newlyUnlocked.push(charData);
      }
    }

    return unlocked;
  }

  // ── 버튼 유틸리티 ──

  /**
   * 일반 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {number} btnW - 버튼 너비
   * @param {number} btnH - 버튼 높이
   * @param {Function} callback - 클릭 콜백
   * @private
   */
  _createBtn(x, y, label, bgColor, btnW, btnH, callback) {
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
