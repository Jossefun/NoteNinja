import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import SingleCard from '../components/SingleCard';
import { LEVEL_CONFIG, NoteCard, LevelKey, ModeKey, SOUND_REQUIRES } from '../notes';
import {
  calcScore,
  getBestScore,
  saveBestScore,
  getStreak,
  incrementStreak,
  resetStreak,
  saveGameRecord,
  NoteAttempt,
} from '../storage';

const COLUMNS: Record<LevelKey, number> = { easy: 4, medium: 4, hard: 5 };
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

async function playSound(soundKey: string): Promise<void> {
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
  const parsed: MelodyNote[] = JSON.parse(text.trim());
  return parsed;
}

interface Props {
  readonly level: LevelKey;
  readonly mode: ModeKey;
  readonly onBackToMenu: () => void;
  readonly onBackToMode: () => void;
  readonly onShowInsights: () => void;
}

export default function GameScreen({ level, mode, onBackToMenu, onBackToMode, onShowInsights }: Props) {
  const [cards, setCards] = useState<NoteCard[]>([]);
  const [turns, setTurns] = useState<number>(0);
  const [choiceOne, setChoiceOne] = useState<NoteCard | null>(null);
  const [choiceTwo, setChoiceTwo] = useState<NoteCard | null>(null);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [playingNotes, setPlayingNotes] = useState<boolean>(false);

  // flashKey per soundKey — increment on match (flashes both cards in pair)
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});
  // tapFlashKeys per card id — increment on tap (flashes only the tapped card)
  const [tapFlashKeys, setTapFlashKeys] = useState<Record<string, number>>({});

  const [seconds, setSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);

  const [matchOrder, setMatchOrder] = useState<string[]>([]);
  // unique NoteCard per matched soundKey (for Play Your Notes pad)
  const [matchedCards, setMatchedCards] = useState<NoteCard[]>([]);

  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [highlightedSoundKey, setHighlightedSoundKey] = useState<string | null>(null);
  const replayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Play Your Notes" modal
  const [showNotepad, setShowNotepad] = useState<boolean>(false);

  const config = LEVEL_CONFIG[level];
  const numColumns = COLUMNS[level];
  const soundOnly = mode === 'sound';

  // Card sizing: fit all rows on screen with padding top+bottom (16px each side)
  // UI chrome approx: header(56) + statsBar(56) + footer(60) + padding(32) = 204
  const UI_CHROME = 204;
  const GRID_HEIGHT = SCREEN_HEIGHT - UI_CHROME;
  const CARD_PADDING = 16; // margin around each card
  const rows = Math.ceil((config.pairs * 2) / numColumns);
  // card size = fill grid height divided by rows, capped by width-based size
  const cardSizeByHeight = Math.floor(GRID_HEIGHT / rows) - CARD_PADDING;
  const cardSizeByWidth  = Math.floor(SCREEN_WIDTH / numColumns) - CARD_PADDING;
  const cardSize = Math.min(cardSizeByHeight, cardSizeByWidth);
  const effectiveColumns = numColumns;
  const cardHeight = cardSize;

  useEffect(() => {
    getBestScore(level, mode).then(setBestScore);
    getStreak().then(setStreak);
  }, [level, mode]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setSeconds((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

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
    setWon(false);
    setScore(null);
    setIsNewBest(false);
    setSeconds(0);
    setTimerActive(false);
    setMatchOrder([]);
    setMatchedCards([]);
    setFlashKeys({});
    setTapFlashKeys({});
    insightRef.current = {};
    setIsReplaying(false);
    setIsComposing(false);
    setPlayingNotes(false);
    setHighlightedSoundKey(null);
    setShowNotepad(false);
    if (replayRef.current) clearTimeout(replayRef.current);
  }, [config]);

  const handleChoice = (card: NoteCard): void => {
    if (choiceOne && choiceOne.id === card.id) return;
    if (!choiceOne && !timerActive) setTimerActive(true); // start on first flip
    choiceOne ? setChoiceTwo(card) : setChoiceOne(card);
  };

  useEffect(() => {
    if (choiceOne && choiceTwo) {
      setDisabled(true);
      if (choiceOne.soundKey === choiceTwo.soundKey) {
        const key = choiceOne.soundKey;
        // Record match
        setMatchOrder((prev) => [...prev, key]);
        setMatchedCards((prev) =>
          prev.find((c) => c.soundKey === key) ? prev : [...prev, choiceOne!]
        );
        // Flash both cards
        setFlashKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
        setCards((prev) =>
          prev.map((c) => c.soundKey === key ? { ...c, matched: true } : c)
        );
        resetTurn();
      } else {
        // Track confusion: choiceOne was wrong guess for some note, mark it
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

  const matchOrderRef = useRef<string[]>([]);
  useEffect(() => { matchOrderRef.current = matchOrder; }, [matchOrder]);

  // Insight tracking: wrong attempts and confusion per note
  const insightRef = useRef<Record<string, { wrong: number; confusedWith: string[] }>>({});

  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.matched)) {
      handleWin(matchOrderRef.current);
    }
  }, [cards]);

  const handleWin = async (finalMatchOrder: string[]): Promise<void> => {
    setTimerActive(false);
    const finalTurns = turns + 1;
    const finalScore = calcScore(finalTurns, seconds);
    setScore(finalScore);
    const newBest = await saveBestScore(level, mode, finalScore);
    setIsNewBest(newBest);
    if (newBest) setBestScore(finalScore);
    const newStreak = await incrementStreak();
    setStreak(newStreak);
    // Save insights record
    const noteAttempts: NoteAttempt[] = finalMatchOrder.map((note) => ({
      note,
      wrong: insightRef.current[note]?.wrong ?? 0,
      confusedWith: insightRef.current[note]?.confusedWith ?? [],
    }));
    saveGameRecord({ ts: Date.now(), level, mode, notes: noteAttempts });

    // Auto-replay then show modal
    runReplay(finalMatchOrder, () => setWon(true));
  };

  // ── Plain replay ──────────────────────────────────────────────
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
      const key = order[index];
      setHighlightedSoundKey(key);
      playSound(key);
      index++;
      replayRef.current = setTimeout(playNext, REPLAY_DELAY_MS);
    };
    playNext();
  };

  // ── AI melody ────────────────────────────────────────────────
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
    setTurns((prev) => prev + 1);
    setDisabled(false);
  };

  const handleNewGame = async (): Promise<void> => {
    await resetStreak();
    setStreak(0);
    shuffleCards();
  };

  useEffect(() => {
    shuffleCards();
    return () => {
      if (replayRef.current) clearTimeout(replayRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
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
        <Text style={styles.title}>NoteNinja</Text>
        <View style={styles.headerRight}>
          <Text style={styles.levelBadge}>{config.label}</Text>
          <Text style={styles.modeBadge}>{soundOnly ? '👂' : '🎵'}</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TURNS</Text>
          <Text style={styles.statValue}>{turns}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.statValue}>{formatTime(seconds)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>STREAK</Text>
          <Text style={styles.statValue}>{streak}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>BEST</Text>
          <Text style={styles.statValue}>{bestScore !== null ? bestScore : '—'}</Text>
        </View>
      </View>



      {/* Card grid */}
      <FlatList<NoteCard>
        data={cards}
        keyExtractor={(item) => item.id ?? item.soundKey}
        numColumns={effectiveColumns}
        key={effectiveColumns}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <SingleCard
            card={item}
            handleChoice={handleChoice}
            flipped={item === choiceOne || item === choiceTwo || item.matched}
            disabled={disabled}
            numColumns={effectiveColumns}
            cardHeight={cardSize}
            soundOnly={soundOnly}
            highlighted={isReplaying && item.soundKey === highlightedSoundKey}
            flashKey={(flashKeys[item.soundKey] ?? 0) + (tapFlashKeys[item.id ?? ''] ?? 0)}
            onTap={() => { if (playingNotes && item.matched) setTapFlashKeys((prev) => ({ ...prev, [item.id ?? '']: (prev[item.id ?? ''] ?? 0) + 1 })); }}
          />
        )}
        contentContainerStyle={styles.grid}
        style={styles.flatList}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.newGameBtn} onPress={handleNewGame}>
          <Text style={styles.newGameText}>New Game</Text>
        </TouchableOpacity>
        {playingNotes && (
          <TouchableOpacity style={styles.footerInsightsBtn} onPress={onShowInsights}>
            <Text style={styles.footerInsightsBtnText}>💡 Insights</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Win modal ── */}
      <Modal visible={won} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {isNewBest ? '🏆 New Best!' : 'You won!'}
            </Text>

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

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnAI]}
              onPress={runAIMelody}
            >
              <Text style={styles.modalBtnText}>✦ AI Melody</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnReplay]}
              onPress={() => { setWon(false); setDisabled(false); setPlayingNotes(true); }}
            >
              <Text style={styles.modalBtnText}>Play Your Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnNewGame]} onPress={shuffleCards}>
              <Text style={styles.modalBtnText}>New Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnSecondary]}
              onPress={onBackToMenu}
            >
              <Text style={styles.modalBtnText}>Change Level</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnInsights]}
              onPress={onShowInsights}
            >
              <Text style={styles.modalBtnText}>💡  My Insights</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Play Your Notes modal ── */}
      <Modal visible={showNotepad} transparent animationType="slide">
        <View style={styles.notepadOverlay}>
          <View style={styles.notepadBox}>
            <Text style={styles.notepadTitle}>🎹 Your Notes</Text>
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
            <TouchableOpacity
              style={[styles.modalBtn, { marginTop: 16 }]}
              onPress={() => setShowNotepad(false)}
            >
              <Text style={styles.modalBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { color: '#aaa', fontSize: 14 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', minWidth: 60, justifyContent: 'flex-end' },
  levelBadge: { color: '#c23866', fontSize: 13, fontWeight: '600' },
  modeBadge: { fontSize: 16, marginLeft: 6 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#251d30',
    marginHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderColor: '#888',
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
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 12 },
  footerInsightsBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#251d30', borderWidth: 1.5, borderColor: '#8e44ad' },
  footerInsightsBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  newGameBtn: { paddingVertical: 10, paddingHorizontal: 36, borderRadius: 10, backgroundColor: '#251d30', borderWidth: 1.5, borderColor: '#8e44ad' },
  newGameText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  modalBox: {
    backgroundColor: '#251d30',
    borderRadius: 16,
    padding: 28,
    width: '82%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8e44ad',
  },
  modalTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
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
    borderColor: '#8e44ad',
  },
  modalBtnAI: { borderColor: '#27ae60' },
  modalBtnNewGame: { borderColor: '#2980b9' },
  modalBtnReplay: { borderColor: '#e67e22' },    // orange — Medium
  modalBtnSecondary: { borderColor: '#c0392b' }, // red    — Hard
  modalBtnInsights: { borderColor: '#8e44ad', marginBottom: 0 },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },

  // Notepad modal
  notepadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  notepadBox: {
    backgroundColor: '#251d30',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderTopWidth: 2,
    borderColor: '#8e44ad',
  },
  notepadTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 4 },
  notepadSubtitle: { fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 20 },
  notepadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
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