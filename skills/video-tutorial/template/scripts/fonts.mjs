// Downloads only the glyphs this video uses, so rendering needs no network and no system fonts.
// Only the de-duplicated set of characters leaves the machine, never the script's text.
// With --check, downloads nothing and fails if the text now uses a character the fonts were not cut for.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FACES = [
  ['Noto Sans SC', 'noto-sans-sc', [400, 500, 600]],
  ['Noto Serif SC', 'noto-serif-sc', [600]],
  ['IBM Plex Sans', 'ibm-plex-sans', [400, 500, 600]],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 500, 600]],
];
const CHARSET = 'public/fonts/charset.txt';

const walk = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const sources = walk('src').filter((f) => /\.(ts|tsx|json)$/.test(f));
const decoded = sources.map((f) => fs.readFileSync(f, 'utf8')).join('');
const chars = new Set([...decoded].filter((c) => c.codePointAt(0) >= 0x20 && c !== ' '));
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));

if (process.argv.includes('--check')) {
  const cut = new Set(fs.existsSync(CHARSET) ? [...fs.readFileSync(CHARSET, 'utf8')] : []);
  const missing = [...chars].filter((c) => !cut.has(c));
  if (missing.length) {
    console.error(`Fonts lack ${missing.length} characters, run pnpm fonts: ${missing.slice(0, 40).join('')}`);
    process.exit(1);
  }
  console.log(`fonts cover all ${chars.size} characters`);
  process.exit(0);
}

const fetchRetrying = async (url, options, tries = 4) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (tries <= 1) throw error;
    console.log(`retrying after: ${error.cause?.code ?? error.message}`);
    return fetchRetrying(url, options, tries - 1);
  }
};

const text = encodeURIComponent([...chars].join(''));
console.log(`${chars.size} unique characters`);
fs.mkdirSync('public/fonts', {recursive: true});
for (const [family, slug, weights] of FACES) {
  for (const w of weights) {
    const q = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${w}&text=${text}`;
    const css = await (await fetchRetrying(q, {headers: {'User-Agent': UA}})).text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
    if (urls.length !== 1) throw new Error(`${family} ${w}: expected one font file, got ${urls.length}\n${css.slice(0, 300)}`);
    const buf = Buffer.from(await (await fetchRetrying(urls[0], {headers: {'User-Agent': UA}})).arrayBuffer());
    fs.writeFileSync(`public/fonts/${slug}-${w}.woff2`, buf);
    console.log(`${slug}-${w}: ${(buf.length / 1024).toFixed(0)} KB`);
  }
}
fs.writeFileSync(CHARSET, [...chars].join(''));
