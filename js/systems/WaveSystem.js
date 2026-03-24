/**
 * @fileoverview 적 스폰 웨이브 관리 시스템.
 *
 * 경과 시간에 따라 SPAWN_TABLE을 참조하여 적 스폰 간격, 동시 스폰 수,
 * 등장 적 종류를 동적으로 조절한다. 미니보스와 보스도 스케줄에 따라 스폰한다.
 * 시간 경과 시 HP/데미지 스케일링을 적용한다.
 */

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  SPAWN_OFFSET_MIN,
  SPAWN_OFFSET_MAX,
  ENEMY_SCALE_PER_MINUTE,
  BASE_DIFFICULTY,
} from '../config.js';
import { SPAWN_TABLE, MINI_BOSS_SCHEDULE, BOSS_SCHEDULE } from '../data/waves.js';
import ObjectPool from './ObjectPool.js';
import Enemy from '../entities/Enemy.js';

// ── WaveSystem 클래스 ──

export default class WaveSystem {
  /**
   * @param {Phaser.Scene} scene - Phaser 씬 참조
   * @param {import('../entities/Player.js').default} player - 플레이어 참조
   * @param {Object} [stageData=null] - 스테이지 데이터 (난이도 배수, 보스/미니보스 오버라이드)
   * @param {Object} [difficultyMode=null] - 난이도 모드 데이터 (DIFFICULTY_MODES의 항목)
   */
  constructor(scene, player, stageData = null, difficultyMode = null) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {import('../entities/Player.js').default} */
    this.player = player;

    /** 스테이지 데이터 (난이도 배수, 보스/미니보스 오버라이드 등) */
    this._stageData = stageData;

    /** 스테이지 난이도 배수 (HP/데미지에 곱셈 적용) */
    this._stageDiffMult = stageData ? (stageData.difficultyMult || 1.0) : 1.0;

    /** 난이도 모드 HP 배수 */
    this._diffHpMult = difficultyMode ? difficultyMode.hpMult : 1.0;

    /** 난이도 모드 공격력 배수 */
    this._diffAtkMult = difficultyMode ? difficultyMode.atkMult : 1.0;

    /** 난이도 모드 이동속도 배수 */
    this._diffSpdMult = difficultyMode ? difficultyMode.spdMult : 1.0;

    /** 경과 시간 (초) */
    this.elapsedTime = 0;

    /** 적 오브젝트 풀 */
    this.enemyPool = new ObjectPool(scene, Enemy, 100);

    /** 적 최대 동시 존재 상한 */
    this.maxActiveEnemies = 80;

    /** 스폰 타이머 (ms, 남은 시간) */
    this.spawnTimer = 0;

    /** 현재 스폰 간격 (ms) */
    this.currentSpawnInterval = 1500;

    /** 현재 동시 스폰 수 범위 */
    this.currentBatchSize = { min: 3, max: 5 };

    /** 현재 스폰 가능한 적 타입 목록 */
    this.availableEnemyTypes = ['nano_drone', 'scout_bot'];

    /** 미니보스 스폰 완료 기록 (시간(초) 기준) */
    this._spawnedMiniBosses = new Set();

    /** 보스 스폰 완료 기록 (시간(초) 기준) */
    this._spawnedBosses = new Set();

    /** 엔들리스 모드 여부 */
    this._isEndless = false;

    /** 엔들리스 HP 배수 */
    this._hpMultiplier = 1;

    /** 엔들리스 데미지 배수 */
    this._dmgMultiplier = 1;

    // 스테이지 오버라이드: 미니보스/보스 스케줄
    this._miniBossSchedule = (stageData && stageData.miniBossOverride)
      ? stageData.miniBossOverride
      : MINI_BOSS_SCHEDULE;

