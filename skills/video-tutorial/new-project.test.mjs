// Run from this folder: node --test new-project.test.mjs. The template and node are real; pnpm is a stub, so nothing is installed.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const scriptFile = 'src/data/script.json';

function setUp() {
  const root = mkdtempSync(join(tmpdir(), 'vt-new-project-'));
  const skill = join(root, 'skill');
  const home = join(root, 'home');
  const voices = join(home, '.video-tutorial/voices');
  const bin = join(root, 'bin');
  const installSkill = () => {
    mkdirSync(skill);
    copyFileSync(join(here, 'new-project.sh'), join(skill, 'new-project.sh'));
    cpSync(join(here, 'template'), join(skill, 'template'), {recursive: true, filter: (path) => !path.includes('node_modules')});
  };
  installSkill();
  mkdirSync(voices, {recursive: true});
  mkdirSync(bin);
  writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'pnpm'), 0o755);
  return {
    root,
    skill,
    voices,
    target: join(root, 'video'),
    addVoice(name, bytes, words) {
      writeFileSync(join(voices, `${name}.wav`), bytes);
      writeFileSync(join(voices, `${name}.txt`), words);
    },
    // What `skills update` does: empties the skill folder, then copies the new version in.
    updateSkill() {
      rmSync(skill, {recursive: true});
      installSkill();
    },
    run: (...args) => spawnSync('/bin/sh', [join(skill, 'new-project.sh'), ...args], {
      env: {HOME: home, PATH: `${bin}:${process.env.PATH}`},
      encoding: 'utf8',
    }),
    cleanup: () => rmSync(root, {recursive: true, force: true}),
  };
}

test('the chosen voice is copied into the project and written into the script', () => {
  const m = setUp();
  m.addVoice('mine', 'mine-audio', '这是我的声音。\n');
  m.addVoice('other', 'other-audio', '这是另一个声音。\n');
  const result = m.run(m.target, 'mine');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(m.target, 'voices/mine.wav'), 'utf8'), 'mine-audio');
  assert.deepEqual(readdirSync(join(m.target, 'voices')), ['mine.wav']);
  const {voice} = JSON.parse(readFileSync(join(m.target, scriptFile), 'utf8'));
  assert.equal(voice.ref, 'voices/mine.wav');
  assert.equal(voice.refText, '这是我的声音。');
  m.cleanup();
});

test('a voice outlives an update of the skill', () => {
  const m = setUp();
  m.addVoice('mine', 'mine-audio', '这是我的声音。\n');
  m.updateSkill();
  const result = m.run(m.target, 'mine');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(m.target, 'voices/mine.wav'), 'utf8'), 'mine-audio');
  m.cleanup();
});

test('words with quotes, backslashes and dollar signs stay exactly as they were', () => {
  const m = setUp();
  const words = '他说"走 $& 路"，\\n 不是 $1。';
  m.addVoice('mine', 'audio', `${words}\n`);
  assert.equal(m.run(m.target, 'mine').status, 0);
  assert.equal(JSON.parse(readFileSync(join(m.target, scriptFile), 'utf8')).voice.refText, words);
  m.cleanup();
});

test('only the two voice lines of the script change', () => {
  const m = setUp();
  m.addVoice('mine', 'audio', '这是我的声音。\n');
  m.run(m.target, 'mine');
  const before = readFileSync(join(here, 'template', scriptFile), 'utf8').split('\n');
  const after = readFileSync(join(m.target, scriptFile), 'utf8').split('\n');
  assert.equal(after.length, before.length);
  const changed = before.flatMap((line, i) => (line === after[i] ? [] : [line.trim().split(':')[0]]));
  assert.deepEqual(changed, ['"ref"', '"refText"']);
  m.cleanup();
});

test('an unknown voice stops before anything is written, and names the voices there are', () => {
  const m = setUp();
  m.addVoice('mine', 'audio', '这是我的声音。\n');
  m.addVoice('other', 'audio', '这是另一个声音。\n');
  const result = m.run(m.target, 'nobody');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No voice named nobody\. Voices on this machine: mine other/);
  assert.match(result.stderr, /Voices are kept in .*\/home\/\.video-tutorial\/voices\. Add one with add_voice\.py/);
  assert.equal(existsSync(m.target), false);
  m.cleanup();
});

