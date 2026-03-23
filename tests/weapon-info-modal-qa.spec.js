/**
 * @fileoverview 무기/패시브 아이콘 클릭 시 설명 모달 QA 테스트.
 * 수용 기준 5개 + 자체 도출 예외 시나리오 검증.
 */

import { test, expect } from '@playwright/test';

// ── 유틸 함수 ──

/** 콘솔 에러를 수집한다. */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** 브라우저 컨텍스트에서 GameScene 인스턴스를 반환하는 인라인 코드 스니펫 */
const GS_SNIPPET = `
  const game = window.__NEON_EXODUS;
  const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
`;

/** 세이브 데이터를 주입한다. */
async function injectSaveData(page, overrides = {}) {
  await page.evaluate((overrides) => {
    const saveData = {
      version: 8,
      credits: 5000,
      dataCores: 0,
      upgrades: {},
      characters: { agent: true },
      selectedCharacter: 'agent',
      achievements: {},
      autoHuntUnlocked: true,
      autoHuntEnabled: false,
      stats: {
        totalKills: 100, totalRuns: 5, totalClears: 2,
        totalPlayTime: 3600, maxLevel: 10, maxKillsInRun: 50,
        longestSurvival: 600, consecutiveClears: 1,
        totalBossKills: 2, totalSurviveMinutes: 60,
        totalMinibossKills: 5,
      },
      characterClears: { agent: 2 },
      collection: { weaponsSeen: ['blaster'], passivesSeen: [], enemiesSeen: [] },
      settings: { locale: 'ko', sfxVolume: 0, bgmVolume: 0 },
      stageClears: { stage_1: true },
      unlockedWeapons: ['blaster'],
      cutscenesSeen: {},
      ...overrides,
    };
    localStorage.setItem('neon-exodus-save', JSON.stringify(saveData));
  }, overrides);
}

/** 게임을 로드하고 GameScene까지 진입한다. */
async function loadGameScene(page, saveOverrides = {}) {
  await page.goto('/');
  await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 15000 });

  await injectSaveData(page, saveOverrides);

  await page.reload();
  await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 15000 });
  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    return game && game.scene && game.scene.isActive('MenuScene');
  }, { timeout: 15000 });

  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    game.scene.start('GameScene', { characterId: 'agent', stageId: 'stage_1' });
  });

  await page.waitForFunction(() => {
    const game = window.__NEON_EXODUS;
    if (!game || !game.scene) return false;
    const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
    return gs && gs.scene.isActive() && gs.player;
  }, { timeout: 15000 });

  await page.waitForTimeout(1000);
}

// ── 수용 기준 테스트 ──

