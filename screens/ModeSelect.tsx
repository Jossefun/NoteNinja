import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LevelKey, ModeKey } from '../notes';
import { BG_DEEP, BG_SURFACE, LEVEL_COLORS } from '../theme';

interface ModeOption {
  key: ModeKey;
  label: string;
  description: string;
  color: string;
  useImage: boolean;
}

const MODES: ModeOption[] = [
  {
    key: 'normal',
    label: 'Normal',
    description: 'Note name, color & sound.\nMatch by sight and ear.',
    color: '#509fd4',
    useImage: true,
  },
  {
    key: 'color',
    label: 'Color & Sound',
    description: 'Color and sound only.\nNo note name shown.',
    color: '#ae61cf',
    useImage: true,
  },
  {
    key: 'sound',
    label: 'Sound Only',
    description: 'Sound only, no color hints.\nPure ear training.',
    color: '#e67e22',
    useImage: true,
  },
];

interface Props {
  readonly level: LevelKey;
  readonly onSelect: (mode: ModeKey) => void;
  readonly onBack: () => void;
}

export default function ModeSelect({ level, onSelect, onBack }: Props) {
  const levelColor = LEVEL_COLORS[level];
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Levels</Text>
      </TouchableOpacity>

      <View style={styles.topSection}>
        <Text style={styles.appTitle}>Select Mode</Text>
        <View style={styles.levelBadge}>
          <Text style={[styles.levelBadgeText, { color: levelColor }]}>
            {levelLabel}
          </Text>
        </View>
      </View>

      <View style={styles.cardsSection}>
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={[styles.card, { borderColor: mode.color }]}
            onPress={() => onSelect(mode.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconContainer, { backgroundColor: mode.color + '22' }]}>
              {mode.useImage ? (
                <Image
                  source={mode.key === 'normal'
                    ? require('../assets/imgNotes/letter_sound.png')
                    : mode.key === 'color'
                    ? require('../assets/imgNotes/color_and_sound.png')
                    : require('../assets/imgNotes/sound_only.png')
                  }
                  style={{ width: 36, height: 36, tintColor: mode.color }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ fontSize: 28, color: mode.color }}>♪</Text>
              )}
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
    backgroundColor: BG_DEEP,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    position: 'absolute',
    top: 54,
    left: 20,
    zIndex: 1,
  },
  backBtnText: { color: '#888', fontSize: 14 },
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
  levelBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: BG_SURFACE,
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
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: BG_SURFACE,
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
  cardContent: { flex: 1 },
  modeLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modeDesc: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 20,
  },
});