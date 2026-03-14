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

interface LevelOption {
  key: LevelKey;
  label: string;
  description: string;
  color: string;
}

const LEVELS: LevelOption[] = [
  {
    key: 'easy',
    label: 'Easy',
    description: '7 pairs  ·  Natural notes  ·  Octave 4',
    color: '#3cd37b',
  },
  {
    key: 'medium',
    label: 'Medium',
    description: '10 pairs  ·  Natural notes  ·  Octaves 3–5',
    color: '#f09d55',
  },
  {
    key: 'hard',
    label: 'Hard',
    description: '14 pairs  ·  Naturals + Flats  ·  Octaves 3–6',
    color: '#e45e4f',
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
            style={[styles.card, { borderColor: level.color }]}
            onPress={() => onSelect(level.key)}
            activeOpacity={0.75}
          >
            <View style={styles.cardRight}>
              <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
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
    backgroundColor: '#1b1523',
    paddingHorizontal: 24,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
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
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#251d30',
    width: '78%',
  },
  cardLeft: {
    width: 48,
    alignItems: 'center',
    marginRight: 16,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardRight: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  levelDesc: {
    fontSize: 12,
    color: '#fff',
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
    backgroundColor: '#251d30',
    borderWidth: 1.5,
    borderColor: '#8e44ad',
  },
  insightsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});