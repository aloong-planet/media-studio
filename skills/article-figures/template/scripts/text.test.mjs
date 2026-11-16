import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nonEnglish} from '../src/check/text.ts';

for (const text of ['压缩', '会话 session', 'セッション', '세션', '（idle）', 'ｉｄｌｅ', 'Done。']) {
  test(`text with a character English does not use is found: ${text}`, () => {
    assert.equal(nonEnglish(text), true);
  });
}

for (const text of ['Compact, then wake', 'idle | busy: 3 × 2 → 6', '“Done” — it’s 12:00…', '≤ 200k tokens · 5%', 'A B\n']) {
  test(`English text with digits and typographic punctuation passes: ${text}`, () => {
    assert.equal(nonEnglish(text), false);
  });
}
