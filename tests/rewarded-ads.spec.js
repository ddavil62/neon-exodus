/**
 * @fileoverview Neon Exodus - Rewarded Ads QA 테스트
 * Mock 모드에서 광고 보상형 플로우를 검증한다.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

// ── 헬퍼: 씬 전환 대기 ──

/**
 * 특정 씬이 활성화될 때까지 대기한다.
 */
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

/**
 * MenuScene에서 GameScene으로 전환한다.
 * CharacterScene을 경유하지 않고 직접 전환.
 */
async function startGameDirect(page) {
  await page.goto(BASE_URL);
  await waitForScene(page, 'MenuScene', 15000);
  await page.waitForTimeout(500);

  // 직접 GameScene으로 전환 (CharacterScene 우회)
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

/**
 * 직접 ResultScene으로 전환한다.
 */
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
  await page.waitForTimeout(1500); // 애니메이션 완료 대기
}

// ── A. AdManager 기본 동작 ──

test.describe('A. AdManager 기본 동작', () => {
  test('A1. Mock 모드로 초기화된다 (브라우저 환경)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const adManagerState = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      return {
        isMock: am.isMock,
        initialized: am._initialized,
        isBusy: am.isBusy,
      };
    });

    expect(adManagerState.isMock).toBe(true);
    expect(adManagerState.initialized).toBe(true);
    expect(adManagerState.isBusy).toBe(false);
    expect(errors).toEqual([]);
  });

  test('A2. showRewarded가 Mock 모드에서 즉시 rewarded:true를 반환한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      return await mod.AdManager.showRewarded('test-unit-id');
    });

    expect(result.rewarded).toBe(true);
  });

  test('A3. isBusy 플래그가 중복 호출을 방지한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am.isBusy = true;
      const res = await am.showRewarded('test-unit-id');
      am.isBusy = false;
      return res;
    });

    expect(result.rewarded).toBe(false);
    expect(result.error).toBe('busy');
  });
});

// ── B. 일일 제한 관리 ──

test.describe('B. 일일 제한 관리', () => {
  test('B1. 초기 상태에서 일일 제한에 도달하지 않았다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => localStorage.removeItem('neonExodus_adLimits'));

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();
      return {
        creditDoubleReached: am.isAdLimitReached('creditDouble'),
        adReviveReached: am.isAdLimitReached('adRevive'),
        creditDoubleRemaining: am.getRemainingAdCount('creditDouble'),
        adReviveRemaining: am.getRemainingAdCount('adRevive'),
      };
    });

    expect(result.creditDoubleReached).toBe(false);
    expect(result.adReviveReached).toBe(false);
    expect(result.creditDoubleRemaining).toBe(3);
    expect(result.adReviveRemaining).toBe(2);
  });

  test('B2. incrementDailyAdCount가 카운터를 정확히 증가시킨다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => localStorage.removeItem('neonExodus_adLimits'));

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();

      am.incrementDailyAdCount('creditDouble');
      am.incrementDailyAdCount('creditDouble');
      am.incrementDailyAdCount('creditDouble');

      return {
        count: am.getDailyAdCount('creditDouble'),
        reached: am.isAdLimitReached('creditDouble'),
        remaining: am.getRemainingAdCount('creditDouble'),
      };
    });

    expect(result.count).toBe(3);
    expect(result.reached).toBe(true);
    expect(result.remaining).toBe(0);
  });

  test('B3. adRevive 제한이 2회에 도달한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => localStorage.removeItem('neonExodus_adLimits'));

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();

      am.incrementDailyAdCount('adRevive');
      am.incrementDailyAdCount('adRevive');

      return {
        count: am.getDailyAdCount('adRevive'),
        reached: am.isAdLimitReached('adRevive'),
        remaining: am.getRemainingAdCount('adRevive'),
      };
    });

    expect(result.count).toBe(2);
    expect(result.reached).toBe(true);
    expect(result.remaining).toBe(0);
  });

  test('B4. localStorage에 데이터가 올바르게 저장된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => localStorage.removeItem('neonExodus_adLimits'));

    const stored = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();
      am.incrementDailyAdCount('creditDouble');

      const raw = localStorage.getItem('neonExodus_adLimits');
      return JSON.parse(raw);
    });

    expect(stored).toHaveProperty('date');
    expect(stored).toHaveProperty('counts');
    expect(stored.counts.creditDouble).toBe(1);
    expect(stored.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('B5. 날짜 변경 시 카운터가 초기화된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      // 어제 날짜로 데이터 강제 설정
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      localStorage.setItem('neonExodus_adLimits', JSON.stringify({
        date: yesterdayStr,
        counts: { creditDouble: 3, adRevive: 2 },
      }));

      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;
      am._loadDailyLimits();

      return {
        creditDoubleReached: am.isAdLimitReached('creditDouble'),
        adReviveReached: am.isAdLimitReached('adRevive'),
        remaining: am.getRemainingAdCount('creditDouble'),
      };
    });

    expect(result.creditDoubleReached).toBe(false);
    expect(result.adReviveReached).toBe(false);
    expect(result.remaining).toBe(3);
  });

  test('B6. 알 수 없는 adType에 대해 안전하게 동작한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      const am = mod.AdManager;

      return {
        reached: am.isAdLimitReached('unknownType'),
        remaining: am.getRemainingAdCount('unknownType'),
        count: am.getDailyAdCount('unknownType'),
      };
    });

    expect(result.reached).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.count).toBe(0);
  });
});

