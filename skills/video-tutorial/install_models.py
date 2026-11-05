"""Checks the two narration models against fixed versions and downloads what is missing. Run by install.sh."""
import contextlib
import hashlib
import os
import pathlib
import subprocess
import sys
import time

STALL_SECONDS = 600  # A download whose folder has not changed for this long counts as stuck.
POLL_SECONDS = 5

# Tried in this order. Hugging Face comes first: of the two, only it finished a whole download when both were measured.
# Xet is off for the mirror because with Xet on, the mirror's data still came from Hugging Face's own storage.
SOURCES = [
    {"endpoint": "https://huggingface.co", "env": {}},
    {"endpoint": "https://hf-mirror.com", "env": {"HF_HUB_DISABLE_XET": "1"}},
]

# Versions and files the narration was verified with, as name: (size, SHA-256). README and .gitattributes are left out: nothing loads them.
MODELS = [
    {
        "repo": "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit",
        "revision": "e7dd0585652209fa0d7783659aad4e8a324de11c",
        "files": {
            "config.json": (5522, "b14fba6bfd391968876248b843b095696b0188187a3d774a3bddc32544d15627"),
            "generation_config.json": (245, "f1b90b4513f3b34c62851049e2492d7b4c5940daf1276f89c82b8ef04127f3aa"),
            "merges.txt": (1671839, "599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3"),
            "model.safetensors": (2417320525, "b965c581ccf6aa852a4124feeb7a8a111542ee7b213139368b4cc7ba7fd4728b"),
            "model.safetensors.index.json": (78070, "9592a7c0ac3261a6211978416ef1796d3841225ac0ff0f9d6bfb5d1a6b49e5e9"),
            "preprocessor_config.json": (127, "efdde1022ea9d76928bf7a9cd53139138f5ba2e466e837f08f6105ab1af1c119"),
            "speech_tokenizer/config.json": (2336, "ee65bb901c876664ab8707c487157aa1a6ee57c65969b28fb5ec9dc211e68167"),
            "speech_tokenizer/configuration.json": (76, "6bc26d64eb5024b4d1dab5a52371958b429256d6c9d59787f1f5294a54e0cebd"),
            "speech_tokenizer/model.safetensors": (682293092, "836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258"),
            "speech_tokenizer/preprocessor_config.json": (234, "fcb3805e597e786d4067706e602f6688524640f8d3396790e2e09b5942fcbdfb"),
            "tokenizer_config.json": (7344, "dc3c31c3bdaedd5016382bb3cbe07323026775ad51f5a4fb564505992ae4a670"),
            "vocab.json": (2776833, "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910"),
        },
    },
    {
        "repo": "mlx-community/whisper-large-v3-turbo-asr-fp16",
        "revision": "624c19c9af5603fa73b83bce14d4aeea96156d18",
        "folder": ".cache/mlx-tts/whisper-large-v3-turbo-asr-fp16",
        "files": {
            "added_tokens.json": (34648, "3c51f66c4c21f9e126970078f11ae77a78c74aee8df606ee9daba86e467108e0"),
            "config.json": (1301, "47ef28115e4b7e08c604546cc98eb1ead8ff72152cfaeb5d7bcb7ef1640a5bdd"),
            "generation_config.json": (3772, "cce11bfe3aaa6ae9e072ea2637caaec8795e68d9b67e655a5af16ee509681a4c"),
            "merges.txt": (493869, "2df2990a395e35e8dfbc7511e08c12d56018d8d04691e0133e5d63b21e154dc6"),
            "model.safetensors": (1613977443, "a76ee3af9c01b616ab7caf1eed663dceb7d68e9dc62c990dac48112db6e57e34"),
            "model.safetensors.index.json": (37633, "9cf894da1061ccc1657c6dabf1fa19dfcf1f0603df4194ab4fb913a554da789d"),
            "normalizer.json": (52666, "bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd"),
            "preprocessor_config.json": (340, "7ccc62c6f2765af1f3b46c00c9b5894426835a05021c8b9c01eecb6dfb542711"),
            "special_tokens_map.json": (2186, "baea4ea09372eb4fca86b4e4346139fd73cb807d5087e9de0948e971739c3e74"),
            "tokenizer.json": (2710337, "297b13372ac43916285644fb9687add3cc62ee2a1adb60da3dc25cc94c1871fd"),
            "tokenizer_config.json": (282843, "844b642c73a91359722f47b35705f7174686df33d252695d8572cf9ac03a6389"),
            "vocab.json": (1036558, "e2aa043ef015641d363d8288e7c241c85e36a5c761fb303598e0710233344387"),
        },
    },
]


def hub() -> pathlib.Path:
    return pathlib.Path(os.environ.get("HF_HOME", pathlib.Path.home() / ".cache/huggingface")) / "hub"


def cache_entry(model: dict) -> pathlib.Path:
    return hub() / f"models--{model['repo'].replace('/', '--')}"


def model_folder(model: dict) -> pathlib.Path:
    if "folder" in model:
        return pathlib.Path.home() / model["folder"]
    return cache_entry(model) / "snapshots" / model["revision"]


def download_root(model: dict) -> pathlib.Path:
    """Where a download writes, unfinished files included."""
    return model_folder(model) if "folder" in model else cache_entry(model)


