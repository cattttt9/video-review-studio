import { create } from 'zustand';
import type { ProjectDto } from '../types';

interface ProjectStore {
  project: ProjectDto | null;
  setProject: (project: ProjectDto | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
}));
