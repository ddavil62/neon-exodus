/**
 * @fileoverview 개발/QA용 디버그 패널 씬.
 *
 * SettingsScene 버전 텍스트 5연타로 진입한다 (DEV_MODE=true 필수).
 * 5개 탭(캐릭터/전투/진행/재화/세이브)과 하단 콘솔 입력창을 제공하여
 * 게임 상태를 즉시 조작할 수 있다. window.__DEBUG 객체를 통해
 * GameScene/WeaponSystem과 실시간 통신한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, SAVE_KEY, XP_FORMULA } from '../config.js';
import { SaveManager } from '../managers/SaveManager.js';

// ── 상수 ──

/** 탭 ID 배열 */
const TABS = ['char', 'battle', 'progress', 'currency', 'save'];

/** 탭 표시 레이블 */
const TAB_LABELS = {
  char: '캐릭터',
  battle: '전투',
  progress: '진행',
  currency: '재화',
  save: '세이브',
};

/** 모든 캐릭터 ID 목록 */
const ALL_CHARACTER_IDS = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];

/** 유효 난이도 목록 */
const VALID_DIFFICULTIES = ['normal', 'hard', 'nightmare'];

/** 버튼 기본 배경색 */
const BTN_BG = 0x1A1A2E;

/** 버튼 테두리색 */
const BTN_BORDER = 0x334466;

/** 버튼 눌림 배경색 */
const BTN_PRESSED_BG = 0x2A2A5E;

/** 토글 ON 배경색 */
const TOGGLE_ON_BG = 0x003300;

/** 토글 ON 테두리색 */
const TOGGLE_ON_BORDER = 0x39FF14;

/** 콘솔 출력 최대 줄 수 */
const CONSOLE_MAX_LINES = 3;

// ── DebugPanelScene 클래스 ──

export default class DebugPanelScene extends Phaser.Scene {
  constructor() {
    super('DebugPanelScene');
  }

  /**
   * 디버그 패널 UI를 생성한다.
   */
  create() {
    // ── window.__DEBUG 초기화 ──
    window.__DEBUG = { godMode: false, noCooldown: false, atkX10: false };

    // ── 씬 종료 시 __DEBUG 초기화 ──
    this.events.on('shutdown', () => {
      window.__DEBUG = { godMode: false, noCooldown: false, atkX10: false };
      this._destroyDOMElements();
    });

    // 씬 진입 페이드
    this.cameras.main.fadeIn(250, 0, 0, 0);

    /** @type {boolean} 씬 전환 중 여부 */
    this._transitioning = false;

    /** @type {string} 현재 활성 탭 */
    this._activeTab = 'char';

    /** @type {Object.<string, Phaser.GameObjects.GameObject[]>} 탭별 콘텐츠 오브젝트 */
    this._tabContents = {};
    TABS.forEach(tab => { this._tabContents[tab] = []; });

    /** @type {string[]} 콘솔 출력 로그 */
    this._consoleLines = [];

    /** @type {Phaser.GameObjects.Text[]} 콘솔 출력 텍스트 오브젝트 */
    this._consoleTexts = [];

    /** @type {boolean} 세이브 초기화 1단계 확인 상태 */
    this._resetConfirmStep = false;

    /** @type {Phaser.Time.TimerEvent|null} 초기화 확인 타이머 */
    this._resetTimer = null;

    /** @type {HTMLElement|null} DOM input 요소 */
    this._domInput = null;

    /** @type {HTMLElement|null} DOM textarea 요소 (내보내기/가져오기용) */
    this._domTextarea = null;

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.97);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── 상단 바 ──
    this._createTopBar(centerX);

    // ── 탭 바 ──
    this._createTabBar(centerX);

    // ── 탭별 콘텐츠 생성 ──
    this._createCharTab(centerX);
    this._createBattleTab(centerX);
    this._createProgressTab(centerX);
    this._createCurrencyTab(centerX);
    this._createSaveTab(centerX);

    // ── 콘솔 영역 ──
    this._createConsoleArea(centerX);

