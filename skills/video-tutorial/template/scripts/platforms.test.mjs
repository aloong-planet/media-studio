import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FRAMES, coversFor, fitTitle, placementProblems} from '../src/ui/platforms.ts';

// video-tutorial::REQ-001/AC-01: the table of covers, as the spec gives it: file, drawn size, saved size.
const TABLE = [
  ['wechat-channels', [['wechat-channels-3x4', '1080×1440', '1080×1440'], ['wechat-channels-4x3', '1440×1080', '1440×1080']]],
  ['youtube', [['youtube-16x9', '1920×1080', '3840×2160']]],
  ['douyin', [['douyin-9x16', '1080×1920', '1080×1920']]],
  ['xiaohongshu', [['xiaohongshu-3x4', '1080×1440', '1080×1440']]],
];
const sizes = (c) => {
  const {width, height} = FRAMES[c.ratio];
  return [c.file, `${width}×${height}`, `${width * c.scale}×${height * c.scale}`];
};

for (const [platform, covers] of TABLE) {
  test(`${platform} gets its covers at the sizes the table gives`, () => {
    assert.deepEqual(coversFor([platform]).map(sizes), covers);
  });
}

test('only the platforms named get covers, each once', () => {
  assert.deepEqual(
    coversFor(['douyin', 'youtube', 'douyin']).map((c) => c.file),
    ['douyin-9x16', 'youtube-16x9'],
  );
});

// video-tutorial::REQ-002/AC-01. Each case gives the title's width as a function of its size, with the room 984.
const FITS = [
  ['a title that fits keeps the largest size', (s) => 15 * s, 56],
  ['a longer title takes the largest half-pixel step that fits', (s) => 20 * s, 49],
  ['a guess from the width at the largest size that is too big is stepped down', (s) => 10 * s + 500, 48],
  ['a guess from the width at the largest size that is too small is stepped up', (s) => 40 * s - 1200, 54.5],
];
for (const [what, widthAt, size] of FITS) {
  test(`title: ${what}`, () => {
    assert.equal(fitTitle(56, 984, widthAt), size);
  });
}

// video-tutorial::QR-001/AC-02 and AC-03. Rects are in the drawing's pixels: x, y, width, height.
const wechat = coversFor(['wechat-channels'])[0]; // 3:4, the area from 214 to 1392
const douyin = coversFor(['douyin'])[0]; // 9:16, the area from 392 to 1540; the app covers the top 220 and bottom 380
const item = (what, x, y, w, h, inArea = true) => ({what, rect: {x, y, w, h}, inArea});

test('the main visual may fill its area to the edges', () => {
  assert.deepEqual(placementProblems(wechat, [item('card', 48, 214, 984, 1178)]), []);
});

test('the main visual must not leave its area on any side', () => {
  assert.deepEqual(
    placementProblems(wechat, [item('below', 48, 1300, 984, 93), item('right', 100, 300, 933, 50), item('left', 47, 300, 10, 50), item('above', 48, 213, 10, 50)]),
    ["outside the main visual's area: below", "outside the main visual's area: right", "outside the main visual's area: left", "outside the main visual's area: above"],
  );
});

test('the title and subtitle are not held to the area', () => {
  assert.deepEqual(placementProblems(wechat, [item('title', 48, 56, 900, 67, false)]), []);
});

test("nothing on the Douyin cover may lie under the app's bars, but it may touch them", () => {
  assert.deepEqual(
    placementProblems(douyin, [item('title', 48, 219, 900, 67, false), item('footer', 48, 1530, 300, 20, false), item('touching', 48, 220, 10, 1320, false)]),
    ["under the app's top 220 px: title", "under the app's bottom 380 px: footer"],
  );
});

test('other covers have no bars', () => {
  assert.deepEqual(placementProblems(wechat, [item('title', 48, 0, 900, 67, false)]), []);
});
