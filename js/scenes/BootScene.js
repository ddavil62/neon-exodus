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

    // ── 컷신 초상화 7종 (200x200, Phase 5 스토리) ──
    const PORTRAIT_IDS = ['agent', 'berserker', 'sniper', 'medic', 'engineer', 'hidden', 'exodus'];
    for (const id of PORTRAIT_IDS) {
      this.load.image(`portrait_${id}`, `assets/portraits/${id}.png`);
    }

    // ── Phase 4 이펙트 스프라이트 10종 ──
    const EFFECT_IDS = ['projectile', 'plasma_orb', 'missile', 'explosion',
      'drone', 'emp_ring', 'force_slash', 'nano_cloud', 'vortex', 'reaper_blade'];
    for (const id of EFFECT_IDS) {
      this.load.image('effect_' + id, 'assets/sprites/effects/' + id + '.png');
    }

    // ── 장식 오브젝트 16종 (배경 리디자인) ──
    const DECO_IDS = [
      'deco_s1_lamppost', 'deco_s1_car', 'deco_s1_manhole', 'deco_s1_debris',
      'deco_s2_drum', 'deco_s2_pipe', 'deco_s2_crane', 'deco_s2_sign',
      'deco_s3_rack', 'deco_s3_cable', 'deco_s3_fan', 'deco_s3_terminal',
      'deco_s4_node', 'deco_s4_pillar', 'deco_s4_core', 'deco_s4_shard',
    ];
    for (const id of DECO_IDS) {
      this.load.image(id, `assets/sprites/decos/${id}.png`);
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

    // 장식 오브젝트 텍스처 생성 (PNG 미로드 시 폴백)
    this._generateDecoTextures();

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
   * Capacitor App 플러그인의 appStateChange 리스너를 등록한다.
   * 오디오 제어는 SoundSystem._initVisibilityHandler()에서 일원화하며,
   * 여기서는 Phaser 게임 루프의 pause/resume만 처리한다.
   *
   * ⚠️ appStateChange와 visibilitychange가 동시에 발생하므로
   *    AudioContext 직접 제어를 여기서 하면 BGM 이중 재생 버그가 발생한다.
   * @private
   */
  _setupAppStateListener() {
    const Capacitor = window.Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform()) return;

    try {
      Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
        // 오디오 제어는 SoundSystem.visibilitychange 핸들러에 위임
        // 여기서는 Phaser 게임 루프만 관리
        if (this.game) {
          if (isActive) {
            this.game.resume();
          } else {
            this.game.pause();
          }
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
        // 가독성을 위한 밝은 테두리
        gfx.lineStyle(1.5, 0xFFFFFF, 0.45);
        gfx.strokeCircle(half, half, half - 2);
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
      effect_drone:        { color: 0xFFCC33, dim: 24, shape: 'circle' },
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

    // ── 진화 무기 전용 이펙트 텍스처 (12종) ──
    // 원본과 색상·형태를 명확히 차별화하여 진화 후 시각 아이덴티티를 부여한다.
    this._generateEvolvedEffectTextures(gfx2);

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
   * 스테이지별(S1~S4) 128x128 반복 타일. 각 스테이지 세계관을 반영하는 고유 패턴.
   * PNG 에셋이 이미 로드된 경우 기존 텍스처를 제거 후 재생성한다.
   * @private
   */
  _generateBackgroundTile() {
    const size = 128;

    // ── S1 도시 외곽: 아스팔트 + 시안 표시선 ──
    this._regenerateTileTexture('bg_tile', size, (gfx) => {
      // 기조색
      gfx.fillStyle(0x0C0C18, 1);
      gfx.fillRect(0, 0, size, size);

      // 대각선 크랙 라인 (약간 밝은 남색)
      gfx.lineStyle(1, 0x14142A, 0.6);
      gfx.lineBetween(10, 0, size, size - 10);
      gfx.lineBetween(0, 30, 98, size);
      gfx.lineBetween(40, 0, size, 88);
      gfx.lineStyle(0.5, 0x14142A, 0.4);
      gfx.lineBetween(0, 70, 58, size);
      gfx.lineBetween(70, 0, size, 58);

      // 도로 점선 세그먼트 (시안, alpha 0.12)
      gfx.lineStyle(1.5, 0x00FFFF, 0.12);
      for (let i = 0; i < size; i += 16) {
        gfx.lineBetween(i, 32, i + 8, 32);
        gfx.lineBetween(i + 4, 96, i + 12, 96);
      }

      // 맨홀 커버 점선 원 (시안, alpha 0.08)
      gfx.lineStyle(1, 0x00FFFF, 0.08);
      gfx.strokeCircle(64, 64, 12);
      gfx.lineStyle(0.5, 0x00FFFF, 0.06);
      gfx.lineBetween(56, 64, 72, 64);
      gfx.lineBetween(64, 56, 64, 72);
    });

    // ── S2 산업 지구: 강철 격자판 + 오렌지 경고선 ──
    this._regenerateTileTexture('bg_tile_s2', size, (gfx) => {
      // 기조색
      gfx.fillStyle(0x0E0A06, 1);
      gfx.fillRect(0, 0, size, size);

      // 32x32 금속 격자 (1.5px)
      gfx.lineStyle(1.5, 0x1A1208, 0.6);
      for (let i = 0; i <= size; i += 32) {
        gfx.lineBetween(i, 0, i, size);
        gfx.lineBetween(0, i, size, i);
      }

      // 볼트 점 (격자 교차점)
      gfx.fillStyle(0x241A0C, 0.7);
      for (let x = 0; x <= size; x += 32) {
        for (let y = 0; y <= size; y += 32) {
          gfx.fillCircle(x, y, 2);
        }
      }

      // 45도 경고 해칭 (오렌지, alpha 0.10) — 한 코너
      gfx.lineStyle(1.5, 0xFF6600, 0.10);
      for (let i = 0; i < 32; i += 6) {
        gfx.lineBetween(i, 0, 0, i);
      }
    });

    // ── S3 지하 서버: PCB 회로 + 퍼플 데이터 라인 ──
    this._regenerateTileTexture('bg_tile_s3', size, (gfx) => {
      // 기조색
      gfx.fillStyle(0x06040E, 1);
      gfx.fillRect(0, 0, size, size);

      // 직각 꺾임 PCB 라인 (퍼플, alpha 0.15)
      gfx.lineStyle(1, 0x8800FF, 0.15);
      // 라인 1: 수평 → 수직 꺾임
      gfx.lineBetween(0, 20, 40, 20);
      gfx.lineBetween(40, 20, 40, 60);
      gfx.lineBetween(40, 60, 80, 60);
      // 라인 2
      gfx.lineBetween(20, 0, 20, 40);
      gfx.lineBetween(20, 40, 60, 40);
      gfx.lineBetween(60, 40, 60, 80);
      // 라인 3
      gfx.lineBetween(80, 0, 80, 30);
      gfx.lineBetween(80, 30, 110, 30);
      gfx.lineBetween(110, 30, 110, 70);
      // 라인 4
      gfx.lineBetween(0, 90, 30, 90);
      gfx.lineBetween(30, 90, 30, 128);
      // 라인 5
      gfx.lineBetween(90, 80, 90, 128);
      gfx.lineBetween(90, 80, 128, 80);

      // 비아 포인트 원 (라인 꺾임점에 작은 원)
      gfx.fillStyle(0x8800FF, 0.20);
      const viaPoints = [
        [40, 20], [40, 60], [80, 60],
        [20, 40], [60, 40], [60, 80],
        [80, 30], [110, 30], [110, 70],
        [30, 90], [90, 80],
      ];
      for (const [vx, vy] of viaPoints) {
        gfx.fillCircle(vx, vy, 2);
      }

      // IC 칩 윤곽 (작은 직사각형)
      gfx.lineStyle(0.8, 0x8800FF, 0.10);
      gfx.strokeRect(48, 8, 16, 10);
      gfx.strokeRect(96, 96, 20, 14);
    });

    // ── S4 더 코어: 육각 에너지 셀 + 그린 맥동 ──
    this._regenerateTileTexture('bg_tile_s4', size, (gfx) => {
      // 기조색
      gfx.fillStyle(0x010801, 1);
      gfx.fillRect(0, 0, size, size);

      // 육각형 반복 패턴 (그린, alpha 0.10)
      gfx.lineStyle(1, 0x00FF44, 0.10);
      const hexR = 20;
      const hexW = hexR * Math.sqrt(3);
      const hexH = hexR * 2;

      for (let row = -1; row < 5; row++) {
        for (let col = -1; col < 5; col++) {
          const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2);
          const cy = row * (hexH * 0.75);

          // 육각형 꼭짓점 계산
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            pts.push({
              x: cx + hexR * Math.cos(angle),
              y: cy + hexR * Math.sin(angle),
            });
          }
          // 육각형 외곽선
          for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            gfx.lineBetween(pts[i].x, pts[i].y, pts[next].x, pts[next].y);
          }

          // 셀 중심 원 (alpha 0.18)
          gfx.fillStyle(0x00FF44, 0.18);
          gfx.fillCircle(cx, cy, 2);

          // 방사선 라인 (alpha 0.08) — 꼭짓점에서 중심으로
          gfx.lineStyle(0.5, 0x00FF44, 0.08);
          for (let i = 0; i < 6; i += 2) {
            gfx.lineBetween(cx, cy, pts[i].x, pts[i].y);
          }
          // 복원
          gfx.lineStyle(1, 0x00FF44, 0.10);
        }
      }
    });
  }

  /**
   * 기존 텍스처를 제거(존재 시)하고 새 그래픽으로 재생성한다.
   * @param {string} key - 텍스처 키
   * @param {number} size - 타일 크기 (px)
   * @param {function(Phaser.GameObjects.Graphics): void} drawFn - 그리기 함수
   * @private
   */
  _regenerateTileTexture(key, size, drawFn) {
    // PNG가 이미 로드되었으면 제거 후 재생성 (프로시저럴 디자인 우선)
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    const gfx = this.add.graphics();
    drawFn(gfx);
    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  // ── 장식 오브젝트 텍스처 생성 (폴백) ──

  /**
   * 스테이지별 장식 오브젝트 16종의 프로시저럴 텍스처를 생성한다.
   * PNG 에셋이 이미 로드된 경우 생성을 건너뛴다.
   * @private
   */
  _generateDecoTextures() {
    const gfx = this.add.graphics();

    // ── S1 도시 외곽 — 색상: 0x1A1A2E ~ 0x222240 ──

    // 가로등 기둥: 16x64 — 세로 막대 + 상단 원(꺼진 랜턴)
    if (!this.textures.exists('deco_s1_lamppost')) {
      gfx.clear();
      gfx.fillStyle(0x1A1A2E, 1);
      gfx.fillRect(6, 12, 4, 52);  // 기둥
      gfx.fillCircle(8, 8, 6);     // 랜턴
      gfx.generateTexture('deco_s1_lamppost', 16, 64);
    }

    // 파손된 차량: 48x32 — 직사각형 윤곽 + 파손 선
    if (!this.textures.exists('deco_s1_car')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x222240, 1);
      gfx.strokeRect(2, 4, 44, 24);
      gfx.lineBetween(12, 4, 8, 28);   // 파손 선 1
      gfx.lineBetween(30, 4, 36, 28);  // 파손 선 2
      gfx.lineBetween(2, 16, 46, 16);  // 중앙 분할
      gfx.generateTexture('deco_s1_car', 48, 32);
    }

    // 맨홀: 24x24 — 원형 윤곽선 + 내부 십자 격자
    if (!this.textures.exists('deco_s1_manhole')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x1A1A2E, 1);
      gfx.strokeCircle(12, 12, 10);
      gfx.lineBetween(4, 12, 20, 12);
      gfx.lineBetween(12, 4, 12, 20);
      gfx.generateTexture('deco_s1_manhole', 24, 24);
    }

    // 잔해 더미: 32x24 — 불규칙 삼각형/사각형 조합
    if (!this.textures.exists('deco_s1_debris')) {
      gfx.clear();
      gfx.fillStyle(0x222240, 1);
      gfx.fillTriangle(4, 20, 14, 4, 24, 20);
      gfx.fillRect(16, 10, 12, 12);
      gfx.fillTriangle(20, 18, 28, 6, 30, 18);
      gfx.generateTexture('deco_s1_debris', 32, 24);
    }

    // ── S2 산업 지구 — 색상: 0x1C130A ~ 0x261A0E ──

    // 드럼통: 20x24 — 세로 직사각형 + 가로줄 2개
    if (!this.textures.exists('deco_s2_drum')) {
      gfx.clear();
      gfx.fillStyle(0x1C130A, 1);
      gfx.fillRect(2, 2, 16, 20);
      gfx.lineStyle(1, 0x261A0E, 1);
      gfx.lineBetween(2, 9, 18, 9);
      gfx.lineBetween(2, 15, 18, 15);
      gfx.generateTexture('deco_s2_drum', 20, 24);
    }

    // 파이프라인: 72x12 — 가로 직사각형 + 조인트 마디
    if (!this.textures.exists('deco_s2_pipe')) {
      gfx.clear();
      gfx.fillStyle(0x261A0E, 1);
      gfx.fillRect(0, 2, 72, 8);
      gfx.fillStyle(0x1C130A, 1);
      gfx.fillRect(16, 0, 4, 12);   // 조인트 1
      gfx.fillRect(40, 0, 4, 12);   // 조인트 2
      gfx.fillRect(56, 0, 4, 12);   // 조인트 3
      gfx.generateTexture('deco_s2_pipe', 72, 12);
    }

    // 크레인 잔해: 40x48 — 대각선 트러스 구조 + 보조선
    if (!this.textures.exists('deco_s2_crane')) {
      gfx.clear();
      gfx.lineStyle(2, 0x1C130A, 1);
      gfx.lineBetween(4, 44, 36, 4);    // 대각선 1
      gfx.lineBetween(4, 4, 36, 44);    // 대각선 2
      gfx.lineStyle(1, 0x261A0E, 0.8);
      gfx.lineBetween(4, 24, 36, 24);   // 가로 보조선
      gfx.lineBetween(20, 4, 20, 44);   // 세로 보조선
      gfx.generateTexture('deco_s2_crane', 40, 48);
    }

    // 경고 표지판: 16x20 — 삼각형 + 세로 막대
    if (!this.textures.exists('deco_s2_sign')) {
      gfx.clear();
      gfx.fillStyle(0x261A0E, 1);
      gfx.fillRect(7, 10, 2, 10);       // 막대
      gfx.fillStyle(0x1C130A, 1);
      gfx.fillTriangle(8, 0, 0, 12, 16, 12);  // 삼각형
      gfx.generateTexture('deco_s2_sign', 16, 20);
    }

    // ── S3 지하 서버 — 색상: 0x100A1E ~ 0x1A1030 ──

    // 서버 랙: 24x48 — 세로 직사각형 + 가로 분할선 4개
    if (!this.textures.exists('deco_s3_rack')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x100A1E, 1);
      gfx.strokeRect(2, 2, 20, 44);
      gfx.lineStyle(1, 0x1A1030, 0.8);
      for (let y = 11; y < 44; y += 10) {
        gfx.lineBetween(2, y, 22, y);
      }
      gfx.generateTexture('deco_s3_rack', 24, 48);
    }

    // 케이블 묶음: 56x10 — 가로 평행선 3줄 (약간 구불구불)
    if (!this.textures.exists('deco_s3_cable')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x1A1030, 1);
      gfx.lineBetween(0, 2, 56, 3);
      gfx.lineBetween(0, 5, 56, 5);
      gfx.lineBetween(0, 8, 56, 7);
      gfx.generateTexture('deco_s3_cable', 56, 10);
    }

    // 냉각 팬: 28x28 — 원 + 내부 X자
    if (!this.textures.exists('deco_s3_fan')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x100A1E, 1);
      gfx.strokeCircle(14, 14, 12);
      gfx.lineBetween(4, 4, 24, 24);
      gfx.lineBetween(24, 4, 4, 24);
      gfx.generateTexture('deco_s3_fan', 28, 28);
    }

    // 터미널: 20x24 — 하단 직사각형 + 상단 모니터
    if (!this.textures.exists('deco_s3_terminal')) {
      gfx.clear();
      gfx.fillStyle(0x100A1E, 1);
      gfx.fillRect(2, 10, 16, 14);    // 본체
      gfx.fillStyle(0x1A1030, 1);
      gfx.fillRect(4, 2, 12, 8);      // 모니터
      gfx.generateTexture('deco_s3_terminal', 20, 24);
    }

    // ── S4 더 코어 — 색상: 0x0A1A0A ~ 0x122412 ──

    // 에너지 노드: 24x24 — 이중 원 + 십자선
    if (!this.textures.exists('deco_s4_node')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x0A1A0A, 1);
      gfx.strokeCircle(12, 12, 10);
      gfx.strokeCircle(12, 12, 5);
      gfx.lineBetween(2, 12, 22, 12);
      gfx.lineBetween(12, 2, 12, 22);
      gfx.generateTexture('deco_s4_node', 24, 24);
    }

    // 데이터 기둥: 16x56 — 세로 rect + 점선 디테일
    if (!this.textures.exists('deco_s4_pillar')) {
      gfx.clear();
      gfx.fillStyle(0x122412, 1);
      gfx.fillRect(4, 0, 8, 56);
      // 점선 효과 (작은 직사각형 반복)
      gfx.fillStyle(0x0A1A0A, 0.8);
      for (let y = 4; y < 56; y += 8) {
        gfx.fillRect(6, y, 4, 3);
      }
      gfx.generateTexture('deco_s4_pillar', 16, 56);
    }

    // 깨진 코어: 32x32 — 육각형 윤곽 + 크랙 선 3개
    if (!this.textures.exists('deco_s4_core')) {
      gfx.clear();
      gfx.lineStyle(1.5, 0x0A1A0A, 1);
      // 육각형
      const hexPts = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        hexPts.push({
          x: 16 + 13 * Math.cos(angle),
          y: 16 + 13 * Math.sin(angle),
        });
      }
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        gfx.lineBetween(hexPts[i].x, hexPts[i].y, hexPts[next].x, hexPts[next].y);
      }
      // 크랙 선 3개
      gfx.lineStyle(1, 0x122412, 0.9);
      gfx.lineBetween(16, 4, 10, 16);
      gfx.lineBetween(16, 4, 22, 14);
      gfx.lineBetween(10, 16, 20, 28);
      gfx.generateTexture('deco_s4_core', 32, 32);
    }

    // 부유 파편: 20x20 — 불규칙 다각형 (5~6점)
    if (!this.textures.exists('deco_s4_shard')) {
      gfx.clear();
      gfx.fillStyle(0x122412, 1);
      gfx.fillPoints([
        { x: 10, y: 1 },
        { x: 18, y: 5 },
        { x: 19, y: 14 },
        { x: 12, y: 19 },
        { x: 3, y: 15 },
        { x: 2, y: 6 },
      ], true);
      gfx.generateTexture('deco_s4_shard', 20, 20);
    }

    gfx.destroy();
  }

  // ── 진화 무기 전용 이펙트 텍스처 생성 ──

  /**
   * 11종 진화 무기의 전용 이펙트 텍스처를 생성한다.
   * 원본과 색상·형태를 명확히 차별화하여 진화 후 시각 아이덴티티를 부여한다.
   * @param {Phaser.GameObjects.Graphics} gfx - 재사용할 Graphics 객체
   * @private
   */
  _generateEvolvedEffectTextures(gfx) {
    // 1. precision_cannon (blaster 진화) — 금색 코어 + 밝은 외곽
    if (!this.textures.exists('effect_precision_cannon')) {
      gfx.clear();
      gfx.fillStyle(0xFFD700, 0.3);
      gfx.fillCircle(8, 8, 7);
      gfx.fillStyle(0xFFFFFF, 0.6);
      gfx.fillCircle(8, 8, 5);
      gfx.fillStyle(0xFFD700, 1.0);
      gfx.fillCircle(8, 8, 3);
      gfx.generateTexture('effect_precision_cannon', 16, 16);
    }

    // 2. guardian_sphere (plasma_orb 진화) — 청록 이중 원
    if (!this.textures.exists('effect_guardian_sphere')) {
      gfx.clear();
      gfx.lineStyle(2, 0x00FFD0, 0.5);
      gfx.strokeCircle(14, 14, 12);
      gfx.fillStyle(0x00FFD0, 0.8);
      gfx.fillCircle(14, 14, 7);
      gfx.fillStyle(0xFFFFFF, 0.6);
      gfx.fillCircle(14, 14, 3);
      gfx.generateTexture('effect_guardian_sphere', 28, 28);
    }

    // 3. nuke_missile (missile 진화) — 붉은 대형 미사일
    if (!this.textures.exists('effect_nuke_missile')) {
      gfx.clear();
      gfx.fillStyle(0xFF2222, 0.9);
      gfx.fillRect(2, 4, 20, 12);
      gfx.fillStyle(0xFFFFFF, 0.7);
      gfx.fillRect(18, 6, 4, 8);
      gfx.fillStyle(0xFF6600, 0.8);
      gfx.fillTriangle(0, 4, 0, 16, 4, 10);
      gfx.generateTexture('effect_nuke_missile', 24, 20);
    }

    // 4. nuke_explosion (nuke_missile 폭발) — 붉은 대형 폭발
    if (!this.textures.exists('effect_nuke_explosion')) {
      gfx.clear();
      gfx.fillStyle(0xFF2222, 0.4);
      gfx.fillCircle(40, 40, 38);
      gfx.fillStyle(0xFF6600, 0.6);
      gfx.fillCircle(40, 40, 26);
      gfx.fillStyle(0xFFFFFF, 0.5);
      gfx.fillCircle(40, 40, 12);
      gfx.generateTexture('effect_nuke_explosion', 80, 80);
    }

    // 5. hivemind (drone 진화) — 진보라 삼각형
    if (!this.textures.exists('effect_hivemind')) {
      gfx.clear();
      gfx.fillStyle(0x9933FF, 0.9);
      gfx.fillTriangle(12, 0, 0, 24, 24, 24);
      gfx.fillStyle(0x00FF66, 0.6);
      gfx.fillCircle(12, 14, 4);
      gfx.generateTexture('effect_hivemind', 24, 24);
    }

    // 6. perpetual_emp (emp_blast 진화) — 보라 이중 링
    if (!this.textures.exists('effect_perpetual_emp')) {
      gfx.clear();
      gfx.lineStyle(3, 0xBB44FF, 0.8);
      gfx.strokeCircle(32, 32, 30);
      gfx.lineStyle(2, 0xEE88FF, 0.5);
      gfx.strokeCircle(32, 32, 20);
      gfx.fillStyle(0xBB44FF, 0.15);
      gfx.fillCircle(32, 32, 30);
      gfx.generateTexture('effect_perpetual_emp', 64, 64);
    }

    // 7. phantom_strike (force_blade 진화) — 유령 시안+보라 슬래시
    if (!this.textures.exists('effect_phantom_strike')) {
      gfx.clear();
      // 외곽 보라 글로우
      gfx.fillStyle(0x8844FF, 0.25);
      gfx.fillRect(0, 4, 48, 40);
      // 중간 시안 슬래시 코어
      gfx.fillStyle(0x00FFFF, 0.5);
      gfx.fillRect(2, 10, 44, 28);
      // 밝은 시안 중심선
      gfx.fillStyle(0x00FFFF, 0.85);
      gfx.fillRect(4, 18, 40, 12);
      // 흰색 하이라이트 (가운데 얇은 라인)
      gfx.fillStyle(0xFFFFFF, 0.9);
      gfx.fillRect(8, 22, 32, 4);
      // 테두리 라인
      gfx.lineStyle(1, 0xBB66FF, 0.6);
      gfx.strokeRect(2, 10, 44, 28);
      gfx.generateTexture('effect_phantom_strike', 48, 48);
    }

    // 8. bioplasma (nano_swarm 진화) — 형광 산성 녹색 구름
    if (!this.textures.exists('effect_bioplasma')) {
      gfx.clear();
      gfx.fillStyle(0xAAFF00, 0.5);
      gfx.fillCircle(24, 24, 22);
      gfx.fillStyle(0xDDFF33, 0.6);
      gfx.fillCircle(18, 18, 10);
      gfx.fillStyle(0xDDFF33, 0.6);
      gfx.fillCircle(30, 28, 8);
      gfx.fillStyle(0xFFFFFF, 0.4);
      gfx.fillCircle(24, 20, 5);
      gfx.generateTexture('effect_bioplasma', 48, 48);
    }

    // 9. event_horizon (vortex_cannon 진화) — 블랙홀 (중심 어둡고 가장자리 보라)
    if (!this.textures.exists('effect_event_horizon')) {
      gfx.clear();
      gfx.fillStyle(0x6600AA, 0.6);
      gfx.fillCircle(24, 24, 22);
      gfx.fillStyle(0x220044, 0.9);
      gfx.fillCircle(24, 24, 14);
      gfx.fillStyle(0x000000, 1.0);
      gfx.fillCircle(24, 24, 7);
      gfx.lineStyle(1, 0xBB66FF, 0.7);
      gfx.strokeCircle(24, 24, 22);
      gfx.generateTexture('effect_event_horizon', 48, 48);
    }

    // 10. death_blossom (reaper_field 진화) — 진홍/블랙 꽃잎 형태
    if (!this.textures.exists('effect_death_blossom')) {
      gfx.clear();
      gfx.fillStyle(0x660022, 0.9);
      // 4개 꽃잎 (십자 방향)
      gfx.fillEllipse(16, 6, 10, 16);
      gfx.fillEllipse(16, 26, 10, 16);
      gfx.fillEllipse(6, 16, 16, 10);
      gfx.fillEllipse(26, 16, 16, 10);
      gfx.fillStyle(0xFF0044, 0.7);
      gfx.fillCircle(16, 16, 5);
      gfx.generateTexture('effect_death_blossom', 32, 32);
    }
  }
}
