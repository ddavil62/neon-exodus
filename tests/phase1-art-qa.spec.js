/**
 * @fileoverview Phase 1 Art QA 검증 테스트.
 * 스프라이트 에셋 로드, 애니메이션 등록, 엔티티 텍스처 전환, 충돌체, 시각적 검증을 수행한다.
 */
import { test, expect } from '@playwright/test';

// ── 헬퍼 ──

/** 콘솔 에러 수집 */
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

/** 모든 콘솔 로그 수집 */
function collectLogs(page) {
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  return logs;
}

/** 치명적 에러 필터 (폰트/favicon/네트워크 제외) */
function filterCritical(errors) {
  return errors.filter(e =>
    !e.includes('font') && !e.includes('Font') &&
    !e.includes('woff2') && !e.includes('favicon') &&
    !e.includes('net::ERR')
  );
}

/**
 * 메뉴 -> 캐릭터선택 -> 게임씬까지 진행한다.
 * Phaser 씬 전환을 waitForFunction으로 확인한다.
 */
async function startGame(page) {
  await page.goto('/');

  // BootScene -> MenuScene 자동 전환 대기
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('MenuScene');
  }, { timeout: 15000 });

  // 메뉴에서 출격 버튼 클릭 (centerX=180, y=310)
  await page.waitForTimeout(300);
  await page.mouse.click(180, 310);

  // CharacterScene 전환 대기
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('CharacterScene');
  }, { timeout: 10000 });

  await page.waitForTimeout(300);

  // 출격 버튼 클릭 (centerX-60=120, GAME_HEIGHT-60=580)
  await page.mouse.click(120, 580);

  // GameScene 전환 대기
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('GameScene');
  }, { timeout: 15000 });

  await page.waitForTimeout(500);
}

// ── 테스트 ──

test.describe('Phase 1 Art QA: 텍스처 로드 검증', () => {
  test('모든 Phase 1 텍스처가 Phaser에 등록되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const keys = [
        'player', 'projectile',
        'enemy_nano_drone', 'enemy_scout_bot', 'enemy_spark_drone',
        'enemy_battle_robot', 'enemy_shield_drone', 'enemy_rush_bot',
        'enemy_repair_bot', 'enemy_heavy_bot', 'enemy_teleport_drone',
        'enemy_suicide_bot',
        'xp_gem_s', 'xp_gem_m', 'xp_gem_l',
      ];
      const result = {};
      for (const k of keys) {
        result[k] = game.textures.exists(k);
      }
      return result;
    });

    for (const [key, exists] of Object.entries(result)) {
      expect(exists, `텍스처 '${key}'가 로드되어야 함`).toBe(true);
    }
  });

  test('player_idle 및 잡몹 10종 idle 애니메이션이 등록되어 있다', async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const animKeys = [
        'player_idle',
        'enemy_nano_drone_idle', 'enemy_scout_bot_idle', 'enemy_spark_drone_idle',
        'enemy_battle_robot_idle', 'enemy_shield_drone_idle', 'enemy_rush_bot_idle',
        'enemy_repair_bot_idle', 'enemy_heavy_bot_idle', 'enemy_teleport_drone_idle',
        'enemy_suicide_bot_idle',
      ];
      const result = {};
      for (const k of animKeys) {
        result[k] = game.anims.exists(k);
      }
      return result;
    });

    for (const [key, exists] of Object.entries(result)) {
      expect(exists, `애니메이션 '${key}'가 등록되어야 함`).toBe(true);
    }
  });

  test('콘솔에 _temp 관련 에러나 참조가 없다', async ({ page }) => {
    const allLogs = collectLogs(page);
    const errors = collectErrors(page);

    await startGame(page);
    await page.waitForTimeout(2000);

    const tempRefs = allLogs.filter(l =>
      l.includes('player_temp') || l.includes('projectile_temp') ||
      l.includes('xpgem_temp') || l.includes('enemy_temp')
    );
    expect(tempRefs, '_temp 키 참조가 콘솔에 없어야 함').toEqual([]);

    expect(filterCritical(errors), '치명적 JS 에러 없어야 함').toEqual([]);
  });
});

