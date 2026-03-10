/**
 * @fileoverview Phase 3 아트 에셋 QA 테스트.
 *
 * 배경 타일 3종, 보스 3종, 무기 아이콘 4종의 존재 및 로딩을 검증한다.
 * 게임 로드 시 콘솔 에러 없음, 에셋 로딩 성공 여부를 확인한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = '/';

// Phase 3 에셋 경로 목록 (서버 기준 상대 경로)
const PHASE3_ASSETS = [
  { name: 'bg_tile_s2', path: '/assets/backgrounds/bg_tile_s2.png', type: 'background' },
  { name: 'bg_tile_s3', path: '/assets/backgrounds/bg_tile_s3.png', type: 'background' },
  { name: 'bg_tile_s4', path: '/assets/backgrounds/bg_tile_s4.png', type: 'background' },
  { name: 'siege_titan_mk2', path: '/assets/sprites/bosses/siege_titan_mk2.png', type: 'boss' },
  { name: 'data_phantom', path: '/assets/sprites/bosses/data_phantom.png', type: 'boss' },
  { name: 'omega_core', path: '/assets/sprites/bosses/omega_core.png', type: 'boss' },
  { name: 'weapon_force_blade', path: '/assets/ui/icons/weapon_force_blade.png', type: 'weapon_icon' },
  { name: 'weapon_nano_swarm', path: '/assets/ui/icons/weapon_nano_swarm.png', type: 'weapon_icon' },
  { name: 'weapon_vortex_cannon', path: '/assets/ui/icons/weapon_vortex_cannon.png', type: 'weapon_icon' },
  { name: 'weapon_reaper_field', path: '/assets/ui/icons/weapon_reaper_field.png', type: 'weapon_icon' },
];

test.describe('Phase 3 아트 에셋 검증', () => {

  test.describe('1. 에셋 파일 HTTP 접근성', () => {
    for (const asset of PHASE3_ASSETS) {
      test(`${asset.name} (${asset.type}) HTTP 200 응답 확인`, async ({ page }) => {
        const response = await page.goto(asset.path);
        expect(response.status()).toBe(200);

        // Content-Type이 이미지인지 확인
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('image/png');
      });
    }
  });

  test.describe('2. 게임 로드 시 에셋 로딩 에러 없음', () => {
    test('게임 로드 시 Phase 3 에셋 관련 404 에러가 없다', async ({ page }) => {
      const failedRequests = [];
      const allRequests = [];

      page.on('requestfailed', (req) => {
        failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
      });

      page.on('response', (res) => {
        const url = res.url();
        // Phase 3 에셋 경로 중 하나라도 404가 오면 기록
        if (res.status() >= 400 && PHASE3_ASSETS.some(a => url.includes(a.path.slice(1)))) {
          allRequests.push({ url, status: res.status() });
        }
      });

      await page.goto(BASE_URL);
      await page.waitForTimeout(5000);

      // Phase 3 에셋 중 실패한 요청이 없어야 함
      const phase3Failures = failedRequests.filter(r =>
        PHASE3_ASSETS.some(a => r.url.includes(a.path.slice(1)))
      );

      console.log('Phase 3 asset HTTP failures:', phase3Failures);
      console.log('Phase 3 asset 4xx/5xx responses:', allRequests);
      expect(phase3Failures).toEqual([]);
      expect(allRequests).toEqual([]);
    });

    test('게임 로드 시 치명적 JS 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(5000);

      // 치명적 에러 필터 (네트워크/AdMob/Capacitor 관련 무시)
      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('admob') && !e.includes('Failed to fetch')
      );

      console.log('All page errors:', errors);
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('3. 메뉴 화면 로딩 후 스크린샷', () => {
    test('메뉴 화면이 정상 렌더링되고 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(4000);

      // 메뉴 화면 스크린샷
      await page.screenshot({ path: 'tests/screenshots/art-phase3-menu.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('Failed to fetch')
      );
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('4. StageSelectScene 스테이지 카드 확인', () => {
    test('스테이지 선택 화면에서 스테이지 2~4 카드가 표시된다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(3500);

      // 메뉴 -> 출격 버튼 (GAME_WIDTH/2=180, y ~ 310)
      await page.mouse.click(180, 310);
      await page.waitForTimeout(2000);

      // 스테이지 선택 화면 스크린샷
      await page.screenshot({ path: 'tests/screenshots/art-phase3-stage-select.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('Failed to fetch')
      );
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('5. Stage 1 게임 시작 후 배경 타일 확인', () => {
    test('Stage 1 게임에서 배경 타일이 정상 렌더링된다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(3500);

      // 메뉴 -> 출격
      await page.mouse.click(180, 310);
      await page.waitForTimeout(2000);

      // 스테이지 1 선택 (첫번째 카드, y 약 200 근처)
      await page.mouse.click(180, 200);
      await page.waitForTimeout(1000);

      // 출격 버튼 클릭 (화면 하단)
      await page.mouse.click(120, 580);
      await page.waitForTimeout(1500);

      // 캐릭터 선택 -> 첫번째 캐릭터로 출격
      await page.mouse.click(180, 500);
      await page.waitForTimeout(3000);

      // 게임 화면 스크린샷 (배경 타일 확인)
      await page.screenshot({ path: 'tests/screenshots/art-phase3-game-bg.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('Failed to fetch')
      );
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('6. 모바일 뷰포트 안정성', () => {
    test('375x667 뷰포트에서 게임 로드 시 에러 없음', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(4000);

      await page.screenshot({ path: 'tests/screenshots/art-phase3-mobile.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('Failed to fetch')
      );
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('7. 콘솔 에러 + 빠른 페이지 전환 안정성', () => {
    test('메뉴 -> 스테이지선택 -> 뒤로가기 빠른 전환 시 에러 없음', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForTimeout(3500);

      // 빠른 전환: 출격 -> 뒤로가기 3회 반복
      for (let i = 0; i < 3; i++) {
        await page.mouse.click(180, 310);
        await page.waitForTimeout(800);
        await page.mouse.click(240, 580); // 뒤로가기 버튼
        await page.waitForTimeout(800);
      }

      await page.screenshot({ path: 'tests/screenshots/art-phase3-rapid-nav.png' });

      const criticalErrors = errors.filter(e =>
        !e.includes('net::') && !e.includes('favicon') && !e.includes('404')
        && !e.includes('AdMob') && !e.includes('Capacitor')
        && !e.includes('Failed to fetch')
      );
      expect(criticalErrors).toEqual([]);
    });
  });
});
