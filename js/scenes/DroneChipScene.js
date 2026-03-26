/**
 * @fileoverview 드론 칩 관리 UI 씬.
 *
 * 칩 장착/해제, 분해, 합성, 변환 4개 탭을 제공한다.
 * 360x640 화면에 드론 슬롯, 탭 바, 스크롤 가능한 칩 목록, 액션 버튼을 배치한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { getChipDef, getGradeInfo, CHIP_GRADES, CHIP_DEFINITIONS, getNextGrade } from '../data/droneChips.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── 상수 ──

const TABS = ['equip', 'dismantle', 'synthesize', 'convert'];
const CARD_W = 80;
const CARD_H = 100;
const CARD_GAP = 8;
const CARDS_PER_ROW = 3;
const LIST_Y_START = 210;

// ── DroneChipScene 클래스 ──

export default class DroneChipScene extends Phaser.Scene {
  constructor() {
    super('DroneChipScene');
  }

  create() {
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.cameras.main.setBackgroundColor(COLORS.BG);

    /** @type {boolean} 씬 전환 중 여부 */
    this._transitioning = false;

    /** @type {string} 현재 활성 탭 */
    this._activeTab = 'equip';

    /** @type {Set<string>} 선택된 칩 uid 집합 */
    this._selectedChips = new Set();

    /** @type {number|null} 선택된 드론 인덱스 (장착 시) */
    this._selectedDrone = null;

    const centerX = GAME_WIDTH / 2;

    // ── 타이틀 바 ──
    this._createTitleBar(centerX);

    // ── 드론 슬롯 ──
    this._createDroneSlots(centerX);

    // ── 탭 바 ──
    this._createTabBar(centerX);

    // ── 칩 목록 영역 (스크롤 가능) ──
    this._listContainer = this.add.container(0, 0).setDepth(10);

    // ── 액션 버튼 ──
    this._actionBtnBg = this.add.graphics().setDepth(20);
    this._actionBtnText = this.add.text(centerX, 612, '', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(21);
    this._actionBtnZone = this.add.zone(centerX, 612, 200, 44).setInteractive({ useHandCursor: true }).setDepth(22);
    this._actionBtnZone.on('pointerdown', () => this._onActionButton());

    // 초기 렌더
    this._refreshList();

    // ESC / 뒤로
    this.input.keyboard.on('keydown-ESC', () => this._goBack());
  }

  // ── 타이틀 바 ──

  /**
   * 타이틀 바 (뒤로 버튼 + 타이틀 + 가루 표시)를 생성한다.
   * @param {number} centerX
   * @private
   */
  _createTitleBar(centerX) {
    // 뒤로 버튼
    const backBtn = this.add.text(20, 30, '\u2190 ' + t('chip.back'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this._goBack());

    // 타이틀
    this.add.text(centerX, 30, '\u26A1 ' + t('chip.title'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.neonMagenta,
      strokeThickness: 1,
    }).setOrigin(0.5);

    // 가루 표시
    this._dustText = this.add.text(GAME_WIDTH - 20, 30, t('chip.dust', SaveManager.getDroneChipDust()), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
    }).setOrigin(1, 0.5);
  }

  // ── 드론 슬롯 ──

  /**
   * 드론 슬롯 3개를 생성한다.
   * @param {number} centerX
   * @private
   */
  _createDroneSlots(centerX) {
    const equippedChips = SaveManager.getEquippedChips();
    const inventory = SaveManager.getDroneChipInventory();
    const droneCount = this._getDroneCount();

    this._droneSlotTexts = [];

    for (let i = 0; i < 3; i++) {
      const sx = centerX - 100 + i * 100;
      const sy = 80;
      const isLocked = i >= droneCount;

      const bg = this.add.graphics();
      bg.fillStyle(isLocked ? COLORS.DARK_GRAY : UI_COLORS.panelBg, 0.8);
      bg.fillRoundedRect(sx - 35, sy - 15, 70, 55, 6);
      bg.lineStyle(1, isLocked ? COLORS.DARK_GRAY : COLORS.NEON_CYAN, 0.4);
      bg.strokeRoundedRect(sx - 35, sy - 15, 70, 55, 6);

      // 드론 번호
      const label = isLocked ? `\uD83D\uDD12 ${i + 1}` : `\uB4DC\uB860 ${i + 1}`;
      this.add.text(sx, sy - 5, label, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: isLocked ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
      }).setOrigin(0.5);

      // 장착된 칩 표시
      let chipLabel = '---';
      if (!isLocked && equippedChips[i]) {
        const chipItem = inventory.find(c => c.uid === equippedChips[i]);
        if (chipItem) {
          const def = getChipDef(chipItem.chipId);
          chipLabel = `${chipItem.grade} ${def ? def.icon : '?'}`;
        }
      }

      const chipText = this.add.text(sx, sy + 17, chipLabel, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: isLocked ? UI_COLORS.textSecondary : UI_COLORS.neonCyan,
      }).setOrigin(0.5);

      this._droneSlotTexts.push(chipText);

      // 드론 슬롯 터치 (장착 탭에서 드론 선택용)
      if (!isLocked) {
        const zone = this.add.zone(sx, sy + 5, 70, 55).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          if (this._activeTab === 'equip') {
            this._selectedDrone = i;
            this._onActionButton();
          }
        });
      }
    }
  }

  /**
   * 현재 드론 수를 반환한다 (증원 업그레이드 포함).
   * @returns {number}
   * @private
   */
  _getDroneCount() {
    const reinforceLv = SaveManager.getDroneUpgradeLevel('droneReinforcement');
    return 1 + reinforceLv;
  }

  // ── 탭 바 ──

  /**
   * 탭 바를 생성한다.
   * @param {number} centerX
   * @private
   */
  _createTabBar(centerX) {
    this._tabTexts = [];
    const tabWidth = 80;
    const startX = centerX - (TABS.length * tabWidth) / 2 + tabWidth / 2;

    TABS.forEach((tab, idx) => {
      const tx = startX + idx * tabWidth;
      const ty = 170;
      const isActive = tab === this._activeTab;

      const text = this.add.text(tx, ty, t(`chip.tab.${tab}`), {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: isActive ? UI_COLORS.neonCyan : UI_COLORS.textSecondary,
        backgroundColor: isActive ? '#002233' : undefined,
        padding: { x: 6, y: 15 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        this._activeTab = tab;
        this._selectedChips.clear();
        this._selectedDrone = null;
        this._refreshTabHighlight();
        this._refreshList();
      });

      this._tabTexts.push({ text, tab });
    });
  }

  /**
   * 탭 하이라이트를 갱신한다.
   * @private
   */
  _refreshTabHighlight() {
    this._tabTexts.forEach(({ text, tab }) => {
      const isActive = tab === this._activeTab;
      text.setColor(isActive ? UI_COLORS.neonCyan : UI_COLORS.textSecondary);
      text.setBackgroundColor(isActive ? '#002233' : 'transparent');
    });
  }

  // ── 칩 목록 ──

  /**
   * 현재 탭에 맞는 칩 목록을 렌더링한다.
   * @private
   */
  _refreshList() {
    // 기존 목록 정리
    this._listContainer.removeAll(true);
    this._selectedChips.clear();

    const inventory = SaveManager.getDroneChipInventory();
    const equippedChips = SaveManager.getEquippedChips();
    const equippedUids = new Set(Object.values(equippedChips).filter(Boolean));

    let displayItems = [];

    switch (this._activeTab) {
      case 'equip':
        displayItems = [...inventory].sort((a, b) => this._gradeSort(b.grade) - this._gradeSort(a.grade));
        break;

      case 'dismantle':
        displayItems = inventory.filter(c => !equippedUids.has(c.uid))
          .sort((a, b) => this._gradeSort(b.grade) - this._gradeSort(a.grade));
        break;

      case 'synthesize':
        displayItems = this._getSynthesizableGroups(inventory, equippedUids);
        break;

      case 'convert':
        displayItems = inventory.filter(c => !equippedUids.has(c.uid))
          .sort((a, b) => this._gradeSort(b.grade) - this._gradeSort(a.grade));
        break;
    }

    if (displayItems.length === 0) {
      this._listContainer.add(
        this.add.text(GAME_WIDTH / 2, LIST_Y_START + 50, t('chip.empty'), {
          fontSize: '14px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.textSecondary,
        }).setOrigin(0.5)
      );
    } else {
      this._renderCards(displayItems, equippedUids);
    }

    this._refreshActionButton();
  }

  /**
   * 카드 목록을 렌더링한다.
   * @param {Array} items - 표시할 칩 배열
   * @param {Set<string>} equippedUids - 장착 중 uid 집합
   * @private
   */
  _renderCards(items, equippedUids) {
    const startX = (GAME_WIDTH - (CARDS_PER_ROW * (CARD_W + CARD_GAP) - CARD_GAP)) / 2 + CARD_W / 2;

    items.forEach((item, idx) => {
      const row = Math.floor(idx / CARDS_PER_ROW);
      const col = idx % CARDS_PER_ROW;
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = LIST_Y_START + row * (CARD_H + CARD_GAP) + CARD_H / 2;

      const chipId = item.chipId || (item.group ? item.group.chipId : '?');
      const grade = item.grade || (item.group ? item.group.grade : 'C');
      const uid = item.uid || null;
      const isGroup = !!item.group;

      const def = getChipDef(chipId);
      const gradeInfo = getGradeInfo(grade);
      const isSelected = uid ? this._selectedChips.has(uid) : (isGroup && this._selectedChips.has(item.groupKey));
      const isEquipped = uid ? equippedUids.has(uid) : false;

      // 카드 배경
      const cardGfx = this.add.graphics();
      const borderColor = gradeInfo ? gradeInfo.colorHex : 0xAAAAAA;
      cardGfx.fillStyle(UI_COLORS.panelBg, 0.9);
      cardGfx.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 6);
      cardGfx.lineStyle(isSelected ? 2 : 1, isSelected ? COLORS.NEON_GREEN : borderColor, isSelected ? 0.9 : 0.5);
      cardGfx.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 6);
      this._listContainer.add(cardGfx);

      // 아이콘
      const icon = def ? def.icon : '?';
      const iconText = this.add.text(cx, cy - 25, icon, {
        fontSize: '20px',
        fontFamily: 'Galmuri11, monospace',
        color: gradeInfo ? gradeInfo.color : '#FFFFFF',
      }).setOrigin(0.5);
      this._listContainer.add(iconText);

      // 등급
      const gradeText = this.add.text(cx, cy + 2, grade, {
        fontSize: '16px',
        fontFamily: 'Galmuri11, monospace',
        color: gradeInfo ? gradeInfo.color : '#FFFFFF',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this._listContainer.add(gradeText);

      // 이름
      const nameKey = def ? def.nameKey : chipId;
      const nameText = this.add.text(cx, cy + 25, t(nameKey), {
        fontSize: '10px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.textPrimary,
      }).setOrigin(0.5);
      this._listContainer.add(nameText);

      // 합성 탭: 수량 표시
      if (isGroup) {
        const countText = this.add.text(cx + CARD_W / 2 - 5, cy - CARD_H / 2 + 5, `x${item.count}`, {
          fontSize: '10px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonGreen,
        }).setOrigin(1, 0);
        this._listContainer.add(countText);
      }

      // 장착 뱃지
      if (isEquipped) {
        const eqChips = SaveManager.getEquippedChips();
        const droneIdx = Object.keys(eqChips).find(k => eqChips[k] === uid);
        const badge = this.add.text(cx - CARD_W / 2 + 5, cy - CARD_H / 2 + 5, `D${Number(droneIdx) + 1}`, {
          fontSize: '9px',
          fontFamily: 'Galmuri11, monospace',
          color: '#000000',
          backgroundColor: UI_COLORS.neonCyan,
          padding: { x: 2, y: 1 },
        }).setOrigin(0, 0);
        this._listContainer.add(badge);
      }

      // 터치 영역
      const zone = this.add.zone(cx, cy, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      this._listContainer.add(zone);

      zone.on('pointerdown', () => {
        this._onCardTap(item, isGroup);
      });
    });
  }

  /**
   * 카드 탭 처리.
   * @param {Object} item - 칩 아이템 또는 그룹
   * @param {boolean} isGroup - 그룹 여부
   * @private
   */
  _onCardTap(item, isGroup) {
    const key = isGroup ? item.groupKey : item.uid;
    if (!key) return;

    switch (this._activeTab) {
      case 'equip':
      case 'convert':
        // 단일 선택
        this._selectedChips.clear();
        this._selectedChips.add(key);
        break;

      case 'dismantle':
        // 복수 선택 토글
        if (this._selectedChips.has(key)) {
          this._selectedChips.delete(key);
        } else {
          this._selectedChips.add(key);
        }
        break;

      case 'synthesize':
        // 단일 그룹 선택
        this._selectedChips.clear();
        this._selectedChips.add(key);
        break;
    }

    this._refreshList();
  }

  // ── 합성 그룹 ──

  /**
   * 합성 가능한 칩 그룹을 반환한다.
   * @param {Array} inventory - 전체 인벤토리
   * @param {Set<string>} equippedUids - 장착 중 uid 집합
   * @returns {Array}
   * @private
   */
  _getSynthesizableGroups(inventory, equippedUids) {
    const groups = {};
    inventory.forEach(c => {
      if (equippedUids.has(c.uid)) return;
      const key = `${c.chipId}_${c.grade}`;
      if (!groups[key]) groups[key] = { group: { chipId: c.chipId, grade: c.grade }, count: 0, items: [], groupKey: key };
      groups[key].count++;
      groups[key].items.push(c);
    });

    return Object.values(groups)
      .filter(g => {
        const nextGrade = getNextGrade(g.group.grade);
        return g.count >= 3 && nextGrade !== null;
      })
      .sort((a, b) => this._gradeSort(b.group.grade) - this._gradeSort(a.group.grade));
  }

  // ── 액션 버튼 ──

  /**
   * 액션 버튼 텍스트/상태를 갱신한다.
   * @private
   */
  _refreshActionButton() {
    const selectedCount = this._selectedChips.size;
    let label = '';
    let enabled = false;

    switch (this._activeTab) {
      case 'equip': {
        if (selectedCount > 0) {
          const uid = [...this._selectedChips][0];
          const equippedChips = SaveManager.getEquippedChips();
          const isEquipped = Object.values(equippedChips).includes(uid);
          label = isEquipped ? t('chip.action.unequip') : t('chip.action.equip');
          enabled = true;
        }
        break;
      }

      case 'dismantle': {
        if (selectedCount > 0) {
          let totalDust = 0;
          for (const uid of this._selectedChips) {
            const inv = SaveManager.getDroneChipInventory();
            const chip = inv.find(c => c.uid === uid);
            if (chip) {
              const gi = getGradeInfo(chip.grade);
              totalDust += gi ? gi.dustOnDismantle : 0;
            }
          }
          label = t('chip.action.dismantle', totalDust);
          enabled = true;
        }
        break;
      }

      case 'synthesize': {
        if (selectedCount > 0) {
          const groupKey = [...this._selectedChips][0];
          const parts = groupKey.split('_');
          const grade = parts[parts.length - 1];
          const nextGrade = getNextGrade(grade);
          if (nextGrade) {
            const nextGi = getGradeInfo(nextGrade);
            const cost = nextGi ? nextGi.synthesizeCost : 0;
            label = t('chip.action.synthesize', cost);
            enabled = cost !== null && SaveManager.getDroneChipDust() >= cost;
          }
        }
        break;
      }

      case 'convert': {
        if (selectedCount > 0) {
          const uid = [...this._selectedChips][0];
          const inv = SaveManager.getDroneChipInventory();
          const chip = inv.find(c => c.uid === uid);
          if (chip) {
            const gi = getGradeInfo(chip.grade);
            const cost = gi ? gi.convertCost : 0;
            label = t('chip.action.convert', cost);
            enabled = SaveManager.getDroneChipDust() >= cost;
          }
        }
        break;
      }
    }

    // 렌더
    this._actionBtnBg.clear();
    if (label) {
      const btnColor = enabled ? UI_COLORS.btnPrimary : UI_COLORS.btnDisabled;
      this._actionBtnBg.fillStyle(btnColor, 0.9);
      this._actionBtnBg.fillRoundedRect(GAME_WIDTH / 2 - 100, 612 - 22, 200, 44, 8);
      if (enabled) {
        this._actionBtnBg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
        this._actionBtnBg.strokeRoundedRect(GAME_WIDTH / 2 - 100, 612 - 22, 200, 44, 8);
      }
    }
    this._actionBtnText.setText(label);
    this._actionBtnText.setColor(enabled ? UI_COLORS.textPrimary : UI_COLORS.textSecondary);
    this._actionBtnZone.input.enabled = enabled;
  }

  /**
   * 액션 버튼 클릭 처리.
   * @private
   */
  _onActionButton() {
    switch (this._activeTab) {
      case 'equip':
        this._doEquip();
        break;
      case 'dismantle':
        this._doDismantle();
        break;
      case 'synthesize':
        this._doSynthesize();
        break;
      case 'convert':
        this._doConvert();
        break;
    }
  }

  /**
   * 장착/해제를 수행한다.
   * @private
   */
  _doEquip() {
    if (this._selectedChips.size === 0) return;
    const uid = [...this._selectedChips][0];
    const equippedChips = SaveManager.getEquippedChips();
    const isEquipped = Object.values(equippedChips).includes(uid);

    if (isEquipped) {
      // 해제
      const droneIdx = Object.keys(equippedChips).find(k => equippedChips[k] === uid);
      if (droneIdx !== undefined) {
        SaveManager.unequipChip(Number(droneIdx));
        SoundSystem.play('select');
      }
    } else {
      // 장착: 사용 가능한 첫 번째 빈 드론에 장착
      const droneCount = this._getDroneCount();
      let slotIdx = -1;
      for (let i = 0; i < droneCount; i++) {
        if (!equippedChips[i]) {
          slotIdx = i;
          break;
        }
      }
      // 빈 슬롯이 없으면 첫 번째 슬롯에 교체
      if (slotIdx < 0) slotIdx = 0;

      SaveManager.equipChip(slotIdx, uid);
      SoundSystem.play('select');
    }

    this._selectedChips.clear();
    this.scene.restart();
  }

  /**
   * 분해를 수행한다.
   * @private
   */
  _doDismantle() {
    if (this._selectedChips.size === 0) return;

    for (const uid of this._selectedChips) {
      SaveManager.dismantleChip(uid);
    }
    SoundSystem.play('select');
    this._selectedChips.clear();
    this.scene.restart();
  }

  /**
   * 합성을 수행한다.
   * @private
   */
  _doSynthesize() {
    if (this._selectedChips.size === 0) return;
    const groupKey = [...this._selectedChips][0];

    // 해당 그룹에서 3개 선택
    const inventory = SaveManager.getDroneChipInventory();
    const equippedUids = new Set(Object.values(SaveManager.getEquippedChips()).filter(Boolean));
    const parts = groupKey.split('_');
    const grade = parts.pop();
    const chipId = parts.join('_');

    const candidates = inventory.filter(c =>
      c.chipId === chipId && c.grade === grade && !equippedUids.has(c.uid)
    );

    if (candidates.length < 3) return;

    const result = SaveManager.synthesizeChips(candidates[0].uid, candidates[1].uid, candidates[2].uid);
    if (result) {
      SoundSystem.play('levelup');
    }

    this._selectedChips.clear();
    this.scene.restart();
  }

  /**
   * 변환을 수행한다.
   * @private
   */
  _doConvert() {
    if (this._selectedChips.size === 0) return;
    const uid = [...this._selectedChips][0];

    const result = SaveManager.convertChip(uid);
    if (result) {
      SoundSystem.play('select');
    }

    this._selectedChips.clear();
    this.scene.restart();
  }

  // ── 유틸리티 ──

  /**
   * 등급을 정렬용 숫자로 변환한다.
   * @param {string} grade
   * @returns {number}
   * @private
   */
  _gradeSort(grade) {
    return { C: 0, B: 1, A: 2, S: 3 }[grade] || 0;
  }

  /**
   * 하드웨어 뒤로가기 / ESC 키 핸들러.
   * BootScene 글로벌 backButton 리스너에서 호출된다.
   * @private
   */
  _onBack() {
    this._goBack();
  }

  /**
   * 뒤로가기.
   * @private
   */
  _goBack() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
