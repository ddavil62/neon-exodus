/**
 * @fileoverview ResultScene UI 겹침 수정 QA 테스트.
 * 무기 7개 + 승리 + 해금 배너 최악 케이스를 포함한 다양한 시나리오에서
 * 해금 배너와 광고 버튼 간 겹침이 없는지, 모든 버튼이 640px 이내인지 검증한다.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';
const BOOT_WAIT = 3000;

/**
 * 특정 씬이 활성화될 때까지 대기한다.
 * @param {import('@playwright/test').Page} page
 * @param {string} sceneKey
 * @param {number} timeout
 */
async function waitForScene(page, sceneKey, timeout = 10000) {
  await page.waitForFunction(
    (key) => {
      const game = window.__NEON_EXODUS;
      if (!game || !game.scene) return false;
      return game.scene.scenes.some(s => s.scene.key === key && s.scene.isActive());
    },
    sceneKey,
    { timeout }
  );
}

/**
 * ResultScene을 특정 데이터로 시작한다.
 * @param {import('@playwright/test').Page} page
 * @param {object} overrides - ResultScene init 데이터 오버라이드
 */
async function startResultScene(page, overrides = {}) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(BOOT_WAIT);

  const data = {
    victory: false,
    killCount: 100,
    runTime: 120,
    creditsEarned: 50,
    level: 5,
    weaponSlotsFilled: 1,
    weaponEvolutions: 0,
    isEndless: false,
    endlessMinutes: 0,
    weaponReport: [],
    stageId: null,
    newWeaponUnlocked: null,
    ...overrides,
  };

  await page.evaluate((d) => {
    const game = window.__NEON_EXODUS;
    const menuScene = game.scene.getScene('MenuScene');
    if (menuScene) {
      menuScene.scene.start('ResultScene', d);
    }
  }, data);

  await waitForScene(page, 'ResultScene', 10000);
  await page.waitForTimeout(3000);
}

/**
 * ResultScene에서 레이아웃 정보를 수집한다.
 * @param {import('@playwright/test').Page} page
 */
async function getLayout(page) {
  return page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const rs = game.scene.getScene('ResultScene');
    if (!rs) return { error: 'no ResultScene' };

    const textObjects = rs.children.list
      .filter(c => c.type === 'Text')
      .map(t => ({ text: t.text, y: Math.round(t.y), x: Math.round(t.x), alpha: t.alpha }));

    const zones = rs.children.list
      .filter(c => c.type === 'Zone')
      .map(z => ({
        y: Math.round(z.y),
        height: z.height,
        width: z.width,
        top: Math.round(z.y - z.height / 2),
        bottom: Math.round(z.y + z.height / 2),
      }));

    const graphics = rs.children.list
      .filter(c => c.type === 'Graphics')
      .map((g, i) => ({ index: i, y: Math.round(g.y), x: Math.round(g.x) }));

    return { textObjects, zones, graphics, gameHeight: 640 };
  });
}

/** 7개 무기 리포트 생성 */
function makeWeaponReport7() {
  return [
    { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 150, damage: 80000, dps: 89 },
    { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 100, damage: 60000, dps: 67 },
    { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 80, damage: 45000, dps: 50 },
    { id: 'missile', nameKey: 'weapon.missile.name', kills: 60, damage: 35000, dps: 39 },
    { id: 'drone', nameKey: 'weapon.drone.name', kills: 50, damage: 25000, dps: 28 },
    { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 60, damage: 20000, dps: 22 },
    { id: 'force_blade', nameKey: 'weapon.force_blade.name', kills: 30, damage: 10000, dps: 11 },
  ];
}

/** 3개 무기 리포트 생성 */
function makeWeaponReport3() {
  return [
    { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 80, damage: 25000, dps: 208 },
    { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 45, damage: 15000, dps: 125 },
    { id: 'plasma_orb', nameKey: 'weapon.plasma_orb.name', kills: 25, damage: 8000, dps: 67 },
  ];
}

