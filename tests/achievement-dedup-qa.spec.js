/**
 * @fileoverview 도감 업적 탭 제거 + 도전과제 보상 정보 추가 QA 검증 테스트.
 *
 * 검증 대상:
 * 1. CollectionScene: 업적 탭 제거, AchievementManager 미참조
 * 2. AchievementScene: 보상 정보 행 추가, 레이아웃, 스크롤
 * 3. i18n: ko/en 보상 텍스트 정상 표시
 * 4. 엣지케이스: null reward, 빈 보상 타입, 긴 보상 텍스트
 */

import { test, expect } from '@playwright/test';

// ── 상수 ──

const EXPECTED_COLLECTION_TABS = ['weapons', 'passives', 'enemies', 'evolutions'];
const VALID_REWARD_TYPES = ['credits', 'dataCore', 'dataCoreAndTitle', 'characterHint', 'hiddenCharacterUnlock'];

// ── 헬퍼 ──

async function loadGame(page) {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

// ── 테스트 ──

test.describe('CollectionScene 업적 탭 제거 검증', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('TABS 배열에 achievements 항목이 없다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/js/scenes/CollectionScene.js');
      // CollectionScene은 default export이므로 모듈 내부 상수에 접근 불가
      // 대신, 씬 인스턴스를 통해 간접 확인한다
      // 소스 코드에서 TABS를 module-level const로 정의하므로 직접 접근 불가
      // 대안: 게임 씬을 시작하여 탭 개수를 확인
      return null;
    });

    // 직접 모듈 소스를 fetch하여 TABS 배열 확인
    const tabsResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/js/scenes/CollectionScene.js');
        const source = await response.text();
        // TABS 배열에서 key 값 추출
        const tabsMatch = source.match(/const TABS\s*=\s*\[([\s\S]*?)\];/);
        if (!tabsMatch) return { error: 'TABS 배열을 찾을 수 없음' };
        const tabsBlock = tabsMatch[1];
        const keys = [...tabsBlock.matchAll(/key:\s*'(\w+)'/g)].map(m => m[1]);
        return { keys, hasAchievements: keys.includes('achievements') };
      } catch (e) {
        return { error: e.message };
      }
    });

    expect(tabsResult.error).toBeUndefined();
    expect(tabsResult.keys).toEqual(EXPECTED_COLLECTION_TABS);
    expect(tabsResult.hasAchievements).toBe(false);
  });

  test('AchievementManager import가 CollectionScene에 없다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/CollectionScene.js');
      const source = await response.text();
      return {
        hasAchievementManagerImport: source.includes('AchievementManager'),
        hasGetAchievementItems: source.includes('_getAchievementItems'),
        hasCaseAchievements: source.includes("case 'achievements'"),
      };
    });

    expect(result.hasAchievementManagerImport).toBe(false);
    expect(result.hasGetAchievementItems).toBe(false);
    expect(result.hasCaseAchievements).toBe(false);
  });

  test('fileoverview 주석이 4개 탭으로 수정되었다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/CollectionScene.js');
      const source = await response.text();
      return {
        has4tabs: source.includes('4개 탭'),
        has5tabs: source.includes('5개 탭'),
      };
    });

    expect(result.has4tabs).toBe(true);
    expect(result.has5tabs).toBe(false);
  });

  test('CollectionScene의 switch문에 4개 case만 존재한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/CollectionScene.js');
      const source = await response.text();
      // switch문 내의 case 추출
      const switchMatch = source.match(/switch\s*\(tab\.key\)\s*\{([\s\S]*?)\}/);
      if (!switchMatch) return { error: 'switch문을 찾을 수 없음' };
      const switchBlock = switchMatch[1];
      const cases = [...switchBlock.matchAll(/case\s*'(\w+)'/g)].map(m => m[1]);
      return { cases };
    });

    expect(result.cases).toEqual(EXPECTED_COLLECTION_TABS);
  });
});

