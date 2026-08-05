import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, App as AntApp, Button, Modal, Select, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FullscreenOutlined,
  HomeOutlined,
  MinusOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  SaveOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { projectService } from '../services/project';
import { recordService } from '../services/records';
import { videoService } from '../services/video';
import { useProjectStore } from '../stores/projectStore';
import { describeError } from '../services/invoke';
import { attachVideoElement, useVideoStore, videoActions } from '../stores/videoStore';
import { useShortcuts } from '../hooks/useShortcuts';
import { assetUrl } from '../utils/paths';
import { formatTimeMs } from '../utils/time';
import type { NewRecordInput, RelocateComparison, ReviewRecordDto } from '../types';
import AnnotationEditor from '../modules/annotation/AnnotationEditor';
import {
  DEFAULT_STYLE,
  annotationFromDto,
  annotationToInput,
  type AnnotationStyle,
  type EditableAnnotation,
  type ToolType,
} from '../modules/annotation/types';
import { useAnnotationHistory } from '../modules/annotation/history';
import StylePanel from '../modules/annotation/StylePanel';
import Timeline from '../modules/timeline/Timeline';
import RecordCard from '../modules/record/RecordCard';
import RecordFormModal, { type RecordFormValues } from '../modules/record/RecordFormModal';
import PreviewModal from '../modules/workspace/PreviewModal';
import ExportModal from '../modules/export/ExportModal';
import { generateThumbnail } from '../modules/thumbnail/thumbnail';

