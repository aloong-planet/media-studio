// The fixtures are real Remotion output: the sample's request-path still and cache-miss GIF, rendered at 0.05 times.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {gifInfo, outputProblems, pngInfo} from './lib/output.mjs';

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
    ],
    [[], [], []],
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
