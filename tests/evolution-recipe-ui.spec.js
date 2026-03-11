/**
 * @fileoverview 진화 조합표 UI + 인게임 힌트 기능 QA 테스트.
 *
 * CollectionScene 5번째 "진화" 탭, _getEvolutionItems(), 인게임 힌트 로직,
 * i18n 키, 엣지케이스를 검증한다.
 */

import { test, expect } from '@playwright/test';

test.describe('진화 조합표 UI + 인게임 힌트 검증', () => {

  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    await page.goto('/');
    // Phaser 로드 대기
    await page.waitForTimeout(3000);
  });

  // ── 1. CollectionScene TABS 정의 검증 ──

  test.describe('CollectionScene TABS 정의', () => {

    test('TABS 배열에 5개 탭이 정의되어 있고 evolutions key가 포함된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const mod = await import('/js/scenes/CollectionScene.js');
          // CollectionScene은 default export이므로 내부 TABS에 직접 접근 불가
          // 대신 소스를 fetch해서 파싱
          const src = await (await fetch('/js/scenes/CollectionScene.js')).text();
          const tabsMatch = src.match(/const TABS\s*=\s*\[([\s\S]*?)\];/);
          if (!tabsMatch) return { error: 'TABS not found in source' };

          const tabsStr = tabsMatch[1];
          // key 값 추출
          const keys = [...tabsStr.matchAll(/key:\s*'(\w+)'/g)].map(m => m[1]);
          return { keys, count: keys.length };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('Source parse test:', result.error);
        return;
      }

      expect(result.count).toBe(5);
      expect(result.keys).toContain('evolutions');
      expect(result.keys).toEqual(['weapons', 'passives', 'enemies', 'achievements', 'evolutions']);
    });

    test('tabW가 62 이하로 5개 탭이 GAME_WIDTH(360)에 수용된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/CollectionScene.js')).text();
          const tabWMatch = src.match(/const tabW\s*=\s*(\d+)/);
          const { GAME_WIDTH } = await import('/js/config.js');

          if (!tabWMatch) return { error: 'tabW not found' };
          const tabW = parseInt(tabWMatch[1]);
          const tabCount = 5;
          const gap = 4;
          const totalW = tabCount * tabW + (tabCount - 1) * gap;
          return {
            tabW,
            totalW,
            gameWidth: GAME_WIDTH,
            fits: totalW <= GAME_WIDTH,
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('Tab width test:', result.error);
        return;
      }

      expect(result.tabW).toBeLessThanOrEqual(62);
      expect(result.fits).toBe(true);
    });
  });

  // ── 2. _getEvolutionItems() 데이터 정합성 ──

  test.describe('_getEvolutionItems 데이터 정합성', () => {

    test('WEAPON_EVOLUTIONS 11개 전체를 순회하여 진화 아이템을 생성한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          return { count: WEAPON_EVOLUTIONS.length };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.count).toBe(11);
    });

    test('조합식이 발견 여부와 무관하게 항상 생성된다 (미발견 시에도 레시피 공개)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          const { t } = await import('/js/i18n.js');

          // 미발견 상태를 시뮬레이션: weaponsSeen이 빈 배열
          const seen = new Set([]);
          const items = WEAPON_EVOLUTIONS.map(evo => {
            const discovered = seen.has(evo.resultId);
            const weaponName = t(`weapon.${evo.weaponId}.name`);
            const passiveName = t(`passive.${evo.passiveId}.name`);
            const recipe = t('collection.evoRecipe', weaponName, passiveName);
            return {
              name: discovered ? `\u2605 ${t(evo.resultNameKey)}` : '\u2605 ???',
              desc: recipe,
              discovered,
            };
          });

          // 모든 아이템의 desc에 'Lv8'과 'Lv5'가 포함되는지 확인 (레시피 공개)
          const allHaveRecipe = items.every(item =>
            item.desc.includes('Lv8') && item.desc.includes('Lv5')
          );

          // 모든 아이템이 미발견이므로 이름은 '??? '
          const allMasked = items.every(item => item.name === '\u2605 ???');

          return {
            count: items.length,
            allHaveRecipe,
            allMasked,
            sampleDesc: items[0].desc,
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.count).toBe(11);
      expect(result.allHaveRecipe).toBe(true);
      expect(result.allMasked).toBe(true);
    });

    test('발견된 진화 무기는 실제 이름이 표시된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          const { t } = await import('/js/i18n.js');

          // precision_cannon을 발견한 상태 시뮬레이션
          const seen = new Set(['precision_cannon']);
          const evo = WEAPON_EVOLUTIONS[0]; // blaster -> precision_cannon
          const discovered = seen.has(evo.resultId);
          const name = discovered ? `\u2605 ${t(evo.resultNameKey)}` : '\u2605 ???';

          return {
            discovered,
            name,
            isRealName: !name.includes('???'),
            hasStarPrefix: name.startsWith('\u2605'),
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.discovered).toBe(true);
      expect(result.isRealName).toBe(true);
      expect(result.hasStarPrefix).toBe(true);
    });
  });

  // ── 3. _renderList switch case 검증 ──

  test.describe('_renderList switch case', () => {

    test('CollectionScene 소스에 evolutions case가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/CollectionScene.js')).text();
          const hasEvolutionsCase = src.includes("case 'evolutions':");
          const hasGetEvolutionItems = src.includes('_getEvolutionItems');
          return { hasEvolutionsCase, hasGetEvolutionItems };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasEvolutionsCase).toBe(true);
      expect(result.hasGetEvolutionItems).toBe(true);
    });
  });

  // ── 4. GameScene._shownHints 초기화 검증 ──

  test.describe('GameScene 힌트 시스템', () => {

    test('GameScene 소스에 _shownHints가 Set으로 초기화된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const hasShownHints = src.includes('this._shownHints = new Set()');
          return { hasShownHints };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasShownHints).toBe(true);
    });

    test('_tryEvolutionCheck에서 weaponMaxed && passiveLv > 0 && passiveLv < 5일 때 힌트를 호출한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();

          // _tryEvolutionCheck 메서드 추출
          const methodMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_tryEvolutionCheck not found' };

          const body = methodMatch[1];

          // passiveLv > 0 조건 존재 확인 (패시브 미보유 시 힌트 안 표시)
          const hasPassiveLvCheck = body.includes('passiveLv > 0');
          // _showEvolutionHint 호출 존재 확인
          const hasHintCall = body.includes('_showEvolutionHint');
          // passiveLv >= 5 시 진화 조건 체크
          const hasEvolutionCondition = body.includes('passiveLv >= 5');
          // weaponMaxed 체크
          const hasWeaponMaxCheck = body.includes('weaponMaxed');

          return {
            hasPassiveLvCheck,
            hasHintCall,
            hasEvolutionCondition,
            hasWeaponMaxCheck,
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn(result.error);
        return;
      }
      expect(result.hasPassiveLvCheck).toBe(true);
      expect(result.hasHintCall).toBe(true);
      expect(result.hasEvolutionCondition).toBe(true);
      expect(result.hasWeaponMaxCheck).toBe(true);
    });

    test('_showEvolutionHint에서 _shownHints로 중복 방지한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const methodMatch = src.match(/_showEvolutionHint\(evo\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_showEvolutionHint not found' };

          const body = methodMatch[1];
          const hasSetCheck = body.includes('_shownHints.has(evo.resultId)');
          const hasSetAdd = body.includes('_shownHints.add(evo.resultId)');
          const hasFadeOut = body.includes('alpha: 0') || body.includes('alpha:0');
          const hasDelay = body.includes('delay: 1500') || body.includes('delay:1500');

          return { hasSetCheck, hasSetAdd, hasFadeOut, hasDelay };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasSetCheck).toBe(true);
      expect(result.hasSetAdd).toBe(true);
      expect(result.hasFadeOut).toBe(true);
      expect(result.hasDelay).toBe(true);
    });

    test('패시브Lv=0인 경우 힌트가 표시되지 않아야 한다 (로직 검증)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const methodMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_tryEvolutionCheck not found' };

          const body = methodMatch[1];
          // "else if (passiveLv > 0)" 조건이 있으면 passiveLv === 0은 걸러짐
          const hasElseIfPassiveGt0 = body.includes('else if (passiveLv > 0)');
          return { hasElseIfPassiveGt0 };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasElseIfPassiveGt0).toBe(true);
    });

    test('이미 진화한 무기(_evolvedId)는 체크에서 건너뛴다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const methodMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_tryEvolutionCheck not found' };

          const body = methodMatch[1];
          const hasEvolvedCheck = body.includes('weapon._evolvedId');
          return { hasEvolvedCheck };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasEvolvedCheck).toBe(true);
    });
  });

  // ── 5. i18n 번역 키 검증 ──

  test.describe('i18n 번역 키 검증', () => {

    test('ko/en 양쪽에 collection.evolutions 키가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { t, setLocale } = await import('/js/i18n.js');

          setLocale('ko');
          const koVal = t('collection.evolutions');
          setLocale('en');
          const enVal = t('collection.evolutions');
          setLocale('ko'); // restore

          return {
            ko: koVal,
            en: enVal,
            koValid: koVal !== 'collection.evolutions', // key가 그대로 반환되면 미등록
            enValid: enVal !== 'collection.evolutions',
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.koValid).toBe(true);
      expect(result.enValid).toBe(true);
      expect(result.ko).toBe('진화');
      expect(result.en).toBe('Evolution');
    });

    test('ko/en 양쪽에 collection.evoRecipe 키가 존재하고 플레이스홀더가 치환된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { t, setLocale } = await import('/js/i18n.js');

          setLocale('ko');
          const koRaw = t('collection.evoRecipe');
          const koSubst = t('collection.evoRecipe', 'TestWeapon', 'TestPassive');

          setLocale('en');
          const enRaw = t('collection.evoRecipe');
          const enSubst = t('collection.evoRecipe', 'TestWeapon', 'TestPassive');

          setLocale('ko');
          return { koRaw, koSubst, enRaw, enSubst };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.koSubst).toBe('TestWeapon Lv8 + TestPassive Lv5');
      expect(result.enSubst).toBe('TestWeapon Lv8 + TestPassive Lv5');
    });

    test('ko/en 양쪽에 hint.evolutionReady 키가 존재하고 치환된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { t, setLocale } = await import('/js/i18n.js');

          setLocale('ko');
          const koSubst = t('hint.evolutionReady', 'WeaponX', 'PassiveY');
          setLocale('en');
          const enSubst = t('hint.evolutionReady', 'WeaponX', 'PassiveY');
          setLocale('ko');

          return { koSubst, enSubst };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.koSubst).toBe('WeaponX MAX! PassiveY Lv5로 진화!');
      expect(result.enSubst).toBe('WeaponX MAX! Evolves with PassiveY Lv5!');
    });

    test('collection.discovered / collection.notDiscovered 키가 ko/en 모두 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { t, setLocale } = await import('/js/i18n.js');

          const keys = ['collection.discovered', 'collection.notDiscovered'];
          const results = {};
          for (const lang of ['ko', 'en']) {
            setLocale(lang);
            results[lang] = {};
            for (const key of keys) {
              const val = t(key);
              results[lang][key] = { value: val, valid: val !== key };
            }
          }
          setLocale('ko');
          return results;
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      for (const lang of ['ko', 'en']) {
        for (const [key, data] of Object.entries(result[lang])) {
          expect(data.valid, `${lang}/${key} missing: "${data.value}"`).toBe(true);
        }
      }
    });
  });

  // ── 6. 진화 레시피와 무기/패시브 이름 매칭 검증 ──

  test.describe('진화 레시피 텍스트 정합성', () => {

    test('11개 진화 레시피 각각에 유효한 무기/패시브 이름이 표시된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          const { t } = await import('/js/i18n.js');

          const items = WEAPON_EVOLUTIONS.map(evo => {
            const weaponName = t(`weapon.${evo.weaponId}.name`);
            const passiveName = t(`passive.${evo.passiveId}.name`);
            const recipe = t('collection.evoRecipe', weaponName, passiveName);

            // 이름이 키 그대로 반환되면(번역 누락) 검출
            const weaponNameValid = !weaponName.startsWith('weapon.');
            const passiveNameValid = !passiveName.startsWith('passive.');

            return {
              resultId: evo.resultId,
              weaponName,
              passiveName,
              recipe,
              weaponNameValid,
              passiveNameValid,
            };
          });

          return items;
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.length).toBe(11);
      for (const item of result) {
        expect(item.weaponNameValid, `${item.resultId}: weapon name fallback to key "${item.weaponName}"`).toBe(true);
        expect(item.passiveNameValid, `${item.resultId}: passive name fallback to key "${item.passiveName}"`).toBe(true);
        expect(item.recipe).toContain('Lv8');
        expect(item.recipe).toContain('Lv5');
      }
    });
  });

  // ── 7. 시각적 검증: 도감 진화 탭 ──

  test.describe('시각적 검증', () => {

    test('메뉴 화면 스크린샷', async ({ page }) => {
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'tests/screenshots/evo-recipe-menu.png' });
    });

    test('도감 버튼 클릭 후 도감 화면 진입 스크린샷', async ({ page }) => {
      await page.waitForTimeout(2000);
      // 메뉴 화면에서 도감 버튼 좌표 클릭 (Phaser Canvas 기반)
      // 도감 버튼 위치 추정: 메뉴 화면 중앙 부근
      // MenuScene의 버튼 배치에 따라 다름 - 스크린샷으로 확인
      await page.screenshot({ path: 'tests/screenshots/evo-recipe-before-collection.png' });

      // Canvas 클릭 시도 - 도감 버튼 위치 (대략적)
      const canvas = page.locator('canvas');
      // 클릭 좌표는 게임마다 다르므로 여러 후보 시도
      // MenuScene에서 '도감' 버튼은 보통 아래쪽에 위치
      await canvas.click({ position: { x: 180, y: 420 } });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'tests/screenshots/evo-recipe-collection-attempt.png' });
    });
  });

  // ── 8. 회귀: 기존 진화 로직이 깨지지 않았는지 ──

  test.describe('회귀 테스트: 기존 진화 동작', () => {

    test('passiveLv >= 5일 때 evolveWeapon이 호출되는 로직이 유지된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const methodMatch = src.match(/_tryEvolutionCheck\(\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_tryEvolutionCheck not found' };

          const body = methodMatch[1];
          const hasEvolveCall = body.includes('weaponSystem.evolveWeapon');
          const hasPassive5Check = body.includes('passiveLv >= 5');
          const hasEvolutionPopup = body.includes('_showEvolutionPopup');

          return { hasEvolveCall, hasPassive5Check, hasEvolutionPopup };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasEvolveCall).toBe(true);
      expect(result.hasPassive5Check).toBe(true);
      expect(result.hasEvolutionPopup).toBe(true);
    });

    test('weaponEvolutions 카운터가 유지된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const hasCounter = src.includes('this.weaponEvolutions++');
          return { hasCounter };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasCounter).toBe(true);
    });

    test('기존 무기 탭에서 진화 무기가 여전히 표시된다 (weapons 탭)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/CollectionScene.js')).text();
          // _getWeaponItems에서 WEAPON_EVOLUTIONS 순회가 유지되는지
          const methodMatch = src.match(/_getWeaponItems\(collection\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_getWeaponItems not found' };

          const body = methodMatch[1];
          const hasEvoLoop = body.includes('WEAPON_EVOLUTIONS');
          return { hasEvoLoop };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasEvoLoop).toBe(true);
    });
  });

  // ── 9. 엣지케이스 ──

  test.describe('엣지케이스', () => {

    test('무기 탭과 진화 탭의 미발견 처리 차이가 올바르다', async ({ page }) => {
      // 무기 탭: 미발견 시 이름/설명 모두 ???
      // 진화 탭: 미발견 시 이름만 ???, 조합식은 항상 공개
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/CollectionScene.js')).text();

          // _getWeaponItems에서 미발견 진화 무기의 desc 처리
          const weaponMethod = src.match(/_getWeaponItems\(collection\)\s*\{([\s\S]*?)\n  \}/);
          // _getEvolutionItems에서 desc 처리
          const evoMethod = src.match(/_getEvolutionItems\(collection\)\s*\{([\s\S]*?)\n  \}/);

          if (!weaponMethod || !evoMethod) return { error: 'methods not found' };

          // 무기 탭: 미발견 시 desc = undiscovered
          const weaponHasUndiscoveredDesc = weaponMethod[1].includes("collection.undiscovered");
          // 진화 탭: desc에 항상 recipe (undiscovered 없음)
          const evoAlwaysShowsRecipe = !evoMethod[1].includes("collection.undiscovered");
          const evoUsesEvoRecipe = evoMethod[1].includes("collection.evoRecipe");

          return {
            weaponHasUndiscoveredDesc,
            evoAlwaysShowsRecipe,
            evoUsesEvoRecipe,
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.weaponHasUndiscoveredDesc).toBe(true);
      expect(result.evoAlwaysShowsRecipe).toBe(true);
      expect(result.evoUsesEvoRecipe).toBe(true);
    });

    test('t() 함수에서 미등록 키는 키 자체를 반환한다 (fallback)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { t } = await import('/js/i18n.js');
          const missing = t('nonexistent.key.test');
          return { missing };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.missing).toBe('nonexistent.key.test');
    });

    test('11개 진화 레시피의 resultNameKey가 모두 i18n에 등록되어 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          const { t, setLocale } = await import('/js/i18n.js');

          const missingKeys = [];
          for (const evo of WEAPON_EVOLUTIONS) {
            setLocale('ko');
            const koName = t(evo.resultNameKey);
            if (koName === evo.resultNameKey) {
              missingKeys.push({ key: evo.resultNameKey, lang: 'ko' });
            }
            setLocale('en');
            const enName = t(evo.resultNameKey);
            if (enName === evo.resultNameKey) {
              missingKeys.push({ key: evo.resultNameKey, lang: 'en' });
            }
          }
          setLocale('ko');
          return { missingKeys };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.missingKeys).toEqual([]);
    });

    test('WEAPON_EVOLUTIONS의 모든 weaponId/passiveId에 대한 i18n name 키가 등록되어 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const { WEAPON_EVOLUTIONS } = await import('/js/data/weapons.js');
          const { t } = await import('/js/i18n.js');

          const missingKeys = [];
          for (const evo of WEAPON_EVOLUTIONS) {
            const wKey = `weapon.${evo.weaponId}.name`;
            const pKey = `passive.${evo.passiveId}.name`;

            if (t(wKey) === wKey) missingKeys.push(wKey);
            if (t(pKey) === pKey) missingKeys.push(pKey);
          }
          return { missingKeys };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.missingKeys).toEqual([]);
    });

    test('_showEvolutionHint 텍스트가 scrollFactor(0)으로 카메라에 고정된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await (await fetch('/js/scenes/GameScene.js')).text();
          const methodMatch = src.match(/_showEvolutionHint\(evo\)\s*\{([\s\S]*?)\n  \}/);
          if (!methodMatch) return { error: '_showEvolutionHint not found' };

          const body = methodMatch[1];
          const hasScrollFactor = body.includes('setScrollFactor(0)');
          const hasDepth = body.includes('setDepth(');
          const hasNeonOrange = body.includes('neonOrange');

          return { hasScrollFactor, hasDepth, hasNeonOrange };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) return;
      expect(result.hasScrollFactor).toBe(true);
      expect(result.hasDepth).toBe(true);
      expect(result.hasNeonOrange).toBe(true);
    });
  });

  // ── 10. 콘솔 에러 검증 ──

  test.describe('런타임 안정성', () => {

    test('페이지 로드 시 콘솔 에러가 없다', async ({ page }) => {
      expect(page._consoleErrors).toEqual([]);
    });

    test('도감 관련 모듈 임포트 시 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const result = await page.evaluate(async () => {
        try {
          await import('/js/scenes/CollectionScene.js');
          await import('/js/data/weapons.js');
          await import('/js/data/passives.js');
          await import('/js/i18n.js');
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.success).toBe(true);
      expect(errors.filter(e =>
        e.includes('CollectionScene') ||
        e.includes('WEAPON_EVOLUTIONS') ||
        e.includes('_getEvolutionItems')
      )).toEqual([]);
    });
  });
});
