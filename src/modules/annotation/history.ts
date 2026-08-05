import { useCallback, useRef, useState } from 'react';
import type { EditableAnnotation } from './types';

export interface AnnotationHistory {
  annotations: EditableAnnotation[];
  setAnnotations: (next: EditableAnnotation[]) => void;
  commit: (next: EditableAnnotation[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (initial: EditableAnnotation[]) => void;
}

export function useAnnotationHistory(): AnnotationHistory {
  const [annotations, setAnnotations] = useState<EditableAnnotation[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStack = useRef<EditableAnnotation[][]>([]);
  const redoStack = useRef<EditableAnnotation[][]>([]);

  const commit = useCallback((next: EditableAnnotation[]) => {
    setAnnotations((current) => {
      undoStack.current.push(current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setAnnotations((current) => {
      const prev = undoStack.current.pop();
      if (!prev) {
        setCanUndo(false);
        return current;
      }
      redoStack.current.push(current);
      setCanRedo(true);
      setCanUndo(undoStack.current.length > 0);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setAnnotations((current) => {
      const next = redoStack.current.pop();
      if (!next) {
        setCanRedo(false);
        return current;
      }
      undoStack.current.push(current);
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
      return next;
    });
  }, []);

  const reset = useCallback((initial: EditableAnnotation[]) => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setAnnotations(initial);
  }, []);

  return {
    annotations,
    setAnnotations,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}
