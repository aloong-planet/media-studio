"""Run from this folder: python3 -B -m unittest test_add_voice. ffmpeg is real; Whisper is a stand-in, so nothing here loads a model.

Not covered here: what real Whisper hears. Check it by running add_voice.py without the words on a real recording.
Not caught by the script at all: noise. It has sound, and Whisper writes a confident sentence for it, so only the person checking the words can tell.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave

HERE = pathlib.Path(__file__).resolve().parent
# Writes what Whisper's job writes: per word, with punctuation stuck to the word before it.
STAND_IN_WHISPER = """
import json, os, sys
spec = json.load(open(sys.argv[1], encoding="utf-8"))
with open(os.environ["WHISPER_LOG"], "a", encoding="utf-8") as log:
    log.write(json.dumps({"model": spec["model"], "clip": spec["jobs"][0]["clip"], "offline": os.environ.get("HF_HUB_OFFLINE")}) + "\\n")
if os.environ.get("WHISPER_FAILS"):
    print("the model broke", file=sys.stderr)
    sys.exit(1)
heard = [w for w in os.environ["WHISPER_HEARS"].split("|") if w]
json.dump([{"w": w, "s": float(i), "e": float(i + 1)} for i, w in enumerate(heard)], open(spec["jobs"][0]["out"], "w", encoding="utf-8"))
"""


class AddVoice(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = pathlib.Path(folder.name)
        self.home = self.root / "home"
        self.skill = self.root / "skill"
        self.voices = self.home / ".video-tutorial/voices"
        self.log = self.root / "whisper.log"
        self.whisper = self.home / ".cache/mlx-tts/whisper-large-v3-turbo-asr-fp16"
        self.whisper.mkdir(parents=True)
        (self.skill / "template/scripts").mkdir(parents=True)
        (self.skill / "template/scripts/transcribe_whisper.py").write_text(STAND_IN_WHISPER, "utf-8")
        shutil.copy(HERE / "add_voice.py", self.skill / "add_voice.py")

    def recording(self, seconds: float = 6.0, name: str = "memo.m4a") -> str:
        """A phone recording's shape: compressed, stereo, 44.1 kHz."""
        path = self.root / name
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency=220:duration={seconds}", "-ac", "2", "-ar", "44100", "-c:a", "aac", str(path)],
            check=True,
        )
        return str(path)

    def run_it(self, *args: str, hears: str = "请求先到网关：|这是第一次打开，|缓存里没有。", fails: bool = False) -> subprocess.CompletedProcess:
        env = {**os.environ, "HOME": str(self.home), "WHISPER_LOG": str(self.log), "WHISPER_HEARS": hears}
        if fails:
            env["WHISPER_FAILS"] = "1"
        return subprocess.run([sys.executable, "-B", "-I", str(self.skill / "add_voice.py"), *args], capture_output=True, text=True, env=env)

    def whisper_runs(self) -> list[dict]:
        return [json.loads(line) for line in self.log.read_text("utf-8").splitlines()] if self.log.exists() else []

    def voice_files(self) -> list[str]:
        return sorted(p.name for p in self.voices.iterdir()) if self.voices.exists() else []

    def refused(self, result: subprocess.CompletedProcess, message: str) -> None:
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertRegex(result.stderr, message)
        self.assertEqual(self.voice_files(), [])

    def test_a_phone_recording_becomes_the_format_the_narration_reads(self):
        result = self.run_it("mine", self.recording(), "这是我的声音。")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.voice_files(), ["mine.txt", "mine.wav"])
        with wave.open(str(self.voices / "mine.wav")) as audio:
            self.assertEqual((audio.getframerate(), audio.getnchannels(), audio.getsampwidth()), (24000, 1, 2))
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 6.0, delta=0.2)

    def test_a_voice_is_kept_outside_the_skill_folder_so_an_update_cannot_delete_it(self):
        self.assertEqual(self.run_it("mine", self.recording(), "这是我的声音。").returncode, 0)
        self.assertEqual(sorted(p.name for p in self.skill.iterdir()), ["add_voice.py", "template"])
        shutil.rmtree(self.skill)
        self.assertEqual(self.voice_files(), ["mine.txt", "mine.wav"])

    def test_given_words_are_kept_and_whisper_is_not_run(self):
        result = self.run_it("mine", self.recording(), "  这是我的声音。 ")
        self.assertEqual((self.voices / "mine.txt").read_text("utf-8"), "这是我的声音。\n")
        self.assertEqual(self.whisper_runs(), [])
        self.assertNotIn("may be wrong", result.stdout)

    def test_without_words_whisper_writes_them_offline_and_the_output_says_to_check(self):
        result = self.run_it("mine", self.recording())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.voices / "mine.txt").read_text("utf-8"), "请求先到网关：这是第一次打开，缓存里没有。\n")
        self.assertEqual(self.whisper_runs()[0]["model"], str(self.whisper))
        self.assertEqual(self.whisper_runs()[0]["offline"], "1")
        self.assertIn("请求先到网关：这是第一次打开，缓存里没有。", result.stdout)
        self.assertIn("may be wrong", result.stdout)
        self.assertIn(str(self.voices / "mine.txt"), result.stdout)

    def test_whisper_hears_the_converted_audio_not_the_original(self):
        self.run_it("mine", self.recording())
        self.assertTrue(self.whisper_runs()[0]["clip"].endswith(".wav"))

    def test_a_recording_too_short_is_refused(self):
        self.refused(self.run_it("mine", self.recording(2.0), "太短了。"), r"runs 2\.\d s\. Cut it to between 3 and 30 s")

    def test_a_recording_too_long_is_refused(self):
        self.refused(self.run_it("mine", self.recording(31.0), "太长了。"), r"runs 31\.\d s\. Cut it to between 3 and 30 s")

    def test_silence_is_refused_before_whisper_can_invent_words_for_it(self):
        silent = self.root / "silent.m4a"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "6", "-c:a", "aac", str(silent)], check=True)
        self.refused(self.run_it("mine", str(silent)), "has no sound in it")
        self.assertEqual(self.whisper_runs(), [])

    def test_silence_is_refused_even_with_words_given(self):
        silent = self.root / "silent.m4a"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "6", "-c:a", "aac", str(silent)], check=True)
        self.refused(self.run_it("mine", str(silent), "这段没有声音。"), "has no sound in it")

    def test_a_file_that_is_not_audio_is_refused(self):
        notes = self.root / "notes.txt"
        notes.write_text("这不是音频", "utf-8")
        self.refused(self.run_it("mine", str(notes), "没有声音。"), "Cannot read audio from .*notes.txt")

    def test_a_video_with_no_sound_is_refused(self):
        video = self.root / "silent.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=white:s=64x64:d=6", str(video)], check=True)
        self.refused(self.run_it("mine", str(video), "没有声音。"), "Cannot read audio from .*silent.mp4")

    def test_a_missing_file_is_refused(self):
        self.refused(self.run_it("mine", str(self.root / "nowhere.m4a"), "没有文件。"), "Cannot read audio from .*nowhere.m4a")

    def test_an_existing_voice_is_never_overwritten(self):
        recording = self.recording()
        self.run_it("mine", recording, "第一次。")
        before = (self.voices / "mine.wav").read_bytes()
        result = self.run_it("mine", recording, "第二次。")
        self.assertEqual(result.returncode, 1)
        self.assertIn("already exists", result.stderr)
        self.assertEqual((self.voices / "mine.txt").read_text("utf-8"), "第一次。\n")
        self.assertEqual((self.voices / "mine.wav").read_bytes(), before)

    def test_a_name_that_would_leave_the_voices_folder_is_refused(self):
        for name in ("../mine", "a/b", "my voice", ""):
            with self.subTest(name=name):
                self.refused(self.run_it(name, self.recording(), "名字不对。"), "Bad voice name")
        self.assertEqual(sorted(p.name for p in self.skill.iterdir()), ["add_voice.py", "template"])
        self.assertFalse((self.home / ".video-tutorial").exists())

    def test_nothing_heard_is_refused_and_leaves_no_voice(self):
        self.refused(self.run_it("mine", self.recording(), hears=""), "nothing was heard")

    def test_whisper_breaking_is_refused_and_leaves_no_voice(self):
        self.refused(self.run_it("mine", self.recording(), fails=True), "Give the words it says instead.*the model broke")

    def test_without_the_whisper_model_it_names_install_sh(self):
        self.whisper.rmdir()
        self.refused(self.run_it("mine", self.recording()), "Missing Whisper model.*Run install.sh")

    def test_without_the_whisper_model_given_words_still_work(self):
        self.whisper.rmdir()
        self.assertEqual(self.run_it("mine", self.recording(), "这是我的声音。").returncode, 0)

    def test_the_wrong_number_of_arguments_prints_the_usage(self):
        result = self.run_it("mine")
        self.assertEqual(result.returncode, 2)
        self.assertIn("usage:", result.stderr)


if __name__ == "__main__":
    unittest.main()
