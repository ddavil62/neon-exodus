/**
 * @fileoverview 햅틱(진동) 피드백을 관리한다. Capacitor 글로벌 브리지(window.Capacitor.Plugins)를
 * 통해 Haptics 플러그인에 접근하며, 번들러 없이도 네이티브 환경에서 동작한다.
 * 웹 환경이나 플러그인 미등록 시 자동으로 비활성화된다.
 */

// ── 상태 ──

/** @type {object|null} Capacitor Haptics 플러그인 인스턴스 */
let _haptics = null;

/** @type {boolean} 초기화 완료 여부 */
let _initialized = false;

/** @type {boolean} 햅틱 활성화 여부 (설정 메뉴에서 제어) */
let _enabled = true;

// ── 초기화 ──

/**
 * Haptics 플러그인을 초기화한다.
 * Capacitor 글로벌 브리지(window.Capacitor.Plugins.Haptics)를 통해 접근한다.
 * 네이티브 환경에서만 활성화되며, 웹에서는 자동으로 비활성화된다.
 * @returns {Promise<void>}
 */
export async function initHaptics() {
  if (_initialized) return;
  _initialized = true;

  try {
    if (!window.Capacitor?.isNativePlatform()) return;

    // Capacitor 글로벌 브리지에서 Haptics 참조 (번들러 없이 동작)
    const haptics = window.Capacitor?.Plugins?.Haptics;
    if (!haptics) {
      console.log('[Haptics] 플러그인이 Capacitor에 등록되지 않음 — 비활성화');
      return;
    }
    _haptics = haptics;
    console.log('[Haptics] 초기화 완료');
  } catch {
    // 플러그인 미설치 또는 로드 실패 — 진동 비활성화
    console.log('[Haptics] 플러그인 로드 실패 — 비활성화');
  }
}

// ── 진동 피드백 ──

/**
 * 짧은 충격 진동을 발생시킨다 (피격 등).
 * 플러그인이 비활성화 상태이면 아무 동작도 하지 않는다.
 */
export function impactHaptic() {
  if (!_haptics || !_enabled) return;
  _haptics.impact({ style: 'MEDIUM' }).catch(() => {});
}

/**
 * 햅틱 활성화 상태를 설정한다.
 * @param {boolean} enabled - 활성화 여부
 */
export function setHapticEnabled(enabled) {
  _enabled = enabled;
}

/**
 * 햅틱 활성화 여부를 반환한다.
 * @returns {boolean} 활성화 여부
 */
export function isHapticEnabled() {
  return _enabled;
}
