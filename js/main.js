/**
 * @fileoverview Phaser 게임 설정 및 부트. 모든 씬을 등록하고 게임 인스턴스를 생성한다.
 * Phase 5: 멀티 스테이지 + 스테이지별 신규 무기 해금.
 * BootScene → MenuScene ↔ UpgradeScene/StageSelectScene/AchievementScene/CollectionScene,
 * StageSelectScene → DeployCharSelectScene → GameScene ↔ LevelUpScene → ResultScene.
 */

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import StageSelectScene from './scenes/StageSelectScene.js';
import GameScene from './scenes/GameScene.js';
import LevelUpScene from './scenes/LevelUpScene.js';
import ResultScene from './scenes/ResultScene.js';
import UpgradeScene from './scenes/UpgradeScene.js';
import CharacterScene from './scenes/CharacterScene.js';
import AchievementScene from './scenes/AchievementScene.js';
import CollectionScene from './scenes/CollectionScene.js';
import CutsceneScene from './scenes/CutsceneScene.js';
import DailyMissionScene from './scenes/DailyMissionScene.js';
import DroneChipScene from './scenes/DroneChipScene.js';
import DeployCharSelectScene from './scenes/DeployCharSelectScene.js';

// ── Phaser 게임 설정 ──

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0A0A1A',
  parent: 'game',
  scene: [BootScene, MenuScene, SettingsScene, StageSelectScene, CharacterScene, DeployCharSelectScene, GameScene, LevelUpScene, ResultScene, UpgradeScene, AchievementScene, CollectionScene, CutsceneScene, DailyMissionScene, DroneChipScene],
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

// ── 드론 칩 디버그 함수 ──

import { SaveManager } from './managers/SaveManager.js';
import { CHIP_DEFINITIONS } from './data/droneChips.js';

/** 칩 지급 */
window.__debugAddChip = (chipId, grade) => {
  const uid = SaveManager.addChip(chipId, grade);
  console.log(`[Debug] 칩 추가: ${chipId} ${grade}, uid=${uid}`);
  return uid;
};

/** 가루 지급 */
window.__debugAddDust = (amount) => {
  SaveManager.addDroneChipDust(amount);
  console.log(`[Debug] 가루 추가: +${amount}, 현재=${SaveManager.getDroneChipDust()}`);
};

/** 드론 칩 해금 */
window.__debugUnlockDroneChip = () => {
  SaveManager.setDroneChipUnlocked();
  SaveManager.save();
  console.log('[Debug] 드론 칩 해금 완료');
};

/** 테스트 세트 일괄 지급 (각 종류별 C등급 2개 + B등급 1개) */
window.__debugChipTestSet = () => {
  CHIP_DEFINITIONS.forEach(def => {
    SaveManager.addChip(def.id, 'C');
    SaveManager.addChip(def.id, 'C');
    SaveManager.addChip(def.id, 'B');
  });
  SaveManager.addDroneChipDust(50);
  console.log('[Debug] 테스트 칩 세트 지급 완료 (각 종류 C*2 + B*1 + 가루 50)');
};
