// The preview before any mp4: both covers and one still per segment, with the layout rules measured in each.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {staleTimeline} from './gate.mjs';

const stale = staleTimeline(process.cwd());
if (stale) {
  console.error(stale);
  process.exit(1);
}

const {segments} = JSON.parse(fs.readFileSync('src/data/timeline.json', 'utf8'));
// Near a segment's end everything has settled, but before cards (12 frames) and the film's ending (18) fade out.
const FROM_END = 20;
const shots = [
  {id: 'Cover34', frame: 0, output: 'out/cover-3x4.png'},
  {id: 'Cover43', frame: 0, output: 'out/cover-4x3.png'},
  ...segments.map((s) => ({id: 'Walkthrough', frame: s.start + Math.max(0, s.dur - FROM_END), output: `out/stills/${s.id}.png`})),
];

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
const found = new Map(); // A problem in the diagram shows in every frame: report it once, with where it was first seen.
const problem = (text, shot) => found.has(text) || found.set(text, shot.output);
for (const shot of shots) {
  const composition = await selectComposition({serveUrl, id: shot.id, inputProps, puppeteerInstance: browser, logLevel: 'error'});
  let report = null;
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: shot.frame,
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
for (const [text, where] of found) console.log(`${where}: ${text}`);
console.log(found.size ? `FAILED: ${found.size} problems` : `ALL PASSED: ${shots.length} frames`);
process.exit(found.size ? 1 : 0);
