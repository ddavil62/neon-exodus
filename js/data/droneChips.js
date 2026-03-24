/**
 * @fileoverview 드론 칩 데이터 정의.
 * 드론 행동 양식을 교체하는 8종 칩과 C/B/A/S 4등급 체계를 정의한다.
 * 분해/합성/변환 경제 테이블과 유틸 함수를 제공한다.
 */

// ── 등급 체계 ──

/**
 * 칩 등급별 색상, 분해 가루, 합성 비용, 변환 비용 테이블.
 * @type {Object.<string, {color: string, colorHex: number, dustOnDismantle: number, synthesizeCost: number|null, synthesizeInputCount: number, convertCost: number}>}
 */
export const CHIP_GRADES = {
  C: {
    color: '#AAAAAA',
    colorHex: 0xAAAAAA,
    dustOnDismantle: 1,
    synthesizeCost: null,      // C등급은 합성 불가 (하위 등급 없음)
    synthesizeInputCount: 0,
    convertCost: 2,
  },
  B: {
    color: '#00FFFF',
    colorHex: 0x00FFFF,
    dustOnDismantle: 3,
    synthesizeCost: 5,         // C등급 3개 + 5 가루 → B등급 1개
    synthesizeInputCount: 3,
    convertCost: 6,
  },
  A: {
    color: '#FF00FF',
    colorHex: 0xFF00FF,
    dustOnDismantle: 8,
    synthesizeCost: 15,        // B등급 3개 + 15 가루 → A등급 1개
    synthesizeInputCount: 3,
    convertCost: 16,
  },
  S: {
    color: '#FFD700',
    colorHex: 0xFFD700,
    dustOnDismantle: 20,
    synthesizeCost: null,      // S등급은 합성 불가 (최상위 등급)
    synthesizeInputCount: 0,
    convertCost: 30,
  },
};

/** 등급 순서 (합성 시 다음 등급 참조용) */
export const GRADE_ORDER = ['C', 'B', 'A', 'S'];

/**
 * 현재 등급의 다음 등급을 반환한다.
 * @param {string} grade - 현재 등급
 * @returns {string|null} 다음 등급 (S이면 null)
 */
export function getNextGrade(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx < 0 || idx >= GRADE_ORDER.length - 1) return null;
  return GRADE_ORDER[idx + 1];
}

// ── 칩 8종 정의 ──

/**
 * 드론 칩 전체 정의.
 * @type {Array<{id: string, type: string, nameKey: string, descKey: string, icon: string, gradeValues: Object}>}
 */
export const CHIP_DEFINITIONS = [
  // 공격 계열
  {
    id: 'pierce',
    type: 'attack',
    nameKey: 'chip.pierce.name',
    descKey: 'chip.pierce.desc',
    icon: '\u27D0',  // ⟐
    gradeValues: {
      C: { pierceCount: 2 },
      B: { pierceCount: 3 },
      A: { pierceCount: 4 },
      S: { pierceCount: 5 },
    },
  },
  {
    id: 'multishot',
    type: 'attack',
    nameKey: 'chip.multishot.name',
    descKey: 'chip.multishot.desc',
    icon: '\u2726',  // ✦
    gradeValues: {
      C: { shotCount: 2 },
      B: { shotCount: 3 },
      A: { shotCount: 4 },
      S: { shotCount: 5 },
    },
  },
  {
    id: 'laser',
    type: 'attack',
    nameKey: 'chip.laser.name',
    descKey: 'chip.laser.desc',
    icon: '\u2550',  // ═
    gradeValues: {
      C: { dps: 15 },
      B: { dps: 25 },
      A: { dps: 40 },
      S: { dps: 60 },
    },
  },
  {
    id: 'kamikaze',
    type: 'attack',
    nameKey: 'chip.kamikaze.name',
    descKey: 'chip.kamikaze.desc',
    icon: '\uD83D\uDCA5',  // 💥
    gradeValues: {
      C: { explosionRadius: 60 },
      B: { explosionRadius: 80 },
      A: { explosionRadius: 100 },
      S: { explosionRadius: 130 },
    },
  },

  // 유틸 계열
  {
    id: 'xp_magnet',
    type: 'utility',
    nameKey: 'chip.xpMagnet.name',
    descKey: 'chip.xpMagnet.desc',
    icon: '\u25CE',  // ◎
    gradeValues: {
      C: { magnetRadius: 150 },
      B: { magnetRadius: 220 },
      A: { magnetRadius: 300 },
      S: { magnetRadius: 400 },
    },
  },
  {
    id: 'taunt',
    type: 'utility',
    nameKey: 'chip.taunt.name',
    descKey: 'chip.taunt.desc',
    icon: '\uD83D\uDEE1\uFE0F',  // 🛡️
    gradeValues: {
      C: { tauntRadius: 80 },
      B: { tauntRadius: 120 },
      A: { tauntRadius: 160 },
      S: { tauntRadius: 200 },
    },
  },
  {
    id: 'repair',
    type: 'utility',
    nameKey: 'chip.repair.name',
    descKey: 'chip.repair.desc',
    icon: '\u2665',  // ♥
    gradeValues: {
      C: { healAmount: 2 },
      B: { healAmount: 4 },
      A: { healAmount: 7 },
      S: { healAmount: 12 },
    },
  },
  {
    id: 'radar',
    type: 'utility',
    nameKey: 'chip.radar.name',
    descKey: 'chip.radar.desc',
    icon: '\u25C9',  // ◉
    gradeValues: {
      C: { rangeMultiplier: 1.3 },
      B: { rangeMultiplier: 1.6 },
      A: { rangeMultiplier: 2.0 },
      S: { rangeMultiplier: 2.5 },
    },
  },
];

// ── 조회 함수 ──

/** @type {Object.<string, Object>} 칩 ID → 데이터 맵 (캐시) */
const CHIP_MAP = {};
CHIP_DEFINITIONS.forEach((c) => { CHIP_MAP[c.id] = c; });

/**
 * 칩 ID로 칩 정의를 조회한다.
 * @param {string} chipId - 칩 ID
 * @returns {Object|undefined}
 */
export function getChipDef(chipId) {
  return CHIP_MAP[chipId];
}

/**
 * 등급 정보를 조회한다.
 * @param {string} grade - 등급 문자열 ('C'|'B'|'A'|'S')
 * @returns {Object|undefined}
 */
export function getGradeInfo(grade) {
  return CHIP_GRADES[grade];
}

/**
 * 특정 칩의 특정 등급에서의 수치를 반환한다.
 * @param {string} chipId - 칩 ID
 * @param {string} grade - 등급
 * @returns {Object|null}
 */
export function getChipGradeValues(chipId, grade) {
  const def = getChipDef(chipId);
  if (!def || !def.gradeValues[grade]) return null;
  return def.gradeValues[grade];
}
