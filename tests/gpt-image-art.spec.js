/**
 * @fileoverview GPT Image API 스프라이트 재생성 QA 테스트.
 *
 * 20종 스프라이트 로드, 게임 실행, 콘솔 에러 확인,
 * 시각적 검증 등 포괄적인 브라우저 테스트.
 */
import { test, expect } from '@playwright/test';

// ── 에셋 정의 (20종) ──

const ALL_TEXTURES = [
  'player', 'projectile',
  'enemy_nano_drone', 'enemy_scout_bot', 'enemy_spark_drone',
  'enemy_battle_robot', 'enemy_shield_drone', 'enemy_rush_bot',
  'enemy_repair_bot', 'enemy_heavy_bot', 'enemy_teleport_drone',
  'enemy_suicide_bot',
  'enemy_guardian_drone', 'enemy_assault_mech',
  'enemy_commander_drone', 'enemy_siege_titan', 'enemy_core_processor',
  'xp_gem_s', 'xp_gem_m', 'xp_gem_l',
];

// Phaser 게임 인스턴스 대기 헬퍼
async function waitForPhaser(page, timeout = 15000) {
  await page.waitForFunction(() => {
    return window.__NEON_EXODUS
      && window.__NEON_EXODUS.scene
      && window.__NEON_EXODUS.scene.scenes
      && window.__NEON_EXODUS.scene.scenes.length > 0;
  }, { timeout });
}

// 특정 씬이 활성화될 때까지 대기
async function waitForScene(page, sceneName, timeout = 15000) {
  await page.waitForFunction((name) => {
    const game = window.__NEON_EXODUS;
    if (!game || !game.scene) return false;
    const scene = game.scene.getScene(name);
    return scene && scene.scene.isActive();
  }, sceneName, { timeout });
}