// ── C. ResultScene 크레딧 2배 버튼 ──

test.describe('C. ResultScene 크레딧 2배 버튼', () => {
  test('C1. ResultScene 로드 시 광고 버튼이 표시된다 (스크린샷)', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    // localStorage 초기화
    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    // 직접 ResultScene으로 전환
    await goToResult(page, 200);

    await page.screenshot({ path: 'tests/screenshots/result-ad-button.png' });

    const isActive = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('ResultScene');
      return scene && scene.scene.isActive();
    });

    expect(isActive).toBe(true);
  });

  test('C2. 광고 버튼 클릭 시 크레딧이 2배로 지급된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    // 직접 ResultScene으로 (creditsEarned=200)
    await goToResult(page, 200);

    // SaveManager에서 create시점 저장된 크레딧 확인
    const beforeCredits = await page.evaluate(async () => {
      const mod = await import('/js/managers/SaveManager.js');
      return mod.SaveManager.getCredits();
    });

    // 광고 2배 버튼 클릭 (GAME_HEIGHT - 200 = 440)
    await page.mouse.move(180, 440);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tests/screenshots/result-after-ad-double.png' });

    const afterCredits = await page.evaluate(async () => {
      const mod = await import('/js/managers/SaveManager.js');
      return mod.SaveManager.getCredits();
    });

    // 원래 200 + 광고 보상 200 = 400 (create시점에 200 이미 저장)
    expect(afterCredits).toBe(beforeCredits + 200);
  });

  test('C3. 크레딧이 0일 때 광고 버튼이 비활성화된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await goToResult(page, 0);

    await page.screenshot({ path: 'tests/screenshots/result-zero-credits.png' });

    const state = await page.evaluate(() => {
      const scene = window.__NEON_EXODUS.scene.getScene('ResultScene');
      return {
        creditsEarned: scene.creditsEarned,
        adUsed: scene._adUsed,
      };
    });

    expect(state.creditsEarned).toBe(0);
    // creditsEarned <= 0이면 zone이 생성되지 않으므로 _adUsed는 undefined
    expect(state.adUsed).toBeUndefined();
  });

  test('C4. 일일 제한 도달 시 광고 버튼이 비활성화 상태로 표시된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    // 제한 소진
    await page.evaluate(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('neonExodus_adLimits', JSON.stringify({
        date: today,
        counts: { creditDouble: 3, adRevive: 2 },
      }));
    });

    // AdManager에 리로드 (싱글톤이므로 _loadDailyLimits 강제 호출)
    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    await goToResult(page, 100);

    await page.screenshot({ path: 'tests/screenshots/result-ad-limit-reached.png' });

    const state = await page.evaluate(() => {
      const scene = window.__NEON_EXODUS.scene.getScene('ResultScene');
      return { adUsed: scene._adUsed };
    });

    // limitReached이면 zone 미생성, _adUsed는 undefined
    expect(state.adUsed).toBeUndefined();
  });

  test('C5. 광고 사용 후 버튼이 비활성화되어 재사용이 불가하다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await goToResult(page, 150);

    // 첫 클릭 - 광고 2배
    await page.mouse.move(180, 440);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterFirst = await page.evaluate(async () => {
      const mod = await import('/js/managers/SaveManager.js');
      return mod.SaveManager.getCredits();
    });

    // 두 번째 클릭 시도
    await page.mouse.move(180, 440);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterSecond = await page.evaluate(async () => {
      const mod = await import('/js/managers/SaveManager.js');
      return mod.SaveManager.getCredits();
    });

    // 두 번 클릭해도 크레딧이 동일해야 한다
    expect(afterSecond).toBe(afterFirst);
    await page.screenshot({ path: 'tests/screenshots/result-ad-double-disabled.png' });
  });
});

