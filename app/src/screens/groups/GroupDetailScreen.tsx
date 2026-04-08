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
import { COLORS } from '../../config/constants';
import {
  Avatar,
  Badge,
  Card,
  Button,
  LoadingScreen,
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

  const groupId: string = route.params?.groupId;

  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
      }
    >
      {/* Group Info Header */}
      <Card style={styles.headerCard}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}

        {/* Invite Code */}
        <View style={styles.inviteSection}>
          <Text style={styles.inviteLabel}>Invite Code</Text>
          <View style={styles.inviteRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{group.invite_code}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={20} color={COLORS.blue} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={20} color={COLORS.blue} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity style={styles.iconButton} onPress={handleRegenerateCode}>
                <Ionicons name="refresh-outline" size={20} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Group meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={COLORS.mutedForeground} />
            <Text style={styles.metaText}>{group.currency}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="git-branch-outline" size={16} color={COLORS.mutedForeground} />
            <Text style={styles.metaText}>{group.default_split_type}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={COLORS.mutedForeground} />
            <Text style={styles.metaText}>{group.members.length} members</Text>
          </View>
        </View>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'AddExpense',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.blue + '1A' }]}>
            <Ionicons name="receipt-outline" size={22} color={COLORS.blue} />
          </View>
          <Text style={styles.quickActionLabel}>Add Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('TasksTab', {
              screen: 'AddTask',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.green + '1A' }]}>
            <Ionicons name="checkbox-outline" size={22} color={COLORS.green} />
          </View>
          <Text style={styles.quickActionLabel}>Add Task</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'Expenses',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.purple + '1A' }]}>
            <Ionicons name="list-outline" size={22} color={COLORS.purple} />
          </View>
          <Text style={styles.quickActionLabel}>Expenses</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            navigation.getParent()?.navigate('ExpensesTab', {
              screen: 'Balances',
              params: { groupId: group.id },
            })
          }
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.orange + '1A' }]}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.orange} />
          </View>
          <Text style={styles.quickActionLabel}>Balances</Text>
        </TouchableOpacity>
      </View>

      {/* Members */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>
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
                      <Text style={styles.memberName}>
                        {member.user.full_name}
                        {isSelf ? ' (You)' : ''}
                      </Text>
                    </View>
                    <Text style={styles.memberEmail}>{member.user.email}</Text>
                  </View>

                  <View style={styles.memberActions}>
                    <Badge
                      label={member.role === 'admin' ? 'Admin' : 'Member'}
                      color={member.role === 'admin' ? COLORS.blue : COLORS.mutedForeground}
                    />
                    {isAdmin && !isSelf && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={COLORS.red} />
                      </TouchableOpacity>
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
            title="Edit Group"
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Header card
  headerCard: {
    margin: 16,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  groupDescription: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
  },
  // Invite
  inviteSection: {
    marginTop: 16,
  },
  inviteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeBox: {
    backgroundColor: COLORS.input,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
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
    color: COLORS.mutedForeground,
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
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },
  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  // Members
  memberCard: {
    marginBottom: 8,
    paddingVertical: 12,
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
    color: COLORS.primary,
  },
  memberEmail: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 1,
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
