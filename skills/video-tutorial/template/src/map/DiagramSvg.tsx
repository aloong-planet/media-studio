import React from 'react';
import {interpolate, interpolateColors} from 'remotion';
import {DIAGRAM} from '../data/diagram';
import {ACCENTS, C, HUES, MONO, SANS, TONES, Tone} from '../theme';
import {DiagramNode, Edge, Label} from './geometry';

const clamp01 = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Heads are longer on the two heavy paths, so their last segment has to be longer too.
export const HEAD_SIZE = {edge: 9, ink: 9, teal: 11, orange: 11, violet: 10} as const;
type Marker = keyof typeof HEAD_SIZE;
const MARKER_COLOR: Record<Marker, string> = {edge: C.edge, ...TONES};
const HEAVY = new Set<Tone>(['teal', 'orange']);

export type Light = {
  lits: Record<string, number>;
  play: number; // 1 while a route is followed and the rest dims, 0 in the overview
  frame: number;
  isCurrent: (edgeId: string) => boolean;
};

export const NO_LIGHT: Light = {lits: {}, play: 0, frame: 0, isCurrent: () => false};

const TITLE: React.CSSProperties = {fontFamily: SANS, fontWeight: 600, fontSize: 13.5};
const SMALL: React.CSSProperties = {fontFamily: SANS, fontSize: 12};
const MONO_SMALL: React.CSSProperties = {fontFamily: MONO, fontSize: 11.5};

const NodeBox: React.FC<{node: DiagramNode; fade: number; light: Light}> = ({node, fade, light}) => {
  const [x, y, w, h] = node.box;
  const hue = HUES[node.hue];
  const L = fade * light.play;
  const width0 = node.quiet ? 1 : 1.25;
  const pad = node.pad ?? 12;
  const textX = node.center ? x + w / 2 : x + pad;
  const anchor = node.center ? 'middle' : 'start';
  let lineY = y + 22;
  return (
    <g data-box="node" opacity={1 - light.play + light.play * (0.5 + 0.5 * fade)}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={interpolateColors(L, [0, 1], [node.nested ? hue.inner : hue.fill, hue.lit])}
        stroke={interpolateColors(L, [0, 1], [hue.line, hue.ink])}
        strokeWidth={width0 + (2 - width0) * L}
      />
      <text data-identity x={textX} y={lineY} textAnchor={anchor} style={{...TITLE, fontSize: node.titleSize ?? 13.5, fill: hue.ink}}>
        {node.title}
      </text>
      {node.aside ? (
        <text x={textX + node.aside.dx} y={lineY} style={{...SMALL, fill: C.muted}}>
          {node.aside.text}
        </text>
      ) : null}
      {(node.lines ?? []).map((line, i) => {
        lineY += line.dy ?? 18;
        const color = line.accent ? ACCENTS[line.accent] : line.key ? hue.ink : C.muted;
        const font = line.mono || line.key || line.accent ? MONO_SMALL : SMALL;
        return (
          <text key={i} data-identity={line.key ? '' : undefined} x={textX} y={lineY} textAnchor={anchor} style={{...font, fontWeight: line.accent ? 600 : 400, fill: color}}>
            {line.text}
          </text>
        );
      })}
    </g>
  );
};

const EdgeLabel: React.FC<{label: Label; color: string}> = ({label, color}) => (
  <text
    data-label
    x={label.x}
    y={label.y}
    textAnchor={label.anchor ?? 'start'}
    style={{
      ...(label.mono ? {fontFamily: MONO, fontSize: 11} : SMALL),
      fill: color,
      paintOrder: 'stroke',
      stroke: C.panel,
      strokeWidth: 4,
      strokeLinejoin: 'round',
    }}
  >
    {label.text}
  </text>
);

