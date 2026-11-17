import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fontCharacters} from './lib/charset.mjs';

const ASCII = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

// Each case gives the text of the sources and the characters the fonts must be cut for.
for (const [what, text, chars] of [
  ['printable ASCII is always there', '', ASCII],
  ['the other characters follow once each in code order, not in the order of the text, and a line break is left out', '缓存·存\n转', `${ASCII}·存缓转`],
]) {
  test(`the characters the fonts are cut for: ${what}`, () => {
    assert.equal(fontCharacters(text), chars);
  });
}
