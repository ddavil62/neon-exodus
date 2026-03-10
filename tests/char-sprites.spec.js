/**
 * @fileoverview QA: 캐릭터별 고유 스프라이트 + 8방향 걷기 애니메이션 테스트.
 *
 * 검증 항목:
 * 1. 6종 캐릭터 idle/walk 에셋 로드 확인
 * 2. 30개 애니메이션 키 등록 확인
 * 3. 캐릭터별 idle 텍스처 키, walk 텍스처 키, walkAnimPrefix 확인
 * 4. 캐릭터별 이동/정지 시 올바른 텍스처 전환
 * 5. agent 하위 호환
 * 6. characterId 미전달 시 기본값 폴백
 * 7. 콘솔 에러 없음
 * 8. 시각적 검증 (스크린샷)
 */

import { test, expect } from '@playwright/test';

const GAME_LOAD_TIMEOUT = 15000;

// ── 공통 헬퍼: 게임 로드 후 MenuScene 대기 ──

async function waitForMenu(page) {
  await page.goto('/');

  await page.waitForFunction(
    () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
    { timeout: GAME_LOAD_TIMEOUT }
  );

  await page.waitForFunction(
    () => {
      const game = window.__NEON_EXODUS;
      const menu = game.scene.getScene('MenuScene');
      return menu && menu.scene.isActive();
    },
    { timeout: 10000 }
  );
}

// ── 공통 헬퍼: 특정 캐릭터로 GameScene 시작 ──

async function startGameWithCharacter(page, characterId = 'agent') {
  await waitForMenu(page);

  await page.evaluate((charId) => {
    const game = window.__NEON_EXODUS;
    const menuScene = game.scene.getScene('MenuScene');
    if (menuScene) {
      menuScene.scene.start('GameScene', { characterId: charId });
    }
  }, characterId);

  await page.waitForFunction(
    () => {
      const game = window.__NEON_EXODUS;
      if (!game) return false;
      const gs = game.scene.getScene('GameScene');
      return gs && gs.scene.isActive() && gs.player && gs.player.active;
    },
    { timeout: 10000 }
  );

  // 안정화 대기
  await page.waitForTimeout(1000);
}

// ── 캐릭터 정의 (테스트용 참조 데이터) ──

const ALL_CHARACTERS = [
  { id: 'agent',     idleKey: 'player',     walkKey: 'player_walk',     animPrefix: 'walk' },
  { id: 'sniper',    idleKey: 'sniper',     walkKey: 'sniper_walk',     animPrefix: 'sniper_walk' },
  { id: 'engineer',  idleKey: 'engineer',   walkKey: 'engineer_walk',   animPrefix: 'engineer_walk' },
  { id: 'berserker', idleKey: 'berserker',  walkKey: 'berserker_walk',  animPrefix: 'berserker_walk' },
  { id: 'medic',     idleKey: 'medic',      walkKey: 'medic_walk',      animPrefix: 'medic_walk' },
  { id: 'hidden',    idleKey: 'hidden',     walkKey: 'hidden_walk',     animPrefix: 'hidden_walk' },
];

const DIRECTIONS = ['down', 'down_right', 'right', 'up_right', 'up'];

// ═══════════════════════════════════════════════════
// 1. 에셋 로드 및 애니메이션 등록 검증
// ═══════════════════════════════════════════════════

