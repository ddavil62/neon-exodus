/**
 * @fileoverview 소모성 아이템(Consumable) 6종 QA 테스트.
 *
 * 스펙 문서: .claude/specs/2026-03-10-neon-exodus-consumables.md
 * 검증 대상: 아이템 데이터, 엔티티 생명주기, 6종 효과, 드롭 시스템,
 *            버프 중복 방지, 엣지케이스, UI 안정성.
 */

import { test, expect } from '@playwright/test';

const GAME_LOAD_TIMEOUT = 10000;

// ── 헬퍼: 게임 인스턴스 참조 ──
function getGame(page) {
  return page.evaluate(() => !!window.__NEON_EXODUS);
}

// ── 헬퍼: MenuScene이 활성화될 때까지 대기 ──
async function waitForMenu(page) {
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    if (!game) return false;
    const menu = game.scene.getScene('MenuScene');
    return menu && menu.scene.isActive();
  }, { timeout: GAME_LOAD_TIMEOUT });
}

// ── 헬퍼: GameScene 프로그래밍 방식으로 시작 ──
async function startGame(page) {
  await waitForMenu(page);

  // 프로그래밍 방식으로 GameScene 시작 (캐릭터 선택 UI 우회)
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const menuScene = game.scene.getScene('MenuScene');
    if (menuScene) {
      menuScene.scene.start('GameScene', { characterId: 'agent' });
    }
  });

  // GameScene이 준비될 때까지 대기
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    if (!game) return false;
    const gs = game.scene.getScene('GameScene');
    return gs && gs.scene.isActive() && gs.player && gs.player.active;
  }, { timeout: GAME_LOAD_TIMEOUT });
}

// ── 테스트 그룹 ──

