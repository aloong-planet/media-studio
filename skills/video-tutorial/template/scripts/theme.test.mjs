import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

const walk = (dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

test('every colour value lives in theme.ts', () => {
  const stray = walk('src')
    .filter((f) => /\.tsx?$/.test(f) && path.basename(f) !== 'theme.ts')
    .flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/g)].map((m) => `${f}: ${m[0]}`));
  assert.deepEqual(stray, []);
});

test('there is no dark look', () => {
  assert.doesNotMatch(fs.readFileSync('src/theme.ts', 'utf8'), /\bdark\b.*[:=]/);
  assert.deepEqual(walk('src').filter((f) => fs.readFileSync(f, 'utf8').includes('prefers-color-scheme')), []);
});

// video-tutorial::QR-001/AC-01, ahead of any render: the cover blocks draw gradient text on a hue's fill or on the panel.
test('both ends of every gradient keep 4.5 contrast on its hue’s fill and on the panel', async () => {
  const {C, GRADIENTS, HUES} = await import('../src/theme.ts');
  const {contrast} = await import('../src/check/colour.ts');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.deepEqual(Object.keys(GRADIENTS).sort(), ['amber', 'blue', 'green', 'pink', 'teal', 'violet']);
  const low = Object.entries(GRADIENTS).flatMap(([hue, ends]) =>
    ends.flatMap((end) => [HUES[hue].fill, C.panel].filter((under) => contrast(rgb(end), rgb(under)) < 4.5).map((under) => `${hue} ${end} on ${under}`)),
  );
  assert.deepEqual(low, []);
});
