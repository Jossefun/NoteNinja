import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Octave } from '../notes';
import { SenseiConfig, getSenseiConfig, saveSenseiConfig } from '../storage';
import { BG_DEEP, BG_SURFACE, LEVEL_COLORS } from '../theme';

const COLOR = LEVEL_COLORS.sensei;
const ALL_OCTAVES: Octave[] = [3, 4, 5, 6];
const MIN_PAIRS = 7;
const MAX_PAIRS = 14;

interface Props {
  readonly onStart: (config: SenseiConfig) => void;
  readonly onBack: () => void;
}

export default function SenseiLevelScreen({ onStart, onBack }: Props) {
  const [pairs, setPairs] = useState(7);
  const [octaves, setOctaves] = useState<Octave[]>([4]);
  const [includeFlats, setIncludeFlats] = useState(false);
  const [poolSize, setPoolSize] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Load persisted config
  useEffect(() => {
    getSenseiConfig().then((cfg) => {
      setPairs(cfg.pairs);
      setOctaves(cfg.octaves);
      setIncludeFlats(cfg.includeFlats);
      setLoaded(true);
    });
  }, []);

  // Compute available pool size and auto-clamp pairs if pool shrinks
  useEffect(() => {
    const notesPerOctave = 7 + (includeFlats ? 5 : 0);
    const newPoolSize = octaves.length * notesPerOctave;
    setPoolSize(newPoolSize);
    if (pairs > newPoolSize) {
      setPairs(Math.max(MIN_PAIRS, newPoolSize));
    }
  }, [octaves, includeFlats]);

  const toggleOctave = (oct: Octave) => {
    setOctaves((prev) => {
      if (prev.includes(oct)) {
        // Must keep at least one octave selected
        if (prev.length === 1) return prev;
        return prev.filter((o) => o !== oct);
      }
      return [...prev, oct].sort((a, b) => a - b);
    });
  };

  const handleStart = () => {
    const config: SenseiConfig = { pairs, octaves, includeFlats };
    saveSenseiConfig(config);
    onStart(config);
  };

  const pairsExceedPool = pairs > poolSize;

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Levels</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <Text style={[styles.title, { color: COLOR }]}>Sensei</Text>
        <Text style={styles.subtitle}>Configure your level</Text>

        {/* Pairs */}
        <View style={[styles.section, { borderColor: COLOR }]}>
          <Text style={styles.sectionLabel}>PAIRS</Text>
          <View style={styles.pairsRow}>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: COLOR }]}
              onPress={() => setPairs((p) => Math.max(MIN_PAIRS, p - 1))}
            >
              <Text style={[styles.stepBtnText, { color: COLOR }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.pairsValue, { color: COLOR }]}>{pairs}</Text>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: COLOR }]}
              onPress={() => setPairs((p) => Math.min(MAX_PAIRS, p + 1))}
            >
              <Text style={[styles.stepBtnText, { color: COLOR }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Octaves */}
        <View style={[styles.section, { borderColor: COLOR }]}>
          <Text style={styles.sectionLabel}>OCTAVES</Text>
          <View style={styles.checkRow}>
            {ALL_OCTAVES.map((oct) => {
              const selected = octaves.includes(oct);
              return (
                <TouchableOpacity
                  key={oct}
                  style={[
                    styles.checkItem,
                    { borderColor: selected ? COLOR : 'rgba(255,255,255,0.2)' },
                    selected && { backgroundColor: COLOR + '33' },
                  ]}
                  onPress={() => toggleOctave(oct)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.checkLabel, { color: selected ? COLOR : '#888' }]}>
                    Oct {oct}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Flats toggle */}
        <View style={[styles.section, { borderColor: COLOR }]}>
          <Text style={styles.sectionLabel}>INCLUDE FLATS</Text>
          <TouchableOpacity
            style={[
              styles.toggle,
              { borderColor: includeFlats ? COLOR : 'rgba(255,255,255,0.2)' },
              includeFlats && { backgroundColor: COLOR + '33' },
            ]}
            onPress={() => setIncludeFlats((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, { color: includeFlats ? COLOR : '#888' }]}>
              {includeFlats ? '✓  B♭  E♭  A♭  D♭  G♭' : 'Naturals only'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pool info */}
        <Text style={[styles.poolInfo, pairsExceedPool && styles.poolWarning]}>
          {pairsExceedPool
            ? `⚠ Pool has ${poolSize} notes — reduce pairs to ${poolSize} or add more octaves`
            : `Pool: ${poolSize} notes available`}
        </Text>

        {/* Start button */}
        <TouchableOpacity
          style={[styles.startBtn, { borderColor: COLOR }, pairsExceedPool && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={pairsExceedPool}
          activeOpacity={0.75}
        >
          <Text style={[styles.startBtnText, { color: pairsExceedPool ? '#555' : COLOR }]}>
            Start Game
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DEEP },
  backBtn: { paddingVertical: 6, paddingHorizontal: 16, marginTop: 8 },
  backBtnText: { color: '#aaa', fontSize: 14 },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    letterSpacing: 1,
    marginBottom: 32,
  },
  section: {
    width: '100%',
    backgroundColor: BG_SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  // Pairs stepper
  pairsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 24, fontWeight: 'bold', lineHeight: 28 },
  pairsValue: { fontSize: 36, fontWeight: 'bold', minWidth: 48, textAlign: 'center' },
  // Octave checkboxes
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  checkItem: {
    flex: 1,
    minWidth: 64,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  checkLabel: { fontSize: 14, fontWeight: '600' },
  // Flats toggle
  toggle: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  toggleText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  // Pool info
  poolInfo: {
    fontSize: 12,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  poolWarning: { color: '#e74c3c' },
  // Start button
  startBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: BG_SURFACE,
  },
  startBtnDisabled: { borderColor: '#333' },
  startBtnText: { fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
});