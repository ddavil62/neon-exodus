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
  COLORS,
  UI_COLORS,
  RUN_DURATION,
  CAMERA_LERP,
  WEAPON_SLOTS,
  ENDLESS_SCALE_INTERVAL,
  ADMOB_UNITS,
  AD_LIMITS,
  CONSUMABLE_HEAL_AMOUNT,
  CONSUMABLE_CREDIT_MIN,
  CONSUMABLE_CREDIT_MAX,
  EMP_BOSS_DAMAGE_RATIO,
  EMP_SCREEN_MARGIN,
  WRAP_RADIUS,
  PLAYER_START_X,
  PLAYER_START_Y,
  WEAPON_DROP_OFFSET_MIN,
  WEAPON_DROP_OFFSET_MAX,
} from '../config.js';
import { t } from '../i18n.js';
import Player from '../entities/Player.js';
import VirtualJoystick from '../systems/VirtualJoystick.js';
import WeaponSystem from '../systems/WeaponSystem.js';
import WaveSystem from '../systems/WaveSystem.js';
import ObjectPool from '../systems/ObjectPool.js';
import XPGem from '../entities/XPGem.js';
import Consumable from '../entities/Consumable.js';
import { CONSUMABLE_MAP } from '../data/consumables.js';
import { MetaManager } from '../managers/MetaManager.js';
import { SaveManager } from '../managers/SaveManager.js';
import { WEAPON_EVOLUTIONS } from '../data/weapons.js';
import { getCharacterById } from '../data/characters.js';
import SoundSystem from '../systems/SoundSystem.js';
import VFXSystem from '../systems/VFXSystem.js';
import { AdManager } from '../managers/AdManager.js';
import { IAPManager } from '../managers/IAPManager.js';
import AutoPilotSystem from '../systems/AutoPilotSystem.js';
import DroneCompanionSystem from '../systems/DroneCompanionSystem.js';
import { getPassiveById } from '../data/passives.js';
import { STAGES } from '../data/stages.js';
import WeaponDropItem from '../entities/WeaponDropItem.js';
import { impactHaptic, setHapticEnabled, isHapticEnabled } from '../managers/HapticManager.js';

// ── 접촉 데미지 쿨다운 (ms) ──
/** 같은 적이 연속으로 접촉 데미지를 주지 않도록 하는 최소 간격 */
const CONTACT_DAMAGE_COOLDOWN = 500;

