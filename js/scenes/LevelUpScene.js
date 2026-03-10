/**
 * @fileoverview 레벨업 3택 선택 오버레이 씬.
 *
 * 플레이어 레벨업 시 GameScene 위에 오버레이로 띄워진다.
 * 무기 레벨업, 새 패시브 획득, 패시브 레벨업 중 랜덤 3개를 카드로 제시하고,
 * 선택 시 효과를 적용한 뒤 GameScene을 재개한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t } from '../i18n.js';
import { PASSIVES, getPassiveById } from '../data/passives.js';
import { getAvailableWeapons, WEAPONS } from '../data/weapons.js';
import { SaveManager } from '../managers/SaveManager.js';

// ── LevelUpScene 클래스 ──

export default class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUpScene');
  }

  /**
   * 초기 데이터를 전달받는다.
   * @param {{ player: import('../entities/Player.js').default, weaponSystem: import('../systems/WeaponSystem.js').default, level: number, rerollsLeft: number, maxWeaponSlots: number }} data
   */
  init(data) {
    this.player = data.player;
    this.weaponSystem = data.weaponSystem;
    this.playerLevel = data.level;
    this.gameScene = this.scene.get('GameScene');

    /** 남은 리롤 횟수 */
    this.rerollsLeft = data.rerollsLeft || 0;

    /** 최대 무기 슬롯 수 */
    this.maxWeaponSlots = data.maxWeaponSlots || 6;

    /** 레벨업 무기 추천 가중치 (hidden 캐릭터: 2.0) */
    this.weaponChoiceBias = data.weaponChoiceBias || this.player?.weaponChoiceBias || 1.0;
  }

  /**
   * 레벨업 UI를 생성한다.
   */
  create() {
    // 이전 스킵 상태 초기화 (Phaser는 scene.stop() 후 재실행 시 인스턴스를 재사용)
    this._skipMode = false;

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // ── 반투명 어두운 오버레이 ──
    this.add.rectangle(centerX, centerY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(0);

    // ── "LEVEL UP!" 텍스트 ──
    this.add.text(centerX, 100, t('levelup.title'), {
      fontSize: '28px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.neonMagenta,
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);

    // 현재 레벨 표시
    this.add.text(centerX, 135, t('hud.level', this.playerLevel), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(1);

    // ── 카드 렌더링 ──
    this._renderCards();

    // ── 리롤 버튼 ──
    this._createRerollButton();
  }

  /**
   * 카드 UI를 렌더링한다. 리롤 시 재호출된다.
   * @private
   */
  _renderCards() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 기존 카드 요소 제거 (리롤 시)
    if (this._cardElements) {
      for (const el of this._cardElements) {
        el.destroy();
      }
    }
    this._cardElements = [];

    // 3택 카드 생성
    const choices = this._generateChoices();

    // 선택지가 없으면 자동 스킵 (UI 표시 없이 즉시 게임 재개)
    if (choices.length === 0) {
      this.time.delayedCall(0, () => this._skipLevelUp());
      return;
    }

    const cardWidth = 96;
    const cardSpacing = 12;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * cardSpacing;
    const startX = centerX - totalWidth / 2 + cardWidth / 2;

    choices.forEach((choice, i) => {
      const cardX = startX + i * (cardWidth + cardSpacing);
      this._createCard(cardX, centerY + 30, choice);
    });
  }

  /**
   * 리롤 버튼을 생성한다.
   * @private
   */
  _createRerollButton() {
    // 기존 리롤 버튼 제거 (스킵 모드 전환 시에도 잔존 요소 정리를 위해 먼저 실행)
    if (this._rerollBtnElements) {
      for (const el of this._rerollBtnElements) {
        el.destroy();
      }
    }
    this._rerollBtnElements = [];

    // 스킵 모드일 때 리롤 버튼을 표시하지 않음 (기존 버튼은 이미 정리됨)
    if (this._skipMode) return;

    const centerX = GAME_WIDTH / 2;
    const btnY = GAME_HEIGHT - 80;

    const hasRerolls = this.rerollsLeft > 0;
    const label = hasRerolls
      ? t('levelup.reroll', this.rerollsLeft)
      : t('levelup.noReroll');

    const btnColor = hasRerolls ? UI_COLORS.neonCyan : UI_COLORS.textSecondary;

    const bg = this.add.graphics().setDepth(2);
    bg.fillStyle(COLORS.UI_PANEL, 0.9);
    bg.fillRoundedRect(centerX - 70, btnY - 16, 140, 32, 6);
    if (hasRerolls) {
      bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
      bg.strokeRoundedRect(centerX - 70, btnY - 16, 140, 32, 6);
    }
    this._rerollBtnElements.push(bg);

    const text = this.add.text(centerX, btnY, label, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: btnColor,
    }).setOrigin(0.5).setDepth(3);
    this._rerollBtnElements.push(text);

    if (hasRerolls) {
      const zone = this.add.zone(centerX, btnY, 140, 32)
        .setInteractive({ useHandCursor: true })
        .setDepth(4);
      this._rerollBtnElements.push(zone);

      zone.on('pointerdown', () => {
        this.rerollsLeft--;
        this._renderCards();
        this._createRerollButton();
      });
    }
  }

  // ── 스킵 UI ──

  /**
   * 모든 업그레이드가 완료되었을 때 스킵 UI를 렌더링한다.
   * 안내 메시지와 스킵 버튼을 표시하고, 리롤 버튼을 숨긴다.
   * @private
   */
  _renderSkip() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 리롤 버튼 숨김 플래그
    this._skipMode = true;

    // 안내 텍스트
    const msg = this.add.text(centerX, centerY - 10, t('levelup.allMaxed'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setDepth(3);
    this._cardElements.push(msg);

    // 스킵 버튼 배경
    const btnW = 140;
    const btnH = 32;
    const btnX = centerX - btnW / 2;
    const btnY = centerY + 50 - btnH / 2;

    const bg = this.add.graphics().setDepth(2);
    bg.fillStyle(COLORS.UI_PANEL, 0.9);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.5);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    this._cardElements.push(bg);

    // 스킵 버튼 텍스트
    const btnText = this.add.text(centerX, centerY + 50, t('levelup.skip'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setDepth(3);
    this._cardElements.push(btnText);

    // 스킵 버튼 터치 영역
    const zone = this.add.zone(centerX, centerY + 50, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    this._cardElements.push(zone);

    zone.on('pointerdown', () => {
      this._skipLevelUp();
    });
  }

  /**
   * 레벨업을 스킵하고 GameScene을 재개한다.
   * 선택지가 없는 상태에서 호출된다.
   * @private
   */
  _skipLevelUp() {
    this.events.emit('levelupDone', { rerollsLeft: this.rerollsLeft });
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  // ── 선택지 생성 ──

  /**
   * 레벨업 선택지 3개를 생성한다.
   * 무기 레벨업, 패시브 레벨업, 새 패시브 중에서 랜덤으로 조합한다.
   * @returns {Array<{ type: string, id: string, name: string, desc: string, icon: string, currentLv?: number, nextLv?: number }>}
   * @private
   */
  _generateChoices() {
    const candidates = [];

    // 1. 보유 무기 레벨업 (최대 레벨 미달인 것들)
    if (this.weaponSystem) {
      for (const weapon of this.weaponSystem.weapons) {
        const maxLevel = weapon.data.maxLevel || 8;
        if (weapon.level < maxLevel) {
          candidates.push({
            type: 'weapon_upgrade',
            id: weapon.id,
            name: t(`weapon.${weapon.id}.name`),
            desc: t(`weapon.${weapon.id}.lv${weapon.level + 1}`) || t(`weapon.${weapon.id}.desc`),
            icon: '🔫',
            currentLv: weapon.level,
            nextLv: weapon.level + 1,
            label: t('levelup.weaponUp'),
          });
        }
      }
    }

    // 2. 보유 패시브 레벨업 (최대 레벨 미달인 것들)
    const playerPassives = this.player._passives || {};
    for (const [passiveId, passiveLv] of Object.entries(playerPassives)) {
      const pData = getPassiveById(passiveId);
      if (!pData) continue;
      if (passiveLv < pData.maxLevel) {
        candidates.push({
          type: 'passive_upgrade',
          id: passiveId,
          name: t(pData.nameKey),
          desc: t(pData.detailKey),
          icon: pData.icon || '🛡️',
          currentLv: passiveLv,
          nextLv: passiveLv + 1,
          label: t('levelup.passiveUp'),
        });
      }
    }

    // 3. 새 패시브 획득 (미보유 것들)
    for (const pData of PASSIVES) {
      if (playerPassives[pData.id]) continue;
      candidates.push({
        type: 'new_passive',
        id: pData.id,
        name: t(pData.nameKey),
        desc: t(pData.detailKey),
        icon: pData.icon || '✨',
        label: t('levelup.newPassive'),
      });
    }

    // 4. 새 무기 획득 (Phase 4 이하 + 해금된 스테이지 무기, 미장착, 슬롯 여유 있음)
    if (this.weaponSystem && this.weaponSystem.weapons.length < this.maxWeaponSlots) {
      const equippedIds = new Set(this.weaponSystem.weapons.map(w => w.id));

      // 기본 무기 (phase <= 4)
      const baseWeapons = getAvailableWeapons(4);

      // 영구 해금된 스테이지 무기 (stageUnlock + SaveManager에 해금 기록)
      const unlockedStageWeapons = WEAPONS.filter(w =>
        w.stageUnlock && SaveManager.isWeaponUnlocked(w.id)
      );

      // 중복 제거 후 합산 (해금 무기가 baseWeapons에 이미 포함된 경우 방지)
      const mergedIds = new Set(baseWeapons.map(w => w.id));
      const merged = [...baseWeapons];
      for (const sw of unlockedStageWeapons) {
        if (!mergedIds.has(sw.id)) {
          merged.push(sw);
          mergedIds.add(sw.id);
        }
      }

      const available = merged.filter(w => {
        // 미장착이고 레벨 데이터가 있는 무기만
        return !equippedIds.has(w.id) && w.levels && w.levels.length > 0;
      });

      const newWeaponCandidates = [];
      for (const wData of available) {
        newWeaponCandidates.push({
          type: 'new_weapon',
          id: wData.id,
          name: t(wData.nameKey),
          desc: t(wData.descKey),
          icon: wData.type === 'beam' ? '💥' : wData.type === 'orbital' ? '🔮' : wData.type === 'chain' ? '⚡' : wData.type === 'homing' ? '🚀' : wData.type === 'summon' ? '🤖' : wData.type === 'aoe' ? '💫' : '🔫',
          label: t('levelup.newWeapon'),
        });
      }

      // weaponChoiceBias 지원: 신규 무기 후보를 가중치만큼 배열에 추가
      const bias = this.weaponChoiceBias || 1.0;
      for (let i = 0; i < Math.floor(bias); i++) {
        candidates.push(...newWeaponCandidates);
      }
    }

    // 셔플
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // 3개 선택 (부족하면 있는 만큼)
    return candidates.slice(0, 3);
  }

  // ── 선택 적용 ──

  /**
   * 선택한 카드의 효과를 적용한다.
   * @param {{ type: string, id: string }} choice - 선택한 카드 데이터
   * @private
   */
  _applyChoice(choice) {
    switch (choice.type) {
      case 'weapon_upgrade':
        this.weaponSystem.upgradeWeapon(choice.id);
        break;

      case 'passive_upgrade':
        this._upgradePassive(choice.id);
        break;

      case 'new_passive':
        this._addPassive(choice.id);
        break;

      case 'new_weapon':
        this.weaponSystem.addWeapon(choice.id, 1);
        break;
    }

    // 남은 리롤 수를 GameScene에 반환
    this.events.emit('levelupDone', { rerollsLeft: this.rerollsLeft });

    // GameScene 재개 및 이 씬 종료
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  /**
   * 플레이어에게 새 패시브를 추가한다.
   * @param {string} passiveId - 패시브 ID
   * @private
   */
  _addPassive(passiveId) {
    if (!this.player._passives) {
      this.player._passives = {};
    }
    this.player._passives[passiveId] = 1;
    this._applyPassiveEffect(passiveId, 1);

    // 도감에 패시브 등록
    SaveManager.addToCollection('passivesSeen', passiveId);
  }

  /**
   * 보유 패시브를 레벨업한다.
   * @param {string} passiveId - 패시브 ID
   * @private
   */
  _upgradePassive(passiveId) {
    if (!this.player._passives) return;
    const currentLv = this.player._passives[passiveId] || 0;
    this.player._passives[passiveId] = currentLv + 1;
    this._applyPassiveEffect(passiveId, currentLv + 1);
  }

  /**
   * 패시브 효과를 플레이어 스탯에 반영한다.
   * @param {string} passiveId - 패시브 ID
   * @param {number} level - 현재 레벨
   * @private
   */
  _applyPassiveEffect(passiveId, level) {
    const pData = getPassiveById(passiveId);
    if (!pData) return;

    const p = this.player;
    const totalEffect = pData.effectPerLevel * level;

    // 패시브 스탯 매핑
    switch (pData.stat) {
      case 'moveSpeed':
        p.speedMultiplier = 1 + totalEffect;
        break;
      case 'defense':
        p.armor = totalEffect;
        break;
      case 'maxHp':
        p.maxHp = 100 + totalEffect; // 기본 HP + 패시브 보너스
        if (p.currentHp > p.maxHp) p.currentHp = p.maxHp;
        break;
      case 'attackSpeed':
        p.cooldownMultiplier = 1 - totalEffect;
        break;
      case 'xpMagnetRadius':
        p.magnetMultiplier = 1 + totalEffect;
        break;
      case 'hpRegen':
        p.regen = totalEffect;
        break;
      case 'projectileRange':
        // 사거리는 WeaponSystem 레벨에서 처리
        break;
      case 'critChance':
        p.critChance = totalEffect;
        break;
      case 'cooldownReduction':
        p.cooldownMultiplier = Math.max(0.3, 1 - totalEffect);
        break;
      case 'creditDropBonus':
        // 크레딧 보너스는 메타에서 처리
        break;
    }
  }

  // ── 카드 UI ──

  /**
   * 선택 카드 하나를 생성한다.
   * @param {number} x - 카드 중심 X 좌표
   * @param {number} y - 카드 중심 Y 좌표
   * @param {Object} choice - 카드 데이터
   * @private
   */
  _createCard(x, y, choice) {
    const cardW = 96;
    const cardH = 160;

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_PANEL, 0.95);
    bg.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
    bg.lineStyle(1, COLORS.NEON_CYAN, 0.6);
    bg.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
    bg.setDepth(2);
    this._cardElements.push(bg);

    // 라벨 (무기 강화 / 새 패시브 / 새 무기 등)
    let labelColor;
    if (choice.type === 'weapon_upgrade') {
      labelColor = UI_COLORS.neonOrange;
    } else if (choice.type === 'new_passive') {
      labelColor = UI_COLORS.neonGreen;
    } else if (choice.type === 'new_weapon') {
      labelColor = UI_COLORS.neonMagenta;
    } else {
      labelColor = UI_COLORS.neonCyan;
    }

    const labelText = this.add.text(x, y - cardH / 2 + 14, choice.label || '', {
      fontSize: '8px',
      fontFamily: 'Galmuri11, monospace',
      color: labelColor,
    }).setOrigin(0.5).setDepth(3);
    this._cardElements.push(labelText);

    // 아이콘: 이미지 텍스처 우선, 없으면 이모지 폴백
    const weaponTypes = ['weapon_upgrade', 'new_weapon'];
    const iconKey = weaponTypes.includes(choice.type)
      ? 'icon_weapon_' + choice.id
      : 'icon_passive_' + choice.id;

    if (this.textures.exists(iconKey)) {
      const iconImg = this.add.image(x, y - 35, iconKey)
        .setDisplaySize(28, 28).setOrigin(0.5).setDepth(3);
      this._cardElements.push(iconImg);
    } else {
      const iconText = this.add.text(x, y - 35, choice.icon || '?', {
        fontSize: '24px',
      }).setOrigin(0.5).setDepth(3);
      this._cardElements.push(iconText);
    }

    // 이름
    const nameText = this.add.text(x, y - 5, choice.name || '', {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
      wordWrap: { width: cardW - 8 },
      align: 'center',
    }).setOrigin(0.5).setDepth(3);
    this._cardElements.push(nameText);

    // 레벨 표시
    let lvText = '';
    if (choice.type === 'new_passive' || choice.type === 'new_weapon') {
      lvText = t('levelup.new');
    } else if (choice.currentLv != null && choice.nextLv != null) {
      lvText = t('levelup.nextLevel', choice.currentLv, choice.nextLv);
    }
    const lvLabel = this.add.text(x, y + 20, lvText, {
      fontSize: '9px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonGreen,
    }).setOrigin(0.5).setDepth(3);
    this._cardElements.push(lvLabel);

    // 효과 설명
    const descText = this.add.text(x, y + 45, choice.desc || '', {
      fontSize: '7px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: cardW - 12 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);
    this._cardElements.push(descText);

    // 터치 영역
    const zone = this.add.zone(x, y, cardW, cardH)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    this._cardElements.push(zone);

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(COLORS.UI_PANEL, 1);
      bg.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(2, COLORS.NEON_CYAN, 1);
      bg.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(COLORS.UI_PANEL, 0.95);
      bg.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1, COLORS.NEON_CYAN, 0.6);
      bg.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 8);
    });

    zone.on('pointerdown', () => {
      this._applyChoice(choice);
    });
  }
}
