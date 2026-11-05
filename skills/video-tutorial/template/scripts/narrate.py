"""Generate the narration with local Qwen3-TTS and derive the whole video timeline from the real audio.

Each segment's length = lead-in + measured audio length + a hold that grows with how much the step
asks the viewer to take in. Segments are voiced in takes: one model call per chapter, or per part of a
long chapter, with no randomness, so the voice stays steady from sentence to sentence. Whisper hears
every take and every segment cut from it, for three jobs:
- cutting: where each segment ends inside its take.
- timing: subtitle text always comes from the script; Whisper only says when each line is spoken.
- checking: differences in sound (not same-sound spelling) are listed with their timestamp in
  captions/voice-check.txt for a human to listen to. A take has no other version: to change how it
  reads, change its wording.
"""
import hashlib
import json
import math
import os
import pathlib
import re
import subprocess
import wave
from difflib import SequenceMatcher
from itertools import groupby

import numpy as np
from pypinyin import lazy_pinyin

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = json.loads((ROOT / "src/data/script.json").read_text("utf-8"))
VOICE = SCRIPT["voice"]
AUDIO = ROOT / "public/audio"
CACHE = ROOT / ".cache/qwen3"  # Clip names ignore the mlx-audio version: clear this folder after upgrading it, or old and new takes mix.
MLX_PYTHON = pathlib.Path.home() / ".venv/mlx-tts/bin/python"
ASR_MODEL = pathlib.Path.home() / ".cache/mlx-tts/whisper-large-v3-turbo-asr-fp16"
# No script hints: the transcript is also the pronunciation check, so it must not be told what to expect.
ASR_PROMPT = "以下是普通话的句子。"
FPS = SCRIPT["fps"]
# The owner's limit. Measured on this model and voice: four takes of 58-66 s all ended with the voice still at speech level.
MAX_TAKE_SECONDS = 40.0
CUT_SEARCH = 0.25  # how far outside Whisper's word times to look for the quiet point between two segments
MIN_CUT_DEPTH = 15.0  # dB below speech a cut must be; real pauses between sentences measured 24 or deeper
# Read after each take's text and cut off. Measured without it: 5 of 10 takes ended with the voice still at speech level, while sentences inside a take fell silent first.
TAKE_TAIL = "我们继续。"
LEAD = {"title": 0.4, "card": 0.2, "tour": 0.12, "step": 0.12, "outro": 0.3}
SCRIPT_ONLY = ("lines", "take", "hold", "tail")  # read here; every other field passes through to the timeline
MAX_CUE_WIDTH = 36  # CJK widths that fit one subtitle line
KEEP_LEAD, KEEP_TAIL = 0.03, 0.05  # silence kept before the first and after the last word
PAUSE_BASE, PAUSE_SCALE = 0.1, 0.3  # inner pause becomes base + scale × original: commas stay shorter than full stops
CARD_FADE_OUT = 0.42  # title and event cards fade out over 12 frames, after the voice has finished
SNAP_TO_PAUSE = 0.4  # how far a subtitle may move from Whisper's estimate to land on a real pause
DIGITS = "零一二三四五六七八九"
ENGLISH_DIGITS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")


class NothingHeard(RuntimeError):
    """A take with no recognisable speech in it."""


def norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s, flags=re.UNICODE).lower()


def width(s: str) -> float:
    return sum(1 if ord(c) > 0x2E7F else 0.55 for c in s)


def is_hanzi(c: str) -> bool:
    return "一" <= c <= "鿿"


def spoken_number(n: str) -> str:
    v = int(n)
    if v < 10:
        return DIGITS[v]
    if v < 100:
        tens = "" if v < 20 else DIGITS[v // 10]
        return f"{tens}十{DIGITS[v % 10] if v % 10 else ''}"
    if v < 1000 and v % 100 == 0:
        return f"{DIGITS[v // 100]}百"
    return "".join(DIGITS[int(d)] for d in n)


def sound_tokens(text: str) -> list[tuple[str, str]]:
    """(sound, source text) per spoken unit. Toneless, so same-sound spelling differences compare equal."""
    out = []
    for m in re.finditer(r"[一-鿿]|[A-Za-z]|\d+", text):
        c = m.group()
        if c.isdigit():
            out.extend((lazy_pinyin(ch)[0], c if k == 0 else "") for k, ch in enumerate(spoken_number(c)))
        elif is_hanzi(c):
            out.append((lazy_pinyin(c)[0], c))
        else:
            out.append((c.lower(), c))
    return out


def mismatch_weight(said: str, heard: str, full: int) -> int:
    """Whisper can write an English-sounding word as a digit ("three" as 3), so also score the digit by its English name."""
    if not (said.isascii() and said.isalpha() and len(heard) == 1 and heard.isdigit()):
        return full
    ops = SequenceMatcher(None, said.lower(), ENGLISH_DIGITS[int(heard)], autojunk=False).get_opcodes()
    return min(full, sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in ops if tag != "equal"))


