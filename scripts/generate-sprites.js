/**
 * @fileoverview DALL-E 3 API를 활용한 스프라이트 에셋 생성 스크립트.
 *
 * Phase 1 에셋 16종(플레이어, 잡몹 10종, 투사체, XP 보석 3종)을
 * 생성하여 assets/sprites/ 디렉토리에 PNG 파일로 저장한다.
 *
 * 사용법: node scripts/generate-sprites.js
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
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_ROOT = path.join(PROJECT_ROOT, 'assets', 'sprites');

// 루트 .env에서 API 키 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 시스템 프롬프트 ──

const SYSTEM_PROMPT = `Minimal pixel art sprite for a cyberpunk game. Pure black background (#000000) only.
Neon color palette. Simple geometric shapes. No text, no UI elements.
Top-down perspective. Centered on canvas. Single character only.`;

// ── 에셋 정의 ──

const ASSETS = [
  // 플레이어
  {
    key: 'player',
    targetW: 24,
    targetH: 24,
    isAnimated: true,
    outputPath: 'player.png',
    prompt: 'Cyberpunk warrior top-down view, cyan neon, round body with directional indicator',
  },
  // 투사체
  {
    key: 'projectile',
    targetW: 6,
    targetH: 6,
    isAnimated: false,
    outputPath: 'projectile.png',
    prompt: 'Energy bullet, tiny glowing dot, neon green',
  },
  // 잡몹 10종
  {
    key: 'enemy_nano_drone',
    targetW: 16,
    targetH: 16,
    isAnimated: true,
    outputPath: 'enemies/nano_drone.png',
    prompt: 'Small flying drone, minimal rotor, red neon',
  },
  {
    key: 'enemy_scout_bot',
    targetW: 20,
    targetH: 20,
    isAnimated: true,
    outputPath: 'enemies/scout_bot.png',
    prompt: 'Scout robot, wheeled, sensor eye, orange',
  },
  {
    key: 'enemy_spark_drone',
    targetW: 16,
    targetH: 16,
    isAnimated: true,
    outputPath: 'enemies/spark_drone.png',
    prompt: 'Electric drone, spark emitter, yellow neon',
  },
  {
    key: 'enemy_battle_robot',
    targetW: 28,
    targetH: 28,
    isAnimated: true,
    outputPath: 'enemies/battle_robot.png',
    prompt: 'Battle robot, armored humanoid silhouette, dark red',
  },
  {
    key: 'enemy_shield_drone',
    targetW: 20,
    targetH: 20,
    isAnimated: true,
    outputPath: 'enemies/shield_drone.png',
    prompt: 'Shield drone, round body with shield front, blue',
  },
  {
    key: 'enemy_rush_bot',
    targetW: 24,
    targetH: 24,
    isAnimated: true,
    outputPath: 'enemies/rush_bot.png',
    prompt: 'Rush bot, forward-charging spiky shape, bright orange',
  },
  {
    key: 'enemy_repair_bot',
    targetW: 20,
    targetH: 20,
    isAnimated: true,
    outputPath: 'enemies/repair_bot.png',
    prompt: 'Repair robot, cross medical symbol on body, bright green',
  },
  {
    key: 'enemy_heavy_bot',
    targetW: 32,
    targetH: 32,
    isAnimated: true,
    outputPath: 'enemies/heavy_bot.png',
    prompt: 'Heavy armored robot, bulky tank-like silhouette, gray',
  },
  {
    key: 'enemy_teleport_drone',
    targetW: 20,
    targetH: 20,
    isAnimated: true,
    outputPath: 'enemies/teleport_drone.png',
    prompt: 'Teleport drone, glitchy distortion effect, purple',
  },
  {
    key: 'enemy_suicide_bot',
    targetW: 24,
    targetH: 24,
    isAnimated: true,
    outputPath: 'enemies/suicide_bot.png',
    prompt: 'Suicide bomb bot, round bomb body, hazard marks, red',
  },
  // XP 보석 3종
  {
    key: 'xp_gem_s',
    targetW: 6,
    targetH: 6,
    isAnimated: false,
    outputPath: 'items/xp_gem_s.png',
    prompt: 'Tiny data fragment crystal, diamond rhombus, neon green',
  },
  {
    key: 'xp_gem_m',
    targetW: 10,
    targetH: 10,
    isAnimated: false,
    outputPath: 'items/xp_gem_m.png',
    prompt: 'Medium data fragment crystal, diamond rhombus, neon cyan',
  },
  {
    key: 'xp_gem_l',
    targetW: 14,
    targetH: 14,
    isAnimated: false,
    outputPath: 'items/xp_gem_l.png',
    prompt: 'Large data fragment crystal, diamond rhombus, magenta',
  },
];

// ── 유틸리티 함수 ──

/**
 * 지정 ms 만큼 대기한다.
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 어두운 픽셀(밝기 임계값 이하)을 투명화한다.
 * DALL-E 3가 투명 배경을 지원하지 않으므로 검은 배경을 후처리로 제거한다.
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
 * DALL-E 3 API로 이미지를 생성하고, 후처리하여 PNG 파일로 저장한다.
 * @param {Object} asset - 에셋 정의 객체
 */
