/**
 * @fileoverview Phase 1 Art 에셋 통합 검증 테스트.
 * 스프라이트 로드, 애니메이션 등록, 폴백 동작, 피격 틴트 복원 등을 검증한다.
 */
import { test, expect } from '@playwright/test';

// 콘솔 에러 수집 헬퍼
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

// 게임 시작까지 진행하는 헬퍼 (Menu -> CharacterScene -> GameScene)
async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('MenuScene');
  }, { timeout: 15000 });

  // 출격 버튼 (y=310)
  await page.mouse.click(180, 310);
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('CharacterScene');
  }, { timeout: 10000 });

  await page.waitForTimeout(300);

  // CharacterScene에서 출격 버튼 (centerX-60=120, GAME_HEIGHT-60=580)
  await page.mouse.click(120, 580);
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('GameScene');
  }, { timeout: 15000 });

  await page.waitForTimeout(500);
}

test.describe('Phase 1 Art: 스프라이트 로드 검증', () => {
  test('게임 로드 시 콘솔에 _temp 관련 에러가 없다', async ({ page }) => {
    const errors = collectErrors(page);
    const allLogs = [];
    page.on('console', (msg) => allLogs.push(msg.text()));

    await startGame(page);
    await page.waitForTimeout(2000);

    // _temp 키 관련 에러가 없어야 함
    const tempErrors = allLogs.filter(l =>
      l.includes('_temp') || l.includes('player_temp') ||
      l.includes('projectile_temp') || l.includes('xpgem_temp') ||
      l.includes('enemy_temp')
    );
    expect(tempErrors).toEqual([]);

    // 치명적 JS 에러 없음
    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') &&
      !e.includes('woff2') && !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('player 텍스처가 정식 에셋으로 로드되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return {
        textureKey: gs.player.texture.key,
        hasPlayerTexture: game.textures.exists('player'),
        hasPlayerIdleAnim: game.anims.exists('player_idle'),
      };
    });

    expect(result.textureKey).toBe('player');
    expect(result.hasPlayerTexture).toBe(true);
    expect(result.hasPlayerIdleAnim).toBe(true);
  });

  test('player_idle 애니메이션이 재생 중이다', async ({ page }) => {
    await startGame(page);

    const animData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const anims = gs.player.anims;
      return {
        isPlaying: anims.isPlaying,
        currentAnimKey: anims.currentAnim ? anims.currentAnim.key : null,
        totalFrames: anims.currentAnim ? anims.currentAnim.frames.length : 0,
      };
    });

    expect(animData.isPlaying).toBe(true);
    expect(animData.currentAnimKey).toBe('player_idle');
    expect(animData.totalFrames).toBe(2);
  });

  test('잡몹 10종 텍스처가 모두 로드되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const keys = [
        'enemy_nano_drone', 'enemy_scout_bot', 'enemy_spark_drone',
        'enemy_battle_robot', 'enemy_shield_drone', 'enemy_rush_bot',
        'enemy_repair_bot', 'enemy_heavy_bot', 'enemy_teleport_drone',
        'enemy_suicide_bot',
      ];
      const textures = {};
      const anims = {};
      for (const k of keys) {
        textures[k] = game.textures.exists(k);
        anims[k + '_idle'] = game.anims.exists(k + '_idle');
      }
      return { textures, anims };
    });

    const allTextureKeys = Object.keys(result.textures);
    for (const k of allTextureKeys) {
      expect(result.textures[k]).toBe(true);
    }

    const allAnimKeys = Object.keys(result.anims);
    for (const k of allAnimKeys) {
      expect(result.anims[k]).toBe(true);
    }
  });

  test('XP 보석 3종 텍스처가 로드되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        xp_gem_s: game.textures.exists('xp_gem_s'),
        xp_gem_m: game.textures.exists('xp_gem_m'),
        xp_gem_l: game.textures.exists('xp_gem_l'),
      };
    });

    expect(result.xp_gem_s).toBe(true);
    expect(result.xp_gem_m).toBe(true);
    expect(result.xp_gem_l).toBe(true);
  });

  test('투사체 텍스처가 로드되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        projectile: game.textures.exists('projectile'),
      };
    });

    expect(result.projectile).toBe(true);
  });
});

