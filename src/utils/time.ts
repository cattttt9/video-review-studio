export function formatTimeMs(ms: number, withMillis = false): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = safe % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const base = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return withMillis ? `${base}.${pad(millis, 3)}` : base;
}

export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.round(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function parseTimeToMs(input: string): number | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const millis = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
  if (minutes > 59 || seconds > 59) return null;
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + millis;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 'B';
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}
