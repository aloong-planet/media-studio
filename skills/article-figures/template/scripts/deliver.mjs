// Run only after the author approved the preview: copies the rendered figures into the article's assets/images.
// It copies exactly what the last passed pnpm render wrote, and keeps any older, different file under a -v<n> name.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {planCopy} from './lib/copy.mjs';
import {deliveryProblems} from './lib/delivery.mjs';
import {parseFigureList} from './lib/figure-list.mjs';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const MANIFEST = 'out/manifest.json';
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : null;
const hashes = Object.fromEntries(
  Object.keys(manifest?.files ?? {}).map((name) => {
    const file = path.join('out', name);
    return [name, fs.existsSync(file) ? sha256(file) : null];
  }),
);
const rows = parseFigureList(fs.readFileSync('figures.md', 'utf8'));
const problems = deliveryProblems(manifest, hashes, rows);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const images = path.resolve('../../images');
fs.mkdirSync(images, {recursive: true});
const existing = new Map(
  fs
    .readdirSync(images, {withFileTypes: true})
    .filter((e) => e.isFile())
    .map((e) => [e.name, sha256(path.join(images, e.name))]),
);
const plan = planCopy(rows.map((r) => ({name: r.file, sha256: manifest.files[r.file]})), existing);
for (const p of plan) {
  if (p.action !== 'copy') continue;
  // The new file goes in under a temporary name first: a copy that fails leaves the older file where it was.
  const part = path.join(images, `.${p.name}.part`);
  fs.copyFileSync(path.join('out', p.name), part);
  if (p.rename) fs.renameSync(path.join(images, p.rename.from), path.join(images, p.rename.to));
  fs.renameSync(part, path.join(images, p.name));
}

const report = [`Copied into ${images}:`];
plan.forEach((p, i) => {
  report.push(`${p.name} (${p.action === 'copy' ? 'copied' : 'already there, the same file'})`, `  Section: ${rows[i].section}`, `  Alt text: ${rows[i].alt}`);
});
const renamed = plan.filter((p) => p.rename);
if (renamed.length) report.push('Renamed to keep the older file:', ...renamed.map((p) => `  ${p.rename.from} -> ${p.rename.to}`));
console.log(report.join('\n'));
