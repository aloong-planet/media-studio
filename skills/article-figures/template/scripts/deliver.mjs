// Run only after the author approved the preview: copies the rendered figures into the article's assets/images.
// It copies exactly what the last passed pnpm render wrote, and keeps any older, different file under a -v<n> name.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {applyPlan, copyReport, planCopy} from './lib/copy.mjs';
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
// Every entry counts, links and folders too, with a content hash only for a plain file.
const entries = new Map(fs.readdirSync(images, {withFileTypes: true}).map((e) => [e.name, e.isFile() ? sha256(path.join(images, e.name)) : null]));
// The folder itself tells whether letter case tells names apart: a probe file is looked up under its name in capitals.
const probe = `.case-probe-${process.pid}`;
fs.writeFileSync(path.join(images, probe), '');
const ignoreCase = fs.existsSync(path.join(images, probe.toUpperCase()));
fs.unlinkSync(path.join(images, probe));
const plan = planCopy(rows.map((r) => ({name: r.file, sha256: manifest.files[r.file]})), {entries, ignoreCase});
// A copy that fails stops the plan; what was copied and renamed before it is reported all the same.
const copied = new Set();
let failure = null;
try {
  applyPlan(plan, {
    rename: (from, to) => fs.renameSync(path.join(images, from), path.join(images, to)),
    copy: (name) => {
      fs.copyFileSync(path.join('out', name), path.join(images, name), fs.constants.COPYFILE_EXCL);
      copied.add(name);
    },
  });
} catch (error) {
  failure = error;
}
console.log(copyReport(plan, rows, images, copied).join('\n'));
if (failure) {
  const name = plan.find((p) => p.action === 'copy' && !copied.has(p.name)).name;
  console.error(`Copying ${name} failed, and nothing after it was copied: ${failure.message}`);
  process.exit(1);
}
