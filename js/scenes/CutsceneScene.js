/**
 * @fileoverview 컷신(비주얼 노벨) 씬. 스토리 대사를 타이핑 애니메이션으로 표시하고,
 * 초상화, 화자 이름, Skip 버튼, 다음 대사 진행 등을 관리한다.
 * 컷신 종료 시 SaveManager에 시청 기록을 남기고 다음 씬으로 전환한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { getCutsceneById } from '../data/story.js';

// ── CutsceneScene 클래스 ──

export default class CutsceneScene extends Phaser.Scene {
  constructor() {
    super('CutsceneScene');
  }

  // ── 초기화 ──

  /**
   * 씬 초기화. 외부에서 전달받은 컷신 데이터를 저장한다.
   * @param {Object} data - 씬 전환 시 전달되는 데이터
   * @param {string} data.cutsceneId - 재생할 컷신 ID ('prologue', 'stage_1_intro', ...)
   * @param {string} data.nextScene - 컷신 종료 후 이동할 씬 키
   * @param {Object} [data.nextSceneData] - 다음 씬에 전달할 데이터
   * @param {string} [data.characterId] - 선택한 캐릭터 (대사 분기용)
   */
  init(data) {
    this.cutsceneId = data.cutsceneId;
    this.nextScene = data.nextScene;
    this.nextSceneData = data.nextSceneData || {};
    this.characterId = data.characterId || null;
    /** @type {boolean} 컷신 종료 처리 완료 여부 (중복 방지) */
    this._ended = false;
  }

  // ── 씬 생성 ──

  /**
   * 컷신 UI를 구성하고 첫 대사를 시작한다.
   * 컷신 데이터가 없으면 즉시 다음 씬으로 전환한다.
   */
  create() {
    const cutsceneData = getCutsceneById(this.cutsceneId);
    if (!cutsceneData) {
      this.scene.start(this.nextScene, this.nextSceneData);
      return;
    }

    this._dialogues = cutsceneData.dialogues;
    this._currentIndex = 0;

    /** @type {boolean} 타이핑 애니메이션 진행 중 여부 */
    this._typing = false;
    /** @type {string} 현재 대사 전체 텍스트 */
    this._fullText = '';
    /** @type {number} 타이핑 중 현재 문자 인덱스 */
    this._charIndex = 0;
    /** @type {Phaser.Time.TimerEvent|null} 타이핑 타이머 */
    this._typeTimer = null;
    /** @type {Phaser.GameObjects.Image|Phaser.GameObjects.Text|null} 현재 초상화 */
    this._portrait = null;
    /** @type {Phaser.GameObjects.Text|null} 다음 대사 표시기 */
    this._nextIndicator = null;

    // 배경
    this._createBackground(cutsceneData.bgKey || 'bg_tile');
    // 대화 박스
    this._createDialogBox();
    // Skip 버튼
    this._createSkipButton();
    // 화면 클릭/탭 이벤트
    this.input.on('pointerdown', (pointer) => this._onTap(pointer));
    // ESC 키로 스킵
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // 첫 대사 시작
    this._showDialogue(0);
  }

  // ── 배경 ──

  /**
   * 배경 이미지를 생성한다. 텍스처가 있으면 이미지를, 없으면 타일링 배경을 사용한다.
   * @param {string} bgKey - 배경 텍스처 키
   * @private
   */
  _createBackground(bgKey) {
    this.cameras.main.setBackgroundColor(COLORS.BG);

    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.6)
        .setDepth(0);
    } else if (this.textures.exists('bg_tile')) {
      // bg_tile 텍스처로 타일링 배경
      this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg_tile')
        .setAlpha(0.4)
        .setDepth(0);
    }
    // 둘 다 없으면 단색 배경만 사용
  }

  // ── 대화 박스 ──

  /**
   * 대화 박스 UI 요소를 생성한다 (반투명 패널, 화자 이름, 대화 텍스트).
   * @private
   */
  _createDialogBox() {
    // 반투명 배경 패널
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x000000, 0.85);
    dialogBg.fillRoundedRect(10, 460, 340, 160, 8);
    dialogBg.lineStyle(1, COLORS.NEON_CYAN, 0.6);
    dialogBg.strokeRoundedRect(10, 460, 340, 160, 8);
    dialogBg.setDepth(5);

    // 화자 이름 (대사창 위 왼쪽)
    this._nameText = this.add.text(15, 448, '', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0, 0.5).setDepth(15);

    // 대화 텍스트 (타이핑 애니메이션)
    this._dialogText = this.add.text(20, 475, '', {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: '#FFFFFF',
      wordWrap: { width: 310 },
      lineSpacing: 6,
    }).setOrigin(0, 0).setDepth(15);
  }

  // ── 타이핑 애니메이션 ──

  /**
   * 대사 텍스트를 한 글자씩 타이핑 애니메이션으로 표시한다.
   * @param {string} fullText - 표시할 전체 텍스트
   * @private
   */
  _startTyping(fullText) {
    this._fullText = fullText;
    this._charIndex = 0;
    this._typing = true;
    this._dialogText.setText('');
    this._hideNextIndicator();

    // 빈 텍스트면 즉시 완료 처리
    if (!fullText || fullText.length === 0) {
      this._typing = false;
      this._showNextIndicator();
      return;
    }

    this._typeTimer = this.time.addEvent({
      delay: 30, // 30ms per character
      callback: () => {
        this._charIndex++;
        this._dialogText.setText(this._fullText.substring(0, this._charIndex));
        if (this._charIndex >= this._fullText.length) {
          this._typing = false;
          this._typeTimer.remove();
          this._showNextIndicator();
        }
      },
      repeat: this._fullText.length - 1,
    });
  }

  // ── 탭/클릭 처리 ──

  /**
   * 화면 탭 시 처리. 타이핑 중이면 즉시 완성, 완성 상태면 다음 대사로 진행한다.
   * Skip 버튼 영역 터치는 무시한다.
   * @param {Phaser.Input.Pointer} pointer - 포인터 이벤트 객체
   * @private
   */
  _onTap(pointer) {
    // Skip 버튼 영역(우상단)은 제외 — 버튼 자체가 처리
    if (pointer && pointer.x > 290 && pointer.y < 50) return;

    if (this._typing) {
      // 타이핑 중이면 즉시 완성
      if (this._typeTimer) this._typeTimer.remove();
      this._typing = false;
      this._dialogText.setText(this._fullText);
      this._showNextIndicator();
    } else {
      // 완성 상태면 다음 대사로
      this._nextDialogue();
    }
  }

  // ── 초상화 ──

  /**
   * 화자의 초상화를 표시한다. 텍스처가 없으면 이니셜 텍스트로 폴백한다.
   * @param {string|null} portraitKey - 초상화 텍스처 키 (null이면 초상화 비표시)
   * @param {string} [side='left'] - 초상화 위치 ('left' 또는 'right')
   * @private
   */
  _showPortrait(portraitKey, side = 'left') {
    if (this._portrait) {
      this._portrait.destroy();
      this._portrait = null;
    }

    if (!portraitKey) return; // narrator는 초상화 없음

    // 오른쪽 끝, 초상화 하단이 대사창 상단(y=460)에 정확히 닿도록 배치
    const x = 310;
    const y = 410;

    // 텍스처 존재 확인 → 없거나 로드 실패(__MISSING) 시 폴백
    const tex = this.textures.exists(portraitKey) ? this.textures.get(portraitKey) : null;
    const hasValidTexture = tex && tex.key !== '__MISSING' && tex.getSourceImage().width > 1;

    if (hasValidTexture) {
      this._portrait = this.add.image(x, y, portraitKey)
        .setDisplaySize(100, 100)
        .setOrigin(0.5)
        .setDepth(10);
    } else {
      // 폴백: 이니셜 텍스트
      const initial = portraitKey.replace('portrait_', '').charAt(0).toUpperCase();
      this._portrait = this.add.text(x, y, initial, {
        fontSize: '36px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonCyan,
      }).setOrigin(0.5).setDepth(10);
    }
  }

  // ── 대사 진행 ──

  /**
   * 지정 인덱스의 대사를 표시한다. 모든 대사 완료 시 컷신을 종료한다.
   * @param {number} index - 대사 인덱스
   * @private
   */
  _showDialogue(index) {
    if (index >= this._dialogues.length) {
      this._endCutscene();
      return;
    }
    this._currentIndex = index;
    const d = this._dialogues[index];

    // 화자 이름
    const speakerName = d.speaker === 'narrator' ? '' : t(`character.${d.speaker}.name`);
    this._nameText.setText(speakerName);

    // 초상화
    this._showPortrait(d.portrait, d.side || 'left');

    // 타이핑 시작
    this._startTyping(t(d.textKey));
  }

  /**
   * 다음 대사로 진행한다.
   * @private
   */
  _nextDialogue() {
    this._showDialogue(this._currentIndex + 1);
  }

  // ── 다음 표시기 ──

  /**
   * 대사 완료 시 우하단에 ▶ 깜빡임 표시기를 보여준다.
   * @private
   */
  _showNextIndicator() {
    if (this._nextIndicator) {
      this._nextIndicator.setVisible(true);
      return;
    }

    this._nextIndicator = this.add.text(340, 608, '\u25B6', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(1, 1).setDepth(20);

    // 깜빡임 트윈
    this.tweens.add({
      targets: this._nextIndicator,
      alpha: { from: 1, to: 0.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * 다음 표시기를 숨긴다.
   * @private
   */
  _hideNextIndicator() {
    if (this._nextIndicator) {
      this._nextIndicator.setVisible(false);
    }
  }

  // ── Skip 버튼 ──

  /**
   * 우상단에 Skip 버튼을 생성한다.
   * @private
   */
  _createSkipButton() {
    const btn = this.add.text(330, 20, 'Skip \u25B6\u25B6', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(20);

    btn.on('pointerdown', () => {
      this._skipCutscene();
    });
  }

  /**
   * 컷신을 스킵한다. 시청 기록을 남기고 다음 씬으로 전환한다.
   * @private
   */
  _skipCutscene() {
    // 중복 호출 방지
    if (this._ended) return;
    this._ended = true;

    // 입력 이벤트 제거 (다음 씬으로 클릭 전파 방지)
    this.input.removeAllListeners();

    // 본 것으로 기록
    SaveManager.viewCutscene(this.cutsceneId);
    // 다음 씬으로
    this.scene.start(this.nextScene, this.nextSceneData);
  }

  // ── 컷신 종료 ──

  /**
   * 컷신을 정상 종료한다. 시청 기록을 남기고 다음 씬으로 전환한다.
   * @private
   */
  _endCutscene() {
    // 중복 호출 방지
    if (this._ended) return;
    this._ended = true;

    // 입력 이벤트 제거 (다음 씬으로 클릭 전파 방지)
    this.input.removeAllListeners();

    SaveManager.viewCutscene(this.cutsceneId);
    this.scene.start(this.nextScene, this.nextSceneData);
  }

  // ── 뒤로가기 ──

  /**
   * ESC 키 등으로 뒤로 갈 때 컷신을 스킵한다.
   * @private
   */
  _onBack() {
    this._skipCutscene();
  }
}
