/**
 * @fileoverview 에셋 로드 및 게임 초기화 씬.
 *
 * Phase 1 스프라이트 에셋(player, projectile, 잡몹 10종, XP 보석 3종),
 * Phase 2 보스/미니보스 에셋(미니보스 2종, 보스 3종),
 * Phase 2 아트 에셋(배경 타일, 조이스틱 UI, 소모품 48x48, 무기/패시브/업그레이드 아이콘)을 preload한다.
 * 에셋 파일이 없는 경우 Graphics 플레이스홀더 텍스처로 폴백한다.
 * 로딩 바를 표시하고, 완료 후 MenuScene으로 전환한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t, setLocale } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import { AdManager } from '../managers/AdManager.js';
import { IAPManager } from '../managers/IAPManager.js';
import SoundSystem from '../systems/SoundSystem.js';
import { initHaptics, setHapticEnabled } from '../managers/HapticManager.js';

// ── BootScene 클래스 ──

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  // ── Phaser 라이프사이클 ──

  /**
   * 에셋을 미리 로드한다.
   * Phase 1 스프라이트 에셋(player, projectile, 잡몹 10종, XP 보석 3종)을 로드한다.
   * 에셋 파일이 없는 경우 create()에서 플레이스홀더 텍스처가 자동 생성된다.
   */
  preload() {
    // ── 로딩 바 표시 ──
    this._createLoadingBar();

    // 로드 진행률 이벤트 (외부 에셋 로드 시 동작)
    this.load.on('progress', (value) => {
      if (this._progressBar) {
        this._progressBar.clear();
        this._progressBar.fillStyle(COLORS.NEON_CYAN, 1);
        this._progressBar.fillRect(
          this._barX, this._barY,
          this._barWidth * value, this._barHeight
        );
      }
    });

    this.load.on('complete', () => {
      if (this._progressBar) {
        this._progressBar.destroy();
      }
      if (this._progressBorder) {
        this._progressBorder.destroy();
      }
      if (this._loadingText) {
        this._loadingText.destroy();
      }
    });

    // ── 벡터 스프라이트 에셋 로드 (20종 정적 이미지) ──

    // 플레이어 정적 이미지 (48x48)
    this.load.image('player', 'assets/sprites/player.png');

    // 플레이어 걷기 애니메이션 스프라이트시트 (240x192, 5방향x4프레임, 프레임 48x48)
    this.load.spritesheet('player_walk', 'assets/sprites/player_walk.png', {
      frameWidth: 48,
      frameHeight: 48,
    });

    // ── 캐릭터 5종 idle + walk 스프라이트 에셋 ──
    const CHAR_SPRITE_KEYS = ['sniper', 'engineer', 'berserker', 'medic', 'hidden'];
    for (const charId of CHAR_SPRITE_KEYS) {
      this.load.image(charId, `assets/sprites/${charId}.png`);
      this.load.spritesheet(`${charId}_walk`, `assets/sprites/${charId}_walk.png`, {
        frameWidth: 48,
        frameHeight: 48,
      });
    }

    // 투사체 정적 이미지 (12x12)
    this.load.image('projectile', 'assets/sprites/projectile.png');

    // 잡몹 10종 정적 이미지
    const enemyAssets = [
      { key: 'enemy_nano_drone',     file: 'enemies/nano_drone.png' },
      { key: 'enemy_scout_bot',      file: 'enemies/scout_bot.png' },
      { key: 'enemy_spark_drone',    file: 'enemies/spark_drone.png' },
      { key: 'enemy_battle_robot',   file: 'enemies/battle_robot.png' },
      { key: 'enemy_shield_drone',   file: 'enemies/shield_drone.png' },
      { key: 'enemy_rush_bot',       file: 'enemies/rush_bot.png' },
      { key: 'enemy_repair_bot',     file: 'enemies/repair_bot.png' },
      { key: 'enemy_heavy_bot',      file: 'enemies/heavy_bot.png' },
      { key: 'enemy_teleport_drone', file: 'enemies/teleport_drone.png' },
      { key: 'enemy_suicide_bot',    file: 'enemies/suicide_bot.png' },
    ];
    for (const e of enemyAssets) {
      this.load.image(e.key, 'assets/sprites/' + e.file);
    }

    // XP 보석 3종 정적 이미지
    this.load.image('xp_gem_s', 'assets/sprites/items/xp_gem_s.png');
    this.load.image('xp_gem_m', 'assets/sprites/items/xp_gem_m.png');
    this.load.image('xp_gem_l', 'assets/sprites/items/xp_gem_l.png');

    // 소모성 아이템 6종 정적 이미지 (48x48, Phase 2 업스케일)
    const consumableAssets = [
      { key: 'consumable_nano_repair',    file: 'items/nano_repair.png' },
      { key: 'consumable_mag_pulse',      file: 'items/magnetic_pulse.png' },
      { key: 'consumable_emp_bomb',       file: 'items/emp_bomb.png' },
      { key: 'consumable_credit_chip',    file: 'items/credit_chip.png' },
      { key: 'consumable_overclock',      file: 'items/overclock.png' },
      { key: 'consumable_shield_battery', file: 'items/shield_battery.png' },
    ];
    for (const c of consumableAssets) {
      this.load.image(c.key, 'assets/sprites/' + c.file);
    }

    // 미니보스 2종 정적 이미지 (80x80)
    this.load.image('enemy_guardian_drone', 'assets/sprites/bosses/guardian_drone.png');
    this.load.image('enemy_assault_mech', 'assets/sprites/bosses/assault_mech.png');

    // 보스 6종 정적 이미지 (128x128) — 기존 3종 + 신규 스테이지 보스 3종
    this.load.image('enemy_commander_drone', 'assets/sprites/bosses/commander_drone.png');
    this.load.image('enemy_siege_titan', 'assets/sprites/bosses/siege_titan.png');
    this.load.image('enemy_core_processor', 'assets/sprites/bosses/core_processor.png');
    this.load.image('enemy_siege_titan_mk2', 'assets/sprites/bosses/siege_titan_mk2.png');
    this.load.image('enemy_data_phantom', 'assets/sprites/bosses/data_phantom.png');
    this.load.image('enemy_omega_core', 'assets/sprites/bosses/omega_core.png');

    // ── Phase 2 아트 에셋 ──

    // 배경 타일 (128x128, 기존 _generateBackgroundTile 폴백과 병행)
    this.load.image('bg_tile', 'assets/backgrounds/bg_tile.png');

    // 스테이지별 배경 타일 (S2~S4, 128x128)
    this.load.image('bg_tile_s2', 'assets/backgrounds/bg_tile_s2.png');
    this.load.image('bg_tile_s3', 'assets/backgrounds/bg_tile_s3.png');
    this.load.image('bg_tile_s4', 'assets/backgrounds/bg_tile_s4.png');

    // 조이스틱 UI 이미지
    this.load.image('joystick_base', 'assets/ui/joystick/base.png');
    this.load.image('joystick_thumb', 'assets/ui/joystick/thumb.png');

    // 메뉴 배경 (Group B)
    this.load.image('menu_bg', 'assets/backgrounds/menu_bg.png');

    // 무기 아이콘 11종 (Group B, 32x32) — 기존 7종 + 신규 스테이지 해금 4종
    const WEAPON_ICON_IDS = ['blaster', 'laser_gun', 'plasma_orb', 'electric_chain', 'missile', 'drone', 'emp_blast', 'force_blade', 'nano_swarm', 'vortex_cannon', 'reaper_field'];
    for (const id of WEAPON_ICON_IDS) {
      this.load.image('icon_weapon_' + id, 'assets/ui/icons/weapon_' + id + '.png');
    }

    // 진화 무기 아이콘 11종 (32x32) — Canvas 생성 PNG
    const EVOLVED_ICON_IDS = ['precision_cannon', 'plasma_storm', 'nuke_missile', 'ion_cannon', 'guardian_sphere', 'hivemind', 'perpetual_emp', 'phantom_strike', 'bioplasma', 'event_horizon', 'death_blossom'];
    for (const id of EVOLVED_ICON_IDS) {
      this.load.image('icon_weapon_' + id, 'assets/ui/icons/weapon_' + id + '.png');
    }

    // 패시브 아이콘 10종 (Group B, 32x32)
    const PASSIVE_ICON_IDS = ['booster', 'armor_plate', 'battery_pack', 'overclock', 'magnet_module', 'regen_module', 'aim_module', 'critical_chip', 'cooldown_chip', 'luck_module'];
    for (const id of PASSIVE_ICON_IDS) {
      this.load.image('icon_passive_' + id, 'assets/ui/icons/passive_' + id + '.png');
    }

    // 업그레이드 아이콘 4종 (Group B, 32x32)
    const UPGRADE_ICON_IDS = ['basic', 'growth', 'special', 'limitBreak'];
    for (const id of UPGRADE_ICON_IDS) {
      this.load.image('icon_upgrade_' + id, 'assets/ui/icons/upgrade_' + id + '.png');
    }

    // ── Phase 4 이펙트 스프라이트 10종 ──
    const EFFECT_IDS = ['projectile', 'plasma_orb', 'missile', 'explosion',
      'drone', 'emp_ring', 'force_slash', 'nano_cloud', 'vortex', 'reaper_blade'];
    for (const id of EFFECT_IDS) {
      this.load.image('effect_' + id, 'assets/sprites/effects/' + id + '.png');
    }
  }

  /**
   * 에셋 로드 완료 후 호출. 텍스처 생성 및 초기화 후 MenuScene으로 전환한다.
   */
  async create() {
    // 세이브 데이터 초기화 (로컬스토리지에서 로드)
    SaveManager.init();

    // 저장된 언어 설정 반영
    const settings = SaveManager.getData().settings;
    if (settings && settings.locale) {
      setLocale(settings.locale);
    }

    // 플레이스홀더 텍스처 생성
    this._generatePlaceholderTextures();

    // 캐릭터 6종 8방향 걷기 애니메이션 등록
    this._registerWalkAnims();

    // 배경 타일 텍스처 생성
    this._generateBackgroundTile();

    // ── SoundSystem 초기화 ──
    SoundSystem.init(SaveManager.getSettings());

    // 저장된 BGM/SFX 활성화 상태 반영
    if (settings.bgmEnabled === false) SoundSystem.setBgmEnabled(false);
    if (settings.sfxEnabled === false) SoundSystem.setSfxEnabled(false);

    // ── Haptics 초기화 ──
    await initHaptics();

    // 저장된 햅틱 활성화 상태 반영
    if (settings.hapticEnabled === false) setHapticEnabled(false);

    // ── AdManager 초기화 ──
    await AdManager.initialize();

    // ── IAPManager 초기화 ──
    await IAPManager.initialize();

    // 구매 내역 복원 (네이티브 환경에서만 실행)
    await IAPManager.restorePurchases();

    // ── Particle 텍스처 생성 (VFXSystem용 4x4 흰색) ──
    this._generateParticleTexture();

    // ── 하드웨어 뒤로가기 버튼 (Android) 글로벌 핸들러 ──
    this._setupHardwareBackButton();

    // ── 앱 백그라운드/포그라운드 전환 시 BGM 일시정지/재개 ──
    this._setupAppStateListener();

    // 짧은 딜레이 후 메뉴 씬으로 전환
    this.time.delayedCall(300, () => {
      this.scene.start('MenuScene');
    });
  }

  // ── 하드웨어 뒤로가기 ──

  /**
   * Android 하드웨어 백버튼 글로벌 리스너를 등록한다.
   * 현재 활성 씬의 _onBack() 메서드를 호출한다.
   * @private
   */
  _setupHardwareBackButton() {
    // Capacitor 네이티브 환경에서만 backButton 리스너 등록
    const Capacitor = window.Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform()) return;

    try {
      Capacitor.Plugins.App.addListener('backButton', () => {
        const scenes = this.scene.manager.getScenes(true);
        // 가장 위에 있는 활성 씬을 찾아 _onBack 호출
        for (const scene of scenes) {
          if (scene._onBack && scene.scene.key !== 'BootScene') {
            scene._onBack();
            return;
          }
        }
      });
    } catch (e) {
      // 리스너 등록 실패 — 무시
    }
  }

  // ── 앱 상태 변화 ──

  /**
   * 앱이 백그라운드/포그라운드로 전환될 때 AudioContext를 일시정지/재개한다.
   * 홈 버튼 등으로 앱을 나가면 BGM이 멈추고, 다시 돌아오면 재개된다.
   * @private
   */
  _setupAppStateListener() {
    const Capacitor = window.Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform()) return;

    try {
      Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
        if (!SoundSystem._ctx) return;

        if (isActive) {
          // 포그라운드 복귀 — AudioContext 재개
          SoundSystem._ctx.resume().catch(() => {});
        } else {
          // 백그라운드 진입 — AudioContext 일시정지 (BGM + SFX 모두 멈춤)
          SoundSystem._ctx.suspend().catch(() => {});
        }
      });
    } catch (e) {
      // 리스너 등록 실패 — 무시
    }
  }

  // ── 걷기 애니메이션 등록 ──

  /**
   * 캐릭터 6종의 8방향 걷기 애니메이션을 Phaser anims에 등록한다.
   * 5방향(down, down-right, right, up-right, up)은 스프라이트시트 프레임으로 직접 등록.
   * 나머지 3방향(down-left, left, up-left)은 Player.js에서 flipX + 미러 방향 키로 처리하므로
   * 별도 등록 불필요.
   *
   * 애니메이션 키 규칙:
   * - agent: walk_down, walk_down_right, ... (기존 호환)
   * - 그 외: {charId}_walk_down, {charId}_walk_down_right, ...
   *
   * @private
   */
  _registerWalkAnims() {
    const fps = 8;

    // 5방향 프레임 번호 = row * 5 + col (Phaser 좌->우, 위->아래 순번)
    const DIR_DEFS = [
      { suffix: 'down',       frames: [0, 5, 10, 15] },
      { suffix: 'down_right', frames: [1, 6, 11, 16] },
      { suffix: 'right',      frames: [2, 7, 12, 17] },
      { suffix: 'up_right',   frames: [3, 8, 13, 18] },
      { suffix: 'up',         frames: [4, 9, 14, 19] },
    ];

    // 6종 캐릭터: spriteKey -> walkTextureKey, animPrefix
    const CHAR_ANIM_DEFS = [
      { walkTexture: 'player_walk',     animPrefix: 'walk' },           // agent (기존 키 유지)
      { walkTexture: 'sniper_walk',     animPrefix: 'sniper_walk' },
      { walkTexture: 'engineer_walk',   animPrefix: 'engineer_walk' },
      { walkTexture: 'berserker_walk',  animPrefix: 'berserker_walk' },
      { walkTexture: 'medic_walk',      animPrefix: 'medic_walk' },
      { walkTexture: 'hidden_walk',     animPrefix: 'hidden_walk' },
    ];

    for (const charDef of CHAR_ANIM_DEFS) {
      // 텍스처 미존재 시 해당 캐릭터 애니메이션 등록 스킵 (플레이스홀더 폴백)
      if (!this.textures.exists(charDef.walkTexture)) continue;

      for (const dir of DIR_DEFS) {
        const animKey = `${charDef.animPrefix}_${dir.suffix}`;
        this.anims.create({
          key: animKey,
          frames: dir.frames.map(f => ({ key: charDef.walkTexture, frame: f })),
          frameRate: fps,
          repeat: -1,
        });
      }
    }
  }

  // ── 내부 메서드 ──

  /**
   * 로딩 바 UI를 생성한다.
   * @private
   */
  _createLoadingBar() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this._barWidth = 200;
    this._barHeight = 16;
    this._barX = centerX - this._barWidth / 2;
    this._barY = centerY + 20;

    // 타이틀 텍스트
    this._loadingText = this.add.text(centerX, centerY - 40, 'NEON EXODUS', {
      fontSize: '28px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.neonCyan,
      stroke: UI_COLORS.neonMagenta,
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 로딩 텍스트
    this.add.text(centerX, centerY, t('ui.loading'), {
      fontSize: '12px',
      fontFamily: 'Galmuri11, monospace',
      color: UI_COLORS.textSecondary,
    }).setOrigin(0.5);

    // 프로그레스 바 테두리
    this._progressBorder = this.add.graphics();
    this._progressBorder.lineStyle(2, COLORS.UI_BORDER, 1);
    this._progressBorder.strokeRect(
      this._barX - 1, this._barY - 1,
      this._barWidth + 2, this._barHeight + 2
    );

    // 프로그레스 바 (채워지는 부분)
    this._progressBar = this.add.graphics();
    this._progressBar.fillStyle(COLORS.NEON_CYAN, 1);
    this._progressBar.fillRect(
      this._barX, this._barY,
      this._barWidth, this._barHeight
    );
  }

  /**
   * 모든 임시 텍스처를 Graphics로 생성한다.
   * 실제 스프라이트 에셋 도입 전까지 사용하는 플레이스홀더이다.
   * @private
   */
  _generatePlaceholderTextures() {
    const gfx = this.add.graphics();

    // 플레이어: 48x48 네온 시안 원 + 방향 삼각형
    if (!this.textures.exists('player')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_CYAN, 1);
      gfx.fillCircle(24, 24, 20);
      gfx.fillStyle(COLORS.NEON_CYAN, 0.7);
      gfx.fillTriangle(46, 24, 36, 14, 36, 34);
      gfx.generateTexture('player', 48, 48);
    }

    // player_walk spritesheet 플레이스홀더 (240x192, 20프레임 시안 원 격자)
    if (!this.textures.exists('player_walk')) {
      gfx.clear();
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
          gfx.fillStyle(COLORS.NEON_CYAN, 0.8);
          gfx.fillCircle(col * 48 + 24, row * 48 + 24, 18);
        }
      }
      gfx.generateTexture('player_walk', 240, 192);
    }

    // ── 캐릭터 5종 idle + walk 플레이스홀더 ──
    const CHAR_PLACEHOLDER_COLORS = {
      sniper:    0x39FF14,
      engineer:  0xFFD700,
      berserker: 0xFF3333,
      medic:     0x00FF88,
      hidden:    0xAA00FF,
    };
    for (const [charId, color] of Object.entries(CHAR_PLACEHOLDER_COLORS)) {
      // idle: 48x48, 해당 색상 원 + 방향 삼각형 (agent와 동일 패턴)
      if (!this.textures.exists(charId)) {
        gfx.clear();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(24, 24, 20);
        gfx.fillStyle(color, 0.7);
        gfx.fillTriangle(46, 24, 36, 14, 36, 34);
        gfx.generateTexture(charId, 48, 48);
      }
      // walk: 240x192, 해당 색상 원 격자 (4행x5열)
      const walkKey = `${charId}_walk`;
      if (!this.textures.exists(walkKey)) {
        gfx.clear();
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 5; col++) {
            gfx.fillStyle(color, 0.8);
            gfx.fillCircle(col * 48 + 24, row * 48 + 24, 18);
          }
        }
        gfx.generateTexture(walkKey, 240, 192);
      }
    }

    // ── 잡몹 10종 (벡터 에셋 크기 기준 플레이스홀더) ──
    const mobColors = {
      nano_drone:     { color: 0xFF4444, dim: 32 },
      scout_bot:      { color: 0xFF6644, dim: 32 },
      spark_drone:    { color: 0xFFFF00, dim: 32 },
      battle_robot:   { color: 0xBB4444, dim: 48 },
      shield_drone:   { color: 0x4488FF, dim: 32 },
      rush_bot:       { color: 0xFF8800, dim: 40 },
      repair_bot:     { color: 0x44FF44, dim: 32 },
      heavy_bot:      { color: 0x888888, dim: 48 },
      teleport_drone: { color: 0xAA44FF, dim: 32 },
      suicide_bot:    { color: 0xFF0000, dim: 40 },
    };

    for (const [id, cfg] of Object.entries(mobColors)) {
      const texKey = `enemy_${id}`;
      if (!this.textures.exists(texKey)) {
        gfx.clear();
        gfx.fillStyle(cfg.color, 1);
        const half = cfg.dim / 2;
        gfx.fillCircle(half, half, half - 2);
        gfx.generateTexture(texKey, cfg.dim, cfg.dim);
      }
    }

    // ── 미니보스 2종: 80x80 ──
    if (!this.textures.exists('enemy_guardian_drone')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_ORANGE, 1);
      gfx.fillCircle(40, 40, 36);
      gfx.lineStyle(2, 0xFFFFFF, 0.5);
      gfx.strokeCircle(40, 40, 36);
      gfx.generateTexture('enemy_guardian_drone', 80, 80);
    }
    if (!this.textures.exists('enemy_assault_mech')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_ORANGE, 1);
      gfx.fillCircle(40, 40, 38);
      gfx.lineStyle(2, 0xFFFFFF, 0.5);
      gfx.strokeCircle(40, 40, 38);
      gfx.generateTexture('enemy_assault_mech', 80, 80);
    }

    // ── 보스 6종: 128x128 (기존 3 + 신규 스테이지 보스 3) ──
    const bossColors = {
      commander_drone:  0xFF00FF,
      siege_titan:      0xFF6600,
      core_processor:   0xFF00FF,
      siege_titan_mk2:  0xFF4400,
      data_phantom:     0x8800FF,
      omega_core:       0x00FF44,
    };
    for (const [id, color] of Object.entries(bossColors)) {
      const texKey = `enemy_${id}`;
      if (!this.textures.exists(texKey)) {
        gfx.clear();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(64, 64, 56);
        gfx.lineStyle(3, 0xFFFFFF, 0.6);
        gfx.strokeCircle(64, 64, 56);
        gfx.generateTexture(texKey, 128, 128);
      }
    }

    // 투사체: 16x16 네온그린 글로우 + 코어
    if (!this.textures.exists('projectile')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_GREEN, 0.4);
      gfx.fillCircle(8, 8, 7);  // 외곽 글로우
      gfx.fillStyle(COLORS.NEON_GREEN, 1);
      gfx.fillCircle(8, 8, 4);  // 코어
      gfx.generateTexture('projectile', 16, 16);
    }

    // XP 보석: 크기별 다이아몬드 (벡터 에셋 크기 기준)
    const gemSizes = { xp_gem_s: 12, xp_gem_m: 20, xp_gem_l: 28 };
    const gemColors = {
      xp_gem_s: COLORS.NEON_GREEN,
      xp_gem_m: COLORS.NEON_CYAN,
      xp_gem_l: COLORS.NEON_MAGENTA,
    };
    for (const [key, size] of Object.entries(gemSizes)) {
      if (!this.textures.exists(key)) {
        const half = size / 2;
        gfx.clear();
        gfx.fillStyle(gemColors[key], 1);
        gfx.fillPoints([
          { x: half, y: 0 },
          { x: size, y: half },
          { x: half, y: size },
          { x: 0, y: half },
        ], true);
        gfx.generateTexture(key, size, size);
      }
    }

    // ── 소모성 아이템 6종: 48x48 (Phase 2 업스케일) ──
    const consumablePlaceholders = {
      consumable_nano_repair:    { color: 0x39FF14, symbol: 'cross' },
      consumable_mag_pulse:      { color: 0x00FFFF, symbol: 'circle' },
      consumable_emp_bomb:       { color: 0x4488FF, symbol: 'circle' },
      consumable_credit_chip:    { color: 0xFFDD00, symbol: 'diamond' },
      consumable_overclock:      { color: 0xFF6600, symbol: 'circle' },
      consumable_shield_battery: { color: 0xAA44FF, symbol: 'circle' },
    };
    for (const [texKey, cfg] of Object.entries(consumablePlaceholders)) {
      if (!this.textures.exists(texKey)) {
        gfx.clear();
        gfx.fillStyle(cfg.color, 1);
        if (cfg.symbol === 'cross') {
          // 십자: 중앙 가로줄 + 세로줄 (48x48 기준 2배 스케일)
          gfx.fillRect(8, 18, 32, 12);
          gfx.fillRect(18, 8, 12, 32);
        } else if (cfg.symbol === 'diamond') {
          // 다이아몬드
          gfx.fillPoints([
            { x: 24, y: 4 },
            { x: 44, y: 24 },
            { x: 24, y: 44 },
            { x: 4, y: 24 },
          ], true);
        } else {
          // 원형
          gfx.fillCircle(24, 24, 20);
        }
        gfx.generateTexture(texKey, 48, 48);
      }
    }

    // 조이스틱 바탕: 128x128 원형 (Phase 2 업스케일)
    if (!this.textures.exists('joystick_base')) {
      gfx.clear();
      gfx.fillStyle(0xFFFFFF, 0.15);
      gfx.fillCircle(64, 64, 64);
      gfx.generateTexture('joystick_base', 128, 128);
    }

    // 조이스틱 엄지: 64x64 원형 (Phase 2 업스케일)
    if (!this.textures.exists('joystick_thumb')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_CYAN, 0.7);
      gfx.fillCircle(32, 32, 32);
      gfx.generateTexture('joystick_thumb', 64, 64);
    }

    // ── Phase 4 이펙트 스프라이트 폴백 (9종 + effect_projectile 별도 처리) ──
    const effectFallbacks = {
      effect_plasma_orb:   { color: 0xFF00FF, dim: 24, shape: 'circle' },
      effect_missile:      { color: 0xFF6600, dim: 20, shape: 'rect' },
      effect_explosion:    { color: 0xFF6600, dim: 64, shape: 'circle' },
      effect_drone:        { color: 0x00FFFF, dim: 24, shape: 'circle' },
      effect_emp_ring:     { color: 0x4488FF, dim: 64, shape: 'circle' },
      effect_force_slash:  { color: 0x00FFFF, dim: 48, shape: 'rect' },
      effect_nano_cloud:   { color: 0x39FF14, dim: 48, shape: 'circle' },
      effect_vortex:       { color: 0xFF00FF, dim: 48, shape: 'circle' },
      effect_reaper_blade: { color: 0xFF3333, dim: 32, shape: 'rect' },
    };

    const gfx2 = this.add.graphics();
    for (const [texKey, cfg] of Object.entries(effectFallbacks)) {
      if (!this.textures.exists(texKey)) {
        gfx2.clear();
        gfx2.fillStyle(cfg.color, 0.9);
        const half = cfg.dim / 2;
        if (cfg.shape === 'circle') {
          gfx2.fillCircle(half, half, half - 2);
        } else {
          gfx2.fillRect(2, 2, cfg.dim - 4, cfg.dim - 4);
        }
        gfx2.generateTexture(texKey, cfg.dim, cfg.dim);
      }
    }

    // effect_projectile: 글로우 레이어 별도 처리 (16x16, 외곽 글로우 + 코어)
    if (!this.textures.exists('effect_projectile')) {
      gfx2.clear();
      gfx2.fillStyle(0x39FF14, 0.4);
      gfx2.fillCircle(8, 8, 7);  // 외곽 글로우
      gfx2.fillStyle(0x39FF14, 1.0);
      gfx2.fillCircle(8, 8, 4);  // 코어
      gfx2.generateTexture('effect_projectile', 16, 16);
    }

    gfx2.destroy();

    gfx.destroy();
  }

  /**
   * VFXSystem용 파티클 텍스처를 생성한다.
   * 4x4 흰색 직사각형.
   * @private
   */
  _generateParticleTexture() {
    if (this.textures.exists('particle')) return;

    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);
    g.destroy();
  }

  /**
   * 배경 타일 텍스처를 생성한다.
   * 스테이지별(S1~S4) SF 바닥 느낌의 64x64 반복 타일.
   * @private
   */
  _generateBackgroundTile() {
    const size = 64;

    // 스테이지별 타일 정의: [텍스처키, 배경색, 그리드색, 리벳색]
    const tileDefs = [
      { key: 'bg_tile',    bg: 0x0D0D1F, grid: 0x1A1A3A, rivet: 0x222244 },
      { key: 'bg_tile_s2', bg: 0x1A0800, grid: 0x3A1A0A, rivet: 0x442211 },
      { key: 'bg_tile_s3', bg: 0x050510, grid: 0x1A0A3A, rivet: 0x221144 },
      { key: 'bg_tile_s4', bg: 0x000000, grid: 0x0A2A0A, rivet: 0x114411 },
    ];

    for (const def of tileDefs) {
      if (this.textures.exists(def.key)) continue;

      const gfx = this.add.graphics();

      // 어두운 배경
      gfx.fillStyle(def.bg, 1);
      gfx.fillRect(0, 0, size, size);

      // 그리드 라인
      gfx.lineStyle(1, def.grid, 0.5);
      gfx.lineBetween(0, 0, size, 0);
      gfx.lineBetween(0, 0, 0, size);

      // 가운데 작은 점 (SF 금속 바닥 리벳)
      gfx.fillStyle(def.rivet, 1);
      gfx.fillCircle(size / 2, size / 2, 2);

      // 모서리 점
      gfx.fillCircle(2, 2, 1);
      gfx.fillCircle(size - 2, 2, 1);
      gfx.fillCircle(2, size - 2, 1);
      gfx.fillCircle(size - 2, size - 2, 1);

      gfx.generateTexture(def.key, size, size);
      gfx.destroy();
    }
  }
}