    // 스테이지별 보스 스케줄: 최종 보스는 엔들리스 모달 확인 후 5초 뒤 수동 스폰
    // (900초 스케줄에서 최종 보스 제외 — GameScene._showEndlessModal에서 처리)
    this._finalBossId = stageData?.bossId || null;
    if (stageData && stageData.bossId) {
      this._bossSchedule = BOSS_SCHEDULE.filter(b => b.time < 900);
    } else {
      this._bossSchedule = BOSS_SCHEDULE;
    }
  }

  // ── 공개 메서드 ──

  /**
   * 매 프레임 호출. 시간 갱신, 스폰 테이블 조회, 적/보스 스폰을 처리한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    // 1. 경과 시간 갱신
    this.elapsedTime += delta / 1000;
    const elapsedMinutes = this.elapsedTime / 60;

    // 2. SPAWN_TABLE에서 현재 시간대 정보 조회
    this._updateSpawnParams();

    // 3. 스폰 타이머 체크
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnBatch(elapsedMinutes);
      this.spawnTimer = this.currentSpawnInterval;
    }

    // 4. 미니보스 스케줄 체크
    this._checkMiniBossSchedule();

    // 5. 보스 스케줄 체크
    this._checkBossSchedule();

    // 6. 활성 적 업데이트
    this.enemyPool.forEach((enemy) => {
      enemy.update(time, delta);
    });
  }

  /**
   * 배치 스폰: batchSize 범위 내 랜덤 수만큼 적을 스폰한다.
   * @param {number} elapsedMinutes - 경과 시간 (분)
   */
  spawnBatch(elapsedMinutes) {
    // 활성 적 수가 상한 이상이면 스폰 보류
    const activeCount = this.enemyPool.getActiveCount();
    if (activeCount >= this.maxActiveEnemies) return;

    const count = Phaser.Math.Between(
      this.currentBatchSize.min,
      this.currentBatchSize.max
    );

    // 스케일링 계산 (스테이지 난이도 배수 + 난이도 모드 배수 + 엔들리스 모드 배수 적용)
    const baseScale = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes);
    const finalHpMult = this._stageDiffMult * this._diffHpMult;
    const finalAtkMult = this._stageDiffMult * this._diffAtkMult;
    const hpMultiplier = this._isEndless ? baseScale * finalHpMult * this._hpMultiplier : baseScale * finalHpMult;
    const dmgMultiplier = this._isEndless ? baseScale * finalAtkMult * this._dmgMultiplier : baseScale * finalAtkMult;

    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPosition();
      const typeId = this._pickRandomEnemyType();
      this.spawnEnemy(typeId, pos.x, pos.y, hpMultiplier, dmgMultiplier);
    }
  }

  /**
   * 특정 타입의 적을 지정 위치에 스폰한다.
   * @param {string} typeId - 적 타입 ID
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {number} [hpMultiplier=1] - HP 배수
   * @param {number} [dmgMultiplier=1] - 데미지 배수
   * @returns {Enemy|null} 스폰된 적 또는 null
   */
  spawnEnemy(typeId, x, y, hpMultiplier = 1, dmgMultiplier = 1) {
    const enemy = this.enemyPool.get(x, y);
    if (!enemy) return null;

    enemy.init(typeId, hpMultiplier, dmgMultiplier);

    // 난이도 모드 이속 배수 적용 (스테이지 배율과 별도)
    if (this._diffSpdMult !== 1.0) {
      enemy.speed = Math.floor(enemy.speed * this._diffSpdMult);
    }

    return enemy;
  }

  /**
   * 미니보스를 스폰한다.
   * @param {Object} bossData - 미니보스 스케줄 데이터 { enemyId, time }
   */
  spawnMiniBoss(bossData) {
    const pos = this.getSpawnPosition();
    const elapsedMinutes = this.elapsedTime / 60;
    const hpMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes) * this._stageDiffMult * this._diffHpMult;
    const dmgMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes) * this._stageDiffMult * this._diffAtkMult;

    // waves.js는 enemyId 필드 사용
    const typeId = bossData.enemyId || bossData.typeId;
    const enemy = this.spawnEnemy(typeId, pos.x, pos.y, hpMult, dmgMult);

    if (enemy && this.scene.onMiniBossSpawn) {
      this.scene.onMiniBossSpawn(enemy);
    }
  }

  /**
   * 보스를 스폰한다.
   * @param {Object} bossData - 보스 스케줄 데이터 { enemyId, time }
   */
  spawnBoss(bossData) {
    const pos = this.getSpawnPosition();
    const elapsedMinutes = this.elapsedTime / 60;
    // 보스는 스케일링 덜 적용 (이미 기본 스탯이 높으므로), 스테이지/난이도 모드 배율은 적용
    const hpMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes * 0.5) * this._stageDiffMult * this._diffHpMult;
    const dmgMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes * 0.5) * this._stageDiffMult * this._diffAtkMult;

    // waves.js는 enemyId 필드 사용
    const typeId = bossData.enemyId || bossData.typeId;
    const enemy = this.spawnEnemy(typeId, pos.x, pos.y, hpMult, dmgMult);

    if (enemy && this.scene.onBossSpawn) {
      this.scene.onBossSpawn(enemy);
    }
  }

  /**
   * 화면 밖 랜덤 좌표를 반환한다.
   * 카메라 뷰포트 기준 경계에서 SPAWN_OFFSET_MIN~MAX 밖.
   * @returns {{ x: number, y: number }}
   */
  getSpawnPosition() {
    const camera = this.scene.cameras.main;
    const cx = camera.scrollX + GAME_WIDTH / 2;
    const cy = camera.scrollY + GAME_HEIGHT / 2;
    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;

    // 화면 4방향 중 하나를 랜덤 선택
    const side = Phaser.Math.Between(0, 3);
    const offset = Phaser.Math.Between(SPAWN_OFFSET_MIN, SPAWN_OFFSET_MAX);

    let x, y;

    switch (side) {
      case 0: // 상
        x = cx + Phaser.Math.Between(-halfW, halfW);
        y = cy - halfH - offset;
        break;
      case 1: // 하
        x = cx + Phaser.Math.Between(-halfW, halfW);
        y = cy + halfH + offset;
        break;
      case 2: // 좌
        x = cx - halfW - offset;
        y = cy + Phaser.Math.Between(-halfH, halfH);
        break;
      case 3: // 우
        x = cx + halfW + offset;
        y = cy + Phaser.Math.Between(-halfH, halfH);
        break;
    }

    return { x, y };
  }

  // ── 엔들리스 모드 ──

  /**
   * 엔들리스 모드로 전환한다.
   * 현재 스케일링 유지 상태에서 엔들리스 전환.
   */
  enterEndlessMode() {
    this._isEndless = true;
    // t=15분 기저 4.0배 × 2.5 = 10.0배 달성
    this._hpMultiplier *= 2.5;
    this._dmgMultiplier *= 2.5;
  }

  /**
   * 엔들리스 스케일을 적용한다. 매 분 HP +30%, 데미지 +24% 누적.
   * 엔들리스 진입 시 HP ×2.5, DMG ×2.5 적용 후 분당 복리 증가.
   * @param {number} minutes - 엔들리스 경과 분
   */
  applyEndlessScale(minutes) {
    this._hpMultiplier *= 1.30;
    this._dmgMultiplier *= 1.24;
  }

  /**
   * 엔들리스 미니보스를 랜덤 스폰한다.
   * guardian_drone 또는 assault_mech 중 하나를 선택한다.
   */
  spawnEndlessMiniboss() {
    const minibossTypes = ['guardian_drone', 'assault_mech'];
    const typeId = minibossTypes[Math.floor(Math.random() * minibossTypes.length)];

    const pos = this.getSpawnPosition();
    const elapsedMinutes = this.elapsedTime / 60;
    const hpMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes) * this._hpMultiplier;
    const dmgMult = BASE_DIFFICULTY * (1 + ENEMY_SCALE_PER_MINUTE * elapsedMinutes) * this._dmgMultiplier;

    const enemy = this.spawnEnemy(typeId, pos.x, pos.y, hpMult, dmgMult);
    if (enemy && this.scene.onMiniBossSpawn) {
      this.scene.onMiniBossSpawn(enemy);
    }
  }

  /**
   * 시스템 리소스를 정리한다.
   */
  destroy() {
    this.enemyPool.destroy();
    this._spawnedMiniBosses.clear();
    this._spawnedBosses.clear();
  }

  // ── 내부 메서드 ──

  /**
   * SPAWN_TABLE에서 현재 시간대에 맞는 스폰 파라미터를 갱신한다.
   * @private
   */
  _updateSpawnParams() {
    if (!SPAWN_TABLE || SPAWN_TABLE.length === 0) return;

    const elapsedMinutes = this.elapsedTime / 60;

    // 현재 시간에 해당하는 마지막 항목 선택
    // waves.js 필드: fromMin, toMin, interval(초), countMin, countMax, enemies
    let current = SPAWN_TABLE[0];
    for (const entry of SPAWN_TABLE) {
      if (elapsedMinutes >= entry.fromMin) {
        current = entry;
      } else {
        break;
      }
    }

    // interval은 초 단위 → ms로 변환
    this.currentSpawnInterval = (current.interval || 1.5) * 1000;
    this.currentBatchSize = {
      min: current.countMin || 3,
      max: current.countMax || 5,
    };
    this.availableEnemyTypes = [...(current.enemies || ['nano_drone'])];

    // 스테이지별 earlySpawnBoost 적용: 특정 적을 일찍 스폰 풀에 추가
    if (this._stageData && this._stageData.spawnTableOverride) {
      const override = this._stageData.spawnTableOverride;
      const boosts = override.earlySpawnBoost;
      if (boosts) {
        const boostArray = Array.isArray(boosts) ? boosts : [boosts];
        for (const boost of boostArray) {
          if (elapsedMinutes >= boost.fromMinute && !this.availableEnemyTypes.includes(boost.enemyId)) {
            this.availableEnemyTypes.push(boost.enemyId);
          }
        }
      }
    }
  }

  /**
   * 미니보스 스케줄을 체크하여 시간 도달 시 스폰한다.
   * 스테이지별 오버라이드 스케줄을 우선 사용한다.
   * @private
   */
  _checkMiniBossSchedule() {
    const schedule = this._miniBossSchedule;
    if (!schedule) return;

    const elapsedSeconds = Math.floor(this.elapsedTime);

    for (const entry of schedule) {
      const triggerSec = entry.time;
      if (elapsedSeconds >= triggerSec && !this._spawnedMiniBosses.has(triggerSec)) {
        this._spawnedMiniBosses.add(triggerSec);
        this.spawnMiniBoss(entry);
      }
    }
  }

  /**
   * 보스 스케줄을 체크하여 시간 도달 시 스폰한다.
   * 스테이지별 최종 보스를 포함한 스케줄을 사용한다.
   * @private
   */
  _checkBossSchedule() {
    const schedule = this._bossSchedule;
    if (!schedule) return;

    const elapsedSeconds = Math.floor(this.elapsedTime);

    for (const entry of schedule) {
      const triggerSec = entry.time;
      if (elapsedSeconds >= triggerSec && !this._spawnedBosses.has(triggerSec)) {
        this._spawnedBosses.add(triggerSec);
        this.spawnBoss(entry);
      }
    }
  }

  /**
   * availableEnemyTypes에서 랜덤으로 적 타입을 선택한다.
   * 앞쪽 타입일수록 높은 가중치 (흔한 적이 더 자주 등장).
   * @returns {string} 선택된 적 타입 ID
   * @private
   */
  _pickRandomEnemyType() {
    const types = this.availableEnemyTypes;
    if (!types || types.length === 0) return 'nano_drone';
    if (types.length === 1) return types[0];

    // 가중치 랜덤: 앞쪽 타입에 더 높은 가중치
    // 예: 3종이면 가중치 [3, 2, 1] → 총 6
    const weights = [];
    let totalWeight = 0;
    for (let i = 0; i < types.length; i++) {
      const w = types.length - i;
      weights.push(w);
      totalWeight += w;
    }

    let rand = Math.random() * totalWeight;
    for (let i = 0; i < types.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return types[i];
    }

    return types[types.length - 1];
  }
}