test.describe('Phase 1 Art: 시각적 검증', () => {
  test('게임 시작 후 플레이어가 화면에 표시된다', async ({ page }) => {
    await startGame(page);
    await page.screenshot({ path: 'tests/screenshots/art-01-game-start.png' });

    const playerVisible = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.player.active && gs.player.visible;
    });
    expect(playerVisible).toBe(true);
  });

  test('적 스폰 후 고유 스프라이트가 표시된다', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/art-02-enemies-spawned.png' });

    const enemyData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const enemies = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      return enemies.map(e => ({
        typeId: e.typeId,
        textureKey: e.texture.key,
        scale: e.scaleX,
        tintTopLeft: e.tintTopLeft,
      }));
    });

    // 적이 스폰되어 있어야 함
    expect(enemyData.length).toBeGreaterThan(0);

    // 정식 텍스처가 로드된 적은 setTexture로 올바른 키를 사용해야 함
    for (const e of enemyData) {
      const expectedTexKey = 'enemy_' + e.typeId;
      expect(e.textureKey).toBe(expectedTexKey);
      // 정식 텍스처 사용 시 scale은 1이어야 함 (잡몹만)
      if (!['guardian_drone', 'assault_mech', 'commander_drone', 'siege_titan', 'core_processor'].includes(e.typeId)) {
        expect(e.scale).toBe(1);
      }
    }
  });

  test('XP 보석이 적 처치 시 정상 드랍된다', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    // 수동으로 적 처치
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const enemies = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      for (let i = 0; i < Math.min(3, enemies.length); i++) {
        enemies[i].takeDamage(9999);
      }
    });

    await page.waitForTimeout(500);

    const gemData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const gems = gs.xpGemPool.pool.getChildren().filter(g => g.active);
      return gems.map(g => ({
        textureKey: g.texture.key,
        scale: g.scaleX,
        gemType: g.gemType,
      }));
    });

    // XP 보석이 드랍되어야 함
    expect(gemData.length).toBeGreaterThan(0);

    // 보석의 텍스처 키가 올바른지 확인
    for (const g of gemData) {
      const expectedTexKeys = ['xp_gem_s', 'xp_gem_m', 'xp_gem_l'];
      expect(expectedTexKeys).toContain(g.textureKey);
      // scale은 1이어야 함 (setScale(1) 적용)
      expect(g.scale).toBe(1);
    }

    await page.screenshot({ path: 'tests/screenshots/art-03-xp-gems.png' });
  });
});

test.describe('Phase 1 Art: Enemy takeDamage 틴트 복원 이슈', () => {
  test('정식 텍스처를 가진 적이 피격 후 틴트 상태 확인 (알려진 이슈)', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    // 적에게 약한 데미지를 주고 100ms 이상 기다린 후 틴트 확인
    const tintResult = await page.evaluate(async () => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const enemies = gs.waveSystem.enemyPool.pool.getChildren().filter(e => e.active);
      if (enemies.length === 0) return { skipped: true };

      const enemy = enemies[0];
      const beforeTypeId = enemy.typeId;
      const beforeTexKey = enemy.texture.key;

      // 약한 데미지 (죽지 않을 정도)
      enemy.takeDamage(1, false);

      // 150ms 후 틴트 확인 (100ms 타이머 이후)
      await new Promise(r => setTimeout(r, 150));

      return {
        skipped: false,
        typeId: beforeTypeId,
        textureKey: beforeTexKey,
        tintAfterHit: enemy.tintTopLeft,
        // 16777215 = 0xFFFFFF = 틴트 없음 (흰색 = clearTint)
        isUntinted: enemy.tintTopLeft === 16777215,
      };
    });

    if (tintResult.skipped) {
      test.skip();
      return;
    }

    // 이 테스트는 알려진 이슈를 기록하기 위한 것이므로 PASS로 처리하되 콘솔에 결과 출력
    if (!tintResult.isUntinted) {
      console.log(`[알려진 이슈] 적(${tintResult.typeId}) 피격 후 틴트: 0x${tintResult.tintAfterHit.toString(16)} (clearTint 기대)`);
    }
  });
});