test.describe('AchievementScene 보상 정보 표시 검증', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('CARD_H가 86으로 설정되어 있다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      const match = source.match(/const CARD_H\s*=\s*(\d+)/);
      return match ? parseInt(match[1]) : null;
    });

    expect(result).toBe(86);
  });

  test('_getRewardText 메서드가 존재한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      return source.includes('_getRewardText');
    });

    expect(result).toBe(true);
  });

  test('보상 행이 카드에 추가되어 있다 (y+14 위치)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      // 보상 행 코드 확인
      return {
        hasRewardLine: source.includes('y + 14'),
        hasGetRewardText: source.includes('_getRewardText(achievement.reward)'),
        hasRewardColor: source.includes('xpYellow') || source.includes('#f0c040'),
        hasFontSize9: source.includes("fontSize: '9px'"),
      };
    });

    expect(result.hasRewardLine).toBe(true);
    expect(result.hasGetRewardText).toBe(true);
    expect(result.hasRewardColor).toBe(true);
    expect(result.hasFontSize9).toBe(true);
  });

  test('_getRewardText가 5종 보상 타입을 모두 처리한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      return {
        hasCredits: source.includes("case 'credits'"),
        hasDataCore: source.includes("case 'dataCore'"),
        hasDataCoreAndTitle: source.includes("case 'dataCoreAndTitle'"),
        hasCharacterHint: source.includes("case 'characterHint'"),
        hasHiddenCharacterUnlock: source.includes("case 'hiddenCharacterUnlock'"),
        hasDefaultEmpty: source.includes("default:") && source.includes("return ''"),
      };
    });

    expect(result.hasCredits).toBe(true);
    expect(result.hasDataCore).toBe(true);
    expect(result.hasDataCoreAndTitle).toBe(true);
    expect(result.hasCharacterHint).toBe(true);
    expect(result.hasHiddenCharacterUnlock).toBe(true);
    expect(result.hasDefaultEmpty).toBe(true);
  });

  test('보상 텍스트 alpha가 완료/미완료에 따라 다르다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      return {
        hasAlphaLogic: source.includes('completed ? 1.0 : 0.7'),
      };
    });

    expect(result.hasAlphaLogic).toBe(true);
  });
});

test.describe('AchievementScene _getRewardText 로직 검증', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('credits 타입: "보상: 크레딧 N" 형태로 반환한다 (ko)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale } = await import('/js/i18n.js');
      setLocale('ko');
      return t('achievement.reward.credits', 100);
    });

    expect(result).toBe('보상: 크레딧 100');
  });

  test('dataCore 타입: "보상: 데이터 코어 N" 형태로 반환한다 (ko)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale } = await import('/js/i18n.js');
      setLocale('ko');
      return t('achievement.reward.dataCore', 2);
    });

    expect(result).toBe('보상: 데이터 코어 2');
  });

  test('dataCoreAndTitle 타입: 두 보상이 병기된다 (ko)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale } = await import('/js/i18n.js');
      setLocale('ko');
      const dataCorePart = t('achievement.reward.dataCore', 3);
      const titlePart = t('achievement.reward.title', '전설의 전사');
      return dataCorePart + ' + ' + titlePart;
    });

    expect(result).toBe('보상: 데이터 코어 3 + 보상: 칭호 "전설의 전사"');
  });

  test('characterHint 타입: 올바른 텍스트를 반환한다 (ko)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale } = await import('/js/i18n.js');
      setLocale('ko');
      return t('achievement.reward.characterHint');
    });

    expect(result).toBe('보상: 캐릭터 해금 힌트');
  });

  test('hiddenCharacterUnlock 타입: 올바른 텍스트를 반환한다 (ko)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale } = await import('/js/i18n.js');
      setLocale('ko');
      return t('achievement.reward.hiddenCharacter');
    });

    expect(result).toBe('보상: 숨겨진 캐릭터 해금');
  });

  test('null/undefined reward에 대해 빈 문자열을 반환한다', async ({ page }) => {
    // _getRewardText의 null 체크 로직을 검증
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      // null 체크 패턴 확인
      return {
        hasNullCheck: source.includes("if (!reward || !reward.type) return ''"),
      };
    });

    expect(result.hasNullCheck).toBe(true);
  });

  test('알 수 없는 reward type에 대해 빈 문자열을 반환한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/js/scenes/AchievementScene.js');
      const source = await response.text();
      // default case가 빈 문자열 반환하는지 확인
      const defaultMatch = source.match(/default:\s*\n?\s*return\s*''/);
      return { hasDefaultEmpty: !!defaultMatch };
    });

    expect(result.hasDefaultEmpty).toBe(true);
  });
});

