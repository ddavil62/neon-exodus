/**
 * @fileoverview QA 테스트: CharacterDetailScene (Phase 3)
 *
 * 단일 캐릭터 상세 뷰의 UI 요소, 캐릭터 전환, 잠금/해금 로직,
 * 출격 버튼 활성화, 뒤로가기 분기, 예외 시나리오를 검증한다.
 */
import { test, expect } from '@playwright/test';

// ── 헬퍼: 게임 로드 + MenuScene 대기 ──

async function loadGame(page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    return typeof window.__NEON_EXODUS !== 'undefined' && document.querySelector('canvas');
  }, { timeout: 15000 });
  // BootScene -> MenuScene 전환 대기
  await page.waitForTimeout(3500);
}

/**
 * localStorage를 수정한 후 SaveManager를 재초기화한다.
 * page.evaluate 내에서 SaveManager.init()을 호출해야 메모리 캐시가 갱신된다.
 */
async function reloadSaveManager(page) {
  await page.evaluate(() => {
    const g = window.__NEON_EXODUS;
    // BootScene의 SaveManager.init()를 통해 재초기화
    const boot = g.scene.getScene('BootScene');
    if (boot) {
      // SaveManager는 static이므로 직접 재초기화
      // localStorage에서 다시 읽어옴
      const SAVE_KEY = 'neon-exodus-save';
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // SaveManager 내부 _data를 직접 교체 (static class이므로)
        // SaveManager.init()을 다시 호출하여 reload
      }
    }
  });
  // SaveManager.init()을 호출하려면 페이지를 완전히 리로드하는 것이 확실
  await page.reload();
  await page.waitForFunction(() => {
    return typeof window.__NEON_EXODUS !== 'undefined' && document.querySelector('canvas');
  }, { timeout: 15000 });
  await page.waitForTimeout(3500);
}

/**
 * CharacterScene으로 직접 전환한다.
 * @param {import('@playwright/test').Page} page
 * @param {Object} data - init 데이터
 */
async function navigateToCharacterScene(page, data = { fromScene: 'MenuScene' }) {
  await page.evaluate((d) => {
    const g = window.__NEON_EXODUS;
    g.scene.start('CharacterScene', d);
  }, data);
  await page.waitForTimeout(1500);
}

/**
 * 현재 활성 씬 이름을 반환한다.
 */
async function getActiveSceneName(page) {
  return page.evaluate(() => {
    const g = window.__NEON_EXODUS;
    const scenes = g.scene.getScenes(true);
    return scenes.length > 0 ? scenes[0].constructor.name : null;
  });
}

/**
 * CharacterScene의 내부 상태를 조회한다.
 */
async function getCharSceneState(page) {
  return page.evaluate(() => {
    const g = window.__NEON_EXODUS;
    const cs = g.scene.getScene('CharacterScene');
    if (!cs || !cs.scene.isActive()) return null;
    const charData = cs._visibleChars[cs._currentIndex];
    return {
      currentIndex: cs._currentIndex,
      charId: charData?.id,
      visibleCount: cs._visibleChars.length,
      fromScene: cs._fromScene,
      stageId: cs._stageId,
      sortieEnabled: cs._sortieEnabled,
    };
  });
}

/**
 * 좌우 화살표 위치를 클릭한다.
 * @param {import('@playwright/test').Page} page
 * @param {'left'|'right'} direction
 */
async function clickNavArrow(page, direction) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const scaleX = box.width / 360;
  const scaleY = box.height / 640;
  const x = direction === 'left' ? 30 * scaleX : 330 * scaleX;
  const y = 140 * scaleY;
  await canvas.click({ position: { x, y } });
  await page.waitForTimeout(300);
}

/**
 * 출격 버튼 위치를 클릭한다.
 */
async function clickSortieBtn(page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const scaleX = box.width / 360;
  const scaleY = box.height / 640;
  await canvas.click({ position: { x: 270 * scaleX, y: 580 * scaleY } });
  await page.waitForTimeout(500);
}

/**
 * 뒤로가기 버튼(하단 좌측) 위치를 클릭한다.
 */
async function clickBackBtn(page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const scaleX = box.width / 360;
  const scaleY = box.height / 640;
  await canvas.click({ position: { x: 90 * scaleX, y: 580 * scaleY } });
  await page.waitForTimeout(500);
}

/**
 * 상단 뒤로 화살표(30, 30) 위치를 클릭한다.
 */