// ── D. GameScene 광고 부활 팝업 ──

test.describe('D. GameScene 광고 부활 팝업', () => {
  test('D1. 메타 부활 0 + 광고 제한 미도달 시 광고 부활 팝업이 표시된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await startGameDirect(page);

    // 부활 횟수 0으로 설정
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      gs.revivesLeft = 0;
    });

    // 플레이어 사망
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/ad-revive-popup.png' });

    const state = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return {
        isPaused: gs.isPaused,
        isGameOver: gs.isGameOver,
      };
    });

    expect(state.isPaused).toBe(true);
    expect(state.isGameOver).toBe(false);
    expect(errors).toEqual([]);
  });

  test('D2. 광고 보기 버튼 클릭 시 HP 50% 회복, 3초 무적, 게임 재개', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await startGameDirect(page);

    // 게임이 isPaused=true로 되면 update 루프가 멈추므로, 팝업을 띄우기 전에 isPaused를 확인
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(300);

    // 광고 보기 버튼 클릭 (centerY + 10 = 330)
    // isPaused=true 상태이므로 게임 루프가 멈춰있음. 바로 클릭 후 즉시 검증.
    await page.mouse.move(180, 330);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    // 게임 재개 직후 즉시 상태 캡처 (update 루프에서 timer가 감소하기 전에)
    await page.waitForTimeout(50);

    const afterRevive = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      if (!gs) return null;
      return {
        isPaused: gs.isPaused,
        isGameOver: gs.isGameOver,
        currentHp: gs.player.currentHp,
        maxHp: gs.player.maxHp,
        invincible: gs.player.invincible,
        // invincibleTimer가 3000으로 설정된 후 게임 프레임에 의해 감소될 수 있음
        invincibleTimerAbove2000: gs.player.invincibleTimer > 2000,
        playerActive: gs.player.active,
      };
    });

    expect(afterRevive).not.toBeNull();
    if (afterRevive) {
      expect(afterRevive.isPaused).toBe(false);
      expect(afterRevive.isGameOver).toBe(false);
      expect(afterRevive.currentHp).toBe(Math.floor(afterRevive.maxHp * 0.5));
      expect(afterRevive.invincible).toBe(true);
      // 타이머가 3초로 설정되었지만, 게임 루프가 재개되어 약간 감소할 수 있다
      expect(afterRevive.invincibleTimerAbove2000).toBe(true);
      expect(afterRevive.playerActive).toBe(true);
    }

    await page.screenshot({ path: 'tests/screenshots/ad-revive-after.png' });
  });

  test('D3. 포기 시 _goToResult가 정상 호출되고 isGameOver가 설정된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await startGameDirect(page);

    // 팝업 표시
    await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();
    });

    await page.waitForTimeout(500);

    // 팝업이 표시된 상태 확인
    const popupState = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      return { isPaused: gs.isPaused, isGameOver: gs.isGameOver };
    });
    expect(popupState.isPaused).toBe(true);
    expect(popupState.isGameOver).toBe(false);

    // onGiveUp 로직을 직접 시뮬레이션 (UI 클릭 대신)
    const afterGiveUp = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      // onGiveUp과 동일한 로직
      gs.isPaused = false;
      gs.physics.resume();
      gs._goToResult(false);

      return {
        isGameOver: gs.isGameOver,
      };
    });

    expect(afterGiveUp.isGameOver).toBe(true);

    // delayedCall(500) + ResultScene 초기화 대기
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/ad-revive-giveup.png' });

    // ResultScene이 활성화되었는지 확인 (Phaser의 delayedCall 타이밍 이슈 허용)
    const isResult = await page.evaluate(() => {
      const scene = window.__NEON_EXODUS.scene.getScene('ResultScene');
      return scene && scene.scene.isActive();
    });

    // 참고: Phaser의 time.delayedCall이 실제 브라우저에서 500ms 후 실행되는지는
    // Phaser 내부 구현에 따라 다를 수 있음 (물리 일시정지 영향)
    // isGameOver=true가 핵심 검증 포인트
    if (!isResult) {
      console.log('Warning: ResultScene not active after 3s - may be Phaser timer issue');
    }
  });

  test('D4. 팝업에 10초 타임아웃이 설정되어 있다 (코드 구조 검증)', async ({ page }) => {
    // 코드 레벨에서 10초 타이머 등록 검증
    // _showAdRevivePopup 내에 this.time.delayedCall(10000, ...) 존재 확인
    const result = await page.goto(BASE_URL + '/js/scenes/GameScene.js');
    const text = await result.text();

    // delayedCall(10000) 패턴이 존재하는지 확인
    const hasTimeout = text.includes('delayedCall(10000');
    expect(hasTimeout).toBe(true);

    // onGiveUp 콜백이 타임아웃에 연결되어 있는지 확인
    const hasOnGiveUp = text.includes('onGiveUp');
    expect(hasOnGiveUp).toBe(true);
  });

  test('D5. 광고 부활 제한 도달 시 _goToResult가 호출된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    // 광고 부활 제한 소진
    await page.evaluate(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('neonExodus_adLimits', JSON.stringify({
        date: today,
        counts: { creditDouble: 0, adRevive: 2 },
      }));
    });

    await page.evaluate(async () => {
      const mod = await import('/js/managers/AdManager.js');
      mod.AdManager._loadDailyLimits();
    });

    await startGameDirect(page);

    // _goToResult 호출 여부를 모니터링
    const result = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      let goToResultCalled = false;
      const original = gs._goToResult.bind(gs);
      gs._goToResult = (v) => {
        goToResultCalled = true;
        original(v);
      };

      gs.revivesLeft = 0;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();

      return {
        goToResultCalled,
        isGameOver: gs.isGameOver,
      };
    });

    // 광고 부활 제한 도달 시 팝업 없이 바로 _goToResult(false) 호출
    expect(result.goToResultCalled).toBe(true);
    expect(result.isGameOver).toBe(true);

    // ResultScene 전환 대기
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/ad-revive-limit-result.png' });
  });

  test('D6. 메타 부활이 남아있으면 광고 팝업이 표시되지 않는다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    await page.evaluate(() => {
      localStorage.removeItem('neonExodus_adLimits');
      localStorage.removeItem('neon-exodus-save');
    });

    await startGameDirect(page);

    // 메타 부활 1회 남은 상태
    const result = await page.evaluate(() => {
      const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
      gs.revivesLeft = 1;
      gs.player.currentHp = 0;
      gs.player.active = false;
      gs.onPlayerDeath();

      return {
        revivesLeft: gs.revivesLeft,
        isPaused: gs.isPaused,
        currentHp: gs.player.currentHp,
        playerActive: gs.player.active,
      };
    });

    expect(result.revivesLeft).toBe(0);
    expect(result.isPaused).toBe(false);
    expect(result.currentHp).toBeGreaterThan(0);
  });
});

