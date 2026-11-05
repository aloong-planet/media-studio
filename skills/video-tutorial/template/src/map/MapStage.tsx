import React from 'react';
import {getLength, getPointAtLength} from '@remotion/paths';
import {Easing, interpolate} from 'remotion';
import {DIAGRAM} from '../data/diagram';
import {C, MONO, TONES, Tone} from '../theme';
import {FPS, Flow, SEGS, Seg, flowStart, litAt, playAt, viewAt} from '../timeline';
import {DiagramSvg, LEGEND_HUE_DX} from './DiagramSvg';
import {EDGES, FULL_VIEW, NODES, ROUTES, STAGE} from './geometry';

const clamp01 = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const lengths = new Map<string, number>();
const lengthOf = (d: string) => {
  if (!lengths.has(d)) lengths.set(d, getLength(d));
  return lengths.get(d)!;
};
const flowFrames = (d: string) => Math.round(Math.min(1.3, Math.max(0.45, lengthOf(d) / 300)) * FPS);
const flowTone = (f: Flow): Tone => EDGES[ROUTES[f.p].edge]?.tone ?? 'ink';

const Packet: React.FC<{seg: Seg; flow: Flow; local: number}> = ({seg, flow, local}) => {
  const {d} = ROUTES[flow.p];
  const dur = flowFrames(d);
  const t = (local - flowStart(seg, flow)) / dur;
  if (t < 0 || t > 1.3) return null;
  const len = lengthOf(d);
  const ease = Easing.inOut(Easing.quad);
  const at = (v: number) => getPointAtLength(d, len * ease(Math.min(1, Math.max(0, v))))!;
  const color = TONES[flowTone(flow)];
  const fade = t > 1 ? 1 - (t - 1) / 0.3 : 1;
  const head = at(t);
  return (
    <g opacity={fade}>
      {[6, 5, 4, 3, 2, 1].map((k) => {
        const p = at(t - k * 0.035);
        return <circle key={k} cx={p.x} cy={p.y} r={6.5 - k * 0.7} fill={color} opacity={0.34 - k * 0.05} />;
      })}
      <circle cx={head.x} cy={head.y} r={15} fill={color} opacity={0.2} />
      <circle cx={head.x} cy={head.y} r={7} fill={color} stroke={C.panel} strokeWidth={2} />
    </g>
  );
};

const Pulses: React.FC<{seg: Seg; local: number}> = ({seg, local}) => {
  const first = seg.flows[0];
  const at = first ? flowStart(seg, first) + flowFrames(ROUTES[first.p].d) - 4 : seg.audioAt;
  const t = (local - at) / 22;
  if (t < 0 || t > 1) return null;
  const color = TONES[first ? flowTone(first) : 'ink'];
  return (
    <g fill="none" stroke={color} strokeWidth={2.5} opacity={1 - t}>
      {seg.n.map((id) => {
        const [x, y, w, h] = NODES[id].box;
        const g = t * 10;
        return <rect key={id} x={x - g} y={y - g} width={w + 2 * g} height={h + 2 * g} rx={4} />;
      })}
    </g>
  );
};

const stepTone = (seg: Seg): Tone => seg.e.map((id) => EDGES[id].tone).find(Boolean) ?? 'ink';

// Passed steps are hollow and the current one is solid; the colour follows the route the step travels.
const Badge: React.FC<{n: number; at: [number, number]; now: boolean; pop: number; tone: Tone; edges: string[]}> = ({n, at, now, pop, tone, edges}) => {
  const color = TONES[tone];
  const r = now ? 9 : 8;
  return (
    <g data-badge data-tone={tone} data-edges={edges.join(' ')} data-now={now ? '' : undefined} data-x={at[0]} data-y={at[1]} data-r={r} data-font={10.5} transform={`translate(${at[0]} ${at[1]}) scale(${pop})`}>
      <circle r={r} fill={now ? color : C.panel} stroke={color} strokeWidth={1.25} />
      <text textAnchor="middle" dominantBaseline="central" style={{font: `600 10.5px ${MONO}`, fill: now ? (tone === 'ink' ? C.panel : C.onHue) : color}}>
        {n}
      </text>
    </g>
  );
};

const Badges: React.FC<{frame: number; idx: number}> = ({frame, idx}) => {
  const seg = SEGS[idx];
  if (seg.kind !== 'step' && seg.kind !== 'wrap') return null;
  const steps = SEGS.filter((s) => s.chapter === seg.chapter && s.kind === 'step' && s.start <= frame);
  return (
    <>
      {steps.map((s) => (
        <Badge
          key={s.id}
          n={s.stepNo!}
          at={s.at!}
          now={s.id === seg.id}
          tone={stepTone(s)}
          edges={s.e}
          pop={interpolate(frame - s.start, [0, 8], [0.4, 1], {...clamp01, easing: Easing.out(Easing.back(2))})}
        />
      ))}
    </>
  );
};

export const MapStage: React.FC<{frame: number; idx: number}> = ({frame, idx}) => {
  const seg = SEGS[idx];
  const local = frame - seg.start;
  const v = viewAt(frame, idx);
  const lits = litAt(frame, idx);
  // When zoomed in, cropped neighbours fade out instead of being cut mid-word.
  const edge = interpolate(v.w, [FULL_VIEW.w * 0.82, FULL_VIEW.w * 0.97], [90, 0], clamp01);
  const mask: React.CSSProperties =
    edge > 0
      ? {
          maskImage: `linear-gradient(to right, transparent, black ${edge}px, black calc(100% - ${edge}px), transparent), linear-gradient(to bottom, transparent, black ${edge * 0.6}px, black calc(100% - ${edge * 0.6}px), transparent)`,
          maskComposite: 'intersect',
        }
      : {};
  // Once the crop reaches the swatches, the labels would be left hanging at the edge without them.
  const hueX = DIAGRAM.legend.at[0] + LEGEND_HUE_DX;
  const hueOpacity = interpolate(v.x + (edge * v.w) / STAGE.width - hueX, [-30, 0], [1, 0], clamp01);
  const isCurrent = (id: string) => seg.e.includes(id) && lits[id] !== undefined && frame >= lits[id] && seg.kind !== 'wrap';
  return (
    <div
      style={{
        position: 'absolute',
        left: STAGE.left,
        top: STAGE.top,
        width: STAGE.width,
        height: STAGE.height,
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div style={{position: 'absolute', inset: 0, ...mask}}>
        <DiagramSvg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} hueOpacity={hueOpacity} light={{lits, play: playAt(frame, idx), frame, isCurrent}}>
          <Pulses seg={seg} local={local} />
          {seg.flows.map((f) => (
            <Packet key={f.p + (f.delay ?? 0)} seg={seg} flow={f} local={local} />
          ))}
          <Badges frame={frame} idx={idx} />
        </DiagramSvg>
      </div>
    </div>
  );
};
