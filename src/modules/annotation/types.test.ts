import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE,
  annotationFromDto,
  annotationToInput,
  decodeGeometry,
  encodeGeometry,
  translateAnnotation,
} from './types';
import type { AnnotationDto } from '../../types';

const dto: AnnotationDto = {
  id: 'a1',
  recordId: 'r1',
  type: 'arrow',
  zIndex: 2,
  styleJson: JSON.stringify({ ...DEFAULT_STYLE, strokeColor: '#00ff00' }),
  geometryJson: JSON.stringify({ kind: 'arrow', x: 0, y: 0, width: 0.5, height: 0.5 }),
  content: null,
  createdAt: '2026-01-01T00:00:00+08:00',
  updatedAt: '2026-01-01T00:00:00+08:00',
};

describe('annotation geometry serialization', () => {
  it('round-trips normalized geometry', () => {
    const geometry = {
      kind: 'rect' as const,
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    };
    expect(decodeGeometry(encodeGeometry(geometry))).toEqual(geometry);
  });

  it('falls back on malformed json', () => {
    expect(decodeGeometry('not-json').kind).toBe('rect');
  });
});

describe('annotation translation', () => {
  it('moves line geometry without changing its size', () => {
    const annotation = annotationFromDto({
      ...dto,
      geometryJson: JSON.stringify({ kind: 'arrow', x: 0.1, y: 0.2, width: 0.3, height: 0.4 }),
    });
    const moved = translateAnnotation(annotation, 0.2, 0.1);
    expect(moved.geometry.x).toBeCloseTo(0.3);
    expect(moved.geometry.y).toBeCloseTo(0.3);
    expect(moved.geometry.width).toBe(0.3);
    expect(moved.geometry.height).toBe(0.4);
  });

  it('moves pen points and clamps the complete stroke inside the image', () => {
    const annotation = annotationFromDto({
      ...dto,
      type: 'pen',
      geometryJson: JSON.stringify({
        kind: 'pen',
        points: [
          { x: 0.7, y: 0.2 },
          { x: 0.9, y: 0.4 },
        ],
      }),
    });
    const moved = translateAnnotation(annotation, 0.5, -0.5);
    expect(moved.geometry.points?.[0].x).toBeCloseTo(0.8);
    expect(moved.geometry.points?.[0].y).toBeCloseTo(0);
    expect(moved.geometry.points?.[1].x).toBeCloseTo(1);
    expect(moved.geometry.points?.[1].y).toBeCloseTo(0.2);
  });
});

describe('annotation dto conversion', () => {
  it('converts dto to editable annotation and back', () => {
    const editable = annotationFromDto(dto);
    expect(editable.style.strokeColor).toBe('#00ff00');
    const input = annotationToInput(editable);
    expect(input.type).toBe('arrow');
    expect(input.id).toBe('a1');
    expect(input.zIndex).toBe(2);
    expect(JSON.parse(input.styleJson).strokeColor).toBe('#00ff00');
  });
});