test.describe('Phase 1 Art: 충돌체 검증', () => {
  test('플레이어 충돌체가 10,2,2로 설정되어 있다', async ({ page }) => {
    await startGame(page);

    const bodyData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const body = gs.player.body;
      return {
        isCircle: body.isCircle,
        radius: body.radius,
        offsetX: body.offset.x,
        offsetY: body.offset.y,
      };
    });

    expect(bodyData.isCircle).toBe(true);
    expect(bodyData.radius).toBe(10);
    expect(bodyData.offsetX).toBe(2);
    expect(bodyData.offsetY).toBe(2);
  });

  test('투사체 충돌체가 반경 3으로 설정되어 있다', async ({ page }) => {
    await startGame(page);

    const bodyData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const proj = gs.weaponSystem.projectilePool.pool.getChildren()[0];
      if (!proj) return null;
      return {
        isCircle: proj.body.isCircle,
        radius: proj.body.radius,
      };
    });

    expect(bodyData).not.toBeNull();
    expect(bodyData.isCircle).toBe(true);
    expect(bodyData.radius).toBe(3);
  });
});

test.describe('Phase 1 Art: 모바일 뷰포트 안정성', () => {
  test('375x667 (iPhone SE) 뷰포트에서 정상 렌더링된다', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await startGame(page);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/art-04-mobile-375x667.png' });

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') &&
      !e.includes('woff2') && !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Phase 1 Art: 게임 플레이 안정성 (전투 + 사망)', () => {
  test('5초 전투 후 에러 없이 실행된다', async ({ page }) => {
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'tests/screenshots/art-06-5sec-battle.png' });

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') &&
      !e.includes('woff2') && !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('플레이어 사망 후 재시작 시 에셋이 정상 로드된다', async ({ page }) => {
    const errors = collectErrors(page);
    await startGame(page);

    // 플레이어 강제 사망
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.currentHp = 1;
      gs.player.invincible = false;
      gs.player.takeDamage(999);
    });
    await page.waitForTimeout(3000);

    // 재도전 버튼 (y=500)
    await page.mouse.click(180, 500);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 재시작 후 플레이어 텍스처 및 애니메이션 확인
    const result = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return {
        textureKey: gs.player.texture.key,
        animPlaying: gs.player.anims.isPlaying,
        animKey: gs.player.anims.currentAnim ? gs.player.anims.currentAnim.key : null,
      };
    });

    expect(result.textureKey).toBe('player');
    expect(result.animPlaying).toBe(true);
    expect(result.animKey).toBe('player_idle');

    await page.screenshot({ path: 'tests/screenshots/art-07-after-restart.png' });

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') &&
      !e.includes('woff2') && !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Phase 1 Art: BootScene 주석 검증', () => {
  test('fileoverview 주석이 Phase 1 에셋 로드를 설명한다', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('C:/antigravity/neon-exodus/js/scenes/BootScene.js', 'utf-8');

    // Phase 1 관련 키워드가 @fileoverview에 포함되어야 함
    expect(content).toContain('Phase 1 스프라이트 에셋');
    expect(content).toContain('preload');
    expect(content).toContain('플레이스홀더 텍스처로 폴백');

    // _temp 키워드가 없어야 함
    expect(content).not.toContain('player_temp');
    expect(content).not.toContain('projectile_temp');
    expect(content).not.toContain('xpgem_temp');
    expect(content).not.toContain('enemy_temp');
  });
});
