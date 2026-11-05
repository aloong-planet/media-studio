"""Run with: pnpm check"""
import pathlib
import tempfile
import unittest
import wave
from unittest import mock

import numpy as np

import narrate
from narrate import VOICE, clip_path, compare, plan_takes, take_text, voice_segments

# Not covered here: that synth_qwen3.py really passes the temperature to the model, and how real speech cuts.
# Only a real run shows those: pnpm narrate, then listen.


def spoken(*texts: str) -> list[dict]:
    return [{"w": t, "s": float(i), "e": float(i + 1)} for i, t in enumerate(texts)]


def weight(script: str, *heard: str) -> int:
    return sum(d["weight"] for d in compare(script, spoken(*heard))[1])


class SoundDifference(unittest.TestCase):
    def test_digit_heard_for_english_word_scores_like_its_english_name(self):
        self.assertEqual(weight("起源 Thread 和", "起源", "3", "和"), weight("起源 Thread 和", "起源", "three", "和"))

    def test_chinese_mishearing_of_english_word_keeps_full_weight(self):
        self.assertEqual(weight("起源 Thread 和", "起源", "税", "和"), 6)

    def test_digit_for_chinese_number_still_matches(self):
        self.assertEqual(weight("PR 十二号", "PR", "12", "号"), 0)

    def test_digit_unlike_the_english_word_is_never_worse_than_a_full_miss(self):
        self.assertEqual(weight("走 Gate 过", "走", "3", "过"), 4)

    def test_digit_for_letter_keeps_the_chinese_reading_when_closer(self):
        self.assertEqual(weight("开 PR 了", "开", "P", "2", "了"), 1)


class TakePlan(unittest.TestCase):
    SEGMENTS = [
        {"id": "a-1", "take": "a", "lines": [{"say": "第一句，"}, {"say": "还是第一句。"}]},
        {"id": "a-2", "take": "a", "lines": [{"say": "第二句。"}]},
        {"id": "a-wrap", "hold": 2.0},
        {"id": "b-1", "take": "b", "lines": [{"say": "第三句。"}]},
    ]

    def test_segments_are_grouped_in_film_order_and_silent_ones_are_skipped(self):
        self.assertEqual(plan_takes(self.SEGMENTS), [
            ("a", [("a-1", "第一句，还是第一句。"), ("a-2", "第二句。")]),
            ("b", [("b-1", "第三句。")]),
        ])

    def test_a_take_reads_its_segments_and_then_the_throwaway_sentence(self):
        self.assertEqual(take_text([("a-1", "第一句。"), ("a-2", "第二句。")]), "第一句。第二句。我们继续。")


class ClipCache(unittest.TestCase):
    def clip_with(self, text: str = "走 Slow Path 进 Router。", **voice) -> str:
        with mock.patch.dict(VOICE, voice):
            return clip_path(text).name

    def test_same_voice_and_text_reuse_the_clip(self):
        self.assertEqual(self.clip_with(), self.clip_with())

    def test_changing_a_voice_setting_makes_a_new_clip(self):
        for change in ({"model": "other/model"}, {"lang": "chinese"}, {"maxTokens": 100}, {"refText": "别的参考文字。"}, {"temperature": 0.9}):
            with self.subTest(change=change):
                self.assertNotEqual(self.clip_with(**change), self.clip_with())

    def test_replacing_the_reference_voice_makes_a_new_clip(self):
        with tempfile.TemporaryDirectory() as folder:
            ref = pathlib.Path(folder) / "ref.wav"
            ref.write_bytes(b"one voice")
            before = self.clip_with(ref=str(ref))
            ref.write_bytes(b"another voice")
            self.assertNotEqual(before, self.clip_with(ref=str(ref)))

    def test_changing_the_text_makes_a_new_clip(self):
        self.assertNotEqual(self.clip_with(text="走 Fast Path。"), self.clip_with())


RATE = 24000


def speech(seconds: float) -> np.ndarray:
    t = np.arange(int(seconds * RATE)) / RATE
    return (8000 * np.sin(2 * np.pi * 200 * t)).astype(np.int16)


def pause(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * RATE), dtype=np.int16)


def write_wav(path: str, *pieces: np.ndarray) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(np.concatenate(pieces).tobytes())


def seconds_of(path: pathlib.Path) -> float:
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def timed(start: float, end: float, text: str) -> list[dict]:
    """Whisper's word list as it really looks: per word, with punctuation stuck to the word before it."""
    chars = list(text)
    step = (end - start) / len(chars)
    return [{"w": c, "s": start + i * step, "e": start + (i + 1) * step} for i, c in enumerate(chars)]


