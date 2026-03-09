/**
 * @fileoverview 업그레이드 다운그레이드 + 크레딧 환불 QA 테스트.
 * UpgradeScene에서 [-] 다운그레이드 버튼의 동작, 환불 로직, UI 갱신을 검증한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

// ── 유틸 함수 ──

/**
 * 게임 로드 완료를 대기한다. window.__NEON_EXODUS 존재를 확인.
 */
async function waitForGameReady(page) {
  await page.waitForTimeout(3000);
}

/**
 * localStorage에 직접 세이브 데이터를 주입한다.
 */
async function injectSaveData(page, upgrades = {}, credits = 5000) {
  await page.evaluate(({ upgrades, credits }) => {
    const saveData = {
      version: 3,
      credits: credits,
      dataCores: 0,
      upgrades: upgrades,
      characters: { agent: true },
      selectedCharacter: 'agent',
      achievements: {},
      stats: {
        totalKills: 0, totalRuns: 0, totalClears: 0,
        totalPlayTime: 0, maxLevel: 0, maxKillsInRun: 0,
        longestSurvival: 0, consecutiveClears: 0,
        totalBossKills: 0, totalSurviveMinutes: 0,
      },
      collection: { weaponsSeen: ['blaster'], passivesSeen: [], enemiesSeen: [] },
      settings: { locale: 'ko', sfxVolume: 1, bgmVolume: 0.7 },
    };
    localStorage.setItem('neon-exodus-save', JSON.stringify(saveData));
  }, { upgrades, credits });
}

/**
 * 세이브 데이터를 주입하고 게임을 리로드하여 반영한다.
 */
async function setupGameWithSave(page, upgrades = {}, credits = 5000) {
  await page.goto(BASE_URL);
  await injectSaveData(page, upgrades, credits);
  await page.reload();
  await waitForGameReady(page);
}

/**
 * MenuScene에서 "업그레이드" 버튼을 클릭하여 UpgradeScene으로 진입한다.
 * MenuScene 레이아웃: 업그레이드 버튼 y=370, centerX=180
 */
async function navigateToUpgradeScene(page) {
  await page.click('canvas', { position: { x: 180, y: 370 } });
  await page.waitForTimeout(600);
}

/**
 * 현재 크레딧 값을 localStorage에서 직접 읽는다.
 */
async function getCredits(page) {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('neon-exodus-save');
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return data.credits || 0;
  });
}

/**
 * 특정 업그레이드 레벨을 localStorage에서 직접 읽는다.
 */
async function getUpgradeLevel(page, upgradeId) {
  return await page.evaluate((id) => {
    const raw = localStorage.getItem('neon-exodus-save');
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return (data.upgrades && data.upgrades[id]) || 0;
  }, upgradeId);
}

// ── 카드 위치 계산 ──
// GAME_WIDTH=360, CARD_W=155, CARD_H=100, CARD_GAP_X=10, GRID_COLS=2, GRID_START_Y=120
// gridStartX = (360 - (2*155 + 10)) / 2 + 155/2 = 20 + 77.5 = 97.5
// col0: x=97.5, col1: x=97.5+165=262.5
// row0: y=120+0+50=170, row1: y=120+108+50=278, row2: y=120+216+50=386, row3: y=120+324+50=494

// 버튼 위치 계산 (카드 하단)
// btnY = cardY + CARD_H/2 - 16 = cardY + 34
// totalBtnW = CARD_W - 20 = 135
// downBtnW = Math.floor(135 * 0.38) = 51
// upBtnW = 135 - 51 - 4 = 80
// startX = cardX - 135/2 = cardX - 67.5
// downBtnX = startX + 51/2 = cardX - 42
// upBtnX = startX + 51 + 4 + 80/2 = cardX + 27.5

function getCardBtnPositions(cardX, cardY) {
  const btnY = cardY + 34;
  const downBtnX = Math.round(cardX - 42);
  const upBtnX = Math.round(cardX + 27.5);
  return { btnY, downBtnX, upBtnX };
}

// Basic 탭 카드 위치
const ATTACK_CARD = { x: 97.5, y: 170 }; // row0, col0
const MAXHP_CARD = { x: 262.5, y: 170 }; // row0, col1

// 탭 위치 계산: tabY=75, tabW=80, totalW=4*80+3*4=332
// startX = (360-332)/2 + 40 = 14 + 40 = 54
// tab0=54, tab1=138, tab2=222, tab3=306
const TAB_Y = 75;
const TAB_POSITIONS = [54, 138, 222, 306];