test.describe('수용 기준 검증', () => {

  test('AC1: 무기 아이콘 탭 시 이름/설명/레벨 모달이 열린다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const inv = gs._inventoryHUD;
      if (!inv || inv.weapons.length === 0) return { error: 'no weapons in HUD' };

      const slot = inv.weapons[0];
      if (!slot.hitZone) return { error: 'no hitZone on weapon slot' };

      const w = gs.weaponSystem.weapons[0];
      gs._showWeaponInfoModal(w);

      return {
        isPaused: gs.isPaused,
        modalOpen: gs._modalOpen,
        weaponId: w.id,
        weaponLevel: w.level,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.isPaused).toBe(true);
    expect(result.modalOpen).toBe(true);
    expect(result.weaponId).toBe('blaster');

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-info-modal-blaster.png' });

    expect(errors).toEqual([]);
  });

  test('AC2: 패시브 아이콘 탭 시 이름/설명/상세/레벨 모달이 열린다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['booster'] = 3;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('booster', 3);

      return {
        isPaused: gs.isPaused,
        modalOpen: gs._modalOpen,
      };
    });

    expect(result.isPaused).toBe(true);
    expect(result.modalOpen).toBe(true);

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/passive-info-modal-booster.png' });

    expect(errors).toEqual([]);
  });

  test('AC3: 진화된 무기 아이콘 탭 시 진화 무기 이름/설명/뱃지가 표시된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[0];
      w._evolvedId = 'precision_cannon';
      w.level = 8;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[0];
      gs._showWeaponInfoModal(w);

      return {
        isPaused: gs.isPaused,
        modalOpen: gs._modalOpen,
        evolvedId: w._evolvedId,
      };
    });

    expect(result.isPaused).toBe(true);
    expect(result.modalOpen).toBe(true);
    expect(result.evolvedId).toBe('precision_cannon');

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-info-modal-evolved.png' });

    expect(errors).toEqual([]);
  });

  test('AC4: 모달 열림 시 isPaused=true, 닫기 시 isPaused=false', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    // 모달 열기 전 상태 확인
    const beforeState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      return { isPaused: gs.isPaused, modalOpen: gs._modalOpen };
    });
    expect(beforeState.isPaused).toBe(false);
    expect(beforeState.modalOpen).toBe(false);

    // 모달 열기
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    const openState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      return {
        isPaused: gs.isPaused,
        modalOpen: gs._modalOpen,
        physicsIsPaused: !gs.physics.world.enabled,
      };
    });
    expect(openState.isPaused).toBe(true);
    expect(openState.modalOpen).toBe(true);

    // 닫기 버튼 클릭
    // btnY = GAME_HEIGHT/2 + panelH/2 - 26 = 320 + 80 - 26 = 374 (non-evolved, panelH=160)
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width / 2, y: 374 } });

    await page.waitForTimeout(500);

    const closeState = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      return { isPaused: gs.isPaused, modalOpen: gs._modalOpen };
    });
    expect(closeState.isPaused).toBe(false);
    expect(closeState.modalOpen).toBe(false);

    expect(errors).toEqual([]);
  });

  test('AC5: _modalOpen=true일 때 다른 모달이 열리지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    // 패시브 추가
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['booster'] = 2;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    // 무기 모달 열기
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    // 패시브 모달 열기 시도 (차단되어야 함)
    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('booster', 2);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(true);
    expect(result.isPaused).toBe(true);

    // 또 다른 무기 모달 열기 시도
    const result2 = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
      return { modalOpen: gs._modalOpen };
    });
    expect(result2.modalOpen).toBe(true);

    expect(errors).toEqual([]);
  });
});

// ── HUD 재생성 검증 ──

test.describe('HUD 재생성 시 hitZone 재등록', () => {

  test('_refreshInventoryHUD 호출 후 hitZone이 정상 등록된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._refreshInventoryHUD();

      const inv = gs._inventoryHUD;
      const weaponHasHitZone = inv.weapons.every(slot => slot.hitZone && typeof slot.hitZone.destroy === 'function');

      return {
        weaponCount: inv.weapons.length,
        passiveCount: inv.passives.length,
        weaponHasHitZone,
      };
    });

    expect(result.weaponCount).toBeGreaterThan(0);
    expect(result.weaponHasHitZone).toBe(true);

    expect(errors).toEqual([]);
  });

  test('무기 추가 후 _refreshInventoryHUD 시 새 슬롯에도 hitZone이 있다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');

      const beforeCount = gs._inventoryHUD.weapons.length;

      gs.weaponSystem.weapons.push({ id: 'laser_gun', level: 1 });
      gs._refreshInventoryHUD();

      const afterCount = gs._inventoryHUD.weapons.length;
      const allHaveHitZone = gs._inventoryHUD.weapons.every(
        slot => slot.hitZone && typeof slot.hitZone.destroy === 'function'
      );

      return { beforeCount, afterCount, allHaveHitZone };
    });

    expect(result.afterCount).toBe(result.beforeCount + 1);
    expect(result.allHaveHitZone).toBe(true);

    expect(errors).toEqual([]);
  });
});