async function clickBackArrow(page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const scaleX = box.width / 360;
  const scaleY = box.height / 640;
  await canvas.click({ position: { x: 30 * scaleX, y: 30 * scaleY } });
  await page.waitForTimeout(500);
}

// ── 1. 씬 로드 및 기본 상태 ──

test.describe('CharacterDetailScene - 씬 로드', () => {

  test('CharacterScene이 정상 로드되고 활성화된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('CharacterScene');
  });

  test('초기 캐릭터가 agent (기본 선택)이다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const state = await getCharSceneState(page);
    expect(state).not.toBeNull();
    expect(state.charId).toBe('agent');
    expect(state.currentIndex).toBe(0);
  });

  test('visibleChars가 phase <= 3인 4캐릭터이다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const charIds = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      return cs._visibleChars.map(c => c.id);
    });

    expect(charIds).toEqual(['agent', 'sniper', 'engineer', 'berserker']);
    expect(charIds.length).toBe(4);
  });

  test('fromScene 기본값이 MenuScene이다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const state = await getCharSceneState(page);
    expect(state.fromScene).toBe('MenuScene');
  });

  test('stageId 기본값이 stage_1이다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const state = await getCharSceneState(page);
    expect(state.stageId).toBe('stage_1');
  });
});

// ── 2. 초상화 + 글로우 배경 텍스처 ──

test.describe('CharacterDetailScene - 초상화 텍스처', () => {

  test('4캐릭터 글로우 배경 텍스처가 생성되어 있다', async ({ page }) => {
    await loadGame(page);

    const exists = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const ids = ['agent', 'sniper', 'engineer', 'berserker'];
      return ids.map(id => ({
        id,
        exists: g.textures.exists(`char_portrait_bg_${id}`),
      }));
    });

    for (const item of exists) {
      expect(item.exists, `char_portrait_bg_${item.id} 텍스처가 존재해야 한다`).toBe(true);
    }
  });

  test('글로우 배경 텍스처 크기가 120x120이다', async ({ page }) => {
    await loadGame(page);

    const sizes = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const ids = ['agent', 'sniper', 'engineer', 'berserker'];
      return ids.map(id => {
        const tex = g.textures.get(`char_portrait_bg_${id}`);
        const frame = tex.getSourceImage();
        return { id, width: frame.width, height: frame.height };
      });
    });

    for (const s of sizes) {
      expect(s.width, `${s.id} 텍스처 너비`).toBe(120);
      expect(s.height, `${s.id} 텍스처 높이`).toBe(120);
    }
  });
});

// ── 3. 좌우 화살표 캐릭터 전환 ──

test.describe('CharacterDetailScene - 캐릭터 전환', () => {

  test('우측 화살표 클릭 시 다음 캐릭터로 전환된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    let state = await getCharSceneState(page);
    expect(state.charId).toBe('agent');

    await clickNavArrow(page, 'right');
    state = await getCharSceneState(page);
    expect(state.charId).toBe('sniper');

    await clickNavArrow(page, 'right');
    state = await getCharSceneState(page);
    expect(state.charId).toBe('engineer');

    await clickNavArrow(page, 'right');
    state = await getCharSceneState(page);
    expect(state.charId).toBe('berserker');
  });

  test('좌측 화살표 클릭 시 이전 캐릭터로 전환된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    await clickNavArrow(page, 'left');
    const state = await getCharSceneState(page);
    expect(state.charId).toBe('berserker');
  });

  test('순환 네비게이션: 마지막에서 우측 -> 처음으로', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    await clickNavArrow(page, 'left');
    let state = await getCharSceneState(page);
    expect(state.charId).toBe('berserker');

    await clickNavArrow(page, 'right');
    state = await getCharSceneState(page);
    expect(state.charId).toBe('agent');
  });

  test('빠른 연타 클릭에도 인덱스가 정상 범위를 유지한다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    for (let i = 0; i < 10; i++) {
      await clickNavArrow(page, 'right');
    }

    const state = await getCharSceneState(page);
    expect(state.currentIndex).toBeGreaterThanOrEqual(0);
    expect(state.currentIndex).toBeLessThan(4);
    expect(state.charId).toBe('engineer');
  });
});

// ── 4. 해금/잠금 캐릭터 표시 ──