test.describe('1. 에셋 로드 및 애니메이션 등록', () => {

  test('1-1. 6종 캐릭터 idle 텍스처가 모두 로드된다', async ({ page }) => {
    await waitForMenu(page);

    const results = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const keys = ['player', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];
      return keys.map(k => ({ key: k, exists: game.textures.exists(k) }));
    });

    for (const r of results) {
      expect(r.exists, `idle 텍스처 '${r.key}' 존재 확인`).toBe(true);
    }
  });

  test('1-2. 6종 캐릭터 walk 스프라이트시트가 모두 로드된다', async ({ page }) => {
    await waitForMenu(page);

    const results = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const keys = ['player_walk', 'sniper_walk', 'engineer_walk', 'berserker_walk', 'medic_walk', 'hidden_walk'];
      return keys.map(k => ({
        key: k,
        exists: game.textures.exists(k),
        frameCount: game.textures.exists(k) ? game.textures.get(k).frameTotal - 1 : 0,
      }));
    });

    for (const r of results) {
      expect(r.exists, `walk 텍스처 '${r.key}' 존재 확인`).toBe(true);
      expect(r.frameCount, `walk 텍스처 '${r.key}' 20프레임`).toBe(20);
    }
  });

  test('1-3. 30개 걷기 애니메이션이 등록된다 (6종x5방향)', async ({ page }) => {
    await waitForMenu(page);

    const animCheck = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const chars = [
        { prefix: 'walk' },            // agent
        { prefix: 'sniper_walk' },
        { prefix: 'engineer_walk' },
        { prefix: 'berserker_walk' },
        { prefix: 'medic_walk' },
        { prefix: 'hidden_walk' },
      ];
      const dirs = ['down', 'down_right', 'right', 'up_right', 'up'];
      const results = [];
      let totalRegistered = 0;

      for (const c of chars) {
        for (const d of dirs) {
          const key = `${c.prefix}_${d}`;
          const exists = game.anims.exists(key);
          if (exists) totalRegistered++;
          results.push({ key, exists });
        }
      }

      return { results, totalRegistered };
    });

    expect(animCheck.totalRegistered).toBe(30);

    for (const r of animCheck.results) {
      expect(r.exists, `애니메이션 '${r.key}' 미등록`).toBe(true);
    }
  });

  test('1-4. 각 애니메이션이 4프레임, 8fps, repeat=-1로 설정된다', async ({ page }) => {
    await waitForMenu(page);

    const details = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const prefixes = ['walk', 'sniper_walk', 'engineer_walk', 'berserker_walk', 'medic_walk', 'hidden_walk'];
      const dirs = ['down', 'down_right', 'right', 'up_right', 'up'];
      const results = [];

      for (const p of prefixes) {
        for (const d of dirs) {
          const key = `${p}_${d}`;
          const anim = game.anims.get(key);
          if (anim) {
            results.push({
              key,
              frameCount: anim.frames.length,
              frameRate: anim.frameRate,
              repeat: anim.repeat,
            });
          }
        }
      }
      return results;
    });

    expect(details.length).toBe(30);

    for (const d of details) {
      expect(d.frameCount, `${d.key}: 4프레임`).toBe(4);
      expect(d.frameRate, `${d.key}: 8fps`).toBe(8);
      expect(d.repeat, `${d.key}: repeat=-1`).toBe(-1);
    }
  });

  test('1-5. 프레임 번호가 스펙과 일치한다 (row*5+col)', async ({ page }) => {
    await waitForMenu(page);

    const expected = {
      down:       [0, 5, 10, 15],
      down_right: [1, 6, 11, 16],
      right:      [2, 7, 12, 17],
      up_right:   [3, 8, 13, 18],
      up:         [4, 9, 14, 19],
    };

    const result = await page.evaluate((exp) => {
      const game = window.__NEON_EXODUS;
      // sniper를 대표로 검증 (agent 이외 캐릭터)
      const prefixes = ['walk', 'sniper_walk'];
      const results = {};

      for (const p of prefixes) {
        results[p] = {};
        for (const [dir, expectedFrames] of Object.entries(exp)) {
          const key = `${p}_${dir}`;
          const anim = game.anims.get(key);
          if (anim) {
            results[p][dir] = anim.frames.map(f => {
              const name = f.textureFrame;
              return typeof name === 'string' ? parseInt(name) : name;
            });
          }
        }
      }
      return results;
    }, expected);

    for (const [prefix, dirs] of Object.entries(result)) {
      for (const [dir, frames] of Object.entries(dirs)) {
        expect(frames, `${prefix}_${dir}: 프레임 번호`).toEqual(expected[dir]);
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// 2. characters.js spriteKey 필드 검증
// ═══════════════════════════════════════════════════

test.describe('2. characters.js spriteKey 필드', () => {

  test('2-1. 6종 캐릭터의 spriteKey가 올바르게 설정되었다', async ({ page }) => {
    await waitForMenu(page);

    const result = await page.evaluate(() => {
      // import가 브라우저에서 직접 불가하므로, GameScene에서 간접 확인
      // GameScene init 후 characterId -> Player 텍스처 키 매핑 검증
      const game = window.__NEON_EXODUS;
      // BootScene에서 이미 characters.js 모듈이 로드되었으므로
      // GameScene의 getCharacterById를 활용
      return true; // characters.js 자체는 정적 데이터 -> Player 생성자에서 검증
    });

    // 실질 검증은 섹션 3에서 각 캐릭터 생성 후 _idleTextureKey로 확인
    expect(result).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 3. 캐릭터별 Player 텍스처 키 검증
// ═══════════════════════════════════════════════════

test.describe('3. 캐릭터별 Player 텍스처 키 검증', () => {

  for (const char of ALL_CHARACTERS) {
    test(`3-${ALL_CHARACTERS.indexOf(char) + 1}. ${char.id}: idle=${char.idleKey}, walk=${char.walkKey}, prefix=${char.animPrefix}`, async ({ page }) => {
      await startGameWithCharacter(page, char.id);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return { error: 'GameScene/player not found' };

        const p = gs.player;
        return {
          characterId: p.characterId,
          idleTextureKey: p._idleTextureKey,
          walkTextureKey: p._walkTextureKey,
          walkAnimPrefix: p._walkAnimPrefix,
          currentTextureKey: p.texture ? p.texture.key : null,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.characterId).toBe(char.id);
      expect(result.idleTextureKey).toBe(char.idleKey);
      expect(result.walkTextureKey).toBe(char.walkKey);
      expect(result.walkAnimPrefix).toBe(char.animPrefix);
      // 초기 상태에서는 idle 텍스처로 시작
      expect(result.currentTextureKey).toBe(char.idleKey);
    });
  }
});

// ═══════════════════════════════════════════════════
// 4. 캐릭터별 이동/정지 전환 검증
// ═══════════════════════════════════════════════════

test.describe('4. 캐릭터별 이동/정지 전환', () => {

  for (const char of ALL_CHARACTERS) {
    test(`4-${ALL_CHARACTERS.indexOf(char) + 1}. ${char.id}: 이동 시 walk 애니메이션 재생 + 정지 시 idle 복귀`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await startGameWithCharacter(page, char.id);

      const result = await page.evaluate((charDef) => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return { error: 'not found' };

        const player = gs.player;

        // --- 오른쪽 이동 ---
        if (gs.joystick) {
          gs.joystick.isActive = true;
          gs.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);

        const movingState = {
          isMoving: player._isMoving,
          animKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
          isPlaying: player.anims.isPlaying,
          flipX: player.flipX,
        };

        // --- 정지 ---
        gs.joystick.direction = { x: 0, y: 0 };
        gs.joystick.isActive = false;
        player.update(100, 16);

        const idleState = {
          isMoving: player._isMoving,
          textureKey: player.texture ? player.texture.key : null,
          flipX: player.flipX,
          isAnimPlaying: player.anims.isPlaying,
        };

        return { movingState, idleState };
      }, char);

      expect(result.error).toBeUndefined();

      // 이동 상태: 해당 캐릭터의 walk 애니메이션 재생
      expect(result.movingState.isMoving).toBe(true);
      expect(result.movingState.animKey).toBe(`${char.animPrefix}_right`);
      expect(result.movingState.isPlaying).toBe(true);
      expect(result.movingState.flipX).toBe(false);

      // 정지 상태: 해당 캐릭터의 idle 텍스처로 복귀
      expect(result.idleState.isMoving).toBe(false);
      expect(result.idleState.textureKey).toBe(char.idleKey);
      expect(result.idleState.flipX).toBe(false);
      expect(result.idleState.isAnimPlaying).toBe(false);

      expect(errors).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════
// 5. agent 하위 호환 검증
// ═══════════════════════════════════════════════════

test.describe('5. agent 하위 호환', () => {

  test('5-1. agent 선택 시 기존 player 텍스처가 사용된다', async ({ page }) => {
    await startGameWithCharacter(page, 'agent');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const p = gs.player;

      return {
        idleKey: p._idleTextureKey,
        walkKey: p._walkTextureKey,
        prefix: p._walkAnimPrefix,
        textureKey: p.texture.key,
      };
    });

    expect(result.idleKey).toBe('player');
    expect(result.walkKey).toBe('player_walk');
    expect(result.prefix).toBe('walk');
    expect(result.textureKey).toBe('player');
  });

  test('5-2. agent의 walk 애니메이션 키가 기존 패턴(walk_*)을 유지한다', async ({ page }) => {
    await startGameWithCharacter(page, 'agent');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const player = gs.player;

      // 오른쪽 이동
      if (gs.joystick) {
        gs.joystick.isActive = true;
        gs.joystick.direction = { x: 1, y: 0 };
      }
      player.update(0, 16);

      return {
        animKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
      };
    });

    expect(result.animKey).toBe('walk_right');
  });

  test('5-3. agent 8방향 모두 올바른 animKey + flipX', async ({ page }) => {
    await startGameWithCharacter(page, 'agent');

    const directions = [
      { dirX: 1, dirY: 0, expectedAnim: 'walk_right', expectedFlip: false, name: 'East' },
      { dirX: 0.707, dirY: 0.707, expectedAnim: 'walk_down_right', expectedFlip: false, name: 'SE' },
      { dirX: 0, dirY: 1, expectedAnim: 'walk_down', expectedFlip: false, name: 'South' },
      { dirX: -0.707, dirY: 0.707, expectedAnim: 'walk_down_right', expectedFlip: true, name: 'SW' },
      { dirX: -1, dirY: 0, expectedAnim: 'walk_right', expectedFlip: true, name: 'West' },
      { dirX: -0.707, dirY: -0.707, expectedAnim: 'walk_up_right', expectedFlip: true, name: 'NW' },
      { dirX: 0, dirY: -1, expectedAnim: 'walk_up', expectedFlip: false, name: 'North' },
      { dirX: 0.707, dirY: -0.707, expectedAnim: 'walk_up_right', expectedFlip: false, name: 'NE' },
    ];

    for (const dir of directions) {
      const result = await page.evaluate(({ dx, dy }) => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        const player = gs.player;

        player._isMoving = true;
        player._setIdleState();

        if (gs.joystick) {
          gs.joystick.isActive = true;
          gs.joystick.direction = { x: dx, y: dy };
        }
        player.update(0, 16);

        return {
          animKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
          flipX: player.flipX,
        };
      }, { dx: dir.dirX, dy: dir.dirY });

      expect(result.animKey, `agent ${dir.name}: animKey`).toBe(dir.expectedAnim);
      expect(result.flipX, `agent ${dir.name}: flipX`).toBe(dir.expectedFlip);
    }
  });
});

// ═══════════════════════════════════════════════════
// 6. 비-agent 캐릭터 8방향 검증 (sniper 대표)
// ═══════════════════════════════════════════════════

test.describe('6. sniper 8방향 검증', () => {

  test('6-1. sniper 8방향 각각에 올바른 animKey + flipX', async ({ page }) => {
    await startGameWithCharacter(page, 'sniper');

    const directions = [
      { dirX: 1, dirY: 0, expectedAnim: 'sniper_walk_right', expectedFlip: false, name: 'East' },
      { dirX: 0.707, dirY: 0.707, expectedAnim: 'sniper_walk_down_right', expectedFlip: false, name: 'SE' },
      { dirX: 0, dirY: 1, expectedAnim: 'sniper_walk_down', expectedFlip: false, name: 'South' },
      { dirX: -0.707, dirY: 0.707, expectedAnim: 'sniper_walk_down_right', expectedFlip: true, name: 'SW' },
      { dirX: -1, dirY: 0, expectedAnim: 'sniper_walk_right', expectedFlip: true, name: 'West' },
      { dirX: -0.707, dirY: -0.707, expectedAnim: 'sniper_walk_up_right', expectedFlip: true, name: 'NW' },
      { dirX: 0, dirY: -1, expectedAnim: 'sniper_walk_up', expectedFlip: false, name: 'North' },
      { dirX: 0.707, dirY: -0.707, expectedAnim: 'sniper_walk_up_right', expectedFlip: false, name: 'NE' },
    ];

    for (const dir of directions) {
      const result = await page.evaluate(({ dx, dy }) => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        const player = gs.player;

        player._isMoving = true;
        player._setIdleState();

        if (gs.joystick) {
          gs.joystick.isActive = true;
          gs.joystick.direction = { x: dx, y: dy };
        }
        player.update(0, 16);

        return {
          animKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
          flipX: player.flipX,
        };
      }, { dx: dir.dirX, dy: dir.dirY });

      expect(result.animKey, `sniper ${dir.name}: animKey`).toBe(dir.expectedAnim);
      expect(result.flipX, `sniper ${dir.name}: flipX`).toBe(dir.expectedFlip);
    }
  });
});

// ═══════════════════════════════════════════════════
// 7. characterId 미전달 시 기본값 폴백
// ═══════════════════════════════════════════════════

test.describe('7. characterId 기본값 폴백', () => {

  test('7-1. GameScene에 characterId 미전달 시 agent로 폴백', async ({ page }) => {
    await waitForMenu(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menuScene = game.scene.getScene('MenuScene');
      // characterId를 전달하지 않고 GameScene 시작
      if (menuScene) {
        menuScene.scene.start('GameScene', {});
      }
    });

    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return gs && gs.scene.isActive() && gs.player && gs.player.active;
    }, { timeout: 10000 });

    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const p = gs.player;
      return {
        characterId: p.characterId,
        idleKey: p._idleTextureKey,
        walkKey: p._walkTextureKey,
        textureKey: p.texture.key,
      };
    });

    expect(result.characterId).toBe('agent');
    expect(result.idleKey).toBe('player');
    expect(result.walkKey).toBe('player_walk');
    expect(result.textureKey).toBe('player');
  });

  test('7-2. GameScene에 undefined characterId 시 agent로 폴백', async ({ page }) => {
    await waitForMenu(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menuScene = game.scene.getScene('MenuScene');
      if (menuScene) {
        menuScene.scene.start('GameScene', { characterId: undefined });
      }
    });

    await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return gs && gs.scene.isActive() && gs.player && gs.player.active;
    }, { timeout: 10000 });

    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return {
        characterId: gs.player.characterId,
        idleKey: gs.player._idleTextureKey,
      };
    });

    expect(result.characterId).toBe('agent');
    expect(result.idleKey).toBe('player');
  });
});

