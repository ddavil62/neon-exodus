/**
 * @fileoverview 캐릭터별 8방향 걷기 애니메이션 스프라이트시트 생성 스크립트.
 *
 * GPT Image API(gpt-image-1)로 idle(1장) + walk(5방향 x 4프레임 = 20장) PNG를 개별 생성하고,
 * sharp로 idle은 48x48, walk은 240x192 스프라이트시트로 합성한다.
 * 나머지 3방향(down-left, left, up-left)은 Player.js에서 flipX로 처리한다.
 *
 * agent는 기존 에셋(player.png / player_walk.png)을 재사용하므로 기본 생성 대상에서 제외한다.
 *
 * 실행:
 *   node scripts/generate-walk-anim.js            # 5종 전체 생성 (agent 제외)
 *   node scripts/generate-walk-anim.js --char sniper   # 특정 캐릭터만 생성
 *
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
const FRAMES_DIR = path.join(SPRITES_ROOT, 'walk_frames');

// 루트 .env에서 API 키 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 공통 스타일 프롬프트 ──

/**
 * 모든 캐릭터에 공통 적용되는 벡터 아트 스타일 지시문.
 * @type {string}
 */
const COMMON_STYLE = `Clean vector art game sprite, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single character centered, no text, no UI elements, vibrant neon glow effects.`;

// ── 캐릭터별 정의 (agent 제외) ──

/**
 * 캐릭터별 스프라이트 생성 정의.
 * agent는 기존 에셋을 재사용하므로 포함하지 않는다.
 * @type {Object<string, {idlePrompt: string, walkStylePrompt: string, color: string}>}
 */
const CHARACTER_DEFS = {
  sniper: {
    idlePrompt: `${COMMON_STYLE}\nNeon green (#39FF14) sniper character, sleek slim build, long-range scope helmet with single glowing eye lens, lightweight tactical combat suit with long coat trailing edges, green (#39FF14) primary color with white highlights, futuristic sniper soldier, standing idle pose facing down.`,
    walkStylePrompt: `${COMMON_STYLE}\nNeon green (#39FF14) sniper character, sleek slim build, long-range scope helmet with single glowing eye lens, lightweight tactical combat suit with long coat trailing edges, green (#39FF14) primary color with white highlights.`,
    color: '#39FF14',
  },
  engineer: {
    idlePrompt: `${COMMON_STYLE}\nYellow (#FFD700) engineer character, stocky build with large tech backpack and antenna array, engineer goggles with HUD display, utility belt with pouches, yellow (#FFD700) primary color with white highlights, futuristic technician, standing idle pose facing down.`,
    walkStylePrompt: `${COMMON_STYLE}\nYellow (#FFD700) engineer character, stocky build with large tech backpack and antenna array, engineer goggles with HUD display, utility belt with pouches, yellow (#FFD700) primary color with white highlights.`,
    color: '#FFD700',
  },
  berserker: {
    idlePrompt: `${COMMON_STYLE}\nRed (#FF3333) berserker character, massive broad-shouldered build, thick heavy combat armor with spiked shoulder pads, horned helmet with red glowing visor, chunky melee fighter silhouette, red (#FF3333) primary color with white highlights, futuristic rage warrior, standing idle pose facing down.`,
    walkStylePrompt: `${COMMON_STYLE}\nRed (#FF3333) berserker character, massive broad-shouldered build, thick heavy combat armor with spiked shoulder pads, horned helmet with red glowing visor, chunky melee fighter silhouette, red (#FF3333) primary color with white highlights.`,
    color: '#FF3333',
  },
  medic: {
    idlePrompt: `${COMMON_STYLE}\nWhite and neon green (#00FF88) medic character, slim build, medical cross (+) symbol on chest armor, medical equipment backpack with syringes and heal packs, lightweight agile armor with green glow accents, white and green (#00FF88) primary colors with white highlights, futuristic field medic, standing idle pose facing down.`,
    walkStylePrompt: `${COMMON_STYLE}\nWhite and neon green (#00FF88) medic character, slim build, medical cross (+) symbol on chest armor, medical equipment backpack with syringes and heal packs, lightweight agile armor with green glow accents, white and green (#00FF88) primary colors.`,
    color: '#00FF88',
  },
  hidden: {
    idlePrompt: `${COMMON_STYLE}\nPurple (#AA00FF) mysterious hidden character, flowing hooded cloak completely concealing face, ethereal purple glow emanating from body edges, dark silhouette with only glowing purple eyes visible under hood, mysterious floating cloak effect, purple (#AA00FF) primary color with deep violet shadows, futuristic phantom, standing idle pose facing down.`,
    walkStylePrompt: `${COMMON_STYLE}\nPurple (#AA00FF) mysterious hidden character, flowing hooded cloak completely concealing face, ethereal purple glow emanating from body edges, only glowing purple eyes visible under hood, purple (#AA00FF) primary color with deep violet shadows.`,
    color: '#AA00FF',
  },
};

