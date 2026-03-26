import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { BG_DEEP, BG_SURFACE, ACCENT_PURPLE } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
const ANDROID_NAV_BAR = Platform.OS === 'android' ? 48 : 0;

// ── Slide 1: How to Play ─────────────────────────────────────────────────────

function Slide1() {
  return (
    <View style={styles.slide}>
      <Text style={styles.slideTitle}>How to Play</Text>
      <Text style={styles.slideSubtitle}>Match notes by sound and memory</Text>
      <View style={styles.cards}>

        <View style={[styles.card, { borderColor: ACCENT_PURPLE }]}>
          <View style={[styles.iconBox, { backgroundColor: ACCENT_PURPLE + '33' }]}>
            <Image
              source={require('../assets/imgNotes/ninja_cover_card.png')}
              style={{ width: 36, height: 36, tintColor: ACCENT_PURPLE }}
              resizeMode="contain"
            />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: ACCENT_PURPLE }]}>Flip cards</Text>
            <Text style={styles.cardBody}>Tap any card to flip it and hear its note.</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: '#e67e22' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#e67e2233' }]}>
            <Image
              source={require('../assets/imgNotes/sound_only.png')}
              style={{ width: 36, height: 36, tintColor: '#e67e22' }}
              resizeMode="contain"
            />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: '#e67e22' }]}>Find the match</Text>
            <Text style={styles.cardBody}>Flip a second card — if the notes match, they stay revealed.</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: '#2ecc71' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#2ecc7133' }]}>
            <Text style={{ fontSize: 30, color: '#2ecc71' }}>★</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: '#2ecc71' }]}>Clear the board</Text>
            <Text style={styles.cardBody}>Match all pairs to win. Fewer turns and less time means a better score.</Text>
          </View>
        </View>

      </View>
    </View>
  );
}

// ── Slide 2: Three Modes ─────────────────────────────────────────────────────

const MODE_ITEMS = [
  {
    label: 'Normal',
    color: '#509fd4',
    image: require('../assets/imgNotes/letter_sound.png'),
    body: 'Note name, color & sound. Great for beginners learning note names.',
  },
  {
    label: 'Color & Sound',
    color: '#ae61cf',
    image: require('../assets/imgNotes/color_and_sound.png'),
    body: 'Color and sound only — no note name shown. A step up from Normal.',
  },
  {
    label: 'Sound Only',
    color: '#e67e22',
    image: require('../assets/imgNotes/sound_only.png'),
    body: 'Pure ear training. No visual hints — match notes by listening alone.',
  },
];

function Slide2() {
  return (
    <View style={styles.slide}>
      <Text style={styles.slideTitle}>Three Modes</Text>
      <Text style={styles.slideSubtitle}>Choose how you want to play</Text>
      <View style={styles.cards}>
        {MODE_ITEMS.map((m) => (
          <View key={m.label} style={[styles.card, { borderColor: m.color }]}>
            <View style={[styles.iconBox, { backgroundColor: m.color + '22' }]}>
              <Image
                source={m.image}
                style={{ width: 36, height: 36, tintColor: m.color }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardHeading, { color: m.color }]}>{m.label}</Text>
              <Text style={styles.cardBody}>{m.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Slide 3: Scoring ─────────────────────────────────────────────────────────

// Mini trend bar chart — 4 bars that fit inside the 52×52 iconBox
const TREND_BARS = [
  { h: 28, color: '#888' },
  { h: 36, color: '#c0392b' },
  { h: 20, color: '#27ae60' },
  { h: 12, color: '#fff' },
];

function TrendMini() {
  return (
    <View style={styles.trendMini}>
      {TREND_BARS.map((bar, i) => (
        <View key={i} style={styles.trendBarWrapper}>
          <View style={[styles.trendBar, { height: bar.h, backgroundColor: bar.color }]} />
        </View>
      ))}
    </View>
  );
}

function Slide3() {
  return (
    <View style={styles.slide}>
      <Text style={styles.slideTitle}>Scoring</Text>
      <Text style={styles.slideSubtitle}>Lower is better</Text>
      <View style={styles.cards}>

        <View style={[styles.card, { borderColor: '#509fd4' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#509fd422' }]}>
            <Text style={{ fontSize: 28 }}>📐</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: '#509fd4' }]}>Formula</Text>
            <Text style={styles.cardBody}>Turns × 10 + Seconds. Every extra flip and every second counts.</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: '#e67e22' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#e67e2222' }]}>
            <Text style={{ fontSize: 28 }}>⭐</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: '#e67e22' }]}>Best score</Text>
            <Text style={styles.cardBody}>Your best per level and mode is saved. Beat it to see "New Best!"</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: ACCENT_PURPLE }]}>
          <View style={[styles.iconBox, { backgroundColor: ACCENT_PURPLE + '22' }]}>
            <TrendMini />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardHeading, { color: ACCENT_PURPLE }]}>Insights</Text>
            <Text style={styles.cardBody}>Track which notes you struggle with most across all your games.</Text>
          </View>
        </View>

      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  readonly onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < 2) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * SCREEN_WIDTH, animated: true });
    } else {
      onDone();
    }
  };

  const isLast = currentIndex === 2;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <Slide1 />
        <Slide2 />
        <Slide3 />
      </ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? '#fff' : '#444' },
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, { borderColor: isLast ? '#2ecc71' : ACCENT_PURPLE }]}
        onPress={goNext}
        activeOpacity={0.75}
      >
        <Text style={[styles.nextBtnText, { color: isLast ? '#2ecc71' : '#fff' }]}>
          {isLast ? "Let's Play" : 'Next'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DEEP,
    alignItems: 'center',
    paddingTop: ANDROID_STATUS_BAR,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 16,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 32,
    textAlign: 'center',
  },
  cards: {
    width: '100%',
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_SURFACE,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(142,68,173,0.25)',
    gap: 14,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: { flex: 1 },
  cardHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  cardBody: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 19,
  },
  // Mini trend chart — constrained to iconBox size
  trendMini: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    width: 36,
    height: 36,
    overflow: 'hidden',
  },
  trendBarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 36,
  },
  trendBar: {
    width: 5,
    borderRadius: 2,
  },
  // Navigation
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    width: '80%',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? ANDROID_NAV_BAR : 20,
    backgroundColor: 'transparent',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});