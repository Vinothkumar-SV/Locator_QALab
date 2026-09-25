export const MSG = Object.freeze({
  // Inspector
  START_INSPECT: 'LOCATORX_START',
  STOP_INSPECT: 'LOCATORX_STOP',
  ELEMENT_SELECTED: 'LOCATORX_SELECTED',
  TEST_LOCATOR: 'LOCATORX_TEST',
  HIGHLIGHT: 'LOCATORX_HIGHLIGHT',
  PING: 'LOCATORX_PING',
  PONG: 'LOCATORX_PONG',

  // Recorder
  REC_START: 'LOCATORX_REC_START',
  REC_STOP: 'LOCATORX_REC_STOP',
  REC_GET: 'LOCATORX_REC_GET',
  REC_CLEAR: 'LOCATORX_REC_CLEAR',
  REC_TICK: 'LOCATORX_RECORDER_TICK',
});

export const STORAGE_KEYS = Object.freeze({
  SELECTED: 'locatorXSelected',
  POM: 'locatorXPom',
  SETTINGS: 'locatorXSettings',
  HISTORY: 'locatorXHistory',
});

export const QUALITY = Object.freeze({
  BEST:    { label: 'BEST',    color: '#10b981', min: 90 },
  GOOD:    { label: 'GOOD',    color: '#3b82f6', min: 70 },
  FRAGILE: { label: 'FRAGILE', color: '#f59e0b', min: 45 },
  AVOID:   { label: 'AVOID',   color: '#ef4444', min: 0 },
});

export const DEFAULT_SETTINGS = Object.freeze({
  autoAddPom: false,
  maxLocators: 15,
  preferRole: true,
  generateXpath: true,
  theme: 'light',
});

export function classifyScore(score) {
  if (score >= QUALITY.BEST.min) return QUALITY.BEST;
  if (score >= QUALITY.GOOD.min) return QUALITY.GOOD;
  if (score >= QUALITY.FRAGILE.min) return QUALITY.FRAGILE;
  return QUALITY.AVOID;
}