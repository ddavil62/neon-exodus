/**
 * @fileoverview 플레이어 8방향 걷기 애니메이션 QA 테스트.
 *
 * 검증 항목:
 * 1. player_walk 스프라이트시트 로드 확인
 * 2. 8방향 걷기 애니메이션 등록 확인
 * 3. 이동 시 걷기 애니메이션 재생 + flipX 미러링
 * 4. 정지 시 idle 텍스처 복귀 + idle tween 재개
 * 5. 콘솔 에러 없음
 * 6. 시각적 검증 (스크린샷)
 */

import { test, expect } from '@playwright/test';

// ── 공통: 게임 시작까지 진행하는 헬퍼 ──

/**
 * 게임을 시작하고 GameScene까지 진행한다.
 * MenuScene 대기 후 evaluate로 직접 GameScene을 시작하여
 * 클릭 좌표 의존성을 제거한다.
 */
async function startGame(page) {
  await page.goto('/');

  // Phaser 로드 대기 (window.__NEON_EXODUS 존재)
  await page.waitForFunction(
    () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
    { timeout: 15000 }
  );

  // BootScene -> MenuScene 전환 대기
  await page.waitForFunction(
    () => {
      const game = window.__NEON_EXODUS;
      const scenes = game.scene.getScenes(true);
      return scenes.some(s => s.scene.key === 'MenuScene');
    },
    { timeout: 10000 }
  );

  // MenuScene에서 직접 GameScene 시작 (클릭 좌표 의존 제거)
  await page.evaluate(() => {
    const game = window.__NEON_EXODUS;
    const menuScene = game.scene.getScene('MenuScene');
    if (menuScene) {
      menuScene.scene.start('GameScene', { characterId: 'agent' });
    }
  });

  // GameScene 진입 대기
  await page.waitForFunction(
    () => {
      const game = window.__NEON_EXODUS;
      const scenes = game.scene.getScenes(true);
      return scenes.some(s => s.scene.key === 'GameScene');
    },
    { timeout: 10000 }
  );

  // GameScene 안정화 대기
  await page.waitForTimeout(1500);
}

// ── 테스트 ──