class SegmentsFromATake(unittest.TestCase):
    FIRST, SECOND = "程序层放行。", "查订阅表。"
    SEGMENTS = [{"id": "a-1", "take": "a", "lines": [{"say": FIRST}]}, {"id": "a-2", "take": "a", "lines": [{"say": SECOND}]}]
    # first sentence 0-1.0 s, pause, second 1.4-2.2 s, pause, throwaway sentence 2.6-3.4 s
    TAKE = (speech(1.0), pause(0.4), speech(0.8), pause(0.4), speech(0.8))
    HEARD_TAKE = timed(0.0, 1.0, FIRST) + timed(1.4, 2.2, SECOND) + timed(2.6, 3.4, "我们继续。")

    def voice(self, take=TAKE, heard_take=HEARD_TAKE, heard_first=None, heard_second=None, already_there=False):
        """The model and Whisper are outside this test: the take and what is heard are given, the cutting and files are real."""
        heard_segments = iter([
            timed(0.0, 1.0, self.FIRST) if heard_first is None else heard_first,
            timed(0.1, 0.9, self.SECOND) if heard_second is None else heard_second,
        ])
        self.jobs = []

        def synthesize(jobs):
            self.jobs += jobs
            for job in jobs:
                write_wav(job["out"], *take)

        def hear(clip):
            return heard_take if clip == clip_path(take_text([("", self.FIRST), ("", self.SECOND)])) else next(heard_segments)

        with mock.patch("narrate.synthesize", synthesize), mock.patch("narrate.transcribe"), mock.patch("narrate.hear", hear):
            return voice_segments(self.SEGMENTS)

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        patcher = mock.patch("narrate.CACHE", pathlib.Path(folder.name))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_the_model_reads_both_segments_and_the_throwaway_sentence_in_one_take(self):
        self.voice()
        self.assertEqual([j["text"] for j in self.jobs], ["程序层放行。查订阅表。我们继续。"])

    def test_each_segment_is_cut_inside_a_pause(self):
        voiced = self.voice()
        self.assertGreater(seconds_of(voiced["a-1"]["clip"]), 1.0)
        self.assertLess(seconds_of(voiced["a-1"]["clip"]), 1.4)

    def test_the_throwaway_sentence_is_in_no_segment(self):
        voiced = self.voice()
        total = seconds_of(voiced["a-1"]["clip"]) + seconds_of(voiced["a-2"]["clip"])
        self.assertGreater(total, 2.2)
        self.assertLess(total, 2.6)

    def test_whisper_inventing_words_after_the_voice_stops_does_not_move_the_cut(self):
        invented = self.HEARD_TAKE + [{"w": "yellow", "s": 3.39, "e": 3.39}, {"w": "Water.", "s": 3.39, "e": 3.39}]
        self.assertLess(seconds_of(self.voice(heard_take=invented)["a-1"]["clip"]), 1.4)

    def test_whisper_missing_the_throwaway_sentence_still_keeps_it_out(self):
        heard = timed(0.0, 1.0, self.FIRST) + timed(1.4, 2.2, self.SECOND)
        voiced = self.voice(heard_take=heard)
        self.assertLess(seconds_of(voiced["a-1"]["clip"]) + seconds_of(voiced["a-2"]["clip"]), 2.6)

    def test_whisper_placing_words_past_the_end_of_the_audio_stops_the_run_and_names_the_segment(self):
        heard = timed(0.0, 1.0, self.FIRST) + timed(5.0, 5.8, self.SECOND) + timed(5.9, 6.7, "我们继续。")
        with self.assertRaisesRegex(RuntimeError, "no quiet point after a-2"):
            self.voice(heard_take=heard)

    def test_differences_are_reported_for_the_segment_they_were_heard_in(self):
        voiced = self.voice(heard_second=timed(0.1, 0.7, "查订阅") + [{"w": "角", "s": 0.7, "e": 0.9}])
        self.assertEqual(voiced["a-1"]["diffs"], [])
        self.assertEqual([(d["said"], d["heard"]) for d in voiced["a-2"]["diffs"]], [("表", "角")])

    def test_a_take_already_generated_is_not_generated_again(self):
        self.voice()
        self.voice()
        self.assertEqual(len(self.jobs), 0)

    def test_a_take_over_forty_seconds_stops_the_run_and_names_it(self):
        with self.assertRaisesRegex(RuntimeError, "take a runs 41.0s"):
            self.voice(take=(pause(41.0),))

    def test_a_take_with_nothing_heard_stops_the_run_and_names_the_text(self):
        with self.assertRaisesRegex(RuntimeError, self.FIRST):
            self.voice(heard_take=[])

    def test_a_segment_with_nothing_heard_stops_the_run_and_names_the_text(self):
        with self.assertRaisesRegex(RuntimeError, self.SECOND):
            self.voice(heard_second=[])

    def test_speech_with_no_pause_at_the_cut_stops_the_run_and_names_the_segment(self):
        with self.assertRaisesRegex(RuntimeError, "no quiet point after a-1"):
            self.voice(take=(speech(3.4),))


class ScriptProblems(unittest.TestCase):
    def test_a_complete_script_has_none(self):
        self.assertEqual(narrate.script_problems([
            {"id": "a", "chapter": "c", "kind": "step", "take": "t", "lines": [{"say": "一句。"}]},
            {"id": "b", "chapter": "c", "kind": "wrap", "hold": 1.6},
        ]), [])

    def test_each_missing_field_is_named_with_its_segment(self):
        self.assertEqual(narrate.script_problems([
            {"id": "a", "kind": "step", "lines": [{"say": "一句。"}]},
            {"chapter": "c", "kind": "wrap"},
        ]), ["a: missing chapter", "a: missing take", "segment 2: missing id", "segment 2: missing lines or hold"])


class Preflight(unittest.TestCase):
    def test_a_missing_voice_stops_the_run_and_names_it(self):
        with mock.patch.dict(VOICE, {"ref": "voices/nobody.wav"}):
            with self.assertRaisesRegex(SystemExit, "reference voice.*nobody.wav"):
                narrate.preflight()

    def test_a_missing_model_stops_the_run_and_names_it(self):
        with mock.patch.dict(VOICE, {"model": "nobody/no-such-model"}):
            with self.assertRaisesRegex(SystemExit, "TTS model.*no-such-model"):
                narrate.preflight()


if __name__ == "__main__":
    unittest.main()
