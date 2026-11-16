import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planCopy} from './lib/copy.mjs';

const existing = (entries) => new Map(Object.entries(entries));

test('a figure whose name is free is copied', () => {
  assert.deepEqual(planCopy([{name: 'a.png', sha256: 'n'}], existing({'b.png': 'o'})), [{name: 'a.png', action: 'copy'}]);
});

for (const [why, figures, before, renamed] of [
  ['the first free number is 1', [{name: 'a.png', sha256: 'new'}], {'a.png': 'old'}, 'a-v1.png'],
  ['a taken number is skipped', [{name: 'a.png', sha256: 'new'}], {'a.png': 'old', 'a-v1.png': 'older'}, 'a-v2.png'],
  ['a name another figure brings is taken too', [{name: 'x.png', sha256: 'new'}, {name: 'x-v1.png', sha256: 'n2'}], {'x.png': 'old'}, 'x-v2.png'],
  ['the extension stays', [{name: 'b.gif', sha256: 'new'}], {'b.gif': 'old', 'b-v1.png': 'other'}, 'b-v1.gif'],
]) {
  test(`an older file with different content is renamed before the copy: ${why}`, () => {
    assert.deepEqual(planCopy(figures, existing(before))[0], {name: figures[0].name, action: 'copy', renameOldTo: renamed});
  });
}

test('a file with the same content is left as it is', () => {
  assert.deepEqual(planCopy([{name: 'a.png', sha256: 'same'}], existing({'a.png': 'same'})), [{name: 'a.png', action: 'keep'}]);
});
