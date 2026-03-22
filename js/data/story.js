/**
 * @fileoverview 스토리 컷신 데이터.
 * 각 컷신의 트리거 조건, 대사 시퀀스, 배경, 초상화를 정의한다.
 */

// ── 컷신 정의 ──

/**
 * 전체 컷신 데이터.
 * @type {Object.<string, {id: string, trigger: string, bgKey: string, stageId?: string, dialogues: Array<{speaker: string, textKey: string, portrait: string|null, side?: string}>}>}
 */
export const CUTSCENES = {
  prologue: {
    id: 'prologue',
    trigger: 'first_game_start',
    bgKey: 'bg_tile',
    dialogues: [
      { speaker: 'narrator', textKey: 'cutscene.prologue.1', portrait: null },
      { speaker: 'narrator', textKey: 'cutscene.prologue.2', portrait: null },
      { speaker: 'berserker', textKey: 'cutscene.prologue.3', portrait: 'portrait_berserker', side: 'left' },
      { speaker: 'engineer', textKey: 'cutscene.prologue.4', portrait: 'portrait_engineer', side: 'right' },
      { speaker: 'narrator', textKey: 'cutscene.prologue.5', portrait: null },
    ],
  },

  stage_1_intro: {
    id: 'stage_1_intro',
    trigger: 'stage_start',
    stageId: 'stage_1',
    bgKey: 'bg_tile',
    dialogues: [
      { speaker: 'berserker', textKey: 'cutscene.s1_intro.1', portrait: 'portrait_berserker', side: 'left' },
      { speaker: 'engineer', textKey: 'cutscene.s1_intro.2', portrait: 'portrait_engineer', side: 'right' },
    ],
  },

  stage_1_clear: {
    id: 'stage_1_clear',
    trigger: 'stage_clear',
    stageId: 'stage_1',
    bgKey: 'bg_tile',
    dialogues: [
      { speaker: 'sniper', textKey: 'cutscene.s1_clear.1', portrait: 'portrait_sniper', side: 'left' },
      { speaker: 'engineer', textKey: 'cutscene.s1_clear.2', portrait: 'portrait_engineer', side: 'right' },
    ],
  },

  stage_2_intro: {
    id: 'stage_2_intro',
    trigger: 'stage_start',
    stageId: 'stage_2',
    bgKey: 'bg_tile_s2',
    dialogues: [
      { speaker: 'agent', textKey: 'cutscene.s2_intro.1', portrait: 'portrait_agent', side: 'left' },
      { speaker: 'medic', textKey: 'cutscene.s2_intro.2', portrait: 'portrait_medic', side: 'right' },
      { speaker: 'berserker', textKey: 'cutscene.s2_intro.3', portrait: 'portrait_berserker', side: 'left' },
    ],
  },

  stage_2_clear: {
    id: 'stage_2_clear',
    trigger: 'stage_clear',
    stageId: 'stage_2',
    bgKey: 'bg_tile_s2',
    dialogues: [
      { speaker: 'engineer', textKey: 'cutscene.s2_clear.1', portrait: 'portrait_engineer', side: 'left' },
      { speaker: 'narrator', textKey: 'cutscene.s2_clear.2', portrait: null },
      { speaker: 'engineer', textKey: 'cutscene.s2_clear.3', portrait: 'portrait_engineer', side: 'left' },
    ],
  },

  stage_3_intro: {
    id: 'stage_3_intro',
    trigger: 'stage_start',
    stageId: 'stage_3',
    bgKey: 'bg_tile_s3',
    dialogues: [
      { speaker: 'hidden', textKey: 'cutscene.s3_intro.1', portrait: 'portrait_hidden', side: 'left' },
      { speaker: 'exodus', textKey: 'cutscene.s3_intro.2', portrait: 'portrait_exodus', side: 'right' },
      { speaker: 'exodus', textKey: 'cutscene.s3_intro.3', portrait: 'portrait_exodus', side: 'right' },
      { speaker: 'exodus', textKey: 'cutscene.s3_intro.4', portrait: 'portrait_exodus', side: 'right' },
    ],
  },

  stage_3_clear: {
    id: 'stage_3_clear',
    trigger: 'stage_clear',
    stageId: 'stage_3',
    bgKey: 'bg_tile_s3',
    dialogues: [
      { speaker: 'narrator', textKey: 'cutscene.s3_clear.1', portrait: null },
      { speaker: 'narrator', textKey: 'cutscene.s3_clear.2', portrait: null },
      { speaker: 'agent', textKey: 'cutscene.s3_clear.3', portrait: 'portrait_agent', side: 'left' },
      { speaker: 'engineer', textKey: 'cutscene.s3_clear.4', portrait: 'portrait_engineer', side: 'right' },
    ],
  },

  stage_4_intro: {
    id: 'stage_4_intro',
    trigger: 'stage_start',
    stageId: 'stage_4',
    bgKey: 'bg_tile_s4',
    dialogues: [
      { speaker: 'exodus', textKey: 'cutscene.s4_intro.1', portrait: 'portrait_exodus', side: 'right' },
      { speaker: 'exodus', textKey: 'cutscene.s4_intro.2', portrait: 'portrait_exodus', side: 'right' },
    ],
  },

  stage_4_clear: {
    id: 'stage_4_clear',
    trigger: 'stage_clear',
    stageId: 'stage_4',
    bgKey: 'bg_tile_s4',
    dialogues: [
      { speaker: 'narrator', textKey: 'cutscene.s4_clear.1', portrait: null },
      { speaker: 'narrator', textKey: 'cutscene.s4_clear.2', portrait: null },
    ],
  },
};

// ── 조회 함수 ──

/**
 * 컷신 ID로 데이터를 조회한다.
 * @param {string} id - 컷신 ID
 * @returns {Object|undefined}
 */
export function getCutsceneById(id) {
  return CUTSCENES[id];
}

/**
 * 스테이지 시작 시 재생할 컷신 ID를 반환한다.
 * @param {string} stageId - 스테이지 ID ('stage_1', 'stage_2', ...)
 * @returns {string|null}
 */
export function getStageIntroCutscene(stageId) {
  const num = stageId.replace('stage_', '');
  const key = `stage_${num}_intro`;
  return CUTSCENES[key] ? key : null;
}

/**
 * 스테이지 클리어 시 재생할 컷신 ID를 반환한다.
 * @param {string} stageId - 스테이지 ID ('stage_1', 'stage_2', ...)
 * @returns {string|null}
 */
export function getStageClearCutscene(stageId) {
  const num = stageId.replace('stage_', '');
  const key = `stage_${num}_clear`;
  return CUTSCENES[key] ? key : null;
}
