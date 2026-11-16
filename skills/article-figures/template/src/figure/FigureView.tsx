import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '../fonts';
import {Measure} from '../check/Measure';
import {FIGURES} from '../data/figures';
import {DiagramSvg, Light, NO_LIGHT} from '../map/DiagramSvg';
import {StepMarks} from '../map/Steps';
import {C, SANS} from '../theme';
import {gifStateAt, gifTiming} from '../timeline';
import {MARGIN, SUBTITLE, TITLE, figureLayout} from './layout';

// The props pnpm render reads: the kind of file, its title, the frames to measure and the scale it renders at.
export type FigureProps = {id: string; kind: 'still' | 'gif' | 'cover'; title: string; measureAt: number[]; scale: number};

// A figure: its title, an optional subtitle and the whole diagram. An animated one lights its steps in turn.
export const FigureView: React.FC<FigureProps> = ({id}) => {
  const frame = useCurrentFrame();
  const f = FIGURES.find((x) => x.id === id)!;
  if (f.kind === 'cover') throw new Error(`${id} is the cover`);
  const layout = figureLayout(f.id, f.diagram.view, f.subtitle);
  let light: Light = NO_LIGHT;
  let marks: React.ReactNode = null;
  if (f.kind === 'gif') {
    const timing = gifTiming(f.steps.length, f.fps, f.stepSeconds, f.holdSeconds);
    const ids = [...f.diagram.nodes.map((n) => n.id), ...f.diagram.edges.map((e) => e.id)];
    const state = gifStateAt(frame, f.steps, timing, ids);
    const current = state.step === null ? null : f.steps[state.step];
    light = {lits: state.lit, play: 1, frame, fadeFrames: timing.fadeFrames, isCurrent: (edge) => !!current?.e.includes(edge)};
    marks = <StepMarks diagram={f.diagram} steps={f.steps} state={state} timing={timing} />;
  }
  return (
    <AbsoluteFill id="frame" style={{background: C.panel}}>
      <div style={{position: 'absolute', left: MARGIN, top: MARGIN, fontFamily: SANS, fontWeight: 600, fontSize: TITLE.size, lineHeight: `${TITLE.line}px`, color: C.ink, whiteSpace: 'nowrap'}}>{f.title}</div>
      {f.subtitle ? (
        <div style={{position: 'absolute', left: MARGIN, top: layout.subtitleTop, fontFamily: SANS, fontSize: SUBTITLE.size, lineHeight: `${SUBTITLE.line}px`, color: C.muted, whiteSpace: 'nowrap'}}>{f.subtitle}</div>
      ) : null}
      <div style={{position: 'absolute', ...layout.diagram}}>
        <DiagramSvg diagram={f.diagram} light={light}>
          {marks}
        </DiagramSvg>
      </div>
      <Measure />
    </AbsoluteFill>
  );
};
