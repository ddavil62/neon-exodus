/**
 * @fileoverview 플레이어 8방향 걷기 애니메이션 스프라이트시트 생성 스크립트.
 *
 * GPT Image API(gpt-image-1)로 5방향 x 4프레임 = 20개 PNG를 개별 생성하고,
 * sharp로 240x192 스프라이트시트(player_walk.png)로 합성한다.
 * 나머지 3방향(down-left, left, up-left)은 Player.js에서 flipX로 처리한다.
 *
 * 실행: node scripts/generate-walk-anim.js
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
 * 걷기 애니메이션 공통 스타일 지시문.
 * 기존 player.png 프롬프트와 동일한 캐릭터 외형을 유지하여 스타일 일관성을 보장한다.
 * @type {string}
 */
const WALK_STYLE_PROMPT = `Clean vector art game sprite, top-down view, cyberpunk neon style, smooth outlines, modern 2D game aesthetic, dark transparent background, single character centered, no text, no UI elements, vibrant neon glow effects. Cyan neon warrior character, round helmet with glowing visor slit, shoulder pads on both sides, cyberpunk armor suit, cyan (#00FFFF) primary color with white highlights, futuristic soldier.`;

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

// ── 프레임 생성 함수 ──

/**
 * GPT Image API로 단일 걷기 프레임을 생성하고 48x48 PNG 파일로 저장한다.
 *
 * 1. gpt-image-1 모델로 1024x1024 이미지를 생성한다.
 * 2. 투명 배경 확인 -> 필요시 폴백 투명화 적용.
 * 3. sharp로 48x48로 리사이즈하여 저장한다.
 *
 * @param {string} dirName - 방향 이름 (예: 'down', 'right')
 * @param {string} dirPrompt - 방향별 프롬프트 보조 텍스트
 * @param {number} frameIndex - 프레임 인덱스 (0~3)
 * @returns {Promise<string>} 저장된 파일 경로
 */
async function generateFrame(dirName, dirPrompt, frameIndex) {
  const framePose = FRAME_POSES[frameIndex];
  const fullPrompt = `${WALK_STYLE_PROMPT}\n${dirPrompt}, ${framePose}`;
  const fileName = `${dirName}_${frameIndex}.png`;
  const filePath = path.join(FRAMES_DIR, fileName);

  console.log(`  [${dirName}_${frameIndex}] GPT Image API 호출 중...`);

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
    console.log(`  [${dirName}_${frameIndex}] 투명 배경 미감지, 폴백 투명화 적용...`);
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

  console.log(`  [${dirName}_${frameIndex}] 저장 완료: walk_frames/${fileName}`);
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
 * @param {string[][]} framePaths - framePaths[방향인덱스][프레임인덱스] = 파일 경로
 * @returns {Promise<void>}
 */
async function composeSpritesheet(framePaths) {
  const outputPath = path.join(SPRITES_ROOT, 'player_walk.png');

  console.log('\n스프라이트시트 합성 중...');

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

  console.log(`스프라이트시트 저장 완료: assets/sprites/player_walk.png (240x192)`);
}

// ── 메인 실행 ──

/**
 * 5방향 x 4프레임 = 20개 프레임을 순차 생성하고 스프라이트시트로 합성한다.
 * API Rate Limit 대응으로 호출 간 1초 대기한다.
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

  console.log('=== NEON EXODUS 플레이어 걷기 애니메이션 생성 시작 ===');
  console.log(`5방향 x 4프레임 = 20개 프레임 생성 예정\n`);

  // framePaths[방향인덱스][프레임인덱스] = 파일 경로
  const framePaths = [];
  let successCount = 0;
  let failCount = 0;
  const failedFrames = [];

  for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
    const dir = DIRECTIONS[dirIdx];
    const dirFramePaths = [];

    for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
      try {
        const filePath = await generateFrame(dir.name, dir.dirPrompt, frameIdx);
        dirFramePaths.push(filePath);
        successCount++;
      } catch (err) {
        const frameName = `${dir.name}_${frameIdx}`;
        failCount++;
        failedFrames.push(frameName);
        console.error(`  [${frameName}] 생성 실패: ${err.message}`);
        // 실패 시 빈 48x48 투명 PNG를 생성하여 스프라이트시트 합성이 깨지지 않도록 함
        const fallbackPath = path.join(FRAMES_DIR, `${dir.name}_${frameIdx}.png`);
        await sharp({
          create: {
            width: 48,
            height: 48,
            channels: 4,
            background: { r: 0, g: 255, b: 255, alpha: 128 },
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

  // 스프라이트시트 합성
  try {
    await composeSpritesheet(framePaths);
  } catch (err) {
    console.error('스프라이트시트 합성 실패:', err.message);
    process.exit(1);
  }

  // 결과 요약
  console.log('\n=== 걷기 애니메이션 생성 완료 ===');
  console.log(`성공: ${successCount}프레임 / 실패: ${failCount}프레임 / 전체: 20프레임`);

  if (failedFrames.length > 0) {
    console.log(`실패 목록: ${failedFrames.join(', ')}`);
  }

  console.log('\n임시 프레임 파일은 디버깅용으로 보존됩니다: assets/sprites/walk_frames/');
}

main().catch((err) => {
  console.error('걷기 애니메이션 생성 치명 오류:', err);
  process.exit(1);
});
