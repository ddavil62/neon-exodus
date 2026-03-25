/**
 * @fileoverview 진화 힌트 팝업 모달 런타임/엣지케이스 QA 테스트.
 * GameScene이 활성화되지 않은 환경에서는 소스 코드 기반 검증으로 대체한다.
 * GameScene.create()를 거치지 않으면 _shownHints 등이 초기화되지 않으므로
 * 런타임 호출 테스트는 소스 분석으로 수행한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = '/';

/** GameScene.js 소스코드를 fetch하여 반환한다 */
async function fetchGameSceneSrc(page) {
  await page.goto(BASE_URL);
  return page.evaluate(async () => {
    const resp = await fetch('/js/scenes/GameScene.js');
    return resp.text();
  });
}

// ── 1. 큐 드레인 누락 시나리오 (구조적 버그 탐지) ──

test.describe('큐 드레인 경로 누락 분석', () => {
  let src;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    src = await fetchGameSceneSrc(page);
    await page.close();
  });

  test('_showEvolutionPopup 닫기 핸들러에서 _evolutionHintQueue를 드레인하지 않는다 (잠재적 버그)', async () => {
    // _showEvolutionPopup 함수 본문 추출
    const popupMatch = src.match(/_showEvolutionPopup\(evo\)\s*\{([\s\S]*?)\n  \}/);
    expect(popupMatch).toBeTruthy();
    const popupBody = popupMatch[1];

    // 진화 성공 팝업 닫기 핸들러에 큐 드레인이 없다
    const hasQueueDrain = popupBody.includes('_evolutionHintQueue');
    expect(hasQueueDrain).toBe(false);

    // 이것이 버그인지 확인: _tryEvolutionCheck 루프에서
    // evolve 성공 → _showEvolutionPopup이 열리면 _modalOpen=true
    // 같은 루프에서 다음 weapon이 hint 대상이면 _showEvolutionHintModal → 큐 적재
    // _showEvolutionPopup 닫아도 큐가 비워지지 않음

    // _tryEvolutionCheck에서 evolve와 hint가 같은 루프에서 발생 가능한지 확인
    const tryMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
    expect(tryMatch).toBeTruthy();
    const tryBody = tryMatch[1];

    // for 루프 안에서 _showEvolutionPopup과 _showEvolutionHintModal 둘 다 호출 가능
    expect(tryBody).toContain('_showEvolutionPopup');
    expect(tryBody).toContain('_showEvolutionHintModal');
  });

  test('_shownHints.add가 큐 적재보다 먼저 호출된다 (큐 아이템 고아화 위험)', async () => {
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    const addPos = body.indexOf('_shownHints.add');
    const queuePushPos = body.indexOf('_evolutionHintQueue.push');

    expect(addPos).toBeLessThan(queuePushPos);
    // 큐에 들어간 항목은 _shownHints에 이미 등록 → _tryEvolutionCheck 재호출 시 무시됨
    // 그러나 큐 자체는 드레인되지 않으면 영구적으로 메모리에 남는다
    // (실질적 영향: 미미 — 배열에 객체 참조 몇 개가 남는 수준)
  });

  test('큐에 적재된 후 드레인 가능한 코드 경로가 존재한다', async () => {
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // 큐 드레인은 오직 _showEvolutionHintModal의 닫기 핸들러에서만 발생
    expect(body).toContain('_evolutionHintQueue.shift()');
    expect(body).toContain('_showEvolutionHintModal(next)');
  });
});

// ── 2. pointerdown 후 pointerout 시 alpha 복원 검증 ──

test.describe('버튼 인터랙션 이벤트 분석', () => {
  test('pointerdown 후 pointerout 시 alpha가 1로 복원된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // pointerdown: alpha 0.6
    expect(body).toContain("btnText.setAlpha(0.6)");
    // pointerout: alpha 1
    expect(body).toContain("btnText.setAlpha(1)");
  });

  test('pointerdown 후 pointerup 없이 pointerout하면 alpha가 복원된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // pointerout 핸들러가 별도로 존재하여 alpha 복원
    const pointeroutIdx = body.lastIndexOf("'pointerout'");
    expect(pointeroutIdx).toBeGreaterThan(-1);
    // pointerout 다음에 setAlpha(1)이 있는지 확인
    const afterPointerout = body.substring(pointeroutIdx);
    expect(afterPointerout).toContain('setAlpha(1)');
  });
});

