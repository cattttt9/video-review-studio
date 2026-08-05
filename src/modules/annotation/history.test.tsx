import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnnotationHistory } from './history';
import { DEFAULT_STYLE, type EditableAnnotation } from './types';

function makeAnnotation(id: string): EditableAnnotation {
  return {
    id,
    type: 'rect',
    zIndex: 0,
    style: { ...DEFAULT_STYLE },
    geometry: { kind: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 },
    content: '',
  };
}

describe('useAnnotationHistory', () => {
  it('supports undo and redo', () => {
    const { result } = renderHook(() => useAnnotationHistory());
    act(() => result.current.commit([makeAnnotation('1')]));
    act(() => result.current.commit([makeAnnotation('1'), makeAnnotation('2')]));
    expect(result.current.annotations).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.annotations).toHaveLength(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.annotations).toHaveLength(2);
  });

  it('resets history when record changes', () => {
    const { result } = renderHook(() => useAnnotationHistory());
    act(() => result.current.commit([makeAnnotation('1')]));
    act(() => result.current.reset([]));
    expect(result.current.annotations).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
