import {DIAGRAM} from '../data/diagram';
import {ACCENTS, Hue, Tone} from '../theme';
import {pathSegments} from './path';

export type Box = [number, number, number, number];
export type View = {x: number; y: number; w: number; h: number};

export type TextLine = {
  text: string;
  mono?: boolean;
  key?: boolean; // names the box's identity: drawn in the box's hue
  accent?: keyof typeof ACCENTS;
  dy?: number; // distance from the line above, default 18
};
export type DiagramNode = {
  id: string;
  box: Box;
  hue: Hue;
  title: string;
  titleSize?: number;
  aside?: {text: string; dx: number}; // short note on the title's row
  lines?: TextLine[];
  nested?: boolean; // inside a larger box of the same hue
  quiet?: boolean; // thinner outline
  center?: boolean;
  pad?: number;
};
export type Label = {x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; mono?: boolean; accent?: keyof typeof ACCENTS};
export type Edge = {
  id: string;
  paths: Array<{d: string; arrow?: 'end' | 'both'}>; // d uses only uppercase M, L, H and V
  tone?: Tone;
  dotted?: boolean;
  labels?: Label[];
};
export type Diagram = {
  view: Box; // the content's bounding box
  bands?: Array<{id: string; box: Box; label: string; labelAt: [number, number]}>; // grey background groups
  notes?: Array<{x: number; y: number; text: string; hue?: Hue}>; // column headings
  nodes: DiagramNode[];
  edges: Edge[];
  routes?: Record<string, {d: string; edge: string}>; // extra packet routes, such as one branch of a shared line
  legend: {
    at: [number, number];
    paths: Array<{label: string; tone?: Tone; dotted?: boolean}>;
    hues: Array<{hue: Hue; label: string}>;
  };
};

// Grey marks what takes no part, so it needs no entry of its own.
const missingFromLegend = [
  ...new Set(DIAGRAM.nodes.map((n) => n.hue).filter((h) => h !== 'gray' && !DIAGRAM.legend.hues.some((row) => row.hue === h))),
  ...new Set(DIAGRAM.edges.flatMap((e) => (e.tone ? [e.tone] : [])).filter((t) => !DIAGRAM.legend.paths.some((row) => row.tone === t))),
];
if (missingFromLegend.length) throw new Error(`diagram.ts legend is missing: ${missingFromLegend.join(', ')}`);

export const STAGE = {left: 40, top: 124, width: 1840, height: 776};
const ASPECT = STAGE.width / STAGE.height;
const PAD = 44;

export const NODES: Record<string, DiagramNode> = Object.fromEntries(DIAGRAM.nodes.map((n) => [n.id, n]));
export const EDGES: Record<string, Edge> = Object.fromEntries(DIAGRAM.edges.map((e) => [e.id, e]));

// An edge is a route under its own id, along its first path.
export const ROUTES: Record<string, {d: string; edge: string}> = {
  ...Object.fromEntries(DIAGRAM.edges.map((e) => [e.id, {d: e.paths[0].d, edge: e.id}])),
  ...DIAGRAM.routes,
};

// Includes the edge's labels, so the camera keeps them in frame.
const edgeBox = (e: Edge): Box => {
  const pts = e.paths.flatMap((p) => pathSegments(p.d).flat());
  for (const l of e.labels ?? []) pts.push([l.x, l.y]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
};

export const FULL_VIEW: View = (() => {
  const [x, y, w0, h0] = DIAGRAM.view;
  const w = Math.max(w0, h0 * ASPECT);
  const h = w / ASPECT;
  return {x: x + w0 / 2 - w / 2, y: y + h0 / 2 - h / 2, w, h};
})();

const MIN_W = DIAGRAM.view[2] * 0.7;

export function viewFor(ids: string[]): View {
  const boxes = ids.map((id) => NODES[id]?.box ?? edgeBox(EDGES[id]));
  if (boxes.length === 0) return FULL_VIEW;
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  let w = Math.max(x1 - x0 + PAD * 2, MIN_W);
  let h = Math.max(y1 - y0 + PAD * 2, MIN_W / ASPECT);
  if (w / h < ASPECT) w = h * ASPECT;
  else h = w / ASPECT;
  if (w >= FULL_VIEW.w * 0.92) return FULL_VIEW;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp((x0 + x1) / 2 - w / 2, FULL_VIEW.x, FULL_VIEW.x + FULL_VIEW.w - w),
    y: clamp((y0 + y1) / 2 - h / 2, FULL_VIEW.y, FULL_VIEW.y + FULL_VIEW.h - h),
    w,
    h,
  };
}
