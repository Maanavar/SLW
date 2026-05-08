import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLocalDateString,
  getReportRange,
  getTenDayRange,
  getWeekStartDate,
} from './dateUtils';

describe('dateUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats local date as YYYY-MM-DD', () => {
    expect(getLocalDateString(new Date('2026-05-09T09:00:00'))).toBe('2026-05-09');
  });

  it('resolves week start as Monday, including Sunday edge case', () => {
    expect(getWeekStartDate(new Date('2026-05-04T10:00:00'))).toBe('2026-05-04');
    expect(getWeekStartDate(new Date('2026-05-03T10:00:00'))).toBe('2026-04-27');
  });

  it('calculates ten-day ranges with clamping and cross-month offsets', () => {
    const base = new Date('2026-05-25T12:00:00');
    expect(getTenDayRange(base, 0, true)).toEqual({ from: '2026-05-21', to: '2026-05-25' });
    expect(getTenDayRange(base, -1, true)).toEqual({ from: '2026-05-11', to: '2026-05-20' });
    expect(getTenDayRange(base, 1, true)).toEqual({ from: '2026-06-01', to: '2026-06-10' });

    const janBase = new Date('2026-01-05T12:00:00');
    expect(getTenDayRange(janBase, -1, true)).toEqual({ from: '2025-12-21', to: '2025-12-31' });
  });

  it('returns current month range for unknown report period', () => {
    vi.setSystemTime(new Date('2026-05-25T10:00:00'));
    expect(getReportRange('unknown-period')).toEqual({ from: '2026-05-01', to: '2026-05-25' });
  });
});
