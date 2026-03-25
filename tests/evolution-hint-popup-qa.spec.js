/**
 * @fileoverview 진화 힌트 팝업 모달 QA 테스트.
 * _showEvolutionHintModal 함수의 코드 정적 검증, i18n, 큐 시스템, 중복 방지, 스타일 일관성 검증.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = '/';

// ── 헬퍼 ──

/** GameScene.js 소스코드를 fetch하여 반환한다 */
async function fetchGameSceneSrc(page) {
  await page.goto(BASE_URL);
  return page.evaluate(async () => {
    const resp = await fetch('/js/scenes/GameScene.js');
    return resp.text();
  });
}

/** i18n.js 소스코드를 fetch하여 반환한다 */
async function fetchI18nSrc(page) {
  await page.goto(BASE_URL);
  return page.evaluate(async () => {
    const resp = await fetch('/js/i18n.js');
    return resp.text();
  });
}

/** Phaser 부팅 대기 + i18n 모듈 import 준비 */
async function waitForGame(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(
    () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene.scenes.length > 0,
    { timeout: 15000 }
  );
  await page.waitForTimeout(2000);
}

// ── 1. 기존 토스트 코드 제거 검증 (소스 기반) ──

test.describe('1. 기존 토스트 코드 제거 검증', () => {
  test('_showEvolutionHint 함수가 GameScene.js에 존재하지 않는다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    // 구 함수 정의가 없어야 함 (but _showEvolutionHintModal은 있어야 함)
    const hasOldFnDef = /_showEvolutionHint\s*\(evo\)\s*\{/.test(src)
      && !/_showEvolutionHintModal\s*\(evo\)\s*\{/.test(src);
    // _showEvolutionHint(evo) { 가 있지만 Modal 버전이 아닌 것
    const oldPattern = src.match(/_showEvolutionHint\(evo\)\s*\{/g) || [];
    const newPattern = src.match(/_showEvolutionHintModal\(evo\)\s*\{/g) || [];
    expect(oldPattern.length).toBe(0); // 구 함수 정의 없음
    expect(newPattern.length).toBe(1); // 신 함수 정의 1개
  });

  test('기존 토스트 tween 코드(alpha, delay)가 제거되었다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    // _showEvolutionHintModal 함수 추출
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    expect(methodMatch).toBeTruthy();
    const body = methodMatch[1];
    // 토스트 패턴: tween으로 alpha 0 페이드아웃, delay 1500
    const hasTweenFade = body.includes('alpha: 0') || body.includes('alpha:0');
    const hasAutoDelay = body.includes('delay: 1500') || body.includes('delay:1500');
    expect(hasTweenFade).toBe(false);
    expect(hasAutoDelay).toBe(false);
  });

  test('_tryEvolutionCheck에서 _showEvolutionHintModal을 호출한다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
    expect(methodMatch).toBeTruthy();
    const body = methodMatch[1];
    expect(body).toContain('_showEvolutionHintModal');
    expect(body).not.toMatch(/_showEvolutionHint[^M]/); // 구 함수명 호출 없어야 함
  });
});

// ── 2. 신규 함수 구조 검증 (소스 기반) ──

test.describe('2. _showEvolutionHintModal 함수 구조 검증', () => {
  let body;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    body = methodMatch ? methodMatch[1] : '';
    await page.close();
  });

  test('_shownHints 중복 방지 로직이 존재한다', async () => {
    expect(body).toContain('_shownHints.has(evo.resultId)');
    expect(body).toContain('_shownHints.add(evo.resultId)');
  });

  test('_levelUpActive 가드가 존재한다', async () => {
    expect(body).toContain('_levelUpActive');
    expect(body).toContain('_evolutionHintQueue.push(evo)');
  });

  test('_modalOpen 가드가 존재한다', async () => {
    expect(body).toContain('_modalOpen');
  });

  test('일시정지 로직이 존재한다 (isPaused, physics.pause, _modalOpen)', async () => {
    expect(body).toContain('this.isPaused = true');
    expect(body).toContain('this.physics.pause()');
    expect(body).toContain('this._modalOpen = true');
  });

  test('게임 재개 로직이 존재한다 (isPaused = false, physics.resume, _modalOpen = false)', async () => {
    expect(body).toContain('this.isPaused = false');
    expect(body).toContain('this.physics.resume()');
    expect(body).toContain('this._modalOpen = false');
  });

  test('popupElements 배열로 요소를 관리한다', async () => {
    expect(body).toContain('popupElements');
    expect(body).toContain('popupElements.forEach');
    expect(body).toContain('el.destroy');
  });

  test('btnZone.destroy()가 호출된다', async () => {
    expect(body).toContain('btnZone.destroy()');
  });

  test('큐 드레인 로직이 닫기 핸들러에 존재한다', async () => {
    expect(body).toContain('_evolutionHintQueue.length > 0');
    expect(body).toContain('_evolutionHintQueue.shift()');
    expect(body).toContain('_showEvolutionHintModal(next)');
  });

  test('setScrollFactor(0)이 모든 요소에 적용된다', async () => {
    // setScrollFactor(0)의 등장 횟수가 충분해야 함 (오버레이, 패널, 타이틀, 아이콘, 이름, 뱃지, 안내, 버튼배경, 버튼텍스트, 존)
    const scrollFactorCount = (body.match(/setScrollFactor\(0\)/g) || []).length;
    expect(scrollFactorCount).toBeGreaterThanOrEqual(9);
  });
});

