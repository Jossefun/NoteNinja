// ─────────────────────────────────────────────
//  notes.ts  –  note pool + level config
// ─────────────────────────────────────────────

export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb';
export type Octave = 3 | 4 | 5 | 6;
export type LevelKey = 'easy' | 'medium' | 'hard';
export type ModeKey = 'normal' | 'sound';

export interface NoteCard {
  name: NoteName;
  octave: Octave;
  label: string;
  color: string;
  octaveColor: string;
  soundKey: string;
  matched: boolean;
  id?: string;
}

export interface LevelConfig {
  pool: NoteCard[];
  pairs: number;
  label: string;
  randomize: boolean;
}

export const NOTE_DISPLAY: Partial<Record<NoteName, string>> = {
  Bb: 'B♭',
  Eb: 'E♭',
  Ab: 'A♭',
  Db: 'D♭',
  Gb: 'G♭',
};

export const NOTE_COLORS: Record<NoteName, string> = {
  C:  '#c0392b',
  D:  '#d35400',
  E:  '#d4ac0d',
  F:  '#1e8449',
  G:  '#1a5276',
  A:  '#6c3483',
  B:  '#117a65',
  Bb: '#7d3c98',
  Eb: '#1a6b4a',
  Ab: '#512e5f',
  Db: '#1f4e79',
  Gb: '#145a32',
};

export const OCTAVE_COLORS: Record<Octave, string> = {
  3: '#ffffff',
  4: '#f9e79f',
  5: '#a9cce3',
  6: '#a9dfbf',
};

function makeNote(name: NoteName, octave: Octave): NoteCard {
  return {
    name,
    octave,
    label: (NOTE_DISPLAY[name] ?? name) + octave,
    color: NOTE_COLORS[name],
    octaveColor: OCTAVE_COLORS[octave],
    soundKey: `${name}${octave}`,
    matched: false,
  };
}

const NATURALS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const FLATS: NoteName[]    = ['Bb', 'Eb', 'Ab', 'Db', 'Gb'];

// ─── EASY: 7 naturals, octave 4 ──────────────
export const EASY_POOL: NoteCard[] = NATURALS.map((n) => makeNote(n, 4));

// ─── MEDIUM: 21 naturals, octaves 3–5 ────────
export const MEDIUM_POOL: NoteCard[] = ([3, 4, 5] as Octave[]).flatMap((oct) =>
  NATURALS.map((n) => makeNote(n, oct))
);

// ─── HARD: 48 notes, naturals + flats, octaves 3–6 ───
export const HARD_POOL: NoteCard[] = ([3, 4, 5, 6] as Octave[]).flatMap((oct) => [
  ...NATURALS.map((n) => makeNote(n, oct)),
  ...FLATS.map((n) => makeNote(n, oct)),
]);

export const LEVEL_CONFIG: Record<LevelKey, LevelConfig> = {
  easy:   { pool: EASY_POOL,   pairs: 7,  label: 'Easy',   randomize: false },
  medium: { pool: MEDIUM_POOL, pairs: 10, label: 'Medium', randomize: true  },
  hard:   { pool: HARD_POOL,   pairs: 14, label: 'Hard',   randomize: true  },
};

// ─────────────────────────────────────────────
//  SOUND_REQUIRES — static require() calls
// ─────────────────────────────────────────────
export const SOUND_REQUIRES: Record<string, number> = {
  // Octave 3 – naturals
  C3:  require('./assets/musicNotes/C3.mp3'),
  D3:  require('./assets/musicNotes/D3.mp3'),
  E3:  require('./assets/musicNotes/E3.mp3'),
  F3:  require('./assets/musicNotes/F3.mp3'),
  G3:  require('./assets/musicNotes/G3.mp3'),
  A3:  require('./assets/musicNotes/A3.mp3'),
  B3:  require('./assets/musicNotes/B3.mp3'),
  // Octave 3 – flats
  Bb3: require('./assets/musicNotes/Bb3.mp3'),
  Eb3: require('./assets/musicNotes/Eb3.mp3'),
  Ab3: require('./assets/musicNotes/Ab3.mp3'),
  Db3: require('./assets/musicNotes/Db3.mp3'),
  Gb3: require('./assets/musicNotes/Gb3.mp3'),
  // Octave 4 – naturals
  C4:  require('./assets/musicNotes/C4.mp3'),
  D4:  require('./assets/musicNotes/D4.mp3'),
  E4:  require('./assets/musicNotes/E4.mp3'),
  F4:  require('./assets/musicNotes/F4.mp3'),
  G4:  require('./assets/musicNotes/G4.mp3'),
  A4:  require('./assets/musicNotes/A4.mp3'),
  B4:  require('./assets/musicNotes/B4.mp3'),
  // Octave 4 – flats
  Bb4: require('./assets/musicNotes/Bb4.mp3'),
  Eb4: require('./assets/musicNotes/Eb4.mp3'),
  Ab4: require('./assets/musicNotes/Ab4.mp3'),
  Db4: require('./assets/musicNotes/Db4.mp3'),
  Gb4: require('./assets/musicNotes/Gb4.mp3'),
  // Octave 5 – naturals
  C5:  require('./assets/musicNotes/C5.mp3'),
  D5:  require('./assets/musicNotes/D5.mp3'),
  E5:  require('./assets/musicNotes/E5.mp3'),
  F5:  require('./assets/musicNotes/F5.mp3'),
  G5:  require('./assets/musicNotes/G5.mp3'),
  A5:  require('./assets/musicNotes/A5.mp3'),
  B5:  require('./assets/musicNotes/B5.mp3'),
  // Octave 5 – flats
  Bb5: require('./assets/musicNotes/Bb5.mp3'),
  Eb5: require('./assets/musicNotes/Eb5.mp3'),
  Ab5: require('./assets/musicNotes/Ab5.mp3'),
  Db5: require('./assets/musicNotes/Db5.mp3'),
  Gb5: require('./assets/musicNotes/Gb5.mp3'),
  // Octave 6 – naturals
  C6:  require('./assets/musicNotes/C6.mp3'),
  D6:  require('./assets/musicNotes/D6.mp3'),
  E6:  require('./assets/musicNotes/E6.mp3'),
  F6:  require('./assets/musicNotes/F6.mp3'),
  G6:  require('./assets/musicNotes/G6.mp3'),
  A6:  require('./assets/musicNotes/A6.mp3'),
  B6:  require('./assets/musicNotes/B6.mp3'),
  // Octave 6 – flats
  Bb6: require('./assets/musicNotes/Bb6.mp3'),
  Eb6: require('./assets/musicNotes/Eb6.mp3'),
  Ab6: require('./assets/musicNotes/Ab6.mp3'),
  Db6: require('./assets/musicNotes/Db6.mp3'),
  Gb6: require('./assets/musicNotes/Gb6.mp3'),
};