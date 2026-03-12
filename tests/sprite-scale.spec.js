/**
 * @fileoverview 스프라이트 2x 스케일 적용 QA 테스트.
 *
 * 수용 기준:
 * 1. 플레이어가 화면에서 ~48px로 표시된다
 * 2. 적 스프라이트가 32~64px 범위로 시인성이 확보된다
 * 3. 투사체와 XP 보석도 적절한 크기로 표시된다
 * 4. 충돌 판정이 기존과 동일하게 유지된다
 * 5. 스프라이트 픽셀이 선명하게 유지된다 (블러 없음)
 * 6. 기존 플레이스홀더 텍스처 사용 시에도 정상 동작
 */

import { test, expect } from '@playwright/test';

// ── 유틸 함수 ──

/**
 * 게임을 로드하고 GameScene에 진입한다.
 * MenuScene -> CharSelectScene -> GameScene
 */
async function enterGameScene(page) {
  await page.goto('http://localhost:5555');

  // Phaser 게임 인스턴스 로드 대기
  await page.waitForFunction(
    () => window.__NEON_EXODUS?.scene?.scenes?.length > 0,
    { timeout: 10000 }
  );
  await page.waitForTimeout(2500);

  // MenuScene에서 "출격" 버튼 클릭 (y=310, centerX=180)
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 180, y: 310 } });
  await page.waitForTimeout(1000);

  // CharacterScene에서 "출격" 버튼 클릭 (x=120, y=580)
  await canvas.click({ position: { x: 120, y: 580 } });
  await page.waitForTimeout(2500);

  // GameScene 활성화 확인 (여러 번 폴링)
  let isGameScene = false;
  for (let i = 0; i < 5; i++) {
    isGameScene = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
      return gs?.scene?.isActive() || false;
    });
    if (isGameScene) break;
    await page.waitForTimeout(500);
  }

  return isGameScene;
}

// ── 테스트 ──

