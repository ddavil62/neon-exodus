/**
 * @fileoverview 진화 조합표 UI 시각적 검증 테스트.
 *
 * 도감 화면에서 진화 탭 진입 및 카드 표시를 시각적으로 확인한다.
 */

import { test, expect } from '@playwright/test';

test.describe('진화 탭 시각적 검증', () => {

  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(3000);
  });

  test('도감 화면 진입 후 기본 탭(무기) 스크린샷', async ({ page }) => {
    const canvas = page.locator('canvas');
    // 도감 버튼: centerX=180, y=490
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/screenshots/evo-collection-weapons-tab.png' });
  });

  test('도감 진화 탭 클릭 후 스크린샷', async ({ page }) => {
    const canvas = page.locator('canvas');
    // 도감 버튼: centerX=180, y=490
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);

    // 진화 탭 위치 계산
    // tabW=62, TABS.length=5, gap=4
    // totalW = 5*62 + 4*4 = 326
    // startX = (360 - 326)/2 + 31 = 48
    // Tab indices: 0:48, 1:114, 2:180, 3:246, 4:312
    // 진화 탭 (index 4): x=312, y=60
    await canvas.click({ position: { x: 312, y: 60 } });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/evo-collection-evolution-tab.png' });
  });

  test('도감 진화 탭 스크롤 후 스크린샷', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);

    // 진화 탭 클릭
    await canvas.click({ position: { x: 312, y: 60 } });
    await page.waitForTimeout(1000);

    // 스크롤 다운 시뮬레이션
    await page.mouse.move(180, 400);
    await page.mouse.down();
    await page.mouse.move(180, 200, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tests/screenshots/evo-collection-evolution-scrolled.png' });
  });

  test('5개 탭 모두 순회하며 스크린샷', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);

    // 탭 X 좌표: 48, 114, 180, 246, 312
    const tabXPositions = [48, 114, 180, 246, 312];
    const tabNames = ['weapons', 'passives', 'enemies', 'achievements', 'evolutions'];

    for (let i = 0; i < tabXPositions.length; i++) {
      await canvas.click({ position: { x: tabXPositions[i], y: 60 } });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/evo-collection-tab-${tabNames[i]}.png` });
    }
  });

  test('모바일 뷰포트(375x667)에서 도감 진화 탭 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);

    // 진화 탭 클릭
    await canvas.click({ position: { x: 312, y: 60 } });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/evo-collection-mobile-viewport.png' });
  });

  test('콘솔 에러 없이 도감 진화 탭까지 동작한다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 180, y: 490 } });
    await page.waitForTimeout(1500);
    await canvas.click({ position: { x: 312, y: 60 } });
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });
});
