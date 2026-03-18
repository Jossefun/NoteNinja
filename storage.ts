import AsyncStorage from '@react-native-async-storage/async-storage';
import { LevelKey, ModeKey, Octave } from './notes';

// ── Score ────────────────────────────────────────────────────────────────────
// Score = turns * 10 + seconds (lower is better)
export function calcScore(turns: number, seconds: number): number {
  return turns * 10 + seconds;
}

function scoreKey(level: LevelKey, mode: ModeKey): string {
  return `bestScore:${level}:${mode}`;
}

function scoreHistoryKey(level: LevelKey, mode: ModeKey): string {
  return `scoreHistory:${level}:${mode}`;
}

export async function getBestScore(level: LevelKey, mode: ModeKey): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(scoreKey(level, mode));
    return val !== null ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export async function getScoreHistory(level: LevelKey, mode: ModeKey): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(scoreHistoryKey(level, mode));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Returns rank (1 = best) and total games played, or null if no history
export async function getScoreRank(
  level: LevelKey,
  mode: ModeKey,
  score: number
): Promise<{ rank: number; total: number } | null> {
  try {
    const history = await getScoreHistory(level, mode);
    if (history.length === 0) return null;
    const sorted = [...history].sort((a, b) => a - b);
    const rank = sorted.findIndex((s) => score <= s) + 1;
    return { rank: rank === 0 ? sorted.length : rank, total: sorted.length };
  } catch {
    return null;
  }
}

// Returns true if this is a new best
export async function saveBestScore(level: LevelKey, mode: ModeKey, score: number): Promise<boolean> {
  try {
    // Save to history
    const history = await getScoreHistory(level, mode);
    history.push(score);
    await AsyncStorage.setItem(scoreHistoryKey(level, mode), JSON.stringify(history));
    // Update best
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

// ── Sensei config persistence ─────────────────────────────────────────────────
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

// ── Insights tracking ─────────────────────────────────────────────────────────
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
    // Clear insights history
    await AsyncStorage.removeItem(INSIGHTS_KEY);
    // Clear all score history keys for every level+mode combination
    const levels: LevelKey[] = ['easy', 'medium', 'hard', 'sensei'];
    const modes: ModeKey[] = ['normal', 'color', 'sound'];
    const keys = levels.flatMap((l) => modes.map((m) => scoreHistoryKey(l, m)));
    await AsyncStorage.multiRemove(keys);
  } catch {}
}