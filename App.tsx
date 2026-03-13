import React, { useState } from 'react';
import LevelSelect from './screens/LevelSelect';
import ModeSelect from './screens/ModeSelect';
import GameScreen from './screens/GameScreen';
import InsightsScreen from './screens/InsightsScreen';
import { LevelKey, ModeKey } from './notes';

type Screen = 'level' | 'mode' | 'game' | 'insights';

export default function App() {
  const [screen, setScreen] = useState<Screen>('level');
  const [level, setLevel] = useState<LevelKey | null>(null);
  const [mode, setMode] = useState<ModeKey | null>(null);

  if (screen === 'insights') {
    return <InsightsScreen onBack={() => setScreen('level')} />;
  }

  if (screen === 'level' || !level) {
    return (
      <LevelSelect
        onSelect={(l) => { setLevel(l); setScreen('mode'); }}
        onShowInsights={() => setScreen('insights')}
      />
    );
  }

  if (screen === 'mode' || !mode) {
    return (
      <ModeSelect
        level={level}
        onSelect={(m) => { setMode(m); setScreen('game'); }}
        onBack={() => { setLevel(null); setScreen('level'); }}
      />
    );
  }

  return (
    <GameScreen
      level={level}
      mode={mode}
      onBackToMenu={() => { setLevel(null); setMode(null); setScreen('level'); }}
      onBackToMode={() => { setMode(null); setScreen('mode'); }}
      onShowInsights={() => setScreen('insights')}
    />
  );
}