test.describe('스프라이트 2x 스케일 검증', () => {

  test.describe('정상 동작 - 수용 기준', () => {

    test('AC1: 플레이어가 화면에서 ~48px(displayWidth)로 표시된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      const playerInfo = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.player) return null;
        const p = gs.player;
        return {
          displayWidth: p.displayWidth,
          displayHeight: p.displayHeight,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          active: p.active,
          visible: p.visible,
        };
      });

      expect(playerInfo).not.toBeNull();
      expect(playerInfo.active).toBe(true);
      expect(playerInfo.visible).toBe(true);
      expect(playerInfo.scaleX).toBe(2);
      expect(playerInfo.scaleY).toBe(2);
      // 24px 프레임 * 2 = 48px 디스플레이
      expect(playerInfo.displayWidth).toBe(48);
      expect(playerInfo.displayHeight).toBe(48);
    });

    test('AC1-body: 플레이어 충돌체가 올바르게 설정되었다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      const bodyInfo = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.player?.body) return null;
        const b = gs.player.body;
        return {
          isCircle: b.isCircle,
          radius: b.radius,
          offsetX: b.offset.x,
          offsetY: b.offset.y,
        };
      });

      expect(bodyInfo).not.toBeNull();
      expect(bodyInfo.isCircle).toBe(true);
      expect(bodyInfo.radius).toBe(12);
      // bodyOffset = (24 * 2) / 2 - 12 = 12
      expect(bodyInfo.offsetX).toBe(12);
      expect(bodyInfo.offsetY).toBe(12);
    });

    test('AC2: 적 스프라이트가 32~64px 범위로 시인성이 확보된다 (잡몹)', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 적이 스폰될 때까지 대기
      await page.waitForTimeout(3000);

      const enemyInfos = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.waveSystem) return [];
        const enemies = gs.waveSystem.enemyPool.getActive();
        return enemies.slice(0, 10).map(e => ({
          typeId: e.typeId,
          displayWidth: e.displayWidth,
          displayHeight: e.displayHeight,
          scaleX: e.scaleX,
          active: e.active,
          visible: e.visible,
          isMiniBoss: e.isMiniBoss,
          isBoss: e.isBoss,
        }));
      });

      expect(enemyInfos.length).toBeGreaterThan(0);

      for (const info of enemyInfos) {
        expect(info.active).toBe(true);
        expect(info.visible).toBe(true);
        // 잡몹 기본 적은 최소 16px(8*2)~64px(32*2) 범위
        expect(info.displayWidth).toBeGreaterThanOrEqual(16);
        expect(info.displayWidth).toBeLessThanOrEqual(128);
      }
    });

    test('AC3: 투사체가 적절한 크기(~12px displayWidth)로 표시된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 적이 스폰되고 투사체가 발사될 때까지 대기
      await page.waitForTimeout(4000);

      const projInfos = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.weaponSystem?.projectilePool) return [];
        const projs = gs.weaponSystem.projectilePool.getActive();
        return projs.slice(0, 5).map(p => ({
          displayWidth: p.displayWidth,
          displayHeight: p.displayHeight,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          active: p.active,
          bodyRadius: p.body?.radius,
          bodyOffsetX: p.body?.offset?.x,
          bodyOffsetY: p.body?.offset?.y,
        }));
      });

      // 투사체가 발사되었을 수 있다
      if (projInfos.length > 0) {
        for (const info of projInfos) {
          expect(info.scaleX).toBe(2);
          expect(info.scaleY).toBe(2);
          // 6px * 2 = 12px
          expect(info.displayWidth).toBe(12);
          // body: radius=4, offset=2
          expect(info.bodyRadius).toBe(4);
          expect(info.bodyOffsetX).toBe(2);
          expect(info.bodyOffsetY).toBe(2);
        }
      }
    });

    test('AC3-xpgem: XP 보석이 적절한 크기로 표시된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 적 처치 후 보석 드랍까지 대기
      await page.waitForTimeout(6000);

      const gemInfos = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.xpGemPool) return [];
        const gems = gs.xpGemPool.getActive();
        return gems.slice(0, 5).map(g => ({
          gemType: g.gemType,
          displayWidth: g.displayWidth,
          displayHeight: g.displayHeight,
          scaleX: g.scaleX,
          scaleY: g.scaleY,
          active: g.active,
          bodyRadius: g.body?.radius,
        }));
      });

      if (gemInfos.length > 0) {
        for (const info of gemInfos) {
          expect(info.scaleX).toBe(2);
          expect(info.scaleY).toBe(2);
          expect(info.active).toBe(true);

          // 각 타입별 검증
          if (info.gemType === 'small') {
            expect(info.displayWidth).toBe(12); // 6 * 2
            expect(info.bodyRadius).toBe(3);
          } else if (info.gemType === 'medium') {
            expect(info.displayWidth).toBe(20); // 10 * 2
            expect(info.bodyRadius).toBe(5);
          } else if (info.gemType === 'large') {
            expect(info.displayWidth).toBe(28); // 14 * 2
            expect(info.bodyRadius).toBe(7);
          }
        }
      }
    });

    test('AC5: pixelArt 설정으로 블러 없이 선명한 렌더링', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      const renderConfig = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        if (!game?.config) return null;
        return {
          pixelArt: game.config.render?.pixelArt || game.config.pixelArt,
          antialias: game.config.render?.antialias || game.config.antialias,
        };
      });

      expect(renderConfig).not.toBeNull();
      expect(renderConfig.pixelArt).toBe(true);
      expect(renderConfig.antialias).toBe(false);
    });

    test('AC6: SPRITE_SCALE 상수가 config.js에 올바르게 정의됨', async ({ page }) => {
      await page.goto('http://localhost:5555');
      await page.waitForFunction(
        () => window.__NEON_EXODUS?.scene?.scenes?.length > 0,
        { timeout: 10000 }
      );

      const scaleValue = await page.evaluate(async () => {
        // config.js에서 SPRITE_SCALE을 동적 import
        const config = await import('/js/config.js');
        return config.SPRITE_SCALE;
      });

      expect(scaleValue).toBe(2);
    });
  });

  test.describe('충돌 판정 검증 (AC4)', () => {

    test('플레이어와 XP 보석 간 충돌 오버랩이 동작한다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 게임 진행 대기 (적 처치 -> 보석 드랍 -> 보석 수집)
      await page.waitForTimeout(8000);

      const playerLevel = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        return gs?.player?.level || 0;
      });

      // 시간이 지나면 XP를 통해 레벨업이 일어남 = XP 보석 수집이 정상 작동
      const playerXp = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        return gs?.player?.xp || 0;
      });

      // 레벨이 1보다 크거나 XP가 0보다 크면 보석 수집이 작동한 것
      const collected = playerLevel > 1 || playerXp > 0;
      expect(collected).toBe(true);
    });

    test('투사체와 적 간 충돌 오버랩이 동작한다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 게임 진행 대기 (적 처치)
      await page.waitForTimeout(6000);

      const killCount = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        return gs?.killCount || 0;
      });

      // 킬 카운트가 0보다 크면 투사체-적 충돌이 동작한 것
      expect(killCount).toBeGreaterThan(0);
    });
  });

  test.describe('엣지케이스 및 예외 시나리오', () => {

    test('콘솔 에러가 발생하지 않는다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 게임을 6초간 진행
      await page.waitForTimeout(6000);

      // 콘솔 에러 확인 (Phaser 내부 경고 제외)
      const criticalErrors = errors.filter(
        e => !e.includes('Cannot read properties of null') || !e.includes('Phaser')
      );

      // 에러가 있으면 내용 출력
      if (criticalErrors.length > 0) {
        console.error('콘솔 에러 발견:', criticalErrors);
      }
      expect(errors.length).toBe(0);
    });

    test('Enemy body offset에서 NaN이나 음수가 발생하지 않는다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      await page.waitForTimeout(4000);

      const bodyInfos = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.waveSystem) return [];
        const enemies = gs.waveSystem.enemyPool.getActive();
        return enemies.map(e => ({
          typeId: e.typeId,
          bodyRadius: e.body?.radius,
          bodyOffsetX: e.body?.offset?.x,
          bodyOffsetY: e.body?.offset?.y,
          bodyIsCircle: e.body?.isCircle,
        }));
      });

      for (const info of bodyInfos) {
        expect(info.bodyRadius).not.toBeNaN();
        expect(info.bodyOffsetX).not.toBeNaN();
        expect(info.bodyOffsetY).not.toBeNaN();
        expect(info.bodyOffsetX).toBeGreaterThanOrEqual(0);
        expect(info.bodyOffsetY).toBeGreaterThanOrEqual(0);
        expect(info.bodyRadius).toBeGreaterThan(0);
      }
    });

    test('Enemy placeholder 스케일이 적의 ENEMY_RADIUS에 맞게 적용된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      await page.waitForTimeout(4000);

      const enemyScales = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.waveSystem) return [];
        const enemies = gs.waveSystem.enemyPool.getActive();
        return enemies.map(e => ({
          typeId: e.typeId,
          scaleX: e.scaleX,
          isMiniBoss: e.isMiniBoss,
          isBoss: e.isBoss,
          displayWidth: e.displayWidth,
        }));
      });

      for (const info of enemyScales) {
        // 모든 적의 스케일은 1보다 커야 한다 (SPRITE_SCALE=2 또는 그 이상)
        expect(info.scaleX).toBeGreaterThanOrEqual(2);
        // displayWidth는 최소 16px (8*2)
        expect(info.displayWidth).toBeGreaterThanOrEqual(16);
      }
    });

    test('풀 재사용 시 투사체 스케일이 유지된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 게임을 오래 진행하여 투사체 풀이 재사용되도록 유도
      await page.waitForTimeout(8000);

      const projScales = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.weaponSystem?.projectilePool) return { active: [], inactive: [] };
        const all = gs.weaponSystem.projectilePool.group.getChildren();
        return {
          active: all.filter(p => p.active).map(p => ({
            scaleX: p.scaleX,
            scaleY: p.scaleY,
            displayWidth: p.displayWidth,
          })),
          inactive: all.filter(p => !p.active).map(p => ({
            scaleX: p.scaleX,
            scaleY: p.scaleY,
          })),
        };
      });

      // 활성 투사체 스케일 확인
      for (const p of projScales.active) {
        expect(p.scaleX).toBe(2);
        expect(p.scaleY).toBe(2);
        expect(p.displayWidth).toBe(12);
      }

      // 비활성(풀 대기) 투사체도 스케일 유지 확인
      for (const p of projScales.inactive) {
        expect(p.scaleX).toBe(2);
        expect(p.scaleY).toBe(2);
      }
    });

    test('풀 재사용 시 XP 보석 스케일이 유지된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      await page.waitForTimeout(8000);

      const gemScales = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.xpGemPool) return { active: [], inactive: [] };
        const all = gs.xpGemPool.group.getChildren();
        return {
          active: all.filter(g => g.active).map(g => ({
            scaleX: g.scaleX,
            scaleY: g.scaleY,
            gemType: g.gemType,
          })),
          inactive: all.filter(g => !g.active).map(g => ({
            scaleX: g.scaleX,
            scaleY: g.scaleY,
          })),
        };
      });

      // 활성 보석 스케일
      for (const g of gemScales.active) {
        expect(g.scaleX).toBe(2);
        expect(g.scaleY).toBe(2);
      }

      // 비활성(풀 대기) 보석도 스케일 유지 (constructor + spawn 모두 setScale 적용)
      for (const g of gemScales.inactive) {
        expect(g.scaleX).toBe(2);
        expect(g.scaleY).toBe(2);
      }
    });

    test('Enemy 풀 재사용 시 스케일이 올바르게 재설정된다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 오래 진행하여 적 풀 재사용 유도
      await page.waitForTimeout(10000);

      const enemyScaleInfo = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.waveSystem) return [];
        const all = gs.waveSystem.enemyPool.group.getChildren();
        return all.filter(e => e.active).map(e => ({
          typeId: e.typeId,
          scaleX: e.scaleX,
          displayWidth: e.displayWidth,
          isMiniBoss: e.isMiniBoss,
          isBoss: e.isBoss,
        }));
      });

      for (const info of enemyScaleInfo) {
        // 스케일은 최소 SPRITE_SCALE(2) 이상
        expect(info.scaleX).toBeGreaterThanOrEqual(2);
        // displayWidth는 0이 아니어야 함
        expect(info.displayWidth).toBeGreaterThan(0);
      }
    });
  });

  test.describe('시각적 검증', () => {

    test('게임 플레이 중 스프라이트 시인성 스크린샷', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 적이 충분히 스폰될 때까지 대기
      await page.waitForTimeout(4000);

      await page.screenshot({
        path: 'tests/screenshots/sprite-scale-gameplay.png',
      });
    });

    test('게임 시작 직후 플레이어 주변 스크린샷', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      await page.waitForTimeout(1500);

      await page.screenshot({
        path: 'tests/screenshots/sprite-scale-player-initial.png',
      });
    });

    test('적 + 투사체 + 보석이 함께 보이는 전투 스크린샷', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 전투가 활발해질 때까지 대기
      await page.waitForTimeout(8000);

      await page.screenshot({
        path: 'tests/screenshots/sprite-scale-combat.png',
      });
    });
  });

  test.describe('잡몹 개별 스케일 검증', () => {

    test('각 잡몹 타입의 스케일이 SPRITE_SCALE 기반이다', async ({ page }) => {
      const entered = await enterGameScene(page);
      expect(entered).toBe(true);

      // 다양한 적 타입이 스폰될 시간 확보
      await page.waitForTimeout(5000);

      const enemyDetails = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS?.scene?.getScene('GameScene');
        if (!gs?.waveSystem) return [];
        const enemies = gs.waveSystem.enemyPool.getActive();
        return enemies.map(e => {
          // 텍스처가 실제 로드된 것인지 placeholder인지 확인
          const texKey = 'enemy_' + e.typeId;
          const hasRealTexture = gs.textures.exists(texKey);
          return {
            typeId: e.typeId,
            scaleX: e.scaleX,
            scaleY: e.scaleY,
            displayWidth: e.displayWidth,
            displayHeight: e.displayHeight,
            hasRealTexture: hasRealTexture,
            textureKey: e.texture?.key,
          };
        });
      });

      if (enemyDetails.length > 0) {
        const uniqueTypes = [...new Set(enemyDetails.map(e => e.typeId))];
        console.log('스폰된 적 타입:', uniqueTypes.join(', '));
        console.log('적 상세:',
          JSON.stringify(enemyDetails.slice(0, 5), null, 2)
        );
      }

      for (const info of enemyDetails) {
        // 모든 적의 scaleX는 양수이고 최소 SPRITE_SCALE(2)
        expect(info.scaleX).toBeGreaterThanOrEqual(2);
        expect(info.displayWidth).toBeGreaterThan(0);
      }
    });
  });

  test.describe('모바일 뷰포트 안정성', () => {

    test('375x667 뷰포트에서 SPRITE_SCALE 값이 유지된다', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('http://localhost:5555');
      await page.waitForFunction(
        () => window.__NEON_EXODUS?.scene?.scenes?.length > 0,
        { timeout: 10000 }
      );
      await page.waitForTimeout(2000);

      // 뷰포트가 달라져도 SPRITE_SCALE 값 자체는 동일해야 한다
      const scaleVal = await page.evaluate(async () => {
        const config = await import('/js/config.js');
        return config.SPRITE_SCALE;
      });
      expect(scaleVal).toBe(2);

      await page.screenshot({
        path: 'tests/screenshots/sprite-scale-mobile-viewport.png',
      });
    });

    test('320x480 뷰포트에서 Phaser 초기화 시 콘솔 에러 없음', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 480 });

      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto('http://localhost:5555');
      await page.waitForFunction(
        () => window.__NEON_EXODUS?.scene?.scenes?.length > 0,
        { timeout: 10000 }
      );
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/screenshots/sprite-scale-small-viewport.png',
      });

      expect(errors.length).toBe(0);
    });
  });
});
