// Light theme colors
export const LIGHT_COLORS = {
  primary: '#030213',
  primaryForeground: '#ffffff',
  background: '#f5f5f7',
  card: '#ffffff',
  secondary: '#ebebef',
  muted: '#e5e5ea',
  mutedForeground: '#6e6e80',
  accent: '#e9ebef',
  border: 'rgba(0, 0, 0, 0.08)',
  input: '#f0f0f3',
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

// Dark theme colors
export const DARK_COLORS = {
  primary: '#ffffff',
  primaryForeground: '#121212',
  background: '#121212',
  card: '#1e1e1e',
  secondary: '#2a2a2e',
  muted: '#3a3a3e',
  mutedForeground: '#a0a0ab',
  accent: '#2e2e33',
  border: 'rgba(255, 255, 255, 0.1)',
  input: '#252528',
  destructive: '#ff4d6d',
  destructiveForeground: '#ffffff',
  blue: '#5b9df6',
  green: '#34d399',
  purple: '#a78bfa',
  orange: '#fbbf24',
  red: '#f87171',
  teal: '#2dd4bf',
  yellow: '#fcd34d',
  pink: '#f472b6',
  indigo: '#818cf8',
  lime: '#a3e635',
};

// Default to light colors (will be overridden by ThemeProvider)
export let COLORS = { ...LIGHT_COLORS };

// Function to switch theme
export const setThemeColors = (isDark: boolean) => {
  COLORS = isDark ? { ...DARK_COLORS } : { ...LIGHT_COLORS };
};

// Helper to get colors based on theme (for components that need reactive updates)
export const getColors = (isDark: boolean) => isDark ? DARK_COLORS : LIGHT_COLORS;

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

export const GROUP_TYPES = [
  { value: 'home', label: 'Home', icon: 'home', color: '#3b82f6' },
  { value: 'trip', label: 'Trip', icon: 'airplane', color: '#f59e0b' },
  { value: 'office', label: 'Office', icon: 'briefcase', color: '#8b5cf6' },
  { value: 'event', label: 'Event', icon: 'calendar', color: '#ec4899' },
  { value: 'custom', label: 'Custom', icon: 'ellipsis-horizontal', color: '#6e6e80' },
] as const;

export type GroupType = typeof GROUP_TYPES[number]['value'];

// Group permission settings
export const GROUP_PERMISSIONS = {
  ANYONE_CAN_ADD: 'anyone',
  OWNER_ONLY: 'owner_only',
} as const;

export type GroupPermission = typeof GROUP_PERMISSIONS[keyof typeof GROUP_PERMISSIONS];
