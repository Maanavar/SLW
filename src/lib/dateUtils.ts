/**
 * Date Utility Functions
 * Ported from src/js/data.js
 */

import type { PeriodRange } from '@/types';

/**
 * Format date as YYYY-MM-DD string
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date from date string (YYYY-MM-DD format)
 * Handles timezone correctly by using UTC to avoid timezone offset issues
 */
export function getDateStart(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use UTC date to avoid timezone offset issues
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Get the start date of the week (Monday)
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return getLocalDateString(start);
}

/**
 * Get the start date of the month
 */
export function getMonthStartDate(date: Date = new Date()): string {
  return getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Get the start date of the year
 */
export function getYearStartDate(date: Date = new Date()): string {
  return getLocalDateString(new Date(date.getFullYear(), 0, 1));
}

/**
 * Get the start date of the half-year (6-month period)
 */
export function getHalfYearStartDate(date: Date = new Date()): string {
  const month = date.getMonth();
  const startMonth = month < 6 ? 0 : 6;
  return getLocalDateString(new Date(date.getFullYear(), startMonth, 1));
}

/**
 * Get the start date of the quarter (3-month period)
 */
export function getQuarterStartDate(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3);
  return getLocalDateString(new Date(date.getFullYear(), quarter * 3, 1));
}

/**
 * Format date for month input (YYYY-MM)
 */
export function getMonthInputString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format date for display (DD Mon)
 * @param dateStr - Date string in YYYY-MM-DD format
 */
export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * Check if date is within range
 */
export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  return (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
}

/**
 * Get report date range for a given period
 */
export function getReportRange(period: string): PeriodRange {
  const today = new Date();

  switch (period) {
    case 'today':
      const day = getLocalDateString(today);
      return { from: day, to: day };
    case 'week':
      return { from: getWeekStartDate(today), to: getLocalDateString(today) };
    case 'month':
      return { from: getMonthStartDate(today), to: getLocalDateString(today) };
    case 'quarter':
      return { from: getQuarterStartDate(today), to: getLocalDateString(today) };
    case 'halfyear':
      return { from: getHalfYearStartDate(today), to: getLocalDateString(today) };
    case 'year':
      return { from: getYearStartDate(today), to: getLocalDateString(today) };
    default:
      return { from: getMonthStartDate(today), to: getLocalDateString(today) };
  }
}