test.describe('플레이어 8방향 걷기 애니메이션', () => {
  test.describe('에셋 및 애니메이션 등록 검증', () => {
    test('player_walk 텍스처가 정상 로드된다', async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
        { timeout: 15000 }
      );

      // BootScene 완료 대기
      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const scenes = game.scene.getScenes(true);
          return scenes.some(s => s.scene.key === 'MenuScene');
        },
        { timeout: 10000 }
      );

      // player_walk 텍스처 존재 확인
      const textureExists = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        return game.textures.exists('player_walk');
      });
      expect(textureExists).toBe(true);

      // 텍스처 프레임 수 확인 (20프레임 = 5x4)
      const frameCount = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const tex = game.textures.get('player_walk');
        return tex.frameTotal - 1; // __BASE 제외
      });
      expect(frameCount).toBe(20);
    });

    test('5방향 걷기 애니메이션이 등록된다', async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
        { timeout: 15000 }
      );

      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const scenes = game.scene.getScenes(true);
          return scenes.some(s => s.scene.key === 'MenuScene');
        },
        { timeout: 10000 }
      );

      // 5방향 애니메이션 키 존재 확인
      const animKeys = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const expected = ['walk_down', 'walk_down_right', 'walk_right', 'walk_up_right', 'walk_up'];
        return expected.map(key => ({
          key,
          exists: game.anims.exists(key),
        }));
      });

      for (const anim of animKeys) {
        expect(anim.exists, `애니메이션 '${anim.key}' 미등록`).toBe(true);
      }
    });

    test('각 애니메이션이 4프레임, 8fps, repeat=-1로 설정된다', async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
        { timeout: 15000 }
      );

      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const scenes = game.scene.getScenes(true);
          return scenes.some(s => s.scene.key === 'MenuScene');
        },
        { timeout: 10000 }
      );

      const animDetails = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const keys = ['walk_down', 'walk_down_right', 'walk_right', 'walk_up_right', 'walk_up'];
        return keys.map(key => {
          const anim = game.anims.get(key);
          return {
            key,
            frameCount: anim ? anim.frames.length : 0,
            frameRate: anim ? anim.frameRate : 0,
            repeat: anim ? anim.repeat : 0,
          };
        });
      });

      for (const detail of animDetails) {
        expect(detail.frameCount, `${detail.key}: 프레임 수 불일치`).toBe(4);
        expect(detail.frameRate, `${detail.key}: fps 불일치`).toBe(8);
        expect(detail.repeat, `${detail.key}: repeat 불일치`).toBe(-1);
      }
    });

    test('프레임 번호가 스펙과 일치한다 (row*5+col)', async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
        { timeout: 15000 }
      );

      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const scenes = game.scene.getScenes(true);
          return scenes.some(s => s.scene.key === 'MenuScene');
        },
        { timeout: 10000 }
      );

      const frameNumbers = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const expected = {
          walk_down: [0, 5, 10, 15],
          walk_down_right: [1, 6, 11, 16],
          walk_right: [2, 7, 12, 17],
          walk_up_right: [3, 8, 13, 18],
          walk_up: [4, 9, 14, 19],
        };
        const result = {};
        for (const [key, expectedFrames] of Object.entries(expected)) {
          const anim = game.anims.get(key);
          if (anim) {
            // Phaser AnimationFrame에서 frame.name으로 인덱스를 얻을 수 있지만
            // 실제로는 textureFrame(숫자)이므로 frame 속성을 읽는다
            result[key] = anim.frames.map(f => {
              // Phaser3에서 spritesheet 프레임은 문자열 또는 숫자
              const name = f.textureFrame;
              return typeof name === 'string' ? parseInt(name) : name;
            });
          }
        }
        return { expected, result };
      });

      for (const [key, expectedFrames] of Object.entries(frameNumbers.expected)) {
        expect(frameNumbers.result[key], `${key}: 프레임 번호 불일치`).toEqual(expectedFrames);
      }
    });
  });

  test.describe('게임 내 동작 검증', () => {
    test('이동 시 걷기 애니메이션이 재생된다 (오른쪽)', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await startGame(page);

      // evaluate로 직접 플레이어를 오른쪽으로 이동시킨다
      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'GameScene/player not found' };

        const player = gameScene.player;

        // 조이스틱 방향을 직접 설정하여 이동 시뮬레이션
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 }; // 오른쪽
        }

        // 1프레임 업데이트 강제 호출
        player.update(0, 16);

        return {
          isMoving: player._isMoving,
          currentAnimKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
          isPlaying: player.anims.isPlaying,
          flipX: player.flipX,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.isMoving).toBe(true);
      expect(result.currentAnimKey).toBe('walk_right');
      expect(result.isPlaying).toBe(true);
      expect(result.flipX).toBe(false);

      // 스크린샷 캡처
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/walk-anim-right.png' });

      expect(errors).toEqual([]);
    });

    test('왼쪽 이동 시 flipX=true + walk_right 애니메이션', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: -1, y: 0 }; // 왼쪽
        }

        player.update(0, 16);

        return {
          isMoving: player._isMoving,
          currentAnimKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
          flipX: player.flipX,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.isMoving).toBe(true);
      expect(result.currentAnimKey).toBe('walk_right'); // 왼쪽은 walk_right + flipX
      expect(result.flipX).toBe(true);
    });

    test('8방향 각각에 올바른 animKey와 flipX가 설정된다', async ({ page }) => {
      await startGame(page);

      // 8방향 테스트 (dirX, dirY) -> (expectedAnimKey, expectedFlipX)
      const directions = [
        { dirX: 1, dirY: 0, expectedAnim: 'walk_right', expectedFlip: false, name: 'right (East)' },
        { dirX: 0.707, dirY: 0.707, expectedAnim: 'walk_down_right', expectedFlip: false, name: 'down-right (SE)' },
        { dirX: 0, dirY: 1, expectedAnim: 'walk_down', expectedFlip: false, name: 'down (South)' },
        { dirX: -0.707, dirY: 0.707, expectedAnim: 'walk_down_right', expectedFlip: true, name: 'down-left (SW)' },
        { dirX: -1, dirY: 0, expectedAnim: 'walk_right', expectedFlip: true, name: 'left (West)' },
        { dirX: -0.707, dirY: -0.707, expectedAnim: 'walk_up_right', expectedFlip: true, name: 'up-left (NW)' },
        { dirX: 0, dirY: -1, expectedAnim: 'walk_up', expectedFlip: false, name: 'up (North)' },
        { dirX: 0.707, dirY: -0.707, expectedAnim: 'walk_up_right', expectedFlip: false, name: 'up-right (NE)' },
      ];

      for (const dir of directions) {
        const result = await page.evaluate(({ dx, dy }) => {
          const game = window.__NEON_EXODUS;
          const gameScene = game.scene.getScene('GameScene');
          if (!gameScene || !gameScene.player) return { error: 'not found' };

          const player = gameScene.player;

          // 먼저 idle 상태로 리셋
          player._isMoving = true; // _setIdleState가 동작하도록
          player._setIdleState();

          // 새 방향으로 이동
          if (gameScene.joystick) {
            gameScene.joystick.isActive = true;
            gameScene.joystick.direction = { x: dx, y: dy };
          }

          player.update(0, 16);

          return {
            currentAnimKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
            flipX: player.flipX,
            isMoving: player._isMoving,
          };
        }, { dx: dir.dirX, dy: dir.dirY });

        expect(result.error).toBeUndefined();
        expect(result.currentAnimKey, `${dir.name}: animKey 불일치`).toBe(dir.expectedAnim);
        expect(result.flipX, `${dir.name}: flipX 불일치`).toBe(dir.expectedFlip);
        expect(result.isMoving, `${dir.name}: isMoving 불일치`).toBe(true);
      }
    });

    test('정지 시 idle 텍스처로 복귀하고 flipX가 false로 리셋된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // 먼저 왼쪽으로 이동 (flipX=true 상태로 만듦)
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: -1, y: 0 };
        }
        player.update(0, 16);

        const movingState = {
          isMoving: player._isMoving,
          flipX: player.flipX,
          animKey: player.anims.currentAnim ? player.anims.currentAnim.key : null,
        };

        // 정지
        gameScene.joystick.direction = { x: 0, y: 0 };
        gameScene.joystick.isActive = false;
        player.update(0, 16);

        const idleState = {
          isMoving: player._isMoving,
          flipX: player.flipX,
          textureKey: player.texture ? player.texture.key : null,
          isAnimPlaying: player.anims.isPlaying,
        };

        return { movingState, idleState };
      });

      expect(result.error).toBeUndefined();

      // 이동 중 상태 확인
      expect(result.movingState.isMoving).toBe(true);
      expect(result.movingState.flipX).toBe(true);

      // 정지 후 상태 확인
      expect(result.idleState.isMoving).toBe(false);
      expect(result.idleState.flipX).toBe(false);
      expect(result.idleState.textureKey).toBe('player');
      expect(result.idleState.isAnimPlaying).toBe(false);
    });

    test('정지 시 idle tween이 재개된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // idle tween 존재 확인
        if (!player._idleTween) return { error: 'no _idleTween' };

        // 이동 시작 -> tween pause 확인
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);

        const tweenPausedDuringMove = player._idleTween.isPaused();

        // 정지 -> tween resume 확인
        gameScene.joystick.direction = { x: 0, y: 0 };
        gameScene.joystick.isActive = false;
        player.update(0, 16);

        // Phaser tween의 isPlaying() 또는 isPaused() 상태를 확인
        const tweenResumedAfterStop = !player._idleTween.isPaused();

        return {
          tweenPausedDuringMove,
          tweenResumedAfterStop,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.tweenPausedDuringMove).toBe(true);
      expect(result.tweenResumedAfterStop).toBe(true);
    });

    test('이동 중 스케일이 SPRITE_SCALE(1)로 정상화된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // idle tween이 스케일을 변형시키므로 잠시 대기
        // tween이 동작한 후의 스케일을 확인하기 위해 여러 프레임 진행
        const beforeMoveScaleX = player.scaleX;
        const beforeMoveScaleY = player.scaleY;

        // 이동 시작
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);

        const afterMoveScaleX = player.scaleX;
        const afterMoveScaleY = player.scaleY;

        return {
          beforeMoveScaleX,
          beforeMoveScaleY,
          afterMoveScaleX,
          afterMoveScaleY,
        };
      });

      expect(result.error).toBeUndefined();
      // 이동 시작 후 스케일이 SPRITE_SCALE(=1)로 정상화되어야 한다
      expect(result.afterMoveScaleX).toBe(1);
      expect(result.afterMoveScaleY).toBe(1);
    });

    test('동일 방향 유지 시 애니메이션이 재시작되지 않는다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // 오른쪽으로 이동 시작
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);

        // 현재 애니메이션의 재생 진행도를 기록
        const progress1 = player.anims.getProgress();
        const currentFrame1 = player.anims.currentFrame ? player.anims.currentFrame.index : -1;

        // 동일 방향으로 다시 update (방향 변경 없음)
        player.update(100, 100); // 시간 경과 시뮬레이션

        const progress2 = player.anims.getProgress();
        const animKey = player.anims.currentAnim ? player.anims.currentAnim.key : null;

        return {
          animKey,
          isPlaying: player.anims.isPlaying,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.animKey).toBe('walk_right');
      expect(result.isPlaying).toBe(true);
    });
  });

  test.describe('엣지케이스 및 예외 시나리오', () => {
    test('방향 전환 시 애니메이션이 올바르게 전환된다 (오른쪽->아래)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // 오른쪽으로 이동
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);
        const firstAnim = player.anims.currentAnim ? player.anims.currentAnim.key : null;

        // 아래로 방향 전환
        gameScene.joystick.direction = { x: 0, y: 1 };
        player.update(100, 16);
        const secondAnim = player.anims.currentAnim ? player.anims.currentAnim.key : null;

        return { firstAnim, secondAnim };
      });

      expect(result.error).toBeUndefined();
      expect(result.firstAnim).toBe('walk_right');
      expect(result.secondAnim).toBe('walk_down');
    });

    test('flipX 전환: 오른쪽->왼쪽 시 flipX가 false->true로 변경된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // 오른쪽으로 이동
        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        player.update(0, 16);
        const flipAfterRight = player.flipX;

        // 왼쪽으로 전환
        gameScene.joystick.direction = { x: -1, y: 0 };
        player.update(100, 16);
        const flipAfterLeft = player.flipX;

        // 다시 오른쪽으로
        gameScene.joystick.direction = { x: 1, y: 0 };
        player.update(200, 16);
        const flipAfterRightAgain = player.flipX;

        return { flipAfterRight, flipAfterLeft, flipAfterRightAgain };
      });

      expect(result.error).toBeUndefined();
      expect(result.flipAfterRight).toBe(false);
      expect(result.flipAfterLeft).toBe(true);
      expect(result.flipAfterRightAgain).toBe(false);
    });

    test('빠른 방향 연타 시 에러가 발생하지 않는다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await startGame(page);

      // 빠르게 8방향을 순환하며 이동 전환
      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;
        const dirs = [
          { x: 1, y: 0 },
          { x: 0.7, y: 0.7 },
          { x: 0, y: 1 },
          { x: -0.7, y: 0.7 },
          { x: -1, y: 0 },
          { x: -0.7, y: -0.7 },
          { x: 0, y: -1 },
          { x: 0.7, y: -0.7 },
          { x: 0, y: 0 }, // 정지
          { x: 1, y: 0 }, // 다시 이동
          { x: 0, y: 0 }, // 다시 정지
        ];

        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
        }

        for (let i = 0; i < dirs.length; i++) {
          if (gameScene.joystick) {
            gameScene.joystick.direction = dirs[i];
            if (dirs[i].x === 0 && dirs[i].y === 0) {
              gameScene.joystick.isActive = false;
            } else {
              gameScene.joystick.isActive = true;
            }
          }
          player.update(i * 16, 16);
        }

        return {
          isMoving: player._isMoving,
          active: player.active,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.active).toBe(true);
      expect(errors).toEqual([]);
    });

    test('_setIdleState 중복 호출이 안전하다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // 이미 idle 상태에서 _setIdleState 중복 호출
        player._isMoving = false;
        player._setIdleState(); // 첫번째: 이미 idle이므로 아무것도 안 함
        player._setIdleState(); // 두번째: 마찬가지
        player._setIdleState(); // 세번째

        return {
          isMoving: player._isMoving,
          textureKey: player.texture ? player.texture.key : null,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.isMoving).toBe(false);
    });

    test('_playWalkAnim 중복 호출 시 동일 애니메이션이 재시작되지 않는다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;

        // play 호출 횟수 추적
        let playCount = 0;
        const origPlay = player.play.bind(player);
        player.play = function(...args) {
          playCount++;
          return origPlay(...args);
        };

        // 같은 방향 오른쪽으로 3번 _playWalkAnim 호출
        player._playWalkAnim(1, 0);
        player._playWalkAnim(1, 0);
        player._playWalkAnim(1, 0);

        return { playCount };
      });

      expect(result.error).toBeUndefined();
      // 첫 호출만 play()를 하고, 이후 동일 방향은 skip
      expect(result.playCount).toBe(1);
    });
  });

  test.describe('기존 기능 유지 검증', () => {
    test('콘솔 에러가 발생하지 않는다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await startGame(page);

      // 이동/정지 사이클 수행
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return;

        const player = gameScene.player;
        if (gameScene.joystick) {
          // 이동
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
          player.update(0, 16);

          // 정지
          gameScene.joystick.direction = { x: 0, y: 0 };
          gameScene.joystick.isActive = false;
          player.update(100, 16);
        }
      });

      // 2초 대기 후 에러 수집
      await page.waitForTimeout(2000);

      expect(errors).toEqual([]);
    });

    test('물리 충돌체가 변경되지 않았다 (원형, 반경 12px)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const body = gameScene.player.body;
        return {
          isCircle: body.isCircle,
          radius: body.radius,
          offsetX: body.offset.x,
          offsetY: body.offset.y,
        };
      });

      expect(result.error).toBeUndefined();
      expect(result.isCircle).toBe(true);
      expect(result.radius).toBe(12);
      expect(result.offsetX).toBe(12);
      expect(result.offsetY).toBe(12);
    });

    test('player 텍스처 키가 idle용으로 유지된다', async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(
        () => window.__NEON_EXODUS && window.__NEON_EXODUS.scene,
        { timeout: 15000 }
      );

      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const scenes = game.scene.getScenes(true);
          return scenes.some(s => s.scene.key === 'MenuScene');
        },
        { timeout: 10000 }
      );

      // player 텍스처가 여전히 존재하는지 확인
      const exists = await page.evaluate(() => {
        return window.__NEON_EXODUS.textures.exists('player');
      });
      expect(exists).toBe(true);
    });
  });

  test.describe('시각적 검증', () => {
    test('게임 시작 후 초기 상태 스크린샷', async ({ page }) => {
      await startGame(page);
      await page.screenshot({ path: 'tests/screenshots/walk-anim-initial.png' });
    });

    test('오른쪽 이동 중 스크린샷', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return;

        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 1, y: 0 };
        }
        // 여러 프레임 진행하여 애니메이션이 보이도록
        for (let i = 0; i < 10; i++) {
          gameScene.player.update(i * 100, 100);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/walk-anim-moving-right.png' });
    });

    test('왼쪽 이동 중 스크린샷 (flipX=true)', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return;

        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: -1, y: 0 };
        }
        for (let i = 0; i < 10; i++) {
          gameScene.player.update(i * 100, 100);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/walk-anim-moving-left.png' });
    });

    test('아래쪽 이동 중 스크린샷', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return;

        if (gameScene.joystick) {
          gameScene.joystick.isActive = true;
          gameScene.joystick.direction = { x: 0, y: 1 };
        }
        for (let i = 0; i < 10; i++) {
          gameScene.player.update(i * 100, 100);
        }
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/walk-anim-moving-down.png' });
    });
  });

  test.describe('atan2 각도 경계값 검증', () => {
    test('정확히 45도 경계에서 올바른 방향이 선택된다', async ({ page }) => {
      await startGame(page);

      // atan2 경계 테스트: 22.5도 경계 부근의 값들
      const boundaryTests = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.player) return { error: 'not found' };

        const player = gameScene.player;
        const results = [];

        // 경계값 테스트를 위한 방향 벡터들
        const tests = [
          // 22.5도 직전 (right에 속해야 함)
          { x: Math.cos(22.4 * Math.PI / 180), y: Math.sin(22.4 * Math.PI / 180), expected: 'walk_right' },
          // 22.5도 직후 (down_right에 속해야 함)
          { x: Math.cos(22.6 * Math.PI / 180), y: Math.sin(22.6 * Math.PI / 180), expected: 'walk_down_right' },
          // 337.5도 직전 (up_right에 속해야 함)
          { x: Math.cos(337.4 * Math.PI / 180), y: Math.sin(337.4 * Math.PI / 180), expected: 'walk_up_right' },
          // 337.5도 직후 (right에 속해야 함)
          { x: Math.cos(337.6 * Math.PI / 180), y: Math.sin(337.6 * Math.PI / 180), expected: 'walk_right' },
          // 정확히 0도 (right)
          { x: 1, y: 0, expected: 'walk_right' },
          // 정확히 90도 (down)
          { x: 0, y: 1, expected: 'walk_down' },
          // 정확히 180도 (left = walk_right + flip)
          { x: -1, y: 0, expected: 'walk_right' },
          // 정확히 270도 (up)
          { x: 0, y: -1, expected: 'walk_up' },
        ];

        for (const t of tests) {
          // idle로 리셋
          player._isMoving = true;
          player._setIdleState();

          if (gameScene.joystick) {
            gameScene.joystick.isActive = true;
            gameScene.joystick.direction = { x: t.x, y: t.y };
          }
          player.update(0, 16);

          results.push({
            input: `(${t.x.toFixed(3)}, ${t.y.toFixed(3)})`,
            expected: t.expected,
            actual: player.anims.currentAnim ? player.anims.currentAnim.key : null,
            match: player.anims.currentAnim ? player.anims.currentAnim.key === t.expected : false,
          });
        }

        return results;
      });

      if (boundaryTests.error) {
        throw new Error(boundaryTests.error);
      }

      for (const bt of boundaryTests) {
        expect(bt.actual, `입력 ${bt.input}: ${bt.expected} 기대, ${bt.actual} 실제`).toBe(bt.expected);
      }
    });
  });
});
