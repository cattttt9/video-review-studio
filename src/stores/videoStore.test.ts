import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachVideoElement, useVideoStore, videoActions } from './videoStore';

afterEach(() => {
  attachVideoElement(null);
  useVideoStore.setState({ currentTimeMs: 0, durationMs: 0, playing: false });
});

describe('videoActions.seek', () => {
  it('remembers a record time while the video element is unmounted for annotation', () => {
    useVideoStore.setState({ durationMs: 200_000 });

    videoActions.seek(29_000);

    expect(useVideoStore.getState().currentTimeMs).toBe(29_000);
  });

  it('applies the remembered time to an attached video element', () => {
    const video = {
      currentTime: 0,
      duration: 200,
      paused: true,
      play: vi.fn(),
      pause: vi.fn(),
    } as unknown as HTMLVideoElement;
    attachVideoElement(video);

    videoActions.seek(29_000);

    expect(video.currentTime).toBe(29);
    expect(useVideoStore.getState().currentTimeMs).toBe(29_000);
  });
});
