/**
 * @fileoverview Phase 4 에셋 생성 스크립트 — 무기 이펙트 SVG 스프라이트 10종.
 *
 * 모든 에셋은 SVG 직접 생성 → sharp → PNG 변환 (GPT Image API 불필요).
 * 이펙트 스프라이트는 소형이고 기하학적이므로 SVG가 적합하다.
 *
 * 실행: node scripts/generate-phase4-assets.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';

// ── 경로 설정 ──

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── 에셋 정의 (Phase 4 — 이펙트 스프라이트 10종) ──

/**
 * Phase 4 이펙트 에셋 목록.
 * 모두 SVG 직접 생성 방식.
 * @type {Array<{key: string, outputPath: string, finalW: number, finalH: number, svgFn: string}>}
 */
const PHASE4_ASSETS = [
  { key: 'effect_projectile',    outputPath: 'sprites/effects/projectile.png',    finalW: 16, finalH: 16, svgFn: 'projectile' },
  { key: 'effect_plasma_orb',   outputPath: 'sprites/effects/plasma_orb.png',   finalW: 24, finalH: 24, svgFn: 'plasma_orb' },
  { key: 'effect_missile',      outputPath: 'sprites/effects/missile.png',      finalW: 20, finalH: 20, svgFn: 'missile' },
  { key: 'effect_explosion',    outputPath: 'sprites/effects/explosion.png',    finalW: 64, finalH: 64, svgFn: 'explosion' },
  { key: 'effect_drone',        outputPath: 'sprites/effects/drone.png',        finalW: 24, finalH: 24, svgFn: 'drone' },
  { key: 'effect_emp_ring',     outputPath: 'sprites/effects/emp_ring.png',     finalW: 64, finalH: 64, svgFn: 'emp_ring' },
  { key: 'effect_force_slash',  outputPath: 'sprites/effects/force_slash.png',  finalW: 48, finalH: 48, svgFn: 'force_slash' },
  { key: 'effect_nano_cloud',   outputPath: 'sprites/effects/nano_cloud.png',   finalW: 48, finalH: 48, svgFn: 'nano_cloud' },
  { key: 'effect_vortex',       outputPath: 'sprites/effects/vortex.png',       finalW: 48, finalH: 48, svgFn: 'vortex' },
  { key: 'effect_reaper_blade', outputPath: 'sprites/effects/reaper_blade.png', finalW: 32, finalH: 32, svgFn: 'reaper_blade' },
];

// ── SVG 생성 함수 ──

/**
 * 이펙트 SVG를 생성한다.
 * @param {string} effectId - 이펙트 ID
 * @param {number} w - 너비
 * @param {number} h - 높이
 * @returns {string} SVG 문자열
 */