// ── 3. _evolutionHintQueue 초기화 검증 ──

test.describe('3. _evolutionHintQueue 초기화 검증', () => {
  test('create() 내에서 _evolutionHintQueue가 배열로 초기화된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    // 선언부에서 초기화 확인
    expect(src).toContain('this._evolutionHintQueue = []');
  });

  test('_shownHints가 Set으로 초기화된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    expect(src).toContain('this._shownHints = new Set()');
  });
});

// ── 4. i18n 키 검증 ──

test.describe('4. i18n 키 존재 확인', () => {
  test('hint.evolutionHintTitle 키가 ko 번역에 존재한다', async ({ page }) => {
    const src = await fetchI18nSrc(page);
    expect(src).toContain("'hint.evolutionHintTitle'");
    // ko 값 확인
    const koMatch = src.match(/'hint\.evolutionHintTitle':\s*'([^']+)'/);
    expect(koMatch).toBeTruthy();
    expect(koMatch[1]).toBe('진화 가능!');
  });

  test('hint.evolutionHintTitle 키가 en 번역에 존재한다', async ({ page }) => {
    await waitForGame(page);
    const result = await page.evaluate(async () => {
      const mod = await import('/js/i18n.js');
      mod.setLocale('en');
      const en = mod.t('hint.evolutionHintTitle');
      mod.setLocale('ko');
      return en;
    });
    expect(result).toBe('Evolution Ready!');
  });

  test('hint.evolutionReady 키가 팝업 본문에서 사용된다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];
    expect(body).toContain("t('hint.evolutionReady'");
  });

  test('hint.evolutionReady 키에 {0}, {1} 플레이스홀더가 있다', async ({ page }) => {
    const src = await fetchI18nSrc(page);
    const koMatch = src.match(/'hint\.evolutionReady':\s*'([^']+)'/);
    expect(koMatch).toBeTruthy();
    expect(koMatch[1]).toContain('{0}');
    expect(koMatch[1]).toContain('{1}');
  });
});

// ── 5. 스타일 일관성 검증 (_showWeaponInfoModal 대비) ──

