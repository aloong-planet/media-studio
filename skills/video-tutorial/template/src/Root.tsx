import React from 'react';
import {Composition} from 'remotion';
import {FPS, TOTAL_FRAMES} from './timeline';
import {Cover34, Cover43} from './ui/Cover';
import {Walkthrough} from './Walkthrough';

export const Root: React.FC = () => (
  <>
    <Composition id="Walkthrough" component={Walkthrough} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="Cover34" component={Cover34} durationInFrames={1} fps={FPS} width={1080} height={1440} />
    <Composition id="Cover43" component={Cover43} durationInFrames={1} fps={FPS} width={1440} height={1080} />
  </>
);
