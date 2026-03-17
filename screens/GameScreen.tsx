import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import SingleCard from '../components/SingleCard';
import { LEVEL_CONFIG, NoteCard, LevelKey, ModeKey, buildSenseiPool } from '../notes';
import {
  calcScore,
  getBestScore,
  saveBestScore,
  getScoreRank,
  getStreak,
  incrementStreak,
  resetStreak,
  saveGameRecord,
  NoteAttempt,
  SenseiConfig,
} from '../storage';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE, LEVEL_COLORS, LEVEL_TITLES } from '../theme';
import { playSound } from '../audio';

const COLUMNS: Record<LevelKey, number> = { easy: 4, medium: 4, hard: 5, sensei: 5 };
const REPLAY_DELAY_MS = 300;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MelodyNote {
  note: string;
  duration: number;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}


async function composeMelody(notes: string[]): Promise<MelodyNote[]> {
  const prompt = `You are a music composer. The player matched these notes in a memory game: ${notes.join(', ')}.

Arrange ALL of these notes (use each note exactly once) into a short melody that sounds pleasant and musical.
You may reorder them freely to create a better musical flow.

Respond with ONLY a JSON array, no explanation, no markdown, no backticks. Example format:
[{"note":"C4","duration":500},{"note":"E4","duration":300}]

Rules:
- Use every note exactly once
- duration is milliseconds until the next note plays (200–800ms range)
- Make it sound like a real melody, not random`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';
  return JSON.parse(text.trim()) as MelodyNote[];
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

interface Props {
  readonly level: LevelKey;
  readonly mode: ModeKey;
  readonly senseiConfig?: SenseiConfig;
  readonly onBackToMenu: () => void;
  readonly onBackToMode: () => void;
  readonly onShowInsights: () => void;
}

export default function GameScreen({ level, mode, senseiConfig, onBackToMenu, onBackToMode, onShowInsights }: Props) {
  // Game state
  const [cards, setCards] = useState<NoteCard[]>([]);
  const [turns, setTurns] = useState(0);
  const turnsRef = useRef(0);
  const [choiceOne, setChoiceOne] = useState<NoteCard | null>(null);
  const [choiceTwo, setChoiceTwo] = useState<NoteCard | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [won, setWon] = useState(false);
  const [playingNotes, setPlayingNotes] = useState(false);

  // Flash keys: match flash (by soundKey) and tap flash (by card id)
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});
  const [tapFlashKeys, setTapFlashKeys] = useState<Record<string, number>>({});

  // Timer
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Score & streak
  const [score, setScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [scoreRank, setScoreRank] = useState<{ rank: number; total: number } | null>(null);

  // Match tracking
  const [matchOrder, setMatchOrder] = useState<string[]>([]);
  const [matchedCards, setMatchedCards] = useState<NoteCard[]>([]);

  // Replay & AI melody
  const [isReplaying, setIsReplaying] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [highlightedSoundKey, setHighlightedSoundKey] = useState<string | null>(null);
  const replayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [showNotepad, setShowNotepad] = useState(false);

  // Swipe-to-play: card layout map and last swiped card tracker
  const cardLayoutsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const lastSwipedIdRef = useRef<string | null>(null);
  const playingNotesRef = useRef(false);
  useEffect(() => { playingNotesRef.current = playingNotes; }, [playingNotes]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => playingNotesRef.current,
      onMoveShouldSetPanResponder: () => playingNotesRef.current,
      onPanResponderGrant: (e) => {
        lastSwipedIdRef.current = null;
        handleSwipeMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        handleSwipeMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        lastSwipedIdRef.current = null;
      },
    })
  ).current;

  const handleSwipeMove = (pageX: number, pageY: number): void => {
    const layouts = cardLayoutsRef.current;
    for (const id in layouts) {
      const { x, y, width, height } = layouts[id];
      if (pageX >= x && pageX <= x + width && pageY >= y && pageY <= y + height) {
        if (id === lastSwipedIdRef.current) return; // already played this card
        lastSwipedIdRef.current = id;
        // Find the card and trigger sound + flash (matched cards only)
        setCards((prev) => {
          const card = prev.find((c) => c.id === id);
          if (card?.matched) {
            playSound(card.soundKey);
            setTapFlashKeys((fk) => ({ ...fk, [id]: (fk[id] ?? 0) + 1 }));
          }
          return prev;
        });
        break;
      }
    }
  };

  // Build config: sensei uses dynamic pool, others use LEVEL_CONFIG
  const config = level === 'sensei' && senseiConfig
    ? {
        pool: buildSenseiPool(senseiConfig.octaves, senseiConfig.includeFlats),
        pairs: senseiConfig.pairs,
        label: 'Sensei',
        randomize: true,
      }
    : LEVEL_CONFIG[level as Exclude<LevelKey, 'sensei'>];

  const numColumns = COLUMNS[level];
  const soundOnly = mode === 'sound';
  const colorMode = mode === 'color';
  const hideNoteName = soundOnly || colorMode;
  const levelColor = LEVEL_COLORS[level];
  const modeColor = mode === 'normal' ? '#509fd4' : mode === 'color' ? '#ae61cf' : '#e67e22';

  // Card sizing: fit all rows within available screen height
  const UI_CHROME = 204;
  const rows = Math.ceil((config.pairs * 2) / numColumns);
  const cardSizeByHeight = Math.floor((SCREEN_HEIGHT - UI_CHROME) / rows) - 10;
  const cardSizeByWidth = Math.floor(SCREEN_WIDTH / numColumns) - 10;
  const cardSize = Math.min(cardSizeByHeight, cardSizeByWidth);

  // Insight tracking: wrong attempts per note
  const insightRef = useRef<Record<string, { wrong: number; confusedWith: string[] }>>({});
  const matchOrderRef = useRef<string[]>([]);
  useEffect(() => { matchOrderRef.current = matchOrder; }, [matchOrder]);

  // Load best score and streak on mount
  useEffect(() => {
    getBestScore(level, mode).then(setBestScore);
    getStreak().then(setStreak);
  }, [level, mode]);

  // Timer tick
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setSeconds((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // Blink animation while paused
  useEffect(() => {
    if (paused) {
      blinkRef.current = setInterval(() => {
        blinkAnim.setValue(0);
        setTimeout(() => blinkAnim.setValue(1), 400);
      }, 1000);
    } else {
      if (blinkRef.current) clearInterval(blinkRef.current);
      blinkAnim.setValue(1);
    }
    return () => { if (blinkRef.current) clearInterval(blinkRef.current); };
  }, [paused]);

  const handleTimerTap = (): void => {
    if (!timerActive && !paused) return; // timer hasn't started yet
    if (paused) {
      setPaused(false);
      setTimerActive(true);
    } else {
      setPaused(true);
      setTimerActive(false);
    }
  };

  const shuffleCards = useCallback((): void => {
    const selected = config.randomize
      ? pickRandom<NoteCard>(config.pool, config.pairs)
      : config.pool.slice(0, config.pairs);

    const shuffled: NoteCard[] = [...selected, ...selected]
      .sort(() => Math.random() - 0.5)
      .map((card) => ({ ...card, id: Math.random().toString() }));

    setChoiceOne(null);
    setChoiceTwo(null);
    setCards(shuffled);
    setTurns(0);
    turnsRef.current = 0;
    setWon(false);
    setScore(null);
    setIsNewBest(false);
    setScoreRank(null);
    setSeconds(0);
    setTimerActive(false);
    setPaused(false);
    setMatchOrder([]);
    setMatchedCards([]);
    setFlashKeys({});
    setTapFlashKeys({});
    insightRef.current = {};
    cardLayoutsRef.current = {};
    setIsReplaying(false);
    setIsComposing(false);
    setPlayingNotes(false);
    setHighlightedSoundKey(null);
    setShowNotepad(false);
    if (replayRef.current) clearTimeout(replayRef.current);
  }, [config]);

  const handleChoice = (card: NoteCard): void => {
    if (paused) return;
    if (choiceOne && choiceOne.id === card.id) return;
    if (!choiceOne && !timerActive) setTimerActive(true);
    choiceOne ? setChoiceTwo(card) : setChoiceOne(card);
  };

  // Compare two selected cards
  useEffect(() => {
    if (choiceOne && choiceTwo) {
      setDisabled(true);
      if (choiceOne.soundKey === choiceTwo.soundKey) {
        const key = choiceOne.soundKey;
        setMatchOrder((prev) => [...prev, key]);
        setMatchedCards((prev) =>
          prev.find((c) => c.soundKey === key) ? prev : [...prev, choiceOne!]
        );
        setFlashKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
        setCards((prev) => prev.map((c) => c.soundKey === key ? { ...c, matched: true } : c));
        resetTurn();
      } else {
        // Track confusion for insights
        const wrongKey = choiceOne.soundKey;
        const otherKey = choiceTwo.soundKey;
        if (!insightRef.current[wrongKey]) insightRef.current[wrongKey] = { wrong: 0, confusedWith: [] };
        if (!insightRef.current[otherKey]) insightRef.current[otherKey] = { wrong: 0, confusedWith: [] };
        insightRef.current[wrongKey].wrong += 1;
        insightRef.current[wrongKey].confusedWith.push(otherKey);
        insightRef.current[otherKey].wrong += 1;
        insightRef.current[otherKey].confusedWith.push(wrongKey);
        setTimeout(() => resetTurn(), 1000);
      }
    }
  }, [choiceOne, choiceTwo]);

  // Check for win
  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.matched)) {
      handleWin(matchOrderRef.current);
    }
  }, [cards]);

  const handleWin = async (finalMatchOrder: string[]): Promise<void> => {
    setTimerActive(false);
    setPaused(false);
    const finalScore = calcScore(turnsRef.current, seconds);
    setScore(finalScore);
    const newBest = await saveBestScore(level, mode, finalScore);
    setIsNewBest(newBest);
    if (newBest) setBestScore(finalScore);
    const rank = await getScoreRank(level, mode, finalScore);
    setScoreRank(rank);
    const newStreak = await incrementStreak();
    setStreak(newStreak);
    const noteAttempts: NoteAttempt[] = finalMatchOrder.map((note) => ({
      note,
      wrong: insightRef.current[note]?.wrong ?? 0,
      confusedWith: insightRef.current[note]?.confusedWith ?? [],
    }));
    saveGameRecord({ ts: Date.now(), level, mode, notes: noteAttempts });
    replayRef.current = setTimeout(() => runReplay(finalMatchOrder, () => setWon(true)), 1000);
  };

  const runReplay = (order: string[], onDone?: () => void): void => {
    if (order.length === 0) { onDone?.(); return; }
    setIsReplaying(true);
    setDisabled(true);
    let index = 0;
    const playNext = (): void => {
      if (index >= order.length) {
        setHighlightedSoundKey(null);
        setIsReplaying(false);
        setDisabled(false);
        onDone?.();
        return;
      }
      setHighlightedSoundKey(order[index]);
      playSound(order[index]);
      index++;
      replayRef.current = setTimeout(playNext, REPLAY_DELAY_MS);
    };
    playNext();
  };

  const runAIMelody = async (): Promise<void> => {
    setWon(false);
    setIsComposing(true);
    setDisabled(true);
    let melody: MelodyNote[] = [];
    try {
      melody = await composeMelody(matchOrder);
    } catch (_) {
      setIsComposing(false);
      runReplay(matchOrder, () => setWon(true));
      return;
    }
    setIsComposing(false);
    setIsReplaying(true);
    let index = 0;
    const playNext = (): void => {
      if (index >= melody.length) {
        setHighlightedSoundKey(null);
        setIsReplaying(false);
        setDisabled(false);
        setWon(true);
        return;
      }
      const { note, duration } = melody[index];
      setHighlightedSoundKey(note);
      playSound(note);
      index++;
      replayRef.current = setTimeout(playNext, duration);
    };
    playNext();
  };

  const resetTurn = (): void => {
    setChoiceOne(null);
    setChoiceTwo(null);
    setTurns((prev) => {
      turnsRef.current = prev + 1;
      return prev + 1;
    });
    setDisabled(false);
  };

  const handleNewGame = async (): Promise<void> => {
    await resetStreak();
    setStreak(0);
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      shuffleCards();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  // Init on level/mode change, cleanup on unmount
  useEffect(() => {
    shuffleCards();
    return () => {
      if (replayRef.current) clearTimeout(replayRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (blinkRef.current) clearInterval(blinkRef.current);
    };
  }, [level, mode]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackToMode} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Mode</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: levelColor }]}>
            {LEVEL_TITLES[level]}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {soundOnly ? (
            <Image
              source={require('../assets/imgNotes/sound_only.png')}
              style={{ width: 32, height: 32, tintColor: modeColor }}
              resizeMode="contain"
            />
          ) : (
            <Image
              source={colorMode
                ? require('../assets/imgNotes/color_and_sound.png')
                : require('../assets/imgNotes/letter_sound.png')
              }
              style={{ width: 32, height: 32, tintColor: modeColor }}
              resizeMode="contain"
            />
          )}
        </View>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { borderColor: levelColor }]}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TURNS</Text>
          <Text style={styles.statValue}>{turns}</Text>
        </View>
        <TouchableOpacity style={styles.statItem} onPress={handleTimerTap} activeOpacity={0.7}>
          <Text style={styles.statLabel}>{paused ? 'PAUSED' : 'TIME'}</Text>
          <Animated.Text style={[styles.statValue, { opacity: blinkAnim }]}>
            {formatTime(seconds)}
          </Animated.Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>STREAK</Text>
          <Text style={styles.statValue}>{streak}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>BEST</Text>
          <Text style={styles.statValue}>{bestScore !== null ? bestScore : '—'}</Text>
        </View>
      </View>

      {/* Card grid — PanResponder active in playingNotes mode */}
      <Animated.View style={[styles.flatList, { opacity: fadeAnim }]} {...panResponder.panHandlers}>
        <FlatList<NoteCard>
          data={cards}
          keyExtractor={(item) => item.id ?? item.soundKey}
          numColumns={numColumns}
          key={numColumns}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <SingleCard
              card={item}
              handleChoice={handleChoice}
              flipped={item === choiceOne || item === choiceTwo || item.matched}
              disabled={disabled}
              numColumns={numColumns}
              cardHeight={cardSize}
              soundOnly={hideNoteName}
              trueSound={soundOnly}
              highlighted={isReplaying && item.soundKey === highlightedSoundKey}
              flashKey={(flashKeys[item.soundKey] ?? 0) + (tapFlashKeys[item.id ?? ''] ?? 0)}
              onTap={() => {
                if (playingNotes && item.matched)
                  setTapFlashKeys((prev) => ({ ...prev, [item.id ?? '']: (prev[item.id ?? ''] ?? 0) + 1 }));
              }}
              onRegisterLayout={(layout) => {
                if (item.id) cardLayoutsRef.current[item.id] = layout;
              }}
              levelColor={levelColor}
            />
          )}
          contentContainerStyle={styles.grid}
        />
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.newGameBtn, { borderColor: levelColor }]} onPress={handleNewGame}>
          <Text style={styles.newGameText}>New Game</Text>
        </TouchableOpacity>
        {playingNotes && (
          <TouchableOpacity style={[styles.footerInsightsBtn, { borderColor: levelColor }]} onPress={onShowInsights}>
            <Text style={styles.footerInsightsBtnText}>💡 Insights</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Win modal */}
      <Modal visible={won} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { borderColor: levelColor }]}>
            <Text style={[styles.modalTitle, { color: levelColor }]}>
              {isNewBest ? '★ New Best!' : 'You won!'}
            </Text>
            {scoreRank && !isNewBest && (
              <Text style={styles.rankText}>
                {ordinal(scoreRank.rank)} best of {scoreRank.total} games
              </Text>
            )}
            <View style={styles.scoreGrid}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>TURNS</Text>
                <Text style={styles.scoreValue}>{turns}</Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>TIME</Text>
                <Text style={styles.scoreValue}>{formatTime(seconds)}</Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>SCORE</Text>
                <Text style={[styles.scoreValue, { color: '#f1c40f' }]}>{score}</Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>STREAK</Text>
                <Text style={styles.scoreValue}>{streak}</Text>
              </View>
            </View>
            {bestScore !== null && (
              <Text style={styles.bestScoreText}>Best: {bestScore}</Text>
            )}
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnAI]} onPress={runAIMelody}>
              <Text style={styles.modalBtnText}>✦ AI Melody</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnReplay]}
              onPress={() => {
                if (replayRef.current) clearTimeout(replayRef.current);
                setIsReplaying(false);
                setWon(false);
                setDisabled(false);
                setPlayingNotes(true);
              }}
            >
              <Text style={styles.modalBtnText}>Play Your Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnNewGame]} onPress={() => {
              Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                shuffleCards();
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
              });
            }}>
              <Text style={styles.modalBtnText}>New Game</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={onBackToMenu}>
              <Text style={styles.modalBtnText}>Change Level</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnInsights]} onPress={onShowInsights}>
              <Text style={styles.modalBtnText}>💡  My Insights</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Play Your Notes modal */}
      <Modal visible={showNotepad} transparent animationType="slide">
        <View style={styles.notepadOverlay}>
          <View style={styles.notepadBox}>
            <Text style={styles.notepadTitle}>♹ Your Notes</Text>
            <Text style={styles.notepadSubtitle}>Tap any note to hear it</Text>
            <ScrollView contentContainerStyle={styles.notepadGrid}>
              {matchedCards.map((card) => (
                <TouchableOpacity
                  key={card.soundKey}
                  style={[styles.notepadCard, { backgroundColor: card.color }]}
                  onPress={() => playSound(card.soundKey)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notepadNote, { color: card.octaveColor }]}>
                    {card.label.slice(0, -1)}
                  </Text>
                  <Text style={[styles.notepadOctave, { color: card.octaveColor }]}>
                    oct {card.octave}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtn, { marginTop: 16 }]} onPress={() => setShowNotepad(false)}>
              <Text style={styles.modalBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI composing overlay */}
      {isComposing && (
        <View style={styles.composingOverlay}>
          <ActivityIndicator size="large" color="#27ae60" />
          <Text style={styles.composingText}>Composing melody…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DEEP },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { color: '#aaa', fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', minWidth: 40, justifyContent: 'flex-end' },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: BG_SURFACE,
    marginHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  flatList: { flex: 1 },
  grid: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  footerInsightsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: BG_SURFACE,
    borderWidth: 1,
    borderColor: ACCENT_PURPLE,
  },
  footerInsightsBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  newGameBtn: {
    paddingVertical: 10,
    paddingHorizontal: 36,
    borderRadius: 10,
    backgroundColor: BG_SURFACE,
    borderWidth: 1,
  },
  newGameText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  modalBox: {
    backgroundColor: BG_SURFACE,
    borderRadius: 16,
    padding: 28,
    width: '82%',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  rankText: { color: '#aaa', fontSize: 12, marginBottom: 14, letterSpacing: 0.5 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', width: '100%', marginBottom: 12 },
  scoreItem: { alignItems: 'center', width: '45%', marginBottom: 14 },
  scoreLabel: { fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 3 },
  scoreValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  bestScoreText: { color: '#aaa', fontSize: 13, marginBottom: 20 },
  modalBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: ACCENT_PURPLE,
  },
  modalBtnAI:        { borderColor: '#27ae60' },
  modalBtnNewGame:   { borderColor: '#2980b9' },
  modalBtnReplay:    { borderColor: '#e67e22' },
  modalBtnSecondary: { borderColor: '#c0392b' },
  modalBtnInsights:  { borderColor: ACCENT_PURPLE, marginBottom: 0 },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  notepadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  notepadBox: {
    backgroundColor: BG_SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderTopWidth: 2,
    borderColor: ACCENT_PURPLE,
  },
  notepadTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 4 },
  notepadSubtitle: { fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 20 },
  notepadGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  notepadCard: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    elevation: 4,
  },
  notepadNote: { fontSize: 18, fontWeight: 'bold' },
  notepadOctave: { fontSize: 10, opacity: 0.85, marginTop: 2 },
  composingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  composingText: { color: '#fff', fontSize: 16 },
});