def compare(text: str, words: list[dict]) -> tuple[list[tuple[float, float]], list[dict]]:
    """Time of every token in the script, and where what was heard differs in sound."""
    script = sound_tokens(text)
    heard = []
    for w in words:
        toks = sound_tokens(w["w"])
        for k, (snd, src) in enumerate(toks):
            span = (w["e"] - w["s"]) / len(toks)
            heard.append((snd, src, w["s"] + k * span, w["s"] + (k + 1) * span))
    times: list = [None] * len(script)
    diffs = []
    matcher = SequenceMatcher(None, [t[0] for t in script], [h[0] for h in heard], autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k][2], heard[j1 + k][3])
        else:
            said, got = "".join(t[1] for t in script[i1:i2]), "".join(h[1] for h in heard[j1:j2])
            diffs.append({
                "index": i1,
                "weight": mismatch_weight(said, got, max(i2 - i1, j2 - j1)),
                "said": said,
                "heard": got,
            })
    if not any(times):
        raise NothingHeard(f"nothing recognisable was heard for: {text}")
    i = 0
    while i < len(times):  # Unmatched tokens get evenly spaced times between their matched neighbours.
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        n = j - i
        left = times[i - 1][1] if i > 0 else max(0.0, times[j][0] - n * 0.2)
        right = times[j][0] if j < len(times) else left + n * 0.2
        step = max(right - left, 0.0) / n
        for k in range(n):
            times[i + k] = (left + k * step, left + (k + 1) * step)
        i = j
    return times, diffs


def script_problems(segments: list[dict]) -> list[str]:
    """Fields a segment cannot do without, found before any audio is generated."""
    problems = []
    for i, seg in enumerate(segments):
        name = seg.get("id", f"segment {i + 1}")
        missing = [k for k in ("id", "chapter", "kind") if k not in seg]
        if "lines" in seg and "take" not in seg:
            missing.append("take")
        if "lines" not in seg and "hold" not in seg:
            missing.append("lines or hold")
        problems += [f"{name}: missing {k}" for k in missing]
    return problems


def plan_takes(segments: list[dict]) -> list[tuple[str, list[tuple[str, str]]]]:
    """Narrated segments grouped into takes, in film order: (take, [(segment id, its text)])."""
    voiced = [s for s in segments if "lines" in s]
    return [
        (take, [(s["id"], "".join(l["say"] for l in s["lines"])) for s in group])
        for take, group in groupby(voiced, key=lambda s: s["take"])
    ]


def take_text(parts: list[tuple[str, str]]) -> str:
    return "".join(text for _, text in parts) + TAKE_TAIL


def clip_path(text: str) -> pathlib.Path:
    ref = hashlib.sha1((ROOT / VOICE["ref"]).read_bytes()).hexdigest()
    key = f"{VOICE['model']}|{ref}|{VOICE['refText']}|{VOICE['lang']}|{VOICE['maxTokens']}|{VOICE['temperature']}|{text}"
    return CACHE / f"{hashlib.sha1(key.encode()).hexdigest()[:14]}.wav"


def synthesize(jobs: list[dict]) -> None:
    if not jobs:
        return
    path = CACHE / "jobs.json"
    path.write_text(json.dumps({**VOICE, "ref": str(ROOT / VOICE["ref"]), "jobs": jobs}, ensure_ascii=False), "utf-8")
    subprocess.run(
        [str(MLX_PYTHON), "-I", str(ROOT / "scripts/synth_qwen3.py"), str(path)],
        check=True, env={**os.environ, "HF_HUB_OFFLINE": "1"},
    )


def transcript_path(clip: pathlib.Path) -> pathlib.Path:
    return clip.with_name(f"{clip.stem}.{ASR_MODEL.name}.json")


