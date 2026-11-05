"""Adds a narration voice to this skill: <name>.wav in the format the narration reads, and <name>.txt with the words it says.

usage: ~/.venv/mlx-tts/bin/python -I add_voice.py <name> <recording> [the words it says]
Without the words, Whisper writes them down from the recording.
"""
import array
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import wave

HERE = pathlib.Path(__file__).resolve().parent
VOICES = HERE / "voices"
TRANSCRIBER = HERE / "template/scripts/transcribe_whisper.py"
WHISPER = pathlib.Path.home() / ".cache/mlx-tts/whisper-large-v3-turbo-asr-fp16"
PROMPT = "以下是普通话的句子。"
# Chosen, not limits of the model: with one synthetic voice, a 12 s take read correctly from 0.4 s to 88 s of reference, taking 9 s to generate at 8 s of reference, 15 s at 35 s and 31 s at 88 s.
MIN_SECONDS, MAX_SECONDS = 3, 30
QUIET_PEAK = 328  # -40 dB of full scale. Measured: Whisper writes a whole sentence for pure silence, so an empty transcript does not catch it.
NAME = re.compile(r"[A-Za-z0-9_-]+")


class Refused(Exception):
    """Something the person adding the voice has to change."""


def convert(recording: str, target: pathlib.Path) -> None:
    """Any format ffmpeg reads becomes the 24 kHz mono 16-bit WAV that the narration was verified with."""
    done = subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", recording, "-map", "0:a:0", "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(target)],
        capture_output=True, text=True,
    )
    if done.returncode != 0:
        raise Refused(f"Cannot read audio from {recording}: {done.stderr.strip()}")


def seconds(path: pathlib.Path) -> float:
    with wave.open(str(path)) as audio:
        return audio.getnframes() / audio.getframerate()


def peak(path: pathlib.Path) -> int:
    with wave.open(str(path)) as audio:
        return max(map(abs, array.array("h", audio.readframes(audio.getnframes()))), default=0)


def transcribe(audio: pathlib.Path) -> str:
    if not WHISPER.exists():
        raise Refused(f"Missing Whisper model: {WHISPER}. Run install.sh, or give the words the recording says.")
    with tempfile.TemporaryDirectory() as folder:
        jobs, words = pathlib.Path(folder) / "jobs.json", pathlib.Path(folder) / "words.json"
        jobs.write_text(json.dumps({"model": str(WHISPER), "prompt": PROMPT, "jobs": [{"clip": str(audio), "out": str(words)}]}, ensure_ascii=False), "utf-8")
        done = subprocess.run([sys.executable, "-I", str(TRANSCRIBER), str(jobs)], capture_output=True, text=True, env={**os.environ, "HF_HUB_OFFLINE": "1"})
        if done.returncode != 0:
            raise Refused(f"Whisper could not read the recording. Give the words it says instead. {done.stderr.strip()}")
        return "".join(word["w"] for word in json.loads(words.read_text("utf-8")))


def add(name: str, recording: str, given: str | None) -> str:
    """Both files appear only once everything has passed, so a refused recording leaves no half a voice."""
    if not NAME.fullmatch(name):
        raise Refused(f"Bad voice name {name!r}: use only letters, digits, - and _.")
    audio, words = VOICES / f"{name}.wav", VOICES / f"{name}.txt"
    if audio.exists() or words.exists():
        raise Refused(f"Voice {name} already exists and was left unchanged. Pick another name.")
    VOICES.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=VOICES) as folder:  # On the same disk, so the finished files can be moved into place.
        new_audio, new_words = pathlib.Path(folder) / "voice.wav", pathlib.Path(folder) / "voice.txt"
        convert(recording, new_audio)
        length = seconds(new_audio)
        if not MIN_SECONDS <= length <= MAX_SECONDS:
            raise Refused(f"The recording runs {length:.1f} s. Cut it to between {MIN_SECONDS} and {MAX_SECONDS} s.")
        if peak(new_audio) < QUIET_PEAK:
            raise Refused(f"{recording} has no sound in it.")
        said = (transcribe(new_audio) if given is None else given).strip()
        if not said:
            raise Refused("No words for this recording: nothing was heard. Give the words it says, or use a clearer recording.")
        new_words.write_text(said + "\n", "utf-8")
        new_words.rename(words)
        new_audio.rename(audio)
    return said


def main(args: list[str]) -> int:
    if len(args) not in (2, 3):
        print(__doc__, file=sys.stderr)
        return 2
    name, recording, *given = args
    try:
        said = add(name, recording, given[0] if given else None)
    except Refused as problem:
        print(problem, file=sys.stderr)
        return 1
    print(f"Added voice {name}: {said}")
    if not given:
        print(f"Whisper wrote these words, so they may be wrong. Compare them with the recording and correct {VOICES / name}.txt.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
