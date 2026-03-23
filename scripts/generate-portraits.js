/**
 * @fileoverview 캐릭터 초상화 생성 스크립트 — GPT Image API(gpt-image-1).
 *
 * 7개 캐릭터 초상화를 200x200 PNG로 생성한다.
 * - 6 플레이어블 캐릭터: agent, sniper, engineer, berserker, medic, hidden
 * - 1 AI 엔티티: exodus
 *
 * 실행: node scripts/generate-portraits.js
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

const STYLE_PROMPT = `Anime-style character portrait bust shot for a cyberpunk mobile game visual novel cutscene.
Front-facing or slight 3/4 angle, shoulders and head visible, dark transparent background.
Clean digital art with vibrant neon glow effects, cyberpunk aesthetic.
Expressive eyes, detailed face, futuristic outfit/armor.
No text, no UI elements, no watermark. High quality illustration.`;

// ── 캐릭터 초상화 정의 ──

/** @type {Array<{id: string, outputPath: string, prompt: string}>} */
const PORTRAITS = [
  {
    id: 'agent',
    outputPath: 'portraits/agent.png',
    prompt: `${STYLE_PROMPT}
Character: Male government spy/special agent, age 36, pragmatic expression.
Appearance: Short dark hair, sharp eyes with cyan glowing visor/HUD lens over one eye.
Outfit: Sleek black tactical suit with cyan neon trim and circuit-like patterns.
Color theme: Cyan (#00FFFF) neon glow accents on dark suit.
Expression: Calm, calculating, professional.`,
  },
  {
    id: 'sniper',
    outputPath: 'portraits/sniper.png',
    prompt: `${STYLE_PROMPT}
Character: Female corporate assassin/sniper, age 28, cool and calculating.
Appearance: Long silver-white hair tied back, narrow sharp eyes, lean face.
Outfit: Dark bodysuit with green neon scope/targeting lens over right eye, high collar.
Color theme: Neon green (#39FF14) glow accents, dark outfit.
Expression: Cold, focused, slightly smirking.`,
  },
  {
    id: 'engineer',
    outputPath: 'portraits/engineer.png',
    prompt: `${STYLE_PROMPT}
Character: Male AI architect/engineer, age 42, wise and responsible look.
Appearance: Messy brown hair, round glasses with orange holographic display, friendly rounded face.
Outfit: Heavy utility vest over tech jumpsuit, tools and gadgets attached, orange neon indicators.
Color theme: Orange (#FF6600) neon glow on tools and glasses.
Expression: Warm, thoughtful, slightly worried.`,
  },
  {
    id: 'berserker',
    outputPath: 'portraits/berserker.png',
    prompt: `${STYLE_PROMPT}
Character: Male riot officer/berserker, age 34, fierce and battle-hardened.
Appearance: Buzz cut, strong jaw, battle scars on face, intense red-glowing eyes.
Outfit: Heavy powered armor with red neon veins pulsing across plates, bulky shoulder guards.
Color theme: Red (#FF3333) neon glow across armor, aggressive energy aura.
Expression: Fierce, angry, determined.`,
  },
  {
    id: 'medic',
    outputPath: 'portraits/medic.png',
    prompt: `${STYLE_PROMPT}
Character: Female underground doctor/medic, age 31, compassionate healer.
Appearance: Short bob-cut black hair, gentle eyes, medical cross hologram near ear.
Outfit: White-green medical coat with neon cross symbol on chest, nano-tech healing gloves.
Color theme: White and green (#39FF14) neon glow, clean medical aesthetic.
Expression: Kind, caring, determined to help.`,
  },
  {
    id: 'hidden',
    outputPath: 'portraits/hidden.png',
    prompt: `${STYLE_PROMPT}
Character: Mysterious amnesiac weapon master, unknown age, enigmatic presence.
Appearance: Face partially obscured by glitching digital mask/hood, one eye visible glowing magenta.
Outfit: Tattered cloak over high-tech bodysuit, multiple weapon sheaths visible, magenta energy cracks.
Color theme: Magenta/purple (#FF00FF) neon glow, glitch effects, digital distortion.
Expression: Mysterious, haunted, searching for identity.`,
  },
  {
    id: 'exodus',
    outputPath: 'portraits/exodus.png',
    prompt: `${STYLE_PROMPT}
Character: EXODUS - rogue AI entity manifested as holographic humanoid form, genderless.
Appearance: Geometric face made of floating polygons and data streams, no fixed features.
Glowing cyan-white core with orbiting data rings and binary code fragments.
Outfit: No physical body — pure energy/hologram form with wireframe skeleton visible.
Color theme: White-cyan holographic glow, matrix-like data cascading, cold blue energy.
Expression: Inhuman, omniscient, eerily calm digital face.`,
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
 * @param {number} [threshold=40] - 밝기 임계값
 * @returns {Promise<Buffer>}
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

// ── GPT Image API 초상화 생성 ──

/**
 * GPT Image API로 초상화를 생성하고 200x200 PNG로 저장한다.
 * @param {Object} portrait - 초상화 정의
 * @returns {Promise<boolean>}
 */
async function generatePortrait(portrait) {
  console.log(`  [${portrait.id}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: portrait.prompt,
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
    console.log(`  [${portrait.id}] 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 출력 디렉토리 생성
  const outputFullPath = path.join(ROOT, 'assets', portrait.outputPath);
  const dir = path.dirname(outputFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 200x200으로 리사이즈
  await sharp(imgBuffer)
    .resize(200, 200, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputFullPath);

  console.log(`  [${portrait.id}] 저장 완료: ${portrait.outputPath} (200x200)`);
  return true;
}

// ── 메인 실행 ──

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  console.log('=== NEON EXODUS 캐릭터 초상화 생성 시작 ===');
  console.log(`초상화 ${PORTRAITS.length}종 생성 예정\n`);

  let successCount = 0;
  let failCount = 0;
  const failedPortraits = [];

  for (let i = 0; i < PORTRAITS.length; i++) {
    const portrait = PORTRAITS[i];

    try {
      const ok = await generatePortrait(portrait);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedPortraits.push(portrait.id);
      console.error(`  [${portrait.id}] 생성 실패: ${err.message}`);
    }

    // Rate limit 대응: API 호출 간 2초 대기
    if (i < PORTRAITS.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n=== 초상화 생성 완료 ===`);
  console.log(`성공: ${successCount}/${PORTRAITS.length}`);
  if (failCount > 0) {
    console.log(`실패: ${failedPortraits.join(', ')}`);
  }
}

main().catch(console.error);
