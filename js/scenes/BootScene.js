/**
 * @fileoverview 에셋 로드 및 게임 초기화 씬.
 *
 * Phase 1에서는 실제 스프라이트 에셋이 없으므로 Graphics로 모든 임시 텍스처를 생성한다.
 * 로딩 바를 표시하고, 완료 후 MenuScene으로 전환한다.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS } from '../config.js';
import { t, setLocale } from '../i18n.js';
import { SaveManager } from '../managers/SaveManager.js';
import SoundSystem from '../systems/SoundSystem.js';

// ── BootScene 클래스 ──

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  // ── Phaser 라이프사이클 ──

  /**
   * 에셋을 미리 로드한다.
   * Phase 1에서는 외부 에셋이 없으므로 플레이스홀더 텍스처만 생성한다.
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
  }

  /**
   * 에셋 로드 완료 후 호출. 텍스처 생성 및 초기화 후 MenuScene으로 전환한다.
   */
  create() {
    // 세이브 데이터 초기화 (로컬스토리지에서 로드)
    SaveManager.init();

    // 저장된 언어 설정 반영
    const settings = SaveManager.getData().settings;
    if (settings && settings.locale) {
      setLocale(settings.locale);
    }

    // 플레이스홀더 텍스처 생성
    this._generatePlaceholderTextures();

    // 배경 타일 텍스처 생성
    this._generateBackgroundTile();

    // ── SoundSystem 초기화 ──
    SoundSystem.init(SaveManager.getSettings());

    // ── Particle 텍스처 생성 (VFXSystem용 4x4 흰색) ──
    this._generateParticleTexture();

    // 짧은 딜레이 후 메뉴 씬으로 전환
    this.time.delayedCall(300, () => {
      this.scene.start('MenuScene');
    });
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

    // 플레이어: 24x24 네온 시안 원 + 방향 삼각형
    if (!this.textures.exists('player')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_CYAN, 1);
      gfx.fillCircle(12, 12, 12);
      gfx.fillStyle(COLORS.NEON_CYAN, 0.7);
      gfx.fillTriangle(24, 12, 18, 6, 18, 18);
      gfx.generateTexture('player', 24, 24);
    }

    // ── 잡몹 10종 ──
    const mobColors = {
      nano_drone:     { color: 0xFF4444, size: 8 },
      scout_bot:      { color: 0xFF6644, size: 10 },
      spark_drone:    { color: 0xFFFF00, size: 8 },
      battle_robot:   { color: 0xBB4444, size: 14 },
      shield_drone:   { color: 0x4488FF, size: 10 },
      rush_bot:       { color: 0xFF8800, size: 12 },
      repair_bot:     { color: 0x44FF44, size: 10 },
      heavy_bot:      { color: 0x888888, size: 16 },
      teleport_drone: { color: 0xAA44FF, size: 10 },
      suicide_bot:    { color: 0xFF0000, size: 12 },
    };

    for (const [id, cfg] of Object.entries(mobColors)) {
      const texKey = `enemy_${id}`;
      if (!this.textures.exists(texKey)) {
        gfx.clear();
        gfx.fillStyle(cfg.color, 1);
        const dim = cfg.size * 2;
        gfx.fillCircle(cfg.size, cfg.size, cfg.size);
        gfx.generateTexture(texKey, dim, dim);
      }
    }

    // ── 미니보스 2종: 40x40 ──
    if (!this.textures.exists('enemy_guardian_drone')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_ORANGE, 1);
      gfx.fillCircle(20, 20, 18);
      gfx.lineStyle(2, 0xFFFFFF, 0.5);
      gfx.strokeCircle(20, 20, 18);
      gfx.generateTexture('enemy_guardian_drone', 40, 40);
    }
    if (!this.textures.exists('enemy_assault_mech')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_ORANGE, 1);
      gfx.fillCircle(20, 20, 20);
      gfx.lineStyle(2, 0xFFFFFF, 0.5);
      gfx.strokeCircle(20, 20, 20);
      gfx.generateTexture('enemy_assault_mech', 40, 40);
    }

    // ── 보스 3종: 64x64 ──
    const bossColors = {
      commander_drone: 0xFF00FF,
      siege_titan:     0xFF6600,
      core_processor:  0xFF00FF,
    };
    for (const [id, color] of Object.entries(bossColors)) {
      const texKey = `enemy_${id}`;
      if (!this.textures.exists(texKey)) {
        gfx.clear();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(32, 32, 28);
        gfx.lineStyle(3, 0xFFFFFF, 0.6);
        gfx.strokeCircle(32, 32, 28);
        gfx.generateTexture(texKey, 64, 64);
      }
    }

    // 투사체: 6x6 네온그린 원
    if (!this.textures.exists('projectile')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_GREEN, 1);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture('projectile', 6, 6);
    }

    // XP 보석: 크기별 다이아몬드
    const gemSizes = { xp_gem_s: 6, xp_gem_m: 10, xp_gem_l: 14 };
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

    // 조이스틱 바탕: 원형
    if (!this.textures.exists('joystick_base')) {
      gfx.clear();
      gfx.fillStyle(0xFFFFFF, 0.15);
      gfx.fillCircle(32, 32, 32);
      gfx.generateTexture('joystick_base', 64, 64);
    }

    // 조이스틱 엄지: 원형
    if (!this.textures.exists('joystick_thumb')) {
      gfx.clear();
      gfx.fillStyle(COLORS.NEON_CYAN, 0.7);
      gfx.fillCircle(16, 16, 16);
      gfx.generateTexture('joystick_thumb', 32, 32);
    }

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
   * SF 메탈 바닥 느낌의 64x64 반복 타일.
   * @private
   */
  _generateBackgroundTile() {
    if (this.textures.exists('bg_tile')) return;

    const gfx = this.add.graphics();
    const size = 64;

    // 어두운 배경
    gfx.fillStyle(0x0D0D1F, 1);
    gfx.fillRect(0, 0, size, size);

    // 그리드 라인
    gfx.lineStyle(1, 0x1A1A3A, 0.5);
    gfx.lineBetween(0, 0, size, 0);
    gfx.lineBetween(0, 0, 0, size);

    // 가운데 작은 점 (SF 금속 바닥 리벳)
    gfx.fillStyle(0x222244, 1);
    gfx.fillCircle(size / 2, size / 2, 2);

    // 모서리 점
    gfx.fillCircle(2, 2, 1);
    gfx.fillCircle(size - 2, 2, 1);
    gfx.fillCircle(2, size - 2, 1);
    gfx.fillCircle(size - 2, size - 2, 1);

    gfx.generateTexture('bg_tile', size, size);
    gfx.destroy();
  }
}
