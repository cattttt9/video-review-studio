import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from './filename';

describe('sanitizeFileName', () => {
  it('replaces invalid characters', () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFileName(' 标题. ')).toBe('标题');
  });

  it('falls back for empty names', () => {
    expect(sanitizeFileName('   ')).toBe('untitled');
    expect(sanitizeFileName('')).toBe('untitled');
  });
});
