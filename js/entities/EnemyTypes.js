/**
 * @fileoverview 적 유형별 특수 행동 정의.
 *
 * 잡몹 10종, 미니보스 2종, 보스 3종의 고유 AI를 함수로 정의하며,
 * Enemy 클래스의 update()에서 typeId를 키로 조회하여 호출한다.
 */

// ── 유틸 함수 ──

/**
 * 두 점 사이의 정규화된 방향 벡터를 반환한다.
 * @param {number} fromX - 출발 X
 * @param {number} fromY - 출발 Y
 * @param {number} toX - 목표 X
 * @param {number} toY - 목표 Y
 * @returns {{ x: number, y: number, dist: number }}
 */
function getDirection(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: 0, y: 0, dist: 0 };
  return { x: dx / dist, y: dy / dist, dist };
}

// ── 적 행동 정의 ──

/**
 * 적 유형별 행동 맵.
 * 각 키는 typeId에 대응하며, 가능한 메서드는:
 * - update(enemy, scene, delta): 매 프레임 호출
 * - onDeath(enemy, scene): 사망 시 호출
 * - modifyDamage(enemy, damage, projectile): 피격 데미지 보정
 *
 * @type {Object.<string, Object>}
 */
export const ENEMY_BEHAVIORS = {

  // ── 초반 잡몹 (0~4분) ──

  /** 나노 드론: 기본 추적만. 특수 행동 없음 */
  nano_drone: {},

  /** 정찰봇: 기본 추적만. 직선 추적 */
  scout_bot: {},

  /** 스파크 드론: 사망 시 전기 폭발 (30px, 3dmg) */
  spark_drone: {
    /**
     * 사망 시 주변에 전기 폭발을 발생시킨다.
     * @param {Phaser.Physics.Arcade.Sprite} enemy - 사망한 적
     * @param {Phaser.Scene} scene - 씬 참조
     */
    onDeath(enemy, scene) {
      const EXPLOSION_RADIUS = 30;
      const EXPLOSION_DAMAGE = 3;

      // 폭발 시각 이펙트
      if (scene.createExplosion) {
        scene.createExplosion(enemy.x, enemy.y, EXPLOSION_RADIUS, EXPLOSION_DAMAGE);
      }

      // 플레이어에게 폭발 데미지 판정
      const player = scene.player;
      if (player && player.active) {
        const dist = Phaser.Math.Distance.Between(
          enemy.x, enemy.y, player.x, player.y
        );
        if (dist <= EXPLOSION_RADIUS) {
          player.takeDamage(EXPLOSION_DAMAGE);
        }
      }
    },
  },

  // ── 중반 잡몹 (4~9분) ──

  /** 전투 로봇: 높은 HP, 느린 이동. 특수 행동 없음 */
  battle_robot: {},

  /** 실드 드론: 정면 실드로 정면 공격 데미지 50% 감소 */
  shield_drone: {
    /**
     * 투사체가 적의 정면에서 왔는지 판정하여 데미지를 보정한다.
     * 적이 플레이어를 향하고 있을 때, 투사체가 적의 정면 +-90도 범위이면 정면.
     * @param {Phaser.Physics.Arcade.Sprite} enemy - 피격 적
     * @param {number} damage - 원래 데미지
     * @param {Phaser.Physics.Arcade.Sprite} projectile - 투사체
     * @returns {number} 보정된 데미지
     */
    modifyDamage(enemy, damage, projectile) {
      if (!projectile) return damage;

      // 적이 플레이어를 향하는 방향
      const player = enemy.scene.player;
      if (!player) return damage;

      const toPlayer = getDirection(enemy.x, enemy.y, player.x, player.y);

      // 투사체가 날아온 방향 (투사체→적)
      const projDir = getDirection(projectile.x, projectile.y, enemy.x, enemy.y);

      // 두 벡터의 내적: 1에 가까울수록 정면
      const dot = toPlayer.x * projDir.x + toPlayer.y * projDir.y;

      // 내적 > 0이면 정면에서 날아온 것 (같은 방향)
      if (dot > 0) {
        return Math.floor(damage * 0.5);
      }
      return damage;
    },
  },

  /** 돌격봇: 주기적으로 플레이어 방향 돌진 (속도 2배, 1초간). 벽에 닿으면 1초 기절 */
  rush_bot: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._chargeTimer) enemy._chargeTimer = 0;
      if (!enemy._chargeState) enemy._chargeState = 'idle'; // idle, charging, stunned
      if (!enemy._stateTimer) enemy._stateTimer = 0;

      enemy._chargeTimer += delta;
      enemy._stateTimer += delta;

      if (enemy._chargeState === 'idle') {
        // 3초마다 돌진 시작
        if (enemy._chargeTimer >= 3000) {
          enemy._chargeState = 'charging';
          enemy._chargeTimer = 0;
          enemy._stateTimer = 0;

          // 돌진 방향 고정
          const player = scene.player;
          if (player && player.active) {
            const dir = getDirection(enemy.x, enemy.y, player.x, player.y);
            enemy._chargeDir = { x: dir.x, y: dir.y };
          }
        }
      } else if (enemy._chargeState === 'charging') {
        // 1초간 2배 속도 돌진
        if (enemy._stateTimer >= 1000) {
          enemy._chargeState = 'idle';
          enemy._stateTimer = 0;
          return;
        }

        if (enemy._chargeDir) {
          const chargeSpeed = enemy.speed * 2;
          enemy.body.setVelocity(
            enemy._chargeDir.x * chargeSpeed,
            enemy._chargeDir.y * chargeSpeed
          );
        }

        // 월드 경계 충돌 시 기절
        if (enemy.body.blocked.left || enemy.body.blocked.right ||
            enemy.body.blocked.up || enemy.body.blocked.down) {
          enemy._chargeState = 'stunned';
          enemy._stateTimer = 0;
          enemy.body.setVelocity(0, 0);
        }
      } else if (enemy._chargeState === 'stunned') {
        // 1초간 기절
        enemy.body.setVelocity(0, 0);
        if (enemy._stateTimer >= 1000) {
          enemy._chargeState = 'idle';
          enemy._stateTimer = 0;
          enemy._chargeTimer = 0;
        }
      }
    },
  },

  /** 수리봇: 주변 200px 내 아군 적을 초당 5HP 회복 */
  repair_bot: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      const HEAL_RADIUS = 200;
      const HEAL_PER_SECOND = 5;
      const healAmount = HEAL_PER_SECOND * (delta / 1000);

      // scene의 enemyPool에서 활성 적을 순회
      if (!scene.waveSystem || !scene.waveSystem.enemyPool) return;

      scene.waveSystem.enemyPool.forEach((ally) => {
        if (ally === enemy) return; // 자기 자신 제외
        if (!ally.active) return;

        const dist = Phaser.Math.Distance.Between(
          enemy.x, enemy.y, ally.x, ally.y
        );

        if (dist <= HEAL_RADIUS) {
          ally.currentHp = Math.min(ally.currentHp + healAmount, ally.maxHp);
        }
      });
    },
  },

  /** 중장갑 봇: 넉백 저항. 특수 update 없음, traits에서 knockbackResist 설정 */
  heavy_bot: {},

  /** 텔레포트 드론: 3초마다 플레이어 근처 랜덤 위치로 순간이동 */
  teleport_drone: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._teleportTimer) enemy._teleportTimer = 0;
      enemy._teleportTimer += delta;

      if (enemy._teleportTimer >= 3000) {
        enemy._teleportTimer = 0;

        const player = scene.player;
        if (!player || !player.active) return;

        // 플레이어 근처 랜덤 위치 (80~150px 범위)
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 70;
        const newX = player.x + Math.cos(angle) * distance;
        const newY = player.y + Math.sin(angle) * distance;

        // 월드 바운드 내로 클램프
        enemy.setPosition(
          Phaser.Math.Clamp(newX, 0, scene.physics.world.bounds.width),
          Phaser.Math.Clamp(newY, 0, scene.physics.world.bounds.height)
        );

        // 텔레포트 시각 이펙트 (간단한 플래시)
        enemy.setAlpha(0.3);
        scene.time.delayedCall(200, () => {
          if (enemy.active) enemy.setAlpha(1);
        });
      }
    },
  },

  /** 자폭봇: 플레이어 접근 시 경고 표시 후 자폭 (60px, 25dmg) */
  suicide_bot: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      const TRIGGER_RANGE = 60;
      const EXPLOSION_RADIUS = 60;
      const EXPLOSION_DAMAGE = 25;
      const WARN_DURATION = 800; // 경고 표시 시간 (ms)

      if (!enemy._suicideState) enemy._suicideState = 'approach';
      if (!enemy._warnTimer) enemy._warnTimer = 0;

      const player = scene.player;
      if (!player || !player.active) return;

      const dist = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, player.x, player.y
      );

      if (enemy._suicideState === 'approach') {
        if (dist <= TRIGGER_RANGE) {
          // 경고 상태 진입
          enemy._suicideState = 'warning';
          enemy._warnTimer = 0;
          // 경고 시각 표시 (빨간 깜빡임)
          enemy.setTint(0xFF0000);
          enemy.body.setVelocity(0, 0); // 정지
        }
      } else if (enemy._suicideState === 'warning') {
        enemy._warnTimer += delta;

        // 빠른 깜빡임
        const blinkPhase = Math.floor(enemy._warnTimer / 100) % 2;
        enemy.setAlpha(blinkPhase === 0 ? 1 : 0.5);

        if (enemy._warnTimer >= WARN_DURATION) {
          // 자폭 실행
          if (scene.createExplosion) {
            scene.createExplosion(enemy.x, enemy.y, EXPLOSION_RADIUS, EXPLOSION_DAMAGE);
          }

          // 플레이어 범위 내이면 데미지
          const dAfter = Phaser.Math.Distance.Between(
            enemy.x, enemy.y, player.x, player.y
          );
          if (dAfter <= EXPLOSION_RADIUS) {
            player.takeDamage(EXPLOSION_DAMAGE);
          }

          // 자폭으로 사망 (XP는 일반 사망 처리)
          enemy.currentHp = 0;
          enemy.die();
        }
      }
    },
  },

  // ── 미니보스 ──

  /** 가디언 드론: 회전 레이저 빔 (근거리 지속 피해) */
  guardian_drone: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._laserAngle) enemy._laserAngle = 0;
      if (!enemy._laserDmgTimer) enemy._laserDmgTimer = 0;

      const LASER_RANGE = 100;
      const LASER_DAMAGE = 2; // 0.5초마다 2 데미지
      const ROTATION_SPEED = 1.5; // 라디안/초

      // 레이저 회전
      enemy._laserAngle += ROTATION_SPEED * (delta / 1000);

      // 레이저 시각 표현 (간단한 라인 Graphics -- 매 프레임 갱신)
      if (!enemy._laserGfx) {
        enemy._laserGfx = scene.add.graphics();
        enemy._laserGfx.setDepth(5);
      }

      enemy._laserGfx.clear();
      enemy._laserGfx.lineStyle(3, 0xFF3333, 0.7);
      const endX = enemy.x + Math.cos(enemy._laserAngle) * LASER_RANGE;
      const endY = enemy.y + Math.sin(enemy._laserAngle) * LASER_RANGE;
      enemy._laserGfx.lineBetween(enemy.x, enemy.y, endX, endY);

      // 반대편 레이저
      const endX2 = enemy.x + Math.cos(enemy._laserAngle + Math.PI) * LASER_RANGE;
      const endY2 = enemy.y + Math.sin(enemy._laserAngle + Math.PI) * LASER_RANGE;
      enemy._laserGfx.lineBetween(enemy.x, enemy.y, endX2, endY2);

      // 레이저 데미지 판정 (500ms 주기)
      enemy._laserDmgTimer += delta;
      if (enemy._laserDmgTimer >= 500) {
        enemy._laserDmgTimer = 0;

        const player = scene.player;
        if (!player || !player.active) return;

        // 플레이어가 레이저 라인 근처인지 판정 (간단한 거리 기반)
        const distToPlayer = Phaser.Math.Distance.Between(
          enemy.x, enemy.y, player.x, player.y
        );
        if (distToPlayer <= LASER_RANGE) {
          // 레이저 라인까지의 거리 계산 (두 방향 모두 체크)
          const hitWidth = 15; // 레이저 판정 폭
          for (const angleOffset of [0, Math.PI]) {
            const lAngle = enemy._laserAngle + angleOffset;
            // 점과 선분 사이의 거리 근사
            const cos = Math.cos(lAngle);
            const sin = Math.sin(lAngle);
            const px = player.x - enemy.x;
            const py = player.y - enemy.y;
            const proj = px * cos + py * sin;
            if (proj > 0 && proj < LASER_RANGE) {
              const perp = Math.abs(-px * sin + py * cos);
              if (perp < hitWidth) {
                player.takeDamage(LASER_DAMAGE);
                break;
              }
            }
          }
        }
      }
    },

    /**
     * 사망 시 레이저 그래픽 정리.
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     */
    onDeath(enemy, scene) {
      if (enemy._laserGfx) {
        enemy._laserGfx.destroy();
        enemy._laserGfx = null;
      }
    },
  },

  /** 어썰트 메카: 3방향 미사일 발사 (주기적) */
  assault_mech: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._missileTimer) enemy._missileTimer = 0;

      const MISSILE_INTERVAL = 3000; // 3초마다 발사
      const MISSILE_DAMAGE = 8;
      const MISSILE_SPEED = 180;

      enemy._missileTimer += delta;

      if (enemy._missileTimer >= MISSILE_INTERVAL) {
        enemy._missileTimer = 0;

        const player = scene.player;
        if (!player || !player.active) return;

        const dir = getDirection(enemy.x, enemy.y, player.x, player.y);

        // 3방향: 정면, -30도, +30도
        const spread = Math.PI / 6; // 30도
        for (const angleOffset of [-spread, 0, spread]) {
          const cos = Math.cos(angleOffset);
          const sin = Math.sin(angleOffset);
          const mx = dir.x * cos - dir.y * sin;
          const my = dir.x * sin + dir.y * cos;

          // 적 투사체 생성 (간단한 Graphics 원)
          _spawnEnemyProjectile(scene, enemy.x, enemy.y, mx, my, MISSILE_SPEED, MISSILE_DAMAGE);
        }
      }
    },
  },

  // ── 보스 ──

  /** 커맨더 드론: 10초 주기 잡몹 4마리 소환 + 돌진 */
  commander_drone: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._summonTimer) enemy._summonTimer = 0;
      if (!enemy._chargeTimer) enemy._chargeTimer = 0;
      if (!enemy._bossState) enemy._bossState = 'chase';
      if (!enemy._stateTimer) enemy._stateTimer = 0;

      enemy._summonTimer += delta;
      enemy._chargeTimer += delta;
      enemy._stateTimer += delta;

      // 10초마다 잡몹 4마리 소환
      if (enemy._summonTimer >= 10000) {
        enemy._summonTimer = 0;

        if (scene.waveSystem) {
          for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i;
            const spawnX = enemy.x + Math.cos(angle) * 50;
            const spawnY = enemy.y + Math.sin(angle) * 50;
            scene.waveSystem.spawnEnemy('nano_drone', spawnX, spawnY, 1, 1);
          }
        }
      }

      // 5초마다 돌진 (1초간 2배 속도)
      if (enemy._bossState === 'chase' && enemy._chargeTimer >= 5000) {
        enemy._bossState = 'charging';
        enemy._stateTimer = 0;
        enemy._chargeTimer = 0;

        const player = scene.player;
        if (player && player.active) {
          const dir = getDirection(enemy.x, enemy.y, player.x, player.y);
          enemy._chargeDir = { x: dir.x, y: dir.y };
        }
      }

      if (enemy._bossState === 'charging') {
        if (enemy._stateTimer >= 1000) {
          enemy._bossState = 'chase';
          enemy._stateTimer = 0;
          return;
        }
        if (enemy._chargeDir) {
          const speed = enemy.speed * 2;
          enemy.body.setVelocity(
            enemy._chargeDir.x * speed,
            enemy._chargeDir.y * speed
          );
        }
      }
    },
  },

  /** 시즈 타이탄: 광역 포격 (원형 범위 표시 -> 2초 후 폭발) + 돌진 */
  siege_titan: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._bombTimer) enemy._bombTimer = 0;
      if (!enemy._chargeTimer) enemy._chargeTimer = 0;
      if (!enemy._bossState) enemy._bossState = 'chase';
      if (!enemy._stateTimer) enemy._stateTimer = 0;

      enemy._bombTimer += delta;
      enemy._chargeTimer += delta;
      enemy._stateTimer += delta;

      const BOMB_INTERVAL = 4000; // 4초마다 포격
      const BOMB_DELAY = 2000;    // 표시 후 2초 뒤 폭발
      const BOMB_RADIUS = 80;
      const BOMB_DAMAGE = 15;

      // 광역 포격
      if (enemy._bombTimer >= BOMB_INTERVAL) {
        enemy._bombTimer = 0;

        const player = scene.player;
        if (player && player.active) {
          const targetX = player.x;
          const targetY = player.y;

          // 범위 표시 원 생성
          const indicator = scene.add.graphics();
          indicator.lineStyle(2, 0xFF6600, 0.6);
          indicator.strokeCircle(0, 0, BOMB_RADIUS);
          indicator.fillStyle(0xFF6600, 0.15);
          indicator.fillCircle(0, 0, BOMB_RADIUS);
          indicator.setPosition(targetX, targetY);
          indicator.setDepth(3);

          // 2초 후 폭발
          scene.time.delayedCall(BOMB_DELAY, () => {
            // 폭발 이펙트
            if (scene.createExplosion) {
              scene.createExplosion(targetX, targetY, BOMB_RADIUS, BOMB_DAMAGE);
            }

            // 플레이어 데미지 판정
            const p = scene.player;
            if (p && p.active) {
              const dist = Phaser.Math.Distance.Between(
                targetX, targetY, p.x, p.y
              );
              if (dist <= BOMB_RADIUS) {
                p.takeDamage(BOMB_DAMAGE);
              }
            }

            indicator.destroy();
          });
        }
      }

      // 7초마다 돌진
      if (enemy._bossState === 'chase' && enemy._chargeTimer >= 7000) {
        enemy._bossState = 'charging';
        enemy._stateTimer = 0;
        enemy._chargeTimer = 0;

        const player = scene.player;
        if (player && player.active) {
          const dir = getDirection(enemy.x, enemy.y, player.x, player.y);
          enemy._chargeDir = { x: dir.x, y: dir.y };
        }
      }

      if (enemy._bossState === 'charging') {
        if (enemy._stateTimer >= 1500) {
          enemy._bossState = 'chase';
          enemy._stateTimer = 0;
          return;
        }
        if (enemy._chargeDir) {
          const speed = enemy.speed * 2.5;
          enemy.body.setVelocity(
            enemy._chargeDir.x * speed,
            enemy._chargeDir.y * speed
          );
        }
      }
    },
  },

  /** 코어 프로세서: 회전 레이저 + 잡몹 소환 + 광역 EMP */
  core_processor: {
    /**
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     * @param {number} delta - ms
     */
    update(enemy, scene, delta) {
      if (!enemy._laserAngle) enemy._laserAngle = 0;
      if (!enemy._laserDmgTimer) enemy._laserDmgTimer = 0;
      if (!enemy._summonTimer) enemy._summonTimer = 0;
      if (!enemy._empTimer) enemy._empTimer = 0;

      const LASER_RANGE = 150;
      const LASER_DAMAGE = 3;
      const ROTATION_SPEED = 1.0;
      const SUMMON_INTERVAL = 12000;
      const EMP_INTERVAL = 8000;
      const EMP_RADIUS = 120;
      const EMP_DAMAGE = 10;

      // ── 회전 레이저 ──
      enemy._laserAngle += ROTATION_SPEED * (delta / 1000);

      if (!enemy._laserGfx) {
        enemy._laserGfx = scene.add.graphics();
        enemy._laserGfx.setDepth(5);
      }

      enemy._laserGfx.clear();
      // 4방향 레이저
      for (let i = 0; i < 4; i++) {
        const angle = enemy._laserAngle + (Math.PI / 2) * i;
        const endX = enemy.x + Math.cos(angle) * LASER_RANGE;
        const endY = enemy.y + Math.sin(angle) * LASER_RANGE;
        enemy._laserGfx.lineStyle(3, 0xFF00FF, 0.8);
        enemy._laserGfx.lineBetween(enemy.x, enemy.y, endX, endY);
      }

      // 레이저 데미지 (500ms 주기)
      enemy._laserDmgTimer += delta;
      if (enemy._laserDmgTimer >= 500) {
        enemy._laserDmgTimer = 0;
        const player = scene.player;
        if (player && player.active) {
          const distToPlayer = Phaser.Math.Distance.Between(
            enemy.x, enemy.y, player.x, player.y
          );
          if (distToPlayer <= LASER_RANGE) {
            const hitWidth = 18;
            for (let i = 0; i < 4; i++) {
              const lAngle = enemy._laserAngle + (Math.PI / 2) * i;
              const cos = Math.cos(lAngle);
              const sin = Math.sin(lAngle);
              const px = player.x - enemy.x;
              const py = player.y - enemy.y;
              const proj = px * cos + py * sin;
              if (proj > 0 && proj < LASER_RANGE) {
                const perp = Math.abs(-px * sin + py * cos);
                if (perp < hitWidth) {
                  player.takeDamage(LASER_DAMAGE);
                  break;
                }
              }
            }
          }
        }
      }

      // ── 잡몹 소환 (12초 주기, 6마리) ──
      enemy._summonTimer += delta;
      if (enemy._summonTimer >= SUMMON_INTERVAL) {
        enemy._summonTimer = 0;
        if (scene.waveSystem) {
          const types = ['nano_drone', 'scout_bot', 'spark_drone'];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const spawnX = enemy.x + Math.cos(angle) * 60;
            const spawnY = enemy.y + Math.sin(angle) * 60;
            const typeId = types[Phaser.Math.Between(0, types.length - 1)];
            scene.waveSystem.spawnEnemy(typeId, spawnX, spawnY, 1, 1);
          }
        }
      }

      // ── 광역 EMP (8초 주기) ──
      enemy._empTimer += delta;
      if (enemy._empTimer >= EMP_INTERVAL) {
        enemy._empTimer = 0;

        // EMP 시각 이펙트
        const empGfx = scene.add.graphics();
        empGfx.lineStyle(4, 0x00FFFF, 0.8);
        empGfx.strokeCircle(enemy.x, enemy.y, EMP_RADIUS);
        empGfx.setDepth(6);

        // 확산 애니메이션
        scene.tweens.add({
          targets: empGfx,
          alpha: 0,
          duration: 500,
          onComplete: () => empGfx.destroy(),
        });

        // EMP 데미지 판정
        const player = scene.player;
        if (player && player.active) {
          const dist = Phaser.Math.Distance.Between(
            enemy.x, enemy.y, player.x, player.y
          );
          if (dist <= EMP_RADIUS) {
            player.takeDamage(EMP_DAMAGE);
          }
        }
      }
    },

    /**
     * 사망 시 레이저 그래픽 정리.
     * @param {Phaser.Physics.Arcade.Sprite} enemy
     * @param {Phaser.Scene} scene
     */
    onDeath(enemy, scene) {
      if (enemy._laserGfx) {
        enemy._laserGfx.destroy();
        enemy._laserGfx = null;
      }
    },
  },
};

