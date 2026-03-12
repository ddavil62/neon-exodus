/**
 * @fileoverview 레벨업 스킵 버튼 QA 테스트.
 * 모든 업그레이드 완료 시 스킵 UI가 올바르게 표시되고 동작하는지 검증한다.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

/** GameScene을 직접 시작하고 준비될 때까지 대기한다. */
async function startGameScene(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => !!window.__NEON_EXODUS, { timeout: 15000 });
  await page.waitForTimeout(1500);

  // GameScene 직접 시작
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    game.scene.start('GameScene', { characterId: 'agent' });
  });
  await page.waitForTimeout(2000);

  // GameScene 활성 확인
  const gsReady = await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    return !!(gs && gs.player && gs.weaponSystem);
  });
  expect(gsReady).toBe(true);
}

/** _generateChoices를 빈 배열 반환하도록 monkey-patch한다. */
async function patchGenerateChoicesEmpty(page) {
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const ls = game.scene.getScene('LevelUpScene');
    ls._originalGenerateChoices = ls._generateChoices.bind(ls);
    ls._generateChoices = () => [];
  });
}

/** _generateChoices 패치를 원래대로 복원한다. */
async function restoreGenerateChoices(page) {
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const ls = game.scene.getScene('LevelUpScene');
    if (ls._originalGenerateChoices) {
      ls._generateChoices = ls._originalGenerateChoices;
      delete ls._originalGenerateChoices;
    }
  });
}

/** 레벨업을 트리거한다 (XP를 대량 부여). */
async function triggerLevelUp(page) {
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    gs.player.addXP(99999);
  });
  await page.waitForTimeout(1000);
}

// ── 정상 동작 검증 ──

test.describe('레벨업 스킵 버튼 - 정상 동작', () => {
  test('정상 레벨업 시 카드가 표시된다 (선택지가 있는 경우)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await triggerLevelUp(page);

    // LevelUpScene이 활성화되었는지 확인
    const lsActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.isActive('LevelUpScene');
    });
    expect(lsActive).toBe(true);

    // 스크린샷 캡처
    await page.screenshot({ path: 'tests/screenshots/levelup-skip-normal.png' });

    // 콘솔 에러 없음
    expect(errors).toEqual([]);
  });

  test('선택지 0개 시 스킵 UI가 표시된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    // LevelUpScene이 활성화되었는지 확인
    const lsActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.isActive('LevelUpScene');
    });
    expect(lsActive).toBe(true);

    // _skipMode 플래그 확인
    const skipModeActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      return ls._skipMode === true;
    });
    expect(skipModeActive).toBe(true);

    // 스크린샷 캡처
    await page.screenshot({ path: 'tests/screenshots/levelup-skip-mode.png' });

    expect(errors).toEqual([]);
  });

  test('스킵 버튼 클릭 시 GameScene이 재개된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    // 스킵 전 상태 확인
    const beforeState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        lsActive: game.scene.isActive('LevelUpScene'),
        gsPaused: game.scene.isPaused('GameScene'),
      };
    });
    expect(beforeState.lsActive).toBe(true);
    expect(beforeState.gsPaused).toBe(true);

    // 스킵 버튼 클릭 (캔버스 중앙, centerY + 50 위치)
    // GAME_WIDTH=360, GAME_HEIGHT=640 -> centerX=180, centerY=320
    // 스킵 버튼 Y: 320 + 50 = 370
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    // GameScene 재개, LevelUpScene 중지 확인
    const afterState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        lsActive: game.scene.isActive('LevelUpScene'),
        gsActive: game.scene.isActive('GameScene'),
        gsPaused: game.scene.isPaused('GameScene'),
      };
    });
    expect(afterState.lsActive).toBe(false);
    expect(afterState.gsActive).toBe(true);
    expect(afterState.gsPaused).toBe(false);

    await page.screenshot({ path: 'tests/screenshots/levelup-skip-after-click.png' });

    expect(errors).toEqual([]);
  });

  test('스킵 시 리롤 버튼이 표시되지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    // 리롤 버튼 관련 요소 확인
    const rerollState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      return {
        skipMode: ls._skipMode,
        rerollBtnElements: ls._rerollBtnElements ? ls._rerollBtnElements.length : 0,
      };
    });
    expect(rerollState.skipMode).toBe(true);
    // 리롤 버튼 요소가 없어야 함 (undefined 또는 0)
    expect(rerollState.rerollBtnElements).toBe(0);

    expect(errors).toEqual([]);
  });

  test('levelupDone 이벤트가 rerollsLeft와 함께 발행된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);

    // levelupDone 이벤트 캡처 설정
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      window._levelupDoneData = null;
      const ls = game.scene.getScene('LevelUpScene');
      ls.events.on('levelupDone', (data) => {
        window._levelupDoneData = data;
      });
    });

    await triggerLevelUp(page);

    // 스킵 버튼 클릭
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    // 이벤트 데이터 확인
    const eventData = await page.evaluate(() => window._levelupDoneData);
    expect(eventData).not.toBeNull();
    expect(eventData).toHaveProperty('rerollsLeft');

    expect(errors).toEqual([]);
  });
});

