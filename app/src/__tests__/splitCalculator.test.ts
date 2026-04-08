import {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  simplifyDebts,
  formatCurrency,
} from '../utils/splitCalculator';

describe('splitCalculator', () => {
  describe('calculateEqualSplit', () => {
    it('splits evenly among 3 people', () => {
      const result = calculateEqualSplit(90, 3);
      expect(result).toEqual([30, 30, 30]);
    });

    it('handles remainder correctly', () => {
      const result = calculateEqualSplit(100, 3);
      // 33.33 * 3 = 99.99, first person gets the extra cent
      expect(result[0]).toBeCloseTo(33.34, 2);
      expect(result[1]).toBeCloseTo(33.33, 2);
      expect(result[2]).toBeCloseTo(33.33, 2);
      const total = result.reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(100, 2);
    });

    it('handles 1 person', () => {
      expect(calculateEqualSplit(50, 1)).toEqual([50]);
    });

    it('handles 0 amount', () => {
      expect(calculateEqualSplit(0, 3)).toEqual([0, 0, 0]);
    });
  });

  describe('calculateUnequalSplit', () => {
    it('validates amounts sum to total', () => {
      const result = calculateUnequalSplit(100, [50, 30, 20]);
      expect(result).toEqual([50, 30, 20]);
    });

    it('throws if amounts do not sum to total', () => {
      expect(() => calculateUnequalSplit(100, [50, 30])).toThrow();
    });
  });

  describe('calculatePercentageSplit', () => {
    it('calculates amounts from percentages', () => {
      const result = calculatePercentageSplit(200, [50, 25, 25]);
      expect(result).toEqual([100, 50, 50]);
    });

    it('throws if percentages do not sum to 100', () => {
      expect(() => calculatePercentageSplit(100, [50, 30])).toThrow();
    });
  });

  describe('calculateSharesSplit', () => {
    it('splits by shares', () => {
      const result = calculateSharesSplit(100, [2, 1, 1]);
      expect(result[0]).toBeCloseTo(50, 2);
      expect(result[1]).toBeCloseTo(25, 2);
      expect(result[2]).toBeCloseTo(25, 2);
    });

    it('throws if all shares are zero', () => {
      expect(() => calculateSharesSplit(100, [0, 0])).toThrow();
    });
  });

  describe('simplifyDebts', () => {
    const makeBalance = (userId: string, amount: number) => ({
      userId,
      userName: userId,
      userColor: '#000',
      amount,
    });

    it('simplifies debts between 3 users', () => {
      const balances = [
        makeBalance('A', -30),
        makeBalance('B', 20),
        makeBalance('C', 10),
      ];
      const result = simplifyDebts(balances);
      expect(result.length).toBeLessThanOrEqual(2);
      const totalTransferred = result.reduce((sum, d) => sum + d.amount, 0);
      expect(totalTransferred).toBeCloseTo(30, 2);
    });

    it('returns empty for balanced accounts', () => {
      const balances = [
        makeBalance('A', 0),
        makeBalance('B', 0),
      ];
      expect(simplifyDebts(balances)).toEqual([]);
    });

    it('handles single debtor and creditor', () => {
      const balances = [
        makeBalance('A', -50),
        makeBalance('B', 50),
      ];
      const result = simplifyDebts(balances);
      expect(result.length).toBe(1);
      expect(result[0].from.id).toBe('A');
      expect(result[0].to.id).toBe('B');
      expect(result[0].amount).toBe(50);
    });
  });

  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      expect(formatCurrency(42.5, 'USD')).toBe('$42.50');
    });

    it('formats EUR correctly', () => {
      expect(formatCurrency(42.5, 'EUR')).toBe('€42.50');
    });

    it('formats GBP correctly', () => {
      expect(formatCurrency(42.5, 'GBP')).toBe('£42.50');
    });

    it('formats INR correctly', () => {
      expect(formatCurrency(42.5, 'INR')).toBe('₹42.50');
    });
  });
});
