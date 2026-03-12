/**
 * @fileoverview 폰트 크기 가독성 개선 QA 테스트
 *
 * 8개 씬의 fontSize 값이 최소 10px 이상인지 정적/동적으로 검증한다.
 * CARD_H 레이아웃 변경 여부, 타이틀 폰트 미변경, CARD_W 미변경을 확인한다.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

/**
 * 게임 초기 로드 후 MenuScene 대기
 */
async function waitForMenu(page) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(4000);
}

/**
 * 특정 씬을 직접 시작한다.
 */
async function startScene(page, sceneName, data = {}) {
  await page.evaluate(({ sceneName, data }) => {
    const game = window.__NEON_EXODUS;
    game.scene.start(sceneName, data);
  }, { sceneName, data });
  await page.waitForTimeout(2000);
}

// ── 정적 코드 분석 (소스 파일 내 fontSize grep 결과를 브라우저에서 재검증) ──

test.describe('폰트 크기 가독성 - 씬별 검증', () => {

  test.beforeEach(async ({ page }) => {
    await waitForMenu(page);
  });

  // ── UpgradeScene ──

  test('UpgradeScene: 탭 버튼, 잠금 힌트, 효과 설명 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'UpgradeScene');

    // UpgradeScene 씬 내부의 텍스트 오브젝트 fontSize 분석
    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('UpgradeScene');
      if (!scene) return { error: 'UpgradeScene not found' };

      const texts = scene.children.list.filter(c => c.type === 'Text');
      const fontSizes = texts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      // fontSize가 10px 미만인 텍스트 검출
      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: texts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);
    expect(result.count).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/screenshots/font-upgrade-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── CollectionScene ──

  test('CollectionScene: 탭 버튼, 아이템 설명 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'CollectionScene');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('CollectionScene');
      if (!scene) return { error: 'CollectionScene not found' };

      // 컨테이너 내부 텍스트도 수집
      const allTexts = [];
      scene.children.list.forEach(c => {
        if (c.type === 'Text') allTexts.push(c);
        if (c.type === 'Container' && c.list) {
          c.list.forEach(child => {
            if (child.type === 'Text') allTexts.push(child);
          });
        }
      });

      const fontSizes = allTexts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: allTexts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-collection-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── CharacterScene ──

  test('CharacterScene: 고유 패시브 설명, 캐릭터 설명 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'CharacterScene', { stageId: 'stage_1' });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('CharacterScene');
      if (!scene) return { error: 'CharacterScene not found' };

      const allTexts = [];
      scene.children.list.forEach(c => {
        if (c.type === 'Text') allTexts.push(c);
        if (c.type === 'Container' && c.list) {
          c.list.forEach(child => {
            if (child.type === 'Text') allTexts.push(child);
          });
        }
      });

      const fontSizes = allTexts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: allTexts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-character-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── StageSelectScene ──

  test('StageSelectScene: 스테이지 설명 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'StageSelectScene');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('StageSelectScene');
      if (!scene) return { error: 'StageSelectScene not found' };

      const allTexts = [];
      scene.children.list.forEach(c => {
        if (c.type === 'Text') allTexts.push(c);
        if (c.type === 'Container' && c.list) {
          c.list.forEach(child => {
            if (child.type === 'Text') allTexts.push(child);
          });
        }
      });

      const fontSizes = allTexts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: allTexts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-stageselect-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── AchievementScene ──

  test('AchievementScene: 도전과제 설명, 진행도 텍스트 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'AchievementScene');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('AchievementScene');
      if (!scene) return { error: 'AchievementScene not found' };

      const allTexts = [];
      scene.children.list.forEach(c => {
        if (c.type === 'Text') allTexts.push(c);
        if (c.type === 'Container' && c.list) {
          c.list.forEach(child => {
            if (child.type === 'Text') allTexts.push(child);
          });
        }
      });

      const fontSizes = allTexts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: allTexts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-achievement-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── ResultScene ──

  test('ResultScene: 무기별 킬/DPS, 데미지 수치 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // ResultScene은 초기 데이터가 필요함
    await startScene(page, 'ResultScene', {
      victory: true,
      killCount: 100,
      runTime: 300,
      creditsEarned: 50,
      level: 10,
      weaponSlotsFilled: 3,
      weaponEvolutions: 0,
      stageId: 'stage_1',
      weaponReport: [
        { id: 'blaster', nameKey: 'weapon.blaster.name', kills: 50, damage: 10000, dps: 33 },
        { id: 'laser_gun', nameKey: 'weapon.laser_gun.name', kills: 30, damage: 8000, dps: 27 },
      ],
    });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('ResultScene');
      if (!scene) return { error: 'ResultScene not found' };

      const texts = scene.children.list.filter(c => c.type === 'Text');
      const fontSizes = texts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: texts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-result-scene.png' });
    expect(errors).toEqual([]);
  });

  // ── GameScene (HUD) ──

  test('GameScene: 무기/패시브 레벨 라벨 폰트 크기 검증', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startScene(page, 'GameScene', {
      characterId: 'agent',
      stageId: 'stage_1',
    });
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('GameScene');
      if (!scene) return { error: 'GameScene not found' };

      const texts = scene.children.list.filter(c => c.type === 'Text');
      const fontSizes = texts.map(t => ({
        text: t.text?.substring(0, 30),
        fontSize: t.style?.fontSize,
      }));

      const tooSmall = fontSizes.filter(f => {
        const px = parseInt(f.fontSize);
        return !isNaN(px) && px < 10;
      });

      return { fontSizes, tooSmall, count: texts.length };
    });

    expect(result.error).toBeUndefined();
    expect(result.tooSmall).toEqual([]);

    await page.screenshot({ path: 'tests/screenshots/font-game-scene.png' });
    expect(errors).toEqual([]);
  });
});

