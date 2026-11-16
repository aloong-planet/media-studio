// Imported with the extension and only types besides, so that node can load this file for the tests.
import type {ACCENTS, Hue, Tone} from '../theme';
import type {Step} from '../timeline';
import {pathSegments} from './path.ts';

export type Box = [number, number, number, number];

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
export type Legend = {
  at: [number, number];
  paths: Array<{label: string; tone?: Tone; dotted?: boolean}>;
  hues: Array<{hue: Hue; label: string}>;
};
// Units are a figure's design pixels: a figure is 720 wide, so 12 units of text are 36 pixels in its 2160-pixel PNG.
export type Diagram = {
  view: Box; // the content's bounding box; every frame shows all of it
  bands?: Array<{id: string; box: Box; label: string; labelAt: [number, number]}>; // grey background groups
  notes?: Array<{x: number; y: number; text: string; hue?: Hue}>; // column headings
  nodes: DiagramNode[];
  edges: Edge[];
  routes?: Record<string, {d: string; edge: string}>; // extra dot routes, such as one branch of a shared line
  legend?: Legend; // required on every figure but the cover
};

type Common = {id: string; title: string; diagram: Diagram};
export type Figure =
  | (Common & {kind: 'still'; subtitle?: string})
  | (Common & {kind: 'gif'; subtitle?: string; steps: Step[]; fps?: number; stepSeconds?: number; holdSeconds?: number})
  | (Common & {kind: 'cover'; subtitle: string});

// An edge is a route under its own id, along its first path.
export const routesOf = (d: Diagram): Record<string, {d: string; edge: string}> => ({
  ...Object.fromEntries(d.edges.map((e) => [e.id, {d: e.paths[0].d, edge: e.id}])),
  ...d.routes,
});

// Mistakes in figures.ts that no render could show: they stop pnpm render before anything is drawn.
export function figureProblems(f: Figure): string[] {
  const d = f.diagram;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) problems.push(`${f.id}: an id is lowercase letters, digits and single hyphens`);
  for (const p of [...d.edges.flatMap((e) => e.paths.map((x) => x.d)), ...Object.values(d.routes ?? {}).map((r) => r.d)]) {
    try {
      pathSegments(p);
    } catch (error) {
      problems.push(`${f.id}: ${(error as Error).message}`);
    }
  }
  if (f.kind !== 'cover' && !d.legend) problems.push(`${f.id}: the diagram needs a legend`);
  if (d.legend) {
    const missing = [
      ...new Set(d.nodes.map((n) => n.hue).filter((h) => h !== 'gray' && !d.legend!.hues.some((row) => row.hue === h))),
      ...new Set(d.edges.flatMap((e) => (e.tone ? [e.tone] : [])).filter((t) => !d.legend!.paths.some((row) => row.tone === t))),
    ];
    if (missing.length) problems.push(`${f.id}: the legend is missing ${missing.join(', ')}`);
  }
  if (f.kind === 'gif') {
    const known = new Set([...d.nodes.map((n) => n.id), ...d.edges.map((e) => e.id)]);
    const routes = routesOf(d);
    f.steps.forEach((s, i) => {
      for (const id of [...s.n, ...s.e]) if (!known.has(id)) problems.push(`${f.id}: step ${i + 1} lights ${id}, which is not in the diagram`);
      for (const id of s.flows ?? []) if (!routes[id]) problems.push(`${f.id}: step ${i + 1} sends a dot along ${id}, which is no route`);
      if (!s.e.length) problems.push(`${f.id}: step ${i + 1} lights no line`);
    });
  }
  return problems;
}
