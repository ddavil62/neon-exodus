/**
 * @fileoverview 캐릭터별 8방향 걷기 애니메이션 스프라이트시트 생성 스크립트 (v2).
 *
 * GPT Image API(gpt-image-1)로 idle(1장) + walk(5방향 x 3유니크프레임 = 15장) PNG를 개별 생성하고,
 * sharp로 idle은 48x48, walk은 240x192 스프라이트시트로 합성한다.
 *
 * v2 개선점:
 * - agent 포함 6종 전체 생성 (기존: agent 제외 5종)
 * - 프레임 0/2 중복 제거: neutral 포즈 1회 생성 → 프레임 0, 2에 복사 (일관성 보장)
 * - 방향 프롬프트 강화: 캐릭터 체형·시선·바디 앵글을 구체적으로 제약
 * - 나머지 3방향(down-left, left, up-left)은 Player.js에서 flipX로 처리
 *
 * 실행:
 *   node scripts/generate-walk-anim.js               # 6종 전체 생성
 *   node scripts/generate-walk-anim.js --char sniper  # 특정 캐릭터만 생성
 *   node scripts/generate-walk-anim.js --char agent   # agent만 생성
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
 * 모든 캐릭터에 공통 적용되는 기본 스타일 지시문.
 * @type {string}
 */
const BASE_STYLE = `Single game character sprite, top-down 3/4 perspective view, cyberpunk neon style, clean vector art with smooth outlines, dark transparent background, character centered in frame, full body visible, no text, no UI elements, no extra objects.`;

// ── 캐릭터별 정의 (agent 포함 6종) ──

/**
 * 캐릭터별 스프라이트 생성 정의.
 * spriteKey: idle 텍스처 저장명, walkKey: walk 스프라이트시트 저장명.
 * @type {Object<string, Object>}
 */
const CHARACTER_DEFS = {
  agent: {
    charDesc: `Neon cyan (#00FFFF) cyber soldier. Medium athletic build. Sleek futuristic combat helmet with glowing cyan T-shaped visor. Compact tactical armor with cyan energy lines on chest and shoulders. Short armored boots. Cyan (#00FFFF) primary color, white secondary highlights, dark grey armor base.`,
    color: '#00FFFF',
    spriteKey: 'player',
    walkKey: 'player_walk',
  },
  sniper: {
    charDesc: `Neon green (#39FF14) sniper. Slim tall build. Long-range scope helmet with single glowing green eye lens on right side. Lightweight tactical coat with trailing edges. Slender legs with knee guards. Green (#39FF14) primary color, white highlights.`,
    color: '#39FF14',
    spriteKey: 'sniper',
    walkKey: 'sniper_walk',
  },
  engineer: {
    charDesc: `Yellow (#FFD700) engineer. Stocky wide build with large tech backpack and antenna on back. Engineer goggles with orange HUD glow. Utility belt with tool pouches around waist. Heavy boots. Yellow (#FFD700) primary color, white highlights.`,
    color: '#FFD700',
    spriteKey: 'engineer',
    walkKey: 'engineer_walk',
  },
  berserker: {
    charDesc: `Red (#FF3333) berserker. Massive broad-shouldered build, largest of all characters. Thick heavy combat armor with spiked shoulder pads. Horned helmet with red glowing visor slit. Huge gauntlets on both hands. Red (#FF3333) primary color, white highlights.`,
    color: '#FF3333',
    spriteKey: 'berserker',
    walkKey: 'berserker_walk',
  },
  medic: {
    charDesc: `White and green (#00FF88) medic. Slim agile build. White armor with medical cross (+) symbol on chest plate. Small medical backpack with green glow. Lightweight leg armor. White primary color, neon green (#00FF88) accent glow.`,
    color: '#00FF88',
    spriteKey: 'medic',
    walkKey: 'medic_walk',
  },
  hidden: {
    charDesc: `Purple (#AA00FF) phantom. Medium build concealed under flowing hooded cloak. Only glowing purple eyes visible under deep hood. Cloak drapes to mid-calf with ethereal purple edge glow. No visible limbs except feet. Purple (#AA00FF) primary color, deep violet shadows.`,
    color: '#AA00FF',
    spriteKey: 'hidden',
    walkKey: 'hidden_walk',
  },
};

// ── 5방향 정의 (강화된 앵글 설명) ──

