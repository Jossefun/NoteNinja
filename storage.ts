import AsyncStorage from '@react-native-async-storage/async-storage';
import { LevelKey, ModeKey, Octave } from './notes';

// ── Score ──────────────────────────────────────────────────────────
// Score = turns * 10 + seconds (lower is better)
export function calcScore(turns: number, seconds: number): number {
  return turns * 10 + seconds;
}

function scoreKey(level: LevelKey, mode: ModeKey): string {
  return `bestScore:${level}:${mode}`;
}

export async function getBestScore(level: LevelKey, mode: ModeKey): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(scoreKey(level, mode));
    return val !== null ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

// Returns true if this is a new best
export async function saveBestScore(level: LevelKey, mode: ModeKey, score: number): Promise<boolean> {
  try {
    const current = await getBestScore(level, mode);
    if (current === null || score < current) {
      await AsyncStorage.setItem(scoreKey(level, mode), String(score));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Streak ────────────────────────────────────────────────────────
export async function getStreak(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem('winStreak');
    return val !== null ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementStreak(): Promise<number> {
  try {
    const current = await getStreak();
    const next = current + 1;
    await AsyncStorage.setItem('winStreak', String(next));
    return next;
  } catch {
    return 0;
  }
}

export async function resetStreak(): Promise<void> {
  try {
    await AsyncStorage.setItem('winStreak', '0');
  } catch {}
}

// ── Sensei config persistence ─────────────────────────────────────
export interface SenseiConfig {
  pairs: number;
  octaves: Octave[];
  includeFlats: boolean;
}

const DEFAULT_SENSEI_CONFIG: SenseiConfig = {
  pairs: 7,
  octaves: [4],
  includeFlats: false,
};

const SENSEI_CONFIG_KEY = 'senseiConfig';

export async function getSenseiConfig(): Promise<SenseiConfig> {
  try {
    const raw = await AsyncStorage.getItem(SENSEI_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SENSEI_CONFIG;
  } catch {
    return DEFAULT_SENSEI_CONFIG;
  }
}

export async function saveSenseiConfig(config: SenseiConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(SENSEI_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

// ── Insights tracking ─────────────────────────────────────────────
export interface NoteAttempt {
  note: string;
  wrong: number;
  confusedWith: string[];
}

export interface GameRecord {
  ts: number;
  level: string;
  mode: string;
  notes: NoteAttempt[];
}

const INSIGHTS_KEY = 'insights:history';
const MAX_RECORDS = 100;

export async function saveGameRecord(record: GameRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(INSIGHTS_KEY);
    const history: GameRecord[] = raw ? JSON.parse(raw) : [];
    history.push(record);
    if (history.length > MAX_RECORDS) history.splice(0, history.length - MAX_RECORDS);
    await AsyncStorage.setItem(INSIGHTS_KEY, JSON.stringify(history));
  } catch {}
}

export async function getGameHistory(): Promise<GameRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(INSIGHTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSIGHTS_KEY);
  } catch {}
}