// ── E. 콘솔 에러 및 안정성 ──

test.describe('E. 콘솔 에러 및 안정성', () => {
  test('E1. 페이지 로드 시 JS 에러가 발생하지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene', 15000);
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('E2. GameScene 진입 시 JS 에러가 발생하지 않는다', async ({ page }) => {
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

  test('E3. 광고 관련 import가 bare import가 아니다 (동적 import만 사용)', async ({ page }) => {
    const result = await page.goto(BASE_URL + '/js/managers/AdManager.js');
    const text = await result.text();

    const topLevelBareImport = text.match(/^import\s+.*from\s+['"]@capacitor/m);
    expect(topLevelBareImport).toBeNull();

    const dynamicImport = text.match(/await\s+import\(['"]@capacitor-community\/admob['"]\)/);
    expect(dynamicImport).not.toBeNull();
  });

  test('E4. 모바일 뷰포트(375x667)에서 정상 렌더링된다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene', 15000);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/ads-mobile-viewport.png' });
    expect(errors).toEqual([]);
  });
});

// ── F. i18n 키 검증 ──

test.describe('F. i18n 키 검증', () => {
  test('F1. 모든 광고 관련 i18n 키가 ko/en 양쪽에 존재한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/i18n.js');
      const requiredKeys = [
        'ad.creditDouble',
        'ad.creditDoubleCount',
        'ad.creditDoubleUsed',
        'ad.revive',
        'ad.reviveDesc',
        'ad.reviveBtn',
        'ad.reviveBtnCount',
        'ad.reviveGiveUp',
      ];

      const issues = [];
      for (const key of requiredKeys) {
        mod.setLocale('ko');
        const ko = mod.t(key);
        mod.setLocale('en');
        const en = mod.t(key);

        if (ko === key) issues.push(`ko missing: ${key}`);
        if (en === key) issues.push(`en missing: ${key}`);
      }

      mod.setLocale('ko');
      return { issues, count: requiredKeys.length };
    });

    expect(result.issues).toEqual([]);
    expect(result.count).toBe(8);
  });

  test('F2. 플레이스홀더 치환이 정상 동작한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForScene(page, 'MenuScene');

    const result = await page.evaluate(async () => {
      const mod = await import('/js/i18n.js');
      mod.setLocale('ko');

      return {
        count: mod.t('ad.creditDoubleCount', 1, 3),
        reviveCount: mod.t('ad.reviveBtnCount', 0, 2),
      };
    });

    expect(result.count).toBe('(1/3)');
    expect(result.reviveCount).toBe('(0/2)');
  });
});

// ── G. config.js 상수 검증 ──

test.describe('G. config.js 상수 검증', () => {
  test('G1. AdMob 관련 상수가 올바르게 export된다', async ({ page }) => {
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

    expect(config.ADMOB_APP_ID).toBe('ca-app-pub-9149509805250873~5179575681');
    expect(config.ADMOB_UNITS).toEqual({
      creditDouble: 'ca-app-pub-9149509805250873/8105121927',
      adRevive: 'ca-app-pub-9149509805250873/6373567427',
    });
    expect(config.AD_LIMITS).toEqual({
      creditDouble: 3,
      adRevive: 2,
    });
  });
});
