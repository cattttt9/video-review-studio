import { recordService } from '../../services/records';
import type { EditableAnnotation } from '../annotation/types';
import {
  canvasToWebpBase64,
  loadImage,
  renderCompositedCanvas,
} from '../annotation/canvasRenderer';
import { assetUrl } from '../../utils/paths';
import type { ReviewRecordDto } from '../../types';

export async function generateThumbnail(
  projectId: string,
  record: ReviewRecordDto,
  annotations: EditableAnnotation[],
): Promise<string | null> {
  if (!record.hasScreenshot || !record.sourceImagePath) return null;
  try {
    const imageUrl = assetUrl(record.sourceImagePath);
    const img = await loadImage(imageUrl);
    const canvas = await renderCompositedCanvas(
      imageUrl,
      img.naturalWidth || 1920,
      img.naturalHeight || 1080,
      annotations,
      320,
    );
    const base64 = await canvasToWebpBase64(canvas);
    const version = record.thumbnailVersion + 1;
    return recordService.saveThumbnail(projectId, record.id, version, base64);
  } catch {
    return null;
  }
}
