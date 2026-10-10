import React from 'react';
import {Composition, Still} from 'remotion';
import {Main} from './Main';
import {ThumbScene} from './scenesC';
import {DURATION_FRAMES, FPS} from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="Main16x9" component={Main} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="Main9x16" component={Main} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="Thumb16x9" component={ThumbScene} width={1920} height={1080} />
    <Still id="Thumb9x16" component={ThumbScene} width={1080} height={1920} />
  </>
);
