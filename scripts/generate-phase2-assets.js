/**
 * @fileoverview Phase 2 에셋 생성 스크립트 — UI + 배경 + 소모품 아이콘.
 *
 * GPT Image API(gpt-image-1)와 SVG 직접 생성을 사용하여 Phase 2 에셋 31종을 생성한다.
 * - GPT Image API: bg_tile, 소모품 6종, menu_bg (8종)
 * - SVG 직접 생성: joystick 2종, 무기 아이콘 7종, 패시브 아이콘 10종, 업그레이드 아이콘 4종 (23종)
 *
 * Phase 1(generate-vector-sprites.js)과 동일한 파이프라인 패턴을 따른다.
 *
 * 실행: node scripts/generate-phase2-assets.js
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

// ── 에셋 정의 (Phase 2 — 31종) ──

/**
 * Phase 2 에셋 목록.
 * svgOverride: true인 에셋은 SVG 직접 생성, false인 에셋은 GPT Image API 사용.
 * @type {Array<{key: string, outputPath: string, finalW: number, finalH: number, prompt: string, svgOverride?: boolean, svgFn?: string}>}
 */
const PHASE2_ASSETS = [
  // ── Group A: GPT Image API 에셋 ──

  // 배경 타일 (128x128, seamless 패턴)
  {
    key: 'bg_tile',
    outputPath: 'backgrounds/bg_tile.png',
    finalW: 128,
    finalH: 128,
    prompt: 'seamless cyberpunk metal floor tile, 128x128, dark navy background #0A0A1A, grid lines with subtle cyan neon glow at 15% opacity, small metallic rivets at corners and center, faint hexagonal etch marks, clean vector art, top-down orthographic view, transparent background, no text',
  },

  // 소모품 6종 (48x48)
  {
    key: 'consumable_nano_repair',
    outputPath: 'sprites/items/nano_repair.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, neon green medical cross glowing #39FF14, nano-bot particles orbiting, cyberpunk tech style, transparent background, clean vector, no text',
  },
  {
    key: 'consumable_mag_pulse',
    outputPath: 'sprites/items/magnetic_pulse.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, cyan electromagnetic pulse rings #00FFFF, circular wave pattern emanating outward, magnet field lines, transparent background, clean vector, no text',
  },
  {
    key: 'consumable_emp_bomb',
    outputPath: 'sprites/items/emp_bomb.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, blue EMP explosion burst #4488FF, electric discharge rays, circular shock wave rings, cyberpunk weapon, transparent background, clean vector, no text',
  },
  {
    key: 'consumable_credit_chip',
    outputPath: 'sprites/items/credit_chip.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, golden hexagonal credit chip #FFDD00, circuit traces on surface, cryptocurrency symbol, cyberpunk token, transparent background, clean vector, no text',
  },
  {
    key: 'consumable_overclock',
    outputPath: 'sprites/items/overclock.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, orange lightning bolt through gear #FF6600, speed lines, overclocking symbol, cyberpunk tech, transparent background, clean vector, no text',
  },
  {
    key: 'consumable_shield_battery',
    outputPath: 'sprites/items/shield_battery.png',
    finalW: 48,
    finalH: 48,
    prompt: '48x48 sci-fi icon, purple hexagonal energy shield with battery bars #AA44FF, glowing force field, protection symbol, cyberpunk, transparent background, clean vector, no text',
  },

  // ── Group B: GPT Image API 에셋 ──

  // 메뉴 배경 (360x640)
  {
    key: 'menu_bg',
    outputPath: 'backgrounds/menu_bg.png',
    finalW: 360,
    finalH: 640,
    prompt: 'cyberpunk city skyline silhouette at night, portrait 360x640, dark background #060612, neon signs in cyan and magenta, futuristic skyscrapers with holographic billboards, atmospheric fog with neon glow, bottom 30% very dark for UI overlay, clean vector illustration, no text, no characters',
  },

  // ── Group A: SVG 직접 생성 에셋 ──

  // 조이스틱 베이스 (128x128)
  {
    key: 'joystick_base',
    outputPath: 'ui/joystick/base.png',
    finalW: 128,
    finalH: 128,
    prompt: '',
    svgOverride: true,
    svgFn: 'joystickBase',
  },

  // 조이스틱 엄지 (64x64)
  {
    key: 'joystick_thumb',
    outputPath: 'ui/joystick/thumb.png',
    finalW: 64,
    finalH: 64,
    prompt: '',
    svgOverride: true,
    svgFn: 'joystickThumb',
  },

  // ── Group B: SVG 직접 생성 — 무기 아이콘 7종 ──
  { key: 'icon_weapon_blaster',       outputPath: 'ui/icons/weapon_blaster.png',       finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_blaster' },
  { key: 'icon_weapon_laser_gun',     outputPath: 'ui/icons/weapon_laser_gun.png',     finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_laser_gun' },
  { key: 'icon_weapon_plasma_orb',    outputPath: 'ui/icons/weapon_plasma_orb.png',    finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_plasma_orb' },
  { key: 'icon_weapon_electric_chain',outputPath: 'ui/icons/weapon_electric_chain.png',finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_electric_chain' },
  { key: 'icon_weapon_missile',       outputPath: 'ui/icons/weapon_missile.png',       finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_missile' },
  { key: 'icon_weapon_drone',         outputPath: 'ui/icons/weapon_drone.png',         finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_drone' },
  { key: 'icon_weapon_emp_blast',     outputPath: 'ui/icons/weapon_emp_blast.png',     finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'weapon_emp_blast' },

  // ── Group B: SVG 직접 생성 — 패시브 아이콘 10종 ──
  { key: 'icon_passive_booster',       outputPath: 'ui/icons/passive_booster.png',       finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_booster' },
  { key: 'icon_passive_armor_plate',   outputPath: 'ui/icons/passive_armor_plate.png',   finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_armor_plate' },
  { key: 'icon_passive_battery_pack',  outputPath: 'ui/icons/passive_battery_pack.png',  finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_battery_pack' },
  { key: 'icon_passive_overclock',     outputPath: 'ui/icons/passive_overclock.png',     finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_overclock' },
  { key: 'icon_passive_magnet_module', outputPath: 'ui/icons/passive_magnet_module.png', finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_magnet_module' },
  { key: 'icon_passive_regen_module',  outputPath: 'ui/icons/passive_regen_module.png',  finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_regen_module' },
  { key: 'icon_passive_aim_module',    outputPath: 'ui/icons/passive_aim_module.png',    finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_aim_module' },
  { key: 'icon_passive_critical_chip', outputPath: 'ui/icons/passive_critical_chip.png', finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_critical_chip' },
  { key: 'icon_passive_cooldown_chip', outputPath: 'ui/icons/passive_cooldown_chip.png', finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_cooldown_chip' },
  { key: 'icon_passive_luck_module',   outputPath: 'ui/icons/passive_luck_module.png',   finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'passive_luck_module' },

  // ── Group B: SVG 직접 생성 — 업그레이드 아이콘 4종 ──
  { key: 'icon_upgrade_basic',      outputPath: 'ui/icons/upgrade_basic.png',      finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'upgrade_basic' },
  { key: 'icon_upgrade_growth',     outputPath: 'ui/icons/upgrade_growth.png',     finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'upgrade_growth' },
  { key: 'icon_upgrade_special',    outputPath: 'ui/icons/upgrade_special.png',    finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'upgrade_special' },
  { key: 'icon_upgrade_limitBreak', outputPath: 'ui/icons/upgrade_limitBreak.png', finalW: 32, finalH: 32, prompt: '', svgOverride: true, svgFn: 'upgrade_limitBreak' },
];

// ── SVG 생성 함수 ──

/**
 * 조이스틱 베이스 SVG를 생성한다.
 * 외곽 글로우 링 + 동심원 2개 + 4방향 틱 마커 구조.
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createJoystickBaseSVG(size = 128) {
  const half = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="baseFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00FFFF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#00FFFF" stop-opacity="0.12"/>
    </radialGradient>
  </defs>
  <!-- 외곽 글로우 링 -->
  <circle cx="${half}" cy="${half}" r="${half - 2}" fill="url(#baseFill)"
    stroke="#00FFFF" stroke-width="2" stroke-opacity="0.6" filter="url(#glow)"/>
  <!-- 동심원 1 (65%) -->
  <circle cx="${half}" cy="${half}" r="${half * 0.65}" fill="none"
    stroke="#00FFFF" stroke-width="1" stroke-opacity="0.35"/>
  <!-- 동심원 2 (35%) -->
  <circle cx="${half}" cy="${half}" r="${half * 0.35}" fill="none"
    stroke="#00FFFF" stroke-width="1" stroke-opacity="0.25"/>
  <!-- 4방향 틱 마커 -->
  <line x1="${half}" y1="6" x2="${half}" y2="16" stroke="#00FFFF" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="${half}" y1="${size - 6}" x2="${half}" y2="${size - 16}" stroke="#00FFFF" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="6" y1="${half}" x2="16" y2="${half}" stroke="#00FFFF" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="${size - 6}" y1="${half}" x2="${size - 16}" y2="${half}" stroke="#00FFFF" stroke-width="1.5" stroke-opacity="0.5"/>
</svg>`;
}

/**
 * 조이스틱 엄지 SVG를 생성한다.
 * 원형 코어 + 글로우 필터 + 하이라이트 점 구조.
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createJoystickThumbSVG(size = 64) {
  const half = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="thumbFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#00FFFF" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#006688" stop-opacity="0.8"/>
    </radialGradient>
  </defs>
  <circle cx="${half}" cy="${half}" r="${half - 4}" fill="url(#thumbFill)" filter="url(#glow)"/>
  <!-- 좌상단 하이라이트 -->
  <circle cx="${half * 0.65}" cy="${half * 0.65}" r="${half * 0.15}" fill="#FFFFFF" opacity="0.35"/>
</svg>`;
}

/**
 * 무기 아이콘 SVG를 생성한다. 무기별 단순 기하학 디자인.
 * @param {string} weaponId - 무기 ID
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createWeaponIconSVG(weaponId, size = 32) {
  const half = size / 2;
  const glowFilter = `<defs><filter id="g"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  switch (weaponId) {
    case 'blaster':
      // 총 측면 실루엣 + 에너지탄
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <rect x="4" y="12" width="18" height="8" rx="2" fill="#00FFFF" opacity="0.9"/>
    <rect x="8" y="10" width="4" height="4" rx="1" fill="#00FFFF" opacity="0.7"/>
    <circle cx="27" cy="16" r="3" fill="#FFFFFF" opacity="0.9"/>
  </g>
</svg>`;

    case 'laser_gun':
      // 총구 + 직선 레이저빔
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <rect x="3" y="12" width="12" height="8" rx="2" fill="#00FFFF" opacity="0.8"/>
    <line x1="15" y1="16" x2="30" y2="16" stroke="#00FFFF" stroke-width="2" opacity="0.95"/>
    <circle cx="30" cy="16" r="1.5" fill="#FFFFFF"/>
  </g>
</svg>`;

    case 'plasma_orb':
      // 중심원 + 2개 궤도 타원 링
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="6" fill="#FF00FF" opacity="0.9"/>
    <ellipse cx="${half}" cy="${half}" rx="12" ry="6" fill="none" stroke="#FF00FF" stroke-width="1" opacity="0.6" transform="rotate(30 ${half} ${half})"/>
    <ellipse cx="${half}" cy="${half}" rx="12" ry="6" fill="none" stroke="#FF00FF" stroke-width="1" opacity="0.5" transform="rotate(-30 ${half} ${half})"/>
  </g>
</svg>`;

    case 'electric_chain':
      // 지그재그 번개 체인 3단
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polyline points="6,6 14,12 8,16 18,22 10,26 26,28" fill="none" stroke="#FFDD00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
    <circle cx="6" cy="6" r="2" fill="#FFDD00" opacity="0.7"/>
    <circle cx="26" cy="28" r="2" fill="#FFDD00" opacity="0.7"/>
  </g>
</svg>`;

    case 'missile':
      // 로켓 측면 실루엣 + 화염 꼬리
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="28,16 20,10 8,12 8,20 20,22" fill="#FF6600" opacity="0.9"/>
    <polygon points="8,13 3,16 8,19" fill="#FF3300" opacity="0.8"/>
    <circle cx="3" cy="16" r="2" fill="#FFDD00" opacity="0.7"/>
    <rect x="20" y="14" width="4" height="4" rx="1" fill="#FFFFFF" opacity="0.6"/>
  </g>
</svg>`;

    case 'drone':
      // 상단뷰 십자형 암 + 4개 프로펠러 원
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <rect x="14" y="6" width="4" height="20" rx="1" fill="#39FF14" opacity="0.7"/>
    <rect x="6" y="14" width="20" height="4" rx="1" fill="#39FF14" opacity="0.7"/>
    <circle cx="8" cy="8" r="4" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.8"/>
    <circle cx="24" cy="8" r="4" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.8"/>
    <circle cx="8" cy="24" r="4" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.8"/>
    <circle cx="24" cy="24" r="4" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.8"/>
    <circle cx="${half}" cy="${half}" r="3" fill="#39FF14" opacity="0.9"/>
  </g>
</svg>`;

    case 'emp_blast':
      // 방사형 원형 파동 4겹
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="3" fill="#4488FF" opacity="0.95"/>
    <circle cx="${half}" cy="${half}" r="6" fill="none" stroke="#4488FF" stroke-width="1" opacity="0.8"/>
    <circle cx="${half}" cy="${half}" r="9" fill="none" stroke="#4488FF" stroke-width="1" opacity="0.6"/>
    <circle cx="${half}" cy="${half}" r="12" fill="none" stroke="#4488FF" stroke-width="1" opacity="0.4"/>
    <circle cx="${half}" cy="${half}" r="14" fill="none" stroke="#4488FF" stroke-width="0.5" opacity="0.25"/>
  </g>
</svg>`;

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half - 2}" fill="#888888"/></svg>`;
  }
}

/**
 * 패시브 아이콘 SVG를 생성한다. 패시브별 단순 기하학 디자인.
 * @param {string} passiveId - 패시브 ID
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createPassiveIconSVG(passiveId, size = 32) {
  const half = size / 2;
  const glowFilter = `<defs><filter id="g"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  switch (passiveId) {
    case 'booster':
      // 로켓 + 불꽃 꼬리
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="16,3 22,14 18,14 18,22 14,22 14,14 10,14" fill="#FF6600" opacity="0.9"/>
    <polygon points="13,22 16,30 19,22" fill="#FFDD00" opacity="0.8"/>
    <circle cx="16" cy="10" r="2" fill="#FFFFFF" opacity="0.6"/>
  </g>
</svg>`;

    case 'armor_plate':
      // 방패 외곽선 실루엣
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <path d="M16 4 L26 10 L26 18 Q26 26 16 30 Q6 26 6 18 L6 10 Z" fill="#AAAACC" opacity="0.3" stroke="#AAAACC" stroke-width="2" stroke-opacity="0.9"/>
    <line x1="16" y1="10" x2="16" y2="24" stroke="#AAAACC" stroke-width="1" opacity="0.5"/>
    <line x1="10" y1="14" x2="22" y2="14" stroke="#AAAACC" stroke-width="1" opacity="0.5"/>
  </g>
</svg>`;

    case 'battery_pack':
      // 배터리 사각형 + 하트 오버레이
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <rect x="9" y="6" width="14" height="22" rx="2" fill="none" stroke="#39FF14" stroke-width="2" opacity="0.8"/>
    <rect x="13" y="3" width="6" height="3" rx="1" fill="#39FF14" opacity="0.7"/>
    <rect x="12" y="12" width="8" height="4" rx="1" fill="#39FF14" opacity="0.6"/>
    <rect x="12" y="18" width="8" height="4" rx="1" fill="#39FF14" opacity="0.4"/>
  </g>
</svg>`;

    case 'overclock':
      // 번개 + 기어 원형
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="11" fill="none" stroke="#FFDD00" stroke-width="1.5" opacity="0.6" stroke-dasharray="3 3"/>
    <polygon points="18,5 12,16 17,16 13,28 20,15 15,15" fill="#FFDD00" opacity="0.95"/>
  </g>
</svg>`;

    case 'magnet_module':
      // U자 자석 + 작은 점 3개
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <path d="M10 8 L10 20 Q10 26 16 26 Q22 26 22 20 L22 8" fill="none" stroke="#FF00FF" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
    <rect x="7" y="6" width="6" height="4" rx="1" fill="#FF3333" opacity="0.8"/>
    <rect x="19" y="6" width="6" height="4" rx="1" fill="#4488FF" opacity="0.8"/>
    <circle cx="16" cy="16" r="1.5" fill="#FF00FF" opacity="0.6"/>
    <circle cx="12" cy="14" r="1" fill="#FF00FF" opacity="0.4"/>
    <circle cx="20" cy="14" r="1" fill="#FF00FF" opacity="0.4"/>
  </g>
</svg>`;

    case 'regen_module':
      // 십자 + 순환 화살표 원
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="12" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.5"/>
    <rect x="14" y="8" width="4" height="16" rx="1" fill="#39FF14" opacity="0.9"/>
    <rect x="8" y="14" width="16" height="4" rx="1" fill="#39FF14" opacity="0.9"/>
    <!-- 순환 화살표 (우상단) -->
    <path d="M24 8 L28 8 L28 12" fill="none" stroke="#39FF14" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>`;

    case 'aim_module':
      // 조준 레티클 (동심원 + 십자선)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="10" fill="none" stroke="#00FFFF" stroke-width="1.5" opacity="0.8"/>
    <circle cx="${half}" cy="${half}" r="5" fill="none" stroke="#00FFFF" stroke-width="1" opacity="0.6"/>
    <circle cx="${half}" cy="${half}" r="1.5" fill="#00FFFF" opacity="0.9"/>
    <line x1="${half}" y1="2" x2="${half}" y2="10" stroke="#00FFFF" stroke-width="1" opacity="0.7"/>
    <line x1="${half}" y1="22" x2="${half}" y2="30" stroke="#00FFFF" stroke-width="1" opacity="0.7"/>
    <line x1="2" y1="${half}" x2="10" y2="${half}" stroke="#00FFFF" stroke-width="1" opacity="0.7"/>
    <line x1="22" y1="${half}" x2="30" y2="${half}" stroke="#00FFFF" stroke-width="1" opacity="0.7"/>
  </g>
</svg>`;

    case 'critical_chip':
      // 6각 별 + 번개
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="16,3 19,12 28,12 21,18 24,28 16,22 8,28 11,18 4,12 13,12" fill="#FFDD00" opacity="0.8"/>
    <polygon points="17,10 14,17 17,15 15,22" fill="#FFFFFF" opacity="0.7" stroke="#FFDD00" stroke-width="0.5"/>
  </g>
</svg>`;

    case 'cooldown_chip':
      // 시계 원 + 화살표
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <circle cx="${half}" cy="${half}" r="12" fill="none" stroke="#AA88FF" stroke-width="2" opacity="0.8"/>
    <line x1="${half}" y1="${half}" x2="${half}" y2="8" stroke="#AA88FF" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <line x1="${half}" y1="${half}" x2="22" y2="18" stroke="#AA88FF" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <circle cx="${half}" cy="${half}" r="2" fill="#AA88FF" opacity="0.9"/>
    <!-- 화살표 (우상단) -->
    <path d="M22 5 L26 5 L26 9" fill="none" stroke="#AA88FF" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>`;

    case 'luck_module':
      // 4개 마름모 클로버 배치
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="16,4 20,12 16,16 12,12" fill="#39FF14" opacity="0.8"/>
    <polygon points="16,28 20,20 16,16 12,20" fill="#39FF14" opacity="0.7"/>
    <polygon points="4,16 12,12 16,16 12,20" fill="#39FF14" opacity="0.75"/>
    <polygon points="28,16 20,12 16,16 20,20" fill="#39FF14" opacity="0.75"/>
    <circle cx="${half}" cy="${half}" r="2" fill="#FFFFFF" opacity="0.5"/>
  </g>
</svg>`;

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half - 2}" fill="#888888"/></svg>`;
  }
}

/**
 * 업그레이드 카테고리 아이콘 SVG를 생성한다.
 * @param {string} category - 카테고리 ID (basic, growth, special, limitBreak)
 * @param {number} size - SVG 크기 (px)
 * @returns {string} SVG 문자열
 */
function createUpgradeIconSVG(category, size = 32) {
  const half = size / 2;
  const glowFilter = `<defs><filter id="g"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  switch (category) {
    case 'basic':
      // 위 화살표 + 바 차트 3개
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <rect x="6" y="18" width="5" height="10" rx="1" fill="#00FFFF" opacity="0.7"/>
    <rect x="13" y="12" width="5" height="16" rx="1" fill="#00FFFF" opacity="0.8"/>
    <rect x="20" y="8" width="5" height="20" rx="1" fill="#00FFFF" opacity="0.9"/>
    <polygon points="16,2 20,8 12,8" fill="#00FFFF" opacity="0.9"/>
  </g>
</svg>`;

    case 'growth':
      // 상향 곡선 화살표 + 작은 싹
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <path d="M4 26 Q10 24 16 16 Q22 8 28 4" fill="none" stroke="#39FF14" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
    <polygon points="28,4 24,4 28,8" fill="#39FF14" opacity="0.8"/>
    <!-- 싹 -->
    <ellipse cx="8" cy="22" rx="3" ry="5" fill="#39FF14" opacity="0.5" transform="rotate(-20 8 22)"/>
    <line x1="8" y1="27" x2="8" y2="22" stroke="#39FF14" stroke-width="1.5" opacity="0.6"/>
  </g>
</svg>`;

    case 'special':
      // 6각 별 + 스파클 4개
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <polygon points="16,4 19,12 28,12 21,18 24,28 16,22 8,28 11,18 4,12 13,12" fill="#FF00FF" opacity="0.7" stroke="#FF00FF" stroke-width="1" stroke-opacity="0.9"/>
    <circle cx="6" cy="6" r="1.5" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="26" cy="6" r="1.5" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="6" cy="26" r="1.5" fill="#FFFFFF" opacity="0.5"/>
    <circle cx="26" cy="26" r="1.5" fill="#FFFFFF" opacity="0.5"/>
  </g>
</svg>`;

    case 'limitBreak':
      // 크리스탈 폭발 + 빛살 8방향
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${glowFilter}
  <g filter="url(#g)">
    <!-- 크리스탈 중심 -->
    <polygon points="16,6 22,16 16,26 10,16" fill="#FFDD00" opacity="0.85"/>
    <polygon points="16,10 19,16 16,22 13,16" fill="#FFFFFF" opacity="0.5"/>
    <!-- 8방향 빛살 -->
    <line x1="16" y1="2" x2="16" y2="6" stroke="#FFDD00" stroke-width="1.5" opacity="0.7"/>
    <line x1="16" y1="26" x2="16" y2="30" stroke="#FFDD00" stroke-width="1.5" opacity="0.7"/>
    <line x1="2" y1="16" x2="6" y2="16" stroke="#FFDD00" stroke-width="1.5" opacity="0.7"/>
    <line x1="26" y1="16" x2="30" y2="16" stroke="#FFDD00" stroke-width="1.5" opacity="0.7"/>
    <line x1="6" y1="6" x2="9" y2="9" stroke="#FFDD00" stroke-width="1" opacity="0.5"/>
    <line x1="23" y1="9" x2="26" y2="6" stroke="#FFDD00" stroke-width="1" opacity="0.5"/>
    <line x1="6" y1="26" x2="9" y2="23" stroke="#FFDD00" stroke-width="1" opacity="0.5"/>
    <line x1="23" y1="23" x2="26" y2="26" stroke="#FFDD00" stroke-width="1" opacity="0.5"/>
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
  // 조이스틱
  if (svgFn === 'joystickBase') return createJoystickBaseSVG(size);
  if (svgFn === 'joystickThumb') return createJoystickThumbSVG(size);

  // 무기 아이콘 (weapon_ 접두어 제거)
  if (svgFn.startsWith('weapon_')) return createWeaponIconSVG(svgFn.slice(7), size);

  // 패시브 아이콘 (passive_ 접두어 제거)
  if (svgFn.startsWith('passive_')) return createPassiveIconSVG(svgFn.slice(8), size);

  // 업그레이드 아이콘 (upgrade_ 접두어 제거)
  if (svgFn.startsWith('upgrade_')) return createUpgradeIconSVG(svgFn.slice(8), size);

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
 * bg_tile은 투명 배경 제거를 하지 않고, 소모품/메뉴 배경은 투명 배경 폴백 적용.
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

  // bg_tile은 배경 제거 불필요 (seamless 타일이므로 채워져 있어야 함)
  if (asset.key !== 'bg_tile') {
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
 * 모든 Phase 2 에셋을 순차적으로 생성한다.
 * SVG 에셋은 즉시 생성, GPT API 에셋은 호출 간 1초 대기.
 * 개별 실패 시 스킵하고 기존 PNG를 보존한다.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS Phase 2 에셋 생성 시작 ===');
  console.log(`에셋 ${PHASE2_ASSETS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedAssets = [];

  for (let i = 0; i < PHASE2_ASSETS.length; i++) {
    const asset = PHASE2_ASSETS[i];

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
    if (!asset.svgOverride && i < PHASE2_ASSETS.length - 1) {
      await sleep(1000);
    }
  }

  // 결과 요약 로그
  console.log('\n=== Phase 2 에셋 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${PHASE2_ASSETS.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Phase 2 에셋 생성 치명 오류:', err);
  process.exit(1);
});
