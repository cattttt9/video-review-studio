export interface CreateActionCopy {
  okText: string;
  hint: string;
}

export function getCreateActionCopy(hasScreenshot: boolean): CreateActionCopy {
  return hasScreenshot
    ? {
        okText: '创建并标注',
        hint: '创建后将直接进入截图标注界面',
      }
    : {
        okText: '创建',
        hint: '关闭后将创建一条不含截图的文字记录',
      };
}