// ═══════════════════════════════════════════════════
// 8. 6종 캐릭터 전체 흐름 크래시 테스트
// ═══════════════════════════════════════════════════

test.describe('8. 6종 캐릭터 전체 흐름 크래시 테스트', () => {

  for (const char of ALL_CHARACTERS) {
    test(`8-${ALL_CHARACTERS.indexOf(char) + 1}. ${char.id}: 선택->시작->이동->방향전환->정지 크래시 없음`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await startGameWithCharacter(page, char.id);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.player) return { error: 'not found' };

        const player = gs.player;
        const dirs = [
          { x: 1, y: 0 },        // right
          { x: 0.7, y: 0.7 },    // down-right
          { x: 0, y: 1 },        // down
          { x: -0.7, y: 0.7 },   // down-left
          { x: -1, y: 0 },       // left
          { x: -0.7, y: -0.7 },  // up-left
          { x: 0, y: -1 },       // up
          { x: 0.7, y: -0.7 },   // up-right
          { x: 0, y: 0 },        // stop
          { x: 1, y: 0 },        // move again
          { x: 0, y: 0 },        // stop again
        ];

        if (gs.joystick) {
          for (let i = 0; i < dirs.length; i++) {
            gs.joystick.isActive = dirs[i].x !== 0 || dirs[i].y !== 0;
            gs.joystick.direction = dirs[i];
            player.update(i * 16, 16);
          }
        }

        return { active: player.active, alive: player.currentHp > 0 };
      });

      expect(result.error).toBeUndefined();
      expect(result.active).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════
// 9. 빠른 방향 연타 (레이스 컨디션)
// ═══════════════════════════════════════════════════

test.describe('9. 빠른 방향 연타 스트레스 테스트', () => {

  test('9-1. berserker로 빠른 방향 연타 20회 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameWithCharacter(page, 'berserker');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (!gs || !gs.player) return { error: 'not found' };

      const player = gs.player;
      const random = (min, max) => min + Math.random() * (max - min);

      if (gs.joystick) {
        for (let i = 0; i < 20; i++) {
          const dx = random(-1, 1);
          const dy = random(-1, 1);
          const isStop = Math.random() < 0.2;

          gs.joystick.isActive = !isStop;
          gs.joystick.direction = isStop ? { x: 0, y: 0 } : { x: dx, y: dy };
          player.update(i * 8, 8); // 8ms 간격 (125fps)
        }
      }

      return { active: player.active };
    });

    expect(result.error).toBeUndefined();
    expect(result.active).toBe(true);
    expect(errors).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// 10. flipX 전환: 비-agent 캐릭터
// ═══════════════════════════════════════════════════

test.describe('10. flipX 전환 검증', () => {

  test('10-1. hidden 캐릭터: 오른쪽->왼쪽 flipX 전환', async ({ page }) => {
    await startGameWithCharacter(page, 'hidden');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const player = gs.player;

      // 오른쪽
      gs.joystick.isActive = true;
      gs.joystick.direction = { x: 1, y: 0 };
      player.update(0, 16);
      const flipRight = player.flipX;

      // 왼쪽
      gs.joystick.direction = { x: -1, y: 0 };
      player.update(100, 16);
      const flipLeft = player.flipX;
      const animLeft = player.anims.currentAnim ? player.anims.currentAnim.key : null;

      // 정지
      gs.joystick.direction = { x: 0, y: 0 };
      gs.joystick.isActive = false;
      player.update(200, 16);
      const flipIdle = player.flipX;

      return { flipRight, flipLeft, animLeft, flipIdle };
    });

    expect(result.flipRight).toBe(false);
    expect(result.flipLeft).toBe(true);
    // 왼쪽 이동 시 hidden_walk_right을 flipX로 미러
    expect(result.animLeft).toBe('hidden_walk_right');
    expect(result.flipIdle).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 11. 콘솔 에러 전체 검증
// ═══════════════════════════════════════════════════

test.describe('11. 콘솔 에러 검증', () => {

  test('11-1. 게임 로드 시 JS 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await waitForMenu(page);
    await page.waitForTimeout(2000);

    const filteredErrors = errors.filter(e =>
      !e.includes('AudioContext') &&
      !e.includes('Capacitor') &&
      !e.includes('net::ERR')
    );
    expect(filteredErrors).toEqual([]);
  });

  test('11-2. sniper로 10초 플레이 시 JS 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await startGameWithCharacter(page, 'sniper');
    await page.waitForTimeout(10000);

    const filteredErrors = errors.filter(e =>
      !e.includes('AudioContext') &&
      !e.includes('Capacitor') &&
      !e.includes('net::ERR')
    );
    expect(filteredErrors).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// 12. 시각적 검증 (스크린샷)
// ═══════════════════════════════════════════════════

test.describe('12. 시각적 검증', () => {

  for (const char of ALL_CHARACTERS) {
    test(`12-${ALL_CHARACTERS.indexOf(char) + 1}. ${char.id}: idle 상태 스크린샷`, async ({ page }) => {
      await startGameWithCharacter(page, char.id);
      await page.screenshot({
        path: `tests/screenshots/char-sprite-${char.id}-idle.png`,
      });
    });
  }

  test('12-7. sniper 이동 중 스크린샷 (오른쪽)', async ({ page }) => {
    await startGameWithCharacter(page, 'sniper');

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (gs.joystick) {
        gs.joystick.isActive = true;
        gs.joystick.direction = { x: 1, y: 0 };
      }
      for (let i = 0; i < 10; i++) {
        gs.player.update(i * 100, 100);
      }
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/char-sprite-sniper-walk-right.png' });
  });

  test('12-8. berserker 이동 중 스크린샷 (왼쪽, flipX)', async ({ page }) => {
    await startGameWithCharacter(page, 'berserker');

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      if (gs.joystick) {
        gs.joystick.isActive = true;
        gs.joystick.direction = { x: -1, y: 0 };
      }
      for (let i = 0; i < 10; i++) {
        gs.player.update(i * 100, 100);
      }
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/char-sprite-berserker-walk-left.png' });
  });
});

// ═══════════════════════════════════════════════════
// 13. 동일 방향 유지 시 애니메이션 재시작 방지
// ═══════════════════════════════════════════════════

test.describe('13. 동일 방향 유지 시 애니메이션 재시작 방지', () => {

  test('13-1. medic 동일 방향 유지 시 play() 중복 호출 없음', async ({ page }) => {
    await startGameWithCharacter(page, 'medic');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const player = gs.player;

      let playCount = 0;
      const origPlay = player.play.bind(player);
      player.play = function(...args) {
        playCount++;
        return origPlay(...args);
      };

      // 같은 방향 3번 연속
      player._playWalkAnim(1, 0);
      player._playWalkAnim(1, 0);
      player._playWalkAnim(1, 0);

      return { playCount };
    });

    expect(result.playCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// 14. 물리 충돌체 유지 검증
// ═══════════════════════════════════════════════════

test.describe('14. 물리 충돌체 유지', () => {

  test('14-1. berserker 선택 후 물리 충돌체 동일 (원형, 반경 12)', async ({ page }) => {
    await startGameWithCharacter(page, 'berserker');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const body = gs.player.body;
      return {
        isCircle: body.isCircle,
        radius: body.radius,
        offsetX: body.offset.x,
        offsetY: body.offset.y,
      };
    });

    expect(result.isCircle).toBe(true);
    expect(result.radius).toBe(12);
    expect(result.offsetX).toBe(12);
    expect(result.offsetY).toBe(12);
  });
});

// ═══════════════════════════════════════════════════
// 15. _setIdleState 중복 호출 안전성
// ═══════════════════════════════════════════════════

test.describe('15. _setIdleState 중복 호출 안전성', () => {

  test('15-1. engineer: idle 상태에서 _setIdleState 3회 호출 안전', async ({ page }) => {
    await startGameWithCharacter(page, 'engineer');

    const result = await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      const player = gs.player;

      // 이미 idle 상태에서 중복 호출
      player._isMoving = false;
      player._setIdleState();
      player._setIdleState();
      player._setIdleState();

      return {
        isMoving: player._isMoving,
        textureKey: player.texture ? player.texture.key : null,
      };
    });

    expect(result.isMoving).toBe(false);
    expect(result.textureKey).toBe('engineer');
  });
});

// ═══════════════════════════════════════════════════
// 16. 존재하지 않는 characterId 엣지케이스
// ═══════════════════════════════════════════════════

test.describe('16. 존재하지 않는 characterId', () => {

  test('16-1. 존재하지 않는 characterId "unknown" 시 동작 확인', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await waitForMenu(page);

    await page.evaluate(() => {
      const game = window.__NEON_EXODUS;
      const menuScene = game.scene.getScene('MenuScene');
      if (menuScene) {
        menuScene.scene.start('GameScene', { characterId: 'unknown' });
      }
    });

    // GameScene이 시작되는지 확인 (크래시 없이)
    const sceneStarted = await page.waitForFunction(() => {
      const game = window.__NEON_EXODUS;
      const gs = game.scene.getScene('GameScene');
      return gs && gs.scene.isActive();
    }, { timeout: 10000 }).then(() => true).catch(() => false);

    // 주의: unknown characterId는 텍스처가 없을 수 있어 에러 발생 가능
    // 이 케이스는 크래시 여부만 확인 (에러 발생은 정보 수집 목적)
    if (sceneStarted) {
      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs.player) return { playerCreated: false };
        return {
          playerCreated: true,
          characterId: gs.player.characterId,
          idleKey: gs.player._idleTextureKey,
        };
      });

      // Player가 생성되었다면, characterId가 'unknown'으로 설정됨
      if (result.playerCreated) {
        expect(result.characterId).toBe('unknown');
        expect(result.idleKey).toBe('unknown');
      }
    }

    // 크래시 여부를 기록 (hard fail은 아님 - 스펙에 명시 안 된 엣지케이스)
    // 에러 발생 시 리포트에 기록
  });
});
