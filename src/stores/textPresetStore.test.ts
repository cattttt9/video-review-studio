import { beforeEach, describe, expect, it } from 'vitest';
import { useTextPresetStore } from './textPresetStore';
import { DEFAULT_STYLE } from '../modules/annotation/types';

describe('textPresetStore', () => {
  beforeEach(() => {
    useTextPresetStore.persist.clearStorage();
    useTextPresetStore.setState({ presets: [] });
  });

  it('adds, renames and removes presets', () => {
    const store = useTextPresetStore.getState();
    expect(store.addPreset('白字黑边', { ...DEFAULT_STYLE, textStrokeWidth: 8 })).toBe(
      true,
    );
    expect(store.addPreset('白字黑边', DEFAULT_STYLE)).toBe(false);
    expect(useTextPresetStore.getState().presets).toHaveLength(1);

    expect(
      useTextPresetStore.getState().renamePreset('白字黑边', '黄字黑边'),
    ).toBe(true);
    expect(useTextPresetStore.getState().presets[0].name).toBe('黄字黑边');

    useTextPresetStore.getState().removePreset('黄字黑边');
    expect(useTextPresetStore.getState().presets).toHaveLength(0);
  });

  it('persists presets to localStorage', () => {
    useTextPresetStore.getState().addPreset('半透明底', DEFAULT_STYLE);
    const raw = localStorage.getItem('vrs-text-presets-v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.presets[0].name).toBe('半透明底');
  });
});

