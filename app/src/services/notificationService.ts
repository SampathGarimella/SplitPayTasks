import { supabase } from '../config/supabase';
import type { AppNotification, NotificationType } from '../types';

// ============================================================
// Notification Service
// ============================================================

/**
 * Get all notifications for the current user, ordered by most recent.
 */
export async function getNotifications(
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AppNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (options.unreadOnly) {
    query = query.eq('read', false);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
  return (data ?? []) as AppNotification[];
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) throw new Error(`Failed to mark all notifications as read: ${error.message}`);
}

/**
 * Delete all read notifications for the current user.
 */
export async function clearNotifications(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('read', true);

  if (error) throw new Error(`Failed to clear notifications: ${error.message}`);
}

/**
 * Register a push notification token for the current user.
 */
export async function registerPushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({
      push_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw new Error(`Failed to register push token: ${error.message}`);
}

/**
 * Create a notification for a specific user.
 * Typically called from other services when events occur.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown> | null,
  groupId?: string | null,
): Promise<AppNotification> {
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data: data ?? null,
      group_id: groupId ?? null,
      read: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create notification: ${error.message}`);
  return notification as AppNotification;
}

/**
 * Send notifications to multiple users at once.
 */
export async function createBulkNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown> | null,
  groupId?: string | null,
): Promise<void> {
  if (userIds.length === 0) return;

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    message,
    data: data ?? null,
    group_id: groupId ?? null,
    read: false,
  }));

  const { error } = await supabase.from('notifications').insert(rows);

  if (error) throw new Error(`Failed to create bulk notifications: ${error.message}`);
}

/**
 * Get the unread notification count for the current user.
 */
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) throw new Error(`Failed to get unread count: ${error.message}`);
  return count ?? 0;
}