// ── 5방향 정의 ──

/**
 * 5방향별 프롬프트 보조 텍스트.
 * @type {Array<{name: string, dirPrompt: string}>}
 */
const DIRECTIONS = [
  { name: 'down',       dirPrompt: 'facing down toward viewer, front view, character moving downward' },
  { name: 'down_right', dirPrompt: 'facing down-right diagonal, three-quarter front view, character moving down-right' },
  { name: 'right',      dirPrompt: 'facing right, side profile view, character moving right' },
  { name: 'up_right',   dirPrompt: 'facing up-right diagonal, three-quarter back view, character moving up-right' },
  { name: 'up',         dirPrompt: 'facing up away from viewer, back view, character moving upward' },
];

/**
 * 4프레임 걷기 사이클 포즈 프롬프트.
 * neutral -> left-step -> neutral -> right-step 패턴.
 * @type {string[]}
 */
const FRAME_POSES = [
  'walking pose neutral stance, both feet on ground',
  'walking pose left foot forward, slight lean, mid-stride',
  'walking pose neutral stance, both feet on ground',
  'walking pose right foot forward, slight lean, mid-stride',
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

  return (transparentCount / totalPixels) >= 0.10;
}

// ── --char 옵션 파싱 ──

/**
 * CLI --char 옵션에서 대상 캐릭터 ID를 파싱한다.
 * @returns {string|null} 지정된 캐릭터 ID 또는 null(전체 생성)
 */
