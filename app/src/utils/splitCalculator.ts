import type { Balance, DebtSimplification, User } from '../types';

// ============================================================
// Split Calculator — Pure Utility Functions
// ============================================================

/**
 * Round to 2 decimal places using banker's rounding.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate equal split among N people.
 * Handles rounding by assigning the remainder to the first person.
 *
 * @returns Array of amounts, one per person, summing exactly to `amount`.
 */
export function calculateEqualSplit(amount: number, numPeople: number): number[] {
  if (numPeople <= 0) throw new Error('Number of people must be positive.');
  if (amount < 0) throw new Error('Amount must be non-negative.');

  const perPerson = Math.floor((amount * 100) / numPeople) / 100;
  const remainder = round2(amount - perPerson * numPeople);

  const splits: number[] = [];
  for (let i = 0; i < numPeople; i++) {
    splits.push(i === 0 ? round2(perPerson + remainder) : perPerson);
  }

  return splits;
}

/**
 * Validate unequal (exact-amount) splits.
 * Each person specifies the exact amount they owe.
 *
 * @param amount Total expense amount.
 * @param amounts Array of exact amounts per person.
 * @returns The validated amounts array.
 */
export function calculateUnequalSplit(amount: number, amounts: number[]): number[] {
  if (amounts.length === 0) throw new Error('At least one split amount is required.');

  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (Math.abs(round2(total) - round2(amount)) > 0.01) {
    throw new Error(
      `Split amounts (${round2(total).toFixed(2)}) do not add up to the total (${round2(amount).toFixed(2)}).`,
    );
  }

  return amounts.map(round2);
}

/**
 * Calculate percentage-based splits.
 * Percentages must sum to 100.
 *
 * @param amount Total expense amount.
 * @param percentages Array of percentages per person (should sum to 100).
 * @returns Array of calculated amounts.
 */
export function calculatePercentageSplit(amount: number, percentages: number[]): number[] {
  if (percentages.length === 0) throw new Error('At least one percentage is required.');

  const totalPercent = percentages.reduce((sum, p) => sum + p, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(
      `Percentages must sum to 100 (got ${round2(totalPercent)}).`,
    );
  }

  // Calculate raw amounts
  const rawAmounts = percentages.map((p) => (amount * p) / 100);
  const roundedAmounts = rawAmounts.map(round2);

  // Fix any rounding discrepancy by adjusting the largest share
  const roundedTotal = roundedAmounts.reduce((sum, a) => sum + a, 0);
  const diff = round2(amount - roundedTotal);

  if (Math.abs(diff) > 0) {
    // Find the index of the largest share to absorb the rounding error
    let maxIdx = 0;
    for (let i = 1; i < roundedAmounts.length; i++) {
      if (roundedAmounts[i] > roundedAmounts[maxIdx]) maxIdx = i;
    }
    roundedAmounts[maxIdx] = round2(roundedAmounts[maxIdx] + diff);
  }

  return roundedAmounts;
}

/**
 * Calculate shares-based splits.
 * Each person has a number of shares; the amount is divided proportionally.
 *
 * @param amount Total expense amount.
 * @param shares Array of share counts per person.
 * @returns Array of calculated amounts.
 */
export function calculateSharesSplit(amount: number, shares: number[]): number[] {
  if (shares.length === 0) throw new Error('At least one share value is required.');
  if (shares.some((s) => s < 0)) throw new Error('Share values must be non-negative.');

  const totalShares = shares.reduce((sum, s) => sum + s, 0);
  if (totalShares === 0) throw new Error('Total shares must be greater than zero.');

  const rawAmounts = shares.map((s) => (amount * s) / totalShares);
  const roundedAmounts = rawAmounts.map(round2);

  // Fix rounding discrepancy
  const roundedTotal = roundedAmounts.reduce((sum, a) => sum + a, 0);
  const diff = round2(amount - roundedTotal);

  if (Math.abs(diff) > 0) {
    let maxIdx = 0;
    for (let i = 1; i < roundedAmounts.length; i++) {
      if (roundedAmounts[i] > roundedAmounts[maxIdx]) maxIdx = i;
    }
    roundedAmounts[maxIdx] = round2(roundedAmounts[maxIdx] + diff);
  }

  return roundedAmounts;
}

/**
 * Simplify debts to minimize the number of transactions.
 *
 * Uses a greedy algorithm that repeatedly matches the largest creditor
 * with the largest debtor. This produces optimal or near-optimal results
 * for most real-world cases.
 *
 * @param balances Array of Balance objects with userId and amount.
 *   Positive amount = person is owed money (creditor).
 *   Negative amount = person owes money (debtor).
 * @returns Array of simplified debt transactions.
 */
export function simplifyDebts(balances: Balance[]): DebtSimplification[] {
  // Filter out zero balances and create mutable copies
  const creditors: { userId: string; userName: string; userColor: string; amount: number }[] = [];
  const debtors: { userId: string; userName: string; userColor: string; amount: number }[] = [];

  for (const b of balances) {
    const rounded = round2(b.amount);
    if (rounded > 0.01) {
      creditors.push({ ...b, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ ...b, amount: Math.abs(rounded) });
    }
  }

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: DebtSimplification[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settleAmount = round2(Math.min(creditor.amount, debtor.amount));

    if (settleAmount > 0.01) {
      transactions.push({
        from: {
          id: debtor.userId,
          email: '',
          full_name: debtor.userName,
          avatar_url: null,
          color: debtor.userColor,
          push_token: null,
          created_at: '',
          updated_at: '',
        } as User,
        to: {
          id: creditor.userId,
          email: '',
          full_name: creditor.userName,
          avatar_url: null,
          color: creditor.userColor,
          push_token: null,
          created_at: '',
          updated_at: '',
        } as User,
        amount: settleAmount,
      });
    }

    creditor.amount = round2(creditor.amount - settleAmount);
    debtor.amount = round2(debtor.amount - settleAmount);

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return transactions;
}

// ============================================================
// Currency Formatting
// ============================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
  INR: '\u20B9',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CNY: '\u00A5',
  KRW: '\u20A9',
  MXN: 'MX$',
  BRL: 'R$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  ZAR: 'R',
  THB: '\u0E3F',
  MYR: 'RM',
  PHP: '\u20B1',
  IDR: 'Rp',
  TWD: 'NT$',
  AED: 'AED',
  SAR: 'SAR',
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'IDR']);

/**
 * Format a numeric amount as a currency string.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? code + ' ';
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(code);

  const absAmount = Math.abs(amount);
  const formatted = isZeroDecimal
    ? Math.round(absAmount).toLocaleString()
    : absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}
