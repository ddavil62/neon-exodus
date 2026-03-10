/**
 * @fileoverview AutoPilot 아이템 수집 가중치 강화 QA 테스트.
 *
 * config.js AUTO_HUNT 신규 설정값, AutoPilotSystem 신규 메서드,
 * 하드코딩 제거, 행동 우선순위 재편, 예외 케이스를 검증한다.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5555';

// ── 유틸 함수 ──

/**
 * 게임 로드 완료를 대기한다.
 */
async function waitForGameReady(page) {
  await page.waitForTimeout(3500);
}

/**
 * localStorage에 세이브 데이터를 주입한다.
 */
async function injectSaveData(page, overrides = {}) {
  await page.evaluate((overrides) => {
    const saveData = {
      version: 5,
      credits: 5000,
      dataCores: 0,
      upgrades: {},
      characters: { agent: true },
      selectedCharacter: 'agent',
      achievements: {},
      autoHuntUnlocked: true,
      autoHuntEnabled: true,
      stats: {
        totalKills: 0, totalRuns: 0, totalClears: 0,
        totalPlayTime: 0, maxLevel: 0, maxKillsInRun: 0,
        longestSurvival: 0, consecutiveClears: 0,
        totalBossKills: 0, totalSurviveMinutes: 0,
      },
      collection: { weaponsSeen: ['blaster'], passivesSeen: [], enemiesSeen: [] },
      settings: { locale: 'ko', sfxVolume: 0, bgmVolume: 0 },
      selectedStage: 'stage_01',
      ...overrides,
    };
    localStorage.setItem('neon-exodus-save', JSON.stringify(saveData));
  }, overrides);
}

/**
 * 세이브 데이터를 주입하고 게임을 리로드하여 반영한다.
 */
async function setupGame(page, overrides = {}) {
  await page.goto(BASE_URL);
  await injectSaveData(page, overrides);
  await page.reload();
  await waitForGameReady(page);
}

/**
 * MenuScene에서 게임을 시작한다.
 */
async function startGame(page) {
  // "출격" 버튼 클릭 -> CharacterScene
  await page.click('canvas', { position: { x: 180, y: 310 } });
  await page.waitForTimeout(800);

  // CharacterScene에서 "출격" 버튼 클릭
  await page.click('canvas', { position: { x: 120, y: 580 } });
  await page.waitForTimeout(2500);
}

/**
 * localStorage에서 세이브 데이터를 읽는다.
 */
async function getSaveData(page) {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('neon-exodus-save');
    return raw ? JSON.parse(raw) : null;
  });
}

// ── 테스트 ──

