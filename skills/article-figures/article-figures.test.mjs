// Run from this folder: node --test article-figures.test.mjs.
// new-project.sh, the template's deliver and fonts scripts and node are real; pnpm is a stub, so nothing is installed,
// in the fonts test fetch is a stub, so nothing is sent, and in one deliver test the file system's copy fails on purpose.
//
// Not tested, here or in template/scripts, and how each is checked instead:
// - What runs in a rendered page needs a browser render, which no test starts: the diagram-design measurements and the
//   not-English check in src/check/Measure.tsx (QR-001/AC-01, CON-001, REQ-003/AC-04, AC-06), the dimming, the dot and
//   the outlines drawn past the view's edge by src/map (REQ-003/AC-03), and scripts/render.mjs, which writes
//   out/manifest.json with the figures it drew only when nothing failed (QR-001/AC-02) and prints, as
//   template/scripts/output.test.mjs tests them, each file's lines and its problems (US-002/AC-01). They are checked by
//   rendering the sample and samples broken on purpose, and by reading the pixels of an outline on the view's edge. A
//   test can be added once the suite can run a render.
// - Root.tsx handing a figure's fps, stepSeconds and holdSeconds to gifTiming (US-003/AC-01): checked by rendering a GIF
//   that sets them and reading its pass length.
// - fonts.mjs --check, which pnpm check runs in a project: checked by pnpm check in a project made from the template.
// - The command pnpm check runs, whose test pattern Node 22 and 24 need where Node 26 also takes a folder: checked by
//   pnpm check on each of them in a project made from the template.
// - deliver.mjs asking a case-sensitive folder: checked by delivering into a case-sensitive volume. On a folder that
//   ignores case, the test of an older Cover.png checks it.
// - The browser copy in new-project.sh, which needs a downloaded browser: checked by making a second project on a
//   machine that rendered once.
// - What SKILL.md tells the agent to do: send the list and wait for agreement before making anything or changing it
//   (US-001/AC-01 to AC-03), wait for the approval of a new preview (US-002/AC-02), write the alt text in the article's
//   language (US-002/AC-03), lower the frame rate or shorten the pass (US-003/AC-01), draw the cover as a design
//   (REQ-004/AC-02), send no preview while a check fails (QR-001/AC-02), send the path of each measured GIF state's
//   still (US-002/AC-01), and send all of pnpm deliver's output and stop when it fails for any reason but a new render
//   (REQ-005/AC-02). They are checked by following the skill.
// - The template as a whole: video-tutorial's palette and fonts (CON-002; theme.test.mjs checks only that colour values
//   stay in theme.ts and that there is no dark look), rendering with Remotion (CON-003), video-tutorial left unchanged
//   (CON-004: git diff of skills/video-tutorial against the default branch is empty), and no publisher named (CON-005:
//   a search of SKILL.md and template/, the lock file aside, for one finds nothing).
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
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
  // Like pnpm 9's install: .modules.yaml is written once every package is in place, and an install stopped by a
  // download leaves none.
  // Under a folder holding pnpm-workspace.yaml it installs that workspace, not the folder it runs in, unless told
  // --ignore-workspace.
  const fail = join(bin, 'fail');
  const nothing = join(bin, 'nothing');
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/bin/sh
if [ -f '${fail}' ]; then echo 'ERR_PNPM_FETCH: network error' >&2; exit 1; fi
if [ -f '${nothing}' ]; then exit 0; fi
into=$PWD
case " $* " in
  *' --ignore-workspace '*) ;;
  *) d=$PWD; while [ "$d" != / ]; do if [ -f "$d/pnpm-workspace.yaml" ]; then into=$d; break; fi; d=$(dirname "$d"); done ;;
