/**
 * @fileoverview Neon Exodus Phase 3 - 치명타 시스템 검증 테스트.
 * E-1 FAIL 수정 후 치명타 로직이 정상 동작하는지 검증한다.
 * 치명타 속성, 공식, 시각 효과, 기존 기능 호환성을 테스트한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9877/index.html';

test.describe('Phase 3 - 치명타(Crit) 시스템 검증', () => {
  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') page._consoleErrors.push(msg.text());
    });
  });

  test('Player에 critChance, critDamage, critDamageMultiplier 속성이 존재한다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // CharacterScene으로 이동
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);

    // 기본 캐릭터로 출격
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    const critProps = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gameScene = game.scene.getScene('GameScene');
      if (!gameScene || !gameScene.player) return null;
      const p = gameScene.player;
      return {
        critChance: p.critChance,
        critDamage: p.critDamage,
        critDamageMultiplier: p.critDamageMultiplier,
      };
    });

    expect(critProps).not.toBeNull();
    expect(critProps.critChance).toBe(0);           // 기본 캐릭터는 critChance = 0
    expect(critProps.critDamage).toBe(1.5);          // 기본 critDamage = 1.5
    expect(critProps.critDamageMultiplier).toBe(0.0); // 기본 critDamageMultiplier = 0.0
  });

  test('WeaponSystem에 _rollCrit 메서드가 존재하고 올바른 결과를 반환한다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    // _rollCrit 메서드 테스트: critChance=0일 때 항상 isCrit=false
    const noCritResult = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return null;

      // critChance가 0이므로 절대 크리티컬이 발생하지 않아야 함
      const results = [];
      for (let i = 0; i < 100; i++) {
        const r = gs.weaponSystem._rollCrit(100);
        results.push(r);
      }
      return {
        allNoCrit: results.every(r => r.isCrit === false),
        allDamage100: results.every(r => r.damage === 100),
      };
    });

    expect(noCritResult).not.toBeNull();
    expect(noCritResult.allNoCrit).toBe(true);
    expect(noCritResult.allDamage100).toBe(true);
  });

  test('critChance=1.0일 때 항상 치명타가 발생하고 데미지가 올바르다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    // critChance를 1.0으로 강제 설정 후 _rollCrit 테스트
    const alwaysCritResult = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem || !gs.player) return null;

      // critChance = 1.0 (100% 크리티컬)
      gs.player.critChance = 1.0;
      gs.player.critDamage = 1.5;
      gs.player.critDamageMultiplier = 0.0;

      const results = [];
      for (let i = 0; i < 50; i++) {
        const r = gs.weaponSystem._rollCrit(100);
        results.push(r);
      }

      // 모두 크리티컬이어야 하고, 데미지는 100 * (1.5 + 0.0) = 150
      return {
        allCrit: results.every(r => r.isCrit === true),
        allDamage150: results.every(r => r.damage === 150),
      };
    });

    expect(alwaysCritResult).not.toBeNull();
    expect(alwaysCritResult.allCrit).toBe(true);
    expect(alwaysCritResult.allDamage150).toBe(true);
  });

  test('스나이퍼 critDamageMultiplier +0.30 적용 시 치명타 데미지가 1.8배이다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    // 스나이퍼 패시브 시뮬레이션
    const sniperCritResult = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem || !gs.player) return null;

      gs.player.critChance = 1.0;
      gs.player.critDamage = 1.5;
      gs.player.critDamageMultiplier = 0.30; // 스나이퍼 보너스

      const r = gs.weaponSystem._rollCrit(100);
      // 기대값: 100 * (1.5 + 0.3) = 180
      return {
        isCrit: r.isCrit,
        damage: r.damage,
        expectedDamage: Math.floor(100 * (1.5 + 0.3)),
      };
    });

    expect(sniperCritResult).not.toBeNull();
    expect(sniperCritResult.isCrit).toBe(true);
    expect(sniperCritResult.damage).toBe(180);
    expect(sniperCritResult.damage).toBe(sniperCritResult.expectedDamage);
  });

  test('Projectile에 isCrit 속성이 존재하고 fire() 시 초기화된다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    const projResult = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return null;

      // 풀에서 투사체 가져와서 isCrit 속성 확인
      const pool = gs.weaponSystem.projectilePool;
      const proj = pool.get(0, 0);
      if (!proj) return { error: 'No projectile available' };

      const hasIsCrit = 'isCrit' in proj;

      // fire() 후 isCrit이 false로 리셋되는지 확인
      proj.fire(100, 100, 1, 0, 50, 400, 1);
      const afterFire = proj.isCrit;

      // 정리
      proj.setActive(false);
      proj.setVisible(false);
      if (proj.body) proj.body.enable = false;

      return {
        hasIsCrit,
        afterFireIsCrit: afterFire,
      };
    });

    expect(projResult).not.toBeNull();
    expect(projResult.hasIsCrit).toBe(true);
    expect(projResult.afterFireIsCrit).toBe(false);
  });

  test('치명타 시스템 추가 후에도 GameScene이 5초간 에러 없이 실행된다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);

    // critChance를 높여서 크리티컬이 자주 발생하게 한 상태로 5초 실행
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (gs && gs.player) {
        gs.player.critChance = 0.5; // 50% 크리티컬
      }
    });

    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'tests/screenshots/crit-system-running.png' });

    // 에러 없는지 확인
    const errors = page._consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS')
    );
    expect(errors).toEqual([]);
  });

  test('_showCritEffect 메서드가 에러 없이 호출된다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // GameScene 진입
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    // _showCritEffect를 직접 호출하여 에러 없는지 확인
    const showResult = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return { error: 'No weapon system' };

      try {
        gs.weaponSystem._showCritEffect(180, 320);
        return { success: true };
      } catch (e) {
        return { error: e.message };
      }
    });

    expect(showResult.success).toBe(true);

    const errors = page._consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('CORS')
    );
    expect(errors).toEqual([]);
  });
});