/**
 * 5방향별 세부 앵글 프롬프트.
 * bodyAngle로 캐릭터의 정확한 체형 방향을 강제한다.
 * @type {Array<{name: string, dirPrompt: string}>}
 */
const DIRECTIONS = [
  {
    name: 'down',
    dirPrompt: `Character faces DIRECTLY DOWN toward the viewer. Front view - viewer sees the character's face/visor, chest, and front of legs. Body oriented at 0 degrees (straight toward camera). Both shoulders equally visible. Symmetrical front-facing pose.`,
  },
  {
    name: 'down_right',
    dirPrompt: `Character faces DOWN-RIGHT at 45 degree angle. Three-quarter front view - viewer sees mostly the character's front-left side. Left shoulder closer to viewer, right shoulder further away. Head/visor turned toward bottom-right corner. Body rotated 45 degrees clockwise from front view.`,
  },
  {
    name: 'right',
    dirPrompt: `Character faces DIRECTLY RIGHT. Perfect side profile view - viewer sees only the character's left side. Head pointing right. One arm and one leg visible. Body oriented at 90 degrees (perpendicular to camera, facing right).`,
  },
  {
    name: 'up_right',
    dirPrompt: `Character faces UP-RIGHT at 45 degree angle. Three-quarter BACK view - viewer sees mostly the character's back-left side. Character's back partially visible. Head/visor turned toward top-right corner. Body rotated 45 degrees showing back.`,
  },
  {
    name: 'up',
    dirPrompt: `Character faces DIRECTLY UP away from the viewer. Full back view - viewer sees the character's back, back of helmet, and back of legs. Body oriented at 180 degrees (facing away from camera). Both shoulders equally visible from behind.`,
  },
];

// ── 3종 유니크 프레임 포즈 ──

/**
 * 3종 유니크 걷기 포즈. 프레임 0/2는 neutral(동일), 1은 left-step, 3은 right-step.
 * @type {Object<string, string>}
 */
const UNIQUE_POSES = {
  neutral: `Standing neutral pose. Both feet flat on ground, shoulder-width apart. Arms at sides, relaxed. Weight evenly distributed. Stable balanced stance.`,
  leftStep: `Walking mid-stride pose. LEFT foot stepped forward, right foot behind. Left arm swings back, right arm swings forward. Slight forward lean. Character in motion.`,
  rightStep: `Walking mid-stride pose. RIGHT foot stepped forward, left foot behind. Right arm swings back, left arm swings forward. Slight forward lean. Character in motion.`,
};

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
 * 이미지에 투명 배경이 적용되었는지 확인한다.
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

/**
 * GPT Image API를 호출하고 투명 배경 처리 후 48x48 PNG로 저장한다.
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {string} outputPath - 출력 파일 경로
 * @param {string} label - 로그용 라벨
 * @returns {Promise<string>} 저장된 파일 경로
 */