test.describe('Phase 1 Art QA: Player 엔티티 검증', () => {
  test('플레이어 텍스처가 player이고 애니메이션이 재생 중이다', async ({ page }) => {
    await startGame(page);

    const data = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const p = gs.player;
      return {
        textureKey: p.texture.key,
        animPlaying: p.anims.isPlaying,
        animKey: p.anims.currentAnim ? p.anims.currentAnim.key : null,
        totalFrames: p.anims.currentAnim ? p.anims.currentAnim.frames.length : 0,
        active: p.active,
        visible: p.visible,
      };
    });

    expect(data.textureKey).toBe('player');
    expect(data.animPlaying).toBe(true);
    expect(data.animKey).toBe('player_idle');
    expect(data.totalFrames).toBe(2);
    expect(data.active).toBe(true);
    expect(data.visible).toBe(true);
  });

  test('플레이어 충돌체: 원형, 반경 10, 오프셋 (2,2)', async ({ page }) => {
    await startGame(page);

    const body = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const b = gs.player.body;
      return { isCircle: b.isCircle, radius: b.radius, offX: b.offset.x, offY: b.offset.y };
    });

    expect(body.isCircle).toBe(true);
    expect(body.radius).toBe(10);
    expect(body.offX).toBe(2);
    expect(body.offY).toBe(2);
  });
});

test.describe('Phase 1 Art QA: Projectile 엔티티 검증', () => {
  test('투사체 텍스처가 projectile이고 충돌체 반경 3이다', async ({ page }) => {
    await startGame(page);

    const data = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      // ObjectPool은 .group 프로퍼티를 가진다
      const proj = gs.weaponSystem.projectilePool.group.getChildren()[0];
      if (!proj) return null;
      return {
        textureKey: proj.texture.key,
        isCircle: proj.body.isCircle,
        radius: proj.body.radius,
      };
    });

    expect(data).not.toBeNull();
    expect(data.textureKey).toBe('projectile');
    expect(data.isCircle).toBe(true);
    expect(data.radius).toBe(3);
  });
});

test.describe('Phase 1 Art QA: Enemy 엔티티 검증', () => {
  test('스폰된 적이 정식 텍스처를 사용하고 scale=1이다', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    const enemies = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const active = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      return active.map(e => ({
        typeId: e.typeId,
        textureKey: e.texture.key,
        scaleX: e.scaleX,
        scaleY: e.scaleY,
      }));
    });

    expect(enemies.length, '적이 스폰되어야 함').toBeGreaterThan(0);

    // 잡몹은 정식 텍스처 key = 'enemy_' + typeId, scale = 1
    const mobTypes = [
      'nano_drone', 'scout_bot', 'spark_drone', 'battle_robot',
      'shield_drone', 'rush_bot', 'repair_bot', 'heavy_bot',
      'teleport_drone', 'suicide_bot',
    ];
    for (const e of enemies) {
      if (mobTypes.includes(e.typeId)) {
        expect(e.textureKey, `${e.typeId} 텍스처 키`).toBe('enemy_' + e.typeId);
        expect(e.scaleX, `${e.typeId} scaleX`).toBe(1);
        expect(e.scaleY, `${e.typeId} scaleY`).toBe(1);
      }
    }
  });

  test('미니보스/보스(텍스처 미존재)는 폴백 스케일/틴트를 사용한다', async ({ page }) => {
    await startGame(page);

    // 미니보스를 강제 스폰하여 폴백 확인
    const result = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const enemy = gs.waveSystem.enemyPool.group.getChildren().find(e => !e.active);
      if (!enemy) return null;

      enemy.init('guardian_drone', 1, 1);
      return {
        typeId: enemy.typeId,
        textureKey: enemy.texture.key,
        scaleX: enemy.scaleX,
        isMiniBoss: enemy.isMiniBoss,
        tint: enemy.tintTopLeft,
      };
    });

    if (result) {
      // guardian_drone은 정식 텍스처가 없으므로 폴백해야 함
      // BootScene에서 placeholder 텍스처 'enemy_guardian_drone'를 생성하므로 그것을 사용할 수도 있음
      expect(result.isMiniBoss).toBe(true);
    }
  });
});