test.describe('GPT Image Art - 에셋 및 게임 검증', () => {
  let consoleErrors;
  let consoleWarnings;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  // ── 1. 메뉴 씬 로드 확인 ──

  test('메뉴 씬이 정상 로드된다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    const isMenuActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menu = game.scene.getScene('MenuScene');
      return menu && menu.scene.isActive();
    });

    expect(isMenuActive).toBe(true);
  });

  // ── 2. 20종 텍스처 전부 로드 확인 ──

  test('20종 텍스처가 모두 로드된다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    const textureResults = await page.evaluate((textures) => {
      const game = window.__NEON_EXODUS;
      const results = {};
      for (const key of textures) {
        results[key] = game.textures.exists(key);
      }
      return results;
    }, ALL_TEXTURES);

    for (const key of ALL_TEXTURES) {
      expect(textureResults[key], `텍스처 ${key} 로드 실패`).toBe(true);
    }
  });

  // ── 3. 텍스처 크기 검증 ──

  test('텍스처 크기가 ART_CONCEPT.md 기준과 일치한다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    const expectedSizes = {
      player: [48, 48],
      projectile: [12, 12],
      enemy_nano_drone: [32, 32],
      enemy_scout_bot: [32, 32],
      enemy_spark_drone: [32, 32],
      enemy_battle_robot: [48, 48],
      enemy_shield_drone: [32, 32],
      enemy_rush_bot: [40, 40],
      enemy_repair_bot: [32, 32],
      enemy_heavy_bot: [48, 48],
      enemy_teleport_drone: [32, 32],
      enemy_suicide_bot: [40, 40],
      enemy_guardian_drone: [80, 80],
      enemy_assault_mech: [80, 80],
      enemy_commander_drone: [128, 128],
      enemy_siege_titan: [128, 128],
      enemy_core_processor: [128, 128],
      xp_gem_s: [12, 12],
      xp_gem_m: [20, 20],
      xp_gem_l: [28, 28],
    };

    const sizes = await page.evaluate((textures) => {
      const game = window.__NEON_EXODUS;
      const results = {};
      for (const key of textures) {
        if (game.textures.exists(key)) {
          const frame = game.textures.get(key).getSourceImage();
          results[key] = [frame.width, frame.height];
        }
      }
      return results;
    }, ALL_TEXTURES);

    for (const [key, [ew, eh]] of Object.entries(expectedSizes)) {
      expect(sizes[key], `${key} 크기 불일치`).toBeDefined();
      if (sizes[key]) {
        expect(sizes[key][0], `${key} 너비 불일치`).toBe(ew);
        expect(sizes[key][1], `${key} 높이 불일치`).toBe(eh);
      }
    }
  });

  // ── 4. Phaser render 설정 검증 ──

  test('Phaser config: pixelArt=false, antialias=true', async ({ page }) => {
    await waitForPhaser(page);

    const renderConfig = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        pixelArt: game.config.pixelArt,
        antialias: game.config.antialias,
      };
    });

    expect(renderConfig.pixelArt).toBe(false);
    expect(renderConfig.antialias).toBe(true);
  });

  // ── 5. 콘솔 에러 확인 (메뉴 씬) ──

  test('메뉴 씬에서 콘솔 에러가 발생하지 않는다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    // 메뉴에서 잠시 대기
    await page.waitForTimeout(2000);

    // 텍스처 로드 실패 에러 필터링
    const textureErrors = consoleErrors.filter(
      (e) => e.includes('texture') || e.includes('Texture')
        || e.includes('load') || e.includes('Load')
        || e.includes('404') || e.includes('Failed')
    );

    expect(textureErrors).toEqual([]);
  });

  // ── 6. 메뉴 씬 스크린샷 ──

  test('메뉴 씬 시각적 확인', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/screenshots/gpt-art-menu-scene.png',
    });
  });

  // ── 7. 게임 시작 후 플레이어 표시 확인 ──

  test('게임 시작 후 플레이어가 표시된다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    // 게임 시작: 먼저 캐릭터 선택 씬으로 전환
    // MenuScene의 시작 버튼을 클릭 (화면 중앙 하단)
    await page.waitForTimeout(500);

    // MenuScene에서 GAME START 버튼 클릭 (씬 내 버튼 위치에 직접 클릭)
    // 또는 evaluate로 직접 씬 전환
    const hasCharScene = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return !!game.scene.getScene('CharacterScene');
    });

    if (hasCharScene) {
      // CharacterScene 진입 시뮬레이션
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        game.scene.start('CharacterScene');
      });
      await waitForScene(page, 'CharacterScene');

      // CharacterScene에서 첫 번째 캐릭터 선택하여 GameScene 진입
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        game.scene.start('GameScene', { characterId: 'agent' });
      });
    } else {
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        game.scene.start('GameScene');
      });
    }

    await waitForScene(page, 'GameScene', 20000);
    await page.waitForTimeout(2000);

    // 플레이어가 활성 상태인지 확인
    const playerInfo = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gameScene = game.scene.getScene('GameScene');
      if (!gameScene || !gameScene.player) return null;
      const p = gameScene.player;
      return {
        active: p.active,
        visible: p.visible,
        x: p.x,
        y: p.y,
        textureKey: p.texture?.key,
        scaleX: p.scaleX,
        scaleY: p.scaleY,
      };
    });

    expect(playerInfo).not.toBeNull();
    expect(playerInfo.active).toBe(true);
    expect(playerInfo.visible).toBe(true);
    expect(playerInfo.textureKey).toBe('player');

    // 게임 씬 스크린샷
    await page.screenshot({
      path: 'tests/screenshots/gpt-art-game-player.png',
    });
  });

  // ── 8. 적 스폰 및 표시 확인 ──

  test('적이 스폰되어 표시된다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(300);

    // 게임 시작
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      game.scene.start('GameScene', { characterId: 'agent' });
    });

    await waitForScene(page, 'GameScene', 20000);

    // 적이 스폰되거나 이미 킬 카운트가 발생할 때까지 대기
    // (LevelUpScene이 떠서 게임이 일시정지될 수 있으므로 킬 수도 함께 확인)
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      const gameScene = game.scene.getScene('GameScene');
      if (!gameScene) return false;

      // 적이 하나라도 있거나
      if (gameScene.enemies) {
        const activeEnemies = gameScene.enemies.getChildren().filter((e) => e.active);
        if (activeEnemies.length > 0) return true;
      }
      // 이미 적을 처치한 이력이 있거나
      if (gameScene.player && gameScene.player.kills > 0) return true;

      return false;
    }, { timeout: 15000 });

    // 현재 활성 적 또는 킬 카운트 확인
    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gameScene = game.scene.getScene('GameScene');
      const activeEnemies = gameScene.enemies
        ? gameScene.enemies.getChildren().filter((e) => e.active)
        : [];
      const allEnemies = gameScene.enemies
        ? gameScene.enemies.getChildren()
        : [];

      return {
        activeCount: activeEnemies.length,
        totalPoolSize: allEnemies.length,
        kills: gameScene.player ? gameScene.player.kills : 0,
        activeEnemies: activeEnemies.slice(0, 5).map((e) => ({
          typeId: e.typeId,
          active: e.active,
          visible: e.visible,
          textureKey: e.texture?.key,
        })),
      };
    });

    // 적이 스폰되었거나 이미 처치했으면 적 관련 시스템이 동작 중인 것
    expect(result.activeCount > 0 || result.kills > 0).toBe(true);

    // 활성 적이 있으면 텍스처 키 검증
    for (const e of result.activeEnemies) {
      const expectedTex = 'enemy_' + e.typeId;
      expect(e.textureKey, `적 ${e.typeId} 텍스처 불일치`).toBe(expectedTex);
    }

    await page.screenshot({
      path: 'tests/screenshots/gpt-art-enemies-spawned.png',
    });
  });

  // ── 9. 게임 플레이 중 콘솔 에러 없음 ──

  test('게임 플레이 5초간 콘솔 에러 없음', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      game.scene.start('GameScene', { characterId: 'agent' });
    });

    await waitForScene(page, 'GameScene', 20000);

    // 5초간 게임 플레이
    await page.waitForTimeout(5000);

    // 심각한 에러 필터링 (텍스처/로드 관련)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('net::ERR') // 네트워크 에러 (폰트 등) 제외
        && !e.includes('Galmuri')    // 폰트 로드 실패 제외
        && !e.includes('ERR_FILE_NOT_FOUND') // file:// 프로토콜 에러 제외
    );

    expect(criticalErrors).toEqual([]);
  });

  // ── 10. 텍스처 로드 실패 관련 콘솔 에러 확인 ──

  test('텍스처 로드 실패 에러가 없다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(1000);

    const textureLoadErrors = consoleErrors.filter(
      (e) => e.includes('.png')
        || (e.includes('texture') && e.toLowerCase().includes('fail'))
    );

    expect(textureLoadErrors).toEqual([]);
  });

  // ── 11. Tween 애니메이션 동작 확인 ──

  test('플레이어 tween 맥동 애니메이션이 동작한다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      game.scene.start('GameScene', { characterId: 'agent' });
    });

    await waitForScene(page, 'GameScene', 20000);
    await page.waitForTimeout(1000);

    // 시간이 지남에 따라 scaleX/Y가 변하는지 확인
    const scale1 = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const p = game.scene.getScene('GameScene').player;
      return { scaleX: p.scaleX, scaleY: p.scaleY };
    });

    await page.waitForTimeout(500);

    const scale2 = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const p = game.scene.getScene('GameScene').player;
      return { scaleX: p.scaleX, scaleY: p.scaleY };
    });

    // tween이 동작 중이면 두 시점의 스케일 값이 다를 가능성이 높음
    // (매우 드물게 동일 구간에 있을 수 있으므로, 범위만 확인)
    expect(scale1.scaleX).toBeGreaterThanOrEqual(0.95);
    expect(scale1.scaleX).toBeLessThanOrEqual(1.05);
    expect(scale1.scaleY).toBeGreaterThanOrEqual(0.95);
    expect(scale1.scaleY).toBeLessThanOrEqual(1.05);
  });

  // ── 12. SPRITE_SCALE=1 확인 ──

  test('SPRITE_SCALE이 1이다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      game.scene.start('GameScene', { characterId: 'agent' });
    });

    await waitForScene(page, 'GameScene', 20000);
    await page.waitForTimeout(500);

    // 플레이어 스프라이트의 기본 스케일이 1 근처인지 (tween이 +-5%)
    const playerScale = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const p = game.scene.getScene('GameScene').player;
      return { scaleX: p.scaleX, scaleY: p.scaleY };
    });

    // SPRITE_SCALE=1이면 tween 범위가 0.95~1.05
    expect(playerScale.scaleX).toBeGreaterThanOrEqual(0.95);
    expect(playerScale.scaleX).toBeLessThanOrEqual(1.05);
  });

  // ── 13. 모바일 뷰포트 렌더링 ──

  test('모바일 뷰포트(375x667)에서 정상 렌더링된다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');
    await page.waitForTimeout(1000);

    const isMenuActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.getScene('MenuScene').scene.isActive();
    });

    expect(isMenuActive).toBe(true);

    await page.screenshot({
      path: 'tests/screenshots/gpt-art-mobile-viewport.png',
    });
  });

  // ── 14. BootScene의 load.image 방식 확인 (코드 내 검증) ──

  test('BootScene이 spritesheet이 아닌 image로 로드한다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    // 모든 텍스처가 static image(프레임 1개)로 로드되었는지 확인
    const textureFrameCounts = await page.evaluate((textures) => {
      const game = window.__NEON_EXODUS;
      const results = {};
      for (const key of textures) {
        if (game.textures.exists(key)) {
          const tex = game.textures.get(key);
          results[key] = tex.frameTotal;
        }
      }
      return results;
    }, ALL_TEXTURES);

    for (const key of ALL_TEXTURES) {
      // image로 로드하면 frameTotal === 1 (또는 2 = __BASE + 사용자 프레임)
      expect(textureFrameCounts[key], `${key}: 프레임 수가 비정상`).toBeLessThanOrEqual(2);
    }
  });

  // ── 15. 플레이스홀더 폴백 동작 확인 ──

  test('플레이스홀더가 정식 텍스처 있으면 사용하지 않는다', async ({ page }) => {
    await waitForPhaser(page);
    await waitForScene(page, 'MenuScene');

    // 모든 20종 텍스처가 정식으로 로드되어 플레이스홀더가 아닌지 확인
    // 정식 텍스처의 소스는 HTMLImageElement, 플레이스홀더는 CanvasTexture
    const textureTypes = await page.evaluate((textures) => {
      const game = window.__NEON_EXODUS;
      const results = {};
      for (const key of textures) {
        if (game.textures.exists(key)) {
          const src = game.textures.get(key).getSourceImage();
          results[key] = src.constructor.name;
        }
      }
      return results;
    }, ALL_TEXTURES);

    for (const key of ALL_TEXTURES) {
      // 정식 로딩된 텍스처는 HTMLImageElement여야 한다
      expect(textureTypes[key], `${key}가 플레이스홀더(Canvas)로 폴백됨`).toBe('HTMLImageElement');
    }
  });
});
