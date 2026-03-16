import { LevelKey } from './notes';

// ── App backgrounds ────────────────────────────────────────────────
export const BG_DEEP    = '#1b1523';
export const BG_SURFACE = '#251d30';

// ── Accent ────────────────────────────────────────────────────────
export const ACCENT_PURPLE = '#8e44ad';

// ── Level colors ──────────────────────────────────────────────────
// easy/medium/hard derived from note card hues, brightened for UI legibility.
// sensei: G-blue family (#1a5276 brightened).
export const LEVEL_COLORS: Record<LevelKey, string> = {
  easy:   '#2ecc71',
  medium: '#e67e22',
  hard:   '#e74c3c',
  sensei: '#2e86c1',
};

export const LEVEL_TITLES: Record<LevelKey, string> = {
  easy:   'EasyNinja',
  medium: 'MediumNinja',
  hard:   'HardNinja',
  sensei: 'SenseiNinja',
};