test.describe('AutoPilot 아이템 수집 가중치 강화 검증', () => {

  // ── 1. config.js AUTO_HUNT 신규 설정값 검증 ──

  test.describe('config.js AUTO_HUNT 설정값', () => {

    test('AUTO_HUNT에 6개 신규 설정값이 존재하고 올바른 값을 가진다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      // ES module이므로 직접 import 불가 -- config.js를 fetch하여 소스 코드 분석
      const configSource = await page.evaluate(async () => {
        const resp = await fetch('/js/config.js');
        return resp.text();
      });

      // 6개 신규 설정값 존재 확인
      expect(configSource).toContain('consumableSearchRadius');
      expect(configSource).toContain('weaponDropSearchRadius');
      expect(configSource).toContain('weaponDropUrgentLifetime');
      expect(configSource).toContain('weaponDropScoreMultiplier');
      expect(configSource).toContain('consumableScoreMultiplier');
      expect(configSource).toContain('xpGemScoreMultiplier');

      // 값 확인 (소스 내 리터럴 검증)
      expect(configSource).toMatch(/consumableSearchRadius:\s*300/);
      expect(configSource).toMatch(/weaponDropSearchRadius:\s*400/);
      expect(configSource).toMatch(/weaponDropUrgentLifetime:\s*4000/);
      expect(configSource).toMatch(/weaponDropScoreMultiplier:\s*10/);
      expect(configSource).toMatch(/consumableScoreMultiplier:\s*5/);
      expect(configSource).toMatch(/xpGemScoreMultiplier:\s*1/);

      // 기존 3개 유지 확인
      expect(configSource).toMatch(/directionInterval:\s*150/);
      expect(configSource).toMatch(/dangerRadius:\s*120/);
      expect(configSource).toMatch(/xpSearchRadius:\s*200/);
    });

    test('AUTO_HUNT 총 9개 설정값이 하나의 블록에 정의되어 있다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const configSource = await page.evaluate(async () => {
        const resp = await fetch('/js/config.js');
        return resp.text();
      });

      // AUTO_HUNT 블록 추출
      const autoHuntMatch = configSource.match(/export\s+const\s+AUTO_HUNT\s*=\s*\{([^}]+)\}/s);
      expect(autoHuntMatch).not.toBeNull();

      const blockContent = autoHuntMatch[1];
      // 9개 키 존재 확인
      const keys = [
        'directionInterval', 'dangerRadius', 'xpSearchRadius',
        'consumableSearchRadius', 'weaponDropSearchRadius',
        'weaponDropUrgentLifetime', 'weaponDropScoreMultiplier',
        'consumableScoreMultiplier', 'xpGemScoreMultiplier',
      ];
      for (const key of keys) {
        expect(blockContent).toContain(key);
      }
    });
  });

  // ── 2. AutoPilotSystem 하드코딩 제거 및 config 연동 검증 ──

  test.describe('AutoPilotSystem 하드코딩 제거', () => {

    test('DANGER_RADIUS, XP_SEARCH_RADIUS, DIRECTION_CHANGE_INTERVAL 하드코딩이 제거되었다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 하드코딩 상수 선언이 없어야 한다
      expect(source).not.toMatch(/const\s+DANGER_RADIUS\s*=/);
      expect(source).not.toMatch(/const\s+XP_SEARCH_RADIUS\s*=/);
      expect(source).not.toMatch(/const\s+DIRECTION_CHANGE_INTERVAL\s*=/);
      expect(source).not.toMatch(/const\s+CRITICAL_DANGER_RADIUS\s*=/);

      // AUTO_HUNT import 확인
      expect(source).toContain('AUTO_HUNT');

      // config 참조 확인
      expect(source).toContain('AUTO_HUNT.dangerRadius');
      expect(source).toContain('AUTO_HUNT.xpSearchRadius');
      expect(source).toContain('AUTO_HUNT.directionInterval');
      expect(source).toContain('AUTO_HUNT.consumableSearchRadius');
      expect(source).toContain('AUTO_HUNT.weaponDropSearchRadius');
      expect(source).toContain('AUTO_HUNT.weaponDropUrgentLifetime');
      expect(source).toContain('AUTO_HUNT.weaponDropScoreMultiplier');
      expect(source).toContain('AUTO_HUNT.consumableScoreMultiplier');
      expect(source).toContain('AUTO_HUNT.xpGemScoreMultiplier');
    });

    test('REACTION_MISS_CHANCE = 0.05 와 IMPERFECTION_ANGLE = 0.3 이 변경되지 않았다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      expect(source).toMatch(/IMPERFECTION_ANGLE\s*=\s*0\.3/);
      expect(source).toMatch(/REACTION_MISS_CHANCE\s*=\s*0\.05/);
    });
  });

  // ── 3. 신규 메서드 존재 확인 ──

  test.describe('신규 메서드 확인', () => {

    test('_evaluateWeaponDropUrgent, _evaluateWeaponDrop, _evaluateConsumable, _hasCriticalDanger 메서드가 존재한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      expect(source).toContain('_evaluateWeaponDropUrgent');
      expect(source).toContain('_evaluateWeaponDrop()');
      expect(source).toContain('_evaluateConsumable()');
      expect(source).toContain('_hasCriticalDanger');
    });

    test('기존 _evaluateXPCollection 메서드가 유지되고 있다 (삭제 금지)', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      expect(source).toContain('_evaluateXPCollection()');
    });
  });

  // ── 4. 행동 우선순위 순서 검증 ──

  test.describe('행동 우선순위 순서', () => {

    test('update() 내 행동 순서가 긴급무기 > 위험회피 > 무기 > 소모품 > XP보석 > 적접근 > 방랑 순이다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // update 메서드 추출
      const updateMatch = source.match(/update\(time,\s*delta\)\s*\{([\s\S]*?)^\s{2}\}/m);
      expect(updateMatch).not.toBeNull();

      const updateBody = updateMatch[1];

      // 호출 순서 확인 (인덱스 비교)
      const urgentIdx = updateBody.indexOf('_evaluateWeaponDropUrgent');
      const dangerIdx = updateBody.indexOf('_evaluateDanger');
      const weaponIdx = updateBody.indexOf('_evaluateWeaponDrop()');
      const consumableIdx = updateBody.indexOf('_evaluateConsumable');
      const xpIdx = updateBody.indexOf('_evaluateXPCollection');
      const approachIdx = updateBody.indexOf('_evaluateEnemyApproach');
      const wanderIdx = updateBody.indexOf('_wander');

      expect(urgentIdx).toBeGreaterThan(-1);
      expect(dangerIdx).toBeGreaterThan(-1);
      expect(weaponIdx).toBeGreaterThan(-1);
      expect(consumableIdx).toBeGreaterThan(-1);
      expect(xpIdx).toBeGreaterThan(-1);
      expect(approachIdx).toBeGreaterThan(-1);
      expect(wanderIdx).toBeGreaterThan(-1);

      // 순서 검증
      expect(urgentIdx).toBeLessThan(dangerIdx);
      expect(dangerIdx).toBeLessThan(weaponIdx);
      expect(weaponIdx).toBeLessThan(consumableIdx);
      expect(consumableIdx).toBeLessThan(xpIdx);
      expect(xpIdx).toBeLessThan(approachIdx);
      expect(approachIdx).toBeLessThan(wanderIdx);
    });
  });

  // ── 5. 점수 공식 검증 ──

  test.describe('점수 공식 검증', () => {

    test('무기 드롭 일반 점수 공식이 올바르다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // _evaluateWeaponDrop 내 점수 공식 확인
      // AUTO_HUNT.weaponDropScoreMultiplier * 1000 / (dist + 1)
      expect(source).toMatch(/AUTO_HUNT\.weaponDropScoreMultiplier\s*\*\s*1000\s*\/\s*\(dist\s*\+\s*1\)/);
    });

    test('무기 드롭 긴급 점수 공식에 x3 보정이 적용된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // _evaluateWeaponDropUrgent 내 점수: multiplier * 3 * 1000 / (dist + 1)
      expect(source).toMatch(/AUTO_HUNT\.weaponDropScoreMultiplier\s*\*\s*3\s*\*\s*1000\s*\/\s*\(dist\s*\+\s*1\)/);
    });

    test('소모품 점수 공식이 올바르다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // AUTO_HUNT.consumableScoreMultiplier * 100 / (dist + 1)
      expect(source).toMatch(/AUTO_HUNT\.consumableScoreMultiplier\s*\*\s*100\s*\/\s*\(dist\s*\+\s*1\)/);
    });

    test('XP 보석 점수 공식에 xpGemScoreMultiplier 가 적용된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // AUTO_HUNT.xpGemScoreMultiplier * (gem.xpValue || 1) / (dist + 1)
      expect(source).toMatch(/AUTO_HUNT\.xpGemScoreMultiplier\s*\*\s*\(gem\.xpValue\s*\|\|\s*1\)\s*\/\s*\(dist\s*\+\s*1\)/);
    });
  });

  // ── 6. 풀 null 안전성 검증 ──

  test.describe('풀 null 안전성', () => {

    test('weaponDropPool undefined 시 _evaluateWeaponDrop이 null을 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // _evaluateWeaponDrop 메서드에서 null 반환 확인
      expect(source).toContain('if (!scene.weaponDropPool) return null');
    });

    test('consumablePool undefined 시 _evaluateConsumable이 null을 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // _evaluateConsumable 메서드에서 null 반환 확인
      expect(source).toContain('if (!scene.consumablePool) return null');
    });

    test('xpGemPool undefined 시 _evaluateXPCollection이 null을 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      expect(source).toContain('if (!scene.xpGemPool) return null');
    });

    test('weaponDropPool undefined 시 _evaluateWeaponDropUrgent이 null을 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 메서드 정의 위치를 찾기 위해 섹션 주석 기준 탐색
      const sectionIdx = source.indexOf('내부: 무기 드롭 긴급 수집');
      expect(sectionIdx).toBeGreaterThan(-1);
      const afterSection = source.substring(sectionIdx, sectionIdx + 800);
      expect(afterSection).toContain('if (!scene.weaponDropPool) return null');
    });
  });

  // ── 7. CRITICAL_DANGER_RADIUS 동적 계산 검증 ──

  test.describe('CRITICAL_DANGER_RADIUS 동적 계산', () => {

    test('CRITICAL_DANGER_RADIUS가 AUTO_HUNT.dangerRadius / 2 로 동적 계산된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // dangerRadius / 2 패턴 확인 (두 곳: _evaluateDanger와 _evaluateWeaponDropUrgent)
      const matches = source.match(/AUTO_HUNT\.dangerRadius\s*\/\s*2/g);
      expect(matches).not.toBeNull();
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 8. 긴급 수집 조건 검증 ──

  test.describe('긴급 수집 조건 검증', () => {

    test('_evaluateWeaponDropUrgent에서 permanent 드롭은 무시된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 섹션 주석 기준으로 메서드 본문 탐색
      const sectionStart = source.indexOf('내부: 무기 드롭 긴급 수집');
      const sectionEnd = source.indexOf('내부: 무기 드롭 일반 수집');
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      const methodBody = source.substring(sectionStart, sectionEnd);

      expect(methodBody).toContain('item.permanent');
      expect(methodBody).toContain('AUTO_HUNT.weaponDropUrgentLifetime');
    });

    test('긴급 수집 시 _hasCriticalDanger가 true이면 null을 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 섹션 주석 기준으로 메서드 본문 탐색
      const sectionStart = source.indexOf('내부: 무기 드롭 긴급 수집');
      const sectionEnd = source.indexOf('내부: 무기 드롭 일반 수집');
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      const methodBody = source.substring(sectionStart, sectionEnd);

      expect(methodBody).toContain('_hasCriticalDanger');
      expect(methodBody).toContain('if (hasCriticalDanger) return null');
    });
  });

  // ── 9. 런타임 통합 테스트: 게임 실행 및 콘솔 에러 검증 ──

  test.describe('런타임 통합 테스트', () => {

    test('자동 사냥 활성화 상태에서 10초 플레이 시 콘솔 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);

      // 초기 스크린샷
      await page.screenshot({ path: 'tests/screenshots/item-weight-initial.png' });

      // 10초 플레이
      await page.waitForTimeout(10000);

      // 10초 후 스크린샷
      await page.screenshot({ path: 'tests/screenshots/item-weight-10s.png' });

      // 에러 없음 확인
      expect(errors).toEqual([]);
    });

    test('자동 사냥 활성화 상태에서 20초 플레이 시 소모품/무기 드롭 관련 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);

      // 20초 동안 소모품/무기 드롭 스폰되는 충분한 시간 대기
      await page.waitForTimeout(20000);

      await page.screenshot({ path: 'tests/screenshots/item-weight-20s.png' });

      // 에러 없음 확인
      expect(errors).toEqual([]);
    });

    test('자동 사냥 중 토글 OFF/ON 반복 시 에러가 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);
      await page.waitForTimeout(2000);

      // 토글 반복 (5회)
      for (let i = 0; i < 5; i++) {
        await page.click('canvas', { position: { x: 320, y: 56 } });
        await page.waitForTimeout(500);
      }

      // 5초 추가 플레이
      await page.waitForTimeout(5000);

      await page.screenshot({ path: 'tests/screenshots/item-weight-toggle-stress.png' });

      expect(errors).toEqual([]);
    });
  });

  // ── 10. 기존 위험 회피(evade) 로직 정상 동작 확인 ──

  test.describe('기존 위험 회피 로직', () => {

    test('_evaluateDanger 메서드가 AUTO_HUNT.dangerRadius를 사용한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 섹션 주석 기준으로 메서드 본문 탐색
      const dangerSectionStart = source.indexOf('내부: 위험 회피');
      const dangerSectionEnd = source.indexOf('내부: 무기 드롭 긴급 수집');
      expect(dangerSectionStart).toBeGreaterThan(-1);
      expect(dangerSectionEnd).toBeGreaterThan(dangerSectionStart);
      const dangerBody = source.substring(dangerSectionStart, dangerSectionEnd);

      expect(dangerBody).toContain('AUTO_HUNT.dangerRadius');
      // 하드코딩 상수 선언이 이 섹션에 없어야 함 (JSDoc 주석 내 문자열은 허용)
      expect(dangerBody).not.toMatch(/const\s+DANGER_RADIUS\s*=/);
    });

    test('위험 회피 완화 조건이 기존과 동일하게 유지된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // closestDist > 90 조건 유지 확인
      expect(source).toContain('closestDist > 90');
      expect(source).toContain('enemies.length < 3');
    });
  });

  // ── 11. 탐색 반경별 분리 검증 ──

  test.describe('탐색 반경 분리', () => {

    test('각 아이템 유형이 서로 다른 탐색 반경을 사용한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 무기 드롭: weaponDropSearchRadius (400px)
      expect(source).toContain('AUTO_HUNT.weaponDropSearchRadius');
      // 소모품: consumableSearchRadius (300px)
      expect(source).toContain('AUTO_HUNT.consumableSearchRadius');
      // XP: xpSearchRadius (200px)
      expect(source).toContain('AUTO_HUNT.xpSearchRadius');
    });
  });

  // ── 12. JSDoc 한국어 주석 검증 ──

  test.describe('JSDoc 주석 규약', () => {

    test('신규 메서드에 한국어 JSDoc 주석이 작성되어 있다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // 섹션 주석 기반으로 메서드 정의 영역 탐색
      // _evaluateWeaponDropUrgent JSDoc
      const urgentSection = source.indexOf('내부: 무기 드롭 긴급 수집');
      expect(urgentSection).toBeGreaterThan(-1);
      const urgentArea = source.substring(urgentSection, urgentSection + 500);
      expect(urgentArea).toContain('@returns');
      expect(urgentArea).toContain('@private');

      // _evaluateConsumable JSDoc
      const consumableSection = source.indexOf('내부: 소모품 수집');
      expect(consumableSection).toBeGreaterThan(-1);
      const consumableArea = source.substring(consumableSection, consumableSection + 500);
      expect(consumableArea).toContain('@returns');
      expect(consumableArea).toContain('@private');

      // _evaluateWeaponDrop JSDoc
      const weaponSection = source.indexOf('내부: 무기 드롭 일반 수집');
      expect(weaponSection).toBeGreaterThan(-1);
      const weaponArea = source.substring(weaponSection, weaponSection + 500);
      expect(weaponArea).toContain('@returns');
      expect(weaponArea).toContain('@private');

      // _hasCriticalDanger JSDoc
      const hasCriticalSection = source.indexOf('_hasCriticalDanger(radius)');
      expect(hasCriticalSection).toBeGreaterThan(-1);
      const hasCriticalJSDocIdx = source.lastIndexOf('/**', hasCriticalSection);
      const hasCriticalArea = source.substring(hasCriticalJSDocIdx, hasCriticalSection);
      expect(hasCriticalArea).toContain('@param');
      expect(hasCriticalArea).toContain('@returns');
      expect(hasCriticalArea).toContain('@private');
    });
  });

  // ── 13. 엣지케이스: 아이템 0개일 때 ──

  test.describe('엣지케이스: 아이템 0개', () => {

    test('게임 시작 직후 (아이템 없음) AUTO ON 상태에서 에러 없이 동작한다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);

      // 게임 시작 직후 (적 미스폰, 아이템 없음) 2초 대기
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/item-weight-no-items.png' });

      expect(errors).toEqual([]);
    });
  });

  // ── 14. waveSystem/enemyPool 안전성 ──

  test.describe('waveSystem/enemyPool 안전성', () => {

    test('_hasCriticalDanger에서 waveSystem이 없을 때 false를 반환한다', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForGameReady(page);

      const source = await page.evaluate(async () => {
        const resp = await fetch('/js/systems/AutoPilotSystem.js');
        return resp.text();
      });

      // _hasCriticalDanger에서 안전 체크 확인
      const methodStart = source.indexOf('_hasCriticalDanger(radius)');
      expect(methodStart).toBeGreaterThan(-1);
      const methodBody = source.substring(methodStart, methodStart + 500);

      expect(methodBody).toContain('!scene.waveSystem');
      expect(methodBody).toContain('return false');
    });
  });

  // ── 15. 모바일 뷰포트 + AUTO ON 플레이 ──

  test.describe('모바일 뷰포트', () => {

    test('375x667 뷰포트에서 AUTO ON + 아이템 수집 10초 플레이 시 에러 없다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.setViewportSize({ width: 375, height: 667 });

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);
      await page.waitForTimeout(10000);

      await page.screenshot({ path: 'tests/screenshots/item-weight-mobile.png' });

      expect(errors).toEqual([]);
    });
  });

  // ── 16. 시각적 검증: 게임 플레이 스크린샷 ──

  test.describe('시각적 검증', () => {

    test('자동 사냥 중 아이템 수집 행동 스크린샷 캡처', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await setupGame(page, {
        autoHuntUnlocked: true,
        autoHuntEnabled: true,
      });

      await startGame(page);

      // 3초 후 (적 스폰 시작, XP 보석 드롭 시작)
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'tests/screenshots/item-weight-3s-gameplay.png' });

      // 7초 후 (소모품 드롭 가능, AI 수집 행동 관찰)
      await page.waitForTimeout(4000);
      await page.screenshot({ path: 'tests/screenshots/item-weight-7s-gameplay.png' });

      // 15초 후 (충분한 전투 진행)
      await page.waitForTimeout(8000);
      await page.screenshot({ path: 'tests/screenshots/item-weight-15s-gameplay.png' });

      expect(errors).toEqual([]);
    });
  });
});
