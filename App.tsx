import React, { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from './ErrorBoundary';
import LevelSelect from './screens/LevelSelect';
import ModeSelect from './screens/ModeSelect';
import GameScreen from './screens/GameScreen';
import InsightsScreen from './screens/InsightsScreen';
import SenseiLevelScreen from './screens/SenseiLevelScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { LevelKey, ModeKey } from './notes';
import { SenseiConfig } from './storage';

type Screen = 'onboarding' | 'level' | 'custom' | 'mode' | 'game' | 'insights';

const ONBOARDING_KEY = 'onboarding:done';

function AppInner() {
  const [screen, setScreen] = useState<Screen | null>(null); // null = loading
  const [level, setLevel] = useState<LevelKey | null>(null);
  const [mode, setMode] = useState<ModeKey | null>(null);
  const [senseiConfig, setSenseiConfig] = useState<SenseiConfig | null>(null);

  useEffect(() => {
    const init = async () => {
      // Configure audio: play through silent switch on iOS
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Check if onboarding has been seen
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      setScreen(done ? 'level' : 'onboarding');
    };
    init();
  }, []);

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setScreen('level');
  };

  const goToLevel = () => {
    setLevel(null);
    setMode(null);
    setSenseiConfig(null);
    setScreen('level');
  };

  // Still loading — render nothing (splash screen stays visible)
  if (screen === null) return null;

  if (screen === 'onboarding') {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  if (screen === 'insights') {
    return <InsightsScreen onBack={goToLevel} />;
  }

  if (screen === 'level' || !level) {
    return (
      <LevelSelect
        onSelect={(l) => {
          setLevel(l);
          setScreen(l === 'sensei' ? 'custom' : 'mode');
        }}
        onShowInsights={() => setScreen('insights')}
        onShowOnboarding={() => setScreen('onboarding')}
      />
    );
  }

  if (screen === 'custom') {
    return (
      <SenseiLevelScreen
        onStart={(cfg) => { setSenseiConfig(cfg); setScreen('mode'); }}
        onBack={goToLevel}
      />
    );
  }

  if (screen === 'mode' || !mode) {
    return (
      <ModeSelect
        level={level}
        onSelect={(m) => { setMode(m); setScreen('game'); }}
        onBack={() => {
          if (level === 'sensei') {
            setScreen('custom');
          } else {
            setLevel(null);
            setScreen('level');
          }
        }}
      />
    );
  }

  return (
    <GameScreen
      level={level}
      mode={mode}
      senseiConfig={senseiConfig ?? undefined}
      onBackToMenu={goToLevel}
      onBackToMode={() => { setMode(null); setScreen('mode'); }}
      onShowInsights={() => setScreen('insights')}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}