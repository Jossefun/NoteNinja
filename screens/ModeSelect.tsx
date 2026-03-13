import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LevelKey, ModeKey } from '../notes';

interface ModeOption {
  key: ModeKey;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const MODES: ModeOption[] = [
  {
    key: 'normal',
    label: 'Normal',
    icon: '🎵',
    description: 'Cards show the note name.\nMatch by sight and sound.',
    color: '#2980b9',
  },
  {
    key: 'sound',
    label: 'Sound Only',
    icon: '👂',
    description: 'Cards show no note name.\nMatch purely by ear.',
    color: '#8e44ad',
  },
];

const LEVEL_COLORS: Record<LevelKey, string> = {
  easy: '#27ae60',
  medium: '#e67e22',
  hard: '#c0392b',
};

interface Props {
  readonly level: LevelKey;
  readonly onSelect: (mode: ModeKey) => void;
  readonly onBack: () => void;
}

export default function ModeSelect({ level, onSelect, onBack }: Props) {
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back button */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Levels</Text>
      </TouchableOpacity>

      {/* Centered title */}
      <View style={styles.topSection}>
        <Text style={styles.appTitle}>Select Mode</Text>
        <View style={styles.levelBadge}>
          <Text style={[styles.levelBadgeText, { color: LEVEL_COLORS[level] }]}>
            {levelLabel}
          </Text>
        </View>
      </View>

      {/* Mode cards */}
      <View style={styles.cardsSection}>
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={[styles.card, { borderColor: mode.color }]}
            onPress={() => onSelect(mode.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconContainer, { backgroundColor: mode.color + '22' }]}>
              <Text style={styles.icon}>{mode.icon}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.modeLabel, { color: mode.color }]}>{mode.label}</Text>
              <Text style={styles.modeDesc}>{mode.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1b1523',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 8,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10, position: 'absolute', top: 54, left: 20, zIndex: 1 },
  backBtnText: { color: '#aaa', fontSize: 14 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  levelBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#251d30',
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardsSection: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#251d30',
    gap: 16,
    width: '78%',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
    color: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modeDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
});