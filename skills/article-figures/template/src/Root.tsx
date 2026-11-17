import React from 'react';
import {Composition} from 'remotion';
import {FIGURES} from './data/figures';
import {CoverView} from './figure/CoverView';
import {FigureView} from './figure/FigureView';
import {COVER, figureLayout} from './figure/layout';
import {figureProblems} from './map/geometry';
import {GIF_FPS, gifTiming, measureFrames} from './timeline';

const problems = FIGURES.flatMap(figureProblems);
if (problems.length) throw new Error(problems.join('\n'));

export const Root: React.FC = () => (
  <>
    {FIGURES.map((f) => {
      const meta = {id: f.id, kind: f.kind, title: f.title};
      if (f.kind === 'cover') {
        return <Composition key={f.id} id={f.id} component={CoverView} defaultProps={{...meta, measureAt: [0], scale: 1}} durationInFrames={1} fps={GIF_FPS} {...COVER} />;
      }
      const {width, height} = figureLayout(f.id, f.diagram.view, f.subtitle);
      if (f.kind === 'still') {
        return <Composition key={f.id} id={f.id} component={FigureView} defaultProps={{...meta, measureAt: [0], scale: 3}} durationInFrames={1} fps={GIF_FPS} width={width} height={height} />;
      }
      const timing = gifTiming(f.steps.length, f.fps, f.stepSeconds, f.holdSeconds);
      return (
        <Composition
          key={f.id}
          id={f.id}
          component={FigureView}
          defaultProps={{...meta, measureAt: measureFrames(timing, f.steps.length), scale: 1.5}}
          durationInFrames={timing.total}
          fps={timing.fps}
          width={width}
          height={height}
        />
      );
    })}
  </>
);