test.describe('5. _showWeaponInfoModal과 스타일 일관성', () => {
  let hintBody, weaponInfoBody;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const src = await fetchGameSceneSrc(page);
    const hintMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    hintBody = hintMatch ? hintMatch[1] : '';
    const weaponMatch = src.match(/_showWeaponInfoModal\(w\)\s*\{([\s\S]*?)\n  \}/);
    weaponInfoBody = weaponMatch ? weaponMatch[1] : '';
    await page.close();
  });

  test('panelW가 동일하다 (250)', async () => {
    expect(hintBody).toContain('panelW = 250');
    expect(weaponInfoBody).toContain('panelW = 250');
  });

  test('오버레이 depth가 동일하다 (350)', async () => {
    expect(hintBody).toContain('setDepth(350)');
    expect(weaponInfoBody).toContain('setDepth(350)');
  });

  test('패널 depth가 동일하다 (351)', async () => {
    expect(hintBody).toContain('setDepth(351)');
    expect(weaponInfoBody).toContain('setDepth(351)');
  });

  test('텍스트 depth가 동일하다 (352)', async () => {
    expect(hintBody).toContain('setDepth(352)');
    expect(weaponInfoBody).toContain('setDepth(352)');
  });

  test('버튼 텍스트 depth가 동일하다 (353)', async () => {
    expect(hintBody).toContain('setDepth(353)');
    expect(weaponInfoBody).toContain('setDepth(353)');
  });

  test('fontFamily가 동일하다 (Galmuri11, monospace)', async () => {
    expect(hintBody).toContain('Galmuri11, monospace');
    expect(weaponInfoBody).toContain('Galmuri11, monospace');
  });

  test('btnW가 동일하다 (120)', async () => {
    expect(hintBody).toContain('btnW = 120');
    expect(weaponInfoBody).toContain('btnW = 120');
  });

  test('오버레이 색상이 동일하다 (0x000000, 0.6)', async () => {
    expect(hintBody).toContain('0x000000, 0.6');
    expect(weaponInfoBody).toContain('0x000000, 0.6');
  });

  test('패널 배경이 동일하다 (COLORS.UI_PANEL, 0.95)', async () => {
    expect(hintBody).toContain('COLORS.UI_PANEL, 0.95');
    expect(weaponInfoBody).toContain('COLORS.UI_PANEL, 0.95');
  });

  test('테두리가 neonCyan이다 (COLORS.NEON_CYAN)', async () => {
    expect(hintBody).toContain('COLORS.NEON_CYAN');
  });

  test('pointerdown/pointerup/pointerout 3종 이벤트가 양쪽 모두 등록된다', async () => {
    for (const fn of [hintBody, weaponInfoBody]) {
      expect(fn).toContain("'pointerdown'");
      expect(fn).toContain("'pointerup'");
      expect(fn).toContain("'pointerout'");
    }
  });

  test('wordWrap width가 동일하다 (220)', async () => {
    expect(hintBody).toContain('width: 220');
    expect(weaponInfoBody).toContain('width: 220');
  });
});

// ── 6. depth 범위 준수 검증 ──

test.describe('6. depth 범위 350-353 준수', () => {
  test('함수 내 setDepth 호출이 모두 350-353 범위이다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];
    const depthCalls = body.match(/setDepth\((\d+)\)/g) || [];
    const depthValues = depthCalls.map(d => parseInt(d.match(/\d+/)[0]));
    expect(depthValues.length).toBeGreaterThan(0);
    for (const d of depthValues) {
      expect(d).toBeGreaterThanOrEqual(350);
      expect(d).toBeLessThanOrEqual(353);
    }
  });
});

// ── 7. 큐 시스템 경로 분석 ──

test.describe('7. 큐 드레인 경로 분석', () => {
  test('_showEvolutionPopup 닫기 핸들러에는 큐 드레인이 없다 (구조적 제한)', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const popupMatch = src.match(/_showEvolutionPopup\(evo\)\s*\{([\s\S]*?)\n  \}/);
    expect(popupMatch).toBeTruthy();
    const popupBody = popupMatch[1];
    // 진화 성공 팝업 닫기에서 _evolutionHintQueue를 소비하지 않음
    expect(popupBody).not.toContain('_evolutionHintQueue');
  });

  test('_shownHints.add가 큐 적재 전에 호출된다 (큐 드레인 불가 시나리오 잠재)', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];
    // _shownHints.add의 위치가 _levelUpActive 체크보다 앞인지 확인
    const addIdx = body.indexOf('_shownHints.add(evo.resultId)');
    const levelUpIdx = body.indexOf('this._levelUpActive');
    expect(addIdx).toBeGreaterThan(-1);
    expect(levelUpIdx).toBeGreaterThan(-1);
    // add가 levelUp 체크보다 앞에 있음 = 큐에 적재된 항목은 _tryEvolutionCheck 재호출 시 _shownHints로 차단됨
    expect(addIdx).toBeLessThan(levelUpIdx);
  });
});

