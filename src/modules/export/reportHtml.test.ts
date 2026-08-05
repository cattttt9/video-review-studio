import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './reportHtml';
import type { ReviewRecordDto } from '../../types';

const record: ReviewRecordDto = {
  id: 'r1',
  projectId: 'p1',
  title: '团战站位',
  description: '站位过于靠前',
  category: '团战',
  importance: '高',
  timeMode: 'point',
  startTimeMs: 2000,
  endTimeMs: 2000,
  representativeTimeMs: 2000,
  hasScreenshot: true,
  sourceImagePath: 'D:\\proj\\screenshots\\record-r1-source.png',
  thumbnailPath: null,
  thumbnailVersion: 1,
  createdAt: '2026-08-05T00:00:00+08:00',
  updatedAt: '2026-08-05T00:00:00+08:00',
};

describe('buildReportHtml', () => {
  const html = buildReportHtml({
    projectName: '示例项目',
    videoName: 'landscape.mp4',
    durationMs: 10000,
    width: 1280,
    height: 720,
    exportTime: '2026-08-05 13:00:00',
    items: [
      { record, annotated: './images/image_001_标注.png', source: './images/image_001_原图.png' },
    ],
    layout: 'side',
    includeNotes: true,
  });

  it('uses relative image paths under ./images/', () => {
    expect(html).toContain('src="./images/image_001_标注.png"');
    expect(html).toContain('src="./images/image_001_原图.png"');
    expect(html).not.toContain('D:\\\\');
    expect(html).not.toContain('file://');
    expect(html).not.toContain('http://');
  });

  it('includes record metadata and escapes html', () => {
    expect(html).toContain('团战站位');
    expect(html).toContain('分类：团战');
    const escaped = buildReportHtml({
      projectName: '示例项目',
      videoName: 'landscape.mp4',
      durationMs: 10000,
      width: 1280,
      height: 720,
      exportTime: '2026-08-05',
      items: [
        {
          record: { ...record, title: '<script>alert(1)</script>' },
          annotated: './images/a.png',
          source: null,
        },
      ],
      layout: 'annotated',
      includeNotes: false,
    });
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).not.toContain('<script>alert(1)</script>');
  });
});

