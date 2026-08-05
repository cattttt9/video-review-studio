import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Divider, Modal, Progress, Radio, Select, Space, message } from 'antd';
import { FolderOpenOutlined, GlobalOutlined, PictureOutlined } from '@ant-design/icons';
import type { ProjectDto, ReviewRecordDto } from '../../types';
import { recordService } from '../../services/records';
import { fileService } from '../../services/files';
import { annotationFromDto, type EditableAnnotation } from '../annotation/types';
import { canvasToPngBase64, renderCompositedCanvas } from '../annotation/canvasRenderer';
import { assetUrl } from '../../utils/paths';
import { formatTimeMs } from '../../utils/time';
import { sanitizeFileName } from '../../utils/filename';
import { describeError } from '../../services/invoke';

export interface ExportModalProps {
  open: boolean;
  project: ProjectDto;
  records: ReviewRecordDto[];
  onClose: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function ExportModal({ open, project, records, onClose }: ExportModalProps) {
  const [imageMode, setImageMode] = useState<'annotated' | 'source' | 'both'>('annotated');
  const [layout, setLayout] = useState<'annotated' | 'side' | 'stacked'>('annotated');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [sortMode, setSortMode] = useState<'video_time' | 'created_at'>('video_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [resultHtmlPath, setResultHtmlPath] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRunning(false);
      setResultHtmlPath(null);
    }
  }, [open]);

  const sorted = useMemo(() => {
    const list = [...records].filter((r) => r.hasScreenshot && r.sourceImagePath);
    list.sort((a, b) => {
      const av = sortMode === 'video_time' ? a.startTimeMs : 0;
      const bv = sortMode === 'video_time' ? b.startTimeMs : 0;
      const cmp = av - bv;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, sortMode, sortDirection]);

  const fetchAnnotations = async (recordId: string): Promise<EditableAnnotation[]> => {
    const dtos = await recordService.getAnnotations(project.id, recordId);
    return dtos.map(annotationFromDto);
  };

  const exportImageFiles = async () => {
    setRunning(true);
    try {
      const used = new Set<string>();
      for (let i = 0; i < sorted.length; i += 1) {
        const record = sorted[i];
        setProgress({ current: i, total: sorted.length });
        if (!record.sourceImagePath) continue;
        const annotations = await fetchAnnotations(record.id);
        const url = assetUrl(record.sourceImagePath);
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => undefined);
        const needAnnotated = imageMode !== 'source';
        const needSource = imageMode !== 'annotated';
        if (needSource) {
          const canvas = await renderCompositedCanvas(
            url,
            img.naturalWidth || 1920,
            img.naturalHeight || 1080,
            [],
            null,
          );
          const base64 = await canvasToPngBase64(canvas);
          const name = exportFileName(i + 1, record, '原图');
          await fileService.writeProjectFile(project.id, `images/${name}`, base64);
        }
        if (needAnnotated) {
          const canvas = await renderCompositedCanvas(
            url,
            img.naturalWidth || 1920,
            img.naturalHeight || 1080,
            annotations,
            null,
          );
          const base64 = await canvasToPngBase64(canvas);
          const name = exportFileName(i + 1, record, '标注');
          await fileService.writeProjectFile(project.id, `images/${name}`, base64);
        }
        used.add(record.id);
      }
      message.success('图片导出完成，可在项目 exports/images 目录查看');
    } catch (err) {
      message.error(`导出失败：${describeError(err)}`);
    } finally {
      setRunning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const exportFileName = (index: number, record: ReviewRecordDto, suffix: string): string => {
    const time = formatTimeMs(record.representativeTimeMs).replace(/:/g, '-');
    const title = sanitizeFileName(record.title ?? '未命名');
    return `${String(index).padStart(3, '0')}_${time}_${title}_${suffix}.png`;
  };

  const buildHtml = (
    items: Array<{
      record: ReviewRecordDto;
      annotated: string | null;
      source: string | null;
    }>,
  ): string => {
    const rows = items
      .map((item, index) => {
        const record = item.record;
        const time =
          record.timeMode === 'interval'
            ? `${formatTimeMs(record.startTimeMs)} – ${formatTimeMs(record.endTimeMs)}`
            : formatTimeMs(record.representativeTimeMs);
        const notes = includeNotes
          ? `<p class="notes">${escapeHtml(record.description ?? '')}</p>`
          : '';
        const images =
          layout === 'side'
            ? `<div class="row side">${item.source ? `<figure><img src="${item.source}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${item.annotated ? `<figure><img src="${item.annotated}" alt="标注图"><figcaption>标注图</figcaption></figure>` : ''}</div>`
            : layout === 'stacked'
              ? `<div class="row stacked">${item.source ? `<figure><img src="${item.source}" alt="原图"><figcaption>原图</figcaption></figure>` : ''}${item.annotated ? `<figure><img src="${item.annotated}" alt="标注图"><figcaption>标注图</figcaption></figure>` : ''}</div>`
              : `<div class="row"><figure><img src="${item.annotated}" alt="标注图"><figcaption>标注图</figcaption></figure></div>`;
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
<title>${escapeHtml(project.name)} 复盘报告</title>
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
<h1>${escapeHtml(project.name)}</h1>
<p class="sub">视频：${escapeHtml(project.videoMeta?.fileName ?? project.sourceVideoPath)} · 时长：${formatTimeMs(project.videoMeta?.durationMs ?? 0)} · 分辨率：${project.videoMeta?.width ?? '?'}×${project.videoMeta?.height ?? '?'} · 导出时间：${new Date().toLocaleString('zh-CN')} · 记录数：${items.length}</p>
${rows}
</body>
</html>`;
  };

  const exportReport = async () => {
    setRunning(true);
    try {
      const items = [];
      for (let i = 0; i < sorted.length; i += 1) {
        const record = sorted[i];
        setProgress({ current: i, total: sorted.length });
        if (!record.sourceImagePath) continue;
        const annotations = await fetchAnnotations(record.id);
        const url = assetUrl(record.sourceImagePath);
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => undefined);
        const nw = img.naturalWidth || 1920;
        const nh = img.naturalHeight || 1080;
        const base = `${String(i + 1).padStart(3, '0')}_${formatTimeMs(record.representativeTimeMs).replace(/:/g, '-')}_${sanitizeFileName(record.title ?? '未命名')}`;
        let annotated: string | null = null;
        let source: string | null = null;
        if (imageMode !== 'source' || layout !== 'annotated') {
          const canvas = await renderCompositedCanvas(url, nw, nh, annotations, 1920);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_标注.png`;
          await fileService.writeProjectFile(project.id, `report/images/${name}`, b64);
          annotated = `images/${name}`;
        }
        if (imageMode !== 'annotated') {
          const canvas = await renderCompositedCanvas(url, nw, nh, [], 1920);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_原图.png`;
          await fileService.writeProjectFile(project.id, `report/images/${name}`, b64);
          source = `images/${name}`;
        }
        if (!annotated) {
          const canvas = await renderCompositedCanvas(url, nw, nh, annotations, 1920);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_标注.png`;
          await fileService.writeProjectFile(project.id, `report/images/${name}`, b64);
          annotated = `images/${name}`;
        }
        items.push({ record, annotated, source });
      }
      const html = buildHtml(items);
      const path = await fileService.writeProjectText(project.id, 'report.html', html);
      setResultHtmlPath(path);
      message.success('HTML 报告导出完成');
    } catch (err) {
      message.error(`报告导出失败：${describeError(err)}`);
    } finally {
      setRunning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const exportsDir = `${project.projectDir.replace(/\\/g, '/')}/exports`;

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="导出" width={620} destroyOnHidden>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div className="vrs-tiny vrs-muted" style={{ marginBottom: 4 }}>
            图片内容
          </div>
          <Radio.Group
            value={imageMode}
            onChange={(e) => setImageMode(e.target.value)}
            options={[
              { label: '仅标注图', value: 'annotated' },
              { label: '仅原图', value: 'source' },
              { label: '两者都要', value: 'both' },
            ]}
            optionType="button"
          />
        </div>
        <div>
          <div className="vrs-tiny vrs-muted" style={{ marginBottom: 4 }}>
            报告图片布局
          </div>
          <Radio.Group
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            options={[
              { label: '仅标注图', value: 'annotated' },
              { label: '原图与标注图并排', value: 'side' },
              { label: '原图在上、标注图在下', value: 'stacked' },
            ]}
            optionType="button"
          />
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Checkbox checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)}>
            报告包含说明文字
          </Checkbox>
          <Select
            size="small"
            value={sortMode}
            onChange={setSortMode}
            style={{ width: 130 }}
            options={[
              { label: '按视频时间', value: 'video_time' },
              { label: '按创建时间', value: 'created_at' },
            ]}
          />
          <Select
            size="small"
            value={sortDirection}
            onChange={setSortDirection}
            style={{ width: 90 }}
            options={[
              { label: '正序', value: 'asc' },
              { label: '倒序', value: 'desc' },
            ]}
          />
        </div>
        <Divider style={{ margin: '4px 0' }} />
        {running && (
          <Progress
            percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
            status="active"
          />
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            icon={<PictureOutlined />}
            loading={running}
            onClick={exportImageFiles}
            disabled={sorted.length === 0}
          >
            导出图片（原分辨率）
          </Button>
          <Button
            type="primary"
            loading={running}
            onClick={exportReport}
            disabled={sorted.length === 0}
          >
            导出 HTML 报告
          </Button>
          {resultHtmlPath && (
            <>
              <Button
                icon={<GlobalOutlined />}
                onClick={() => fileService.openPath(resultHtmlPath)}
              >
                在浏览器打开（可打印为 PDF）
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => fileService.revealInFolder(resultHtmlPath)}
              >
                打开文件夹
              </Button>
            </>
          )}
        </div>
        <div className="vrs-tiny vrs-muted">
          导出位置：{exportsDir}（整个目录移动后 HTML 报告仍可打开）
        </div>
      </Space>
    </Modal>
  );
}
