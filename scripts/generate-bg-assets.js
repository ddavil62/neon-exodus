/**
 * @fileoverview 배경 타일 4종 + 장식 오브젝트 16종 에셋 생성 스크립트.
 *
 * GPT Image API(gpt-image-1)를 사용하여 배경 리디자인 에셋 20종을 생성한다.
 * - 배경 타일 4종 (128x128, seamless, 배경 제거 안 함)
 * - 장식 오브젝트 16종 (투명 배경, 다양한 크기)
 *
 * generate-phase3-assets.js와 동일한 파이프라인 패턴을 따른다.
 *
 * 실행: node scripts/generate-bg-assets.js
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

// ── 에셋 정의 (배경 타일 4종 + 장식 오브젝트 16종 = 20종) ──

/**
 * 배경 리디자인 에셋 목록.
 * isBgTile: true인 에셋은 배경 제거를 하지 않는다.
 * @type {Array<{key: string, outputPath: string, finalW: number, finalH: number, prompt: string, isBgTile?: boolean}>}
 */
const BG_ASSETS = [
  // ── 배경 타일 4종 (128x128, seamless) — 배경 제거 스킵 ──

  {
    key: 'bg_tile',
    outputPath: 'backgrounds/bg_tile.png',
    finalW: 128,
    finalH: 128,
    isBgTile: true,
    prompt: 'seamless dark cyberpunk city floor tile, 128x128 pixels, very dark navy-blue base color #0C0C18, subtle diagonal crack lines in slightly lighter shade, faint cyan (#00FFFF) dashed road marking lines at 12% opacity, small manhole cover circle outline in center at 8% opacity, top-down orthographic view, minimalist clean design, must be perfectly tileable, no text, no bright elements, very dark and muted overall',
  },
  {
    key: 'bg_tile_s2',
    outputPath: 'backgrounds/bg_tile_s2.png',
    finalW: 128,
    finalH: 128,
    isBgTile: true,
    prompt: 'seamless dark industrial metal floor tile, 128x128 pixels, very dark brownish base #0E0A06, steel grid plate pattern with 32px cells, bolt dots at grid intersections, faint orange (#FF6600) diagonal hazard stripes at 10% opacity in one corner, top-down orthographic view, minimalist clean design, must be perfectly tileable, no text, very dark and muted overall',
  },
  {
    key: 'bg_tile_s3',
    outputPath: 'backgrounds/bg_tile_s3.png',
    finalW: 128,
    finalH: 128,
    isBgTile: true,
    prompt: 'seamless dark server room PCB circuit board floor tile, 128x128 pixels, very dark indigo base #06040E, thin right-angle circuit trace lines in purple (#8800FF) at 15% opacity, small via dots at line endpoints, faint IC chip rectangle outlines, top-down orthographic view, minimalist clean design, must be perfectly tileable, no text, very dark and muted overall',
  },
  {
    key: 'bg_tile_s4',
    outputPath: 'backgrounds/bg_tile_s4.png',
    finalW: 128,
    finalH: 128,
    isBgTile: true,
    prompt: 'seamless dark energy core hexagonal grid floor tile, 128x128 pixels, near-black dark green base #010801, hexagonal cell grid pattern in green (#00FF44) at 10% opacity, small energy dot in each hex center at 18% opacity, faint radial lines from vertices, top-down orthographic view, minimalist clean design, must be perfectly tileable, no text, very dark and muted overall',
  },

  // ── 장식 오브젝트 16종 (투명 배경) ──
  // 픽셀아트 스타일, 스테이지 색상 계열, 뚜렷한 실루엣

  // S1 도시 외곽 (시안 네온 계열)
  {
    key: 'deco_s1_lamppost',
    outputPath: 'sprites/decos/deco_s1_lamppost.png',
    finalW: 24,
    finalH: 72,
    prompt: 'pixel art broken street lamp post, cyberpunk neon style, medium-dark cyan blue color #4466AA, thin metal pole with tilted lamp head emitting faint glow at top, visible cracks and rust, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s1_car',
    outputPath: 'sprites/decos/deco_s1_car.png',
    finalW: 56,
    finalH: 40,
    prompt: 'pixel art abandoned wrecked car top-down view, cyberpunk style, medium-dark steel blue #556688, rectangular sedan shape with smashed windshield, dented roof, visible rust patches, one tire missing, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s1_manhole',
    outputPath: 'sprites/decos/deco_s1_manhole.png',
    finalW: 40,
    finalH: 40,
    prompt: 'pixel art circular manhole cover, cyberpunk style, medium gray-blue #667799, round disc with cross-hatch grid pattern and small bolts around rim, slightly ajar with faint cyan glow underneath, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s1_debris',
    outputPath: 'sprites/decos/deco_s1_debris.png',
    finalW: 48,
    finalH: 36,
    prompt: 'pixel art pile of concrete rubble and debris, cyberpunk style, medium gray-blue #556677, scattered broken concrete chunks with rebar sticking out, dust particles, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },

  // S2 산업 지구 (오렌지 계열)
  {
    key: 'deco_s2_drum',
    outputPath: 'sprites/decos/deco_s2_drum.png',
    finalW: 36,
    finalH: 40,
    prompt: 'pixel art industrial oil drum barrel, rusted metal, dark orange-brown #885533, cylindrical barrel with horizontal bands and hazard warning label, slight dent on side, leaking fluid puddle, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s2_pipe',
    outputPath: 'sprites/decos/deco_s2_pipe.png',
    finalW: 80,
    finalH: 24,
    prompt: 'pixel art broken industrial pipe segment, dark orange-brown #774422, long horizontal thick pipe with flanged joints at both ends, steam leak from a crack in the middle, rusty surface texture, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s2_crane',
    outputPath: 'sprites/decos/deco_s2_crane.png',
    finalW: 56,
    finalH: 56,
    prompt: 'pixel art collapsed construction crane wreckage, dark rust orange #886644, diagonal steel truss lattice beams fallen on ground, bent metal, scattered bolts and cables, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s2_sign',
    outputPath: 'sprites/decos/deco_s2_sign.png',
    finalW: 32,
    finalH: 40,
    prompt: 'pixel art fallen warning sign on broken pole, industrial style, yellow-orange #AA7733 triangle warning sign with exclamation mark, bent metal pole lying on ground, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },

  // S3 지하 서버 (보라 네온 계열)
  {
    key: 'deco_s3_rack',
    outputPath: 'sprites/decos/deco_s3_rack.png',
    finalW: 36,
    finalH: 56,
    prompt: 'pixel art server rack cabinet, dark purple #6644AA, tall rectangular unit with horizontal slot lines for blade servers, small LED indicator dots on front in green and red, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s3_cable',
    outputPath: 'sprites/decos/deco_s3_cable.png',
    finalW: 64,
    finalH: 20,
    prompt: 'pixel art bundle of network ethernet cables, purple #7755BB, three parallel thick cables with slight curve, connector plugs visible at ends, cable ties holding bundle together, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s3_fan',
    outputPath: 'sprites/decos/deco_s3_fan.png',
    finalW: 40,
    finalH: 40,
    prompt: 'pixel art large server cooling fan unit, dark purple #5533AA, square housing with circular fan blade pattern inside, wire mesh grill cover, small screws at corners, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s3_terminal',
    outputPath: 'sprites/decos/deco_s3_terminal.png',
    finalW: 36,
    finalH: 40,
    prompt: 'pixel art broken computer terminal monitor, purple-blue #6655AA, CRT-style square screen showing glitched static lines in purple, attached keyboard below, cracked screen corner, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },

  // S4 더 코어 (녹색 에너지 계열)
  {
    key: 'deco_s4_node',
    outputPath: 'sprites/decos/deco_s4_node.png',
    finalW: 40,
    finalH: 40,
    prompt: 'pixel art energy relay node, dark green #448844, double concentric circle rings with pulsing energy, crosshair targeting lines extending outward, faint green glow aura, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s4_pillar',
    outputPath: 'sprites/decos/deco_s4_pillar.png',
    finalW: 28,
    finalH: 64,
    prompt: 'pixel art tall data pillar column, dark green #336633, rectangular column with glowing green circuit line patterns running vertically, small data readout panels on sides, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s4_core',
    outputPath: 'sprites/decos/deco_s4_core.png',
    finalW: 44,
    finalH: 44,
    prompt: 'pixel art broken energy core fragment, dark green #448844, hexagonal crystalline structure with glowing crack lines revealing bright green energy inside, shattered corner pieces floating nearby, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
  },
  {
    key: 'deco_s4_shard',
    outputPath: 'sprites/decos/deco_s4_shard.png',
    finalW: 32,
    finalH: 32,
    prompt: 'pixel art energy crystal shard, translucent green #55AA55, irregular angular polygon crystal shape with faceted surfaces catching light, faint green glow emanating from edges, top-down overhead view, transparent background, clean sharp edges, 2D game sprite asset',
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
 * bg_tile 계열은 투명 배경 제거를 하지 않고, 장식(deco_*)은 투명 배경 폴백 적용.
 * @param {Object} asset - 에셋 정의 객체
 * @returns {Promise<boolean>} 생성 성공 여부
 */
async function generateAsset(asset) {
  console.log(`  [${asset.key}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: asset.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: asset.isBgTile ? 'auto' : 'transparent',
  });

  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  // 배경 타일은 배경 제거 불필요 (seamless 타일이므로 채워져 있어야 함)
  if (!asset.isBgTile) {
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
 * 모든 배경 리디자인 에셋을 순차적으로 생성한다.
 * GPT API 호출 간 1초 대기 (rate limit 대응).
 * 개별 실패 시 스킵하고 기존 PNG를 보존한다.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  // --deco-only 플래그: 데코 스프라이트만 재생성 (배경 타일 스킵)
  const decoOnly = process.argv.includes('--deco-only');
  const targetAssets = decoOnly ? BG_ASSETS.filter(a => !a.isBgTile) : BG_ASSETS;

  console.log('=== NEON EXODUS 배경 리디자인 에셋 생성 시작 ===');
  console.log(`에셋 ${targetAssets.length}종 생성 예정${decoOnly ? ' (데코만)' : ''}\n`);

  let successCount = 0;
  let failCount = 0;
  const failedAssets = [];

  for (let i = 0; i < targetAssets.length; i++) {
    const asset = targetAssets[i];

    try {
      const ok = await generateAsset(asset);
      if (ok) successCount++;
    } catch (err) {
      failCount++;
      failedAssets.push(asset.key);
      console.error(`  [${asset.key}] 생성 실패 (기존 PNG 보존): ${err.message}`);
    }

    // Rate limit 대응: 마지막 에셋이 아니면 1초 대기
    if (i < targetAssets.length - 1) {
      await sleep(1000);
    }
  }

  // 결과 요약 로그
  console.log('\n=== 배경 리디자인 에셋 생성 완료 ===');
  console.log(`성공: ${successCount}종 / 실패: ${failCount}종 / 전체: ${targetAssets.length}종`);

  if (failedAssets.length > 0) {
    console.log(`실패 목록: ${failedAssets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('배경 리디자인 에셋 생성 치명 오류:', err);
  process.exit(1);
});