async function generateAndSave(prompt, outputPath, label) {
  console.log(`  [${label}] GPT Image API 호출 중...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
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
    console.log(`  [${label}] 투명 배경 미감지, 폴백 투명화 적용...`);
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

  console.log(`  [${label}] 저장 완료`);
  return outputPath;
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

// ── 스프라이트시트 합성 ──

/**
 * 20개 프레임 파일을 240x192 스프라이트시트로 합성한다.
 *
 * 레이아웃: 5열(방향) x 4행(프레임)
 * - 열(col) = 방향 인덱스 (0=down, 1=down_right, 2=right, 3=up_right, 4=up)
 * - 행(row) = 프레임 인덱스 (0~3)
 *
 * @param {string} charId - 캐릭터 ID
 * @param {string} walkKey - 출력 파일명 (확장자 제외)
 * @param {string[][]} framePaths - framePaths[방향인덱스][프레임인덱스] = 파일 경로
 * @returns {Promise<void>}
 */
async function composeSpritesheet(charId, walkKey, framePaths) {
  const outputPath = path.join(SPRITES_ROOT, `${walkKey}.png`);

  console.log(`\n[${charId}] 스프라이트시트 합성 중...`);

  const compositeInputs = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
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

  console.log(`[${charId}] 스프라이트시트 저장: assets/sprites/${walkKey}.png (240x192)`);
}

// ── 단일 캐릭터 전체 생성 ──

/**
 * 지정 캐릭터의 idle + walk 프레임 + 스프라이트시트를 순차 생성한다.
 *
 * v2 전략:
 * - 각 방향마다 3종 유니크 프레임만 생성 (neutral, leftStep, rightStep)
 * - 프레임 0 = neutral, 프레임 1 = leftStep, 프레임 2 = neutral(복사), 프레임 3 = rightStep
 * - 이로써 프레임 0/2가 픽셀 동일 → 깜빡임 절반 제거
 *
 * @param {string} charId - 캐릭터 ID
 * @param {Object} charDef - CHARACTER_DEFS의 캐릭터 정의
 * @returns {Promise<{success: number, fail: number, failed: string[]}>}
 */
async function generateCharacter(charId, charDef) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${charId}] 캐릭터 에셋 생성 시작 (색상: ${charDef.color})`);
  console.log(`${'='.repeat(60)}`);

  let successCount = 0;
  let failCount = 0;
  const failedFrames = [];

  const charFramesDir = path.join(FRAMES_DIR, charId === 'agent' ? '' : charId);
  if (!fs.existsSync(charFramesDir)) {
    fs.mkdirSync(charFramesDir, { recursive: true });
  }

  // ── 1. idle 스프라이트 생성 ──
  const idlePath = path.join(SPRITES_ROOT, `${charDef.spriteKey}.png`);
  const idlePrompt = `${BASE_STYLE}\n${charDef.charDesc}\nCharacter faces DIRECTLY DOWN toward the viewer. Front view. Standing idle pose, relaxed, arms at sides.`;

  try {
    await generateAndSave(idlePrompt, idlePath, `${charId}/idle`);
    successCount++;
  } catch (err) {
    failCount++;
    failedFrames.push(`${charId}_idle`);
    console.error(`  [${charId}/idle] 생성 실패: ${err.message}`);
  }

  await sleep(1500);

  // ── 2. walk 프레임 생성 (방향당 3유니크 → 4프레임) ──
  const framePaths = []; // framePaths[dirIdx][frameIdx]

  for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
    const dir = DIRECTIONS[dirIdx];
    const dirFramePaths = []; // 4개 프레임 경로

    console.log(`\n[${charId}] 방향: ${dir.name} (${dirIdx + 1}/5)`);

    // 프레임 0 (neutral) 생성
    const neutralPath = path.join(charFramesDir, `${dir.name}_0.png`);
    const neutralPrompt = `${BASE_STYLE}\n${charDef.charDesc}\n${dir.dirPrompt}\n${UNIQUE_POSES.neutral}`;

    try {
      await generateAndSave(neutralPrompt, neutralPath, `${charId}/${dir.name}_0 (neutral)`);
      successCount++;
    } catch (err) {
      failCount++;
      failedFrames.push(`${charId}/${dir.name}_0`);
      console.error(`  [${charId}/${dir.name}_0] 생성 실패: ${err.message}`);
      await _writeFallback(neutralPath);
    }
    dirFramePaths.push(neutralPath);

    await sleep(1500);

    // 프레임 1 (leftStep) 생성
    const leftStepPath = path.join(charFramesDir, `${dir.name}_1.png`);
    const leftStepPrompt = `${BASE_STYLE}\n${charDef.charDesc}\n${dir.dirPrompt}\n${UNIQUE_POSES.leftStep}`;

    try {
      await generateAndSave(leftStepPrompt, leftStepPath, `${charId}/${dir.name}_1 (leftStep)`);
      successCount++;
    } catch (err) {
      failCount++;
      failedFrames.push(`${charId}/${dir.name}_1`);
      console.error(`  [${charId}/${dir.name}_1] 생성 실패: ${err.message}`);
      await _writeFallback(leftStepPath);
    }
    dirFramePaths.push(leftStepPath);

    await sleep(1500);

    // 프레임 2 = 프레임 0 복사 (neutral, 픽셀 동일)
    const frame2Path = path.join(charFramesDir, `${dir.name}_2.png`);
    try {
      fs.copyFileSync(neutralPath, frame2Path);
      console.log(`  [${charId}/${dir.name}_2] = 프레임 0 복사 (neutral 동일)`);
      // 복사이므로 API 호출 없음, 성공 카운트 증가하지 않음
    } catch (err) {
      console.error(`  [${charId}/${dir.name}_2] 복사 실패: ${err.message}`);
      await _writeFallback(frame2Path);
    }
    dirFramePaths.push(frame2Path);

    // 프레임 3 (rightStep) 생성
    const rightStepPath = path.join(charFramesDir, `${dir.name}_3.png`);
    const rightStepPrompt = `${BASE_STYLE}\n${charDef.charDesc}\n${dir.dirPrompt}\n${UNIQUE_POSES.rightStep}`;

    try {
      await generateAndSave(rightStepPrompt, rightStepPath, `${charId}/${dir.name}_3 (rightStep)`);
      successCount++;
    } catch (err) {
      failCount++;
      failedFrames.push(`${charId}/${dir.name}_3`);
      console.error(`  [${charId}/${dir.name}_3] 생성 실패: ${err.message}`);
      await _writeFallback(rightStepPath);
    }
    dirFramePaths.push(rightStepPath);

    await sleep(1500);

    framePaths.push(dirFramePaths);
  }

  // ── 3. 스프라이트시트 합성 ──
  try {
    await composeSpritesheet(charId, charDef.walkKey, framePaths);
  } catch (err) {
    console.error(`[${charId}] 스프라이트시트 합성 실패:`, err.message);
  }

  const totalUnique = 1 + (5 * 3); // idle 1 + 방향5 × 유니크3
  console.log(`\n[${charId}] 완료: API 성공 ${successCount} / 실패 ${failCount} (유니크 ${totalUnique}장, 복사 5장)`);

  return { success: successCount, fail: failCount, failed: failedFrames };
}

