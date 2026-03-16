import React, { useState } from 'react';
import LevelSelect from './screens/LevelSelect';
import ModeSelect from './screens/ModeSelect';
import GameScreen from './screens/GameScreen';
import InsightsScreen from './screens/InsightsScreen';
import SenseiLevelScreen from './screens/SenseiLevelScreen';
import { LevelKey, ModeKey } from './notes';
import { SenseiConfig } from './storage';

type Screen = 'level' | 'custom' | 'mode' | 'game' | 'insights';

export default function App() {
  const [screen, setScreen] = useState<Screen>('level');
  const [level, setLevel] = useState<LevelKey | null>(null);
  const [mode, setMode] = useState<ModeKey | null>(null);
  const [senseiConfig, setSenseiConfig] = useState<SenseiConfig | null>(null);

  const goToLevel = () => {
    setLevel(null);
    setMode(null);
    setSenseiConfig(null);
    setScreen('level');
  };

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