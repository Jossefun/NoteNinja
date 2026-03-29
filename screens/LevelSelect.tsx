import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { LevelKey } from '../notes';
import { getBestScore } from '../storage';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE, LEVEL_COLORS } from '../theme';

interface LevelOption {
  key: LevelKey;
  label: string;
  description: string;
}

const LEVELS: LevelOption[] = [
  { key: 'easy',   label: 'Easy',   description: '7 pairs  ·  Natural notes  ·  Octave 4' },
  { key: 'medium', label: 'Medium', description: '10 pairs  ·  Natural notes  ·  Octaves 3–5' },
  { key: 'hard',   label: 'Hard',   description: '14 pairs  ·  Naturals + Flats  ·  Octaves 3–6' },
  { key: 'sensei', label: 'Sensei', description: 'Custom pairs, octaves & flats  ·  Your rules' },
];

interface Props {
  readonly onSelect: (level: LevelKey) => void;
  readonly onShowInsights: () => void;
  readonly onShowOnboarding: () => void;
}

export default function LevelSelect({ onSelect, onShowInsights, onShowOnboarding }: Props) {
  const [bestScores, setBestScores] = useState<Partial<Record<LevelKey, number>>>({});

  useEffect(() => {
    const load = async () => {
      const results: Partial<Record<LevelKey, number>> = {};
      for (const level of LEVELS) {
        const scores = await Promise.all([
          getBestScore(level.key, 'normal'),
          getBestScore(level.key, 'color'),
          getBestScore(level.key, 'sound'),
        ]);
        const valid = scores.filter((s): s is number => s !== null);
        if (valid.length > 0) results[level.key] = Math.min(...valid);
      }
      setBestScores(results);
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topSection}>
        <View style={styles.titleRow}>
          <Image
            source={require('../assets/imgNotes/ninja_cover_card.png')}
            style={styles.titleIcon}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>NoteNinja</Text>
        </View>
        <Text style={styles.subtitle}>Select a level to begin</Text>
      </View>

      <View style={styles.cardsSection}>
        {LEVELS.map((level) => {
          const best = bestScores[level.key];
          return (
            <TouchableOpacity
              key={level.key}
              style={[styles.card, { borderColor: LEVEL_COLORS[level.key] }]}
              onPress={() => onSelect(level.key)}
              activeOpacity={0.75}
            >
              <View style={styles.cardRight}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.levelLabel, { color: LEVEL_COLORS[level.key] }]}>
                    {level.label}
                  </Text>
                  {best !== undefined && (
                    <Text style={[styles.bestScore, { color: LEVEL_COLORS[level.key] }]}>
                      ★ {best}
                    </Text>
                  )}
                </View>
                <Text style={styles.levelDesc} numberOfLines={1} ellipsizeMode="tail">{level.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.insightsBtn} onPress={onShowInsights}>
          <Text style={styles.insightsBtnText}>💡  My Insights</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.howToPlayBtn} onPress={onShowOnboarding}>
          <Text style={styles.howToPlayText}>How to Play</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
const ANDROID_NAV_BAR = Platform.OS === 'android' ? 48 : 0;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DEEP,
    paddingHorizontal: 24,
    paddingTop: ANDROID_STATUS_BAR,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  titleIcon: { width: 44, height: 44 },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cardsSection: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: BG_SURFACE,
    width: '78%',
  },
  cardRight: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  levelLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bestScore: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.85,
  },
  levelDesc: {
    fontSize: 12,
    color: '#aaa',
    letterSpacing: 0.3,
  },
  bottomSection: {
    flex: 0,
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR : 20,
    gap: 12,
  },
  insightsBtn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 10,
    backgroundColor: BG_SURFACE,
    borderWidth: 1.5,
    borderColor: ACCENT_PURPLE,
  },
  insightsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  howToPlayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  howToPlayText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
});