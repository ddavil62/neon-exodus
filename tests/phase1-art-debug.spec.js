import { test, expect } from '@playwright/test';

test('Debug: check MenuScene and start game', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto('/');
  await page.waitForTimeout(3000);

  // Check if MenuScene is active
  const menuState = await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    if (!game) return { error: 'no game' };
    const scenes = game.scene.getScenes(true);
    return {
      activeScenes: scenes.map(s => s.scene.key),
      isMenuActive: game.scene.isActive('MenuScene'),
    };
  });
  console.log('Menu state:', JSON.stringify(menuState));

  await page.screenshot({ path: 'tests/screenshots/debug-02-menu.png' });

  // Try clicking on center of screen
  await page.mouse.click(180, 350);
  await page.waitForTimeout(3000);

  const afterClick = await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const scenes = game.scene.getScenes(true);
    return {
      activeScenes: scenes.map(s => s.scene.key),
      isGameActive: game.scene.isActive('GameScene'),
      isMenuActive: game.scene.isActive('MenuScene'),
    };
  });
  console.log('After click:', JSON.stringify(afterClick));

  await page.screenshot({ path: 'tests/screenshots/debug-03-afterclick.png' });
  expect(true).toBe(true);
});
