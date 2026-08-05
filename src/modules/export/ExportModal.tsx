import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  message,
} from 'antd';
import {
  FolderOpenOutlined,
  GlobalOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ProjectDto, ReviewRecordDto } from '../../types';
import { recordService } from '../../services/records';
import { fileService } from '../../services/files';
import {
  annotationFromDto,
  type EditableAnnotation,
} from '../annotation/types';
import {
  canvasToPngBase64,
  renderCompositedCanvas,
} from '../annotation/canvasRenderer';
import { assetUrl } from '../../utils/paths';
import { formatTimeMs } from '../../utils/time';
import { sanitizeFileName } from '../../utils/filename';
import { describeError } from '../../services/invoke';
import { buildReportHtml, type ReportLayout } from './reportHtml';

export interface ExportModalProps {
  open: boolean;
  project: ProjectDto;
  records: ReviewRecordDto[];
  onClose: () => void;
}

const EXPORT_DIR_KEY = 'vrs-export-dir';

function rememberExportDir(dir: string | null) {
  try {
    if (dir) localStorage.setItem(EXPORT_DIR_KEY, dir);
    else localStorage.removeItem(EXPORT_DIR_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}

function readRememberedExportDir(): string | null {
  try {
    return localStorage.getItem(EXPORT_DIR_KEY);
  } catch {
    return null;
  }
}

export default function ExportModal({
  open,
  project,
  records,
  onClose,
}: ExportModalProps) {
  const [imageMode, setImageMode] = useState<'annotated' | 'source' | 'both'>(
    'annotated',
  );
  const [layout, setLayout] = useState<ReportLayout>('annotated');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [sortMode, setSortMode] = useState<'video_time' | 'created_at'>(
    'video_time',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [exportDir, setExportDir] = useState<string | null>(() =>
    readRememberedExportDir(),
  );
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

  const fetchAnnotations = useCallback(
    async (recordId: string): Promise<EditableAnnotation[]> => {
      const dtos = await recordService.getAnnotations(project.id, recordId);
      return dtos.map(annotationFromDto);
    },
    [project.id],
  );

  const chooseExportDir = useCallback(async (): Promise<string | null> => {
    const dir = await openDialog({ directory: true, multiple: false });
    if (typeof dir !== 'string') return null;
    setExportDir(dir);
    rememberExportDir(dir);
    return dir;
  }, []);

  const ensureExportDir = useCallback(async (): Promise<string | null> => {
    if (exportDir) return exportDir;
    return chooseExportDir();
  }, [exportDir, chooseExportDir]);

  const verifyFiles = useCallback(async (paths: string[]): Promise<boolean> => {
    const results = await Promise.all(paths.map((p) => fileService.pathExists(p)));
    return results.every(Boolean);
  }, []);

  const renderRecordImage = async (
    record: ReviewRecordDto,
    annotations: EditableAnnotation[],
  ): Promise<HTMLCanvasElement> => {
    const url = assetUrl(record.sourceImagePath!);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => undefined);
    return renderCompositedCanvas(
      url,
      img.naturalWidth || 1920,
      img.naturalHeight || 1080,
      annotations,
      null,
    );
  };

  const exportImageFiles = async () => {
    const dir = await ensureExportDir();
    if (!dir) return;
    setRunning(true);
    try {
      const written: string[] = [];
      for (let i = 0; i < sorted.length; i += 1) {
        const record = sorted[i];
        setProgress({ current: i, total: sorted.length });
        if (!record.sourceImagePath) continue;
        const annotations = await fetchAnnotations(record.id);
        const needAnnotated = imageMode !== 'source';
        const needSource = imageMode !== 'annotated';
        if (needSource) {
          const canvas = await renderRecordImage(record, []);
          const base64 = await canvasToPngBase64(canvas);
          const name = exportFileName(i + 1, record, '原图');
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `images/${name}`,
              base64,
              dir,
            ),
          );
        }
        if (needAnnotated) {
          const canvas = await renderRecordImage(record, annotations);
          const base64 = await canvasToPngBase64(canvas);
          const name = exportFileName(i + 1, record, '标注');
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `images/${name}`,
              base64,
              dir,
            ),
          );
        }
      }
      if (!(await verifyFiles(written))) {
        message.error('导出校验失败：部分图片文件不存在，请检查导出目录');
        return;
      }
      message.success(`图片导出完成：${dir}`);
    } catch (err) {
      message.error(`导出失败：${describeError(err)}`);
    } finally {
      setRunning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const exportFileName = (
    index: number,
    record: ReviewRecordDto,
    suffix: string,
  ): string => {
    const time = formatTimeMs(record.representativeTimeMs).replace(/:/g, '-');
    const title = sanitizeFileName(record.title ?? '未命名');
    return `${String(index).padStart(3, '0')}_${time}_${title}_${suffix}.png`;
  };

  const exportReport = async () => {
    const dir = await ensureExportDir();
    if (!dir) return;
    setRunning(true);
    try {
      const written: string[] = [];
      const items: Array<{
        record: ReviewRecordDto;
        annotated: string | null;
        source: string | null;
      }> = [];
      for (let i = 0; i < sorted.length; i += 1) {
        const record = sorted[i];
        setProgress({ current: i, total: sorted.length });
        if (!record.sourceImagePath) continue;
        const annotations = await fetchAnnotations(record.id);
        const base = `image_${String(i + 1).padStart(3, '0')}`;
        let annotated: string | null = null;
        let source: string | null = null;
        if (imageMode !== 'source') {
          const canvas = await renderRecordImage(record, annotations);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_标注.png`;
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `images/${name}`,
              b64,
              dir,
            ),
          );
          annotated = `./images/${name}`;
        }
        if (imageMode !== 'annotated') {
          const canvas = await renderRecordImage(record, []);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_原图.png`;
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `images/${name}`,
              b64,
              dir,
            ),
          );
          source = `./images/${name}`;
        }
        items.push({ record, annotated, source });
      }
      const html = buildReportHtml({
        projectName: project.name,
        videoName: project.videoMeta?.fileName ?? project.sourceVideoPath,
        durationMs: project.videoMeta?.durationMs ?? 0,
        width: project.videoMeta?.width ?? null,
        height: project.videoMeta?.height ?? null,
        exportTime: new Date().toLocaleString('zh-CN'),
        items,
        layout,
        includeNotes,
      });
      const htmlPath = await fileService.writeProjectText(
        project.id,
        'report.html',
        html,
        dir,
      );
      if (!(await verifyFiles([htmlPath, ...written]))) {
        message.error('报告导出校验失败：存在缺失文件，请检查导出目录');
        return;
      }
      setResultHtmlPath(htmlPath);
      message.success(`HTML 报告导出完成：${dir}`);
    } catch (err) {
      message.error(`报告导出失败：${describeError(err)}`);
    } finally {
      setRunning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="导出"
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div className="vrs-tiny vrs-muted" style={{ marginBottom: 4 }}>
            导出目录
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <span
              className="vrs-ellipsis"
              style={{
                flex: 1,
                lineHeight: '30px',
                padding: '0 10px',
                border: '1px solid var(--vrs-border)',
                borderRadius: 6,
                background: '#fafafa',
                fontSize: 12,
              }}
              title={exportDir ?? ''}
            >
              {exportDir ?? '未选择（导出时将弹出目录选择窗口）'}
            </span>
            <Button icon={<FolderOpenOutlined />} onClick={() => void chooseExportDir()}>
              选择目录
            </Button>
          </Space.Compact>
        </div>
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
          <Checkbox
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
          >
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
            percent={
              progress.total > 0
                ? Math.round((progress.current / progress.total) * 100)
                : 0
            }
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
                onClick={() => {
                  if (exportDir) void fileService.revealInFolder(exportDir);
                }}
              >
                打开导出目录
              </Button>
            </>
          )}
        </div>
        <div className="vrs-tiny vrs-muted">
          导出结构：report.html 与 images/ 位于同一目录，使用相对路径，整目录移动后仍可打开。
        </div>
      </Space>
    </Modal>
  );
}

