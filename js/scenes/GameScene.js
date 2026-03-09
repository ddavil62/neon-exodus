/**
 * @fileoverview 핵심 게임플레이 씬.
 *
 * 플레이어 이동, 자동 공격, 적 스폰, XP 보석, 레벨업, HUD를 통합 관리한다.
 * 15분 런 타이머가 만료되면 최종 보스가 등장하고, 보스 처치 시 클리어된다.
 * 물리 충돌(투사체-적, 적-플레이어, 플레이어-XP보석)을 설정하며
 * WaveSystem/WeaponSystem/VirtualJoystick을 조율한다.
 */

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  COLORS,
  UI_COLORS,
  RUN_DURATION,
  CAMERA_LERP,
  WEAPON_SLOTS,
  ENDLESS_SCALE_INTERVAL,
  ADMOB_UNITS,
  AD_LIMITS,
} from '../config.js';
import { t } from '../i18n.js';
import Player from '../entities/Player.js';
import VirtualJoystick from '../systems/VirtualJoystick.js';
import WeaponSystem from '../systems/WeaponSystem.js';
import WaveSystem from '../systems/WaveSystem.js';
import ObjectPool from '../systems/ObjectPool.js';
import XPGem from '../entities/XPGem.js';
import { MetaManager } from '../managers/MetaManager.js';
import { SaveManager } from '../managers/SaveManager.js';
import { WEAPON_EVOLUTIONS } from '../data/weapons.js';
import { getCharacterById } from '../data/characters.js';
import SoundSystem from '../systems/SoundSystem.js';
import VFXSystem from '../systems/VFXSystem.js';
import { AdManager } from '../managers/AdManager.js';
import { IAPManager } from '../managers/IAPManager.js';
import AutoPilotSystem from '../systems/AutoPilotSystem.js';
import { getPassiveById } from '../data/passives.js';

// ── 접촉 데미지 쿨다운 (ms) ──
/** 같은 적이 연속으로 접촉 데미지를 주지 않도록 하는 최소 간격 */
const CONTACT_DAMAGE_COOLDOWN = 500;

// ── 무기 아이콘 맵 ──
/** @type {Object.<string, string>} 무기 ID -> 표시 이모지 */
const WEAPON_ICON_MAP = {
  blaster:          '\u{1F52B}',
  laser_gun:        '\u26A1',
  plasma_orb:       '\u{1F49C}',
  electric_chain:   '\u{1F329}\uFE0F',
  missile:          '\u{1F680}',
  drone:            '\u{1F916}',
  emp_blast:        '\u{1F4A5}',
  precision_cannon: '\u{1F3AF}',
  plasma_storm:     '\u{1F300}',
  nuke_missile:     '\u2622\uFE0F',
};

/** 무기 아이콘 맵에 없는 무기의 fallback 아이콘 */
const WEAPON_ICON_FALLBACK = '\u2694\uFE0F';

