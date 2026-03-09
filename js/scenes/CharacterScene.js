/**
 * @fileoverview 캐릭터 선택 화면 씬.
 *
 * 해금된/잠금된 캐릭터를 세로 스크롤 리스트로 표시하고,
 * 선택한 캐릭터로 GameScene을 시작한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { CHARACTERS, getCharacterById } from '../data/characters.js';

// ── 레이아웃 상수 ──

const CARD_W = 300;
const CARD_H = 80;
const CARD_GAP = 10;
const LIST_START_Y = 100;

// ── CharacterScene 클래스 ──

export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
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
    const contentHeight = visibleChars.length * (CARD_H + CARD_GAP);

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

    // ── 캐릭터 카드 생성 ──
    visibleChars.forEach((charData, i) => {
      const isUnlocked = this._isCharUnlocked(charData, stats);
      const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;

      this._createCharCard(centerX, cardY, charData, isUnlocked);
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

    // ── 하단 버튼 ──
    const btnY = GAME_HEIGHT - 60;

    // 출격 버튼
    this._createBtn(centerX - 60, btnY, t('menu.start'), UI_COLORS.btnPrimary, () => {
      SaveManager.setSelectedCharacter(this._selectedId);
      this.scene.start('GameScene', { characterId: this._selectedId });
    });

    // 뒤로가기 버튼
    this._createBtn(centerX + 60, btnY, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this.scene.start('MenuScene');
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

    // 해금되었으면 SaveManager에 기록
    if (unlocked) {
      SaveManager.unlockCharacter(charData.id);
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

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, isUnlocked ? 0.9 : 0.4);
    bg.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 8);

    // 선택된 캐릭터 하이라이트
    if (isSelected && isUnlocked) {
      bg.lineStyle(2, COLORS.NEON_CYAN, 1);
    } else if (isUnlocked) {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.5);
    } else {
      bg.lineStyle(1, COLORS.UI_BORDER, 0.2);
    }
    bg.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 8);

    this._container.add(bg);

    if (isUnlocked) {
      // 이름
      const nameText = this.add.text(x - CARD_W / 2 + 16, y - 25, t(charData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: isSelected ? UI_COLORS.neonCyan : UI_COLORS.textPrimary,
      });
      this._container.add(nameText);

      // 고유 패시브 설명
      const passiveText = this.add.text(x - CARD_W / 2 + 16, y, t(charData.passiveKey), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: CARD_W - 32 },
      });
      this._container.add(passiveText);

      // 설명
      const descText = this.add.text(x - CARD_W / 2 + 16, y + 18, t(charData.descKey), {
        fontSize: '9px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
        wordWrap: { width: CARD_W - 32 },
      }).setAlpha(0.7);
      this._container.add(descText);

      // 터치 영역
      const zone = this.add.zone(x, y, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true });
      this._container.add(zone);

      zone.on('pointerdown', () => {
        this._selectedId = charData.id;
        // 전체 UI 재생성
        this._container.removeAll(true);
        this._cardElements = [];
        const stats = SaveManager.getStats();
        const visibleChars = CHARACTERS.filter(c => c.phase <= 3);
        visibleChars.forEach((cd, i) => {
          const unlocked = this._isCharUnlocked(cd, stats);
          const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;
          this._createCharCard(GAME_WIDTH / 2, cardY, cd, unlocked);
        });
      });
    } else {
      // 잠금 상태: 반투명 + 잠금 조건 표시
      const lockText = this.add.text(x - CARD_W / 2 + 16, y - 15, t(charData.nameKey), {
        fontSize: '14px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setAlpha(0.4);
      this._container.add(lockText);

      const condText = this.add.text(x - CARD_W / 2 + 16, y + 8, charData.unlockKey ? t(charData.unlockKey) : t('menu.locked'), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textSecondary,
      }).setAlpha(0.4);
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

    zone.on('pointerdown', () => { text.setAlpha(0.6); });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (callback) callback();
    });
  }
}