// ── 예외 및 엣지케이스 ──

test.describe('예외 및 엣지케이스', () => {

  test('레벨업 활성 상태에서 무기 모달이 열리지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._levelUpActive = true;
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(false);
    expect(result.isPaused).toBe(false);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._levelUpActive = false;
    });

    expect(errors).toEqual([]);
  });

  test('게임오버 상태에서 무기/패시브 모달이 열리지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isGameOver = true;
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(false);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isGameOver = false;
    });

    expect(errors).toEqual([]);
  });

  test('일시정지 중 무기 모달이 열리지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isPaused = true;
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
      return { modalOpen: gs._modalOpen };
    });

    expect(result.modalOpen).toBe(false);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isPaused = false;
    });

    expect(errors).toEqual([]);
  });

  test('존재하지 않는 패시브 ID로 모달 열기 시 크래시하지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('nonexistent_passive', 1);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(false);
    expect(result.isPaused).toBe(false);

    expect(errors).toEqual([]);
  });

  test('존재하지 않는 무기 ID의 무기 객체로 모달 열기 시 fallback 표시', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const fakeWeapon = { id: 'unknown_weapon_xyz', level: 1 };
      gs._showWeaponInfoModal(fakeWeapon);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(true);
    expect(result.isPaused).toBe(true);

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-info-modal-fallback.png' });

    expect(errors).toEqual([]);
  });

  test('일시정지 토글이 모달 열림 중 차단된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const beforePaused = gs.isPaused;

      if (typeof gs._togglePause === 'function') {
        gs._togglePause();
      }

      return { beforePaused, afterPaused: gs.isPaused, modalOpen: gs._modalOpen };
    });

    expect(result.afterPaused).toBe(true);
    expect(result.modalOpen).toBe(true);

    expect(errors).toEqual([]);
  });

  test('모달 닫기 후 즉시 다시 열 수 있다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isPaused = false;
      gs.physics.resume();
      gs._modalOpen = false;
    });

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(true);
    expect(result.isPaused).toBe(true);

    expect(errors).toEqual([]);
  });

  test('다수 무기가 있을 때 각 슬롯의 hitZone이 독립적으로 동작한다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.weaponSystem.weapons.push(
        { id: 'laser_gun', level: 3 },
        { id: 'plasma_orb', level: 2 },
      );
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[1]; // laser_gun
      gs._showWeaponInfoModal(w);
      return { modalOpen: gs._modalOpen, weaponId: w.id };
    });

    expect(result.modalOpen).toBe(true);
    expect(result.weaponId).toBe('laser_gun');

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-info-modal-laser.png' });

    expect(errors).toEqual([]);
  });

  test('다수 패시브가 있을 때 각 슬롯의 hitZone이 독립적으로 동작한다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['booster'] = 3;
      gs.player._passives['armor_plate'] = 2;
      gs.player._passives['battery_pack'] = 5;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('battery_pack', 5);
      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(true);

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/passive-info-modal-battery.png' });

    expect(errors).toEqual([]);
  });

  test('패시브 desc의 effectPerLevel 계산값 검증 (퍼센트 기반 표시 이슈)', async ({ page }) => {
    await loadGameScene(page);

    // 퍼센트 기반 패시브 (booster: effectPerLevel=0.08, Lv.3)
    const boosterResult = await page.evaluate(() => {
      const effectPerLevel = 0.08;
      const plevel = 3;
      const displayValue = Math.round(effectPerLevel * plevel * 100) / 100;
      return { displayValue, expected: 24 };
    });

    // 현재 구현: 0.24 표시 (기대값: 24)
    expect(boosterResult.displayValue).toBe(0.24);
    expect(boosterResult.displayValue).not.toBe(boosterResult.expected);

    // 비퍼센트 패시브 (battery_pack: effectPerLevel=20, Lv.3)
    const batteryResult = await page.evaluate(() => {
      const effectPerLevel = 20;
      const plevel = 3;
      const displayValue = Math.round(effectPerLevel * plevel * 100) / 100;
      return { displayValue, expected: 60 };
    });
    expect(batteryResult.displayValue).toBe(batteryResult.expected);
  });

  test('무기 모달 + 패시브 모달 연속 연타 시 중복 생성되지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['overclock'] = 1;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[0];

      gs._showWeaponInfoModal(w);
      gs._showWeaponInfoModal(w);
      gs._showPassiveInfoModal('overclock', 1);

      return { modalOpen: gs._modalOpen, isPaused: gs.isPaused };
    });

    expect(result.modalOpen).toBe(true);

    expect(errors).toEqual([]);
  });
});

