/**
 * @fileoverview GPT Image API 기반 소모성 아이템 스프라이트 생성 스크립트.
 *
 * OpenAI gpt-image-1 모델을 사용하여 6종 소모성 아이템의
 * 24x24 PNG 아이콘을 생성한다.
 *
 * 실행: node scripts/generate-consumable-sprites.js
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
const SPRITES_ROOT = path.join(ROOT, 'assets', 'sprites', 'items');

// 루트 .env에서 API 키 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 프롬프트 ──

const STYLE_PROMPT = `Clean vector art game item icon, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single item centered, no text, no UI elements, vibrant neon glow effects, 24x24 pixel game pickup item`;

// ── 에셋 정의 (6종) ──

const ASSETS = [
  {
    key: 'nano_repair',
    outputFile: 'nano_repair.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Green (#39FF14) glowing cross/plus medical repair kit icon, neon green healing symbol, cyberpunk medkit pickup item',
  },
  {
    key: 'magnetic_pulse',
    outputFile: 'magnetic_pulse.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Cyan (#00FFFF) glowing horseshoe magnet icon with radiating magnetic field lines, neon cyan magnet pulse pickup item',
  },
  {
    key: 'emp_bomb',
    outputFile: 'emp_bomb.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Electric blue (#4488FF) glowing bomb icon with lightning spark, circular EMP grenade with radiating electric arcs, pickup item',
  },
  {
    key: 'credit_chip',
    outputFile: 'credit_chip.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Gold (#FFDD00) glowing diamond-shaped credit chip icon, shiny golden hexagonal data chip with circuit lines, pickup item',
  },
  {
    key: 'overclock',
    outputFile: 'overclock.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Orange (#FF6600) glowing lightning bolt icon, neon orange speed boost symbol with radiating energy, overclock module pickup item',
  },
  {
    key: 'shield_battery',
    outputFile: 'shield_battery.png',
    finalW: 24,
    finalH: 24,
    prompt: 'Purple (#AA44FF) glowing shield icon, neon violet energy barrier with circular glow, shield battery pickup item',
  },
];

// ── 유틸리티 함수 ──

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 어두운 픽셀을 투명화한다 (배경 제거 폴백).
 * @param {Buffer} inputBuffer - 입력 PNG 버퍼
 * @param {number} [threshold=40] - 밝기 임계값
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
 * 투명 배경 존재 여부를 확인한다.
 * @param {Buffer} imgBuffer - PNG 이미지 버퍼
 * @returns {Promise<boolean>}
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

// ── 에셋 생성 함수 ──

async function generateSprite(asset) {
  const fullPrompt = STYLE_PROMPT + '\n' + asset.prompt;

  console.log(`  [${asset.key}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
  });

  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  const isTransparent = await hasTransparentBackground(imgBuffer);
  if (!isTransparent) {
    console.log(`  [${asset.key}] 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 출력 디렉토리 생성
  if (!fs.existsSync(SPRITES_ROOT)) {
    fs.mkdirSync(SPRITES_ROOT, { recursive: true });
  }

  const outputPath = path.join(SPRITES_ROOT, asset.outputFile);

  await sharp(imgBuffer)
    .resize(asset.finalW, asset.finalH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);

  console.log(`  [${asset.key}] 저장 완료: items/${asset.outputFile} (${asset.finalW}x${asset.finalH})`);
  return true;
}

// ── 메인 실행 ──

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS 소모성 아이템 스프라이트 생성 시작 ===');
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
      console.error(`  [${asset.key}] 생성 실패: ${err.message}`);
    }

    // Rate limit 대응: 1초 대기
    if (i < ASSETS.length - 1) {
      await sleep(1000);
    }
  }

  console.log('\n=== 소모성 아이템 스프라이트 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${ASSETS.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('스프라이트 생성 치명 오류:', err);
  process.exit(1);
});
