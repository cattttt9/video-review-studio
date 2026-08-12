import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [resultPdfPath, setResultPdfPath] = useState<string | null>(null);
  const [resultDir, setResultDir] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(records.map((record) => record.id)),
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setRunning(false);
      setResultHtmlPath(null);
      setResultPdfPath(null);
      setResultDir(null);
      setSelectedIds(new Set(records.map((record) => record.id)));
    }
    wasOpenRef.current = open;
  }, [open, records]);

  const sorted = useMemo(() => {
    const list = [...records].filter((record) => selectedIds.has(record.id));
    list.sort((a, b) => {
      const av = sortMode === 'video_time' ? a.startTimeMs : Date.parse(a.createdAt);
      const bv = sortMode === 'video_time' ? b.startTimeMs : Date.parse(b.createdAt);
      const cmp = av - bv;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedIds, sortMode, sortDirection]);

  const selectedScreenshotRecords = useMemo(
    () => sorted.filter((record) => record.hasScreenshot && record.sourceImagePath),
    [sorted],
  );

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
      for (let i = 0; i < selectedScreenshotRecords.length; i += 1) {
        const record = selectedScreenshotRecords[i];
        setProgress({ current: i, total: selectedScreenshotRecords.length });
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
      const timestamp = new Date();
      const stamp = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}`;
      const packageName = `${sanitizeFileName(project.name)}_复盘报告_${stamp}`;
      const items: Array<{
        record: ReviewRecordDto;
        annotated: string | null;
        source: string | null;
      }> = [];
      for (let i = 0; i < sorted.length; i += 1) {
        const record = sorted[i];
        setProgress({ current: i, total: sorted.length });
        const hasImage = record.hasScreenshot && !!record.sourceImagePath;
        const annotations = hasImage ? await fetchAnnotations(record.id) : [];
        const base = `image_${String(i + 1).padStart(3, '0')}`;
        let annotated: string | null = null;
        let source: string | null = null;
        if (hasImage) {
          const canvas = await renderRecordImage(record, annotations);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_标注.png`;
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `${packageName}/images/${name}`,
              b64,
              dir,
            ),
          );
          annotated = `./images/${name}`;
        }
        if (hasImage && layout === 'comparison') {
          const canvas = await renderRecordImage(record, []);
          const b64 = await canvasToPngBase64(canvas);
          const name = `${base}_原图.png`;
          written.push(
            await fileService.writeProjectFile(
              project.id,
              `${packageName}/images/${name}`,
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
        projectDescription: project.description,
        videoName: project.videoMeta?.fileName ?? project.sourceVideoPath,
        durationMs: project.videoMeta?.durationMs ?? 0,
        width: project.videoMeta?.width ?? null,
        height: project.videoMeta?.height ?? null,
        exportTime: timestamp.toLocaleString('zh-CN'),
        items,
        layout,
        includeNotes,
      });
      const htmlPath = await fileService.writeProjectText(
        project.id,
        `${packageName}/report.html`,
        html,
        dir,
      );
      if (!(await verifyFiles([htmlPath, ...written]))) {
        message.error('报告导出校验失败：存在缺失文件，请检查导出目录');
        return;
      }
      setResultHtmlPath(htmlPath);
      const packageDir = htmlPath.replace(/[\\/][^\\/]+$/, '');
      setResultDir(packageDir);
      const pdfName = `${sanitizeFileName(project.name)}_复盘报告.pdf`;
      const separator = htmlPath.includes('\\') ? '\\' : '/';
      const pdfPath = `${packageDir}${separator}${pdfName}`;
      try {
        const createdPdf = await fileService.createPdfFromHtml(htmlPath, pdfPath);
        setResultPdfPath(createdPdf);
        message.success(`A4 PDF 报告已生成：${packageName}`);
      } catch (pdfError) {
        setResultPdfPath(null);
        message.warning(`HTML 报告已生成，但 PDF 生成失败：${describeError(pdfError)}`);
      }
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
            A4 报告图片形式
          </div>
          <Radio.Group
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            options={[
              { label: '仅标注图', value: 'annotated' },
              { label: '原图与标注图对照', value: 'comparison' },
            ]}
            optionType="button"
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="vrs-tiny vrs-muted">选择报告记录（含纯文字记录）</span>
            <Space size={6}>
              <Button size="small" type="link" onClick={() => setSelectedIds(new Set(records.map((record) => record.id)))}>全选</Button>
              <Button size="small" type="link" onClick={() => setSelectedIds(new Set())}>清空</Button>
            </Space>
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px 10px', border: '1px solid var(--vrs-border)', borderRadius: 6 }}>
            <Space direction="vertical" size={5} style={{ width: '100%' }}>
              {records.map((record) => (
                <Checkbox
                  key={record.id}
                  checked={selectedIds.has(record.id)}
                  onChange={(event) => setSelectedIds((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(record.id);
                    else next.delete(record.id);
                    return next;
                  })}
                >
                  {formatTimeMs(record.representativeTimeMs)} · {record.title || '未命名记录'} {!record.hasScreenshot ? '（文字）' : ''}
                </Checkbox>
              ))}
            </Space>
          </div>
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
            disabled={selectedScreenshotRecords.length === 0}
          >
            导出图片（原分辨率）
          </Button>
          <Button
            type="primary"
            loading={running}
            onClick={exportReport}
            disabled={sorted.length === 0}
          >
            生成 A4 PDF 报告
          </Button>
          {resultPdfPath && (
            <Button icon={<GlobalOutlined />} onClick={() => fileService.openPath(resultPdfPath)}>
              打开 PDF
            </Button>
          )}
          {resultHtmlPath && (
            <>
              <Button
                icon={<GlobalOutlined />}
                onClick={() => fileService.openPath(resultHtmlPath)}
              >
                打开 HTML 版本
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  if (resultDir) void fileService.revealInFolder(resultDir);
                }}
              >
                打开导出目录
              </Button>
            </>
          )}
        </div>
        <div className="vrs-tiny vrs-muted">
          每次导出会创建“项目名_复盘报告_日期时间”独立文件夹，内含 PDF、HTML 备份及 images/ 资源。
        </div>
      </Space>
    </Modal>
  );
}
