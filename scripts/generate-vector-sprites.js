/**
 * @fileoverview GPT Image API 기반 스프라이트 생성 스크립트.
 *
 * OpenAI gpt-image-1 모델을 사용하여 20종 엔티티(플레이어, 잡몹 10종,
 * 미니보스 2종, 보스 3종, XP 보석 3종, 투사체)의 PNG 스프라이트를 생성한다.
 * ART_CONCEPT.md의 사이버펑크 네온 스타일 가이드를 따른다.
 *
 * 실행: node scripts/generate-vector-sprites.js
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
const SPRITES_ROOT = path.join(ROOT, 'assets', 'sprites');

// 루트 .env에서 API 키 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 프롬프트 ──

/**
 * 모든 에셋에 적용되는 공통 스타일 지시문.
 * 사이버펑크 네온 벡터 아트 스타일을 일관되게 유지한다.
 * @type {string}
 */
const STYLE_PROMPT = `Clean vector art game sprite, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single character centered, no text, no UI elements, vibrant neon glow effects`;

// ── 에셋 정의 (20종) ──

/**
 * 생성할 스프라이트 에셋 목록.
 * ART_CONCEPT.md의 엔티티별 디자인 가이드 기반.
 * @type {Array<{key: string, outputPath: string, finalW: number, finalH: number, prompt: string}>}
 */
const ASSETS = [
  // ── 플레이어 ──
  {
    key: 'player',
    outputPath: 'player.png',
    finalW: 48,
    finalH: 48,
    prompt: 'Cyan neon warrior character, round helmet with glowing visor slit, shoulder pads on both sides, cyberpunk armor suit, cyan (#00FFFF) as primary color with white highlights, futuristic soldier top-down view',
  },

  // ── 투사체 ──
  {
    key: 'projectile',
    outputPath: 'projectile.png',
    finalW: 12,
    finalH: 12,
    prompt: 'Cyan energy bullet projectile, circular glowing core with radial glow rays emanating outward, bright white center fading to cyan (#00FFFF) edges, small compact energy orb',
  },

  // ── 잡몹 10종 ──
  {
    key: 'nano_drone',
    outputPath: 'enemies/nano_drone.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Small triangular flying drone, red (#FF3333) glowing core in center, two thin angular wings extending from sides, compact aggressive design, enemy robot drone',
  },
  {
    key: 'scout_bot',
    outputPath: 'enemies/scout_bot.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Round-bodied scout robot with antenna on top, single large orange (#FF6600) sensor eye in center, small wheeled or hovering base, reconnaissance drone design',
  },
  {
    key: 'spark_drone',
    outputPath: 'enemies/spark_drone.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Electric spark drone with hexagonal body, yellow (#FFDD00) glowing core, visible electric arc sparks around the body, tesla coil style energy emitter',
  },
  {
    key: 'battle_robot',
    outputPath: 'enemies/battle_robot.png',
    finalW: 48,
    finalH: 48,
    prompt: 'Heavy armored battle robot, rectangular body with two mechanical arms, two red (#FF3333) glowing eyes, thick armor plating with panel lines, military combat robot design',
  },
  {
    key: 'shield_drone',
    outputPath: 'enemies/shield_drone.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Hexagonal shield drone with protective energy panels, dual glow effect - cyan (#00FFFF) shield outer ring and red (#FF3333) inner core, defensive barrier drone',
  },
  {
    key: 'rush_bot',
    outputPath: 'enemies/rush_bot.png',
    finalW: 40,
    finalH: 40,
    prompt: 'Triangular wedge-shaped rush bot, sharp pointed front, orange (#FF6600) booster thrusters at the rear, aggressive charging pose, fast assault drone design',
  },
  {
    key: 'repair_bot',
    outputPath: 'enemies/repair_bot.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Round medical repair robot, cross/plus symbol on body, green (#39FF14) healing glow aura, friendly medic drone with circular body shape',
  },
  {
    key: 'heavy_bot',
    outputPath: 'enemies/heavy_bot.png',
    finalW: 48,
    finalH: 48,
    prompt: 'Wide rectangular heavy armored bot, thick layered armor plating, dual core system - orange (#FF6600) and red (#FF3333) dual glowing power cores, tank-like design',
  },
  {
    key: 'teleport_drone',
    outputPath: 'enemies/teleport_drone.png',
    finalW: 32,
    finalH: 32,
    prompt: 'Diamond/rhombus-shaped teleport drone, magenta (#FF00FF) blinking core in center, ghost afterimage trails, phase-shifting glitch effect design',
  },
  {
    key: 'suicide_bot',
    outputPath: 'enemies/suicide_bot.png',
    finalW: 40,
    finalH: 40,
    prompt: 'Spherical suicide bomb bot, round body with hazard warning triangle symbol, pulsating red (#FF3333) and yellow (#FFDD00) core, volatile explosive drone design',
  },

  // ── 미니보스 2종 ──
  {
    key: 'guardian_drone',
    outputPath: 'bosses/guardian_drone.png',
    finalW: 80,
    finalH: 80,
    prompt: 'Large hexagonal guardian drone boss, rotating ring armor orbiting the body, orange (#FF6600) and red (#FF3333) intense glow, armored hexagonal shell with panel details, imposing defensive boss design',
  },
  {
    key: 'assault_mech',
    outputPath: 'bosses/assault_mech.png',
    finalW: 80,
    finalH: 80,
    prompt: 'Bipedal assault mech boss, wide heavy shoulder armor plates, dark red missile pods on shoulders, two mechanical legs, red glowing visor eye slit, military war machine design',
  },

  // ── 보스 3종 ──
  {
    key: 'commander_drone',
    outputPath: 'bosses/commander_drone.png',
    finalW: 128,
    finalH: 128,
    prompt: 'Massive mothership commander drone boss, crown-like antenna array on top with three prongs, magenta (#FF00FF) glowing core, orbital rings circling the body, large spherical main body, supreme commander design',
  },
  {
    key: 'siege_titan',
    outputPath: 'bosses/siege_titan.png',
    finalW: 128,
    finalH: 128,
    prompt: 'Siege titan walker boss, heavy caterpillar treads, large cannon arm extending upward, orange (#FF6600) and yellow (#FFDD00) glowing cannon muzzle, massive armored tank-walker hybrid, siege warfare machine design',
  },
  {
    key: 'core_processor',
    outputPath: 'bosses/core_processor.png',
    finalW: 128,
    finalH: 128,
    prompt: 'AI crystal core processor boss, diamond-shaped crystalline body, three layers of orbital rings rotating at different angles, magenta (#FF00FF) and white pulsating energy core, four energy nodes at cardinal points, transcendent AI entity design',
  },

  // ── XP 보석 3종 ──
  {
    key: 'xp_gem_s',
    outputPath: 'items/xp_gem_s.png',
    finalW: 12,
    finalH: 12,
    prompt: 'Tiny diamond-shaped gem pickup item, small rhombus shape, cyan (#00FFFF) glowing crystal, simple clean jewel design, collectible data fragment',
  },
  {
    key: 'xp_gem_m',
    outputPath: 'items/xp_gem_m.png',
    finalW: 20,
    finalH: 20,
    prompt: 'Medium diamond-shaped gem pickup item, rhombus shape, cyan-to-green (#00FFFF to #39FF14) gradient glow, slightly larger crystal with more defined facets, collectible data fragment',
  },
  {
    key: 'xp_gem_l',
    outputPath: 'items/xp_gem_l.png',
    finalW: 28,
    finalH: 28,
    prompt: 'Large diamond-shaped gem pickup item, rhombus shape, multi-layered glow effect with cyan core and green outer glow, prominent faceted crystal with bright highlights, collectible data fragment',
  },
];

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
    // 밝기 계산 (간단 평균)
    const brightness = (r + g + b) / 3;
    if (brightness <= threshold) {
      pixels[i + 3] = 0; // alpha = 0 (투명)
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
 * 투명 픽셀(alpha < 10) 비율이 10% 미만이면 투명 배경이 없는 것으로 판단.
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

  // 투명 픽셀 비율이 10% 이상이면 투명 배경이 있다고 판단
  return (transparentCount / totalPixels) >= 0.10;
}

