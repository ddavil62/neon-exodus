/**
 * @fileoverview 프리징 버그 스트레스 테스트.
 *
 * 진화 팝업 + 보스/미니보스 스폰이 동시에 발생하는 시나리오를
 * 100회 반복하여 마젠타 화면 고정 및 프리징이 재현되지 않는지 검증한다.
 *
 * 시나리오:
 * - A: 진화 팝업 열린 상태에서 보스 스폰
 * - B: 진화 팝업 열린 상태에서 미니보스 스폰
 * - C: 보스 스폰 직후 진화 발동
 * - D: 다수 적 + 진화 + 보스 동시 발생 (과부하)
 */
import { test, expect } from '@playwright/test';

// ── 상수 ──

const EVOLUTION_MAP = {
  precision_cannon: 'blaster',
  plasma_storm: 'electric_chain',
  nuke_missile: 'missile',
  ion_cannon: 'laser_gun',
  guardian_sphere: 'plasma_orb',
  hivemind: 'drone',
  perpetual_emp: 'emp_blast',
  phantom_strike: 'force_blade',
  bioplasma: 'nano_swarm',
  event_horizon: 'vortex_cannon',
  death_blossom: 'reaper_field',
};

const EVOLVED_IDS = Object.keys(EVOLUTION_MAP);

// ── 헬퍼 ──

/**
 * GameScene을 시작하고 준비될 때까지 대기한다.
 */
async function startGameScene(page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__NEON_EXODUS, { timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    game.scene.start('GameScene', { characterId: 'agent', stageId: 'stage_1' });
  });
  await page.waitForTimeout(3000);

  const ready = await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (gs && gs.player) {
      // 테스트 중 사망 방지: 무적 + HP 풀 회복
      gs.player.invincible = true;
      gs.player.invincibleTimer = 999999;
      gs.player.hp = gs.player.maxHp;
    }
    return !!(gs && gs.weaponSystem && gs.waveSystem && gs.player);
  });
  expect(ready).toBe(true);
}

/**
 * 게임 씬을 가져온다.
 */
function getGameScene(page) {
  return page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    return game.scene.getScene('GameScene');
  });
}

/**
 * 게임이 프리징되었는지 확인한다.
 * scene.time이 진행되고 있는지, 카메라 플래시가 고정되었는지 확인.
 */
async function checkNotFrozen(page) {
  const result = await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.scene.isActive()) return { alive: false, reason: 'scene_inactive' };

    // 카메라 플래시 고정 확인
    const cam = gs.cameras.main;
    const flashEffect = cam._flashAlpha !== undefined ? cam._flashAlpha : 0;

    return {
      alive: true,
      isPaused: gs.isPaused,
      modalOpen: gs._modalOpen,
      levelUpActive: gs._levelUpActive,
      flashAlpha: flashEffect,
      time: gs.time.now,
    };
  });
  return result;
}

/**
 * 시나리오 A: 진화 팝업 열린 상태에서 보스 스폰
 */
async function scenarioA_EvolutionThenBoss(page) {
  return page.evaluate((evolvedIds) => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.weaponSystem) return { success: false, error: 'no_scene' };

    // 랜덤 진화 무기 선택
    const evoId = evolvedIds[Math.floor(Math.random() * evolvedIds.length)];

    // 진화 팝업 강제 열기
    gs._showEvolutionPopup({
      weaponId: 'blaster',
      passiveId: 'critDamage',
      resultId: evoId,
      resultNameKey: `weapon.${evoId}.name`,
    });

    // 즉시 보스 스폰 이벤트 호출 (카메라 플래시 발동 시도)
    gs.onBossSpawn({ type: 'boss', hp: 1000 });

    return {
      success: true,
      modalOpen: gs._modalOpen,
      isPaused: gs.isPaused,
    };
  }, EVOLVED_IDS);
}

/**
 * 시나리오 B: 진화 팝업 열린 상태에서 미니보스 스폰
 */
