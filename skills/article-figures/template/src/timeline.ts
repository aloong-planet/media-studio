// The timing of an animated figure. One pass lights the steps one after another, then holds the whole diagram,
// and the GIF loops back to the first step. Nothing here moves the view: every frame shows the whole diagram.
export const GIF_FPS = 15;
export const MAX_PASS_SECONDS = 12;

export type Step = {
  n: string[]; // boxes this step lights
  e: string[]; // lines this step lights
  at: [number, number]; // where its marker sits, beside a line it lights
  flows?: string[]; // routes a dot travels; by default each line in e
};

export type GifTiming = {fps: number; stepFrames: number; holdFrames: number; fadeFrames: number; total: number};

export function gifTiming(steps: number, fps: number = GIF_FPS, stepSeconds = 1.6, holdSeconds = 2): GifTiming {
  const stepFrames = Math.round(stepSeconds * fps);
  const holdFrames = Math.round(holdSeconds * fps);
  const total = steps * stepFrames + holdFrames;
  const seconds = total / fps;
  if (seconds > MAX_PASS_SECONDS) throw new Error(`${steps} steps make a ${seconds.toFixed(1)} s pass, over ${MAX_PASS_SECONDS} s`);
  return {fps, stepFrames, holdFrames, fadeFrames: Math.round(fps / 3), total};
}

export type GifState = {
  step: number | null; // the current step, or null in the hold
  local: number; // frames since the current step or the hold began
  lit: Record<string, number>; // each lit box or line, with the frame it lit at; everything else is dimmed
  badges: Array<{step: number; now: boolean; since: number}>; // passed steps hollow, the current one solid
};

// A step lights its own boxes and lines and keeps those of the steps before lit, since their hollow markers
// must stay the colour of the lines beside them. The hold lights the whole diagram: ids are all its boxes and lines.
export function gifStateAt(frame: number, steps: Step[], t: GifTiming, ids: string[]): GifState {
  const k = Math.min(Math.floor(frame / t.stepFrames), steps.length);
  const lit: Record<string, number> = {};
  steps.slice(0, k + 1).forEach((s, j) => {
    for (const id of [...s.n, ...s.e]) lit[id] ??= j * t.stepFrames;
  });
  const badges = steps.slice(0, k + 1).map((_, j) => ({step: j, now: j === k, since: frame - j * t.stepFrames}));
  if (k < steps.length) return {step: k, local: frame - k * t.stepFrames, lit, badges};
  const holdStart = steps.length * t.stepFrames;
  for (const id of ids) lit[id] ??= holdStart;
  return {step: null, local: frame - holdStart, lit, badges};
}

// One frame per step once it has settled, and the last frame of the hold.
export const measureFrames = (t: GifTiming, steps: number): number[] => [
  ...Array.from({length: steps}, (_, k) => (k + 1) * t.stepFrames - 1),
  t.total - 1,
];