    // ── 초기 탭 표시 ──
    this._showTab('char');

    // ── ESC 키 리스너 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  // ── 상단 바 ──

  /**
   * 상단 뒤로가기 버튼과 타이틀을 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createTopBar(centerX) {
    // 뒤로가기 버튼
    const backText = this.add.text(20, 25, '\u2190', {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: '#00FFFF',
    }).setOrigin(0, 0.5);

    const backZone = this.add.zone(30, 25, 44, 44).setInteractive({ useHandCursor: true });
    backZone.on('pointerdown', () => { backText.setAlpha(0.5); });
    backZone.on('pointerup', () => { backText.setAlpha(1); this._onBack(); });
    backZone.on('pointerout', () => { backText.setAlpha(1); });

    // 타이틀
    this.add.text(centerX, 25, 'DEBUG PANEL', {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: '#00FFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  // ── 탭 바 ──

  /**
   * 5개 탭 텍스트 버튼을 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createTabBar(centerX) {
    /** @type {Object.<string, Phaser.GameObjects.Text>} 탭 텍스트 맵 */
    this._tabTexts = {};
    /** @type {Phaser.GameObjects.Graphics} 탭 밑줄 그래픽 */
    this._tabUnderline = this.add.graphics();

    const tabStartX = 36;
    const tabGap = 72;

