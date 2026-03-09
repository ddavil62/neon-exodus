/**
 * @fileoverview SVG 벡터 스프라이트 생성 스크립트.
 *
 * 20종 엔티티(플레이어, 잡몹 10종, 미니보스 2종, 보스 3종, XP 보석 3종, 투사체)의
 * SVG 문자열을 코드로 생성하고 sharp로 PNG로 변환하여 assets/sprites/에 저장한다.
 * ART_CONCEPT.md의 색상 팔레트와 글로우 필터 표준을 따른다.
 *
 * 실행: node scripts/generate-vector-sprites.js
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── 색상 팔레트 (ART_CONCEPT.md 기준) ──

const COLORS = {
  CYAN: '#00FFFF',
  CYAN_EDGE: '#006688',
  MAGENTA: '#FF00FF',
  MAGENTA_EDGE: '#660066',
  GREEN: '#39FF14',
  GREEN_EDGE: '#0A6600',
  ORANGE: '#FF6600',
  ORANGE_EDGE: '#663300',
  RED: '#FF3333',
  RED_EDGE: '#661414',
  YELLOW: '#FFDD00',
  WHITE: '#FFFFFF',
  SHADOW: '#222244',
};

// ── 유틸리티 ──

/**
 * 네온 글로우 SVG 필터를 생성한다.
 * @param {string} id - 필터 ID
 * @param {number} stdDev - 가우시안 블러 강도
 * @returns {string} SVG filter 요소 문자열
 */
function glowFilter(id, stdDev) {
  return `<filter id="${id}">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${stdDev}" result="blur"/>
    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
  </filter>`;
}

/**
 * SVG 래퍼를 생성한다.
 * @param {number} w - 너비
 * @param {number} h - 높이
 * @param {string} defs - <defs> 내 콘텐츠
 * @param {string} body - SVG 그리기 요소
 * @returns {string} 완전한 SVG 문자열
 */
function svgWrap(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${defs}</defs>
  ${body}
</svg>`;
}

/**
 * SVG 문자열을 PNG 파일로 변환하여 저장한다.
 * @param {string} svgStr - SVG 문자열
 * @param {string} outputPath - 출력 파일 경로
 * @param {number} width - 출력 PNG 너비
 * @param {number} height - 출력 PNG 높이
 */
async function svgToPng(svgStr, outputPath, width, height) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  await sharp(Buffer.from(svgStr))
    .resize(width, height)
    .png()
    .toFile(outputPath);
  console.log(`  생성: ${outputPath} (${width}x${height})`);
}

// ── 플레이어 SVG (48x48) ──

/**
 * 플레이어 SVG를 생성한다.
 * 둥근 헬멧 + 바이저 + 어깨 패드, 시안 글로우.
 * @returns {string} SVG 문자열
 */
function createPlayerSVG() {
  const w = 48, h = 48;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('player-glow', 2)}
    <radialGradient id="player-grad" cx="50%" cy="40%">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.9"/>
      <stop offset="40%" stop-color="${COLORS.CYAN}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.CYAN_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <!-- 글로우 레이어 -->
    <circle cx="${cx}" cy="${cy}" r="18" fill="${COLORS.CYAN}" opacity="0.25" filter="url(#player-glow)"/>
    <!-- 바디 (헬멧) -->
    <circle cx="${cx}" cy="${cy}" r="14" fill="url(#player-grad)" stroke="${COLORS.CYAN_EDGE}" stroke-width="1.5"/>
    <!-- 바이저 -->
    <rect x="${cx - 10}" y="${cy - 3}" width="20" height="6" rx="2" fill="${COLORS.WHITE}" opacity="0.85"/>
    <!-- 바이저 내부 글로우 -->
    <rect x="${cx - 8}" y="${cy - 1}" width="16" height="2" rx="1" fill="${COLORS.CYAN}" opacity="0.9"/>
    <!-- 어깨 패드 좌 -->
    <ellipse cx="${cx - 14}" cy="${cy + 6}" rx="6" ry="4" fill="${COLORS.CYAN_EDGE}" opacity="0.8"/>
    <ellipse cx="${cx - 14}" cy="${cy + 6}" rx="4" ry="2.5" fill="${COLORS.CYAN}" opacity="0.5"/>
    <!-- 어깨 패드 우 -->
    <ellipse cx="${cx + 14}" cy="${cy + 6}" rx="6" ry="4" fill="${COLORS.CYAN_EDGE}" opacity="0.8"/>
    <ellipse cx="${cx + 14}" cy="${cy + 6}" rx="4" ry="2.5" fill="${COLORS.CYAN}" opacity="0.5"/>
    <!-- 하이라이트 -->
    <circle cx="${cx - 4}" cy="${cy - 6}" r="3" fill="${COLORS.WHITE}" opacity="0.3"/>
  `;

  return svgWrap(w, h, defs, body);
}

// ── 투사체 SVG (12x12) ──

