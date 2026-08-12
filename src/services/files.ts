import { call } from './invoke';

export const fileService = {
  writeProjectFile(
    projectId: string,
    relPath: string,
    dataBase64: string,
    exportDir?: string,
  ) {
    return call<string>('write_project_file', {
      projectId,
      relPath,
      dataBase64,
      exportDir: exportDir ?? null,
    });
  },
  writeProjectText(
    projectId: string,
    relPath: string,
    content: string,
    exportDir?: string,
  ) {
    return call<string>('write_project_text', {
      projectId,
      relPath,
      content,
      exportDir: exportDir ?? null,
    });
  },
  pathExists(path: string) {
    return call<boolean>('path_exists', { path });
  },
  revealInFolder(path: string) {
    return call<void>('reveal_in_folder', { path });
  },
  openPath(path: string) {
    return call<void>('open_path', { path });
  },
  createPdfFromHtml(htmlPath: string, pdfPath: string) {
    return call<string>('create_pdf_from_html', { htmlPath, pdfPath });
  },
};
