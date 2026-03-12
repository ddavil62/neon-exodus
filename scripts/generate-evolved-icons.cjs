/**
 * @fileoverview 진화 무기 11종 아이콘 생성 스크립트.
 * 기본 무기 아이콘과 동일한 32x32 네온 픽셀아트 스타일로 진화 무기 아이콘을 생성한다.
 * 실행: node scripts/generate-evolved-icons.cjs
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 32;
const OUT = path.join(__dirname, '..', 'assets', 'ui', 'icons');

/** 픽셀을 찍는 헬퍼 */
function px(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w || 1, h || 1);
}

/** 글로우 원 */
function glowCircle(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha || 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 진화 마크 (우상단 작은 별) */
function evoMark(ctx) {
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 3;
  // 작은 다이아몬드
  ctx.beginPath();
  ctx.moveTo(27, 2);
  ctx.lineTo(29, 5);
  ctx.lineTo(27, 8);
  ctx.lineTo(25, 5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ── 진화 무기별 아이콘 렌더링 ──

const ICONS = {
  /** 프리시전 캐논: 블래스터 강화 — 이중 포신 + 조준선 */
  precision_cannon(ctx) {
    // 글로우 배경
    glowCircle(ctx, 16, 16, 12, '#00FFFF', 0.15);
    // 포신 (두꺼운 이중)
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(6, 13, 18, 3);
    ctx.fillRect(6, 17, 18, 3);
    // 포구 하이라이트
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(23, 14, 3, 1);
    ctx.fillRect(23, 18, 3, 1);
    // 본체
    ctx.fillStyle = '#0088AA';
    ctx.fillRect(4, 12, 6, 9);
    // 조준선 (십자)
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 11); ctx.lineTo(24, 22);
    ctx.moveTo(19, 16); ctx.lineTo(29, 16);
    ctx.stroke();
    evoMark(ctx);
  },

  /** 플라즈마 스톰: 전기 체인 강화 — 번개 폭풍 */
  plasma_storm(ctx) {
    glowCircle(ctx, 16, 16, 13, '#4488FF', 0.2);
    // 중심 번개볼
    ctx.fillStyle = '#66CCFF';
    ctx.beginPath();
    ctx.arc(16, 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(16, 16, 3, 0, Math.PI * 2);
    ctx.fill();
    // 번개 가지 (8방향)
    ctx.strokeStyle = '#88DDFF';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = 8 + (i % 2) * 3;
      ctx.beginPath();
      ctx.moveTo(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5);
      ctx.lineTo(16 + Math.cos(a + 0.2) * len, 16 + Math.sin(a + 0.2) * len);
      ctx.stroke();
    }
    evoMark(ctx);
  },

  /** 핵 미사일: 미사일 강화 — 핵탄두 + 방사능 마크 */
  nuke_missile(ctx) {
    glowCircle(ctx, 16, 16, 12, '#FF6600', 0.2);
    // 미사일 몸체
    ctx.fillStyle = '#FF4400';
    ctx.fillRect(8, 13, 16, 6);
    // 탄두 (뾰족)
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.moveTo(24, 13);
    ctx.lineTo(28, 16);
    ctx.lineTo(24, 19);
    ctx.fill();
    // 꼬리 날개
    ctx.fillStyle = '#CC3300';
    ctx.fillRect(6, 11, 3, 2);
    ctx.fillRect(6, 19, 3, 2);
    // 방사능 심볼 (간단)
    ctx.fillStyle = '#FFDD00';
    ctx.beginPath();
    ctx.arc(16, 16, 2, 0, Math.PI * 2);
    ctx.fill();
    // 핵 글로우
    ctx.fillStyle = '#FFDD00';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(26, 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    evoMark(ctx);
  },

  /** 이온 캐논: 레이저건 강화 — 이중 빔 */
  ion_cannon(ctx) {
    glowCircle(ctx, 16, 16, 12, '#FFFF00', 0.15);
    // 빔 2줄
    ctx.fillStyle = '#FFFF66';
    ctx.shadowColor = '#FFFF00';
    ctx.shadowBlur = 4;
    ctx.fillRect(4, 12, 24, 2);
    ctx.fillRect(4, 18, 24, 2);
    ctx.shadowBlur = 0;
    // 빔 코어
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(4, 12.5, 24, 1);
    ctx.fillRect(4, 18.5, 24, 1);
    // 포구 원
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(6, 16, 5, 0, Math.PI * 2);
    ctx.stroke();
    evoMark(ctx);
  },

  /** 가디언 스피어: 플라즈마 오브 강화 — 5개 궤도 구체 */
  guardian_sphere(ctx) {
    glowCircle(ctx, 16, 16, 13, '#AA44FF', 0.2);
    // 중심 큰 구체
    ctx.fillStyle = '#CC66FF';
    ctx.beginPath();
    ctx.arc(16, 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EECCFF';
    ctx.beginPath();
    ctx.arc(15, 14, 2, 0, Math.PI * 2);
    ctx.fill();
    // 궤도선
    ctx.strokeStyle = 'rgba(170, 68, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.stroke();
    // 5개 작은 궤도 구체
    ctx.fillStyle = '#DD88FF';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    evoMark(ctx);
  },

  /** 하이브마인드: 드론 강화 — 5기 드론 군단 */
  hivemind(ctx) {
    glowCircle(ctx, 16, 16, 13, '#00FF66', 0.15);
    // 중심 모선
    ctx.fillStyle = '#00CC44';
    ctx.fillRect(13, 13, 6, 6);
    ctx.fillStyle = '#00FF66';
    ctx.fillRect(14, 14, 4, 4);
    // 안테나
    ctx.fillStyle = '#00FF66';
    ctx.fillRect(15.5, 10, 1, 3);
    // 4기 소형 드론 (주변)
    const dronePosArr = [[6, 6], [24, 6], [6, 24], [24, 24]];
    ctx.fillStyle = '#00AA44';
    for (const [dx, dy] of dronePosArr) {
      ctx.fillRect(dx - 2, dy - 2, 4, 4);
      // 드론 눈
      ctx.fillStyle = '#00FF66';
      ctx.fillRect(dx - 0.5, dy - 0.5, 1, 1);
      ctx.fillStyle = '#00AA44';
    }
    // 연결선
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)';
    ctx.lineWidth = 0.5;
    for (const [dx, dy] of dronePosArr) {
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }
    evoMark(ctx);
  },

  /** 퍼페추얼 EMP: EMP 강화 — 영구 펄스 링 */
  perpetual_emp(ctx) {
    // 다중 펄스 링
    for (let i = 3; i > 0; i--) {
      ctx.strokeStyle = `rgba(100, 150, 255, ${0.2 + i * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(16, 16, 4 + i * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 중심 에너지 코어
    ctx.fillStyle = '#6688FF';
    ctx.shadowColor = '#4466FF';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(16, 16, 2, 0, Math.PI * 2);
    ctx.fill();
    evoMark(ctx);
  },

  /** 팬텀 스트라이크: 포스 블레이드 강화 — 이중 잔상 검 */
  phantom_strike(ctx) {
    glowCircle(ctx, 16, 16, 13, '#00FFCC', 0.15);
    // 잔상 검 1 (반투명)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#00FFCC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 26); ctx.lineTo(22, 6);
    ctx.stroke();
    ctx.restore();
    // 잔상 검 2 (반투명)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#00FFCC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 26); ctx.lineTo(24, 6);
    ctx.stroke();
    ctx.restore();
    // 메인 검
    ctx.strokeStyle = '#00FFE5';
    ctx.shadowColor = '#00FFE5';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 26); ctx.lineTo(26, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 검 코어
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 26); ctx.lineTo(26, 6);
    ctx.stroke();
    // 가드
    ctx.fillStyle = '#00CCAA';
    ctx.fillRect(11, 20, 6, 2);
    evoMark(ctx);
  },

  /** 바이오플라즈마: 나노 스웜 강화 — 독성 구름 */
  bioplasma(ctx) {
    glowCircle(ctx, 16, 16, 14, '#44FF44', 0.2);
    // 독성 구름 (여러 원)
    const clouds = [[12, 12, 5], [20, 12, 4], [16, 18, 6], [10, 18, 4], [22, 18, 3.5]];
    ctx.fillStyle = '#33CC33';
    ctx.globalAlpha = 0.6;
    for (const [cx, cy, r] of clouds) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 독 파티클
    ctx.fillStyle = '#88FF88';
    const particles = [[8, 8], [24, 10], [6, 20], [26, 22], [16, 6], [14, 26]];
    for (const [px, py] of particles) {
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 중심 코어
    ctx.fillStyle = '#66FF66';
    ctx.beginPath();
    ctx.arc(16, 16, 3, 0, Math.PI * 2);
    ctx.fill();
    evoMark(ctx);
  },

  /** 이벤트 호라이즌: 볼텍스 캐논 강화 — 블랙홀 */
  event_horizon(ctx) {
    // 외곽 왜곡 링
    ctx.strokeStyle = '#8844DD';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.stroke();
    // 흡입 소용돌이
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(136, 68, 221, ${0.3 + i * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(16, 16, 10 - i * 3, i * 0.8, Math.PI * 1.5 + i * 0.8);
      ctx.stroke();
    }
    // 중심 블랙홀
    ctx.fillStyle = '#110022';
    ctx.beginPath();
    ctx.arc(16, 16, 5, 0, Math.PI * 2);
    ctx.fill();
    // 사건의 지평선 테두리
    ctx.strokeStyle = '#CC88FF';
    ctx.shadowColor = '#AA66FF';
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(16, 16, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 흡입 파티클
    ctx.fillStyle = '#BB77FF';
    ctx.fillRect(3, 15, 2, 1);
    ctx.fillRect(27, 16, 2, 1);
    ctx.fillRect(15, 3, 1, 2);
    ctx.fillRect(16, 27, 1, 2);
    evoMark(ctx);
  },

  /** 데스 블로썸: 리퍼 필드 강화 — 6개 회전 블레이드 */
  death_blossom(ctx) {
    glowCircle(ctx, 16, 16, 13, '#FF00AA', 0.2);
    // 6개 블레이드 (꽃잎 모양)
    ctx.fillStyle = '#FF44BB';
    ctx.shadowColor = '#FF00AA';
    ctx.shadowBlur = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(16, 16);
      ctx.rotate(a);
      // 블레이드 (삼각형)
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    // 중심 코어
    ctx.fillStyle = '#FF88CC';
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(16, 16, 2, 0, Math.PI * 2);
    ctx.fill();
    evoMark(ctx);
  },
};

// ── 메인 실행 ──

function main() {
  console.log('진화 무기 아이콘 생성 시작...\n');

  for (const [id, render] of Object.entries(ICONS)) {
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');

    // 투명 배경
    ctx.clearRect(0, 0, SIZE, SIZE);

    render(ctx);

    const filename = `weapon_${id}.png`;
    const filepath = path.join(OUT, filename);
    fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
    console.log(`  ✅ ${filename}`);
  }

  console.log(`\n생성 완료! 경로: ${OUT}`);
  console.log(`총 ${Object.keys(ICONS).length}종 진화 무기 아이콘`);
}

main();
