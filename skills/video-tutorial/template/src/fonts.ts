import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const FACES: Array<[string, string, number[]]> = [
  ['Noto Sans SC', 'noto-sans-sc', [400, 500, 600]],
  ['Noto Serif SC', 'noto-serif-sc', [600]],
  ['IBM Plex Sans', 'ibm-plex-sans', [400, 500, 600]],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 500, 600]],
];

const loads: Promise<void>[] = [];
for (const [family, slug, weights] of FACES) {
  for (const weight of weights) {
    loads.push(loadFont({family, url: staticFile(`fonts/${slug}-${weight}.woff2`), weight: String(weight), format: 'woff2'}));
  }
}

// Settles once every face above is in use. Wait for this, not document.fonts.ready, before measuring text: loadFont adds
// a face to document.fonts only after fetching it, so document.fonts.ready does not wait for a face still being fetched.
export const fontsLoaded = Promise.all(loads);
