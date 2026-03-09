/**
 * @fileoverview Phaser 게임 설정 및 부트. 모든 씬을 등록하고 게임 인스턴스를 생성한다.
 * Phase 3: 콘텐츠 확장 (신규 무기 2종, 캐릭터 3종, 도전과제/도감 UI).
 * BootScene → MenuScene ↔ UpgradeScene/CharacterScene/AchievementScene/CollectionScene,
 * CharacterScene → GameScene ↔ LevelUpScene → ResultScene.
 */

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import LevelUpScene from './scenes/LevelUpScene.js';
import ResultScene from './scenes/ResultScene.js';
import UpgradeScene from './scenes/UpgradeScene.js';
import CharacterScene from './scenes/CharacterScene.js';
import AchievementScene from './scenes/AchievementScene.js';
import CollectionScene from './scenes/CollectionScene.js';

// ── Phaser 게임 설정 ──

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0A0A1A',
  parent: 'game',
  scene: [BootScene, MenuScene, CharacterScene, GameScene, LevelUpScene, ResultScene, UpgradeScene, AchievementScene, CollectionScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 1,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

/** Phaser 게임 인스턴스 (디버그 접근을 위해 window에 노출) */
const game = new Phaser.Game(config);
window.__NEON_EXODUS = game;
