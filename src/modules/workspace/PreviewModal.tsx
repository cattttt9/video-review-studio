import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CloseOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Button, Modal, Spin } from 'antd';
import type { ReviewRecordDto } from '../../types';
import { recordService } from '../../services/records';
import { assetUrl } from '../../utils/paths';
import { annotationFromDto, type EditableAnnotation } from '../annotation/types';
import { renderCompositedCanvas } from '../annotation/canvasRenderer';
import { formatTimeMs } from '../../utils/time';

export interface PreviewModalProps {
  open: boolean;
  projectId: string;
  records: ReviewRecordDto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onEdit: (record: ReviewRecordDto) => void;
}

export default function PreviewModal({
  open,
  projectId,
  records,
  index,
  onClose,
  onNavigate,
  onEdit,
}: PreviewModalProps) {
  const record = records[index];
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImageUrl(null);
    if (!open || !record?.hasScreenshot || !record.sourceImagePath) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const dtos = await recordService.getAnnotations(projectId, record.id);
        const annotations: EditableAnnotation[] = dtos.map(annotationFromDto);
        const src = record.sourceImagePath!;
        const url = assetUrl(src);
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => undefined);
        const canvas = await renderCompositedCanvas(
          url,
          img.naturalWidth || 1920,
          img.naturalHeight || 1080,
          annotations,
          2560,
        );
        if (!cancelled) setImageUrl(canvas.toDataURL('image/png'));
      } catch {
        // 预览失败时静默降级
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, record, projectId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((z) => Math.min(10, Math.max(0.1, z * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="92vw"
      styles={{ body: { height: '82vh', padding: 0 } }}
      destroyOnHidden
      title={
        record
          ? `${record.title || '未命名记录'} · ${formatTimeMs(record.representativeTimeMs)}`
          : '预览'
      }
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#111',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging.current ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={() => {
          setZoom(1);
          setOffset({ x: 0, y: 0 });
        }}
      >
        {loading && <Spin />}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="预览"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              maxWidth: '100%',
              maxHeight: '100%',
              transformOrigin: 'center',
              userSelect: 'none',
            }}
            draggable={false}
          />
        )}
        {!loading && !imageUrl && <span style={{ color: '#999' }}>该记录没有截图</span>}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            disabled={index <= 0}
            onClick={() => onNavigate(index - 1)}
          />
          <Button
            size="small"
            icon={<ArrowRightOutlined />}
            disabled={index >= records.length - 1}
            onClick={() => onNavigate(index + 1)}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={!record}
            onClick={() => {
              if (record) {
                onEdit(record);
                onClose();
              }
            }}
          />
          <Button size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            color: '#fff',
            fontSize: 12,
            background: 'rgba(0,0,0,0.55)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          滚轮缩放 · 拖动平移 · 双击复位 · {Math.round(zoom * 100)}%
        </div>
      </div>
    </Modal>
  );
}
