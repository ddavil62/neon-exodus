/**
 * @fileoverview AudioContext 기반 프로그래매틱 SFX/BGM 시스템.
 *
 * 외부 오디오 파일 없이 오실레이터로 모든 사운드를 합성한다.
 * SFX 9종 + BGM 2곡(game, menu)을 지원한다.
 * 모바일 AudioContext unlock 패턴(resume)을 포함한다.
 */

// ── SoundSystem 클래스 ──

export default class SoundSystem {
  /** @type {AudioContext|null} AudioContext 인스턴스 */
  static _ctx = null;

  /** @type {number} SFX 볼륨 (0~1) */
  static _sfxVol = 1;

  /** @type {number} BGM 볼륨 (0~1) */
  static _bgmVol = 0.7;

  /** @type {Array|null} 현재 BGM 관련 노드/타이머 배열 */
  static _bgmNodes = null;

  /** @type {string|null} 현재 재생 중인 BGM ID */
  static _currentBgmId = null;

  /** @type {number|null} BGM 루프 인터벌 ID */
  static _bgmInterval = null;

  /** @type {boolean} BGM 활성화 여부 */
  static _bgmEnabled = true;

  /** @type {boolean} SFX 활성화 여부 */
  static _sfxEnabled = true;

  /** @type {string|null} 마지막으로 요청된 BGM ID (OFF→ON 재시작용) */
  static _lastBgmId = null;

  /** @type {boolean} 페이지 숨김 전 BGM 재생 중이었는지 추적 */
  static _bgmWasPlaying = false;

  /**
   * 사운드 시스템을 초기화한다.
   * @param {Object} [settings] - 설정 객체 (sfxVolume, bgmVolume)
   */
  static init(settings) {
    try {
      SoundSystem._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[SoundSystem] AudioContext 생성 실패:', e);
      return;
    }

    if (settings) {
      SoundSystem._sfxVol = settings.sfxVolume ?? 1;
      SoundSystem._bgmVol = settings.bgmVolume ?? 0.7;
      if (settings.bgmEnabled !== undefined) SoundSystem._bgmEnabled = settings.bgmEnabled;
      if (settings.sfxEnabled !== undefined) SoundSystem._sfxEnabled = settings.sfxEnabled;
    }

    // suspended 상태이면 즉시 resume 시도
    SoundSystem.resume();

    // 모바일 백그라운드 전환 시 오디오 정지/재개
    SoundSystem._initVisibilityHandler();
  }

  /**
   * 페이지 가시성 변경 핸들러를 등록한다.
   * 홈 버튼/탭 전환 시 AudioContext를 suspend하여 BGM/SFX를 완전 정지한다.
   * @private
   */
  static _initVisibilityHandler() {
    if (SoundSystem._visibilityBound) return; // 중복 등록 방지
    SoundSystem._visibilityBound = true;

    /** @type {boolean} 포그라운드 복귀 처리 진행 중 (이중 진입 방지) */
    let resuming = false;

    document.addEventListener('visibilitychange', () => {
      if (!SoundSystem._ctx) return;

      if (document.hidden) {
        // 백그라운드 진입: BGM 완전 정지 후 AudioContext 중단
        // setInterval이 계속 돌면서 새 노드를 만들지 않도록 BGM을 먼저 정리
        resuming = false;
        SoundSystem._bgmWasPlaying = !!SoundSystem._currentBgmId;
        SoundSystem._bgmResumeId = SoundSystem._lastBgmId;
        SoundSystem.stopBgm();
        SoundSystem._ctx.suspend().catch(() => {});
      } else {
        // 포그라운드 복귀: AudioContext 재개 후 BGM 재시작
        // 이중 진입 방지 (appStateChange와 visibilitychange 동시 발화 대응)
        if (resuming) return;
        resuming = true;

        SoundSystem._ctx.resume().then(() => {
          if (SoundSystem._bgmWasPlaying && SoundSystem._bgmResumeId) {
            // playBgm 내부에서 stopBgm()을 먼저 호출하므로 잔여 노드가 정리됨
            SoundSystem.playBgm(SoundSystem._bgmResumeId);
          }
          resuming = false;
        }).catch(() => { resuming = false; });
      }
    });
  }

  /**
   * 모바일 unlock: 사용자 제스처 후 AudioContext를 재개한다.
   */
  static resume() {
    if (SoundSystem._ctx && SoundSystem._ctx.state === 'suspended') {
      SoundSystem._ctx.resume().catch(() => {});
    }
  }

