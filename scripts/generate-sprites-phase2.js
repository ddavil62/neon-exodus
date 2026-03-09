/**
 * @fileoverview DALL-E 3 API를 활용한 Phase 2 스프라이트 에셋 생성 스크립트.
 *
 * Phase 2 에셋 5종(미니보스 2종, 보스 3종)을
 * 생성하여 assets/sprites/bosses/ 디렉토리에 PNG 파일로 저장한다.
 * 미니보스: 40x40 2프레임 시트 (80x40)
 * 보스: 64x64 4프레임 시트 (256x64) — idle 2F + special 2F, DALL-E 2회 호출
 *
 * 사용법: node scripts/generate-sprites-phase2.js
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
  // 미니보스 2종 (40x40, 2프레임 idle)
  {
    key: 'enemy_guardian_drone',
    targetW: 40,
    targetH: 40,
    frames: 2,
    outputPath: 'bosses/guardian_drone.png',
    prompt: 'Large hexagonal guardian drone, spinning ring armor, armored plating, orange neon glow, top-down silhouette',
  },
  {
    key: 'enemy_assault_mech',
    targetW: 40,
    targetH: 40,
    frames: 2,
    outputPath: 'bosses/assault_mech.png',
    prompt: 'Heavy bipedal assault mech, broad armored shoulders, missile pods on back, dark red neon, top-down silhouette',
  },
  // 보스 3종 (64x64, 4프레임: idle 2F + special 2F)
  {
    key: 'enemy_commander_drone',
    targetW: 64,
    targetH: 64,
    frames: 4,
    outputPath: 'bosses/commander_drone.png',
    prompt: 'Commanding mothership drone, crown antennae array, magenta core, top-down silhouette',
    promptSpecial: 'Commanding mothership drone charging, energy aura extended, magenta-white overcharge glow, top-down silhouette',
  },
  {
    key: 'enemy_siege_titan',
    targetW: 64,
    targetH: 64,
    frames: 4,
    outputPath: 'bosses/siege_titan.png',
    prompt: 'Massive siege walker mech, tank treads, artillery cannon arm, orange-yellow neon, top-down silhouette',
    promptSpecial: 'Massive siege walker mech, cannon charging, barrel glow intensified, orange-yellow overcharge, top-down silhouette',
  },
  {
    key: 'enemy_core_processor',
    targetW: 64,
    targetH: 64,
    frames: 4,
    outputPath: 'bosses/core_processor.png',
    prompt: 'Final boss AI crystal core, orbital rings, magenta-white pulsating energy, top-down silhouette',
    promptSpecial: 'Final boss AI crystal core, all rings spinning fast, overcharge white flare, magenta-white energy burst, top-down silhouette',
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
 * DALL-E 3 API로 이미지 1장을 생성하고 배경 제거 및 리사이즈하여 프레임 버퍼를 반환한다.
 * @param {string} key - 에셋 키 (로그용)
 * @param {string} prompt - DALL-E 3 프롬프트
 * @param {number} targetW - 프레임 너비
 * @param {number} targetH - 프레임 높이
 * @returns {Promise<Buffer>} 리사이즈된 PNG 프레임 버퍼
 */
async function generateFrame(key, prompt, targetW, targetH) {
  const fullPrompt = `${SYSTEM_PROMPT}\n${prompt}`;

  console.log(`[${key}] DALL-E 3 API 호출 중...`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    style: 'vivid',
    response_format: 'url',
  });

  const imageUrl = response.data[0].url;
  console.log(`[${key}] 이미지 URL 획득, 다운로드 중...`);

  // URL에서 PNG 다운로드
  const fetchRes = await fetch(imageUrl);
  if (!fetchRes.ok) {
    throw new Error(`이미지 다운로드 실패: ${fetchRes.status}`);
  }
  const arrayBuffer = await fetchRes.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  // 배경 제거 (어두운 픽셀 투명화)
  console.log(`[${key}] 배경 제거 중...`);
  const transparentBuffer = await removeBackground(rawBuffer);

  // 타겟 크기로 리사이즈
  const frameBuffer = await sharp(transparentBuffer)
    .resize(targetW, targetH, { kernel: 'nearest', fit: 'fill' })
    .png()
    .toBuffer();

  return frameBuffer;
}

/**
 * Phase 2 에셋을 생성한다.
 * 미니보스(2프레임): 단일 DALL-E 호출 → idle 2F 시트 조립
 * 보스(4프레임): DALL-E 2회 호출(idle + special) → 4F 시트 조립
 * @param {Object} asset - 에셋 정의 객체
 */
async function generateAsset(asset) {
  const { key, targetW, targetH, frames, outputPath, prompt, promptSpecial } = asset;

  // idle 프레임 생성 (모든 에셋 공통)
  const idleFrame = await generateFrame(key, prompt, targetW, targetH);

  let resultBuffer;

  if (frames === 2) {
    // 미니보스: idle 프레임을 2칸 배치 (80x40)
    const sheetW = targetW * 2;
    const sheetH = targetH;

    resultBuffer = await sharp({
      create: {
        width: sheetW,
        height: sheetH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: idleFrame, left: 0, top: 0 },
        { input: idleFrame, left: targetW, top: 0 },
      ])
      .png()
      .toBuffer();

    console.log(`[${key}] 미니보스 시트 조립 완료 (${sheetW}x${sheetH}, 2F)`);
  } else if (frames === 4) {
    // 보스: special 프레임 추가 생성 (DALL-E 2회째)
    await sleep(1000); // rate limit 대응
    const specialFrame = await generateFrame(
      `${key}_special`, promptSpecial, targetW, targetH
    );

    // 4프레임 시트: [idle | idle | special | special] (256x64)
    const sheetW = targetW * 4;
    const sheetH = targetH;

    resultBuffer = await sharp({
      create: {
        width: sheetW,
        height: sheetH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: idleFrame, left: 0, top: 0 },
        { input: idleFrame, left: targetW, top: 0 },
        { input: specialFrame, left: targetW * 2, top: 0 },
        { input: specialFrame, left: targetW * 3, top: 0 },
      ])
      .png()
      .toBuffer();

    console.log(`[${key}] 보스 시트 조립 완료 (${sheetW}x${sheetH}, 4F: idle 2F + special 2F)`);
  }

  // 출력 디렉토리 생성 및 파일 저장
  const outputFullPath = path.join(ASSETS_ROOT, outputPath);
  const outputDir = path.dirname(outputFullPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFullPath, resultBuffer);

  console.log(`[${key}] 저장 완료: ${outputFullPath}`);
}

// ── 메인 실행 ──

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log(`=== Neon Exodus Phase 2 스프라이트 생성 시작 ===`);
  console.log(`에셋 ${ASSETS.length}종 생성 예정 (DALL-E 호출 총 8회)\n`);

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

  console.log('\n=== Phase 2 스프라이트 생성 완료 ===');
}

main();
