import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pathSegments} from '../src/map/path.ts';

test('turns are followed from the point before', () => {
  assert.deepEqual(pathSegments('M10 20H30V50'), [[[10, 20], [30, 20]], [[30, 20], [30, 50]]]);
});

test('nothing is drawn across a jump to a new start', () => {
  assert.deepEqual(pathSegments('M0 0H10M0 5H10'), [[[0, 0], [10, 0]], [[0, 5], [10, 5]]]);
});

for (const d of ['M0 0h10', 'M0 0C1 1 2 2 3 3', 'M0 0L10 0z']) {
  test(`a path outside M, L, H and V stops the run: ${d}`, () => {
    assert.throws(() => pathSegments(d), /only M, L, H and V/);
  });
}

test('the last piece of a branching line is the one the arrow sits on', () => {
  assert.deepEqual(pathSegments('M150 95H168M168 95V203').at(-1), [[168, 95], [168, 203]]);
});
