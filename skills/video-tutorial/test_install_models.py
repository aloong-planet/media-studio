"""Run from this folder: python3 -B -m unittest test_install_models. Not covered here: the real download. Check it by running install.sh on an empty home."""
import contextlib
import hashlib
import io
import json
import os
import pathlib
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

import install_models
from install_models import main

QWEN3_REPO = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit"
WHISPER_REPO = "mlx-community/whisper-large-v3-turbo-asr-fp16"
QWEN3_ENTRY = ".cache/huggingface/hub/models--mlx-community--Qwen3-TTS-12Hz-1.7B-Base-8bit"
QWEN3_REVISION = "e7dd0585652209fa0d7783659aad4e8a324de11c"
QWEN3_FOLDER = f"{QWEN3_ENTRY}/snapshots/{QWEN3_REVISION}"
WHISPER_FOLDER = ".cache/mlx-tts/whisper-large-v3-turbo-asr-fp16"
OFFICIAL = "https://huggingface.co"
MIRROR = "https://hf-mirror.com"


def place(home: pathlib.Path, model: dict, folder: str) -> None:
    """Files with the real names and sizes; sparse, so a 2 GB model costs nothing."""
    for name, (size, _) in model["files"].items():
        path = home / folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as file:
            file.truncate(size)


def python_child(code: str) -> list[str]:
    return [sys.executable, "-I", "-B", "-c", code]


