// Run before any mp4: renders every cover, the first frame and one still per segment, and measures the layout rules in each.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {PLATFORM_COVERS} from '../src/ui/platforms.ts';
import {staleTimeline} from './gate.mjs';
import {problemList} from './problems.mjs';

const stale = staleTimeline(process.cwd());
if (stale) {
  console.error(stale);
  process.exit(1);
}

const {segments} = JSON.parse(fs.readFileSync('src/data/timeline.json', 'utf8'));
// Near a segment's end everything has settled, but before cards (12 frames) and the film's ending (18) fade out.
const FROM_END = 20;
const EVERY_COVER = Object.values(PLATFORM_COVERS).flat();

// Every cover file goes first, so a platform no longer named leaves no cover behind.
for (const c of EVERY_COVER) fs.rmSync(`out/${c.file}.png`, {force: true});
fs.rmSync('out/stills', {recursive: true, force: true});
fs.mkdirSync('out/stills', {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome');

// Keeps the downloaded browser for the next project on this machine: new-project.sh copies it from here.
const LOCAL_BROWSER = 'node_modules/.remotion/chrome-headless-shell';
const SHARED_BROWSER = path.join(os.homedir(), '.cache/video-tutorial/chrome-headless-shell');
if (!fs.existsSync(SHARED_BROWSER) && fs.existsSync(path.join(LOCAL_BROWSER, 'VERSION'))) {
  const partial = `${SHARED_BROWSER}.partial`;
  fs.rmSync(partial, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(SHARED_BROWSER), {recursive: true});
  fs.cpSync(LOCAL_BROWSER, partial, {recursive: true, verbatimSymlinks: true});
  fs.renameSync(partial, SHARED_BROWSER);
}
const inputProps = {measure: true};
// src/ui/Cover.tsx registers one composition per cover of the platforms src/data/cover.tsx names.
const ids = new Set((await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser, logLevel: 'error'})).map((c) => c.id));
const shots = [
  ...EVERY_COVER.filter((c) => ids.has(`cover-${c.file}`)).map((c) => ({id: `cover-${c.file}`, frame: 0, scale: c.scale, output: `out/${c.file}.png`, cover: true})),
  // Look at this still: the first frame must already be the finished title.
  {id: 'Walkthrough', frame: 0, scale: 1, output: 'out/stills/first-frame.png'},
  ...segments.map((s) => ({id: 'Walkthrough', frame: s.start + Math.max(0, s.dur - FROM_END), scale: 1, output: `out/stills/${s.id}.png`})),
];
const found = problemList();
const problem = found.add;
for (const shot of shots) {
  const composition = await selectComposition({serveUrl, id: shot.id, inputProps, puppeteerInstance: browser, logLevel: 'error'});
  let report = null;
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: shot.frame,
    scale: shot.scale,
    output: shot.output,
    puppeteerInstance: browser,
    logLevel: 'error',
    onBrowserLog: ({text}) => {
      if (text.startsWith('MEASURE ')) report = JSON.parse(text.slice(8));
    },
  });
  if (!report) problem(`not measured: ${shot.output}`, shot);
  else if (report.luminance < 0.8) problem(`background too dark for the daytime look (${report.luminance.toFixed(2)})`, shot);
  for (const p of report?.problems ?? []) problem(p, shot);
}
await browser.close({silent: true});
const lines = found.lines();
for (const line of lines) console.log(line);
console.log(lines.length ? `FAILED: ${lines.length} problems` : `ALL PASSED: ${shots.length} frames`);
process.exit(lines.length ? 1 : 0);
