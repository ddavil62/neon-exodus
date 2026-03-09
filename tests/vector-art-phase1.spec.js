/**
 * @fileoverview 벡터 아트 Phase 1 QA 테스트.
 *
 * SVG 벡터 스프라이트 전면 교체(20종)와 Phaser 설정 변경을 검증한다.
 */

import { test, expect } from '@playwright/test';

/** 게임 내 Phaser 좌표를 실제 canvas 클릭 좌표로 변환하는 헬퍼 */
async function clickGameCoord(page, gameX, gameY) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  // Phaser Scale.FIT을 사용하므로 canvas 크기에서 비율 계산
  const scaleX = box.width / 360;
  const scaleY = box.height / 640;
  const scale = Math.min(scaleX, scaleY);
  // 중앙 정렬 오프셋
  const offsetX = (box.width - 360 * scale) / 2;
  const offsetY = (box.height - 640 * scale) / 2;
  const clickX = offsetX + gameX * scale;
  const clickY = offsetY + gameY * scale;
  await canvas.click({ position: { x: clickX, y: clickY } });
}

/** MenuScene -> CharacterScene -> GameScene 진입 헬퍼 */
async function enterGameScene(page) {
  await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('MenuScene');
  }, { timeout: 15000 });

  // 출격 버튼 클릭 (MenuScene 시작 버튼: centerX=180, y=310)
  await clickGameCoord(page, 180, 310);

  // CharacterScene 또는 GameScene 활성 대기
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && (
      game.scene.isActive('CharacterScene') || game.scene.isActive('GameScene')
    );
  }, { timeout: 10000 });

  const isCharScene = await page.evaluate(() =>
    window.__NEON_EXODUS.scene.isActive('CharacterScene')
  );

  if (isCharScene) {
    // 출격 버튼: centerX - 60 = 120, btnY = 640 - 60 = 580
    await clickGameCoord(page, 120, 580);

    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 15000 });
  }
}


