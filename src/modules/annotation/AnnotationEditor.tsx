import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Arrow,
  Circle,
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from 'react-konva';
import type Konva from 'konva';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { loadImage } from './canvasRenderer';
import {
  createAnnotationId,
  translateAnnotation,
  type AnnotationStyle,
  type EditableAnnotation,
  type NormalizedPoint,
  type ToolType,
} from './types';

export interface AnnotationEditorProps {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  annotations: EditableAnnotation[];
  tool: ToolType;
  activeStyle: AnnotationStyle;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: EditableAnnotation[]) => void;
  onCommit: (next: EditableAnnotation[]) => void;
  onHistoryCommit: (next: EditableAnnotation[]) => void;
  onFinishCreate: (id: string | null) => void;
}

interface FitRect {
  scale: number;
  dw: number;
  dh: number;
  ox: number;
  oy: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AnnotationEditor({
  imageUrl,
  naturalWidth,
  naturalHeight,
  annotations,
  tool,
  activeStyle,
  selectedId,
  onSelect,
  onChange,
  onCommit,
  onHistoryCommit,
  onFinishCreate,
}: AnnotationEditorProps) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [draft, setDraft] = useState<EditableAnnotation | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const editingTextIdRef = useRef<string | null>(null);
  const textOriginalRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    setLoadedImage(null);
    loadImage(imageUrl)
      .then((img) => {
        if (!cancelled) setLoadedImage(img);
      })
      .catch(() => {
        if (!cancelled) setLoadedImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const fit: FitRect | null = useMemo(() => {
    if (size.width <= 0 || size.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return null;
    }
    const scale = Math.min(size.width / naturalWidth, size.height / naturalHeight);
    const dw = naturalWidth * scale;
    const dh = naturalHeight * scale;
    return {
      scale,
      dw,
      dh,
      ox: (size.width - dw) / 2,
      oy: (size.height - dh) / 2,
    };
  }, [size, naturalWidth, naturalHeight]);

  const toNormalized = useCallback(
    (pos: { x: number; y: number }): NormalizedPoint => {
      if (!fit) return { x: 0, y: 0 };
      return {
        x: clamp01((pos.x - fit.ox) / fit.dw),
        y: clamp01((pos.y - fit.oy) / fit.dh),
      };
    },
    [fit],
  );

  const toScreen = useCallback(
    (x: number, y: number) => {
      if (!fit) return { x: 0, y: 0 };
      return { x: fit.ox + x * fit.dw, y: fit.oy + y * fit.dh };
    },
    [fit],
  );

  const sorted = useMemo(() => [...annotations].sort((a, b) => a.zIndex - b.zIndex), [annotations]);

  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId],
  );

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (
      !selected ||
      tool !== 'select' ||
      selected.type === 'pen' ||
      selected.type === 'line' ||
      selected.type === 'arrow'
    ) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selected.id}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selected, tool]);

  const updateAnnotation = useCallback(
    (id: string, updater: (a: EditableAnnotation) => EditableAnnotation) => {
      onChange(annotations.map((a) => (a.id === id ? updater(a) : a)));
    },
    [annotations, onChange],
  );

  const startEditingText = useCallback(
    (annotation: EditableAnnotation) => {
      onSelect(annotation.id);
      editingTextIdRef.current = annotation.id;
      setEditingTextId(annotation.id);
      setTextInput(annotation.content);
      textOriginalRef.current = annotation.content;
    },
    [onSelect],
  );

  const commitTextEdit = useCallback(() => {
    const id = editingTextIdRef.current;
    if (!id) return;
    const target = annotations.find((a) => a.id === id);
    let next: EditableAnnotation[];
    if (!target || textInput.trim() === '') {
      next = annotations.filter((a) => a.id !== id);
    } else {
      next = annotations.map((a) =>
        a.id === id ? { ...a, content: textInput } : a,
      );
    }
    onChange(next);
    onHistoryCommit(next);
    editingTextIdRef.current = null;
    setEditingTextId(null);
    onFinishCreate(next.some((annotation) => annotation.id === id) ? id : null);
  }, [annotations, textInput, onChange, onHistoryCommit, onFinishCreate]);

  const cancelTextEdit = useCallback(() => {
    const id = editingTextIdRef.current;
    if (!id) return;
    const target = annotations.find((a) => a.id === id);
    let next: EditableAnnotation[];
    if (!target || textOriginalRef.current.trim() === '') {
      next = annotations.filter((a) => a.id !== id);
    } else {
      next = annotations.map((a) =>
        a.id === id ? { ...a, content: textOriginalRef.current } : a,
      );
    }
    onChange(next);
    onHistoryCommit(next);
    editingTextIdRef.current = null;
    setEditingTextId(null);
    onFinishCreate(next.some((annotation) => annotation.id === id) ? id : null);
  }, [annotations, onChange, onHistoryCommit, onFinishCreate]);

  // 切换工具时自动保存当前文本编辑
  const commitRef = useRef(commitTextEdit);
  commitRef.current = commitTextEdit;
  const prevToolRef = useRef(tool);
  useEffect(() => {
    if (prevToolRef.current !== tool && editingTextIdRef.current) {
      commitRef.current();
    }
    prevToolRef.current = tool;
  }, [tool]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (editingTextIdRef.current) {
        commitTextEdit();
        return;
      }
      if (!fit) return;
      if (tool === 'select') {
        // 标注节点会在自己的 onMouseDown 中阻止冒泡；事件落到 Stage 本身
        // 说明用户点击了图片或留黑区域，应取消选中并隐藏变换边框。
        if (e.target === e.target.getStage()) onSelect(null);
        return;
      }
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      const p = toNormalized(pos);
      if (tool === 'text') {
        const annotation: EditableAnnotation = {
          id: createAnnotationId(),
          type: 'text',
          zIndex: annotations.length,
          style: activeStyle,
          geometry: { kind: 'text', x: p.x, y: p.y, width: 0.25, height: 0.08 },
          content: '',
        };
        onCommit([...annotations, annotation]);
        startEditingText(annotation);
        return;
      }
      const base: EditableAnnotation = {
        id: createAnnotationId(),
        type: tool,
        zIndex: annotations.length,
        style: activeStyle,
        geometry: { kind: tool },
        content: '',
      };
      if (tool === 'pen') {
        base.geometry.points = [p];
      } else {
        base.geometry.x = p.x;
        base.geometry.y = p.y;
        base.geometry.width = 0;
        base.geometry.height = 0;
      }
      setDraft(base);
    },
    [
      fit,
      tool,
      activeStyle,
      annotations,
      onCommit,
      onSelect,
      toNormalized,
      commitTextEdit,
      startEditingText,
    ],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!draft || !fit) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      const p = toNormalized(pos);
      if (draft.type === 'pen') {
        const points = draft.geometry.points ?? [];
        const last = points[points.length - 1];
        if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.002) {
          setDraft({
            ...draft,
            geometry: { ...draft.geometry, points: [...points, p] },
          });
        }
      } else {
        setDraft({
          ...draft,
          geometry: {
            ...draft.geometry,
            width: p.x - (draft.geometry.x ?? 0),
            height: p.y - (draft.geometry.y ?? 0),
          },
        });
      }
    },
    [draft, fit, toNormalized],
  );

  const handleMouseUp = useCallback(() => {
    if (draft) {
      onCommit([...annotations, draft]);
      setDraft(null);
      onFinishCreate(draft.id);
    }
  }, [draft, annotations, onCommit, onFinishCreate]);

  const createTextAt = useCallback(
    (p: NormalizedPoint, initialText = '') => {
      const annotation: EditableAnnotation = {
        id: createAnnotationId(),
        type: 'text',
        zIndex: annotations.length,
        style: activeStyle,
        geometry: { kind: 'text', x: p.x, y: p.y, width: 0.25, height: 0.08 },
        content: initialText,
      };
      onCommit([...annotations, annotation]);
      startEditingText(annotation);
    },
    [activeStyle, annotations, onCommit, startEditingText],
  );

  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!fit) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      createTextAt(toNormalized(pos));
    },
    [fit, createTextAt, toNormalized],
  );

  const dragBound = useCallback(
    (pos: { x: number; y: number }) => {
      if (!fit) return pos;
      return {
        x: Math.min(fit.ox + fit.dw, Math.max(fit.ox, pos.x)),
        y: Math.min(fit.oy + fit.dh, Math.max(fit.oy, pos.y)),
      };
    },
    [fit],
  );

  const handleTransformEnd = useCallback(
    (id: string, node: Konva.Node) => {
      if (!fit) return annotations;
      const nx = node.x();
      const ny = node.y();
      const nw = Math.abs(node.width() * node.scaleX());
      const nh = Math.abs(node.height() * node.scaleY());
      node.scaleX(1);
      node.scaleY(1);
      node.width(nw);
      node.height(nh);
      return annotations.map((a) =>
        a.id === id
          ? {
              ...a,
              geometry: {
                kind: a.type,
                x: clamp01((nx - fit.ox) / fit.dw),
                y: clamp01((ny - fit.oy) / fit.dh),
                width: clamp01(nw / fit.dw),
                height: clamp01(nh / fit.dh),
              },
            }
          : a,
      );
    },
    [fit, annotations],
  );

  const handleMoveEnd = useCallback(
    (annotation: EditableAnnotation, node: Konva.Node, origin: { x: number; y: number }) => {
      if (!fit) return;
      const deltaX = (node.x() - origin.x) / fit.dw;
      const deltaY = (node.y() - origin.y) / fit.dh;
      node.position(origin);
      const next = annotations.map((item) =>
        item.id === annotation.id ? translateAnnotation(item, deltaX, deltaY) : item,
      );
      onHistoryCommit(next);
    },
    [fit, annotations, onHistoryCommit],
  );

  const editingText = useMemo(
    () => sorted.find((a) => a.id === editingTextId) ?? null,
    [sorted, editingTextId],
  );

  const editingRect = useMemo(() => {
    if (!editingText || !fit) return null;
    const g = editingText.geometry;
    const pos = toScreen(g.x ?? 0, g.y ?? 0);
    const w = Math.max(160, (g.width ?? 0.25) * fit.dw);
    const h = Math.max(48, (g.height ?? 0.08) * fit.dh);
    return { ...pos, w, h, style: editingText.style, scale: fit.scale };
  }, [editingText, fit, toScreen]);

  const renderNode = useCallback(
    (annotation: EditableAnnotation) => {
      if (!fit) return null;
      const g = annotation.geometry;
      const s = annotation.style;
      const pos = toScreen(g.x ?? 0, g.y ?? 0);
      const w = (g.width ?? 0) * fit.dw;
      const h = (g.height ?? 0) * fit.dh;
      const common = {
        id: annotation.id,
        key: annotation.id,
        onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
          onSelect(annotation.id);
        },
      };

      switch (annotation.type) {
        case 'pen': {
          const pts = (g.points ?? []).flatMap((p) => {
            const sp = toScreen(p.x, p.y);
            return [sp.x, sp.y];
          });
          return (
            <Line
              {...common}
              points={pts}
              stroke={s.strokeColor}
              strokeWidth={Math.max(1, s.strokeWidth * fit.scale)}
              lineCap="round"
              lineJoin="round"
              listening={tool === 'select'}
              draggable={tool === 'select'}
              onDragEnd={(e) => handleMoveEnd(annotation, e.target, { x: 0, y: 0 })}
            />
          );
        }
        case 'line':
        case 'arrow': {
          const end = toScreen((g.x ?? 0) + (g.width ?? 0), (g.y ?? 0) + (g.height ?? 0));
          const Component = annotation.type === 'arrow' ? Arrow : Line;
          return (
            <>
              <Component
                {...common}
                points={[pos.x, pos.y, end.x, end.y]}
                stroke={s.strokeColor}
                strokeWidth={Math.max(1, s.strokeWidth * fit.scale)}
                lineCap="round"
                lineJoin="round"
                pointerLength={Math.max(10, s.strokeWidth * fit.scale * 2)}
                pointerWidth={Math.max(8, s.strokeWidth * fit.scale * 1.6)}
                listening={tool === 'select'}
                draggable={tool === 'select'}
                onDragEnd={(e) => handleMoveEnd(annotation, e.target, { x: 0, y: 0 })}
              />
              {selected?.id === annotation.id && tool === 'select' && (
                <>
                  <Circle
                    key={`${annotation.id}-s`}
                    x={pos.x}
                    y={pos.y}
                    radius={6}
                    fill="#fff"
                    stroke="#1677ff"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                      const p = toNormalized(e.target.position());
                      updateAnnotation(annotation.id, (a) => ({
                        ...a,
                        geometry: { ...a.geometry, x: p.x, y: p.y },
                      }));
                    }}
                  />
                  <Circle
                    key={`${annotation.id}-e`}
                    x={end.x}
                    y={end.y}
                    radius={6}
                    fill="#fff"
                    stroke="#1677ff"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                      const p = toNormalized(e.target.position());
                      updateAnnotation(annotation.id, (a) => ({
                        ...a,
                        geometry: {
                          ...a.geometry,
                          width: p.x - (a.geometry.x ?? 0),
                          height: p.y - (a.geometry.y ?? 0),
                        },
                      }));
                    }}
                  />
                </>
              )}
            </>
          );
        }
        case 'rect':
          return (
            <Rect
              {...common}
              x={pos.x}
              y={pos.y}
              width={w}
              height={h}
              stroke={s.strokeColor}
              strokeWidth={Math.max(1, s.strokeWidth * fit.scale)}
              fill={withAlpha(s.fillColor, s.fillOpacity)}
              draggable={tool === 'select'}
              dragBoundFunc={dragBound}
              onDragEnd={(e) => {
                const p = toNormalized(e.target.position());
                const next = annotations.map((a) =>
                  a.id === annotation.id
                    ? { ...a, geometry: { ...a.geometry, x: p.x, y: p.y } }
                    : a,
                );
                onChange(next);
                onHistoryCommit(next);
              }}
              onTransformEnd={(e) => {
                const next = handleTransformEnd(annotation.id, e.target);
                onHistoryCommit(next);
              }}
            />
          );
        case 'ellipse':
          return (
            <Ellipse
              {...common}
              x={pos.x + w / 2}
              y={pos.y + h / 2}
              radiusX={Math.abs(w) / 2}
              radiusY={Math.abs(h) / 2}
              stroke={s.strokeColor}
              strokeWidth={Math.max(1, s.strokeWidth * fit.scale)}
              fill={withAlpha(s.fillColor, s.fillOpacity)}
              draggable={tool === 'select'}
              dragBoundFunc={dragBound}
              onDragEnd={(e) => {
                const p = toNormalized({
                  x: e.target.x() - w / 2,
                  y: e.target.y() - h / 2,
                });
                const next = annotations.map((a) =>
                  a.id === annotation.id
                    ? { ...a, geometry: { ...a.geometry, x: p.x, y: p.y } }
                    : a,
                );
                onChange(next);
                onHistoryCommit(next);
              }}
              onTransformEnd={(e) => {
                const next = handleTransformEnd(annotation.id, e.target);
                onHistoryCommit(next);
              }}
            />
          );
        case 'text': {
          const textW = Math.max(60, (g.width ?? 0.25) * fit.dw);
          const textH = Math.max(20, (g.height ?? 0.08) * fit.dh);
          return (
            <KonvaText
              {...common}
              x={pos.x}
              y={pos.y}
              width={textW}
              height={textH}
              text={annotation.content || '双击编辑文本'}
              fontFamily={s.fontFamily}
              fontSize={Math.max(6, s.fontSize * fit.scale)}
              fontStyle={Number(s.fontWeight) >= 600 ? 'bold' : 'normal'}
              fill={s.textColor}
              stroke={s.textStrokeWidth > 0 ? s.textStrokeColor : undefined}
              strokeWidth={Math.max(0.5, s.textStrokeWidth * fit.scale)}
              align={s.align}
              lineHeight={s.lineHeight}
              verticalAlign="top"
              wrap="word"
              draggable={tool === 'select'}
              dragBoundFunc={dragBound}
              onDragEnd={(e) => {
                const p = toNormalized(e.target.position());
                const next = annotations.map((a) =>
                  a.id === annotation.id
                    ? { ...a, geometry: { ...a.geometry, x: p.x, y: p.y } }
                    : a,
                );
                onChange(next);
                onHistoryCommit(next);
              }}
              onDblClick={(e) => {
                e.cancelBubble = true;
                startEditingText(annotation);
              }}
              onTransformEnd={(e) => {
                const next = handleTransformEnd(annotation.id, e.target);
                onHistoryCommit(next);
              }}
            />
          );
        }
        default:
          return null;
      }
    },
    [
      fit,
      toScreen,
      toNormalized,
      tool,
      selected,
      onSelect,
      updateAnnotation,
      handleTransformEnd,
      handleMoveEnd,
      onHistoryCommit,
      annotations,
      onChange,
      dragBound,
      startEditingText,
    ],
  );

  return (
    <div ref={ref} className="vrs-stage-wrap">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        onMouseLeave={() => setDraft(null)}
      >
        <Layer>
          {loadedImage && fit && (
            <KonvaImage
              image={loadedImage}
              x={fit.ox}
              y={fit.oy}
              width={fit.dw}
              height={fit.dh}
              listening={false}
            />
          )}
          {draft && renderNode(draft)}
          {sorted.map((annotation) => renderNode(annotation))}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            flipEnabled={false}
            keepRatio={false}
            borderStroke="#1677ff"
            anchorStroke="#1677ff"
            anchorFill="#ffffff"
            anchorSize={8}
          />
        </Layer>
      </Stage>
      {editingRect && editingText && (
        <textarea
          className="vrs-text-input"
          value={textInput}
          autoFocus
          onChange={(e) => setTextInput(e.target.value)}
          onBlur={() => commitTextEdit()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              cancelTextEdit();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          style={{
            position: 'absolute',
            left: editingRect.x,
            top: editingRect.y,
            width: editingRect.w,
            minHeight: editingRect.h,
            fontSize: Math.max(12, editingRect.style.fontSize * editingRect.scale),
            fontFamily: editingRect.style.fontFamily,
            fontWeight: String(editingRect.style.fontWeight),
            color: editingRect.style.textColor,
            background:
              editingRect.style.backgroundOpacity > 0
                ? withAlpha(
                    editingRect.style.background,
                    editingRect.style.backgroundOpacity,
                  )
                : 'transparent',
            lineHeight: String(editingRect.style.lineHeight),
            resize: 'both',
            border: '2px solid #1677ff',
            outline: 'none',
            zIndex: 10,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
