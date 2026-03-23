/**
 * @fileoverview 배경 리디자인 QA 테스트.
 * 각 스테이지별 배경 타일 + 장식 오브젝트 렌더링을 스크린샷으로 확인한다.
 */
import { test, expect } from '@playwright/test';

const GAME_READY_TIMEOUT = 20000;

/**
 * 게임 로드 완료를 기다린다.
 */
async function waitForGame(page) {
  await page.waitForFunction(() => {
    const g = window.__NEON_EXODUS;
    if (!g) return false;
    const scenes = g.scene.scenes;
    return scenes.some(s => s.constructor.name === 'MenuScene' && s.scene.isActive());
  }, { timeout: GAME_READY_TIMEOUT });
}

/**
 * 특정 스테이지로 게임을 시작한다.
 */
async function startStage(page, stageId) {
  await page.evaluate((sid) => {
    const g = window.__NEON_EXODUS;
    // SaveManager에 스테이지 해금 강제 설정
    const sm = g.scene.scenes.find(s => s.constructor.name === 'MenuScene');
    if (sm && sm.scene.isActive()) {
      // GameScene으로 직접 전환
      g.scene.start('GameScene', {
        stageId: sid,
        characterId: 'soldier',
      });
    }
  }, stageId);

  // GameScene이 활성화될 때까지 대기
  await page.waitForFunction(() => {
    const g = window.__NEON_EXODUS;
    if (!g) return false;
    return g.scene.scenes.some(s => s.constructor.name === 'GameScene' && s.scene.isActive());
  }, { timeout: 10000 });

  // 2초 대기하여 타일/데코 렌더링 완료
  await page.waitForTimeout(2000);
}

test.describe('배경 리디자인 QA', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화 (클린 상태)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForGame(page);
  });

  for (const [name, stageId] of [
    ['S1-도시외곽', 'stage_1'],
    ['S2-산업지구', 'stage_2'],
    ['S3-지하서버', 'stage_3'],
    ['S4-더코어', 'stage_4'],
  ]) {
    test(`${name} 배경+데코 렌더링`, async ({ page }) => {
      await startStage(page, stageId);

      // 스크린샷 캡처
      await page.screenshot({
        path: `tests/screenshots/bg-${stageId}.png`,
        fullPage: false,
      });

      // GameScene에서 데코 개수 확인
      const decoCount = await page.evaluate(() => {
        const g = window.__NEON_EXODUS;
        const gs = g.scene.scenes.find(s => s.constructor.name === 'GameScene');
        return gs._decos ? gs._decos.length : 0;
      });

      // 데코가 15~25개 범위인지 확인
      expect(decoCount).toBeGreaterThanOrEqual(15);
      expect(decoCount).toBeLessThanOrEqual(25);
    });
  }
});
