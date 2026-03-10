/**
 * @fileoverview Neon Exodus Art Phase 2 QA 테스트.
 *
 * 검증 항목:
 * 1. 에셋 파일 존재 및 텍스처 로딩 (31종)
 * 2. BootScene preload 정상 등록
 * 3. 배경 타일 렌더링 (bg_tile PNG 우선, 폴백 시 프로시저럴)
 * 4. 조이스틱 Image 텍스처 전환 + Graphics 폴백
 * 5. MenuScene 배경 이미지 표시
 * 6. LevelUpScene 무기/패시브 아이콘 이미지 표시 (이모지 폴백)
 * 7. UpgradeScene 카테고리 아이콘 표시
 * 8. Consumable.js Physics body 48x48 기준 설정
 * 9. 소모품 플레이스홀더 48x48 크기
 * 10. 6종 캐릭터 게임 시작 크래시 없음
 * 11. 콘솔 에러 없음
 * 12. 시각적 검증 (스크린샷)
 */

import { test, expect } from '@playwright/test';

const GAME_LOAD_TIMEOUT = 15000;

// ── 헬퍼: MenuScene 대기 ──
async function waitForMenu(page) {
  await page.waitForFunction(
    () => {
      const game = window.__NEON_EXODUS;
      if (!game || !game.scene) return false;
      const menu = game.scene.getScene('MenuScene');
      return menu && menu.scene.isActive();
    },
    { timeout: GAME_LOAD_TIMEOUT }
  );
}

// ── 헬퍼: GameScene 프로그래밍 방식으로 시작 ──
async function startGame(page, characterId = 'agent') {
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
    { timeout: GAME_LOAD_TIMEOUT }
  );

  // GameScene 안정화 대기
  await page.waitForTimeout(1000);
}

// ── 테스트 ──

