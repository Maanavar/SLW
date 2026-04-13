/**
 * Sample test suite for utilities
 * This demonstrates the testing setup
 */

describe('Utility Functions', () => {
  test('should format currency values correctly', () => {
    // Sample test - replace with actual utils tests
    const value = 1000;
    const formatted = value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });
    expect(formatted).toContain('₹');
  });

  test('should handle date formatting', () => {
    const date = new Date('2026-04-13');
    expect(date).toBeInstanceOf(Date);
  });

  test('localStorage should be working', () => {
    localStorage.setItem('test_key', 'test_value');
    const value = localStorage.getItem('test_key');
    expect(value).toBe('test_value');
    localStorage.removeItem('test_key');
    expect(localStorage.getItem('test_key')).toBeNull();
  });
});
