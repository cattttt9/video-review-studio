import { create } from 'zustand';

let videoElement: HTMLVideoElement | null = null;

export function attachVideoElement(el: HTMLVideoElement | null) {
  videoElement = el;
}

export function getVideoElement(): HTMLVideoElement | null {
  return videoElement;
}

interface VideoState {
  currentTimeMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  ready: boolean;
  setCurrentTimeMs: (ms: number) => void;
  setDurationMs: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setReady: (ready: boolean) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  currentTimeMs: 0,
  durationMs: 0,
  playing: false,
  rate: 1,
  volume: 1,
  muted: false,
  ready: false,
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
  setDurationMs: (durationMs) => set({ durationMs }),
  setPlaying: (playing) => set({ playing }),
  setRate: (rate) => set({ rate }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setReady: (ready) => set({ ready }),
}));

export const videoActions = {
  togglePlay() {
    const el = videoElement;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  },
  seek(ms: number) {
    const el = videoElement;
    if (!el) return;
    const durationMs = Number.isFinite(el.duration) ? el.duration * 1000 : ms;
    const targetMs = Math.min(durationMs, Math.max(0, ms));
    useVideoStore.setState({ currentTimeMs: targetMs });
    el.currentTime = targetMs / 1000;
  },
  skip(seconds: number) {
    const el = videoElement;
    if (!el) return;
    this.seek((el.currentTime + seconds) * 1000);
  },
  stepFrame(direction: -1 | 1, frameRate?: number | null) {
    const el = videoElement;
    if (!el) return;
    el.pause();
    const fps = frameRate && frameRate > 0 ? frameRate : 30;
    this.seek((el.currentTime + direction / fps) * 1000);
  },
};
