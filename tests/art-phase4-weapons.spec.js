/**
 * @fileoverview Phase 4 무기 이펙트 QA 테스트.
 *
 * 이펙트 에셋 로딩, 무기 동작, 콘솔 에러, 시각적 렌더링을 검증한다.
 * 게임 인스턴스: window.__NEON_EXODUS (Phaser.Game)
 * 게임 뷰포트: 360x640
 */
import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'tests/screenshots';

// 게임이 완전히 로드되고 메뉴가 나올 때까지 대기 (시간 기반)
async function waitForGame(page) {
  await page.goto('/');
  // Phaser CDN + BootScene 로드 + MenuScene 전환 = 약 4~6초
  await page.waitForTimeout(6000);
}

// GameScene으로 직접 전환하는 헬퍼 (시간 기반)
async function gotoGameScene(page) {
  await page.evaluate(() => {
    const g = window.__NEON_EXODUS;
    if (!g) return;
    const menu = g.scene.getScene('MenuScene');
    if (menu) menu.scene.start('GameScene');
  });
  await page.waitForTimeout(2000);
}

// 비-게임 에러 필터
function filterCriticalErrors(errors) {
  return errors.filter(e =>
    !e.includes('net::ERR') && !e.includes('404') &&
    !e.includes('favicon') && !e.includes('woff2') &&
    !e.includes('AdMob') && !e.includes('Capacitor') &&
    !e.includes('ERR_FILE_NOT_FOUND') && !e.includes('ERR_CONNECTION') &&
    !e.includes('Failed to load resource')
  );
}