// ── 무기 아이콘 맵 ──
/** @type {Object.<string, string>} 무기 ID -> 표시 이모지 */
const WEAPON_ICON_MAP = {
  // 기본 무기 11종
  blaster:          '\u{1F52B}',
  laser_gun:        '\u26A1',
  plasma_orb:       '\u{1F49C}',
  electric_chain:   '\u{1F329}\uFE0F',
  missile:          '\u{1F680}',
  emp_blast:        '\u{1F4A5}',
  force_blade:      '\u2694\uFE0F',
  nano_swarm:       '\u{1F9EA}',
  vortex_cannon:    '\u{1F300}',
  reaper_field:     '\u{1FA93}',
  // 진화 무기 11종
  precision_cannon: '\u{1F3AF}',
  plasma_storm:     '\u{1F300}',
  nuke_missile:     '\u2622\uFE0F',
  ion_cannon:       '\u{1F4A0}',
  guardian_sphere:  '\u{1F6E1}\uFE0F',
  perpetual_emp:    '\u{1F4AB}',
  phantom_strike:   '\u{1F47B}',
  bioplasma:        '\u{1F9EC}',
  event_horizon:    '\u{1F573}\uFE0F',
  death_blossom:    '\u2620\uFE0F',
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
   * @param {{ characterId?: string, stageId?: string }} data - 캐릭터/스테이지 선택 정보
   */
  init(data) {
    /** 선택된 캐릭터 ID (기본: agent) */
    this.characterId = data?.characterId || 'agent';

    /** 선택된 스테이지 ID (기본: stage_1) */
    this.stageId = data?.stageId || 'stage_1';

    /** 현재 스테이지 데이터 */
    this.stageData = STAGES[this.stageId] || STAGES.stage_1;
  }

  /**
   * 게임 씬을 초기화하고 모든 시스템을 셋업한다.
   */
  create() {
    // ── 월드 설정 (무한 월드 — 물리 경계 없음) ──

    // 배경: 화면 크기 고정 + scrollFactor(0)으로 카메라에 붙이고, update에서 타일 오프셋 갱신
    const bgTileKey = this.stageData.bgTileKey || 'bg_tile';
    this.bgTile = this.add.tileSprite(
      0, 0, GAME_WIDTH, GAME_HEIGHT, bgTileKey
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(-10);

    // 스테이지별 배경색 적용
    this.cameras.main.setBackgroundColor(this.stageData.bgColor);

    // ── XP 보석 오브젝트 풀 ──
    this.xpGemPool = new ObjectPool(this, XPGem, 100);

    // ── 소모성 아이템 오브젝트 풀 ──
    this.consumablePool = new ObjectPool(this, Consumable, 20);

    // ── 무기 드롭 아이템 오브젝트 풀 ──
    this.weaponDropPool = new ObjectPool(this, WeaponDropItem, 5);

    // ── 플레이어 (선택된 캐릭터 ID에 따른 스프라이트 적용) ──
    this.player = new Player(this, PLAYER_START_X, PLAYER_START_Y, this.characterId);

    // 배경 장식 오브젝트 초기화 (플레이어 주변 배치)
    this._initDecos();

    // ── 플레이어 발밑 글로우 서클 ──
    // depth 9: 플레이어(depth 10) 아래, 배경(depth 0~1) 위
    this._playerGlowCircle = this.add.graphics();
    this._playerGlowCircle.fillStyle(0x00FFFF, 1);
    this._playerGlowCircle.fillCircle(0, 0, 22);
    this._playerGlowCircle.setPosition(this.player.x, this.player.y);
    this._playerGlowCircle.setDepth(9);
    this._playerGlowCircle.setAlpha(0.35);
    // 플레이어에 참조 주입 (피격 플래시 및 펄스 처리용)
    this.player.glowCircle = this._playerGlowCircle;

    // ── 카메라 설정 (무한 월드 — 경계 없음) ──
    this.cameras.main.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);

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
      } else if (up.stat === 'droneDamageBonus') {
        // 엔지니어: 드론 데미지 +30%
        this.player.droneDamageBonus = up.value;
      }
    }

    // 캐릭터 시작 무기 결정
    let startWeaponId = charData ? charData.startWeapon : 'blaster';

    /** 달성한 무기 진화 수 */
    this.weaponEvolutions = 0;

    /** 런 내 총 피격 횟수 (무피격 업적 판정용) */
    this._totalHitsTaken = 0;

    /** 현재 무피격 연속 구간 시작 시각 (초) */
    this._noDamageStreakStart = 0;

    /** 최대 무피격 연속 시간 (초) */
    this._maxNoDamageStreak = 0;

    /** 이미 표시한 진화 힌트 ID 세트 (중복 방지) */
    this._shownHints = new Set();

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

    // ── 메타 드론 동반자 초기화 (해금 시에만) ──
    this.droneCompanion = null;
    if (SaveManager.isDroneUnlocked()) {
      this.droneCompanion = new DroneCompanionSystem(
        this, this.player, this.weaponSystem.projectilePool
      );
      this.droneCompanion.init();
    }

    this.waveSystem = new WaveSystem(this, this.player, this.stageData);

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

    // 플레이어 ↔ 소모성 아이템
    this.physics.add.overlap(
      this.player,
      this.consumablePool.group,
      this._onCollectConsumable,
      null,
      this
    );

    // 플레이어 ↔ 무기 드롭 아이템
    this.physics.add.overlap(
      this.player,
      this.weaponDropPool.group,
      this._onCollectWeaponDrop,
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

    /** 이번 런에서 스테이지 무기를 이미 획득했는지 여부 */
    this._stageWeaponCollected = false;

    /** 모달 열림 상태 (일시정지 토글 차단용) */
    this._modalOpen = false;

    /** 레벨업 씬 활성 상태 (카메라 이펙트 충돌 방지용) */
    this._levelUpActive = false;

    // ── 스테이지 무기 맵 배치 ──
    this._placeWeaponOnMap();

    // ── HUD 생성 ──
    this._createHUD();

    // ── 일시정지 오버레이 (초기 숨김) ──
    this._createPauseOverlay();

    // ── BGM: 게임 BGM 시작 ──
    SoundSystem.resume();
    SoundSystem.playBgm('bgm_game');

    // ── ESC 키로 일시정지 토글 ──
    this.input.keyboard.on('keydown-ESC', () => this._onBack());

    // ── scene.resume 시 잔여 카메라 이펙트 강제 정리 (안전망) ──
    this.events.on('resume', () => {
      this.cameras.main.resetFX();
    });
  }

  /**
   * 매 프레임 호출. 시스템 업데이트, 엔티티 업데이트, HUD 갱신을 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    // 배경 타일 오프셋 갱신 (일시정지 중에도 배경은 보여야 하므로 isPaused 체크 전 실행)
    this.bgTile.setTilePosition(this.cameras.main.scrollX, this.cameras.main.scrollY);

    if (this.isPaused || this.isGameOver) return;

    // 시간 갱신
    this.runTime += delta / 1000;

    // 시스템 업데이트
    if (this.autoPilot && this.autoPilot.enabled) {
      this.autoPilot.update(time, delta);
    }
    this.player.update(time, delta);

    // 플레이어 글로우 서클 위치 동기화 (alpha는 Player.update에서 처리)
    if (this._playerGlowCircle && this.player && this.player.active) {
      this._playerGlowCircle.setPosition(this.player.x, this.player.y);
    }

    this.weaponSystem.update(time, delta);
    this.weaponSystem.renderBeams();
    if (this.droneCompanion) this.droneCompanion.update(time, delta);
    this.waveSystem.update(time, delta);

    // XP 보석 업데이트
    this.xpGemPool.forEach((gem) => {
      gem.update(time, delta);
    });

    // 소모성 아이템 업데이트
    this.consumablePool.forEach((item) => {
      item.update(time, delta);
    });

    // 무기 드롭 아이템 업데이트
    this.weaponDropPool.forEach((drop) => {
      drop.update(time, delta);
    });

    // 무한 월드 래핑 — 플레이어 기준 WRAP_RADIUS 밖 엔티티를 반대편으로 텔레포트
    this._wrapEntities();
    this._wrapDecos();  // 배경 장식 오브젝트 래핑

    // HUD 갱신
    this._updateHUD();
  }

  // ── 씬 콜백 (엔티티/시스템에서 호출) ──

  /**
   * 플레이어 레벨업 시 호출된다. LevelUpScene을 오버레이로 띄운다.
   */
  onLevelUp() {
    // 레벨업 플래그 ON — 같은 프레임의 보스/미니보스 카메라 이펙트 차단
    this._levelUpActive = true;

    // 진행 중인 카메라 이펙트 즉시 정리 (마젠타 플래시 고정 방지)
    this.cameras.main.resetFX();

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
      // 레벨업 플래그 OFF + 잔여 카메라 이펙트 정리 (안전망)
      this._levelUpActive = false;
      this.cameras.main.resetFX();

      if (data && data.rerollsLeft !== undefined) {
        this.rerollsLeft = data.rerollsLeft;
      }
      // 무기/패시브 변경 후 진화 조건 체크
      this._tryEvolutionCheck();
      // 인벤토리 HUD 갱신 (레벨업, 진화 반영)
      this._refreshInventoryHUD();

      // 레벨업 선택 후 1초 무적 — 선택 직후 피격 방지
      this.player.invincible = true;
      this.player.invincibleTimer = 1000;

      // 플레이어 속도 즉시 정지 — 이전 방향으로 관성 이동 방지
      if (this.player.body) {
        this.player.body.setVelocity(0, 0);
      }

      // 조이스틱: 활성 포인터가 있으면 즉시 연결, 없으면 리셋
      if (this.joystick) {
        const pointer = this.input.activePointer;
        if (pointer.isDown) {
          this.joystick.activateAt(pointer);
        } else {
          this.joystick.reset();
        }
      }
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
      this._safeFlash(500, 255, 255, 255);

      // 부활 SFX + 메시지 표시
      SoundSystem.play('revive');
      this._showWarning(t('game.revived'), 'info');
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
        evolved: !!weapon._evolvedId,
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

    // _cleanup() 전에 결과 데이터를 스냅샷 (destroy 후 접근 불가 방지)
    // 스테이지 클리어 시 해금된 무기 ID (엔들리스 진입 = 보스 처치 = 클리어)
    const unlockWeaponId = (this.isEndlessMode && this.stageData)
      ? this.stageData.unlockWeaponId
      : null;

    // 최종 무피격 연속 기록 갱신 (런 종료 시점까지)
    const finalStreak = this.runTime - this._noDamageStreakStart;
    if (finalStreak > this._maxNoDamageStreak) {
      this._maxNoDamageStreak = finalStreak;
    }

    const resultData = {
      victory: victory,
      isEndless: this.isEndlessMode,
      endlessMinutes: this.endlessMinutes,
      killCount: this.killCount,
      runTime: this.runTime,
      creditsEarned: this.creditsEarned,
      level: this.player ? this.player.level : 1,
      weaponSlotsFilled: this.weaponSystem ? this.weaponSystem.weapons.length : 0,
      weaponEvolutions: this.weaponEvolutions,
      weaponReport: this._buildWeaponReport(),
      stageId: this.stageId,
      characterId: this.characterId,
      finalHpPercent: this.player ? (this.player.currentHp / this.player.maxHp) : 0,
      newWeaponUnlocked: unlockWeaponId,
      maxNoDamageStreak: this._maxNoDamageStreak,
      totalHitsTaken: this._totalHitsTaken,
    };

    // 물리 엔진 즉시 정지 (딜레이 중 추가 충돌 방지)
    this.physics.pause();

    // 약간의 딜레이 후 결과 화면
    this.time.delayedCall(500, () => {
      this._cleanup();
      this.scene.start('ResultScene', resultData);
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

    // 미니보스 처치 시 totalMinibossKills 통계 증가
    if (enemy.isMiniBoss) {
      SaveManager.updateStats('totalMinibossKills', 1);
    }

    // 최종 보스 처치 판정 → 스테이지 클리어 + 엔들리스 모드 전환
    const finalBossId = this.stageData ? this.stageData.bossId : 'core_processor';
    if (enemy.isBoss && enemy.typeId === finalBossId) {
      if (!this.isEndlessMode) {
        // 스테이지 클리어 처리
        this._onStageClear();
        this._onEnterEndless();
      }
      // 엔들리스 중 보스 재처치: WaveSystem이 자동 다시 스폰
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
   * 소모성 아이템을 스폰한다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} typeId - 아이템 타입 ID
   */
  spawnConsumable(x, y, typeId) {
    const item = this.consumablePool.get(x, y);
    if (item) {
      item.spawn(x, y, typeId);
    }
  }

  /**
   * 카메라 플래시를 안전하게 실행한다.
   * Phaser의 camera.flash()를 사용하지 않고, 직접 Rectangle 오버레이를 생성하여
   * requestAnimationFrame으로 페이드아웃한다. scene.pause()와 완전히 독립적으로 동작한다.
   * @param {number} duration - 플래시 지속 시간 (ms)
   * @param {number} r - 빨강 (0~255)
   * @param {number} g - 초록 (0~255)
   * @param {number} b - 파랑 (0~255)
   * @private
   */
  _safeFlash(duration, r, g, b) {
    const color = Phaser.Display.Color.GetColor(r, g, b);
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH + 20, GAME_HEIGHT + 20,
      color, 1.0
    ).setScrollFactor(0).setDepth(9999);

    // 씬 종료 시 정리
    const cleanup = () => {
      if (overlay && overlay.active) overlay.destroy();
    };
    this.events.once('shutdown', cleanup);

    // requestAnimationFrame 기반 페이드아웃 (scene.pause 무관)
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      if (overlay.active) {
        overlay.setAlpha(1 - progress);
      }
      if (progress < 1 && overlay.active) {
        requestAnimationFrame(animate);
      } else {
        cleanup();
        this.events.off('shutdown', cleanup);
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * 미니보스 스폰 시 호출된다. 오렌지 카메라 플래시 + 경고 표시.
   * @param {import('../entities/Enemy.js').default} enemy - 스폰된 미니보스
   */
  onMiniBossSpawn(enemy) {
    // 일시정지/레벨업/모달 활성 중이면 카메라 이펙트 생략 (플래시 고정 방지)
    if (!this.isPaused && !this._levelUpActive && !this._modalOpen) {
      this._safeFlash(300, 255, 100, 0);
    }
    this._showWarning(t('hud.minibossWarning'));
  }

  /**
   * 보스 스폰 시 호출된다. 마젠타 카메라 플래시 + 카메라 흔들림 + 경고 표시.
   * @param {import('../entities/Enemy.js').default} enemy - 스폰된 보스
   */
  onBossSpawn(enemy) {
    SoundSystem.play('boss_appear');
    // 일시정지/레벨업/모달 활성 중이면 카메라 이펙트 생략 (플래시 고정으로 인한 크래시 방지)
    if (!this.isPaused && !this._levelUpActive && !this._modalOpen) {
      this._safeFlash(500, 255, 0, 255);
      this.cameras.main.shake(500, 0.02);
    }
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

    // 진행 중인 카메라 이펙트 즉시 정리 (플래시 고정 방지)
    this.cameras.main.resetFX();

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

          // 광고 복귀 후 씬이 이미 전환되었을 수 있으므로 안전 가드
          if (!this.player || this.isGameOver) return;

          // HP 50% 회복
          this.player.currentHp = Math.floor(this.player.maxHp * 0.5);
          this.player.active = true;

          // 3초 무적
          this.player.invincible = true;
          this.player.invincibleTimer = 3000;

          // 화면 플래시 효과
          this._safeFlash(500, 255, 255, 255);

          // 부활 SFX + 메시지 표시
          SoundSystem.play('revive');
          this._showWarning(t('game.revived'), 'info');

          // 게임 재개
          this.isPaused = false;
          this.physics.resume();
        } else {
          // 광고 실패/취소 — 버튼 입력 다시 허용
          adLoading = false;
          adBtnText.setAlpha(1);
          giveUpText.setAlpha(1);

          // busy(중복 호출)가 아닌 경우에만 안내 메시지 표시
          if (result.error !== 'busy') {
            this._showWarning(t('ad.loadFailed'));
          }
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
      if (passiveLv >= 5) {
        // 진화 조건 충족!
        const success = this.weaponSystem.evolveWeapon(evo.weaponId, evo.resultId);
        if (success) {
          this.weaponEvolutions++;
          SoundSystem.play('evolution');
          this._showEvolutionPopup(evo);
        }
      } else if (passiveLv > 0) {
        // 무기는 Max인데 패시브가 부족 → 힌트 표시
        this._showEvolutionHint(evo);
      }
    }
  }

  /**
   * 진화 성공 모달을 표시한다.
   * 게임을 일시정지하고, 플레이어가 "확인"을 눌러야 닫히는 모달 방식.
   * 조합 레시피(무기 + 패시브 → 진화무기)를 함께 표시한다.
   * @param {object} evo - WEAPON_EVOLUTIONS 항목 (weaponId, passiveId, resultNameKey 등)
   * @private
   */
  _showEvolutionPopup(evo) {
    // 이미 모달이 열려 있으면 중복 표시 방지
    if (this._modalOpen) return;

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 진행 중인 카메라 이펙트 즉시 정리 (마젠타 플래시 고정 방지)
    this.cameras.main.resetFX();

    // 게임 일시정지
    this.isPaused = true;
    this.physics.pause();
    this._modalOpen = true;

    // 모달 요소를 저장할 배열 (정리 시 사용)
    const popupElements = [];

    // 반투명 검정 오버레이
    const overlay = this.add.rectangle(
      centerX, centerY, GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.6
    ).setScrollFactor(0).setDepth(350);
    popupElements.push(overlay);

    // 조합 레시피 텍스트 (무기 + 패시브)
    const weaponName = t(`weapon.${evo.weaponId}.name`);
    const passiveName = t(`passive.${evo.passiveId}.name`);
    const recipeStr = `${weaponName} + ${passiveName}`;

    // 중앙 패널 배경 + 테두리 (레시피 행 추가로 높이 확장)
    const panelW = 240;
    const panelH = 190;
    const panelX = centerX - panelW / 2;
    const panelY = centerY - panelH / 2;

    const panelBg = this.add.graphics().setScrollFactor(0).setDepth(351);
    panelBg.fillStyle(COLORS.UI_PANEL, 0.95);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panelBg.lineStyle(2, COLORS.NEON_ORANGE, 1);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    popupElements.push(panelBg);

    // 조합 레시피 (무기 + 패시브)
    const recipeText = this.add.text(centerX, centerY - 48, recipeStr, {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(recipeText);

    // 화살표
    const arrowText = this.add.text(centerX, centerY - 28, '▼', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(arrowText);

    // 진화 무기 이름 텍스트
    const weaponNameText = this.add.text(centerX, centerY - 6, t(evo.resultNameKey), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonOrange,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(weaponNameText);

    // "EVOLVED!" 부제목
    const evolvedText = this.add.text(centerX, centerY + 20, 'EVOLVED!', {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(evolvedText);

    // 확인 버튼 배경
    const btnW = 120;
    const btnH = 36;
    const btnY = centerY + 58;

    const btnBg = this.add.graphics().setScrollFactor(0).setDepth(352);
    btnBg.fillStyle(COLORS.NEON_ORANGE, 0.8);
    btnBg.fillRoundedRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
    popupElements.push(btnBg);

    // 확인 버튼 텍스트
    const btnText = this.add.text(centerX, btnY, t('ui.confirm'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(353);
    popupElements.push(btnText);

    // 확인 버튼 인터랙션 Zone
    const btnZone = this.add.zone(centerX, btnY, btnW, btnH)
      .setScrollFactor(0).setDepth(353)
      .setInteractive({ useHandCursor: true });

    btnZone.on('pointerdown', () => {
      btnText.setAlpha(0.6);
    });
    btnZone.on('pointerup', () => {
      // 모든 모달 요소 제거
      popupElements.forEach((el) => {
        if (el && el.destroy) el.destroy();
      });
      btnZone.destroy();

      // 게임 재개
      this.isPaused = false;
      this.physics.resume();
      this._modalOpen = false;
    });
    btnZone.on('pointerout', () => {
      btnText.setAlpha(1);
    });
  }

  /**
   * 무기 Max 달성 시 진화 조건 힌트를 화면 상단에 토스트로 표시한다.
   * 동일 진화에 대해 한 번만 표시한다.
   * @param {Object} evo - 진화 레시피 데이터
   * @private
   */
  _showEvolutionHint(evo) {
    // 이미 힌트를 보여준 진화는 건너뛴다
    if (this._shownHints.has(evo.resultId)) return;
    this._shownHints.add(evo.resultId);

    const weaponName = t(`weapon.${evo.weaponId}.name`);
    const passiveName = t(`passive.${evo.passiveId}.name`);
    const msg = t('hint.evolutionReady', weaponName, passiveName);

    const hintText = this.add.text(
      GAME_WIDTH / 2, 30,
      msg,
      {
        fontSize: '12px',
        fontFamily: 'Galmuri11, monospace',
        color: UI_COLORS.neonOrange,
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    // 2초 후 fade out 후 자동 소멸
    this.tweens.add({
      targets: hintText,
      alpha: 0,
      duration: 500,
      delay: 1500,
      onComplete: () => hintText.destroy(),
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

    // 적 피격 SFX (VFX는 Enemy.takeDamage 내부에서 쿨다운 기반 처리)
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

    // 쉴드 활성 시 접촉 대미지를 적에게 반사
    if (player.shieldActive) {
      player.reflectShieldDamage(enemy);
      return;
    }

    // 무적이 아닐 때만 실제 피격 처리 (takeDamage 내부에서도 체크하지만 통계용 선행 판정)
    const willTakeDamage = !player.invincible && player.active;

    player.takeDamage(enemy.contactDamage);

    // 실제 피격 시 무피격 연속 기록 갱신
    if (willTakeDamage) {
      const streak = this.runTime - this._noDamageStreakStart;
      if (streak > this._maxNoDamageStreak) {
        this._maxNoDamageStreak = streak;
      }
      this._noDamageStreakStart = this.runTime;
      this._totalHitsTaken++;
    }

    // 플레이어 피격 VFX/SFX/Haptic
    VFXSystem.playerHit(this, player.x, player.y);
    SoundSystem.play('player_hit');
    impactHaptic();
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

  /**
   * 플레이어가 소모성 아이템을 수집했을 때 처리한다.
   * 아이템 종류에 따라 즉시 효과를 적용한다.
   * @param {import('../entities/Player.js').default} player - 플레이어
   * @param {import('../entities/Consumable.js').default} item - 소모성 아이템
   * @private
   */
  _onCollectConsumable(player, item) {
    if (!player.active || !item.active) return;

    const itemId = item.collect();
    const data = CONSUMABLE_MAP[itemId];

    // 수집 VFX/SFX
    if (data) {
      VFXSystem.consumableCollect(this, item.x, item.y, data.tintColor);
    }
    SoundSystem.play('xp_collect'); // 수집 SFX 재사용

    // 아이템별 효과 적용
    switch (itemId) {
      case 'nano_repair':
        // 나노 수리킷: HP 즉시 회복
        player.heal(CONSUMABLE_HEAL_AMOUNT);
        break;

      case 'mag_pulse':
        // 자기 펄스: 전체 XP 보석을 플레이어 방향으로 끌어당김 (뱀서 스타일)
        this.xpGemPool.forEach((gem) => {
          if (gem.active) {
            gem.beingMagnetized = true;
          }
        });
        break;

      case 'emp_bomb':
        // EMP 폭탄: 화면 내 일반 적 즉사 / 미니보스/보스 HP 20% 대미지
        VFXSystem.empBlast(this, player.x, player.y);
        this._applyEMPEffect();
        break;

      case 'credit_chip':
        // 크레딧 칩: 랜덤 크레딧 즉시 획득
        {
          const amount = Phaser.Math.Between(CONSUMABLE_CREDIT_MIN, CONSUMABLE_CREDIT_MAX);
          this.addCredits(amount);
          SaveManager.addCredits(amount);
        }
        break;

      case 'overclock':
        // 오버클럭 모듈: 이동속도 +50%, 공격속도 +30% 버프
        player.applyOverclock();
        break;

      case 'shield_battery':
        // 쉴드 배터리: 30초 무적 + 접촉 반사 대미지
        player.applyShield();
        break;

      default:
        break;
    }
  }

  /**
   * EMP 폭탄 효과를 적용한다.
   * 카메라 뷰포트 + 여유 마진 범위 내의 적에게 효과를 적용한다.
   * - 일반 적: 즉사 (현재 HP 만큼 대미지)
   * - 미니보스/보스: 최대 HP의 20% 대미지
   * @private
   */
  _applyEMPEffect() {
    const cam = this.cameras.main;
    const camLeft = cam.scrollX - EMP_SCREEN_MARGIN;
    const camRight = cam.scrollX + cam.width + EMP_SCREEN_MARGIN;
    const camTop = cam.scrollY - EMP_SCREEN_MARGIN;
    const camBottom = cam.scrollY + cam.height + EMP_SCREEN_MARGIN;

    this.waveSystem.enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      // 화면 내 판정
      if (enemy.x < camLeft || enemy.x > camRight ||
          enemy.y < camTop || enemy.y > camBottom) return;

      if (enemy.isBoss || enemy.isMiniBoss) {
        // 미니보스/보스: 최대 HP 20% 대미지
        const empDmg = Math.floor(enemy.maxHp * EMP_BOSS_DAMAGE_RATIO);
        enemy.takeDamage(empDmg, false);
      } else {
        // 일반 적: 즉사 (현재 HP 만큼 대미지)
        enemy.takeDamage(enemy.currentHp, false);
      }
    });
  }

  // ── 무기 드롭 시스템 ──

  /**
   * 게임 시작 시 스테이지 무기를 플레이어 시작 위치 기준 랜덤 각도 + 오프셋 거리에 배치한다.
   * 무한 월드에서는 월드 경계가 없으므로 플레이어 시작 좌표 기준으로 배치한다.
   * @private
   */
  _placeWeaponOnMap() {
    if (!this.stageData || !this.stageData.unlockWeaponId) return;

    const weaponId = this.stageData.unlockWeaponId;

    // 플레이어 시작 위치 기준 랜덤 각도 + 오프셋 배치
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(WEAPON_DROP_OFFSET_MIN, WEAPON_DROP_OFFSET_MAX);
    const x = PLAYER_START_X + Math.cos(angle) * dist;
    const y = PLAYER_START_Y + Math.sin(angle) * dist;

    const drop = this.weaponDropPool.get(x, y);
    if (drop) {
      drop.spawn(x, y, weaponId, true);
      // 알림은 배치 시점에 띄우지 않음 — 플레이어가 근접 시 별도 처리
    }
  }

  // ── 배경 장식 오브젝트 ──

  /**
   * 배경 장식 오브젝트를 플레이어 주변에 랜덤 배치한다.
   * 스테이지 데이터의 decoTypes가 없으면 아무것도 생성하지 않는다.
   * Depth 1~2, alpha 0.15~0.25, 물리 충돌 없음.
   * @private
   */
  _initDecos() {
    /** @type {Phaser.GameObjects.Image[]} */
    this._decos = [];

    const decoTypes = this.stageData.decoTypes || [];
    if (decoTypes.length === 0) return;

    const decoTint = this.stageData.decoTint || 0x1A1A2E;
    const decoCount = Phaser.Math.Between(15, 25);
    const px = this.player ? this.player.x : PLAYER_START_X;
    const py = this.player ? this.player.y : PLAYER_START_Y;

    for (let i = 0; i < decoCount; i++) {
      const texKey = decoTypes[Phaser.Math.Between(0, decoTypes.length - 1)];
      const x = px + Phaser.Math.Between(-800, 800);
      const y = py + Phaser.Math.Between(-800, 800);
      const img = this.add.image(x, y, texKey);
      img.setDepth(Phaser.Math.Between(1, 2));
      img.setAlpha(Phaser.Math.FloatBetween(0.15, 0.25));
      img.setTint(decoTint);  // 스테이지 컬러로 틴트 적용
      img.setAngle(Phaser.Math.Between(0, 359));  // 랜덤 회전으로 단조로움 방지
      this._decos.push(img);
    }
  }

  /**
   * 배경 장식 오브젝트를 WRAP_RADIUS 기반으로 래핑한다.
   * 플레이어에서 WRAP_RADIUS 밖으로 벗어난 데코를 반대편으로 이동시킨다.
   * @private
   */
  _wrapDecos() {
    if (!this._decos || this._decos.length === 0) return;

    const px = this.player.x;
    const py = this.player.y;
    const r2 = WRAP_RADIUS * WRAP_RADIUS;

    for (const deco of this._decos) {
      const dx = deco.x - px;
      const dy = deco.y - py;
      if (dx * dx + dy * dy > r2) {
        deco.setPosition(px - dx, py - dy);
      }
    }
  }

  /**
   * 플레이어 기준 래핑 반경 밖의 엔티티를 반대편으로 텔레포트한다.
   * 뱀파이어 서바이버 스타일 무한 월드 핵심 로직.
   * @private
   */
  _wrapEntities() {
    const px = this.player.x;
    const py = this.player.y;
    const r2 = WRAP_RADIUS * WRAP_RADIUS;

    // 적 래핑
    this.waveSystem.enemyPool.forEach((enemy) => {
      if (!enemy.active) return;
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      if (dx * dx + dy * dy > r2) {
        enemy.setPosition(px - dx, py - dy);
      }
    });

    // XP 보석 래핑 (자석 흡수 중 제외)
    this.xpGemPool.forEach((gem) => {
      if (!gem.active || gem.beingMagnetized) return;
      const dx = gem.x - px;
      const dy = gem.y - py;
      if (dx * dx + dy * dy > r2) {
        gem.setPosition(px - dx, py - dy);
      }
    });

    // 소모품 래핑 (자석 흡수 중 제외)
    this.consumablePool.forEach((item) => {
      if (!item.active || item.beingMagnetized) return;
      const dx = item.x - px;
      const dy = item.y - py;
      if (dx * dx + dy * dy > r2) {
        item.setPosition(px - dx, py - dy);
      }
    });

    // 무기 드롭 래핑 — permanent(맵 배치) 무기는 래핑 제외, 몬스터 드롭만 래핑
    this.weaponDropPool.forEach((drop) => {
      if (!drop.active || drop.beingMagnetized || drop.permanent) return;
      const dx = drop.x - px;
      const dy = drop.y - py;
      if (dx * dx + dy * dy > r2) {
        drop.setPosition(px - dx, py - dy);
      }
    });
  }

  /**
   * 플레이어가 무기 드롭 아이템을 수집했을 때 처리한다.
   * @param {import('../entities/Player.js').default} player - 플레이어
   * @param {import('../entities/WeaponDropItem.js').default} drop - 무기 드롭 아이템
   * @private
   */
  _onCollectWeaponDrop(player, drop) {
    if (!player.active || !drop.active) return;

    const weaponId = drop.collect();
    this._stageWeaponCollected = true;

    // 이미 보유 중이면 레벨업, 미보유면 새로 장착
    const existing = this.weaponSystem.getWeapon(weaponId);
    if (existing) {
      this.weaponSystem.upgradeWeapon(weaponId);
      this._showWarning(t('weaponDrop.upgraded', t(`weapon.${weaponId}.name`)), 'info');
    } else {
      this.weaponSystem.addWeapon(weaponId, 1);
      this._showWarning(t('weaponDrop.collected', t(`weapon.${weaponId}.name`)), 'info');
    }

    // 인벤토리 HUD 갱신
    this._refreshInventoryHUD();

    // 수집 VFX/SFX
    VFXSystem.consumableCollect(this, drop.x, drop.y, 0x00FFFF);
    SoundSystem.play('levelup');
  }

  // ── 스테이지 클리어 ──

  /**
   * 스테이지 클리어 시 호출된다.
   * SaveManager에 클리어 기록 + 무기 영구 해금을 처리한다.
   * @private
   */
  _onStageClear() {
    if (!this.stageData) return;

    SaveManager.clearStage(this.stageId);

    // 스테이지 고유 무기 영구 해금
    if (this.stageData.unlockWeaponId) {
      SaveManager.unlockWeapon(this.stageData.unlockWeaponId);
    }
  }

  // ── 엔들리스 모드 ──

  /**
   * 엔들리스 모드에 진입한다. 코어 프로세서 첫 처치 시 호출.
   * @private
   */
  _onEnterEndless() {
    this.isEndlessMode = true;
    this.isGameOver = false;
    this._showEndlessModal();
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

  // ── 엔들리스 모드 모달 ──

  /**
   * 엔들리스 모드 진입 모달을 표시한다.
   * 게임을 일시정지하고, 플레이어가 "확인"을 눌러야 닫히는 모달 방식.
   * @private
   */
  _showEndlessModal() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 진행 중인 카메라 이펙트 즉시 정리 (마젠타 플래시 고정 방지)
    this.cameras.main.resetFX();

    // 게임 일시정지
    this.isPaused = true;
    this.physics.pause();
    this._modalOpen = true;

    // 모달 요소를 저장할 배열 (정리 시 사용)
    const popupElements = [];

    // 반투명 검정 오버레이
    const overlay = this.add.rectangle(
      centerX, centerY, GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.6
    ).setScrollFactor(0).setDepth(350);
    popupElements.push(overlay);

    // 중앙 패널 배경 + 테두리 (네온 마젠타)
    const panelW = 220;
    const panelH = 160;
    const panelX = centerX - panelW / 2;
    const panelY = centerY - panelH / 2;

    const panelBg = this.add.graphics().setScrollFactor(0).setDepth(351);
    panelBg.fillStyle(COLORS.UI_PANEL, 0.95);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panelBg.lineStyle(2, COLORS.NEON_MAGENTA, 1);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    popupElements.push(panelBg);

    // 제목 텍스트 (네온 마젠타)
    const titleText = this.add.text(centerX, centerY - 35, t('game.endlessMode'), {
      fontSize: '20px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonMagenta,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(titleText);

    // 설명 텍스트
    const descText = this.add.text(centerX, centerY + 2, t('game.endlessModeDesc'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
      wordWrap: { width: 200 },
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(352);
    popupElements.push(descText);

    // 확인 버튼 배경 (네온 시안)
    const btnW = 120;
    const btnH = 36;
    const btnY = centerY + 45;

    const btnBg = this.add.graphics().setScrollFactor(0).setDepth(352);
    btnBg.fillStyle(COLORS.NEON_CYAN, 0.8);
    btnBg.fillRoundedRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
    popupElements.push(btnBg);

    // 확인 버튼 텍스트
    const btnText = this.add.text(centerX, btnY, t('ui.confirm'), {
      fontSize: '14px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textPrimary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(353);
    popupElements.push(btnText);

    // 확인 버튼 인터랙션 Zone
    const btnZone = this.add.zone(centerX, btnY, btnW, btnH)
      .setScrollFactor(0).setDepth(353)
      .setInteractive({ useHandCursor: true });

    btnZone.on('pointerdown', () => {
      btnText.setAlpha(0.6);
    });
    btnZone.on('pointerup', () => {
      // 모든 모달 요소 제거
      popupElements.forEach((el) => {
        if (el && el.destroy) el.destroy();
      });
      btnZone.destroy();

      // 게임 재개
      this.isPaused = false;
      this.physics.resume();
      this._modalOpen = false;
    });
    btnZone.on('pointerout', () => {
      btnText.setAlpha(1);
    });
  }

  // ── 경고 표시 ──

  /**
   * 화면 중앙에 경고 메시지를 잠시 표시한다.
   * @param {string} message - 경고 메시지
   * @private
   */
  /**
   * 화면 중앙 알림을 표시한다. 반투명 배경 패널 + 용도별 색상으로 가독성 확보.
   * @param {string} message - 표시할 메시지
   * @param {'danger'|'info'} [type='danger'] - 알림 유형 (danger=빨강, info=시안)
   */
  _showWarning(message, type = 'danger') {
    const isDanger = type === 'danger';
    const color = isDanger ? UI_COLORS.hpRed : UI_COLORS.neonCyan;
    const borderColor = isDanger ? 0xFF3333 : 0x00FFFF;
    const fontSize = isDanger ? '26px' : '22px';
    const glowColor = isDanger ? '#FF3333' : '#00FFFF';

    // 활성 토스트 스택 관리 — 겹침 방지
    if (!this._activeToasts) this._activeToasts = [];

    // 기본 Y 위치 + 활성 토스트 수만큼 아래로 밀기
    const baseY = GAME_HEIGHT / 2 - 80;
    const stackOffset = 44;
    const toastY = baseY + this._activeToasts.length * stackOffset;

    const warningText = this.add.text(
      GAME_WIDTH / 2, toastY,
      message,
      {
        fontSize: fontSize,
        fontFamily: 'Galmuri11, monospace',
        color: color,
        stroke: '#000000',
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 0, color: glowColor, blur: 12, fill: true },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // 텍스트 크기 기반 배경 패널 + 타입별 테두리
    const pad = 16;
    const bgW = warningText.width + pad * 2;
    const bgH = warningText.height + pad;
    const bgGfx = this.add.graphics().setScrollFactor(0).setDepth(200);
    bgGfx.fillStyle(0x000000, 0.85);
    bgGfx.fillRoundedRect(GAME_WIDTH / 2 - bgW / 2, toastY - bgH / 2, bgW, bgH, 6);
    bgGfx.lineStyle(1.5, borderColor, 0.9);
    bgGfx.strokeRoundedRect(GAME_WIDTH / 2 - bgW / 2, toastY - bgH / 2, bgW, bgH, 6);

    // 스택에 등록
    const toastEntry = { text: warningText, bg: bgGfx };
    this._activeToasts.push(toastEntry);

    // 스케일 펀치 등장 애니메이션 (0.5 → 1.1 → 1.0)
    warningText.setScale(0.5);
    bgGfx.setScale(0.5);
    this.tweens.add({
      targets: [warningText, bgGfx],
      scaleX: { from: 0.5, to: 1.1 },
      scaleY: { from: 0.5, to: 1.1 },
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [warningText, bgGfx],
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // 페이드 아웃 후 제거 + 스택에서 해제
    this.tweens.add({
      targets: [bgGfx, warningText],
      alpha: { from: 1, to: 0 },
      duration: 2000,
      delay: 1000,
      ease: 'Power2',
      onComplete: () => {
        warningText.destroy();
        bgGfx.destroy();
        // 스택에서 제거
        const idx = this._activeToasts.indexOf(toastEntry);
        if (idx !== -1) this._activeToasts.splice(idx, 1);
      },
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
    if (this.isGameOver) return;
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
    const weaponRadius = 5;             // 둥근 모서리 반경

    const weapons = this.weaponSystem ? this.weaponSystem.weapons : [];
    const wCount = weapons.length || 1;

    // 무기 수에 따라 슬롯 크기·간격을 동적으로 축소 (최대 10개까지 360px 화면에 수용)
    const weaponSize = wCount > 7 ? 26 : 32;
    const maxStride = wCount > 7 ? 34 : 60;
    const totalWidth = GAME_WIDTH - 20;          // 좌우 여백 10px
    const weaponStride = Math.min(maxStride, totalWidth / wCount);
    const weaponStartX = 10 + weaponStride / 2;  // 좌측 여백 + 반슬롯
    const iconSize = wCount > 7 ? '14px' : '18px';
    const lvlSize = wCount > 7 ? '8px' : '10px';

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
        fontSize: iconSize,
        fontFamily: 'Galmuri11, monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(106);

      // 레벨 숫자: 우하단 정렬
      const level = this.add.text(
        cx + weaponSize / 2 - 2,         // 우측 기준 2px 안쪽
        weaponY + weaponSize / 2 - 1,    // 하단 기준 1px 안쪽
        `${w.level}`,
        {
          fontSize: lvlSize,
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
          fontSize: '11px',
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

    // ── 버튼 공통 크기 ──
    const btnW = 180;
    const btnH = 40;

    // 계속 버튼
    this._resumeBg = this._createPauseBtnBg(centerX, centerY + 20, btnW, btnH, UI_COLORS.btnPrimary, COLORS.NEON_GREEN);
    this._resumeText = this.add.text(centerX, centerY + 20, t('hud.resume'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonGreen,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setVisible(false);
    this._resumeZone = this.add.zone(centerX, centerY + 20, btnW, btnH)
      .setScrollFactor(0).setDepth(303).setVisible(false)
      .setInteractive({ useHandCursor: true });

    this._resumeZone.on('pointerdown', () => {
      this._togglePause();
    });

    // 설정 버튼
    this._settingsBg = this._createPauseBtnBg(centerX, centerY + 68, btnW, btnH, UI_COLORS.btnSecondary, COLORS.NEON_CYAN);
    this._settingsText = this.add.text(centerX, centerY + 68, t('hud.settings'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setVisible(false);
    this._settingsZone = this.add.zone(centerX, centerY + 68, btnW, btnH)
      .setScrollFactor(0).setDepth(303).setVisible(false)
      .setInteractive({ useHandCursor: true });

    this._settingsZone.on('pointerdown', () => {
      this._toggleInlineSettings();
    });

    // ── 인라인 설정 토글 (BGM / SFX / 햅틱) ──
    this._settingsOpen = false;
    this._settingsElements = [];
    this._createInlineSettings(centerX, centerY + 100);

    // 포기 버튼
    this._quitBg = this._createPauseBtnBg(centerX, centerY + 120, btnW, btnH, 0x331111, 0xFF3333);
    this._quitText = this.add.text(centerX, centerY + 120, t('hud.quit'), {
      fontSize: '16px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.hpRed,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setVisible(false);
    this._quitZone = this.add.zone(centerX, centerY + 120, btnW, btnH)
      .setScrollFactor(0).setDepth(303).setVisible(false)
      .setInteractive({ useHandCursor: true });

    this._quitZone.on('pointerdown', () => {
      // BGM 정지 (결과/메뉴 화면에서 게임 BGM이 계속 재생되는 것을 방지)
      SoundSystem.stopBgm();

      // 스테이지 클리어 시 해금된 무기 ID (엔들리스 진입 = 보스 처치 = 클리어)
      const quitUnlockWeaponId = (this.isEndlessMode && this.stageData)
        ? this.stageData.unlockWeaponId
        : null;

      // 최종 무피격 연속 기록 갱신 (런 종료 시점까지)
      const quitFinalStreak = this.runTime - this._noDamageStreakStart;
      if (quitFinalStreak > this._maxNoDamageStreak) {
        this._maxNoDamageStreak = quitFinalStreak;
      }

      // _cleanup() 전에 결과 데이터를 스냅샷 (destroy 후 접근 불가 방지)
      const resultData = {
        victory: this.isEndlessMode ? true : false,
        isEndless: this.isEndlessMode ? true : undefined,
        endlessMinutes: this.isEndlessMode ? this.endlessMinutes : undefined,
        killCount: this.killCount,
        runTime: this.runTime,
        creditsEarned: this.creditsEarned,
        level: this.player ? this.player.level : 1,
        weaponSlotsFilled: this.weaponSystem ? this.weaponSystem.weapons.length : 0,
        weaponEvolutions: this.weaponEvolutions,
        weaponReport: this._buildWeaponReport(),
        stageId: this.stageId,
        characterId: this.characterId,
        finalHpPercent: this.player ? (this.player.currentHp / this.player.maxHp) : 0,
        newWeaponUnlocked: quitUnlockWeaponId,
        maxNoDamageStreak: this._maxNoDamageStreak,
        totalHitsTaken: this._totalHitsTaken,
      };

      this._cleanup();
      this.scene.start('ResultScene', resultData);
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
    // 모달이 열려 있는 동안 일시정지 토글 차단
    if (this._modalOpen) return;

    this.isPaused = !this.isPaused;

    const visible = this.isPaused;
    this._pauseBg.setVisible(visible);
    this._pauseTitle.setVisible(visible);
    this._pauseKillsText.setVisible(visible);
    this._pauseTimeText.setVisible(visible);
    this._pauseCreditsText.setVisible(visible);
    // 버튼: bg + 텍스트 + zone
    this._resumeBg.setVisible(visible);
    this._resumeText.setVisible(visible);
    this._resumeZone.setVisible(visible);
    this._settingsBg.setVisible(visible);
    this._settingsText.setVisible(visible);
    this._settingsZone.setVisible(visible);
    this._quitBg.setVisible(visible);
    this._quitText.setVisible(visible);
    this._quitZone.setVisible(visible);

    // 일시정지 해제 시 인라인 설정도 닫기
    if (!visible && this._settingsOpen) {
      this._settingsOpen = false;
      for (const el of this._settingsElements) el.setVisible(false);
    }

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
      // 진행 중인 카메라 이펙트 즉시 정리 (플래시 고정 방지)
      this.cameras.main.resetFX();
      this.physics.pause();
    } else {
      this.physics.resume();
    }
  }

  // ── 인라인 설정 (일시정지 중) ──

  /**
   * 일시정지 버튼용 둥근 사각형 배경(Graphics)을 생성한다.
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {number} w - 너비
   * @param {number} h - 높이
   * @param {number} fillColor - 배경 채움 색상
   * @param {number} strokeColor - 테두리 색상
   * @returns {Phaser.GameObjects.Graphics} 생성된 Graphics 객체
   * @private
   */
  _createPauseBtnBg(x, y, w, h, fillColor, strokeColor) {
    const gfx = this.add.graphics();
    // (0,0) 기준으로 그린 뒤 setPosition으로 이동 — setY()로 위치 변경 가능
    gfx.fillStyle(fillColor, 0.85);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    gfx.lineStyle(1, strokeColor, 0.6);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    gfx.setPosition(x, y).setScrollFactor(0).setDepth(301).setVisible(false);
    return gfx;
  }

  /**
   * 일시정지 화면 내 인라인 설정 토글 행(BGM/SFX/햅틱)을 생성한다.
   * 기본적으로 숨김 상태이며, 설정 버튼 클릭 시 표시된다.
   * @param {number} cx - 중심 X 좌표
   * @param {number} baseY - 시작 Y 좌표
   * @private
   */
  _createInlineSettings(cx, baseY) {
    const rowH = 28;
    const labelStyle = { fontSize: '13px', fontFamily: 'Galmuri11, monospace', color: UI_COLORS.textSecondary };

    const rows = [
      {
        label: t('settings.bgm'),
        getState: () => SoundSystem.isBgmEnabled(),
        onToggle: (v) => { SoundSystem.setBgmEnabled(v); SaveManager.setSetting('bgmEnabled', v); },
      },
      {
        label: t('settings.sfx'),
        getState: () => SoundSystem.isSfxEnabled(),
        onToggle: (v) => { SoundSystem.setSfxEnabled(v); SaveManager.setSetting('sfxEnabled', v); },
      },
      {
        label: t('settings.haptic'),
        getState: () => isHapticEnabled(),
        onToggle: (v) => { setHapticEnabled(v); SaveManager.setSetting('hapticEnabled', v); },
      },
    ];

    rows.forEach((row, i) => {
      const y = baseY + i * rowH;

      // 레이블
      const lbl = this.add.text(cx - 60, y, row.label, labelStyle)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(302).setVisible(false);

      // 상태 텍스트
      const isOn = row.getState();
      const state = this.add.text(cx + 60, y, isOn ? 'ON' : 'OFF', {
        fontSize: '13px', fontFamily: 'Galmuri11, monospace',
        color: isOn ? UI_COLORS.neonGreen : UI_COLORS.textSecondary,
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(302).setVisible(false);

      // 터치 영역
      const zone = this.add.zone(cx, y, 200, rowH)
        .setScrollFactor(0).setDepth(303).setVisible(false)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        const newVal = !row.getState();
        row.onToggle(newVal);
        state.setText(newVal ? 'ON' : 'OFF');
        state.setColor(newVal ? UI_COLORS.neonGreen : UI_COLORS.textSecondary);
      });

      this._settingsElements.push(lbl, state, zone);
    });
  }

  /**
   * 인라인 설정 패널의 표시/숨김을 토글한다.
   * 설정이 열리면 포기 버튼을 아래로 밀고, 닫히면 원래 위치로 복원한다.
   * @private
   */
  _toggleInlineSettings() {
    this._settingsOpen = !this._settingsOpen;
    const show = this._settingsOpen;

    for (const el of this._settingsElements) el.setVisible(show);

    // 설정 패널이 열리면 포기 버튼(bg + 텍스트 + zone)을 아래로 이동
    const centerY = GAME_HEIGHT / 2;
    const quitY = show ? centerY + 195 : centerY + 120;
    this._quitBg.setY(quitY);
    this._quitText.setY(quitY);
    this._quitZone.setY(quitY);
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
    if (this.droneCompanion) this.droneCompanion.destroy();
    if (this.waveSystem) this.waveSystem.destroy();
    if (this.xpGemPool) this.xpGemPool.destroy();
    if (this.consumablePool) this.consumablePool.destroy();
    this._contactCooldowns.clear();

    // 플레이어 글로우 서클 정리
    if (this._playerGlowCircle) {
      this._playerGlowCircle.destroy();
      this._playerGlowCircle = null;
    }

    // 배경 장식 오브젝트 정리
    if (this._decos) {
      for (const deco of this._decos) {
        if (deco && deco.destroy) deco.destroy();
      }
      this._decos = null;
    }

    // destroy 후 참조를 null로 설정하여 use-after-destroy 방지
    this.joystick = null;
    this.autoPilot = null;
    this.weaponSystem = null;
    this.waveSystem = null;
    this.xpGemPool = null;
    this.consumablePool = null;
    this.player = null;
  }
}