// ── 에셋 생성 함수 ──

/**
 * GPT Image API로 단일 에셋을 생성하고 PNG 파일로 저장한다.
 *
 * 1. gpt-image-1 모델로 1024x1024 이미지를 생성한다.
 * 2. base64 디코딩 후 투명 배경 확인 -> 필요시 폴백 투명화 적용.
 * 3. sharp로 목표 크기로 리사이즈하여 최종 PNG를 저장한다.
 *
 * @param {Object} asset - 에셋 정의 객체
 * @param {string} asset.key - 에셋 식별자 (로그용)
 * @param {string} asset.outputPath - SPRITES_ROOT 기준 상대 출력 경로
 * @param {number} asset.finalW - 최종 출력 너비 (픽셀)
 * @param {number} asset.finalH - 최종 출력 높이 (픽셀)
 * @param {string} asset.prompt - 개별 프롬프트
 * @returns {Promise<boolean>} 생성 성공 여부
 */
async function generateSprite(asset) {
  const fullPrompt = STYLE_PROMPT + '\n' + asset.prompt;

  console.log(`  [${asset.key}] GPT Image API 호출 중...`);

  // gpt-image-1 API 호출 (투명 배경 + 고품질)
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
  });

  // gpt-image-1은 항상 b64_json 형태로 반환
  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  // 투명 배경 확인 및 폴백 처리
  const isTransparent = await hasTransparentBackground(imgBuffer);
  if (!isTransparent) {
    console.log(`  [${asset.key}] 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 출력 디렉토리 생성
  const outputFullPath = path.join(SPRITES_ROOT, asset.outputPath);
  const dir = path.dirname(outputFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // sharp로 목표 크기로 리사이즈 (투명 배경 유지, 비율 유지 축소)
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
 * 모든 에셋을 순차적으로 생성한다.
 * 개별 에셋 실패 시 스킵하고 기존 PNG를 보존한다.
 * API Rate Limit 대응으로 호출 간 1초 대기한다.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS GPT Image API 스프라이트 생성 시작 ===');
  console.log(`에셋 ${ASSETS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedAssets = [];

  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];

    try {
      const ok = await generateSprite(asset);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedAssets.push(asset.key);
      console.error(`  [${asset.key}] 생성 실패 (기존 PNG 보존): ${err.message}`);
    }

    // Rate limit 대응: 마지막 호출이 아니면 1초 대기
    if (i < ASSETS.length - 1) {
      await sleep(1000);
    }
  }

  // 결과 요약 로그
  console.log('\n=== GPT Image API 스프라이트 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${ASSETS.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('스프라이트 생성 치명 오류:', err);
  process.exit(1);
});
