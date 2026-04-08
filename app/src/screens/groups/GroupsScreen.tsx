import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../config/constants';
import { Avatar, Card, EmptyState, LoadingScreen, Button } from '../../components/common';
import { getGroups, joinGroupByCode } from '../../services/groupService';
import { useAuth } from '../../hooks/useAuth';
import type { GroupWithMembers } from '../../types';

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const loadGroups = useCallback(async () => {
    try {
      const data = await getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Reload when navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadGroups();
    });
    return unsubscribe;
  }, [navigation, loadGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  }, [loadGroups]);

  // ----------------------------------------------------------
  // Join group
  // ----------------------------------------------------------

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setJoining(true);
    try {
      await joinGroupByCode(inviteCode.trim());
      setJoinModalVisible(false);
      setInviteCode('');
      await loadGroups();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  // ----------------------------------------------------------
  // Render group card
  // ----------------------------------------------------------

  const renderGroup = ({ item }: { item: GroupWithMembers }) => {
    const memberCount = item.members.length;
    const displayAvatars = item.members.slice(0, 4);
    const extraCount = memberCount - 4;

    return (
      <Card
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupTitleRow}>
            <Text style={styles.groupName}>{item.name}</Text>
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyText}>{item.currency}</Text>
            </View>
          </View>
          {item.description && (
            <Text style={styles.groupDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>

        <View style={styles.groupFooter}>
          {/* Overlapping avatars */}
          <View style={styles.avatarStack}>
            {displayAvatars.map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.avatarWrapper,
                  { marginLeft: index === 0 ? 0 : -10, zIndex: displayAvatars.length - index },
                ]}
              >
                <Avatar
                  name={member.user.full_name}
                  color={member.user.color}
                  size="small"
                  imageUrl={member.user.avatar_url}
                />
              </View>
            ))}
            {extraCount > 0 && (
              <View style={[styles.avatarWrapper, styles.extraBadge, { marginLeft: -10 }]}>
                <Text style={styles.extraText}>+{extraCount}</Text>
              </View>
            )}
          </View>

          <Text style={styles.memberCount}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </Card>
    );
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading && groups.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      <View style={styles.actions}>
        <Button
          title="Create Group"
          onPress={() => navigation.navigate('CreateGroup')}
          icon="add-circle-outline"
          size="small"
        />
        <Button
          title="Join Group"
          onPress={() => setJoinModalVisible(true)}
          variant="secondary"
          icon="enter-outline"
          size="small"
        />
      </View>

      {/* Group list */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        contentContainerStyle={groups.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No groups yet"
            subtitle="Create a group to start splitting expenses and tasks with your housemates."
            actionLabel="Create Group"
            onAction={() => navigation.navigate('CreateGroup')}
          />
        }
      />

      {/* Join Modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setJoinModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Join a Group</Text>
                <Text style={styles.modalSubtitle}>
                  Enter the invite code shared by a group member.
                </Text>

                <TextInput
                  style={styles.codeInput}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="INVITE CODE"
                  placeholderTextColor={COLORS.mutedForeground}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  textAlign="center"
                />

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => {
                      setJoinModalVisible(false);
                      setInviteCode('');
                    }}
                    variant="ghost"
                    size="small"
                  />
                  <Button
                    title="Join"
                    onPress={handleJoin}
                    loading={joining}
                    size="small"
                    icon="enter-outline"
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  // Group card
  groupCard: {
    marginBottom: 12,
  },
  groupHeader: {
    marginBottom: 12,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
  },
  currencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.blue + '14',
    marginLeft: 8,
  },
  currencyText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
  },
  groupDescription: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: COLORS.card,
    borderRadius: 18,
  },
  extraBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  memberCount: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    fontWeight: '500',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeInput: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