  /**
   * SFX를 재생한다.
   * @param {string} sfxId - SFX ID
   */
  static play(sfxId) {
    if (!SoundSystem._ctx || SoundSystem._sfxVol <= 0 || !SoundSystem._sfxEnabled) return;

    const ctx = SoundSystem._ctx;
    const vol = SoundSystem._sfxVol;
    const now = ctx.currentTime;

    switch (sfxId) {
      case 'shoot':
        SoundSystem._playShoot(ctx, now, vol);
        break;
      case 'hit':
        SoundSystem._playHit(ctx, now, vol);
        break;
      case 'player_hit':
        SoundSystem._playPlayerHit(ctx, now, vol);
        break;
      case 'levelup':
        SoundSystem._playLevelUp(ctx, now, vol);
        break;
      case 'evolution':
        SoundSystem._playEvolution(ctx, now, vol);
        break;
      case 'boss_appear':
        SoundSystem._playBossAppear(ctx, now, vol);
        break;
      case 'emp_blast':
        SoundSystem._playEmpBlast(ctx, now, vol);
        break;
      case 'revive':
        SoundSystem._playRevive(ctx, now, vol);
        break;
      case 'xp_collect':
        SoundSystem._playXpCollect(ctx, now, vol);
        break;
    }
  }

  /**
   * BGM을 시작한다 (루프).
   * @param {string} bgmId - BGM ID ('bgm_game' | 'bgm_menu')
   */
  static playBgm(bgmId) {
    SoundSystem.stopBgm();
    SoundSystem._lastBgmId = bgmId;
    if (!SoundSystem._ctx || SoundSystem._bgmVol <= 0 || !SoundSystem._bgmEnabled) return;

    SoundSystem._currentBgmId = bgmId;

    if (bgmId === 'bgm_game') {
      SoundSystem._startGameBgm();
    } else if (bgmId === 'bgm_menu') {
      SoundSystem._startMenuBgm();
    }
  }

  /**
   * BGM을 정지한다.
   */
  static stopBgm() {
    if (SoundSystem._bgmInterval) {
      clearInterval(SoundSystem._bgmInterval);
      SoundSystem._bgmInterval = null;
    }
    if (SoundSystem._bgmNodes) {
      SoundSystem._bgmNodes.forEach(n => {
        try { n.stop(); } catch (e) { /* 이미 정지됨 */ }
      });
      SoundSystem._bgmNodes = null;
    }
    SoundSystem._currentBgmId = null;
  }

  /**
   * SFX 볼륨을 설정한다.
   * @param {number} v - 볼륨 (0~1)
   */
  static setSfxVolume(v) {
    SoundSystem._sfxVol = Math.max(0, Math.min(1, v));
  }

  /**
   * BGM 볼륨을 설정한다.
   * @param {number} v - 볼륨 (0~1)
   */
  static setBgmVolume(v) {
    SoundSystem._bgmVol = Math.max(0, Math.min(1, v));
  }

  /**
   * BGM 활성화 상태를 설정한다.
   * false이면 즉시 정지, true이면 마지막 BGM을 재시작한다.
   * @param {boolean} enabled - 활성화 여부
   */
  static setBgmEnabled(enabled) {
    SoundSystem._bgmEnabled = enabled;
    if (!enabled) {
      SoundSystem.stopBgm();
    } else if (SoundSystem._lastBgmId) {
      SoundSystem.playBgm(SoundSystem._lastBgmId);
    }
  }

  /**
   * SFX 활성화 상태를 설정한다.
   * @param {boolean} enabled - 활성화 여부
   */
  static setSfxEnabled(enabled) {
    SoundSystem._sfxEnabled = enabled;
  }

  /**
   * BGM 활성화 여부를 반환한다.
   * @returns {boolean} BGM 활성화 여부
   */
  static isBgmEnabled() {
    return SoundSystem._bgmEnabled;
  }

  /**
   * SFX 활성화 여부를 반환한다.
   * @returns {boolean} SFX 활성화 여부
   */
  static isSfxEnabled() {
    return SoundSystem._sfxEnabled;
  }

  // ── SFX 구현 ──

