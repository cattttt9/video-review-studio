import type { AnnotationDto, AnnotationInput, AnnotationType } from '../../types';

export type ToolType = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedGeometry {
  kind: AnnotationType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: NormalizedPoint[];
}

export interface AnnotationStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  textColor: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  background: string;
  backgroundOpacity: number;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface EditableAnnotation {
  id: string;
  type: AnnotationType;
  zIndex: number;
  style: AnnotationStyle;
  geometry: NormalizedGeometry;
  content: string;
}

export const DEFAULT_STYLE: AnnotationStyle = {
  strokeColor: '#ff3b30',
  strokeWidth: 8,
  fillColor: '#ff3b30',
  fillOpacity: 0.15,
  fontFamily: 'Microsoft YaHei, "PingFang SC", sans-serif',
  fontSize: 48,
  fontWeight: 700,
  textColor: '#ffffff',
  textStrokeColor: '#000000',
  textStrokeWidth: 6,
  background: '#000000',
  backgroundOpacity: 0.45,
  align: 'left',
  lineHeight: 1.3,
};

export const TEXT_PRESETS: Record<string, AnnotationStyle> = {
  白字黑边: {
    ...DEFAULT_STYLE,
    textColor: '#ffffff',
    textStrokeColor: '#000000',
    textStrokeWidth: 8,
    backgroundOpacity: 0,
  },
  黄字黑边: {
    ...DEFAULT_STYLE,
    textColor: '#ffd500',
    textStrokeColor: '#000000',
    textStrokeWidth: 8,
    backgroundOpacity: 0,
  },
  红底白字: {
    ...DEFAULT_STYLE,
    textColor: '#ffffff',
    textStrokeColor: '#000000',
    textStrokeWidth: 4,
    background: '#ff4d4f',
    backgroundOpacity: 1,
  },
  半透明黑底白字: {
    ...DEFAULT_STYLE,
    textColor: '#ffffff',
    textStrokeWidth: 2,
    background: '#000000',
    backgroundOpacity: 0.55,
  },
};

export function encodeGeometry(geometry: NormalizedGeometry): string {
  return JSON.stringify(geometry);
}

export function decodeGeometry(raw: string): NormalizedGeometry {
  try {
    const parsed = JSON.parse(raw) as NormalizedGeometry;
    if (parsed && typeof parsed.kind === 'string') return parsed;
  } catch {
    // fall through
  }
  return { kind: 'rect' };
}

export function encodeStyle(style: AnnotationStyle): string {
  return JSON.stringify(style);
}

export function decodeStyle(raw: string): AnnotationStyle {
  try {
    const parsed = JSON.parse(raw) as Partial<AnnotationStyle>;
    return { ...DEFAULT_STYLE, ...parsed };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

export function annotationFromDto(dto: AnnotationDto): EditableAnnotation {
  return {
    id: dto.id,
    type: dto.type,
    zIndex: dto.zIndex,
    style: decodeStyle(dto.styleJson),
    geometry: decodeGeometry(dto.geometryJson),
    content: dto.content ?? '',
  };
}

export function annotationToInput(annotation: EditableAnnotation): AnnotationInput {
  return {
    id: annotation.id,
    type: annotation.type,
    zIndex: annotation.zIndex,
    styleJson: encodeStyle(annotation.style),
    geometryJson: encodeGeometry(annotation.geometry),
    content: annotation.type === 'text' ? annotation.content : null,
  };
}

export function createAnnotationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