def transcribe(clips: list[pathlib.Path]) -> None:
    jobs = [{"clip": str(c), "out": str(transcript_path(c))} for c in clips if not transcript_path(c).exists()]
    if not jobs:
        return
    path = CACHE / "asr-jobs.json"
    path.write_text(json.dumps({"model": str(ASR_MODEL), "prompt": ASR_PROMPT, "jobs": jobs}, ensure_ascii=False), "utf-8")
    subprocess.run(
        [str(MLX_PYTHON), "-I", str(ROOT / "scripts/transcribe_whisper.py"), str(path)],
        check=True, env={**os.environ, "HF_HUB_OFFLINE": "1"},
    )


def hear(clip: pathlib.Path) -> list[dict]:
    return json.loads(transcript_path(clip).read_text("utf-8"))


def read_samples(path: pathlib.Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16), w.getframerate()


def frame_levels(samples: np.ndarray, rate: int) -> tuple[np.ndarray, int, int]:
    """Level in dB of each 20 ms frame, one frame every 5 ms, with the frame and hop sizes in samples."""
    win, hop = int(0.02 * rate), int(0.005 * rate)
    power = np.concatenate(([0.0], np.cumsum((samples / 32768.0) ** 2)))
    starts = np.arange(0, len(samples) - win, hop)
    return 10 * np.log10((power[starts + win] - power[starts]) / win + 1e-18), win, hop


def split_take(take: str, clip: pathlib.Path, parts: list[tuple[str, str]]) -> dict[str, pathlib.Path]:
    """Cut a take into one file per segment, at the quietest moment between segments. The throwaway last sentence goes in no file."""
    texts = [text for _, text in parts] + [TAKE_TAIL]
    times, _ = compare("".join(texts), hear(clip))
    spans, pos = [], 0
    for text in texts:
        n = len(sound_tokens(text))
        spans.append((times[pos][0], times[pos + n - 1][1]))
        pos += n
    samples, rate = read_samples(clip)
    levels, win, hop = frame_levels(samples, rate)
    speech = np.percentile(levels[levels > -60], 75)
    cuts = [0]
    for (seg_id, _), (_, end), (start, _) in zip(parts, spans, spans[1:]):
        # Whisper's times can run past the end of the audio, as when it invents words after the voice stops.
        hi = min(int((start + CUT_SEARCH) * rate / hop), len(levels))
        lo = min(int((end - CUT_SEARCH) * rate / hop), hi - 1)
        k = lo + int(np.argmin(levels[lo:hi]))
        cut = k * hop + win // 2
        if speech - levels[k] < MIN_CUT_DEPTH or cut <= cuts[-1]:
            raise RuntimeError(f"take {take}: no quiet point after {seg_id}; change its wording")
        cuts.append(cut)
    out = {}
    for (seg_id, _), a, b in zip(parts, cuts, cuts[1:]):
        path = CACHE / f"{clip.stem}-{seg_id}-{a}-{b}.wav"  # Named by the samples it holds, so a moved cut never reuses an old transcript.
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(samples[a:b].tobytes())
        out[seg_id] = path
    return out


def voice_segments(segments: list[dict]) -> dict[str, dict]:
    """Each narrated segment's audio file, token times and sound differences."""
    plan = plan_takes(segments)
    clips = {take: clip_path(take_text(parts)) for take, parts in plan}
    synthesize([{"text": take_text(parts), "out": str(clips[take])} for take, parts in plan if not clips[take].exists()])
    for take, clip in clips.items():
        if duration(clip) > MAX_TAKE_SECONDS:
            raise RuntimeError(f"take {take} runs {duration(clip):.1f}s, over {MAX_TAKE_SECONDS:.0f}s: split it in script.json")
    transcribe(list(clips.values()))
    files = {seg_id: path for take, parts in plan for seg_id, path in split_take(take, clips[take], parts).items()}
    transcribe(list(files.values()))
    voiced = {}
    for _, parts in plan:
        for seg_id, text in parts:
            times, diffs = compare(text, hear(files[seg_id]))
            voiced[seg_id] = {"clip": files[seg_id], "times": times, "diffs": diffs}
    return voiced


def duration(path: pathlib.Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


def silences(path: pathlib.Path) -> list[tuple[float, float]]:
    err = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "silencedetect=noise=-45dB:d=0.1", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends))


