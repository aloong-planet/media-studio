// The layout stays as the template gave it to this project. A change the owner agreed to updates template-sums.txt with it.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

const walk = (dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

// Finder writes .DS_Store into any folder it shows, here or in the template the project came from.
const FINDER = (f) => path.basename(f) === '.DS_Store';

test('src and scripts, apart from src/data, are what the template gave this project', () => {
  const recorded = fs.readFileSync('template-sums.txt', 'utf8').trim().split('\n').flatMap((line) => {
    const [hash, file] = line.split(/\s+/);
    return FINDER(file) ? [] : [`${file} ${hash}`];
  });
  const now = [...walk('src'), ...walk('scripts')]
    .filter((f) => !f.startsWith('src/data/') && !f.includes('__pycache__') && !FINDER(f))
    .map((f) => `${f} ${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}`);
  assert.deepEqual(now.sort(), recorded.sort());
});
