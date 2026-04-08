export const COLORS = {
  primary: '#030213',
  primaryForeground: '#ffffff',
  background: '#ffffff',
  card: '#ffffff',
  secondary: '#f5f5f8',
  muted: '#ececf0',
  mutedForeground: '#717182',
  accent: '#e9ebef',
  border: 'rgba(0, 0, 0, 0.1)',
  input: '#f3f3f5',
  destructive: '#d4183d',
  destructiveForeground: '#ffffff',
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#8b5cf6',
  orange: '#f59e0b',
  red: '#ef4444',
  teal: '#14b8a6',
  yellow: '#fbbf24',
  pink: '#ec4899',
  indigo: '#6366f1',
  lime: '#84cc16',
};

export const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food', icon: 'restaurant', color: '#f59e0b' },
  { value: 'groceries', label: 'Groceries', icon: 'cart', color: '#10b981' },
  { value: 'rent', label: 'Rent', icon: 'home', color: '#3b82f6' },
  { value: 'utilities', label: 'Utilities', icon: 'flash', color: '#f97316' },
  { value: 'transport', label: 'Transport', icon: 'car', color: '#8b5cf6' },
  { value: 'entertainment', label: 'Entertainment', icon: 'game-controller', color: '#ec4899' },
  { value: 'subscriptions', label: 'Subscriptions', icon: 'repeat', color: '#6366f1' },
  { value: 'misc', label: 'Misc', icon: 'ellipsis-horizontal', color: '#717182' },
] as const;

export const TASK_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning', icon: 'sparkles', color: '#3b82f6' },
  { value: 'cooking', label: 'Cooking', icon: 'restaurant', color: '#f59e0b' },
  { value: 'shopping', label: 'Shopping', icon: 'cart', color: '#10b981' },
  { value: 'maintenance', label: 'Maintenance', icon: 'construct', color: '#f97316' },
  { value: 'laundry', label: 'Laundry', icon: 'shirt', color: '#8b5cf6' },
  { value: 'trash', label: 'Trash', icon: 'trash', color: '#717182' },
  { value: 'misc', label: 'Misc', icon: 'ellipsis-horizontal', color: '#ececf0' },
] as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'] as const;