test('a machine with no voices at all is told how to add one', () => {
  const m = setUp();
  rmSync(dirname(m.voices), {recursive: true});
  const result = m.run(m.target, 'mine');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No voice named mine/);
  assert.match(result.stderr, /Voices are kept in .*\/home\/\.video-tutorial\/voices\. Add one with add_voice\.py/);
  assert.equal(existsSync(m.target), false);
  m.cleanup();
});

test('a voice with no words is not a voice', () => {
  const m = setUp();
  writeFileSync(join(m.voices, 'mine.wav'), 'audio');
  const result = m.run(m.target, 'mine');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No voice named mine/);
  assert.equal(existsSync(m.target), false);
  m.cleanup();
});

test('leaving out the voice stops with the usage', () => {
  const m = setUp();
  m.addVoice('mine', 'audio', '这是我的声音。\n');
  const result = m.run(m.target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: new-project\.sh <new or empty directory> <voice name>/);
  assert.equal(existsSync(m.target), false);
  m.cleanup();
});

test('a directory that is not empty is refused and left alone', () => {
  const m = setUp();
  m.addVoice('mine', 'audio', '这是我的声音。\n');
  mkdirSync(m.target);
  writeFileSync(join(m.target, 'keep.txt'), 'keep');
  const result = m.run(m.target, 'mine');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not empty/);
  assert.deepEqual(readdirSync(m.target), ['keep.txt']);
  m.cleanup();
});

// Each case gives a change to the project and the exit code the template comparison must give. Finder writes .DS_Store
// into any folder it shows, here or in the skill's own template.
for (const [what, change, status] of [
  ['a .DS_Store in src passes', (m) => writeFileSync(join(m.target, 'src/.DS_Store'), 'Finder'), 0],
  ['a .DS_Store the template brought passes', null, 0],
  ['an edited source fails', (m) => writeFileSync(join(m.target, 'src/theme.ts'), `${readFileSync(join(m.target, 'src/theme.ts'), 'utf8')}// edited\n`), 1],
]) {
  test(`pnpm check compares src and scripts with the template: ${what}`, () => {
    const m = setUp();
    m.addVoice('mine', 'audio', '这是我的声音。\n');
    if (!change) writeFileSync(join(m.skill, 'template/scripts/.DS_Store'), 'Finder');
    assert.equal(m.run(m.target, 'mine').status, 0);
    change?.(m);
    // Run the template comparison without NODE_TEST_CONTEXT, which would make the inner run report to this one and exit 0 whatever it found.
    const {NODE_TEST_CONTEXT, ...env} = process.env;
    const result = spawnSync(process.execPath, ['--test', 'scripts/template.test.mjs'], {cwd: m.target, env, encoding: 'utf8'});
    assert.equal(result.status, status, result.stdout);
    m.cleanup();
  });
}

test('pnpm fonts sends Google Fonts each character once, in code order, never in the order of the text', () => {
  const m = setUp();
  m.addVoice('mine', 'audio', '这是我的声音。\n');
  assert.equal(m.run(m.target, 'mine').status, 0);
  // Characters no other source holds, out of code order (U+9F9F, U+5154, U+8D5B): the video draws them, so each must be sent.
  const text = '龟兔赛';
  writeFileSync(join(m.target, 'src/data/note.ts'), `export const NOTE = '${text}';\n`);
  // Replace fetch: write down each request's text parameter and answer with a tiny font.
  const sentFile = join(m.root, 'sent.txt');
  const stub = join(m.root, 'fetch-stub.mjs');
  writeFileSync(
    stub,
    `import fs from 'node:fs';
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.hostname !== 'fonts.googleapis.com') return {arrayBuffer: async () => new ArrayBuffer(4)};
  fs.appendFileSync(${JSON.stringify(sentFile)}, JSON.stringify(u.searchParams.get('text')) + '\\n');
  return {text: async () => 'src: url(https://fonts.gstatic.com/s/x.woff2)'};
};
`,
  );
  const result = spawnSync(process.execPath, ['--import', stub, 'scripts/fonts.mjs'], {cwd: m.target, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const sent = readFileSync(sentFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(sent.length, 10); // Expect one request per face and weight: three each of Noto Sans SC, IBM Plex Sans and IBM Plex Mono, one of Noto Serif SC.
  for (const chars of sent) {
    assert.deepEqual([...text].filter((c) => !chars.includes(c)), [], chars);
    assert.ok([...chars].every((c, i, all) => i === 0 || all[i - 1].codePointAt(0) < c.codePointAt(0)), chars);
  }
  m.cleanup();
});
