import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnnotationStyle } from '../modules/annotation/types';

export interface TextPreset {
  name: string;
  style: AnnotationStyle;
  updatedAt: number;
}

interface TextPresetState {
  presets: TextPreset[];
  addPreset: (name: string, style: AnnotationStyle) => boolean;
  renamePreset: (oldName: string, newName: string) => boolean;
  removePreset: (name: string) => void;
}

export const useTextPresetStore = create<TextPresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      addPreset: (name, style) => {
        const trimmed = name.trim();
        if (!trimmed || get().presets.some((p) => p.name === trimmed)) {
          return false;
        }
        set((state) => ({
          presets: [
            ...state.presets.filter((p) => p.name !== trimmed),
            { name: trimmed, style: { ...style }, updatedAt: Date.now() },
          ],
        }));
        return true;
      },
      renamePreset: (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed || get().presets.some((p) => p.name === trimmed)) {
          return false;
        }
        set((state) => ({
          presets: state.presets.map((p) =>
            p.name === oldName
              ? { ...p, name: trimmed, updatedAt: Date.now() }
              : p,
          ),
        }));
        return true;
      },
      removePreset: (name) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.name !== name),
        })),
    }),
    { name: 'vrs-text-presets-v1' },
  ),
);

