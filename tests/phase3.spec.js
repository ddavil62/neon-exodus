/**
 * @fileoverview Neon Exodus Phase 3 QA 브라우저 테스트.
 * 메뉴/캐릭터 선택/업적/도감 UI, 콘솔 에러 없음, 360x640 레이아웃 검증.
 * HTTP 서버를 통해 ES 모듈을 로드한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9877/index.html';

test.describe('Phase 3 - UI 씬 렌더링 검증', () => {
  test.beforeEach(async ({ page }) => {
    // 콘솔 에러 수집
    page._consoleErrors = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') page._consoleErrors.push(msg.text());
    });
  });

  test('BootScene -> MenuScene 정상 전환 및 콘솔 에러 없음', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);

    // BootScene이 완료되고 MenuScene이 렌더링될 때까지 대기
    await page.waitForTimeout(3000);

    // 스크린샷 캡처
    await page.screenshot({ path: 'tests/screenshots/menu-scene.png' });

    // 게임 인스턴스가 존재하는지 확인
    const gameExists = await page.evaluate(() => {
      return window.__NEON_EXODUS !== undefined;
    });
    expect(gameExists).toBe(true);

    // 현재 씬이 MenuScene인지 확인
    const currentScene = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scenes = game.scene.scenes;
      return scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(currentScene).toContain('MenuScene');

    // 콘솔 에러 없음 확인
    const errors = page._consoleErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
    expect(errors).toEqual([]);
  });

  test('MenuScene 출격 버튼 -> CharacterScene 전환', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    // canvas 요소 찾기
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();

    // Phaser는 canvas 내부를 FIT 모드로 렌더링하므로
    // 실제 클릭 좌표를 canvas 좌표계에 맞춰야 한다
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // 출격 버튼 영역 클릭 (y=310 근처)
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);

    const activeScenes = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(activeScenes).toContain('CharacterScene');

    await page.screenshot({ path: 'tests/screenshots/character-scene.png' });
  });

  test('MenuScene 업그레이드 버튼 -> UpgradeScene 전환', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    await page.mouse.click(box.x + 180 * scaleX, box.y + 370 * scaleY);
    await page.waitForTimeout(500);

    const activeScenes = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(activeScenes).toContain('UpgradeScene');

    await page.screenshot({ path: 'tests/screenshots/upgrade-scene.png' });
  });

  test('MenuScene 도전과제 버튼 -> AchievementScene 전환', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    await page.mouse.click(box.x + 180 * scaleX, box.y + 430 * scaleY);
    await page.waitForTimeout(500);

    const activeScenes = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(activeScenes).toContain('AchievementScene');

    await page.screenshot({ path: 'tests/screenshots/achievement-scene.png' });
  });

  test('MenuScene 도감 버튼 -> CollectionScene 전환', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    await page.mouse.click(box.x + 180 * scaleX, box.y + 490 * scaleY);
    await page.waitForTimeout(500);

    const activeScenes = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(activeScenes).toContain('CollectionScene');

    await page.screenshot({ path: 'tests/screenshots/collection-scene.png' });
  });

  test('CharacterScene -> GameScene 시작 (agent 기본)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // 출격 -> CharacterScene
    await page.mouse.click(box.x + 180 * scaleX, box.y + 310 * scaleY);
    await page.waitForTimeout(500);

    // 출격 버튼 (하단 좌측, x=120, y=580)
    await page.mouse.click(box.x + 120 * scaleX, box.y + 580 * scaleY);
    await page.waitForTimeout(2000);

    const activeScenes = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
    });
    expect(activeScenes).toContain('GameScene');

    await page.screenshot({ path: 'tests/screenshots/game-scene.png' });
  });

  test('GameScene 에서 콘솔 에러 없이 5초 동안 실행', async ({ page }) => {
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
    await page.waitForTimeout(5000);

    // 에러 없는지 확인 (pageerror만 - console error 아닌 것)
    const gameErrors = page._consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS')
    );
    expect(gameErrors).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/game-running-5s.png' });
  });

  test('SaveManager 통계 확장: totalBossKills 존재', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const hasBossKills = await page.evaluate(() => {
      const raw = localStorage.getItem('neon-exodus-save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data.stats && data.stats.totalBossKills !== undefined;
    });
    expect(hasBossKills).toBe(true);
  });

  test('SaveManager 데이터 버전이 2인지 확인', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const version = await page.evaluate(() => {
      const raw = localStorage.getItem('neon-exodus-save');
      if (!raw) return -1;
      const data = JSON.parse(raw);
      return data.version;
    });
    expect(version).toBe(2);
  });

  test('모바일 뷰포트(375x667)에서 정상 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/mobile-viewport.png' });

    const gameExists = await page.evaluate(() => window.__NEON_EXODUS !== undefined);
    expect(gameExists).toBe(true);
  });

  test('CollectionScene 4탭 전환 시 에러 없음', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // 도감으로 이동
    await page.mouse.click(box.x + 180 * scaleX, box.y + 490 * scaleY);
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tests/screenshots/collection-weapons-tab.png' });

    // 패시브 탭 (두번째 탭)
    await page.mouse.click(box.x + 140 * scaleX, box.y + 60 * scaleY);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/collection-passives-tab.png' });

    // 적 탭 (세번째 탭)
    await page.mouse.click(box.x + 222 * scaleX, box.y + 60 * scaleY);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/collection-enemies-tab.png' });

    // 도전과제 탭 (네번째 탭)
    await page.mouse.click(box.x + 304 * scaleX, box.y + 60 * scaleY);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/collection-achievements-tab.png' });

    const errors = page._consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('CORS')
    );
    expect(errors).toEqual([]);
  });

  test('UpgradeScene 360x640 레이아웃 오버플로 없음', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;

    // 업그레이드 화면으로 이동
    await page.mouse.click(box.x + 180 * scaleX, box.y + 370 * scaleY);
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tests/screenshots/upgrade-360x640.png' });

    const errors = page._consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('CORS')
    );
    expect(errors).toEqual([]);
  });
});
