import { call } from './invoke';

export const fileService = {
  writeProjectFile(projectId: string, relPath: string, dataBase64: string) {
    return call<string>('write_project_file', {
      projectId,
      relPath,
      dataBase64,
    });
  },
  writeProjectText(projectId: string, relPath: string, content: string) {
    return call<string>('write_project_text', {
      projectId,
      relPath,
      content,
    });
  },
  revealInFolder(path: string) {
    return call<void>('reveal_in_folder', { path });
  },
  openPath(path: string) {
    return call<void>('open_path', { path });
  },
};