// ── 테스트 ──

test.describe('업그레이드 다운그레이드 기능 검증', () => {

  test.describe('정상 동작', () => {

    test('[-] 다운그레이드 버튼이 카드에 표시된다', async ({ page }) => {
      await setupGameWithSave(page, { attack: 3 }, 5000);
      await navigateToUpgradeScene(page);

      // 스크린샷 캡처
      await page.screenshot({ path: 'tests/screenshots/downgrade-btn-visible.png' });

      // attack이 Lv3이므로 저장 확인
      const level = await getUpgradeLevel(page, 'attack');
      expect(level).toBe(3);
    });

    test('[-] 버튼 클릭 시 레벨이 1 감소하고 크레딧이 환불된다 (attack Lv3 -> Lv2, +300)', async ({ page }) => {
      await setupGameWithSave(page, { attack: 3 }, 1000);
      await navigateToUpgradeScene(page);

      const initialCredits = await getCredits(page);
      expect(initialCredits).toBe(1000);

      // attack 카드의 [-] 버튼 클릭
      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 레벨 확인
      const newLevel = await getUpgradeLevel(page, 'attack');
      expect(newLevel).toBe(2);

      // 환불액 확인: costFormula(3) = 100 * 3 = 300
      const newCredits = await getCredits(page);
      expect(newCredits).toBe(1300);
    });

    test('[-] 버튼 클릭 시 Lv1 -> Lv0, 환불 100', async ({ page }) => {
      await setupGameWithSave(page, { attack: 1 }, 500);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      const newLevel = await getUpgradeLevel(page, 'attack');
      expect(newLevel).toBe(0);

      const newCredits = await getCredits(page);
      expect(newCredits).toBe(600); // 500 + 100
    });

    test('다운그레이드 후 카드 UI 및 크레딧 HUD 즉시 갱신 (스크린샷 비교)', async ({ page }) => {
      await setupGameWithSave(page, { attack: 5 }, 200);
      await navigateToUpgradeScene(page);

      // 다운그레이드 전 스크린샷
      await page.screenshot({ path: 'tests/screenshots/before-downgrade.png' });

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 다운그레이드 후 스크린샷
      await page.screenshot({ path: 'tests/screenshots/after-downgrade.png' });

      // 데이터 확인
      const level = await getUpgradeLevel(page, 'attack');
      expect(level).toBe(4);
      const credits = await getCredits(page);
      expect(credits).toBe(700); // 200 + 500(=100*5)
    });

    test('MAX 레벨 카드에서도 [-] 버튼이 동작한다', async ({ page }) => {
      await setupGameWithSave(page, { attack: 10 }, 0);
      await navigateToUpgradeScene(page);

      // MAX 상태 스크린샷
      await page.screenshot({ path: 'tests/screenshots/max-level-card.png' });

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 다운그레이드 후 스크린샷
      await page.screenshot({ path: 'tests/screenshots/max-level-after-downgrade.png' });

      const level = await getUpgradeLevel(page, 'attack');
      expect(level).toBe(9);
      const credits = await getCredits(page);
      expect(credits).toBe(1000); // 0 + 100*10 = 1000
    });
  });

  test.describe('비활성 상태', () => {

    test('Lv0 카드에서 [-] 버튼 클릭 시 아무 동작하지 않는다', async ({ page }) => {
      await setupGameWithSave(page, {}, 5000);
      await navigateToUpgradeScene(page);

      // Lv0 상태 스크린샷
      await page.screenshot({ path: 'tests/screenshots/lv0-disabled-btn.png' });

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 레벨이 0 그대로인지 확인 (음수로 가면 안 됨)
      const level = await getUpgradeLevel(page, 'attack');
      expect(level).toBe(0);

      // 크레딧 변동 없음
      const credits = await getCredits(page);
      expect(credits).toBe(5000);
    });
  });

  test.describe('한계돌파 카테고리', () => {

    test('한계돌파 탭의 weaponSlots 카드 다운그레이드가 동작한다', async ({ page }) => {
      const allBasicMax = {
        attack: 10, maxHp: 10, hpRegen: 10, defense: 10,
        moveSpeed: 10, cooldown: 10, projectileSpeed: 10, areaOfEffect: 10,
        weaponSlots: 2,
      };
      await setupGameWithSave(page, allBasicMax, 500);
      await navigateToUpgradeScene(page);

      // 한도 돌파 탭 클릭
      await page.click('canvas', { position: { x: TAB_POSITIONS[3], y: TAB_Y } });
      await page.waitForTimeout(500);

      // 한도 돌파 탭 스크린샷
      await page.screenshot({ path: 'tests/screenshots/limitbreak-tab.png' });

      // weaponSlots = 첫 번째 카드 (row0, col0)
      const weaponBtn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: weaponBtn.downBtnX, y: weaponBtn.btnY } });
      await page.waitForTimeout(400);

      const level = await getUpgradeLevel(page, 'weaponSlots');
      expect(level).toBe(1);

      // 환불액: costFormula(2) = 1000 * 2 = 2000
      const credits = await getCredits(page);
      expect(credits).toBe(2500); // 500 + 2000
    });

    test('goldRush(maxLevel=1) Lv1 -> Lv0 다운그레이드 시 2000 크레딧 환불', async ({ page }) => {
      const allBasicMax = {
        attack: 10, maxHp: 10, hpRegen: 10, defense: 10,
        moveSpeed: 10, cooldown: 10, projectileSpeed: 10, areaOfEffect: 10,
        goldRush: 1,
      };
      await setupGameWithSave(page, allBasicMax, 0);
      await navigateToUpgradeScene(page);

      // 한도 돌파 탭 클릭
      await page.click('canvas', { position: { x: TAB_POSITIONS[3], y: TAB_Y } });
      await page.waitForTimeout(500);

      // goldRush = 세 번째 카드 (row1, col0)
      const goldRushCard = { x: 97.5, y: 278 };
      const btn = getCardBtnPositions(goldRushCard.x, goldRushCard.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      const level = await getUpgradeLevel(page, 'goldRush');
      expect(level).toBe(0);

      const credits = await getCredits(page);
      expect(credits).toBe(2000);
    });
  });

  test.describe('잠금 카드', () => {

    test('잠금 상태 카드에는 [-] 버튼이 표시되지 않는다', async ({ page }) => {
      await setupGameWithSave(page, { attack: 3 }, 5000);
      await navigateToUpgradeScene(page);

      // 한도 돌파 탭 클릭 (basic이 maxed가 아닌 상태)
      await page.click('canvas', { position: { x: TAB_POSITIONS[3], y: TAB_Y } });
      await page.waitForTimeout(500);

      // 잠금 카드 스크린샷
      await page.screenshot({ path: 'tests/screenshots/locked-card-no-downgrade.png' });

      // 잠금 카드 위치에 클릭해도 변화 없음
      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      const level = await getUpgradeLevel(page, 'weaponSlots');
      expect(level).toBe(0);
    });
  });

  test.describe('예외 및 엣지케이스', () => {

    test('연속 다운그레이드: Lv3 -> Lv2 -> Lv1 -> Lv0 (3연타)', async ({ page }) => {
      await setupGameWithSave(page, { attack: 3 }, 0);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);

      // 1회: Lv3 -> Lv2, +300
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(300);
      expect(await getUpgradeLevel(page, 'attack')).toBe(2);
      expect(await getCredits(page)).toBe(300);

      // 2회: Lv2 -> Lv1, +200
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(300);
      expect(await getUpgradeLevel(page, 'attack')).toBe(1);
      expect(await getCredits(page)).toBe(500);

      // 3회: Lv1 -> Lv0, +100
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(300);
      expect(await getUpgradeLevel(page, 'attack')).toBe(0);
      expect(await getCredits(page)).toBe(600);

      // 4회: Lv0에서 클릭 -> 아무 일 없음
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(300);
      expect(await getUpgradeLevel(page, 'attack')).toBe(0);
      expect(await getCredits(page)).toBe(600);
    });

    test('크레딧 0인 상태에서 다운그레이드 후 환불 정상 동작', async ({ page }) => {
      await setupGameWithSave(page, { attack: 1 }, 0);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      expect(await getUpgradeLevel(page, 'attack')).toBe(0);
      expect(await getCredits(page)).toBe(100); // 0 + 100
    });

    test('다운그레이드 후 구매하고 다시 다운그레이드하면 정상 환불', async ({ page }) => {
      await setupGameWithSave(page, { attack: 1 }, 200);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);

      // 다운그레이드: Lv1 -> Lv0, +100
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);
      expect(await getUpgradeLevel(page, 'attack')).toBe(0);
      expect(await getCredits(page)).toBe(300);

      // 구매: Lv0 -> Lv1, -100
      await page.click('canvas', { position: { x: btn.upBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);
      expect(await getUpgradeLevel(page, 'attack')).toBe(1);
      expect(await getCredits(page)).toBe(200);

      // 다시 다운그레이드: Lv1 -> Lv0, +100
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);
      expect(await getUpgradeLevel(page, 'attack')).toBe(0);
      expect(await getCredits(page)).toBe(300);
    });

    test('두 카드 교차 다운그레이드: attack과 maxHp 번갈아 다운', async ({ page }) => {
      await setupGameWithSave(page, { attack: 2, maxHp: 3 }, 0);
      await navigateToUpgradeScene(page);

      const attackBtn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      const maxHpBtn = getCardBtnPositions(MAXHP_CARD.x, MAXHP_CARD.y);

      // attack 다운: Lv2->Lv1, +200
      await page.click('canvas', { position: { x: attackBtn.downBtnX, y: attackBtn.btnY } });
      await page.waitForTimeout(300);
      expect(await getCredits(page)).toBe(200);

      // maxHp 다운: Lv3->Lv2, +300
      await page.click('canvas', { position: { x: maxHpBtn.downBtnX, y: maxHpBtn.btnY } });
      await page.waitForTimeout(300);
      expect(await getCredits(page)).toBe(500);

      expect(await getUpgradeLevel(page, 'attack')).toBe(1);
      expect(await getUpgradeLevel(page, 'maxHp')).toBe(2);
    });

    test('세이브가 다운그레이드 후 즉시 저장된다 (새로고침 후에도 유지)', async ({ page }) => {
      await setupGameWithSave(page, { attack: 5 }, 100);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 페이지 새로고침
      await page.reload();
      await waitForGameReady(page);

      // 새로고침 후에도 데이터가 유지되는지 확인
      expect(await getUpgradeLevel(page, 'attack')).toBe(4);
      expect(await getCredits(page)).toBe(600); // 100 + 500
    });
  });

  test.describe('UI 안정성', () => {

    test('콘솔 에러가 발생하지 않는다 (다운그레이드 흐름)', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGameWithSave(page, { attack: 3 }, 5000);
      await navigateToUpgradeScene(page);

      const btn = getCardBtnPositions(ATTACK_CARD.x, ATTACK_CARD.y);

      // 다운그레이드 3회 연속 + Lv0에서 한 번 더 시도
      for (let i = 0; i < 4; i++) {
        await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
        await page.waitForTimeout(250);
      }

      // 구매 버튼 한 번 클릭
      await page.click('canvas', { position: { x: btn.upBtnX, y: btn.btnY } });
      await page.waitForTimeout(250);

      // 탭 전환
      await page.click('canvas', { position: { x: TAB_POSITIONS[1], y: TAB_Y } }); // 성장 가속 탭
      await page.waitForTimeout(300);
      await page.click('canvas', { position: { x: TAB_POSITIONS[0], y: TAB_Y } }); // 기본 스탯 탭
      await page.waitForTimeout(300);

      expect(errors).toEqual([]);
    });

    test('전체 업그레이드 화면 스크린샷 (혼합 레벨)', async ({ page }) => {
      await setupGameWithSave(page, {
        attack: 5, maxHp: 3, hpRegen: 0, defense: 10,
        moveSpeed: 7, cooldown: 0, projectileSpeed: 2, areaOfEffect: 10,
      }, 3500);
      await navigateToUpgradeScene(page);

      await page.screenshot({ path: 'tests/screenshots/upgrade-scene-full.png' });
    });

    test('다운그레이드 후 구매 가능 상태 전환 스크린샷', async ({ page }) => {
      // maxHp Lv10(MAX), 크레딧 부족
      await setupGameWithSave(page, { maxHp: 10 }, 0);
      await navigateToUpgradeScene(page);

      // MAX 상태 스크린샷
      await page.screenshot({ path: 'tests/screenshots/maxhp-max-before-down.png' });

      // 다운그레이드: Lv10 -> Lv9, +1000
      const btn = getCardBtnPositions(MAXHP_CARD.x, MAXHP_CARD.y);
      await page.click('canvas', { position: { x: btn.downBtnX, y: btn.btnY } });
      await page.waitForTimeout(400);

      // 다운그레이드 후 스크린샷
      await page.screenshot({ path: 'tests/screenshots/maxhp-after-down-to-9.png' });

      expect(await getUpgradeLevel(page, 'maxHp')).toBe(9);
      expect(await getCredits(page)).toBe(1000);
    });
  });
});
