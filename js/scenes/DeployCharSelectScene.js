/**
 * @fileoverview 출격 전용 캐릭터 선택 씬.
 *
 * StageSelectScene에서 스테이지/난이도 선택 후 진입한다.
 * 해금된 캐릭터만 좌우 탐색하고, 선택 후 "출격" 버튼으로 GameScene에 진입한다.
 * CharacterScene(도감/스킬투자용)과 역할을 분리한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { CHARACTERS } from '../data/characters.js';
import { CHARACTER_COLORS } from '../data/characterSkills.js';

// ── DeployCharSelectScene 클래스 ──

export default class DeployCharSelectScene extends Phaser.Scene {
  constructor() {
    super('DeployCharSelectScene');
  }

  /**
   * 씬 초기화 데이터를 수신한다.
   * @param {{ stageId: string, difficulty: string }} data - 스테이지/난이도 정보
   */
  init(data) {
    /** @type {string} 선택된 스테이지 ID */
    this._stageId = data?.stageId || 'stage_1';
    /** @type {string} 선택된 난이도 */
    this._difficulty = data?.difficulty || 'normal';
  }

  /**
   * 출격 캐릭터 선택 UI를 생성한다.
   */
  create() {
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 */
    this._transitioning = false;

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 해금된 캐릭터만 필터 ──
    this._chars = CHARACTERS.filter(c =>
      c.phase <= 3 && (SaveManager.isCharacterUnlocked(c.id) || !c.unlockCondition)
    );

    // 현재 선택 인덱스
    const selectedId = SaveManager.getSelectedCharacter() || 'agent';
    /** @type {number} 현재 캐릭터 인덱스 */
    this._currentIndex = Math.max(0, this._chars.findIndex(c => c.id === selectedId));

    /** @type {Array<Phaser.GameObjects.GameObject>} 동적 요소 */
    this._dynamicElements = [];

    // ── 상단 헤더 ──
    this._createBackArrow(30, 30);
    this.add.text(centerX, 30, t('deploy.selectCharacter'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 좌우 화살표 ──
    this._createNavArrow(30, 260, '\u25C0', -1);
    this._createNavArrow(330, 260, '\u25B6', 1);

    // ── 하단 출격 버튼 ──
    this._createDeployBtn(centerX, GAME_HEIGHT - 70);

    // ── 하단 뒤로가기 ──
    this._createSmallBtn(centerX, GAME_HEIGHT - 25, t('ui.back'), () => this._onBack());

    // ── ESC 키 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // ── 스와이프 ──
    this._swipeStartX = 0;
    this.input.on('pointerdown', (p) => { this._swipeStartX = p.x; });
    this.input.on('pointerup', (p) => {
      const dx = p.x - this._swipeStartX;
      if (Math.abs(dx) >= 40) {
        const dir = dx < 0 ? 1 : -1;
        this._currentIndex = (this._currentIndex + dir + this._chars.length) % this._chars.length;
        this._refreshDisplay();
      }
    });

    this._refreshDisplay();
  }

  // ── 동적 UI 갱신 ──

  /**
   * 현재 캐릭터 정보로 동적 요소를 갱신한다.
   * @private
   */
  _refreshDisplay() {
    this._dynamicElements.forEach(el => { if (el?.destroy) el.destroy(); });
    this._dynamicElements = [];

    const centerX = GAME_WIDTH / 2;
    const charData = this._chars[this._currentIndex];
    const charColor = CHARACTER_COLORS[charData.id] || COLORS.NEON_CYAN;
    const charColorStr = '#' + charColor.toString(16).padStart(6, '0');

    // ── 초상화 ──
    this._renderPortrait(centerX, 220, charData, charColor);

    // ── 이름 ──
    const nameText = this.add.text(centerX, 370, t(charData.nameKey), {
      fontSize: '22px',
      fontFamily: 'Galmuri11, monospace',
      color: charColorStr,
    }).setOrigin(0.5);
    this._dynamicElements.push(nameText);

    // ── 패시브 설명 ──
    const passiveText = this.add.text(centerX, 400, t(charData.passiveKey), {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: 300 },
      align: 'center',
    }).setOrigin(0.5);
    this._dynamicElements.push(passiveText);

    // ── 인디케이터 도트 ──
    this._renderDots(centerX, 450, charColor);

    // 선택 저장
    SaveManager.setSelectedCharacter(charData.id);
  }

  // ── 초상화 렌더링 ──

  /**
   * 캐릭터 초상화를 렌더링한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} charData - 캐릭터 데이터
   * @param {number} charColor - 캐릭터 색상
   * @private
   */
  _renderPortrait(x, y, charData, charColor) {
    // 글로우 배경
    const bgKey = `char_portrait_bg_${charData.id}`;
    if (this.textures.exists(bgKey)) {
      const bgImg = this.add.image(x, y, bgKey).setOrigin(0.5);
      this._dynamicElements.push(bgImg);
    }

    // 컷씬 포트레이트
    const portraitKey = `portrait_${charData.id}`;
    if (this.textures.exists(portraitKey)) {
      const portrait = this.add.image(x - 55, y - 5, portraitKey)
        .setOrigin(0.5)
        .setDisplaySize(150, 150);
      this._dynamicElements.push(portrait);
    }

    // SD 스프라이트
    const spriteKey = charData.spriteKey;
    if (this.textures.exists(spriteKey)) {
      const sprite = this.add.image(x + 70, y + 15, spriteKey)
        .setOrigin(0.5)
        .setScale(3.5);
      this._dynamicElements.push(sprite);
    }
  }

  // ── 인디케이터 도트 ──

  /**
   * 캐릭터 인디케이터 도트를 렌더링한다.
   * @param {number} centerX - 중심 X
   * @param {number} y - Y 좌표
   * @param {number} currentColor - 현재 캐릭터 색상
   * @private
   */
  _renderDots(centerX, y, currentColor) {
    const count = this._chars.length;
    const gap = 20;
    const startX = centerX - ((count - 1) * gap) / 2;
    const gfx = this.add.graphics();
    this._dynamicElements.push(gfx);

    this._chars.forEach((cd, i) => {
      const dotX = startX + i * gap;
      const dotColor = CHARACTER_COLORS[cd.id] || COLORS.TEXT_GRAY;
      if (i === this._currentIndex) {
        gfx.fillStyle(currentColor, 1);
        gfx.fillCircle(dotX, y, 5);
      } else {
        gfx.fillStyle(dotColor, 0.4);
        gfx.fillCircle(dotX, y, 4);
      }

      // 탭으로 캐릭터 전환
      if (i !== this._currentIndex) {
        const zone = this.add.zone(dotX, y, 20, 20).setInteractive({ useHandCursor: true });
        zone.on('pointerup', () => {
          this._currentIndex = i;
          this._refreshDisplay();
        });
        this._dynamicElements.push(zone);
      }
    });
  }

  // ── 출격 버튼 ──

  /**
   * 출격(Deploy) 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createDeployBtn(x, y) {
    const btnW = 200;
    const btnH = 48;

    const bg = this.add.graphics();
    bg.fillStyle(UI_COLORS.btnPrimary, 0.9);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);
    bg.lineStyle(2, COLORS.NEON_CYAN, 0.8);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 8);

    const text = this.add.text(x, y, t('menu.start'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: '#FFFFFF',
    }).setOrigin(0.5);

    // 글로우 깜빡임
    this.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0.7 },
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: 'Sine.easeInOut',
    });

    const zone = this.add.zone(x, y, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; text.setAlpha(0.5); });
    zone.on('pointerup', () => {
      text.setAlpha(1);
      if (pressed) this._onDeploy();
      pressed = false;
    });
    zone.on('pointerout', () => { pressed = false; text.setAlpha(1); });
  }

  // ── 액션 ──

  /**
   * 출격 — GameScene으로 진입한다.
   * @private
   */
  _onDeploy() {
    const charData = this._chars[this._currentIndex];
    SaveManager.setSelectedCharacter(charData.id);
    this._fadeToScene('GameScene', {
      characterId: charData.id,
      stageId: this._stageId,
      difficulty: this._difficulty,
    });
  }

  /** 이전 화면(StageSelectScene)으로 돌아간다. */
  _onBack() {
    this._fadeToScene('StageSelectScene');
  }

  // ── 네비게이션 유틸 ──

  /**
   * 뒤로 화살표를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @private
   */
  _createBackArrow(x, y) {
    const text = this.add.text(x, y, '\u2190', {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, 36, 36).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => text.setAlpha(0.5));
    zone.on('pointerup', () => { text.setAlpha(1); this._onBack(); });
    zone.on('pointerout', () => text.setAlpha(1));
  }

  /**
   * 좌우 네비게이션 화살표를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} symbol - 화살표 문자
   * @param {number} direction - 방향 (-1 또는 +1)
   * @private
   */
  _createNavArrow(x, y, symbol, direction) {
    const text = this.add.text(x, y, symbol, {
      fontSize: '24px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, 44, 44).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => text.setAlpha(0.5));
    zone.on('pointerup', () => {
      text.setAlpha(1);
      this._currentIndex = (this._currentIndex + direction + this._chars.length) % this._chars.length;
      this._refreshDisplay();
    });
    zone.on('pointerout', () => text.setAlpha(1));
  }

  /**
   * 소형 텍스트 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 텍스트
   * @param {Function} callback - 콜백
   * @private
   */
  _createSmallBtn(x, y, label, callback) {
    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, 80, 28).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => text.setAlpha(0.5));
    zone.on('pointerup', () => { text.setAlpha(1); callback(); });
    zone.on('pointerout', () => text.setAlpha(1));
  }

  /**
   * 페이드 아웃 후 씬을 전환한다.
   * @param {string} sceneName - 전환할 씬
   * @param {Object} [data] - 전달 데이터
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
}
