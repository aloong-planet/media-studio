// The only way to an mp4: checks the final confirmation, renders, and sets the loudness.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {refusal} from './gate.mjs';

const root = process.cwd();
const stop = refusal(root);
if (stop) {
  console.error(stop);
  process.exit(1);
}
const {meta} = JSON.parse(fs.readFileSync('src/data/script.json', 'utf8'));
fs.mkdirSync('out', {recursive: true});
// Thousands of progress lines go to a file; they appear only if the step fails.
const LOG = 'out/render.log';
const run = (cmd, args) => {
  const log = fs.openSync(LOG, 'w');
  try {
    execFileSync(cmd, args, {stdio: ['ignore', log, log]});
  } catch (error) {
    console.error(fs.readFileSync(LOG, 'utf8').slice(-4000));
    throw error;
  } finally {
    fs.closeSync(log);
  }
};
run('pnpm', ['exec', 'remotion', 'render', 'src/index.ts', 'Walkthrough', 'out/raw.mp4', '--crf=18', '--audio-codec=aac', '--audio-bitrate=192k', '--log=warn']);
// True peak -2 leaves room for the AAC encoder: a 4-minute film set this way measured -1.8 dB when finished.
run('ffmpeg', ['-v', 'error', '-y', '-i', 'out/raw.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `out/${meta.slug}.mp4`]);
fs.rmSync('out/raw.mp4');
fs.rmSync(LOG);
console.log(`out/${meta.slug}.mp4`);