/**
 * 투사체 SVG를 생성한다.
 * 시안 에너지탄, 원형 코어 + 글로우.
 * @returns {string} SVG 문자열
 */
function createProjectileSVG() {
  const w = 12, h = 12;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('proj-glow', 2)}
    <radialGradient id="proj-grad">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="${COLORS.CYAN}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.CYAN_EDGE}" stop-opacity="0.6"/>
    </radialGradient>
  `;

  const body = `
    <circle cx="${cx}" cy="${cy}" r="5" fill="${COLORS.CYAN}" opacity="0.3" filter="url(#proj-glow)"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="url(#proj-grad)"/>
    <circle cx="${cx}" cy="${cy}" r="1.5" fill="${COLORS.WHITE}" opacity="0.8"/>
  `;

  return svgWrap(w, h, defs, body);
}

// ── 잡몹 SVG (10종) ──

/**
 * 나노 드론 SVG (32x32) — 삼각형 드론, 레드 코어, 2개 날개.
 * @returns {string}
 */
function createNanoDroneSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('nd-glow', 1.5)}
    <radialGradient id="nd-grad">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.7"/>
      <stop offset="50%" stop-color="${COLORS.RED}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <polygon points="${cx},${cy - 10} ${cx - 10},${cy + 8} ${cx + 10},${cy + 8}" fill="${COLORS.RED}" opacity="0.2" filter="url(#nd-glow)"/>
    <!-- 본체 삼각형 -->
    <polygon points="${cx},${cy - 8} ${cx - 8},${cy + 6} ${cx + 8},${cy + 6}" fill="url(#nd-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="1"/>
    <!-- 날개 좌 -->
    <line x1="${cx - 6}" y1="${cy}" x2="${cx - 14}" y2="${cy - 4}" stroke="${COLORS.RED}" stroke-width="1.5" opacity="0.7"/>
    <!-- 날개 우 -->
    <line x1="${cx + 6}" y1="${cy}" x2="${cx + 14}" y2="${cy - 4}" stroke="${COLORS.RED}" stroke-width="1.5" opacity="0.7"/>
    <!-- 코어 -->
    <circle cx="${cx}" cy="${cy + 1}" r="2" fill="${COLORS.WHITE}" opacity="0.9"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 정찰봇 SVG (32x32) — 원형 바디, 오렌지 센서 아이.
 * @returns {string}
 */
function createScoutBotSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('sb-glow', 1.5)}
    <radialGradient id="sb-grad">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.ORANGE_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <circle cx="${cx}" cy="${cy}" r="11" fill="${COLORS.ORANGE}" opacity="0.2" filter="url(#sb-glow)"/>
    <circle cx="${cx}" cy="${cy}" r="9" fill="url(#sb-grad)" stroke="${COLORS.ORANGE_EDGE}" stroke-width="1"/>
    <!-- 센서 아이 -->
    <circle cx="${cx}" cy="${cy - 1}" r="4" fill="${COLORS.SHADOW}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy - 1}" r="2.5" fill="${COLORS.ORANGE}" opacity="0.9"/>
    <circle cx="${cx + 1}" cy="${cy - 2}" r="1" fill="${COLORS.WHITE}" opacity="0.8"/>
    <!-- 안테나 -->
    <line x1="${cx}" y1="${cy - 9}" x2="${cx}" y2="${cy - 14}" stroke="${COLORS.ORANGE}" stroke-width="1" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy - 14}" r="1.5" fill="${COLORS.ORANGE}" opacity="0.6"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 스파크 드론 SVG (32x32) — 육각형, 옐로우 코어, 전기 아크선.
 * @returns {string}
 */
function createSparkDroneSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;
  const r = 10;

  // 육각형 꼭짓점
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    hex.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  const hexPoints = hex.join(' ');

  const defs = `
    ${glowFilter('sd-glow', 1.5)}
  `;

  const body = `
    <polygon points="${hexPoints}" fill="${COLORS.YELLOW}" opacity="0.2" filter="url(#sd-glow)"/>
    <polygon points="${hexPoints}" fill="${COLORS.YELLOW}" opacity="0.7" stroke="${COLORS.ORANGE_EDGE}" stroke-width="1"/>
    <!-- 전기 아크선 -->
    <polyline points="${cx - 8},${cy - 2} ${cx - 4},${cy + 2} ${cx},${cy - 3} ${cx + 4},${cy + 2} ${cx + 8},${cy - 2}" fill="none" stroke="${COLORS.WHITE}" stroke-width="1" opacity="0.7"/>
    <!-- 코어 -->
    <circle cx="${cx}" cy="${cy}" r="3" fill="${COLORS.WHITE}" opacity="0.85"/>
    <circle cx="${cx}" cy="${cy}" r="1.5" fill="${COLORS.YELLOW}" opacity="0.9"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 전투 로봇 SVG (48x48) — 사각형 바디, 레드 글로우 눈, 중장감.
 * @returns {string}
 */