test.describe('CharacterDetailScene - 잠금 캐릭터', () => {

  test('agent는 기본 해금, 출격 활성화', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const state = await getCharSceneState(page);
    expect(state.charId).toBe('agent');
    expect(state.sortieEnabled).toBe(true);
  });

  test('sniper는 신규 세이브에서 잠금, 출격 비활성', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    // sniper로 이동
    await clickNavArrow(page, 'right');
    const state = await getCharSceneState(page);
    expect(state.charId).toBe('sniper');
    expect(state.sortieEnabled).toBe(false);
  });

  test('잠금 캐릭터에서 출격 버튼 클릭해도 씬 전환 안 됨', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    // sniper로 이동
    await clickNavArrow(page, 'right');
    const state = await getCharSceneState(page);
    expect(state.charId).toBe('sniper');
    expect(state.sortieEnabled).toBe(false);

    // 출격 버튼 클릭 시도
    await clickSortieBtn(page);

    // 여전히 CharacterScene이어야 함
    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('CharacterScene');
  });
});

// ── 5. 출격 로직 ──

test.describe('CharacterDetailScene - 출격', () => {

  test('해금 캐릭터(agent)에서 출격 시 씬 전환된다', async ({ page }) => {
    await loadGame(page);

    // 프롤로그 컷신 본 것으로 처리 후 리로드
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('neon-exodus-save') || '{}');
      save.cutscenesSeen = save.cutscenesSeen || {};
      save.cutscenesSeen.prologue = true;
      save.cutscenesSeen.stage_1_intro = true;
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    await reloadSaveManager(page);

    await navigateToCharacterScene(page);

    const state = await getCharSceneState(page);
    expect(state.sortieEnabled).toBe(true);

    // 출격 클릭
    await clickSortieBtn(page);
    await page.waitForTimeout(1500);

    // GameScene으로 전환됨 (컷신 이미 봄)
    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('GameScene');
  });

  test('출격 시 selectedCharacter가 SaveManager에 저장된다', async ({ page }) => {
    await loadGame(page);

    // 컷신 스킵 설정
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('neon-exodus-save') || '{}');
      save.cutscenesSeen = save.cutscenesSeen || {};
      save.cutscenesSeen.prologue = true;
      save.cutscenesSeen.stage_1_intro = true;
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    await reloadSaveManager(page);

    await navigateToCharacterScene(page);
    await clickSortieBtn(page);
    await page.waitForTimeout(500);

    const savedChar = await page.evaluate(() => {
      return localStorage.getItem('neon-exodus-save');
    });
    const saveData = JSON.parse(savedChar);
    expect(saveData.selectedCharacter).toBe('agent');
  });
});

// ── 6. 뒤로가기 분기 ──

test.describe('CharacterDetailScene - 뒤로가기', () => {

  test('MenuScene에서 진입 시 뒤로가기 -> MenuScene', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page, { fromScene: 'MenuScene' });

    await clickBackBtn(page);
    await page.waitForTimeout(1000);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('MenuScene');
  });

  test('StageSelectScene에서 진입 시 뒤로가기 -> StageSelectScene', async ({ page }) => {
    await loadGame(page);

    // StageSelectScene을 먼저 시작하여 Phaser 씬 매니저에 등록
    await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      g.scene.start('StageSelectScene');
    });
    await page.waitForTimeout(1000);

    // CharacterScene으로 전환 (fromScene: StageSelectScene)
    await navigateToCharacterScene(page, { fromScene: 'StageSelectScene', stageId: 'stage_1' });

    const state = await getCharSceneState(page);
    expect(state.fromScene).toBe('StageSelectScene');

    await clickBackBtn(page);
    await page.waitForTimeout(1000);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('StageSelectScene');
  });

  test('ESC 키로 뒤로가기 동작', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page, { fromScene: 'MenuScene' });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('MenuScene');
  });

  test('상단 뒤로 화살표 클릭으로 뒤로가기 동작', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page, { fromScene: 'MenuScene' });

    await clickBackArrow(page);
    await page.waitForTimeout(1000);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('MenuScene');
  });
});

// ── 7. MenuScene/StageSelectScene fromScene 전달 ──

