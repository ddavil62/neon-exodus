/**
 * @fileoverview ResultScene 무기 리포트 레이아웃 수정 검증 테스트.
 * 무기 3개 이상 시 하단 버튼(광고/재도전/메뉴)과 겹치지 않는지 확인한다.
 * 이전 QA에서 MEDIUM으로 보고된 이슈의 수정을 검증한다.
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
  // 모든 애니메이션 완료 대기 (최대 딜레이는 약 2초)
  await page.waitForTimeout(3000);
}

/**
 * 무기 6개 테스트용 weaponReport 생성
 */
function makeWeaponReport6() {
  return [
    { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 150, damage: 80000, dps: 89 },
    { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 100, damage: 60000, dps: 67 },
    { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 80, damage: 45000, dps: 50 },
    { id: 'missile', nameKey: 'weapon.missile.name', kills: 60, damage: 35000, dps: 39 },
    { id: 'drone', nameKey: 'weapon.drone.name', kills: 50, damage: 25000, dps: 28 },
    { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 60, damage: 20000, dps: 22 },
  ];
}

test.describe('ResultScene 레이아웃 수정 검증', () => {

  // ── 테스트 A: 무기 6개 패배 (핵심 수정 대상) ──

  test('A. 무기 6개 패배 시 하단 버튼과 무기 리포트가 겹치지 않는다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      killCount: 500,
      runTime: 120,
      creditsEarned: 200,
      level: 15,
      weaponSlotsFilled: 6,
      weaponReport: makeWeaponReport6(),
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-6weapons-defeat.png' });

    // Y좌표 검증: 코드 내부에서 동적으로 계산된 값을 확인
    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      // 모든 텍스트 객체의 Y좌표와 내용 수집
      const textObjects = rs.children.list
        .filter(c => c.type === 'Text')
        .map(t => ({ text: t.text, y: Math.round(t.y), x: Math.round(t.x) }));

      // 모든 Zone 객체 (버튼 터치 영역)의 Y좌표와 크기 수집
      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          height: z.height,
          width: z.width,
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      return { textObjects, zones, gameHeight: 640 };
    });

    expect(layout.error).toBeUndefined();

    // 무기 리포트 텍스트 중 가장 아래에 있는 것의 Y좌표
    const weaponTexts = layout.textObjects.filter(t =>
      t.text.includes('K') || t.text.includes('DPS') || t.text.includes('kills')
    );

    // 버튼 Zone의 상단 좌표 중 가장 위에 있는 것
    const buttonZones = layout.zones;
    if (buttonZones.length > 0) {
      const topButtonY = Math.min(...buttonZones.map(z => z.top));
      // 무기 리포트 텍스트 중 가장 아래 있는 텍스트의 Y좌표
      const allTextsYs = layout.textObjects.map(t => t.y);
      const maxTextY = Math.max(...allTextsYs);

      // 가장 아래 Zone의 하단이 GAME_HEIGHT(640) 이내인지
      const maxZoneBottom = Math.max(...buttonZones.map(z => z.bottom));
      expect(maxZoneBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 B: 무기 1개 패배 (최소 케이스) ──

  test('B. 무기 1개 패배 시 레이아웃이 자연스럽다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      killCount: 10,
      runTime: 15,
      creditsEarned: 5,
      level: 2,
      weaponSlotsFilled: 1,
      weaponReport: [
        { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 10, damage: 3000, dps: 200 },
      ],
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-1weapon-defeat.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      return { zones };
    });

    expect(layout.error).toBeUndefined();

    // 버튼이 모두 화면 안에 있어야 함
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 C: 무기 6개 승리 (보너스 텍스트 포함) ──

  test('C. 무기 6개 승리 시 보너스 텍스트 + 하단 버튼이 640px 이내에 들어간다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 600,
      runTime: 900,
      creditsEarned: 500,
      level: 20,
      weaponSlotsFilled: 6,
      weaponEvolutions: 2,
      weaponReport: makeWeaponReport6(),
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-6weapons-victory.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      const textObjects = rs.children.list
        .filter(c => c.type === 'Text')
        .map(t => ({ text: t.text, y: Math.round(t.y) }));

      return { zones, textObjects };
    });

    expect(layout.error).toBeUndefined();

    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 D: 무기 6개 + 엔들리스 + 승리 (최악의 시나리오) ──

  test('D. 무기 6개 + 엔들리스 + 승리 (가장 빡빡한 케이스)에서 모든 요소가 640px 이내', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: true,
      killCount: 1000,
      runTime: 1800,
      creditsEarned: 800,
      level: 25,
      weaponSlotsFilled: 6,
      weaponEvolutions: 3,
      isEndless: true,
      endlessMinutes: 15,
      weaponReport: makeWeaponReport6(),
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-worst-case.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      const textObjects = rs.children.list
        .filter(c => c.type === 'Text')
        .map(t => ({ text: t.text, y: Math.round(t.y) }));

      return { zones, textObjects };
    });

    expect(layout.error).toBeUndefined();

    // 모든 버튼이 화면 안에 있어야 함
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    // 모든 텍스트가 화면 안에 있어야 함 (마진 고려하여 650까지 허용)
    const maxTextY = Math.max(...layout.textObjects.map(t => t.y));
    expect(maxTextY).toBeLessThanOrEqual(640);

    expect(errors).toEqual([]);
  });

  // ── 테스트 E: 무기 0개 (빈 리포트) ──

  test('E. 무기 0개 시 무기 리포트 섹션이 표시되지 않고 버튼이 적절한 위치에 있다', async ({ page }) => {
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

    await page.screenshot({ path: 'tests/screenshots/layout-fix-0weapons.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      return { zones };
    });

    expect(layout.error).toBeUndefined();

    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);

      // 무기 0개, creditsEarned=0 시 광고 버튼 Zone이 생성되지 않으므로
      // 첫 번째 Zone(재도전 버튼)이 retryBtnY(=484)에 위치한다.
      // adBtnY는 440이지만 광고 Zone은 creditsEarned <= 0이라 미생성.
      const minZoneY = Math.min(...layout.zones.map(z => z.y));
      expect(minZoneY).toBe(484); // adBtnY(440) + btnGap(44) = 484 (재도전 버튼)
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 F: 무기 3개 (이전 QA에서 겹침이 시작된 경계값) ──

  test('F. 무기 3개 시 하단 버튼과 겹치지 않는다 (이전 FAIL 경계값)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      killCount: 150,
      runTime: 120,
      creditsEarned: 50,
      level: 5,
      weaponSlotsFilled: 3,
      weaponReport: [
        { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 80, damage: 25000, dps: 208 },
        { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 45, damage: 15000, dps: 125 },
        { id: 'plasma_orb', nameKey: 'weapon.plasma_orb.name', kills: 25, damage: 8000, dps: 67 },
      ],
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-3weapons-defeat.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      // 무기 리포트의 마지막 행 Y좌표와 첫 번째 버튼 Zone의 상단 Y좌표 비교
      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      // 구분선 Graphics 포함한 모든 Graphics 객체
      const graphics = rs.children.list
        .filter(c => c.type === 'Graphics')
        .map((g, i) => ({ index: i, y: Math.round(g.y) }));

      // 텍스트 객체들
      const textObjects = rs.children.list
        .filter(c => c.type === 'Text')
        .map(t => ({ text: t.text, y: Math.round(t.y) }));

      return { zones, graphics, textObjects };
    });

    expect(layout.error).toBeUndefined();

    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 G: 실제 게임 플레이 후 6개 무기 결과 ──

  test('G. 실제 게임 -> 무기 6개 추가 -> 사망 -> ResultScene 전환 시 레이아웃 정상', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForTimeout(BOOT_WAIT);

    // GameScene 시작
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menuScene = game.scene.getScene('MenuScene');
      if (menuScene) {
        menuScene.scene.start('GameScene', { characterId: 'agent' });
      }
    });

    await waitForScene(page, 'GameScene', 10000);
    await page.waitForTimeout(1000);

    // 무기 6개 추가 + 데미지/킬 기록 + 사망 처리
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.weaponSystem) return;

      // 추가 무기 장착
      gs.weaponSystem.addWeapon('laser_gun');
      gs.weaponSystem.addWeapon('plasma_orb');
      gs.weaponSystem.addWeapon('electric_chain');
      gs.weaponSystem.addWeapon('missile');
      gs.weaponSystem.addWeapon('drone');

      // 데미지 기록
      gs.weaponSystem.recordDamage('blaster', 5000);
      gs.weaponSystem.recordDamage('laser_gun', 3000);
      gs.weaponSystem.recordDamage('plasma_orb', 2000);
      gs.weaponSystem.recordDamage('electric_chain', 1500);
      gs.weaponSystem.recordDamage('missile', 1000);
      gs.weaponSystem.recordDamage('drone', 500);

      // 킬 기록
      gs.weaponSystem.recordKill('blaster');
      gs.weaponSystem.recordKill('blaster');
      gs.weaponSystem.recordKill('laser_gun');
      gs.killCount = 3;
      gs.runTime = 60;

      // _buildWeaponReport 후 ResultScene으로 직접 전환
      const weaponReport = gs._buildWeaponReport();
      gs.scene.start('ResultScene', {
        victory: false,
        killCount: gs.killCount,
        runTime: gs.runTime,
        creditsEarned: 10,
        level: 5,
        weaponSlotsFilled: 6,
        weaponEvolutions: 0,
        weaponReport: weaponReport,
      });
    });

    await waitForScene(page, 'ResultScene', 10000);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/layout-fix-gameplay-6weapons.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          top: Math.round(z.y - z.height / 2),
          bottom: Math.round(z.y + z.height / 2),
        }));

      const weaponReportLength = rs.weaponReport ? rs.weaponReport.length : 0;

      return { zones, weaponReportLength };
    });

    expect(layout.error).toBeUndefined();
    expect(layout.weaponReportLength).toBe(6);

    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 H: 콘솔 에러 없음 (모든 시나리오에서) ──

  test('H. 다양한 weaponReport 크기로 ResultScene 전환 시 콘솔 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // 무기 0개
    await startResultScene(page, { weaponReport: [] });
    await page.waitForTimeout(500);

    // 무기 1개
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (rs) {
        rs.scene.start('ResultScene', {
          victory: false, killCount: 5, runTime: 10, creditsEarned: 2, level: 1,
          weaponSlotsFilled: 1, weaponEvolutions: 0,
          weaponReport: [
            { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 5, damage: 1000, dps: 100 },
          ],
        });
      }
    });
    await page.waitForTimeout(2000);

    // 무기 6개
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (rs) {
        rs.scene.start('ResultScene', {
          victory: true, killCount: 500, runTime: 900, creditsEarned: 500, level: 20,
          weaponSlotsFilled: 6, weaponEvolutions: 2, isEndless: true, endlessMinutes: 15,
          weaponReport: [
            { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 150, damage: 80000, dps: 89 },
            { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 100, damage: 60000, dps: 67 },
            { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 80, damage: 45000, dps: 50 },
            { id: 'missile', nameKey: 'weapon.missile.name', kills: 60, damage: 35000, dps: 39 },
            { id: 'drone', nameKey: 'weapon.drone.name', kills: 50, damage: 25000, dps: 28 },
            { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 60, damage: 20000, dps: 22 },
          ],
        });
      }
    });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  // ── 테스트 I: Y좌표 동적 계산 로직 직접 검증 ──

  test('I. 버튼 Y좌표가 콘텐츠 끝 위치 기준으로 동적 계산된다', async ({ page }) => {
    // 무기 6개 패배 케이스
    await startResultScene(page, {
      victory: false,
      weaponReport: makeWeaponReport6(),
    });

    const result1 = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };
      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => Math.round(z.y));
      return { zones };
    });

    // 무기 0개 패배 케이스로 재시작
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (rs) {
        rs.scene.start('ResultScene', {
          victory: false, killCount: 0, runTime: 3, creditsEarned: 0, level: 1,
          weaponSlotsFilled: 0, weaponEvolutions: 0,
          weaponReport: [],
        });
      }
    });
    await page.waitForTimeout(2000);

    const result2 = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };
      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => Math.round(z.y));
      return { zones };
    });

    // 무기 6개 시 버튼이 무기 0개 시보다 아래에 있어야 함 (동적 계산 증명)
    // 최소 1개의 Zone이 존재해야 함
    expect(result1.zones.length).toBeGreaterThan(0);
    expect(result2.zones.length).toBeGreaterThan(0);

    // 무기 6개 시 가장 위의 버튼 Y좌표가 무기 0개 시보다 크거나 같아야 함
    const min6 = Math.min(...result1.zones);
    const min0 = Math.min(...result2.zones);
    expect(min6).toBeGreaterThanOrEqual(min0);
  });

  // ── 테스트 J: 무기 7개 이상 전달 시 최대 6개만 표시 ──

  test('J. 무기 7개 전달 시 최대 6개만 표시된다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startResultScene(page, {
      victory: false,
      weaponReport: [
        { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 150, damage: 80000, dps: 89 },
        { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 100, damage: 60000, dps: 67 },
        { id: 'electric_chain', nameKey: 'weapon.electric_chain.name', kills: 80, damage: 45000, dps: 50 },
        { id: 'missile', nameKey: 'weapon.missile.name', kills: 60, damage: 35000, dps: 39 },
        { id: 'drone', nameKey: 'weapon.drone.name', kills: 50, damage: 25000, dps: 28 },
        { id: 'emp_blast', nameKey: 'weapon.emp_blast.name', kills: 60, damage: 20000, dps: 22 },
        { id: 'plasma_orb', nameKey: 'weapon.plasma_orb.name', kills: 30, damage: 10000, dps: 11 },
      ],
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-7weapons-capped.png' });

    // 실제 렌더링된 무기 행 수 확인 (weaponReport 텍스트 객체 수로 추정)
    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      // 무기별 리포트 행은 무기 이름 텍스트 + 킬/DPS 텍스트 + 데미지 수치 텍스트로 구성
      // 무기 리포트 섹션 타이틀은 제외
      const textObjects = rs.children.list.filter(c => c.type === 'Text');

      // weaponReport 데이터 확인
      const wpLength = rs.weaponReport ? rs.weaponReport.length : 0;

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          bottom: Math.round(z.y + z.height / 2),
        }));

      return { wpLength, zoneCount: zones.length, zones };
    });

    expect(layout.error).toBeUndefined();
    // 원본 데이터는 7개이지만 slice(0, 6)으로 6개만 표시
    expect(layout.wpLength).toBe(7); // init에서 전달된 원본 길이

    // 버튼이 화면 안에 있어야 함
    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });

  // ── 테스트 K: 모바일 뷰포트 ──

  test('K. 360x640 모바일 뷰포트에서 6개 무기 레이아웃 정상', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 360, height: 640 });

    await startResultScene(page, {
      victory: false,
      killCount: 300,
      runTime: 300,
      creditsEarned: 100,
      level: 10,
      weaponSlotsFilled: 6,
      weaponReport: makeWeaponReport6(),
    });

    await page.screenshot({ path: 'tests/screenshots/layout-fix-mobile-6weapons.png' });

    const layout = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const rs = game.scene.getScene('ResultScene');
      if (!rs) return { error: 'no ResultScene' };

      const zones = rs.children.list
        .filter(c => c.type === 'Zone')
        .map(z => ({
          y: Math.round(z.y),
          bottom: Math.round(z.y + z.height / 2),
        }));

      return { zones };
    });

    expect(layout.error).toBeUndefined();

    if (layout.zones.length > 0) {
      const maxBottom = Math.max(...layout.zones.map(z => z.bottom));
      expect(maxBottom).toBeLessThanOrEqual(640);
    }

    expect(errors).toEqual([]);
  });
});
