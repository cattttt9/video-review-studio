import type { ReviewRecordDto } from '../../types';
import { formatTimeMs } from '../../utils/time';

export type ReportLayout = 'annotated' | 'comparison';

export interface ReportItem {
  record: ReviewRecordDto;
  annotated: string | null;
  source: string | null;
}

export interface ReportOptions {
  projectName: string;
  projectDescription?: string | null;
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

function recordTime(record: ReviewRecordDto): string {
  return record.timeMode === 'interval'
    ? `${formatTimeMs(record.startTimeMs)} – ${formatTimeMs(record.endTimeMs)}`
    : formatTimeMs(record.representativeTimeMs);
}

function pageFooter(projectName: string, page: number, total: number): string {
  return `<footer class="page-footer"><span>${escapeHtml(projectName)} · 视频复盘报告</span><span>第 ${page} 页 / 共 ${total} 页</span></footer>`;
}

export function buildReportHtml(options: ReportOptions): string {
  const tocPageSize = 14;
  const tocPageCount = Math.max(1, Math.ceil(options.items.length / tocPageSize));
  const firstRecordPage = 2 + tocPageCount;
  const totalPages = options.items.length + 1 + tocPageCount;
  const withScreenshot = options.items.filter((item) => item.record.hasScreenshot).length;
  const textOnly = options.items.length - withScreenshot;
  const highPriority = options.items.filter((item) => item.record.importance === '高').length;
  const categories = new Set(
    options.items.map((item) => item.record.category).filter((value): value is string => !!value),
  ).size;

  const tocPages = Array.from({ length: tocPageCount }, (_, tocPageIndex) => {
    const start = tocPageIndex * tocPageSize;
    const rows = options.items
      .slice(start, start + tocPageSize)
      .map((item, localIndex) => {
        const index = start + localIndex;
        const record = item.record;
        return `<div class="toc-row"><span class="toc-index">${String(index + 1).padStart(2, '0')}</span><span class="toc-title">${escapeHtml(record.title ?? '未命名记录')}</span><span class="toc-time">${recordTime(record)}</span><span class="toc-page">${firstRecordPage + index}</span></div>`;
      })
      .join('');
    const stats = tocPageIndex === 0
      ? `<div class="stats"><div class="stat"><strong>${options.items.length}</strong><span>记录总数</span></div><div class="stat"><strong>${withScreenshot}</strong><span>画面记录</span></div><div class="stat"><strong>${textOnly}</strong><span>文字记录</span></div><div class="stat"><strong>${highPriority}</strong><span>高重要记录 · ${categories} 类</span></div></div>`
      : '';
    const page = tocPageIndex + 2;
    return `<section class="page summary-page">
      <div class="page-header"><span>${escapeHtml(options.projectName)}</span><span>${tocPageIndex === 0 ? '报告概览' : `目录续 ${tocPageIndex}`}</span></div>
      <h2 class="section-title">${tocPageIndex === 0 ? '概览与目录' : '目录（续）'}</h2>
      ${stats}
      <div class="toc">${rows || '<p>未选择记录</p>'}</div>
      ${pageFooter(options.projectName, page, totalPages)}
    </section>`;
  }).join('\n');

  const recordPages = options.items
    .map((item, index) => {
      const record = item.record;
      const figures =
        options.layout === 'comparison'
          ? `<div class="figures comparison">${item.source ? `<figure><div class="image-frame"><img src="${escapeHtml(item.source)}" alt="原图"></div><figcaption>原始画面</figcaption></figure>` : ''}${item.annotated ? `<figure><div class="image-frame"><img src="${escapeHtml(item.annotated)}" alt="标注图"></div><figcaption>标注画面</figcaption></figure>` : ''}</div>`
          : item.annotated
            ? `<div class="figures"><figure><div class="image-frame"><img src="${escapeHtml(item.annotated)}" alt="标注图"></div><figcaption>标注画面</figcaption></figure></div>`
            : '';
      const noImage = !figures
        ? '<div class="text-record"><span>文字记录</span><p>该条记录未保存代表截图。</p></div>'
        : '';
      const notes = options.includeNotes
        ? `<section class="notes"><h3>复盘说明</h3><p>${escapeHtml(record.description?.trim() || '暂无补充说明')}</p></section>`
        : '';
      return `<section class="page record-page">
        <div class="page-header"><span>${escapeHtml(options.projectName)}</span><span>记录 ${String(index + 1).padStart(2, '0')}</span></div>
        <div class="record-heading"><div><span class="eyebrow">REVIEW NOTE ${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(record.title ?? '未命名记录')}</h2></div><div class="time-badge">${recordTime(record)}</div></div>
        <div class="tags"><span>${escapeHtml(record.category || '未分类')}</span><span class="importance ${record.importance === '高' ? 'high' : ''}">重要程度：${escapeHtml(record.importance || '未设置')}</span></div>
        ${figures}${noImage}${notes}
        ${pageFooter(options.projectName, firstRecordPage + index, totalPages)}
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.projectName)} 复盘报告</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #17202a; background: #dfe4e8; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; height: 297mm; margin: 10mm auto; padding: 18mm 18mm 16mm; overflow: hidden; background: #fff; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .cover { display: flex; flex-direction: column; justify-content: space-between; color: #fff; background: linear-gradient(145deg, #102a43 0%, #1f4e5f 58%, #3b7d78 100%); }
  .cover-mark { width: 18mm; height: 2mm; background: #efb366; }
  .cover-main { margin-top: 40mm; }
  .cover .kicker, .eyebrow { letter-spacing: .16em; font-size: 9pt; font-weight: 700; color: #efb366; }
  .cover h1 { max-width: 155mm; margin: 7mm 0 4mm; font-size: 30pt; line-height: 1.25; }
  .cover .subtitle { font-size: 15pt; opacity: .9; }
  .cover-description { max-width: 145mm; margin-top: 12mm; font-size: 10.5pt; line-height: 1.8; opacity: .8; white-space: pre-wrap; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 12mm; padding-top: 8mm; border-top: 1px solid rgba(255,255,255,.28); font-size: 9.5pt; }
  .cover-meta strong { display: block; margin-top: 1mm; font-size: 11pt; }
  .page-header { display: flex; justify-content: space-between; padding-bottom: 3mm; border-bottom: .3mm solid #d8e0e5; color: #6c7a86; font-size: 8.5pt; }
  .section-title { margin: 12mm 0 7mm; font-size: 23pt; color: #173b4b; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 10mm; }
  .stat { padding: 5mm 3mm; background: #f1f5f6; border-top: 1.3mm solid #3b7d78; }
  .stat strong { display: block; font-size: 20pt; color: #173b4b; }
  .stat span { font-size: 8.5pt; color: #6c7a86; }
  .toc { overflow: hidden; }
  .toc-row { display: grid; grid-template-columns: 12mm 1fr 30mm 12mm; gap: 3mm; align-items: center; min-height: 11mm; border-bottom: .25mm solid #e6ebee; font-size: 9.5pt; }
  .toc-index, .toc-page { color: #3b7d78; font-weight: 700; }
  .toc-time { color: #6c7a86; font-variant-numeric: tabular-nums; }
  .toc-page { text-align: right; }
  .record-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin: 10mm 0 4mm; }
  .record-heading h2 { margin: 2mm 0 0; font-size: 20pt; line-height: 1.3; color: #173b4b; }
  .time-badge { flex: none; padding: 2.5mm 4mm; border-radius: 1mm; background: #edf4f3; color: #27655f; font-size: 10pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tags { display: flex; gap: 2mm; margin-bottom: 6mm; }
  .tags span { padding: 1.5mm 3mm; border-radius: 5mm; background: #eff2f4; color: #52616d; font-size: 8.5pt; }
  .tags .high { color: #9b302b; background: #fbe9e7; }
  .figures { display: flex; align-items: flex-start; justify-content: center; gap: 5mm; width: 100%; }
  .figures figure { flex: 1; min-width: 0; margin: 0; }
  .image-frame { display: flex; align-items: center; justify-content: center; width: 100%; height: 145mm; padding: 2mm; background: #f2f4f5; border: .25mm solid #dce3e7; }
  .comparison .image-frame { height: 120mm; }
  .image-frame img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
  figcaption { margin-top: 2mm; text-align: center; color: #6c7a86; font-size: 8pt; }
  .notes { margin-top: 6mm; padding: 4mm 5mm; border-left: 1.2mm solid #efb366; background: #fbf8f2; }
  .notes h3 { margin: 0 0 2mm; color: #78562c; font-size: 9pt; }
  .notes p { max-height: 25mm; margin: 0; overflow: hidden; font-size: 9.5pt; line-height: 1.65; white-space: pre-wrap; }
  .text-record { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 135mm; background: #f3f6f7; border: .4mm dashed #bac7ce; color: #6c7a86; }
  .text-record span { font-size: 18pt; color: #3b7d78; }
  .page-footer { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; padding-top: 2.5mm; border-top: .25mm solid #d8e0e5; color: #7b8790; font-size: 8pt; }
  @media print { html, body { background: #fff; } .page { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
  <section class="page cover">
    <div><div class="cover-mark"></div><div class="cover-main"><div class="kicker">VIDEO REVIEW REPORT</div><h1>${escapeHtml(options.projectName)}</h1><div class="subtitle">视频复盘报告</div><p class="cover-description">${escapeHtml(options.projectDescription?.trim() || '关键画面、标注与复盘记录归档')}</p></div></div>
    <div class="cover-meta"><div>视频文件<strong>${escapeHtml(options.videoName)}</strong></div><div>报告记录<strong>${options.items.length} 条</strong></div><div>视频规格<strong>${options.width ?? '?'} × ${options.height ?? '?'} · ${formatTimeMs(options.durationMs)}</strong></div><div>生成时间<strong>${escapeHtml(options.exportTime)}</strong></div></div>
    ${pageFooter(options.projectName, 1, totalPages)}
  </section>
  ${tocPages}
  ${recordPages}
  <script>
    Promise.all(Array.from(document.images).map((image) => {
      if (image.complete && image.naturalWidth > 0) return image.decode?.().catch(() => undefined);
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      }).then(() => image.decode?.().catch(() => undefined));
    })).then(() => { document.documentElement.dataset.imagesReady = 'true'; });
  </script>
</body>
</html>`;
}
