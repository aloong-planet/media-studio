import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deliveryProblems} from './lib/delivery.mjs';
import {parseFigureList} from './lib/figure-list.mjs';

const MANIFEST = {
  files: {'a.png': 'hash-a', 'b.gif': 'hash-b'},
  figures: [
    {id: 'a', kind: 'still', title: 'Human in the loop'},
    {id: 'b', kind: 'gif', title: 'Compact, then wake'},
  ],
};
const HASHES = {'a.png': 'hash-a', 'b.gif': 'hash-b'};
const HEAD = '| File | Section | Kind | Title | Shows | Alt text |\n|---|---|---|---|---|---|\n';
const A = '| `a.png` | §2 派活 | still | Human in the loop | Who does each step | 每一步由谁来做 |\n';
const B = '| `b.gif` | §5 压缩 | gif | Compact, then wake | The steps in order | 压缩再唤醒 |\n';
const rows = (...lines) => parseFigureList(HEAD + lines.join(''));
const AGAIN = 'run pnpm render again and show the new preview.';

// Each case: the manifest of the last passed render, the hashes of out/ now, the list now, and the problems.
for (const [what, manifest, hashes, list, problems] of [
  ['a passed render whose files and list are unchanged', MANIFEST, HASHES, rows(A, B), []],
  ['no passed render', null, {}, rows(A, B), ['No passed render in out/: run pnpm render, show the preview, and deliver once the author approves it.']],
  ['a rendered file that changed', MANIFEST, {...HASHES, 'a.png': 'edited'}, rows(A, B), [`out/a.png changed after pnpm render passed: ${AGAIN}`]],
  ['a rendered file that is gone', MANIFEST, {...HASHES, 'b.gif': null}, rows(A, B), [`out/b.gif changed after pnpm render passed: ${AGAIN}`]],
  ['a row added to the list', MANIFEST, HASHES, rows(A, B, '| `c.png` | §6 | still | Later | Added | 后加的图 |\n'), [`figures.md changed after pnpm render passed (c.png is in figures.md but not drawn): ${AGAIN}`]],
  ['a row removed from the list', MANIFEST, HASHES, rows(A), [`figures.md changed after pnpm render passed (b is drawn but not in figures.md): ${AGAIN}`]],
  ['a title changed in the list', MANIFEST, HASHES, rows(A.replace('Human in the loop', 'Who acts'), B), [`figures.md changed after pnpm render passed (a.png is listed as "Who acts" but drawn as "Human in the loop"): ${AGAIN}`]],
]) {
  test(`what may be copied into the article: ${what}`, () => {
    assert.deepEqual(deliveryProblems(manifest, hashes, list), problems);
  });
}
