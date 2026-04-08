import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { getColors } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, Card, Badge, EmptyState, FluidTouchable } from '../../components/common';
import { getGroups } from '../../services/groupService';
import { getExpenses } from '../../services/expenseService';
import { getTasks } from '../../services/taskService';
import type {
  Expense,
  Task,
  GroupWithMembers,
  TaskStatus,
} from '../../types';
import type {
  DashboardStackParamList,
  MainTabParamList,
} from '../../navigation/AppNavigator';

// ---------------------------------------------------------------------------
// Navigation typing
// ---------------------------------------------------------------------------

type DashboardNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<MainTabParamList>
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getStatusConfig = (colors: any): Record<TaskStatus, { label: string; color: string }> => ({
  pending: { label: 'Pending', color: colors.orange },
  completed: { label: 'Done', color: colors.green },
  skipped: { label: 'Skipped', color: colors.mutedForeground },
  overdue: { label: 'Overdue', color: colors.red },
});

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNavProp>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const STATUS_CONFIG = getStatusConfig(colors);

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [pendingExpenseCount, setPendingExpenseCount] = useState(0);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Profile avatar animation
  const profileScaleAnim = useRef(new Animated.Value(1)).current;
  const profileOpacityAnim = useRef(new Animated.Value(1)).current;

  const handleProfilePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(profileScaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(profileOpacityAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [profileScaleAnim, profileOpacityAnim]);

  const handleProfilePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(profileScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(profileOpacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [profileScaleAnim, profileOpacityAnim]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const fetchedGroups = await getGroups();
      setGroups(fetchedGroups);

      // Aggregate expenses and tasks from all groups
      const allExpenses: Expense[] = [];
      const allTasks: Task[] = [];

      await Promise.all(
        fetchedGroups.map(async (group) => {
          const [expenses, tasks] = await Promise.all([
            getExpenses(group.id),
            getTasks(group.id),
          ]);
          allExpenses.push(...expenses);
          allTasks.push(...tasks);
        }),
      );

      // Sort expenses by created_at descending and take the 3 most recent
      allExpenses.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRecentExpenses(allExpenses.slice(0, 3));

      // Calculate total balance: sum of amounts where current user is the payer
      // minus sum of split amounts where user owes
      let balance = 0;
      for (const expense of allExpenses) {
        if (expense.paid_by === user?.id) {
          // User paid: they are owed the total minus their own share
          const ownSplit = expense.splits?.find(
            (s) => s.user_id === user?.id && !s.is_settled,
          );
          const othersOwed = (expense.splits ?? [])
            .filter((s) => s.user_id !== user?.id && !s.is_settled)
            .reduce((sum, s) => sum + s.amount, 0);
          balance += othersOwed;
        } else {
          // Someone else paid: user owes their split
          const ownSplit = expense.splits?.find(
            (s) => s.user_id === user?.id && !s.is_settled,
          );
          if (ownSplit) {
            balance -= ownSplit.amount;
          }
        }
      }
      setTotalBalance(Math.round(balance * 100) / 100);

      // Count unsettled expense splits where user owes
      const pendingCount = allExpenses.reduce((count, exp) => {
        const unsettled = (exp.splits ?? []).filter(
          (s) => s.user_id === user?.id && !s.is_settled && exp.paid_by !== user?.id,
        );
        return count + unsettled.length;
      }, 0);
      setPendingExpenseCount(pendingCount);

      // Upcoming tasks: pending/overdue, sorted by due date
      const activeTasks = allTasks.filter(
        (t) => t.status === 'pending' || t.status === 'overdue',
      );
      activeTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setUpcomingTasks(activeTasks.slice(0, 3));
      setActiveTaskCount(activeTasks.length);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoaded(true);
    }
  }, [user?.id]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const navigateToAddExpense = useCallback(() => {
    navigation.getParent()?.navigate('ExpensesTab', {
      screen: 'AddExpense',
    });
  }, [navigation]);

  const navigateToAddTask = useCallback(() => {
    navigation.getParent()?.navigate('TasksTab', {
      screen: 'AddTask',
    });
  }, [navigation]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.blue} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.primary }]}>
            Hello, {user?.full_name?.split(' ')[0] ?? 'there'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Here's your overview</Text>
        </View>
        <TouchableWithoutFeedback
          onPress={() => navigation.navigate('Profile')}
          onPressIn={handleProfilePressIn}
          onPressOut={handleProfilePressOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: profileScaleAnim }],
              opacity: profileOpacityAnim,
            }}
          >
            <Avatar
              name={user?.full_name ?? '?'}
              color={user?.color ?? colors.blue}
              imageUrl={user?.avatar_url}
              size="medium"
            />
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={[styles.statCard, { backgroundColor: colors.blue + '0F' }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.blue + '1A' }]}>
            <Ionicons name="cash-outline" size={20} color={colors.blue} />
          </View>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {formatCurrency(Math.abs(totalBalance))}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            {totalBalance >= 0 ? 'You are owed' : 'You owe'}
          </Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.green + '0F' }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.green + '1A' }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.green} />
          </View>
          <Text style={[styles.statValue, { color: colors.primary }]}>{activeTaskCount}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active Tasks</Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.purple + '0F' }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.purple + '1A' }]}>
            <Ionicons name="people-outline" size={20} color={colors.purple} />
          </View>
          <Text style={[styles.statValue, { color: colors.primary }]}>{groups.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Groups</Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.orange + '0F' }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.orange + '1A' }]}>
            <Ionicons name="receipt-outline" size={20} color={colors.orange} />
          </View>
          <Text style={[styles.statValue, { color: colors.primary }]}>{pendingExpenseCount}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pending</Text>
        </Card>
      </View>

      {/* Recent Expenses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Recent Expenses</Text>
          <FluidTouchable
            onPress={() => navigation.getParent()?.navigate('ExpensesTab')}
          >
            <Text style={[styles.seeAll, { color: colors.blue }]}>See All</Text>
          </FluidTouchable>
        </View>

        {loaded && recentExpenses.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No Expenses Yet"
            subtitle="Add your first shared expense to get started"
          />
        ) : (
          recentExpenses.map((expense) => {
            const linkedGroup = groups.find(g => g.id === expense.group_id);
            return (
              <Card key={expense.id} style={styles.expenseCard}>
                <View style={styles.expenseRow}>
                  <Avatar
                    name={expense.payer?.full_name ?? '?'}
                    color={expense.payer?.color ?? colors.blue}
                    imageUrl={expense.payer?.avatar_url}
                    size="small"
                  />
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseDescription, { color: colors.primary }]} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>
                      {expense.payer?.full_name ?? 'Unknown'} {' \u2022 '}
                      {formatRelativeDate(expense.created_at)}
                      {linkedGroup && ` \u2022 ${linkedGroup.name}`}
                    </Text>
                  </View>
                  <Text style={[styles.expenseAmount, { color: colors.primary }]}>
                    {formatCurrency(expense.amount, expense.currency)}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </View>

      {/* Upcoming Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Upcoming Tasks</Text>
          <FluidTouchable
            onPress={() => navigation.getParent()?.navigate('TasksTab')}
          >
            <Text style={[styles.seeAll, { color: colors.blue }]}>See All</Text>
          </FluidTouchable>
        </View>

        {loaded && upcomingTasks.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="No Upcoming Tasks"
            subtitle="Create tasks to share chores with your group"
          />
        ) : (
          upcomingTasks.map((task) => {
            const statusConfig = STATUS_CONFIG[task.status];
            const linkedGroup = groups.find(g => g.id === task.group_id);
            return (
              <Card key={task.id} style={styles.taskCard}>
                <View style={styles.taskRow}>
                  <Avatar
                    name={task.assignee?.full_name ?? '?'}
                    color={task.assignee?.color ?? colors.purple}
                    imageUrl={task.assignee?.avatar_url}
                    size="small"
                  />
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, { color: colors.primary }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskMeta, { color: colors.mutedForeground }]}>
                      {task.assignee?.full_name ?? 'Unassigned'}
                      {task.due_date
                        ? ` \u2022 Due ${formatDate(task.due_date)}`
                        : ''}
                      {linkedGroup && ` \u2022 ${linkedGroup.name}`}
                    </Text>
                  </View>
                  <Badge label={statusConfig.label} color={statusConfig.color} />
                </View>
              </Card>
            );
          })
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <FluidTouchable
            style={[styles.actionButton, { backgroundColor: colors.blue + '0F' }]}
            onPress={navigateToAddExpense}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.blue + '1A' }]}>
              <Ionicons name="add-circle-outline" size={24} color={colors.blue} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.primary }]}>Add Expense</Text>
          </FluidTouchable>

          <FluidTouchable
            style={[styles.actionButton, { backgroundColor: colors.green + '0F' }]}
            onPress={navigateToAddTask}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.green + '1A' }]}>
              <Ionicons name="clipboard-outline" size={24} color={colors.green} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.primary }]}>Add Task</Text>
          </FluidTouchable>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    padding: 14,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Expense cards
  expenseCard: {
    marginBottom: 10,
    padding: 14,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  expenseMeta: {
    fontSize: 13,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Task cards
  taskCard: {
    marginBottom: 10,
    padding: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  taskMeta: {
    fontSize: 13,
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
