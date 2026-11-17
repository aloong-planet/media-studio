import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dotFrames, gifStateAt, gifTiming, measureFrames} from '../src/timeline.ts';

const STEPS = [
  {n: ['a', 'b'], e: ['ab'], at: [0, 0]},
  {n: ['c'], e: ['bc'], at: [0, 0]},
  {n: ['d'], e: ['cd', 'bd'], at: [0, 0]},
];
// At 15 frames a second: 1.6 s is 24 frames a step, 2 s is a 30-frame hold, so three steps make 102 frames.
const TIMING = gifTiming(3, 15);

// Each case: the steps, frame rate, seconds a step and seconds of hold, and the timing.
for (const [what, args, expected] of [
  ['at 15 frames a second', [3, 15], {fps: 15, stepFrames: 24, holdFrames: 30, fadeFrames: 5, total: 102}],
  // A lower frame rate keeps the seconds: 1.6 s is 16 frames at 10 a second.
  ['at 10 frames a second', [3, 10], {fps: 10, stepFrames: 16, holdFrames: 20, fadeFrames: 3, total: 68}],
  // A shorter pass: 1.2 s is 18 frames and 1.4 s is 21 at 15 a second.
  ['with shorter steps and hold', [3, 15, 1.2, 1.4], {fps: 15, stepFrames: 18, holdFrames: 21, fadeFrames: 5, total: 75}],
  // Five steps of 2 s and a 2 s hold are 180 frames, 12.0 s: at the limit, not over it.
  ['of exactly 12 seconds', [5, 15, 2, 2], {fps: 15, stepFrames: 30, holdFrames: 30, fadeFrames: 5, total: 180}],
]) {
  test(`a pass is its steps and then the hold: ${what}`, () => {
    assert.deepEqual(gifTiming(...args), expected);
  });
}

for (const [what, args, error] of [
  ['a pass over 12 seconds', [7, 15], /7 steps make a 13\.2 s pass, over 12 s/],
  // 0.3 s is 5 frames: without the 2 before the dot sets off and the last one, 2 are left, which fit 1.3 times
  // a travel of 1 frame only, and a dot needs at least 2.
  // At 10 frames a second 0.5 s is 5 frames: the light settles in 3, but without the 2 before the dot sets off and the
  // last one, 2 are left, which fit 1.3 times a travel of 1 frame only, and a dot needs at least 2.
  ['a step too short for its dot', [3, 10, 0.5], /a step of 0\.5 s is too short/],
  // At 30 frames a second 0.3 s is 9 frames, room enough for the dot, but the light takes 10 frames to come on.
  ['a step too short for its light to settle', [3, 30, 0.3], /a step of 0\.3 s is too short/],
  // The hold is measured on its last frame, which has to come after the 5 frames the last lines take to light up.
  ['no hold', [3, 15, 1.6, 0], /a hold of 0 s is too short/],
  ['a hold too short to light the whole diagram', [3, 15, 1.6, 0.2], /a hold of 0\.2 s is too short/],
]) {
  test(`a timing the article cannot use is refused: ${what}`, () => {
    assert.throws(() => gifTiming(...args), error);
  });
}

// Each case: the route's length, the timing, and the frames the dot travels. At 15 frames a second a 448-unit route
// would take 1 s, 15 frames, and a 45-unit one the shortest travel, 0.45 s, 7 frames. A 1.0 s step is 15 frames: the
// dot sets off after 2 and must be gone, 1.3 times its travel later, by frame 14, which allows 9 frames of travel.
for (const [what, length, timing, frames] of [
  ['a long route in a 1.6 s step', 448, gifTiming(3, 15), 15],
  ['a short route in a 1.6 s step', 45, gifTiming(3, 15), 7],
  ['a long route in a 1.0 s step, sped up to reach the end', 448, gifTiming(3, 15, 1.0), 9],
]) {
  test(`a dot travels its whole route within its step: ${what}`, () => {
    assert.equal(dotFrames(length, timing), frames);
  });
}

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
