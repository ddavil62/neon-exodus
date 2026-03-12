/**
 * @fileoverview Play Console 내부 테스트 자동 배포 스크립트.
 * GitHub Actions에서 빌드 후 AAB를 내부 테스트 트랙에 업로드 및 출시한다.
 *
 * 사용법:
 *   node scripts/play-deploy.cjs <aab-path>
 *
 * 환경변수:
 *   PLAY_SERVICE_ACCOUNT_JSON — 서비스 계정 JSON 문자열 (CI용)
 *   또는 ../secrets/play-service-account.json 파일 (로컬용)
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const PACKAGE_NAME = 'com.antigravity.neonexodus';

async function main() {
  const aabPath = process.argv[2];
  if (!aabPath || !fs.existsSync(aabPath)) {
    console.error('❌ AAB 파일 경로를 지정하세요: node scripts/play-deploy.cjs <path-to.aab>');
    process.exit(1);
  }

  console.log(`📦 AAB: ${aabPath} (${(fs.statSync(aabPath).size / 1024 / 1024).toFixed(1)}MB)`);

  // ── 인증 ──
  let auth;
  if (process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    // CI 환경: 환경변수에서 JSON 직접 읽기
    const credentials = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    console.log('🔑 인증: 환경변수 (CI)');
  } else {
    // 로컬 환경: 파일에서 읽기
    const keyPath = path.join(__dirname, '..', '..', 'secrets', 'play-service-account.json');
    if (!fs.existsSync(keyPath)) {
      console.error('❌ 서비스 계정 키 없음:', keyPath);
      process.exit(1);
    }
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    console.log('🔑 인증: 로컬 키 파일');
  }

  const api = google.androidpublisher({ version: 'v3', auth });

  try {
    // ── 1. 편집 세션 생성 ──
    const edit = await api.edits.insert({ packageName: PACKAGE_NAME, requestBody: {} });
    const editId = edit.data.id;
    console.log('📝 편집 세션:', editId);

    // ── 2. AAB 업로드 ──
    console.log('⬆️ AAB 업로드 중...');
    const upload = await api.edits.bundles.upload({
      packageName: PACKAGE_NAME,
      editId,
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(aabPath),
      },
    });
    const versionCode = upload.data.versionCode;
    console.log(`✅ 업로드 완료 — versionCode: ${versionCode}`);

    // ── 3. 내부 테스트 트랙에 출시 ──
    console.log('🚀 내부 테스트 트랙에 출시 중...');
    await api.edits.tracks.update({
      packageName: PACKAGE_NAME,
      editId,
      track: 'internal',
      requestBody: {
        track: 'internal',
        releases: [{
          status: 'completed',
          versionCodes: [String(versionCode)],
          releaseNotes: [
            { language: 'ko-KR', text: `빌드 v${versionCode}` },
            { language: 'en-US', text: `Build v${versionCode}` },
          ],
        }],
      },
    });

    // ── 4. 커밋 ──
    await api.edits.commit({ packageName: PACKAGE_NAME, editId });
    console.log(`\n🎉 내부 테스트 배포 완료! (versionCode: ${versionCode})`);
    console.log('   테스터 기기에서 Play Store 업데이트 가능.');

  } catch (err) {
    console.error('❌ 배포 실패:', err.message);
    if (err.response?.data) {
      console.error('   상세:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
