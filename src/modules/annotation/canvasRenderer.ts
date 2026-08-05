import type { EditableAnnotation } from './types';

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

function applyTextStyle(
  ctx: CanvasRenderingContext2D,
  style: EditableAnnotation['style'],
  scale: number,
) {
  ctx.font = `${style.fontWeight} ${Math.round(style.fontSize * scale)}px ${style.fontFamily}`;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: EditableAnnotation[],
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
) {
  const sorted = [...annotations].sort((a, b) => a.zIndex - b.zIndex);
  for (const annotation of sorted) {
    const g = annotation.geometry;
    const s = annotation.style;
    ctx.save();
    ctx.strokeStyle = s.strokeColor;
    ctx.fillStyle = s.fillColor;
    ctx.lineWidth = Math.max(0.5, s.strokeWidth * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (annotation.type) {
      case 'pen': {
        const points = (g.points ?? []).map((p) => ({
          x: p.x * naturalWidth * scale,
          y: p.y * naturalHeight * scale,
        }));
        if (points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'line':
      case 'arrow': {
        const x1 = (g.x ?? 0) * naturalWidth * scale;
        const y1 = (g.y ?? 0) * naturalHeight * scale;
        const x2 = ((g.x ?? 0) + (g.width ?? 0)) * naturalWidth * scale;
        const y2 = ((g.y ?? 0) + (g.height ?? 0)) * naturalHeight * scale;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (annotation.type === 'arrow') {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const head = Math.max(14, s.strokeWidth * scale * 2.2);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - head * Math.cos(angle - Math.PI / 6),
            y2 - head * Math.sin(angle - Math.PI / 6),
          );
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - head * Math.cos(angle + Math.PI / 6),
            y2 - head * Math.sin(angle + Math.PI / 6),
          );
          ctx.stroke();
        }
        break;
      }
      case 'rect': {
        const x = (g.x ?? 0) * naturalWidth * scale;
        const y = (g.y ?? 0) * naturalHeight * scale;
        const w = (g.width ?? 0) * naturalWidth * scale;
        const h = (g.height ?? 0) * naturalHeight * scale;
        if (s.fillOpacity > 0) {
          ctx.globalAlpha = s.fillOpacity;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'ellipse': {
        const cx = ((g.x ?? 0) + (g.width ?? 0) / 2) * naturalWidth * scale;
        const cy = ((g.y ?? 0) + (g.height ?? 0) / 2) * naturalHeight * scale;
        const rx = Math.abs((g.width ?? 0) * naturalWidth * scale) / 2;
        const ry = Math.abs((g.height ?? 0) * naturalHeight * scale) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (s.fillOpacity > 0) {
          ctx.globalAlpha = s.fillOpacity;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
        break;
      }
      case 'text': {
        const text = annotation.content || '';
        const x = (g.x ?? 0) * naturalWidth * scale;
        const y = (g.y ?? 0) * naturalHeight * scale;
        const fontSize = Math.max(4, s.fontSize * scale);
        const lineHeight = fontSize * s.lineHeight;
        const lines = text.split('\n');
        applyTextStyle(ctx, s, scale);
        const maxWidth = Math.max(60 * scale, ...lines.map((line) => ctx.measureText(line).width));
        const width = (g.width ?? maxWidth / naturalWidth) * naturalWidth * scale;
        const drawWidth = Math.max(width, maxWidth);
        const height = lines.length * lineHeight;
        if (s.backgroundOpacity > 0) {
          ctx.globalAlpha = s.backgroundOpacity;
          ctx.fillStyle = s.background;
          ctx.fillRect(x - 8 * scale, y - 4 * scale, drawWidth + 16 * scale, height + 10 * scale);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = s.textColor;
        ctx.strokeStyle = s.textStrokeColor;
        ctx.lineWidth = Math.max(0.5, s.textStrokeWidth * scale);
        const align = s.align;
        let cursorX = x;
        if (align === 'center') cursorX = x + drawWidth / 2;
        if (align === 'right') cursorX = x + drawWidth;
        for (let i = 0; i < lines.length; i += 1) {
          const lineY = y + i * lineHeight;
          if (s.textStrokeWidth > 0) {
            ctx.strokeText(lines[i], cursorX, lineY, drawWidth);
          }
          ctx.fillText(lines[i], cursorX, lineY, drawWidth);
        }
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }
}

export async function renderCompositedCanvas(
  imageUrl: string,
  naturalWidth: number,
  naturalHeight: number,
  annotations: EditableAnnotation[],
  maxDimension: number | null,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageUrl);
  const scale =
    maxDimension == null ? 1 : Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.drawImage(img, 0, 0, width, height);
  drawAnnotations(ctx, annotations, scale, naturalWidth, naturalHeight);
  return canvas;
}

export async function canvasToPngBase64(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/png');
  });
  return blobToBase64(blob);
}

export async function canvasToWebpBase64(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('缩略图生成失败'))),
      'image/webp',
      0.82,
    );
  });
  return blobToBase64(blob);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片数据失败'));
    reader.readAsDataURL(blob);
  });
}
