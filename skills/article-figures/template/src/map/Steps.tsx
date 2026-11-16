import React from 'react';
import {getLength, getPointAtLength} from '@remotion/paths';
import {Easing, interpolate} from 'remotion';
import {C, MONO, TONES, Tone} from '../theme';
import {GifState, GifTiming, Step} from '../timeline';
import {Diagram, routesOf} from './geometry';

const clamp01 = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const DOT_DELAY = 2; // frames after the step begins

const lengths = new Map<string, number>();
const lengthOf = (d: string) => {
  if (!lengths.has(d)) lengths.set(d, getLength(d));
  return lengths.get(d)!;
};

// A dot with a short trail travels the route once, then fades out before the step ends.
const Dot: React.FC<{d: string; tone: Tone; local: number; fps: number}> = ({d, tone, local, fps}) => {
  const len = lengthOf(d);
  const dur = Math.round(Math.min(1, Math.max(0.45, len / 300)) * fps);
  const t = (local - DOT_DELAY) / dur;
  if (t < 0 || t > 1.3) return null;
  const ease = Easing.inOut(Easing.quad);
  const at = (v: number) => getPointAtLength(d, len * ease(Math.min(1, Math.max(0, v))))!;
  const color = TONES[tone];
  const head = at(t);
  return (
    <g opacity={t > 1 ? 1 - (t - 1) / 0.3 : 1}>
      {[4, 3, 2, 1].map((k) => {
        const p = at(t - k * 0.05);
        return <circle key={k} cx={p.x} cy={p.y} r={6.5 - k} fill={color} opacity={0.34 - k * 0.06} />;
      })}
      <circle cx={head.x} cy={head.y} r={7} fill={color} stroke={C.panel} strokeWidth={2} />
    </g>
  );
};

// Passed steps are hollow and the current one is solid; the colour follows the line the step lights.
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

export const StepMarks: React.FC<{diagram: Diagram; steps: Step[]; state: GifState; timing: GifTiming}> = ({diagram, steps, state, timing}) => {
  const routes = routesOf(diagram);
  const toneOf = (edgeId: string): Tone => diagram.edges.find((e) => e.id === edgeId)?.tone ?? 'ink';
  const stepTone = (s: Step): Tone => s.e.map(toneOf).find((t) => t !== 'ink') ?? 'ink';
  const current = state.step === null ? null : steps[state.step];
  return (
    <>
      {(current?.flows ?? current?.e ?? []).map((id) => (
        <Dot key={id} d={routes[id].d} tone={toneOf(routes[id].edge)} local={state.local} fps={timing.fps} />
      ))}
      {state.badges.map((b) => (
        <Badge
          key={b.step}
          n={b.step + 1}
          at={steps[b.step].at}
          now={b.now}
          tone={stepTone(steps[b.step])}
          edges={steps[b.step].e}
          pop={interpolate(b.since, [0, timing.fadeFrames], [0.4, 1], {...clamp01, easing: Easing.out(Easing.back(2))})}
        />
      ))}
    </>
  );
};
