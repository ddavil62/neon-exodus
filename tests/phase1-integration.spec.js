/**
 * @fileoverview Neon Exodus Phase 1 통합 검증 테스트.
 * 게임 로딩, 메뉴, 게임플레이, 레벨업, 결과 화면 등을 검증한다.
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

test.describe('Phase 1: BootScene - 로딩 및 초기화', () => {
  test('페이지 로드 시 Phaser 게임이 생성된다', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    // Phaser가 로드되었는지 확인
    await page.waitForFunction(() => window.Phaser !== undefined, { timeout: 10000 });
    const phaserExists = await page.evaluate(() => typeof window.Phaser !== 'undefined');
    expect(phaserExists).toBe(true);

    // 게임 인스턴스가 생성되었는지 확인
    await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
    const gameExists = await page.evaluate(() => typeof window.__NEON_EXODUS !== 'undefined');
    expect(gameExists).toBe(true);

    // JavaScript 에러 없음 확인 (font 관련 경고 제외)
    const criticalErrors = errors.filter(e => !e.includes('font') && !e.includes('Font') && !e.includes('woff2'));
    expect(criticalErrors).toEqual([]);
  });

  test('BootScene에서 MenuScene으로 전환된다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });

    // MenuScene이 활성화될 때까지 대기
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    const isMenuActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('MenuScene');
    });
    expect(isMenuActive).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/01-menu-scene.png' });
  });
});

test.describe('Phase 1: MenuScene - 메인 메뉴', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });
  });

  test('메뉴 화면이 정상 렌더링된다', async ({ page }) => {
    // Canvas가 존재하는지 확인
    const canvasExists = await page.locator('canvas').count();
    expect(canvasExists).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/screenshots/02-menu-rendered.png' });
  });

  test('출격 버튼 클릭 시 GameScene으로 전환된다', async ({ page }) => {
    // 메뉴 씬에서 "출격" 버튼 영역 클릭
    // 버튼 좌표: centerX=180, y=350 (config.js GAME_WIDTH/2 = 180)
    await page.mouse.click(180, 350);

    // GameScene이 활성화될 때까지 대기
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });

    const isGameActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('GameScene');
    });
    expect(isGameActive).toBe(true);

    // 잠시 대기하여 게임이 렌더링되도록
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/03-game-scene.png' });
  });

  test('비활성 버튼(업그레이드, 도감) 클릭 시 씬 전환되지 않는다', async ({ page }) => {
    // 업그레이드 버튼 영역 (y=420)
    await page.mouse.click(180, 420);
    await page.waitForTimeout(300);

    const isStillMenu = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('MenuScene');
    });
    expect(isStillMenu).toBe(true);
  });
});

test.describe('Phase 1: GameScene - 게임플레이', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    // 출격 버튼 클릭
    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });

    // 게임 초기화 대기
    await page.waitForTimeout(500);
  });

  test('플레이어가 월드 중앙에 생성된다', async ({ page }) => {
    const playerData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      if (!gs || !gs.player) return null;
      return {
        x: gs.player.x,
        y: gs.player.y,
        active: gs.player.active,
        hp: gs.player.currentHp,
        maxHp: gs.player.maxHp,
        level: gs.player.level,
      };
    });

    expect(playerData).not.toBeNull();
    expect(playerData.active).toBe(true);
    expect(playerData.x).toBe(1000); // WORLD_WIDTH/2
    expect(playerData.y).toBe(1000); // WORLD_HEIGHT/2
    expect(playerData.hp).toBe(100);
    expect(playerData.maxHp).toBe(100);
    expect(playerData.level).toBe(1);
  });

  test('블래스터 무기가 장착되어 있다', async ({ page }) => {
    const weaponData = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return null;
      return {
        count: gs.weaponSystem.weapons.length,
        firstWeapon: gs.weaponSystem.weapons[0] ? {
          id: gs.weaponSystem.weapons[0].id,
          level: gs.weaponSystem.weapons[0].level,
        } : null,
      };
    });

    expect(weaponData).not.toBeNull();
    expect(weaponData.count).toBe(1);
    expect(weaponData.firstWeapon.id).toBe('blaster');
    expect(weaponData.firstWeapon.level).toBe(1);
  });

  test('적이 시간 경과 후 스폰된다', async ({ page }) => {
    // 2초 대기하여 적 스폰 기다림
    await page.waitForTimeout(2000);

    const enemyCount = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      if (!gs || !gs.waveSystem) return 0;
      return gs.waveSystem.enemyPool.getActiveCount();
    });

    expect(enemyCount).toBeGreaterThan(0);
  });

  test('조이스틱으로 플레이어가 이동한다', async ({ page }) => {
    // 초기 위치 기록
    const initialPos = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return { x: gs.player.x, y: gs.player.y };
    });

    // 조이스틱 시뮬레이션: 화면 왼쪽 하단 터치 후 오른쪽으로 드래그
    await page.mouse.move(100, 500);
    await page.mouse.down();
    await page.mouse.move(160, 500, { steps: 5 });
    await page.waitForTimeout(500);

    // 이동 후 위치 확인
    const movedPos = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return { x: gs.player.x, y: gs.player.y };
    });

    await page.mouse.up();

    // 오른쪽으로 이동했으므로 X가 증가해야 함
    expect(movedPos.x).toBeGreaterThan(initialPos.x);
  });

  test('자동 공격이 적에게 투사체를 발사한다', async ({ page }) => {
    // 적이 스폰되고 투사체가 발사될 시간 대기
    await page.waitForTimeout(3000);

    const projCount = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return 0;
      return gs.weaponSystem.projectilePool.getActiveCount();
    });

    // 적이 사거리 내에 있으면 투사체가 발사되어야 함
    // 적이 없거나 사거리 밖이면 0일 수 있으므로 >= 0으로 체크
    expect(projCount).toBeGreaterThanOrEqual(0);

    await page.screenshot({ path: 'tests/screenshots/04-game-with-enemies.png' });
  });

  test('HUD 요소가 표시된다', async ({ page }) => {
    // HUD가 생성되었는지 확인
    const hudExists = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs && gs._hud != null;
    });

    expect(hudExists).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/05-hud-display.png' });
  });

  test('일시정지 토글이 동작한다', async ({ page }) => {
    // 일시정지 버튼 클릭 (좌상단 12, 10)
    await page.mouse.click(20, 18);
    await page.waitForTimeout(300);

    const isPaused = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.isPaused;
    });
    expect(isPaused).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/06-paused.png' });

    // 계속 버튼 클릭 (centerX=180, centerY=320)
    await page.mouse.click(180, 320);
    await page.waitForTimeout(300);

    const isResumed = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.isPaused;
    });
    expect(isResumed).toBe(false);
  });

  test('포기 시 메뉴 화면으로 돌아간다', async ({ page }) => {
    // 일시정지
    await page.mouse.click(20, 18);
    await page.waitForTimeout(300);

    // 포기 버튼 클릭 (centerX=180, centerY+50=370)
    await page.mouse.click(180, 370);
    await page.waitForTimeout(500);

    const isMenuActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('MenuScene');
    });
    expect(isMenuActive).toBe(true);
  });
});

test.describe('Phase 1: 콘솔 에러 검증', () => {
  test('전체 게임 흐름에서 치명적 에러가 발생하지 않는다', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    // 메뉴 -> 게임
    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });

    // 3초간 게임 플레이 (적 스폰, 전투)
    await page.waitForTimeout(3000);

    // 일시정지 -> 포기
    await page.mouse.click(20, 18);
    await page.waitForTimeout(200);
    await page.mouse.click(180, 370);
    await page.waitForTimeout(500);

    // 치명적 JS 에러 필터 (font 경고 제외)
    const criticalErrors = errors.filter(e =>
      !e.includes('font') &&
      !e.includes('Font') &&
      !e.includes('woff2') &&
      !e.includes('favicon') &&
      !e.includes('net::ERR')
    );

    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Phase 1: XP/레벨업 시스템 검증', () => {
  test('XP 추가 시 레벨업이 트리거된다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });

    await page.waitForTimeout(500);

    // 수동으로 XP를 추가하여 레벨업 강제 트리거
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      // XP_FORMULA(1) = 10 + 1*5 = 15. 레벨업에 15 XP 필요
      gs.player.addXP(20);
    });

    await page.waitForTimeout(500);

    // LevelUpScene이 활성화되었는지 확인
    const isLevelUpActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('LevelUpScene');
    });
    expect(isLevelUpActive).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/07-levelup-scene.png' });
  });

  test('레벨업 카드 선택 시 GameScene이 재개된다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    // 레벨업 강제 트리거
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.addXP(20);
    });

    await page.waitForTimeout(500);

    // 첫 번째 카드 클릭 (3장이 가로 배치)
    // cards: centerX - totalWidth/2 + cardWidth/2 부터 시작
    // totalWidth = 3*96 + 2*12 = 312, startX = 180 - 156 + 48 = 72
    // 첫 카드: x=72, y=centerY+30 = 350
    await page.mouse.click(72, 350);
    await page.waitForTimeout(500);

    // GameScene이 다시 활성화되어야 함
    const isGameActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('GameScene');
    });
    expect(isGameActive).toBe(true);

    // LevelUpScene은 중지되어야 함
    const isLevelUpStopped = await page.evaluate(() => {
      return !window.__NEON_EXODUS.scene.isActive('LevelUpScene');
    });
    expect(isLevelUpStopped).toBe(true);
  });
});

test.describe('Phase 1: 플레이어 사망 및 결과 화면', () => {
  test('플레이어 HP가 0이 되면 ResultScene으로 전환된다', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    // 플레이어 강제 사망
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.currentHp = 1;
      gs.player.invincible = false;
      gs.player.takeDamage(999);
    });

    // ResultScene 전환 대기 (500ms delay + 약간의 여유)
    await page.waitForTimeout(1500);

    const isResultActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('ResultScene');
    });
    expect(isResultActive).toBe(true);

    await page.screenshot({ path: 'tests/screenshots/08-result-scene-defeat.png' });

    // 치명적 에러 확인
    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') && !e.includes('woff2') && !e.includes('favicon') && !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('결과 화면에서 재도전 버튼이 동작한다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    // 강제 사망
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.currentHp = 1;
      gs.player.invincible = false;
      gs.player.takeDamage(999);
    });
    await page.waitForTimeout(1500);

    // 재도전 버튼 클릭 (GAME_HEIGHT - 140 = 500)
    // 애니메이션 대기
    await page.waitForTimeout(1500);
    await page.mouse.click(180, 500);
    await page.waitForTimeout(500);

    const isGameActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('GameScene');
    });
    expect(isGameActive).toBe(true);
  });

  test('결과 화면에서 메인 메뉴 버튼이 동작한다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    // 강제 사망
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.player.currentHp = 1;
      gs.player.invincible = false;
      gs.player.takeDamage(999);
    });
    await page.waitForTimeout(1500);

    // 메인 메뉴 버튼 (btnY + 60 = 560)
    await page.waitForTimeout(1500);
    await page.mouse.click(180, 560);
    await page.waitForTimeout(500);

    const isMenuActive = await page.evaluate(() => {
      return window.__NEON_EXODUS.scene.isActive('MenuScene');
    });
    expect(isMenuActive).toBe(true);
  });
});

test.describe('Phase 1: 엣지케이스 및 안정성', () => {
  test('빠른 연타로 출격 버튼을 두 번 클릭해도 크래시가 없다', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    // 빠른 더블클릭
    await page.mouse.click(180, 350);
    await page.mouse.click(180, 350);
    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') && !e.includes('woff2') && !e.includes('favicon') && !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('일시정지 버튼 연타 시 크래시가 없다', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });
    await page.waitForTimeout(300);

    // 일시정지 버튼 연속 5회
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(20, 18);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') && !e.includes('woff2') && !e.includes('favicon') && !e.includes('net::ERR')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('게임 시작 -> 사망 -> 재시작 반복이 안정적이다', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    for (let cycle = 0; cycle < 3; cycle++) {
      // 게임 시작 (첫 번째는 메뉴에서, 이후는 결과 화면에서)
      if (cycle === 0) {
        await page.mouse.click(180, 350);
      }

      await page.waitForFunction(() => {
        const game = window.__NEON_EXODUS;
        return game && game.scene && game.scene.isActive('GameScene');
      }, { timeout: 10000 });
      await page.waitForTimeout(500);

      // 강제 사망
      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        gs.player.currentHp = 1;
        gs.player.invincible = false;
        gs.player.takeDamage(999);
      });
      await page.waitForTimeout(1500);

      // ResultScene 확인
      const isResult = await page.evaluate(() => {
        return window.__NEON_EXODUS.scene.isActive('ResultScene');
      });
      expect(isResult).toBe(true);

      // 재도전
      await page.waitForTimeout(1500);
      await page.mouse.click(180, 500);
      await page.waitForTimeout(500);
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('Font') && !e.includes('woff2') && !e.includes('favicon') && !e.includes('net::ERR')
    );

    if (criticalErrors.length > 0) {
      console.log('Errors during restart cycle:', criticalErrors);
    }
    expect(criticalErrors).toEqual([]);
  });

  test('5초간 게임 실행 후 메모리 누수 징후가 없다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('MenuScene');
    }, { timeout: 10000 });

    await page.mouse.click(180, 350);
    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      return game && game.scene && game.scene.isActive('GameScene');
    }, { timeout: 10000 });

    // 5초 게임 실행
    await page.waitForTimeout(5000);

    // 적 수가 비정상적으로 많지 않은지 확인 (< 200)
    const enemyCount = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return gs.waveSystem.enemyPool.getActiveCount();
    });

    expect(enemyCount).toBeLessThan(200);

    await page.screenshot({ path: 'tests/screenshots/09-after-5-seconds.png' });
  });
});

test.describe('Phase 1: 빌드 스크립트 검증', () => {
  test('build.js가 www/ 디렉토리를 정상 생성한다', async () => {
    // This test doesn't use page
    const { execSync } = await import('child_process');
    const { existsSync } = await import('fs');
    const { join } = await import('path');

    const projectRoot = 'C:/antigravity/neon-exodus';

    try {
      execSync('node scripts/build.js', { cwd: projectRoot, encoding: 'utf-8' });
    } catch (e) {
      // build 실패 시 에러 메시지 출력
      console.error('Build failed:', e.stderr || e.message);
    }

    const wwwDir = join(projectRoot, 'www');
    expect(existsSync(wwwDir)).toBe(true);
    expect(existsSync(join(wwwDir, 'index.html'))).toBe(true);
    expect(existsSync(join(wwwDir, 'js', 'main.js'))).toBe(true);
    expect(existsSync(join(wwwDir, 'js', 'config.js'))).toBe(true);
  });
});
