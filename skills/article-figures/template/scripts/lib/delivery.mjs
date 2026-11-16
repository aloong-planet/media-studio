// Whether the files in out/ may go into the article: only what the last passed pnpm render wrote, for the list it checked.
import {figureListProblems} from './figure-list.mjs';

const AGAIN = 'run pnpm render again and show the new preview.';

// manifest: what pnpm render wrote when nothing failed, {files: {name: sha256}, figures: [{id, kind, title}]}, or null;
// hashes: each manifest file's sha256 in out/ now, or null when it is gone; rows: the figure list in figures.md now.
export function deliveryProblems(manifest, hashes, rows) {
  if (!manifest) return ['No passed render in out/: run pnpm render, show the preview, and deliver once the author approves it.'];
  return [
    ...Object.entries(manifest.files)
      .filter(([name, sha256]) => hashes[name] !== sha256)
      .map(([name]) => `out/${name} changed after pnpm render passed: ${AGAIN}`),
    ...figureListProblems(rows, manifest.figures).map((p) => `figures.md changed after pnpm render passed (${p}): ${AGAIN}`),
  ];
}