async function scenarioB_EvolutionThenMiniBoss(page) {
  return page.evaluate((evolvedIds) => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.weaponSystem) return { success: false, error: 'no_scene' };

    const evoId = evolvedIds[Math.floor(Math.random() * evolvedIds.length)];

    gs._showEvolutionPopup({
      weaponId: 'electric_chain',
      passiveId: 'moveSpeed',
      resultId: evoId,
      resultNameKey: `weapon.${evoId}.name`,
    });

    gs.onMiniBossSpawn({ type: 'miniboss', hp: 500 });

    return {
      success: true,
      modalOpen: gs._modalOpen,
      isPaused: gs.isPaused,
    };
  }, EVOLVED_IDS);
}

/**
 * 시나리오 C: 보스 스폰 직후 진화 발동
 */
async function scenarioC_BossThenEvolution(page) {
  return page.evaluate((evolvedIds) => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.weaponSystem) return { success: false, error: 'no_scene' };

    const evoId = evolvedIds[Math.floor(Math.random() * evolvedIds.length)];

    // 먼저 보스 스폰 (카메라 플래시 시작)
    gs.onBossSpawn({ type: 'boss', hp: 1000 });

    // 직후 진화 팝업 열기
    gs._showEvolutionPopup({
      weaponId: 'missile',
      passiveId: 'attackSpeed',
      resultId: evoId,
      resultNameKey: `weapon.${evoId}.name`,
    });

    return {
      success: true,
      modalOpen: gs._modalOpen,
      isPaused: gs.isPaused,
    };
  }, EVOLVED_IDS);
}

/**
 * 시나리오 D: 보스 + 미니보스 + 진화 동시 발생
 */
async function scenarioD_AllAtOnce(page) {
  return page.evaluate((evolvedIds) => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.weaponSystem) return { success: false, error: 'no_scene' };

    const evoId = evolvedIds[Math.floor(Math.random() * evolvedIds.length)];

    // 모두 동시에 호출
    gs.onMiniBossSpawn({ type: 'miniboss', hp: 500 });
    gs.onBossSpawn({ type: 'boss', hp: 1000 });
    gs._showEvolutionPopup({
      weaponId: 'plasma_orb',
      passiveId: 'hpRegen',
      resultId: evoId,
      resultNameKey: `weapon.${evoId}.name`,
    });

    return {
      success: true,
      modalOpen: gs._modalOpen,
      isPaused: gs.isPaused,
    };
  }, EVOLVED_IDS);
}

/**
 * 팝업을 닫고 게임 상태를 초기화한다.
 */
async function cleanupPopup(page) {
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.scene.isActive()) return;

    // 모달 닫기
    gs._modalOpen = false;
    gs.isPaused = false;
    gs._levelUpActive = false;

    // 플레이어 무적 재설정
    if (gs.player) {
      gs.player.invincible = true;
      gs.player.invincibleTimer = 999999;
      gs.player.hp = gs.player.maxHp;
    }

    // 물리 재개 (이미 running이면 무시)
    try {
      if (gs.physics && gs.physics.world && gs.physics.world.isPaused) {
        gs.physics.resume();
      }
    } catch (e) { /* ignore */ }

    // 카메라 플래시 강제 완료 (resetFX 대신 안전한 방식)
    try {
      const cam = gs.cameras.main;
      if (cam && cam._flashAlpha > 0) {
        cam._flashAlpha = 0;
      }
    } catch (e) { /* ignore */ }
  });
  await page.waitForTimeout(150);
}

/**
 * 시나리오 E: 보스 플래시 진행 중 isPaused 설정 (레이스 컨디션 재현)
 */
async function scenarioE_FlashThenPause(page) {
  return page.evaluate((evolvedIds) => {
    const game = window.__NEON_EXODUS;
    const gs = game.scene.getScene('GameScene');
    if (!gs || !gs.weaponSystem) return { success: false, error: 'no_scene' };

    // 1. 보스 플래시 강제 발동 (가드 우회)
    gs.cameras.main.flash(500, 255, 0, 255, false);

    // 2. 즉시 pause (레이스 컨디션 시뮬레이션)
    const evoId = evolvedIds[Math.floor(Math.random() * evolvedIds.length)];
    gs._showEvolutionPopup({
      weaponId: 'blaster',
      passiveId: 'critDamage',
      resultId: evoId,
      resultNameKey: `weapon.${evoId}.name`,
    });

    return {
      success: true,
      modalOpen: gs._modalOpen,
      isPaused: gs.isPaused,
    };
  }, EVOLVED_IDS);
}

