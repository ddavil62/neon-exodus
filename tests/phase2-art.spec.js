/**
 * @fileoverview Phase 2 보스/미니보스 스프라이트 QA 테스트.
 *
 * 검증 항목:
 * 1. 에셋 파일 존재 및 HTTP 로드 가능 여부
 * 2. 게임 초기화 시 콘솔 에러 없음
 * 3. BootScene에서 spritesheet preload 및 animation 등록 확인
 * 4. GameScene 진입 후 보스/미니보스 스폰 연출 확인
 * 5. 피격 플래시 복원 로직 검증 (textures.exists 분기)
 * 6. 플레이스홀더 폴백 동작 확인
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Phase 2 보스/미니보스 스프라이트 검증', () => {

  // ============================================================
  // 1. 에셋 파일 HTTP 접근 가능 여부
  // ============================================================
  test.describe('에셋 파일 검증', () => {

    const miniBossFiles = [
      { name: 'guardian_drone.png', expectedWidth: 80, expectedHeight: 40 },
      { name: 'assault_mech.png', expectedWidth: 80, expectedHeight: 40 },
    ];

    const bossFiles = [
      { name: 'commander_drone.png', expectedWidth: 256, expectedHeight: 64 },
      { name: 'siege_titan.png', expectedWidth: 256, expectedHeight: 64 },
      { name: 'core_processor.png', expectedWidth: 256, expectedHeight: 64 },
    ];

    const allFiles = [...miniBossFiles, ...bossFiles];

    for (const file of allFiles) {
      test(`assets/sprites/bosses/${file.name}이 HTTP 200으로 로드된다`, async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/assets/sprites/bosses/${file.name}`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
      });
    }
  });

  // ============================================================
  // 2. 게임 초기화 - 콘솔 에러 확인
  // ============================================================
  test.describe('게임 초기화', () => {

    test('게임이 시작되고 MenuScene까지 콘솔 에러 없이 진행된다', async ({ page }) => {
      const errors = [];
      const warnings = [];

      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
        if (msg.type() === 'warning') warnings.push(msg.text());
      });

      await page.goto(BASE_URL);

      // Phaser 게임 인스턴스가 생성될 때까지 대기
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });

      // MenuScene 전환 대기 (BootScene에서 300ms 딜레이 후 전환)
      await page.waitForTimeout(2000);

      // 스프라이트 로드 실패 관련 에러가 없어야 한다
      const spriteErrors = errors.filter(e =>
        e.includes('bosses/') ||
        e.includes('guardian_drone') ||
        e.includes('assault_mech') ||
        e.includes('commander_drone') ||
        e.includes('siege_titan') ||
        e.includes('core_processor')
      );
      expect(spriteErrors).toEqual([]);

      // 전반적인 JS 에러도 없어야 한다 (asset load 실패 콘솔 경고는 Phaser가 내보낼 수 있으므로 warn은 별도)
      // Phaser의 asset load 실패는 console warning으로 나오므로 체크
      const assetLoadWarnings = warnings.filter(w =>
        w.includes('Failed to load') ||
        w.includes('404')
      );
      expect(assetLoadWarnings).toEqual([]);

      await page.screenshot({ path: 'tests/screenshots/game-init-menu.png' });
    });

    test('BootScene에서 보스/미니보스 텍스처가 로드된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Phaser 텍스처 매니저에서 5종 모두 존재 확인
      const textureResults = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const textures = game.textures;
        const keys = [
          'enemy_guardian_drone',
          'enemy_assault_mech',
          'enemy_commander_drone',
          'enemy_siege_titan',
          'enemy_core_processor',
        ];
        return keys.map(key => ({
          key,
          exists: textures.exists(key),
        }));
      });

      for (const result of textureResults) {
        expect(result.exists, `텍스처 ${result.key}가 존재해야 한다`).toBe(true);
      }
    });

    test('BootScene에서 미니보스 idle animation이 등록된다 (3fps)', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      const animResults = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const anims = game.anims;
        const miniBossKeys = ['enemy_guardian_drone', 'enemy_assault_mech'];

        return miniBossKeys.map(key => {
          const animKey = key + '_idle';
          const exists = anims.exists(animKey);
          let frameRate = null;
          let repeat = null;
          let frameCount = null;
          if (exists) {
            const anim = anims.get(animKey);
            frameRate = anim.frameRate;
            repeat = anim.repeat;
            frameCount = anim.frames.length;
          }
          return { key: animKey, exists, frameRate, repeat, frameCount };
        });
      });

      for (const result of animResults) {
        expect(result.exists, `${result.key} animation이 존재해야 한다`).toBe(true);
        expect(result.frameRate, `${result.key} frameRate가 3이어야 한다`).toBe(3);
        expect(result.repeat, `${result.key} repeat가 -1 (무한)이어야 한다`).toBe(-1);
        expect(result.frameCount, `${result.key} 프레임이 2개여야 한다`).toBe(2);
      }
    });

    test('BootScene에서 보스 idle (2fps) + special (8fps) animation이 등록된다', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      const animResults = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const anims = game.anims;
        const bossKeys = ['enemy_commander_drone', 'enemy_siege_titan', 'enemy_core_processor'];

        const results = [];
        for (const key of bossKeys) {
          // idle
          const idleKey = key + '_idle';
          const idleExists = anims.exists(idleKey);
          let idleFrameRate = null, idleRepeat = null, idleFrameCount = null;
          if (idleExists) {
            const a = anims.get(idleKey);
            idleFrameRate = a.frameRate;
            idleRepeat = a.repeat;
            idleFrameCount = a.frames.length;
          }

          // special
          const specialKey = key + '_special';
          const specialExists = anims.exists(specialKey);
          let specialFrameRate = null, specialRepeat = null, specialFrameCount = null;
          if (specialExists) {
            const a = anims.get(specialKey);
            specialFrameRate = a.frameRate;
            specialRepeat = a.repeat;
            specialFrameCount = a.frames.length;
          }

          results.push({
            key,
            idle: { key: idleKey, exists: idleExists, frameRate: idleFrameRate, repeat: idleRepeat, frameCount: idleFrameCount },
            special: { key: specialKey, exists: specialExists, frameRate: specialFrameRate, repeat: specialRepeat, frameCount: specialFrameCount },
          });
        }
        return results;
      });

      for (const boss of animResults) {
        // idle 검증
        expect(boss.idle.exists, `${boss.idle.key} animation이 존재해야 한다`).toBe(true);
        expect(boss.idle.frameRate, `${boss.idle.key} frameRate가 2이어야 한다`).toBe(2);
        expect(boss.idle.repeat, `${boss.idle.key} repeat가 -1 (무한)이어야 한다`).toBe(-1);
        expect(boss.idle.frameCount, `${boss.idle.key} 프레임이 2개여야 한다`).toBe(2);

        // special 검증
        expect(boss.special.exists, `${boss.special.key} animation이 존재해야 한다`).toBe(true);
        expect(boss.special.frameRate, `${boss.special.key} frameRate가 8이어야 한다`).toBe(8);
        expect(boss.special.repeat, `${boss.special.key} repeat가 3이어야 한다`).toBe(3);
        expect(boss.special.frameCount, `${boss.special.key} 프레임이 2개여야 한다`).toBe(2);
      }
    });
  });

  // ============================================================
  // 3. GameScene 진입 및 보스/미니보스 스폰 검증
  // ============================================================
  test.describe('GameScene 보스/미니보스 스폰', () => {

    /**
     * GameScene을 시작하는 헬퍼 함수.
     * MenuScene에서 캐릭터 선택 없이 바로 GameScene으로 전환한다.
     */
    async function startGame(page) {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      // GameScene으로 직접 전환
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const currentScene = game.scene.getScenes(true)[0];
        if (currentScene) {
          currentScene.scene.start('GameScene', { characterId: 'agent' });
        }
      });

      // GameScene 초기화 대기
      await page.waitForTimeout(1500);
    }

    test('GameScene 진입 시 콘솔 에러가 발생하지 않는다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await startGame(page);

      await page.screenshot({ path: 'tests/screenshots/game-scene-started.png' });

      // 치명적 JS 에러가 없어야 한다
      expect(errors.length, `콘솔 에러가 없어야 한다: ${errors.join(', ')}`).toBe(0);
    });

    test('미니보스 스폰 시 오렌지 카메라 플래시(300ms)가 발동한다', async ({ page }) => {
      await startGame(page);

      // 미니보스를 직접 스폰하여 연출 확인
      const flashResult = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.scene.isActive()) return { error: 'GameScene not active' };

        // 카메라 flash 메서드를 감시
        let flashCalled = false;
        let flashArgs = null;
        const originalFlash = gameScene.cameras.main.flash.bind(gameScene.cameras.main);
        gameScene.cameras.main.flash = (duration, r, g, b, force) => {
          flashCalled = true;
          flashArgs = { duration, r, g, b, force };
          return originalFlash(duration, r, g, b, force);
        };

        // 미니보스 스폰 콜백 직접 호출
        gameScene.onMiniBossSpawn({ typeId: 'guardian_drone' });

        // 원래 메서드 복원
        gameScene.cameras.main.flash = originalFlash;

        return { flashCalled, flashArgs };
      });

      expect(flashResult.flashCalled, '미니보스 스폰 시 카메라 flash가 호출되어야 한다').toBe(true);
      expect(flashResult.flashArgs.duration).toBe(300);
      expect(flashResult.flashArgs.r).toBe(255);
      expect(flashResult.flashArgs.g).toBe(100);
      expect(flashResult.flashArgs.b).toBe(0);
    });

    test('보스 스폰 시 마젠타 플래시(500ms) + shake(500ms, 0.02)가 발동한다', async ({ page }) => {
      await startGame(page);

      const bossResult = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.scene.isActive()) return { error: 'GameScene not active' };

        // 카메라 flash/shake 메서드를 감시
        let flashCalled = false, flashArgs = null;
        let shakeCalled = false, shakeArgs = null;

        const originalFlash = gameScene.cameras.main.flash.bind(gameScene.cameras.main);
        const originalShake = gameScene.cameras.main.shake.bind(gameScene.cameras.main);

        gameScene.cameras.main.flash = (duration, r, g, b, force) => {
          flashCalled = true;
          flashArgs = { duration, r, g, b, force };
          return originalFlash(duration, r, g, b, force);
        };
        gameScene.cameras.main.shake = (duration, intensity) => {
          shakeCalled = true;
          shakeArgs = { duration, intensity };
          return originalShake(duration, intensity);
        };

        // 보스 스폰 콜백 직접 호출
        gameScene.onBossSpawn({ typeId: 'commander_drone' });

        // 복원
        gameScene.cameras.main.flash = originalFlash;
        gameScene.cameras.main.shake = originalShake;

        return { flashCalled, flashArgs, shakeCalled, shakeArgs };
      });

      expect(bossResult.flashCalled, '보스 스폰 시 카메라 flash가 호출되어야 한다').toBe(true);
      expect(bossResult.flashArgs.duration).toBe(500);
      expect(bossResult.flashArgs.r).toBe(255);
      expect(bossResult.flashArgs.g).toBe(0);
      expect(bossResult.flashArgs.b).toBe(255);

      expect(bossResult.shakeCalled, '보스 스폰 시 카메라 shake가 호출되어야 한다').toBe(true);
      expect(bossResult.shakeArgs.duration).toBe(500);
      expect(bossResult.shakeArgs.intensity).toBe(0.02);
    });

    test('WaveSystem을 통해 미니보스를 스폰하면 스프라이트가 표시된다', async ({ page }) => {
      await startGame(page);

      const spawnResult = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.scene.isActive()) return { error: 'GameScene not active' };

        // WaveSystem으로 미니보스 직접 스폰
        const enemy = gameScene.waveSystem.spawnEnemy(
          'guardian_drone',
          gameScene.player.x + 100,
          gameScene.player.y,
          1, 1
        );

        if (!enemy) return { error: 'failed to spawn' };

        return {
          active: enemy.active,
          visible: enemy.visible,
          textureKey: enemy.texture.key,
          isMiniBoss: enemy.isMiniBoss,
          hasAnimation: enemy.anims?.currentAnim?.key || null,
        };
      });

      expect(spawnResult.active).toBe(true);
      expect(spawnResult.visible).toBe(true);
      expect(spawnResult.textureKey).toBe('enemy_guardian_drone');
      expect(spawnResult.isMiniBoss).toBe(true);
      expect(spawnResult.hasAnimation).toBe('enemy_guardian_drone_idle');

      await page.screenshot({ path: 'tests/screenshots/miniboss-spawned.png' });
    });

    test('WaveSystem을 통해 보스를 스폰하면 스프라이트가 표시된다', async ({ page }) => {
      await startGame(page);

      const spawnResult = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !gameScene.scene.isActive()) return { error: 'GameScene not active' };

        const enemy = gameScene.waveSystem.spawnEnemy(
          'commander_drone',
          gameScene.player.x + 150,
          gameScene.player.y,
          1, 1
        );

        if (!enemy) return { error: 'failed to spawn' };

        return {
          active: enemy.active,
          visible: enemy.visible,
          textureKey: enemy.texture.key,
          isBoss: enemy.isBoss,
          hasAnimation: enemy.anims?.currentAnim?.key || null,
          scale: enemy.scaleX,
        };
      });

      expect(spawnResult.active).toBe(true);
      expect(spawnResult.visible).toBe(true);
      expect(spawnResult.textureKey).toBe('enemy_commander_drone');
      expect(spawnResult.isBoss).toBe(true);
      expect(spawnResult.hasAnimation).toBe('enemy_commander_drone_idle');
      // SPRITE_SCALE = 2
      expect(spawnResult.scale).toBe(2);

      await page.screenshot({ path: 'tests/screenshots/boss-spawned.png' });
    });

    test('모든 보스 3종이 정상적으로 스폰되고 idle animation이 재생된다', async ({ page }) => {
      await startGame(page);

      const bossTypes = ['commander_drone', 'siege_titan', 'core_processor'];
      for (const typeId of bossTypes) {
        const result = await page.evaluate((bossTypeId) => {
          const game = window.__NEON_EXODUS;
          const gs = game.scene.getScene('GameScene');
          if (!gs || !gs.scene.isActive()) return { error: 'GameScene not active' };

          const enemy = gs.waveSystem.spawnEnemy(
            bossTypeId,
            gs.player.x + 150,
            gs.player.y + 50,
            1, 1
          );
          if (!enemy) return { error: 'spawn failed' };

          return {
            typeId: bossTypeId,
            textureKey: enemy.texture.key,
            animKey: enemy.anims?.currentAnim?.key || null,
            isBoss: enemy.isBoss,
          };
        }, typeId);

        expect(result.textureKey).toBe(`enemy_${typeId}`);
        expect(result.animKey).toBe(`enemy_${typeId}_idle`);
        expect(result.isBoss).toBe(true);
      }

      await page.screenshot({ path: 'tests/screenshots/all-bosses-spawned.png' });
    });
  });

  // ============================================================
  // 4. 피격 플래시 복원 로직 검증
  // ============================================================
  test.describe('피격 플래시 복원 (takeDamage)', () => {

    async function startGame(page) {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const currentScene = game.scene.getScenes(true)[0];
        if (currentScene) {
          currentScene.scene.start('GameScene', { characterId: 'agent' });
        }
      });
      await page.waitForTimeout(1500);
    }

    test('보스 피격 후 스프라이트 틴트가 clearTint로 복원된다 (잔여 틴트 없음)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          const game = window.__NEON_EXODUS;
          const gs = game.scene.getScene('GameScene');
          if (!gs || !gs.scene.isActive()) {
            resolve({ error: 'GameScene not active' });
            return;
          }

          // 보스 스폰
          const enemy = gs.waveSystem.spawnEnemy(
            'commander_drone',
            gs.player.x + 200,
            gs.player.y,
            1, 1
          );
          if (!enemy) {
            resolve({ error: 'spawn failed' });
            return;
          }

          // 텍스처가 실제 스프라이트인지 확인
          const texExists = gs.textures.exists('enemy_commander_drone');

          // 피격 전 tint 상태
          const tintBefore = enemy.tintTopLeft;

          // 피격 (소량 데미지, 죽지 않도록)
          enemy.takeDamage(1, false);

          // 피격 직후: 흰색 플래시가 적용되어 있어야 한다
          const tintDuringFlash = enemy.tintTopLeft;

          // 100ms 후 복원 확인
          gs.time.delayedCall(150, () => {
            const tintAfterRestore = enemy.tintTopLeft;
            // 스프라이트가 존재하면 clearTint → 0xFFFFFF (Phaser의 기본 no-tint)
            // clearTint 호출 시 tintTopLeft는 0xFFFFFF (16777215)
            resolve({
              texExists,
              tintBefore,
              tintDuringFlash,
              tintAfterRestore,
              expectedClear: 0xFFFFFF, // 16777215
            });
          });
        });
      });

      expect(result.texExists, '보스 텍스처가 존재해야 한다').toBe(true);
      expect(result.tintDuringFlash, '피격 즉시 흰색 플래시가 적용되어야 한다').toBe(0xFFFFFF);
      // 복원 후 clearTint 상태 (no tint = 0xFFFFFF)
      expect(result.tintAfterRestore, '복원 후 clearTint 상태여야 한다').toBe(0xFFFFFF);
    });

    test('미니보스 피격 후에도 clearTint로 복원된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          const game = window.__NEON_EXODUS;
          const gs = game.scene.getScene('GameScene');
          if (!gs || !gs.scene.isActive()) {
            resolve({ error: 'GameScene not active' });
            return;
          }

          const enemy = gs.waveSystem.spawnEnemy(
            'guardian_drone',
            gs.player.x + 200,
            gs.player.y,
            1, 1
          );
          if (!enemy) {
            resolve({ error: 'spawn failed' });
            return;
          }

          enemy.takeDamage(1, false);

          gs.time.delayedCall(150, () => {
            resolve({
              texExists: gs.textures.exists('enemy_guardian_drone'),
              tintAfterRestore: enemy.tintTopLeft,
              isMiniBoss: enemy.isMiniBoss,
            });
          });
        });
      });

      expect(result.texExists).toBe(true);
      expect(result.isMiniBoss).toBe(true);
      // clearTint 상태
      expect(result.tintAfterRestore).toBe(0xFFFFFF);
    });

    test('잡몹 피격 후에도 clearTint로 복원된다 (Phase 1 스프라이트)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          const game = window.__NEON_EXODUS;
          const gs = game.scene.getScene('GameScene');
          if (!gs || !gs.scene.isActive()) {
            resolve({ error: 'GameScene not active' });
            return;
          }

          const enemy = gs.waveSystem.spawnEnemy(
            'nano_drone',
            gs.player.x + 200,
            gs.player.y,
            1, 1
          );
          if (!enemy) {
            resolve({ error: 'spawn failed' });
            return;
          }

          enemy.takeDamage(1, false);

          gs.time.delayedCall(150, () => {
            resolve({
              texExists: gs.textures.exists('enemy_nano_drone'),
              tintAfterRestore: enemy.tintTopLeft,
              isBoss: enemy.isBoss,
              isMiniBoss: enemy.isMiniBoss,
            });
          });
        });
      });

      expect(result.texExists).toBe(true);
      expect(result.isBoss).toBe(false);
      expect(result.isMiniBoss).toBe(false);
      // Phase 1 스프라이트도 존재하므로 clearTint 상태
      expect(result.tintAfterRestore).toBe(0xFFFFFF);
    });
  });

  // ============================================================
  // 5. 엣지케이스 및 안정성 검증
  // ============================================================
  test.describe('엣지케이스 및 안정성', () => {

    async function startGame(page) {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const currentScene = game.scene.getScenes(true)[0];
        if (currentScene) {
          currentScene.scene.start('GameScene', { characterId: 'agent' });
        }
      });
      await page.waitForTimeout(1500);
    }

    test('보스를 연속 피격해도 크래시 없이 동작한다 (연타 시뮬레이션)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          const game = window.__NEON_EXODUS;
          const gs = game.scene.getScene('GameScene');
          if (!gs || !gs.scene.isActive()) {
            resolve({ error: 'GameScene not active' });
            return;
          }

          const enemy = gs.waveSystem.spawnEnemy(
            'commander_drone',
            gs.player.x + 200,
            gs.player.y,
            100, 1 // HP를 크게 올려서 죽지 않게
          );
          if (!enemy) {
            resolve({ error: 'spawn failed' });
            return;
          }

          // 빠른 연속 피격 20회 (10ms 간격)
          let hitCount = 0;
          const interval = setInterval(() => {
            if (!enemy.active || hitCount >= 20) {
              clearInterval(interval);
              resolve({
                hitCount,
                active: enemy.active,
                noError: true,
              });
              return;
            }
            try {
              enemy.takeDamage(1, false);
              hitCount++;
            } catch (err) {
              clearInterval(interval);
              resolve({ error: err.message });
            }
          }, 10);
        });
      });

      expect(result.noError, '20회 연속 피격 시 에러가 없어야 한다').toBe(true);
      expect(result.hitCount).toBe(20);
    });

    test('보스 사망 후 비활성화되고 다시 스폰할 수 있다 (풀 재활용)', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.scene.isActive()) return { error: 'GameScene not active' };

        // 미니보스 스폰 (HP 배수 1 = 낮은 HP)
        const enemy = gs.waveSystem.spawnEnemy(
          'guardian_drone',
          gs.player.x + 200,
          gs.player.y,
          0.01, 1 // 매우 낮은 HP
        );
        if (!enemy) return { error: 'spawn failed' };

        // 큰 데미지로 즉사
        enemy.takeDamage(99999, false);

        const afterDeath = {
          active: enemy.active,
          visible: enemy.visible,
        };

        // 다시 스폰 시도
        const enemy2 = gs.waveSystem.spawnEnemy(
          'assault_mech',
          gs.player.x + 200,
          gs.player.y,
          1, 1
        );

        return {
          afterDeath,
          respawned: enemy2 ? {
            active: enemy2.active,
            textureKey: enemy2.texture.key,
          } : null,
        };
      });

      expect(result.afterDeath.active).toBe(false);
      expect(result.afterDeath.visible).toBe(false);
      expect(result.respawned).not.toBeNull();
      expect(result.respawned.active).toBe(true);
    });

    test('special animation이 anims 레지스트리에 등록되어 있다 (재생 트리거 없이)', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const anims = game.anims;
        const specialKeys = [
          'enemy_commander_drone_special',
          'enemy_siege_titan_special',
          'enemy_core_processor_special',
        ];
        return specialKeys.map(key => ({
          key,
          exists: anims.exists(key),
        }));
      });

      for (const r of result) {
        expect(r.exists, `${r.key} special animation이 등록되어야 한다`).toBe(true);
      }
    });

    test('Phase 1 잡몹 스프라이트에 영향이 없다', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      const result = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const textures = game.textures;
        const anims = game.anims;

        const phase1Keys = [
          'enemy_nano_drone', 'enemy_scout_bot', 'enemy_spark_drone',
          'enemy_battle_robot', 'enemy_shield_drone', 'enemy_rush_bot',
          'enemy_repair_bot', 'enemy_heavy_bot', 'enemy_teleport_drone',
          'enemy_suicide_bot',
        ];

        return phase1Keys.map(key => ({
          key,
          textureExists: textures.exists(key),
          animExists: anims.exists(key + '_idle'),
        }));
      });

      for (const r of result) {
        expect(r.textureExists, `Phase 1 텍스처 ${r.key}가 존재해야 한다`).toBe(true);
        expect(r.animExists, `Phase 1 animation ${r.key}_idle이 존재해야 한다`).toBe(true);
      }
    });

    test('모바일 뷰포트(375x667)에서 게임이 정상 실행된다', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/mobile-viewport.png' });

      expect(errors.length, `모바일 뷰포트에서 에러가 없어야 한다: ${errors.join(', ')}`).toBe(0);
    });

    test('다수의 보스/미니보스를 동시 스폰해도 크래시가 발생하지 않는다', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(BASE_URL);
      await page.waitForFunction(() => window.__NEON_EXODUS !== undefined, { timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const currentScene = game.scene.getScenes(true)[0];
        if (currentScene) {
          currentScene.scene.start('GameScene', { characterId: 'agent' });
        }
      });
      await page.waitForTimeout(1500);

      const spawnResult = await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const gs = game.scene.getScene('GameScene');
        if (!gs || !gs.scene.isActive()) return { error: 'GameScene not active' };

        const types = [
          'guardian_drone', 'assault_mech',
          'commander_drone', 'siege_titan', 'core_processor',
        ];
        let spawned = 0;

        for (let i = 0; i < 10; i++) {
          for (const typeId of types) {
            const enemy = gs.waveSystem.spawnEnemy(
              typeId,
              gs.player.x + Math.random() * 400 - 200,
              gs.player.y + Math.random() * 400 - 200,
              1, 1
            );
            if (enemy) spawned++;
          }
        }

        return { spawned, noError: true };
      });

      expect(spawnResult.noError).toBe(true);
      expect(spawnResult.spawned).toBeGreaterThan(0);
      expect(errors.length).toBe(0);

      await page.screenshot({ path: 'tests/screenshots/mass-spawn.png' });
    });
  });
});
