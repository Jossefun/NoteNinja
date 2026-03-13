# Music Memory – React Native (Expo) v2

## Project structure

```
App.js                        ← root: routes between level select and game
notes.js                      ← all note definitions, level pools, sound requires
screens/
  LevelSelect.js              ← dedicated level selection screen
  GameScreen.js               ← main game logic + win modal
components/
  SingleCard.js               ← flip animation + text-based card face + sound
assets/
  imgNotes/
    cover.png                 ← card back image (required)
  musicNotes/
    C3.mp3  D3.mp3 ... B6.mp3
    Bb3.mp3 Eb3.mp3 ... Gb6.mp3
```

## Levels

| Level  | Pairs | Notes used                          | Octaves |
|--------|-------|-------------------------------------|---------|
| Easy   | 7     | C D E F G A B (naturals)            | 3       |
| Medium | 10    | C D E F G A B C D E (naturals)      | 3–4     |
| Hard   | 14    | Naturals + B♭ E♭ A♭ D♭ G♭ (flats)  | 3–6     |

## Setup

```bash
npm install
npx expo start
```

## Asset filenames expected in assets/musicNotes/

Naturals: C3 D3 E3 F3 G3 A3 B3  (repeat for 4, 5, 6)
Flats:    Bb3 Eb3 Ab3 Db3 Gb3   (repeat for 4, 5, 6)

Cover image: assets/imgNotes/cover.png

If you are missing some octaves, remove those entries from SOUND_REQUIRES
in notes.js and remove those notes from HARD_POOL.

## Key changes from v1

- No PNG images for note faces — rendered with View + Text, colour-coded per note
- Octave tint colour distinguishes octave 3/4/5/6 at a glance
- Dedicated LevelSelect screen
- Win modal with turn count, play-again and change-level actions
- Match comparison uses soundKey (note + octave) — same note in different octaves does NOT match
- Sound plays on every tap via expo-av, unloaded after playback