esac
mkdir -p "$into/node_modules" && : > "$into/node_modules/.modules.yaml"
`,
  );
  chmodSync(join(bin, 'pnpm'), 0o755);
  const repo = join(root, 'repo');
  const article = join(repo, 'posts/my-article');
  mkdirSync(article, {recursive: true});
  writeFileSync(join(article, 'source.md'), '# My article\n');
  spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', repo]);
  const env = {HOME: join(root, 'home'), PATH: `${bin}:${process.env.PATH}`};
  return {
    root,
    skill,
    repo,
    article,
    project: join(article, 'assets/sources/figures'),
    images: join(article, 'assets/images'),
    failInstalls: (on) => (on ? writeFileSync(fail, '') : rmSync(fail, {force: true})),
    // An install that exits 0 and puts no packages in the project, as installing an enclosing workspace instead does.
    installNothing: () => writeFileSync(nothing, ''),
    // Run as SKILL.md says, by its own path, so that a script not executable in the checkout fails every process test.
    newProject: (file = join(article, 'source.md')) => spawnSync(join(skill, 'new-project.sh'), [file], {env, encoding: 'utf8'}),
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

test('a project whose packages failed to install gets them when new-project.sh runs again', () => {
  const m = setUp();
  m.failInstalls(true);
  assert.equal(m.newProject().status, 1);
  // The author's work so far: the agreed list and a figure drawn in src/data.
  writeFileSync(join(m.project, 'figures.md'), 'the agreed list');
  writeFileSync(join(m.project, 'src/data/figures.ts'), 'export const FIGURES = []; // drawn by the author\n');
  const outsidePackages = (all) => Object.fromEntries(Object.entries(all).filter(([f]) => !f.startsWith('node_modules/')));
  const before = outsidePackages(snapshot(m.project));
  m.failInstalls(false);
  const result = m.newProject();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(m.project, 'node_modules/.modules.yaml')), result.stdout);
  assert.deepEqual(outsidePackages(snapshot(m.project)), before);
  m.cleanup();
});

test('an article inside a pnpm workspace gets its packages in its figures project, and the workspace is left as it was', () => {
  const m = setUp();
  // A repository that is a pnpm workspace whose packages do not include the article.
  writeFileSync(join(m.repo, 'pnpm-workspace.yaml'), 'packages:\n  - publishers/medium/app\n  - publishers/zhihu/app\n');
  writeFileSync(join(m.repo, 'package.json'), '{\n  "name": "studio",\n  "private": true,\n  "packageManager": "pnpm@9.12.3"\n}\n');
  const outside = (all) => Object.fromEntries(Object.entries(all).filter(([f]) => !f.startsWith('posts/my-article/assets/')));
  const before = snapshot(m.repo);
  const result = m.newProject();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(m.project, 'node_modules/.modules.yaml')), result.stdout);
  assert.equal(existsSync(join(m.repo, 'node_modules')), false);
  assert.deepEqual(outside(snapshot(m.repo)), before);
  m.cleanup();
});

test('an install that leaves no packages in the project stops new-project.sh, and it says so', () => {
  const m = setUp();
  m.installNothing();
  const result = m.newProject();
  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.stderr.includes(`left no packages in ${m.project}`), result.stderr);
  assert.doesNotMatch(result.stdout, /Ready/);
  m.cleanup();
});

// Finder writes .DS_Store into any folder it shows, the skill's own template included.
for (const [what, change, status] of [
  ['a .DS_Store in src passes', (m) => writeFileSync(join(m.project, 'src/.DS_Store'), 'Finder'), 0],
  ['a .DS_Store the template brought passes', null, 0],
  ['an edited source fails', (m) => writeFileSync(join(m.project, 'src/theme.ts'), `${readFileSync(join(m.project, 'src/theme.ts'), 'utf8')}// edited\n`), 1],
]) {
  test(`pnpm check compares src and scripts with the template: ${what}`, () => {
    const m = setUp();
    if (!change) writeFileSync(join(m.skill, 'template/scripts/.DS_Store'), 'Finder');
    assert.equal(m.newProject().status, 0);
    change?.(m);
    // Without NODE_TEST_CONTEXT, which would make the inner run report to this one and exit 0 whatever it found.
    const {NODE_TEST_CONTEXT, ...env} = process.env;
    const result = spawnSync(process.execPath, ['--test', 'scripts/template.test.mjs'], {cwd: m.project, env, encoding: 'utf8'});
    assert.equal(result.status, status, result.stdout);
    m.cleanup();
  });
}

