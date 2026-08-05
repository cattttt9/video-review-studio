import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimeMs, parseTimeToMs } from './time';

describe('formatTimeMs', () => {
  it('formats hours/minutes/seconds', () => {
    expect(formatTimeMs(0)).toBe('00:00:00');
    expect(formatTimeMs(61_500)).toBe('00:01:01');
    expect(formatTimeMs(3_661_000)).toBe('01:01:01');
  });

  it('formats with milliseconds', () => {
    expect(formatTimeMs(1_234, true)).toBe('00:00:01.234');
    expect(formatTimeMs(-100)).toBe('00:00:00');
  });
});

describe('parseTimeToMs', () => {
  it('parses full and short formats', () => {
    expect(parseTimeToMs('00:01:01.500')).toBe(61_500);
    expect(parseTimeToMs('1:02:03')).toBe(3_723_000);
    expect(parseTimeToMs('02:03')).toBe(123_000);
    expect(parseTimeToMs('01:02:03,250')).toBe(3_723_250);
  });

  it('rejects invalid input', () => {
    expect(parseTimeToMs('abc')).toBeNull();
    expect(parseTimeToMs('00:99:00')).toBeNull();
    expect(parseTimeToMs('')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('omits hours when zero', () => {
    expect(formatDuration(90_000)).toBe('1:30');
    expect(formatDuration(3_600_000)).toBe('1:00:00');
  });
});