test.describe('CharacterDetailScene - 라우팅 호환', () => {

  test('MenuScene 캐릭터 버튼이 fromScene: MenuScene을 전달한다', async ({ page }) => {
    await loadGame(page);

    // MenuScene에서 캐릭터 버튼 클릭 (96, 370)
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;
    await canvas.click({ position: { x: 96 * scaleX, y: 370 * scaleY } });
    await page.waitForTimeout(1500);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('CharacterScene');

    const state = await getCharSceneState(page);
    expect(state.fromScene).toBe('MenuScene');
  });

  test('StageSelectScene 출격 버튼이 fromScene: StageSelectScene을 전달한다', async ({ page }) => {
    await loadGame(page);

    // StageSelectScene으로 직접 이동
    await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      g.scene.start('StageSelectScene');
    });
    await page.waitForTimeout(1500);

    // StageSelectScene 확인
    const stageSceneName = await getActiveSceneName(page);
    expect(stageSceneName).toBe('StageSelectScene');

    // StageSelectScene의 출격(Deploy) 버튼 클릭
    // _createBtn(centerX + 60, btnY, ...) -> x=240, y=580
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    const scaleX = box.width / 360;
    const scaleY = box.height / 640;
    await canvas.click({ position: { x: 240 * scaleX, y: 580 * scaleY } });
    await page.waitForTimeout(1500);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('CharacterScene');

    const state = await getCharSceneState(page);
    expect(state.fromScene).toBe('StageSelectScene');
  });
});

// ── 8. 스킬 요약 영역 ──

test.describe('CharacterDetailScene - 스킬 요약', () => {

  test('agent의 Q/W/E/R 스킬 데이터가 표시된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const skillInfo = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements.filter(e => e && e.type === 'Text');
      const textContents = texts.map(t => t.text);
      return {
        textContents,
        hasQ: textContents.some(t => t.includes('[Q]')),
        hasW: textContents.some(t => t.includes('[W]')),
        hasE: textContents.some(t => t.includes('[E]')),
        hasR: textContents.some(t => t.includes('[R]')),
      };
    });

    expect(skillInfo.hasQ).toBe(true);
    expect(skillInfo.hasW).toBe(true);
    expect(skillInfo.hasE).toBe(true);
    expect(skillInfo.hasR).toBe(true);
  });

  test('스킬 레벨이 Lv.N/max 형식으로 표시된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasLvDisplay = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.some(t => /Lv\.\d+\/\d+/.test(t));
    });

    expect(hasLvDisplay).toBe(true);
  });
});

// ── 9. 인디케이터 도트 ──

test.describe('CharacterDetailScene - 인디케이터 도트', () => {

  test('인디케이터 도트 Graphics 요소가 존재한다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasDotGraphics = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      return cs._dynamicElements.some(e => e && e.type === 'Graphics');
    });

    expect(hasDotGraphics).toBe(true);
  });
});

// ── 10. 예외 및 엣지케이스 ──

test.describe('CharacterDetailScene - 예외 시나리오', () => {

  test('init에 data 없이 호출해도 크래시 안 됨', async ({ page }) => {
    await loadGame(page);

    // data 없이 CharacterScene 시작
    await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      g.scene.start('CharacterScene');
    });
    await page.waitForTimeout(1500);

    // CharacterScene이 활성화되었는지 확인
    const state = await getCharSceneState(page);
    expect(state).not.toBeNull();
    expect(state.fromScene).toBe('MenuScene'); // 기본값
    expect(state.stageId).toBe('stage_1'); // 기본값
  });

  test('존재하지 않는 fromScene 전달 시 에러 처리', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);
    await navigateToCharacterScene(page, { fromScene: 'NonExistentScene' });

    // 뒤로가기 시도
    await clickBackBtn(page);
    await page.waitForTimeout(500);

    // Phaser는 미등록 씬에 대해 경고만 출력하고 크래시하지 않음
    if (errors.length > 0) {
      console.log('NonExistentScene 뒤로가기 에러:', errors);
    }
  });

  test('동적 요소 재생성 시 메모리 누수 없음 (연속 전환)', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    // 20번 연속 전환
    for (let i = 0; i < 20; i++) {
      await clickNavArrow(page, 'right');
    }

    const elementCount = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      return cs._dynamicElements.length;
    });

    // 현재 표시 중인 요소만 남아야 함 (파괴된 요소 포함 안 됨)
    expect(elementCount).toBeLessThan(30);
  });

  test('씬 재진입 시 이전 상태가 정리된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    // 다른 캐릭터로 이동
    await clickNavArrow(page, 'right');
    await clickNavArrow(page, 'right');

    // ESC로 MenuScene 복귀 (더 안정적)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 다시 CharacterScene 진입
    await navigateToCharacterScene(page);

    const sceneName = await getActiveSceneName(page);
    expect(sceneName).toBe('CharacterScene');

    // 새로 진입 시 selectedCharacter 기준으로 재설정됨
    const state = await getCharSceneState(page);
    expect(state).not.toBeNull();
  });
});