test('a Markdown file that does not exist makes no project', () => {
  const m = setUp();
  const result = m.newProject(join(m.article, 'missing.md'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No such article/);
  assert.equal(existsSync(join(m.article, 'assets')), false);
  m.cleanup();
});

test('pnpm fonts sends Google Fonts the English characters one by one in code order, never the text of a figure', () => {
  const m = setUp();
  assert.equal(m.newProject().status, 0);
  // The Chinese text must not be sent; the arrow, which English uses and no other source holds, must be.
  const text = '缓存未命中时请求转发';
  writeFileSync(join(m.project, 'src/data/note.ts'), `export const NOTE = '${text}', MARK = '⇄';\n`);
  // fetch is replaced: each request's text parameter is written down, and a tiny font comes back.
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
  const result = spawnSync(process.execPath, ['--import', stub, 'scripts/fonts.mjs'], {cwd: m.project, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const sent = readFileSync(sentFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(sent.length, 6); // three weights of two faces
  for (const chars of sent) {
    assert.deepEqual([...text].filter((c) => chars.includes(c)), []);
    assert.ok(chars.includes('⇄'), chars);
    assert.ok([...chars].every((c, i, all) => i === 0 || all[i - 1].codePointAt(0) < c.codePointAt(0)), chars);
  }
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
  const figures = [
    {id: 'cover', kind: 'cover', title: 'Sessions that run themselves'},
    {id: 'a', kind: 'still', title: 'Human in the loop'},
    {id: 'b', kind: 'gif', title: 'Compact, then wake'},
  ];
  writeFileSync(join(m.project, 'out/manifest.json'), JSON.stringify({files: Object.fromEntries(Object.entries(out).map(([n, c]) => [n, sha256(c)])), figures}));
  mkdirSync(m.images, {recursive: true});
  writeFileSync(join(m.images, 'cover.png'), 'old cover');
  writeFileSync(join(m.images, 'a.png'), 'same a');
  return {
    ...m,
    deliver: (...node) => spawnSync(process.execPath, [...node, 'scripts/deliver.mjs'], {cwd: m.project, encoding: 'utf8'}),
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

// Whether the temporary folder takes Cover.png and cover.png for one name, as macOS volumes do unless made case-sensitive.
const tmpIgnoresCase = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'af-case-'));
  writeFileSync(join(dir, 'probe'), '');
  const ignores = existsSync(join(dir, 'PROBE'));
  rmSync(dir, {recursive: true, force: true});
  return ignores;
})();

test('an older file whose name differs in letter case is the one kept, in a folder that ignores case', {skip: !tmpIgnoresCase && 'the temporary folder tells letter case apart'}, () => {
  const m = rendered();
  rmSync(join(m.images, 'cover.png'));
  writeFileSync(join(m.images, 'Cover.png'), 'old cover');
  const result = m.deliver();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(m.images).sort(), ['Cover-v1.png', 'a.png', 'b.gif', 'cover.png']);
  assert.equal(readFileSync(join(m.images, 'Cover-v1.png'), 'utf8'), 'old cover');
  assert.match(result.stdout, /Renamed to keep the older file:\n {2}Cover\.png -> Cover-v1\.png\n$/);
  m.cleanup();
});

test('a link under a figure\'s name is kept like an older file', () => {
  const m = rendered();
  const shared = join(m.root, 'shared.gif');
  writeFileSync(shared, 'a picture other articles show');
  symlinkSync(shared, join(m.images, 'b.gif'));
  const result = m.deliver();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readlinkSync(join(m.images, 'b-v1.gif')), shared);
  assert.equal(readFileSync(join(m.images, 'b.gif'), 'utf8'), 'gif b');
  assert.equal(readFileSync(shared, 'utf8'), 'a picture other articles show');
  m.cleanup();
});

test('a copy that fails stops pnpm deliver, which still reports what it copied and the older files it renamed', () => {
  const m = rendered();
  // The disk fills up while b.gif is copied, after cover.png was copied: the file system's copy is replaced to make it so.
  const stub = join(m.root, 'no-space-for-b.mjs');
  writeFileSync(
    stub,
    `import fs from 'node:fs';
const copy = fs.copyFileSync;
fs.copyFileSync = (from, to, mode) => {
  if (String(to).endsWith('/b.gif')) throw Object.assign(new Error('ENOSPC: no space left on device'), {code: 'ENOSPC'});
  return copy(from, to, mode);
};
`,
  );
  const result = m.deliver('--import', stub);
  assert.equal(result.status, 1, result.stdout);
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
      'b.gif (not copied)',
      '  Section: §5 最难的一环是压缩自己，然后接着干',
      '  Alt text: 会话压缩自己再被唤醒的过程',
      'Renamed to keep the older file:',
      '  cover.png -> cover-v1.png',
      '',
    ].join('\n'),
  );
  assert.match(result.stderr, /Copying b\.gif failed.*ENOSPC/);
  assert.deepEqual(readdirSync(m.images).sort(), ['a.png', 'cover-v1.png', 'cover.png']);
  m.cleanup();
});

// Each case reaches deliver's check through another of what it reads: the manifest, a rendered file whose content
// changed or that is gone, and the list in figures.md. What the check decides is tested in template/scripts/delivery.test.mjs.
for (const [what, spoil] of [
  ['there is no passed render', (m) => rmSync(join(m.project, 'out/manifest.json'))],
  ['a rendered file changed after the render', (m) => writeFileSync(join(m.project, 'out/a.png'), 'edited after the render')],
  ['a rendered file is gone after the render', (m) => rmSync(join(m.project, 'out/b.gif'))],
  ['a row was added to figures.md after the render', (m) => writeFileSync(join(m.project, 'figures.md'), `${readFileSync(join(m.project, 'figures.md'), 'utf8')}| \`c.png\` | §6 | still | Later | Added after the preview | 后加的图 |\n`)],
]) {
  test(`nothing is copied when ${what}`, () => {
    const m = rendered();
    spoil(m);
    const before = snapshot(m.images);
    const result = m.deliver();
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /run pnpm render/);
    assert.deepEqual(snapshot(m.images), before);
    m.cleanup();
  });
}
