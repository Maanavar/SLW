/**
 * Currency Utility Functions
 * Ported from src/js/utils.js
 */

/**
 * Format number as Indian Rupees (₹)
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | string): string {
  const value = Number(amount) || 0;
  const hasFraction = Math.abs(value % 1) > 0.0001;
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  return `₹${formatter.format(value)}`;
}
