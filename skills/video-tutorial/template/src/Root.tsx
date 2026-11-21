import React from 'react';
import {Composition} from 'remotion';
import {FPS, TOTAL_FRAMES} from './timeline';
import {COVERS} from './ui/Cover';
import {Walkthrough} from './Walkthrough';

export const Root: React.FC = () => (
  <>
    <Composition id="Walkthrough" component={Walkthrough} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
    {COVERS.map((c) => (
      <Composition key={c.id} id={c.id} component={c.component} durationInFrames={1} fps={FPS} width={c.width} height={c.height} />
    ))}
  </>
);
