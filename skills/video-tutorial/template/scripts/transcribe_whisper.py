"""Transcribe clips listed in a jobs file with an MLX Whisper model. Run with ~/.venv/mlx-tts/bin/python (see narrate.py)."""
import json
import sys
import time
from pathlib import Path

from mlx_audio.stt.utils import load

spec = json.loads(Path(sys.argv[1]).read_text("utf-8"))
model = load(spec["model"])

started = time.perf_counter()
for i, job in enumerate(spec["jobs"], 1):
    result = model.generate(job["clip"], language="zh", word_timestamps=True, initial_prompt=spec["prompt"])
    words = [{"w": w["word"], "s": float(w["start"]), "e": float(w["end"])} for s in result.segments for w in s["words"]]
    out = Path(job["out"])
    tmp = out.with_name(out.name + ".tmp")  # A cut-off run must not leave a half-written transcript in the cache.
    tmp.write_text(json.dumps(words, ensure_ascii=False), "utf-8")
    tmp.rename(out)
    print(f"[{i}/{len(spec['jobs'])}] {time.perf_counter() - started:.0f}s {result.text[:24]}", flush=True)
