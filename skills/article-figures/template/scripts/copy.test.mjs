import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyPlan, copyReport, planCopy} from './lib/copy.mjs';

// A folder like macOS's default one, which takes Cover.png and cover.png for one name, or one made case-sensitive.
const folder = (entries, ignoreCase = true) => ({entries: new Map(Object.entries(entries)), ignoreCase});

// Each case: the figures to copy, the folder (names to content hash, null for a link or a folder) and the plan.
for (const [what, figures, before, plan] of [
  ['a figure whose name is free is copied', [{name: 'a.png', sha256: 'n'}], folder({'b.png': 'o'}), [{name: 'a.png', action: 'copy'}]],
  ['a file with the same content is left as it is', [{name: 'a.png', sha256: 'same'}], folder({'a.png': 'same'}), [{name: 'a.png', action: 'keep'}]],
  ['an older, different file is renamed first: the first free number is 1', [{name: 'a.png', sha256: 'new'}], folder({'a.png': 'old'}), [{name: 'a.png', action: 'copy', rename: {from: 'a.png', to: 'a-v1.png'}}]],
  ['an older, different file is renamed first: a taken number is skipped', [{name: 'a.png', sha256: 'new'}], folder({'a.png': 'old', 'a-v1.png': 'older'}), [{name: 'a.png', action: 'copy', rename: {from: 'a.png', to: 'a-v2.png'}}]],
  [
    'an older, different file is renamed first: a name another figure brings is taken too',
    [{name: 'x.png', sha256: 'new'}, {name: 'x-v1.png', sha256: 'n2'}],
    folder({'x.png': 'old'}),
    [{name: 'x.png', action: 'copy', rename: {from: 'x.png', to: 'x-v2.png'}}, {name: 'x-v1.png', action: 'copy'}],
  ],
  ['an older, different file is renamed first: the extension stays', [{name: 'b.gif', sha256: 'new'}], folder({'b.gif': 'old', 'b-v1.png': 'other'}), [{name: 'b.gif', action: 'copy', rename: {from: 'b.gif', to: 'b-v1.gif'}}]],
  ['an older, different file is renamed first: a name without an extension gets the number at its end', [{name: 'notes', sha256: 'new'}], folder({notes: 'old'}), [{name: 'notes', action: 'copy', rename: {from: 'notes', to: 'notes-v1'}}]],
  ['a link or a folder under the name is renamed like an older file', [{name: 'b.gif', sha256: 'new'}], folder({'b.gif': null}), [{name: 'b.gif', action: 'copy', rename: {from: 'b.gif', to: 'b-v1.gif'}}]],
  ['in a folder that ignores letter case: a number taken in other case is skipped', [{name: 'cover.png', sha256: 'new'}], folder({'cover.png': 'old', 'Cover-v1.png': 'unrelated'}), [{name: 'cover.png', action: 'copy', rename: {from: 'cover.png', to: 'cover-v2.png'}}]],
  ['in a folder that ignores letter case: a different file under the name in other case is renamed', [{name: 'cover.png', sha256: 'new'}], folder({'Cover.png': 'old'}), [{name: 'cover.png', action: 'copy', rename: {from: 'Cover.png', to: 'Cover-v1.png'}}]],
  ['in a folder that ignores letter case: the same file under the name in other case is left as it is', [{name: 'cover.png', sha256: 'same'}], folder({'Cover.png': 'same'}), [{name: 'cover.png', action: 'keep'}]],
  ['in a case-sensitive folder: a file whose name differs in letter case is another file', [{name: 'cover.png', sha256: 'new'}], folder({'Cover.png': 'old'}, false), [{name: 'cover.png', action: 'copy'}]],
  ['in a case-sensitive folder: a number taken only in other case is free', [{name: 'cover.png', sha256: 'new'}], folder({'cover.png': 'old', 'Cover-v1.png': 'other'}, false), [{name: 'cover.png', action: 'copy', rename: {from: 'cover.png', to: 'cover-v1.png'}}]],
]) {
  test(what, () => {
    assert.deepEqual(planCopy(figures, before), plan);
  });
}

