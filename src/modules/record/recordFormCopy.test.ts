import { describe, expect, it } from 'vitest';
import { getCreateActionCopy } from './recordFormCopy';

describe('getCreateActionCopy', () => {
  it('describes the direct annotation flow for screenshot records', () => {
    expect(getCreateActionCopy(true)).toEqual({
      okText: '创建并标注',
      hint: '创建后将直接进入截图标注界面',
    });
  });

  it('describes plain creation for records without screenshots', () => {
    expect(getCreateActionCopy(false)).toEqual({
      okText: '创建',
      hint: '关闭后将创建一条不含截图的文字记录',
    });
  });
});