function createBattleRobotSVG() {
  const w = 48, h = 48;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('br-glow', 2)}
    <linearGradient id="br-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.RED}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="1"/>
    </linearGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <rect x="${cx - 14}" y="${cy - 14}" width="28" height="28" rx="3" fill="${COLORS.RED}" opacity="0.2" filter="url(#br-glow)"/>
    <!-- 바디 -->
    <rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="2" fill="url(#br-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="1.5"/>
    <!-- 장갑 디테일 -->
    <rect x="${cx - 10}" y="${cy - 5}" width="20" height="2" fill="${COLORS.SHADOW}" opacity="0.5"/>
    <rect x="${cx - 10}" y="${cy + 3}" width="20" height="2" fill="${COLORS.SHADOW}" opacity="0.5"/>
    <!-- 눈 좌 -->
    <circle cx="${cx - 5}" cy="${cy - 5}" r="2.5" fill="${COLORS.RED}" opacity="0.9"/>
    <circle cx="${cx - 5}" cy="${cy - 5}" r="1" fill="${COLORS.WHITE}" opacity="0.85"/>
    <!-- 눈 우 -->
    <circle cx="${cx + 5}" cy="${cy - 5}" r="2.5" fill="${COLORS.RED}" opacity="0.9"/>
    <circle cx="${cx + 5}" cy="${cy - 5}" r="1" fill="${COLORS.WHITE}" opacity="0.85"/>
    <!-- 팔 좌 -->
    <rect x="${cx - 18}" y="${cy - 4}" width="5" height="12" rx="1" fill="${COLORS.RED_EDGE}" opacity="0.8"/>
    <!-- 팔 우 -->
    <rect x="${cx + 13}" y="${cy - 4}" width="5" height="12" rx="1" fill="${COLORS.RED_EDGE}" opacity="0.8"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 실드 드론 SVG (32x32) — 육각형 실드 패널, 시안-레드 이중 글로우.
 * @returns {string}
 */
function createShieldDroneSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;
  const r = 10;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    hex.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }

  const defs = `
    ${glowFilter('shd-glow', 1.5)}
  `;

  const body = `
    <!-- 시안 외곽 글로우 -->
    <polygon points="${hex.join(' ')}" fill="${COLORS.CYAN}" opacity="0.15" filter="url(#shd-glow)"/>
    <!-- 레드 코어 -->
    <polygon points="${hex.join(' ')}" fill="${COLORS.RED}" opacity="0.6" stroke="${COLORS.CYAN}" stroke-width="1.5"/>
    <!-- 실드 표시 -->
    <circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${COLORS.CYAN}" stroke-width="1.5" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="2" fill="${COLORS.CYAN}" opacity="0.8"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 돌격봇 SVG (40x40) — 쐐기형(삼각), 오렌지 부스터 글로우.
 * @returns {string}
 */
function createRushBotSVG() {
  const w = 40, h = 40;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('rb-glow', 2)}
    <linearGradient id="rb-grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.ORANGE_EDGE}" stop-opacity="0.8"/>
    </linearGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <polygon points="${cx + 14},${cy} ${cx - 10},${cy - 12} ${cx - 10},${cy + 12}" fill="${COLORS.ORANGE}" opacity="0.2" filter="url(#rb-glow)"/>
    <!-- 쐐기 바디 -->
    <polygon points="${cx + 12},${cy} ${cx - 8},${cy - 10} ${cx - 8},${cy + 10}" fill="url(#rb-grad)" stroke="${COLORS.ORANGE_EDGE}" stroke-width="1.5"/>
    <!-- 부스터 글로우 -->
    <ellipse cx="${cx - 10}" cy="${cy}" rx="3" ry="6" fill="${COLORS.ORANGE}" opacity="0.6"/>
    <ellipse cx="${cx - 11}" cy="${cy}" rx="2" ry="4" fill="${COLORS.YELLOW}" opacity="0.5"/>
    <!-- 전면 날카로운 부분 -->
    <circle cx="${cx + 10}" cy="${cy}" r="2" fill="${COLORS.WHITE}" opacity="0.7"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 수리봇 SVG (32x32) — 원형 + 십자 마크, 그린 힐링 글로우.
 * @returns {string}
 */
function createRepairBotSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('rpb-glow', 1.5)}
    <radialGradient id="rpb-grad">
      <stop offset="0%" stop-color="${COLORS.GREEN}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${COLORS.GREEN_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <circle cx="${cx}" cy="${cy}" r="12" fill="${COLORS.GREEN}" opacity="0.2" filter="url(#rpb-glow)"/>
    <circle cx="${cx}" cy="${cy}" r="9" fill="url(#rpb-grad)" stroke="${COLORS.GREEN_EDGE}" stroke-width="1"/>
    <!-- 십자 마크 -->
    <rect x="${cx - 1.5}" y="${cy - 6}" width="3" height="12" rx="0.5" fill="${COLORS.WHITE}" opacity="0.85"/>
    <rect x="${cx - 6}" y="${cy - 1.5}" width="12" height="3" rx="0.5" fill="${COLORS.WHITE}" opacity="0.85"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 중장갑 봇 SVG (48x48) — 넓은 직사각형, 오렌지-레드 듀얼 코어.
 * @returns {string}
 */
function createHeavyBotSVG() {
  const w = 48, h = 48;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('hb-glow', 2)}
    <linearGradient id="hb-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="1"/>
    </linearGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <rect x="${cx - 16}" y="${cy - 12}" width="32" height="24" rx="3" fill="${COLORS.ORANGE}" opacity="0.2" filter="url(#hb-glow)"/>
    <!-- 장갑 바디 -->
    <rect x="${cx - 14}" y="${cy - 10}" width="28" height="20" rx="2" fill="url(#hb-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="2"/>
    <!-- 장갑판 디테일 -->
    <rect x="${cx - 12}" y="${cy - 3}" width="24" height="1.5" fill="${COLORS.SHADOW}" opacity="0.5"/>
    <rect x="${cx - 12}" y="${cy + 3}" width="24" height="1.5" fill="${COLORS.SHADOW}" opacity="0.5"/>
    <!-- 듀얼 코어 좌 -->
    <circle cx="${cx - 5}" cy="${cy - 3}" r="3" fill="${COLORS.ORANGE}" opacity="0.9"/>
    <circle cx="${cx - 5}" cy="${cy - 3}" r="1.5" fill="${COLORS.WHITE}" opacity="0.7"/>
    <!-- 듀얼 코어 우 -->
    <circle cx="${cx + 5}" cy="${cy - 3}" r="3" fill="${COLORS.RED}" opacity="0.9"/>
    <circle cx="${cx + 5}" cy="${cy - 3}" r="1.5" fill="${COLORS.WHITE}" opacity="0.7"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 텔레포트 드론 SVG (32x32) — 다이아몬드, 마젠타 점멸 코어, 잔상.
 * @returns {string}
 */
function createTeleportDroneSVG() {
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('td-glow', 1.5)}
  `;

  const body = `
    <!-- 글로우 -->
    <polygon points="${cx},${cy - 12} ${cx + 12},${cy} ${cx},${cy + 12} ${cx - 12},${cy}" fill="${COLORS.MAGENTA}" opacity="0.2" filter="url(#td-glow)"/>
    <!-- 다이아몬드 바디 -->
    <polygon points="${cx},${cy - 10} ${cx + 10},${cy} ${cx},${cy + 10} ${cx - 10},${cy}" fill="${COLORS.MAGENTA}" opacity="0.7" stroke="${COLORS.MAGENTA_EDGE}" stroke-width="1"/>
    <!-- 잔상 효과선 -->
    <polygon points="${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="0.7" opacity="0.4" transform="translate(-2, 0)"/>
    <polygon points="${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="0.5" opacity="0.25" transform="translate(-4, 0)"/>
    <!-- 코어 -->
    <circle cx="${cx}" cy="${cy}" r="3" fill="${COLORS.WHITE}" opacity="0.85"/>
    <circle cx="${cx}" cy="${cy}" r="1.5" fill="${COLORS.MAGENTA}" opacity="0.9"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 자폭봇 SVG (40x40) — 구형 + 경고 삼각형, 레드-옐로우 맥동 코어.
 * @returns {string}
 */
function createSuicideBotSVG() {
  const w = 40, h = 40;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('sbb-glow', 2)}
    <radialGradient id="sbb-grad">
      <stop offset="0%" stop-color="${COLORS.YELLOW}" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="${COLORS.RED}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <circle cx="${cx}" cy="${cy}" r="14" fill="${COLORS.RED}" opacity="0.2" filter="url(#sbb-glow)"/>
    <!-- 구형 바디 -->
    <circle cx="${cx}" cy="${cy}" r="11" fill="url(#sbb-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="1.5"/>
    <!-- 경고 삼각형 -->
    <polygon points="${cx},${cy - 6} ${cx - 5},${cy + 3} ${cx + 5},${cy + 3}" fill="none" stroke="${COLORS.YELLOW}" stroke-width="1.5" opacity="0.9"/>
    <!-- 느낌표 -->
    <rect x="${cx - 0.8}" y="${cy - 4}" width="1.6" height="4" fill="${COLORS.YELLOW}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy + 2}" r="0.8" fill="${COLORS.YELLOW}" opacity="0.9"/>
  `;

  return svgWrap(w, h, defs, body);
}

// ── 미니보스 SVG (2종, 80x80) ──

/**
 * 가디언 드론 SVG (80x80) — 육각형, 회전 링 아머, 오렌지-레드 글로우.
 * @returns {string}
 */
