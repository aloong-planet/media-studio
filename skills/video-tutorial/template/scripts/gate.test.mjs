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

test('the finished mp4 runs as long as the timeline, even when that lands on a tenth of a second', () => {
  // 129 frames at 30 per second is 4.3 s. Remotion is a stand-in; ffmpeg and render.mjs are real.
  const script = '{"meta":{"slug":"t"}}';
  write('src/data/script.json', script);
  write('src/data/timeline.json', JSON.stringify({script: crypto.createHash('sha256').update(script).digest('hex'), totalFrames: 129, fps: 30}));
  approve(root);
  write('bin/pnpm', '#!/bin/sh\nexec ffmpeg -v error -y -f lavfi -i color=c=white:s=64x64:r=30:d=4.3 -f lavfi -i sine=frequency=220:duration=4.307 -c:v libx264 -c:a aac out/raw.mp4\n');
  fs.chmodSync(path.join(root, 'bin/pnpm'), 0o755);
  const render = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render.mjs');
  const run = spawnSync(process.execPath, [render], {cwd: root, encoding: 'utf8', env: {...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`}});
  assert.equal(run.status, 0, run.stderr);
  const stream = (kind, field) => Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', kind, '-show_entries', `stream=${field}`, '-of', 'csv=p=0', path.join(root, 'out/t.mp4')], {encoding: 'utf8'}));
  assert.equal(stream('v', 'nb_frames'), 129);
  assert.ok(Math.abs(stream('a', 'duration') - 4.3) < 0.03, `audio runs ${stream('a', 'duration')} s, video 4.3 s`);
});

test('pnpm approve records the video in the current directory', () => {
  const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate.mjs');
  execFileSync(process.execPath, [gate], {cwd: root});
  assert.equal(refusal(root), null);
});
