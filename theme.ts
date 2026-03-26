import { LevelKey } from './notes';

// ── App backgrounds ────────────────────────────────────────────────────────
export const BG_DEEP    = '#1b1523';
export const BG_SURFACE = '#251d30';

// ── Accent ────────────────────────────────────────────────────────────────
export const ACCENT_PURPLE = '#8e44ad';

// ── Level colors ──────────────────────────────────────────────────────────
export const LEVEL_COLORS: Record<LevelKey, string> = {
  easy:   '#2ecc71',
  medium: '#e67e22',
  hard:   '#e74c3c',
  sensei: '#2e86c1',
};

export const LEVEL_TITLES: Record<LevelKey, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
  sensei: 'Sensei',
};