function createGuardianDroneSVG() {
  const w = 80, h = 80;
  const cx = w / 2, cy = h / 2;
  const r = 26;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    hex.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }

  const defs = `
    ${glowFilter('gd-glow', 2.5)}
    <radialGradient id="gd-grad">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <!-- 외곽 글로우 -->
    <polygon points="${hex.join(' ')}" fill="${COLORS.ORANGE}" opacity="0.15" filter="url(#gd-glow)"/>
    <!-- 회전 링 아머 외곽 -->
    <circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${COLORS.ORANGE}" stroke-width="2" opacity="0.4" stroke-dasharray="8,4"/>
    <!-- 회전 링 아머 내곽 -->
    <circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="${COLORS.RED}" stroke-width="1.5" opacity="0.35" stroke-dasharray="5,3"/>
    <!-- 육각형 바디 -->
    <polygon points="${hex.join(' ')}" fill="url(#gd-grad)" stroke="${COLORS.ORANGE_EDGE}" stroke-width="2"/>
    <!-- 내부 육각형 디테일 -->
    <circle cx="${cx}" cy="${cy}" r="14" fill="${COLORS.RED}" opacity="0.3"/>
    <!-- 중앙 코어 -->
    <circle cx="${cx}" cy="${cy}" r="8" fill="${COLORS.ORANGE}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="${COLORS.WHITE}" opacity="0.7"/>
    <!-- 장갑 패널 표시 -->
    <line x1="${cx - 20}" y1="${cy}" x2="${cx - 10}" y2="${cy}" stroke="${COLORS.WHITE}" stroke-width="1" opacity="0.4"/>
    <line x1="${cx + 10}" y1="${cy}" x2="${cx + 20}" y2="${cy}" stroke="${COLORS.WHITE}" stroke-width="1" opacity="0.4"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 어썰트 메카 SVG (80x80) — 이족 메카, 어깨장갑, 미사일 포드.
 * @returns {string}
 */
function createAssaultMechSVG() {
  const w = 80, h = 80;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('am-glow', 2.5)}
    <linearGradient id="am-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="1"/>
    </linearGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <rect x="${cx - 22}" y="${cy - 20}" width="44" height="40" rx="5" fill="${COLORS.ORANGE}" opacity="0.15" filter="url(#am-glow)"/>
    <!-- 몸통 -->
    <rect x="${cx - 14}" y="${cy - 16}" width="28" height="28" rx="3" fill="url(#am-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="1.5"/>
    <!-- 머리 -->
    <rect x="${cx - 8}" y="${cy - 22}" width="16" height="10" rx="2" fill="${COLORS.ORANGE_EDGE}" stroke="${COLORS.ORANGE}" stroke-width="1"/>
    <!-- 눈 -->
    <rect x="${cx - 5}" y="${cy - 19}" width="10" height="3" rx="1" fill="${COLORS.RED}" opacity="0.9"/>
    <rect x="${cx - 3}" y="${cy - 18}" width="6" height="1" rx="0.5" fill="${COLORS.WHITE}" opacity="0.8"/>
    <!-- 어깨 장갑 좌 -->
    <rect x="${cx - 28}" y="${cy - 14}" width="12" height="18" rx="2" fill="${COLORS.RED_EDGE}" opacity="0.9"/>
    <rect x="${cx - 26}" y="${cy - 12}" width="8" height="5" rx="1" fill="${COLORS.ORANGE}" opacity="0.5"/>
    <!-- 어깨 장갑 우 -->
    <rect x="${cx + 16}" y="${cy - 14}" width="12" height="18" rx="2" fill="${COLORS.RED_EDGE}" opacity="0.9"/>
    <rect x="${cx + 18}" y="${cy - 12}" width="8" height="5" rx="1" fill="${COLORS.ORANGE}" opacity="0.5"/>
    <!-- 다리 좌 -->
    <rect x="${cx - 10}" y="${cy + 12}" width="6" height="14" rx="1" fill="${COLORS.ORANGE_EDGE}" opacity="0.8"/>
    <!-- 다리 우 -->
    <rect x="${cx + 4}" y="${cy + 12}" width="6" height="14" rx="1" fill="${COLORS.ORANGE_EDGE}" opacity="0.8"/>
    <!-- 미사일 포드 -->
    <circle cx="${cx - 22}" cy="${cy - 8}" r="2" fill="${COLORS.RED}" opacity="0.8"/>
    <circle cx="${cx + 22}" cy="${cy - 8}" r="2" fill="${COLORS.RED}" opacity="0.8"/>
  `;

  return svgWrap(w, h, defs, body);
}

// ── 보스 SVG (3종, 128x128) ──

/**
 * 커맨더 드론 SVG (128x128) — 모선 드론, 왕관 안테나, 마젠타 코어, 궤도 링.
 * @returns {string}
 */