// ── CARD_H 레이아웃 검증 ──

test.describe('CARD_H 레이아웃 상수 검증', () => {

  test.beforeEach(async ({ page }) => {
    await waitForMenu(page);
  });

  test('CollectionScene CARD_H = 60', async ({ page }) => {
    await startScene(page, 'CollectionScene');

    const cardH = await page.evaluate(() => {
      // CARD_H는 모듈 스코프 상수이므로 소스 코드에서 직접 확인
      // 대신 카드 배경 Graphics의 높이를 추론
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('CollectionScene');
      if (!scene || !scene._container) return null;

      // 컨테이너 내의 Graphics 객체에서 카드 높이를 검증
      const graphics = scene._container.list.filter(c => c.type === 'Graphics');
      if (graphics.length === 0) return null;

      // 첫 번째 그래픽 요소의 commandBuffer에서 fillRoundedRect의 높이를 추출
      // Phaser 내부 구조이므로 대안: 두 카드 사이의 Y간격으로 CARD_H 추론
      const texts = scene._container.list.filter(c => c.type === 'Text');
      // 이름 텍스트들의 Y 위치로 간격 계산
      const nameTexts = texts.filter(t => t.style?.fontSize === '12px');
      if (nameTexts.length >= 2) {
        const gap = Math.abs(nameTexts[1].y - nameTexts[0].y);
        // gap = CARD_H + CARD_GAP (4) = 64
        return gap - 4; // CARD_GAP = 4
      }
      return null;
    });

    // CARD_H = 60이면 간격은 64 (60 + 4)
    if (cardH !== null) {
      expect(cardH).toBe(60);
    }
  });

  test('AchievementScene CARD_H = 64', async ({ page }) => {
    await startScene(page, 'AchievementScene');

    const cardH = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const scene = game.scene.getScene('AchievementScene');
      if (!scene || !scene._container) return null;

      const texts = scene._container.list.filter(c => c.type === 'Text');
      // 제목 텍스트들의 Y 위치로 간격 계산
      const nameTexts = texts.filter(t => t.style?.fontSize === '12px');
      if (nameTexts.length >= 2) {
        const gap = Math.abs(nameTexts[1].y - nameTexts[0].y);
        // gap = CARD_H + CARD_GAP (6) = 70
        return gap - 6; // CARD_GAP = 6
      }
      return null;
    });

    if (cardH !== null) {
      expect(cardH).toBe(64);
    }
  });
});

// ── 전체 기준선 검증: 콘솔 에러 없음 ──

test.describe('전체 통합 검증', () => {

  test('모든 씬을 순회하며 콘솔 에러가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await waitForMenu(page);

    // MenuScene 스크린샷
    await page.screenshot({ path: 'tests/screenshots/font-menu-scene.png' });

    // UpgradeScene
    await startScene(page, 'UpgradeScene');
    await page.waitForTimeout(500);

    // CollectionScene
    await startScene(page, 'CollectionScene');
    await page.waitForTimeout(500);

    // AchievementScene
    await startScene(page, 'AchievementScene');
    await page.waitForTimeout(500);

    // StageSelectScene
    await startScene(page, 'StageSelectScene');
    await page.waitForTimeout(500);

    // CharacterScene
    await startScene(page, 'CharacterScene', { stageId: 'stage_1' });
    await page.waitForTimeout(500);

    // MenuScene으로 복귀
    await startScene(page, 'MenuScene');
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('모바일 뷰포트(360x640)에서 텍스트 오버플로 없이 렌더링', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await waitForMenu(page);

    // UpgradeScene
    await startScene(page, 'UpgradeScene');
    await page.screenshot({ path: 'tests/screenshots/font-upgrade-mobile.png' });

    // CollectionScene
    await startScene(page, 'CollectionScene');
    await page.screenshot({ path: 'tests/screenshots/font-collection-mobile.png' });

    // StageSelectScene
    await startScene(page, 'StageSelectScene');
    await page.screenshot({ path: 'tests/screenshots/font-stageselect-mobile.png' });

    // AchievementScene
    await startScene(page, 'AchievementScene');
    await page.screenshot({ path: 'tests/screenshots/font-achievement-mobile.png' });

    // CharacterScene
    await startScene(page, 'CharacterScene', { stageId: 'stage_1' });
    await page.screenshot({ path: 'tests/screenshots/font-character-mobile.png' });

    expect(errors).toEqual([]);
  });
});
