/**
 * @fileoverview 도전과제 보상 시각적 검증 - 다양한 보상 타입 스크린샷.
 */

import { test, expect } from '@playwright/test';

async function loadGame(page) {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

function startScene(sceneName) {
  return `
    const game = window.__NEON_EXODUS;
    if (game) {
      game.scene.getScenes(true).forEach(s => game.scene.stop(s));
      game.scene.start('${sceneName}');
    }
  `;
}

test.describe('시각적 검증 - 다양한 보상 타입', () => {
  test('AchievementScene 스크롤하여 dataCore 보상 확인', async ({ page }) => {
    await loadGame(page);
    await page.evaluate(startScene('AchievementScene'));
    await page.waitForTimeout(1500);

    // 스크롤 다운하여 machine_breaker(dataCore 보상) 카드가 보이도록
    // machine_breaker는 인덱스 5 (6번째) → CARD_H=86, CARD_GAP=6 → cardY = 70 + 5*92 + 43 = 573
    // 하지만 listHeight=490, 화면에 보이려면 스크롤 필요
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // 스크롤 다운 (드래그)
    await canvas.dispatchEvent('pointerdown', { clientX: box.x + 180, clientY: box.y + 400 });
    await page.waitForTimeout(100);
    for (let i = 0; i < 5; i++) {
      await canvas.dispatchEvent('pointermove', {
        clientX: box.x + 180,
        clientY: box.y + 400 - (i + 1) * 60,
      });
      await page.waitForTimeout(50);
    }
    await canvas.dispatchEvent('pointerup', { clientX: box.x + 180, clientY: box.y + 100 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/achievement-rewards-datacore.png',
    });
  });

  test('CollectionScene 각 탭 전환 스크린샷', async ({ page }) => {
    await loadGame(page);
    await page.evaluate(startScene('CollectionScene'));
    await page.waitForTimeout(1500);

    // 현재 weapons 탭
    await page.screenshot({ path: 'tests/screenshots/collection-tab-weapons-4tab.png' });

    const canvas = page.locator('canvas');
    // 탭 위치 계산
    const tabY = 60;
    const tabW = 62;
    const totalW = 4 * tabW + 3 * 4;
    const startX = (360 - totalW) / 2 + tabW / 2;

    // passives 탭 클릭
    await canvas.click({ position: { x: startX + 1 * (tabW + 4), y: tabY } });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/collection-tab-passives-4tab.png' });

    // enemies 탭 클릭
    await canvas.click({ position: { x: startX + 2 * (tabW + 4), y: tabY } });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/collection-tab-enemies-4tab.png' });

    // evolution 탭 클릭
    await canvas.click({ position: { x: startX + 3 * (tabW + 4), y: tabY } });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/collection-tab-evolution-4tab.png' });
  });
});
