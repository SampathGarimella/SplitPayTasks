// ============================================================
// Split Pay & Tasks — Core Type Definitions
// ============================================================

export type SplitType = 'equal' | 'unequal' | 'percentage' | 'shares';
export type TaskStatus = 'pending' | 'completed' | 'skipped' | 'overdue';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type TaskPriority = 'low' | 'medium' | 'high';
export type GroupRole = 'admin' | 'member';
export type ExpenseCategory = 'food' | 'groceries' | 'rent' | 'utilities' | 'transport' | 'entertainment' | 'subscriptions' | 'misc';
export type TaskCategory = 'cleaning' | 'cooking' | 'shopping' | 'maintenance' | 'laundry' | 'trash' | 'misc';
export type NotificationType = 'expense_added' | 'payment_reminder' | 'task_due' | 'task_overdue' | 'task_completed' | 'group_invite' | 'settlement';
export type GroupType = 'home' | 'trip' | 'office' | 'event' | 'custom' | string;
export type GroupPermission = 'anyone' | 'owner_only';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  color: string;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  default_split_type: SplitType;
  currency: string;
  timezone: string;
  group_type: string;
  expense_permission: string;
  task_permission: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  user?: User;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paid_by: string;
  split_type: SplitType;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  linked_task_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  splits?: ExpenseSplit[];
  payer?: User;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage: number | null;
  shares: number | null;
  is_settled: boolean;
  settled_at: string | null;
  user?: User;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

export interface Task {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  recurrence: TaskRecurrence;
  recurrence_rule: string | null;
  custom_days: number[] | null;
  is_rotating: boolean;
  rotation_order: string[] | null;
  current_rotation_index: number;
  assigned_to: string | null;
  linked_expense_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  assignee?: User;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  action: 'created' | 'completed' | 'skipped' | 'reassigned' | 'edited';
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  group_id: string;
  user_id: string;
  action: string;
  entity_type: 'expense' | 'task' | 'settlement' | 'group' | 'member';
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user?: User;
}

// Computed types
export interface Balance {
  userId: string;
  userName: string;
  userColor: string;
  amount: number; // positive = owed to them, negative = they owe
}

export interface DebtSimplification {
  from: User;
  to: User;
  amount: number;
}

export interface GroupWithMembers extends Group {
  members: (GroupMember & { user: User })[];
}
