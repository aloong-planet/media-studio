import React from 'react';
import {Easing, interpolate} from 'remotion';
import {C, DISPLAY, MONO, SANS} from '../theme';
import {CHAPTERS, Chapter, META, NUMBERED, SEGS, Seg, TOTAL_FRAMES} from '../timeline';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const quote = (c: Chapter) => (c.plain ? c.quote : `「${c.quote}」`);

export const Header: React.FC<{seg: Seg; frame: number}> = ({seg, frame}) => {
  const ch = CHAPTERS[seg.chapter];
  if (seg.kind === 'title' || seg.kind === 'outro' || seg.kind === 'card') return null;
  const local = frame - seg.start;
  const heading = ch.no ? `${META.unit} ${ch.no} / ${NUMBERED.length} · ${ch.tab}` : ch.label;
  const sub = ch.no ? `${ch.source}：${quote(ch)}` : ch.sub;
  const resultIn = seg.kind === 'wrap' ? interpolate(local, [6, 18], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.4))}) : 0;
  return (
    <div style={{opacity: seg.stepNo === 1 ? interpolate(local, [0, 12], [0, 1], clamp) : 1, position: 'absolute', left: 40, right: 40, top: 26, height: 84, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
      <div style={{minWidth: 0}}>
        <div style={{fontFamily: DISPLAY, fontWeight: 600, fontSize: 36, color: C.ink, lineHeight: 1.25}}>{heading}</div>
        <div style={{fontFamily: SANS, fontSize: 25, color: C.muted, lineHeight: 1.4}}>{sub}</div>
      </div>
      {seg.kind === 'step' ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontSize: 24, color: C.muted}}>
          <span>步骤 {seg.stepNo} / {seg.stepTotal}</span>
          <div style={{display: 'flex', gap: 8}}>
            {Array.from({length: seg.stepTotal!}, (_, i) => (
              <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: i < seg.stepNo! ? C.ink : C.line}} />
            ))}
          </div>
        </div>
      ) : null}
      {seg.kind === 'wrap' ? (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 40,
            color: C.bg,
            background: C.ink,
            padding: '10px 26px',
            borderRadius: 4,
            opacity: Math.min(1, resultIn),
            transform: `scale(${0.85 + 0.15 * resultIn})`,
          }}
        >
          {ch.result}
        </div>
      ) : null}
    </div>
  );
};

export const Subtitle: React.FC<{seg: Seg; frame: number}> = ({seg, frame}) => {
  const local = frame - seg.start;
  const cue = seg.cues.find((c) => local >= c.s && local < c.e);
  if (!cue) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 918,
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: 46,
        lineHeight: 1.3,
        color: C.ink,
        opacity: interpolate(local, [cue.s, cue.s + 3], [0.2, 1], clamp),
      }}
    >
      {cue.text}
    </div>
  );
};

const FULL: React.CSSProperties = {position: 'absolute', left: 40, top: 124, width: 1840, height: 776, borderRadius: 4};

const scrimOpacity = (seg: Seg, local: number) =>
  interpolate(local, [0, 10, seg.dur - 12, seg.dur], [seg.kind === 'title' ? 0.97 : 0, 0.97, 0.97, 0], clamp);