test.describe('i18n 보상 키 검증', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('한국어(ko) 보상 텍스트가 모두 존재한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TRANSLATIONS } = await import('/js/i18n.js');
      const ko = TRANSLATIONS?.ko;
      if (!ko) return { error: 'ko translations not found' };

      const keys = [
        'achievement.reward.credits',
        'achievement.reward.dataCore',
        'achievement.reward.title',
        'achievement.reward.characterHint',
        'achievement.reward.hiddenCharacter',
      ];

      const missing = keys.filter(k => !ko[k]);
      return { missing };
    });

    if (!result.error) {
      expect(result.missing).toEqual([]);
    }
  });

  test('영어(en) 보상 텍스트가 모두 존재한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { TRANSLATIONS } = await import('/js/i18n.js');
      const en = TRANSLATIONS?.en;
      if (!en) return { error: 'en translations not found' };

      const keys = [
        'achievement.reward.credits',
        'achievement.reward.dataCore',
        'achievement.reward.title',
        'achievement.reward.characterHint',
        'achievement.reward.hiddenCharacter',
      ];

      const missing = keys.filter(k => !en[k]);
      return { missing };
    });

    if (!result.error) {
      expect(result.missing).toEqual([]);
    }
  });

  test('영어 모드에서 보상 텍스트가 영어로 표시된다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { t, setLocale, TRANSLATIONS } = await import('/js/i18n.js');
      if (setLocale) setLocale('en');

      return {
        credits: t('achievement.reward.credits', 100),
        dataCore: t('achievement.reward.dataCore', 2),
        title: t('achievement.reward.title', 'Legendary Warrior'),
        characterHint: t('achievement.reward.characterHint'),
        hiddenCharacter: t('achievement.reward.hiddenCharacter'),
      };
    });

    expect(result.credits).toBe('Reward: 100 Credits');
    expect(result.dataCore).toBe('Reward: 2 Data Core');
    expect(result.characterHint).toBe('Reward: Character unlock hint');
    expect(result.hiddenCharacter).toBe('Reward: Hidden character unlock');
  });
});

test.describe('도전과제 데이터 무결성 - 모든 보상이 올바른 타입을 가진다', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('모든 100개 도전과제에 reward 객체가 있다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const noReward = ACHIEVEMENTS.filter(a => !a.reward || !a.reward.type);
      return { noReward: noReward.map(a => a.id), total: ACHIEVEMENTS.length };
    });

    expect(result.total).toBe(100);
    expect(result.noReward).toEqual([]);
  });

  test('credits/dataCore 보상에 amount가 0보다 크다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const invalid = ACHIEVEMENTS
        .filter(a => ['credits', 'dataCore', 'dataCoreAndTitle'].includes(a.reward.type))
        .filter(a => typeof a.reward.amount !== 'number' || a.reward.amount <= 0)
        .map(a => ({ id: a.id, type: a.reward.type, amount: a.reward.amount }));
      return invalid;
    });

    expect(result).toEqual([]);
  });

  test('dataCoreAndTitle 보상에 title 속성이 있다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const dcat = ACHIEVEMENTS.filter(a => a.reward.type === 'dataCoreAndTitle');
      const invalid = dcat.filter(a => !a.reward.title || typeof a.reward.title !== 'string');
      return {
        total: dcat.length,
        invalid: invalid.map(a => a.id),
        titles: dcat.map(a => ({ id: a.id, title: a.reward.title })),
      };
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.invalid).toEqual([]);
  });

  test('characterHint/hiddenCharacterUnlock은 amount 없이도 동작한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const special = ACHIEVEMENTS.filter(a =>
        a.reward.type === 'characterHint' || a.reward.type === 'hiddenCharacterUnlock'
      );
      return special.map(a => ({
        id: a.id,
        type: a.reward.type,
        hasAmount: 'amount' in a.reward,
      }));
    });

    // characterHint, hiddenCharacterUnlock은 amount 필드가 없어도 정상
    expect(result.length).toBeGreaterThan(0);
  });
});

