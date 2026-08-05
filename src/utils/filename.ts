export function sanitizeFileName(name: string): string {
  const cleaned = [...name]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) return '_';
      if (/[<>:"/\\|?*]/.test(ch)) return '_';
      return ch;
    })
    .join('')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned || 'untitled';
}
