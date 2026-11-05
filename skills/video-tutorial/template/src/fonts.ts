import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const FACES: Array<[string, string, number[]]> = [
  ['Noto Sans SC', 'noto-sans-sc', [400, 500, 600]],
  ['Noto Serif SC', 'noto-serif-sc', [600]],
  ['IBM Plex Sans', 'ibm-plex-sans', [400, 500, 600]],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 500, 600]],
];

for (const [family, slug, weights] of FACES) {
  for (const weight of weights) {
    loadFont({family, url: staticFile(`fonts/${slug}-${weight}.woff2`), weight: String(weight), format: 'woff2'});
  }
}
