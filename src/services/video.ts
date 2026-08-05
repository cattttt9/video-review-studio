import { call } from './invoke';
import type {
  PlayableVideo,
  PortableResult,
  ProxyResult,
  RelocateComparison,
  VideoMetaDto,
  VideoStatus,
} from '../types';

export const videoService = {
  bindVideo(projectId: string, path: string) {
    return call<unknown>('bind_video', { projectId, path });
  },
  checkVideo(projectId: string) {
    return call<VideoStatus>('check_video', { projectId });
  },
  compareVideo(projectId: string, newPath: string) {
    return call<RelocateComparison>('compare_video', { projectId, newPath });
  },
  forceBindVideo(projectId: string, newPath: string) {
    return call<unknown>('force_bind_video', { projectId, newPath });
  },
  ensureProxy(projectId: string) {
    return call<ProxyResult>('ensure_proxy', { projectId });
  },
  cancelOperation(projectId: string) {
    return call<void>('cancel_operation', { projectId });
  },
  captureScreenshot(projectId: string, timeMs: number, fileStem: string) {
    return call<string>('capture_screenshot', {
      projectId,
      timeMs,
      fileStem,
    });
  },
  resolvePlayableVideo(projectId: string) {
    return call<PlayableVideo>('resolve_playable_video', { projectId });
  },
  probeExternalFile(path: string) {
    return call<VideoMetaDto>('probe_external_file', { path });
  },
  convertToPortable(projectId: string) {
    return call<PortableResult>('convert_to_portable', { projectId });
  },
};