/**
 * 실패 시 48x48 투명 폴백 PNG를 생성한다.
 * @param {string} filePath - 출력 경로
 * @private
 */
async function _writeFallback(filePath) {
  await sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 128 },
    },
  })
    .png()
    .toFile(filePath);
}

// ── 메인 실행 ──

/**
 * --char 옵션으로 단일 캐릭터 또는 전체 6종을 순차 생성한다.
 * API Rate Limit 대응으로 호출 간 1.5초, 캐릭터 간 3초 대기한다.
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
    if (!CHARACTER_DEFS[targetChar]) {
      console.error(`알 수 없는 캐릭터: ${targetChar}. 사용 가능: ${Object.keys(CHARACTER_DEFS).join(', ')}`);
      process.exit(1);
    }
    charEntries = [[targetChar, CHARACTER_DEFS[targetChar]]];
  } else {
    charEntries = Object.entries(CHARACTER_DEFS);
  }

  const totalChars = charEntries.length;
  const apiCallsPerChar = 1 + (5 * 3); // idle 1 + 방향5 × 유니크프레임3
  const totalApiCalls = totalChars * apiCallsPerChar;

  console.log('=== NEON EXODUS 캐릭터 스프라이트 생성 v2 ===');
  console.log(`대상 캐릭터: ${charEntries.map(([id]) => id).join(', ')}`);
  console.log(`예상 GPT Image API 호출: ${totalApiCalls}회 (${totalChars}캐릭터 x ${apiCallsPerChar}유니크)`);
  console.log(`프레임 0/2 중복 제거 적용: 프레임 0 = 프레임 2 (neutral 포즈 복사)\n`);

  let totalSuccess = 0;
  let totalFail = 0;
  const allFailed = [];

  for (let i = 0; i < charEntries.length; i++) {
    const [charId, charDef] = charEntries[i];
    const result = await generateCharacter(charId, charDef);
    totalSuccess += result.success;
    totalFail += result.fail;
    allFailed.push(...result.failed);

    // 캐릭터 간 3초 추가 대기
    if (i < charEntries.length - 1) {
      console.log('\n캐릭터 간 3초 대기...');
      await sleep(3000);
    }
  }

  // 최종 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('전체 스프라이트 생성 완료');
  console.log('='.repeat(60));
  console.log(`API 호출 성공: ${totalSuccess} / 실패: ${totalFail} / 예상: ${totalApiCalls}`);

  if (allFailed.length > 0) {
    console.log(`실패 목록: ${allFailed.join(', ')}`);
  }

  console.log('\n임시 프레임 파일 보존: assets/sprites/walk_frames/{charId}/');
}

main().catch((err) => {
  console.error('스프라이트 생성 치명 오류:', err);
  process.exit(1);
});
