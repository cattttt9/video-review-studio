import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';

type DragDropEvent = {
  payload: {
    type: 'drop';
    paths: string[];
  };
};

const webviewMock = vi.hoisted(() => ({
  handler: undefined as ((event: DragDropEvent) => void) | undefined,
}));

const projectMock = vi.hoisted(() => ({
  listRecentProjects: vi.fn(),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: (event: DragDropEvent) => void) => {
      webviewMock.handler = handler;
      return () => undefined;
    },
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

vi.mock('../services/project', () => ({
  projectService: {
    listRecentProjects: projectMock.listRecentProjects,
    openProject: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

describe('HomePage video drop', () => {
  beforeAll(() => {
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      getComputedStyle(element),
    );
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    webviewMock.handler = undefined;
    projectMock.listRecentProjects.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the dropped absolute path in the create-project dialog', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(webviewMock.handler).toBeTypeOf('function'));

    const videoPath = String.raw`D:\Videos\王者荣耀复盘.mp4`;
    act(() => {
      webviewMock.handler?.({ payload: { type: 'drop', paths: [videoPath] } });
    });

    expect(await screen.findByLabelText('视频文件路径')).toHaveValue(videoPath);
  });
});