function createEffectSVG(effectId, w, h) {
  const glowFilter = `<defs><filter id="g"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  switch (effectId) {
    // 1. 시안 에너지 탄환 (16x16) — 블래스터
    case 'projectile':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="8" cy="8" r="5" fill="#00FFFF" opacity="0.9"/>
    <circle cx="8" cy="8" r="3" fill="#FFFFFF" opacity="0.8"/>
    <circle cx="8" cy="8" r="6" fill="none" stroke="#00FFFF" stroke-width="0.5" opacity="0.4"/>
  </g>
</svg>`;

    // 2. 마젠타 오브 + 궤도 링 (24x24) — 플라즈마 오브
    case 'plasma_orb':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="12" cy="12" r="6" fill="#FF00FF" opacity="0.8"/>
    <circle cx="12" cy="12" r="4" fill="#FF88FF" opacity="0.6"/>
    <circle cx="12" cy="12" r="2" fill="#FFFFFF" opacity="0.7"/>
    <ellipse cx="12" cy="12" rx="10" ry="5" fill="none" stroke="#FF00FF" stroke-width="1" opacity="0.5" transform="rotate(30 12 12)"/>
    <ellipse cx="12" cy="12" rx="10" ry="5" fill="none" stroke="#FF00FF" stroke-width="0.8" opacity="0.3" transform="rotate(-30 12 12)"/>
  </g>
</svg>`;

    // 3. 오렌지 로켓 미사일 (20x20) — 미사일
    case 'missile':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="17,10 12,6 4,8 4,12 12,14" fill="#FF6600" opacity="0.9"/>
    <polygon points="4,8.5 1,10 4,11.5" fill="#FF3300" opacity="0.8"/>
    <circle cx="2" cy="10" r="1.5" fill="#FFDD00" opacity="0.7"/>
    <rect x="12" y="8.5" width="3" height="3" rx="0.5" fill="#FFFFFF" opacity="0.5"/>
    <!-- 날개 -->
    <polygon points="8,6 6,3 6,6" fill="#FF8844" opacity="0.7"/>
    <polygon points="8,14 6,17 6,14" fill="#FF8844" opacity="0.7"/>
  </g>
</svg>`;

    // 4. 오렌지-옐로우 폭발 링 (64x64) — 폭발
    case 'explosion':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="g2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="explFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="#FFDD00" stop-opacity="0.7"/>
      <stop offset="70%" stop-color="#FF6600" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#FF3300" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#g2)">
    <circle cx="32" cy="32" r="28" fill="url(#explFill)"/>
    <circle cx="32" cy="32" r="22" fill="none" stroke="#FFDD00" stroke-width="2" opacity="0.6"/>
    <circle cx="32" cy="32" r="14" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.4"/>
    <!-- 파편 라인 -->
    <line x1="32" y1="4" x2="32" y2="12" stroke="#FFDD00" stroke-width="1.5" opacity="0.5"/>
    <line x1="32" y1="52" x2="32" y2="60" stroke="#FFDD00" stroke-width="1.5" opacity="0.5"/>
    <line x1="4" y1="32" x2="12" y2="32" stroke="#FFDD00" stroke-width="1.5" opacity="0.5"/>
    <line x1="52" y1="32" x2="60" y2="32" stroke="#FFDD00" stroke-width="1.5" opacity="0.5"/>
  </g>
</svg>`;

    // 5. 골드 미니 드론 (24x24) — 드론
    case 'drone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 본체 (십자 암) -->
    <rect x="10" y="4" width="4" height="16" rx="1" fill="#FFCC33" opacity="0.7"/>
    <rect x="4" y="10" width="16" height="4" rx="1" fill="#FFCC33" opacity="0.7"/>
    <!-- 프로펠러 4개 -->
    <circle cx="6" cy="6" r="3.5" fill="none" stroke="#FFCC33" stroke-width="1.2" opacity="0.6"/>
    <circle cx="18" cy="6" r="3.5" fill="none" stroke="#FFCC33" stroke-width="1.2" opacity="0.6"/>
    <circle cx="6" cy="18" r="3.5" fill="none" stroke="#FFCC33" stroke-width="1.2" opacity="0.6"/>
    <circle cx="18" cy="18" r="3.5" fill="none" stroke="#FFCC33" stroke-width="1.2" opacity="0.6"/>
    <!-- 중심 코어 -->
    <circle cx="12" cy="12" r="2.5" fill="#FFCC33" opacity="0.9"/>
    <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" opacity="0.6"/>
  </g>
</svg>`;

    // 6. 블루 EMP 파동 링 (64x64) — EMP
    case 'emp_ring':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="g3"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g filter="url(#g3)">
    <circle cx="32" cy="32" r="28" fill="none" stroke="#4488FF" stroke-width="3" opacity="0.8"/>
    <circle cx="32" cy="32" r="22" fill="none" stroke="#4488FF" stroke-width="2" opacity="0.5"/>
    <circle cx="32" cy="32" r="16" fill="none" stroke="#88BBFF" stroke-width="1.5" opacity="0.3"/>
    <circle cx="32" cy="32" r="8" fill="#4488FF" opacity="0.15"/>
    <!-- 전기 스파크 8방향 -->
    <line x1="32" y1="2" x2="32" y2="8" stroke="#88BBFF" stroke-width="1" opacity="0.6"/>
    <line x1="32" y1="56" x2="32" y2="62" stroke="#88BBFF" stroke-width="1" opacity="0.6"/>
    <line x1="2" y1="32" x2="8" y2="32" stroke="#88BBFF" stroke-width="1" opacity="0.6"/>
    <line x1="56" y1="32" x2="62" y2="32" stroke="#88BBFF" stroke-width="1" opacity="0.6"/>
    <line x1="10" y1="10" x2="14" y2="14" stroke="#88BBFF" stroke-width="1" opacity="0.4"/>
    <line x1="50" y1="10" x2="54" y2="14" stroke="#88BBFF" stroke-width="1" opacity="0.4"/>
    <line x1="10" y1="50" x2="14" y2="54" stroke="#88BBFF" stroke-width="1" opacity="0.4"/>
    <line x1="50" y1="50" x2="54" y2="54" stroke="#88BBFF" stroke-width="1" opacity="0.4"/>
  </g>
</svg>`;

    // 7. 시안 호(arc) 슬래시 (48x48) — Force Blade
    case 'force_slash':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="g4"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g filter="url(#g4)">
    <!-- 호 슬래시 (우측으로 향하는 반원 아크) -->
    <path d="M 8 8 Q 40 12 40 24 Q 40 36 8 40" fill="none" stroke="#00FFFF" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
    <path d="M 10 12 Q 36 16 36 24 Q 36 32 10 36" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <!-- 글로우 외곽 -->
    <path d="M 6 6 Q 44 10 44 24 Q 44 38 6 42" fill="none" stroke="#00FFFF" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
    <!-- 파티클 점 -->
    <circle cx="38" cy="14" r="1.5" fill="#FFFFFF" opacity="0.7"/>
    <circle cx="40" cy="24" r="1.5" fill="#FFFFFF" opacity="0.7"/>
    <circle cx="38" cy="34" r="1.5" fill="#FFFFFF" opacity="0.7"/>
  </g>
</svg>`;

    // 8. 그린 나노 구름 (48x48) — Nano Swarm
    case 'nano_cloud':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="g5"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="cloudFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#39FF14" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#39FF14" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#39FF14" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#g5)">
    <circle cx="24" cy="24" r="20" fill="url(#cloudFill)"/>
    <!-- 구름 덩어리 -->
    <circle cx="18" cy="20" r="8" fill="#39FF14" opacity="0.25"/>
    <circle cx="28" cy="18" r="7" fill="#39FF14" opacity="0.2"/>
    <circle cx="22" cy="28" r="9" fill="#39FF14" opacity="0.2"/>
    <circle cx="30" cy="26" r="6" fill="#39FF14" opacity="0.15"/>
    <!-- 나노 입자 점 -->
    <circle cx="14" cy="16" r="1" fill="#BBFFAA" opacity="0.8"/>
    <circle cx="30" cy="14" r="1" fill="#BBFFAA" opacity="0.7"/>
    <circle cx="16" cy="30" r="1" fill="#BBFFAA" opacity="0.6"/>
    <circle cx="32" cy="28" r="1" fill="#BBFFAA" opacity="0.7"/>
    <circle cx="24" cy="22" r="1.5" fill="#FFFFFF" opacity="0.5"/>
  </g>
</svg>`;

    // 9. 마젠타-시안 나선 소용돌이 (48x48) — Vortex Cannon
    case 'vortex':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="g6"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g filter="url(#g6)">
    <!-- 나선 링 (바깥 → 안쪽) -->
    <circle cx="24" cy="24" r="20" fill="none" stroke="#FF00FF" stroke-width="2" opacity="0.4"/>
    <circle cx="24" cy="24" r="15" fill="none" stroke="#00FFFF" stroke-width="2" opacity="0.5"/>
    <circle cx="24" cy="24" r="10" fill="none" stroke="#FF00FF" stroke-width="2" opacity="0.6"/>
    <circle cx="24" cy="24" r="5" fill="none" stroke="#00FFFF" stroke-width="2" opacity="0.7"/>
    <!-- 나선 암 -->
    <path d="M 24 4 Q 44 12 40 24 Q 36 36 24 36" fill="none" stroke="#FF00FF" stroke-width="1.5" opacity="0.5"/>
    <path d="M 24 44 Q 4 36 8 24 Q 12 12 24 12" fill="none" stroke="#00FFFF" stroke-width="1.5" opacity="0.5"/>
    <!-- 중심 코어 -->
    <circle cx="24" cy="24" r="3" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="24" cy="24" r="1.5" fill="#FF00FF" opacity="0.9"/>
  </g>
</svg>`;

    // 10. 레드 초승달 낫 (32x32) — Reaper Field
    case 'reaper_blade':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 초승달 낫 형태 -->
    <path d="M 8 28 Q 4 16 16 6 Q 28 -2 28 12 Q 20 8 14 16 Q 10 22 12 28 Z" fill="#FF3333" opacity="0.9"/>
    <path d="M 10 26 Q 8 18 16 10 Q 24 2 26 12 Q 20 10 16 16 Q 12 22 12 26 Z" fill="#FF6666" opacity="0.5"/>
    <!-- 날 하이라이트 -->
    <path d="M 8 28 Q 4 16 16 6" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.4"/>
    <!-- 자루 -->
    <line x1="12" y1="28" x2="18" y2="30" stroke="#FF3333" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <!-- 영혼 불꽃 -->
    <circle cx="22" cy="8" r="2" fill="#FF0000" opacity="0.6"/>
    <circle cx="22" cy="8" r="1" fill="#FFDD00" opacity="0.5"/>
  </g>
</svg>`;

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w/2}" cy="${h/2}" r="${w/2 - 2}" fill="#888888"/></svg>`;
  }
}

