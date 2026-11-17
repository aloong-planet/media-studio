// Renders every figure into out/, measures the diagram rules in each rendered state, and checks each file.
// Only when nothing failed does it write out/manifest.json, which pnpm deliver copies by.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {EXTENSION, figureListProblems, parseFigureList} from './lib/figure-list.mjs';
import {fileReport, gifInfo, gifStates, outputProblems, pngInfo, problemLines} from './lib/output.mjs';

fs.rmSync('out', {recursive: true, force: true});
fs.mkdirSync('out/frames', {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome');

// Keeps the downloaded browser for the next project on this machine: new-project.sh copies it from here.
const LOCAL_BROWSER = 'node_modules/.remotion/chrome-headless-shell';
const SHARED_BROWSER = path.join(os.homedir(), '.cache/article-figures/chrome-headless-shell');
if (!fs.existsSync(SHARED_BROWSER) && fs.existsSync(path.join(LOCAL_BROWSER, 'VERSION'))) {
  const partial = `${SHARED_BROWSER}.partial`;
  fs.rmSync(partial, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(SHARED_BROWSER), {recursive: true});
  fs.cpSync(LOCAL_BROWSER, partial, {recursive: true, verbatimSymlinks: true});
  fs.renameSync(partial, SHARED_BROWSER);
}

const compositions = await getCompositions(serveUrl, {puppeteerInstance: browser, logLevel: 'error'});
const figures = compositions.map((c) => ({...c.props, file: c.props.id + EXTENSION[c.props.kind], composition: c}));
const listProblems = figureListProblems(parseFigureList(fs.readFileSync('figures.md', 'utf8')), figures);
if (listProblems.length) {
  for (const p of listProblems) console.log(p);
  console.log('FAILED: figures.md and src/data/figures.ts differ; agree the change with the author before drawing it.');
  await browser.close({silent: true});
  process.exit(1);
}

const found = [];
const lines = [];
for (const f of figures) {
  const {composition} = f;
  const output = path.join('out', f.file);
  const states = f.kind === 'gif' ? gifStates(f.id, f.measureAt.length) : null;
  // A GIF is measured on one still per step and on its hold, kept in out/frames for review; a still and the cover on the file itself.
  for (const [i, frame] of f.measureAt.entries()) {
    const measure = f.kind !== 'gif' || i === f.measureAt.length - 1 ? 'static' : 'step';
    let report = null;
    await renderStill({
      composition,
      serveUrl,
      frame,
      scale: f.scale,
      output: states ? states[i].still : output,
      inputProps: {measure},
      puppeteerInstance: browser,
      logLevel: 'error',
      onBrowserLog: ({text}) => {
        if (text.startsWith('MEASURE ')) report = JSON.parse(text.slice(8));
      },
    });
    const where = states ? `${output} ${states[i].state}` : output;
    const problem = (text) => found.push({file: f.file, where, text});
    if (!report) problem('not measured');
    else if (report.luminance < 0.8) problem(`background too dark for the daytime look (${report.luminance.toFixed(2)})`);
    for (const p of report?.problems ?? []) problem(p);
  }
  if (f.kind === 'gif') {
    await renderMedia({composition, serveUrl, codec: 'gif', scale: f.scale, numberOfGifLoops: null, outputLocation: output, inputProps: {}, puppeteerInstance: browser, logLevel: 'error'});
  }
  const buf = fs.readFileSync(output);
  const info = f.kind === 'gif' ? gifInfo(buf) : pngInfo(buf);
  for (const p of outputProblems({file: f.file, kind: f.kind, height: composition.height, fps: composition.fps}, info)) found.push({file: f.file, where: output, text: p});
  lines.push(...fileReport({file: f.file, kind: f.kind, id: f.id, stateCount: f.measureAt.length}, info, buf.length));
}
await browser.close({silent: true});

const problems = problemLines(found);
for (const l of [...lines, ...problems]) console.log(l);
if (problems.length) {
  console.log(`FAILED: ${problems.length} problems`);
  process.exit(1);
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// The figures as drawn go in too, so that pnpm deliver refuses a figures.md that changed after this render.
const manifest = {files: Object.fromEntries(figures.map((f) => [f.file, sha256(path.join('out', f.file))])), figures: figures.map(({id, kind, title}) => ({id, kind, title}))};
fs.writeFileSync('out/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
const measured = figures.reduce((n, f) => n + f.measureAt.length, 0);
console.log(`ALL PASSED: ${figures.length} figures, ${measured} states measured`);