def tighten(src: pathlib.Path, dst: pathlib.Path):
    """Shorten the voice's silences, leaving speech untouched. Returns the time mapping and where pauses end."""
    total = duration(src)
    cuts = []
    found = silences(src)
    for s, e in found:
        gap = e - s
        if s < 0.02:
            cuts.append((s, e - min(gap, KEEP_LEAD)))
        elif e > total - 0.02:
            cuts.append((s + min(gap, KEEP_TAIL), e))
        else:
            keep = min(gap, PAUSE_BASE + PAUSE_SCALE * gap)
            cuts.append((s + keep / 2, e - keep / 2))
    cuts = [(a, b) for a, b in cuts if b - a > 0.01]

    keeps, pos = [], 0.0
    for a, b in cuts:
        keeps.append((pos, a))
        pos = b
    if total - pos > 0.001:
        keeps.append((pos, total))
    parts = "".join(f"[0]atrim={a:.4f}:{b:.4f},asetpts=N/SR/TB[s{i}];" for i, (a, b) in enumerate(keeps))
    inputs = "".join(f"[s{i}]" for i in range(len(keeps)))
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", f"{parts}{inputs}concat=n={len(keeps)}:v=0:a=1[o]",
         "-map", "[o]", "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(dst)],
        check=True,
    )

    def remap(t: float) -> float:
        removed = 0.0
        for a, b in cuts:
            if t >= b:
                removed += b - a
            elif t > a:
                return a - removed
        return t - removed

    return remap, [remap(e) for s, e in found if s >= 0.02 and e <= total - 0.02]


def line_cues(seg_id: str, lines: list[dict], starts: list[float], pauses: list[float]) -> list[dict]:
    """Subtitle text comes from the script; only the line's start time comes from the audio.

    Whisper's word times can be a few tenths off, so a line starts where the audio actually resumes:
    the first line with the voice, later lines at the end of the pause nearest Whisper's estimate.
    """
    cues, a = [], 0
    for line in lines:
        text = re.sub(r"[，。；：、]+$", "", line.get("show", line["say"]))
        if width(text) > MAX_CUE_WIDTH:
            print(f"  ! {seg_id}: subtitle may overflow ({width(text):.0f}): {text}")
        at = starts[a]
        near = min(pauses, key=lambda p: abs(p - at), default=at)
        at = near if abs(near - at) <= SNAP_TO_PAUSE else at
        cues.append({"text": text, "s": at if cues else 0.0, "e": 0.0})
        a += len(sound_tokens(line["say"]))
    if a != len(starts):
        raise RuntimeError(f"{seg_id}: line tokens {a} != segment tokens {len(starts)}")
    for cur, nxt in zip(cues, cues[1:]):
        if nxt["s"] <= cur["s"]:
            raise RuntimeError(f"{seg_id}: subtitle order broken at {nxt['text']}")
    for cur, nxt in zip(cues, cues[1:]):
        cur["e"] = nxt["s"]
    return cues


def clock(sec: float) -> str:
    return f"{int(sec // 60)}:{int(sec % 60):02}"


