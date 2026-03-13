"""
rename_notes.py
---------------
Renames note audio files from the pattern:
  3-b.mp3  →  B3.mp3
  3-cs.mp3 →  Db3.mp3   (sharp → enharmonic flat)
  4-fs.mp3 →  Gb4.mp3
  etc.

Usage:
  1. Place this script in the same folder as your audio files.
  2. Run:  python rename_notes.py
  3. A dry-run preview is printed first. Press Enter to confirm.
"""

import os
import sys

# ── Mapping: note letter → standard name (naturals)
NATURALS = {
    'c': 'C',
    'd': 'D',
    'e': 'E',
    'f': 'F',
    'g': 'G',
    'a': 'A',
    'b': 'B',
}

# ── Mapping: sharp note → enharmonic flat name used in the app
SHARPS_TO_FLAT = {
    'cs': 'Db',   # C# = Db
    'ds': 'Eb',   # D# = Eb
    'es': 'F',    # E# = F  (enharmonic, treated as natural)
    'fs': 'Gb',   # F# = Gb
    'gs': 'Ab',   # G# = Ab
    'as': 'Bb',   # A# = Bb
    'bs': 'C',    # B# = C  (enharmonic, treated as natural)
}

def parse_filename(stem):
    """
    Parse a filename stem like '3-b', '4-cs', '5-fs'
    Returns (new_stem, octave) or None if pattern doesn't match.
    """
    # Expected format: <octave>-<note>[s]
    # octave = digit(s), note = letter, optional 's' for sharp
    parts = stem.split('-')
    if len(parts) != 2:
        return None

    octave_str, note_str = parts
    if not octave_str.isdigit():
        return None

    octave = octave_str
    note_str = note_str.lower()

    if note_str in SHARPS_TO_FLAT:
        note_name = SHARPS_TO_FLAT[note_str]
    elif note_str in NATURALS:
        note_name = NATURALS[note_str]
    else:
        return None

    return f"{note_name}{octave}"


def main():
    folder = os.path.dirname(os.path.abspath(__file__))
    files = sorted(os.listdir(folder))

    renames = []
    skipped = []

    for filename in files:
        stem, ext = os.path.splitext(filename)
        if ext.lower() not in ('.mp3', '.wav', '.ogg', '.m4a'):
            continue
        if filename == os.path.basename(__file__):
            continue

        new_stem = parse_filename(stem)
        if new_stem is None:
            skipped.append(filename)
            continue

        new_filename = new_stem + ext.lower()
        if filename != new_filename:
            renames.append((filename, new_filename))

    if not renames:
        print("No files to rename.")
        if skipped:
            print(f"\nSkipped (unrecognised pattern): {skipped}")
        return

    # Preview
    print(f"{'ORIGINAL':<20}  →  NEW NAME")
    print("-" * 40)
    for old, new in renames:
        print(f"{old:<20}  →  {new}")

    if skipped:
        print(f"\nSkipped (unrecognised pattern):")
        for s in skipped:
            print(f"  {s}")

    print(f"\n{len(renames)} file(s) will be renamed.")
    confirm = input("\nPress Enter to confirm, or type 'n' to cancel: ").strip().lower()
    if confirm == 'n':
        print("Cancelled.")
        return

    # Rename
    errors = []
    for old, new in renames:
        old_path = os.path.join(folder, old)
        new_path = os.path.join(folder, new)
        if os.path.exists(new_path):
            errors.append(f"SKIP (already exists): {new}")
            continue
        os.rename(old_path, new_path)
        print(f"Renamed: {old}  →  {new}")

    if errors:
        print("\nWarnings:")
        for e in errors:
            print(f"  {e}")

    print("\nDone.")


if __name__ == '__main__':
    main()