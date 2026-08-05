import type { ReviewRecordDto } from '../../types';
import { formatTimeMs } from '../../utils/time';

export type ReportLayout = 'annotated' | 'side' | 'stacked';

export interface ReportItem {
  record: ReviewRecordDto;
  annotated: string | null;
  source: string | null;
}

export interface ReportOptions {
  projectName: string;
  videoName: string;
  durationMs: number;
  width: number | null;
  height: number | null;
  exportTime: string;
  items: ReportItem[];
  layout: ReportLayout;
  includeNotes: boolean;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReportHtml(options: ReportOptions): string {
  const rows = options.items
    .map((item, index) => {
      const record = item.record;
      const time =
        record.timeMode === 'interval'
          ? `${formatTimeMs(record.startTimeMs)} – ${formatTimeMs(record.endTimeMs)}`
          : formatTimeMs(record.representativeTimeMs);
      const notes = options.includeNotes
        ? `<p class="notes">${escapeHtml(record.description ?? '')}</p>`
        : '';
      const images =
        options.layout === 'side'
          ? `<div class="row side">${item.source ? `<figure><img src="${escapeHtml(item.source)}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${item.annotated ? `<figure><img src="${escapeHtml(item.annotated)}" alt="标注图"><figcaption>标注图</figcaption></figure>` : ''}</div>`
          : options.layout === 'stacked'
            ? `<div class="row stacked">${item.source ? `<figure><img src="${escapeHtml(item.source)}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${item.annotated ? `<figure><img src="${escapeHtml(item.annotated)}" alt="标注图"><figcaption>标注图</figcaption></figure>` : ''}</div>`
            : `<div class="row">${item.annotated ? `<figure><img src="${escapeHtml(item.annotated)}" alt="标注图"><figcaption>标注图</figcaption></figure>` : ''}</div>`;
      return `<article class="record">
          <header><span class="index">#${String(index + 1).padStart(3, '0')}</span><h2>${escapeHtml(record.title ?? '未命名记录')}</h2><span class="time">${time}</span></header>
          ${record.category ? `<p class="meta">分类：${escapeHtml(record.category)}${record.importance ? ` · 重要程度：${escapeHtml(record.importance)}` : ''}</p>` : ''}
          ${images}
          ${notes}
        </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.projectName)} 复盘报告</title>
<style>
  body { font-family: "Microsoft YaHei", -apple-system, sans-serif; margin: 0; padding: 24px 32px; color: #262626; background: #fafafa; }
  h1 { margin: 0 0 4px; }
  .sub { color: #8c8c8c; margin-bottom: 24px; }
  .record { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 16px; margin-bottom: 20px; break-inside: avoid; }
  .record header { display: flex; align-items: baseline; gap: 12px; }
  .record .index { color: #1677ff; font-weight: 700; }
  .record h2 { margin: 0; font-size: 18px; flex: 1; }
  .record .time { color: #1677ff; font-variant-numeric: tabular-nums; }
  .record .meta { color: #8c8c8c; font-size: 13px; }
  .row { display: flex; gap: 12px; margin-top: 8px; }
  .row.stacked { flex-direction: column; }
  .row figure { margin: 0; flex: 1; }
  .row img { width: 100%; border-radius: 4px; }
  figcaption { font-size: 12px; color: #8c8c8c; margin-top: 4px; }
  .notes { margin-top: 8px; white-space: pre-wrap; }
  @media print { body { padding: 0; background: #fff; } .record { border: none; border-bottom: 1px solid #e2e2e2; } }
</style>
</head>
<body>
<h1>${escapeHtml(options.projectName)}</h1>
<p class="sub">视频：${escapeHtml(options.videoName)} · 时长：${formatTimeMs(options.durationMs)} · 分辨率：${options.width ?? '?'}×${options.height ?? '?'} · 导出时间：${escapeHtml(options.exportTime)} · 记录数：${options.items.length}</p>
${rows}
</body>
</html>`;
}