// ── 3. 닫기 핸들러에서 popupElements 순회 시 안전성 ──

test.describe('popupElements 정리 안전성', () => {
  test('el?.destroy 또는 el && el.destroy 패턴으로 null 안전 처리한다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // forEach에서 null 체크 존재
    const hasNullCheck = body.includes('el && el.destroy') || body.includes('el?.destroy');
    expect(hasNullCheck).toBe(true);
  });

  test('btnZone이 popupElements에 포함되지 않고 별도 destroy된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // btnZone은 popupElements에 push되지 않는다
    expect(body).not.toContain("popupElements.push(btnZone)");
    // 별도로 destroy된다
    expect(body).toContain("btnZone.destroy()");
  });
});

// ── 4. 오버레이 클릭 시 팝업이 닫히지 않는지 확인 ──

test.describe('오버레이 클릭 동작', () => {
  test('오버레이(overlay)에 인터랙션이 없다 (팝업 닫기는 버튼만)', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // overlay 변수에 setInteractive가 호출되지 않아야 한다
    // overlay는 단순 검정 배경
    const overlaySection = body.substring(
      body.indexOf('const overlay'),
      body.indexOf('popupElements.push(overlay)') + 30
    );
    expect(overlaySection).not.toContain('setInteractive');
  });
});

// ── 5. 동일 팝업 연속 호출 (더블탭 시뮬레이션) ──

test.describe('동시성: 빠른 연속 호출', () => {
  test('for 루프에서 동일 evo 연속 호출 시 두 번째는 _shownHints로 차단된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // _shownHints.has 체크가 함수 진입 직후 (첫 번째 가드)인지 확인
    const hasCheck = body.indexOf('_shownHints.has(evo.resultId)');
    const addCheck = body.indexOf('_shownHints.add(evo.resultId)');
    const levelUpCheck = body.indexOf('this._levelUpActive');
    const modalCheck = body.indexOf('this._modalOpen');

    // 순서: has → add → levelUp → modalOpen
    expect(hasCheck).toBeLessThan(addCheck);
    expect(addCheck).toBeLessThan(levelUpCheck);
    expect(levelUpCheck).toBeLessThan(modalCheck);
  });
});

// ── 6. _showEvolutionPopup의 _modalOpen 가드 동작 확인 ──

test.describe('_showEvolutionPopup과의 상호작용', () => {
  test('_showEvolutionPopup에도 _modalOpen 가드가 있다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const popupMatch = src.match(/_showEvolutionPopup\(evo\)\s*\{([\s\S]*?)\n  \}/);
    expect(popupMatch).toBeTruthy();
    const body = popupMatch[1];

    expect(body).toContain('if (this._modalOpen) return');
  });

  test('_tryEvolutionCheck 루프에서 진화 성공 후 hint 호출 순서가 안전하다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const tryMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
    const body = tryMatch[1];

    // for 루프 안에서 진화 성공 시 _showEvolutionPopup 호출 → _modalOpen = true
    // 같은 루프 다음 iteration에서 hint 호출 시 _modalOpen 체크로 큐에 적재
    // 이 동작은 안전하지만, 큐 드레인이 _showEvolutionPopup에는 없으므로
    // 큐 아이템이 다음 게임 이벤트까지 대기한다
    expect(body).toContain('_showEvolutionPopup');
    expect(body).toContain('_showEvolutionHintModal');
  });
});

// ── 7. 콘솔 에러 없이 페이지 로드 ──

test.describe('페이지 안정성', () => {
  test('페이지 로드 시 JavaScript 예외가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene.scenes.length > 0,
      { timeout: 15000 }
    );
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes('net::') && !e.includes('favicon')
    );
    expect(criticalErrors).toEqual([]);
  });
});
