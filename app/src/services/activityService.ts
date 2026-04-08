import { supabase } from '../config/supabase';
import type { ActivityLog } from '../types';

// ============================================================
// Activity Service
// ============================================================

type EntityType = ActivityLog['entity_type'];

/**
 * Get activity logs for a group, ordered by most recent.
 */
export async function getActivity(
  groupId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(*)
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch activity: ${error.message}`);
  return (data ?? []) as ActivityLog[];
}

/**
 * Log an activity event for a group.
 */
export async function logActivity(
  groupId: string,
  action: string,
  entityType: EntityType,
  entityId: string,
  details?: Record<string, unknown> | null,
): Promise<ActivityLog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      group_id: groupId,
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? null,
    })
    .select(`
      *,
      user:users(*)
    `)
    .single();

  if (error) throw new Error(`Failed to log activity: ${error.message}`);
  return data as ActivityLog;
}

/**
 * Get activity logs filtered by entity type.
 */
export async function getActivityByType(
  groupId: string,
  entityType: EntityType,
  limit: number = 50,
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(*)
    `)
    .eq('group_id', groupId)
    .eq('entity_type', entityType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch activity by type: ${error.message}`);
  return (data ?? []) as ActivityLog[];
}

/**
 * Get activity logs for a specific entity (e.g., a particular expense or task).
 */
export async function getActivityForEntity(
  entityType: EntityType,
  entityId: string,
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(*)
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch entity activity: ${error.message}`);
  return (data ?? []) as ActivityLog[];
}
