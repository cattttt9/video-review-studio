import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Checkbox, Form, Input, Modal, Radio, Select, Switch } from 'antd';
import type { ReviewRecordDto, TimeMode } from '../../types';
import { formatTimeMs, parseTimeToMs } from '../../utils/time';
import { getCreateActionCopy } from './recordFormCopy';

export interface RecordFormValues {
  title: string;
  category: string;
  importance: string;
  description: string;
  timeMode: TimeMode;
  startTime: string;
  endTime: string;
  representativeTime: string;
  hasScreenshot: boolean;
  recapture: boolean;
  keepAnnotations: boolean;
}

export interface RecordFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  record: ReviewRecordDto | null;
  defaultTimeMs: number;
  durationMs: number;
  videoAvailable: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: RecordFormValues) => void;
}

interface ModalOffset {
  x: number;
  y: number;
}

interface ModalDragSession {
  pointerId: number;
  startX: number;
  startY: number;
  origin: ModalOffset;
  minDeltaX: number;
  maxDeltaX: number;
  minDeltaY: number;
  maxDeltaY: number;
}

const MODAL_VIEWPORT_MARGIN = 16;

export default function RecordFormModal({
  open,
  mode,
  record,
  defaultTimeMs,
  durationMs,
  videoAvailable,
  submitting,
  onCancel,
  onSubmit,
}: RecordFormModalProps) {
  const [form] = Form.useForm<RecordFormValues>();
  const [timeMode, setTimeMode] = useState<TimeMode>('point');
  const [modalOffset, setModalOffset] = useState<ModalOffset>({ x: 0, y: 0 });
  const modalSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<ModalDragSession | null>(null);
  const watchHasScreenshot = Form.useWatch('hasScreenshot', form);
  const createActionCopy = getCreateActionCopy(!!watchHasScreenshot);

  const initialValues = useMemo<RecordFormValues>(() => {
    if (mode === 'edit' && record) {
      return {
        title: record.title ?? '',
        category: record.category ?? '',
        importance: record.importance ?? '中',
        description: record.description ?? '',
        timeMode: record.timeMode,
        startTime: formatTimeMs(record.startTimeMs, true),
        endTime: formatTimeMs(record.endTimeMs, true),
        representativeTime: formatTimeMs(record.representativeTimeMs, true),
        hasScreenshot: record.hasScreenshot,
        recapture: false,
        keepAnnotations: true,
      };
    }
    return {
      title: '',
      category: '',
      importance: '中',
      description: '',
      timeMode: 'point',
      startTime: formatTimeMs(defaultTimeMs, true),
      endTime: formatTimeMs(defaultTimeMs, true),
      representativeTime: formatTimeMs(defaultTimeMs, true),
      hasScreenshot: videoAvailable,
      recapture: false,
      keepAnnotations: true,
    };
  }, [mode, record, defaultTimeMs, videoAvailable]);

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues);
      setTimeMode(initialValues.timeMode);
      setModalOffset({ x: 0, y: 0 });
      dragSessionRef.current = null;
    }
  }, [open, initialValues, form]);

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = modalSurfaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: modalOffset,
      minDeltaX: MODAL_VIEWPORT_MARGIN - rect.left,
      maxDeltaX: window.innerWidth - MODAL_VIEWPORT_MARGIN - rect.right,
      minDeltaY: MODAL_VIEWPORT_MARGIN - rect.top,
      maxDeltaY: window.innerHeight - MODAL_VIEWPORT_MARGIN - rect.bottom,
    };
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const deltaX = Math.min(
      session.maxDeltaX,
      Math.max(session.minDeltaX, event.clientX - session.startX),
    );
    const deltaY = Math.min(
      session.maxDeltaY,
      Math.max(session.minDeltaY, event.clientY - session.startY),
    );
    setModalOffset({ x: session.origin.x + deltaX, y: session.origin.y + deltaY });
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    dragSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const syncPointTime = (key: 'startTime' | 'endTime' | 'representativeTime', value: string) => {
    if (timeMode !== 'point') return;
    form.setFieldsValue({
      [key]: value,
      startTime: value,
      endTime: value,
      representativeTime: value,
    });
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    const start = parseTimeToMs(values.startTime);
    const end = parseTimeToMs(values.endTime);
    const representative = parseTimeToMs(values.representativeTime);
    if (start == null || end == null || representative == null) {
      form.setFields([
        { name: 'startTime', errors: start == null ? ['时间格式应为 HH:MM:SS.mmm'] : [] },
        { name: 'endTime', errors: end == null ? ['时间格式应为 HH:MM:SS.mmm'] : [] },
        {
          name: 'representativeTime',
          errors: representative == null ? ['时间格式应为 HH:MM:SS.mmm'] : [],
        },
      ]);
      return;
    }
    if (values.timeMode === 'interval' && !(start <= representative && representative <= end)) {
      form.setFields([{ name: 'representativeTime', errors: ['代表时间必须在区间内'] }]);
      return;
    }
    if (start > durationMs || end > durationMs || representative > durationMs) {
      form.setFields([{ name: 'representativeTime', errors: ['时间超出视频时长'] }]);
      return;
    }
    onSubmit({
      ...values,
      startTime: formatTimeMs(start, true),
      endTime: formatTimeMs(end, true),
      representativeTime: formatTimeMs(representative, true),
    });
  };

  const canScreenshot = videoAvailable;

  return (
    <Modal
      open={open}
      title={
        <div
          className="vrs-record-modal-drag-handle"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          title="按住标题栏拖动"
        >
          <span>{mode === 'create' ? '新建复盘记录' : '编辑复盘记录'}</span>
          <span className="vrs-record-modal-drag-hint">可拖动 · 移开弹窗查看视频</span>
        </div>
      }
      okText={mode === 'create' ? createActionCopy.okText : '保存'}
      cancelText="取消"
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
      modalRender={(modal) => (
        <div
          ref={modalSurfaceRef}
          className="vrs-record-modal-drag-surface"
          style={{ transform: `translate3d(${modalOffset.x}px, ${modalOffset.y}px, 0)` }}
        >
          {modal}
        </div>
      )}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onValuesChange={(changed) => {
          if (changed.timeMode) setTimeMode(changed.timeMode);
        }}
      >
        <Form.Item name="title" label="标题" rules={[{ max: 100 }]}>
          <Input placeholder="（可选）" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="category" label="分类" style={{ flex: 1 }}>
            <Input placeholder="（可选）" />
          </Form.Item>
          <Form.Item name="importance" label="重要程度" style={{ width: 140 }}>
            <Select
              options={[
                { label: '高', value: '高' },
                { label: '中', value: '中' },
                { label: '低', value: '低' },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={2} placeholder="（可选）" />
        </Form.Item>
        <Form.Item name="timeMode" label="记录类型">
          <Radio.Group
            options={[
              { label: '时间点', value: 'point' },
              { label: '时间区间', value: 'interval' },
            ]}
            optionType="button"
            buttonStyle="solid"
          />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="startTime" label="开始时间" style={{ flex: 1 }}>
            <Input
              placeholder="HH:MM:SS.mmm"
              onChange={(e) => syncPointTime('startTime', e.target.value)}
            />
          </Form.Item>
          <Form.Item name="endTime" label="结束时间" style={{ flex: 1 }}>
            <Input
              placeholder="HH:MM:SS.mmm"
              disabled={timeMode === 'point'}
              onChange={(e) => syncPointTime('endTime', e.target.value)}
            />
          </Form.Item>
          <Form.Item name="representativeTime" label="代表时间" style={{ flex: 1 }}>
            <Input
              placeholder="HH:MM:SS.mmm"
              onChange={(e) => syncPointTime('representativeTime', e.target.value)}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="hasScreenshot"
          valuePropName="checked"
          extra={
            !canScreenshot
              ? '视频不可用，无法截图'
              : createActionCopy.hint
          }
        >
          <Checkbox disabled={!canScreenshot} checked={watchHasScreenshot}>
            保存代表截图
          </Checkbox>
        </Form.Item>
        {mode === 'edit' && (
          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="recapture" valuePropName="checked" label="操作">
              <Checkbox disabled={!canScreenshot}>重新截取代表截图</Checkbox>
            </Form.Item>
            <Form.Item name="keepAnnotations" valuePropName="checked" label="标注">
              <Switch checkedChildren="保留" unCheckedChildren="清空" defaultChecked />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
}