test.describe('소모성 아이템(Consumable) 6종 검증', () => {

  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page.on('pageerror', (err) => page._consoleErrors.push(err.message));

    await page.goto('/', { waitUntil: 'load' });
    // Phaser 초기화를 위해 충분히 대기
    await page.waitForTimeout(3000);
  });

  // =========================================
  // 1. 게임 로딩 및 기본 무결성
  // =========================================

  test.describe('1. 게임 로딩 및 기본 무결성', () => {

    test('1-1. 게임이 에러 없이 로딩되고 MenuScene이 활성화된다', async ({ page }) => {
      await waitForMenu(page);
      expect(page._consoleErrors.length).toBe(0);
    });

    test('1-2. 6종 소모성 아이템 텍스처가 모두 로드된다', async ({ page }) => {
      await waitForMenu(page);

      const textureKeys = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const texMgr = game.textures;
        const keys = [
          'consumable_nano_repair',
          'consumable_mag_pulse',
          'consumable_emp_bomb',
          'consumable_credit_chip',
          'consumable_overclock',
          'consumable_shield_battery',
        ];
        return keys.map(k => ({ key: k, exists: texMgr.exists(k) }));
      });

      for (const tex of textureKeys) {
        expect(tex.exists, `텍스처 ${tex.key} 존재`).toBe(true);
      }
    });

    test('1-3. consumablePool이 초기 크기 20으로 생성된다', async ({ page }) => {
      await startGame(page);

      const config = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        return {
          hasPool: !!gs.consumablePool,
          poolSize: gs.consumablePool?.group?.getLength() || 0,
        };
      });

      expect(config.hasPool).toBe(true);
      expect(config.poolSize).toBeGreaterThanOrEqual(20);
    });
  });

  // =========================================
  // 2. 아이템 스폰 및 생명주기
  // =========================================

  test.describe('2. 아이템 스폰 및 생명주기', () => {

    test('2-1. spawnConsumable()로 6종 아이템을 스폰할 수 있다', async ({ page }) => {
      await startGame(page);

      const results = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const ids = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];
        for (const id of ids) {
          gs.spawnConsumable(gs.player.x + 50, gs.player.y + 50, id);
        }
        const spawned = [];
        gs.consumablePool.forEach((item) => {
          spawned.push({ id: item.itemId, active: item.active, visible: item.visible });
        });
        return { spawned, count: spawned.length };
      });

      expect(results.count).toBe(6);
      for (const item of results.spawned) {
        expect(item.active).toBe(true);
        expect(item.visible).toBe(true);
      }
    });

    test('2-2. 아이템 수명 10초 후 자동 소멸', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(async () => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        gs.spawnConsumable(gs.player.x + 200, gs.player.y + 200, 'nano_repair');

        let item = null;
        gs.consumablePool.forEach((c) => {
          if (c.active && c.itemId === 'nano_repair') item = c;
        });
        if (!item) return { error: 'spawn failed' };

        // aliveTime을 수명 직전으로 설정 후 update 호출
        item.aliveTime = 9990;
        item.update(0, 20); // delta 20ms => aliveTime = 10010 >= 10000

        return {
          activeAfter: item.active,
          visibleAfter: item.visible,
        };
      });

      expect(result.activeAfter).toBe(false);
      expect(result.visibleAfter).toBe(false);
    });

    test('2-3. 마지막 3초 깜빡임 tween 생성', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        gs.spawnConsumable(gs.player.x + 200, gs.player.y + 200, 'credit_chip');

        let item = null;
        gs.consumablePool.forEach((c) => {
          if (c.active && c.itemId === 'credit_chip') item = c;
        });
        if (!item) return { error: 'spawn failed' };

        const beforeBlink = item._blinkTween === null;
        // aliveTime을 깜빡임 시작 직후로 설정 후 update
        item.aliveTime = 7050;
        item.update(0, 0);

        return {
          beforeBlink,
          afterBlink: item._blinkTween !== null,
        };
      });

      expect(result.beforeBlink).toBe(true);
      expect(result.afterBlink).toBe(true);
    });
  });

  // =========================================
  // 3. 6종 아이템 효과
  // =========================================

  test.describe('3. 아이템별 효과', () => {

    test('3-1. 나노 수리킷: HP 30 회복', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.currentHp = 50;
        const before = p.currentHp;

        gs.spawnConsumable(p.x, p.y, 'nano_repair');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'nano_repair') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return { before, after: p.currentHp, healed: p.currentHp - before };
      });

      expect(result.healed).toBe(30);
      expect(result.after).toBe(80);
    });

    test('3-2. 나노 수리킷: maxHp 초과 불가', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.currentHp = p.maxHp - 10;

        gs.spawnConsumable(p.x, p.y, 'nano_repair');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'nano_repair') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return { maxHp: p.maxHp, hp: p.currentHp, capped: p.currentHp === p.maxHp };
      });

      expect(result.capped).toBe(true);
    });

    test('3-3. 자기 펄스: XP 보석 전부 흡수 + XP 획득', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;

        for (let i = 0; i < 5; i++) {
          gs.spawnXPGem(p.x + 100 + i * 20, p.y + 100, 'small');
        }

        const xpBefore = p.xp;
        let gemsBefore = 0;
        gs.xpGemPool.forEach(() => gemsBefore++);

        gs.spawnConsumable(p.x, p.y, 'mag_pulse');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'mag_pulse') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        let gemsAfter = 0;
        gs.xpGemPool.forEach(() => gemsAfter++);

        return { gemsBefore, gemsAfter, xpGained: p.xp - xpBefore };
      });

      expect(result.gemsBefore).toBeGreaterThanOrEqual(5);
      expect(result.gemsAfter).toBe(0);
      expect(result.xpGained).toBeGreaterThan(0);
    });

    test('3-4. EMP 폭탄: 화면 내 일반 적 즉사', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;

        // 화면 내 일반 적 3마리 스폰
        for (let i = 0; i < 3; i++) {
          const e = gs.waveSystem.enemyPool.get(p.x + 30 + i * 20, p.y + 30);
          e.init('nano_drone', 1, 1);
        }

        let normalOnScreenBefore = 0;
        const cam = gs.cameras.main;
        gs.waveSystem.enemyPool.forEach((e) => {
          if (!e.active || e.isBoss || e.isMiniBoss) return;
          if (e.x >= cam.scrollX - 50 && e.x <= cam.scrollX + cam.width + 50 &&
              e.y >= cam.scrollY - 50 && e.y <= cam.scrollY + cam.height + 50) {
            normalOnScreenBefore++;
          }
        });

        gs.spawnConsumable(p.x, p.y, 'emp_bomb');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'emp_bomb') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        let normalOnScreenAfter = 0;
        gs.waveSystem.enemyPool.forEach((e) => {
          if (!e.active || e.isBoss || e.isMiniBoss) return;
          if (e.x >= cam.scrollX - 50 && e.x <= cam.scrollX + cam.width + 50 &&
              e.y >= cam.scrollY - 50 && e.y <= cam.scrollY + cam.height + 50) {
            normalOnScreenAfter++;
          }
        });

        return { normalOnScreenBefore, normalOnScreenAfter };
      });

      expect(result.normalOnScreenBefore).toBeGreaterThanOrEqual(3);
      expect(result.normalOnScreenAfter).toBe(0);
    });

    test('3-5. EMP 폭탄: 미니보스에게 maxHp 20% 대미지', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;

        const e = gs.waveSystem.enemyPool.get(p.x + 50, p.y + 50);
        e.init('guardian_drone', 1, 1);
        e.setPosition(p.x + 50, p.y + 50);

        const maxHp = e.maxHp;
        const hpBefore = e.currentHp;

        gs.spawnConsumable(p.x, p.y, 'emp_bomb');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'emp_bomb') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return { maxHp, hpBefore, hpAfter: e.currentHp, expectedDmg: Math.floor(maxHp * 0.2) };
      });

      expect(result.hpBefore - result.hpAfter).toBe(result.expectedDmg);
    });

    test('3-6. 크레딧 칩: 5~15 크레딧 획득', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const before = gs.creditsEarned || 0;

        gs.spawnConsumable(p.x, p.y, 'credit_chip');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'credit_chip') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return { before, after: gs.creditsEarned || 0, gained: (gs.creditsEarned || 0) - before };
      });

      expect(result.gained).toBeGreaterThanOrEqual(5);
      expect(result.gained).toBeLessThanOrEqual(15);
    });

    test('3-7. 오버클럭: speed*1.5, cooldown*0.7, 타이머 5000ms', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const speedBefore = p.speedMultiplier;
        const cdBefore = p.cooldownMultiplier;

        gs.spawnConsumable(p.x, p.y, 'overclock');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'overclock') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return {
          speedBefore, speedAfter: p.speedMultiplier,
          cdBefore, cdAfter: p.cooldownMultiplier,
          timer: p._overclockTimer,
          expectedSpeed: speedBefore * 1.5,
          expectedCd: cdBefore * 0.7,
        };
      });

      expect(result.speedAfter).toBeCloseTo(result.expectedSpeed, 4);
      expect(result.cdAfter).toBeCloseTo(result.expectedCd, 4);
      expect(result.timer).toBe(5000);
    });

    test('3-8. 오버클럭 만료 시 원래 값 복원', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const speedOrig = p.speedMultiplier;
        const cdOrig = p.cooldownMultiplier;

        p.applyOverclock();
        p._overclockTimer = 10;
        p._updateBuffs(20);

        return {
          speedOrig, speedAfter: p.speedMultiplier,
          cdOrig, cdAfter: p.cooldownMultiplier,
          timer: p._overclockTimer,
        };
      });

      expect(result.timer).toBe(0);
      expect(result.speedAfter).toBeCloseTo(result.speedOrig, 4);
      expect(result.cdAfter).toBeCloseTo(result.cdOrig, 4);
    });

    test('3-9. 쉴드 배터리: 30000ms 무적 + shieldActive', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const before = { shield: p.shieldActive, inv: p.invincible };

        gs.spawnConsumable(p.x, p.y, 'shield_battery');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'shield_battery') item = c; });
        if (item) gs._onCollectConsumable(p, item);

        return {
          before,
          shieldActive: p.shieldActive,
          invincible: p.invincible,
          timer: p._shieldTimer,
        };
      });

      expect(result.before.shield).toBe(false);
      expect(result.shieldActive).toBe(true);
      expect(result.invincible).toBe(true);
      // CRITICAL CHECK: SHIELD_DURATION = 30000ms (30 seconds)
      expect(result.timer).toBe(30000);
    });

    test('3-10. 쉴드 만료 시 해제', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.applyShield();
        p._shieldTimer = 10;
        p._updateBuffs(20);

        return { shield: p.shieldActive, inv: p.invincible, timer: p._shieldTimer };
      });

      expect(result.shield).toBe(false);
      expect(result.inv).toBe(false);
      expect(result.timer).toBe(0);
    });

    test('3-11. 쉴드 접촉 반사 대미지 5', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.applyShield();

        const e = gs.waveSystem.enemyPool.get(p.x + 30, p.y);
        e.init('nano_drone', 1, 1);
        const before = e.currentHp;
        p.reflectShieldDamage(e);

        return { before, after: e.currentHp, dmg: before - e.currentHp };
      });

      expect(result.dmg).toBe(5);
    });

    test('3-12. 쉴드 중 접촉 시 플레이어 무피해', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.currentHp = p.maxHp;
        const hpBefore = p.currentHp;
        p.applyShield();

        const e = gs.waveSystem.enemyPool.get(p.x + 10, p.y);
        e.init('nano_drone', 1, 1);
        gs._onEnemyContactPlayer(p, e);

        return { hpBefore, hpAfter: p.currentHp };
      });

      expect(result.hpAfter).toBe(result.hpBefore);
    });
  });

  // =========================================
  // 4. 드롭 시스템
  // =========================================

  test.describe('4. 드롭 시스템', () => {

    test('4-1. 보스 die()에서 소모성 아이템 드롭 발생', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        let spawnCalled = 0;
        const origSpawn = gs.spawnConsumable.bind(gs);
        gs.spawnConsumable = (x, y, id) => { spawnCalled++; return origSpawn(x, y, id); };

        const e = gs.waveSystem.enemyPool.get(p.x + 50, p.y + 50);
        e.init('commander_drone', 1, 1);
        e.currentHp = 1;
        e.die();

        gs.spawnConsumable = origSpawn;
        return { spawnCalled };
      });

      // 보스 nano_repair 100% 드롭
      expect(result.spawnCalled).toBeGreaterThanOrEqual(1);
    });

    test('4-2. HP<=50% 시 잡몹 나노수리킷 드롭률 상승 (통계)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.currentHp = Math.floor(p.maxHp * 0.4);

        let nanoDrops = 0;
        const origSpawn = gs.spawnConsumable.bind(gs);
        gs.spawnConsumable = (x, y, id) => { if (id === 'nano_repair') nanoDrops++; return origSpawn(x, y, id); };

        for (let i = 0; i < 1000; i++) {
          const e = gs.waveSystem.enemyPool.get(p.x + 200, p.y + 200);
          e.init('nano_drone', 1, 1);
          e.currentHp = 1;
          e.die();
        }

        gs.spawnConsumable = origSpawn;
        return { nanoDrops, rate: nanoDrops / 1000 };
      });

      // 8%: expect roughly 80 in 1000 trials. Allow 30-160 range
      expect(result.nanoDrops).toBeGreaterThan(30);
      expect(result.nanoDrops).toBeLessThan(160);
    });

    test('4-3. 한 적에서 최대 1개만 드롭', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        let maxDrops = 0;

        for (let i = 0; i < 50; i++) {
          let drops = 0;
          const origSpawn = gs.spawnConsumable.bind(gs);
          gs.spawnConsumable = (x, y, id) => { drops++; return origSpawn(x, y, id); };

          const e = gs.waveSystem.enemyPool.get(p.x + 200, p.y + 200);
          e.init('commander_drone', 1, 1);
          e.currentHp = 1;
          e.die();

          gs.spawnConsumable = origSpawn;
          if (drops > maxDrops) maxDrops = drops;
        }

        return { maxDrops };
      });

      expect(result.maxDrops).toBeLessThanOrEqual(1);
    });
  });

  // =========================================
  // 5. 버프 중복 방지
  // =========================================

  test.describe('5. 버프 중복 방지', () => {

    test('5-1. 오버클럭 재수집 시 이중 적용 없음', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const origSpeed = p.speedMultiplier;

        p.applyOverclock();
        const after1 = p.speedMultiplier;

        p._overclockTimer = 3000;
        p.applyOverclock();
        const after2 = p.speedMultiplier;

        return { origSpeed, after1, after2, timer: p._overclockTimer, doubled: after2 !== after1 };
      });

      expect(result.doubled).toBe(false);
      expect(result.timer).toBe(5000);
    });

    test('5-2. 쉴드 재수집 시 타이머만 리셋', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.applyShield();
        p._shieldTimer = 20000;
        p.applyShield();

        return { shield: p.shieldActive, timer: p._shieldTimer };
      });

      expect(result.shield).toBe(true);
      expect(result.timer).toBe(30000);
    });
  });

  // =========================================
  // 6. 복합 버프 시나리오
  // =========================================

  test.describe('6. 복합 버프', () => {

    test('6-1. 오버클럭+쉴드 동시 -> 오버클럭만 만료', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const origSpeed = p.speedMultiplier;

        p.applyOverclock();
        p.applyShield();

        p._overclockTimer = 10;
        p._updateBuffs(20);

        return {
          overclockExpired: p._overclockTimer === 0,
          speedRestored: Math.abs(p.speedMultiplier - origSpeed) < 0.01,
          shieldActive: p.shieldActive,
          invincible: p.invincible,
        };
      });

      expect(result.overclockExpired).toBe(true);
      expect(result.speedRestored).toBe(true);
      expect(result.shieldActive).toBe(true);
      expect(result.invincible).toBe(true);
    });

    test('6-2. 쉴드 만료 후 피격 무적 정상 동작', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;

        p.applyShield();
        p._shieldTimer = 10;
        p._updateBuffs(20);

        // 쉴드 만료 후
        const afterExpiry = { shield: p.shieldActive, inv: p.invincible };

        // 피격
        p.currentHp = p.maxHp;
        p.takeDamage(10);

        return {
          afterExpiry,
          hpLost: p.currentHp < p.maxHp,
          invAfterHit: p.invincible,
        };
      });

      expect(result.afterExpiry.shield).toBe(false);
      expect(result.afterExpiry.inv).toBe(false);
      expect(result.hpLost).toBe(true);
      expect(result.invAfterHit).toBe(true);
    });
  });

  // =========================================
  // 7. 풀 확장
  // =========================================

  test.describe('7. 풀 확장', () => {

    test('7-1. 20개 초과 스폰 시 자동 확장', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        const sizeBefore = gs.consumablePool.group.getLength();

        for (let i = 0; i < 25; i++) {
          gs.spawnConsumable(p.x + i * 10, p.y + i * 10, 'nano_repair');
        }

        return {
          sizeBefore,
          sizeAfter: gs.consumablePool.group.getLength(),
          activeCount: gs.consumablePool.getActiveCount(),
        };
      });

      expect(result.sizeAfter).toBeGreaterThan(result.sizeBefore);
      expect(result.activeCount).toBe(25);
    });
  });

  // =========================================
  // 8. 안정성
  // =========================================

  test.describe('8. 안정성', () => {

    test('8-1. 게임 10초 플레이 동안 JS 에러 없음', async ({ page }) => {
      await startGame(page);
      await page.waitForTimeout(10000);

      await page.screenshot({ path: 'tests/screenshots/gameplay-10s.png' });

      const errs = page._consoleErrors.filter(e =>
        !e.includes('AudioContext') &&
        !e.includes('Capacitor') &&
        !e.includes('net::ERR')
      );
      expect(errs).toEqual([]);
    });

    test('8-2. 6종 연속 스폰+수집 후 에러 없음', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.currentHp = 50;
        const ids = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];

        for (const id of ids) {
          gs.spawnConsumable(p.x, p.y, id);
          gs.consumablePool.forEach((item) => {
            if (item.active && item.itemId === id) gs._onCollectConsumable(p, item);
          });
        }

        return { alive: p.active, hp: p.currentHp };
      });

      expect(result.alive).toBe(true);
      expect(result.hp).toBeGreaterThan(50);
    });

    test('8-3. 비활성 아이템 수집 시 안전 처리', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;

        gs.spawnConsumable(p.x + 100, p.y + 100, 'nano_repair');
        let item = null;
        gs.consumablePool.forEach((c) => { if (c.active && c.itemId === 'nano_repair') item = c; });
        if (!item) return { error: 'no item' };

        item.setActive(false);
        try {
          gs._onCollectConsumable(p, item);
          return { safe: true };
        } catch (e) {
          return { safe: false, err: e.message };
        }
      });

      expect(result.safe).toBe(true);
    });

    test('8-4. _cleanup 시 consumablePool 정리', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        gs.spawnConsumable(100, 100, 'nano_repair');
        const hadPool = !!gs.consumablePool;
        gs._cleanup();
        return { hadPool, poolAfter: gs.consumablePool };
      });

      expect(result.hadPool).toBe(true);
      expect(result.poolAfter).toBe(null);
    });
  });

  // =========================================
  // 9. 시각적 검증
  // =========================================

  test.describe('9. 시각적 검증', () => {

    test('9-1. 6종 아이템 렌더링 스크린샷', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const px = gs.player.x;
        const py = gs.player.y;
        gs.spawnConsumable(px - 50, py - 50, 'nano_repair');
        gs.spawnConsumable(px + 50, py - 50, 'mag_pulse');
        gs.spawnConsumable(px - 50, py + 50, 'emp_bomb');
        gs.spawnConsumable(px + 50, py + 50, 'credit_chip');
        gs.spawnConsumable(px - 80, py, 'overclock');
        gs.spawnConsumable(px + 80, py, 'shield_battery');
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/consumable-6types.png' });
    });

    test('9-2. 쉴드 활성 시 보라색 틴트', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        gs.player.applyShield();
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/shield-active.png' });
    });
  });

  // =========================================
  // 10. SHIELD_DURATION 30000ms 필수
  // =========================================

  test.describe('10. SHIELD_DURATION 필수 검증', () => {

    test('10-1. SHIELD_DURATION이 정확히 30000ms', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const p = gs.player;
        p.shieldActive = false;
        p._shieldTimer = 0;
        p.invincible = false;

        p.applyShield();
        const timer = p._shieldTimer;

        // 즉시 해제
        p._shieldTimer = 1;
        p._updateBuffs(2);

        return { shieldDuration: timer };
      });

      expect(result.shieldDuration).toBe(30000);
    });
  });

  // =========================================
  // 11. 데이터 정합성
  // =========================================

  test.describe('11. 데이터 정합성', () => {

    test('11-1. 6종 텍스처 키가 CONSUMABLE_MAP과 일치', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        const ids = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];
        const results = [];
        for (const id of ids) {
          gs.spawnConsumable(gs.player.x + 200, gs.player.y + 200, id);
        }
        gs.consumablePool.forEach((item) => {
          if (item.active) {
            results.push({ id: item.itemId, texKey: item.texture?.key, valid: item.texture?.key !== '__MISSING' });
          }
        });
        return { count: results.length, items: results };
      });

      expect(result.count).toBe(6);
      for (const item of result.items) {
        expect(item.valid).toBe(true);
      }
    });
  });
});
