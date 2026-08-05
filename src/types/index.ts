export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  sourceMode: 'referenced' | 'portable';
  sourceVideoPath: string;
  portableVideoPath: string | null;
  projectDir: string;
  sortMode: 'video_time' | 'created_at';
  sortDirection: 'asc' | 'desc';
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  videoMeta: VideoMetaDto | null;
  videoExists: boolean;
  resolvedVideoPath: string | null;
  recordCount: number;
}

export interface VideoMetaDto {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  codec: string | null;
  containerFormat: string | null;
  rotation: number;
  hashHead: string | null;
  hashTail: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TimeMode = 'point' | 'interval';

export interface ReviewRecordDto {
  id: string;
  projectId: string;
  title: string | null;
  description: string | null;
  category: string | null;
  importance: string | null;
  timeMode: TimeMode;
  startTimeMs: number;
  endTimeMs: number;
  representativeTimeMs: number;
  hasScreenshot: boolean;
  sourceImagePath: string | null;
  thumbnailPath: string | null;
  thumbnailVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type AnnotationType = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

export interface AnnotationDto {
  id: string;
  recordId: string;
  type: AnnotationType;
  zIndex: number;
  styleJson: string;
  geometryJson: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewRecordInput {
  title: string | null;
  description: string | null;
  category: string | null;
  importance: string | null;
  timeMode: TimeMode;
  startTimeMs: number;
  endTimeMs: number;
  representativeTimeMs: number;
  hasScreenshot: boolean;
  sourceImagePath: string | null;
}

export interface AnnotationInput {
  id: string;
  type: AnnotationType;
  zIndex: number;
  styleJson: string;
  geometryJson: string;
  content: string | null;
}

export interface RecentProjectEntry {
  dir: string;
  name: string;
  lastOpenedAt: string | null;
  sourceMode: string;
  videoExists: boolean;
  recordCount: number;
  videoFileName: string | null;
  projectValid: boolean;
}

export interface VideoStatus {
  exists: boolean;
  path: string | null;
  size: number | null;
}

export interface RelocateComparison {
  matches: boolean;
  differences: string[];
  probed: VideoMetaDto;
}

export interface PlayableVideo {
  path: string;
  kind: 'source' | 'proxy';
  mime: string;
  usesProxy: boolean;
}

export interface ProxyResult {
  path: string;
  created: boolean;
}

export interface PortableResult {
  projectDir: string;
  mediaPath: string;
}

export interface ProgressPayload {
  projectId: string;
  doneMs: number;
  totalMs: number;
  percent: number;
  stage: string;
}

export interface PortableProgressPayload {
  projectId: string;
  copiedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface AppErrorPayload {
  category: string;
  message: string;
  recoverable: boolean;
}