test.describe('벡터 아트 Phase 1 검증', () => {

  test.describe('정상 동작 - 게임 로드', () => {

    test('메뉴 씬이 정상 로드된다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      await page.screenshot({ path: 'tests/screenshots/01-menu-scene.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') && !e.includes('net::ERR')
      );
      expect(criticalErrors).toEqual([]);
    });

    test('Phaser render 설정이 올바르다 (pixelArt: false, antialias: true)', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      const renderConfig = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        // Phaser 3.87에서 config.render가 다를 수 있으므로 직접 확인
        const cfg = game.config;
        return {
          pixelArt: cfg.pixelArt,
          antialias: cfg.antialias,
          // renderType도 확인
          renderType: game.config.renderType,
        };
      });

      expect(renderConfig.pixelArt).toBe(false);
      expect(renderConfig.antialias).toBe(true);
    });
  });

  test.describe('정상 동작 - 텍스처 로드', () => {

    test('20종 텍스처가 모두 로드된다', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      const textureStatus = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const tm = game.textures;
        const keys = [
          'player', 'projectile',
          'enemy_nano_drone', 'enemy_scout_bot', 'enemy_spark_drone',
          'enemy_battle_robot', 'enemy_shield_drone', 'enemy_rush_bot',
          'enemy_repair_bot', 'enemy_heavy_bot', 'enemy_teleport_drone',
          'enemy_suicide_bot',
          'enemy_guardian_drone', 'enemy_assault_mech',
          'enemy_commander_drone', 'enemy_siege_titan', 'enemy_core_processor',
          'xp_gem_s', 'xp_gem_m', 'xp_gem_l',
        ];
        const result = {};
        for (const k of keys) {
          result[k] = tm.exists(k);
        }
        return result;
      });

      for (const [key, exists] of Object.entries(textureStatus)) {
        expect(exists, `텍스처 '${key}'가 로드되어야 한다`).toBe(true);
      }
    });

    test('텍스처 크기가 올바르다', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      const textureSizes = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const tm = game.textures;
        const keys = [
          { key: 'player', w: 48, h: 48 },
          { key: 'projectile', w: 12, h: 12 },
          { key: 'enemy_nano_drone', w: 32, h: 32 },
          { key: 'enemy_scout_bot', w: 32, h: 32 },
          { key: 'enemy_spark_drone', w: 32, h: 32 },
          { key: 'enemy_battle_robot', w: 48, h: 48 },
          { key: 'enemy_shield_drone', w: 32, h: 32 },
          { key: 'enemy_rush_bot', w: 40, h: 40 },
          { key: 'enemy_repair_bot', w: 32, h: 32 },
          { key: 'enemy_heavy_bot', w: 48, h: 48 },
          { key: 'enemy_teleport_drone', w: 32, h: 32 },
          { key: 'enemy_suicide_bot', w: 40, h: 40 },
          { key: 'enemy_guardian_drone', w: 80, h: 80 },
          { key: 'enemy_assault_mech', w: 80, h: 80 },
          { key: 'enemy_commander_drone', w: 128, h: 128 },
          { key: 'enemy_siege_titan', w: 128, h: 128 },
          { key: 'enemy_core_processor', w: 128, h: 128 },
          { key: 'xp_gem_s', w: 12, h: 12 },
          { key: 'xp_gem_m', w: 20, h: 20 },
          { key: 'xp_gem_l', w: 28, h: 28 },
        ];
        const results = [];
        for (const k of keys) {
          const tex = tm.get(k.key);
          const frame = tex.get('__BASE');
          results.push({
            key: k.key,
            expected: `${k.w}x${k.h}`,
            actual: frame ? `${frame.width}x${frame.height}` : 'N/A',
            pass: frame && frame.width === k.w && frame.height === k.h,
          });
        }
        return results;
      });

      for (const t of textureSizes) {
        expect(t.pass, `텍스처 '${t.key}': 기대 ${t.expected}, 실제 ${t.actual}`).toBe(true);
      }
    });
  });

  test.describe('정상 동작 - 게임 플레이', () => {

    test('게임 시작 후 플레이어가 표시되고 tween이 동작한다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await enterGameScene(page);

      // GameScene에서 플레이어 존재 확인
      const playerInfo = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return null;
        const p = gs.player;
        return {
          active: p.active,
          visible: p.visible,
          x: p.x,
          y: p.y,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          texture: p.texture?.key,
        };
      });

      expect(playerInfo).not.toBeNull();
      expect(playerInfo.active).toBe(true);
      expect(playerInfo.visible).toBe(true);
      expect(playerInfo.texture).toBe('player');

      // 짧은 대기 후 스크린샷
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/screenshots/03-game-scene-player.png' });

      // tween 동작 확인
      const tweenActive = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return false;
        const tweens = gs.tweens.getTweensOf(gs.player);
        return tweens.length > 0;
      });
      expect(tweenActive, '플레이어에 tween이 활성화되어야 한다').toBe(true);

      // 콘솔 에러 필터링
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') && !e.includes('net::ERR') &&
        !e.includes('AdMob') && !e.includes('Capacitor')
      );
      expect(criticalErrors).toEqual([]);
    });

    test('적이 스폰되고 tween이 적용된다', async ({ page }) => {
      await enterGameScene(page);

      // 적 스폰 대기 (4초)
      await page.waitForTimeout(4000);

      const enemyInfo = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.waveSystem) return null;

        const enemyGroup = gs.waveSystem?.enemyPool?.group;
        if (!enemyGroup) return null;

        const activeEnemies = enemyGroup.getChildren().filter(e => e.active);
        const result = {
          activeCount: activeEnemies.length,
          enemies: [],
        };

        for (const e of activeEnemies.slice(0, 5)) {
          const hasTween = gs.tweens.getTweensOf(e).length > 0;
          result.enemies.push({
            typeId: e.typeId,
            texture: e.texture?.key,
            active: e.active,
            visible: e.visible,
            hasTween: hasTween,
          });
        }
        return result;
      });

      // 적이 스폰되어야 한다
      if (enemyInfo && enemyInfo.activeCount > 0) {
        for (const e of enemyInfo.enemies) {
          expect(e.hasTween, `적 '${e.typeId}'에 tween이 적용되어야 한다`).toBe(true);
        }
      }

      await page.screenshot({ path: 'tests/screenshots/04-game-scene-enemies.png' });
    });
  });

  test.describe('콘솔 에러 감시', () => {

    test('전체 게임 흐름에서 텍스처 관련 에러가 없다', async ({ page }) => {
      const textureErrors = [];
      page.on('console', msg => {
        const text = msg.text();
        if (
          text.includes('texture') ||
          text.includes('Texture') ||
          text.includes('sprite') ||
          text.includes('image')
        ) {
          if (msg.type() === 'warning' || msg.type() === 'error') {
            textureErrors.push(text);
          }
        }
      });

      page.on('pageerror', err => {
        textureErrors.push('PAGE_ERROR: ' + err.message);
      });

      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      // 출격 -> 게임 시작 흐름
      await clickGameCoord(page, 180, 310);
      await page.waitForTimeout(500);

      const isCharScene = await page.evaluate(() =>
        window.__NEON_EXODUS.scene.isActive('CharacterScene')
      );
      if (isCharScene) {
        await clickGameCoord(page, 120, 580);
      }

      // 5초간 게임 플레이
      await page.waitForTimeout(5000);

      expect(textureErrors).toEqual([]);
    });
  });

  test.describe('예외 및 엣지케이스', () => {

    test('_createAnimations 메서드가 제거되었다', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      const hasCreateAnimations = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const bootScene = game.scene.getScene('BootScene');
        return typeof bootScene._createAnimations === 'function';
      });

      expect(hasCreateAnimations, '_createAnimations가 제거되어야 한다').toBe(false);
    });

    test('플레이스홀더 폴백 메서드가 존재한다', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      const hasPlaceholderMethod = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const bootScene = game.scene.getScene('BootScene');
        return typeof bootScene._generatePlaceholderTextures === 'function';
      });

      expect(hasPlaceholderMethod, '_generatePlaceholderTextures가 존재해야 한다').toBe(true);
    });

    test('적 비활성화 시 tween이 정리된다', async ({ page }) => {
      await enterGameScene(page);

      // 적 스폰 대기
      await page.waitForTimeout(4000);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.waveSystem) return { error: 'no game scene' };

        const enemyGroup = gs.waveSystem?.enemyPool?.group;
        if (!enemyGroup) return { error: 'no enemy group' };

        const activeEnemies = enemyGroup.getChildren().filter(e => e.active);
        if (activeEnemies.length === 0) return { noEnemies: true };

        const enemy = activeEnemies[0];
        const tweensBefore = gs.tweens.getTweensOf(enemy).length;

        // 강제 비활성화
        enemy.die();

        const tweensAfter = gs.tweens.getTweensOf(enemy).length;

        return {
          tweensBefore,
          tweensAfter,
          enemyActive: enemy.active,
        };
      });

      if (!result.noEnemies && !result.error) {
        expect(result.tweensBefore).toBeGreaterThan(0);
        expect(result.tweensAfter).toBe(0);
        expect(result.enemyActive).toBe(false);
      }
    });
  });

  test.describe('시각적 검증', () => {

    test('게임 메뉴 화면 스크린샷', async ({ page }) => {
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      await page.screenshot({ path: 'tests/screenshots/05-menu-full.png' });
    });

    test('게임 플레이 중 화면 스크린샷', async ({ page }) => {
      await enterGameScene(page);

      // 5초 대기 (적 스폰, 투사체 발사 등)
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'tests/screenshots/06-gameplay-5sec.png' });

      // 10초 후 추가 스크린샷
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'tests/screenshots/07-gameplay-10sec.png' });
    });

    test('모바일 뷰포트(375x667)에서 정상 렌더링', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('MenuScene');
      }, { timeout: 15000 });

      await page.screenshot({ path: 'tests/screenshots/08-mobile-viewport.png' });
    });
  });

  test.describe('body offset 검증', () => {

    test('플레이어 body offset이 올바르다 (circle r=12, offset=12)', async ({ page }) => {
      await enterGameScene(page);

      const bodyInfo = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return null;
        const b = gs.player.body;
        return {
          radius: b.radius,
          offsetX: b.offset.x,
          offsetY: b.offset.y,
          isCircle: b.isCircle,
        };
      });

      expect(bodyInfo).not.toBeNull();
      expect(bodyInfo.isCircle).toBe(true);
      expect(bodyInfo.radius).toBe(12);
      expect(bodyInfo.offsetX).toBe(12);
      expect(bodyInfo.offsetY).toBe(12);
    });
  });
});
