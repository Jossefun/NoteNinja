import { LevelKey } from './notes';

// ── App backgrounds ────────────────────────────────────────────────
export const BG_DEEP    = '#1b1523';   // screen background
export const BG_SURFACE = '#251d30';   // cards, modals, bars

// ── Accent ────────────────────────────────────────────────────────
export const ACCENT_PURPLE = '#8e44ad';  // default borders, insights btn

// ── Level colors ──────────────────────────────────────────────────
// Derived from note card hues (F-green, D-orange, C-red),
// brightened for legibility as borders/text on dark backgrounds.
export const LEVEL_COLORS: Record<LevelKey, string> = {
  easy:   '#2ecc71',  // F-green family
  medium: '#e67e22',  // D-orange family
  hard:   '#e74c3c',  // C-red family
};

export const LEVEL_TITLES: Record<LevelKey, string> = {
  easy:   'EasyNinja',
  medium: 'MediumNinja',
  hard:   'HardNinja',
};