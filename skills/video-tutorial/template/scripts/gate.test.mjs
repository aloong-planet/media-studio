import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {approve, refusal, staleTimeline} from './gate.mjs';

let root;
const write = (rel, body) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
  fs.writeFileSync(path.join(root, rel), body);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  write('src/data/script.json', '{"a":1}');
  write('src/data/timeline.json', JSON.stringify({script: crypto.createHash('sha256').update('{"a":1}').digest('hex')}));
  write('public/audio/title.wav', 'voice');
});
afterEach(() => fs.rmSync(root, {recursive: true}));

test('a video nobody confirmed is refused', () => {
  assert.match(refusal(root), /No final confirmation/);
});

test('the confirmed video may be rendered', () => {
  approve(root);
  assert.equal(refusal(root), null);
});

for (const [what, rel, body] of [
  ['changed text', 'src/data/script.json', '{"a":2}'],
  ['changed audio', 'public/audio/title.wav', 'other voice'],
  ['a new file', 'public/audio/extra.wav', 'voice'],
]) {
  test(`${what} after the confirmation is refused`, () => {
    approve(root);
    write(rel, body);
    assert.match(refusal(root), /changed after the final confirmation/);
  });
}

test('a deleted file after the confirmation is refused', () => {
  approve(root);
  fs.rmSync(path.join(root, 'public/audio/title.wav'));
  assert.match(refusal(root), /changed after the final confirmation/);
});

test('a timeline built from this script is current', () => {
  assert.equal(staleTimeline(root), null);
});

test('a script edited after its timeline was built is reported', () => {
  write('src/data/script.json', '{"a":2}');
  assert.match(staleTimeline(root), /run pnpm narrate/);
});

test('a project with no timeline yet is reported', () => {
  fs.rmSync(path.join(root, 'src/data/timeline.json'));
  assert.match(staleTimeline(root), /run pnpm narrate/);
});

test('a video confirmed with a stale timeline is still refused', () => {
  write('src/data/script.json', '{"a":2}');
  approve(root);
  assert.match(refusal(root), /run pnpm narrate/);
});

test('files the system drops into a folder do not reopen the gate', () => {
  approve(root);
  write('public/.DS_Store', 'noise');
  assert.equal(refusal(root), null);
});

test('pnpm render stops before rendering when there is no confirmation', () => {
  const render = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render.mjs');
  const run = spawnSync(process.execPath, [render], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No final confirmation/);
  assert.equal(fs.existsSync(path.join(root, 'out')), false);
});

test('pnpm approve records the video in the current directory', () => {
  const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate.mjs');
  execFileSync(process.execPath, [gate], {cwd: root});
  assert.equal(refusal(root), null);
});