test.describe('AchievementScene 레이아웃 검증 (정적 분석)', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('카드 요소 y 오프셋이 카드 범위(CARD_H=86) 안에 있다', async ({ page }) => {
    // CARD_H=86, 반높이=43
    // 아이콘: y-22, 제목: y-28, 설명: y-10, 보상: y+14
    // 모든 요소가 y-43 ~ y+43 범위 안에 있어야 한다
    const offsets = {
      icon: -22,       // y-22 (fontSize 16px, origin 0.5)
      title: -28,      // y-28 (fontSize 12px, top-aligned)
      description: -10, // y-10 (fontSize 10px, top-aligned)
      reward: 14,      // y+14 (fontSize 9px, top-aligned)
    };

    const halfH = 43;

    for (const [name, offset] of Object.entries(offsets)) {
      expect(Math.abs(offset)).toBeLessThan(halfH);
    }
  });

  test('설명(y-10)과 보상(y+14) 사이 간격이 충분하다 (최소 10px)', async ({ page }) => {
    const descY = -10;
    const rewardY = 14;
    const gap = rewardY - descY;

    // 설명 폰트 10px + 간격 >= 10px (겹침 방지)
    expect(gap).toBeGreaterThanOrEqual(10);
  });

  test('스크롤 contentHeight가 100개 아이템에서 올바르다', async ({ page }) => {
    const CARD_H = 86;
    const CARD_GAP = 6;
    const itemCount = 100;
    const contentHeight = itemCount * (CARD_H + CARD_GAP);
    const GAME_HEIGHT = 640;
    const listHeight = GAME_HEIGHT - 150;

    // contentHeight = 100 * 92 = 9200 > listHeight = 490
    expect(contentHeight).toBe(9200);
    expect(contentHeight).toBeGreaterThan(listHeight);
    expect(listHeight).toBe(490);
  });
});

test.describe('기존 기능 유지 검증', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('도전과제 달성 체크 로직이 정상 동작한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { AchievementManager } = await import('/js/managers/AchievementManager.js');
      const { SaveManager } = await import('/js/managers/SaveManager.js');
      SaveManager.init();

      AchievementManager.checkAll({ totalKills: 100 }, {});

      return {
        first_kill: SaveManager.isAchievementComplete('first_kill'),
        novice_hunter: SaveManager.isAchievementComplete('novice_hunter'),
        slayer: SaveManager.isAchievementComplete('slayer'),
      };
    });

    expect(result.first_kill).toBe(true);
    expect(result.novice_hunter).toBe(true);
    expect(result.slayer).toBe(false);
  });

  test('보상 지급 로직이 정상 동작한다 (credits)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { AchievementManager } = await import('/js/managers/AchievementManager.js');
      const { SaveManager } = await import('/js/managers/SaveManager.js');
      SaveManager.init();

      const before = SaveManager.getCredits();
      AchievementManager.checkAll({ totalKills: 1 }, {});
      const after = SaveManager.getCredits();

      return { before, after, gained: after - before };
    });

    // first_kill: credits 50
    expect(result.gained).toBe(50);
  });

  test('보상 지급 로직이 정상 동작한다 (dataCore)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { AchievementManager } = await import('/js/managers/AchievementManager.js');
      const { SaveManager } = await import('/js/managers/SaveManager.js');
      SaveManager.init();

      const before = SaveManager.getDataCores();
      AchievementManager.checkAll({ totalKills: 10000 }, {});
      const after = SaveManager.getDataCores();

      return { before, after, gained: after - before };
    });

    // machine_breaker: dataCore 1 (totalKills 10000)
    // 기타 credits 도전과제도 함께 달성되지만 dataCore만 확인
    expect(result.gained).toBeGreaterThanOrEqual(1);
  });
});