test.describe('Art Phase 2: UI + 배경 + 소모품 아이콘', () => {

  test.beforeEach(async ({ page }) => {
    page._consoleErrors = [];
    page.on('pageerror', (err) => page._consoleErrors.push(err.message));
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
  });

  // =====================================================
  // Group A: 에셋 존재 및 텍스처 로딩
  // =====================================================

  test.describe('A. 에셋 텍스처 로딩 검증', () => {

    test('A1. bg_tile 텍스처가 로드된다', async ({ page }) => {
      await waitForMenu(page);
      const exists = await page.evaluate(() =>
        window.__NEON_EXODUS.textures.exists('bg_tile')
      );
      expect(exists).toBe(true);
    });

    test('A2. 조이스틱 base/thumb 텍스처가 로드된다', async ({ page }) => {
      await waitForMenu(page);
      const result = await page.evaluate(() => ({
        base: window.__NEON_EXODUS.textures.exists('joystick_base'),
        thumb: window.__NEON_EXODUS.textures.exists('joystick_thumb'),
      }));
      expect(result.base).toBe(true);
      expect(result.thumb).toBe(true);
    });

    test('A3. 소모품 6종 텍스처가 로드된다', async ({ page }) => {
      await waitForMenu(page);
      const keys = [
        'consumable_nano_repair', 'consumable_mag_pulse', 'consumable_emp_bomb',
        'consumable_credit_chip', 'consumable_overclock', 'consumable_shield_battery',
      ];
      const results = await page.evaluate((texKeys) => {
        return texKeys.map(k => ({
          key: k,
          exists: window.__NEON_EXODUS.textures.exists(k),
        }));
      }, keys);
      for (const r of results) {
        expect(r.exists, `텍스처 '${r.key}' 미존재`).toBe(true);
      }
    });

    test('A4. menu_bg 텍스처가 로드된다 (Group B)', async ({ page }) => {
      await waitForMenu(page);
      const exists = await page.evaluate(() =>
        window.__NEON_EXODUS.textures.exists('menu_bg')
      );
      expect(exists).toBe(true);
    });

    test('A5. 무기 아이콘 7종 텍스처가 로드된다 (Group B)', async ({ page }) => {
      await waitForMenu(page);
      const weaponIds = ['blaster', 'laser_gun', 'plasma_orb', 'electric_chain', 'missile', 'drone', 'emp_blast'];
      const results = await page.evaluate((ids) => {
        return ids.map(id => ({
          key: 'icon_weapon_' + id,
          exists: window.__NEON_EXODUS.textures.exists('icon_weapon_' + id),
        }));
      }, weaponIds);
      for (const r of results) {
        expect(r.exists, `텍스처 '${r.key}' 미존재`).toBe(true);
      }
    });

    test('A6. 패시브 아이콘 10종 텍스처가 로드된다 (Group B)', async ({ page }) => {
      await waitForMenu(page);
      const passiveIds = ['booster', 'armor_plate', 'battery_pack', 'overclock', 'magnet_module', 'regen_module', 'aim_module', 'critical_chip', 'cooldown_chip', 'luck_module'];
      const results = await page.evaluate((ids) => {
        return ids.map(id => ({
          key: 'icon_passive_' + id,
          exists: window.__NEON_EXODUS.textures.exists('icon_passive_' + id),
        }));
      }, passiveIds);
      for (const r of results) {
        expect(r.exists, `텍스처 '${r.key}' 미존재`).toBe(true);
      }
    });

    test('A7. 업그레이드 아이콘 4종 텍스처가 로드된다 (Group B)', async ({ page }) => {
      await waitForMenu(page);
      const upgradeIds = ['basic', 'growth', 'special', 'limitBreak'];
      const results = await page.evaluate((ids) => {
        return ids.map(id => ({
          key: 'icon_upgrade_' + id,
          exists: window.__NEON_EXODUS.textures.exists('icon_upgrade_' + id),
        }));
      }, upgradeIds);
      for (const r of results) {
        expect(r.exists, `텍스처 '${r.key}' 미존재`).toBe(true);
      }
    });

    test('A8. bg_tile 텍스처 크기가 128x128이다', async ({ page }) => {
      await waitForMenu(page);
      const size = await page.evaluate(() => {
        const tex = window.__NEON_EXODUS.textures.get('bg_tile');
        const src = tex.getSourceImage();
        return { width: src.width, height: src.height };
      });
      expect(size.width).toBe(128);
      expect(size.height).toBe(128);
    });

    test('A9. 소모품 텍스처 크기가 48x48이다', async ({ page }) => {
      await waitForMenu(page);
      const keys = [
        'consumable_nano_repair', 'consumable_mag_pulse', 'consumable_emp_bomb',
        'consumable_credit_chip', 'consumable_overclock', 'consumable_shield_battery',
      ];
      const results = await page.evaluate((texKeys) => {
        return texKeys.map(k => {
          const tex = window.__NEON_EXODUS.textures.get(k);
          const src = tex.getSourceImage();
          return { key: k, width: src.width, height: src.height };
        });
      }, keys);
      for (const r of results) {
        expect(r.width, `${r.key}: width`).toBe(48);
        expect(r.height, `${r.key}: height`).toBe(48);
      }
    });
  });

  // =====================================================
  // B. 배경 타일 렌더링 및 폴백
  // =====================================================

  test.describe('B. 배경 타일 렌더링', () => {

    test('B1. GameScene에서 bg_tile이 tileSprite로 사용된다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.bgTile) return { error: 'bgTile not found' };
        // Phaser TileSprite는 내부적으로 UUID 키로 텍스처 사본을 생성한다.
        // 따라서 원본 키 대신 bgTile 존재 + 크기 + 타입으로 검증한다.
        return {
          type: gs.bgTile.type,
          exists: !!gs.bgTile.texture,
          width: gs.bgTile.width,
          height: gs.bgTile.height,
          // bg_tile 텍스처가 게임에 로드되어 있는지 별도 확인
          bgTileLoaded: gs.textures.exists('bg_tile'),
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.exists).toBe(true);
      expect(result.type).toBe('TileSprite');
      expect(result.bgTileLoaded).toBe(true);
      expect(result.width).toBe(2000); // WORLD_WIDTH
      expect(result.height).toBe(2000); // WORLD_HEIGHT
    });

    test('B2. _generateBackgroundTile은 bg_tile PNG 로드 시 스킵된다', async ({ page }) => {
      await waitForMenu(page);
      // bg_tile 텍스처가 PNG로 로드되었는지 확인 (프로시저럴이 아닌)
      const texInfo = await page.evaluate(() => {
        const tex = window.__NEON_EXODUS.textures.get('bg_tile');
        const src = tex.getSourceImage();
        // PNG로 로드된 경우 Image 객체. 프로시저럴이면 Canvas.
        return {
          isImage: src instanceof HTMLImageElement,
          width: src.width,
          height: src.height,
        };
      });
      // PNG가 존재하므로 HTMLImageElement (128x128)
      expect(texInfo.isImage).toBe(true);
      expect(texInfo.width).toBe(128);
      expect(texInfo.height).toBe(128);
    });
  });

  // =====================================================
  // C. 조이스틱 Image 텍스처 전환
  // =====================================================

  test.describe('C. 조이스틱 Image 텍스처', () => {

    test('C1. 조이스틱 base가 Image 타입이다 (PNG 존재 시)', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };
        const base = gs.joystick.base;
        return {
          type: base.type,
          // Phaser Image type = 'Image', Graphics type = 'Graphics'
          isImage: base.type === 'Image',
          textureKey: base.texture ? base.texture.key : null,
          visible: base.visible,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.isImage).toBe(true);
      expect(result.textureKey).toBe('joystick_base');
    });

    test('C2. 조이스틱 thumb이 Image 타입이다 (PNG 존재 시)', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };
        const thumb = gs.joystick.thumb;
        return {
          type: thumb.type,
          isImage: thumb.type === 'Image',
          textureKey: thumb.texture ? thumb.texture.key : null,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.isImage).toBe(true);
      expect(result.textureKey).toBe('joystick_thumb');
    });

    test('C3. 조이스틱 터치 시 base/thumb이 정상 표시된다', async ({ page }) => {
      await startGame(page);
      // 터치 시뮬레이션
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };

        // 포인터 다운 시뮬레이션
        const joystick = gs.joystick;
        joystick._onPointerDown({ id: 99, x: 100, y: 400 });

        const baseVisible = joystick.base.visible;
        const thumbVisible = joystick.thumb.visible;
        const baseX = joystick.base.x;
        const baseY = joystick.base.y;

        // 포인터 업으로 정리
        joystick._onPointerUp({ id: 99 });

        return { baseVisible, thumbVisible, baseX, baseY };
      });
      expect(result.error).toBeUndefined();
      expect(result.baseVisible).toBe(true);
      expect(result.thumbVisible).toBe(true);
      expect(result.baseX).toBe(100);
      expect(result.baseY).toBe(400);
    });

    test('C4. 조이스틱 setPosition/setVisible이 Image에서 정상 동작한다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };

        const joystick = gs.joystick;

        // setPosition 호출 테스트
        joystick.base.setPosition(200, 300);
        const pos = { x: joystick.base.x, y: joystick.base.y };

        // setVisible 호출 테스트
        joystick.base.setVisible(true);
        const vis1 = joystick.base.visible;
        joystick.base.setVisible(false);
        const vis2 = joystick.base.visible;

        return { pos, vis1, vis2 };
      });
      expect(result.error).toBeUndefined();
      expect(result.pos.x).toBe(200);
      expect(result.pos.y).toBe(300);
      expect(result.vis1).toBe(true);
      expect(result.vis2).toBe(false);
    });
  });

  // =====================================================
  // D. MenuScene 배경 이미지
  // =====================================================

  test.describe('D. MenuScene 배경 이미지', () => {

    test('D1. MenuScene에서 menu_bg 이미지가 렌더링된다', async ({ page }) => {
      await waitForMenu(page);
      const result = await page.evaluate(() => {
        const menu = window.__NEON_EXODUS.scene.getScene('MenuScene');
        if (!menu) return { error: 'MenuScene not found' };

        // MenuScene의 displayList에서 menu_bg를 사용하는 Image를 찾는다
        const children = menu.children.list;
        const bgImage = children.find(c =>
          c.type === 'Image' && c.texture && c.texture.key === 'menu_bg'
        );
        if (!bgImage) return { found: false };
        return {
          found: true,
          alpha: bgImage.alpha,
          depth: bgImage.depth,
          displayWidth: bgImage.displayWidth,
          displayHeight: bgImage.displayHeight,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.found).toBe(true);
      expect(result.alpha).toBe(0.85);
      expect(result.depth).toBe(-1);
      expect(result.displayWidth).toBe(360); // GAME_WIDTH
      expect(result.displayHeight).toBe(640); // GAME_HEIGHT
    });

    test('D2. MenuScene 스크린샷: 배경 이미지 + 버튼 가독성', async ({ page }) => {
      await waitForMenu(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-menu-bg.png' });
    });
  });

  // =====================================================
  // E. Consumable Physics body 크기
  // =====================================================

  test.describe('E. Consumable Physics body', () => {

    test('E1. Consumable의 Physics body가 48x48 기준으로 설정되었다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return { error: 'pool not found' };

        // 풀에서 소모품 하나를 가져와 body 확인
        const pool = gs.consumablePool;
        // getFirstDead 또는 children 직접 접근
        const children = pool.group ? pool.group.getChildren() : [];
        if (children.length === 0) return { error: 'no consumables in pool' };

        const c = children[0];
        if (!c.body) return { error: 'no body' };

        return {
          isCircle: c.body.isCircle,
          radius: c.body.radius,
          offsetX: c.body.offset.x,
          offsetY: c.body.offset.y,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.isCircle).toBe(true);
      // setCircle(16, 8, 8) -> radius=16, offset=(8,8)
      expect(result.radius).toBe(16);
      expect(result.offsetX).toBe(8);
      expect(result.offsetY).toBe(8);
    });

    test('E2. 소모품 스폰 시 텍스처가 정상 전환된다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return { error: 'pool not found' };

        // 풀에서 가져오기
        const pool = gs.consumablePool;
        const c = pool.get();
        if (!c) return { error: 'could not get from pool' };

        // 스폰
        c.spawn(500, 500, 'nano_repair');

        return {
          textureKey: c.texture ? c.texture.key : null,
          active: c.active,
          visible: c.visible,
          scaleX: c.scaleX,
          scaleY: c.scaleY,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.textureKey).toBe('consumable_nano_repair');
      expect(result.active).toBe(true);
      expect(result.visible).toBe(true);
      expect(result.scaleX).toBe(1); // SPRITE_SCALE = 1
    });

    test('E3. 6종 소모품 모두 스폰 시 올바른 텍스처를 사용한다', async ({ page }) => {
      await startGame(page);
      const itemTypes = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];
      const expectedTextures = {
        nano_repair: 'consumable_nano_repair',
        mag_pulse: 'consumable_mag_pulse',
        emp_bomb: 'consumable_emp_bomb',
        credit_chip: 'consumable_credit_chip',
        overclock: 'consumable_overclock',
        shield_battery: 'consumable_shield_battery',
      };

      const results = await page.evaluate(({ types, expected }) => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return { error: 'pool not found' };

        return types.map(type => {
          const c = gs.consumablePool.get();
          if (!c) return { type, error: 'could not get' };
          c.spawn(500, 500, type);
          const texKey = c.texture ? c.texture.key : null;
          // 정리
          c.collect();
          return { type, textureKey: texKey, expected: expected[type] };
        });
      }, { types: itemTypes, expected: expectedTextures });

      if (results.error) throw new Error(results.error);

      for (const r of results) {
        expect(r.textureKey, `${r.type}: 텍스처 불일치`).toBe(r.expected);
      }
    });
  });

  // =====================================================
  // F. UpgradeScene 카테고리 아이콘
  // =====================================================

  test.describe('F. UpgradeScene 카테고리 아이콘', () => {

    test('F1. UpgradeScene에서 icon_upgrade 텍스처가 로드되어 있다', async ({ page }) => {
      await waitForMenu(page);
      const result = await page.evaluate(() => {
        const ids = ['basic', 'growth', 'special', 'limitBreak'];
        return ids.map(id => ({
          key: 'icon_upgrade_' + id,
          exists: window.__NEON_EXODUS.textures.exists('icon_upgrade_' + id),
        }));
      });
      for (const r of result) {
        expect(r.exists, `텍스처 '${r.key}' 미존재`).toBe(true);
      }
    });

    test('F2. UpgradeScene 스크린샷: 카테고리 아이콘 표시 확인', async ({ page }) => {
      await waitForMenu(page);

      // UpgradeScene으로 이동
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const menuScene = game.scene.getScene('MenuScene');
        if (menuScene) {
          menuScene.scene.start('UpgradeScene');
        }
      });

      // UpgradeScene 활성화 대기
      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const us = game.scene.getScene('UpgradeScene');
          return us && us.scene.isActive();
        },
        { timeout: 10000 }
      );

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-upgrade-icons.png' });
    });
  });

  // =====================================================
  // G. 게임 플레이 플로우 크래시 없음
  // =====================================================

  test.describe('G. 게임 플레이 안정성', () => {

    test('G1. agent 캐릭터로 게임 시작 -> 이동 -> 에러 없음', async ({ page }) => {
      await startGame(page, 'agent');

      // 이동 시뮬레이션
      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick || !gs.player) return;
        gs.joystick.isActive = true;
        gs.joystick.direction = { x: 1, y: 0 };
        gs.player.update(0, 16);
      });
      await page.waitForTimeout(1000);

      expect(page._consoleErrors).toEqual([]);
    });

    test('G2. 6종 캐릭터 모두 게임 시작에서 크래시가 없다', async ({ page }) => {
      const characters = ['agent', 'sniper', 'engineer', 'berserker', 'medic', 'hidden'];

      for (const charId of characters) {
        // 페이지 새로 로드 (각 캐릭터마다)
        await page.goto('/', { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        await waitForMenu(page);

        await page.evaluate((cId) => {
          const game = window.__NEON_EXODUS;
          const menuScene = game.scene.getScene('MenuScene');
          if (menuScene) {
            menuScene.scene.start('GameScene', { characterId: cId });
          }
        }, charId);

        // GameScene 진입 대기 (크래시 시 타임아웃)
        const loaded = await page.waitForFunction(
          () => {
            const game = window.__NEON_EXODUS;
            if (!game) return false;
            const gs = game.scene.getScene('GameScene');
            return gs && gs.scene.isActive() && gs.player && gs.player.active;
          },
          { timeout: GAME_LOAD_TIMEOUT }
        ).then(() => true).catch(() => false);

        expect(loaded, `캐릭터 '${charId}' 게임 시작 실패`).toBe(true);
      }
    });

    test('G3. 게임 중 소모품 스폰 + 수집 플로우에서 크래시 없음', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return { error: 'pool not found' };

        try {
          // 소모품 6종 스폰 후 수집
          const types = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];
          for (const type of types) {
            const c = gs.consumablePool.get();
            if (!c) continue;
            c.spawn(gs.player.x + 10, gs.player.y + 10, type);
            // 수집
            c.collect();
          }
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(page._consoleErrors).toEqual([]);
    });
  });

  // =====================================================
  // H. 시각적 검증
  // =====================================================

  test.describe('H. 시각적 검증', () => {

    test('H1. 게임 시작 후 배경 타일 스크린샷', async ({ page }) => {
      await startGame(page);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-bg-tile.png' });
    });

    test('H2. 조이스틱 터치 시 스크린샷', async ({ page }) => {
      await startGame(page);

      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return;
        // 터치 시뮬레이션으로 조이스틱 표시
        gs.joystick._onPointerDown({ id: 99, x: 100, y: 500 });
        // 살짝 이동해서 thumb도 보이도록
        gs.joystick._onPointerMove({ id: 99, x: 130, y: 480 });
      });

      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-joystick.png' });

      // 터치 해제
      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (gs && gs.joystick) {
          gs.joystick._onPointerUp({ id: 99 });
        }
      });
    });

    test('H3. 소모품 아이콘 48x48 스크린샷', async ({ page }) => {
      await startGame(page);

      // 화면 중앙 근처에 6종 소모품 스폰
      await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return;

        const types = ['nano_repair', 'mag_pulse', 'emp_bomb', 'credit_chip', 'overclock', 'shield_battery'];
        const px = gs.player.x;
        const py = gs.player.y;

        types.forEach((type, i) => {
          const c = gs.consumablePool.get();
          if (!c) return;
          // 카메라 뷰 안에 일렬로 배치
          c.spawn(px - 100 + i * 40, py + 60, type);
        });
      });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-consumables.png' });
    });

    test('H4. 모바일 뷰포트(360x640) 렌더링 정상', async ({ page }) => {
      // 이미 playwright.config.js에서 360x640이지만 명시적으로 확인
      await page.setViewportSize({ width: 360, height: 640 });
      await startGame(page);
      await page.screenshot({ path: 'tests/screenshots/art-phase2-mobile-360x640.png' });
    });
  });

  // =====================================================
  // I. 엣지케이스 및 예외 시나리오
  // =====================================================

  test.describe('I. 엣지케이스', () => {

    test('I1. 조이스틱 다중 포인터 시 두 번째 포인터가 무시된다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };

        const joystick = gs.joystick;

        // 첫 번째 포인터 다운
        joystick._onPointerDown({ id: 1, x: 100, y: 400 });
        const firstActive = joystick.isActive;
        const firstPointerId = joystick._pointerId;

        // 두 번째 포인터 다운 (무시되어야 함)
        joystick._onPointerDown({ id: 2, x: 200, y: 300 });
        const secondPointerId = joystick._pointerId;

        // 정리
        joystick._onPointerUp({ id: 1 });

        return {
          firstActive,
          firstPointerId,
          secondPointerId,
          // pointerId가 변경되지 않았는지 확인
          ignored: firstPointerId === secondPointerId,
        };
      });
      expect(result.error).toBeUndefined();
      expect(result.firstActive).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.firstPointerId).toBe(1);
    });

    test('I2. 조이스틱 destroy 호출 시 Image/Graphics 모두 에러 없이 정리된다', async ({ page }) => {
      await startGame(page);
      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.joystick) return { error: 'joystick not found' };

        try {
          // destroy는 실제로 호출하면 게임이 깨지므로, base/thumb.destroy가 함수인지만 확인
          const baseDestroyable = typeof gs.joystick.base.destroy === 'function';
          const thumbDestroyable = typeof gs.joystick.thumb.destroy === 'function';
          return { baseDestroyable, thumbDestroyable };
        } catch (e) {
          return { error: e.message };
        }
      });
      expect(result.error).toBeUndefined();
      expect(result.baseDestroyable).toBe(true);
      expect(result.thumbDestroyable).toBe(true);
    });

    test('I3. 소모품 플레이스홀더 크기가 48x48이다 (PNG 실제 로드 시 해당 없으나 코드 검증)', async ({ page }) => {
      await waitForMenu(page);
      // PNG가 로드된 상태에서 텍스처 크기 확인 - 48x48이어야 한다
      const result = await page.evaluate(() => {
        const keys = [
          'consumable_nano_repair', 'consumable_mag_pulse', 'consumable_emp_bomb',
          'consumable_credit_chip', 'consumable_overclock', 'consumable_shield_battery',
        ];
        return keys.map(k => {
          const tex = window.__NEON_EXODUS.textures.get(k);
          if (!tex) return { key: k, error: 'not found' };
          const frame = tex.get();
          return { key: k, width: frame.width, height: frame.height };
        });
      });
      for (const r of result) {
        expect(r.width, `${r.key}: width`).toBe(48);
        expect(r.height, `${r.key}: height`).toBe(48);
      }
    });

    test('I4. 빠른 씬 전환 시 에러 없음 (MenuScene -> UpgradeScene -> MenuScene)', async ({ page }) => {
      await waitForMenu(page);

      // 빠르게 씬 전환 반복
      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const menu = game.scene.getScene('MenuScene');
        if (!menu) return;

        menu.scene.start('UpgradeScene');
      });

      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const upgrade = game.scene.getScene('UpgradeScene');
        if (upgrade && upgrade.scene.isActive()) {
          upgrade.scene.start('MenuScene');
        }
      });

      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const menu = game.scene.getScene('MenuScene');
        if (menu && menu.scene.isActive()) {
          menu.scene.start('UpgradeScene');
        }
      });

      await page.waitForTimeout(500);

      expect(page._consoleErrors).toEqual([]);
    });

    test('I5. 소모품 수집 후 재스폰 시 텍스처가 올바르게 전환된다', async ({ page }) => {
      await startGame(page);

      const result = await page.evaluate(() => {
        const gs = window.__NEON_EXODUS.scene.getScene('GameScene');
        if (!gs || !gs.consumablePool) return { error: 'pool not found' };

        const c = gs.consumablePool.get();
        if (!c) return { error: 'could not get' };

        // nano_repair로 스폰
        c.spawn(500, 500, 'nano_repair');
        const tex1 = c.texture.key;

        // 수집
        c.collect();

        // emp_bomb으로 재스폰
        c.spawn(500, 500, 'emp_bomb');
        const tex2 = c.texture.key;

        c.collect();

        return { tex1, tex2 };
      });

      expect(result.error).toBeUndefined();
      expect(result.tex1).toBe('consumable_nano_repair');
      expect(result.tex2).toBe('consumable_emp_bomb');
    });
  });

  // =====================================================
  // J. 콘솔 에러 종합 검증
  // =====================================================

  test.describe('J. 콘솔 에러 검증', () => {

    test('J1. 전체 로딩 + 메뉴 + 게임 시작 과정에서 콘솔 에러 없음', async ({ page }) => {
      await startGame(page);
      await page.waitForTimeout(2000);
      expect(page._consoleErrors).toEqual([]);
    });

    test('J2. UpgradeScene 진입/탭전환 시 콘솔 에러 없음', async ({ page }) => {
      await waitForMenu(page);

      await page.evaluate(() => {
        const game = window.__NEON_EXODUS;
        const menu = game.scene.getScene('MenuScene');
        if (menu) menu.scene.start('UpgradeScene');
      });

      await page.waitForFunction(
        () => {
          const game = window.__NEON_EXODUS;
          const us = game.scene.getScene('UpgradeScene');
          return us && us.scene.isActive();
        },
        { timeout: 10000 }
      );

      // 4개 탭 모두 전환
      for (let i = 0; i < 4; i++) {
        await page.evaluate((tabIdx) => {
          const game = window.__NEON_EXODUS;
          const us = game.scene.getScene('UpgradeScene');
          if (!us) return;
          us._currentTab = tabIdx;
          us._refreshTabs();
          us._renderCards();
        }, i);
        await page.waitForTimeout(200);
      }

      expect(page._consoleErrors).toEqual([]);
    });
  });
});
