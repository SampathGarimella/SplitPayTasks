-- ============================================================
-- Split Pay & Tasks — Add Group Type and Permissions
-- ============================================================

-- Add group_type column to groups table
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'home';

-- Add expense permission column
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS expense_permission TEXT NOT NULL DEFAULT 'anyone' 
CHECK (expense_permission IN ('anyone', 'owner_only'));

-- Add task permission column
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS task_permission TEXT NOT NULL DEFAULT 'anyone'
CHECK (task_permission IN ('anyone', 'owner_only'));
