/**
 * @fileoverview 궁극기 이펙트 에셋 생성 스크립트 — GPT Image API(gpt-image-1).
 *
 * 6 캐릭터별 궁극기 이펙트 이미지를 투명 배경 PNG로 생성한다.
 * Phaser에서 tween(scale/alpha/rotation)으로 애니메이션한다.
 *
 * 실행: node scripts/generate-ult-effects.js
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

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 프롬프트 ──

const STYLE_PROMPT = `Game VFX effect sprite for a top-down cyberpunk mobile shooter game.
Transparent background, centered composition, vibrant neon glow.
2D flat art style, clean edges, suitable for overlay on dark game screen.
No text, no UI, no characters, no watermark. Pure visual effect only.`;

// ── 궁극기 이펙트 정의 ──

const EFFECTS = [
  {
    id: 'ult_agent',
    outputPath: 'effects/ult_agent.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Tactical orbital strike laser grid bombardment.
A grid of cyan laser beams raining down from above, forming a crosshatch pattern.
Multiple vertical cyan (#00FFFF) laser lines hitting the ground with bright impact sparks.
Electric arcs between beams, debris particles flying outward.
Intense cyan glow at beam impact points, light rays spreading horizontally.
Top-down perspective, beams coming from upper area toward center.`,
  },
  {
    id: 'ult_sniper',
    outputPath: 'effects/ult_sniper.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Precision kill zone - sniper death beam.
A single massive green (#39FF14) laser beam cutting horizontally across the frame.
Bright neon green energy beam with intense core (white-hot center, green edges).
Particles and energy wisps trailing along the beam path.
Targeting reticle/crosshair overlay with scanning lines.
Impact explosion at the beam's leading edge with green energy dispersal.`,
  },
  {
    id: 'ult_engineer',
    outputPath: 'effects/ult_engineer.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Orbital cannon energy beam from space.
A massive vertical orange (#FF6600) energy beam descending from the top.
Wide beam with bright white-hot core fading to orange edges.
Circular shockwave ripple at the ground impact point.
Floating tech debris and holographic hexagonal shields around the beam.
Ground crackling with orange energy veins spreading outward from impact.`,
  },
  {
    id: 'ult_berserker',
    outputPath: 'effects/ult_berserker.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Explosive rage nova shockwave.
A massive circular red (#FF3333) explosion expanding outward from center.
Concentric rings of red energy waves with bright white-hot core.
Jagged lightning bolts radiating outward in all directions.
Ground cracking with red molten energy underneath.
Fire and ember particles scattered throughout, intense destructive energy.`,
  },
  {
    id: 'ult_medic',
    outputPath: 'effects/ult_medic.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Bio-purge healing wave pulse.
A circular expanding wave of green-white healing energy from center.
Soft green (#39FF14) and white bioluminescent particles floating upward.
DNA helix strands dissolving into light particles around the wave edge.
Medical cross symbol briefly visible in the bright white core.
Gentle but powerful, purifying glow spreading outward. Clean, ethereal feel.`,
  },
  {
    id: 'ult_hidden',
    outputPath: 'effects/ult_hidden.png',
    size: 512,
    prompt: `${STYLE_PROMPT}
Effect: Dimensional void rift - reality tearing apart.
A massive magenta (#FF00FF) dimensional crack/rift in the center of the frame.
Space-time distortion with warped grid lines being pulled into the rift.
Dark void/black hole center surrounded by swirling magenta energy vortex.
Glitch artifacts and digital distortion fragments around the edges.
Reality fragments breaking apart and being sucked into the void. Cosmic horror energy.`,
  },
];

// ── 유틸리티 함수 ──

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 어두운 픽셀을 투명화한다 (배경 제거 폴백).
 * @param {Buffer} inputBuffer - 입력 PNG 버퍼
 * @param {number} [threshold=30] - 밝기 임계값
 * @returns {Promise<Buffer>}
 */
async function removeBackground(inputBuffer, threshold = 30) {
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
 * 투명 배경 존재 여부 확인.
 * @param {Buffer} imgBuffer
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

// ── GPT Image API 이펙트 생성 ──

/**
 * GPT Image API로 이펙트 이미지를 생성하고 PNG로 저장한다.
 * @param {Object} effect - 이펙트 정의
 * @returns {Promise<boolean>}
 */
async function generateEffect(effect) {
  console.log(`  [${effect.id}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: effect.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
  });

  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  // 투명 배경 확인 및 폴백
  const isTransparent = await hasTransparentBackground(imgBuffer);
  if (!isTransparent) {
    console.log(`  [${effect.id}] 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 출력 디렉토리 생성
  const outputFullPath = path.join(ROOT, 'assets', effect.outputPath);
  const dir = path.dirname(outputFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 지정 크기로 리사이즈
  await sharp(imgBuffer)
    .resize(effect.size, effect.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFullPath);

  console.log(`  [${effect.id}] 저장 완료: ${effect.outputPath} (${effect.size}x${effect.size})`);
  return true;
}

// ── 메인 실행 ──

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS 궁극기 이펙트 생성 시작 ===');
  console.log(`이펙트 ${EFFECTS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedEffects = [];

  for (let i = 0; i < EFFECTS.length; i++) {
    const effect = EFFECTS[i];

    try {
      const ok = await generateEffect(effect);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedEffects.push(effect.id);
      console.error(`  [${effect.id}] 생성 실패: ${err.message}`);
    }

    // Rate limit 대응: API 호출 간 3초 대기
    if (i < EFFECTS.length - 1) {
      await sleep(3000);
    }
  }

  console.log(`\n=== 궁극기 이펙트 생성 완료 ===`);
  console.log(`성공: ${successCount}/${EFFECTS.length}`);
  if (failCount > 0) {
    console.log(`실패: ${failedEffects.join(', ')}`);
  }
}

main().catch(console.error);
