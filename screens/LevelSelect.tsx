import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LevelKey } from '../notes';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE, LEVEL_COLORS } from '../theme';

interface LevelOption {
  key: LevelKey;
  label: string;
  description: string;
}

const LEVELS: LevelOption[] = [
  {
    key: 'easy',
    label: 'Easy',
    description: '7 pairs  ·  Natural notes  ·  Octave 4',
  },
  {
    key: 'medium',
    label: 'Medium',
    description: '10 pairs  ·  Natural notes  ·  Octaves 3–5',
  },
  {
    key: 'hard',
    label: 'Hard',
    description: '14 pairs  ·  Naturals + Flats  ·  Octaves 3–6',
  },
  {
    key: 'sensei',
    label: 'Sensei',
    description: 'Custom pairs, octaves & flats  ·  Your rules',
  },
];

interface Props {
  readonly onSelect: (level: LevelKey) => void;
  readonly onShowInsights: () => void;
}

export default function LevelSelect({ onSelect, onShowInsights }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topSection}>
        <Text style={styles.appTitle}>NoteNinja</Text>
        <Text style={styles.subtitle}>Select a level to begin</Text>
      </View>

      <View style={styles.cardsSection}>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.key}
            style={[styles.card, { borderColor: LEVEL_COLORS[level.key] }]}
            onPress={() => onSelect(level.key)}
            activeOpacity={0.75}
          >
            <View style={styles.cardRight}>
              <Text style={[styles.levelLabel, { color: LEVEL_COLORS[level.key] }]}>
                {level.label}
              </Text>
              <Text style={styles.levelDesc}>{level.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.insightsBtn} onPress={onShowInsights}>
          <Text style={styles.insightsBtnText}>💡  My Insights</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DEEP,
    paddingHorizontal: 24,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cardsSection: {
    flex: 3,
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
  levelLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  levelDesc: {
    fontSize: 12,
    color: '#aaa',
    letterSpacing: 0.3,
  },
  bottomSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});