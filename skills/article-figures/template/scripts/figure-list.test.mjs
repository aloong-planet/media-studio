import assert from 'node:assert/strict';
import {test} from 'node:test';
import {figureListProblems, parseFigureList} from './lib/figure-list.mjs';

// Shaped like a real list for a Chinese article: Chinese sections and alt text, file names in backticks,
// a section title that holds a slash and parentheses, and an escaped pipe inside a cell.
const LIST = `# Figure list

Agreed on 2026-11-16.

| File | Section | Kind | Title | Shows | Alt text |
|---|---|---|---|---|---|
| \`cover.png\` | Cover | cover | Sessions that run themselves | Subtitle: one session hands out the work and wakes the others | 封面：调度会话给工人会话派活 |
| \`worker-states.png\` | §4 调度会话怎么管工人（状态以 Claude Code 自己的为准） | still | Worker states | idle \\| busy \\| waiting, and what moves a worker between them | 工人会话的几种状态和切换条件 |
| \`compact-wake.gif\` | §5 最难的一环是压缩自己，然后接着干 | gif | Compact, then wake | The compaction steps in order | 会话压缩自己再被唤醒的过程 |
`;

const DRAWN = [
  {id: 'cover', kind: 'cover', title: 'Sessions that run themselves'},
  {id: 'worker-states', kind: 'still', title: 'Worker states'},
  {id: 'compact-wake', kind: 'gif', title: 'Compact, then wake'},
];

test('each row gives the file, its section, kind, title, what it shows and its alt text', () => {
  assert.deepEqual(parseFigureList(LIST)[1], {
    file: 'worker-states.png',
    section: '§4 调度会话怎么管工人（状态以 Claude Code 自己的为准）',
    kind: 'still',
    title: 'Worker states',
    shows: 'idle | busy | waiting, and what moves a worker between them',
    alt: '工人会话的几种状态和切换条件',
  });
});

// Each case: the list, the figures drawn, and the problems.
for (const [what, list, drawn, problems] of [
  ['a list that matches the drawn figures has none', LIST, DRAWN, []],
  ['a listed figure that is not drawn', LIST, DRAWN.slice(0, 2), ['compact-wake.gif is in figures.md but not drawn']],
  ['a drawn figure that is not listed', LIST, [...DRAWN, {id: 'extra', kind: 'still', title: 'Extra'}], ['extra is drawn but not in figures.md']],
  ['a GIF name for a still', LIST, DRAWN.map((f) => (f.id === 'compact-wake' ? {...f, kind: 'still'} : f)), ['compact-wake.gif is listed as gif but drawn as still, which renders compact-wake.png']],
  // A still and a cover are both .png files, so only the kind tells them apart.
  ['a still drawn as a cover', LIST, DRAWN.map((f) => (f.id === 'worker-states' ? {...f, kind: 'cover'} : f)), ['worker-states.png is listed as still but drawn as cover, which renders worker-states.png']],
  ['another title', LIST, DRAWN.map((f) => (f.id === 'worker-states' ? {...f, title: 'States'} : f)), ['worker-states.png is listed as "Worker states" but drawn as "States"']],
  ['a file listed twice', `${LIST}| \`compact-wake.gif\` | §6 收尾 | gif | Compact, then wake | The same steps again | 再看一遍压缩过程 |\n`, DRAWN, ['compact-wake.gif is listed twice']],
  ['a file without the table', '# Figure list\n\nTo be agreed.\n', DRAWN, ['figures.md has no table with the columns File, Section, Kind, Title, Shows and Alt text']],
]) {
  test(`the list and the drawing are compared: ${what}`, () => {
    assert.deepEqual(figureListProblems(parseFigureList(list), drawn), problems);
  });
}
