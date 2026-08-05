import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE,
  annotationFromDto,
  annotationToInput,
  decodeGeometry,
  encodeGeometry,
} from './types';
import type { AnnotationDto } from '../../types';

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

describe('annotation dto conversion', () => {
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