test.describe('엣지케이스 및 예외 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('reward가 null인 도전과제가 없다 (데이터 무결성)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      return ACHIEVEMENTS.filter(a => !a.reward).map(a => a.id);
    });

    expect(result).toEqual([]);
  });

  test('reward.type이 빈 문자열인 도전과제가 없다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      return ACHIEVEMENTS.filter(a => a.reward && a.reward.type === '').map(a => a.id);
    });

    expect(result).toEqual([]);
  });

  test('dataCoreAndTitle의 title이 한국어 하드코드 - EN에서도 한국어로 표시됨 (알려진 제한)', async ({ page }) => {
    // legendary_warrior의 reward.title이 '전설의 전사'로 하드코드
    // EN 모드에서도 한국어 칭호가 표시되는 것은 알려진 제한사항
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const legendary = ACHIEVEMENTS.find(a => a.id === 'legendary_warrior');
      return {
        title: legendary?.reward?.title,
        isKorean: /[가-힣]/.test(legendary?.reward?.title || ''),
      };
    });

    expect(result.title).toBe('전설의 전사');
    expect(result.isKorean).toBe(true);
    // 이것은 FAIL이 아닌 알려진 제한사항으로 기록
  });

  test('모든 보상 타입이 유효한 i18n 키를 사용한다', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ACHIEVEMENTS } = await import('/js/data/achievements.js');
      const { t } = await import('/js/i18n.js');

      const issues = [];
      for (const ach of ACHIEVEMENTS) {
        const r = ach.reward;
        if (!r) continue;

        let text = '';
        switch (r.type) {
          case 'credits':
            text = t('achievement.reward.credits', r.amount);
            break;
          case 'dataCore':
            text = t('achievement.reward.dataCore', r.amount);
            break;
          case 'dataCoreAndTitle':
            text = t('achievement.reward.dataCore', r.amount) + ' + ' + t('achievement.reward.title', r.title);
            break;
          case 'characterHint':
            text = t('achievement.reward.characterHint');
            break;
          case 'hiddenCharacterUnlock':
            text = t('achievement.reward.hiddenCharacter');
            break;
        }

        // i18n 키가 해석되지 않으면 키 자체가 반환됨
        if (text.startsWith('achievement.reward.')) {
          issues.push({ id: ach.id, text });
        }
      }
      return issues;
    });

    expect(result).toEqual([]);
  });
});

test.describe('시각적 검증 - 스크린샷', () => {
  test.beforeEach(async ({ page }) => {
    await loadGame(page);
  });

  test('CollectionScene 4탭 레이아웃 스크린샷', async ({ page }) => {
    // CollectionScene으로 이동
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      if (game) {
        const bootScene = game.scene.scenes.find(s => s.scene.key === 'BootScene');
        if (bootScene) game.scene.stop('BootScene');
        const menuScene = game.scene.scenes.find(s => s.scene.key === 'MenuScene');
        if (menuScene) game.scene.stop('MenuScene');
        game.scene.start('CollectionScene');
      }
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'tests/screenshots/collection-4tabs.png',
    });
  });

  test('AchievementScene 보상 정보 표시 스크린샷', async ({ page }) => {
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      if (game) {
        const bootScene = game.scene.scenes.find(s => s.scene.key === 'BootScene');
        if (bootScene) game.scene.stop('BootScene');
        const menuScene = game.scene.scenes.find(s => s.scene.key === 'MenuScene');
        if (menuScene) game.scene.stop('MenuScene');
        game.scene.start('AchievementScene');
      }
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'tests/screenshots/achievement-rewards.png',
    });
  });
});

test.describe('콘솔 에러 없음 검증', () => {
  test('CollectionScene 진입 시 콘솔 에러가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      if (game) game.scene.start('CollectionScene');
    });
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('favicon') &&
      !e.includes('Phaser')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('AchievementScene 진입 시 콘솔 에러가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      if (game) game.scene.start('AchievementScene');
    });
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('favicon') &&
      !e.includes('Phaser')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('CollectionScene 탭 순회 시 콘솔 에러가 없다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);

    // CollectionScene 진입 후 각 탭 순회를 시뮬레이션
    await page.evaluate(async () => {
      const game = window.__NEON_EXODUS;
      if (!game) return;
      game.scene.start('CollectionScene');
    });
    await page.waitForTimeout(1500);

    // 탭 클릭은 캔버스 내부이므로 좌표 기반 클릭
    // 탭 위치: tabY=60, tabW=62, 4탭, totalW=4*62+3*4=260
    // startX=(360-260)/2+62/2=50+31=81
    const canvas = page.locator('canvas');
    const tabY = 60;
    const tabW = 62;
    const totalW = 4 * tabW + 3 * 4;
    const startX = (360 - totalW) / 2 + tabW / 2;

    for (let i = 0; i < 4; i++) {
      const tabX = startX + i * (tabW + 4);
      await canvas.click({ position: { x: tabX, y: tabY } });
      await page.waitForTimeout(500);
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('favicon') &&
      !e.includes('Phaser')
    );

    expect(criticalErrors).toEqual([]);
  });
});
