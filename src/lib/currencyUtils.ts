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
  return '₹' + Number(amount).toLocaleString('en-IN');
}
