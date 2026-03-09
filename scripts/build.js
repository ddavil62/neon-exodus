/**
 * @fileoverview 웹 에셋을 www/ 디렉토리로 복사하는 빌드 스크립트.
 * Capacitor는 webDir(www/)을 기준으로 Android 프로젝트에 동기화한다.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'www');

// 기존 www 삭제 후 재생성
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

// 복사 대상 목록
const targets = [
  'index.html',
  'js',
  'assets',
];

for (const t of targets) {
  const src = join(ROOT, t);
  const dest = join(OUT, t);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  } else {
    console.warn(`\u26A0\uFE0F  ${t} not found, skipping.`);
  }
}

console.log('\u2705 Build complete \u2192 www/');