const EdgeLine: React.FC<{edge: Edge; fade: number; light: Light}> = ({edge, fade, light}) => {
  const L = fade * light.play;
  const cur = light.isCurrent(edge.id);
  const color = edge.tone ? TONES[edge.tone] : interpolateColors(L, [0, 1], [C.edge, C.ink]);
  const base = edge.tone && HEAVY.has(edge.tone) ? 2.25 : 1.5;
  const marker: Marker = edge.tone ?? (L > 0.5 ? 'ink' : 'edge');
  const url = `url(#head-${marker})`;
  return (
    <g opacity={1 - light.play + light.play * (0.3 + 0.7 * fade)}>
      {edge.paths.map((p) => (
        <path
          key={p.d}
          d={p.d}
          data-line
          data-edge={edge.id}
          data-tone={edge.tone ?? 'ink'}
          data-head={p.arrow ? HEAD_SIZE[edge.tone ?? 'ink'] : undefined}
          data-both={p.arrow === 'both' ? '' : undefined}
          fill="none"
          stroke={color}
          strokeWidth={cur ? 3 : base + (2.5 - base) * L}
          strokeDasharray={cur ? '9 6' : edge.dotted ? '2 4' : 'none'}
          strokeDashoffset={cur ? -light.frame * 0.625 : 0}
          markerEnd={p.arrow ? url : undefined}
          markerStart={p.arrow === 'both' ? url : undefined}
        />
      ))}
      {(edge.labels ?? []).map((label) => (
        <EdgeLabel key={label.text} label={label} color={label.accent ? ACCENTS[label.accent] : edge.tone ? TONES[edge.tone] : C.ink} />
      ))}
    </g>
  );
};

const LegendRows: React.FC<{hueOpacity: number}> = ({hueOpacity}) => {
  const {at, paths, hues} = DIAGRAM.legend;
  return (
    <g data-legend>
      {paths.map((row, i) => (
        <g key={row.label} transform={`translate(${at[0]} ${at[1] + i * 24})`}>
          <line x1={0} x2={26} y1={0} y2={0} stroke={row.tone ? TONES[row.tone] : C.edge} strokeWidth={2.5} strokeDasharray={row.dotted ? '2 4' : undefined} />
          <text x={34} y={4} style={{...SMALL, fill: C.muted}}>
            {row.label}
          </text>
        </g>
      ))}
      {hues.map((row, i) => (
        <g key={row.hue} transform={`translate(${at[0] + LEGEND_HUE_DX} ${at[1] + i * 24})`} opacity={hueOpacity}>
          <rect x={0} y={-7} width={20} height={14} rx={2} fill={HUES[row.hue].fill} stroke={HUES[row.hue].line} strokeWidth={1.25} />
          <text x={28} y={4} style={{...SMALL, fill: C.muted}}>
            {row.label}
          </text>
        </g>
      ))}
    </g>
  );
};

export const LEGEND_HUE_DX = 176;

export const DiagramSvg: React.FC<{viewBox: string; light: Light; hueOpacity?: number; children?: React.ReactNode}> = ({viewBox, light, hueOpacity = 1, children}) => {
  const fade = (id: string) => (light.lits[id] === undefined ? 0 : interpolate(light.frame - light.lits[id], [0, 10], [0, 1], clamp01));
  return (
    <svg id="map" viewBox={viewBox} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', textRendering: 'geometricPrecision'}}>
      <defs>
        {(Object.keys(HEAD_SIZE) as Marker[]).map((m) => (
          <marker key={m} id={`head-${m}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={HEAD_SIZE[m]} markerHeight={HEAD_SIZE[m]} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={MARKER_COLOR[m]} />
          </marker>
        ))}
      </defs>
      {(DIAGRAM.bands ?? []).map((b) => (
        <g key={b.id} data-box="band">
          <rect x={b.box[0]} y={b.box[1]} width={b.box[2]} height={b.box[3]} rx={3} fill={C.band} stroke={C.line} />
          <text x={b.labelAt[0]} y={b.labelAt[1]} style={{...SMALL, fill: C.muted}}>
            {b.label}
          </text>
        </g>
      ))}
      {(DIAGRAM.notes ?? []).map((n) => (
        <text key={n.text} x={n.x} y={n.y} style={{...MONO_SMALL, fill: n.hue ? HUES[n.hue].ink : C.muted}}>
          {n.text}
        </text>
      ))}
      {DIAGRAM.nodes.map((node) => (
        <NodeBox key={node.id} node={node} fade={fade(node.id)} light={light} />
      ))}
      {DIAGRAM.edges.map((edge) => (
        <EdgeLine key={edge.id} edge={edge} fade={fade(edge.id)} light={light} />
      ))}
      <LegendRows hueOpacity={hueOpacity} />
      {children}
    </svg>
  );
};
