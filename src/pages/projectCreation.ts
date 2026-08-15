export interface CreateProjectFormBridge {
  resetFields: () => void;
  setFieldValue: (name: string, value: string) => void;
}

/**
 * Start every create flow from a clean form and seed a dropped video's
 * absolute path into the same field that handleCreate later submits.
 */
export function prepareCreateProjectForm(
  form: CreateProjectFormBridge,
  videoPath?: string,
) {
  form.resetFields();
  if (videoPath) form.setFieldValue('videoPath', videoPath);
}
