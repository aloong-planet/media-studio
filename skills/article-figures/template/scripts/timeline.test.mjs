import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gifStateAt, gifTiming, measureFrames} from '../src/timeline.ts';

const STEPS = [
  {n: ['a', 'b'], e: ['ab'], at: [0, 0]},
  {n: ['c'], e: ['bc'], at: [0, 0]},
  {n: ['d'], e: ['cd', 'bd'], at: [0, 0]},
];
// At 15 frames a second: 1.6 s is 24 frames a step, 2 s is a 30-frame hold, so three steps make 102 frames.
const TIMING = gifTiming(3, 15);

// A lower frame rate keeps the seconds: 1.6 s is 16 frames at 10 a second.
for (const [fps, expected] of [
  [15, {fps: 15, stepFrames: 24, holdFrames: 30, fadeFrames: 5, total: 102}],
  [10, {fps: 10, stepFrames: 16, holdFrames: 20, fadeFrames: 3, total: 68}],
]) {
  test(`a pass is its steps and then the hold, at ${fps} frames a second`, () => {
    assert.deepEqual(gifTiming(3, fps), expected);
  });
}

test('a pass over 12 seconds is refused', () => {
  assert.throws(() => gifTiming(7, 15), /7 steps make a 13\.2 s pass, over 12 s/);
});

// x is in no step: only the hold lights it.
const IDS = ['a', 'b', 'c', 'd', 'x', 'ab', 'bc', 'cd', 'bd'];

// A step lights its own boxes and lines on top of those of the steps before, and the rest stays dimmed; its marker
// is the solid one beside the hollow ones of the steps before. After the last step every box and line is lit and
// every marker is hollow.
for (const [frame, expected] of [
  [0, {step: 0, lit: {a: 0, ab: 0, b: 0}, badges: [[0, true]]}],
  [30, {step: 1, lit: {a: 0, ab: 0, b: 0, bc: 24, c: 24}, badges: [[0, false], [1, true]]}],
  [101, {step: null, lit: {a: 0, ab: 0, b: 0, bc: 24, c: 24, d: 48, cd: 48, bd: 48, x: 72}, badges: [[0, false], [1, false], [2, false]]}],
]) {
  test(`what frame ${frame} lights and marks`, () => {
    const s = gifStateAt(frame, STEPS, TIMING, IDS);
    assert.deepEqual({step: s.step, lit: s.lit, badges: s.badges.map((b) => [b.step, b.now])}, expected);
  });
}

test('each step is measured once it has settled, and the hold on its last frame', () => {
  assert.deepEqual(measureFrames(TIMING, 3), [23, 47, 71, 101]);
});
