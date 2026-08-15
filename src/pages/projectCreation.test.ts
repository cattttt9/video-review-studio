import { describe, expect, it, vi } from 'vitest';
import { prepareCreateProjectForm } from './projectCreation';

describe('prepareCreateProjectForm', () => {
  it('stores a dropped video absolute path in the submitted form field', () => {
    const resetFields = vi.fn();
    const setFieldValue = vi.fn();
    const videoPath = String.raw`D:\Videos\复盘素材.mp4`;

    prepareCreateProjectForm({ resetFields, setFieldValue }, videoPath);

    expect(resetFields).toHaveBeenCalledOnce();
    expect(setFieldValue).toHaveBeenCalledWith('videoPath', videoPath);
  });

  it('opens a normal create flow with a clean unbound form', () => {
    const resetFields = vi.fn();
    const setFieldValue = vi.fn();

    prepareCreateProjectForm({ resetFields, setFieldValue });

    expect(resetFields).toHaveBeenCalledOnce();
    expect(setFieldValue).not.toHaveBeenCalled();
  });
});