def srt_time(sec: float) -> str:
    ms = round(sec * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def preflight() -> None:
    """Name what is missing before a run spends minutes on it, and never fall back to another voice or model."""
    needs = {
        "reference voice": ROOT / VOICE["ref"],
        "Python environment": MLX_PYTHON,
        "Whisper model": ASR_MODEL,
        "TTS model": pathlib.Path(os.environ.get("HF_HOME", pathlib.Path.home() / ".cache/huggingface")) / "hub" / f"models--{VOICE['model'].replace('/', '--')}",
    }
    missing = [f"{name}: {path}" for name, path in needs.items() if not path.exists()]
    if missing:
        raise SystemExit("Missing (run install.sh in the video-tutorial skill folder; for the reference voice, ask the owner):\n  " + "\n  ".join(missing))
    problems = script_problems(SCRIPT["segments"])
    if problems:
        raise SystemExit("script.json:\n  " + "\n  ".join(problems))


def main() -> None:
    preflight()
    AUDIO.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    voiced = voice_segments(SCRIPT["segments"])
    for old in AUDIO.iterdir():
        old.unlink()

    segs, seen, start = [], set(), 0
    srt, check = [], []
    print(f"{'segment':<13}{'new':>4}{'sent':>5}{'chars':>6}{'score':>7}{'voice':>7}{'hold':>6}{'total':>7}")
    for i, raw in enumerate(SCRIPT["segments"]):
        following = SCRIPT["segments"][i + 1]["kind"] if i + 1 < len(SCRIPT["segments"]) else None
        seg = {k: v for k, v in raw.items() if k not in SCRIPT_ONLY}
        seg["n"], seg["e"], seg["flows"] = raw.get("n", []), raw.get("e", []), raw.get("flows", [])
        if raw["kind"] == "card" or raw.get("reset"):
            seen = set()
        fresh = [x for x in seg["n"] + seg["e"] if x not in seen]
        seen.update(fresh)

        if "lines" in raw:
            text = "".join(l["say"] for l in raw["lines"])
            spoken = voiced[raw["id"]]
            wav = AUDIO / f"{raw['id']}.wav"
            remap, pauses = tighten(spoken["clip"], wav)
            starts = [remap(a) for a, _ in spoken["times"]]
            dur = duration(wav)
            cues = line_cues(raw["id"], raw["lines"], starts, pauses)
            sentences = max(1, len(re.findall(r"[。？！；]", text)))
            chars = len(norm(text))
            # Complexity: what newly appears on the map, plus how much is being explained.
            score = len(fresh) + 2 * (sentences - 1) + chars / 20
            # The route summary that follows the last step already gives the viewer time to look.
            hold = 0.15 if following == "wrap" else min(1.0, max(0.2, 0.15 + 0.06 * score))
            if raw["kind"] in ("card", "title"):
                hold = max(hold, CARD_FADE_OUT)
            cues[-1]["e"] = dur + hold  # Keep the last line up during the hold instead of blinking off.
            hold += raw.get("tail", 0)
            lead = LEAD[raw["kind"]]
            total = lead + dur + hold
            seg["audio"] = f"audio/{raw['id']}.wav"
            seg["audioAt"] = round(lead * FPS)
            seg["cues"] = [
                {"text": c["text"], "s": seg["audioAt"] + round(c["s"] * FPS), "e": seg["audioAt"] + round(c["e"] * FPS)}
                for c in cues
            ]
            for c in cues:
                srt.append((start / FPS + lead + c["s"], start / FPS + lead + c["e"], c["text"]))
            for d in spoken["diffs"]:
                at = start / FPS + lead + starts[min(d["index"], len(starts) - 1)]
                check.append(f"{clock(at):>5}  {raw['id']:<12} 稿子：{d['said'] or '（无）'}  听到：{d['heard'] or '（无）'}")
        else:
            dur, hold, score, sentences, chars = 0.0, raw["hold"], 0.0, 0, 0
            total, seg["audio"], seg["audioAt"], seg["cues"] = hold, None, 0, []

        seg["start"] = start
        seg["dur"] = math.ceil(total * FPS)
        seg["score"] = round(score, 1)
        start += seg["dur"]
        segs.append(seg)
        print(f"{raw['id']:<13}{len(fresh):>4}{sentences:>5}{chars:>6}{score:>7.1f}{dur:>7.1f}{hold:>6.1f}{seg['dur']/FPS:>7.1f}")

    # Step numbering inside each chapter, for the header and the map's badges.
    for chapter in {s["chapter"] for s in segs}:
        steps = [s for s in segs if s["chapter"] == chapter and s["kind"] == "step"]
        for i, s in enumerate(steps):
            s["stepNo"], s["stepTotal"] = i + 1, len(steps)

    # Screens read the timeline, not the script, so the script it was built from is recorded for pnpm stills and pnpm render to compare.
    script_hash = hashlib.sha256((ROOT / "src/data/script.json").read_bytes()).hexdigest()
    timeline = {"script": script_hash, "fps": FPS, "totalFrames": start, "meta": SCRIPT["meta"], "chapters": SCRIPT["chapters"], "segments": segs}
    (ROOT / "src/data/timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), "utf-8")
    body = "\n".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{t}\n" for i, (a, b, t) in enumerate(srt, 1))
    # Not beside the mp4: players such as VLC auto-load a same-named .srt on top of the burned-in subtitles.
    (ROOT / "captions").mkdir(exist_ok=True)
    (ROOT / f"captions/{SCRIPT['meta']['slug']}.zh.srt").write_text(body, "utf-8")
    (ROOT / "captions/voice-check.txt").write_text("\n".join(check) + "\n", "utf-8")
    voice = sum(duration(AUDIO / f"{s['id']}.wav") for s in segs if s["audio"])
    print(f"voice {voice:.1f}s; total {start/FPS:.1f}s, {start} frames, {len(srt)} cues")
    print(f"--- {len(check)} sound differences left to listen to")
    print("\n".join(check))


if __name__ == "__main__":
    main()