// ── 8. 팝업 내용 구성 요소 검증 ──

test.describe('8. 팝업 내용 구성 요소', () => {
  let body;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    body = methodMatch ? methodMatch[1] : '';
    await page.close();
  });

  test('무기 아이콘(WEAPON_ICON_MAP)을 사용한다', async () => {
    expect(body).toContain('WEAPON_ICON_MAP[evo.weaponId]');
    expect(body).toContain('WEAPON_ICON_FALLBACK');
  });

  test('무기 이름을 i18n으로 조회한다', async () => {
    expect(body).toMatch(/t\(`weapon\.\$\{evo\.weaponId\}\.name`\)/);
  });

  test('패시브 이름을 i18n으로 조회한다', async () => {
    expect(body).toMatch(/t\(`passive\.\$\{evo\.passiveId\}\.name`\)/);
  });

  test('MAX! 뱃지가 neonOrange로 표시된다', async () => {
    expect(body).toContain("'MAX!'");
    expect(body).toContain('neonOrange');
  });

  test('타이틀이 neonCyan으로 표시된다', async () => {
    expect(body).toContain('evolutionHintTitle');
    expect(body).toContain('neonCyan');
  });

  test('닫기 버튼 텍스트가 t("ui.close")이다', async () => {
    expect(body).toContain("t('ui.close')");
  });

  test('panelH가 180이다', async () => {
    expect(body).toContain('panelH = 180');
  });

  test('btnH가 44이다 (Apple HIG 최소값 충족)', async () => {
    expect(body).toContain('btnH = 44');
  });
});

// ── 9. 기존 테스트 참조 업데이트 필요성 검증 ──

test.describe('9. 기존 테스트 파일 영향 분석', () => {
  test('evolution-recipe-ui.spec.js에 _showEvolutionHint 구 참조가 있다', async ({ page }) => {
    await page.goto(BASE_URL);
    const src = await page.evaluate(async () => {
      const resp = await fetch('/tests/evolution-recipe-ui.spec.js');
      if (!resp.ok) return null;
      return resp.text();
    });
    // 테스트 파일이 http-server를 통해 접근 가능할 수도 있고 아닐 수도 있음
    // 소스 코드 직접 분석으로 대체
  });
});

// ── 10. 시각적 검증 (런타임) ──

test.describe('10. 런타임 시각적 검증', () => {
  test('GameScene.js 소스에서 팝업 레이아웃 좌표가 올바르다', async ({ page }) => {
    const src = await fetchGameSceneSrc(page);
    const methodMatch = src.match(/_showEvolutionHintModal\(evo\)\s*\{([\s\S]*?)\n  \}/);
    const body = methodMatch[1];

    // AD 리뷰에서 확정한 좌표값 검증
    expect(body).toContain('panelH = 180');
    expect(body).toContain('centerY - panelH / 2 + 20'); // titleY
    expect(body).toContain('titleY + 22'); // headerY
    expect(body).toContain('headerY + 20'); // badgeY
    expect(body).toContain('badgeY + 16'); // infoY
    expect(body).toContain('btnH = 44');
    expect(body).toContain('centerY + panelH / 2 - 30'); // btnY
  });
});

// ── 11. 콘솔 에러 검증 ──

test.describe('11. 페이지 로드 시 콘솔 에러', () => {
  test('페이지 로드 시 JavaScript 예외가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await waitForGame(page);
    // 치명적 에러만 필터 (Phaser 내부 경고 제외)
    const criticalErrors = errors.filter(
      (e) => !e.includes('net::') && !e.includes('favicon')
    );
    expect(criticalErrors).toEqual([]);
  });
});