test.describe('Phase 4 무기 이펙트 검증', () => {
  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page._consoleWarnings = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') page._consoleErrors.push(msg.text());
      if (msg.type() === 'warning') page._consoleWarnings.push(msg.text());
    });
  });

  test.describe('1. 게임 로딩 및 에셋 확인', () => {
    test('게임이 에러 없이 로드된다', async ({ page }) => {
      await waitForGame(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-menu-loaded.png` });

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors).toEqual([]);
    });

    test('이펙트 텍스처 10종 로드 및 크기 확인', async ({ page }) => {
      await waitForGame(page);

      const textureCheck = await page.evaluate(() => {
        const g = window.__NEON_EXODUS;
        if (!g || !g.textures) return null;
        const expected = {
          effect_projectile: { w: 16, h: 16 },
          effect_plasma_orb: { w: 24, h: 24 },
          effect_missile: { w: 20, h: 20 },
          effect_explosion: { w: 64, h: 64 },
          effect_drone: { w: 24, h: 24 },
          effect_emp_ring: { w: 64, h: 64 },
          effect_force_slash: { w: 48, h: 48 },
          effect_nano_cloud: { w: 48, h: 48 },
          effect_vortex: { w: 48, h: 48 },
          effect_reaper_blade: { w: 32, h: 32 },
        };
        const results = {};
        for (const [key, exp] of Object.entries(expected)) {
          const exists = g.textures.exists(key);
          let actualW = 0, actualH = 0;
          if (exists) {
            const frame = g.textures.getFrame(key, '__BASE');
            if (frame) { actualW = frame.width; actualH = frame.height; }
          }
          results[key] = { exists, actualW, actualH, expectedW: exp.w, expectedH: exp.h };
        }
        return results;
      });

      expect(textureCheck).not.toBeNull();
      for (const [key, info] of Object.entries(textureCheck)) {
        expect(info.exists, `텍스처 ${key} 존재 여부`).toBe(true);
        expect(info.actualW, `${key} 너비 ${info.actualW} != ${info.expectedW}`).toBe(info.expectedW);
        expect(info.actualH, `${key} 높이 ${info.actualH} != ${info.expectedH}`).toBe(info.expectedH);
      }
    });
  });

  test.describe('2. 게임플레이 중 무기 동작', () => {
    test('GameScene 5초 플레이에서 크래시 없음', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-gameplay-5sec.png` });

      const alive = await page.evaluate(() => {
        const g = window.__NEON_EXODUS;
        if (!g) return false;
        const gs = g.scene.getScene('GameScene');
        return gs && gs.scene.isActive();
      });
      expect(alive).toBe(true);

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      if (criticalErrors.length > 0) console.log('Errors:', criticalErrors);
      expect(criticalErrors.length).toBe(0);
    });

    test('WeaponSystem에 _clouds, _vortexes, _bladeData 초기화 확인', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const wsCheck = await page.evaluate(() => {
        const g = window.__NEON_EXODUS;
        const gs = g?.scene?.getScene('GameScene');
        const ws = gs?.weaponSystem;
        if (!ws) return null;
        return {
          hasClouds: Array.isArray(ws._clouds),
          hasVortexes: Array.isArray(ws._vortexes),
          hasBladeData: ws._bladeData instanceof Map,
          cloudsLen: ws._clouds.length,
          vortexesLen: ws._vortexes.length,
          bladeDataSize: ws._bladeData.size,
        };
      });

      expect(wsCheck).not.toBeNull();
      expect(wsCheck.hasClouds).toBe(true);
      expect(wsCheck.hasVortexes).toBe(true);
      expect(wsCheck.hasBladeData).toBe(true);
    });

    test('투사체가 effect_projectile 텍스처를 사용한다', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);
      await page.waitForTimeout(3000);

      const result = await page.evaluate(() => {
        const g = window.__NEON_EXODUS;
        const gs = g?.scene?.getScene('GameScene');
        const ws = gs?.weaponSystem;
        if (!ws) return { texKey: null, hasEffectTex: false };
        let texKey = null;
        ws.projectilePool.forEach(proj => {
          if (!texKey && proj.texture) texKey = proj.texture.key;
        });
        return { texKey, hasEffectTex: g.textures.exists('effect_projectile') };
      });

      expect(result.hasEffectTex).toBe(true);
      if (result.texKey) expect(result.texKey).toBe('effect_projectile');
    });
  });

  test.describe('3. 신규 4종 무기 직접 주입', () => {
    test('Force Blade (melee) 장착 및 스탯/동작', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        const ws = gs?.weaponSystem;
        if (!ws) return null;
        const added = ws.addWeapon('force_blade');
        const weapon = ws.getWeapon('force_blade');
        const stats = weapon ? ws.getWeaponStats(weapon) : null;
        return { added, type: weapon?.data?.type, level: weapon?.level, stats };
      });

      expect(result).not.toBeNull();
      expect(result.added).toBe(true);
      expect(result.type).toBe('melee');
      expect(result.level).toBe(1);
      expect(result.stats.damage).toBe(30);
      expect(result.stats.range).toBe(60);
      expect(result.stats.arcAngle).toBe(60);
      expect(result.stats.knockback).toBe(20);
      expect(result.stats.cooldown).toBe(800);

      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-force-blade.png` });

      const alive = await page.evaluate(() => {
        return window.__NEON_EXODUS?.scene?.getScene('GameScene')?.scene?.isActive();
      });
      expect(alive).toBe(true);
    });

    test('Nano Swarm (cloud) 장착 및 스탯/동작', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        const ws = gs?.weaponSystem;
        if (!ws) return null;
        const added = ws.addWeapon('nano_swarm');
        const weapon = ws.getWeapon('nano_swarm');
        const stats = weapon ? ws.getWeaponStats(weapon) : null;
        return { added, type: weapon?.data?.type, stats };
      });

      expect(result).not.toBeNull();
      expect(result.added).toBe(true);
      expect(result.type).toBe('cloud');
      expect(result.stats.cloudCount).toBe(1);
      expect(result.stats.tickDamage).toBe(5);
      expect(result.stats.radius).toBe(40);
      expect(result.stats.duration).toBe(4000);
      expect(result.stats.poisonStack).toBe(1);

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-nano-swarm.png` });

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });

    test('Vortex Cannon (gravity) 장착 및 스탯/동작', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        const ws = gs?.weaponSystem;
        if (!ws) return null;
        const added = ws.addWeapon('vortex_cannon');
        const weapon = ws.getWeapon('vortex_cannon');
        const stats = weapon ? ws.getWeaponStats(weapon) : null;
        return { added, type: weapon?.data?.type, stats };
      });

      expect(result).not.toBeNull();
      expect(result.added).toBe(true);
      expect(result.type).toBe('gravity');
      expect(result.stats.pullRadius).toBe(60);
      expect(result.stats.pullForce).toBe(80);
      expect(result.stats.vortexDuration).toBe(3000);
      expect(result.stats.pullDamage).toBe(4);

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-vortex-cannon.png` });

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });

    test('Reaper Field (rotating_blade) 장착 및 블레이드 생성', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (ws) ws.addWeapon('reaper_field');
      });

      await page.waitForTimeout(1500);

      const bladeState = await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return null;
        const bladeInfo = ws._bladeData.get('reaper_field');
        return {
          exists: !!bladeInfo,
          spriteCount: bladeInfo?.sprites.length || 0,
          currentBladeCount: bladeInfo?.currentBladeCount || 0,
          spritesVisible: bladeInfo ? bladeInfo.sprites.every(s => s.visible) : false,
        };
      });

      expect(bladeState).not.toBeNull();
      expect(bladeState.exists).toBe(true);
      expect(bladeState.spriteCount).toBe(3);
      expect(bladeState.currentBladeCount).toBe(3);
      expect(bladeState.spritesVisible).toBe(true);

      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-reaper-field.png` });
    });
  });

  test.describe('4. 엣지 케이스 및 안정성', () => {
    test('11종 무기 동시 장착 후 5초 안정성', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return;
        const ids = [
          'blaster', 'laser_gun', 'plasma_orb', 'electric_chain',
          'missile', 'drone', 'emp_blast',
          'force_blade', 'nano_swarm', 'vortex_cannon', 'reaper_field'
        ];
        for (const id of ids) ws.addWeapon(id);
      });

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-all-weapons.png` });

      const alive = await page.evaluate(() => {
        return window.__NEON_EXODUS?.scene?.getScene('GameScene')?.scene?.isActive();
      });
      expect(alive).toBe(true);

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });

    test('동일 무기 중복 장착 -> false', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const results = await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return null;
        const first = ws.addWeapon('force_blade');
        const second = ws.addWeapon('force_blade');
        return { first, second, count: ws.weapons.filter(w => w.id === 'force_blade').length };
      });

      expect(results).not.toBeNull();
      expect(results.first).toBe(true);
      expect(results.second).toBe(false);
      expect(results.count).toBe(1);
    });

    test('존재하지 않는 무기 ID -> false', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const result = await page.evaluate(() => {
        return window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem?.addWeapon('nonexistent_xyz');
      });
      expect(result).toBe(false);
    });

    test('Reaper 저주 + EMP 둔화 동시 10초 안정성', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return;
        ws.addWeapon('emp_blast');
        ws.addWeapon('reaper_field');
      });

      await page.waitForTimeout(10000);

      const alive = await page.evaluate(() => {
        return window.__NEON_EXODUS?.scene?.getScene('GameScene')?.scene?.isActive();
      });
      expect(alive).toBe(true);

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });

    test('destroy() 리소스 정리 확인', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      const result = await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return null;
        ws.addWeapon('force_blade');
        ws.addWeapon('nano_swarm');
        ws.addWeapon('vortex_cannon');
        ws.addWeapon('reaper_field');

        let error = null;
        try { ws.destroy(); } catch (e) { error = e.message; }

        return {
          error,
          weapons: ws.weapons.length,
          clouds: ws._clouds.length,
          vortexes: ws._vortexes.length,
          bladeData: ws._bladeData.size,
        };
      });

      expect(result).not.toBeNull();
      expect(result.error).toBeNull();
      expect(result.weapons).toBe(0);
      expect(result.clouds).toBe(0);
      expect(result.vortexes).toBe(0);
      expect(result.bladeData).toBe(0);
    });

    test('Reaper Field 레벨업 bladeCount 변경 -> 재구성', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (ws) ws.addWeapon('reaper_field');
      });
      await page.waitForTimeout(500);

      const lv1 = await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        return ws?._bladeData.get('reaper_field')?.currentBladeCount;
      });
      expect(lv1).toBe(3);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (!ws) return;
        ws.upgradeWeapon('reaper_field'); // lv2
        ws.upgradeWeapon('reaper_field'); // lv3
        ws.upgradeWeapon('reaper_field'); // lv4 (bladeCount -> 4)
      });
      await page.waitForTimeout(500);

      const lv4 = await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        const info = ws?._bladeData.get('reaper_field');
        return {
          count: info?.currentBladeCount,
          sprites: info?.sprites.length,
          level: ws?.getWeapon('reaper_field')?.level,
        };
      });

      expect(lv4.level).toBe(4);
      expect(lv4.count).toBe(4);
      expect(lv4.sprites).toBe(4);
    });
  });

  test.describe('5. VFXSystem empRing', () => {
    test('EMP 발동 에러 없음', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);

      await page.evaluate(() => {
        const ws = window.__NEON_EXODUS?.scene?.getScene('GameScene')?.weaponSystem;
        if (ws) ws.addWeapon('emp_blast');
      });

      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-emp-ring.png` });

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('6. 10초 게임플레이 콘솔 에러', () => {
    test('콘솔 에러 없음', async ({ page }) => {
      await waitForGame(page);
      await gotoGameScene(page);
      await page.waitForTimeout(10000);

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      if (criticalErrors.length > 0) console.log('Console errors:', criticalErrors);
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('7. 모바일 뷰포트', () => {
    test('375x667 정상 렌더링', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await waitForGame(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-mobile-menu.png` });

      await gotoGameScene(page);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/phase4-mobile-gameplay.png` });

      const criticalErrors = filterCriticalErrors(page._consoleErrors);
      expect(criticalErrors.length).toBe(0);
    });
  });
});
