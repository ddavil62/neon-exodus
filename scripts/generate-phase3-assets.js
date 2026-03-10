/**
 * @fileoverview Phase 3 에셋 생성 스크립트 — 스테이지 배경 타일 + 보스 + 무기 아이콘.
 *
 * GPT Image API(gpt-image-1)와 SVG 직접 생성을 사용하여 Phase 3 에셋 10종을 생성한다.
 * - GPT Image API: 배경 타일 3종 (S2/S3/S4), 보스 3종 (6종)
 * - SVG 직접 생성: 무기 아이콘 4종
 *
 * Phase 2(generate-phase2-assets.js)와 동일한 파이프라인 패턴을 따른다.
 *
 * 실행: node scripts/generate-phase3-assets.js
 * 필요: 루트 .env 파일에 OPENAI_API_KEY 설정
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';
import OpenAI from 'openai';

// ── 경로 설정 ──

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 루트 .env에서 API 키 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 프롬프트 ──

const STYLE_PROMPT = 'Clean vector art game sprite, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single character centered, no text, no UI elements, vibrant neon glow effects';

// ── 에셋 정의 (Phase 3 — 10종) ──

/**
 * Phase 3 에셋 목록.
 * svgOverride: true인 에셋은 SVG 직접 생성, false인 에셋은 GPT Image API 사용.
 * @type {Array<{key: string, outputPath: string, finalW: number, finalH: number, prompt: string, svgOverride?: boolean, svgFn?: string}>}
 */
