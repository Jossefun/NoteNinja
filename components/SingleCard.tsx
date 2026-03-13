import React, { useEffect, useRef } from 'react';
import {
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { NoteCard, SOUND_REQUIRES } from '../notes';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  readonly card: NoteCard;
  readonly handleChoice: (card: NoteCard) => void;
  readonly flipped: boolean;
  readonly disabled: boolean;
  readonly numColumns: number;
  readonly cardHeight?: number;   // if provided, card is portrait rectangle
  readonly soundOnly: boolean;
  readonly highlighted?: boolean; // replay highlight
  readonly flashKey?: number;     // increment to trigger match flash
  readonly onTap?: () => void;    // called on every press (even when disabled)
}

export default function SingleCard({
  card,
  handleChoice,
  flipped,
  disabled,
  numColumns,
  cardHeight,
  soundOnly,
  highlighted = false,
  flashKey = 0,
  onTap,
}: Props) {
  // Use cardHeight as the authoritative size (GameScreen calculates it to fit screen)
  const CARD_WIDTH = cardHeight ?? (SCREEN_WIDTH / numColumns - 10);
  const CARD_HEIGHT = CARD_WIDTH;

  const flipAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isFlashing = useRef(false);
  const prevFlashKey = useRef(0);

  // Flip animation
  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 1 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipped]);

  // Match flash — 600ms, white border via isFlashing ref + forceUpdate trick
  const [flashActive, setFlashActive] = React.useState(false);
  useEffect(() => {
    if (flashKey > 0 && flashKey !== prevFlashKey.current) {
      prevFlashKey.current = flashKey;
      setFlashActive(true);
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 450, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setFlashActive(false), 600);
    }
  }, [flashKey]);

  // Replay highlight pulse
  useEffect(() => {
    if (highlighted) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [highlighted]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0.49, 0.5], outputRange: [0, 1] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0.49, 0.5], outputRange: [1, 0] });

  const handlePress = async (): Promise<void> => {
    if (!disabled) handleChoice(card);
    onTap?.();
    try {
      const source = SOUND_REQUIRES[card.soundKey];
      if (source) {
        const { sound } = await Audio.Sound.createAsync(source);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) sound.unloadAsync();
        });
      }
    } catch (_) {}
  };

  const showBorder = flashActive || highlighted;
  const fontSize = CARD_WIDTH < 55 ? 10 : CARD_WIDTH < 72 ? 14 : 18;
  const octaveFontSize = CARD_WIDTH < 55 ? 7 : CARD_WIDTH < 72 ? 10 : 12;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={{ margin: 3 }}>
      <Animated.View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale: pulseAnim }] }}>

        {/* BACK */}
        <Animated.View
          style={[
            styles.card,
            { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 10 },
            { transform: [{ rotateY: backRotate }], opacity: backOpacity },
          ]}
        >
          <Image
            source={require('../assets/imgNotes/cover.png')}
            style={{ width: '100%', height: '100%', borderRadius: 10 }}
            resizeMode="cover"
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
              backgroundColor: card.color,
              borderColor: showBorder ? '#ffffff' : 'rgba(255,255,255,0.2)',
              borderWidth: showBorder ? 3 : 2,
            },
            { transform: [{ rotateY: frontRotate }], opacity: frontOpacity },
          ]}
        >
          {soundOnly ? (
            <Text style={[styles.soundIcon, { fontSize: CARD_WIDTH * 0.4 }]}>♪</Text>
          ) : (
            <>
              <Text style={[styles.noteLabel, { fontSize, color: card.octaveColor }]}>
                {card.label.slice(0, -1)}
              </Text>
              <Text style={[styles.octaveLabel, { fontSize: octaveFontSize, color: card.octaveColor }]}>
                oct {card.octave}
              </Text>
            </>
          )}
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  noteLabel: { fontWeight: 'bold', textAlign: 'center' },
  octaveLabel: { marginTop: 4, opacity: 0.85, textAlign: 'center' },
  soundIcon: { color: 'rgba(255,255,255,0.6)' },
});