// A folder in memory, name to content: rename moves an entry, and copy adds the figure unless the name is taken or the
// copy is made to fail.
function memoryFolder(entries, failing = []) {
  const files = new Map(Object.entries(entries));
  return {
    files,
    ops: {
      rename: (from, to) => {
        files.set(to, files.get(from));
        files.delete(from);
      },
      copy: (name) => {
        if (files.has(name)) throw new Error(`EEXIST ${name}`);
        if (failing.includes(name)) throw new Error(`ENOSPC ${name}`);
        files.set(name, `new ${name}`);
      },
    },
  };
}
const PLAN = [
  {name: 'a.png', action: 'copy', rename: {from: 'a.png', to: 'a-v1.png'}},
  {name: 'b.png', action: 'keep'},
  {name: 'c.png', action: 'copy'},
];

test('a plan is carried out: older files are kept under their new names and the figures copied in', () => {
  const f = memoryFolder({'a.png': 'old a', 'b.png': 'same b'});
  applyPlan(PLAN, f.ops);
  assert.deepEqual(Object.fromEntries(f.files), {'a-v1.png': 'old a', 'a.png': 'new a.png', 'b.png': 'same b', 'c.png': 'new c.png'});
});

// Each case: the figure whose copy fails, and what the folder holds after the error.
for (const [what, failing, after] of [
  ['the older file it was renamed from goes back under its name', 'a.png', {'a.png': 'old a', 'b.png': 'same b'}],
  ['the figures copied before it stay', 'c.png', {'a-v1.png': 'old a', 'a.png': 'new a.png', 'b.png': 'same b'}],
]) {
  test(`a copy that fails stops the plan, and ${what}`, () => {
    const f = memoryFolder({'a.png': 'old a', 'b.png': 'same b'}, [failing]);
    assert.throws(() => applyPlan(PLAN, f.ops), new RegExp(`ENOSPC ${failing}`));
    assert.deepEqual(Object.fromEntries(f.files), after);
  });
}

const ROWS = [
  {section: '§1 起因', alt: '旧的 a'},
  {section: '§2 经过', alt: '不变的 b'},
  {section: '§3 结果', alt: '新的 c'},
];

// Each case: the names whose copy succeeded, and the report.
for (const [what, copied, report] of [
  [
    'every copy succeeded',
    ['a.png', 'c.png'],
    [
      'Copied into /article/assets/images:',
      'a.png (copied)',
      '  Section: §1 起因',
      '  Alt text: 旧的 a',
      'b.png (already there, the same file)',
      '  Section: §2 经过',
      '  Alt text: 不变的 b',
      'c.png (copied)',
      '  Section: §3 结果',
      '  Alt text: 新的 c',
      'Renamed to keep the older file:',
      '  a.png -> a-v1.png',
    ],
  ],
  [
    'a copy that failed after an earlier one renamed an older file still lists that rename',
    ['a.png'],
    [
      'Copied into /article/assets/images:',
      'a.png (copied)',
      '  Section: §1 起因',
      '  Alt text: 旧的 a',
      'b.png (already there, the same file)',
      '  Section: §2 经过',
      '  Alt text: 不变的 b',
      'c.png (not copied)',
      '  Section: §3 结果',
      '  Alt text: 新的 c',
      'Renamed to keep the older file:',
      '  a.png -> a-v1.png',
    ],
  ],
  [
    'a copy that failed after its own rename lists no rename, since the older file has its name back',
    [],
    [
      'Copied into /article/assets/images:',
      'a.png (not copied)',
      '  Section: §1 起因',
      '  Alt text: 旧的 a',
      'b.png (already there, the same file)',
      '  Section: §2 经过',
      '  Alt text: 不变的 b',
      'c.png (not copied)',
      '  Section: §3 结果',
      '  Alt text: 新的 c',
    ],
  ],
]) {
  test(`what deliver reports: ${what}`, () => {
    assert.deepEqual(copyReport(PLAN, ROWS, '/article/assets/images', new Set(copied)), report);
  });
}