const PHASE3_ASSETS = [
  // ── 배경 타일 3종 (128x128, seamless) — 배경 제거 스킵 ──

  {
    key: 'bg_tile_s2',
    outputPath: 'backgrounds/bg_tile_s2.png',
    finalW: 128,
    finalH: 128,
    prompt: 'seamless cyberpunk industrial zone metal floor tile, 128x128, dark brownish-orange background #1A0800, rusted metal panels with orange (#FF6600) neon grid lines at 20% opacity, corroded rivets and pipe marks, oil stains, industrial factory floor look, clean vector art, top-down orthographic view, transparent background, no text',
  },
  {
    key: 'bg_tile_s3',
    outputPath: 'backgrounds/bg_tile_s3.png',
    finalW: 128,
    finalH: 128,
    prompt: 'seamless cyberpunk server room floor tile, 128x128, very dark indigo background #050510, circuit board trace patterns with purple (#8800FF) neon lines, data flow indicators, small LED dots at intersections, server rack grid overlay, clean vector art, top-down orthographic view, transparent background, no text',
  },
  {
    key: 'bg_tile_s4',
    outputPath: 'backgrounds/bg_tile_s4.png',
    finalW: 128,
    finalH: 128,
    prompt: 'seamless cyberpunk energy core floor tile, 128x128, pure black background #000000, pulsing energy grid lines in green (#00FF44) neon, hexagonal energy cells, power conduit patterns, digital matrix rain overlay at low opacity, clean vector art, top-down orthographic view, transparent background, no text',
  },

  // ── 보스 3종 (128x128, 투명 배경) — removeBackground 폴백 적용 ──

  {
    key: 'enemy_siege_titan_mk2',
    outputPath: 'sprites/bosses/siege_titan_mk2.png',
    finalW: 128,
    finalH: 128,
    prompt: `Massive reinforced siege titan mk2 boss, heavy upgraded armor plating, giant dual cannons on shoulders, orange (#FF6600) and red (#FF3333) glowing power vents, caterpillar treads, thick front ram shield, intimidating war machine, cyberpunk mech design. ${STYLE_PROMPT}`,
  },
  {
    key: 'enemy_data_phantom',
    outputPath: 'sprites/bosses/data_phantom.png',
    finalW: 128,
    finalH: 128,
    prompt: `Ghostly data phantom boss, semi-transparent spectral body, digital glitch distortion effects, purple (#8800FF) afterimage trails, holographic fragmented form, floating data fragments orbiting, cyberpunk digital ghost entity design. ${STYLE_PROMPT}`,
  },
  {
    key: 'enemy_omega_core',
    outputPath: 'sprites/bosses/omega_core.png',
    finalW: 128,
    finalH: 128,
    prompt: `Supreme omega core final boss, massive crystalline energy core, three layers of orbital defense rings rotating at different speeds, green (#00FF44) and white pulsating power core, eight energy nodes at cardinal and ordinal points, transcendent AI singularity entity design, ultimate cyberpunk boss. ${STYLE_PROMPT}`,
  },

  // ── 무기 아이콘 4종 (32x32, SVG 직접 생성) ──

  { key: 'icon_weapon_force_blade',    outputPath: 'ui/icons/weapon_force_blade.png',    finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_force_blade' },
  { key: 'icon_weapon_nano_swarm',     outputPath: 'ui/icons/weapon_nano_swarm.png',     finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_nano_swarm' },
  { key: 'icon_weapon_vortex_cannon',  outputPath: 'ui/icons/weapon_vortex_cannon.png',  finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_vortex_cannon' },
  { key: 'icon_weapon_reaper_field',   outputPath: 'ui/icons/weapon_reaper_field.png',   finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_reaper_field' },
];

// ── SVG 생성 함수 ──

/**
 * Phase 3 무기 아이콘 SVG를 생성한다. 무기별 단순 기하학 디자인.
 * @param {string} weaponId - 무기 ID (force_blade, nano_swarm, vortex_cannon, reaper_field)
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createWeaponIconSVG(weaponId, size = 32) {
  const half = size / 2;
  const glowFilter = `<defs><filter id="g"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  switch (weaponId) {
    case 'force_blade':
      // 에너지 검 실루엣: 시안 글로우 블레이드, 대각선 검 형태, 검날에 에너지 광선
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 검날 (대각선) -->
    <line x1="6" y1="26" x2="26" y2="4" stroke="#00FFFF" stroke-width="3" stroke-linecap="round" opacity="0.95"/>
    <!-- 검날 에너지 광선 -->
    <line x1="8" y1="24" x2="24" y2="6" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/>
    <!-- 가드 -->
    <line x1="10" y1="18" x2="18" y2="22" stroke="#00FFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <!-- 검끝 글로우 -->
    <circle cx="26" cy="4" r="2.5" fill="#00FFFF" opacity="0.7"/>
    <circle cx="26" cy="4" r="1" fill="#FFFFFF" opacity="0.9"/>
    <!-- 손잡이 -->
    <line x1="4" y1="28" x2="8" y2="24" stroke="#00AAAA" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  </g>
</svg>`;

    case 'nano_swarm':
      // 나노봇 구름: 그린 작은 원 여러 개가 클러스터, 중심 큰 원 + 주변 작은 원 5-6개
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 중심 코어 -->
    <circle cx="${half}" cy="${half}" r="4" fill="#39FF14" opacity="0.9"/>
    <circle cx="${half}" cy="${half}" r="2" fill="#FFFFFF" opacity="0.5"/>
    <!-- 주변 나노봇 6개 -->
    <circle cx="10" cy="10" r="2.5" fill="#39FF14" opacity="0.7"/>
    <circle cx="22" cy="8" r="2" fill="#39FF14" opacity="0.65"/>
    <circle cx="24" cy="20" r="2.5" fill="#39FF14" opacity="0.7"/>
    <circle cx="20" cy="26" r="2" fill="#39FF14" opacity="0.6"/>
    <circle cx="8" cy="24" r="2.5" fill="#39FF14" opacity="0.65"/>
    <circle cx="6" cy="16" r="2" fill="#39FF14" opacity="0.7"/>
    <!-- 연결선 (점선) -->
    <line x1="10" y1="10" x2="16" y2="16" stroke="#39FF14" stroke-width="0.5" opacity="0.4" stroke-dasharray="1 1"/>
    <line x1="22" y1="8" x2="16" y2="16" stroke="#39FF14" stroke-width="0.5" opacity="0.4" stroke-dasharray="1 1"/>
    <line x1="24" y1="20" x2="16" y2="16" stroke="#39FF14" stroke-width="0.5" opacity="0.4" stroke-dasharray="1 1"/>
    <line x1="8" y1="24" x2="16" y2="16" stroke="#39FF14" stroke-width="0.5" opacity="0.4" stroke-dasharray="1 1"/>
  </g>
</svg>`;

    case 'vortex_cannon':
      // 소용돌이 나선: 마젠타와 시안 이중 나선, 중심에서 바깥으로 회전
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 중심점 -->
    <circle cx="${half}" cy="${half}" r="2.5" fill="#FFFFFF" opacity="0.9"/>
    <!-- 마젠타 나선 아크 -->
    <path d="M16 16 Q20 10 26 12" fill="none" stroke="#FF00FF" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <path d="M16 16 Q12 22 6 20" fill="none" stroke="#FF00FF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <!-- 시안 나선 아크 -->
    <path d="M16 16 Q22 22 20 28" fill="none" stroke="#00FFFF" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    <path d="M16 16 Q10 10 12 4" fill="none" stroke="#00FFFF" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
    <!-- 외곽 글로우 링 -->
    <circle cx="${half}" cy="${half}" r="13" fill="none" stroke="#FF00FF" stroke-width="0.8" opacity="0.3"/>
    <circle cx="${half}" cy="${half}" r="11" fill="none" stroke="#00FFFF" stroke-width="0.8" opacity="0.25"/>
  </g>
</svg>`;

    case 'reaper_field':
      // 에너지 낫 3개가 120도 간격 배치, 퍼플 코어
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 퍼플 코어 -->
    <circle cx="${half}" cy="${half}" r="3.5" fill="#8800FF" opacity="0.85"/>
    <circle cx="${half}" cy="${half}" r="1.5" fill="#FFFFFF" opacity="0.5"/>
    <!-- 낫 1 (상단, 0도) -->
    <path d="M16 12 Q22 6 24 10 Q20 8 16 12" fill="#FF3333" opacity="0.85"/>
    <path d="M16 12 Q10 6 8 10 Q12 8 16 12" fill="#FF3333" opacity="0.6"/>
    <!-- 낫 2 (좌하단, 120도) -->
    <path d="M11 20 Q6 26 10 27 Q7 24 11 20" fill="#FF3333" opacity="0.85"/>
    <path d="M11 20 Q8 14 12 13 Q9 16 11 20" fill="#FF3333" opacity="0.6"/>
    <!-- 낫 3 (우하단, 240도) -->
    <path d="M21 20 Q26 26 22 27 Q25 24 21 20" fill="#FF3333" opacity="0.85"/>
    <path d="M21 20 Q24 14 20 13 Q23 16 21 20" fill="#FF3333" opacity="0.6"/>
    <!-- 회전 궤적 -->
    <circle cx="${half}" cy="${half}" r="10" fill="none" stroke="#FF3333" stroke-width="0.5" opacity="0.3" stroke-dasharray="2 2"/>
  </g>
</svg>`;

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half - 2}" fill="#888888"/></svg>`;
  }
}

/**
 * svgFn 키에 대응하는 SVG 문자열을 반환한다.
 * @param {string} svgFn - SVG 함수 식별자
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function getSVGString(svgFn, size) {
  // 무기 아이콘 (weapon_ 접두어 제거)
  if (svgFn.startsWith('weapon_')) return createWeaponIconSVG(svgFn.slice(7), size);

  // 알 수 없는 svgFn
  const half = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half - 2}" fill="#888888"/></svg>`;
}

// ── SVG 에셋 생성 함수 ──

/**
 * SVG 문자열로 PNG를 직접 생성하여 파일로 저장한다.
 * @param {Object} asset - 에셋 정의 객체 (svgOverride: true)
 * @returns {Promise<boolean>} 생성 성공 여부
 */
async function generateSVGSprite(asset) {
  console.log(`  [${asset.key}] SVG 직접 생성 중... (${asset.finalW}x${asset.finalH})`);

  const svgString = getSVGString(asset.svgFn, asset.finalW);
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

// ── 유틸리티 함수 ──

/**
 * 지정 ms만큼 대기한다.
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 어두운 픽셀(밝기 임계값 이하)을 투명화한다.
 * gpt-image-1 API에서 투명 배경이 제대로 적용되지 않는 경우의 폴백 처리.
 * @param {Buffer} inputBuffer - 입력 PNG 버퍼
 * @param {number} [threshold=40] - 밝기 임계값 (0~255)
 * @returns {Promise<Buffer>} 투명화 처리된 PNG 버퍼
 */
async function removeBackground(inputBuffer, threshold = 40) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const brightness = (r + g + b) / 3;
    if (brightness <= threshold) {
      pixels[i + 3] = 0;
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * 이미지에 실질적인 투명 배경이 적용되었는지 확인한다.
 * @param {Buffer} imgBuffer - PNG 이미지 버퍼
 * @returns {Promise<boolean>} 투명 배경 존재 여부
 */
async function hasTransparentBackground(imgBuffer) {
  const { data } = await sharp(imgBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let transparentCount = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) {
      transparentCount++;
    }
  }

  return (transparentCount / totalPixels) >= 0.10;
}

// ── GPT Image API 에셋 생성 함수 ──

/**
 * GPT Image API로 단일 에셋을 생성하고 PNG 파일로 저장한다.
 * bg_tile 계열은 투명 배경 제거를 하지 않고, 보스는 투명 배경 폴백 적용.
 * @param {Object} asset - 에셋 정의 객체
 * @returns {Promise<boolean>} 생성 성공 여부
 */
async function generateGPTSprite(asset) {
  console.log(`  [${asset.key}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: asset.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
  });

  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  // bg_tile 계열은 배경 제거 불필요 (seamless 타일이므로 채워져 있어야 함)
  if (!asset.key.startsWith('bg_tile')) {
    const isTransparent = await hasTransparentBackground(imgBuffer);
    if (!isTransparent) {
      console.log(`  [${asset.key}] 투명 배경 미감지, 폴백 투명화 적용...`);
      imgBuffer = await removeBackground(imgBuffer);
    }
  }

  // 출력 디렉토리 생성
  const outputFullPath = path.join(ROOT, 'assets', asset.outputPath);
  const dir = path.dirname(outputFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // sharp로 목표 크기로 리사이즈
  await sharp(imgBuffer)
    .resize(asset.finalW, asset.finalH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFullPath);

  console.log(`  [${asset.key}] 저장 완료: ${asset.outputPath} (${asset.finalW}x${asset.finalH})`);
  return true;
}

// ── 메인 실행 ──

/**
 * 모든 Phase 3 에셋을 순차적으로 생성한다.
 * SVG 에셋은 즉시 생성, GPT API 에셋은 호출 간 1초 대기.
 * 개별 실패 시 스킵하고 기존 PNG를 보존한다.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS Phase 3 에셋 생성 시작 ===');
  console.log(`에셋 ${PHASE3_ASSETS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedAssets = [];

  for (let i = 0; i < PHASE3_ASSETS.length; i++) {
    const asset = PHASE3_ASSETS[i];

    try {
      const ok = asset.svgOverride
        ? await generateSVGSprite(asset)
        : await generateGPTSprite(asset);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedAssets.push(asset.key);
      console.error(`  [${asset.key}] 생성 실패 (기존 PNG 보존): ${err.message}`);
    }

    // Rate limit 대응: GPT API 호출 에셋만 대기 (SVG 직접 생성은 대기 불필요)
    if (!asset.svgOverride && i < PHASE3_ASSETS.length - 1) {
      await sleep(1000);
    }
  }

  // 결과 요약 로그
  console.log('\n=== Phase 3 에셋 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${PHASE3_ASSETS.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Phase 3 에셋 생성 치명 오류:', err);
  process.exit(1);
});