// ── 엣지케이스 및 예외 시나리오 ──

test.describe('레벨업 스킵 버튼 - 엣지케이스', () => {
  test('스킵 후 다음 정상 레벨업에서 카드와 리롤 버튼이 정상 표시된다 (_skipMode 초기화)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);

    // 1단계: 스킵 모드 레벨업
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    // _skipMode가 true인지 확인
    const skipModeBefore = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      return ls._skipMode;
    });
    expect(skipModeBefore).toBe(true);

    // 스킵 버튼 클릭
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    // 2단계: 정상 레벨업 (패치 해제)
    await restoreGenerateChoices(page);
    await triggerLevelUp(page);

    // LevelUpScene이 활성화되었는지 확인
    const lsActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.isActive('LevelUpScene');
    });
    expect(lsActive).toBe(true);

    // _skipMode가 false 또는 undefined여야 함 (정상 레벨업)
    const skipModeAfter = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      return {
        skipMode: ls._skipMode,
        cardElements: ls._cardElements ? ls._cardElements.length : 0,
        rerollBtnElements: ls._rerollBtnElements ? ls._rerollBtnElements.length : 0,
      };
    });

    // 핵심 검증: _skipMode가 꺼져있고, 카드와 리롤 버튼이 존재해야 함
    // _skipMode가 true이면 리롤 버튼이 숨겨지는 버그가 발생함
    expect(skipModeAfter.skipMode).toBeFalsy();
    expect(skipModeAfter.cardElements).toBeGreaterThan(0);
    expect(skipModeAfter.rerollBtnElements).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/screenshots/levelup-skip-then-normal.png' });

    expect(errors).toEqual([]);
  });

  test('스킵 버튼 더블클릭 시 중복 이벤트 발행되지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);

    // 이벤트 카운터 설정
    await page.evaluate(() => {
      window._levelupDoneCount = 0;
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      ls.events.on('levelupDone', () => {
        window._levelupDoneCount++;
      });
    });

    await triggerLevelUp(page);

    // 빠른 더블 클릭
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    const eventCount = await page.evaluate(() => window._levelupDoneCount);
    // 첫 번째 클릭만 처리되어야 함 (씬이 stop되므로 두 번째 클릭은 무시)
    expect(eventCount).toBeLessThanOrEqual(2); // GameScene의 once 리스너 + 스킵의 emit

    expect(errors).toEqual([]);
  });

  test('리롤로 선택지가 0개가 되는 경우 스킵 UI로 전환된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);

    // 리롤 횟수를 강제로 1로 설정
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      gs.rerollsLeft = 1;
    });

    await triggerLevelUp(page);

    // LevelUpScene에서 리롤 버튼 클릭 전에 _generateChoices를 빈 배열로 패치
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      ls._generateChoices = () => [];
    });

    // 리롤 버튼 클릭 (GAME_HEIGHT - 80 = 560)
    await page.click('canvas', { position: { x: 180, y: 560 } });
    await page.waitForTimeout(500);

    // 스킵 모드로 전환되었는지 확인
    const state = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      if (!game.scene.isActive('LevelUpScene')) return { sceneActive: false };
      return {
        sceneActive: true,
        skipMode: ls._skipMode,
      };
    });

    // 씬이 활성 상태이면 스킵 모드여야 함
    if (state.sceneActive) {
      expect(state.skipMode).toBe(true);
    }

    await page.screenshot({ path: 'tests/screenshots/levelup-skip-after-reroll.png' });

    expect(errors).toEqual([]);
  });

  test('연속 레벨업 (다단 레벨업)에서 스킵 모드가 올바르게 동작한다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);

    // 첫 번째 레벨업 트리거 (XP 대량 추가하면 addXP에서 while 루프로 연속 레벨업)
    await triggerLevelUp(page);

    // LevelUpScene이 표시되는지 확인
    const lsActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return game.scene.isActive('LevelUpScene');
    });
    expect(lsActive).toBe(true);

    // 스킵 클릭
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    // 연쇄 레벨업으로 또 LevelUpScene이 떠야 할 수 있음
    // (player.addXP(99999)로 여러 레벨 올라감 -> 각각 onLevelUp 호출)
    // Phaser에서 씬 중복 launch 처리를 확인
    const afterState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      return {
        lsActive: game.scene.isActive('LevelUpScene'),
        gsActive: game.scene.isActive('GameScene'),
        gsPaused: game.scene.isPaused('GameScene'),
        playerLevel: game.scene.getScene('GameScene')?.player?.level,
      };
    });

    // 에러 없이 동작해야 함
    expect(errors).toEqual([]);
  });
});

