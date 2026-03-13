import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { getGameHistory, clearHistory, GameRecord } from '../storage';
import { NOTE_COLORS, SOUND_REQUIRES } from '../notes';

interface NoteStats {
  note: string;
  totalWrong: number;
  appearances: number;
  avgWrong: number;
  confusedWith: Record<string, number>;
}

interface TrendPoint {
  game: number;
  avgWrong: number;
}

function buildStats(history: GameRecord[]): {
  noteStats: NoteStats[];
  trend: TrendPoint[];
  totalGames: number;
} {
  const map: Record<string, NoteStats> = {};

  history.forEach((record) => {
    record.notes.forEach((n) => {
      if (!map[n.note]) {
        map[n.note] = { note: n.note, totalWrong: 0, appearances: 0, avgWrong: 0, confusedWith: {} };
      }
      map[n.note].totalWrong += n.wrong;
      map[n.note].appearances += 1;
      n.confusedWith.forEach((c) => {
        map[n.note].confusedWith[c] = (map[n.note].confusedWith[c] ?? 0) + 1;
      });
    });
  });

  const noteStats = Object.values(map)
    .map((s) => ({ ...s, avgWrong: s.totalWrong / s.appearances }))
    .sort((a, b) => b.avgWrong - a.avgWrong);

  const recent = history.slice(-20);
  const trend: TrendPoint[] = recent.map((record, i) => {
    const total = record.notes.reduce((sum, n) => sum + n.wrong, 0);
    const avg = record.notes.length > 0 ? total / record.notes.length : 0;
    return { game: i + 1, avgWrong: parseFloat(avg.toFixed(2)) };
  });

  return { noteStats, trend, totalGames: history.length };
}

function noteColor(note: string): string {
  const name = note.replace(/[0-9]/g, '') as keyof typeof NOTE_COLORS;
  return NOTE_COLORS[name] ?? '#555';
}

function difficultyLabel(avg: number): { label: string; color: string } {
  if (avg === 0) return { label: 'Perfect', color: '#27ae60' };
  if (avg < 1)   return { label: 'Good',    color: '#2980b9' };
  if (avg < 2)   return { label: 'OK',      color: '#e67e22' };
  return           { label: 'Hard',    color: '#c0392b' };
}

async function playNote(soundKey: string): Promise<void> {
  try {
    const source = SOUND_REQUIRES[soundKey];
    if (!source) return;
    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync();
    });
  } catch (_) {}
}

interface Props {
  readonly onBack: () => void;
}

