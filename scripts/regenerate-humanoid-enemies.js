/**
 * @fileoverview 휴머노이드/메카 형태 적 스프라이트 재생성 스크립트.
 *
 * 애니메이션 없이도 자연스러운 부유/드론/구체 형태로 재생성한다.
 * 대상: battle_robot, heavy_bot (잡몹), assault_mech (미니보스), siege_titan (보스)
 *
 * 실행: node scripts/regenerate-humanoid-enemies.js
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

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 ──

const COMMON_STYLE = `Clean vector art game sprite, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single character centered, no text, no UI elements, vibrant neon glow effects.`;

// ── 재생성 대상 정의 ──

const TARGETS = [
  // 잡몹 2종 (48x48)
  {
    id: 'battle_robot',
    outputPath: 'enemies/battle_robot.png',
    targetSize: 48,
    prompt: `${COMMON_STYLE}
Hovering armored war drone, top-down view, NO legs NO arms NO humanoid features.
Round heavily armored chassis with thick red (#BB4444) neon armor plates,
floating anti-gravity ring underneath glowing red, two side-mounted weapon barrels,
single menacing red sensor eye on top, dark metallic body with red neon edge glow.
Symmetrical radial design that looks natural from any viewing angle.`,
  },
  {
    id: 'heavy_bot',
    outputPath: 'enemies/heavy_bot.png',
    targetSize: 48,
    prompt: `${COMMON_STYLE}
Massive hovering siege sphere, top-down view, NO legs NO treads NO humanoid features.
Giant armored orb with layered gray (#888888) metallic plating and orange neon cracks,
spinning ring of energy around the equator, heavy armor panels floating around the core,
central glowing orange reactor visible through gaps in armor.
Bulky imposing spherical silhouette, looks like a floating fortress core.`,
  },
  // 미니보스 1종 (80x80)
  {
    id: 'assault_mech',
    outputPath: 'bosses/assault_mech.png',
    targetSize: 80,
    prompt: `${COMMON_STYLE}
Large menacing hovering gunship drone, top-down view, NO legs NO arms NO humanoid features.
Wide armored disc-shaped body with dark red (#CC2222) neon trim,
four hovering weapon pods arranged symmetrically around the central body,
missile racks visible on wing-like extensions, thick front armor plating,
central cockpit replaced by a large glowing red sensor dome.
Military gunship silhouette from above, radially symmetric.`,
  },
  // 보스 1종 (128x128)
  {
    id: 'siege_titan',
    outputPath: 'bosses/siege_titan.png',
    targetSize: 128,
    prompt: `${COMMON_STYLE}
Enormous hovering dreadnought warship, top-down view, NO legs NO treads NO humanoid features.
Massive diamond-shaped armored hull with orange (#FF6600) neon energy lines across surface,
huge central cannon barrel pointing forward from the bow, flanked by smaller turrets,
layered heavy armor plating with glowing orange reactor vents on the sides,
trailing energy exhaust from rear thrusters. Imposing capital ship silhouette from above.`,
  },
];

// ── 생성 함수 ──

/**
 * 투명 배경 여부를 확인한다 (알파 채널 검사).
 * @param {Buffer} pngBuffer - PNG 이미지 버퍼
 * @returns {Promise<boolean>}
 */
async function hasTransparentBackground(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) transparentPixels++;
  }
  return transparentPixels / total > 0.3;
}

/**
 * 검정 배경을 투명으로 변환한다.
 * @param {Buffer} pngBuffer - PNG 이미지 버퍼
 * @returns {Promise<Buffer>}
 */
async function removeBlackBackground(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r < 30 && g < 30 && b < 30) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * GPT Image API로 스프라이트를 생성한다.
 * @param {Object} target - 대상 정의
 * @returns {Promise<void>}
 */
async function generateSprite(target) {
  console.log(`\n🎨 [${target.id}] 스프라이트 생성 중...`);

  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: target.prompt,
    n: 1,
    size: '1024x1024',
    background: 'transparent',
  });

  const b64 = result.data[0].b64_json;
  let pngBuf = Buffer.from(b64, 'base64');

  // 투명 배경 확인 + 폴백
  const isTransparent = await hasTransparentBackground(pngBuf);
  if (!isTransparent) {
    console.log(`  ⚠️ 투명 배경 감지 실패, 검정 배경 제거 적용...`);
    pngBuf = await removeBlackBackground(pngBuf);
  }

  // 타겟 크기로 리사이즈
  const outPath = path.join(SPRITES_ROOT, target.outputPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp(pngBuf)
    .resize(target.targetSize, target.targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);

  console.log(`  ✅ [${target.id}] → ${target.outputPath} (${target.targetSize}x${target.targetSize})`);
}

// ── main ──

async function main() {
  console.log('=== 휴머노이드 적 스프라이트 재생성 (4종) ===\n');

  let success = 0;
  let fail = 0;

  for (const target of TARGETS) {
    try {
      await generateSprite(target);
      success++;
    } catch (err) {
      console.error(`  ❌ [${target.id}] 실패:`, err.message);
      fail++;
    }
    // Rate limit 대응
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== 완료: ${success} 성공, ${fail} 실패 ===`);
}

main().catch(console.error);
