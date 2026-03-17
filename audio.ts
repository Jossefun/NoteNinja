import { Audio } from 'expo-av';
import { SOUND_REQUIRES } from './notes';

export async function playSound(soundKey: string): Promise<void> {
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