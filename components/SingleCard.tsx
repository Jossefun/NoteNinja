import React, { useEffect, useRef } from 'react';
import {
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { NoteCard } from '../notes';
import { BG_SURFACE } from '../theme';
import { playSound } from '../audio';

const SCREEN_WIDTH = Dimensions.get('window').width;

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  readonly card: NoteCard;
  readonly handleChoice: (card: NoteCard) => void;
  readonly flipped: boolean;
  readonly disabled: boolean;
  readonly numColumns: number;
  readonly cardHeight?: number;
  readonly soundOnly: boolean;
  readonly trueSound?: boolean;
  readonly highlighted?: boolean;
  readonly flashKey?: number;
  readonly onTap?: () => void;
  readonly levelColor?: string;
  readonly onRegisterLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  // Hint reveal props — only affect already-matched cards at time of reveal
  readonly revealedColorIds?: Set<string>;
  readonly revealedLetterIds?: Set<string>;
}

export default function SingleCard({
  card,
  handleChoice,
  flipped,
  disabled,
  numColumns,
  cardHeight,
  soundOnly,
  trueSound = false,
  highlighted = false,
  flashKey = 0,
  onTap,
  levelColor = '#888',
  onRegisterLayout,
  revealedColorIds,
  revealedLetterIds,
}: Props) {
  const CARD_WIDTH  = cardHeight ?? (SCREEN_WIDTH / numColumns - 10);
  const CARD_HEIGHT = CARD_WIDTH;

  const flipAnim      = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const streakAnim    = useRef(new Animated.Value(-1)).current;
  const streakOpacity = useRef(new Animated.Value(0)).current;
  const prevFlashKey  = useRef(0);
  const [flashActive, setFlashActive] = React.useState(false);

  // Flip animation
  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 1 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipped]);

  // Match flash — pulse + diagonal streak
  useEffect(() => {
    if (flashKey > 0 && flashKey !== prevFlashKey.current) {
      prevFlashKey.current = flashKey;
      setFlashActive(true);

      Animated.sequence([
        // Match flash pulse 
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 450, useNativeDriver: true }),
      ]).start();

      streakAnim.setValue(-1);
      streakOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(streakOpacity, { toValue: 1,   duration: 60,  useNativeDriver: true }),
        Animated.timing(streakAnim,    { toValue: 1,   duration: 380, useNativeDriver: true }),
        Animated.timing(streakOpacity, { toValue: 0,   duration: 120, useNativeDriver: true }),
      ]).start();

      setTimeout(() => setFlashActive(false), 600);
    }
  }, [flashKey]);

  // Replay highlight pulse
  useEffect(() => {
    if (highlighted) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [highlighted]);

  const frontRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backRotate   = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0.49, 0.5], outputRange: [0, 1] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0.49, 0.5], outputRange: [1, 0] });

  const streakX = streakAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-CARD_WIDTH * 1.4, CARD_WIDTH * 1.4],
  });

  const handlePress = (): void => {
    if (!disabled) handleChoice(card);
    onTap?.();

    // Block sound on covered cards during flip-back animation
    if (!flipped && disabled) return;

    playSound(card.soundKey);
  };

  // Hint reveal: only applies to cards that were already matched when reveal was triggered
  const cardId = card.id ?? card.soundKey;
  const colorRevealed = card.matched && (revealedColorIds?.has(cardId) ?? false);
  const letterRevealed = card.matched && (revealedLetterIds?.has(cardId) ?? false);

  // In Sound Only (trueSound) mode, show color if revealed; otherwise BG_SURFACE
  const frontBgColor = (trueSound && !colorRevealed) ? BG_SURFACE : card.color;

  // Show note text if: not soundOnly, OR letter is revealed for this card
  const showNoteText = !soundOnly || letterRevealed;

  const showBorder = flashActive || highlighted;
  const fontSize = CARD_WIDTH < 55 ? 10 : CARD_WIDTH < 72 ? 14 : 18;
  const octaveFontSize = CARD_WIDTH < 55 ? 7 : CARD_WIDTH < 72 ? 10 : 12;
  const ninjaColor = lighten(levelColor, 60);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={{ margin: 3 }}
      onLayout={(e) => {
        if (!onRegisterLayout) return;
        e.target.measure((_x, _y, width, height, pageX, pageY) => {
          onRegisterLayout({ x: pageX, y: pageY, width, height });
        });
      }}
    >
      <Animated.View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale: pulseAnim }] }}>

        {/* BACK */}
        <Animated.View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: levelColor,
              overflow: 'hidden',
            },
            { transform: [{ rotateY: backRotate }], opacity: backOpacity },
          ]}
        >
          <Image
            source={require('../assets/imgNotes/ninja_cover_card.png')}
            style={{ width: '85%', height: '85%', tintColor: ninjaColor }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* FRONT */}
        <Animated.View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: 10,
              backgroundColor: frontBgColor,
              borderColor: showBorder ? '#ffffff' : 'rgba(255,255,255,0.2)',
              borderWidth: showBorder ? 3 : 2,
              overflow: 'hidden',
            },
            { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
          ]}
        >
          {showNoteText ? (
            <>
              <Text style={[styles.noteLabel, { fontSize, color: card.octaveColor }]}>
                {card.label.slice(0, -1)}
              </Text>
              <Text style={[styles.octaveLabel, { fontSize: octaveFontSize, color: card.octaveColor }]}>
                oct {card.octave}
              </Text>
            </>
          ) : (
            <Image
              source={require('../assets/imgNotes/color_and_sound.png')}
              style={{ width: CARD_WIDTH * 0.5, height: CARD_HEIGHT * 0.5, tintColor: 'rgba(255,255,255,0.5)' }}
              resizeMode="contain"
            />
          )}

          {/* Diagonal streak overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.streak,
              {
                height: CARD_HEIGHT * 2.5,
                opacity: streakOpacity,
                transform: [
                  { translateX: streakX },
                  { rotate: '-45deg' },
                ],
              },
            ]}
          />
        </Animated.View>

      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    backgroundColor: BG_SURFACE,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  streak: {
    position: 'absolute',
    width: 28,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    top: -50,
  },
  noteLabel: { fontWeight: 'bold', textAlign: 'center' },
  octaveLabel: { marginTop: 4, opacity: 0.85, textAlign: 'center' },
  soundIcon: { color: 'rgba(255,255,255,0.6)' },
});