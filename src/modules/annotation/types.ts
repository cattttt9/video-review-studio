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
  fillOpacity: 0,
  fontFamily: 'Microsoft YaHei, "PingFang SC", sans-serif',
  fontSize: 48,
  fontWeight: 400,
  textColor: '#ffffff',
  textStrokeColor: '#000000',
  textStrokeWidth: 0,
  background: '#000000',
  backgroundOpacity: 0,
  align: 'left',
  lineHeight: 1.3,
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

function geometryBounds(geometry: NormalizedGeometry) {
  if (geometry.kind === 'pen' && geometry.points?.length) {
    const xs = geometry.points.map((point) => point.x);
    const ys = geometry.points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  const x = geometry.x ?? 0;
  const y = geometry.y ?? 0;
  const endX = x + (geometry.width ?? 0);
  const endY = y + (geometry.height ?? 0);
  return {
    minX: Math.min(x, endX),
    maxX: Math.max(x, endX),
    minY: Math.min(y, endY),
    maxY: Math.max(y, endY),
  };
}

/** Translate an annotation while keeping its complete geometry inside the image. */
export function translateAnnotation(
  annotation: EditableAnnotation,
  deltaX: number,
  deltaY: number,
): EditableAnnotation {
  const bounds = geometryBounds(annotation.geometry);
  const dx = Math.max(-bounds.minX, Math.min(1 - bounds.maxX, deltaX));
  const dy = Math.max(-bounds.minY, Math.min(1 - bounds.maxY, deltaY));
  const geometry = annotation.geometry;

  if (geometry.kind === 'pen') {
    return {
      ...annotation,
      geometry: {
        ...geometry,
        points: (geometry.points ?? []).map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      },
    };
  }

  return {
    ...annotation,
    geometry: {
      ...geometry,
      x: (geometry.x ?? 0) + dx,
      y: (geometry.y ?? 0) + dy,
    },
  };
}