async function generateAsset(asset) {
  const fullPrompt = `${SYSTEM_PROMPT}\n${asset.prompt}`;

  console.log(`[${asset.key}] DALL-E 3 API 호출 중...`);

  // DALL-E 3 API 호출
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    style: 'vivid',
    response_format: 'url',
  });

  const imageUrl = response.data[0].url;
  console.log(`[${asset.key}] 이미지 URL 획득, 다운로드 중...`);

  // URL에서 PNG 다운로드
  const fetchRes = await fetch(imageUrl);
  if (!fetchRes.ok) {
    throw new Error(`이미지 다운로드 실패: ${fetchRes.status}`);
  }
  const arrayBuffer = await fetchRes.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  // 배경 제거 (어두운 픽셀 투명화)
  console.log(`[${asset.key}] 배경 제거 중...`);
  const transparentBuffer = await removeBackground(rawBuffer);

  // 최종 크기 계산
  const finalW = asset.isAnimated ? asset.targetW * 2 : asset.targetW;
  const finalH = asset.targetH;

  let resultBuffer;

  if (asset.isAnimated) {
    // 스프라이트시트: 단일 프레임을 리사이즈 후 좌우 2칸 배치
    const frameBuffer = await sharp(transparentBuffer)
      .resize(asset.targetW, asset.targetH, { kernel: 'nearest', fit: 'fill' })
      .png()
      .toBuffer();

    // 좌우 2프레임 합성 (frame1 = frame2 = 동일 이미지)
    resultBuffer = await sharp({
      create: {
        width: finalW,
        height: finalH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: frameBuffer, left: 0, top: 0 },
        { input: frameBuffer, left: asset.targetW, top: 0 },
      ])
      .png()
      .toBuffer();
  } else {
    // 정적 이미지: 타겟 크기로 리사이즈
    resultBuffer = await sharp(transparentBuffer)
      .resize(finalW, finalH, { kernel: 'nearest', fit: 'fill' })
      .png()
      .toBuffer();
  }

  // 출력 디렉토리 생성 및 파일 저장
  const outputFullPath = path.join(ASSETS_ROOT, asset.outputPath);
  const outputDir = path.dirname(outputFullPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFullPath, resultBuffer);

  console.log(`[${asset.key}] 저장 완료: ${outputFullPath} (${finalW}x${finalH})`);
}

// ── 메인 실행 ──

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log(`=== Neon Exodus Phase 1 스프라이트 생성 시작 ===`);
  console.log(`에셋 ${ASSETS.length}종 생성 예정\n`);

  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];
    try {
      await generateAsset(asset);
    } catch (err) {
      console.error(`[${asset.key}] 생성 실패:`, err.message);
    }

    // API rate limit 대응: 마지막 호출이 아니면 1초 대기
    if (i < ASSETS.length - 1) {
      await sleep(1000);
    }
  }

  console.log('\n=== 스프라이트 생성 완료 ===');
}

main();
