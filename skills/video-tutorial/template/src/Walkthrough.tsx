import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Measure} from './check/Measure';
import './fonts';
import {MapStage} from './map/MapStage';
import {C, SANS} from './theme';
import {SEGS, TOTAL_FRAMES, segIndexAt} from './timeline';
import {ChapterCard, Header, Outro, ProgressBar, Subtitle, TitleCard} from './ui/Overlays';

export const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = segIndexAt(frame);
  const seg = SEGS[idx];
  const fade = interpolate(frame, [0, 14, TOTAL_FRAMES - 18, TOTAL_FRAMES - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill id="frame" style={{background: C.bg, fontFamily: SANS}}>
      {SEGS.filter((s) => s.audio).map((s) => (
        <Sequence key={s.id} from={s.start + s.audioAt} name={`voice ${s.id}`} layout="none">
          <Audio src={staticFile(s.audio!)} />
        </Sequence>
      ))}
      <AbsoluteFill style={{opacity: fade}}>
        <Header seg={seg} frame={frame} />
        <MapStage frame={frame} idx={idx} />
        <TitleCard seg={seg} frame={frame} />
        <ChapterCard seg={seg} frame={frame} />
        <Outro seg={seg} frame={frame} />
        <Subtitle seg={seg} frame={frame} />
        <ProgressBar frame={frame} />
      </AbsoluteFill>
      <Measure tag={seg.id} />
    </AbsoluteFill>
  );
};
