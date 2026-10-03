#!/usr/bin/env python3
"""
Transcribe every audio/video file in a folder.

Usage:
    python transcribe_folder.py /path/to/folder [--model small] [--language en] [--recursive]

Setup (one time):
    pip install faster-whisper
    # ffmpeg must be installed and on PATH:
    #   Windows: winget install Gyan.FFmpeg
    #   macOS:   brew install ffmpeg
    #   Linux:   sudo apt install ffmpeg

Outputs, next to each source file:
    <name>.txt  - plain transcript
    <name>.srt  - subtitle/caption file
Files that already have a .txt are skipped, so it's safe to re-run.
"""

import argparse
import sys
import time
from pathlib import Path

print("Starting transcribe_folder.py")
print("Importing faster-whisper (first run may take a moment)...")
try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.exit("faster-whisper not installed. Run:  pip install faster-whisper")
print("faster-whisper imported OK")

MEDIA_EXTS = {
    ".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".wma",
    ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v",
}


def fmt_ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1_000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def transcribe(model: WhisperModel, path: Path, language: str | None) -> None:
    txt_path = path.with_suffix(".txt")
    srt_path = path.with_suffix(".srt")
    print(f"  source: {path} ({path.stat().st_size / 1e6:.1f} MB)")

    print("  running model.transcribe()...")
    t0 = time.perf_counter()
    segments, info = model.transcribe(
        str(path),
        language=language,
        vad_filter=True,   # skips long silences
        beam_size=5,
    )
    print(f"  language: {info.language} ({info.language_probability:.0%})")
    print(f"  audio duration: {info.duration:.1f}s; transcribing...")

    lines, srt = [], []
    for i, seg in enumerate(segments, start=1):
        text = seg.text.strip()
        lines.append(text)
        srt.append(f"{i}\n{fmt_ts(seg.start)} --> {fmt_ts(seg.end)}\n{text}\n")
        print(f"  [{fmt_ts(seg.start)}] {text[:70]}", end="\r")

    elapsed = time.perf_counter() - t0
    print(f"\n  transcribed {len(lines)} segment(s) in {elapsed:.1f}s")
    txt_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  wrote {txt_path.name} ({len(lines)} lines)")
    srt_path.write_text("\n".join(srt), encoding="utf-8")
    print(f"  wrote {srt_path.name}")
    print(f"  -> done: {txt_path.name}, {srt_path.name}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Batch-transcribe a folder of media files.")
    ap.add_argument("folder", type=Path)
    ap.add_argument("--model", default="small",
                    help="tiny | base | small | medium | large-v3 (bigger = slower, more accurate)")
    ap.add_argument("--language", default=None,
                    help="ISO code like 'en'. Omit to auto-detect per file.")
    ap.add_argument("--recursive", action="store_true", help="Include subfolders")
    ap.add_argument("--force", action="store_true", help="Re-transcribe even if a .txt exists")
    ap.add_argument("--device", default="auto", help="auto | cpu | cuda")
    args = ap.parse_args()
    print("Configuration:")
    print(f"  folder:    {args.folder}")
    print(f"  model:     {args.model}")
    print(f"  language:  {args.language or 'auto-detect'}")
    print(f"  recursive: {args.recursive}")
    print(f"  force:     {args.force}")
    print(f"  device:    {args.device}")

    if not args.folder.is_dir():
        sys.exit(f"Not a folder: {args.folder}")

    print(f"Scanning {'recursively' if args.recursive else 'top-level'}: {args.folder}")
    files = sorted(
        p for p in (args.folder.rglob("*") if args.recursive else args.folder.iterdir())
        if p.is_file() and p.suffix.lower() in MEDIA_EXTS
    )
    if not files:
        sys.exit("No audio/video files found.")

    todo = [f for f in files if args.force or not f.with_suffix(".txt").exists()]
    skipped = len(files) - len(todo)
    print(f"Found {len(files)} media file(s); {len(todo)} to transcribe, {skipped} already done.")
    if not todo:
        print("Nothing to do; exiting.")
        return

    print(f"Loading Whisper model '{args.model}' on device '{args.device}'...")
    compute = "int8" if args.device in ("auto", "cpu") else "float16"
    print(f"Using compute_type='{compute}'")
    t_load = time.perf_counter()
    model = WhisperModel(args.model, device=args.device, compute_type=compute)
    print(f"Model loaded in {time.perf_counter() - t_load:.1f}s")

    failures = []
    t_start = time.perf_counter()
    for n, f in enumerate(todo, start=1):
        print(f"\n[{n}/{len(todo)}] {f.name}")
        try:
            transcribe(model, f, args.language)
        except Exception as e:  # keep going on a bad file
            print(f"  FAILED: {e}")
            failures.append(f)

    total = time.perf_counter() - t_start
    print(f"\nDone in {total:.1f}s. {len(todo) - len(failures)} succeeded, {len(failures)} failed.")
    if failures:
        print("Failed files:")
    for f in failures:
        print(f"  - {f}")


if __name__ == "__main__":
    main()