// What pnpm stills reports, without a browser.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {problemList} from './problems.mjs';

test('a problem in the diagram is reported once, with the still it was first seen in', () => {
  const list = problemList();
  list.add('text leaves the frame: 网关', {output: 'out/stills/tour-1.png'});
  list.add('text leaves the frame: 网关', {output: 'out/stills/tour-2.png'});
  assert.deepEqual(list.lines(), ['out/stills/tour-1.png: text leaves the frame: 网关']);
});

// video-tutorial::QR-001
test('a problem on several covers is reported for each cover', () => {
  const list = problemList();
  list.add("outside the main visual's area: card 「两种情况」", {output: 'out/wechat-channels-4x3.png', cover: true});
  list.add("outside the main visual's area: card 「两种情况」", {output: 'out/youtube-16x9.png', cover: true});
  assert.deepEqual(list.lines(), [
    "out/wechat-channels-4x3.png: outside the main visual's area: card 「两种情况」",
    "out/youtube-16x9.png: outside the main visual's area: card 「两种情况」",
  ]);
});
