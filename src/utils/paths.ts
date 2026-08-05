import { convertFileSrc } from '@tauri-apps/api/core';

export function assetUrl(path: string): string {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}
