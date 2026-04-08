import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Share,
  StyleSheet,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { getColors, GROUP_TYPES } from '../../config/constants';
import {
  Avatar,
  Badge,
  Card,
  Button,
  LoadingScreen,
  FluidTouchable,
} from '../../components/common';
import {
  getGroup,
  removeMember,
  leaveGroup,
  regenerateInviteCode,
} from '../../services/groupService';
import { useAuth } from '../../hooks/useAuth';
import type { GroupWithMembers, GroupMember, User } from '../../types';

export default function GroupDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const groupId: string = route.params?.groupId;

  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get group type info
  const getGroupTypeInfo = (type: string | undefined) => {
    const found = GROUP_TYPES.find(t => t.value === type);
    if (found) return found;
    // Custom type
    return { value: type ?? 'custom', label: type ?? 'Custom', icon: 'ellipsis-horizontal' as const, color: colors.mutedForeground };
  };

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const loadGroup = useCallback(async () => {
    try {
      const data = await getGroup(groupId);
      setGroup(data);
    } catch (err) {
      console.error('Failed to load group:', err);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroup();
    setRefreshing(false);
  }, [loadGroup]);

  // ----------------------------------------------------------
  // Permissions
  // ----------------------------------------------------------

  const currentMember = group?.members.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin';

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const handleCopyCode = () => {
    if (!group) return;
    Clipboard.setString(group.invite_code);
    Alert.alert('Copied', 'Invite code copied to clipboard');
  };

  const handleShareCode = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `Join my group "${group.name}" on Split Pay & Tasks!\n\nInvite code: ${group.invite_code}`,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const handleRegenerateCode = () => {
    Alert.alert(
      'Regenerate Code',
      'The current invite code will stop working. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerateInviteCode(groupId);
              await loadGroup();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to regenerate code');
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = (member: GroupMember & { user: User }) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.user.full_name} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(groupId, member.user_id);
              await loadGroup();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to remove member');
            }
          },
        },
      ],
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(groupId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to leave group');
            }
          },
        },
      ],
    );
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading || !group) {
    return <LoadingScreen />;
  }

  const groupTypeInfo = getGroupTypeInfo(group.group_type);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
      }
    >
      {/* Group Info Header */}
      <Card style={styles.headerCard}>
        <View style={styles.groupHeaderRow}>
          <View style={styles.groupTitleSection}>
            <Text style={[styles.groupName, { color: colors.primary }]}>{group.name}</Text>
            {group.description && (
              <Text style={[styles.groupDescription, { color: colors.mutedForeground }]}>{group.description}</Text>
            )}
          </View>
          <View style={[styles.groupTypeBadge, { backgroundColor: groupTypeInfo.color + '1A' }]}>
            <Ionicons
              name={groupTypeInfo.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={groupTypeInfo.color}
            />
            <Text style={[styles.groupTypeText, { color: groupTypeInfo.color }]}>
              {groupTypeInfo.label}
            </Text>
          </View>
        </View>

        {/* Invite Code */}
        <View style={styles.inviteSection}>
          <Text style={[styles.inviteLabel, { color: colors.mutedForeground }]}>Invite Code</Text>
          <View style={styles.inviteRow}>
            <View style={[styles.codeBox, { backgroundColor: colors.input }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{group.invite_code}</Text>
            </View>
            <FluidTouchable style={styles.iconButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={20} color={colors.blue} />
            </FluidTouchable>
            <FluidTouchable style={styles.iconButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={20} color={colors.blue} />
            </FluidTouchable>
            {isAdmin && (
              <FluidTouchable style={styles.iconButton} onPress={handleRegenerateCode}>
                <Ionicons name="refresh-outline" size={20} color={colors.mutedForeground} />
              </FluidTouchable>
            )}
          </View>
        </View>

        {/* Group meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{group.currency}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="git-branch-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{group.default_split_type}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{group.members.length} members</Text>
          </View>
        </View>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <FluidTouchable
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'AddExpense',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.blue + '1A' }]}>
            <Ionicons name="receipt-outline" size={22} color={colors.blue} />
          </View>
          <Text style={[styles.quickActionLabel, { color: colors.primary }]}>Add Expense</Text>
        </FluidTouchable>

        <FluidTouchable
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('TasksTab', {
              screen: 'AddTask',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.green + '1A' }]}>
            <Ionicons name="checkbox-outline" size={22} color={colors.green} />
          </View>
          <Text style={[styles.quickActionLabel, { color: colors.primary }]}>Add Task</Text>
        </FluidTouchable>

        <FluidTouchable
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'Expenses',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.purple + '1A' }]}>
            <Ionicons name="list-outline" size={22} color={colors.purple} />
          </View>
          <Text style={[styles.quickActionLabel, { color: colors.primary }]}>Expenses</Text>
        </FluidTouchable>

        <FluidTouchable
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'Balances',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.orange + '1A' }]}>
            <Ionicons name="wallet-outline" size={22} color={colors.orange} />
          </View>
          <Text style={[styles.quickActionLabel, { color: colors.primary }]}>Balances</Text>
        </FluidTouchable>
      </View>

      {/* Members */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          Members ({group.members.length})
        </Text>

        {group.members
          .sort((a, b) => {
            // Admins first, then by name
            if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
            return a.user.full_name.localeCompare(b.user.full_name);
          })
          .map((member) => {
            const isSelf = member.user_id === user?.id;

            return (
              <Card key={member.id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <Avatar
                    name={member.user.full_name}
                    color={member.user.color}
                    size="medium"
                    imageUrl={member.user.avatar_url}
                  />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={[styles.memberName, { color: colors.primary }]}>
                        {member.user.full_name}
                        {isSelf ? ' (You)' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.memberEmail, { color: colors.mutedForeground }]}>{member.user.email}</Text>
                  </View>

                  <View style={styles.memberActions}>
                    <Badge
                      label={member.role === 'admin' ? 'Admin' : 'Member'}
                      color={member.role === 'admin' ? colors.blue : colors.mutedForeground}
                    />
                    {isAdmin && !isSelf && (
                      <FluidTouchable
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.red} />
                      </FluidTouchable>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
      </View>

      {/* Admin Settings / Leave Group */}
      <View style={styles.sectionContainer}>
        {isAdmin && (
          <Button
            title="Edit Group Settings"
            onPress={() =>
              navigation.navigate('CreateGroup', { groupId: group.id, editing: true })
            }
            variant="secondary"
            icon="settings-outline"
            size="medium"
          />
        )}

        <View style={{ height: 10 }} />

        <Button
          title="Leave Group"
          onPress={handleLeaveGroup}
          variant="destructive"
          icon="exit-outline"
          size="medium"
        />
      </View>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Header card
  headerCard: {
    margin: 16,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  groupTitleSection: {
    flex: 1,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  groupTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginLeft: 12,
  },
  groupTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Invite
  inviteSection: {
    marginTop: 16,
  },
  inviteLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeBox: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  iconButton: {
    padding: 8,
  },
  // Meta
  metaRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Member card
  memberCard: {
    marginBottom: 8,
    padding: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    padding: 4,
  },
});
