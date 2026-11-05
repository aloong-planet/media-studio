// The final-confirmation gate. pnpm approve records exactly what the owner saw; pnpm render refuses anything else.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const WATCHED = ['src', 'public'];

const filesUnder = (dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });

export const fingerprint = (root) => {
  const hash = crypto.createHash('sha256');
  const files = WATCHED.flatMap((d) => (fs.existsSync(path.join(root, d)) ? filesUnder(path.join(root, d)) : []));
  for (const f of files.map((p) => path.relative(root, p)).sort()) hash.update(f).update('\0').update(fs.readFileSync(path.join(root, f)));
  return hash.digest('hex');
};

export const stampPath = (root) => path.join(root, 'approved.json');

// Screens read the timeline, so an edit to the script shows nowhere until pnpm narrate has run.
export const staleTimeline = (root) => {
  const timeline = path.join(root, 'src/data/timeline.json');
  const built = fs.existsSync(timeline) ? JSON.parse(fs.readFileSync(timeline, 'utf8')).script : null;
  const current = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src/data/script.json'))).digest('hex');
  return built === current ? null : 'script.json changed after the timeline was built: run pnpm narrate.';
};

export const approve = (root) => fs.writeFileSync(stampPath(root), `${JSON.stringify({fingerprint: fingerprint(root)}, null, 1)}\n`);

// Why this project may not be rendered yet, or null when it may.
export const refusal = (root) => {
  if (!fs.existsSync(stampPath(root))) return 'No final confirmation yet: show the owner the preview, and run pnpm approve only after they say yes.';
  const {fingerprint: approved} = JSON.parse(fs.readFileSync(stampPath(root), 'utf8'));
  if (approved !== fingerprint(root)) return 'The video changed after the final confirmation: show the owner the new version, and run pnpm approve only after they say yes.';
  return staleTimeline(root);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  approve(process.cwd());
  console.log('Final confirmation recorded for the current video.');
}
