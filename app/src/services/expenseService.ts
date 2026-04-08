import { supabase } from '../config/supabase';
import type {
  Expense,
  ExpenseSplit,
  Settlement,
  Balance,
  DebtSimplification,
  SplitType,
  ExpenseCategory,
  User,
} from '../types';
import { simplifyDebts as simplifyDebtsAlgorithm } from '../utils/splitCalculator';

// ============================================================
// Expense Service
// ============================================================

interface CreateExpenseInput {
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paid_by: string;
  split_type: SplitType;
  receipt_url?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  linked_task_id?: string | null;
}

interface CreateSplitInput {
  user_id: string;
  amount: number;
  percentage?: number | null;
  shares?: number | null;
}

/**
 * Create an expense with its splits in a single operation.
 */
export async function createExpense(
  expense: CreateExpenseInput,
  splits: CreateSplitInput[],
): Promise<Expense> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate: split amounts must sum to expense amount
  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(splitTotal - expense.amount) > 0.01) {
    throw new Error(
      `Split amounts (${splitTotal.toFixed(2)}) do not match expense amount (${expense.amount.toFixed(2)}).`,
    );
  }

  // Insert expense
  const { data: created, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      ...expense,
      created_by: user.id,
    })
    .select()
    .single();

  if (expenseError) throw new Error(`Failed to create expense: ${expenseError.message}`);

  // Insert splits
  const splitRows = splits.map((s) => ({
    expense_id: created.id,
    user_id: s.user_id,
    amount: s.amount,
    percentage: s.percentage ?? null,
    shares: s.shares ?? null,
    is_settled: false,
  }));

  const { error: splitError } = await supabase.from('expense_splits').insert(splitRows);

  if (splitError) {
    // Roll back the expense if splits fail
    await supabase.from('expenses').delete().eq('id', created.id);
    throw new Error(`Failed to create splits: ${splitError.message}`);
  }

  // Return full expense with splits and payer
  return getExpense(created.id);
}

/**
 * Get a single expense with payer and splits joined.
 */
async function getExpense(id: string): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      payer:users!expenses_paid_by_fkey(*),
      splits:expense_splits(
        *,
        user:users(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(`Failed to fetch expense: ${error.message}`);
  return data as Expense;
}

/**
 * Get all expenses for a group with payer and splits.
 */
export async function getExpenses(groupId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      payer:users!expenses_paid_by_fkey(*),
      splits:expense_splits(
        *,
        user:users(*)
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
  return (data ?? []) as Expense[];
}

/**
 * Update an existing expense.
 */
export async function updateExpense(
  id: string,
  updates: Partial<Pick<Expense, 'description' | 'amount' | 'category' | 'notes' | 'receipt_url'>>,
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update expense: ${error.message}`);
  return data as Expense;
}

/**
 * Delete an expense and its associated splits (cascade expected).
 */
export async function deleteExpense(id: string): Promise<void> {
  // Delete splits first in case there's no cascade
  await supabase.from('expense_splits').delete().eq('expense_id', id);

  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete expense: ${error.message}`);
}

/**
 * Calculate net balances for all members in a group.
 * Positive = others owe this person. Negative = this person owes others.
 */
export async function getBalances(groupId: string): Promise<Balance[]> {
  // Get all members
  const { data: members, error: memError } = await supabase
    .from('group_members')
    .select('user_id, user:users(*)')
    .eq('group_id', groupId);

  if (memError) throw new Error(`Failed to fetch members: ${memError.message}`);
  if (!members || members.length === 0) return [];

  // Get all unsettled expenses
  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select(`
      id, paid_by, amount,
      splits:expense_splits(user_id, amount, is_settled)
    `)
    .eq('group_id', groupId);

  if (expError) throw new Error(`Failed to fetch expenses: ${expError.message}`);

  // Get settlements
  const { data: settlements, error: setError } = await supabase
    .from('settlements')
    .select('from_user_id, to_user_id, amount')
    .eq('group_id', groupId);

  if (setError) throw new Error(`Failed to fetch settlements: ${setError.message}`);

  // Build balance map: userId -> net amount
  const balanceMap = new Map<string, number>();
  for (const m of members) {
    balanceMap.set(m.user_id, 0);
  }

  // Process expenses: payer gets +amount, each split user gets -splitAmount
  for (const expense of expenses ?? []) {
    const splits = (expense.splits ?? []) as ExpenseSplit[];
    for (const split of splits) {
      if (split.is_settled) continue;
      // The payer is owed this split amount
      balanceMap.set(
        expense.paid_by,
        (balanceMap.get(expense.paid_by) ?? 0) + split.amount,
      );
      // The split user owes this amount
      balanceMap.set(
        split.user_id,
        (balanceMap.get(split.user_id) ?? 0) - split.amount,
      );
    }
  }

  // Process settlements: from_user paid to_user
  for (const s of settlements ?? []) {
    balanceMap.set(s.from_user_id, (balanceMap.get(s.from_user_id) ?? 0) + s.amount);
    balanceMap.set(s.to_user_id, (balanceMap.get(s.to_user_id) ?? 0) - s.amount);
  }

  // Build results
  const userMap = new Map(members.map((m) => [m.user_id, m.user as unknown as User]));
  const balances: Balance[] = [];

  for (const [userId, amount] of balanceMap) {
    const u = userMap.get(userId);
    if (!u) continue;
    balances.push({
      userId,
      userName: u.full_name,
      userColor: u.color,
      amount: Math.round(amount * 100) / 100,
    });
  }

  return balances.sort((a, b) => b.amount - a.amount);
}

/**
 * Simplify debts in a group to minimize the number of transactions.
 */
export async function simplifyDebts(groupId: string): Promise<DebtSimplification[]> {
  const balances = await getBalances(groupId);

  // Get member user objects
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, user:users(*)')
    .eq('group_id', groupId);

  const userMap = new Map(
    (members ?? []).map((m) => [m.user_id, m.user as unknown as User]),
  );

  // Run simplification algorithm
  const simplified = simplifyDebtsAlgorithm(balances);

  // Map to DebtSimplification with full user objects
  return simplified.map((debt) => ({
    from: userMap.get(debt.from.id) ?? debt.from,
    to: userMap.get(debt.to.id) ?? debt.to,
    amount: debt.amount,
  }));
}

/**
 * Record a settlement between two users in a group.
 */
export async function createSettlement(
  fromUserId: string,
  toUserId: string,
  amount: number,
  groupId: string,
  currency?: string,
  notes?: string | null,
): Promise<Settlement> {
  // Fetch group currency if not provided
  let settlementCurrency = currency;
  if (!settlementCurrency) {
    const { data: group } = await supabase
      .from('groups')
      .select('currency')
      .eq('id', groupId)
      .single();
    settlementCurrency = group?.currency ?? 'USD';
  }

  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: groupId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      currency: settlementCurrency,
      notes: notes ?? null,
    })
    .select(`
      *,
      from_user:users!settlements_from_user_id_fkey(*),
      to_user:users!settlements_to_user_id_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to create settlement: ${error.message}`);
  return data as Settlement;
}

/**
 * Get all settlements for a group.
 */
export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select(`
      *,
      from_user:users!settlements_from_user_id_fkey(*),
      to_user:users!settlements_to_user_id_fkey(*)
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch settlements: ${error.message}`);
  return (data ?? []) as Settlement[];
}