function createCommanderDroneSVG() {
  const w = 128, h = 128;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('cd-glow', 3)}
    <radialGradient id="cd-grad">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="${COLORS.MAGENTA}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.MAGENTA_EDGE}" stop-opacity="0.8"/>
    </radialGradient>
  `;

  const body = `
    <!-- 삼중 글로우 -->
    <circle cx="${cx}" cy="${cy}" r="50" fill="${COLORS.MAGENTA}" opacity="0.08" filter="url(#cd-glow)"/>
    <circle cx="${cx}" cy="${cy}" r="40" fill="${COLORS.MAGENTA}" opacity="0.12"/>
    <!-- 궤도 링 -->
    <ellipse cx="${cx}" cy="${cy}" rx="45" ry="20" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="1.5" opacity="0.4" stroke-dasharray="6,3"/>
    <ellipse cx="${cx}" cy="${cy}" rx="38" ry="16" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="1" opacity="0.3" transform="rotate(30, ${cx}, ${cy})"/>
    <!-- 본체 -->
    <circle cx="${cx}" cy="${cy}" r="28" fill="url(#cd-grad)" stroke="${COLORS.MAGENTA_EDGE}" stroke-width="2"/>
    <!-- 내부 링 디테일 -->
    <circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${COLORS.WHITE}" stroke-width="0.8" opacity="0.3"/>
    <!-- 왕관 안테나 -->
    <line x1="${cx - 8}" y1="${cy - 28}" x2="${cx - 12}" y2="${cy - 40}" stroke="${COLORS.MAGENTA}" stroke-width="1.5" opacity="0.7"/>
    <line x1="${cx}" y1="${cy - 28}" x2="${cx}" y2="${cy - 42}" stroke="${COLORS.MAGENTA}" stroke-width="2" opacity="0.8"/>
    <line x1="${cx + 8}" y1="${cy - 28}" x2="${cx + 12}" y2="${cy - 40}" stroke="${COLORS.MAGENTA}" stroke-width="1.5" opacity="0.7"/>
    <circle cx="${cx - 12}" cy="${cy - 40}" r="2" fill="${COLORS.MAGENTA}" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy - 42}" r="2.5" fill="${COLORS.WHITE}" opacity="0.8"/>
    <circle cx="${cx + 12}" cy="${cy - 40}" r="2" fill="${COLORS.MAGENTA}" opacity="0.7"/>
    <!-- 중앙 코어 -->
    <circle cx="${cx}" cy="${cy}" r="10" fill="${COLORS.MAGENTA}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="${COLORS.WHITE}" opacity="0.8"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 시즈 타이탄 SVG (128x128) — 시즈 워커, 캐터필러, 포 팔, 오렌지-옐로우 포구.
 * @returns {string}
 */
