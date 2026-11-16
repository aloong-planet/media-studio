import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nonEnglish} from '../src/check/text.ts';

// Each case: a text and whether it has a character English does not use. English text keeps digits and typographic punctuation.
for (const [text, found] of [
  ['压缩', true],
  ['会话 session', true],
  ['セッション', true],
  ['세션', true],
  ['（idle）', true],
  ['ｉｄｌｅ', true],
  ['Done。', true],
  // Signs and spaces of the English blocks that IBM Plex lacks, so they would be drawn in another font.
  ['on a miss ↯', true],
  ['12 ms', true],
  ['Compact, then wake', false],
  ['idle | busy: 3 × 2 → 6', false],
  ['“Done” — it’s 12:00…', false],
  ['≤ 200k tokens · 5%', false],
  ['A B\n', false],
]) {
  test(`a character English does not use is ${found ? 'found' : 'not found'}: ${text}`, () => {
    assert.equal(nonEnglish(text), found);
  });
}
