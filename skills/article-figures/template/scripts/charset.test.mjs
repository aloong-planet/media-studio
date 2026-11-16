import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fontCharacters} from './lib/charset.mjs';

const ASCII = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

// Each case: the text of the sources and the characters the fonts are cut for.
for (const [what, text, chars] of [
  ['printable ASCII is always there', '', ASCII],
  ['a character English does not use is left out', '缓存 cache\n', ASCII],
  ['other English signs follow in code order, not in the order of the text', '3 × 2 · “x”', `${ASCII}·×“”`],
]) {
  test(`the characters the fonts are cut for: ${what}`, () => {
    assert.equal(fontCharacters(text), chars);
  });
}