// ── GameScene 클래스 ──

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // ── Phaser 라이프사이클 ──

  /**
   * 씬 초기화 데이터를 수신한다.
   * @param {{ characterId?: string }} data - 캐릭터 선택 정보
   */
  init(data) {
    /** 선택된 캐릭터 ID (기본: agent) */
    this.characterId = data?.characterId || 'agent';
  }

  /**
   * 게임 씬을 초기화하고 모든 시스템을 셋업한다.
   */
  create() {
    // ── 월드 설정 ──
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 배경: 타일 스프라이트로 월드 전체를 채움
    this.bgTile = this.add.tileSprite(
      0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'bg_tile'
    ).setOrigin(0, 0).setDepth(-10);

    // ── XP 보석 오브젝트 풀 ──
    this.xpGemPool = new ObjectPool(this, XPGem, 100);

    // ── 플레이어 ──
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    // ── 카메라 설정 ──
    this.cameras.main.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── MetaManager 보너스 적용 ──
    const bonuses = MetaManager.getPlayerBonuses();

    // 부활/리롤 상태
    /** 남은 부활 횟수 */
    this.revivesLeft = bonuses.revives || 0;

    /** 남은 리롤 횟수 */
    this.rerollsLeft = bonuses.rerolls || 0;

    /** 최대 무기 슬롯 수 (기본 6 + 한도돌파 보너스) */
    this.maxWeaponSlots = WEAPON_SLOTS + (bonuses.extraWeaponSlots || 0);

    // 플레이어에 메타 업그레이드 스탯 반영
    this.player.applyMetaUpgrades({
      attackLevel: SaveManager.getUpgradeLevel('attack'),
      maxHpLevel: SaveManager.getUpgradeLevel('maxHp'),
      regenLevel: SaveManager.getUpgradeLevel('hpRegen'),
      defenseLevel: SaveManager.getUpgradeLevel('defense'),
      speedLevel: SaveManager.getUpgradeLevel('moveSpeed'),
      cooldownLevel: SaveManager.getUpgradeLevel('cooldown'),
      projSpeedLevel: SaveManager.getUpgradeLevel('projectileSpeed'),
      areaLevel: SaveManager.getUpgradeLevel('areaOfEffect'),
      xpLevel: SaveManager.getUpgradeLevel('xpGain'),
      magnetLevel: SaveManager.getUpgradeLevel('xpMagnet'),
      invincibleLevel: SaveManager.getUpgradeLevel('vanish'),
    });

    // ── 캐릭터 고유 패시브 적용 ──
    const charData = getCharacterById(this.characterId);

    if (charData && charData.uniquePassive) {
      const up = charData.uniquePassive;

      if (up.stat === 'critDamageMultiplier') {
        this.player.critDamageMultiplier = up.value;
      } else if (up.stat === 'lowHpAttackBonus') {
        this.player.lowHpAttackBonus = up.value;
        this.player.hpThreshold = up.hpThreshold || 0.5;
      } else if (up.stat === 'hpRegenMultiplier') {
        // 메딕: HP 재생 x2, 최대 HP -30%
        this.player.regenMultiplier = up.value;
        this.player.maxHp *= (1 - (up.maxHpPenalty || 0));
        this.player.currentHp = this.player.maxHp;
      } else if (up.stat === 'weaponMaster') {
        // 히든: 무기 슬롯 +2, 레벨업 무기 추천 가중치 x2
        this.maxWeaponSlots += up.extraWeaponSlots;
        this.player.weaponChoiceBias = up.weaponChoiceBias;
      } else if (up.stat === 'droneSummonBonus') {
        // 엔지니어: 드론 소환 보너스
        this.player.droneSummonBonus = up.value;
      }
    }

    // 캐릭터 시작 무기 결정
    let startWeaponId = charData ? charData.startWeapon : 'blaster';

    /** 달성한 무기 진화 수 */
    this.weaponEvolutions = 0;

    // ── 시스템 초기화 ──
    this.joystick = new VirtualJoystick(this);

    // ── 자동 사냥(AutoPilot) 시스템 ──
    this.autoPilot = new AutoPilotSystem(this, this.player);

    // 자동 사냥 해금 상태 확인 및 이전 런 설정 복원
    this._autoHuntUnlocked = IAPManager.isAutoHuntUnlocked();
    if (this._autoHuntUnlocked) {
      const savedEnabled = SaveManager.getData().autoHuntEnabled === true;
      if (savedEnabled) {
        this.autoPilot.activate();
      }
    }

    this.weaponSystem = new WeaponSystem(this, this.player);

    // 초기 무기 레벨 (메타 보너스 반영)
    const startWeaponLv = Math.min(bonuses.startWeaponLevel || 1, 8);
    this.weaponSystem.addWeapon(startWeaponId, startWeaponLv);

    this.waveSystem = new WaveSystem(this, this.player);

    // ── 충돌 설정 ──
    // 투사체 ↔ 적
    this.physics.add.overlap(
      this.weaponSystem.projectilePool.group,
      this.waveSystem.enemyPool.group,
      this._onProjectileHitEnemy,
      null,
      this
    );

    // 플레이어 ↔ 적 (접촉 데미지)
    this.physics.add.overlap(
      this.player,
      this.waveSystem.enemyPool.group,
      this._onEnemyContactPlayer,
      null,
      this
    );

    // 플레이어 ↔ XP 보석
    this.physics.add.overlap(
      this.player,
      this.xpGemPool.group,
      this._onCollectXPGem,
      null,
      this
    );

    // ── 게임 상태 ──
    /** 런 경과 시간 (초) */
    this.runTime = 0;

    /** 일시정지 상태 */
    this.isPaused = false;

    /** 게임 종료 상태 */
    this.isGameOver = false;

    /** 킬 카운트 */
    this.killCount = 0;

    /** 획득 크레딧 */
    this.creditsEarned = 0;

    /** 최종 보스 스폰 여부 */
    this.finalBossSpawned = false;

    /** 엔들리스 모드 여부 */
    this.isEndlessMode = false;

    /** 엔들리스 모드 경과 분 */
    this.endlessMinutes = 0;

    /** 접촉 데미지 쿨다운 맵 (적 ID → 마지막 접촉 시각) */
    this._contactCooldowns = new Map();

    // ── HUD 생성 ──
    this._createHUD();

    // ── 일시정지 오버레이 (초기 숨김) ──
    this._createPauseOverlay();

    // ── BGM: 게임 BGM 시작 ──
    SoundSystem.resume();
    SoundSystem.playBgm('bgm_game');

    // ── ESC 키로 일시정지 토글 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());
  }

  /**
   * 매 프레임 호출. 시스템 업데이트, 엔티티 업데이트, HUD 갱신을 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (this.isPaused || this.isGameOver) return;

    // 시간 갱신
    this.runTime += delta / 1000;

    // 시스템 업데이트
    if (this.autoPilot && this.autoPilot.enabled) {
      this.autoPilot.update(time, delta);
    }
    this.player.update(time, delta);
    this.weaponSystem.update(time, delta);
    this.weaponSystem.renderBeams();
    this.waveSystem.update(time, delta);

    // XP 보석 업데이트
    this.xpGemPool.forEach((gem) => {
      gem.update(time, delta);
    });

    // HUD 갱신
    this._updateHUD();
  }

  // ── 씬 콜백 (엔티티/시스템에서 호출) ──

  /**
   * 플레이어 레벨업 시 호출된다. LevelUpScene을 오버레이로 띄운다.
   */
  onLevelUp() {
    // 레벨업 SFX/VFX
    SoundSystem.play('levelup');
    VFXSystem.levelUpBurst(this, this.player.x, this.player.y);

    this.scene.pause('GameScene');
    this.scene.launch('LevelUpScene', {
      player: this.player,
      weaponSystem: this.weaponSystem,
      level: this.player.level,
      rerollsLeft: this.rerollsLeft,
      maxWeaponSlots: this.maxWeaponSlots,
      weaponChoiceBias: this.player.weaponChoiceBias,
    });

    // LevelUpScene으로부터 남은 리롤 수 수신 및 진화 체크
    const levelUpScene = this.scene.get('LevelUpScene');
    levelUpScene.events.once('levelupDone', (data) => {
      if (data && data.rerollsLeft !== undefined) {
        this.rerollsLeft = data.rerollsLeft;
      }
      // 무기/패시브 변경 후 진화 조건 체크
      this._tryEvolutionCheck();
      // 인벤토리 HUD 갱신 (레벨업, 진화 반영)
      this._refreshInventoryHUD();
    });
  }

  /**
   * 플레이어 사망 시 호출된다.
   * 부활 횟수가 남아있으면 부활 처리하고, 아니면 광고 부활 팝업을 표시한다.
   * 광고 부활도 불가능하면 ResultScene으로 전환한다.
   */
  onPlayerDeath() {
    // 메타 부활 처리
    if (this.revivesLeft > 0) {
      this.revivesLeft--;
      this.player.currentHp = Math.floor(this.player.maxHp * 0.5);
      this.player.active = true;

      // 2초 무적
      this.player.invincible = true;
      this.player.invincibleTimer = 2000;

      // 화면 플래시 효과
      this.cameras.main.flash(500, 255, 255, 255, false);

      // 부활 SFX + 메시지 표시
      SoundSystem.play('revive');
      this._showWarning(t('game.revived'));
      return;
    }

    // 광고 부활 팝업 표시 (일일 제한 미도달 시)
    if (!AdManager.isAdLimitReached('adRevive')) {
      this._showAdRevivePopup();
      return;
    }

    // 광고 부활도 불가 — 결과 화면으로 전환
    this._goToResult(false);
  }

  /**
   * 무기별 통계 리포트를 생성한다.
   * WeaponSystem의 weaponStats와 weapons 배열을 결합하여
   * 각 무기의 이름, 킬 수, 데미지, DPS를 배열로 반환한다.
   * @returns {Array<{ id: string, nameKey: string, kills: number, damage: number, dps: number }>}
   * @private
   */
  _buildWeaponReport() {
    const report = [];
    if (!this.weaponSystem) return report;

    const runTimeSec = Math.max(1, this.runTime);

    for (const weapon of this.weaponSystem.weapons) {
      const wId = weapon.id;
      const stats = this.weaponSystem.weaponStats.get(wId) || { kills: 0, damage: 0 };
      const nameKey = weapon._evolvedNameKey || `weapon.${wId}.name`;
      const dps = Math.round(stats.damage / runTimeSec);

      report.push({
        id: wId,
        nameKey: nameKey,
        kills: stats.kills,
        damage: stats.damage,
        dps: dps,
      });
    }

    // 데미지 높은 순으로 정렬
    report.sort((a, b) => b.damage - a.damage);

    return report;
  }

  /**
   * 결과 화면으로 전환한다.
   * @param {boolean} victory - 승리 여부
   * @private
   */
  _goToResult(victory) {
    this.isGameOver = true;

    // BGM 정지 (결과 화면에서 게임 BGM이 계속 재생되는 것을 방지)
    SoundSystem.stopBgm();

    // 약간의 딜레이 후 결과 화면
    this.time.delayedCall(500, () => {
      // 무기별 통계 스냅샷 (씬 전환 전 복사)
      const weaponReport = this._buildWeaponReport();

      this._cleanup();
      this.scene.start('ResultScene', {
        victory: victory,
        isEndless: this.isEndlessMode,
        endlessMinutes: this.endlessMinutes,
        killCount: this.killCount,
        runTime: this.runTime,
        creditsEarned: this.creditsEarned,
        level: this.player.level,
        weaponSlotsFilled: this.weaponSystem.weapons.length,
        weaponEvolutions: this.weaponEvolutions,
        weaponReport: weaponReport,
      });
    });
  }

  /**
   * 적 처치 시 호출된다 (Enemy.die() 내부에서 호출).
   * 킬 카운트 증가 및 보스 처치 판정만 처리한다.
   * (크레딧 드랍은 Enemy.die()에서 addCredits()를 직접 호출)
   * @param {import('../entities/Enemy.js').default} enemy - 처치된 적
   * @param {string|null} [weaponId=null] - 처치한 무기 ID (통계 추적용)
   */
  onEnemyKilled(enemy, weaponId = null) {
    this.killCount++;

    // 무기별 킬 통계 기록
    if (weaponId && this.weaponSystem) {
      this.weaponSystem.recordKill(weaponId);
    }

    // 적 사망 VFX
    VFXSystem.enemyDie(this, enemy.x, enemy.y);

    // 적 도감 등록
    if (enemy.typeId) {
      SaveManager.addToCollection('enemiesSeen', enemy.typeId);
    }

    // 보스 처치 시 totalBossKills 통계 증가
    if (enemy.isBoss) {
      SaveManager.updateStats('totalBossKills', 1);
    }

    // 최종 보스 처치 판정 → 엔들리스 모드 전환
    if (enemy.isBoss && enemy.typeId === 'core_processor') {
      if (!this.isEndlessMode) {
        this._onEnterEndless();
      }
      // 엔들리스 중 코어 프로세서 재처치: WaveSystem이 자동 다시 스폰
    }
  }

  /**
   * XP 보석을 스폰한다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} type - 보석 타입 ('small'|'medium'|'large')
   */
  spawnXPGem(x, y, type) {
    const gem = this.xpGemPool.get(x, y);
    if (gem) {
      gem.spawn(x, y, type);
    }
  }

  /**
   * 크레딧을 추가한다.
   * @param {number} amount - 크레딧 양
   */
  addCredits(amount) {
    this.creditsEarned += amount;
  }

  /**
   * 미니보스 스폰 시 호출된다. 오렌지 카메라 플래시 + 경고 표시.
   * @param {import('../entities/Enemy.js').default} enemy - 스폰된 미니보스
   */
  onMiniBossSpawn(enemy) {
    // 미니보스 등장: 오렌지 플래시 300ms
    this.cameras.main.flash(300, 255, 100, 0, false);
    this._showWarning(t('hud.minibossWarning'));
  }

  /**
   * 보스 스폰 시 호출된다. 마젠타 카메라 플래시 + 카메라 흔들림 + 경고 표시.
   * @param {import('../entities/Enemy.js').default} enemy - 스폰된 보스
   */
  onBossSpawn(enemy) {
    SoundSystem.play('boss_appear');
    // 보스 등장: 마젠타 플래시 500ms + 카메라 흔들림 500ms
    this.cameras.main.flash(500, 255, 0, 255, false);
    this.cameras.main.shake(500, 0.02);
    this._showWarning(t('hud.bossWarning'));
  }

  /**
   * 폭발 이펙트를 생성한다 (스파크 드론, 자폭봇, 보스 포격 등에서 사용).
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {number} radius - 폭발 반경
   * @param {number} damage - 폭발 데미지
   */
  createExplosion(x, y, radius, damage) {
    const gfx = this.add.graphics();
    gfx.fillStyle(COLORS.NEON_ORANGE, 0.4);
    gfx.fillCircle(x, y, radius);
    gfx.lineStyle(2, COLORS.NEON_ORANGE, 0.8);
    gfx.strokeCircle(x, y, radius);
    gfx.setDepth(8);

    // 페이드아웃 후 제거
    this.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 400,
      onComplete: () => gfx.destroy(),
    });
  }

  // ── 광고 부활 팝업 ──

  /**
   * 광고 부활 팝업을 표시한다.
   * 게임을 일시정지하고, 광고 시청 또는 포기를 선택할 수 있다.
   * 10초 타임아웃 시 자동으로 포기 처리된다.
   * @private
   */
  _showAdRevivePopup() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 게임 일시정지
    this.isPaused = true;
    this.physics.pause();

    // 팝업 요소를 저장할 배열 (정리 시 사용)
    const popupElements = [];

    // 반투명 배경
    const overlay = this.add.rectangle(
      centerX, centerY, GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.75
    ).setScrollFactor(0).setDepth(400);
    popupElements.push(overlay);

    // 타이틀 텍스트
    const titleText = this.add.text(centerX, centerY - 70, t('ad.revive'), {
      fontSize: '22px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
    popupElements.push(titleText);

    // 설명 텍스트
    const descText = this.add.text(centerX, centerY - 38, t('ad.reviveDesc'), {
      fontSize: '13px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
    popupElements.push(descText);

    // 광고 보기 버튼
    const adBtnWidth = 180;
    const adBtnHeight = 40;
    const adBtnY = centerY + 10;

    const remaining = AdManager.getRemainingAdCount('adRevive');
    const limit = AD_LIMITS.adRevive;
    const used = limit - remaining;
    const limitReached = AdManager.isAdLimitReached('adRevive');

    const adBtnBg = this.add.graphics()
      .setScrollFactor(0).setDepth(401);
    const adBtnColor = limitReached ? UI_COLORS.btnDisabled : COLORS.NEON_ORANGE;
    adBtnBg.fillStyle(adBtnColor, 0.9);
    adBtnBg.fillRoundedRect(
      centerX - adBtnWidth / 2, adBtnY - adBtnHeight / 2,
      adBtnWidth, adBtnHeight, 6
    );
    popupElements.push(adBtnBg);

    const adBtnLabel = limitReached
      ? t('ad.reviveBtn')
      : `${t('ad.reviveBtn')} ${t('ad.reviveBtnCount', used, limit)}`;

    const adBtnText = this.add.text(centerX, adBtnY, adBtnLabel, {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: limitReached ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(402);
    popupElements.push(adBtnText);

    // 포기 버튼
    const giveUpBtnY = centerY + 60;

    const giveUpBg = this.add.graphics()
      .setScrollFactor(0).setDepth(401);
    giveUpBg.fillStyle(UI_COLORS.btnSecondary, 0.8);
    giveUpBg.fillRoundedRect(
      centerX - adBtnWidth / 2, giveUpBtnY - adBtnHeight / 2,
      adBtnWidth, adBtnHeight, 6
    );
    popupElements.push(giveUpBg);

    const giveUpText = this.add.text(centerX, giveUpBtnY, t('ad.reviveGiveUp'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.hpRed,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(402);
    popupElements.push(giveUpText);

    /** 팝업을 제거하고 게임 상태를 정리한다. */
    const destroyPopup = () => {
      if (timeoutEvent) timeoutEvent.remove(false);
      popupElements.forEach((el) => {
        if (el && el.destroy) el.destroy();
      });
      if (adZone && adZone.destroy) adZone.destroy();
      if (giveUpZone && giveUpZone.destroy) giveUpZone.destroy();
    };

    /** 포기 처리: 팝업 제거 후 결과 화면 전환 */
    const onGiveUp = () => {
      destroyPopup();
      // 일시정지 해제 후 결과 화면 전환
      this.isPaused = false;
      this.physics.resume();
      this._goToResult(false);
    };

    // 10초 타임아웃 → 자동 포기
    const timeoutEvent = this.time.delayedCall(10000, () => {
      onGiveUp();
    });

    // 광고 로딩 중 모든 버튼 입력 차단 플래그
    let adLoading = false;

    // 광고 보기 버튼 인터랙션 (비활성이 아닐 때만)
    let adZone = null;
    if (!limitReached) {
      adZone = this.add.zone(centerX, adBtnY, adBtnWidth, adBtnHeight)
        .setScrollFactor(0).setDepth(403)
        .setInteractive({ useHandCursor: true });

      let adPressed = false;
      adZone.on('pointerdown', () => {
        if (adLoading) return;
        adPressed = true;
        adBtnText.setAlpha(0.6);
      });
      adZone.on('pointerup', async () => {
        adBtnText.setAlpha(1);
        if (!adPressed || adLoading) return;
        adPressed = false;

        // 광고 로딩 시작 — 모든 버튼 입력 차단
        adLoading = true;
        adBtnText.setAlpha(0.4);
        giveUpText.setAlpha(0.4);

        // 광고 재생 중 타임아웃 발동 방지 (광고는 보통 15~30초 소요)
        if (timeoutEvent) timeoutEvent.remove(false);

        const result = await AdManager.showRewarded(ADMOB_UNITS.adRevive);
        if (result.rewarded) {
          AdManager.incrementDailyAdCount('adRevive');

          // 팝업 제거
          destroyPopup();

          // HP 50% 회복
          this.player.currentHp = Math.floor(this.player.maxHp * 0.5);
          this.player.active = true;

          // 3초 무적
          this.player.invincible = true;
          this.player.invincibleTimer = 3000;

          // 화면 플래시 효과
          this.cameras.main.flash(500, 255, 255, 255, false);

          // 부활 SFX + 메시지 표시
          SoundSystem.play('revive');
          this._showWarning(t('game.revived'));

          // 게임 재개
          this.isPaused = false;
          this.physics.resume();
        } else {
          // 광고 실패/취소 — 버튼 입력 다시 허용
          adLoading = false;
          adBtnText.setAlpha(1);
          giveUpText.setAlpha(1);
        }
      });
      adZone.on('pointerout', () => { adPressed = false; adBtnText.setAlpha(adLoading ? 0.4 : 1); });
    }

    // 포기 버튼 인터랙션
    const giveUpZone = this.add.zone(centerX, giveUpBtnY, adBtnWidth, adBtnHeight)
      .setScrollFactor(0).setDepth(403)
      .setInteractive({ useHandCursor: true });

    let giveUpPressed = false;
    giveUpZone.on('pointerdown', () => {
      if (adLoading) return;
      giveUpPressed = true;
      giveUpText.setAlpha(0.6);
    });
    giveUpZone.on('pointerup', () => {
      giveUpText.setAlpha(adLoading ? 0.4 : 1);
      if (giveUpPressed && !adLoading) onGiveUp();
      giveUpPressed = false;
    });
    giveUpZone.on('pointerout', () => { giveUpPressed = false; giveUpText.setAlpha(1); });
  }

  // ── 무기 진화 체크 ──

  /**
   * 무기 진화 조건을 체크하고, 조건 충족 시 자동 진화를 처리한다.
   * LevelUpScene에서 무기/패시브 업그레이드 적용 후 호출한다.
   */
  _tryEvolutionCheck() {
    for (const evo of WEAPON_EVOLUTIONS) {
      const weapon = this.weaponSystem.getWeapon(evo.weaponId);
      if (!weapon) continue;

      // 이미 진화한 무기는 건너뛴다
      if (weapon._evolvedId) continue;

      const weaponMaxed = weapon.level >= (weapon.data.maxLevel || 8);
      if (!weaponMaxed) continue;

      // 패시브 레벨 확인
      const passiveLv = (this.player._passives || {})[evo.passiveId] || 0;
      if (passiveLv < 5) continue;

      // 진화 조건 충족!
      const success = this.weaponSystem.evolveWeapon(evo.weaponId, evo.resultId);
      if (success) {
        this.weaponEvolutions++;
        SoundSystem.play('evolution');
        this._showEvolutionPopup(evo.resultNameKey);
      }
    }
  }

  /**
   * 진화 성공 팝업을 표시한다.
   * @param {string} nameKey - 진화 무기 이름 i18n 키
   * @private
   */
  _showEvolutionPopup(nameKey) {
    // 카메라 플래시 (금색)
    this.cameras.main.flash(300, 255, 215, 0);

    const popupText = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80,
      `${t(nameKey)} EVOLVED!`,
      {
        fontSize: '20px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    // 2초 후 자동 소멸
    this.tweens.add({
      targets: popupText,
      alpha: 0,
      y: popupText.y - 30,
      duration: 500,
      delay: 1500,
      onComplete: () => popupText.destroy(),
    });
  }

  // ── 충돌 콜백 (내부) ──

  /**
   * 투사체가 적에게 적중했을 때 처리한다.
   * @param {import('../entities/Projectile.js').default} projectile - 투사체
   * @param {import('../entities/Enemy.js').default} enemy - 적
   * @private
   */
  _onProjectileHitEnemy(projectile, enemy) {
    if (!projectile.active || !enemy.active) return;

    const dmg = projectile.damage;
    const weaponId = projectile.weaponId || null;
    enemy.takeDamage(dmg, true, projectile, weaponId);

    // 무기별 데미지 통계 기록
    if (weaponId && this.weaponSystem) {
      this.weaponSystem.recordDamage(weaponId, dmg);
    }

    // 적 피격 VFX/SFX
    VFXSystem.hitSpark(this, enemy.x, enemy.y);
    SoundSystem.play('hit');

    // 치명타 투사체 적중 시 시각 효과 표시
    if (projectile.isCrit && this.weaponSystem) {
      this.weaponSystem._showCritEffect(enemy.x, enemy.y);
    }

    projectile.onHitEnemy(enemy);
  }

  /**
   * 적이 플레이어에게 접촉했을 때 처리한다.
   * 접촉 쿨다운을 적용하여 연속 데미지를 방지한다.
   * @param {import('../entities/Player.js').default} player - 플레이어
   * @param {import('../entities/Enemy.js').default} enemy - 적
   * @private
   */
  _onEnemyContactPlayer(player, enemy) {
    if (!player.active || !enemy.active) return;
    if (enemy.contactDamage <= 0) return;

    // 접촉 쿨다운 체크
    const now = this.time.now;
    const lastContact = this._contactCooldowns.get(enemy) || 0;
    if (now - lastContact < CONTACT_DAMAGE_COOLDOWN) return;

    this._contactCooldowns.set(enemy, now);
    player.takeDamage(enemy.contactDamage);

    // 플레이어 피격 VFX/SFX
    VFXSystem.playerHit(this, player.x, player.y);
    SoundSystem.play('player_hit');
  }

  /**
   * 플레이어가 XP 보석을 수집했을 때 처리한다.
   * @param {import('../entities/Player.js').default} player - 플레이어
   * @param {import('../entities/XPGem.js').default} gem - XP 보석
   * @private
   */
  _onCollectXPGem(player, gem) {
    if (!player.active || !gem.active) return;

    // XP 수집 SFX/VFX
    SoundSystem.play('xp_collect');
    VFXSystem.xpCollect(this, gem.x, gem.y);

    gem.collect();
  }

  // ── 엔들리스 모드 ──

  /**
   * 엔들리스 모드에 진입한다. 코어 프로세서 첫 처치 시 호출.
   * @private
   */
  _onEnterEndless() {
    this.isEndlessMode = true;
    this.isGameOver = false;
    this._showWarning(t('game.endlessMode'));
    this.waveSystem.enterEndlessMode();

    // 스케일링 간격마다 적 강화
    this.time.addEvent({
      delay: ENDLESS_SCALE_INTERVAL,
      repeat: -1,
      callback: () => {
        if (!this.isEndlessMode) return;
        this.endlessMinutes++;
        this.waveSystem.applyEndlessScale(this.endlessMinutes);
      },
    });

    // 5분마다 미니보스 리스폰
    this.time.addEvent({
      delay: 300000,
      repeat: -1,
      callback: () => {
        if (!this.isEndlessMode) return;
        this.waveSystem.spawnEndlessMiniboss();
      },
    });
  }

  // ── 경고 표시 ──

  /**
   * 화면 중앙에 경고 메시지를 잠시 표시한다.
   * @param {string} message - 경고 메시지
   * @private
   */
  _showWarning(message) {
    const warningText = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
      message,
      {
        fontSize: '18px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.hpRed,
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 깜빡임 후 제거
    this.tweens.add({
      targets: warningText,
      alpha: { from: 1, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: 3,
      onComplete: () => warningText.destroy(),
    });
  }

  // ── HUD ──

  /**
   * HUD UI 요소를 생성한다. scrollFactor(0)으로 카메라에 고정.
   * @private
   */
  _createHUD() {
    const hud = {};

    // ── 일시정지 버튼 (좌상단) ──
    hud.pauseBtn = this.add.text(12, 10, '❚❚', {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });

    hud.pauseBtn.on('pointerdown', () => {
      this._togglePause();
    });

    // ── 자동 사냥 토글 버튼 (우상단, 레벨 옆) ──
    if (this._autoHuntUnlocked) {
      const autoLabel = this.autoPilot.enabled
        ? t('autoHunt.on')
        : t('autoHunt.off');
      const autoColor = this.autoPilot.enabled
        ? UI_COLORS.neonGreen
        : UI_COLORS.textSecondary;

      hud.autoHuntBtn = this.add.text(GAME_WIDTH - 12, 48, autoLabel, {
        fontSize: '11px',
        fontFamily: 'Galmuri11, monospace',
        color: autoColor,
        backgroundColor: '#1A1A2E',
        padding: { x: 6, y: 3 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100)
        .setInteractive({ useHandCursor: true });

      hud.autoHuntBtn.on('pointerdown', () => {
        this._toggleAutoHunt();
      });
    }

    // ── HP 바 ──
    const hpBarX = 42;
    const hpBarY = 12;
    const hpBarW = 220;
    const hpBarH = 14;

    hud.hpBarBg = this.add.graphics()
      .setScrollFactor(0).setDepth(100);
    hud.hpBarBg.fillStyle(0x333333, 0.8);
    hud.hpBarBg.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    hud.hpBar = this.add.graphics()
      .setScrollFactor(0).setDepth(101);

    hud.hpBarX = hpBarX;
    hud.hpBarY = hpBarY;
    hud.hpBarW = hpBarW;
    hud.hpBarH = hpBarH;

    // HP 텍스트
    hud.hpText = this.add.text(hpBarX + 4, hpBarY + 1, t('hud.hp'), {
      fontSize: '10px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setScrollFactor(0).setDepth(102);

    // ── 레벨 표시 ──
    hud.levelText = this.add.text(GAME_WIDTH - 12, 12, t('hud.level', 1), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // ── XP 바 ──
    const xpBarY = 32;
    const xpBarW = 250;
    const xpBarH = 8;
    const xpBarX = 12;

    hud.xpBarBg = this.add.graphics()
      .setScrollFactor(0).setDepth(100);
    hud.xpBarBg.fillStyle(0x333333, 0.6);
    hud.xpBarBg.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);

    hud.xpBar = this.add.graphics()
      .setScrollFactor(0).setDepth(101);

    hud.xpBarX = xpBarX;
    hud.xpBarY = xpBarY;
    hud.xpBarW = xpBarW;
    hud.xpBarH = xpBarH;

    // ── 타이머 ──
    hud.timerText = this.add.text(GAME_WIDTH - 12, 32, '', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // ── 하단 바: 크레딧 (좌), 킬수 (우) ──
    hud.creditText = this.add.text(12, GAME_HEIGHT - 24, '', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setScrollFactor(0).setDepth(100);

    hud.killText = this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 24, '', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // 인벤토리 HUD 컨테이너 초기화
    this._inventoryHUD = { weapons: [], passives: [] };

    this._hud = hud;

    // 초기 렌더링 (씬 시작 시 보유 무기 표시)
    this._refreshInventoryHUD();
  }

  /**
   * HUD 요소를 매 프레임 갱신한다.
   * @private
   */
  _updateHUD() {
    const hud = this._hud;
    if (!hud) return;

    const p = this.player;

    // HP 바 갱신
    const hpRatio = Math.max(0, p.currentHp / p.maxHp);
    hud.hpBar.clear();
    // HP 비율에 따라 색상 변경 (50% 이하: 빨강)
    const hpColor = hpRatio > 0.5 ? COLORS.NEON_GREEN : COLORS.HP_RED;
    hud.hpBar.fillStyle(hpColor, 0.9);
    hud.hpBar.fillRect(
      hud.hpBarX, hud.hpBarY,
      hud.hpBarW * hpRatio, hud.hpBarH
    );

    // XP 바 갱신
    const xpRatio = Math.min(1, p.xp / p.xpToNext);
    hud.xpBar.clear();
    hud.xpBar.fillStyle(COLORS.XP_YELLOW, 0.9);
    hud.xpBar.fillRect(
      hud.xpBarX, hud.xpBarY,
      hud.xpBarW * xpRatio, hud.xpBarH
    );

    // 레벨 텍스트
    hud.levelText.setText(t('hud.level', p.level));

    // 타이머 (엔들리스 모드에서는 +MM:SS 카운트업)
    if (this.isEndlessMode) {
      const endlessElapsed = this.runTime - RUN_DURATION;
      const eMin = Math.floor(Math.max(0, endlessElapsed) / 60);
      const eSec = Math.floor(Math.max(0, endlessElapsed) % 60);
      const endlessStr = `+${String(eMin).padStart(2, '0')}:${String(eSec).padStart(2, '0')}`;
      hud.timerText.setText(endlessStr);
    } else {
      const remaining = Math.max(0, RUN_DURATION - this.runTime);
      const min = Math.floor(remaining / 60);
      const sec = Math.floor(remaining % 60);
      const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      hud.timerText.setText(t('hud.timer', timeStr));
    }

    // 크레딧
    hud.creditText.setText(t('hud.credits', this.creditsEarned));

    // 킬수
    hud.killText.setText(t('hud.kills', this.killCount));
  }

  /**
   * 인벤토리 HUD(무기 행 + 패시브 행)를 갱신한다.
   * 기존 슬롯을 모두 destroy 후 현재 보유 아이템 기반으로 재생성한다.
   * 이벤트 기반 호출이므로 매 프레임 갱신하지 않는다.
   * @private
   */
  _refreshInventoryHUD() {
    const inv = this._inventoryHUD;
    if (!inv) return;

    // ── 기존 슬롯 정리 ──
    inv.weapons.forEach((slot) => {
      if (slot.bg && slot.bg.destroy) slot.bg.destroy();
      if (slot.icon && slot.icon.destroy) slot.icon.destroy();
      if (slot.level && slot.level.destroy) slot.level.destroy();
    });
    inv.passives.forEach((slot) => {
      if (slot.bg && slot.bg.destroy) slot.bg.destroy();
      if (slot.icon && slot.icon.destroy) slot.icon.destroy();
      if (slot.level && slot.level.destroy) slot.level.destroy();
    });
    inv.weapons = [];
    inv.passives = [];

    // ── 무기 행 (Y = GAME_HEIGHT - 80 = 560) ──
    const weaponY = GAME_HEIGHT - 80;   // 중심 Y
    const weaponSize = 32;              // 슬롯 크기 (px)
    const weaponRadius = 5;             // 둥근 모서리 반경
    const weaponStride = 60;            // 슬롯 간격 (px)
    const weaponStartX = 30;            // 첫 슬롯 중심 X

    const weapons = this.weaponSystem ? this.weaponSystem.weapons : [];
    weapons.forEach((w, idx) => {
      const cx = weaponStartX + idx * weaponStride;

      // 배경: 반투명 검정 둥근 사각형
      const bg = this.add.graphics().setScrollFactor(0).setDepth(105);
      bg.fillStyle(0x000000, 0.55);
      bg.fillRoundedRect(
        cx - weaponSize / 2, weaponY - weaponSize / 2,
        weaponSize, weaponSize,
        weaponRadius
      );

      // 아이콘: 진화된 무기면 진화 ID로 조회
      const iconKey = w._evolvedId || w.id;
      const emoji = WEAPON_ICON_MAP[iconKey] || WEAPON_ICON_FALLBACK;
      const icon = this.add.text(cx, weaponY, emoji, {
        fontSize: '18px',
        fontFamily: 'Galmuri11, monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(106);

      // 레벨 숫자: 우하단 정렬
      const level = this.add.text(
        cx + weaponSize / 2 - 2,         // 우측 기준 2px 안쪽
        weaponY + weaponSize / 2 - 1,    // 하단 기준 1px 안쪽
        `${w.level}`,
        {
          fontSize: '9px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.xpYellow,
        }
      ).setOrigin(1, 1).setScrollFactor(0).setDepth(107);

      inv.weapons.push({ bg, icon, level });
    });

    // ── 패시브 행 (Y = GAME_HEIGHT - 46 = 594) ──
    const passiveY = GAME_HEIGHT - 46;  // 중심 Y
    const passiveSize = 28;             // 슬롯 크기 (px)
    const passiveRadius = 4;            // 둥근 모서리 반경
    const passiveStride = 36;           // 슬롯 간격 (px)
    const passiveStartX = 18;           // 첫 슬롯 중심 X

    const passives = this.player ? (this.player._passives || {}) : {};
    Object.entries(passives).forEach(([pid, plevel], idx) => {
      const cx = passiveStartX + idx * passiveStride;

      // 배경: 반투명 검정 둥근 사각형
      const bg = this.add.graphics().setScrollFactor(0).setDepth(105);
      bg.fillStyle(0x000000, 0.50);
      bg.fillRoundedRect(
        cx - passiveSize / 2, passiveY - passiveSize / 2,
        passiveSize, passiveSize,
        passiveRadius
      );

      // 아이콘: passives.js 데이터에서 icon 필드 조회
      const passiveData = getPassiveById(pid);
      const emoji = passiveData?.icon ?? '?';
      const icon = this.add.text(cx, passiveY, emoji, {
        fontSize: '15px',
        fontFamily: 'Galmuri11, monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(106);

      // 레벨 숫자: 우하단 정렬
      const level = this.add.text(
        cx + passiveSize / 2 - 2,         // 우측 기준 2px 안쪽
        passiveY + passiveSize / 2 - 1,   // 하단 기준 1px 안쪽
        `${plevel}`,
        {
          fontSize: '8px',
          fontFamily: 'Galmuri11, monospace',
          color: UI_COLORS.neonCyan,
        }
      ).setOrigin(1, 1).setScrollFactor(0).setDepth(107);

      inv.passives.push({ bg, icon, level });
    });
  }

  // ── 일시정지 ──

  /**
   * 일시정지 오버레이를 생성한다.
   * @private
   */
  _createPauseOverlay() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 반투명 배경
    this._pauseBg = this.add.rectangle(
      centerX, centerY, GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(300).setVisible(false);

    // 일시정지 텍스트
    this._pauseTitle = this.add.text(centerX, centerY - 100, t('hud.pause'), {
      fontSize: '24px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false);

    // ── 런 리포트 (처치 수, 생존 시간, 크레딧) ──
    const reportStyle = {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    };

    this._pauseKillsText = this.add.text(centerX, centerY - 60, '', reportStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false);

    this._pauseTimeText = this.add.text(centerX, centerY - 40, '', reportStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false);

    this._pauseCreditsText = this.add.text(centerX, centerY - 20, '', {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false);

    // 계속 버튼
    this._resumeText = this.add.text(centerX, centerY + 20, t('hud.resume'), {
      fontSize: '18px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonGreen,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false)
      .setInteractive({ useHandCursor: true });

    this._resumeText.on('pointerdown', () => {
      this._togglePause();
    });

    // 포기 버튼
    this._quitText = this.add.text(centerX, centerY + 70, t('hud.quit'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.hpRed,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false)
      .setInteractive({ useHandCursor: true });

    this._quitText.on('pointerdown', () => {
      // BGM 정지 (결과/메뉴 화면에서 게임 BGM이 계속 재생되는 것을 방지)
      SoundSystem.stopBgm();

      // 무기별 통계 스냅샷 (씬 전환 전 복사)
      const weaponReport = this._buildWeaponReport();

      if (this.isEndlessMode) {
        // 엔들리스 모드에서 포기하면 결과 화면으로
        this._cleanup();
        this.scene.start('ResultScene', {
          victory: true,
          isEndless: true,
          endlessMinutes: this.endlessMinutes,
          killCount: this.killCount,
          runTime: this.runTime,
          creditsEarned: this.creditsEarned,
          level: this.player.level,
          weaponSlotsFilled: this.weaponSystem.weapons.length,
          weaponEvolutions: this.weaponEvolutions,
          weaponReport: weaponReport,
        });
      } else {
        // 일반 모드 포기 — 결과 화면으로 이동하여 크레딧 정산
        this._cleanup();
        this.scene.start('ResultScene', {
          victory: false,
          killCount: this.killCount,
          runTime: this.runTime,
          creditsEarned: this.creditsEarned,
          level: this.player.level,
          weaponSlotsFilled: this.weaponSystem.weapons.length,
          weaponEvolutions: this.weaponEvolutions,
          weaponReport: weaponReport,
        });
      }
    });
  }

  /**
   * 하드웨어 뒤로가기/ESC 키 핸들러. 게임 중에는 일시정지를 토글한다.
   * @private
   */
  _onBack() {
    if (this.isGameOver) return;
    this._togglePause();
  }

  /**
   * 일시정지 토글.
   * @private
   */
  _togglePause() {
    this.isPaused = !this.isPaused;

    const visible = this.isPaused;
    this._pauseBg.setVisible(visible);
    this._pauseTitle.setVisible(visible);
    this._pauseKillsText.setVisible(visible);
    this._pauseTimeText.setVisible(visible);
    this._pauseCreditsText.setVisible(visible);
    this._resumeText.setVisible(visible);
    this._quitText.setVisible(visible);

    // 일시정지 시 런 리포트 갱신
    if (visible) {
      const min = Math.floor(this.runTime / 60);
      const sec = Math.floor(this.runTime % 60);
      const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      this._pauseKillsText.setText(t('hud.pauseKills', this.killCount));
      this._pauseTimeText.setText(t('hud.pauseTime', timeStr));
      this._pauseCreditsText.setText(t('hud.pauseCredits', this.creditsEarned));
    }

    // 물리 엔진도 함께 일시정지/재개하여 적 이동을 멈춘다
    if (this.isPaused) {
      this.physics.pause();
    } else {
      this.physics.resume();
    }
  }

  // ── 자동 사냥 토글 ──

  /**
   * 자동 사냥 활성/비활성을 토글한다.
   * 토글 상태를 SaveManager에 저장하여 다음 런에도 유지한다.
   * @private
   */
  _toggleAutoHunt() {
    if (!this.autoPilot) return;

    if (this.autoPilot.enabled) {
      this.autoPilot.deactivate();
    } else {
      this.autoPilot.activate();
    }

    // HUD 버튼 텍스트/색상 갱신
    const hud = this._hud;
    if (hud && hud.autoHuntBtn) {
      const label = this.autoPilot.enabled
        ? t('autoHunt.on')
        : t('autoHunt.off');
      const color = this.autoPilot.enabled
        ? UI_COLORS.neonGreen
        : UI_COLORS.textSecondary;

      hud.autoHuntBtn.setText(label);
      hud.autoHuntBtn.setColor(color);
    }

    // 상태를 SaveManager에 저장 (다음 런 자동 적용)
    const data = SaveManager.getData();
    data.autoHuntEnabled = this.autoPilot.enabled;
    SaveManager.save();
  }

  // ── 정리 ──

  /**
   * 씬 전환 전 리소스를 정리한다.
   * @private
   */
  _cleanup() {
    if (this.joystick) this.joystick.destroy();
    if (this.autoPilot) this.autoPilot.destroy();
    if (this.weaponSystem) this.weaponSystem.destroy();
    if (this.waveSystem) this.waveSystem.destroy();
    if (this.xpGemPool) this.xpGemPool.destroy();
    this._contactCooldowns.clear();
  }
}
