"""Checks the finished mp4: format, loudness, daytime look, and that subtitles are on time. Run with pnpm verify."""
import importlib.util
import json
import pathlib
import re
import statistics
import subprocess
import sys
from difflib import SequenceMatcher

import numpy as np

ROOT = pathlib.Path.cwd()
spec = importlib.util.spec_from_file_location("narrate", ROOT / "scripts/narrate.py")
narrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(narrate)

TIMELINE = json.loads((ROOT / "src/data/timeline.json").read_text("utf-8"))
VIDEO = ROOT / f"out/{TIMELINE['meta']['slug']}.mp4"
FPS = 30
TARGET_LUFS, LUFS_TOLERANCE, MAX_PEAK = -16.0, 1.0, -1.5
MIN_LUMINANCE = 0.8
MAX_SYNC_OFFSET = 0.25  # seconds, median of when a line is heard minus when its subtitle appears
MIN_MATCHED = 0.9  # share of the script heard back, by sound
FAILURES = []


def report(ok: bool, text: str) -> None:
    print(f"{'ok ' if ok else 'BAD'} {text}")
    if not ok:
        FAILURES.append(text)


def check_format() -> None:
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate", "-of", "json", str(VIDEO)],
        capture_output=True, text=True, check=True,
    ).stdout)
    video = next(s for s in probe["streams"] if s["codec_type"] == "video")
    audio = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    report((video["width"], video["height"]) == (1920, 1080), f"size {video['width']}x{video['height']}")
    report(video["r_frame_rate"] == f"{FPS}/1", f"frame rate {video['r_frame_rate']}, required {FPS}")
    report(audio["codec_name"] == "aac" and audio["sample_rate"] == "48000", f"audio {audio['codec_name']} {audio['sample_rate']} Hz")
    expected = TIMELINE["totalFrames"] / TIMELINE["fps"]
    seconds = float(probe["format"]["duration"])
    report(abs(seconds - expected) <= 0.1, f"duration {seconds:.2f}s, timeline {expected:.2f}s")


def check_loudness() -> None:
    err = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(VIDEO), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    tail = err[err.rindex("Summary:"):]
    lufs = float(re.search(r"I:\s*(-?[\d.]+) LUFS", tail).group(1))
    peak = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", tail).group(1))
    report(abs(lufs - TARGET_LUFS) <= LUFS_TOLERANCE, f"loudness {lufs} LUFS, target {TARGET_LUFS} +/- {LUFS_TOLERANCE}")
    report(peak <= MAX_PEAK, f"true peak {peak} dB, limit {MAX_PEAK}")


def luminance(rgb: np.ndarray) -> float:
    v = rgb / 255
    v = np.where(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2])


def check_daytime() -> None:
    if FAILURES and any(f.startswith("size ") for f in FAILURES):
        report(False, "background not checked: the frame size is wrong")
        return
    darkest = 1.0
    for seg in TIMELINE["segments"]:
        at = (seg["start"] + seg["dur"] // 2) / TIMELINE["fps"]
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{at:.2f}", "-i", str(VIDEO), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True,
        ).stdout
        frame = np.frombuffer(raw, dtype=np.uint8).reshape(1080, 1920, 3).astype(float)
        darkest = min(darkest, luminance(frame[6:18, 6:18].mean(axis=(0, 1))))
    report(darkest >= MIN_LUMINANCE, f"background luminance at least {darkest:.2f} across {len(TIMELINE['segments'])} segments, minimum {MIN_LUMINANCE}")


def check_sync() -> None:
    wav = ROOT / ".cache/qwen3/final.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(VIDEO), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    narrate.transcript_path(wav).unlink(missing_ok=True)  # final.wav keeps its name between builds.
    narrate.transcribe([wav])
    raw = {r["id"]: r for r in narrate.SCRIPT["segments"]}
    tokens, cue_at = [], []
    for seg in TIMELINE["segments"]:
        if not seg["audio"]:
            continue
        for line, cue in zip(raw[seg["id"]]["lines"], seg["cues"]):
            cue_at.append((len(tokens), (seg["start"] + cue["s"]) / TIMELINE["fps"]))
            tokens += [t[0] for t in narrate.sound_tokens(line["say"])]
    heard = []
    for w in narrate.hear(wav):
        toks = narrate.sound_tokens(w["w"])
        heard += [(snd, w["s"] + k * (w["e"] - w["s"]) / len(toks)) for k, (snd, _) in enumerate(toks)]
    matched = {}
    for a, b, size in SequenceMatcher(None, tokens, [h[0] for h in heard], autojunk=False).get_matching_blocks():
        for k in range(size):
            matched[a + k] = heard[b + k][1]
    share = len(matched) / len(tokens)
    report(share >= MIN_MATCHED, f"{share:.0%} of the script heard back in the video")
    offsets = [matched[i] - at for i, at in cue_at if i in matched]
    median = statistics.median(offsets)
    report(abs(median) <= MAX_SYNC_OFFSET, f"subtitles {median:+.2f}s from the voice (median of {len(offsets)}), limit {MAX_SYNC_OFFSET}")


def check_one_subtitle_layer() -> None:
    beside = sorted(p.name for p in VIDEO.parent.glob("*.srt"))
    report(not beside, f"no .srt beside the mp4, found {beside}: players load it on top of the burned-in subtitles")


def main() -> None:
    if not VIDEO.exists():
        raise SystemExit(f"No video at {VIDEO}: run pnpm render first.")
    check_format()
    check_loudness()
    check_daytime()
    check_one_subtitle_layer()
    check_sync()
    print(f"FAILED: {len(FAILURES)}" if FAILURES else "ALL PASSED")
    sys.exit(1 if FAILURES else 0)


if __name__ == "__main__":
    main()