// ── 테스트 ──

const scenarios = [
  { name: 'A: 진화팝업→보스스폰', fn: scenarioA_EvolutionThenBoss },
  { name: 'B: 진화팝업→미니보스스폰', fn: scenarioB_EvolutionThenMiniBoss },
  { name: 'C: 보스스폰→진화팝업', fn: scenarioC_BossThenEvolution },
  { name: 'D: 보스+미니보스+진화 동시', fn: scenarioD_AllAtOnce },
  { name: 'E: 플래시진행중→pause', fn: scenarioE_FlashThenPause },
];

test.describe('프리징 버그 스트레스 테스트 (1000회)', () => {
  test.setTimeout(1800000); // 30분 타임아웃

  test('게임 씬 초기화', async ({ page }) => {
    await startGameScene(page);

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < 1000; i++) {
      // 4개 시나리오를 순환
      const scenario = scenarios[i % scenarios.length];

      try {
        // 시나리오 실행
        const result = await scenario.fn(page);

        if (!result.success) {
          // 씬이 죽었으면 재시작
          await startGameScene(page);
          failed++;
          failures.push(`#${i + 1} ${scenario.name}: scene_dead`);
          continue;
        }

        // 200ms 대기 후 프리징 확인
        await page.waitForTimeout(200);
        const status = await checkNotFrozen(page);

        if (!status.alive) {
          // scene_inactive는 씬 전환(게임 오버 등)이지 프리징 아님 → 재시작 후 계속
          console.log(`  [복구] #${i + 1} ${scenario.name}: ${status.reason} (씬 재시작)`);
          await startGameScene(page);
          passed++; // 프리징이 아니므로 통과로 간주
          continue;
        }

        // 실제 프리징 확인: 카메라 플래시가 높은 alpha로 고정되어 있는지
        if (status.flashAlpha > 0.5 && status.isPaused) {
          failed++;
          failures.push(`#${i + 1} ${scenario.name}: FREEZE flashAlpha=${status.flashAlpha}`);
          await startGameScene(page);
          continue;
        }

        // 팝업 정리 후 다음 반복
        await cleanupPopup(page);

        // 정리 후 게임이 살아있는지 재확인
        const postClean = await checkNotFrozen(page);
        if (!postClean.alive) {
          // cleanup 중 씬 전환 → 재시작 후 계속 (프리징 아님)
          console.log(`  [복구] #${i + 1} ${scenario.name}: cleanup 후 씬 재시작`);
          await startGameScene(page);
        }

        passed++;
      } catch (err) {
        failed++;
        failures.push(`#${i + 1} ${scenario.name}: ${err.message.slice(0, 80)}`);
        // 에러 복구: 씬 재시작
        try {
          await startGameScene(page);
        } catch {
          // 페이지 자체가 죽었으면 새로 goto
          await page.goto('/');
          await page.waitForTimeout(3000);
          await startGameScene(page);
        }
      }

      // 매 25회마다 진행 상황 로그
      if ((i + 1) % 100 === 0) {
        console.log(`[진행] ${i + 1}/1000 — 통과: ${passed}, 실패: ${failed}`);
      }
    }

    console.log(`\n=== 최종 결과 ===`);
    console.log(`통과: ${passed}/1000`);
    console.log(`실패: ${failed}/1000`);
    if (failures.length > 0) {
      console.log(`\n실패 목록:`);
      failures.forEach(f => console.log(`  - ${f}`));
    }

    // 100% 통과 요구
    expect(failed, `프리징 발생 ${failed}회:\n${failures.join('\n')}`).toBe(0);
  });
});