function createSiegeTitanSVG() {
  const w = 128, h = 128;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('st-glow', 3)}
    <linearGradient id="st-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.ORANGE}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${COLORS.RED_EDGE}" stop-opacity="1"/>
    </linearGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <rect x="${cx - 35}" y="${cy - 30}" width="70" height="60" rx="5" fill="${COLORS.ORANGE}" opacity="0.1" filter="url(#st-glow)"/>
    <!-- 캐터필러 좌 -->
    <rect x="${cx - 40}" y="${cy + 10}" width="16" height="30" rx="3" fill="${COLORS.ORANGE_EDGE}" opacity="0.9"/>
    <rect x="${cx - 38}" y="${cy + 12}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <rect x="${cx - 38}" y="${cy + 19}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <rect x="${cx - 38}" y="${cy + 26}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <!-- 캐터필러 우 -->
    <rect x="${cx + 24}" y="${cy + 10}" width="16" height="30" rx="3" fill="${COLORS.ORANGE_EDGE}" opacity="0.9"/>
    <rect x="${cx + 26}" y="${cy + 12}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <rect x="${cx + 26}" y="${cy + 19}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <rect x="${cx + 26}" y="${cy + 26}" width="12" height="5" rx="1" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <!-- 메인 바디 -->
    <rect x="${cx - 25}" y="${cy - 15}" width="50" height="35" rx="4" fill="url(#st-grad)" stroke="${COLORS.RED_EDGE}" stroke-width="2"/>
    <!-- 포탑 -->
    <rect x="${cx - 12}" y="${cy - 30}" width="24" height="20" rx="3" fill="${COLORS.ORANGE_EDGE}" stroke="${COLORS.ORANGE}" stroke-width="1.5"/>
    <!-- 포 -->
    <rect x="${cx - 3}" y="${cy - 45}" width="6" height="18" rx="1" fill="${COLORS.ORANGE}" opacity="0.9"/>
    <!-- 포구 글로우 -->
    <circle cx="${cx}" cy="${cy - 45}" r="4" fill="${COLORS.YELLOW}" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy - 45}" r="2" fill="${COLORS.WHITE}" opacity="0.8"/>
    <!-- 장갑 디테일 -->
    <rect x="${cx - 22}" y="${cy - 5}" width="44" height="2" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <rect x="${cx - 22}" y="${cy + 5}" width="44" height="2" fill="${COLORS.SHADOW}" opacity="0.4"/>
    <!-- 눈 -->
    <rect x="${cx - 7}" y="${cy - 26}" width="14" height="4" rx="1" fill="${COLORS.RED}" opacity="0.9"/>
    <rect x="${cx - 4}" y="${cy - 25}" width="8" height="2" rx="0.5" fill="${COLORS.WHITE}" opacity="0.7"/>
  `;

  return svgWrap(w, h, defs, body);
}

/**
 * 코어 프로세서 SVG (128x128) — AI 크리스탈, 궤도 링 3중, 마젠타-화이트 맥동.
 * @returns {string}
 */
function createCoreProcessorSVG() {
  const w = 128, h = 128;
  const cx = w / 2, cy = h / 2;

  const defs = `
    ${glowFilter('cp-glow', 3)}
    <radialGradient id="cp-grad">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="${COLORS.MAGENTA}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${COLORS.MAGENTA_EDGE}" stop-opacity="0.7"/>
    </radialGradient>
  `;

  const body = `
    <!-- 삼중 글로우 -->
    <circle cx="${cx}" cy="${cy}" r="55" fill="${COLORS.MAGENTA}" opacity="0.06" filter="url(#cp-glow)"/>
    <circle cx="${cx}" cy="${cy}" r="45" fill="${COLORS.MAGENTA}" opacity="0.1"/>
    <circle cx="${cx}" cy="${cy}" r="35" fill="${COLORS.MAGENTA}" opacity="0.12"/>
    <!-- 궤도 링 3중 -->
    <ellipse cx="${cx}" cy="${cy}" rx="50" ry="18" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="1.5" opacity="0.4" stroke-dasharray="8,4"/>
    <ellipse cx="${cx}" cy="${cy}" rx="42" ry="22" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="1" opacity="0.35" transform="rotate(60, ${cx}, ${cy})" stroke-dasharray="6,3"/>
    <ellipse cx="${cx}" cy="${cy}" rx="46" ry="15" fill="none" stroke="${COLORS.MAGENTA}" stroke-width="1" opacity="0.3" transform="rotate(-60, ${cx}, ${cy})" stroke-dasharray="5,4"/>
    <!-- 크리스탈 바디 (다이아몬드) -->
    <polygon points="${cx},${cy - 30} ${cx + 22},${cy} ${cx},${cy + 30} ${cx - 22},${cy}" fill="url(#cp-grad)" stroke="${COLORS.MAGENTA_EDGE}" stroke-width="2"/>
    <!-- 내부 크리스탈 면 -->
    <polygon points="${cx},${cy - 20} ${cx + 14},${cy} ${cx},${cy + 20} ${cx - 14},${cy}" fill="${COLORS.MAGENTA}" opacity="0.3"/>
    <!-- 에너지 노드 4개 -->
    <circle cx="${cx}" cy="${cy - 30}" r="3" fill="${COLORS.WHITE}" opacity="0.7"/>
    <circle cx="${cx + 22}" cy="${cy}" r="3" fill="${COLORS.WHITE}" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy + 30}" r="3" fill="${COLORS.WHITE}" opacity="0.7"/>
    <circle cx="${cx - 22}" cy="${cy}" r="3" fill="${COLORS.WHITE}" opacity="0.7"/>
    <!-- 중앙 코어 -->
    <circle cx="${cx}" cy="${cy}" r="10" fill="${COLORS.MAGENTA}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="${COLORS.WHITE}" opacity="0.9"/>
    <!-- 에너지 필드 연결선 -->
    <line x1="${cx}" y1="${cy - 30}" x2="${cx + 22}" y2="${cy}" stroke="${COLORS.MAGENTA}" stroke-width="0.8" opacity="0.3"/>
    <line x1="${cx + 22}" y1="${cy}" x2="${cx}" y2="${cy + 30}" stroke="${COLORS.MAGENTA}" stroke-width="0.8" opacity="0.3"/>
    <line x1="${cx}" y1="${cy + 30}" x2="${cx - 22}" y2="${cy}" stroke="${COLORS.MAGENTA}" stroke-width="0.8" opacity="0.3"/>
    <line x1="${cx - 22}" y1="${cy}" x2="${cx}" y2="${cy - 30}" stroke="${COLORS.MAGENTA}" stroke-width="0.8" opacity="0.3"/>
  `;

  return svgWrap(w, h, defs, body);
}

// ── XP 보석 SVG (3종) ──

/**
 * XP 보석 SVG를 생성한다.
 * @param {'small'|'medium'|'large'} size - 보석 크기
 * @returns {{ svg: string, px: number }} SVG 문자열과 크기
 */
function createGemSVG(size) {
  const sizeMap = { small: 12, medium: 20, large: 28 };
  const stdDevMap = { small: 1, medium: 1.5, large: 2 };
  const px = sizeMap[size];
  const half = px / 2;
  const stdDev = stdDevMap[size];

  // 크기별 색상 강도 조절: 소=시안, 중=시안-그린, 대=그린
  const colorMap = {
    small: { core: COLORS.CYAN, edge: COLORS.CYAN_EDGE },
    medium: { core: '#1AFF8A', edge: '#0A6644' },  // 시안-그린 중간
    large: { core: COLORS.GREEN, edge: COLORS.GREEN_EDGE },
  };
  const color = colorMap[size];

  const filterId = `gem-${size}-glow`;

  const defs = `
    ${glowFilter(filterId, stdDev)}
    <radialGradient id="gem-${size}-grad">
      <stop offset="0%" stop-color="${COLORS.WHITE}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="${color.core}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color.edge}" stop-opacity="0.7"/>
    </radialGradient>
  `;

  const body = `
    <!-- 글로우 -->
    <polygon points="${half},${1} ${px - 1},${half} ${half},${px - 1} ${1},${half}" fill="${color.core}" opacity="0.25" filter="url(#${filterId})"/>
    <!-- 다이아몬드 바디 -->
    <polygon points="${half},${2} ${px - 2},${half} ${half},${px - 2} ${2},${half}" fill="url(#gem-${size}-grad)" stroke="${color.edge}" stroke-width="0.8"/>
    <!-- 하이라이트 -->
    <polygon points="${half},${half * 0.4} ${half + half * 0.3},${half} ${half},${half * 0.8} ${half - half * 0.3},${half}" fill="${COLORS.WHITE}" opacity="0.3"/>
  `;

  return { svg: svgWrap(px, px, defs, body), px };
}

// ── 메인 실행 ──

/**
 * 모든 SVG 에셋을 생성하고 PNG로 변환한다.
 */
async function main() {
  console.log('=== NEON EXODUS 벡터 스프라이트 생성 시작 ===\n');

  const spritesDir = join(ROOT, 'assets', 'sprites');

  // ── 플레이어 ──
  console.log('[플레이어]');
  await svgToPng(createPlayerSVG(), join(spritesDir, 'player.png'), 48, 48);

  // ── 투사체 ──
  console.log('\n[투사체]');
  await svgToPng(createProjectileSVG(), join(spritesDir, 'projectile.png'), 12, 12);

  // ── 잡몹 10종 ──
  console.log('\n[잡몹]');
  const enemyDir = join(spritesDir, 'enemies');

  const enemies = [
    { name: 'nano_drone',     fn: createNanoDroneSVG,     w: 32, h: 32 },
    { name: 'scout_bot',      fn: createScoutBotSVG,      w: 32, h: 32 },
    { name: 'spark_drone',    fn: createSparkDroneSVG,     w: 32, h: 32 },
    { name: 'battle_robot',   fn: createBattleRobotSVG,    w: 48, h: 48 },
    { name: 'shield_drone',   fn: createShieldDroneSVG,    w: 32, h: 32 },
    { name: 'rush_bot',       fn: createRushBotSVG,        w: 40, h: 40 },
    { name: 'repair_bot',     fn: createRepairBotSVG,      w: 32, h: 32 },
    { name: 'heavy_bot',      fn: createHeavyBotSVG,       w: 48, h: 48 },
    { name: 'teleport_drone', fn: createTeleportDroneSVG,  w: 32, h: 32 },
    { name: 'suicide_bot',    fn: createSuicideBotSVG,     w: 40, h: 40 },
  ];

  for (const e of enemies) {
    await svgToPng(e.fn(), join(enemyDir, `${e.name}.png`), e.w, e.h);
  }

  // ── 미니보스 2종 ──
  console.log('\n[미니보스]');
  const bossDir = join(spritesDir, 'bosses');
  await svgToPng(createGuardianDroneSVG(), join(bossDir, 'guardian_drone.png'), 80, 80);
  await svgToPng(createAssaultMechSVG(), join(bossDir, 'assault_mech.png'), 80, 80);

  // ── 보스 3종 ──
  console.log('\n[보스]');
  await svgToPng(createCommanderDroneSVG(), join(bossDir, 'commander_drone.png'), 128, 128);
  await svgToPng(createSiegeTitanSVG(), join(bossDir, 'siege_titan.png'), 128, 128);
  await svgToPng(createCoreProcessorSVG(), join(bossDir, 'core_processor.png'), 128, 128);

  // ── XP 보석 3종 ──
  console.log('\n[XP 보석]');
  const itemsDir = join(spritesDir, 'items');
  for (const size of ['small', 'medium', 'large']) {
    const { svg, px } = createGemSVG(size);
    const sizeChar = size[0]; // s, m, l
    await svgToPng(svg, join(itemsDir, `xp_gem_${sizeChar}.png`), px, px);
  }

  console.log('\n=== 벡터 스프라이트 생성 완료 (20종) ===');
}

main().catch((err) => {
  console.error('스프라이트 생성 실패:', err);
  process.exit(1);
});
