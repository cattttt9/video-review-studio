import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReviewRecordDto } from '../../types';
import { formatTimeMs } from '../../utils/time';

export interface TimelineProps {
  durationMs: number;
  currentTimeMs: number;
  records: ReviewRecordDto[];
  onSeek: (ms: number) => void;
}

interface ViewWindow {
  start: number;
  end: number;
}

function chooseTickStep(viewMs: number, width: number): number {
  const candidates = [
    500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000,
    3600000, 7200000,
  ];
  for (const step of candidates) {
    if ((viewMs / step) * 70 <= width * 0.95) return step;
  }
  return candidates[candidates.length - 1];
}

export default function Timeline({ durationMs, currentTimeMs, records, onSeek }: TimelineProps) {
  const [view, setView] = useState<ViewWindow>({ start: 0, end: durationMs });
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef<number | null>(null);

  const effectiveView = useMemo<ViewWindow>(() => {
    if (durationMs <= 0) return { start: 0, end: 1 };
    let { start, end } = view;
    if (end - start < 1) end = start + 1000;
    start = Math.max(0, Math.min(start, durationMs));
    end = Math.min(durationMs, Math.max(end, 1000));
    return { start, end };
  }, [view, durationMs]);

  const zoomAt = (factor: number) => {
    const range = effectiveView.end - effectiveView.start;
    const newRange = Math.min(durationMs, Math.max(1000, range * factor));
    const center = Math.min(Math.max(effectiveView.start, currentTimeMs), effectiveView.end);
    let start = center - newRange / 2;
    if (start < 0) start = 0;
    let end = start + newRange;
    if (end > durationMs) {
      end = durationMs;
      start = Math.max(0, end - newRange);
    }
    setView({ start, end });
  };

  const width = 1000;
  const toX = (ms: number) =>
    ((ms - effectiveView.start) / (effectiveView.end - effectiveView.start)) * width;

  const tickStep = chooseTickStep(effectiveView.end - effectiveView.start, width);
  const ticks = useMemo(() => {
    const list: number[] = [];
    const first = Math.floor(effectiveView.start / tickStep) * tickStep;
    for (let t = first; t <= effectiveView.end; t += tickStep) {
      list.push(t);
    }
    return list;
  }, [effectiveView, tickStep]);

  const visibleRecords = useMemo(
    () =>
      records.filter(
        (r) => r.startTimeMs <= effectiveView.end && r.endTimeMs >= effectiveView.start,
      ),
    [records, effectiveView],
  );

  const msFromEvent = useCallback(
    (e: { clientX: number; currentTarget: HTMLDivElement }) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ms =
        effectiveView.start +
        ratio * (effectiveView.end - effectiveView.start);
      return Math.max(0, Math.min(durationMs, ms));
    },
    [effectiveView, durationMs],
  );

  const seekAt = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onSeek(msFromEvent(e));
    },
    [onSeek, msFromEvent],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      seekAt(e);
    },
    [seekAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        seekAt(e);
      });
    },
    [dragging, seekAt],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDragging(false);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragging) return;
      onSeek(msFromEvent(e));
    },
    [dragging, onSeek, msFromEvent],
  );

  return (
    <div className="vrs-timeline">
      <div className="vrs-timeline-ruler">
        {ticks.map((t) => (
          <span key={t} style={{ position: 'absolute', left: `${(toX(t) / width) * 100}%` }}>
            {formatTimeMs(t)}
          </span>
        ))}
      </div>
      <div
        className="vrs-timeline-track"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {visibleRecords.map((r) => {
          const left = (toX(r.startTimeMs) / width) * 100;
          if (r.timeMode === 'interval') {
            const right = (toX(r.endTimeMs) / width) * 100;
            return (
              <div
                key={r.id}
                className="vrs-timeline-mark interval"
                style={{ left: `${left}%`, width: `${right - left}%` }}
                title={`${r.title ?? ''} ${formatTimeMs(r.startTimeMs)} - ${formatTimeMs(r.endTimeMs)}`}
              />
            );
          }
          return (
            <div
              key={r.id}
              className="vrs-timeline-mark"
              style={{ left: `${left}%` }}
              title={`${r.title ?? ''} ${formatTimeMs(r.startTimeMs)}`}
            />
          );
        })}
      </div>
      {currentTimeMs >= effectiveView.start && currentTimeMs <= effectiveView.end && (
        <div
          className="vrs-timeline-playhead"
          style={{ left: `${(toX(currentTimeMs) / width) * 100}%` }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          right: 6,
          top: 34,
          display: 'flex',
          gap: 4,
        }}
      >
        <button onClick={() => zoomAt(2)}>放大</button>
        <button onClick={() => zoomAt(0.5)}>缩小</button>
        <button onClick={() => setView({ start: 0, end: durationMs })}>适应</button>
      </div>
    </div>
  );
}