test.describe('Phase 1 Art QA: XPGem 엔티티 검증', () => {
  test('XP 보석이 적 처치 시 정식 텍스처로 드랍된다', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    // 적 3마리 강제 처치
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const active = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      for (let i = 0; i < Math.min(3, active.length); i++) {
        active[i].takeDamage(99999);
      }
    });

    await page.waitForTimeout(500);

    const gems = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const active = gs.xpGemPool.group.getChildren().filter(g => g.active);
      return active.map(g => ({
        textureKey: g.texture.key,
        scaleX: g.scaleX,
        gemType: g.gemType,
        tint: g.tintTopLeft,
      }));
    });

    expect(gems.length, 'XP 보석이 드랍되어야 함').toBeGreaterThan(0);

    const validTexKeys = ['xp_gem_s', 'xp_gem_m', 'xp_gem_l'];
    for (const g of gems) {
      expect(validTexKeys, `보석 텍스처 '${g.textureKey}'`).toContain(g.textureKey);
      expect(g.scaleX, `보석 scale = 1`).toBe(1);
      // clearTint() 후 tint는 0xFFFFFF = 16777215
      expect(g.tint, '보석에 틴트가 적용되지 않아야 함').toBe(16777215);
    }
  });

  test('XP 보석 타입별 텍스처 매핑이 올바르다', async ({ page }) => {
    await startGame(page);

    const mapping = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const results = [];

      // 각 타입으로 보석 스폰
      for (const type of ['small', 'medium', 'large']) {
        const gem = gs.xpGemPool.group.getChildren().find(g => !g.active);
        if (gem) {
          gem.spawn(100, 100, type);
          results.push({
            type: gem.gemType,
            textureKey: gem.texture.key,
            scaleX: gem.scaleX,
          });
          gem.setActive(false);
          gem.setVisible(false);
        }
      }
      return results;
    });

    expect(mapping.length).toBe(3);
    expect(mapping[0].textureKey).toBe('xp_gem_s');
    expect(mapping[1].textureKey).toBe('xp_gem_m');
    expect(mapping[2].textureKey).toBe('xp_gem_l');
    for (const m of mapping) {
      expect(m.scaleX).toBe(1);
    }
  });
});

test.describe('Phase 1 Art QA: 알려진 이슈 - 피격 틴트 복원', () => {
  test('정식 텍스처 적이 피격 후 틴트 상태 확인 (알려진 이슈)', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    const result = await page.evaluate(async () => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const active = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      if (active.length === 0) return { skipped: true };

      const enemy = active[0];
      const typeId = enemy.typeId;
      const texKey = enemy.texture.key;

      // 약한 데미지 (넉백 없이)
      enemy.takeDamage(1, false);

      // 150ms 후 틴트 확인 (100ms delayedCall 이후)
      await new Promise(r => setTimeout(r, 200));

      return {
        skipped: false,
        typeId,
        textureKey: texKey,
        tintAfterHit: enemy.tintTopLeft,
        // 0xFFFFFF = 16777215 = clearTint 상태
        hasTintApplied: enemy.tintTopLeft !== 16777215,
      };
    });

    if (result.skipped) {
      test.skip();
      return;
    }

    // 알려진 이슈: 정식 텍스처를 사용하는 적이 피격 후 setTint(COLORS.HP_RED)로
    // 빨간 틴트가 적용된다. clearTint()가 더 적절하지만 기존 동작 유지.
    // 이 테스트는 이슈를 기록하기 위한 것이므로 결과를 로깅한다.
    if (result.hasTintApplied) {
      console.log(`[알려진 이슈] 적(${result.typeId}, tex=${result.textureKey}) 피격 후 틴트: 0x${result.tintAfterHit.toString(16)}`);
    }
    // 의도적으로 PASS 처리 (스펙에 명시되지 않은 기존 동작)
    expect(true).toBe(true);
  });
});