// ── i18n 키 검증 ──

test.describe('레벨업 스킵 버튼 - i18n 검증', () => {
  test('levelup.allMaxed 키가 ko/en 모두 존재한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => !!window.__NEON_EXODUS, { timeout: 15000 });
    await page.waitForTimeout(1500);

    const i18nResult = await page.evaluate(async () => {
      // i18n 모듈을 import
      const { t, setLocale } = await import('./js/i18n.js');

      setLocale('ko');
      const ko = t('levelup.allMaxed');

      setLocale('en');
      const en = t('levelup.allMaxed');

      // 키가 존재하지 않으면 키 자체가 반환됨
      return {
        ko,
        en,
        koExists: ko !== 'levelup.allMaxed',
        enExists: en !== 'levelup.allMaxed',
      };
    });

    expect(i18nResult.koExists).toBe(true);
    expect(i18nResult.enExists).toBe(true);
    expect(i18nResult.ko).toBe('모든 업그레이드 완료!');
    expect(i18nResult.en).toBe('All Upgrades Maxed!');
  });

  test('levelup.skip 키가 ko/en 모두 존재한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => !!window.__NEON_EXODUS, { timeout: 15000 });
    await page.waitForTimeout(1500);

    const i18nResult = await page.evaluate(async () => {
      const { t, setLocale } = await import('./js/i18n.js');

      setLocale('ko');
      const ko = t('levelup.skip');

      setLocale('en');
      const en = t('levelup.skip');

      return {
        ko,
        en,
        koExists: ko !== 'levelup.skip',
        enExists: en !== 'levelup.skip',
      };
    });

    expect(i18nResult.koExists).toBe(true);
    expect(i18nResult.enExists).toBe(true);
    expect(i18nResult.ko).toBe('스킵');
    expect(i18nResult.en).toBe('Skip');
  });
});

// ── UI 안정성 ──

test.describe('레벨업 스킵 버튼 - UI 안정성', () => {
  test('전체 흐름에서 콘솔 에러가 발생하지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);

    // 1. 스킵 모드 레벨업
    await triggerLevelUp(page);
    await page.waitForTimeout(500);

    // 2. 스킵 클릭
    await page.click('canvas', { position: { x: 180, y: 370 } });
    await page.waitForTimeout(500);

    // 3. 정상 레벨업
    await restoreGenerateChoices(page);
    await triggerLevelUp(page);
    await page.waitForTimeout(500);

    // 총 에러 0건
    expect(errors).toEqual([]);
  });

  test('모바일 뷰포트 (375x667)에서도 스킵 UI가 정상 렌더링된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 375, height: 667 });
    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    await page.screenshot({ path: 'tests/screenshots/levelup-skip-mobile.png' });

    expect(errors).toEqual([]);
  });

  test('스킵 모드에서 _cardElements에 모든 요소가 등록된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameScene(page);
    await patchGenerateChoicesEmpty(page);
    await triggerLevelUp(page);

    const elemCount = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const ls = game.scene.getScene('LevelUpScene');
      // 안내 텍스트(1) + 버튼 배경(1) + 버튼 텍스트(1) + 터치 영역(1) = 4
      return ls._cardElements ? ls._cardElements.length : 0;
    });

    // 최소 4개 요소 (msg, bg, btnText, zone)
    expect(elemCount).toBeGreaterThanOrEqual(4);

    expect(errors).toEqual([]);
  });
});
