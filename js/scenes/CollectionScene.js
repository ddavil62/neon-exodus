/**
 * @fileoverview 도감 화면 씬.
 *
 * 5개 탭(무기/패시브/적/도전과제/진화)으로 구성된 도감을 표시한다.
 * 발견된 항목은 이름, 설명, 스탯을 보여주고,
 * 미발견 항목은 ???로 마스킹한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { WEAPONS, WEAPON_EVOLUTIONS, EVOLVED_WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/passives.js';
import { AchievementManager } from '../managers/AchievementManager.js';

// ── 적 ID 목록 (표시용) ──

const ENEMY_IDS = [
  'nano_drone', 'scout_bot', 'spark_drone', 'battle_robot',
  'shield_drone', 'rush_bot', 'repair_bot', 'heavy_bot',
  'teleport_drone', 'suicide_bot',
  'guardian_drone', 'assault_mech',
  'commander_drone', 'siege_titan', 'core_processor',
];

// ── 탭 정의 ──

const TABS = [
  { key: 'weapons', labelKey: 'collection.weapons' },
  { key: 'passives', labelKey: 'collection.passives' },
  { key: 'enemies', labelKey: 'collection.enemies' },
  { key: 'achievements', labelKey: 'collection.achievements' },
  { key: 'evolutions', labelKey: 'collection.evolutions' },
];

// ── 레이아웃 상수 ──

const CARD_W = 320;
const CARD_H = 56;
const CARD_GAP = 4;
const LIST_START_Y = 110;

// ── CollectionScene 클래스 ──

export default class CollectionScene extends Phaser.Scene {
  constructor() {
    super('CollectionScene');
  }

  /**
   * 도감 화면 UI를 생성한다.
   */
  create() {
    /** 현재 선택된 탭 인덱스 */
    this._currentTab = 0;

    /** 탭 버튼 요소 배열 */
    this._tabElements = [];

    /** 리스트 컨테이너 */
    this._container = null;

    const centerX = GAME_WIDTH / 2;

    // ── 배경 ──
    this.cameras.main.setBackgroundColor(COLORS.BG_DARK);

    // ── 제목 ──
    this.add.text(centerX, 25, t('collection.title'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5);

    // ── 탭 버튼 ──
    this._createTabs();

    // ── 뒤로가기 버튼 ──
    this._createButton(centerX, GAME_HEIGHT - 40, t('ui.back'), UI_COLORS.btnSecondary, () => {
      this._onBack();
    });

    // ── ESC 키로 뒤로가기 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // ── 초기 탭 렌더링 ──
    this._renderList();
  }

  /** 메뉴 화면으로 돌아간다. */
  _onBack() {
    this.scene.start('MenuScene');
  }

  // ── 탭 ──

  /**
   * 탭 버튼 5개를 생성한다.
   * @private
   */
  _createTabs() {
    const tabY = 60;
    const tabW = 62;
    const tabH = 26;
    const totalW = TABS.length * tabW + (TABS.length - 1) * 4;
    const startX = (GAME_WIDTH - totalW) / 2 + tabW / 2;

    TABS.forEach((tab, i) => {
      const tabX = startX + i * (tabW + 4);
      const isActive = i === this._currentTab;

      const bg = this.add.graphics();
      const textColor = isActive ? UI_COLORS.neonCyan : UI_COLORS.textSecondary;
      const bgAlpha = isActive ? 0.9 : 0.5;

      bg.fillStyle(COLORS.UI_PANEL, bgAlpha);
      bg.fillRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 4);
      if (isActive) {
        bg.lineStyle(1, COLORS.NEON_CYAN, 0.7);
        bg.strokeRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 4);
      }

      const label = this.add.text(tabX, tabY, t(tab.labelKey), {
        fontSize: '9px',
        fontFamily: 'Galmuri11, monospace',
        color: textColor,
      }).setOrigin(0.5);

      const zone = this.add.zone(tabX, tabY, tabW, tabH)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        this._currentTab = i;
        this._refreshTabs();
        this._renderList();
      });

      this._tabElements.push(bg, label, zone);
    });
  }

  /**
   * 탭 버튼을 새로 그린다.
   * @private
   */
  _refreshTabs() {
    for (const el of this._tabElements) {
      el.destroy();
    }
    this._tabElements = [];
    this._createTabs();
  }

  // ── 리스트 렌더링 ──

  /**
   * 현재 탭에 맞는 리스트를 렌더링한다.
   * @private
   */
  _renderList() {
    // 기존 컨테이너 제거
    if (this._container) {
      this._container.removeAll(true);
      this._container.destroy();
    }

    this._container = this.add.container(0, 0);

    // 마스크 영역 설정
    const centerX = GAME_WIDTH / 2;
    const listHeight = GAME_HEIGHT - 190;
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(centerX - CARD_W / 2 - 5, LIST_START_Y - 5, CARD_W + 10, listHeight + 10);
    const mask = maskShape.createGeometryMask();
    this._container.setMask(mask);

    const collection = SaveManager.getCollection();
    const tab = TABS[this._currentTab];
    let items = [];

    switch (tab.key) {
      case 'weapons':
        items = this._getWeaponItems(collection);
        break;
      case 'passives':
        items = this._getPassiveItems(collection);
        break;
      case 'enemies':
        items = this._getEnemyItems(collection);
        break;
      case 'achievements':
        items = this._getAchievementItems();
        break;
      case 'evolutions':
        items = this._getEvolutionItems(collection);
        break;
    }

    const contentHeight = items.length * (CARD_H + CARD_GAP);

    items.forEach((item, i) => {
      const cardY = LIST_START_Y + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      this._createListCard(centerX, cardY, item);
    });

    // 스크롤 처리
    if (contentHeight > listHeight) {
      this._scrollMin = -(contentHeight - listHeight);
      this._scrollMax = 0;
      this._scrollOffset = 0;

      // 기존 pointermove 리스너 제거 후 재등록
      this.input.off('pointermove');
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
    } else {
      this.input.off('pointermove');
    }
  }

  // ── 데이터 수집 ──

  /**
   * 무기 탭 항목을 반환한다.
   * @param {Object} collection - 도감 데이터
   * @returns {Array<Object>} 항목 배열
   * @private
   */
  _getWeaponItems(collection) {
    const seen = new Set(collection.weaponsSeen || []);
    const items = [];

    // 일반 무기
    for (const w of WEAPONS) {
      const discovered = seen.has(w.id);
      items.push({
        name: discovered ? t(w.nameKey) : t('collection.undiscovered'),
        desc: discovered ? t(w.descKey) : t('collection.undiscovered'),
        discovered,
      });
    }

    // 진화 무기
    for (const evo of WEAPON_EVOLUTIONS) {
      const discovered = seen.has(evo.resultId);
      // 진화 조건 텍스트
      const condText = discovered
        ? `${t(`weapon.${evo.weaponId}.name`)} Lv8 + ${t(`passive.${evo.passiveId}.name`)} Lv5`
        : t('collection.undiscovered');

      items.push({
        name: discovered ? t(evo.resultNameKey) : t('collection.undiscovered'),
        desc: discovered ? condText : t('collection.undiscovered'),
        discovered,
      });
    }

    return items;
  }

  /**
   * 패시브 탭 항목을 반환한다.
   * @param {Object} collection - 도감 데이터
   * @returns {Array<Object>} 항목 배열
   * @private
   */
  _getPassiveItems(collection) {
    const seen = new Set(collection.passivesSeen || []);
    return PASSIVES.map(p => ({
      name: seen.has(p.id) ? t(p.nameKey) : t('collection.undiscovered'),
      desc: seen.has(p.id) ? t(p.detailKey) : t('collection.undiscovered'),
      discovered: seen.has(p.id),
    }));
  }

  /**
   * 적 탭 항목을 반환한다.
   * @param {Object} collection - 도감 데이터
   * @returns {Array<Object>} 항목 배열
   * @private
   */
  _getEnemyItems(collection) {
    const seen = new Set(collection.enemiesSeen || []);
    return ENEMY_IDS.map(id => ({
      name: seen.has(id) ? t(`enemy.${id}.name`) : t('collection.undiscovered'),
      desc: seen.has(id) ? t(`enemy.${id}.desc`) : t('collection.undiscovered'),
      discovered: seen.has(id),
    }));
  }

  /**
   * 도전과제 탭 항목을 반환한다.
   * @returns {Array<Object>} 항목 배열
   * @private
   */
  _getAchievementItems() {
    const achievements = AchievementManager.getAllAchievements();
    return achievements.map(a => ({
      name: t(a.nameKey),
      desc: t(a.descKey),
      discovered: a.completed,
    }));
  }

  /**
   * 진화 탭 항목을 반환한다.
   * 조합식은 항상 공개하되, 진화 무기 이름은 발견 여부에 따라 마스킹한다.
   * @param {Object} collection - 도감 데이터
   * @returns {Array<Object>} 항목 배열
   * @private
   */
  _getEvolutionItems(collection) {
    const seen = new Set(collection.weaponsSeen || []);
    return WEAPON_EVOLUTIONS.map(evo => {
      const discovered = seen.has(evo.resultId);
      // 무기 이름과 패시브 이름으로 조합식 텍스트 생성 (항상 공개)
      const weaponName = t(`weapon.${evo.weaponId}.name`);
      const passiveName = t(`passive.${evo.passiveId}.name`);
      const recipe = t('collection.evoRecipe', weaponName, passiveName);

      return {
        name: discovered ? `\u2605 ${t(evo.resultNameKey)}` : '\u2605 ???',
        desc: recipe,
        discovered,
      };
    });
  }

  // ── 리스트 카드 ──

  /**
   * 리스트 카드 하나를 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {Object} item - 항목 데이터 { name, desc, discovered }
   * @private
   */
  _createListCard(x, y, item) {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, item.discovered ? 0.9 : 0.5);
    bg.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 4);
    bg.lineStyle(1, item.discovered ? COLORS.UI_BORDER : 0x222233, 0.3);
    bg.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 4);
    this._container.add(bg);

    const nameColor = item.discovered ? UI_COLORS.neonCyan : UI_COLORS.textSecondary;
    const nameText = this.add.text(x - CARD_W / 2 + 12, y - 14, item.name, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: nameColor,
    }).setAlpha(item.discovered ? 1 : 0.5);
    this._container.add(nameText);

    const descText = this.add.text(x - CARD_W / 2 + 12, y + 6, item.desc, {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
      wordWrap: { width: CARD_W - 24 },
    }).setAlpha(item.discovered ? 0.85 : 0.3);
    this._container.add(descText);
  }

  // ── 버튼 ──

  /**
   * 버튼을 생성한다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {string} label - 버튼 텍스트
   * @param {number} bgColor - 배경 색상
   * @param {Function} callback - 클릭 콜백
   * @private
   */
  _createButton(x, y, label, bgColor, callback) {
    const btnW = 160;
    const btnH = 36;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.4);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);

    const text = this.add.text(x, y, label, {
      fontSize: '14px',
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
