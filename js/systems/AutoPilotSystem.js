/**
 * @fileoverview 자동 사냥(AutoPilot) AI 이동 시스템.
 *
 * 플레이어가 조이스틱을 조작하지 않아도 AI가 자동으로 이동을 제어한다.
 * 종합형 AI: 위험 회피 > XP 보석 수집 > 적 접근 순서로 행동 우선순위를 결정한다.
 * 의도적 불완전성을 포함하여 직접 조작의 게임성을 보존한다.
 */

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  XP_MAGNET_RADIUS,
  AUTO_HUNT,
} from '../config.js';

// ── 내부 상수 ──

/** 위험 감지 반경 (px) — 이 안에 적이 있으면 회피 모드 진입 */
const DANGER_RADIUS = 120;

/** 심각한 위험 반경 (px) — 이 안에 적이 있으면 즉시 회피 */
const CRITICAL_DANGER_RADIUS = 60;

/** XP 보석 탐색 반경 (px) — 자석 반경보다 넓게 설정하여 보석을 향해 이동 */
const XP_SEARCH_RADIUS = 200;

/** 적 접근 유지 거리 (px) — 무기 사거리 내에서 적당한 거리를 유지 */
const PREFERRED_ENEMY_DISTANCE = 150;

/** 벽 회피 마진 (px) — 월드 경계에서 이 거리 이내면 중앙으로 밀어냄 */
const WALL_MARGIN = 80;

/** 방향 전환 최소 간격 (ms) — 너무 빈번한 방향 변경 방지 (지터 방지) */
const DIRECTION_CHANGE_INTERVAL = 150;

/** 의도적 불완전성: 랜덤 방향 변동 최대 각도 (라디안) */
const IMPERFECTION_ANGLE = 0.3;

/** 의도적 불완전성: AI 반응 지연 확률 (0~1, 프레임당 반응 누락 확률) */
const REACTION_MISS_CHANCE = 0.05;

// ── AutoPilotSystem 클래스 ──

export default class AutoPilotSystem {
  /**
   * @param {Phaser.Scene} scene - GameScene 참조
   * @param {import('../entities/Player.js').default} player - 플레이어 참조
   */
  constructor(scene, player) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {import('../entities/Player.js').default} */
    this.player = player;

    /**
     * AI가 계산한 이동 방향 벡터. { x: 0, y: 0 }은 정지.
     * @type {{ x: number, y: number }}
     */
    this.direction = { x: 0, y: 0 };

    /** 자동 사냥 활성 여부 */
    this.enabled = false;

    /** 마지막 방향 갱신 시각 (ms) */
    this._lastDirectionTime = 0;

