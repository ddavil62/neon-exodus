/**
 * @fileoverview Neon Exodus 앱 아이콘 생성 스크립트.
 * Canvas API로 사이버펑크 스타일 앱 아이콘을 생성하고 각 해상도별 PNG로 저장한다.
 * 실행: node scripts/generate-app-icon.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ── Android mipmap 사이즈 정의 ──
const SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192,
  'playstore': 512,
  'web': 1024,
};

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');

/**
 * 사이버펑크 스타일 앱 아이콘을 Canvas에 렌더링한다.
 * @param {number} size - 아이콘 크기 (px)
 * @returns {Buffer} PNG 버퍼
 */
function renderIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size; // 축약

  // ── 배경: 다크 그라디언트 ──
  const bgGrad = ctx.createLinearGradient(0, 0, s, s);
  bgGrad.addColorStop(0, '#0a0a1a');
  bgGrad.addColorStop(0.5, '#0d1025');
  bgGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bgGrad;

  // 둥근 사각형 (Android Adaptive Icon용)
  const r = s * 0.18;
  roundRect(ctx, 0, 0, s, s, r);
  ctx.fill();

  // ── 배경 그리드 패턴 ──
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.06)';
  ctx.lineWidth = Math.max(1, s * 0.002);
  const gridStep = s / 12;
  for (let i = 0; i <= 12; i++) {
    const pos = i * gridStep;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(s, pos);
    ctx.stroke();
  }

  // ── 외곽 네온 테두리 ──
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = Math.max(2, s * 0.015);
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = s * 0.06;
  roundRect(ctx, s * 0.04, s * 0.04, s * 0.92, s * 0.92, r * 0.8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── 중앙 "N" 심볼 (네온 스타일) ──
  const cx = s * 0.5;
  const cy = s * 0.46;
  const letterH = s * 0.38;
  const letterW = s * 0.28;
  const thick = Math.max(3, s * 0.055);

  // N 글자 경로
  ctx.beginPath();
  // 왼쪽 세로
  ctx.moveTo(cx - letterW / 2, cy + letterH / 2);
  ctx.lineTo(cx - letterW / 2, cy - letterH / 2);
  // 대각선
  ctx.lineTo(cx + letterW / 2, cy + letterH / 2);
  // 오른쪽 세로
  ctx.lineTo(cx + letterW / 2, cy - letterH / 2);

  // 네온 글로우 (바깥)
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = thick + Math.max(2, s * 0.025);
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = s * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 네온 코어 (안쪽 밝은 색)
  ctx.strokeStyle = '#b0f0ff';
  ctx.lineWidth = thick * 0.5;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = s * 0.03;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── "EXODUS" 텍스트 (하단) ──
  const fontSize = Math.max(6, s * 0.09);
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${s * 0.02}px`;

  // 텍스트 글로우
  ctx.shadowColor = '#ff00aa';
  ctx.shadowBlur = s * 0.04;
  ctx.fillStyle = '#ff2ec4';
  ctx.fillText('EXODUS', cx, cy + letterH / 2 + s * 0.04);

  // 텍스트 코어
  ctx.shadowColor = '#ff88dd';
  ctx.shadowBlur = s * 0.015;
  ctx.fillStyle = '#ffcce8';
  ctx.fillText('EXODUS', cx, cy + letterH / 2 + s * 0.04);
  ctx.shadowBlur = 0;

  // ── 장식 요소: 코너 도트 ──
  const dotR = Math.max(1.5, s * 0.012);
  const dotOffset = s * 0.1;
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = s * 0.02;

  // 네 코너에 작은 도트
  [[dotOffset, dotOffset], [s - dotOffset, dotOffset],
   [dotOffset, s - dotOffset], [s - dotOffset, s - dotOffset]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── 장식: 상단/하단 얇은 라인 ──
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 0, 170, 0.3)';
  ctx.lineWidth = Math.max(1, s * 0.004);

  // 상단 라인
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.12);
  ctx.lineTo(s * 0.85, s * 0.12);
  ctx.stroke();

  // 하단 라인
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.88);
  ctx.lineTo(s * 0.85, s * 0.88);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

/**
 * 둥근 사각형 경로를 그린다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - 모서리 반지름
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── 메인 실행 ──
function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Neon Exodus 앱 아이콘 생성 시작...\n');

  for (const [name, size] of Object.entries(SIZES)) {
    const buffer = renderIcon(size);
    const filename = `ic_launcher_${name}_${size}x${size}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`  ✅ ${filename} (${size}x${size})`);
  }

  // 기본 아이콘 (512x512)도 별도 저장
  const mainBuffer = renderIcon(512);
  const mainPath = path.join(OUTPUT_DIR, 'ic_launcher.png');
  fs.writeFileSync(mainPath, mainBuffer);
  console.log(`  ✅ ic_launcher.png (512x512 기본)\n`);

  console.log(`생성 완료! 경로: ${OUTPUT_DIR}`);
  console.log('\nAndroid 적용 시:');
  console.log('  mipmap-mdpi/ic_launcher.png    ← 48x48');
  console.log('  mipmap-hdpi/ic_launcher.png    ← 72x72');
  console.log('  mipmap-xhdpi/ic_launcher.png   ← 96x96');
  console.log('  mipmap-xxhdpi/ic_launcher.png  ← 144x144');
  console.log('  mipmap-xxxhdpi/ic_launcher.png ← 192x192');
  console.log('  Play Store 등록용             ← 512x512');
}

main();
