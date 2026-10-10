import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Caption, Scene} from './kit';
import {CAPTIONS} from './captions';
import {TM} from './theme';
import {HookScene, NotebookScene, MissingScene, FamiliarScene, PainIntro, PaperScene, ChatsScene, SheetScene, OnePersonScene, ExhaustingScene} from './scenesA';
import {RevealScene, POSScene, BookingScene, PMScene, PDFScene} from './scenesB';
import {DifferentScene, BuildAroundScene, TaglineScene, CTAScene} from './scenesC';

export const Main: React.FC = () => {
  const cuts: [React.FC, number, number, 'angle' | 'hex' | 'up' | 'none' | 'flash', [number, number]?][] = [
    [HookScene, 0, 3.0, 'none'],
    [NotebookScene, 3.0, 4.7, 'angle'],
    [MissingScene, 4.7, 6.47, 'angle'],
    [FamiliarScene, 6.47, 8.66, 'hex'],
    [PainIntro, 8.66, 10.28, 'angle'],
    [PaperScene, 10.28, 10.9, 'up'],
    [ChatsScene, 10.9, 11.98, 'angle'],
    [SheetScene, 11.98, 12.75, 'up'],
    [OnePersonScene, 12.75, 14.54, 'angle'],
    [ExhaustingScene, 14.54, 15.7, 'angle'],
    [RevealScene, 15.7, 19.55, 'none'],
    [POSScene, 19.55, 21.54, 'angle'],
    [BookingScene, 21.54, 23.78, 'angle'],
    [PMScene, 23.78, 25.65, 'angle'],
    [PDFScene, 25.65, 28.65, 'angle'],
    [DifferentScene, 28.65, 30.79, 'hex'],
    [BuildAroundScene, 30.79, 33.65, 'angle'],
    [TaglineScene, 33.65, 35.38, 'angle'],
    [CTAScene, 35.38, 40, 'hex'],
  ];
  return (
    <AbsoluteFill style={{background: '#031C38'}}>
      {cuts.map(([S, a, b, wipe, hc], i) => (
        <Scene key={i} start={a} end={b} wipe={wipe} hexCenter={hc} z={i}>
          <S />
        </Scene>
      ))}
      <Caption chunks={CAPTIONS} />
    </AbsoluteFill>
  );
};