    TABS.forEach((tab, i) => {
      const x = tabStartX + i * tabGap;
      const text = this.add.text(x, 65, TAB_LABELS[tab], {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: '#555577',
      }).setOrigin(0.5);

      const zone = this.add.zone(x, 65, tabGap - 4, 30).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._showTab(tab));

      this._tabTexts[tab] = text;
    });
  }

  // ── 탭 전환 ──

  /**
   * 지정한 탭을 활성화하고 다른 탭 콘텐츠를 숨긴다.
   * @param {string} tab - 탭 ID
   * @private
   */
  _showTab(tab) {
    this._activeTab = tab;

    // 탭 텍스트 색상 갱신
    TABS.forEach(t => {
      this._tabTexts[t].setColor(t === tab ? '#00FFFF' : '#555577');
    });

    // 탭 밑줄 갱신
    this._tabUnderline.clear();
    const activeText = this._tabTexts[tab];
    this._tabUnderline.fillStyle(0x00FFFF, 1);
    this._tabUnderline.fillRect(
      activeText.x - activeText.width / 2,
      80,
      activeText.width,
      2
    );

    // 콘텐츠 표시/숨기기
    TABS.forEach(t => {
      const visible = t === tab;
      this._tabContents[t].forEach(obj => obj.setVisible(visible));
    });
  }

  // ── 버튼 헬퍼 ──

  /**
   * 일반 액션 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 버튼 텍스트
   * @param {number} width - 버튼 너비
   * @param {Function} onClick - 클릭 콜백
   * @param {string} tabId - 소속 탭 ID
   * @returns {{ gfx: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, zone: Phaser.GameObjects.Zone }}
   * @private
   */
  _createButton(x, y, label, width, onClick, tabId) {
    const height = 44;
    const gfx = this.add.graphics();
    this._drawButtonBg(gfx, x, y, width, height, BTN_BG, BTN_BORDER);

    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: '#AABBCC',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      gfx.clear();
      this._drawButtonBg(gfx, x, y, width, height, BTN_PRESSED_BG, BTN_BORDER);
      this.time.delayedCall(100, () => {
        gfx.clear();
        this._drawButtonBg(gfx, x, y, width, height, BTN_BG, BTN_BORDER);
      });
      onClick();
    });

    this._tabContents[tabId].push(gfx, text, zone);
    return { gfx, text, zone };
  }

  /**
   * 토글 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} labelOff - OFF 상태 레이블
   * @param {string} labelOn - ON 상태 레이블
   * @param {number} width - 버튼 너비
   * @param {Function} onToggle - 토글 콜백 (isOn) => void
   * @param {string} tabId - 소속 탭 ID
   * @returns {{ gfx: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, zone: Phaser.GameObjects.Zone, isOn: boolean }}
   * @private
   */
  _createToggleButton(x, y, labelOff, labelOn, width, onToggle, tabId) {
    const height = 44;
    let isOn = false;

    const gfx = this.add.graphics();
    const text = this.add.text(x, y, `[OFF] ${labelOff}`, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: '#AABBCC',
    }).setOrigin(0.5);

    const drawState = () => {
      gfx.clear();
      if (isOn) {
        this._drawButtonBg(gfx, x, y, width, height, TOGGLE_ON_BG, TOGGLE_ON_BORDER);
        text.setText(`[ON] ${labelOn}`);
        text.setColor('#39FF14');
      } else {
        this._drawButtonBg(gfx, x, y, width, height, BTN_BG, BTN_BORDER);
        text.setText(`[OFF] ${labelOff}`);
        text.setColor('#AABBCC');
      }
    };

    drawState();

    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      isOn = !isOn;
      drawState();
      onToggle(isOn);
    });

    this._tabContents[tabId].push(gfx, text, zone);
    return { gfx, text, zone, get isOn() { return isOn; } };
  }

  /**
   * 버튼 배경(둥근 사각형)을 그린다.
   * @param {Phaser.GameObjects.Graphics} gfx - Graphics 오브젝트
   * @param {number} cx - 중심 X
   * @param {number} cy - 중심 Y
   * @param {number} w - 너비
   * @param {number} h - 높이
   * @param {number} fillColor - 배경색
   * @param {number} strokeColor - 테두리색
   * @private
   */
  _drawButtonBg(gfx, cx, cy, w, h, fillColor, strokeColor) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    gfx.fillStyle(fillColor, 1);
    gfx.fillRoundedRect(x, y, w, h, 6);
    gfx.lineStyle(1, strokeColor, 1);
    gfx.strokeRoundedRect(x, y, w, h, 6);
  }

  // ── 탭별 콘텐츠 생성 ──

  // -- 캐릭터 탭 --

  /**
   * 캐릭터 탭 콘텐츠를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createCharTab(centerX) {
    const tabId = 'char';

    // 레이블: 캐릭터 레벨 설정 안내
    const label1 = this.add.text(centerX, 110, '캐릭터 레벨 설정: (콘솔에서)', {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: '#778899',
    }).setOrigin(0.5);
    this._tabContents[tabId].push(label1);

    const label2 = this.add.text(centerX, 125, 'charlv agent 18', {
      fontSize: '9px',
      fontFamily: 'Galmuri11, monospace',
      color: '#556677',
    }).setOrigin(0.5);
    this._tabContents[tabId].push(label2);

    // 전체 캐릭터 해금 버튼
    this._createButton(centerX, 155, '전체 캐릭터 해금', 200, () => {
      this._unlockAllCharacters();
    }, tabId);
  }

  // -- 전투 탭 --

  /**
   * 전투 탭 콘텐츠를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createBattleTab(centerX) {
    const tabId = 'battle';

    // 갓모드 토글
    this._createToggleButton(centerX, 115, '갓모드', '갓���드', 200, (isOn) => {
      window.__DEBUG.godMode = isOn;
      this._consoleOut(isOn ? '갓모드 ON' : '갓모드 OFF');
    }, tabId);

    // 쿨다운 없음 토글
    this._createToggleButton(centerX, 175, '쿨다운 없음', '쿨다운 없음', 200, (isOn) => {
      window.__DEBUG.noCooldown = isOn;
      this._consoleOut(isOn ? '쿨다운 없음 ON' : '쿨다운 없음 OFF');
    }, tabId);

    // 공격력 x10 토글
    this._createToggleButton(centerX, 235, '공격력 x10', '공격력 x10', 200, (isOn) => {
      window.__DEBUG.atkX10 = isOn;
      this._consoleOut(isOn ? '공격력 x10 ON' : '공격력 x10 OFF');
    }, tabId);
  }

  // -- 진행 탭 --

  /**
   * 진행 탭 콘텐츠를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createProgressTab(centerX) {
    const tabId = 'progress';

    const label1 = this.add.text(centerX, 110, '스테이지: stage stage_1 ~ stage_4', {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: '#778899',
    }).setOrigin(0.5);
    this._tabContents[tabId].push(label1);

    const label2 = this.add.text(centerX, 130, '난이도: diff normal/hard/nightmare', {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: '#778899',
    }).setOrigin(0.5);
    this._tabContents[tabId].push(label2);

    // 웨이브 스킵 버튼
    this._createButton(centerX, 155, '웨이브 스킵', 200, () => {
      this._skipWave();
    }, tabId);
  }

  // -- 재화 탭 --

  /**
   * 재화 탭 콘텐츠를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createCurrencyTab(centerX) {
    const tabId = 'currency';

    // DC +100 버튼
    this._createButton(80, 115, 'DC +100', 140, () => {
      SaveManager.addDataCores(100);
      SaveManager.save();
      this._consoleOut('DC +100 추가');
    }, tabId);

    // DC +1000 버튼
    this._createButton(230, 115, 'DC +1000', 140, () => {
      SaveManager.addDataCores(1000);
      SaveManager.save();
      this._consoleOut('DC +1000 추가');
    }, tabId);

    // DC +10000 버튼
    this._createButton(155, 175, 'DC +10000', 140, () => {
      SaveManager.addDataCores(10000);
      SaveManager.save();
      this._consoleOut('DC +10000 추가');
    }, tabId);

    // 상점 전체 해금 버튼
    this._createButton(centerX, 240, '상점 전체 해금', 200, () => {
      this._unlockAllShop();
    }, tabId);
  }

  // -- 세이브 탭 --

  /**
   * 세이브 탭 콘텐츠를 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createSaveTab(centerX) {
    const tabId = 'save';

    // 세이브 내보내기 버튼
    this._createButton(centerX, 115, '세이브 내보내기', 200, () => {
      this._exportSave();
    }, tabId);

    // 세이브 가져오기 버튼
    this._createButton(centerX, 175, '세이브 가져오기', 200, () => {
      this._importSave();
    }, tabId);

    // 세이브 초기화 버튼
    this._resetBtnRef = this._createButton(centerX, 235, '세이브 초기화', 200, () => {
      this._onResetButton();
    }, tabId);
  }

  // ── 콘솔 영역 ──

  /**
   * 하단 콘솔 입력창과 출력 영역을 생성한다.
   * @param {number} centerX - 화면 중앙 X
   * @private
   */
  _createConsoleArea(centerX) {
    // 구분선
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x334466, 1);
    divider.lineBetween(10, 530, GAME_WIDTH - 10, 530);

    // 프롬프트 레이블
    this.add.text(15, 548, '>', {
      fontSize: '11px',
      fontFamily: 'Galmuri11, monospace',
      color: '#00FFFF',
    });

    // DOM input 생성
    this._createDOMInput();

    // 콘솔 출력 텍스트 (3줄)
    for (let i = 0; i < CONSOLE_MAX_LINES; i++) {
      const txt = this.add.text(15, 575 + i * 18, '', {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: '#778899',
        wordWrap: { width: GAME_WIDTH - 30 },
      });
      this._consoleTexts.push(txt);
    }
  }

  /**
   * DOM input 요소를 생성하여 Phaser 캔버스 위에 배치한다.
   * @private
   */
  _createDOMInput() {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '명령어 입력...';
    input.style.cssText = `
      position: absolute;
      background: #0a0a1a;
      color: #00ffff;
      border: 1px solid #334466;
      font-size: 12px;
      font-family: 'Galmuri11', monospace;
      width: 270px;
      height: 28px;
      padding: 0 6px;
      outline: none;
      z-index: 10;
    `;

    // Phaser 캔버스 기준 위치 계산
    this._positionDOMElement(input, 35, 535, 270, 28);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
          this._executeConsoleCommand(cmd);
        }
        input.value = '';
      }
    });

    document.body.appendChild(input);
    this._domInput = input;
  }

  /**
   * DOM 요소를 Phaser 캔버스 좌표에 맞게 배치한다.
   * @param {HTMLElement} el - DOM 요소
   * @param {number} gameX - 게임 좌표 X
   * @param {number} gameY - 게임 좌표 Y
   * @param {number} gameW - 게임 좌표 너비
   * @param {number} gameH - 게임 좌표 높이
   * @private
   */
  _positionDOMElement(el, gameX, gameY, gameW, gameH) {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;

    el.style.left = `${rect.left + gameX * scaleX}px`;
    el.style.top = `${rect.top + gameY * scaleY}px`;
    el.style.width = `${gameW * scaleX}px`;
    el.style.height = `${gameH * scaleY}px`;
    el.style.fontSize = `${12 * Math.min(scaleX, scaleY)}px`;
  }

  /**
   * DOM 요소들을 제거한다.
   * @private
   */
  _destroyDOMElements() {
    if (this._domInput && this._domInput.parentNode) {
      this._domInput.parentNode.removeChild(this._domInput);
      this._domInput = null;
    }
    if (this._domTextarea && this._domTextarea.parentNode) {
      this._domTextarea.parentNode.removeChild(this._domTextarea);
      this._domTextarea = null;
    }
  }

  // ── 콘솔 출력 ──

  /**
   * 콘솔 출력 영역에 메시지를 표시한다.
   * 최신 메시지가 맨 위에 온다.
   * @param {string} msg - 출력할 메시지
   * @private
   */
  _consoleOut(msg) {
    this._consoleLines.unshift(msg);
    if (this._consoleLines.length > CONSOLE_MAX_LINES) {
      this._consoleLines.length = CONSOLE_MAX_LINES;
    }
    for (let i = 0; i < CONSOLE_MAX_LINES; i++) {
      this._consoleTexts[i].setText(this._consoleLines[i] || '');
    }
  }

  // ── 콘솔 명령 처리 ──

  /**
   * 콘솔 입력 명령어를 파싱하여 실행한다.
   * @param {string} cmd - 입력된 명령어 문자열
   * @private
   */
  _executeConsoleCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'level': {
        const n = parseInt(parts[1]);
        if (isNaN(n) || n < 1) {
          this._consoleOut('사용법: level N (N >= 1)');
          return;
        }
        this._setRunLevel(n);
        break;
      }

      case 'charlv': {
        const charId = parts[1];
        const lvl = parseInt(parts[2]);
        if (!charId || isNaN(lvl) || lvl < 1) {
          this._consoleOut('사용법: charlv CHARID N');
          return;
        }
        this._setCharLevel(charId, lvl);
        break;
      }

      case 'dc': {
        const amount = parseInt(parts[1]);
        if (isNaN(amount)) {
          this._consoleOut('사용법: dc N');
          return;
        }
        SaveManager.addDataCores(amount);
        SaveManager.save();
        this._consoleOut(`DC +${amount} 추가 (현재: ${SaveManager.getData().dataCores})`);
        break;
      }

      case 'stage': {
        const stageId = parts[1];
        if (!stageId) {
          this._consoleOut('사용법: stage STAGEID (예: stage_1)');
          return;
        }
        SaveManager.setSelectedStage(stageId);
        SaveManager.save();
        this._consoleOut(`스테이지 변경: ${stageId}`);
        break;
      }

      case 'diff': {
        const mode = parts[1]?.toLowerCase();
        if (!VALID_DIFFICULTIES.includes(mode)) {
          this._consoleOut(`유효 난이도: ${VALID_DIFFICULTIES.join('/')}`);
          return;
        }
        SaveManager.setSelectedDifficulty(mode);
        SaveManager.save();
        this._consoleOut(`난이도 변경: ${mode}`);
        break;
      }

      case 'unlock': {
        if (parts[1]?.toLowerCase() === 'all') {
          this._unlockAllCharacters();
          this._unlockAllShop();
          this._consoleOut('전체 해금 완료 (캐릭터 + 상점)');
        } else {
          this._consoleOut('사용법: unlock all');
        }
        break;
      }

      case 'help':
        this._showHelp();
        break;

      default:
        this._consoleOut(`알 수 없는 명령어: ${cmd}`);
        break;
    }
  }

  // ── 명령 실행 메서드 ──

  /**
   * 런 레벨을 직접 설정한다. GameScene이 활성 상태여야 한다.
   * @param {number} n - 목표 레벨
   * @private
   */
  _setRunLevel(n) {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.scene.isActive()) {
      this._consoleOut('오류: GameScene이 활성 상태가 아닙니다');
      return;
    }
    const player = gameScene.player;
    if (!player) {
      this._consoleOut('오류: 플레이어가 없습니다');
      return;
    }
    player.level = n;
    player.xp = 0;
    player.xpToNext = XP_FORMULA(n);
    this._consoleOut(`런 레벨 설정: ${n}`);
  }

  /**
   * 캐릭터 진행도 레벨을 설정한다.
   * @param {string} charId - 캐릭터 ID
   * @param {number} level - 목표 레벨
   * @private
   */
  _setCharLevel(charId, level) {
    try {
      const prog = SaveManager.getCharacterProgression(charId);
      prog.level = level;
      SaveManager.save();
      this._consoleOut(`${charId} 레벨 설정: ${level}`);
    } catch (e) {
      this._consoleOut(`오류: ${e.message}`);
    }
  }

  /**
   * 모든 캐릭터를 해금한다.
   * @private
   */
  _unlockAllCharacters() {
    const data = SaveManager.getData();
    ALL_CHARACTER_IDS.forEach(id => {
      data.characters[id] = true;
    });
    SaveManager.save();
    this._consoleOut('전체 캐릭터 해금 완료');
  }

  /**
   * 상점 전체 해금 (모든 슬롯 purchased=true).
   * @private
   */
  _unlockAllShop() {
    const data = SaveManager.getData();
    if (!data.shopRotation || !data.shopRotation.slots || data.shopRotation.slots.length === 0) {
      this._consoleOut('상점 로테이션이 초기화되지 않았습니다');
      return;
    }
    data.shopRotation.slots.forEach(slot => {
      slot.purchased = true;
    });
    SaveManager.save();
    this._consoleOut('상점 전체 해금 완료');
  }

  /**
   * 웨이브를 60초 앞으로 스킵한다. GameScene이 활성 상태여야 한다.
   * @private
   */
  _skipWave() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.scene.isActive()) {
      this._consoleOut('오류: GameScene이 활성 상태가 아닙니다');
      return;
    }
    if (!gameScene.waveSystem) {
      this._consoleOut('오류: WaveSystem이 없습니다');
      return;
    }
    gameScene.waveSystem.elapsedTime += 60;
    this._consoleOut(`웨이브 스킵: +60초 (현재 ${Math.floor(gameScene.waveSystem.elapsedTime)}초)`);
  }

  /**
   * 도움말을 콘솔에 출력한다.
   * @private
   */
  _showHelp() {
    // 콘솔은 3줄까지 표시되므로 3줄에 걸쳐 출력
    this._consoleOut('dc N / stage ID / diff MODE');
    this._consoleOut('level N / charlv ID N / unlock all');
    this._consoleOut('help — 명령어 목록');
  }

  // ── 세이브 관련 ──

  /**
   * 세이브 데이터를 클립보드에 복사한다. 실패 시 textarea fallback.
   * @private
   */
  _exportSave() {
    const json = JSON.stringify(SaveManager.getData(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => this._consoleOut('세이브 데이터를 클립보드에 복사했습니다'))
        .catch(() => this._showExportTextarea(json));
    } else {
      this._showExportTextarea(json);
    }
  }

  /**
   * 내보내기용 임시 DOM textarea를 표시한다.
   * @param {string} json - JSON 문자열
   * @private
   */
  _showExportTextarea(json) {
    this._removeDOMTextarea();

    const ta = document.createElement('textarea');
    ta.value = json;
    ta.readOnly = true;
    ta.style.cssText = `
      position: absolute;
      background: #0a0a1a;
      color: #00ffff;
      border: 1px solid #334466;
      font-size: 10px;
      font-family: monospace;
      padding: 6px;
      outline: none;
      z-index: 20;
      resize: none;
    `;
    this._positionDOMElement(ta, 20, 100, 320, 200);

    document.body.appendChild(ta);
    ta.select();
    this._domTextarea = ta;

    // 화면 아무 곳이나 탭하면 닫기
    const closeHandler = () => {
      this._removeDOMTextarea();
      this.input.off('pointerdown', closeHandler);
    };
    this.time.delayedCall(300, () => {
      this.input.on('pointerdown', closeHandler);
    });

    this._consoleOut('텍스트를 선택하여 복사하세요');
  }

  /**
   * 세이브 가져오기 UI (DOM textarea)를 표시한다.
   * @private
   */
  _importSave() {
    this._removeDOMTextarea();

    const ta = document.createElement('textarea');
    ta.placeholder = '세이브 JSON을 붙여넣고 Enter';
    ta.style.cssText = `
      position: absolute;
      background: #0a0a1a;
      color: #00ffff;
      border: 1px solid #334466;
      font-size: 10px;
      font-family: monospace;
      padding: 6px;
      outline: none;
      z-index: 20;
      resize: none;
    `;
    this._positionDOMElement(ta, 20, 100, 320, 200);

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const raw = ta.value.trim();
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
          // SaveManager 캐시 초기화 — init()을 다시 호출하도록 유도
          SaveManager.init();
          this._removeDOMTextarea();
          this._consoleOut('세이브 가져오기 완료. SettingsScene으로 이동합니다.');
          this.time.delayedCall(500, () => {
            this.scene.start('SettingsScene');
          });
        } catch (err) {
          this._consoleOut(`JSON 파싱 오류: ${err.message}`);
        }
      }
    });

    document.body.appendChild(ta);
    ta.focus();
    this._domTextarea = ta;
  }

  /**
   * DOM textarea를 제거한다.
   * @private
   */
  _removeDOMTextarea() {
    if (this._domTextarea && this._domTextarea.parentNode) {
      this._domTextarea.parentNode.removeChild(this._domTextarea);
      this._domTextarea = null;
    }
  }

  /**
   * 세이브 초기화 버튼 핸들러. 2단계 확인 로직.
   * @private
   */
  _onResetButton() {
    if (!this._resetConfirmStep) {
      // 1단계: 확인 요청 상태로 전환
      this._resetConfirmStep = true;
      const { gfx, text } = this._resetBtnRef;
      const centerX = GAME_WIDTH / 2;
      gfx.clear();
      this._drawButtonBg(gfx, centerX, 235, 200, 44, BTN_BG, 0xFF3333);
      text.setText('정말 초기화?');
      text.setColor('#FF3333');

      // 3초 후 자동 원복
      this._resetTimer = this.time.delayedCall(3000, () => {
        this._resetConfirmStep = false;
        gfx.clear();
        this._drawButtonBg(gfx, centerX, 235, 200, 44, BTN_BG, BTN_BORDER);
        text.setText('세이브 초기화');
        text.setColor('#AABBCC');
      });
    } else {
      // 2단계: 실제 초기화 실행
      if (this._resetTimer) this._resetTimer.remove();
      this._resetConfirmStep = false;
      SaveManager.resetAll();
      this._consoleOut('세이브 초기화 완료. BootScene으로 이동합니다.');
      this.time.delayedCall(300, () => {
        this.scene.start('BootScene');
      });
    }
  }

  // ── 뒤로가기 ──

  /**
   * SettingsScene으로 복귀한다.
   * @private
   */
  _onBack() {
    if (this._transitioning) return;
    this._transitioning = true;
    this._destroyDOMElements();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SettingsScene');
    });
  }
}
