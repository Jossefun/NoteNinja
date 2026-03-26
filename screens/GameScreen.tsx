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
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import SingleCard from '../components/SingleCard';
import { LEVEL_CONFIG, NoteCard, LevelKey, ModeKey, buildSenseiPool } from '../notes';
import {
  calcScore,
  getBestScore,
  saveBestScore,
  getScoreRank,
  saveGameRecord,
  NoteAttempt,
  SenseiConfig,
} from '../storage';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE, LEVEL_COLORS, LEVEL_TITLES } from '../theme';
import { playSound } from '../audio';

const COLUMNS: Record<LevelKey, number> = { easy: 4, medium: 4, hard: 5, sensei: 5 };
const REPLAY_DELAY_MS = 300;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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

  // Score
  const [score, setScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [scoreRank, setScoreRank] = useState<{ rank: number; total: number } | null>(null);

  // Match tracking
  const [matchOrder, setMatchOrder] = useState<string[]>([]);
  const [matchedCards, setMatchedCards] = useState<NoteCard[]>([]);

  // Replay
  const [isReplaying, setIsReplaying] = useState(false);
  const [highlightedSoundKey, setHighlightedSoundKey] = useState<string | null>(null);
  const replayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [showNotepad, setShowNotepad] = useState(false);

  // Mode hint modal
  const [showModeHint, setShowModeHint] = useState(false);

  // Reveal sets: IDs of already-matched cards at the moment reveal was triggered.
  // New matches after reveal are NOT included — reveal is a snapshot.
  const [revealedColorIds, setRevealedColorIds] = useState<Set<string>>(new Set());
  const [revealedLetterIds, setRevealedLetterIds] = useState<Set<string>>(new Set());

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
        if (id === lastSwipedIdRef.current) return;
        lastSwipedIdRef.current = id;
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

  // Load best score on mount
  useEffect(() => {
    getBestScore(level, mode).then(setBestScore);
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
    if (!timerActive && !paused) return;
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
    setPlayingNotes(false);
    setHighlightedSoundKey(null);
    setShowNotepad(false);
    // Reset hint reveals for new game
    setRevealedColorIds(new Set());
    setRevealedLetterIds(new Set());
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

  const resetTurn = (): void => {
    setChoiceOne(null);
    setChoiceTwo(null);
    setTurns((prev) => {
      turnsRef.current = prev + 1;
      return prev + 1;
    });
    setDisabled(false);
  };

  const handleNewGame = (): void => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      shuffleCards();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  // Snapshot the IDs of currently matched cards and add them to the reveal set
  const handleRevealColors = (): void => {
    setCards((prev) => {
      const ids = new Set(prev.filter((c) => c.matched).map((c) => c.id ?? c.soundKey));
      setRevealedColorIds(ids);
      return prev;
    });
    setShowModeHint(false);
  };

  const handleRevealLetters = (): void => {
    setCards((prev) => {
      const ids = new Set(prev.filter((c) => c.matched).map((c) => c.id ?? c.soundKey));
      setRevealedLetterIds(ids);
      return prev;
    });
    setShowModeHint(false);
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

  const colorsRevealed = revealedColorIds.size > 0;
  const lettersRevealed = revealedLetterIds.size > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackToMode} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Mode</Text>
        </TouchableOpacity>
        <View style={styles.titleRow} pointerEvents="none">
          <Text style={[styles.title, { color: levelColor }]}>
            {LEVEL_TITLES[level]}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Tappable mode icon — opens hint modal */}
          <TouchableOpacity
            onPress={() => setShowModeHint(true)}
            activeOpacity={0.6}
            style={styles.modeIconBtn}
          >
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
          </TouchableOpacity>
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
              revealedColorIds={revealedColorIds}
              revealedLetterIds={revealedLetterIds}
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
            </View>
            {bestScore !== null && (
              <Text style={styles.bestScoreText}>Best: {bestScore}</Text>
            )}
            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: levelColor }]}
              onPress={() => { setWon(false); handleNewGame(); }}
            >
              <Text style={styles.modalBtnText}>New Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: levelColor }]}
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
            <TouchableOpacity style={[styles.modalBtn, { borderColor: levelColor }]} onPress={onBackToMenu}>
              <Text style={styles.modalBtnText}>Change Level</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { borderColor: levelColor, marginBottom: 0 }]} onPress={onShowInsights}>
              <Text style={styles.modalBtnText}>💡  My Insights</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mode hint modal */}
      <Modal visible={showModeHint} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { borderColor: modeColor }]}>
            <Text style={[styles.modalTitle, { color: modeColor, fontSize: 18, marginBottom: 16 }]}>
              Hint Options
            </Text>

            {/* Sound Only mode: offer color reveal and letter reveal */}
            {mode === 'sound' && (
              <>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    { borderColor: colorsRevealed ? '#555' : ACCENT_PURPLE },
                    colorsRevealed && styles.modalBtnDone,
                  ]}
                  onPress={handleRevealColors}
                  disabled={colorsRevealed}
                >
                  <Text style={[styles.modalBtnText, colorsRevealed && styles.modalBtnDoneText]}>
                    {colorsRevealed ? 'Colors Revealed ✓' : 'Reveal Colors'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    { borderColor: lettersRevealed ? '#555' : ACCENT_PURPLE },
                    lettersRevealed && styles.modalBtnDone,
                  ]}
                  onPress={handleRevealLetters}
                  disabled={lettersRevealed}
                >
                  <Text style={[styles.modalBtnText, lettersRevealed && styles.modalBtnDoneText]}>
                    {lettersRevealed ? 'Letters Revealed ✓' : 'Reveal Letters'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Color mode: offer letter reveal only */}
            {mode === 'color' && (
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { borderColor: lettersRevealed ? '#555' : ACCENT_PURPLE },
                  lettersRevealed && styles.modalBtnDone,
                ]}
                onPress={handleRevealLetters}
                disabled={lettersRevealed}
              >
                <Text style={[styles.modalBtnText, lettersRevealed && styles.modalBtnDoneText]}>
                  {lettersRevealed ? 'Letters Revealed ✓' : 'Reveal Letters'}
                </Text>
              </TouchableOpacity>
            )}

            {/* All modes: change mode */}
            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: '#e74c3c' }]}
              onPress={() => { setShowModeHint(false); onBackToMode(); }}
            >
              <Text style={[styles.modalBtnText, { color: '#e74c3c' }]}>Change Mode</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: ACCENT_PURPLE, marginBottom: 0 }]}
              onPress={() => setShowModeHint(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
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

    </SafeAreaView>
  );
}

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
const ANDROID_NAV_BAR = Platform.OS === 'android' ? 48 : 0;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DEEP, paddingTop: ANDROID_STATUS_BAR },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { color: '#888', fontSize: 14 },
  titleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', minWidth: 40, justifyContent: 'flex-end' },
  modeIconBtn: { padding: 6 },
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
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR : 14,
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
  modalBtnDone: {
    opacity: 0.45,
  },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  modalBtnDoneText: { color: '#aaa' },
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
});