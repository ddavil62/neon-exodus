/**
 * @fileoverview NineSlice 기반 UI 버튼 팩토리.
 * GPT Image로 생성한 회로 패널 프레임 에셋을 9-slice로 늘려서
 * 다양한 크기의 버튼/카드/탭을 일관된 스타일로 생성한다.
 */

// ── 9-slice 좌표 (에셋별 코너 영역 크기) ──
const SLICE_CONFIGS = {
  /** CTA 버튼 — 화려한 회로 패널 프레임 (200x82, 코너 21x17) */
  btn: { texture: 'ui_btn_frame', left: 21, right: 21, top: 17, bottom: 17 },
  /** Primary 버튼 — 글로우 라인 프레임 (200x82, 코너 16x14) */
  primary: { texture: 'ui_btn_primary', left: 16, right: 16, top: 14, bottom: 14 },
  /** Secondary 버튼 — 미니멀 얇은 라인 (200x82, 코너 14x12) */
  secondary: { texture: 'ui_btn_secondary', left: 14, right: 14, top: 12, bottom: 12 },
  /** Retry 버튼 — 시안 글로우 터미널 프레임 (200x82, 코너 18x15) */
  retry: { texture: 'ui_btn_retry', left: 18, right: 18, top: 15, bottom: 15 },
  /** Menu 버튼 — 그레이 절제 프레임 (200x82, 코너 14x12) */
  menu: { texture: 'ui_btn_menu', left: 14, right: 14, top: 12, bottom: 12 },
  /** Ad 버튼 — 앰버 글로우 프레임 (200x82, 코너 16x14) */
  ad: { texture: 'ui_btn_ad', left: 16, right: 16, top: 14, bottom: 14 },
  /** 카드/패널 프레임 (200x296) — 코너 20x21 */
  card: { texture: 'ui_card_frame', left: 20, right: 20, top: 21, bottom: 21 },
  /** 탭 프레임 (128x72) — 코너 15x10 */
  tab: { texture: 'ui_tab_frame', left: 15, right: 15, top: 10, bottom: 10 },
};

/**
 * NineSlice 버튼을 생성한다.
 * @param {Phaser.Scene} scene - 현재 씬
 * @param {number} x - 중심 X 좌표
 * @param {number} y - 중심 Y 좌표
 * @param {string} label - 버튼 텍스트
 * @param {object} [options] - 옵션
 * @param {number} [options.width=156] - 버튼 너비
 * @param {number} [options.height=52] - 버튼 높이
 * @param {string} [options.fontSize='14px'] - 폰트 크기
 * @param {string} [options.textColor='#FFFFFF'] - 텍스트 색상
 * @param {string} [options.textStroke] - 텍스트 외곽선 색상
 * @param {number} [options.textStrokeThickness=0] - 텍스트 외곽선 두께
 * @param {number} [options.tint] - 프레임 틴트 색상 (0xRRGGBB)
 * @param {number} [options.alpha=1] - 전체 알파
 * @param {string} [options.frameType='btn'] - 프레임 유형 (btn, card, tab)
 * @param {boolean} [options.disabled=false] - 비활성 상태
 * @param {Function} [options.callback] - 클릭 콜백
 * @returns {{ bg: Phaser.GameObjects.NineSlice, text: Phaser.GameObjects.Text, zone: Phaser.GameObjects.Zone }}
 */
export function createNineSliceButton(scene, x, y, label, options = {}) {
  const {
    width = 156,
    height = 52,
    fontSize = '14px',
    textColor = '#FFFFFF',
    textStroke = null,
    textStrokeThickness = 0,
    tint = null,
    alpha = 1,
    frameType = 'btn',
    disabled = false,
    callback = null,
  } = options;

  const slice = SLICE_CONFIGS[frameType] || SLICE_CONFIGS.btn;

  // NineSlice 배경
  const bg = scene.add.nineslice(
    x, y,
    slice.texture, null,
    width, height,
    slice.left, slice.right, slice.top, slice.bottom
  ).setOrigin(0.5);

  if (tint !== null) {
    bg.setTint(tint);
  }
  if (disabled) {
    bg.setTint(0x333344);
    bg.setAlpha(0.5);
  } else {
    bg.setAlpha(alpha);
  }

  // 텍스트
  const textStyle = {
    fontSize,
    fontFamily: 'Galmuri11, monospace',
    color: disabled ? '#888888' : textColor,
  };
  if (textStroke) {
    textStyle.stroke = textStroke;
    textStyle.strokeThickness = textStrokeThickness;
  }

  const text = scene.add.text(x, y, label, textStyle).setOrigin(0.5);

  if (disabled) {
    return { bg, text, zone: null };
  }

  // 인터랙션 존
  const zone = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });

  let pressed = false;
  zone.on('pointerover', () => { text.setAlpha(0.8); bg.setAlpha(alpha * 0.85); });
  zone.on('pointerout', () => { text.setAlpha(1); bg.setAlpha(alpha); pressed = false; });
  zone.on('pointerdown', () => { pressed = true; text.setAlpha(0.6); bg.setAlpha(alpha * 0.7); });
  zone.on('pointerup', () => {
    text.setAlpha(1);
    bg.setAlpha(alpha);
    if (pressed && callback) callback();
    pressed = false;
  });

  return { bg, text, zone };
}
