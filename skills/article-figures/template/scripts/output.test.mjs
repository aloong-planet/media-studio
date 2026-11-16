// The fixtures are real Remotion output: the sample's request-path still and cache-miss GIF, rendered at 0.05 times.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {fileReport, gifInfo, outputProblems, pngInfo, problemLines} from './lib/output.mjs';

const fixture = (name) => fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url));

test('a PNG gives its size', () => {
  // The still is 720 × 500 design units; PIL reads the fixture as 36 × 25.
  assert.deepEqual(pngInfo(fixture('still.png')), {width: 36, height: 25});
});

test('a GIF gives its size, its loop and the length of one pass', () => {
  // The sample GIF: four steps of 24 frames and a 30-frame hold at 15 frames a second, looping forever.
  // PIL reads the fixture as 36 × 24, 126 frames lasting 8400 ms, loop 0.
  assert.deepEqual(gifInfo(fixture('anim.gif')), {width: 36, height: 24, frames: 126, loops: 0, seconds: 8.4});
});

test('a figure the article can use has no problems', () => {
  assert.deepEqual(
    [
      outputProblems({file: 'a.png', kind: 'still', height: 474, fps: 15}, {width: 2160, height: 1422}),
      outputProblems({file: 'c.png', kind: 'cover', height: 820, fps: 15}, {width: 1920, height: 820}),
      outputProblems({file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 126, loops: 0, seconds: 8.4}),
      // 180 frames at 15 a second: a pass of exactly 12 s, the longest allowed.
      outputProblems({file: 'd.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 180, loops: 0, seconds: 12}),
    ],
    [[], [], [], []],
  );
});

for (const [what, figure, info, problem] of [
  ['a still not 2160 wide', {file: 'a.png', kind: 'still', height: 474, fps: 15}, {width: 1080, height: 711}, 'a.png is 1080×711 px, not 2160×1422'],
  ['a cover of another size', {file: 'c.png', kind: 'cover', height: 820, fps: 15}, {width: 1920, height: 1080}, 'c.png is 1920×1080 px, not 1920×820'],
  ['a GIF not 1080 wide', {file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 2160, height: 1422, frames: 126, loops: 0, seconds: 8.4}, 'b.gif is 2160×1422 px, not 1080×711'],
  ['a GIF that plays once', {file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 126, loops: null, seconds: 8.4}, 'b.gif does not loop forever'],
  ['a GIF that loops a few times', {file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 126, loops: 3, seconds: 8.4}, 'b.gif does not loop forever'],
  ['a pass over 12 s', {file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 189, loops: 0, seconds: 12.6}, 'b.gif lasts 12.6 s a pass, over 12 s'],
  ['another frame rate', {file: 'b.gif', kind: 'gif', height: 474, fps: 15}, {width: 1080, height: 711, frames: 84, loops: 0, seconds: 8.4}, 'b.gif plays 10.0 frames a second, not 15'],
]) {
  test(`a file the article cannot use is a problem: ${what}`, () => {
    assert.deepEqual(outputProblems(figure, info), [problem]);
  });
}

// Each case: a rendered file and the lines pnpm render prints for it. Each first line is as a render of the sample
// printed it.
for (const [what, figure, info, bytes, lines] of [
  ['a still gives its size', {file: 'request-path.png', kind: 'still', id: 'request-path', stateCount: 1}, {width: 2160, height: 1500}, 201728, ['out/request-path.png: 2160×1500, 197 KB, measured']],
  [
    'a GIF gives its pass and the still of each state it was measured on',
    {file: 'cache-miss.gif', kind: 'gif', id: 'cache-miss', stateCount: 5},
    {width: 1080, height: 717, frames: 126, loops: 0, seconds: 8.4},
    519168,
    [
      'out/cache-miss.gif: 1080×717, 126 frames, 8.4 s a pass, 507 KB, 4 steps and the hold measured',
      '  out/frames/cache-miss-step-1.png',
      '  out/frames/cache-miss-step-2.png',
      '  out/frames/cache-miss-step-3.png',
      '  out/frames/cache-miss-step-4.png',
      '  out/frames/cache-miss-hold.png',
    ],
  ],
]) {
  test(`what pnpm render prints for a file: ${what}`, () => {
    assert.deepEqual(fileReport(figure, info, bytes), lines);
  });
}

// Each case: the problems in the order pnpm render found them, and the lines it prints for them.
for (const [what, found, lines] of [
  [
    'the same problem in every state of a GIF is listed once, where it was first seen',
    [
      {file: 'b.gif', where: 'out/b.gif step-1', text: 'not English: Cache 缓存'},
      {file: 'b.gif', where: 'out/b.gif step-2', text: 'not English: Cache 缓存'},
      {file: 'b.gif', where: 'out/b.gif hold', text: 'not English: Cache 缓存'},
    ],
    ['out/b.gif step-1: not English: Cache 缓存'],
  ],
  [
    'the same problem in two figures is listed for each',
    [
      {file: 'cover.png', where: 'out/cover.png', text: 'not English: Cache 缓存'},
      {file: 'a.png', where: 'out/a.png', text: 'not English: Cache 缓存'},
      {file: 'b.gif', where: 'out/b.gif step-1', text: 'not English: Cache 缓存'},
    ],
    ['out/cover.png: not English: Cache 缓存', 'out/a.png: not English: Cache 缓存', 'out/b.gif step-1: not English: Cache 缓存'],
  ],
]) {
  test(`the problems pnpm render lists: ${what}`, () => {
    assert.deepEqual(problemLines(found), lines);
  });
}
