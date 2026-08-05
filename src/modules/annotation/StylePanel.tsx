import { useState } from 'react';
import {
  App as AntApp,
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import type { AnnotationStyle, ToolType } from './types';
import { useTextPresetStore } from '../../stores/textPresetStore';

export interface StylePanelProps {
  tool: ToolType;
  style: AnnotationStyle;
  onChange: (style: AnnotationStyle) => void;
}

interface PresetModalState {
  open: boolean;
  mode: 'create' | 'rename';
  name: string;
}

export default function StylePanel({ tool, style, onChange }: StylePanelProps) {
  const { message } = AntApp.useApp();
  const presets = useTextPresetStore((s) => s.presets);
  const addPreset = useTextPresetStore((s) => s.addPreset);
  const renamePreset = useTextPresetStore((s) => s.renamePreset);
  const removePreset = useTextPresetStore((s) => s.removePreset);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [modal, setModal] = useState<PresetModalState>({
    open: false,
    mode: 'create',
    name: '',
  });
  const [presetNameInput, setPresetNameInput] = useState('');

  const update = (patch: Partial<AnnotationStyle>) =>
    onChange({ ...style, ...patch });

  const showStroke = ['line', 'arrow', 'rect', 'ellipse', 'pen'].includes(tool);
  const showFill = tool === 'rect' || tool === 'ellipse';
  const showText = tool === 'text';

  const confirmPreset = () => {
    const name = presetNameInput.trim();
    if (!name) {
      message.warning('请输入预设名称');
      return;
    }
    if (modal.mode === 'create') {
      if (!addPreset(name, style)) {
        message.error('预设名称已存在');
        return;
      }
      message.success(`预设“${name}”已保存`);
      setSelectedPreset(name);
    } else {
      const oldName = modal.name;
      if (!renamePreset(oldName, name)) {
        message.error('预设名称已存在');
        return;
      }
      message.success('预设已重命名');
      setSelectedPreset(name);
    }
    setModal({ open: false, mode: 'create', name: '' });
    setPresetNameInput('');
  };

  return (
    <div
      style={{
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxHeight: '100%',
        overflowY: 'auto',
      }}
    >
      {showStroke && (
        <>
          <div className="vrs-tiny vrs-muted">描边</div>
          <Space size={8} wrap>
            <ColorPicker
              size="small"
              value={style.strokeColor}
              onChange={(_, hex) => update({ strokeColor: hex })}
            />
            <InputNumber
              size="small"
              min={1}
              max={60}
              value={style.strokeWidth}
              onChange={(v) => update({ strokeWidth: v ?? 8 })}
              addonAfter="px"
            />
          </Space>
        </>
      )}
      {showFill && (
        <>
          <div className="vrs-tiny vrs-muted">填充</div>
          <Space size={8} wrap>
            <ColorPicker
              size="small"
              value={style.fillColor}
              onChange={(_, hex) => update({ fillColor: hex })}
            />
            <InputNumber
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={style.fillOpacity}
              onChange={(v) => update({ fillOpacity: v ?? 0 })}
              addonAfter="α"
            />
          </Space>
        </>
      )}
      {showText && (
        <>
          <div className="vrs-tiny vrs-muted">文本预设</div>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              size="small"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="选择预设"
              value={selectedPreset}
              onChange={(name: string) => {
                const preset = presets.find((p) => p.name === name);
                if (preset) {
                  onChange({ ...preset.style });
                  setSelectedPreset(name);
                }
              }}
              options={presets.map((p) => ({ label: p.name, value: p.name }))}
              notFoundContent={presets.length === 0 ? '暂无预设' : undefined}
            />
            <Tooltip title="保存当前参数为预设">
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={() => {
                  setModal({ open: true, mode: 'create', name: '' });
                  setPresetNameInput('');
                }}
              />
            </Tooltip>
            <Tooltip title="重命名选中预设">
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={!selectedPreset}
                onClick={() => {
                  if (!selectedPreset) return;
                  setModal({ open: true, mode: 'rename', name: selectedPreset });
                  setPresetNameInput(selectedPreset);
                }}
              />
            </Tooltip>
            <Popconfirm
              title="删除该预设？"
              okText="删除"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                if (selectedPreset) {
                  removePreset(selectedPreset);
                  setSelectedPreset(null);
                  message.success('预设已删除');
                }
              }}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedPreset}
              />
            </Popconfirm>
          </Space.Compact>
          <Space size={8} wrap>
            <InputNumber
              size="small"
              min={10}
              max={400}
              value={style.fontSize}
              onChange={(v) => update({ fontSize: v ?? 48 })}
              addonAfter="字号"
            />
            <Radio.Group
              size="small"
              value={Number(style.fontWeight) >= 600 ? 'bold' : 'normal'}
              onChange={(e) =>
                update({ fontWeight: e.target.value === 'bold' ? 700 : 400 })
              }
              options={[
                { label: '常规', value: 'normal' },
                { label: '加粗', value: 'bold' },
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </Space>
          <Space size={8} wrap>
            <ColorPicker
              size="small"
              value={style.textColor}
              onChange={(_, hex) => update({ textColor: hex })}
            />
            <span className="vrs-tiny vrs-muted">字色</span>
            <ColorPicker
              size="small"
              value={style.textStrokeColor}
              onChange={(_, hex) => update({ textStrokeColor: hex })}
            />
            <span className="vrs-tiny vrs-muted">描边色</span>
            <InputNumber
              size="small"
              min={0}
              max={40}
              value={style.textStrokeWidth}
              onChange={(v) => update({ textStrokeWidth: v ?? 0 })}
              addonAfter="px"
            />
          </Space>
          <Space size={8} wrap>
            <ColorPicker
              size="small"
              value={style.background}
              onChange={(_, hex) => update({ background: hex })}
            />
            <span className="vrs-tiny vrs-muted">背景</span>
            <InputNumber
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={style.backgroundOpacity}
              onChange={(v) => update({ backgroundOpacity: v ?? 0 })}
              addonAfter="α"
            />
          </Space>
          <Space size={8}>
            <span className="vrs-tiny vrs-muted">对齐</span>
            <Radio.Group
              size="small"
              value={style.align}
              onChange={(e) => update({ align: e.target.value })}
              options={[
                { label: '左', value: 'left' },
                { label: '中', value: 'center' },
                { label: '右', value: 'right' },
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </Space>
        </>
      )}

      <Modal
        open={modal.open}
        title={modal.mode === 'create' ? '保存文本预设' : '重命名预设'}
        okText={modal.mode === 'create' ? '保存' : '重命名'}
        cancelText="取消"
        onOk={confirmPreset}
        onCancel={() => setModal({ ...modal, open: false })}
        width={360}
        destroyOnHidden
      >
        <Input
          placeholder="请输入预设名称"
          value={presetNameInput}
          maxLength={30}
          autoFocus
          onChange={(e) => setPresetNameInput(e.target.value)}
          onPressEnter={confirmPreset}
        />
      </Modal>
    </div>
  );
}

