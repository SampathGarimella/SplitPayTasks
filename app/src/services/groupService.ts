import { supabase } from '../config/supabase';
import type { Group, GroupMember, GroupWithMembers } from '../types';

// ============================================================
// Group Service
// ============================================================

/**
 * Create a new group and add the creator as an admin member.
 */
export async function createGroup(
  name: string,
  description: string | null,
  currency: string = 'USD',
  timezone: string = 'UTC',
): Promise<GroupWithMembers> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      currency,
      timezone,
      created_by: user.id,
    })
    .select()
    .single();

  if (groupError) throw new Error(`Failed to create group: ${groupError.message}`);

  // Add creator as admin member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin' as const,
    });

  if (memberError) throw new Error(`Failed to add creator as member: ${memberError.message}`);

  // Fetch the full group with members
  return getGroup(group.id);
}

/**
 * Get all groups the current user belongs to, with member details.
 */
export async function getGroups(): Promise<GroupWithMembers[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get group IDs the user is a member of
  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (memError) throw new Error(`Failed to fetch memberships: ${memError.message}`);
  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  // Fetch groups with members
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(
        *,
        user:profiles(*)
      )
    `)
    .in('id', groupIds)
    .order('updated_at', { ascending: false });

  if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

  return (groups ?? []) as GroupWithMembers[];
}

/**
 * Get a single group by ID with all members.
 */
export async function getGroup(id: string): Promise<GroupWithMembers> {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(
        *,
        user:profiles(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(`Failed to fetch group: ${error.message}`);

  return data as GroupWithMembers;
}

/**
 * Join a group using an invite code.
 */
export async function joinGroupByCode(code: string): Promise<GroupWithMembers> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Find group by invite code
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('invite_code', code.trim().toUpperCase())
    .single();

  if (groupError || !group) {
    throw new Error('Invalid invite code. Please check and try again.');
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    throw new Error('You are already a member of this group.');
  }

  // Add user as member
  const { error: joinError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'member' as const,
    });

  if (joinError) throw new Error(`Failed to join group: ${joinError.message}`);

  return getGroup(group.id);
}

/**
 * Update group details. Only admins should call this.
 */
export async function updateGroup(
  id: string,
  updates: Partial<Pick<Group, 'name' | 'description' | 'currency' | 'timezone' | 'default_split_type'>>,
): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update group: ${error.message}`);

  return data as Group;
}

/**
 * Remove a member from a group. Only admins can remove others.
 */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

/**
 * Leave a group. If the user is the last admin, they cannot leave
 * unless they transfer admin rights first.
 */
export async function leaveGroup(groupId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if user is the only admin
  const { data: admins, error: adminError } = await supabase
    .from('group_members')
    .select('id, user_id')
    .eq('group_id', groupId)
    .eq('role', 'admin');

  if (adminError) throw new Error(`Failed to check admin status: ${adminError.message}`);

  const isOnlyAdmin =
    admins?.length === 1 && admins[0].user_id === user.id;

  // Check total member count
  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (isOnlyAdmin && (count ?? 0) > 1) {
    throw new Error(
      'You are the only admin. Please promote another member to admin before leaving.',
    );
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to leave group: ${error.message}`);

  // If the group is now empty, delete it
  if ((count ?? 0) <= 1) {
    await supabase.from('groups').delete().eq('id', groupId);
  }
}

/**
 * Regenerate the invite code for a group.
 */
export async function regenerateInviteCode(groupId: string): Promise<string> {
  // Generate a random 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes confusing chars I/O/0/1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const { data, error } = await supabase
    .from('groups')
    .update({ invite_code: code, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select('invite_code')
    .single();

  if (error) throw new Error(`Failed to regenerate invite code: ${error.message}`);

  return data.invite_code;
}
