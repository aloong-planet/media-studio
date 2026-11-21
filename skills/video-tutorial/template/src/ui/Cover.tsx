// The covers: for each platform src/data/cover.tsx names, the covers platforms.ts gives it, each in the same frame:
// the title on one line, the subtitle, and the area in which src/data/cover.tsx draws the video's main visual.
import React, {useEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {fontsLoaded} from '../fonts';
import {Measure} from '../check/Measure';
import {CoverBody, PLATFORMS} from '../data/cover';
import {C, DISPLAY, SANS} from '../theme';
import {META} from '../timeline';
import {Cover, FRAMES, MARGIN, coversFor, fitTitle} from './platforms';

const CoverFrame: React.FC<{cover: Cover}> = ({cover}) => {
  const f = FRAMES[cover.ratio];
  const frame = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('fit the title'));
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    fontsLoaded.then(() => {
      const t = title.current!;
      // In the drawing's pixels, so a preview scaled to the screen fits the title as the render does.
      const k = f.width / frame.current!.getBoundingClientRect().width;
      const fitted = fitTitle(f.title.size, f.width - 2 * MARGIN, (s) => {
        t.style.fontSize = `${s}px`;
        return t.getBoundingClientRect().width * k;
      });
      t.style.fontSize = `${fitted}px`;
      setSize(fitted);
    });
  }, [f]);
  // Measure, rendered with the fitted title, holds the render until it has measured.
  useEffect(() => {
    if (size !== null) continueRender(handle);
  }, [size, handle]);
  return (
    <AbsoluteFill ref={frame} id="frame" style={{background: C.bg}}>
      <div ref={title} style={{position: 'absolute', left: MARGIN, top: f.title.top, fontFamily: DISPLAY, fontWeight: 600, fontSize: size ?? f.title.size, lineHeight: 1.2, color: C.ink, whiteSpace: 'nowrap'}}>
        {META.title}
      </div>
      <div style={{position: 'absolute', left: MARGIN + 2, top: f.subtitle.top, fontFamily: SANS, fontSize: f.subtitle.size, lineHeight: 1.3, color: C.muted, whiteSpace: 'nowrap'}}>{META.subtitle}</div>
      <div data-area style={{position: 'absolute', left: MARGIN, top: f.area.top, width: f.width - 2 * MARGIN, height: f.area.bottom - f.area.top}}>
        <CoverBody ratio={cover.ratio} width={f.width - 2 * MARGIN} height={f.area.bottom - f.area.top} />
      </div>
      {size !== null ? <Measure tag={`cover-${cover.file}`} cover={cover} /> : null}
    </AbsoluteFill>
  );
};

const frameFor = (cover: Cover): React.FC => {
  const CoverStill: React.FC = () => <CoverFrame cover={cover} />;
  return CoverStill;
};

export const COVERS = coversFor(PLATFORMS).map((cover) => {
  const {width, height} = FRAMES[cover.ratio];
  return {id: `cover-${cover.file}`, width, height, component: frameFor(cover)};
});
