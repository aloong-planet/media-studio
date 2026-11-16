// Reads what a rendered file really is, holds it to the sizes the article needs, and words what pnpm render prints.

export function pngInfo(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG file');
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
}

// loops: 0 plays forever, n repeats n more times, null (no NETSCAPE2.0 block) plays once.
export function gifInfo(buf) {
  if (!/^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) throw new Error('not a GIF file');
  const info = {width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), frames: 0, loops: null, seconds: 0};
  let at = 13 + (buf[10] & 0x80 ? 3 * 2 ** ((buf[10] & 7) + 1) : 0);
  const skipBlocks = () => {
    while (buf[at] !== 0) at += buf[at] + 1;
    at++;
  };
  let centiseconds = 0;
  while (at < buf.length && buf[at] !== 0x3b) {
    if (buf[at] === 0x21) {
      const label = buf[at + 1];
      at += 2;
      if (label === 0xf9) centiseconds += buf.readUInt16LE(at + 2);
      if (label === 0xff && buf.subarray(at + 1, at + 12).toString('latin1') === 'NETSCAPE2.0') info.loops = buf.readUInt16LE(at + 14);
      skipBlocks();
    } else if (buf[at] === 0x2c) {
      const packed = buf[at + 9];
      at += 10 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0) + 1;
      skipBlocks();
      info.frames++;
    } else throw new Error(`unexpected byte ${buf[at]} at ${at}`);
  }
  info.seconds = centiseconds / 100;
  return info;
}

// The states a GIF is measured on, one for each step and the last for its hold, each with the still kept for review.
export const gifStates = (id, count) =>
  Array.from({length: count}, (_, i) => {
    const state = i === count - 1 ? 'hold' : `step-${i + 1}`;
    return {state, still: `out/frames/${id}-${state}.png`};
  });

// What pnpm render prints for a rendered file: its size and what was measured, and under a GIF the still of each state.
export function fileReport({file, kind, id, states}, info, bytes) {
  const kb = `${Math.round(bytes / 1024)} KB`;
  if (kind !== 'gif') return [`out/${file}: ${info.width}×${info.height}, ${kb}, measured`];
  return [
    `out/${file}: ${info.width}×${info.height}, ${info.frames} frames, ${info.seconds} s a pass, ${kb}, ${states - 1} steps and the hold measured`,
    ...gifStates(id, states).map((s) => `  ${s.still}`),
  ];
}

// problems: [{file, where, text}] in the order pnpm render found them. A problem in a diagram can show in several states
// of a GIF: it is listed once for each file, with where in that file it was first seen.
export function problemLines(problems) {
  const seen = new Map();
  for (const {file, where, text} of problems) {
    const key = `${file}\n${text}`;
    if (!seen.has(key)) seen.set(key, `${where}: ${text}`);
  }
  return [...seen.values()];
}

const MAX_PASS_SECONDS = 12;

// figure: {file, kind, height, fps} with height in design units, as the composition has it.
export function outputProblems({file, kind, height, fps}, info) {
  const problems = [];
  const size = (w, h) => {
    if (info.width !== w || info.height !== h) problems.push(`${file} is ${info.width}×${info.height} px, not ${w}×${h}`);
  };
  if (kind === 'cover') size(1920, 820);
  if (kind === 'still') size(2160, height * 3);
  if (kind === 'gif') {
    size(1080, height * 1.5);
    if (info.loops !== 0) problems.push(`${file} does not loop forever`);
    if (info.seconds > MAX_PASS_SECONDS) problems.push(`${file} lasts ${info.seconds} s a pass, over ${MAX_PASS_SECONDS} s`);
    const rate = info.frames / info.seconds;
    if (Math.abs(rate - fps) > 0.5) problems.push(`${file} plays ${rate.toFixed(1)} frames a second, not ${fps}`);
  }
  return problems;
}
