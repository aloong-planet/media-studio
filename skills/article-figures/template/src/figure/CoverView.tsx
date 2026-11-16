import React from 'react';
import {AbsoluteFill} from 'remotion';
import '../fonts';
import {Measure} from '../check/Measure';
import {FIGURES} from '../data/figures';
import {DiagramSvg, NO_LIGHT} from '../map/DiagramSvg';
import {C, SANS} from '../theme';
import {FigureProps} from './FigureView';

// The cover: the English title and a one-sentence subtitle on the left, the article's subject as a simple diagram on the right.
export const CoverView: React.FC<FigureProps> = ({id}) => {
  const f = FIGURES.find((x) => x.id === id)!;
  return (
    <AbsoluteFill id="frame" style={{background: C.bg}}>
      <div style={{position: 'absolute', left: 96, top: 0, bottom: 0, width: 840, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
        <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 72, lineHeight: 1.15, color: C.ink}}>{f.title}</div>
        <div style={{fontFamily: SANS, fontSize: 34, lineHeight: 1.35, color: C.muted}}>{f.subtitle}</div>
      </div>
      <div style={{position: 'absolute', left: 1016, top: 72, width: 808, height: 676, boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 8, background: C.panel}}>
        <div style={{position: 'absolute', inset: 36}}>
          <DiagramSvg diagram={f.diagram} light={NO_LIGHT} />
        </div>
      </div>
      <Measure />
    </AbsoluteFill>
  );
};
