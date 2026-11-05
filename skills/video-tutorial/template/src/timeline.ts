import {Easing, interpolate} from 'remotion';
import raw from './data/timeline.json';
import {EDGES, FULL_VIEW, NODES, ROUTES, View, viewFor} from './map/geometry';

export type Flow = {p: string; cue: number; delay?: number};
export type Cue = {text: string; s: number; e: number};
export type Seg = {
  id: string;
  chapter: string;
  kind: 'title' | 'tour' | 'card' | 'step' | 'wrap' | 'outro';
  n: string[];
  e: string[];
  flows: Flow[];
  at?: [number, number] | null;
  cam?: 'full' | null;
  focus?: string[] | null;
  reset?: boolean | null;
  audio: string | null;
  audioAt: number;
  cues: Cue[];
  start: number;
  dur: number;
  score: number;
  stepNo?: number;
  stepTotal?: number;
};
export type Chapter = {
  no?: number; // numbered chapters are the ones with a card, a wrap and a row in the outro and on the covers
  tab?: string;
  label?: string;
  sub?: string;
  source?: string;
  quote?: string;
  plain?: boolean; // quote is a description, not someone's words
  result?: string;
};
export type Meta = {
  slug: string;
  title: string;
  subtitle: string;
  note?: string;
  titleScale?: number; // below 1 when the title does not fit one line
  unit: string; // what a numbered chapter is: 事件, 场景
  outro: {heading: string; sources: string[]};
};

export const FPS: number = raw.fps;
export const TOTAL_FRAMES: number = raw.totalFrames;
export const SEGS = raw.segments as unknown as Seg[];
export const CHAPTERS = raw.chapters as Record<string, Chapter>;
export const META = raw.meta as Meta;
export const NUMBERED = Object.values(CHAPTERS)
  .filter((c) => c.no)
  .sort((a, b) => a.no! - b.no!);

// A mistyped id would otherwise surface as a blank box or a crash far from its cause.
for (const seg of SEGS) {
  const unknown = [
    ...seg.n.filter((id) => !NODES[id]),
    ...seg.e.filter((id) => !EDGES[id]),
    ...(seg.focus ?? []).filter((id) => !NODES[id] && !EDGES[id]),
    ...seg.flows.filter((f) => !ROUTES[f.p]).map((f) => f.p),
    ...(CHAPTERS[seg.chapter] ? [] : [seg.chapter]),
    ...(seg.kind === 'step' && !seg.at ? ['at'] : []),
    ...seg.flows.filter((f) => f.cue >= Math.max(1, seg.cues.length)).map((f) => `line ${f.cue} for flow ${f.p}`),
    ...(seg.kind === 'step' && !seg.e.length ? ['at least one line in e'] : []),
    // A step's number takes the colour of the path it marks, so a step can mark only one.
    ...(seg.kind === 'step' && new Set(seg.e.map((id) => EDGES[id]?.tone).filter(Boolean)).size > 1 ? ['one path colour per step'] : []),
    // The outro brings in one row per line, so any other count shifts every row.
    ...(seg.kind === 'outro' && seg.cues.length !== NUMBERED.length + 1 ? [`${NUMBERED.length + 1} lines: the heading and one per numbered chapter`] : []),
  ];
  if (unknown.length) throw new Error(`script.json, segment ${seg.id}: unknown or missing ${unknown.join(', ')}`);
}

export const segIndexAt = (frame: number): number => {
  for (let i = SEGS.length - 1; i >= 0; i--) if (frame >= SEGS[i].start) return i;
  return 0;
};

// Frame, relative to its segment, at which a flow's packet leaves.
export const flowStart = (seg: Seg, flow: Flow): number => {
  const base = flow.cue === 0 ? seg.audioAt : (seg.cues[flow.cue]?.s ?? seg.audioAt);
  return Math.round(base + (flow.delay ?? 0) * FPS);
};

// For each segment: when (absolute frame) every element became lit in the current run.
const LIT_AT: Array<Record<string, number>> = (() => {
  const out: Array<Record<string, number>> = [];
  let cur: Record<string, number> = {};
  for (const seg of SEGS) {
    if (seg.kind === 'card' || seg.kind === 'title' || seg.kind === 'outro' || seg.reset) cur = {};
    cur = {...cur};
    for (const id of seg.n) cur[id] = seg.start;
    for (const id of seg.e) {
      const flow = seg.flows.find((f) => ROUTES[f.p]?.edge === id);
      cur[id] = seg.start + (flow ? flowStart(seg, flow) : 0);
    }
    out.push(cur);
  }
  return out;
})();

const CARD_HOLD_OLD = 10; // A card keeps showing the old route until its scrim has covered it.

export const litAt = (frame: number, idx: number): Record<string, number> => {
  const seg = SEGS[idx];
  const keepOld = seg.kind === 'card' && frame - seg.start < CARD_HOLD_OLD && idx > 0;
  return LIT_AT[keepOld ? idx - 1 : idx];
};

// 1 while a route is being followed (others dimmed), 0 in the undimmed overview.
const isPlay = (s: Seg) => s.kind !== 'title' && s.kind !== 'outro';
export const playAt = (frame: number, idx: number): number => {
  const seg = SEGS[idx];
  const prev = SEGS[idx - 1];
  if (!prev || isPlay(prev) === isPlay(seg)) return isPlay(seg) ? 1 : 0;
  const t = interpolate(frame - seg.start, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return isPlay(seg) ? t : 1 - t;
};

const targetView = (seg: Seg): View =>
  seg.cam === 'full' || seg.kind === 'card' || seg.kind === 'title' || seg.kind === 'outro' || seg.kind === 'wrap'
    ? FULL_VIEW
    : viewFor([...seg.n, ...seg.e, ...(seg.focus ?? [])]);

export const viewAt = (frame: number, idx: number): View => {
  const seg = SEGS[idx];
  const to = targetView(seg);
  const prev = SEGS[idx - 1];
  if (!prev) return to;
  const from = targetView(prev);
  const t = interpolate(frame - seg.start, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.33, 0, 0.2, 1),
  });
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {x: mix(from.x, to.x), y: mix(from.y, to.y), w: mix(from.w, to.w), h: mix(from.h, to.h)};
};
