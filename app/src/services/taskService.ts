import { supabase } from '../config/supabase';
import type { Task, TaskHistory, TaskCategory, TaskPriority, TaskRecurrence, TaskStatus } from '../types';

// ============================================================
// Task Service
// ============================================================

interface CreateTaskInput {
  group_id: string;
  title: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  due_date?: string | null;
  recurrence?: TaskRecurrence;
  recurrence_rule?: string | null;
  custom_days?: number[] | null;
  is_rotating?: boolean;
  rotation_order?: string[] | null;
  assigned_to?: string | null;
  linked_expense_id?: string | null;
}

/**
 * Create a new task in a group.
 */
export async function createTask(task: CreateTaskInput): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      group_id: task.group_id,
      title: task.title,
      description: task.description ?? null,
      category: task.category ?? 'misc',
      priority: task.priority ?? 'medium',
      status: 'pending' as TaskStatus,
      due_date: task.due_date ?? null,
      recurrence: task.recurrence ?? 'none',
      recurrence_rule: task.recurrence_rule ?? null,
      custom_days: task.custom_days ?? null,
      is_rotating: task.is_rotating ?? false,
      rotation_order: task.rotation_order ?? null,
      current_rotation_index: 0,
      assigned_to: task.assigned_to ?? null,
      linked_expense_id: task.linked_expense_id ?? null,
      created_by: user.id,
    })
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);

  // Log history
  await logTaskHistory(data.id, user.id, 'created', { title: task.title });

  return data as Task;
}

/**
 * Get all tasks for a group with assignee details.
 */
export async function getTasks(groupId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .eq('group_id', groupId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
  return (data ?? []) as Task[];
}

/**
 * Update a task.
 */
export async function updateTask(
  id: string,
  updates: Partial<
    Pick<
      Task,
      | 'title'
      | 'description'
      | 'category'
      | 'priority'
      | 'status'
      | 'due_date'
      | 'recurrence'
      | 'recurrence_rule'
      | 'custom_days'
      | 'is_rotating'
      | 'rotation_order'
      | 'assigned_to'
      | 'linked_expense_id'
    >
  >,
): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);

  await logTaskHistory(data.id, user.id, 'edited', updates);

  return data as Task;
}

/**
 * Delete a task and its history.
 */
export async function deleteTask(id: string): Promise<void> {
  // Delete history first in case there's no cascade
  await supabase.from('task_history').delete().eq('task_id', id);

  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

/**
 * Mark a task as completed and handle recurrence/rotation.
 */
export async function completeTask(id: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  // Fetch current task state
  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw new Error('Task not found');

  // Mark as completed
  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed' as TaskStatus,
      completed_at: now,
      completed_by: user.id,
      updated_at: now,
    })
    .eq('id', id)
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to complete task: ${error.message}`);

  await logTaskHistory(id, user.id, 'completed', null);

  // If recurring, create the next occurrence
  if (current.recurrence !== 'none') {
    const nextDueDate = calculateNextDueDate(current.due_date, current.recurrence, current.custom_days);
    const nextAssignee = current.is_rotating
      ? getNextRotationAssignee(current.rotation_order, current.current_rotation_index)
      : current.assigned_to;

    const nextIndex = current.is_rotating
      ? ((current.current_rotation_index ?? 0) + 1) % (current.rotation_order?.length ?? 1)
      : current.current_rotation_index;

    await supabase.from('tasks').insert({
      group_id: current.group_id,
      title: current.title,
      description: current.description,
      category: current.category,
      priority: current.priority,
      status: 'pending',
      due_date: nextDueDate,
      recurrence: current.recurrence,
      recurrence_rule: current.recurrence_rule,
      custom_days: current.custom_days,
      is_rotating: current.is_rotating,
      rotation_order: current.rotation_order,
      current_rotation_index: nextIndex,
      assigned_to: nextAssignee,
      linked_expense_id: current.linked_expense_id,
      created_by: current.created_by,
    });
  }

  return data as Task;
}

/**
 * Skip a task (mark as skipped) and optionally rotate to next person.
 */
export async function skipTask(id: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  // Fetch current task state for rotation
  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw new Error('Task not found');

  // Calculate next assignee if rotating
  let nextAssignee = current.assigned_to;
  let nextIndex = current.current_rotation_index;

  if (current.is_rotating && current.rotation_order?.length) {
    nextIndex = ((current.current_rotation_index ?? 0) + 1) % current.rotation_order.length;
    nextAssignee = current.rotation_order[nextIndex];
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: 'skipped' as TaskStatus,
      assigned_to: nextAssignee,
      current_rotation_index: nextIndex,
      updated_at: now,
    })
    .eq('id', id)
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to skip task: ${error.message}`);

  await logTaskHistory(id, user.id, 'skipped', { next_assignee: nextAssignee });

  return data as Task;
}

/**
 * Advance rotation on a task without changing its status.
 */
export async function rotateTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: current, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (fetchError || !current) throw new Error('Task not found');

  if (!current.is_rotating || !current.rotation_order?.length) {
    throw new Error('Task is not configured for rotation.');
  }

  const nextIndex = ((current.current_rotation_index ?? 0) + 1) % current.rotation_order.length;
  const nextAssignee = current.rotation_order[nextIndex];

  const { data, error } = await supabase
    .from('tasks')
    .update({
      assigned_to: nextAssignee,
      current_rotation_index: nextIndex,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(*)
    `)
    .single();

  if (error) throw new Error(`Failed to rotate task: ${error.message}`);

  await logTaskHistory(taskId, user.id, 'reassigned', {
    previous_assignee: current.assigned_to,
    new_assignee: nextAssignee,
  });

  return data as Task;
}

/**
 * Get the history of actions taken on a task.
 */
export async function getTaskHistory(taskId: string): Promise<TaskHistory[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch task history: ${error.message}`);
  return (data ?? []) as TaskHistory[];
}

// ============================================================
// Internal helpers
// ============================================================

async function logTaskHistory(
  taskId: string,
  userId: string,
  action: TaskHistory['action'],
  details: Record<string, unknown> | null,
): Promise<void> {
  await supabase.from('task_history').insert({
    task_id: taskId,
    user_id: userId,
    action,
    details,
  });
}

function calculateNextDueDate(
  currentDue: string | null,
  recurrence: TaskRecurrence,
  customDays: number[] | null,
): string | null {
  if (!currentDue) return null;

  const date = new Date(currentDue);

  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'custom':
      if (customDays?.length) {
        // customDays are day-of-week (0=Sun..6=Sat)
        const currentDay = date.getDay();
        const sortedDays = [...customDays].sort((a, b) => a - b);
        const nextDay = sortedDays.find((d) => d > currentDay) ?? sortedDays[0];
        let daysToAdd = nextDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        date.setDate(date.getDate() + daysToAdd);
      } else {
        date.setDate(date.getDate() + 7); // fallback
      }
      break;
    default:
      return null;
  }

  return date.toISOString();
}

function getNextRotationAssignee(
  rotationOrder: string[] | null,
  currentIndex: number,
): string | null {
  if (!rotationOrder?.length) return null;
  const nextIndex = (currentIndex + 1) % rotationOrder.length;
  return rotationOrder[nextIndex];
}
