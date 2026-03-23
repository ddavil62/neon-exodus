/**
 * @fileoverview 캐릭터 선택 화면 씬.
 *
 * 해금된/잠금된 캐릭터를 세로 스크롤 리스트로 표시하고,
 * 선택한 캐릭터로 GameScene을 시작한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { DIFFICULTY_MODES } from '../data/stages.js';
import { CHARACTERS, getCharacterById } from '../data/characters.js';
import { CHARACTER_SKILLS, CHARACTER_COLORS, canInvestUlt, getXpForNextLevel, MAX_CHAR_LEVEL } from '../data/characterSkills.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── 레이아웃 상수 ──

const CARD_W = 300;
const CARD_H = 88;
const CARD_H_EXPANDED = 220;
const CARD_GAP = 10;
const LIST_START_Y = 100;

// ── CharacterScene 클래스 ──

export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  /**
   * 씬 초기화 데이터를 수신한다.
   * @param {{ stageId?: string }} data - StageSelectScene에서 전달한 스테이지 ID
   */
  init(data) {
    /** 선택된 스테이지 ID */
    this._stageId = data?.stageId || 'stage_1';
  }

  /**
   * 캐릭터 선택 UI를 생성한다.
   */
  create() {
    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 제목 ──
    this.add.text(centerX, 30, t('menu.selectCharacter'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // 현재 선택된 캐릭터 ID
    this._selectedId = SaveManager.getSelectedCharacter() || 'agent';

    // 잠금 해제 여부를 판별하고 표시 가능한 캐릭터만 필터 (Phase 3 이하)
    const stats = SaveManager.getStats();
    const visibleChars = CHARACTERS.filter(c => c.phase <= 3);

    // ── 스크롤 컨테이너 (Phaser Container + Mask) ──
    const listHeight = GAME_HEIGHT - 200;
    // 선택된 캐릭터가 해금 상태면 확장 높이 적용
    let contentHeight = 0;
    visibleChars.forEach(cd => {
      const unlocked = SaveManager.isCharacterUnlocked(cd.id) || !cd.unlockCondition;
      const isSelected = this._selectedId === cd.id;
      contentHeight += ((isSelected && unlocked) ? CARD_H_EXPANDED : CARD_H) + CARD_GAP;
    });

    this._container = this.add.container(0, 0);

    // 마스크 영역 설정
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(
      centerX - CARD_W / 2 - 10, LIST_START_Y,
      CARD_W + 20, listHeight
    );
    const mask = maskShape.createGeometryMask();
    this._container.setMask(mask);

    /** @type {Array<Object>} 카드 UI 요소 배열 */
    this._cardElements = [];

    /** @type {Array<Object>} 이번 진입에서 새로 해금된 캐릭터 목록 */
    this._newlyUnlocked = [];

    // ── 캐릭터 카드 생성 (선택된 카드는 확장) ──
    let accY = LIST_START_Y;
    visibleChars.forEach((charData, i) => {
      const isUnlocked = this._isCharUnlocked(charData, stats);
      const isSelected = this._selectedId === charData.id;
      const cardHeight = (isSelected && isUnlocked) ? CARD_H_EXPANDED : CARD_H;
      const cardY = accY + cardHeight / 2;

      this._createCharCard(centerX, cardY, charData, isUnlocked);
      accY += cardHeight + CARD_GAP;
    });

    // ── 신규 해금 알림 표시 ──
    if (this._newlyUnlocked.length > 0) {
      this._showUnlockNotifications();
    }

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

    // ── 하단 버튼 ──
    const btnY = GAME_HEIGHT - 60;

    // 뒤로가기 버튼 (좌)
    this._createBtn(centerX - 60, btnY, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this._onBack();
    });

    // 출격 버튼 (우) — 스테이지 인트로 미시청 시 컷신 → GameScene
    this._createBtn(centerX + 60, btnY, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SaveManager.setSelectedCharacter(this._selectedId);
      const stageNum = this._stageId.replace('stage_', '');
      const introId = `stage_${stageNum}_intro`;

      const selectedDifficulty = SaveManager.getSelectedDifficulty();
      if (!SaveManager.isCutsceneViewed(introId)) {
        this.scene.start('CutsceneScene', {
          cutsceneId: introId,
          nextScene: 'GameScene',
          nextSceneData: {
            characterId: this._selectedId,
            stageId: this._stageId,
            difficulty: selectedDifficulty,
          },
          characterId: this._selectedId,
        });
      } else {
        this.scene.start('GameScene', {
          characterId: this._selectedId,
          stageId: this._stageId,
          difficulty: selectedDifficulty,
        });
      }
    });

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 뒤로가기 ──

  /** 스테이지 선택 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('StageSelectScene');
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
    bg.fillStyle(0x002244, 0.9);
    bg.fillRoundedRect(centerX - 130, toastY - 18, 260, 36, 8);
    bg.lineStyle(2, COLORS.NEON_CYAN, 0.8);
    bg.strokeRoundedRect(centerX - 130, toastY - 18, 260, 36, 8);
    bg.setDepth(500).setAlpha(0);

    // 텍스트
    const text = this.add.text(centerX, toastY, message, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: '#000000',
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

  // ── 캐릭터 카드 ──

  /**
   * 캐릭터 카드를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} charData - 캐릭터 데이터
   * @param {boolean} isUnlocked - 해금 여부
   * @private
   */
  _createCharCard(x, y, charData, isUnlocked) {
    const isSelected = this._selectedId === charData.id;
    const cardHeight = (isSelected && isUnlocked) ? CARD_H_EXPANDED : CARD_H;
    const prog = SaveManager.getCharacterProgression(charData.id);

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, isUnlocked ? 0.9 : 0.4);
    bg.fillRoundedRect(x - CARD_W / 2, y - cardHeight / 2, CARD_W, cardHeight, 8);

    // 선택된 캐릭터 하이라이트
    if (isSelected && isUnlocked) {
      bg.lineStyle(2, COLORS.NEON_CYAN, 1);
    } else if (isUnlocked) {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.5);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.2);
    }
    bg.strokeRoundedRect(x - CARD_W / 2, y - cardHeight / 2, CARD_W, cardHeight, 8);

    this._container.add(bg);

    if (isUnlocked) {
      const topY = y - cardHeight / 2;

      // 이름 + 레벨
      const lvStr = prog.level >= MAX_CHAR_LEVEL ? t('charLevel.maxLevel') : `Lv.${prog.level}`;
      const nameText = this.add.text(x - CARD_W / 2 + 16, topY + 12, `${t(charData.nameKey)}  ${lvStr}`, {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: isSelected ? UI_COLORS.neonCyan : UI_COLORS.textPrimary,
      });
      this._container.add(nameText);

      // XP 바 (작은 가로 바)
      const xpBarX = x - CARD_W / 2 + 16;
      const xpBarY = topY + 32;
      const xpBarW = 160;
      const xpBarH = 4;
      const needed = getXpForNextLevel(prog.level);
      const xpRatio = needed > 0 ? Math.min(1, prog.xp / needed) : 1;

      const xpBarBg = this.add.graphics();
      xpBarBg.fillStyle(0x333333, 0.6);
      xpBarBg.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
      this._container.add(xpBarBg);

      const xpBarFill = this.add.graphics();
      const charColor = CHARACTER_COLORS[charData.id] || COLORS.NEON_CYAN;
      xpBarFill.fillStyle(charColor, 0.8);
      xpBarFill.fillRect(xpBarX, xpBarY, xpBarW * xpRatio, xpBarH);
      this._container.add(xpBarFill);

      // XP 수치
      const xpStr = needed > 0 ? `${prog.xp}/${needed}` : 'MAX';
      const xpText = this.add.text(xpBarX + xpBarW + 8, xpBarY - 2, xpStr, {
        fontSize: '9px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      });
      this._container.add(xpText);

      // SP 배지 (미사용 SP가 있으면 강조)
      if (prog.sp > 0) {
        const spBadge = this.add.text(x + CARD_W / 2 - 16, topY + 12, t('charLevel.sp', prog.sp), {
          fontSize: '11px',
          fontFamily: 'Galmuri11, monospace',
          color: '#FFD700',
          backgroundColor: '#333300',
          padding: { x: 4, y: 2 },
        }).setOrigin(1, 0);
        this._container.add(spBadge);
      }

      if (!isSelected) {
        // 미선택: 간단 설명
        const passiveText = this.add.text(x - CARD_W / 2 + 16, topY + 44, t(charData.passiveKey), {
          fontSize: '11px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
          wordWrap: { width: CARD_W - 32 },
        });
        this._container.add(passiveText);

        const descText = this.add.text(x - CARD_W / 2 + 16, topY + 62, t(charData.descKey), {
          fontSize: '11px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
          wordWrap: { width: CARD_W - 32 },
        }).setAlpha(0.7);
        this._container.add(descText);
      } else {
        // 선택됨: 스킬 4행 표시
        this._renderSkillRows(x, topY, charData.id, prog);
      }

      // 터치 영역
      const zone = this.add.zone(x, y, CARD_W, cardHeight)
        .setInteractive({ useHandCursor: true });
      this._container.add(zone);

      zone.on('pointerdown', () => {
        this._selectedId = charData.id;
        // 전체 UI 재생성
        this._rebuildCards();
      });
    } else {
      // 잠금 상태: 잠금 아이콘 + 가독성 확보된 텍스트
      const lockIcon = this.add.text(x - CARD_W / 2 + 16, y - 16, '\uD83D\uDD12', {
        fontSize: '14px',
      });
      this._container.add(lockIcon);

      const lockText = this.add.text(x - CARD_W / 2 + 38, y - 15, t(charData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setAlpha(0.7);
      this._container.add(lockText);

      const condText = this.add.text(x - CARD_W / 2 + 38, y + 8, charData.unlockKey ? t(charData.unlockKey) : t('menu.locked'), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }).setAlpha(0.5);
      this._container.add(condText);
    }
  }

  /**
   * 선택된 카드의 스킬 4행을 렌더링한다.
   * @param {number} x - 카드 중심 X
   * @param {number} topY - 카드 상단 Y
   * @param {string} charId - 캐릭터 ID
   * @param {Object} prog - 캐릭터 진행 데이터
   * @private
   */
  _renderSkillRows(x, topY, charId, prog) {
    const skillDefs = CHARACTER_SKILLS[charId];
    if (!skillDefs) return;

    const slots = ['Q', 'W', 'E', 'R'];
    const startY = topY + 50;
    const rowH = 36;
    const leftX = x - CARD_W / 2 + 12;

    slots.forEach((slot, i) => {
      const skill = skillDefs[slot];
      if (!skill) return;

      const rowY = startY + i * rowH;
      const lv = prog.skills[slot] || 0;

      // 슬롯 라벨
      const label = this.add.text(leftX, rowY, `[${slot}]`, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      });
      this._container.add(label);

      // 스킬명
      const skillName = this.add.text(leftX + 30, rowY, t(skill.nameKey), {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      });
      this._container.add(skillName);

      // R 잠금 상태 체크
      if (slot === 'R' && !canInvestUlt(prog.level, lv)) {
        const gate = lv < 3 ? [6, 11, 16][lv] : 16;
        const lockStr = t('skill.locked', gate);
        const lockLabel = this.add.text(x + CARD_W / 2 - 16, rowY, lockStr, {
          fontSize: '10px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
        }).setOrigin(1, 0).setAlpha(0.6);
        this._container.add(lockLabel);
        return;
      }

      // 레벨 표시
      const lvText = this.add.text(x + CARD_W / 2 - 70, rowY, `${lv}/${skill.maxLevel}`, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: lv >= skill.maxLevel ? UI_COLORS.neonGreen : UI_COLORS.textPrimary,
      }).setOrigin(1, 0);
      this._container.add(lvText);

      // [+1] 버튼
      const canUpgrade = prog.sp >= 1 && lv < skill.maxLevel &&
        (slot !== 'R' || canInvestUlt(prog.level, lv));

      const btnX = x + CARD_W / 2 - 28;
      const btnW = 36;
      const btnH = 32;

      const btnBg = this.add.graphics();
      const btnColor = canUpgrade ? 0x00AAAA : 0x333344;
      btnBg.fillStyle(btnColor, 0.8);
      btnBg.fillRoundedRect(btnX - btnW / 2, rowY - 2, btnW, btnH, 4);
      this._container.add(btnBg);

      const btnLabel = this.add.text(btnX, rowY + btnH / 2 - 2, t('skill.upgrade'), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: canUpgrade ? '#FFFFFF' : '#666666',
      }).setOrigin(0.5);
      this._container.add(btnLabel);

      if (canUpgrade) {
        const btnZone = this.add.zone(btnX, rowY + btnH / 2 - 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        this._container.add(btnZone);

        btnZone.on('pointerdown', () => {
          const success = SaveManager.allocateSkillPoint(charId, slot);
          if (success) {
            SoundSystem.play('levelup');
            this._rebuildCards();
          }
        });
      }
    });
  }

  /**
   * 카드 리스트를 전체 재생성한다.
   * @private
   */
  _rebuildCards() {
    this._container.removeAll(true);
    this._cardElements = [];
    const stats = SaveManager.getStats();
    const visibleChars = CHARACTERS.filter(c => c.phase <= 3);
    let accY = LIST_START_Y;
    visibleChars.forEach((cd) => {
      const unlocked = this._isCharUnlocked(cd, stats);
      const isSelected = this._selectedId === cd.id;
      const cardHeight = (isSelected && unlocked) ? CARD_H_EXPANDED : CARD_H;
      const cardY = accY + cardHeight / 2;
      this._createCharCard(GAME_WIDTH / 2, cardY, cd, unlocked);
      accY += cardHeight + CARD_GAP;
    });
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