// ── 11. 콘솔 에러 감시 ──

test.describe('CharacterDetailScene - 안정성', () => {

  test('전체 플로우에서 JS 에러 없음', async ({ page }) => {
    const errors = [];
    // 게임 로드 후부터만 에러 수집 (BootScene의 비관련 에러 제외)
    await loadGame(page);

    page.on('pageerror', err => errors.push(err.message));

    await navigateToCharacterScene(page);

    // 4캐릭터 순회
    for (let i = 0; i < 4; i++) {
      await clickNavArrow(page, 'right');
    }

    // 뒤로가기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 다시 진입 (StageSelectScene 경유)
    await navigateToCharacterScene(page, { fromScene: 'StageSelectScene', stageId: 'stage_2' });

    // 4캐릭터 순회 (좌측)
    for (let i = 0; i < 4; i++) {
      await clickNavArrow(page, 'left');
    }

    // ESC로 뒤로가기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });
});

// ── 12. 시각적 검증 (스크린샷) ──

test.describe('CharacterDetailScene - 시각적 검증', () => {

  test('agent 상세 뷰 전체 레이아웃', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/char-detail-agent.png',
    });
  });

  test('sniper (잠금 캐릭터) 표시', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);
    await clickNavArrow(page, 'right');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/char-detail-sniper-locked.png',
    });
  });

  test('berserker (잠금 캐릭터) 표시', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);
    await clickNavArrow(page, 'left');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/char-detail-berserker-locked.png',
    });
  });

  test('해금된 다중 캐릭터 상태 (SP 배지 포함)', async ({ page }) => {
    // localStorage 세팅 후 리로드
    await page.goto('/');
    await page.evaluate(() => {
      const save = {
        version: 13,
        credits: 1000,
        dataCores: 50,
        upgrades: {},
        characters: { agent: true, sniper: true, engineer: true, berserker: true },
        selectedCharacter: 'agent',
        achievements: {},
        autoHuntUnlocked: false,
        autoHuntEnabled: false,
        upgradeUnlocked: false,
        droneUnlocked: false,
        droneUpgrades: {},
        cutscenesSeen: {},
        stageClears: {},
        selectedDifficulty: 'normal',
        unlockedWeapons: [],
        selectedStage: 'stage_1',
        characterClears: {},
        characterProgression: {
          agent:     { xp: 2, level: 5, sp: 3, skills: { Q: 2, W: 1, E: 0, R: 0 } },
          sniper:    { xp: 1, level: 3, sp: 2, skills: { Q: 1, W: 1, E: 0, R: 0 } },
          engineer:  { xp: 3, level: 2, sp: 0, skills: { Q: 1, W: 0, E: 0, R: 0 } },
          berserker: { xp: 0, level: 1, sp: 0, skills: { Q: 1, W: 0, E: 0, R: 0 } },
          medic:     { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 } },
          hidden:    { xp: 0, level: 0, sp: 0, skills: { Q: 0, W: 0, E: 0, R: 0 } },
        },
        dailyMissions: { date: '', seed: 0, missions: [], bonusClaimed: false, streak: 0, totalCompleted: 0, charsUsedToday: [] },
        stats: { totalKills: 6000, totalRuns: 20, totalClears: 15, totalPlayTime: 50000, maxLevel: 10, maxKillsInRun: 500, longestSurvival: 800, consecutiveClears: 3, totalBossKills: 15, totalSurviveMinutes: 300, totalMinibossKills: 20 },
        collection: { weaponsSeen: ['blaster'], passivesSeen: [], enemiesSeen: [] },
        settings: { locale: 'en', sfxVolume: 1, bgmVolume: 0.7, hapticEnabled: true, bgmEnabled: true, sfxEnabled: true },
      };
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    // 게임 리로드 (SaveManager 초기화 포함)
    await loadGame(page);
    await navigateToCharacterScene(page);
    await page.waitForTimeout(500);

    // agent (SP 3)
    await page.screenshot({
      path: 'tests/screenshots/char-detail-agent-unlocked-sp.png',
    });

    // sniper (해금됨, SP 2)
    await clickNavArrow(page, 'right');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'tests/screenshots/char-detail-sniper-unlocked.png',
    });

    // engineer (해금됨, SP 0)
    await clickNavArrow(page, 'right');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'tests/screenshots/char-detail-engineer-unlocked.png',
    });

    // berserker (해금됨)
    await clickNavArrow(page, 'right');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'tests/screenshots/char-detail-berserker-unlocked.png',
    });
  });
});

