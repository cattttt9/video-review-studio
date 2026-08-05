import { call } from './invoke';
import type { ProjectDto, RecentProjectEntry } from '../types';

export const projectService = {
  createProject(name: string, sourceVideoPath?: string | null, parentDir?: string | null) {
    return call<ProjectDto>('create_project', {
      name,
      sourceVideoPath,
      parentDir,
    });
  },
  openProject(projectDir: string) {
    return call<ProjectDto>('open_project', { projectDir });
  },
  listRecentProjects() {
    return call<RecentProjectEntry[]>('list_recent_projects');
  },
  deleteProject(projectDir: string) {
    return call<void>('delete_project', { projectDir });
  },
  renameProject(projectId: string, newName: string) {
    return call<ProjectDto>('rename_project', { projectId, newName });
  },
  updateProjectSettings(
    projectId: string,
    sortMode: string,
    sortDirection: string,
    description: string | null,
  ) {
    return call<ProjectDto>('update_project_settings', {
      projectId,
      sortMode,
      sortDirection,
      description,
    });
  },
  closeProject(projectId: string) {
    return call<void>('close_project', { projectId });
  },
  refreshProject(projectId: string) {
    return call<ProjectDto>('refresh_project_dto', { projectId });
  },
};