export const ChapterCard: React.FC<{seg: Seg; frame: number}> = ({seg, frame}) => {
  if (seg.kind !== 'card') return null;
  const local = frame - seg.start;
  const ch = CHAPTERS[seg.chapter];
  const rise = interpolate(local, [4, 22], [18, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const textOp = interpolate(local, [4, 16, seg.dur - 12, seg.dur - 2], [0, 1, 1, 0], clamp);
  return (
    <div style={{...FULL, background: C.bg, opacity: scrimOpacity(seg, local), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{opacity: textOp, transform: `translateY(${rise}px)`, textAlign: 'center', padding: '0 120px'}}>
        <div style={{fontFamily: SANS, fontSize: 32, color: C.muted, marginBottom: 28}}>
          第 {ch.no} 个{META.unit} · {ch.tab}
        </div>
        <div style={{fontFamily: DISPLAY, fontWeight: 600, fontSize: 84, color: C.ink, lineHeight: 1.3}}>{quote(ch)}</div>
        <div style={{fontFamily: SANS, fontSize: 30, color: C.muted, marginTop: 32}}>{ch.source}</div>
      </div>
    </div>
  );
};

export const TitleCard: React.FC<{seg: Seg; frame: number}> = ({seg, frame}) => {
  if (seg.kind !== 'title') return null;
  const local = frame - seg.start;
  const op = interpolate(local, [6, 24, seg.dur - 12, seg.dur - 2], [0, 1, 1, 0], clamp);
  return (
    <div style={{...FULL, background: C.bg, opacity: scrimOpacity(seg, local), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{opacity: op, textAlign: 'center'}}>
        <div style={{fontFamily: DISPLAY, fontWeight: 600, fontSize: 112 * (META.titleScale ?? 1), color: C.ink, whiteSpace: 'nowrap'}}>{META.title}</div>
        <div style={{fontFamily: SANS, fontSize: 40, color: C.muted, marginTop: 26, whiteSpace: 'nowrap'}}>{META.subtitle}</div>
        {META.note ? <div style={{fontFamily: SANS, fontSize: 26, color: C.muted, marginTop: 40}}>{META.note}</div> : null}
      </div>
    </div>
  );
};

export const Outro: React.FC<{seg: Seg; frame: number}> = ({seg, frame}) => {
  if (seg.kind !== 'outro') return null;
  const local = frame - seg.start;
  const lastEnd = seg.cues[seg.cues.length - 1].e;
  const sourceOp = interpolate(local, [lastEnd, lastEnd + 14], [0, 1], clamp);
  return (
    <div style={{...FULL, background: C.bg, opacity: interpolate(local, [0, 12], [0, 1], clamp), padding: '48px 96px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <div style={{fontFamily: DISPLAY, fontWeight: 600, fontSize: 56, color: C.ink, marginBottom: 24}}>{META.outro.heading}</div>
      {NUMBERED.map((ch, i) => {
        const at = seg.cues[i + 1]?.s ?? 0; // The outro's first line is the heading; each later line brings in one row.
        return (
          <div key={ch.tab} style={{opacity: interpolate(local, [at, at + 10], [0.12, 1], clamp), display: 'grid', gridTemplateColumns: '330px 1fr auto', alignItems: 'baseline', gap: 24, padding: '19px 0', borderTop: `1px solid ${C.line}`}}>
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.ink}}>{ch.tab}</div>
            <div style={{fontFamily: SANS, fontSize: 27, color: C.muted}}>{ch.source}：{quote(ch)}</div>
            <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 29, color: C.ink}}>{ch.result}</div>
          </div>
        );
      })}
      <div style={{opacity: sourceOp, fontFamily: MONO, fontSize: 21, color: C.muted, marginTop: 24, lineHeight: 1.6}}>
        {META.outro.sources.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
};

export const ProgressBar: React.FC<{frame: number}> = ({frame}) => {
  const chapters = [...new Set(SEGS.map((s) => s.chapter))];
  return (
    <div style={{position: 'absolute', left: 40, top: 1056, width: 1840, height: 4, display: 'flex', gap: 4}}>
      {chapters.map((id) => {
        const segs = SEGS.filter((s) => s.chapter === id);
        const start = segs[0].start;
        const end = segs[segs.length - 1].start + segs[segs.length - 1].dur;
        const done = interpolate(frame, [start, end], [0, 100], clamp);
        return (
          <div key={id} style={{flex: `${(end - start) / TOTAL_FRAMES} 0 0`, background: C.line, borderRadius: 2, overflow: 'hidden'}}>
            <div style={{width: `${done}%`, height: '100%', background: C.muted}} />
          </div>
        );
      })}
    </div>
  );
};
