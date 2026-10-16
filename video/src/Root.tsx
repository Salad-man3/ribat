import { Composition } from 'remotion';
import { FPS } from './timeline';
import { Film, timeline } from './Film';

export const Root = () => (
  <Composition
    id="Ribat"
    component={Film}
    durationInFrames={Math.ceil(timeline.seconds * FPS)}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
