import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contrast, gradientStops} from '../src/check/colour.ts';

// video-tutorial::QR-001/AC-01: the ends of a gradient are read from the browser's computed background-image.
test('a gradient gives every colour it passes through, in order', () => {
  assert.deepEqual(gradientStops('linear-gradient(100deg, rgb(23, 74, 151), rgb(106, 63, 201))'), [
    [23, 74, 151],
    [106, 63, 201],
  ]);
  assert.deepEqual(gradientStops('linear-gradient(90deg, rgb(1, 2, 3) 0%, rgba(4, 5, 6, 0.5) 50%, rgb(7, 8, 9) 100%)'), [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test('no gradient gives no colours', () => {
  assert.deepEqual(gradientStops('none'), []);
});

// WCAG's own figures: black on white is 21, and #767676 is the lightest grey that keeps 4.5 on white.
test('contrast is the WCAG ratio', () => {
  assert.equal(contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrast([118, 118, 118], [255, 255, 255]).toFixed(2), '4.54');
});