    /** 현재 행동 모드 ('evade' | 'collect' | 'approach' | 'idle') */
    this._currentMode = 'idle';
  }

  // ── 공개 메서드 ──

  /**
   * 자동 사냥을 활성화한다.
   */
  activate() {
    this.enabled = true;
    this._currentMode = 'idle';
  }

  /**
   * 자동 사냥을 비활성화하고 방향을 초기화한다.
   */
  deactivate() {
    this.enabled = false;
    this.direction.x = 0;
    this.direction.y = 0;
    this._currentMode = 'idle';
  }

  /**
   * 매 프레임 호출. AI 이동 방향을 계산한다.
   * @param {number} time - 전체 경과 시간 (ms)
   * @param {number} delta - 프레임 간격 (ms)
   */
  update(time, delta) {
    if (!this.enabled || !this.player.active) {
      this.direction.x = 0;
      this.direction.y = 0;
      return;
    }

    // 방향 전환 간격 제한 (지터 방지)
    if (time - this._lastDirectionTime < DIRECTION_CHANGE_INTERVAL) {
      return;
    }
    this._lastDirectionTime = time;

    // 의도적 불완전성: 확률적 반응 누락 (이전 방향 유지)
    if (Math.random() < REACTION_MISS_CHANCE) {
      return;
    }

    // 행동 우선순위 결정
    const dangerDir = this._evaluateDanger();
    if (dangerDir) {
      this._currentMode = 'evade';
      this._applyDirection(dangerDir.x, dangerDir.y);
      return;
    }

    const collectDir = this._evaluateXPCollection();
    if (collectDir) {
      this._currentMode = 'collect';
      this._applyDirection(collectDir.x, collectDir.y);
      return;
    }

    const approachDir = this._evaluateEnemyApproach();
    if (approachDir) {
      this._currentMode = 'approach';
      this._applyDirection(approachDir.x, approachDir.y);
      return;
    }

    // 아무 행동도 필요 없으면 약간 랜덤 방랑
    this._currentMode = 'idle';
    this._wander();
  }

  /**
   * 현재 AI 행동 모드를 반환한다 (디버그/HUD용).
   * @returns {string} 행동 모드
   */
  getCurrentMode() {
    return this._currentMode;
  }

  // ── 정리 ──

  /**
   * 시스템 리소스를 정리한다.
   */
  destroy() {
    this.enabled = false;
    this.direction.x = 0;
    this.direction.y = 0;
  }

  // ── 내부: 위험 회피 ──

  /**
   * 주변 적을 스캔하여 위험 회피 방향을 계산한다.
   * 위험 반경 내에 적이 있으면 반대 방향 벡터를 반환한다.
   * @returns {{ x: number, y: number }|null} 회피 방향 또는 null
   * @private
   */
  _evaluateDanger() {
    const enemies = this._getNearbyEnemies(DANGER_RADIUS);
    if (enemies.length === 0) return null;

    const px = this.player.x;
    const py = this.player.y;

    // 위험 가중 벡터 합산: 가까운 적일수록 강한 반발력
    let repelX = 0;
    let repelY = 0;
    let hasCriticalDanger = false;

    for (const enemy of enemies) {
      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // 거리 기반 가중치 (가까울수록 강함)
      const weight = 1 / (dist * dist);
      repelX += (dx / dist) * weight;
      repelY += (dy / dist) * weight;

      if (dist < CRITICAL_DANGER_RADIUS) {
        hasCriticalDanger = true;
      }
    }

    // 적이 있지만 심각한 수준은 아닐 때는 무시 (3마리 미만, 가장 가까운 적 거리 > 90px)
    if (!hasCriticalDanger && enemies.length < 3) {
      const closestDist = this._getClosestEnemyDistance();
      if (closestDist > 90) return null;
    }

    // 정규화
    const len = Math.sqrt(repelX * repelX + repelY * repelY);
    if (len === 0) return null;

    return {
      x: repelX / len,
      y: repelY / len,
    };
  }

  // ── 내부: XP 보석 수집 ──

  /**
   * 주변 XP 보석을 스캔하여 가장 가까운 보석 방향을 계산한다.
   * @returns {{ x: number, y: number }|null} 보석 방향 또는 null
   * @private
   */
  _evaluateXPCollection() {
    const scene = this.scene;
    if (!scene.xpGemPool) return null;

    const px = this.player.x;
    const py = this.player.y;
    const magnetRadius = XP_MAGNET_RADIUS * (this.player.magnetMultiplier || 1);

    let bestGem = null;
    let bestScore = -Infinity;

    scene.xpGemPool.forEach((gem) => {
      if (!gem.active) return;

      const dx = gem.x - px;
      const dy = gem.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 자석 반경 안이면 이미 수집되므로 무시
      if (dist < magnetRadius) return;

      // 탐색 반경 밖이면 무시
      if (dist > XP_SEARCH_RADIUS) return;

      // 점수: XP 값이 높고 가까울수록 우선
      const score = (gem.xpValue || 1) / (dist + 1);
      if (score > bestScore) {
        bestScore = score;
        bestGem = gem;
      }
    });

    if (!bestGem) return null;

    const dx = bestGem.x - px;
    const dy = bestGem.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    return {
      x: dx / dist,
      y: dy / dist,
    };
  }

  // ── 내부: 적 접근 ──

  /**
   * 가장 가까운 적을 향해 적당한 거리를 유지하며 접근한다.
   * @returns {{ x: number, y: number }|null} 접근 방향 또는 null
   * @private
   */
  _evaluateEnemyApproach() {
    const scene = this.scene;
    if (!scene.waveSystem || !scene.waveSystem.enemyPool) return null;

    const px = this.player.x;
    const py = this.player.y;

    let closestEnemy = null;
    let closestDist = Infinity;

    scene.waveSystem.enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    });

    if (!closestEnemy) return null;

    // 적이 선호 거리보다 가까우면 접근할 필요 없음 (무기가 자동으로 공격)
    if (closestDist < PREFERRED_ENEMY_DISTANCE) return null;

    const dx = closestEnemy.x - px;
    const dy = closestEnemy.y - py;

    return {
      x: dx / closestDist,
      y: dy / closestDist,
    };
  }

  // ── 내부: 방랑 ──

  /**
   * 특별한 행동이 없을 때 약간의 랜덤 이동을 한다.
   * 월드 중앙을 향한 경향성을 포함한다.
   * @private
   */
  _wander() {
    const px = this.player.x;
    const py = this.player.y;

    // 월드 중앙 방향으로 약한 경향
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    const toCenterX = centerX - px;
    const toCenterY = centerY - py;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;

    // 랜덤 방향 + 중앙 경향 혼합
    const randomAngle = Math.random() * Math.PI * 2;
    const randomX = Math.cos(randomAngle);
    const randomY = Math.sin(randomAngle);

    const blendX = randomX * 0.5 + (toCenterX / toCenterDist) * 0.5;
    const blendY = randomY * 0.5 + (toCenterY / toCenterDist) * 0.5;

    const len = Math.sqrt(blendX * blendX + blendY * blendY) || 1;
    this.direction.x = blendX / len;
    this.direction.y = blendY / len;
  }

  // ── 내부: 방향 적용 ──

  /**
   * 계산된 방향에 벽 회피와 의도적 불완전성을 적용하여 최종 방향을 설정한다.
   * @param {number} dx - 원래 X 방향
   * @param {number} dy - 원래 Y 방향
   * @private
   */
  _applyDirection(dx, dy) {
    // 벽 회피 보정
    const wallCorrection = this._getWallAvoidance();
    dx += wallCorrection.x;
    dy += wallCorrection.y;

    // 의도적 불완전성: 미세한 랜덤 각도 변동
    const angle = Math.atan2(dy, dx);
    const jitter = (Math.random() - 0.5) * 2 * IMPERFECTION_ANGLE;
    const newAngle = angle + jitter;

    this.direction.x = Math.cos(newAngle);
    this.direction.y = Math.sin(newAngle);
  }

  // ── 내부: 벽 회피 ──

  /**
   * 플레이어가 월드 경계에 가까우면 중앙 방향으로 보정 벡터를 반환한다.
   * @returns {{ x: number, y: number }} 벽 회피 보정 벡터
   * @private
   */
  _getWallAvoidance() {
    const px = this.player.x;
    const py = this.player.y;
    let wx = 0;
    let wy = 0;

    // 왼쪽 벽
    if (px < WALL_MARGIN) {
      wx += (WALL_MARGIN - px) / WALL_MARGIN;
    }
    // 오른쪽 벽
    if (px > WORLD_WIDTH - WALL_MARGIN) {
      wx -= (px - (WORLD_WIDTH - WALL_MARGIN)) / WALL_MARGIN;
    }
    // 상단 벽
    if (py < WALL_MARGIN) {
      wy += (WALL_MARGIN - py) / WALL_MARGIN;
    }
    // 하단 벽
    if (py > WORLD_HEIGHT - WALL_MARGIN) {
      wy -= (py - (WORLD_HEIGHT - WALL_MARGIN)) / WALL_MARGIN;
    }

    return { x: wx, y: wy };
  }

  // ── 내부: 유틸리티 ──

  /**
   * 지정 반경 내의 활성 적 목록을 반환한다.
   * @param {number} radius - 탐색 반경 (px)
   * @returns {Array<import('../entities/Enemy.js').default>} 적 배열
   * @private
   */
  _getNearbyEnemies(radius) {
    const scene = this.scene;
    if (!scene.waveSystem || !scene.waveSystem.enemyPool) return [];

    const px = this.player.x;
    const py = this.player.y;
    const result = [];

    scene.waveSystem.enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        result.push(enemy);
      }
    });

    return result;
  }

  /**
   * 가장 가까운 적까지의 거리를 반환한다.
   * @returns {number} 거리 (적이 없으면 Infinity)
   * @private
   */
  _getClosestEnemyDistance() {
    const scene = this.scene;
    if (!scene.waveSystem || !scene.waveSystem.enemyPool) return Infinity;

    const px = this.player.x;
    const py = this.player.y;
    let closestDist = Infinity;

    scene.waveSystem.enemyPool.forEach((enemy) => {
      if (!enemy.active) return;

      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
      }
    });

    return closestDist;
  }
}
