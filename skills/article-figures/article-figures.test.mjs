// Run from this folder: node --test article-figures.test.mjs.
// new-project.sh, the template's deliver script and node are real; pnpm is a stub, so nothing is installed.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// What a working copy of the template may hold besides its sources; none of it is part of the skill.
const NOT_SHIPPED = /\/(node_modules|out|public|\.cache)(\/|$)/;

function setUp() {
  // The real path: on macOS the temporary folder is reached through a link, and the deliver script reports real paths.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'af-')));
  const skill = join(root, 'skill');
  mkdirSync(skill);
  copyFileSync(join(here, 'new-project.sh'), join(skill, 'new-project.sh'));
  cpSync(join(here, 'template'), join(skill, 'template'), {recursive: true, filter: (p) => !NOT_SHIPPED.test(p)});
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'pnpm'), 0o755);
  const repo = join(root, 'repo');
  const article = join(repo, 'posts/my-article');
  mkdirSync(article, {recursive: true});
  writeFileSync(join(article, 'source.md'), '# My article\n');
  spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', repo]);
  const env = {HOME: join(root, 'home'), PATH: `${bin}:${process.env.PATH}`};
  return {
    repo,
    article,
    project: join(article, 'assets/sources/figures'),
    images: join(article, 'assets/images'),
    newProject: (file = join(article, 'source.md')) => spawnSync('/bin/sh', [join(skill, 'new-project.sh'), file], {env, encoding: 'utf8'}),
    cleanup: () => rmSync(root, {recursive: true, force: true}),
  };
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    : [];
// Every file under a directory with its content and modification time, to show that nothing there was touched.
const snapshot = (dir) => Object.fromEntries(walk(dir).map((f) => [relative(dir, f), `${readFileSync(f, 'base64')} ${statSync(f).mtimeMs}`]));
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

test('the project is made beside the article, and what it installs or renders stays out of git', () => {
  const m = setUp();
  const result = m.newProject();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(m.project, 'package.json')));
  for (const f of ['node_modules/remotion/index.js', 'out/a.png', 'public/fonts/ibm-plex-sans-400.woff2', '.cache/x.json']) {
    mkdirSync(dirname(join(m.project, f)), {recursive: true});
    writeFileSync(join(m.project, f), 'x');
  }
  const listed = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: m.repo, encoding: 'utf8'}).stdout;
  assert.match(listed, /posts\/my-article\/assets\/sources\/figures\/package\.json/);
  assert.match(listed, /posts\/my-article\/assets\/sources\/figures\/figures\.md/);
  assert.doesNotMatch(listed, /node_modules|\/out\/|\/public\/|\.cache/);
  m.cleanup();
});

test('a folder that holds something else is left alone', () => {
  const m = setUp();
  mkdirSync(m.project, {recursive: true});
  writeFileSync(join(m.project, 'keep.txt'), 'keep');
  const result = m.newProject();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not empty and holds no figures project/);
  assert.deepEqual(readdirSync(m.project), ['keep.txt']);
  m.cleanup();
});

test('a folder that already holds a figures project is worked in, not written over', () => {
  const m = setUp();
  assert.equal(m.newProject().status, 0);
  writeFileSync(join(m.project, 'figures.md'), 'the agreed list');
  const before = snapshot(m.project);
  const result = m.newProject();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already holds a figures project.*work in it/s);
  assert.deepEqual(snapshot(m.project), before);
  m.cleanup();
});

test('a Markdown file that does not exist makes no project', () => {
  const m = setUp();
  const result = m.newProject(join(m.article, 'missing.md'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No such article/);
  assert.equal(existsSync(join(m.article, 'assets')), false);
  m.cleanup();
});

// A project that rendered cover.png, a.png and b.gif, and an article that already has two of those names.
function rendered() {
  const m = setUp();
  assert.equal(m.newProject().status, 0);
  writeFileSync(
    join(m.project, 'figures.md'),
    [
      '# Figure list',
      '',
      '| File | Section | Kind | Title | Shows | Alt text |',
      '|---|---|---|---|---|---|',
      '| `cover.png` | Cover | cover | Sessions that run themselves | Subtitle: one session hands out the work | 封面：调度会话给工人会话派活 |',
      '| `a.png` | §2 派活不用人，其余动作都得人来 | still | Human in the loop | Who does each step | 每一步由谁来做 |',
      '| `b.gif` | §5 最难的一环是压缩自己，然后接着干 | gif | Compact, then wake | The compaction steps in order | 会话压缩自己再被唤醒的过程 |',
      '',
    ].join('\n'),
  );
  const out = {'cover.png': 'new cover', 'a.png': 'same a', 'b.gif': 'gif b'};
  mkdirSync(join(m.project, 'out'));
  for (const [name, content] of Object.entries(out)) writeFileSync(join(m.project, 'out', name), content);
  writeFileSync(join(m.project, 'out/manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(out).map(([n, c]) => [n, sha256(c)]))));
  mkdirSync(m.images, {recursive: true});
  writeFileSync(join(m.images, 'cover.png'), 'old cover');
  writeFileSync(join(m.images, 'a.png'), 'same a');
  return {
    ...m,
    deliver: () => spawnSync(process.execPath, ['scripts/deliver.mjs'], {cwd: m.project, encoding: 'utf8'}),
  };
}

test('approved files go into the article, older files under the same name are kept, and each is reported with its section and alt text', () => {
  const m = rendered();
  const aBefore = statSync(join(m.images, 'a.png')).mtimeMs;
  const result = m.deliver();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(m.images, 'cover-v1.png'), 'utf8'), 'old cover');
  assert.equal(readFileSync(join(m.images, 'cover.png'), 'utf8'), 'new cover');
  assert.equal(readFileSync(join(m.images, 'a.png'), 'utf8'), 'same a');
  assert.equal(statSync(join(m.images, 'a.png')).mtimeMs, aBefore);
  assert.equal(readFileSync(join(m.images, 'b.gif'), 'utf8'), 'gif b');
  assert.deepEqual(readdirSync(m.images).sort(), ['a.png', 'b.gif', 'cover-v1.png', 'cover.png']);
  assert.equal(
    result.stdout,
    [
      `Copied into ${m.images}:`,
      'cover.png (copied)',
      '  Section: Cover',
      '  Alt text: 封面：调度会话给工人会话派活',
      'a.png (already there, the same file)',
      '  Section: §2 派活不用人，其余动作都得人来',
      '  Alt text: 每一步由谁来做',
      'b.gif (copied)',
      '  Section: §5 最难的一环是压缩自己，然后接着干',
      '  Alt text: 会话压缩自己再被唤醒的过程',
      'Renamed to keep the older file:',
      '  cover.png -> cover-v1.png',
      '',
    ].join('\n'),
  );
  m.cleanup();
});

test('nothing is copied without a passed render, or when a rendered file changed after it', () => {
  for (const spoil of [
    (m) => rmSync(join(m.project, 'out/manifest.json')),
    (m) => writeFileSync(join(m.project, 'out/a.png'), 'edited after the render'),
    (m) => writeFileSync(join(m.project, 'figures.md'), readFileSync(join(m.project, 'figures.md'), 'utf8').replace(/^\| `b\.gif`.*\n/m, '')),
  ]) {
    const m = rendered();
    spoil(m);
    const before = snapshot(m.images);
    const result = m.deliver();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm render/);
    assert.deepEqual(snapshot(m.images), before);
    m.cleanup();
  }
});
