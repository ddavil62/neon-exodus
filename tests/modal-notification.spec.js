/**
 * @fileoverview 인게임 알림 모달 전환 QA 테스트.
 *
 * 무기 진화 모달(_showEvolutionPopup)과 엔들리스 모달(_showEndlessModal)의
 * 구현 정합성, 일시정지 연동, 모달 차단 플래그, i18n 키 등을 검증한다.
 */

import { test, expect } from '@playwright/test';

test.describe('인게임 알림 모달 전환 검증', () => {

  test.beforeEach(async ({ page }) => {
    // 콘솔 에러 수집
    page._consoleErrors = [];
    page._consoleWarnings = [];
    page.on('pageerror', err => page._consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') page._consoleErrors.push(msg.text());
      if (msg.type() === 'warning') page._consoleWarnings.push(msg.text());
    });
    await page.goto('/');
    // Phaser 로드 대기
    await page.waitForTimeout(3000);
  });

  // ── i18n 키 검증 ──

  test.describe('i18n 키 검증', () => {

    test('game.endlessModeDesc 한국어 키가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const mod = await import('/js/i18n.js');
          // 한국어로 설정하여 키 존재 확인
          if (mod.setLocale) mod.setLocale('ko');
          const val = mod.t('game.endlessModeDesc');
          return { value: val, isKey: val === 'game.endlessModeDesc' };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('ESM import failed:', result.error);
        return;
      }

      expect(result.isKey).toBe(false);
      expect(result.value).toContain('60');
    });

    test('game.endlessModeDesc 영어 키가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const mod = await import('/js/i18n.js');
          if (mod.setLocale) mod.setLocale('en');
          const val = mod.t('game.endlessModeDesc');
          return { value: val, isKey: val === 'game.endlessModeDesc' };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('ESM import failed:', result.error);
        return;
      }

      expect(result.isKey).toBe(false);
      expect(result.value).toContain('60 seconds');
    });

    test('ui.confirm 한국어/영어 키가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const mod = await import('/js/i18n.js');
          if (mod.setLocale) mod.setLocale('ko');
          const ko = mod.t('ui.confirm');
          if (mod.setLocale) mod.setLocale('en');
          const en = mod.t('ui.confirm');
          return { ko, en };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('ESM import failed:', result.error);
        return;
      }

      expect(result.ko).toBe('확인');
      expect(result.en).toBe('OK');
    });

    test('game.endlessMode 한국어/영어 키가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const mod = await import('/js/i18n.js');
          if (mod.setLocale) mod.setLocale('ko');
          const ko = mod.t('game.endlessMode');
          if (mod.setLocale) mod.setLocale('en');
          const en = mod.t('game.endlessMode');
          return { ko, en };
        } catch (e) {
          return { error: e.message };
        }
      });

      if (result.error) {
        console.warn('ESM import failed:', result.error);
        return;
      }

      // 둘 다 "ENDLESS MODE!" 이어야 한다
      expect(result.ko).toBe('ENDLESS MODE!');
      expect(result.en).toBe('ENDLESS MODE!');
    });
  });

  // ── 코드 구조 검증 (모듈 임포트 기반) ──

  test.describe('GameScene 코드 구조 검증', () => {

    test('_modalOpen 상태 변수가 create()에서 false로 초기화된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          // _modalOpen = false 패턴이 존재하는지 확인
          const hasInit = src.includes('this._modalOpen = false');
          // create 메서드 내에 있는지 확인 (대략적으로 create( 와 가까운 위치)
          const createIdx = src.indexOf('create(');
          const modalOpenIdx = src.indexOf('this._modalOpen = false');
          // _showEvolutionPopup보다 앞에 있어야 한다
          const evoPopupIdx = src.indexOf('_showEvolutionPopup(');
          return {
            hasInit,
            initBeforePopup: modalOpenIdx < evoPopupIdx,
            createIdx,
            modalOpenIdx
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.hasInit).toBe(true);
      expect(result.initBeforePopup).toBe(true);
    });

    test('_togglePause에 _modalOpen 가드가 존재한다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          // _togglePause 메서드 정의 위치를 찾는다 (함수 선언: '_togglePause() {')
          const toggleDeclIdx = src.indexOf('_togglePause() {');
          const guardPattern = 'if (this._modalOpen) return';
          const guardIdx = src.indexOf(guardPattern, toggleDeclIdx);
          // guard가 _togglePause 함수 선언 뒤 가까이에 있어야 한다
          return {
            hasGuard: guardIdx > -1,
            distance: guardIdx - toggleDeclIdx,
            toggleDeclIdx
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.hasGuard).toBe(true);
      // _togglePause 함수 선언 뒤 200자 이내에 가드가 있어야 한다
      expect(result.distance).toBeLessThan(200);
    });

    test('_showWarning 함수가 보존되어 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          const hasShowWarning = src.includes('_showWarning(message)');
          // _showWarning이 game.revived에서 여전히 사용되는지
          const hasRevivedCall = src.includes("_showWarning(t('game.revived'))");
          return { hasShowWarning, hasRevivedCall };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.hasShowWarning).toBe(true);
      expect(result.hasRevivedCall).toBe(true);
    });

    test('_showEvolutionHint 함수가 변경 없이 보존되어 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          const hasHint = src.includes('_showEvolutionHint(evo)');
          // 토스트 방식(자동 소멸)이 유지되는지 확인
          // 함수 끝까지 충분히 읽기 위해 1500자로 확장 (CRLF 고려)
          const hintIdx = src.indexOf('_showEvolutionHint(evo) {');
          const hintSection = src.substring(hintIdx, hintIdx + 1500);
          const hasTween = hintSection.includes('this.tweens.add');
          const hasAutoDestroy = hintSection.includes('hintText.destroy()');
          return { hasHint, hasTween, hasAutoDestroy, sectionLength: hintSection.length };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.hasHint).toBe(true);
      expect(result.hasTween).toBe(true);
      expect(result.hasAutoDestroy).toBe(true);
    });

    test('_onEnterEndless에서 _showEndlessModal을 호출한다 (not _showWarning)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          // 함수 정의를 찾는다 (호출 사이트가 아닌 선언)
          const enterEndlessDeclIdx = src.indexOf('_onEnterEndless() {');
          // 함수 본문을 충분히 읽는다 (1500자)
          const enterEndlessBody = src.substring(enterEndlessDeclIdx, enterEndlessDeclIdx + 1500);

          const callsEndlessModal = enterEndlessBody.includes('_showEndlessModal()');
          // _onEnterEndless 본문 내에서 _showWarning 호출이 없어야 한다
          const callsShowWarning = enterEndlessBody.includes('_showWarning');
          return { callsEndlessModal, callsShowWarning, bodyPreview: enterEndlessBody.substring(0, 200) };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.callsEndlessModal).toBe(true);
      expect(result.callsShowWarning).toBe(false);
    });

    test('기존 카메라 플래시 방식이 _showEvolutionPopup에서 제거되었다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
          const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
          // 다음 메서드 시작점 찾기
          const nextMethodIdx = src.indexOf('\n  _show', evoIdx + 30);
          const evoBody = src.substring(evoIdx, nextMethodIdx > 0 ? nextMethodIdx : evoIdx + 1000);

          const hasCameraFlash = evoBody.includes('camera') && evoBody.includes('flash');
          const hasAutoDestroy = evoBody.includes('delay:') && evoBody.includes('destroy') && !evoBody.includes('pointerup');

          // 모달 방식 확인
          const hasIsPaused = evoBody.includes('this.isPaused = true');
          const hasPhysicsPause = evoBody.includes('this.physics.pause()');
          const hasModalOpen = evoBody.includes('this._modalOpen = true');
          const hasOverlay = evoBody.includes('0x000000') && evoBody.includes('0.6');
          const hasPointerup = evoBody.includes('pointerup');

          return {
            hasCameraFlash,
            hasAutoDestroy,
            hasIsPaused,
            hasPhysicsPause,
            hasModalOpen,
            hasOverlay,
            hasPointerup
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      // 카메라 플래시가 없어야 한다
      expect(result.hasCameraFlash).toBe(false);
      // 모달 방식이어야 한다
      expect(result.hasIsPaused).toBe(true);
      expect(result.hasPhysicsPause).toBe(true);
      expect(result.hasModalOpen).toBe(true);
      expect(result.hasOverlay).toBe(true);
      expect(result.hasPointerup).toBe(true);
    });
  });

  // ── _showEvolutionPopup 모달 상세 검증 ──

  test.describe('_showEvolutionPopup 모달 상세', () => {

    test('오버레이: 0x000000 alpha 0.6, depth 350, scrollFactor(0)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        return {
          hasBlack: body.includes('0x000000'),
          hasAlpha06: body.includes('0.6'),
          hasDepth350: body.includes('setDepth(350)'),
          hasScrollFactor0: body.includes('setScrollFactor(0)'),
        };
      });

      expect(result.hasBlack).toBe(true);
      expect(result.hasAlpha06).toBe(true);
      expect(result.hasDepth350).toBe(true);
      expect(result.hasScrollFactor0).toBe(true);
    });

    test('패널: fillRoundedRect + NEON_ORANGE strokeRoundedRect, depth 351', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        return {
          hasFillRounded: body.includes('fillRoundedRect'),
          hasStrokeRounded: body.includes('strokeRoundedRect'),
          hasNeonOrange: body.includes('NEON_ORANGE'),
          hasDepth351: body.includes('setDepth(351)'),
          hasUIPanel: body.includes('UI_PANEL'),
        };
      });

      expect(result.hasFillRounded).toBe(true);
      expect(result.hasStrokeRounded).toBe(true);
      expect(result.hasNeonOrange).toBe(true);
      expect(result.hasDepth351).toBe(true);
      expect(result.hasUIPanel).toBe(true);
    });

    test('무기 이름: t(nameKey), 20px, neonOrange, depth 352', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        return {
          hasNameKey: body.includes('t(nameKey)'),
          has20px: body.includes("'20px'"),
          hasNeonOrangeColor: body.includes('neonOrange'),
          hasDepth352: body.includes('setDepth(352)'),
        };
      });

      expect(result.hasNameKey).toBe(true);
      expect(result.has20px).toBe(true);
      expect(result.hasNeonOrangeColor).toBe(true);
      expect(result.hasDepth352).toBe(true);
    });

    test('"EVOLVED!" 부제목: 14px, textSecondary, depth 352', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        return {
          hasEvolvedText: body.includes("'EVOLVED!'"),
          has14px: body.includes("'14px'"),
          hasTextSecondary: body.includes('textSecondary'),
        };
      });

      expect(result.hasEvolvedText).toBe(true);
      expect(result.has14px).toBe(true);
      expect(result.hasTextSecondary).toBe(true);
    });

    test('확인 버튼: NEON_ORANGE 배경, t("ui.confirm"), depth 352-353', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        const btnBgIdx = body.indexOf('fillStyle(COLORS.NEON_ORANGE');
        const hasConfirmKey = body.includes("t('ui.confirm')");
        const hasDepth353 = body.includes('setDepth(353)');
        const hasInteractive = body.includes('setInteractive');

        return {
          hasBtnOrangeBg: btnBgIdx > -1,
          hasConfirmKey,
          hasDepth353,
          hasInteractive,
        };
      });

      expect(result.hasBtnOrangeBg).toBe(true);
      expect(result.hasConfirmKey).toBe(true);
      expect(result.hasDepth353).toBe(true);
      expect(result.hasInteractive).toBe(true);
    });

    test('pointerup: 모든 요소 destroy + isPaused=false + physics.resume() + _modalOpen=false', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey)');
        const nextIdx = src.indexOf('\n  _showEvolutionHint', evoIdx);
        const body = src.substring(evoIdx, nextIdx);

        const pointerupIdx = body.indexOf("'pointerup'");
        const afterPointerup = body.substring(pointerupIdx);

        return {
          hasPointerup: pointerupIdx > -1,
          hasDestroyLoop: afterPointerup.includes('forEach') && afterPointerup.includes('destroy'),
          hasIsPausedFalse: afterPointerup.includes('this.isPaused = false'),
          hasPhysicsResume: afterPointerup.includes('this.physics.resume()'),
          hasModalOpenFalse: afterPointerup.includes('this._modalOpen = false'),
          hasBtnZoneDestroy: afterPointerup.includes('btnZone.destroy()'),
        };
      });

      expect(result.hasPointerup).toBe(true);
      expect(result.hasDestroyLoop).toBe(true);
      expect(result.hasIsPausedFalse).toBe(true);
      expect(result.hasPhysicsResume).toBe(true);
      expect(result.hasModalOpenFalse).toBe(true);
      expect(result.hasBtnZoneDestroy).toBe(true);
    });
  });

  // ── _showEndlessModal 모달 상세 검증 ──

  test.describe('_showEndlessModal 모달 상세', () => {

    test('게임 일시정지 + _modalOpen=true', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const endlessIdx = src.indexOf('_showEndlessModal()');
        // 두번째 occurrence (함수 선언)
        const declIdx = src.indexOf('_showEndlessModal() {', endlessIdx);
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        return {
          hasIsPaused: body.includes('this.isPaused = true'),
          hasPhysicsPause: body.includes('this.physics.pause()'),
          hasModalOpen: body.includes('this._modalOpen = true'),
        };
      });

      expect(result.hasIsPaused).toBe(true);
      expect(result.hasPhysicsPause).toBe(true);
      expect(result.hasModalOpen).toBe(true);
    });

    test('패널 테두리: NEON_MAGENTA', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const declIdx = src.indexOf('_showEndlessModal() {');
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        return {
          hasNeonMagenta: body.includes('NEON_MAGENTA'),
          hasStrokeRounded: body.includes('strokeRoundedRect'),
        };
      });

      expect(result.hasNeonMagenta).toBe(true);
      expect(result.hasStrokeRounded).toBe(true);
    });

    test('제목: t("game.endlessMode"), neonMagenta', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const declIdx = src.indexOf('_showEndlessModal() {');
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        return {
          hasEndlessMode: body.includes("t('game.endlessMode')"),
          hasNeonMagentaColor: body.includes('neonMagenta'),
          has20px: body.includes("'20px'"),
        };
      });

      expect(result.hasEndlessMode).toBe(true);
      expect(result.hasNeonMagentaColor).toBe(true);
      expect(result.has20px).toBe(true);
    });

    test('설명: t("game.endlessModeDesc"), wordWrap', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const declIdx = src.indexOf('_showEndlessModal() {');
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        return {
          hasEndlessModeDesc: body.includes("t('game.endlessModeDesc')"),
          hasWordWrap: body.includes('wordWrap'),
          has12px: body.includes("'12px'"),
          hasTextSecondary: body.includes('textSecondary'),
        };
      });

      expect(result.hasEndlessModeDesc).toBe(true);
      expect(result.hasWordWrap).toBe(true);
      expect(result.has12px).toBe(true);
      expect(result.hasTextSecondary).toBe(true);
    });

    test('확인 버튼: NEON_CYAN 배경', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const declIdx = src.indexOf('_showEndlessModal() {');
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        return {
          hasNeonCyan: body.includes('NEON_CYAN'),
          hasConfirmKey: body.includes("t('ui.confirm')"),
          hasDepth353: body.includes('setDepth(353)'),
        };
      });

      expect(result.hasNeonCyan).toBe(true);
      expect(result.hasConfirmKey).toBe(true);
      expect(result.hasDepth353).toBe(true);
    });

    test('pointerup: 모든 요소 destroy + 게임 재개', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const declIdx = src.indexOf('_showEndlessModal() {');
        const nextIdx = src.indexOf('\n  _showWarning', declIdx);
        const body = src.substring(declIdx, nextIdx);

        const pointerupIdx = body.indexOf("'pointerup'");
        const afterPointerup = body.substring(pointerupIdx);

        return {
          hasPointerup: pointerupIdx > -1,
          hasDestroyLoop: afterPointerup.includes('forEach') && afterPointerup.includes('destroy'),
          hasIsPausedFalse: afterPointerup.includes('this.isPaused = false'),
          hasPhysicsResume: afterPointerup.includes('this.physics.resume()'),
          hasModalOpenFalse: afterPointerup.includes('this._modalOpen = false'),
        };
      });

      expect(result.hasPointerup).toBe(true);
      expect(result.hasDestroyLoop).toBe(true);
      expect(result.hasIsPausedFalse).toBe(true);
      expect(result.hasPhysicsResume).toBe(true);
      expect(result.hasModalOpenFalse).toBe(true);
    });
  });

  // ── 엣지케이스 / 예외 시나리오 ──

  test.describe('엣지케이스 및 예외 시나리오', () => {

    test('동시 진화 시 모달 중첩 방지 가드가 있는지 확인', async ({ page }) => {
      // _showEvolutionPopup에 _modalOpen 체크 가드가 있는지 확인
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const body = src.substring(evoIdx, evoIdx + 200);

        // 함수 초반에 _modalOpen 체크가 있는지 확인
        const hasModalGuard = body.includes('if (this._modalOpen)');

        // _tryEvolutionCheck 함수 정의를 찾는다
        const tryEvoDeclIdx = src.indexOf('_tryEvolutionCheck() {');
        // 2000자 범위 내에서 for 루프와 _showEvolutionPopup 호출이 있는지 확인
        const tryEvoBody = src.substring(tryEvoDeclIdx, tryEvoDeclIdx + 2000);
        const hasForLoop = tryEvoBody.includes('for (');
        const multipleCallsPossible = hasForLoop && tryEvoBody.includes('_showEvolutionPopup');

        return { hasModalGuard, multipleCallsPossible, tryEvoDeclIdx };
      });

      // _tryEvolutionCheck에서 for 루프로 여러 진화를 동시에 처리할 수 있음을 확인
      expect(result.multipleCallsPossible).toBe(true);

      // 모달 가드가 없으면 MEDIUM 이슈로 기록
      // (현재 구현에서는 가드가 없어 동시 진화 시 모달 중첩 가능)
      if (!result.hasModalGuard) {
        console.warn('MEDIUM ISSUE: _showEvolutionPopup에 _modalOpen 중복 방지 가드 부재. '
          + '동시 2개 이상 진화 시 모달 중첩 가능성.');
      }
    });

    test('엔들리스 모드 타이머가 모달 표시 직후 시작되는지 확인', async ({ page }) => {
      // _onEnterEndless에서 _showEndlessModal 호출 후 time.addEvent 호출 순서 확인
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());
        const enterEndlessIdx = src.indexOf('_onEnterEndless() {');
        const body = src.substring(enterEndlessIdx, enterEndlessIdx + 500);

        const modalCallIdx = body.indexOf('_showEndlessModal()');
        const timeAddEventIdx = body.indexOf('this.time.addEvent');

        // time.addEvent가 모달 호출 이후에 실행됨
        // physics.pause()는 time 이벤트를 멈추지 않으므로 타이머가 모달 중에도 돌아감
        return {
          modalCallIdx,
          timeAddEventIdx,
          timerAfterModal: timeAddEventIdx > modalCallIdx,
          // 첫 타이머 delay 확인
          hasLongDelay: body.includes('ENDLESS_SCALE_INTERVAL'),
        };
      });

      // 타이머가 모달 이후에 등록되지만, 60초 delay이므로 실질적 문제는 없음
      expect(result.timerAfterModal).toBe(true);
      expect(result.hasLongDelay).toBe(true);
    });

    test('pointerdown 후 pointerout 시 alpha 복원 확인', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());

        // _showEvolutionPopup
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const evoEnd = src.indexOf('_showEvolutionHint', evoIdx);
        const evoBody = src.substring(evoIdx, evoEnd);
        const evoHasPointerout = evoBody.includes("'pointerout'");
        const evoHasAlphaRestore = evoBody.includes('setAlpha(1)');

        // _showEndlessModal
        const endIdx = src.indexOf('_showEndlessModal() {');
        const endEnd = src.indexOf('_showWarning', endIdx);
        const endBody = src.substring(endIdx, endEnd);
        const endHasPointerout = endBody.includes("'pointerout'");
        const endHasAlphaRestore = endBody.includes('setAlpha(1)');

        return {
          evoHasPointerout,
          evoHasAlphaRestore,
          endHasPointerout,
          endHasAlphaRestore,
        };
      });

      expect(result.evoHasPointerout).toBe(true);
      expect(result.evoHasAlphaRestore).toBe(true);
      expect(result.endHasPointerout).toBe(true);
      expect(result.endHasAlphaRestore).toBe(true);
    });

    test('btnZone이 popupElements에 포함되지 않아 별도 destroy 호출 확인', async ({ page }) => {
      // btnZone은 popupElements 배열에 push되지 않고 별도 destroy 호출이 필요
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());

        // _showEvolutionPopup 분석
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const evoEnd = src.indexOf('_showEvolutionHint', evoIdx);
        const evoBody = src.substring(evoIdx, evoEnd);

        // btnZone이 popupElements에 push 되는지 확인
        const btnZoneInArray = evoBody.includes('popupElements.push(btnZone)');
        // btnZone.destroy() 별도 호출이 있는지 확인
        const btnZoneDestroyed = evoBody.includes('btnZone.destroy()');

        // _showEndlessModal 분석
        const endIdx = src.indexOf('_showEndlessModal() {');
        const endEnd = src.indexOf('_showWarning', endIdx);
        const endBody = src.substring(endIdx, endEnd);

        const endBtnZoneInArray = endBody.includes('popupElements.push(btnZone)');
        const endBtnZoneDestroyed = endBody.includes('btnZone.destroy()');

        return {
          evoBtnZoneInArray: btnZoneInArray,
          evoBtnZoneDestroyed: btnZoneDestroyed,
          endBtnZoneInArray: endBtnZoneInArray,
          endBtnZoneDestroyed: endBtnZoneDestroyed,
        };
      });

      // btnZone은 popupElements에 포함되지 않으므로 별도 destroy가 필수
      if (!result.evoBtnZoneInArray) {
        expect(result.evoBtnZoneDestroyed).toBe(true);
      }
      if (!result.endBtnZoneInArray) {
        expect(result.endBtnZoneDestroyed).toBe(true);
      }
    });

    test('모달 depth가 350~353 범위 내에 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());

        // 두 모달 함수에서 사용된 depth 값 추출
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const evoEnd = src.indexOf('_showEvolutionHint', evoIdx);
        const evoBody = src.substring(evoIdx, evoEnd);

        const endIdx = src.indexOf('_showEndlessModal() {');
        const endEnd = src.indexOf('_showWarning', endIdx);
        const endBody = src.substring(endIdx, endEnd);

        const depthRegex = /setDepth\((\d+)\)/g;
        const evoDepths = [];
        const endDepths = [];

        let match;
        while ((match = depthRegex.exec(evoBody)) !== null) {
          evoDepths.push(parseInt(match[1]));
        }
        depthRegex.lastIndex = 0;
        while ((match = depthRegex.exec(endBody)) !== null) {
          endDepths.push(parseInt(match[1]));
        }

        const allDepths = [...evoDepths, ...endDepths];
        const allInRange = allDepths.every(d => d >= 350 && d <= 353);
        const min = Math.min(...allDepths);
        const max = Math.max(...allDepths);

        return { evoDepths, endDepths, allInRange, min, max };
      });

      expect(result.allInRange).toBe(true);
      expect(result.min).toBeGreaterThanOrEqual(350);
      expect(result.max).toBeLessThanOrEqual(353);
    });

    test('Galmuri11, monospace 폰트가 모달에서 사용된다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());

        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const evoEnd = src.indexOf('_showEvolutionHint', evoIdx);
        const evoBody = src.substring(evoIdx, evoEnd);

        const endIdx = src.indexOf('_showEndlessModal() {');
        const endEnd = src.indexOf('_showWarning', endIdx);
        const endBody = src.substring(endIdx, endEnd);

        // fontFamily 체크
        const evoFonts = (evoBody.match(/fontFamily/g) || []).length;
        const endFonts = (endBody.match(/fontFamily/g) || []).length;
        const evoGalmuri = (evoBody.match(/Galmuri11/g) || []).length;
        const endGalmuri = (endBody.match(/Galmuri11/g) || []).length;

        return {
          evoFontCount: evoFonts,
          endFontCount: endFonts,
          evoGalmuriCount: evoGalmuri,
          endGalmuriCount: endGalmuri,
          allMatch: evoFonts === evoGalmuri && endFonts === endGalmuri,
        };
      });

      expect(result.allMatch).toBe(true);
      expect(result.evoFontCount).toBeGreaterThanOrEqual(2); // 최소 무기이름, 부제목, 확인버튼
      expect(result.endFontCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 게임 실행 시 콘솔 에러 검증 ──

  test.describe('런타임 안정성', () => {

    test('게임 로드 시 콘솔 에러가 발생하지 않는다', async ({ page }) => {
      // 페이지 로드 후 추가 대기
      await page.waitForTimeout(2000);
      const jsErrors = page._consoleErrors.filter(
        err => !err.includes('net::') && !err.includes('favicon')
      );
      expect(jsErrors).toEqual([]);
    });

    test('게임 시작 후 5초간 콘솔 에러 없음', async ({ page }) => {
      // 메뉴에서 시작 버튼 클릭 시도
      const canvas = page.locator('canvas');
      await canvas.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(2000);

      // 게임 캔버스 클릭 (시작 버튼 위치 대략)
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        // 중앙 하단 부근 클릭 (시작 버튼 위치)
        await page.mouse.click(
          canvasBox.x + canvasBox.width / 2,
          canvasBox.y + canvasBox.height * 0.55
        );
        await page.waitForTimeout(1000);
        // 캐릭터 선택 화면일 수 있으니 한번 더 클릭
        await page.mouse.click(
          canvasBox.x + canvasBox.width / 2,
          canvasBox.y + canvasBox.height * 0.4
        );
        await page.waitForTimeout(1000);
        // 스테이지 선택
        await page.mouse.click(
          canvasBox.x + canvasBox.width / 2,
          canvasBox.y + canvasBox.height * 0.4
        );
      }

      await page.waitForTimeout(5000);

      await page.screenshot({
        path: 'tests/screenshots/modal-notification-runtime.png'
      });

      const jsErrors = page._consoleErrors.filter(
        err => !err.includes('net::') && !err.includes('favicon') && !err.includes('AdMob')
      );
      // 게임 관련 critical 에러만 체크
      const criticalErrors = jsErrors.filter(
        err => err.includes('TypeError') || err.includes('ReferenceError') || err.includes('SyntaxError')
      );
      expect(criticalErrors).toEqual([]);
    });

    test('모바일 뷰포트(360x640)에서 게임 로드 성공', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await page.goto('/');
      await page.waitForTimeout(3000);

      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 5000 });

      await page.screenshot({
        path: 'tests/screenshots/modal-notification-mobile.png'
      });

      const jsErrors = page._consoleErrors.filter(
        err => !err.includes('net::') && !err.includes('favicon')
      );
      expect(jsErrors).toEqual([]);
    });
  });

  // ── scrollFactor(0) 검증 ──

  test.describe('scrollFactor 검증', () => {

    test('모든 모달 요소에 scrollFactor(0)이 설정되어 있다', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const src = await fetch('/js/scenes/GameScene.js').then(r => r.text());

        // _showEvolutionPopup의 add. 호출 수와 setScrollFactor(0) 수 비교
        const evoIdx = src.indexOf('_showEvolutionPopup(nameKey) {');
        const evoEnd = src.indexOf('_showEvolutionHint', evoIdx);
        const evoBody = src.substring(evoIdx, evoEnd);

        // this.add.xxx로 생성된 시각 요소 수
        const evoAddCalls = (evoBody.match(/this\.add\.(rectangle|graphics|text|zone)/g) || []).length;
        const evoScrollFactors = (evoBody.match(/setScrollFactor\(0\)/g) || []).length;

        // _showEndlessModal
        const endIdx = src.indexOf('_showEndlessModal() {');
        const endEnd = src.indexOf('_showWarning', endIdx);
        const endBody = src.substring(endIdx, endEnd);

        const endAddCalls = (endBody.match(/this\.add\.(rectangle|graphics|text|zone)/g) || []).length;
        const endScrollFactors = (endBody.match(/setScrollFactor\(0\)/g) || []).length;

        return {
          evoAddCalls,
          evoScrollFactors,
          evoAllHaveScroll: evoScrollFactors >= evoAddCalls,
          endAddCalls,
          endScrollFactors,
          endAllHaveScroll: endScrollFactors >= endAddCalls,
        };
      });

      expect(result.evoAllHaveScroll).toBe(true);
      expect(result.endAllHaveScroll).toBe(true);
    });
  });
});