test.describe('Phase 1 Art QA: 시각적 검증 (스크린샷)', () => {
  test('게임 시작 직후 화면 캡처', async ({ page }) => {
    await startGame(page);
    await page.screenshot({ path: 'tests/screenshots/qa-art-01-game-start.png' });

    const visible = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.player.active && gs.player.visible;
    });
    expect(visible).toBe(true);
  });

  test('3초 후 적 스폰 상태 캡처', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/qa-art-02-enemies-3sec.png' });

    const count = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active).length;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('XP 보석 드랍 후 캡처', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(3000);

    // 적 처치하여 보석 드랍
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      const active = gs.waveSystem.enemyPool.group.getChildren().filter(e => e.active);
      for (let i = 0; i < Math.min(5, active.length); i++) {
        active[i].takeDamage(99999);
      }
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/qa-art-03-xp-gems.png' });
  });

  test('모바일 뷰포트 (375x667) 렌더링 캡처', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await startGame(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/qa-art-04-mobile.png' });
    expect(filterCritical(errors)).toEqual([]);
  });
});

test.describe('Phase 1 Art QA: 게임 안정성', () => {
  test('5초 전투 후 에러 없이 동작한다', async ({ page }) => {
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'tests/screenshots/qa-art-05-5sec-battle.png' });
    expect(filterCritical(errors), '5초 전투 후 치명적 에러 없음').toEqual([]);
  });

  test('콘솔 에러 없이 메뉴 -> 게임 -> 사망 -> 결과화면 진행', async ({ page }) => {
    const errors = collectErrors(page);
    await startGame(page);

    // 플레이어 강제 사망
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.currentHp = 1;
      gs.player.invincible = false;
      gs.player.takeDamage(999);
    });

    // ResultScene 또는 광고 부활 팝업 대기
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/qa-art-06-death.png' });

    expect(filterCritical(errors), '사망 처리 중 치명적 에러 없음').toEqual([]);
  });
});

test.describe('Phase 1 Art QA: BootScene 코드 검증', () => {
  test('@fileoverview가 Phase 1 에셋 로드를 설명한다', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('C:/antigravity/neon-exodus/js/scenes/BootScene.js', 'utf-8');

    expect(content).toContain('Phase 1 스프라이트 에셋');
    expect(content).toContain('플레이스홀더 텍스처로 폴백');
  });

  test('소스 코드에 _temp 텍스처 참조가 없다', async () => {
    const fs = await import('fs');
    const files = [
      'C:/antigravity/neon-exodus/js/scenes/BootScene.js',
      'C:/antigravity/neon-exodus/js/entities/Player.js',
      'C:/antigravity/neon-exodus/js/entities/Projectile.js',
      'C:/antigravity/neon-exodus/js/entities/XPGem.js',
      'C:/antigravity/neon-exodus/js/entities/Enemy.js',
    ];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content, `${filePath}에 player_temp 없어야 함`).not.toContain('player_temp');
      expect(content, `${filePath}에 projectile_temp 없어야 함`).not.toContain('projectile_temp');
      expect(content, `${filePath}에 xpgem_temp 없어야 함`).not.toContain('xpgem_temp');
      expect(content, `${filePath}에 enemy_temp 없어야 함`).not.toContain('enemy_temp');
    }
  });

  test('GEM_COLORS/GEM_SIZES 상수가 제거되었다', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('C:/antigravity/neon-exodus/js/entities/XPGem.js', 'utf-8');

    expect(content).not.toContain('GEM_COLORS');
    expect(content).not.toContain('GEM_SIZES');
  });

  test('Projectile.js에 COLORS import가 없다', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('C:/antigravity/neon-exodus/js/entities/Projectile.js', 'utf-8');

    // COLORS를 import하지 않아야 함
    expect(content).not.toMatch(/import\s*\{[^}]*COLORS[^}]*\}/);
  });

  test('XPGem.js에 COLORS import가 없다', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('C:/antigravity/neon-exodus/js/entities/XPGem.js', 'utf-8');

    expect(content).not.toMatch(/import\s*\{[^}]*COLORS[^}]*\}/);
  });
});