// ── 유틸: 적 투사체 생성 ──

/**
 * 적이 발사하는 간단한 투사체를 생성한다.
 * (어썰트 메카 미사일 등에 사용)
 * @param {Phaser.Scene} scene
 * @param {number} x - 발사 위치 X
 * @param {number} y - 발사 위치 Y
 * @param {number} dirX - 방향 X
 * @param {number} dirY - 방향 Y
 * @param {number} speed - 이동 속도
 * @param {number} damage - 데미지
 * @private
 */
function _spawnEnemyProjectile(scene, x, y, dirX, dirY, speed, damage) {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xFF6600, 1);
  gfx.fillCircle(0, 0, 4);
  gfx.setPosition(x, y);
  gfx.setDepth(4);

  // 물리 바디 없이 수동 이동
  const proj = { x, y, dirX, dirY, speed, damage, gfx, alive: true, timer: 0 };

  // 업데이트 루프에 추가
  const updateEvent = scene.time.addEvent({
    delay: 16, // ~60fps
    loop: true,
    callback: () => {
      if (!proj.alive) {
        updateEvent.destroy();
        return;
      }

      proj.timer += 16;
      proj.x += proj.dirX * proj.speed * (16 / 1000);
      proj.y += proj.dirY * proj.speed * (16 / 1000);
      proj.gfx.setPosition(proj.x, proj.y);

      // 수명 3초
      if (proj.timer > 3000) {
        proj.alive = false;
        proj.gfx.destroy();
        updateEvent.destroy();
        return;
      }

      // 플레이어와 충돌 판정 (간단한 거리 기반)
      const player = scene.player;
      if (player && player.active) {
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, player.x, player.y);
        if (dist < 16) {
          player.takeDamage(proj.damage);
          proj.alive = false;
          proj.gfx.destroy();
          updateEvent.destroy();
        }
      }
    },
  });
}
