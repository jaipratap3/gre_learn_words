#!/usr/bin/env python3
"""
generate_audio.py - Generates audio study tracks for GRE flashcard words.
Format per word:
  [Word] -> 10-second silence gap (for recall) -> [Meaning + Mnemonic] -> 2-second pause.

Usage examples:
  python3 generate_audio.py --part 1 --limit 3          # Fast test (3 words)
  python3 generate_audio.py --part 1                    # Full Part 1
  python3 generate_audio.py --part all                  # All parts
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

def clean_text_for_speech(text):
    if not text:
        return ""
    # Remove markdown links [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove markdown formatting characters
    text = re.sub(r'[*_#~`]', '', text)
    # Remove excess whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def resolve_voice(requested_voice):
    if not requested_voice:
        return None
    try:
        res = subprocess.run(["say", "-v", "?"], capture_output=True, text=True)
        available = res.stdout
        for line in available.splitlines():
            name = line.split()[0] if line.split() else ""
            if requested_voice.lower() == name.lower():
                return name
        # If requested was Jasper or an en-IN voice, try Rishi or Aman on macOS
        if "jasper" in requested_voice.lower() or "in" in requested_voice.lower():
            for backup in ["Rishi", "Aman", "Samantha"]:
                if backup in available:
                    print(f"   ℹ️ Voice '{requested_voice}' not found in macOS say, using '{backup}' (en-IN).")
                    return backup
    except Exception:
        pass
    return requested_voice

def build_script_for_words(words_list, mnemonics_map, delay_ms=10000, pause_ms=2000):
    """
    Builds macOS `say` script string with embedded [[slnc <ms>]] silence tags.
    Speaks: Word -> 10s recall pause -> Mnemonic -> Easy English Explanation -> 2s pause.
    """
    parts = []
    for idx, w in enumerate(words_list):
        word_text = w.get("word", "").strip()
        mnemonic = clean_text_for_speech(mnemonics_map.get(word_text.upper(), ""))
        
        # Easy English explanation: from easy_english or concise sentence from description
        easy_english = clean_text_for_speech(w.get("easy_english", ""))
        if easy_english.lower().startswith("simple synonyms:"):
            easy_english = easy_english[16:].strip()
            
        if not easy_english and w.get("description"):
            easy_english = clean_text_for_speech(w.get("description", "").split(".")[0].strip())

        # Part announcement at start
        if idx == 0:
            part_label = f"Part {w.get('part', '')}" if str(w.get('part', '')).isdigit() else str(w.get('part', ''))
            parts.append(f"GRE Flashcards, {part_label}. Let's begin. [[slnc 1500]]")

        word_num_str = f"Word {idx + 1}. "
        # 1. Speak word
        speech_chunk = f"{word_num_str}{word_text}. [[slnc {delay_ms}]] "

        # 2. Speak mnemonic
        if mnemonic:
            speech_chunk += f"Mnemonic: {mnemonic}. "

        # 3. Speak easy English explanation
        if easy_english:
            speech_chunk += f"Easy explanation: {easy_english}. "
        elif w.get("description"):
            speech_chunk += f"Meaning: {clean_text_for_speech(w.get('description'))}. "

        # 4. Short pause before next word
        speech_chunk += f"[[slnc {pause_ms}]] "
        parts.append(speech_chunk)

    return "\n".join(parts)

def generate_part_audio(part_name, words, mnemonics, output_dir, delay_sec=10, pause_sec=2, voice=None, limit=None):
    os.makedirs(output_dir, exist_ok=True)
    part_words = [w for w in words if str(w.get("part", "")).upper() == str(part_name).upper()]
    if limit and limit > 0:
        part_words = part_words[:limit]

    if not part_words:
        print(f"No words found for part: {part_name}")
        return None

    out_filename = f"part_{str(part_name).lower()}.m4a"
    out_path = os.path.join(output_dir, out_filename)

    print(f"\n🎧 Generating audio for Part {part_name} ({len(part_words)} words)...")
    print(f"   ⏱ Recall delay: {delay_sec}s | Pause between words: {pause_sec}s")

    delay_ms = int(delay_sec * 1000)
    pause_ms = int(pause_sec * 1000)
    full_text = build_script_for_words(part_words, mnemonics, delay_ms, pause_ms)

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as txt_file:
        txt_path = txt_file.name
        txt_file.write(full_text)

    aiff_path = txt_path.replace(".txt", ".aiff")

    try:
        # Step 1: Synthesize with macOS say
        cmd_say = ["say", "-f", txt_path, "-o", aiff_path]
        chosen_voice = resolve_voice(voice)
        if chosen_voice:
            cmd_say.extend(["-v", chosen_voice])

        print(f"   🎙 Synthesizing speech with macOS say (voice: {chosen_voice or 'default'})...")
        subprocess.run(cmd_say, check=True)

        # Step 2: Convert to compressed AAC .m4a using afconvert
        print(f"   📦 Compressing to AAC M4A: {out_filename}...")
        cmd_convert = ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", aiff_path, out_path]
        subprocess.run(cmd_convert, check=True)

        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        print(f"   ✅ Saved: {out_path} ({size_mb:.2f} MB)")
        return out_path
    finally:
        if os.path.exists(txt_path):
            os.remove(txt_path)
        if os.path.exists(aiff_path):
            os.remove(aiff_path)

def main():
    parser = argparse.ArgumentParser(description="Generate GRE audio study tracks with 10s recall pause.")
    parser.add_argument("--part", default="1", help="Part number (1-7, EXTRA, or 'all')")
    parser.add_argument("--delay", type=int, default=10, help="Recall delay in seconds (default: 10)")
    parser.add_argument("--pause", type=int, default=2, help="Pause between words in seconds (default: 2)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of words for testing")
    parser.add_argument("--voice", default="Jasper", help="Voice name (default: Jasper (en-IN), or Rishi, Aman, Samantha)")
    parser.add_argument("--output-dir", default="audio", help="Output directory for audio files")
    args = parser.parse_args()

    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    words_path = os.path.join(base_dir, "words.json")
    mnemonics_path = os.path.join(base_dir, "mnemonics.json")

    with open(words_path, "r", encoding="utf-8") as f:
        words = json.load(f)

    with open(mnemonics_path, "r", encoding="utf-8") as f:
        mnemonics = json.load(f)

    if args.part.lower() == "all":
        parts_to_run = sorted(list(set(str(w.get("part", "")) for w in words)), key=lambda x: (not x.isdigit(), int(x) if x.isdigit() else x))
    else:
        parts_to_run = [args.part]

    for p in parts_to_run:
        generate_part_audio(
            part_name=p,
            words=words,
            mnemonics=mnemonics,
            output_dir=os.path.join(base_dir, args.output_dir),
            delay_sec=args.delay,
            pause_sec=args.pause,
            voice=args.voice,
            limit=args.limit
        )

    print("\n🎉 Done! All audio generation complete.")

if __name__ == "__main__":
    main()
