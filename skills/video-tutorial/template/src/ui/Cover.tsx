import React from 'react';
import {AbsoluteFill} from 'remotion';
import '../fonts';
import {Measure} from '../check/Measure';
import {DIAGRAM} from '../data/diagram';
import {DiagramSvg, NO_LIGHT} from '../map/DiagramSvg';
import {C, DISPLAY, SANS} from '../theme';
import {META, NUMBERED} from '../timeline';

const SCALE = META.titleScale ?? 1;
const WHOLE_DIAGRAM = DIAGRAM.view.join(' ');

const Title: React.FC<{size: number; left: number; top: number}> = ({size, left, top}) => (
  <div style={{position: 'absolute', left, top, fontFamily: DISPLAY, fontWeight: 600, fontSize: size * SCALE, lineHeight: 1.2, color: C.ink, whiteSpace: 'nowrap'}}>{META.title}</div>
);

const Subtitle: React.FC<{size: number; left: number; top: number}> = ({size, left, top}) => (
  <div style={{position: 'absolute', left, top, fontFamily: SANS, fontSize: size, lineHeight: 1.3, color: C.muted, whiteSpace: 'nowrap'}}>{META.subtitle}</div>
);

const Panel: React.FC<{top: number; height: number}> = ({top, height}) => (
  <div style={{position: 'absolute', left: 48, right: 48, top, height, overflow: 'hidden', border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel}}>
    <DiagramSvg viewBox={WHOLE_DIAGRAM} light={NO_LIGHT} />
  </div>
);

export const Cover43: React.FC = () => (
  <AbsoluteFill id="frame" style={{background: C.bg}}>
    <Title size={72} left={48} top={56} />
    <Subtitle size={36} left={50} top={148} />
    <Panel top={220} height={604} />
    <div style={{position: 'absolute', left: 48, right: 48, top: 848, display: 'grid', gridTemplateColumns: `repeat(${NUMBERED.length}, 1fr)`, gap: 14}}>
      {NUMBERED.map((ch) => (
        <div key={ch.tab} data-fit style={{height: 168, overflow: 'hidden', padding: '20px 18px', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel}}>
          <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 30, lineHeight: 1.3, color: C.ink, whiteSpace: 'nowrap'}}>{ch.tab}</div>
          <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 24, lineHeight: 1.4, color: C.muted, marginTop: 14}}>{ch.result}</div>
        </div>
      ))}
    </div>
    <Measure tag="cover-4x3" />
  </AbsoluteFill>
);

export const Cover34: React.FC = () => (
  <AbsoluteFill id="frame" style={{background: C.bg}}>
    <Title size={60} left={48} top={62} />
    <Subtitle size={34} left={50} top={146} />
    <Panel top={220} height={438} />
    <div style={{position: 'absolute', left: 48, top: 690, padding: '10px 24px', fontFamily: DISPLAY, fontWeight: 600, fontSize: 46, color: C.bg, background: C.ink, borderRadius: 6, whiteSpace: 'nowrap'}}>{META.outro.heading}</div>
    {/* The rows share one height, so fewer chapters spread out instead of leaving the bottom empty. */}
    <div style={{position: 'absolute', left: 48, right: 48, top: 796, height: 565, display: 'flex', flexDirection: 'column'}}>
      {NUMBERED.map((ch) => (
        <div key={ch.tab} style={{flex: 1, display: 'flex', alignItems: 'center', borderTop: `1px solid ${C.line}`}}>
          <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, whiteSpace: 'nowrap'}}>
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 46, color: C.ink}}>{ch.tab}</div>
            <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 34, color: C.muted}}>{ch.result}</div>
          </div>
        </div>
      ))}
    </div>
    <Measure tag="cover-3x4" />
  </AbsoluteFill>
);