class TemporaryHome(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = pathlib.Path(folder.name)
        env = {key: value for key, value in os.environ.items() if not key.startswith("HF_")}
        patch = mock.patch.dict(os.environ, {**env, "HOME": str(self.home)}, clear=True)
        patch.start()
        self.addCleanup(patch.stop)


class InstallModels(TemporaryHome):
    def setUp(self):
        super().setUp()
        self.fetched = []

    def fill(self, qwen3=True, whisper=True):
        qwen3_model, whisper_model = install_models.MODELS
        if qwen3:
            place(self.home, qwen3_model, QWEN3_FOLDER)
            ref = self.home / QWEN3_ENTRY / "refs/main"
            ref.parent.mkdir(parents=True, exist_ok=True)
            ref.write_text(QWEN3_REVISION)
        if whisper:
            place(self.home, whisper_model, WHISPER_FOLDER)

    def fetch_for_real(self, model, source):
        """Stands in for the network: leaves what a finished download leaves, and no refs/main for a fixed commit."""
        self.fetched.append(model["repo"])
        place(self.home, model, WHISPER_FOLDER if "whisper" in model["repo"] else QWEN3_FOLDER)

    def run_main(self, fetch):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(fetch=fetch)
        return code, out.getvalue(), err.getvalue()

    def test_complete_models_are_left_alone(self):
        self.fill()
        code, out, _ = self.run_main(self.fetch_for_real)
        self.assertEqual((code, self.fetched), (0, []))
        self.assertIn(f"Model in place: {WHISPER_REPO}", out)

    def test_an_empty_home_downloads_both_and_says_how_big(self):
        code, out, _ = self.run_main(self.fetch_for_real)
        self.assertEqual(code, 0)
        self.assertEqual(self.fetched, [QWEN3_REPO, WHISPER_REPO])
        self.assertIn("3.1 GB", out)
        self.assertIn("1.6 GB", out)

    def test_download_leaves_main_on_the_fixed_version(self):
        self.run_main(self.fetch_for_real)
        self.assertEqual((self.home / QWEN3_ENTRY / "refs/main").read_text(), QWEN3_REVISION)

    def test_only_the_model_with_a_gap_is_downloaded_again(self):
        self.fill()
        (self.home / WHISPER_FOLDER / "tokenizer.json").unlink()
        code, _, _ = self.run_main(self.fetch_for_real)
        self.assertEqual((code, self.fetched), (0, [WHISPER_REPO]))

    def test_a_file_of_the_wrong_size_counts_as_a_gap(self):
        self.fill()
        with open(self.home / QWEN3_FOLDER / "vocab.json", "wb") as file:
            file.truncate(10)
        self.run_main(self.fetch_for_real)
        self.assertEqual(self.fetched, [QWEN3_REPO])

    def test_main_on_another_version_counts_as_a_gap(self):
        self.fill()
        (self.home / QWEN3_ENTRY / "refs/main").write_text("0" * 40)
        code, _, _ = self.run_main(self.fetch_for_real)
        self.assertEqual((code, self.fetched), (0, [QWEN3_REPO]))
        self.assertEqual((self.home / QWEN3_ENTRY / "refs/main").read_text(), QWEN3_REVISION)

    def test_hf_home_moves_the_cached_model(self):
        moved = self.home / "elsewhere"
        qwen3_model = install_models.MODELS[0]
        place(self.home, qwen3_model, f"elsewhere/hub/models--mlx-community--Qwen3-TTS-12Hz-1.7B-Base-8bit/snapshots/{QWEN3_REVISION}")
        ref = moved / "hub/models--mlx-community--Qwen3-TTS-12Hz-1.7B-Base-8bit/refs/main"
        ref.parent.mkdir(parents=True)
        ref.write_text(QWEN3_REVISION)
        self.fill(qwen3=False)
        with mock.patch.dict(os.environ, {"HF_HOME": str(moved)}):
            code, _, _ = self.run_main(self.fetch_for_real)
        self.assertEqual((code, self.fetched), (0, []))

    def test_the_official_address_comes_first_and_the_mirror_stands_in_for_it(self):
        self.fill(whisper=False)
        tried = []

        def official_fails(model, source):
            tried.append(source["endpoint"])
            if source["endpoint"] == OFFICIAL:
                raise OSError("connection reset")
            self.fetch_for_real(model, source)

        code, _, err = self.run_main(official_fails)
        self.assertEqual((code, tried), (0, [OFFICIAL, MIRROR]))
        self.assertIn(f"from {OFFICIAL}: connection reset", err)
        self.assertNotIn("Run install.sh again", err)

    def test_when_every_address_fails_it_says_to_run_again_without_a_traceback(self):
        tried = []

        def broken(model, source):
            tried.append(source["endpoint"])
            raise OSError("connection reset")

        code, _, err = self.run_main(broken)
        self.assertEqual((code, tried), (1, [OFFICIAL, MIRROR]))
        self.assertIn("connection reset", err)
        self.assertIn("Run install.sh again to", err)  # SKILL.md tells network errors apart by these words.
        self.assertIn("an unfinished file starts over", err)
        self.assertIn("HF_ENDPOINT", err)
        self.assertNotIn("Traceback", err)

    def test_an_address_the_user_set_is_the_only_one_tried(self):
        tried = []

        def broken(model, source):
            tried.append(source["endpoint"])
            raise OSError("connection reset")

        with mock.patch.dict(os.environ, {"HF_ENDPOINT": "https://example.test"}):
            self.run_main(broken)
        self.assertEqual(tried, ["https://example.test"])

    def test_a_download_that_leaves_a_gap_is_not_success(self):
        code, _, err = self.run_main(lambda model, source: None)
        self.assertEqual(code, 1)
        self.assertIn("still incomplete", err)
        self.assertIn("model.safetensors is missing", err)

    def leave_partial(self, folder: str) -> pathlib.Path:
        partial = self.home / folder / "836b7b35.80707a08.incomplete"
        partial.parent.mkdir(parents=True, exist_ok=True)
        partial.write_bytes(b"cut off")
        return partial

    def test_leftovers_of_a_killed_download_go_before_the_next_download(self):
        qwen3 = self.leave_partial(f"{QWEN3_ENTRY}/blobs")
        whisper = self.leave_partial(f"{WHISPER_FOLDER}/.cache/huggingface/download")
        present = []

        def fetch(model, source):
            present.append((model["repo"], (whisper if "whisper" in model["repo"] else qwen3).exists()))
            self.fetch_for_real(model, source)

        code, _, _ = self.run_main(fetch)
        self.assertEqual(code, 0)
        self.assertEqual(present, [(QWEN3_REPO, False), (WHISPER_REPO, False)])

    def test_a_complete_model_keeps_everything_in_its_folder(self):
        self.fill()
        leftover = self.leave_partial(f"{QWEN3_ENTRY}/blobs")
        self.run_main(self.fetch_for_real)
        self.assertTrue(leftover.exists())

    def test_counting_survives_files_renamed_while_it_counts(self):
        target = self.home / "busy"
        target.mkdir()
        done = threading.Event()

        def rename_all_the_time():
            first, second = target / "first", target / "second"
            first.write_bytes(b"x")
            while not done.is_set():
                first.rename(second)
                second.rename(first)

        worker = threading.Thread(target=rename_all_the_time)
        worker.start()
        self.addCleanup(worker.join)
        self.addCleanup(done.set)
        for _ in range(3000):
            install_models.bytes_in(target)


class Download(TemporaryHome):
    """download() with a real child process doing what a transfer does, because the point is what happens to that process."""

    MODEL = {
        "repo": "someone/small",
        "revision": "abc",
        "folder": "small",
        "files": {"right": (3, hashlib.sha256(b"abc").hexdigest()), "changed": (3, hashlib.sha256(b"abc").hexdigest())},
    }
    SOURCE = {"endpoint": OFFICIAL, "env": {}}

    def setUp(self):
        super().setUp()
        self.folder = self.home / "small"
        self.folder.mkdir()
        patch = mock.patch.multiple(install_models, STALL_SECONDS=0.3, POLL_SECONDS=0.02)
        patch.start()
        self.addCleanup(patch.stop)

    def download_with(self, code: str):
        with mock.patch.object(install_models, "fetch_command", lambda model, source: python_child(code)):
            install_models.download(self.MODEL, self.SOURCE)

    def test_a_stuck_transfer_is_killed_and_reported(self):
        pid_file = self.folder / "pid"
        with self.assertRaisesRegex(OSError, "no new data"):
            self.download_with(f"import os, threading; open({str(pid_file)!r}, 'w').write(str(os.getpid())); threading.Event().wait()")
        with self.assertRaises(ProcessLookupError):
            os.kill(int(pid_file.read_text()), 0)

    def test_a_transfer_that_keeps_writing_is_left_to_finish(self):
        target = self.folder / "model"
        self.download_with(f"import time\nwith open({str(target)!r}, 'wb') as f:\n  for _ in range(20):\n    f.write(b'x'); f.flush(); time.sleep(0.05)\n")
        self.assertEqual(target.stat().st_size, 20)

    def test_a_file_still_coming_after_another_failed_is_left_to_finish(self):
        failed = self.folder / "failed.incomplete"
        failed.write_bytes(b"x" * 1000)
        target = self.folder / "other"
        self.download_with(
            "import os, time\n"
            "time.sleep(0.1)\n"  # Lets the watcher count the failed file first.
            f"os.unlink({str(failed)!r})\n"  # What the hub does to the temporary file of a transfer that fails.
            f"with open({str(target)!r}, 'wb') as f:\n  for _ in range(20):\n    f.write(b'x'); f.flush(); time.sleep(0.05)\n"
        )
        self.assertEqual(target.stat().st_size, 20)

    def test_a_transfer_that_fails_counts_as_failed(self):
        with self.assertRaisesRegex(OSError, "exit code 3"):
            self.download_with("import sys; sys.exit(3)")

    def test_a_source_setting_reaches_the_transfer_only(self):
        seen = self.folder / "seen"
        code = f"import os; open({str(seen)!r}, 'w').write(os.environ.get('HF_HUB_DISABLE_XET', 'unset'))"
        with mock.patch.object(install_models, "fetch_command", lambda model, source: python_child(code)):
            install_models.download(self.MODEL, {"endpoint": MIRROR, "env": {"HF_HUB_DISABLE_XET": "1"}})
        self.assertEqual(seen.read_text(), "1")
        self.assertNotIn("HF_HUB_DISABLE_XET", os.environ)

    def test_right_content_stays(self):
        (self.folder / "right").write_bytes(b"abc")
        (self.folder / "changed").write_bytes(b"abc")
        self.download_with("pass")
        self.assertEqual(sorted(path.name for path in self.folder.iterdir()), ["changed", "right"])

    def test_changed_content_of_the_right_size_is_removed_and_counts_as_failed(self):
        (self.folder / "right").write_bytes(b"abc")
        (self.folder / "changed").write_bytes(b"xyz")
        with self.assertRaisesRegex(OSError, "wrong content, removed: changed"):
            self.download_with("pass")
        self.assertEqual([path.name for path in self.folder.iterdir()], ["right"])

    def test_a_changed_cached_file_goes_along_with_its_link(self):
        blob = self.home / "blobs/836b7b35"
        blob.parent.mkdir()
        blob.write_bytes(b"xyz")
        (self.folder / "changed").symlink_to(blob)
        with self.assertRaisesRegex(OSError, "wrong content, removed: changed"):
            self.download_with("pass")
        self.assertEqual((blob.exists(), (self.folder / "changed").is_symlink()), (False, False))


STAND_IN_HUB = """
import json
import os


def snapshot_download(*args, **kwargs):
    if os.environ.get("STAND_IN_FAILS"):
        raise OSError("the stand-in failed")
    with open(os.environ["STAND_IN_RECORD"], "w") as file:
        json.dump({"args": args, "kwargs": {key: str(value) if key in ("cache_dir", "local_dir") else value for key, value in kwargs.items()}}, file)
"""


class TheInstallerProcess(unittest.TestCase):
    """The real process, because what is checked here is whether it ends and what it leaves on the terminal."""

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.home = pathlib.Path(folder.name)

    def start(self, setup: str, *args, **env) -> subprocess.Popen:
        skill = str(pathlib.Path(install_models.__file__).parent)
        code = f"import sys; sys.path[:0] = [{str(self.home / 'stand-in')!r}, {skill!r}]; import install_models as m; sys.argv = ['install_models.py', *{list(args)!r}]; {setup}; m.run()"
        process = subprocess.Popen(
            python_child(code),
            env={"HOME": str(self.home), "PATH": os.environ["PATH"], **env},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.addCleanup(process.stderr.close)
        self.addCleanup(process.stdout.close)
        self.addCleanup(process.wait)
        self.addCleanup(process.kill)
        return process

    def finish(self, process: subprocess.Popen) -> tuple[str, str]:
        try:
            return process.communicate(timeout=20)
        except subprocess.TimeoutExpired:
            self.fail("the process is still running")

    def stuck_transfers(self, stall_seconds: float) -> str:
        return (
            "m.fetch_command = lambda model, source: [sys.executable, '-c', 'import threading; threading.Event().wait()']; "
            f"m.STALL_SECONDS = {stall_seconds}; m.POLL_SECONDS = 0.05"
        )

    def test_when_every_address_is_stuck_the_process_ends_and_says_what_to_do(self):
        process = self.start(self.stuck_transfers(0.3))
        _, err = self.finish(process)
        self.assertEqual(process.returncode, 1)
        self.assertIn(f"from {OFFICIAL}: no new data", err)
        self.assertIn(f"from {MIRROR}: no new data", err)
        self.assertIn("Run install.sh again to", err)

    def test_ctrl_c_ends_a_stuck_download(self):
        process = self.start(self.stuck_transfers(600))
        self.assertIn("Downloading", process.stdout.readline())
        time.sleep(0.5)
        process.send_signal(signal.SIGINT)
        self.finish(process)
        self.assertEqual(process.returncode, 130)

    def test_a_machine_with_both_models_ends_at_once_and_says_so(self):
        for model in install_models.MODELS:
            place(self.home, model, model.get("folder", QWEN3_FOLDER))
        ref = self.home / QWEN3_ENTRY / "refs/main"
        ref.parent.mkdir(parents=True)
        ref.write_text(QWEN3_REVISION)
        process = self.start("pass")
        out, _ = self.finish(process)
        self.assertEqual(process.returncode, 0)
        self.assertIn(f"Model in place: {WHISPER_REPO}", out)

    def write_stand_in_hub(self):
        hub = self.home / "stand-in/huggingface_hub"
        hub.mkdir(parents=True)
        (hub / "__init__.py").write_text(STAND_IN_HUB)
        (hub / "utils.py").write_text("def disable_progress_bars():\n    pass\n")

    def test_the_transfer_asks_the_hub_for_the_fixed_version_from_the_given_address(self):
        self.write_stand_in_hub()
        record = self.home / "record.json"
        process = self.start("pass", "--fetch", QWEN3_REPO, MIRROR, STAND_IN_RECORD=str(record))
        self.finish(process)
        self.assertEqual(process.returncode, 0)
        called = json.loads(record.read_text())
        self.assertEqual(called["args"], [QWEN3_REPO])
        self.assertEqual(called["kwargs"]["revision"], QWEN3_REVISION)
        self.assertEqual(called["kwargs"]["endpoint"], MIRROR)
        self.assertIs(called["kwargs"]["token"], False)
        self.assertEqual(called["kwargs"]["cache_dir"], str(self.home / ".cache/huggingface/hub"))
        self.assertIn("speech_tokenizer/model.safetensors", called["kwargs"]["allow_patterns"])

    def test_a_whisper_transfer_writes_into_its_own_folder(self):
        self.write_stand_in_hub()
        record = self.home / "record.json"
        process = self.start("pass", "--fetch", WHISPER_REPO, OFFICIAL, STAND_IN_RECORD=str(record))
        self.finish(process)
        self.assertEqual(json.loads(record.read_text())["kwargs"]["local_dir"], str(self.home / WHISPER_FOLDER))

    def test_a_transfer_that_fails_prints_the_reason_without_a_traceback(self):
        self.write_stand_in_hub()
        process = self.start("pass", "--fetch", QWEN3_REPO, OFFICIAL, STAND_IN_FAILS="1")
        _, err = self.finish(process)
        self.assertEqual(process.returncode, 1)
        self.assertIn("the stand-in failed", err)
        self.assertNotIn("Traceback", err)


if __name__ == "__main__":
    unittest.main()