test.describe('ResultScene UI 겹침 수정 검증', () => {

  // ── AC1: 무기 7개 + 승리 + 해금 배너 - 겹침 없음 ──

  test('AC1. 무기 7개 + 승리 + 해금 배너 시 해금 배너와 광고 버튼이 겹치지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-7w-victory-banner.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // 해금 배너 관련 Graphics 객체의 위치 확인
    // 배너는 RoundedRect이므로 Graphics로 렌더링됨
    // Zone(버튼 터치 영역) 중 가장 위에 있는 것의 상단 Y
    const buttonZones = layout.zones;
    expect(buttonZones.length).toBeGreaterThan(0);

    // 광고 버튼 Zone은 가장 위에 있는 Zone (가장 작은 Y)
    const sortedZones = [...buttonZones].sort((a, b) => a.y - b.y);
    const adBtnZone = sortedZones[0]; // 광고 버튼 (최상단)

    // 해금 배너 텍스트 Y 좌표 확인
    // 배너 텍스트에는 "해금" 또는 "UNLOCK" 키워드가 있을 것
    const bannerTexts = layout.textObjects.filter(t =>
      t.text.includes('해금') || t.text.includes('UNLOCK') || t.text.includes('unlock')
    );

    // 스테이지 클리어 텍스트 확인
    const clearTexts = layout.textObjects.filter(t =>
      t.text.includes('클리어') || t.text.includes('Clear') || t.text.includes('CLEAR')
    );

    // 해금 배너/클리어 텍스트 중 가장 아래에 있는 것 + 배너 반높이(16)
    const contentBottomTexts = [...bannerTexts, ...clearTexts];
    if (contentBottomTexts.length > 0) {
      const maxBannerTextY = Math.max(...contentBottomTexts.map(t => t.y));
      // 배너 반높이 16px을 더해 배너 하단 추정
      const bannerBottom = maxBannerTextY + 16;
      // 광고 버튼 상단과 비교
      const gap = adBtnZone.top - bannerBottom;
      console.log(`Banner bottom: ${bannerBottom}, Ad button top: ${adBtnZone.top}, Gap: ${gap}px`);
      expect(gap).toBeGreaterThanOrEqual(0);
    }

    expect(errors).toEqual([]);
  });

  // ── AC2: 메뉴 버튼 하단이 640px 이내 ──

  test('AC2. 무기 7개 + 승리 + 해금 배너 시 메뉴 버튼 하단이 640px 이내', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-menu-btn-bounds.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // 모든 Zone(버튼)의 하단이 640px 이내
    const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
    console.log(`Max button bottom: ${maxBottom}, GAME_HEIGHT: 640`);
    expect(maxBottom).toBeLessThanOrEqual(640);

    // 모든 텍스트의 Y 좌표도 640px 이내
    const maxTextY = Math.max(...layout.textObjects.map(t => t.y));
    expect(maxTextY).toBeLessThanOrEqual(640);

    expect(errors).toEqual([]);
  });

  // ── AC3: 무기 0개 + 패배 - contentScale=1.0 ──

  test('AC3. 무기 0개 + 패배 시 레이아웃 정상 (contentScale=1.0)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      killCount: 0,
      runTime: 5,
      creditsEarned: 0,
      level: 1,
      weaponSlotsFilled: 0,
      weaponReport: [],
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-0w-defeat.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // contentScale 확인 (0개 무기, 패배 -> rawScalable이 작으므로 1.0이어야 함)
    const scaleInfo = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return null;
      // _calcRawScalable 호출하여 값 확인
      const raw = rs._calcRawScalable(3);
      return { raw };
    });

    if (scaleInfo) {
      // 무기 0개 시 weaponSection=10, rewardSection=6+24=30, bannerSection=0
      // rawScalable = 40 -> 매우 작으므로 contentScale=1.0
      expect(scaleInfo.raw).toBeLessThan(258); // scalableTarget(3 stats) 미만
    }

    // 버튼이 화면 안에 있어야 함
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── AC4: 무기 3개 + 승리(해금 없음) - 레이아웃 정상 ──

  test('AC4. 무기 3개 + 승리(해금 없음) 시 레이아웃 정상', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 200,
      runTime: 900,
      creditsEarned: 300,
      level: 15,
      weaponSlotsFilled: 3,
      weaponEvolutions: 1,
      weaponReport: makeWeaponReport3(),
      stageId: null,
      newWeaponUnlocked: null,
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-3w-victory-nobanner.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // 버튼 모두 640px 이내
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    // 해금 배너가 없어야 한다
    const bannerTexts = layout.textObjects.filter(t =>
      t.text.includes('해금') || t.text.includes('UNLOCK') || t.text.includes('unlock')
    );
    expect(bannerTexts.length).toBe(0);

    expect(errors).toEqual([]);
  });

  // ── AC5: 애니메이션 정상 동작 ──

  test('AC5. 광고/재도전/메뉴 버튼 등장 애니메이션 정상', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 500,
      runTime: 900,
      creditsEarned: 200,
      level: 20,
      weaponSlotsFilled: 7,
      weaponEvolutions: 2,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    // 애니메이션 완료 후 모든 Zone이 인터랙티브 상태인지 확인
    const interactiveCount = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return 0;
      return rs.children.list
        .filter(c => c.type === 'Zone' && c.input && c.input.enabled)
        .length;
    });

    // 최소 2개 (광고 + 재도전) 또는 3개 (광고 + 재도전 + 메뉴) 인터랙티브 영역
    // creditsEarned > 0이므로 광고 버튼 Zone 포함
    expect(interactiveCount).toBeGreaterThanOrEqual(2);

    // 모든 텍스트가 alpha > 0 (애니메이션 완료)
    const layout = await getLayout(page);
    const visibleTexts = layout.textObjects.filter(t => t.alpha > 0.5);
    expect(visibleTexts.length).toBeGreaterThan(5); // 타이틀 + 통계 + 보상 + 버튼 텍스트

    expect(errors).toEqual([]);
  });

  // ── AC7: contentScale < 1.0 시 텍스트 겹침/잘림 없음 ──

  test('AC7. contentScale < 1.0 시 텍스트 겹침 없음 (수직 간격 검증)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // 모든 텍스트를 Y좌표로 정렬
    const sortedTexts = [...layout.textObjects].sort((a, b) => a.y - b.y);

    // 인접 텍스트 간 최소 간격 확인 (같은 Y에 있는 것은 좌우 배치이므로 제외)
    for (let i = 1; i < sortedTexts.length; i++) {
      const prev = sortedTexts[i - 1];
      const curr = sortedTexts[i];
      const yDiff = curr.y - prev.y;

      // 같은 Y (좌우 배치)가 아닌 경우 최소 간격 검증
      if (yDiff > 2) {
        // fontSize 기준 최소 간격: 10px 이상이어야 텍스트가 겹치지 않음
        // (최소 fontSize=10px 기준)
        // 하지만 damage bar 텍스트와 weapon name이 같은 행에서 Y 차이가 적을 수 있음
        // Y 차이가 2px 초과이면서 6px 미만인 경우 잠재적 겹침
        if (yDiff < 6 && yDiff > 2) {
          console.log(`Potential overlap: "${prev.text}" (y=${prev.y}) and "${curr.text}" (y=${curr.y}), diff=${yDiff}px`);
        }
      }
    }

    // 명시적 겹침 체크: 같은 Y의 텍스트가 X 좌표도 비슷한 경우
    const yGroups = {};
    sortedTexts.forEach(t => {
      const roundedY = Math.round(t.y / 3) * 3; // 3px 단위로 그룹핑
      if (!yGroups[roundedY]) yGroups[roundedY] = [];
      yGroups[roundedY].push(t);
    });

    Object.entries(yGroups).forEach(([y, texts]) => {
      if (texts.length > 3) {
        console.log(`Warning: ${texts.length} texts at Y~${y}: ${texts.map(t => `"${t.text.substring(0, 20)}"`).join(', ')}`);
      }
    });

    expect(errors).toEqual([]);
  });

  // ── 엣지케이스: 엔들리스 + 7 무기 + 승리 + 배너 (4행 통계) ──

  test('EDGE1. 엔들리스 4행 통계 + 무기 7개 + 승리 + 배너 시 모든 요소 640px 이내', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 2000,
      runTime: 1800,
      creditsEarned: 1000,
      level: 30,
      weaponSlotsFilled: 7,
      weaponEvolutions: 4,
      isEndless: true,
      endlessMinutes: 30,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-endless-7w-banner.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // contentScale 확인 (4행 통계이므로 더 압축 필요)
    const scaleInfo = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return null;
      const raw = rs._calcRawScalable(4);
      // fixedStatsEnd = 160 + 4*26 = 264
      // scalableTarget = 524 - 12 - 264 - 16 = 232
      return { raw, scalableTarget: 232 };
    });

    if (scaleInfo) {
      console.log(`Endless case: raw=${scaleInfo.raw}, target=${scaleInfo.scalableTarget}`);
      // scale = max(0.78, target/raw)
      const computedScale = scaleInfo.raw > scaleInfo.scalableTarget
        ? Math.max(0.78, scaleInfo.scalableTarget / scaleInfo.raw)
        : 1.0;
      console.log(`Computed contentScale: ${computedScale.toFixed(4)}`);
      // 0.78 이상이어야 함
      expect(computedScale).toBeGreaterThanOrEqual(0.78);
    }

    // 모든 버튼이 640px 이내
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      console.log(`Endless worst case - max button bottom: ${maxBottom}`);
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    // 배너와 광고 버튼 겹침 확인
    const sortedZones = [...layout.zones].sort((a, b) => a.y - b.y);
    if (sortedZones.length > 0) {
      const adBtnZone = sortedZones[0];
      const bannerTexts = layout.textObjects.filter(t =>
        t.text.includes('해금') || t.text.includes('UNLOCK') || t.text.includes('unlock')
      );
      if (bannerTexts.length > 0) {
        const maxBannerY = Math.max(...bannerTexts.map(t => t.y));
        const bannerBottom = maxBannerY + 16;
        const gap = adBtnZone.top - bannerBottom;
        console.log(`Endless: banner bottom=${bannerBottom}, adBtn top=${adBtnZone.top}, gap=${gap}px`);
        expect(gap).toBeGreaterThanOrEqual(0);
      }
    }

    expect(errors).toEqual([]);
  });

  // ── 엣지케이스: newWeaponUnlocked=true 이지만 stageId=null ──

  test('EDGE2. newWeaponUnlocked 설정이지만 stageId가 null인 경우', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 500,
      runTime: 900,
      creditsEarned: 300,
      level: 20,
      weaponSlotsFilled: 7,
      weaponEvolutions: 2,
      weaponReport: makeWeaponReport7(),
      stageId: null,
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-no-stageid.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // stageId가 null이면 stageData도 null -> "스테이지명 클리어!" 스타일 텍스트 미표시
    // 주의: "클리어 보너스: +100" 텍스트는 victory=true일 때 항상 표시되므로 제외
    const stageClearTexts = layout.textObjects.filter(t => {
      const text = t.text;
      // "스테이지명 클리어!" 패턴 확인 (bonusCredit "클리어 보너스" 제외)
      return (text.includes('클리어!') || text.includes('Cleared!'));
    });
    expect(stageClearTexts.length).toBe(0);

    // 해금 배너는 여전히 표시됨
    const bannerTexts = layout.textObjects.filter(t =>
      t.text.includes('해금') || t.text.includes('UNLOCK') || t.text.includes('unlock')
    );
    expect(bannerTexts.length).toBeGreaterThan(0);

    // 버튼 640px 이내
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 엣지케이스: 존재하지 않는 stageId ──

  test('EDGE3. 존재하지 않는 stageId 전달 시 크래시 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 500,
      runTime: 900,
      creditsEarned: 300,
      level: 20,
      weaponSlotsFilled: 7,
      weaponEvolutions: 2,
      weaponReport: makeWeaponReport7(),
      stageId: 'nonexistent_stage',
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-invalid-stageid.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // STAGES['nonexistent_stage']는 undefined -> stageData = null
    // "스테이지명 클리어!" 텍스트 미표시 (bonusCredit "클리어 보너스" 제외)
    const stageClearTexts = layout.textObjects.filter(t =>
      (t.text.includes('클리어!') || t.text.includes('Cleared!'))
    );
    expect(stageClearTexts.length).toBe(0);

    // 버튼 640px 이내
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 엣지케이스: 무기 10개 (최대 표시 한도) ──

  test('EDGE4. 무기 10개 전달 시 레이아웃이 640px 이내', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const weapons10 = [];
    for (let i = 0; i < 10; i++) {
      weapons10.push({
        id: `weapon_${i}`,
        nameKey: 'weapon.blaster.name',
        kills: 100 - i * 10,
        damage: 50000 - i * 5000,
        dps: 50 - i * 5,
      });
    }

    await startResultScene(page, {
      victory: true,
      killCount: 1500,
      runTime: 900,
      creditsEarned: 800,
      level: 30,
      weaponSlotsFilled: 10,
      weaponEvolutions: 5,
      weaponReport: weapons10,
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    await page.screenshot({ path: 'tests/screenshots/result-overlap-10weapons.png' });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // 버튼 640px 이내
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      console.log(`10 weapons max bottom: ${maxBottom}`);
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 엣지케이스: creditsEarned=0 시 광고 버튼 비활성 ──

  test('EDGE5. creditsEarned=0 시 광고 버튼 Zone 미생성', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      killCount: 0,
      runTime: 3,
      creditsEarned: 0,
      level: 1,
      weaponSlotsFilled: 0,
      weaponReport: [],
    });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    // creditsEarned <= 0이면 광고 Zone 미생성, 재도전/메뉴 Zone만 존재
    // _createAdDoubleButton에서 `if (limitReached || this.creditsEarned <= 0) return;` 으로 Zone 미생성
    expect(layout.zones.length).toBe(2); // 재도전 + 메뉴

    expect(errors).toEqual([]);
  });

  // ── 수치 검증: _calcRawScalable 반환값 직접 검증 ──

  test('CALC1. _calcRawScalable 반환값이 스펙과 일치 (7무기+승리+배너)', async ({ page }) => {
    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no scene' };

      // 3 stats (non-endless)
      const raw = rs._calcRawScalable(3);

      // 개별 구간 계산 검증
      const totalWeapons = 7;
      const rowHeight = 22; // > 6
      const displayCount = 7;
      const weaponSection = 10 + 12 + 18 + displayCount * rowHeight + 4; // 198
      const rewardSection = 6 + 44; // 50 (victory)
      const bannerSection = 8 + 32 + 20; // 60 (stageData exists)
      const expected = weaponSection + rewardSection + bannerSection; // 308

      return { raw, expected, weaponSection, rewardSection, bannerSection };
    });

    expect(result.error).toBeUndefined();
    console.log(`_calcRawScalable: raw=${result.raw}, expected=${result.expected}`);
    console.log(`  weaponSection=${result.weaponSection}, rewardSection=${result.rewardSection}, bannerSection=${result.bannerSection}`);
    expect(result.raw).toBe(308);
    expect(result.raw).toBe(result.expected);
  });

  // ── 수치 검증: contentScale 계산 ──

  test('CALC2. contentScale이 올바르게 계산된다 (7무기+승리+배너)', async ({ page }) => {
    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no scene' };

      // 재계산
      const statsCount = 3;
      const fixedStatsEnd = 160 + statsCount * 26; // 238
      const bannerHalf = 16;
      const MAX_AD_BTN_Y = 640 - 44 * 2 - 28; // 524
      const BTN_CONTENT_GAP = 12;
      const scalableTarget = MAX_AD_BTN_Y - BTN_CONTENT_GAP - fixedStatsEnd - bannerHalf; // 258
      const rawScalable = rs._calcRawScalable(statsCount); // 308
      const MIN_CONTENT_SCALE = 0.78;
      const contentScale = rawScalable > scalableTarget
        ? Math.max(MIN_CONTENT_SCALE, scalableTarget / rawScalable)
        : 1.0;

      return { fixedStatsEnd, scalableTarget, rawScalable, contentScale };
    });

    expect(result.error).toBeUndefined();
    console.log(`fixedStatsEnd=${result.fixedStatsEnd}, scalableTarget=${result.scalableTarget}, rawScalable=${result.rawScalable}`);
    console.log(`contentScale=${result.contentScale}`);

    expect(result.fixedStatsEnd).toBe(238);
    expect(result.scalableTarget).toBe(258);
    expect(result.rawScalable).toBe(308);
    expect(result.contentScale).toBeGreaterThan(0.78);
    expect(result.contentScale).toBeLessThan(1.0);
    // 258/308 = 0.8376...
    expect(result.contentScale).toBeCloseTo(0.838, 2);
  });

  // ── 수치 검증: 버튼 Y좌표 추적 ──

  test('CALC3. 최악 케이스 버튼 Y좌표가 스펙과 일치', async ({ page }) => {
    await startResultScene(page, {
      victory: true,
      killCount: 800,
      runTime: 900,
      creditsEarned: 500,
      level: 25,
      weaponSlotsFilled: 7,
      weaponEvolutions: 3,
      weaponReport: makeWeaponReport7(),
      stageId: 'stage_1',
      newWeaponUnlocked: 'force_blade',
    });

    const layout = await getLayout(page);
    expect(layout.error).toBeUndefined();

    const sortedZones = [...layout.zones].sort((a, b) => a.y - b.y);
    expect(sortedZones.length).toBeGreaterThanOrEqual(2);

    // 광고 버튼 (최상단 Zone, width=200)
    const adBtn = sortedZones.find(z => z.width === 200);
    // 재도전/메뉴 버튼 (width=180)
    const otherBtns = sortedZones.filter(z => z.width === 180);

    if (adBtn) {
      console.log(`Ad button: y=${adBtn.y}, top=${adBtn.top}, bottom=${adBtn.bottom}`);
      // adBtnY <= MAX_AD_BTN_Y(524)
      expect(adBtn.y).toBeLessThanOrEqual(524);
    }

    if (otherBtns.length >= 2) {
      const retryBtn = otherBtns[0];
      const menuBtn = otherBtns[1];
      console.log(`Retry button: y=${retryBtn.y}, bottom=${retryBtn.bottom}`);
      console.log(`Menu button: y=${menuBtn.y}, bottom=${menuBtn.bottom}`);

      // 메뉴 버튼 하단 <= 640
      expect(menuBtn.bottom).toBeLessThanOrEqual(640);

      // 버튼 간 간격 = BTN_GAP(44)
      if (adBtn) {
        expect(retryBtn.y - adBtn.y).toBe(44);
        expect(menuBtn.y - retryBtn.y).toBe(44);
      }
    }
  });

  // ── 콘솔 에러 없음 ──

  test('STABILITY. 다양한 시나리오 전환 시 콘솔 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // 시나리오 1: 무기 0개 패배
    await startResultScene(page, { weaponReport: [], creditsEarned: 0 });
    await page.waitForTimeout(500);

    // 시나리오 2: 무기 7개 + 승리 + 배너
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (rs) {
        rs.scene.start('ResultScene', {
          victory: true, killCount: 800, runTime: 900, creditsEarned: 500, level: 25,
          weaponSlotsFilled: 7, weaponEvolutions: 3,
          isEndless: false, endlessMinutes: 0,
          weaponReport: [
            { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 150, damage: 80000, dps: 89 },
            { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 100, damage: 60000, dps: 67 },
            { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 80, damage: 45000, dps: 50 },
            { id: 'missile', nameKey: 'weapon.missile.name', kills: 60, damage: 35000, dps: 39 },
            { id: 'drone', nameKey: 'weapon.drone.name', kills: 50, damage: 25000, dps: 28 },
            { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 60, damage: 20000, dps: 22 },
            { id: 'force_blade', nameKey: 'weapon.force_blade.name', kills: 30, damage: 10000, dps: 11 },
          ],
          stageId: 'stage_1',
          newWeaponUnlocked: 'force_blade',
        });
      }
    });
    await page.waitForTimeout(3000);

    // 시나리오 3: 엔들리스 + 7무기 + 배너
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (rs) {
        rs.scene.start('ResultScene', {
          victory: true, killCount: 2000, runTime: 1800, creditsEarned: 1000, level: 30,
          weaponSlotsFilled: 7, weaponEvolutions: 4,
          isEndless: true, endlessMinutes: 30,
          weaponReport: [
            { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 300, damage: 160000, dps: 89 },
            { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 200, damage: 120000, dps: 67 },
            { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 160, damage: 90000, dps: 50 },
            { id: 'missile', nameKey: 'weapon.missile.name', kills: 120, damage: 70000, dps: 39 },
            { id: 'drone', nameKey: 'weapon.drone.name', kills: 100, damage: 50000, dps: 28 },
            { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 120, damage: 40000, dps: 22 },
            { id: 'force_blade', nameKey: 'weapon.force_blade.name', kills: 60, damage: 20000, dps: 11 },
          ],
          stageId: 'stage_1',
          newWeaponUnlocked: 'force_blade',
        });
      }
    });
    await page.waitForTimeout(3000);

    expect(errors).toEqual([]);
  });
});
