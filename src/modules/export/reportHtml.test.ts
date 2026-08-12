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
    layout: 'comparison',
    includeNotes: true,
  });

  it('uses relative image paths under ./images/', () => {
    expect(html).toContain('src="./images/image_001_标注.png"');
    expect(html).toContain('src="./images/image_001_原图.png"');
    expect(html).not.toContain('D:\\\\');
    expect(html).not.toContain('file://');
    expect(html).not.toContain('http://');
    expect(html).toContain("document.documentElement.dataset.imagesReady = 'true'");
  });

  it('includes record metadata and escapes html', () => {
    expect(html).toContain('团战站位');
    expect(html).toContain('<span>团战</span>');
    expect(html).toContain('重要程度：高');
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

  it('uses fixed A4 pages with cover, summary, page numbers and bounded images', () => {
    expect(html).toContain('@page { size: A4 portrait;');
    expect(html).toContain('VIDEO REVIEW REPORT');
    expect(html).toContain('概览与目录');
    expect(html).toContain('第 3 页 / 共 3 页');
    expect(html).toContain('max-height: 100%');
  });

  it('includes text-only records without requiring an image', () => {
    const textOnly = buildReportHtml({
      projectName: '文字项目',
      videoName: 'video.mp4',
      durationMs: 10000,
      width: 1280,
      height: 720,
      exportTime: '2026-08-12',
      items: [{ record: { ...record, hasScreenshot: false, sourceImagePath: null }, annotated: null, source: null }],
      layout: 'annotated',
      includeNotes: true,
    });
    expect(textOnly).toContain('该条记录未保存代表截图');
    expect(textOnly).toContain('站位过于靠前');
  });

  it('paginates a long table of contents and offsets record page numbers', () => {
    const manyRecords = buildReportHtml({
      projectName: '长报告',
      videoName: 'video.mp4',
      durationMs: 10000,
      width: 1280,
      height: 720,
      exportTime: '2026-08-12',
      items: Array.from({ length: 15 }, (_, index) => ({
        record: { ...record, id: `r${index}`, title: `记录 ${index + 1}` },
        annotated: './images/a.png',
        source: null,
      })),
      layout: 'annotated',
      includeNotes: true,
    });
    expect(manyRecords).toContain('目录（续）');
    expect(manyRecords).toContain('第 4 页 / 共 18 页');
    expect(manyRecords).toContain('<span class="toc-page">4</span>');
  });
});
