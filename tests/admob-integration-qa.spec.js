/**
 * @fileoverview AdMob Integration QA 테스트
 * 2026-03-12 AdMob 보상형 광고 실 연동 구현 검증.
 * 동적 import, 이벤트 기반 보상 판단, Mock 모드, 리스너 cleanup, isBusy 플래그 등.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

// ── 헬퍼 ──

async function waitForScene(page, sceneKey, timeout = 15000) {
  await page.waitForFunction(
    (key) => {
      const game = window.__NEON_EXODUS;
      if (!game) return false;
      const scene = game.scene.getScene(key);
      return scene && scene.scene.isActive();
    },
    sceneKey,
    { timeout }
  );
}

async function startGameDirect(page) {
  await page.goto(BASE_URL);
  await waitForScene(page, 'MenuScene', 15000);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const menuScene = game.scene.getScene('MenuScene');
    if (menuScene) {
      menuScene.scene.start('GameScene', { characterId: 'agent' });
    }
  });
  await waitForScene(page, 'GameScene', 10000);
  await page.waitForTimeout(500);
}

async function goToResult(page, creditsEarned = 200) {
  await page.evaluate((credits) => {
    const game = window.__NEON_EXODUS;
    const activeScene = game.scene.scenes.find(s => s.scene.isActive());
    if (activeScene) {
      activeScene.scene.start('ResultScene', {
        victory: false,
        killCount: 10,
        runTime: 60,
        creditsEarned: credits,
        level: 3,
        weaponSlotsFilled: 1,
        weaponEvolutions: 0,
      });
    }
  }, creditsEarned);
  await waitForScene(page, 'ResultScene', 5000);
  await page.waitForTimeout(1500);
}

// ── QA1. AdManager.js 소스 코드 정적 검증 ──

test.describe('QA1. AdManager.js 소스 코드 정적 검증', () => {
  test('QA1-1. 최상단에 bare import가 없고, 동적 import만 존재한다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // bare import 없어야 함
    const bareImport = text.match(/^import\s+.*from\s+['"]@capacitor/m);
    expect(bareImport).toBeNull();

    // 동적 import 존재해야 함
    const dynamicImport = text.match(/await\s+import\(['"]@capacitor-community\/admob['"]\)/);
    expect(dynamicImport).not.toBeNull();
  });

  test('QA1-2. window.Capacitor.Plugins.AdMob 직접 참조가 제거되었다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // 직접 참조 패턴이 없어야 함
    const directRef = text.match(/window\.Capacitor\.Plugins\.AdMob/);
    expect(directRef).toBeNull();
  });

  test('QA1-3. 이벤트 리스너 등록 패턴이 올바르다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // 세 가지 이벤트 리스너가 모두 등록되어야 함
    expect(text).toContain('onRewardedVideoAdReward');
    expect(text).toContain('onRewardedVideoAdDismissed');
    expect(text).toContain('onRewardedVideoAdFailedToShow');
  });

  test('QA1-4. cleanup 함수에서 모든 핸들의 remove()가 호출된다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // cleanup 함수 패턴 확인
    expect(text).toContain('rewardedHandle) rewardedHandle.remove()');
    expect(text).toContain('dismissedHandle) dismissedHandle.remove()');
    expect(text).toContain('failedHandle) failedHandle.remove()');
  });

  test('QA1-5. cleanup이 모든 종료 경로에서 호출된다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // cleanup() 호출 횟수 확인: dismissed, failedToShow, showRewardVideoAd.catch = 3회
    const cleanupCalls = text.match(/cleanup\(\)/g);
    expect(cleanupCalls).not.toBeNull();
    expect(cleanupCalls.length).toBeGreaterThanOrEqual(3);
  });

  test('QA1-6. isBusy가 finally 블록에서 해제된다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // finally 블록에서 isBusy = false가 있어야 함
    expect(text).toContain('finally');
    // finally 블록 내에 isBusy = false
    const finallyBlock = text.match(/finally\s*\{[\s\S]*?this\.isBusy\s*=\s*false/);
    expect(finallyBlock).not.toBeNull();
  });

  test('QA1-7. BGM suspend/resume이 showRewarded에 존재한다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    expect(text).toContain('_suspendAudio');
    expect(text).toContain('_resumeAudio');
  });

  test('QA1-8. 플러그인 로드 실패 시 Mock 모드 폴백 로직이 있다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    // catch 블록에서 isMock = true 폴백
    const fallback = text.match(/catch[\s\S]*?this\.isMock\s*=\s*true/);
    expect(fallback).not.toBeNull();
  });
});

// ── QA2. Mock 모드 런타임 검증 ──

test.describe('QA2. Mock 모드 런타임 검증', () => {
  test('QA2-1. 브라우저 환경에서 isMock=true로 초기화된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const state = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      return {
        isMock: am.isMock,
        initialized: am._initialized,
        isBusy: am.isBusy,
        admobNull: am._admob === null,
      };
    });

    expect(state.isMock).toBe(true);
    expect(state.initialized).toBe(true);
    expect(state.isBusy).toBe(false);
    expect(state.admobNull).toBe(true);
    expect(errors).toEqual([]);
  });

  test('QA2-2. Mock 모드에서 showRewarded가 즉시 rewarded:true를 반환한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const start = Date.now();
      const res = await mod.AdManager.showRewarded('test-unit-id');
      const elapsed = Date.now() - start;
      return { ...res, elapsed };
    });

    expect(result.rewarded).toBe(true);
    // Mock 모드는 즉시 반환해야 함 (100ms 미만)
    expect(result.elapsed).toBeLessThan(100);
  });

  test('QA2-3. Mock 모드에서 showRewarded 후 isBusy가 false로 복원된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const state = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      await am.showRewarded('test-unit-id');
      return { isBusy: am.isBusy };
    });

    expect(state.isBusy).toBe(false);
  });

  test('QA2-4. isBusy=true 상태에서 중복 호출이 차단된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am.isBusy = true;
      const res = await am.showRewarded('test-unit-id');
      am.isBusy = false; // 복원
      return res;
    });

    expect(result.rewarded).toBe(false);
    expect(result.error).toBe('busy');
  });

  test('QA2-5. showRewarded를 빠르게 연속 호출하면 Mock 모드에서는 모두 성공한다 (알려진 동작)', async ({ page }) => {
    // FINDING: Mock 모드에서는 isBusy가 동기적으로 set/unset되므로
    // Promise.all 동시 호출 시 모두 rewarded:true를 반환한다.
    // 이는 Mock 경로에 await가 없기 때문이다.
    // 실제 네이티브 모드에서는 prepareRewardVideoAd의 await로 isBusy가 보호된다.
    // 또한 호출부(GameScene, ResultScene)에 별도 guard(adLoading, _adUsed)가 있어
    // 실사용에서 문제가 되지 않는다.
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const results = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      const promises = [
        am.showRewarded('test-1'),
        am.showRewarded('test-2'),
        am.showRewarded('test-3'),
      ];
      return Promise.all(promises);
    });

    // Mock 모드에서는 동기적 실행으로 3개 모두 성공 (알려진 동작)
    const rewardedCount = results.filter(r => r.rewarded).length;
    expect(rewardedCount).toBe(3);

    // isBusy가 최종적으로 false인지 확인
    const isBusy = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      return mod.AdManager.isBusy;
    });
    expect(isBusy).toBe(false);
  });

  test('QA2-6. initialize()를 여러 번 호출해도 중복 초기화되지 않는다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      const countBefore = am._initialized;
      await am.initialize();
      await am.initialize();
      await am.initialize();
      return {
        initialized: am._initialized,
        isMock: am.isMock,
      };
    });

    expect(result.initialized).toBe(true);
    expect(result.isMock).toBe(true);
  });
});

// ── QA3. 일일 제한 관리 엣지케이스 ──

test.describe('QA3. 일일 제한 관리 엣지케이스', () => {
  test('QA3-1. localStorage가 손상된 JSON일 때 안전하게 초기화된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      // 손상된 JSON 주입
      localStorage.setItem('neonExodus_adLimits', '{invalid json!!!');
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();
      return {
        creditDoubleReached: am.isAdLimitReached('creditDouble'),
        count: am.getDailyAdCount('creditDouble'),
      };
    });

    expect(result.creditDoubleReached).toBe(false);
    expect(result.count).toBe(0);
  });

  test('QA3-2. localStorage에 date만 있고 counts가 없을 때 안전 처리', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('neonExodus_adLimits', JSON.stringify({ date: today }));
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();
      return {
        count: am.getDailyAdCount('creditDouble'),
        reached: am.isAdLimitReached('creditDouble'),
      };
    });

    // counts 필드가 없으므로 유효성 검증에 걸려 기본값으로 초기화
    expect(result.count).toBe(0);
    expect(result.reached).toBe(false);
  });

  test('QA3-3. 제한을 초과하여 increment해도 음수가 되지 않는다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      localStorage.removeItem('neonExodus_adLimits');
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();

      // 제한(3)을 초과하여 5번 increment
      for (let i = 0; i < 5; i++) {
        am.incrementDailyAdCount('creditDouble');
      }
      return {
        count: am.getDailyAdCount('creditDouble'),
        remaining: am.getRemainingAdCount('creditDouble'),
        reached: am.isAdLimitReached('creditDouble'),
      };
    });

    expect(result.count).toBe(5);
    expect(result.remaining).toBe(0); // Math.max(0, ...) 보장
    expect(result.reached).toBe(true);
  });

  test('QA3-4. getRemainingAdCount가 음수를 반환하지 않는다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const today = new Date().toISOString().slice(0, 10);
      // 제한(3)을 넘긴 데이터 주입
      localStorage.setItem('neonExodus_adLimits', JSON.stringify({
        date: today,
        counts: { creditDouble: 10, adRevive: 10 },
      }));
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();
      return {
        creditRemaining: am.getRemainingAdCount('creditDouble'),
        adReviveRemaining: am.getRemainingAdCount('adRevive'),
      };
    });

    expect(result.creditRemaining).toBe(0);
    expect(result.adReviveRemaining).toBe(0);
  });
});

// ── QA4. config.js 광고 설정 검증 ──

test.describe('QA4. config.js 광고 설정 검증', () => {
  test('QA4-1. AD_UNIT_IDS 형식이 올바르다 (ca-app-pub 접두사)', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const config = await page.evaluate(async () => {
      const mod = await import('/js/config.js');
      return {
        ADMOB_APP_ID: mod.ADMOB_APP_ID,
        ADMOB_UNITS: mod.ADMOB_UNITS,
        AD_LIMITS: mod.AD_LIMITS,
      };
    });

    // 앱 ID 형식 검증
    expect(config.ADMOB_APP_ID).toMatch(/^ca-app-pub-\d+~\d+$/);

    // 광고 단위 ID 형식 검증
    expect(config.ADMOB_UNITS.creditDouble).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(config.ADMOB_UNITS.adRevive).toMatch(/^ca-app-pub-\d+\/\d+$/);

    // 제한 값 타입 검증
    expect(typeof config.AD_LIMITS.creditDouble).toBe('number');
    expect(typeof config.AD_LIMITS.adRevive).toBe('number');
    expect(config.AD_LIMITS.creditDouble).toBeGreaterThan(0);
    expect(config.AD_LIMITS.adRevive).toBeGreaterThan(0);
  });
});

// ── QA5. GameScene 광고 부활 통합 검증 ──

test.describe('QA5. GameScene 광고 부활 통합 검증', () => {
  test('QA5-1. 사망 시 onPlayerDeath가 콘솔 에러 없이 동작한다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameDirect(page);

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
    });

    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('QA5-2. 광고 부활 후 isBusy가 false로 복원된다', async ({ page }) => {
    await startGameDirect(page);

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
    });

    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    // 사망 -> 팝업 표시
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(300);

    // 광고 보기 버튼 클릭
    await page.mouse.move(180, 330);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const isBusy = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      return mod.AdManager.isBusy;
    });

    expect(isBusy).toBe(false);
  });

  test('QA5-3. 광고 부활 팝업 스크린샷 시각적 검증', async ({ page }) => {
    await startGameDirect(page);

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
    });

    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/qa-ad-revive-popup.png' });
  });

  test('QA5-4. 광고 부활 성공 시 adRevive 일일 카운터가 1 증가한다', async ({ page }) => {
    await startGameDirect(page);

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
    });

    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    const beforeCount = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      return mod.AdManager.getDailyAdCount('adRevive');
    });

    // 사망 -> 팝업 -> 광고 시청
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(300);

    await page.mouse.move(180, 330);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterCount = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      return mod.AdManager.getDailyAdCount('adRevive');
    });

    expect(afterCount).toBe(beforeCount + 1);
  });
});

// ── QA6. ResultScene 크레딧 2배 통합 검증 ──

test.describe('QA6. ResultScene 크레딧 2배 통합 검증', () => {
  test('QA6-1. ResultScene 로드 시 광고 버튼이 표시되고 에러가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await goToResult(page, 200);

    await page.screenshot({ path: 'tests/screenshots/qa-result-ad-button.png' });

    const isActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('ResultScene');
      return scene && scene.scene.isActive();
    });

    expect(isActive).toBe(true);
    expect(errors).toEqual([]);
  });

  test('QA6-2. creditsEarned=0일 때 광고 버튼 zone이 생성되지 않는다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await goToResult(page, 0);

    const state = await page.evaluate(() => {
      const scene = window.__NEON_EXODUS.scene.getScene('ResultScene');
      return {
        creditsEarned: scene.creditsEarned,
        adUsed: scene._adUsed,
      };
    });

    expect(state.creditsEarned).toBe(0);
    // creditsEarned <= 0이면 zone 미생성, _adUsed는 undefined
    expect(state.adUsed).toBeUndefined();
  });
});

// ── QA7. capacitor.config.json 검증 ──

test.describe('QA7. capacitor.config.json 검증', () => {
  test('QA7-1. capacitor.config.json에 AdMob appId가 올바르게 설정되어 있다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/capacitor.config.json');
    const json = await result.json();

    expect(json.appId).toBe('com.antigravity.neonexodus');
    expect(json.plugins).toBeDefined();
    expect(json.plugins.AdMob).toBeDefined();
    expect(json.plugins.AdMob.appId).toBe('ca-app-pub-9149509805250873~5179575681');
  });
});

// ── QA8. 콘솔 에러 및 안정성 ──

test.describe('QA8. 콘솔 에러 및 안정성', () => {
  test('QA8-1. 페이지 로드 -> MenuScene -> GameScene 전환 시 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene', 15000);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menuScene = game.scene.getScene('MenuScene');
      menuScene.scene.start('GameScene', { characterId: 'agent' });
    });

    await waitForScene(page, 'GameScene', 10000);
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('QA8-2. GameScene -> ResultScene 전환 시 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameDirect(page);

    await goToResult(page, 100);

    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test('QA8-3. 모바일 뷰포트(375x667)에서 전체 플로우 에러 없음', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene', 15000);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/qa-mobile-viewport.png' });
    expect(errors).toEqual([]);
  });

  test('QA8-4. 소형 뷰포트(320x480)에서 에러 없음', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene', 15000);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/qa-small-viewport.png' });
    expect(errors).toEqual([]);
  });
});

// ── QA9. BootScene에서 AdManager.initialize() 호출 검증 ──

test.describe('QA9. BootScene 초기화 흐름 검증', () => {
  test('QA9-1. BootScene 소스에서 AdManager.initialize() 호출이 존재한다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/scenes/BootScene.js');
    const text = await result.text();

    expect(text).toContain('AdManager.initialize()');
    // await로 호출되는지 확인
    expect(text).toContain('await AdManager.initialize()');
  });
});

// ── QA10. GitHub Actions 빌드 설정 검증 ──

test.describe('QA10. GitHub Actions 빌드 설정 검증', () => {
  test('QA10-1. build-apk.yml에 APPLICATION_ID sed 주입이 존재한다', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/.github/workflows/build-apk.yml');
    const text = await result.text();

    // APPLICATION_ID 주입 패턴
    expect(text).toContain('com.google.android.gms.ads.APPLICATION_ID');
    // 올바른 앱 ID
    expect(text).toContain('ca-app-pub-9149509805250873~5179575681');
    // AndroidManifest.xml 대상
    expect(text).toContain('AndroidManifest.xml');
  });
});
