import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planCopy} from './lib/copy.mjs';

const existing = (entries) => new Map(Object.entries(entries));

// Each case: the figures to copy, the folder's files (name to content hash) and the plan.
for (const [what, figures, before, plan] of [
  ['a figure whose name is free is copied', [{name: 'a.png', sha256: 'n'}], {'b.png': 'o'}, [{name: 'a.png', action: 'copy'}]],
  ['a file with the same content is left as it is', [{name: 'a.png', sha256: 'same'}], {'a.png': 'same'}, [{name: 'a.png', action: 'keep'}]],
  ['an older, different file is renamed first: the first free number is 1', [{name: 'a.png', sha256: 'new'}], {'a.png': 'old'}, [{name: 'a.png', action: 'copy', rename: {from: 'a.png', to: 'a-v1.png'}}]],
  ['an older, different file is renamed first: a taken number is skipped', [{name: 'a.png', sha256: 'new'}], {'a.png': 'old', 'a-v1.png': 'older'}, [{name: 'a.png', action: 'copy', rename: {from: 'a.png', to: 'a-v2.png'}}]],
  [
    'an older, different file is renamed first: a name another figure brings is taken too',
    [{name: 'x.png', sha256: 'new'}, {name: 'x-v1.png', sha256: 'n2'}],
    {'x.png': 'old'},
    [{name: 'x.png', action: 'copy', rename: {from: 'x.png', to: 'x-v2.png'}}, {name: 'x-v1.png', action: 'copy'}],
  ],
  ['an older, different file is renamed first: the extension stays', [{name: 'b.gif', sha256: 'new'}], {'b.gif': 'old', 'b-v1.png': 'other'}, [{name: 'b.gif', action: 'copy', rename: {from: 'b.gif', to: 'b-v1.gif'}}]],
  ['an older, different file is renamed first: a name without an extension gets the number at its end', [{name: 'notes', sha256: 'new'}], {notes: 'old'}, [{name: 'notes', action: 'copy', rename: {from: 'notes', to: 'notes-v1'}}]],
  // On macOS, Cover-v1.png and cover-v1.png are one name, and cover.png reaches the file Cover.png.
  [
    'letter case does not tell names apart: a number taken in other case is skipped',
    [{name: 'cover.png', sha256: 'new'}],
    {'cover.png': 'old', 'Cover-v1.png': 'unrelated'},
    [{name: 'cover.png', action: 'copy', rename: {from: 'cover.png', to: 'cover-v2.png'}}],
  ],
  ['letter case does not tell names apart: a different file under the name in other case is renamed', [{name: 'cover.png', sha256: 'new'}], {'Cover.png': 'old'}, [{name: 'cover.png', action: 'copy', rename: {from: 'Cover.png', to: 'Cover-v1.png'}}]],
  ['letter case does not tell names apart: the same file under the name in other case is left as it is', [{name: 'cover.png', sha256: 'same'}], {'Cover.png': 'same'}, [{name: 'cover.png', action: 'keep'}]],
]) {
  test(what, () => {
    assert.deepEqual(planCopy(figures, existing(before)), plan);
  });
}
