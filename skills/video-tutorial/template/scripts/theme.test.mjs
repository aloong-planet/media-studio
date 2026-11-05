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
