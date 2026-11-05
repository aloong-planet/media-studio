"""Generate Qwen3-TTS clips listed in a jobs file. Run with ~/.venv/mlx-tts/bin/python (see narrate.py)."""
import json
import sys
import time
from pathlib import Path

import mlx.core as mx
import numpy as np

from mlx_audio.audio_io import write as audio_write
from mlx_audio.tts.utils import load

spec = json.loads(Path(sys.argv[1]).read_text("utf-8"))
model = load(spec["model"])
sample_rate = int(model.sample_rate)

started = time.perf_counter()
for i, job in enumerate(spec["jobs"], 1):
    mx.random.seed(42)  # Has no effect at temperature 0. Above it, this keeps a re-run identical: generate() takes no seed of its own.
    parts = [
        np.array(r.audio, dtype=np.float32).reshape(-1)
        for r in model.generate(
            text=job["text"],
            ref_audio=spec["ref"],
            ref_text=spec["refText"],
            lang_code=spec["lang"],
            max_tokens=spec["maxTokens"],  # 12.5 codes per second: a cap for a runaway take, well above any take.
            temperature=spec["temperature"],
        )
    ]
    # generate() yields nothing when the model stops before any audio. Silence lets the check reject this take like any other.
    audio = np.concatenate(parts) if parts else np.zeros(sample_rate // 2, dtype=np.float32)
    out = Path(job["out"])
    tmp = out.with_name(out.stem + ".tmp.wav")  # A cut-off run must not leave a half-written clip in the cache.
    audio_write(str(tmp), mx.array(np.clip(audio, -1.0, 1.0)), sample_rate, format="wav")
    tmp.rename(out)
    mx.clear_cache()
    print(f"[{i}/{len(spec['jobs'])}] {time.perf_counter() - started:.0f}s {job['text'][:24]}", flush=True)