def problems(model: dict) -> list[str]:
    """What keeps this model from loading offline at the fixed version. Sizes only, so that a machine with complete models is done in seconds."""
    found = []
    for name, (size, _) in model["files"].items():
        path = model_folder(model) / name
        if not path.exists():
            found.append(f"{name} is missing")
        elif path.stat().st_size != size:
            found.append(f"{name} has the wrong size")
    if "folder" not in model:
        ref = cache_entry(model) / "refs/main"
        if not ref.exists() or ref.read_text().strip() != model["revision"]:
            found.append("refs/main does not point at the fixed version")
    return found


def sources() -> list[dict]:
    chosen = os.environ.get("HF_ENDPOINT")
    return [{"endpoint": chosen, "env": {}}] if chosen else SOURCES


def remove_leftovers(model: dict) -> None:
    """A killed download leaves partial files behind, and the hub names them per run, so no later run can use them."""
    for path in download_root(model).rglob("*.incomplete"):
        path.unlink()


def remove_wrong_files(model: dict) -> None:
    """Sizes would not show a changed file. Wrong ones go, because the hub keeps a cached file it finds instead of fetching it again."""
    wrong = []
    for name, (_, expected) in model["files"].items():
        path = model_folder(model) / name
        if not path.exists():
            continue
        with open(path, "rb") as file:
            if hashlib.file_digest(file, "sha256").hexdigest() != expected:
                wrong.append(name)
        if name in wrong:
            path.resolve().unlink()
            path.unlink(missing_ok=True)
    if wrong:
        raise OSError("wrong content, removed: " + ", ".join(wrong))


def bytes_in(folder: pathlib.Path) -> int:
    total = 0
    for parent, _, names in os.walk(folder):
        for name in names:
            with contextlib.suppress(FileNotFoundError):  # A finished file is renamed while this counts.
                total += os.lstat(os.path.join(parent, name)).st_size
    return total


def until_stalled(child: subprocess.Popen, folder: pathlib.Path) -> None:
    """Waits for the child and raises once the folder stops changing: snapshot_download waits for every file, so one wedged transfer never returns."""
    last, changed_at = bytes_in(folder), time.monotonic()
    while child.poll() is None:
        time.sleep(POLL_SECONDS)
        size = bytes_in(folder)
        if size != last:
            last, changed_at = size, time.monotonic()
        elif child.poll() is None and time.monotonic() - changed_at > STALL_SECONDS:
            raise OSError(f"no new data was written for {STALL_SECONDS / 60:g} minutes")


def fetch_command(model: dict, source: dict) -> list[str]:
    return [sys.executable, "-I", __file__, "--fetch", model["repo"], source["endpoint"]]


def download(model: dict, source: dict) -> None:
    """In a child process, because a wedged transfer ends only by being killed."""
    child = subprocess.Popen(fetch_command(model, source), env={**os.environ, **source["env"]})
    try:
        until_stalled(child, download_root(model))
    finally:
        child.kill()
        child.wait()
    if child.returncode != 0:
        raise OSError(f"the download stopped with exit code {child.returncode}")
    remove_wrong_files(model)


def fetch_in_this_process(repo: str, endpoint: str) -> int:
    """What the child process runs."""
    from huggingface_hub import snapshot_download
    from huggingface_hub.utils import disable_progress_bars

    if not sys.stderr.isatty():
        disable_progress_bars()
    model = next(candidate for candidate in MODELS if candidate["repo"] == repo)
    place = {"local_dir": model_folder(model)} if "folder" in model else {"cache_dir": hub()}
    try:
        # token=False: both models are public, and otherwise the hub sends a saved token to whatever address it is given.
        snapshot_download(repo, revision=model["revision"], allow_patterns=list(model["files"]), endpoint=endpoint, token=False, **place)
    except Exception as error:
        print(error, file=sys.stderr, flush=True)
        return 1
    return 0


def point_main_at_fixed_version(model: dict) -> None:
    """The narration loads by name while offline, which resolves refs/main, and a download by commit does not write it."""
    if "folder" in model:
        return
    ref = cache_entry(model) / "refs/main"
    ref.parent.mkdir(parents=True, exist_ok=True)
    ref.write_text(model["revision"])


def fetch_from_any_source(model: dict, fetch) -> bool:
    for source in sources():
        remove_leftovers(model)
        try:
            fetch(model, source)
            return True
        except Exception as error:
            print(f"Could not download {model['repo']} from {source['endpoint']}: {error}", file=sys.stderr, flush=True)
    return False


def main(fetch=download) -> int:
    for model in MODELS:
        if not problems(model):
            print(f"Model in place: {model['repo']}")
            continue
        size = sum(size for size, _ in model["files"].values()) / 1e9
        print(f"Downloading {model['repo']} ({size:.1f} GB in full).", flush=True)
        if not fetch_from_any_source(model, fetch):
            print(
                "Run install.sh again to continue: finished files are kept and an unfinished file starts over. "
                "To use another address, set HF_ENDPOINT first.",
                file=sys.stderr,
            )
            return 1
        point_main_at_fixed_version(model)
        left = problems(model)
        if left:
            print(f"{model['repo']} is still incomplete after downloading: " + "; ".join(left), file=sys.stderr)
            return 1
    return 0


def run() -> None:
    try:
        sys.exit(fetch_in_this_process(*sys.argv[2:]) if sys.argv[1:2] == ["--fetch"] else main())
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    run()
