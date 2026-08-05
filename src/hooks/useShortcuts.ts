import { useEffect, useRef } from 'react';
import type { ToolType } from '../modules/annotation/types';

export interface ShortcutHandlers {
  enabled: boolean;
  onTogglePlay?: () => void;
  onFrameStep?: (direction: -1 | 1) => void;
  onSeekBy?: (seconds: number) => void;
  onNewRecord?: () => void;
  onDeleteAnnotation?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSetTool?: (tool: ToolType) => void;
  onEscape?: () => void;
  onSave?: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!handlersRef.current.enabled) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const h = handlersRef.current;
      const key = event.key;
      const shift = event.shiftKey;
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && key.toLowerCase() === 'z') {
        event.preventDefault();
        if (shift) h.onRedo?.();
        else h.onUndo?.();
        return;
      }
      if (ctrl && key.toLowerCase() === 'y') {
        event.preventDefault();
        h.onRedo?.();
        return;
      }
      if (ctrl && key.toLowerCase() === 's') {
        event.preventDefault();
        h.onSave?.();
        return;
      }
      if (key === ' ') {
        event.preventDefault();
        h.onTogglePlay?.();
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        if (shift) h.onSeekBy?.(-5);
        else h.onFrameStep?.(-1);
        return;
      }
      if (key === 'ArrowRight') {
        event.preventDefault();
        if (shift) h.onSeekBy?.(5);
        else h.onFrameStep?.(1);
        return;
      }
      if (key === 'n' || key === 'N') {
        h.onNewRecord?.();
        return;
      }
      if (key === 'Delete' || key === 'Backspace') {
        h.onDeleteAnnotation?.();
        return;
      }
      const toolMap: Record<string, ToolType> = {
        t: 'text',
        T: 'text',
        a: 'arrow',
        A: 'arrow',
        r: 'rect',
        R: 'rect',
        p: 'pen',
        P: 'pen',
      };
      if (toolMap[key]) {
        h.onSetTool?.(toolMap[key]);
        return;
      }
      if (key === 'Escape') {
        h.onEscape?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