function parseCharOption() {
  const idx = process.argv.indexOf('--char');
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

// ── idle 스프라이트 생성 ──

/**
 * GPT Image API로 캐릭터 idle 스프라이트를 생성하고 48x48 PNG로 저장한다.
 *
 * @param {string} charId - 캐릭터 ID (예: 'sniper')
 * @param {Object} charDef - CHARACTER_DEFS에서 가져온 캐릭터 정의
 * @returns {Promise<string>} 저장된 파일 경로
 */
async function generateIdleSprite(charId, charDef) {
  const outputPath = path.join(SPRITES_ROOT, `${charId}.png`);

  console.log(`  [${charId}] idle 스프라이트 GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: charDef.idlePrompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
  });

  const base64 = response.data[0].b64_json;
  let imgBuffer = Buffer.from(base64, 'base64');

  // 투명 배경 확인 및 폴백 처리
  const isTransparent = await hasTransparentBackground(imgBuffer);
  if (!isTransparent) {
    console.log(`  [${charId}] idle 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 48x48로 리사이즈하여 저장
  await sharp(imgBuffer)
    .resize(48, 48, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);

  console.log(`  [${charId}] idle 저장 완료: assets/sprites/${charId}.png`);
  return outputPath;
}

// ── 프레임 생성 함수 ──

/**
 * GPT Image API로 단일 걷기 프레임을 생성하고 48x48 PNG 파일로 저장한다.
 *
 * 1. gpt-image-1 모델로 1024x1024 이미지를 생성한다.
 * 2. 투명 배경 확인 -> 필요시 폴백 투명화 적용.
 * 3. sharp로 48x48로 리사이즈하여 저장한다.
 *
 * @param {string} charId - 캐릭터 ID (예: 'sniper')
 * @param {string} walkStylePrompt - 캐릭터별 걷기 스타일 프롬프트
 * @param {string} dirName - 방향 이름 (예: 'down', 'right')
 * @param {string} dirPrompt - 방향별 프롬프트 보조 텍스트
 * @param {number} frameIndex - 프레임 인덱스 (0~3)
 * @returns {Promise<string>} 저장된 파일 경로
 */
async function generateFrame(charId, walkStylePrompt, dirName, dirPrompt, frameIndex) {
  const framePose = FRAME_POSES[frameIndex];
  const fullPrompt = `${walkStylePrompt}\n${dirPrompt}, ${framePose}`;
  const fileName = `${dirName}_${frameIndex}.png`;
  const charFramesDir = path.join(FRAMES_DIR, charId);
  const filePath = path.join(charFramesDir, fileName);

  // 캐릭터별 프레임 디렉토리 생성
  if (!fs.existsSync(charFramesDir)) {
    fs.mkdirSync(charFramesDir, { recursive: true });
  }

  console.log(`  [${charId}/${dirName}_${frameIndex}] GPT Image API 호출 중...`);

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

  // 투명 배경 확인 및 폴백 처리
  const isTransparent = await hasTransparentBackground(imgBuffer);
  if (!isTransparent) {
    console.log(`  [${charId}/${dirName}_${frameIndex}] 투명 배경 미감지, 폴백 투명화 적용...`);
    imgBuffer = await removeBackground(imgBuffer);
  }

  // 48x48로 리사이즈하여 저장
  await sharp(imgBuffer)
    .resize(48, 48, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(filePath);

  console.log(`  [${charId}/${dirName}_${frameIndex}] 저장 완료: walk_frames/${charId}/${fileName}`);
  return filePath;
}

// ── 스프라이트시트 합성 ──

/**
 * 20개 개별 프레임을 240x192 스프라이트시트로 합성한다.
 *
 * 레이아웃: 5열(방향) x 4행(프레임)
 * - 열(col) = 방향 인덱스 (0=down, 1=down_right, 2=right, 3=up_right, 4=up)
 * - 행(row) = 프레임 인덱스 (0~3)
 *
 * Phaser 프레임 번호 = row * 5 + col
 *
 * @param {string} charId - 캐릭터 ID
 * @param {string[][]} framePaths - framePaths[방향인덱스][프레임인덱스] = 파일 경로
 * @returns {Promise<void>}
 */
async function composeSpritesheet(charId, framePaths) {
  const outputPath = path.join(SPRITES_ROOT, `${charId}_walk.png`);

  console.log(`\n[${charId}] 스프라이트시트 합성 중...`);

  const compositeInputs = [];
  for (let row = 0; row < 4; row++) {       // 프레임 인덱스 (0~3)
    for (let col = 0; col < 5; col++) {     // 방향 인덱스 (0~4)
      compositeInputs.push({
        input: framePaths[col][row],
        left: col * 48,
        top: row * 48,
      });
    }
  }

  await sharp({
    create: {
      width: 240,
      height: 192,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toFile(outputPath);

  console.log(`[${charId}] 스프라이트시트 저장 완료: assets/sprites/${charId}_walk.png (240x192)`);
}

// ── 단일 캐릭터 전체 생성 ──

/**
 * 지정 캐릭터의 idle + walk 프레임 + 스프라이트시트를 순차 생성한다.
 *
 * @param {string} charId - 캐릭터 ID
 * @param {Object} charDef - CHARACTER_DEFS의 캐릭터 정의
 * @returns {Promise<{success: number, fail: number, failed: string[]}>} 결과 통계
 */
async function generateCharacter(charId, charDef) {
  console.log(`\n=== [${charId}] 캐릭터 에셋 생성 시작 ===`);

  let successCount = 0;
  let failCount = 0;
  const failedFrames = [];

  // ── 1. idle 스프라이트 생성 ──
  try {
    await generateIdleSprite(charId, charDef);
    successCount++;
  } catch (err) {
    failCount++;
    failedFrames.push(`${charId}_idle`);
    console.error(`  [${charId}] idle 생성 실패: ${err.message}`);
  }

  await sleep(1000);

  // ── 2. walk 프레임 20개 생성 ──
  const charFramesDir = path.join(FRAMES_DIR, charId);
  if (!fs.existsSync(charFramesDir)) {
    fs.mkdirSync(charFramesDir, { recursive: true });
  }

  const framePaths = [];

  for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
    const dir = DIRECTIONS[dirIdx];
    const dirFramePaths = [];

    for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
      try {
        const filePath = await generateFrame(charId, charDef.walkStylePrompt, dir.name, dir.dirPrompt, frameIdx);
        dirFramePaths.push(filePath);
        successCount++;
      } catch (err) {
        const frameName = `${charId}/${dir.name}_${frameIdx}`;
        failCount++;
        failedFrames.push(frameName);
        console.error(`  [${frameName}] 생성 실패: ${err.message}`);
        // 실패 시 빈 48x48 투명 PNG를 생성하여 스프라이트시트 합성이 깨지지 않도록 함
        const fallbackPath = path.join(charFramesDir, `${dir.name}_${frameIdx}.png`);
        await sharp({
          create: {
            width: 48,
            height: 48,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 128 },
          },
        })
          .png()
          .toFile(fallbackPath);
        dirFramePaths.push(fallbackPath);
      }

      // Rate limit 대응: 마지막 프레임이 아니면 1초 대기
      const isLast = dirIdx === DIRECTIONS.length - 1 && frameIdx === 3;
      if (!isLast) {
        await sleep(1000);
      }
    }

    framePaths.push(dirFramePaths);
  }

  // ── 3. 스프라이트시트 합성 ──
  try {
    await composeSpritesheet(charId, framePaths);
  } catch (err) {
    console.error(`[${charId}] 스프라이트시트 합성 실패:`, err.message);
  }

  console.log(`\n=== [${charId}] 완료: 성공 ${successCount} / 실패 ${failCount} (idle 1 + walk 20 = 21) ===`);

  return { success: successCount, fail: failCount, failed: failedFrames };
}

// ── 메인 실행 ──

/**
 * --char 옵션으로 단일 캐릭터 또는 전체 5종(agent 제외)을 순차 생성한다.
 * API Rate Limit 대응으로 호출 간 1초, 캐릭터 간 2초 대기한다.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다. 루트 .env 파일을 확인하세요.');
    process.exit(1);
  }

  // walk_frames 디렉토리 생성
  if (!fs.existsSync(FRAMES_DIR)) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  }

  const targetChar = parseCharOption();

  // 대상 캐릭터 결정
  let charEntries;
  if (targetChar) {
    if (targetChar === 'agent') {
      console.log('agent는 기존 에셋(player.png / player_walk.png)을 재사용합니다. 생성을 건너뜁니다.');
      process.exit(0);
    }
    if (!CHARACTER_DEFS[targetChar]) {
      console.error(`알 수 없는 캐릭터: ${targetChar}. 사용 가능: ${Object.keys(CHARACTER_DEFS).join(', ')}`);
      process.exit(1);
    }
    charEntries = [[targetChar, CHARACTER_DEFS[targetChar]]];
  } else {
    charEntries = Object.entries(CHARACTER_DEFS);
  }

  const totalChars = charEntries.length;
  const totalImages = totalChars * 21; // idle 1 + walk 20

  console.log('=== NEON EXODUS 캐릭터 스프라이트 생성 시작 ===');
  console.log(`대상 캐릭터: ${charEntries.map(([id]) => id).join(', ')}`);
  console.log(`예상 GPT Image API 호출: ${totalImages}회 (${totalChars}캐릭터 x 21이미지)\n`);

  let totalSuccess = 0;
  let totalFail = 0;
  const allFailed = [];

  for (let i = 0; i < charEntries.length; i++) {
    const [charId, charDef] = charEntries[i];
    const result = await generateCharacter(charId, charDef);
    totalSuccess += result.success;
    totalFail += result.fail;
    allFailed.push(...result.failed);

    // 캐릭터 간 2초 추가 대기 (마지막 캐릭터 제외)
    if (i < charEntries.length - 1) {
      console.log('\n캐릭터 간 2초 대기...');
      await sleep(2000);
    }
  }

  // 최종 결과 요약
  console.log('\n=== 전체 스프라이트 생성 완료 ===');
  console.log(`성공: ${totalSuccess} / 실패: ${totalFail} / 전체: ${totalImages}`);

  if (allFailed.length > 0) {
    console.log(`실패 목록: ${allFailed.join(', ')}`);
  }

  console.log('\n임시 프레임 파일은 디버깅용으로 보존됩니다: assets/sprites/walk_frames/{charId}/');
}

main().catch((err) => {
  console.error('스프라이트 생성 치명 오류:', err);
  process.exit(1);
});