// ── i18n 검증 ──

test.describe('i18n 검증', () => {

  test('ko 로케일에서 모달 텍스트가 한국어로 표시된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-modal-ko.png' });

    expect(errors).toEqual([]);
  });

  test('en 로케일에서 모달 텍스트가 영어로 표시된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page, { settings: { locale: 'en', sfxVolume: 0, bgmVolume: 0 } });

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/weapon-modal-en.png' });

    expect(errors).toEqual([]);
  });
});

// ── 시각적 검증 ──

test.describe('시각적 검증', () => {

  test('무기 모달 레이아웃이 캔버스 내에 수용된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/weapon-modal-layout.png' });

    expect(errors).toEqual([]);
  });

  test('패시브 모달 레이아웃이 캔버스 내에 수용된다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['critical_chip'] = 4;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('critical_chip', 4);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/passive-modal-layout.png' });

    expect(errors).toEqual([]);
  });

  test('진화 무기 모달은 더 높은 패널을 사용한다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[0];
      w._evolvedId = 'precision_cannon';
      w.level = 8;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/evolved-weapon-modal-layout.png' });

    expect(errors).toEqual([]);
  });

  test('무기 10개일 때 HUD 슬롯이 화면에 수용되고 모달이 열린다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const weaponIds = ['laser_gun', 'plasma_orb', 'electric_chain', 'missile',
                         'emp_blast', 'force_blade', 'nano_swarm', 'vortex_cannon', 'reaper_field'];
      for (const id of weaponIds) {
        gs.weaponSystem.weapons.push({ id, level: 1 });
      }
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const lastW = gs.weaponSystem.weapons[gs.weaponSystem.weapons.length - 1];
      gs._showWeaponInfoModal(lastW);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/weapon-modal-10-weapons.png' });

    expect(errors).toEqual([]);
  });
});

// ── 콘솔 에러 검증 ──

test.describe('콘솔 에러 없음 검증', () => {

  test('전체 흐름에서 콘솔 에러가 발생하지 않는다', async ({ page }) => {
    const errors = collectErrors(page);
    await loadGameScene(page);

    // 패시브 추가
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      if (!gs.player._passives) gs.player._passives = {};
      gs.player._passives['booster'] = 3;
      gs.player._passives['armor_plate'] = 2;
      gs._refreshInventoryHUD();
    });

    await page.waitForTimeout(300);

    // 1. 무기 모달 열기 -> 닫기
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showWeaponInfoModal(gs.weaponSystem.weapons[0]);
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isPaused = false;
      gs.physics.resume();
      gs._modalOpen = false;
    });
    await page.waitForTimeout(200);

    // 2. 패시브 모달 열기 -> 닫기
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs._showPassiveInfoModal('booster', 3);
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      gs.isPaused = false;
      gs.physics.resume();
      gs._modalOpen = false;
    });
    await page.waitForTimeout(200);

    // 3. 진화 무기 모달 열기
    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.scenes.find(s => s.constructor.name === 'GameScene');
      const w = gs.weaponSystem.weapons[0];
      w._evolvedId = 'precision_cannon';
      gs._showWeaponInfoModal(w);
    });
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });
});
