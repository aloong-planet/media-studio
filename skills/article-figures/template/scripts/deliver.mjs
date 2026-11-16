// Run only after the author approved the preview: copies the rendered figures into the article's assets/images.
// It copies exactly what the last passed pnpm render wrote, and keeps any older, different file under a -v<n> name.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {planCopy} from './lib/copy.mjs';
import {parseFigureList} from './lib/figure-list.mjs';

const stop = (why) => {
  console.error(why);
  process.exit(1);
};
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const MANIFEST = 'out/manifest.json';
if (!fs.existsSync(MANIFEST)) stop('No passed render in out/: run pnpm render, show the preview, and deliver once the author approves it.');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const rows = parseFigureList(fs.readFileSync('figures.md', 'utf8')) ?? [];
for (const [name, hash] of Object.entries(manifest)) {
  const file = path.join('out', name);
  if (!fs.existsSync(file) || sha256(file) !== hash) stop(`${file} changed after pnpm render passed: run pnpm render again and show the new preview.`);
  if (!rows.some((r) => r.file === name)) stop(`figures.md no longer lists ${name}: run pnpm render again and show the new preview.`);
}

const images = path.resolve('../../images');
fs.mkdirSync(images, {recursive: true});
const existing = new Map(
  fs
    .readdirSync(images, {withFileTypes: true})
    .filter((e) => e.isFile())
    .map((e) => [e.name, sha256(path.join(images, e.name))]),
);
const listed = rows.filter((r) => r.file in manifest);
const plan = planCopy(listed.map((r) => ({name: r.file, sha256: manifest[r.file]})), existing);
for (const p of plan) if (p.renameOldTo) fs.renameSync(path.join(images, p.name), path.join(images, p.renameOldTo));
for (const p of plan) if (p.action === 'copy') fs.copyFileSync(path.join('out', p.name), path.join(images, p.name), fs.constants.COPYFILE_EXCL);

const report = [`Copied into ${images}:`];
plan.forEach((p, i) => {
  report.push(`${p.name} (${p.action === 'copy' ? 'copied' : 'already there, the same file'})`, `  Section: ${listed[i].section}`, `  Alt text: ${listed[i].alt}`);
});
const renamed = plan.filter((p) => p.renameOldTo);
if (renamed.length) report.push('Renamed to keep the older file:', ...renamed.map((p) => `  ${p.name} -> ${p.renameOldTo}`));
console.log(report.join('\n'));