const TOOL_ITEMS: Array<{ tool: ToolType; label: string; icon: React.ReactNode; key: string }> = [
  { tool: 'select', label: '选择', icon: <CheckOutlined />, key: 'select' },
  { tool: 'pen', label: '画笔 (P)', icon: <EditOutlined />, key: 'pen' },
  { tool: 'line', label: '直线', icon: <MinusOutlined />, key: 'line' },
  { tool: 'arrow', label: '箭头 (A)', icon: <ArrowUpOutlined />, key: 'arrow' },
  { tool: 'rect', label: '矩形 (R)', icon: <EditOutlined />, key: 'rect' },
  { tool: 'ellipse', label: '椭圆', icon: <EditOutlined />, key: 'ellipse' },
  { tool: 'text', label: '文本 (T)', icon: <EditOutlined />, key: 'text' },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message: antMessage } = AntApp.useApp();
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const video = useVideoStore();

  const [records, setRecords] = useState<ReviewRecordDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoKind, setVideoKind] = useState<'source' | 'proxy' | null>(null);
  const [proxyState, setProxyState] = useState<'idle' | 'generating' | 'ready' | 'failed'>('idle');
  const [proxyPercent, setProxyPercent] = useState(0);
  const [portablePercent, setPortablePercent] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [tool, setTool] = useState<ToolType>('select');
  const [activeStyle, setActiveStyle] = useState<AnnotationStyle>(DEFAULT_STYLE);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annotationsDirty, setAnnotationsDirty] = useState(false);
  const [recordForm, setRecordForm] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    record: ReviewRecordDto | null;
  }>({ open: false, mode: 'create', record: null });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [relocateInfo, setRelocateInfo] = useState<RelocateComparison | null>(null);
  const [relocatePath, setRelocatePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const history = useAnnotationHistory();
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const thumbAttempted = useRef<Set<string>>(new Set());
  const dirtyRef = useRef(false);

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  // 打开项目（从首页跳转）
  useEffect(() => {
    if (project) return;
    const dir = (location.state as { projectDir?: string } | null)?.projectDir;
    if (dir) {
      projectService
        .openProject(dir)
        .then(setProject)
        .catch((err) => antMessage.error(`打开项目失败：${describeError(err)}`));
    } else {
      navigate('/', { replace: true });
    }
  }, [project, location.state, navigate, setProject, antMessage]);

  // 加载记录
  useEffect(() => {
    if (!project) return;
    recordService
      .listRecords(project.id, project.sortMode, project.sortDirection)
      .then((list) => {
        setRecords(list);
        setSelectedId(null);
        history.reset([]);
      })
      .catch((err) => antMessage.error(`加载记录失败：${describeError(err)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project]);

  // 解析可播放视频
  useEffect(() => {
    if (!project) return;
    setVideoUrl(null);
    setVideoKind(null);
    videoService
      .resolvePlayableVideo(project.id)
      .then((result) => {
        setVideoUrl(assetUrl(result.path));
        setVideoKind(result.kind);
      })
      .catch(() => {
        setVideoUrl(null);
        setVideoKind(null);
      });
  }, [project]);

  const needsProxy = useMemo(() => {
    if (!project?.videoMeta || videoKind !== 'source') return false;
    const meta = project.videoMeta;
    const container = (meta.containerFormat ?? '').toLowerCase();
    const codec = (meta.codec ?? '').toLowerCase();
    const browserFriendlyContainer =
      container.includes('mp4') || container.includes('mov') || container.includes('webm');
    const browserFriendlyCodec = ['h264', 'avc1', 'vp8', 'vp9', 'av1'].includes(codec);
    return !(browserFriendlyContainer && browserFriendlyCodec);
  }, [project, videoKind]);

  // 任务进度事件
  useEffect(() => {
    if (!project) return;
    const un1 = listen<{ projectId: string; percent: number; doneMs: number; totalMs: number }>(
      'proxy-progress',
      (e) => {
        if (e.payload.projectId === project.id) {
          setProxyPercent(e.payload.percent);
        }
      },
    );
    const un2 = listen<{ projectId: string; percent: number }>('portable-progress', (e) => {
      if (e.payload.projectId === project.id) {
        setPortablePercent(e.payload.percent);
      }
    });
    return () => {
      void un1.then((fn) => fn());
      void un2.then((fn) => fn());
    };
  }, [project?.id, project]);

  const saveAnnotations = useCallback(
    async (manual: boolean) => {
      if (!project || !selectedRecord) return;
      setSaveState('saving');
      try {
        const inputs = history.annotations.map((a) => annotationToInput(a));
        await recordService.replaceAnnotations(project.id, selectedRecord.id, inputs);
        const thumbnailPath = await generateThumbnail(
          project.id,
          selectedRecord,
          history.annotations,
        );
        setRecords((list) =>
          list.map((r) =>
            r.id === selectedRecord.id
              ? {
                  ...r,
                  thumbnailPath,
                  thumbnailVersion: r.thumbnailVersion + 1,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        );
        dirtyRef.current = false;
        setAnnotationsDirty(false);
        setSaveState('saved');
        if (manual) antMessage.success('标注已保存');
      } catch (err) {
        setSaveState('error');
        antMessage.error(`保存失败：${describeError(err)}`);
      }
    },
    [project, selectedRecord, history.annotations, antMessage],
  );

  // 选中记录：加载标注 + 跳转
  const selectRecord = useCallback(
    async (record: ReviewRecordDto) => {
      if (dirtyRef.current) {
        await saveAnnotations(false);
      }
      setSelectedId(record.id);
      setSelectedAnnotationId(null);
      setTool('select');
      dirtyRef.current = false;
      setAnnotationsDirty(false);
      if (record.hasScreenshot && record.sourceImagePath) {
        try {
          const dtos = await recordService.getAnnotations(project!.id, record.id);
          history.reset(dtos.map(annotationFromDto));
        } catch {
          history.reset([]);
        }
      } else {
        history.reset([]);
      }
      if (videoUrl) {
        videoActions.seek(record.representativeTimeMs);
        const el = videoElementRef.current;
        if (el) el.pause();
      }
    },
    [project, history, videoUrl, saveAnnotations],
  );

  const deselectRecord = useCallback(async () => {
    if (dirtyRef.current) {
      await saveAnnotations(false);
    }
    setSelectedId(null);
    setSelectedAnnotationId(null);
    history.reset([]);
  }, [history, saveAnnotations]);

  // 保存标注（防抖自动保存）
  useEffect(() => {
    if (!annotationsDirty || !project || !selectedRecord) return;
    const timer = setTimeout(() => {
      void saveAnnotations(false);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsDirty, history.annotations]);

  const handleCommit = useCallback(
    (next: EditableAnnotation[]) => {
      history.commit(next);
      dirtyRef.current = true;
      setAnnotationsDirty(true);
    },
    [history],
  );

  const handleChange = useCallback(
    (next: EditableAnnotation[]) => {
      history.setAnnotations(next);
      dirtyRef.current = true;
      setAnnotationsDirty(true);
    },
    [history],
  );

  const handleHistoryCommit = useCallback(
    (next: EditableAnnotation[]) => {
      history.commit(next);
      dirtyRef.current = true;
      setAnnotationsDirty(true);
    },
    [history],
  );

  const handleRecordSubmit = async (values: RecordFormValues) => {
    if (!project) return;
    setSubmitting(true);
    try {
      const toMs = (s: string) => {
        const parts = s.split(':').map((p) => parseFloat(p));
        let ms = 0;
        if (parts.length === 3) ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        else if (parts.length === 2) ms = (parts[0] * 60 + parts[1]) * 1000;
        return Math.round(ms);
      };
      const start = toMs(values.startTime);
      const end = toMs(values.endTime);
      const representative = toMs(values.representativeTime);
      const wantScreenshot = values.hasScreenshot && project.videoExists;

      if (recordForm.mode === 'create') {
        let imagePath: string | null = null;
        if (wantScreenshot) {
          imagePath = await videoService.captureScreenshot(
            project.id,
            representative,
            `record-${crypto.randomUUID()}`,
          );
        }
        const input: NewRecordInput = {
          title: values.title || null,
          description: values.description || null,
          category: values.category || null,
          importance: values.importance,
          timeMode: values.timeMode,
          startTimeMs: start,
          endTimeMs: end,
          representativeTimeMs: representative,
          hasScreenshot: values.hasScreenshot && project.videoExists,
          sourceImagePath: imagePath,
        };
        const created = await recordService.createRecord(project.id, input);
        setRecordForm({ open: false, mode: 'create', record: null });
        const list = await recordService.listRecords(
          project.id,
          project.sortMode,
          project.sortDirection,
        );
        setRecords(list);
        await selectRecord(list.find((r) => r.id === created.id) ?? created);
        if (created.sourceImagePath) {
          const thumbnailPath = await generateThumbnail(project.id, created, []);
          setRecords((prev) =>
            prev.map((r) => (r.id === created.id ? { ...r, thumbnailPath } : r)),
          );
        }
      } else {
        const record = recordForm.record!;
        let imagePath = record.sourceImagePath;
        if (values.recapture && wantScreenshot) {
          imagePath = await videoService.captureScreenshot(
            project.id,
            representative,
            `record-${record.id}-source`,
          );
        }
        const input: NewRecordInput = {
          title: values.title || null,
          description: values.description || null,
          category: values.category || null,
          importance: values.importance,
          timeMode: values.timeMode,
          startTimeMs: start,
          endTimeMs: end,
          representativeTimeMs: representative,
          hasScreenshot: values.hasScreenshot && project.videoExists,
          sourceImagePath: values.hasScreenshot && project.videoExists ? imagePath : null,
        };
        const updated = await recordService.updateRecord(project.id, record.id, input);
        if (!values.keepAnnotations && values.recapture) {
          await recordService.replaceAnnotations(project.id, record.id, []);
          history.reset([]);
        }
        setRecordForm({ open: false, mode: 'create', record: null });
        const list = await recordService.listRecords(
          project.id,
          project.sortMode,
          project.sortDirection,
        );
        setRecords(list);
        await selectRecord(list.find((r) => r.id === updated.id) ?? updated);
        if (updated.sourceImagePath) {
          await generateThumbnail(project.id, updated, history.annotations);
        }
      }
      antMessage.success(recordForm.mode === 'create' ? '记录已创建' : '记录已更新');
      projectService
        .refreshProject(project.id)
        .then(setProject)
        .catch(() => undefined);
    } catch (err) {
      antMessage.error(`操作失败：${describeError(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (record: ReviewRecordDto) => {
    if (!project) return;
    try {
      await recordService.deleteRecord(project.id, record.id);
      const list = await recordService.listRecords(
        project.id,
        project.sortMode,
        project.sortDirection,
      );
      setRecords(list);
      if (selectedId === record.id) {
        setSelectedId(null);
        history.reset([]);
      }
      antMessage.success('记录已删除');
    } catch (err) {
      antMessage.error(`删除失败：${describeError(err)}`);
    }
  };

  const handleCopyRecord = async (record: ReviewRecordDto) => {
    if (!project) return;
    try {
      const copied = await recordService.copyRecord(project.id, record.id);
      const list = await recordService.listRecords(
        project.id,
        project.sortMode,
        project.sortDirection,
      );
      setRecords(list);
      await selectRecord(list.find((r) => r.id === copied.id) ?? copied);
      antMessage.success('记录已复制');
    } catch (err) {
      antMessage.error(`复制失败：${describeError(err)}`);
    }
  };

  const handleRelocate = async () => {
    if (!project) return;
    const path = await openDialog({
      multiple: false,
      filters: [
        {
          name: '视频文件',
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv', 'wmv', 'm4v', 'ts', 'mts'],
        },
      ],
    });
    if (typeof path !== 'string') return;
    try {
      const comparison = await videoService.compareVideo(project.id, path);
      setRelocatePath(path);
      setRelocateInfo(comparison);
    } catch (err) {
      antMessage.error(`检查新视频失败：${describeError(err)}`);
    }
  };

  const confirmRelocate = async (force: boolean) => {
    if (!project || !relocatePath) return;
    try {
      if (force) {
        await videoService.forceBindVideo(project.id, relocatePath);
      } else {
        await videoService.bindVideo(project.id, relocatePath);
      }
      const updated = await projectService.refreshProject(project.id);
      setProject(updated);
      setRelocateInfo(null);
      setRelocatePath(null);
      antMessage.success('视频已重新定位');
    } catch (err) {
      antMessage.error(`重新定位失败：${describeError(err)}`);
    }
  };

  const ensureProxy = async () => {
    if (!project) return;
    setProxyState('generating');
    setProxyPercent(0);
    try {
      await videoService.ensureProxy(project.id);
      setProxyState('ready');
      const result = await videoService.resolvePlayableVideo(project.id);
      setVideoUrl(assetUrl(result.path));
      setVideoKind(result.kind);
      antMessage.success('代理视频生成完成');
    } catch (err) {
      setProxyState('failed');
      antMessage.error(`代理生成失败：${describeError(err)}`);
    }
  };

  useShortcuts({
    enabled: !!project,
    onTogglePlay: () => videoActions.togglePlay(),
    onFrameStep: (dir) => videoActions.stepFrame(dir, project?.videoMeta?.frameRate),
    onSeekBy: (sec) => videoActions.skip(sec),
    onNewRecord: () => {
      if (project && project.videoExists) {
        setRecordForm({ open: true, mode: 'create', record: null });
      }
    },
    onDeleteAnnotation: () => {
      if (selectedAnnotationId && tool === 'select') {
        handleCommit(history.annotations.filter((a) => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
    },
    onUndo: () => {
      history.undo();
      dirtyRef.current = true;
      setAnnotationsDirty(true);
    },
    onRedo: () => {
      history.redo();
      dirtyRef.current = true;
      setAnnotationsDirty(true);
    },
    onSetTool: (t) => {
      setTool(t);
      if (t !== 'select') setSelectedAnnotationId(null);
    },
    onEscape: () => {
      if (tool !== 'select') {
        setTool('select');
      } else if (selectedAnnotationId) {
        setSelectedAnnotationId(null);
      } else if (selectedRecord) {
        void deselectRecord();
      }
    },
    onSave: () => void saveAnnotations(true),
  });

  if (!project) return null;

  const meta = project.videoMeta;
  const editingScreenshot = selectedRecord?.hasScreenshot && !!selectedRecord.sourceImagePath;
  const thumbnailUrlFor = (record: ReviewRecordDto) =>
    record.thumbnailPath ? assetUrl(record.thumbnailPath) : null;

  const ensureCardThumbnail = (record: ReviewRecordDto) => {
    if (
      !record.thumbnailPath &&
      record.hasScreenshot &&
      record.sourceImagePath &&
      !thumbAttempted.current.has(record.id)
    ) {
      thumbAttempted.current.add(record.id);
      recordService
        .getAnnotations(project.id, record.id)
        .then((dtos) => generateThumbnail(project.id, record, dtos.map(annotationFromDto)))
        .then((path) => {
          if (path) {
            setRecords((list) =>
              list.map((r) => (r.id === record.id ? { ...r, thumbnailPath: path } : r)),
            );
          }
        })
        .catch(() => undefined);
    }
  };

  const sortOptions = [
    { label: '按视频时间', value: 'video_time' },
    { label: '按创建时间', value: 'created_at' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div
        style={{
          height: 46,
          background: '#fff',
          borderBottom: '1px solid var(--vrs-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 10,
        }}
      >
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => {
            projectService.closeProject(project.id).catch(() => undefined);
            setProject(null);
            navigate('/');
          }}
        />
        <strong style={{ fontSize: 14 }}>{project.name}</strong>
        <span className={`vrs-tiny ${saveState === 'error' ? 'vrs-danger' : 'vrs-muted'}`}>
          {saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中…' : '保存失败'}
        </span>
        <div style={{ flex: 1 }} />
        {needsProxy && proxyState !== 'ready' && (
          <Button
            size="small"
            icon={<CloudDownloadOutlined />}
            loading={proxyState === 'generating'}
            onClick={ensureProxy}
          >
            {proxyState === 'generating'
              ? `生成代理 ${Math.round(proxyPercent)}%`
              : '生成兼容代理视频'}
          </Button>
        )}
        <Tooltip title="转为便携项目（复制视频到项目目录）">
          <Button
            size="small"
            icon={<CloudDownloadOutlined />}
            loading={portablePercent != null}
            onClick={async () => {
              setPortablePercent(0);
              try {
                await videoService.convertToPortable(project.id);
                const updated = await projectService.refreshProject(project.id);
                setProject(updated);
                antMessage.success('已转为便携项目');
              } catch (err) {
                antMessage.error(`转换失败：${describeError(err)}`);
              } finally {
                setPortablePercent(null);
              }
            }}
          >
            便携项目
          </Button>
        </Tooltip>
        <Button size="small" icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>
          导出
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setRecordForm({ open: true, mode: 'create', record: null })}
        >
          新建记录 (N)
        </Button>
      </div>

      {/* 视频丢失提示 */}
      {!project.videoExists && (
        <Alert
          banner
          type="warning"
          message="原视频丢失，已有记录仍可查看；新建截图与代理需要重新定位视频。"
          action={
            <Button size="small" onClick={handleRelocate}>
              重新定位视频
            </Button>
          }
        />
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左侧工具栏 */}
        <div
          style={{
            width: 68,
            background: '#fff',
            borderRight: '1px solid var(--vrs-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: 4,
            overflowY: 'auto',
          }}
        >
          {TOOL_ITEMS.map((item) => (
            <Tooltip key={item.key} title={item.label} placement="right">
              <Button
                type={tool === item.tool ? 'primary' : 'text'}
                icon={item.icon}
                onClick={() => {
                  setTool(item.tool);
                  if (item.tool !== 'select') setSelectedAnnotationId(null);
                }}
              />
            </Tooltip>
          ))}
          <div style={{ width: 40, borderTop: '1px solid var(--vrs-border)', margin: '6px 0' }} />
          <Tooltip title="撤销 (Ctrl+Z)">
            <Button
              type="text"
              icon={<UndoOutlined />}
              disabled={!history.canUndo}
              onClick={() => {
                history.undo();
                dirtyRef.current = true;
                setAnnotationsDirty(true);
              }}
            />
          </Tooltip>
          <Tooltip title="重做 (Ctrl+Y)">
            <Button
              type="text"
              icon={<RedoOutlined />}
              disabled={!history.canRedo}
              onClick={() => {
                history.redo();
                dirtyRef.current = true;
                setAnnotationsDirty(true);
              }}
            />
          </Tooltip>
          <Tooltip title="删除选中标注 (Delete)">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!selectedAnnotationId}
              onClick={() => {
                handleCommit(history.annotations.filter((a) => a.id !== selectedAnnotationId));
                setSelectedAnnotationId(null);
              }}
            />
          </Tooltip>
          <Tooltip title="保存标注 (Ctrl+S)">
            <Button
              type="text"
              icon={<SaveOutlined />}
              disabled={!annotationsDirty}
              onClick={() => void saveAnnotations(true)}
            />
          </Tooltip>
        </div>

        {/* 样式面板 */}
        <div
          style={{
            width: 220,
            background: '#fff',
            borderRight: '1px solid var(--vrs-border)',
            overflowY: 'auto',
          }}
        >
          <StylePanel tool={tool} style={activeStyle} onChange={setActiveStyle} />
        </div>

        {/* 中央区域 */}
        <div className="vrs-grow" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="vrs-grow" style={{ position: 'relative' }}>
            {editingScreenshot ? (
              <>
                <AnnotationEditor
                  imageUrl={assetUrl(selectedRecord!.sourceImagePath!)}
                  naturalWidth={meta?.width || 1920}
                  naturalHeight={meta?.height || 1080}
                  annotations={history.annotations}
                  tool={tool}
                  activeStyle={activeStyle}
                  selectedId={selectedAnnotationId}
                  onSelect={setSelectedAnnotationId}
                  onChange={handleChange}
                  onCommit={handleCommit}
                  onHistoryCommit={handleHistoryCommit}
                />
                <Button
                  size="small"
                  style={{ position: 'absolute', top: 10, right: 10, zIndex: 30 }}
                  onClick={() => void deselectRecord()}
                >
                  完成标注 · 返回视频 (Esc)
                </Button>
              </>
            ) : videoUrl ? (
              <div className="vrs-stage-wrap" style={{ background: '#000' }}>
                <video
                  ref={(el) => {
                    videoElementRef.current = el;
                    attachVideoElement(el);
                  }}
                  src={videoUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onTimeUpdate={(e) =>
                    video.setCurrentTimeMs(Math.round(e.currentTarget.currentTime * 1000))
                  }
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    video.setDurationMs(Math.round((el.duration || 0) * 1000));
                    video.setReady(true);
                  }}
                  onPlay={() => video.setPlaying(true)}
                  onPause={() => video.setPlaying(false)}
                  onRateChange={(e) => video.setRate(e.currentTarget.playbackRate)}
                  onVolumeChange={(e) => {
                    video.setVolume(e.currentTarget.volume);
                    video.setMuted(e.currentTarget.muted);
                  }}
                  onEnded={() => video.setPlaying(false)}
                />
              </div>
            ) : (
              <div className="vrs-flex-center" style={{ height: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="视频不可用"
                  description="请重新定位原视频，或先生成兼容代理视频。"
                  action={<Button onClick={handleRelocate}>重新定位</Button>}
                />
              </div>
            )}

            {/* 播放控制条 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 44,
                background: 'rgba(0,0,0,0.72)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px',
                color: '#fff',
                zIndex: 20,
              }}
            >
              <Button
                type="text"
                size="small"
                icon={video.playing ? <PauseOutlined /> : <PlayCircleOutlined />}
                onClick={() => videoActions.togglePlay()}
                style={{ color: '#fff' }}
              />
              <Button
                type="text"
                size="small"
                icon={<StepBackwardOutlined />}
                onClick={() => videoActions.skip(-5)}
                style={{ color: '#fff' }}
              />
              <Button
                type="text"
                size="small"
                icon={<StepForwardOutlined />}
                onClick={() => videoActions.skip(5)}
                style={{ color: '#fff' }}
              />
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {formatTimeMs(video.currentTimeMs, true)} / {formatTimeMs(video.durationMs, true)}
              </span>
              <Select
                size="small"
                value={video.rate}
                style={{ width: 72 }}
                onChange={(rate) => {
                  video.setRate(rate);
                  const el = videoElementRef.current;
                  if (el) el.playbackRate = rate;
                }}
                options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => ({
                  label: `${v}x`,
                  value: v,
                }))}
              />
              <Button
                type="text"
                size="small"
                icon={<SoundOutlined />}
                onClick={() => {
                  const el = videoElementRef.current;
                  if (el) {
                    el.muted = !el.muted;
                    video.setMuted(el.muted);
                  }
                }}
                style={{ color: '#fff' }}
              />
              <div style={{ flex: 1 }} />
              <span className="vrs-tiny" style={{ opacity: 0.8 }}>
                {videoKind === 'proxy' ? '代理播放' : '原片播放'}
              </span>
              <Button
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
                onClick={() => {
                  const el = videoElementRef.current;
                  void el?.requestFullscreen?.();
                }}
                style={{ color: '#fff' }}
              />
            </div>
          </div>

          <Timeline
            durationMs={video.durationMs || meta?.durationMs || 0}
            currentTimeMs={video.currentTimeMs}
            records={records}
            onSeek={(ms) => videoActions.seek(ms)}
          />
        </div>

        {/* 右侧记录栏 */}
        <div
          style={{
            width: 300,
            background: '#fff',
            borderLeft: '1px solid var(--vrs-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--vrs-border)',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <Select
              size="small"
              value={project.sortMode}
              style={{ flex: 1 }}
              options={sortOptions}
              onChange={(sortMode) => {
                projectService
                  .updateProjectSettings(
                    project.id,
                    sortMode,
                    project.sortDirection,
                    project.description,
                  )
                  .then((p) => {
                    setProject(p);
                    return recordService.listRecords(p.id, p.sortMode, p.sortDirection);
                  })
                  .then(setRecords)
                  .catch((err) => antMessage.error(describeError(err)));
              }}
            />
            <Button
              size="small"
              icon={project.sortDirection === 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              onClick={() => {
                const direction = project.sortDirection === 'asc' ? 'desc' : 'asc';
                projectService
                  .updateProjectSettings(
                    project.id,
                    project.sortMode,
                    direction,
                    project.description,
                  )
                  .then((p) => {
                    setProject(p);
                    return recordService.listRecords(p.id, p.sortMode, p.sortDirection);
                  })
                  .then(setRecords)
                  .catch((err) => antMessage.error(describeError(err)));
              }}
            />
          </div>
          <div className="vrs-card-list">
            {records.length === 0 && (
              <div className="vrs-muted vrs-tiny" style={{ textAlign: 'center', padding: 24 }}>
                暂无记录，点击“新建记录”创建第一条复盘
              </div>
            )}
            {records.map((record, index) => {
              ensureCardThumbnail(record);
              return (
                <RecordCard
                  key={record.id}
                  record={record}
                  selected={selectedId === record.id}
                  thumbnailUrl={thumbnailUrlFor(record)}
                  onSelect={() => void selectRecord(record)}
                  onPreview={() => setPreviewIndex(index)}
                  onEdit={() => setRecordForm({ open: true, mode: 'edit', record })}
                  onCopy={() => void handleCopyRecord(record)}
                  onDelete={() => void handleDeleteRecord(record)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div
        style={{
          height: 26,
          background: '#fff',
          borderTop: '1px solid var(--vrs-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 16,
          fontSize: 12,
          color: 'var(--vrs-muted)',
        }}
      >
        <span>
          {meta
            ? `${meta.width ?? '?'}×${meta.height ?? '?'} · ${meta.frameRate ? meta.frameRate.toFixed(2) + ' fps' : '帧率未知'}`
            : '无视频元数据'}
        </span>
        <span>记录 {records.length} 条</span>
        <span>当前 {formatTimeMs(video.currentTimeMs)}</span>
        <div style={{ flex: 1 }} />
        <span>
          {proxyState === 'generating'
            ? `代理生成中 ${Math.round(proxyPercent)}%`
            : videoKind === 'proxy'
              ? '代理就绪'
              : ''}
        </span>
        <span>{portablePercent != null ? `便携转换 ${Math.round(portablePercent)}%` : ''}</span>
        <span>
          自动保存：
          {saveState === 'saved' ? '已启用' : saveState === 'saving' ? '正在写入' : '异常'}
        </span>
      </div>

      <RecordFormModal
        open={recordForm.open}
        mode={recordForm.mode}
        record={recordForm.record}
        defaultTimeMs={video.currentTimeMs}
        durationMs={video.durationMs || meta?.durationMs || 0}
        videoAvailable={project.videoExists}
        submitting={submitting}
        onCancel={() => setRecordForm({ ...recordForm, open: false })}
        onSubmit={(values) => void handleRecordSubmit(values)}
      />

      <PreviewModal
        open={previewIndex != null}
        projectId={project.id}
        records={records}
        index={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onNavigate={setPreviewIndex}
        onEdit={(record) => setRecordForm({ open: true, mode: 'edit', record })}
      />

      <ExportModal
        open={exportOpen}
        project={project}
        records={records}
        onClose={() => setExportOpen(false)}
      />

      {/* 重新定位确认 */}
      <Modal
        open={relocateInfo != null}
        title="确认重新定位视频"
        okText="强制绑定"
        okButtonProps={{ danger: !relocateInfo?.matches }}
        cancelText="取消"
        onOk={() => void confirmRelocate(true)}
        onCancel={() => {
          setRelocateInfo(null);
          setRelocatePath(null);
        }}
        width={480}
      >
        {relocateInfo?.matches ? (
          <p>新视频与项目元数据完全匹配，可以安全绑定。</p>
        ) : (
          <>
            <p>新视频与项目记录不完全一致：</p>
            <ul>
              {relocateInfo?.differences.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="vrs-muted vrs-tiny">
              强制绑定后，已有截图像素数据不会改变，但新截图将基于新视频。
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
