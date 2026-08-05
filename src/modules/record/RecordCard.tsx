import { CopyOutlined, DeleteOutlined, EditOutlined, ZoomInOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Tooltip } from 'antd';
import type { ReviewRecordDto } from '../../types';
import { formatTimeMs } from '../../utils/time';

export interface RecordCardProps {
  record: ReviewRecordDto;
  selected: boolean;
  thumbnailUrl: string | null;
  onSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export default function RecordCard({
  record,
  selected,
  thumbnailUrl,
  onSelect,
  onPreview,
  onEdit,
  onCopy,
  onDelete,
}: RecordCardProps) {
  const timeLabel =
    record.timeMode === 'interval'
      ? `${formatTimeMs(record.startTimeMs)} – ${formatTimeMs(record.endTimeMs)}`
      : formatTimeMs(record.representativeTimeMs);
  const metaParts = [
    record.category || null,
    record.importance || null,
    record.description || null,
  ].filter(Boolean);

  return (
    <div className={`vrs-record-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="thumb-wrap">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={record.title ?? '记录'}
            draggable={false}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          />
        ) : (
          <span className="vrs-muted">无截图</span>
        )}
        <div
          className="card-actions"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="放大预览">
            <Button size="small" icon={<ZoomInOutlined />} onClick={onPreview} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
          </Tooltip>
          <Tooltip title="复制">
            <Button size="small" icon={<CopyOutlined />} onClick={onCopy} />
          </Tooltip>
          <Popconfirm
            title="删除这条记录？"
            description="将同时删除截图与缩略图缓存，不可恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={onDelete}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      </div>
      <div className="card-body">
        <div className="card-time">{timeLabel}</div>
        <div className="card-title" title={record.title ?? ''}>
          {record.title || '未命名记录'}
        </div>
        {metaParts.length > 0 && (
          <div className="card-meta" title={metaParts.join(' · ')}>
            {metaParts.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
