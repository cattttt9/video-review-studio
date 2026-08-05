import { ColorPicker, InputNumber, Radio, Select, Space } from 'antd';
import type { AnnotationStyle, ToolType } from './types';
import { TEXT_PRESETS } from './types';

export interface StylePanelProps {
  tool: ToolType;
  style: AnnotationStyle;
  onChange: (style: AnnotationStyle) => void;
}

const presetNames = Object.keys(TEXT_PRESETS);

export default function StylePanel({ tool, style, onChange }: StylePanelProps) {
  const update = (patch: Partial<AnnotationStyle>) => onChange({ ...style, ...patch });

  const shapeTools: ToolType[] = ['line', 'arrow', 'rect', 'ellipse', 'pen'];
  const showStroke = shapeTools.includes(tool);
  const showFill = tool === 'rect' || tool === 'ellipse';
  const showText = tool === 'text' || tool === 'select';

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
              onChange={(v) => update({ fillOpacity: v ?? 0.15 })}
              addonAfter="α"
            />
          </Space>
        </>
      )}
      {showText && (
        <>
          <div className="vrs-tiny vrs-muted">文本预设</div>
          <Select
            size="small"
            placeholder="应用预设"
            style={{ width: '100%' }}
            value={null}
            onChange={(name: string) => onChange(TEXT_PRESETS[name])}
            options={presetNames.map((name) => ({ label: name, value: name }))}
          />
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
              onChange={(e) => update({ fontWeight: e.target.value === 'bold' ? 700 : 400 })}
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
    </div>
  );
}