// ── SVG → PNG 생성 함수 ──

/**
 * SVG 문자열로 PNG를 직접 생성하여 파일로 저장한다.
 * @param {Object} asset - 에셋 정의 객체
 * @returns {Promise<boolean>} 생성 성공 여부
 */
async function generateEffectSprite(asset) {
  console.log(`  [${asset.key}] SVG 직접 생성 중... (${asset.finalW}x${asset.finalH})`);

  const svgString = createEffectSVG(asset.svgFn, asset.finalW, asset.finalH);
  const svgBuffer = Buffer.from(svgString);

  // 출력 디렉토리 생성
  const outputFullPath = path.join(ROOT, 'assets', asset.outputPath);
  const dir = path.dirname(outputFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // SVG -> PNG 변환
  await sharp(svgBuffer)
    .png()
    .toFile(outputFullPath);

  console.log(`  [${asset.key}] SVG->PNG 저장 완료: ${asset.outputPath} (${asset.finalW}x${asset.finalH})`);
  return true;
}

// ── 메인 실행 ──

/**
 * 모든 Phase 4 이펙트 에셋을 순차적으로 생성한다.
 * GPT API 불필요 — 모두 SVG 직접 생성.
 */
async function main() {
  console.log('=== NEON EXODUS Phase 4 이펙트 에셋 생성 시작 ===');
  console.log(`에셋 ${PHASE4_ASSETS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedAssets = [];

  for (const asset of PHASE4_ASSETS) {
    try {
      const ok = await generateEffectSprite(asset);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedAssets.push(asset.key);
      console.error(`  [${asset.key}] 생성 실패: ${err.message}`);
    }
  }

  // 결과 요약 로그
  console.log('\n=== Phase 4 이펙트 에셋 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${PHASE4_ASSETS.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Phase 4 에셋 생성 치명 오류:', err);
  process.exit(1);
});
