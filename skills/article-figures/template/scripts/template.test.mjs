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

test('src and scripts, apart from src/data, are what the template gave this project', () => {
  const recorded = fs.readFileSync('template-sums.txt', 'utf8').trim().split('\n').map((line) => {
    const [hash, file] = line.split(/\s+/);
    return `${file} ${hash}`;
  });
  const now = [...walk('src'), ...walk('scripts')]
    .filter((f) => !f.startsWith('src/data/') && !f.includes('__pycache__'))
    .map((f) => `${f} ${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}`);
  assert.deepEqual(now.sort(), recorded.sort());
});