  /**
   * 투사체 발사 SFX: 880Hz→440Hz 사인파, 0.08초.
   * @private
   */
  static _playShoot(ctx, now, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.08);
    gain.gain.setValueAtTime(0.2 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * 적 피격 SFX: 220Hz 사인파, gain 0.3, 0.05초.
   * @private
   */
  static _playHit(ctx, now, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    gain.gain.setValueAtTime(0.3 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 플레이어 피격 SFX: 110Hz 사각파, gain 0.5, 0.1초.
   * @private
   */
  static _playPlayerHit(ctx, now, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, now);
    gain.gain.setValueAtTime(0.5 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 레벨업 SFX: C4→E4→G4→C5 아르페지오, 0.1초씩.
   * @private
   */
  static _playLevelUp(ctx, now, vol) {
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.25 * vol, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.1);
    });
  }

  /**
   * 무기 진화 SFX: C4→G4→C5→G5 아르페지오.
   * @private
   */
  static _playEvolution(ctx, now, vol) {
    const notes = [261.63, 392.00, 523.25, 783.99]; // C4, G4, C5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.3 * vol, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.15);
    });
  }

  /**
   * 보스 등장 SFX: 55Hz 사각파, gain 0.8, 긴 지속.
   * @private
   */
  static _playBossAppear(ctx, now, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.6);
    gain.gain.setValueAtTime(0.8 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * EMP 폭발 SFX: 200Hz→0Hz 노이즈, 0.5초.
   * @private
   */
  static _playEmpBlast(ctx, now, vol) {
    // 버퍼 노이즈 생성
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.linearRampToValueAtTime(20, now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  /**
   * 부활 SFX: G4→C5→G5 상승, 0.15초씩.
   * @private
   */
  static _playRevive(ctx, now, vol) {
    const notes = [392.00, 523.25, 783.99]; // G4, C5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.3 * vol, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.15);
    });
  }

  /**
   * XP 수집 SFX: 1200Hz 사인파, gain 0.1, 0.03초.
   * @private
   */
  static _playXpCollect(ctx, now, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.1 * vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  // ── BGM 구현 ──

  /**
   * 게임 BGM: 80 BPM, 4/4 박자, 8바 루프.
   * 베이스라인(C2 사각파) + 드럼(노이즈 버스트).
   * @private
   */
  static _startGameBgm() {
    const ctx = SoundSystem._ctx;
    if (!ctx) return;

    const vol = SoundSystem._bgmVol;
    // 80 BPM → 1비트 = 0.75초, 8바(32비트) = 24초
    const beatDuration = 0.75;
    const loopLength = 24000; // ms

    const playLoop = () => {
      if (SoundSystem._currentBgmId !== 'bgm_game') return;
      const now = ctx.currentTime;
      const nodes = [];

      // 베이스라인: C2(65.41Hz) 사각파, 매 비트 0.3초
      const bassNotes = [65.41, 65.41, 82.41, 65.41, 65.41, 65.41, 82.41, 98.00]; // C2, C2, E2, C2, C2, C2, E2, G2
      for (let bar = 0; bar < 8; bar++) {
        const baseFreq = bassNotes[bar % bassNotes.length];
        for (let beat = 0; beat < 4; beat++) {
          const t = now + (bar * 4 + beat) * beatDuration;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(baseFreq, t);
          gain.gain.setValueAtTime(0.08 * vol, t);
          gain.gain.linearRampToValueAtTime(0, t + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.35);
          nodes.push(osc);
        }
      }

      // 드럼: 매 비트 노이즈 버스트
      for (let i = 0; i < 32; i++) {
        const t = now + i * beatDuration;
        const bufferSize = Math.floor(ctx.sampleRate * 0.05);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        // 강박(1, 3)은 크게, 약박(2, 4)은 작게
        const beatVol = (i % 4 === 0) ? 0.12 : 0.05;
        gain.gain.setValueAtTime(beatVol * vol, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.05);
        noise.connect(gain).connect(ctx.destination);
        noise.start(t);
        noise.stop(t + 0.06);
        nodes.push(noise);
      }

      SoundSystem._bgmNodes = nodes;
    };

    // 즉시 시작 + 루프
    playLoop();
    SoundSystem._bgmInterval = setInterval(playLoop, loopLength);
  }

  /**
   * 메뉴 BGM: C4→D4→E4→G4 사인 멜로디, 120 BPM, 2바 루프.
   * @private
   */
  static _startMenuBgm() {
    const ctx = SoundSystem._ctx;
    if (!ctx) return;

    const vol = SoundSystem._bgmVol;
    // 120 BPM → 1비트 = 0.5초, 2바(8비트) = 4초
    const beatDuration = 0.5;
    const loopLength = 4000; // ms

    const playLoop = () => {
      if (SoundSystem._currentBgmId !== 'bgm_menu') return;
      const now = ctx.currentTime;
      const nodes = [];

      const melody = [261.63, 293.66, 329.63, 392.00, 329.63, 293.66, 261.63, 196.00]; // C4, D4, E4, G4, E4, D4, C4, G3
      melody.forEach((freq, i) => {
        const t = now + i * beatDuration;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.1 * vol, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
        nodes.push(osc);
      });

      SoundSystem._bgmNodes = nodes;
    };

    playLoop();
    SoundSystem._bgmInterval = setInterval(playLoop, loopLength);
  }
}