export default function InsightsScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [noteStats, setNoteStats] = useState<NoteStats[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [tab, setTab] = useState<'notes' | 'confused' | 'trend'>('notes');

  const load = async () => {
    setLoading(true);
    const history = await getGameHistory();
    const result = buildStats(history);
    setNoteStats(result.noteStats);
    setTrend(result.trend);
    setTotalGames(result.totalGames);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClear = () => {
    Alert.alert('Reset Insights', 'This will delete all your progress data. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          await clearHistory();
          setNoteStats([]); setTrend([]); setTotalGames(0);
        }
      },
    ]);
  };

  const hardNotes = noteStats.filter((n) => n.avgWrong > 0);
  const maxAvg = hardNotes.length > 0 ? hardNotes[0].avgWrong : 1;

  const confusedPairs: { a: string; b: string; count: number }[] = [];
  const seen = new Set<string>();
  noteStats.forEach((s) => {
    Object.entries(s.confusedWith).forEach(([other, count]) => {
      const key = [s.note, other].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        confusedPairs.push({ a: s.note, b: other, count });
      }
    });
  });
  confusedPairs.sort((a, b) => b.count - a.count);

  const trendDir = trend.length >= 2
    ? trend[trend.length - 1].avgWrong - trend[0].avgWrong
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Insights</Text>
        <TouchableOpacity onPress={handleClear} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#c23866" size="large" style={{ marginTop: 60 }} />
      ) : totalGames === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>
            Play some games and your ear training progress will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalGames}</Text>
              <Text style={styles.summaryLabel}>GAMES</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{hardNotes.length}</Text>
              <Text style={styles.summaryLabel}>NOTES</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[
                styles.summaryValue,
                { color: trendDir < -0.1 ? '#27ae60' : trendDir > 0.1 ? '#c0392b' : '#aaa' }
              ]}>
                {trendDir < -0.1 ? '↑ Better' : trendDir > 0.1 ? '↓ Harder' : '→ Stable'}
              </Text>
              <Text style={styles.summaryLabel}>TREND</Text>
            </View>
          </View>

          {/* Hint */}
          <Text style={styles.tapHint}>Tap any note to hear it</Text>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['notes', 'confused', 'trend'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'notes' ? 'Hard Notes' : t === 'confused' ? 'Confused' : 'Trend'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ── Hard Notes tab ── */}
            {tab === 'notes' && (
              <View style={styles.tabContent}>
                {hardNotes.length === 0 ? (
                  <Text style={styles.emptyTabText}>No mistakes yet — keep playing!</Text>
                ) : (
                  hardNotes.slice(0, 20).map((s) => {
                    const { label, color } = difficultyLabel(s.avgWrong);
                    const barWidth = (s.avgWrong / maxAvg) * 100;
                    return (
                      <View key={s.note} style={styles.noteRow}>
                        <TouchableOpacity
                          style={[styles.noteChip, { backgroundColor: noteColor(s.note) }]}
                          onPress={() => playNote(s.note)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.noteChipText}>{s.note}</Text>
                          <Text style={styles.noteChipPlay}>▶</Text>
                        </TouchableOpacity>
                        <View style={styles.noteBarContainer}>
                          <View style={[styles.noteBar, { width: `${barWidth}%` as any, backgroundColor: color }]} />
                        </View>
                        <View style={styles.noteStatRight}>
                          <Text style={[styles.diffLabel, { color }]}>{label}</Text>
                          <Text style={styles.avgText}>{s.avgWrong.toFixed(1)} avg</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ── Confused pairs tab ── */}
            {tab === 'confused' && (
              <View style={styles.tabContent}>
                {confusedPairs.length === 0 ? (
                  <Text style={styles.emptyTabText}>No confusion pairs recorded yet.</Text>
                ) : (
                  confusedPairs.slice(0, 15).map((pair, i) => (
                    <View key={i} style={styles.confusedRow}>
                      <TouchableOpacity
                        style={[styles.noteChip, { backgroundColor: noteColor(pair.a) }]}
                        onPress={() => playNote(pair.a)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.noteChipText}>{pair.a}</Text>
                        <Text style={styles.noteChipPlay}>▶</Text>
                      </TouchableOpacity>
                      <Text style={styles.confusedArrow}>↔</Text>
                      <TouchableOpacity
                        style={[styles.noteChip, { backgroundColor: noteColor(pair.b) }]}
                        onPress={() => playNote(pair.b)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.noteChipText}>{pair.b}</Text>
                        <Text style={styles.noteChipPlay}>▶</Text>
                      </TouchableOpacity>
                      <View style={styles.confusedCountBox}>
                        <Text style={styles.confusedCount}>{pair.count}×</Text>
                        <Text style={styles.confusedCountLabel}>confused</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ── Trend tab ── */}
            {tab === 'trend' && (
              <View style={styles.tabContent}>
                <Text style={styles.trendTitle}>Average wrong attempts per game</Text>
                <Text style={styles.trendSubtitle}>Last {trend.length} games · lower is better</Text>
                {trend.length < 2 ? (
                  <Text style={styles.emptyTabText}>Play at least 2 games to see a trend.</Text>
                ) : (
                  <View style={styles.trendChart}>
                    {trend.map((pt, i) => {
                      const maxVal = Math.max(...trend.map((t) => t.avgWrong), 1);
                      const barH = Math.max((pt.avgWrong / maxVal) * 130, 4);
                      const isLast = i === trend.length - 1;
                      return (
                        <View key={i} style={styles.trendBarWrapper}>
                          <Text style={styles.trendValue}>
                            {pt.avgWrong > 0 ? pt.avgWrong.toFixed(1) : '✓'}
                          </Text>
                          <View style={[
                            styles.trendBar,
                            { height: barH, backgroundColor: isLast ? '#f1c40f' : '#8e44ad' },
                          ]} />
                          <Text style={styles.trendLabel}>{pt.game}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1b1523' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backBtnText: { color: '#aaa', fontSize: 14 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  resetBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  resetBtnText: { color: '#c0392b', fontSize: 13, fontWeight: '600' },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    backgroundColor: '#251d30',
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderColor: '#888',
    borderWidth: 1,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#3d2b50' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  summaryLabel: { fontSize: 9, color: '#888', letterSpacing: 1 },
  tapHint: {
    textAlign: 'center',
    color: '#555',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#251d30', borderWidth: 1.5, borderColor: '#8e44ad22' },
  tabActive: { backgroundColor: '#251d30', borderColor: '#888' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  tabTextActive: { color: '#fff', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40 },
  tabContent: { paddingTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  emptyTabText: { color: '#666', textAlign: 'center', marginTop: 48, fontSize: 14 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  noteChip: {
    width: 56,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  noteChipText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  noteChipPlay: { color: 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 1 },
  noteBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#251d30',
    borderRadius: 4,
    overflow: 'hidden',
  },
  noteBar: { height: '100%', borderRadius: 4 },
  noteStatRight: { alignItems: 'flex-end', minWidth: 76 },
  diffLabel: { fontSize: 12, fontWeight: 'bold' },
  avgText: { fontSize: 10, color: '#666', marginTop: 1 },
  confusedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  confusedArrow: { color: '#555', fontSize: 20 },
  confusedCountBox: { marginLeft: 'auto', alignItems: 'flex-end' },
  confusedCount: { color: '#f1c40f', fontWeight: 'bold', fontSize: 15 },
  confusedCountLabel: { color: '#666', fontSize: 9, letterSpacing: 0.5 },
  trendTitle: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  trendSubtitle: { color: '#888', fontSize: 11, textAlign: 'center', marginBottom: 20 },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 180,
    gap: 4,
    paddingBottom: 28,
    backgroundColor: '#251d30',
    borderRadius: 12,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  trendBarWrapper: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  trendBar: { width: '80%', borderRadius: 4, marginBottom: 4 },
  trendValue: { fontSize: 7, color: '#888', marginBottom: 3 },
  trendLabel: { fontSize: 7, color: '#555', marginTop: 3 },
});