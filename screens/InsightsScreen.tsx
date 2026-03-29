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
  Modal,
  Platform,
} from 'react-native';
import { getGameHistory, clearHistory, GameRecord } from '../storage';
import { NOTE_COLORS } from '../notes';
import { playSound } from '../audio';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE } from '../theme';

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
const ANDROID_NAV_BAR = Platform.OS === 'android' ? 48 : 0;

interface NoteStats {
  note: string;
  totalWrong: number;
  appearances: number;
  wrongAppearances: number;
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
        map[n.note] = { note: n.note, totalWrong: 0, appearances: 0, wrongAppearances: 0, avgWrong: 0, confusedWith: {} };
      }
      map[n.note].totalWrong += n.wrong;
      map[n.note].appearances += 1;
      if (n.wrong > 0) map[n.note].wrongAppearances += 1;
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
  if (avg < 1)  return { label: 'Sharp',  color: '#27ae60' };
  if (avg < 2)  return { label: 'Good',   color: '#2980b9' };
  if (avg < 4)  return { label: 'OK',     color: '#e67e22' };
  return          { label: 'Hard',   color: '#c0392b' };
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
  const [showExplain, setShowExplain] = useState(false);
  const [showExplainNotes, setShowExplainNotes] = useState(false);
  const [showExplainConfused, setShowExplainConfused] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [noteSort, setNoteSort] = useState<'wrong' | 'clean'>('wrong');
  const [modeFilter, setModeFilter] = useState<'all' | 'normal' | 'color' | 'sound'>('all');
  const [fullHistory, setFullHistory] = useState<GameRecord[]>([]);

  const load = async () => {
    setLoading(true);
    const history = await getGameHistory();
    setFullHistory(history);
    const result = buildStats(history);
    setNoteStats(result.noteStats);
    setTrend(result.trend);
    setTotalGames(result.totalGames);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (fullHistory.length === 0) return;
    const filtered = modeFilter === 'all'
      ? fullHistory
      : fullHistory.filter((r) => r.mode === modeFilter);
    const result = buildStats(filtered);
    setNoteStats(result.noteStats);
    setTrend(result.trend);
    setTotalGames(result.totalGames);
  }, [modeFilter, fullHistory]);

  const handleClear = () => setShowResetModal(true);

  const confirmClear = async () => {
    await clearHistory();
    setFullHistory([]);
    setNoteStats([]);
    setTrend([]);
    setTotalGames(0);
    setShowResetModal(false);
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

  const trendDir = (() => {
    if (trend.length < 2) return 0;
    const count = Math.min(3, Math.floor(trend.length / 2));
    const first = trend.slice(0, count);
    const last  = trend.slice(-count);
    const avgFirst = first.reduce((s, p) => s + p.avgWrong, 0) / first.length;
    const avgLast  = last.reduce((s, p) => s + p.avgWrong, 0) / last.length;
    return avgLast - avgFirst;
  })();

  const trendLabel = trendDir < -0.1 ? '↑ Better' : trendDir > 0.1 ? '↓ Harder' : '→ Stable';
  const trendColor = trendDir < -0.1 ? '#27ae60' : trendDir > 0.1 ? '#c0392b' : '#aaa';

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

      {/* Mode filter — always visible */}
      <View style={styles.modeFilterRow}>
        {([
          { key: 'all',    label: 'All',     color: '#aaa' },
          { key: 'normal', label: 'Normal',  color: '#509fd4' },
          { key: 'color',  label: 'Color',   color: '#ae61cf' },
          { key: 'sound',  label: 'Ear',     color: '#e67e22' },
        ] as const).map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.modeFilterBtn,
              modeFilter === m.key && { borderColor: m.color, backgroundColor: m.color + '22' },
            ]}
            onPress={() => setModeFilter(m.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeFilterText, { color: modeFilter === m.key ? m.color : '#888' }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#c23866" size="large" style={{ marginTop: 60 }} />
      ) : totalGames === 0 ? (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>♩</Text>
            <Text style={styles.emptyTitle}>
              {modeFilter === 'all'    ? 'No data yet' :
               modeFilter === 'normal' ? 'No Normal mode data yet' :
               modeFilter === 'color'  ? 'No Color & Sound data yet' :
                                         'No Ear Training data yet'}
            </Text>
            <Text style={styles.emptyText}>
              {modeFilter === 'all'    ? 'Play some games and your progress will appear here.' :
               modeFilter === 'normal' ? 'Play a game in Normal mode to see note name stats.' :
               modeFilter === 'color'  ? 'Play a game in Color & Sound mode to see color-based stats.' :
                                         'Play a game in Ear Training mode to see pure listening stats.'}
            </Text>
          </View>
        </>
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
              <Text style={[styles.summaryValue, { color: trendColor }]}>{trendLabel}</Text>
              <Text style={styles.summaryLabel}>TREND</Text>
            </View>
          </View>

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

            {/* Hard Notes tab */}
            {tab === 'notes' && (
              <View style={styles.tabContent}>
                <View style={styles.trendHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendTitle}>Notes you struggle with</Text>
                  </View>
                  <TouchableOpacity style={styles.explainBtn} onPress={() => setShowExplainNotes(true)}>
                    <Text style={styles.explainBtnText}>?</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sortRow}>
                  <TouchableOpacity
                    style={[styles.sortBtn, noteSort === 'wrong' && styles.sortBtnActive]}
                    onPress={() => setNoteSort('wrong')}
                  >
                    <Text style={[styles.sortBtnText, noteSort === 'wrong' && styles.sortBtnTextActive]}>
                      Most Wrong
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortBtn, noteSort === 'clean' && styles.sortBtnActive]}
                    onPress={() => setNoteSort('clean')}
                  >
                    <Text style={[styles.sortBtnText, noteSort === 'clean' && styles.sortBtnTextActive]}>
                      Most Clean
                    </Text>
                  </TouchableOpacity>
                </View>

                {hardNotes.length === 0 ? (
                  <Text style={styles.emptyTabText}>No mistakes yet — keep playing!</Text>
                ) : (
                  [...hardNotes]
                    .sort((a, b) => noteSort === 'wrong'
                      ? b.avgWrong - a.avgWrong
                      : (b.appearances - b.wrongAppearances) - (a.appearances - a.wrongAppearances)
                    )
                    .slice(0, 20)
                    .map((s) => {
                    const { label, color } = difficultyLabel(s.avgWrong);
                    const cleanAppearances = s.appearances - s.wrongAppearances;
                    const maxClean = Math.max(...[...hardNotes].map((n) => n.appearances - n.wrongAppearances), 1);
                    const barWidth = noteSort === 'wrong'
                      ? (s.avgWrong / maxAvg) * 100
                      : (cleanAppearances / maxClean) * 100;
                    const barColor = noteSort === 'wrong' ? color : '#27ae60';
                    return (
                      <View key={s.note} style={styles.noteRow}>
                        <TouchableOpacity
                          style={[styles.noteChip, { backgroundColor: noteColor(s.note) }]}
                          onPress={() => playSound(s.note)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.noteChipText}>{s.note}</Text>
                          <Text style={styles.noteChipPlay}>▶</Text>
                        </TouchableOpacity>
                        <View style={styles.noteBarContainer}>
                          <View style={[styles.noteBar, { width: `${barWidth}%` as any, backgroundColor: barColor }]} />
                        </View>
                        <View style={styles.noteStatRight}>
                          <Text style={[styles.diffLabel, { color }]}>{label}</Text>
                          <Text style={styles.avgText}>{s.avgWrong.toFixed(1)} avg</Text>
                          <Text style={styles.ratioText}>
                            {s.wrongAppearances}/{s.appearances} games
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Confused pairs tab */}
            {tab === 'confused' && (
              <View style={styles.tabContent}>
                <View style={styles.trendHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendTitle}>Notes you mix up</Text>
                    <Text style={styles.trendSubtitle}>Sorted by confusion count</Text>
                  </View>
                  <TouchableOpacity style={styles.explainBtn} onPress={() => setShowExplainConfused(true)}>
                    <Text style={styles.explainBtnText}>?</Text>
                  </TouchableOpacity>
                </View>
                {confusedPairs.length === 0 ? (
                  <Text style={styles.emptyTabText}>No confusion pairs recorded yet.</Text>
                ) : (
                  confusedPairs.slice(0, 15).map((pair, i) => (
                    <View key={i} style={styles.confusedRow}>
                      <TouchableOpacity
                        style={[styles.noteChip, { backgroundColor: noteColor(pair.a) }]}
                        onPress={() => playSound(pair.a)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.noteChipText}>{pair.a}</Text>
                        <Text style={styles.noteChipPlay}>▶</Text>
                      </TouchableOpacity>
                      <Text style={styles.confusedArrow}>⇔</Text>
                      <TouchableOpacity
                        style={[styles.noteChip, { backgroundColor: noteColor(pair.b) }]}
                        onPress={() => playSound(pair.b)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.noteChipText}>{pair.b}</Text>
                        <Text style={styles.noteChipPlay}>▶</Text>
                      </TouchableOpacity>
                      <View style={styles.confusedCountBox}>
                        <Text style={styles.confusedCount}>{pair.count}×</Text>
                        <Text style={styles.confusedCountLabel}>
                          in {Math.min(
                            noteStats.find((s) => s.note === pair.a)?.appearances ?? 0,
                            noteStats.find((s) => s.note === pair.b)?.appearances ?? 0
                          )} games
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Trend tab */}
            {tab === 'trend' && (
              <View style={styles.tabContent}>
                <View style={styles.trendHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendTitle}>Wrong attempts per game</Text>
                    <Text style={styles.trendSubtitle}>Last {trend.length} games · lower is better</Text>
                  </View>
                  <TouchableOpacity style={styles.explainBtn} onPress={() => setShowExplain(true)}>
                    <Text style={styles.explainBtnText}>?</Text>
                  </TouchableOpacity>
                </View>

                {trend.length < 2 ? (
                  <Text style={styles.emptyTabText}>Play at least 2 games to see a trend.</Text>
                ) : (
                  <>
                    <View style={styles.trendChart}>
                      {trend.map((pt, i) => {
                        const maxVal = Math.max(...trend.map((t) => t.avgWrong), 1);
                        const barH = Math.max((pt.avgWrong / maxVal) * 130, 4);
                        const isLast = i === trend.length - 1;
                        const firstVal = trend[0].avgWrong;
                        const barColor = isLast
                          ? '#ffffff'
                          : pt.avgWrong < firstVal - 0.1
                          ? '#27ae60'
                          : pt.avgWrong > firstVal + 0.1
                          ? '#c0392b'
                          : '#888';
                        return (
                          <View key={i} style={styles.trendBarWrapper}>
                            <Text style={styles.trendValue}>
                              {pt.avgWrong > 0 ? pt.avgWrong.toFixed(1) : '✓'}
                            </Text>
                            <View style={[styles.trendBar, { height: barH, backgroundColor: barColor }]} />
                            <Text style={styles.trendLabel}>{pt.game}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
                        <Text style={styles.legendText}>Better than start</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#c0392b' }]} />
                        <Text style={styles.legendText}>Harder than start</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#888' }]} />
                        <Text style={styles.legendText}>Stable</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#ffffff' }]} />
                        <Text style={styles.legendText}>Latest game</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

          </ScrollView>
        </>
      )}

      {/* Hard Notes explanation modal */}
      <Modal visible={showExplainNotes} transparent animationType="fade">
        <TouchableOpacity style={styles.explainOverlay} activeOpacity={1} onPress={() => setShowExplainNotes(false)}>
          <View style={styles.explainBox}>
            <Text style={styles.explainTitle}>Hard Notes</Text>
            <Text style={styles.explainText}>
              Notes you've made at least one mistake on, across all games. The bar shows how wrong you were on average — longer means harder.
            </Text>
            <Text style={styles.explainText}>
              The ratio (e.g. 3/8 games) shows how many games you struggled with that note out of how many times it appeared.
            </Text>
            <Text style={styles.explainText}>
              Use the sort toggle to switch between your hardest notes (Most Wrong) and your strongest notes (Most Clean).
            </Text>
            <View style={styles.explainLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
                <Text style={styles.explainLegendText}>Sharp — found quickly, less than 1 wrong on average</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2980b9' }]} />
                <Text style={styles.explainLegendText}>Good — 1 to 2 wrong on average</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#e67e22' }]} />
                <Text style={styles.explainLegendText}>OK — 2 to 4 wrong on average</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#c0392b' }]} />
                <Text style={styles.explainLegendText}>Hard — 4 or more wrong on average</Text>
              </View>
            </View>
            <Text style={styles.explainTip}>
              Tip: in a card game you always flip a few cards to explore — 1–2 wrong attempts per note is normal.
            </Text>
            <TouchableOpacity style={styles.explainClose} onPress={() => setShowExplainNotes(false)}>
              <Text style={styles.explainCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confused pairs explanation modal */}
      <Modal visible={showExplainConfused} transparent animationType="fade">
        <TouchableOpacity style={styles.explainOverlay} activeOpacity={1} onPress={() => setShowExplainConfused(false)}>
          <View style={styles.explainBox}>
            <Text style={styles.explainTitle}>Confused Pairs</Text>
            <Text style={styles.explainText}>
              Shows pairs of notes you tend to mix up — when you flipped one note while looking for the other.
            </Text>
            <Text style={styles.explainText}>
              The number (e.g. 3×) is how many total times across all your games you confused those two notes. Confusion is mutual — it counts both directions.
            </Text>
            <Text style={styles.explainText}>
              The "games" number below it shows how many games both notes appeared together — giving you context for how often you actually had the chance to confuse them.
            </Text>
            <Text style={styles.explainTip}>
              Tip: tap either note to hear them back to back and train your ear on the difference.
            </Text>
            <TouchableOpacity style={styles.explainClose} onPress={() => setShowExplainConfused(false)}>
              <Text style={styles.explainCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Trend explanation modal */}
      <Modal visible={showExplain} transparent animationType="fade">
        <TouchableOpacity style={styles.explainOverlay} activeOpacity={1} onPress={() => setShowExplain(false)}>
          <View style={styles.explainBox}>
            <Text style={styles.explainTitle}>How to read this chart</Text>
            <Text style={styles.explainText}>
              Each bar is one game. The height shows your average wrong attempts — the lower, the better.
            </Text>
            <Text style={styles.explainText}>
              Bar colors compare each game to your very first game on this chart:
            </Text>
            <View style={styles.explainLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
                <Text style={styles.explainLegendText}>Green — fewer mistakes than your first game</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#c0392b' }]} />
                <Text style={styles.explainLegendText}>Red — more mistakes than your first game</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#888' }]} />
                <Text style={styles.explainLegendText}>Grey — roughly the same</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ffffff' }]} />
                <Text style={styles.explainLegendText}>White — your most recent game</Text>
              </View>
            </View>
            <Text style={styles.explainTip}>Tip: aim for more green bars over time.</Text>
            <TouchableOpacity style={styles.explainClose} onPress={() => setShowExplain(false)}>
              <Text style={styles.explainCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reset confirmation modal */}
      <Modal visible={showResetModal} transparent animationType="fade">
        <TouchableOpacity style={styles.explainOverlay} activeOpacity={1} onPress={() => setShowResetModal(false)}>
          <View style={styles.explainBox}>
            <Text style={styles.resetModalIcon}>🗑</Text>
            <Text style={styles.resetModalTitle}>Ready to start fresh?</Text>
            <Text style={styles.resetModalText}>
              Every mistake is part of the journey. Resetting will clear all your progress — wrong attempts, confusion pairs, score history, and trend data.
            </Text>
            <Text style={styles.resetModalText}>
              Your best scores on the level select screen will also be cleared.
            </Text>
            <TouchableOpacity style={styles.resetConfirmBtn} onPress={confirmClear}>
              <Text style={styles.resetConfirmBtnText}>Yes, reset everything</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetCancelBtn} onPress={() => setShowResetModal(false)}>
              <Text style={styles.resetCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DEEP, paddingTop: ANDROID_STATUS_BAR },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
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
    paddingVertical: 8,
    backgroundColor: BG_SURFACE,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 10,
    borderColor: ACCENT_PURPLE,
    borderWidth: 1,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#3d2b50' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  summaryLabel: { fontSize: 9, color: '#888', letterSpacing: 1 },
  tapHint: {
    textAlign: 'center',
    color: '#888',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modeFilterRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  modeFilterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    backgroundColor: BG_SURFACE,
  },
  modeFilterText: { fontSize: 12, fontWeight: '600', color: '#888' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 15,
    gap: 8,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: BG_SURFACE, borderWidth: 1.5, borderColor: '#8e44ad22' },
  tabActive: { backgroundColor: BG_SURFACE, borderColor: ACCENT_PURPLE },
  tabText: { color: '#9b9696', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  tabTextActive: { color: '#fff', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40 + ANDROID_NAV_BAR },
  tabContent: { paddingTop: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  emptyTabText: { color: '#666', textAlign: 'center', marginTop: 48, fontSize: 14 },
  noteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  noteChip: {
    width: 56, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3,
  },
  noteChipText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  noteChipPlay: { color: 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 1 },
  noteBarContainer: { flex: 1, height: 8, backgroundColor: BG_SURFACE, borderRadius: 4, overflow: 'hidden' },
  noteBar: { height: '100%', borderRadius: 4 },
  noteStatRight: { alignItems: 'flex-end', minWidth: 76 },
  diffLabel: { fontSize: 12, fontWeight: 'bold' },
  avgText: { fontSize: 10, color: '#666', marginTop: 1 },
  ratioText: { fontSize: 10, color: '#555', marginTop: 1 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sortBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(142,68,173,0.3)', alignItems: 'center', backgroundColor: BG_SURFACE,
  },
  sortBtnActive: { borderColor: ACCENT_PURPLE },
  sortBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  sortBtnTextActive: { color: '#fff' },
  confusedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  confusedArrow: { color: '#555', fontSize: 20 },
  confusedCountBox: { marginLeft: 'auto', alignItems: 'flex-end' },
  confusedCount: { color: '#f1c40f', fontWeight: 'bold', fontSize: 15 },
  confusedCountLabel: { color: '#666', fontSize: 9, letterSpacing: 0.5 },
  trendHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  trendTitle: { color: '#fff', fontSize: 10, fontWeight: '600', marginBottom: 2 },
  trendSubtitle: { color: '#888', fontSize: 11 },
  explainBtn: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    borderColor: ACCENT_PURPLE, alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  explainBtnText: { color: ACCENT_PURPLE, fontSize: 14, fontWeight: 'bold' },
  trendChart: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    height: 180, gap: 4, paddingBottom: 0, backgroundColor: BG_SURFACE,
    borderRadius: 12, paddingTop: 16, paddingHorizontal: 12, marginBottom: 16,
  },
  trendBarWrapper: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  trendBar: { width: '80%', borderRadius: 4, marginBottom: 4 },
  trendValue: { fontSize: 7, color: '#888', marginBottom: 3 },
  trendLabel: { fontSize: 7, color: '#555', marginTop: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingHorizontal: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#888', fontSize: 11 },
  explainOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  explainBox: {
    backgroundColor: BG_SURFACE, borderRadius: 16, padding: 24,
    width: '100%', borderWidth: 1, borderColor: ACCENT_PURPLE,
  },
  explainTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  explainText: { color: '#aaa', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  explainLegend: { marginVertical: 8, gap: 8 },
  explainLegendText: { color: '#aaa', fontSize: 13 },
  explainTip: { color: '#27ae60', fontSize: 12, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  explainClose: {
    marginTop: 16, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: ACCENT_PURPLE, alignItems: 'center',
  },
  explainCloseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resetModalIcon: { fontSize: 44, textAlign: 'center', marginBottom: 12 },
  resetModalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  resetModalText: { color: '#aaa', fontSize: 13, lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  resetConfirmBtn: {
    marginTop: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#c0392b', alignItems: 'center', width: '100%', marginBottom: 10,
  },
  resetConfirmBtnText: { color: '#c0392b', fontSize: 14, fontWeight: '600' },
  resetCancelBtn: {
    paddingVertical: 13, borderRadius: 10, borderWidth: 1.5,
    borderColor: ACCENT_PURPLE, alignItems: 'center', width: '100%',
  },
  resetCancelBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});