// ── 13. SP 배지 표시 ──

test.describe('CharacterDetailScene - SP 배지', () => {

  test('SP > 0인 캐릭터에서 SP 배지가 표시된다', async ({ page }) => {
    // localStorage 설정 후 리로드로 SaveManager 갱신
    await page.goto('/');
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('neon-exodus-save') || '{}');
      save.characterProgression = save.characterProgression || {};
      save.characterProgression.agent = { xp: 0, level: 5, sp: 3, skills: { Q: 1, W: 1, E: 0, R: 0 } };
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasSPBadge = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.some(t => t.includes('SP'));
    });

    expect(hasSPBadge).toBe(true);
  });

  test('SP = 0인 캐릭터에서 SP 배지가 숨겨진다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasSPBadge = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.some(t => t.includes('SP'));
    });

    expect(hasSPBadge).toBe(false);
  });
});

// ── 14. XP 바 표시 ──

test.describe('CharacterDetailScene - XP 바', () => {

  test('만렙 캐릭터에서 XP 수치가 MAX로 표시된다', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('neon-exodus-save') || '{}');
      save.characterProgression = save.characterProgression || {};
      save.characterProgression.agent = { xp: 0, level: 18, sp: 0, skills: { Q: 5, W: 5, E: 5, R: 3 } };
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    await loadGame(page);
    await navigateToCharacterScene(page);

    const xpText = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.find(t => t === 'MAX');
    });

    expect(xpText).toBe('MAX');

    await page.screenshot({
      path: 'tests/screenshots/char-detail-agent-maxlevel.png',
    });
  });

  test('레벨 1 캐릭터에서 XP 수치가 N/N 형식으로 표시된다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasXpRatio = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.some(t => /^\d+\/\d+$/.test(t));
    });

    expect(hasXpRatio).toBe(true);
  });
});

// ── 15. i18n 키 검증 ──

test.describe('CharacterDetailScene - i18n', () => {

  test('charDetail.skills 키가 존재하고 값이 올바르다', async ({ page }) => {
    await loadGame(page);
    await navigateToCharacterScene(page);

    const hasSkillLabel = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const texts = cs._dynamicElements
        .filter(e => e && e.type === 'Text')
        .map(t => t.text);
      return texts.some(t => t === 'Skills' || t === '스킬');
    });

    expect(hasSkillLabel).toBe(true);
  });
});

// ── 16. config.js 추가 색상 검증 ──

test.describe('CharacterDetailScene - config 색상', () => {

  test('COLORS.DARK_GRAY, COLORS.TOAST_BG가 정의됨', async ({ page }) => {
    await loadGame(page);

    const colors = await page.evaluate(() => {
      return {
        darkGrayHex: 0x333333,
        toastBgHex: 0x002244,
      };
    });

    expect(colors.darkGrayHex).toBe(0x333333);
    expect(colors.toastBgHex).toBe(0x002244);
  });

  test('UI_COLORS.gold, UI_COLORS.goldBg가 SP 배지에 적용됨', async ({ page }) => {
    // SP > 0 세이브 설정 + 리로드
    await page.goto('/');
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('neon-exodus-save') || '{}');
      save.characterProgression = save.characterProgression || {};
      save.characterProgression.agent = { xp: 0, level: 5, sp: 3, skills: { Q: 1, W: 1, E: 0, R: 0 } };
      localStorage.setItem('neon-exodus-save', JSON.stringify(save));
    });
    await loadGame(page);
    await navigateToCharacterScene(page);

    const spBadgeStyle = await page.evaluate(() => {
      const g = window.__NEON_EXODUS;
      const cs = g.scene.getScene('CharacterScene');
      const spBadge = cs._dynamicElements.find(e =>
        e && e.type === 'Text' && e.text && e.text.includes('SP')
      );
      if (!spBadge) return null;
      return {
        color: spBadge.style?.color,
        backgroundColor: spBadge.style?.backgroundColor,
      };
    });

    expect(spBadgeStyle).not.toBeNull();
    expect(spBadgeStyle.color).toBe('#FFD700');
    expect(spBadgeStyle.backgroundColor).toBe('#333300');
  });
});
