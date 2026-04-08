import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, TASK_CATEGORIES } from '../../config/constants';
import { Avatar, Badge, Button, Card, LoadingScreen } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import {
  getTasks,
  completeTask,
  skipTask,
  deleteTask,
  getTaskHistory,
} from '../../services/taskService';
import { getExpenses } from '../../services/expenseService';
import type { Task, TaskHistory, Expense } from '../../types';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';

// ============================================================
// Helpers
// ============================================================

const PRIORITY_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  high: { color: COLORS.red, label: 'High', icon: 'arrow-up' },
  medium: { color: COLORS.orange, label: 'Medium', icon: 'remove' },
  low: { color: COLORS.green, label: 'Low', icon: 'arrow-down' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending: { color: COLORS.orange, label: 'Pending', icon: 'time-outline' },
  completed: { color: COLORS.green, label: 'Completed', icon: 'checkmark-circle' },
  skipped: { color: COLORS.mutedForeground, label: 'Skipped', icon: 'play-skip-forward' },
  overdue: { color: COLORS.red, label: 'Overdue', icon: 'alert-circle' },
};

const HISTORY_ICONS: Record<string, { icon: string; color: string }> = {
  created: { icon: 'add-circle', color: COLORS.blue },
  completed: { icon: 'checkmark-circle', color: COLORS.green },
  skipped: { icon: 'play-skip-forward', color: COLORS.orange },
  reassigned: { icon: 'swap-horizontal', color: COLORS.purple },
  edited: { icon: 'pencil', color: COLORS.mutedForeground },
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

function getCategoryConfig(category: string) {
  return TASK_CATEGORIES.find((c) => c.value === category) ?? TASK_CATEGORIES[6];
}

function isOverdue(task: Task): boolean {
  if (task.status !== 'pending' || !task.due_date) return false;
  return isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
}

// ============================================================
// Main Screen
// ============================================================

export default function TaskDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const taskId: string = route.params?.taskId;
  const groupId: string = route.params?.groupId;

  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [linkedExpense, setLinkedExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ----------------------------------------------------------
  // Load data
  // ----------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const [tasks, taskHistory] = await Promise.all([
        getTasks(groupId),
        getTaskHistory(taskId),
      ]);

      const found = tasks.find((t) => t.id === taskId) ?? null;
      setTask(found);
      setHistory(taskHistory);

      if (found?.linked_expense_id) {
        try {
          const expenses = await getExpenses(groupId);
          const exp = expenses.find((e) => e.id === found.linked_expense_id) ?? null;
          setLinkedExpense(exp);
        } catch {
          setLinkedExpense(null);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const handleComplete = useCallback(async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await completeTask(task.id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }, [task, loadData]);

  const handleSkip = useCallback(async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await skipTask(task.id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }, [task, loadData]);

  const handleEdit = useCallback(() => {
    if (!task) return;
    navigation.navigate('AddTask', { groupId, taskId: task.id, editMode: true });
  }, [task, navigation, groupId]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(task.id);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  }, [task, navigation]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading) {
    return <LoadingScreen />;
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Not Found</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>This task may have been deleted.</Text>
        </View>
      </View>
    );
  }

  const overdue = isOverdue(task);
  const cat = getCategoryConfig(task.category);
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];
  const isPending = task.status === 'pending' || task.status === 'overdue';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <TouchableOpacity onPress={handleEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="create-outline" size={22} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
        }
      >
        {/* Title & Status */}
        <View style={styles.titleSection}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '1A' }]}>
              <Ionicons name={statusCfg.icon as any} size={14} color={statusCfg.color} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            {overdue && (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.red + '1A' }]}>
                <Ionicons name="alert-circle" size={14} color={COLORS.red} />
                <Text style={[styles.statusText, { color: COLORS.red }]}>Overdue</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {task.description && (
          <Card style={styles.detailCard}>
            <Text style={styles.cardLabel}>Description</Text>
            <Text style={styles.descriptionText}>{task.description}</Text>
          </Card>
        )}

        {/* Details grid */}
        <Card style={styles.detailCard}>
          {/* Category */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Badge label={cat.label} color={cat.color} />
          </View>

          {/* Priority */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority</Text>
            <View style={styles.priorityBadge}>
              <Ionicons name={priorityCfg.icon as any} size={14} color={priorityCfg.color} />
              <Text style={[styles.priorityText, { color: priorityCfg.color }]}>
                {priorityCfg.label}
              </Text>
            </View>
          </View>

          {/* Due date */}
          {task.due_date && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={[styles.detailValue, overdue && { color: COLORS.red, fontWeight: '600' }]}>
                {format(new Date(task.due_date), 'EEE, MMM d, yyyy')}
              </Text>
            </View>
          )}

          {/* Recurrence */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recurrence</Text>
            <View style={styles.recurrenceBadge}>
              {task.recurrence !== 'none' && (
                <Ionicons name="repeat" size={14} color={COLORS.blue} style={{ marginRight: 4 }} />
              )}
              <Text style={styles.detailValue}>
                {RECURRENCE_LABELS[task.recurrence]}
              </Text>
            </View>
          </View>

          {/* Assignee */}
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Assigned to</Text>
            {task.assignee ? (
              <View style={styles.assigneeDisplay}>
                <Avatar
                  name={task.assignee.full_name}
                  color={task.assignee.color}
                  size="small"
                  imageUrl={task.assignee.avatar_url}
                />
                <Text style={styles.detailValue}>{task.assignee.full_name}</Text>
              </View>
            ) : (
              <Text style={styles.detailValueMuted}>Unassigned</Text>
            )}
          </View>
        </Card>

        {/* Linked expense */}
        {linkedExpense && (
          <Card style={styles.detailCard}>
            <Text style={styles.cardLabel}>Linked Expense</Text>
            <View style={styles.expenseInfoRow}>
              <Ionicons name="receipt-outline" size={18} color={COLORS.blue} />
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseName}>{linkedExpense.description}</Text>
                <Text style={styles.expenseAmount}>
                  {linkedExpense.currency} {linkedExpense.amount.toFixed(2)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Action buttons */}
        {isPending && (
          <View style={styles.actionButtons}>
            <Button
              title="Complete"
              onPress={handleComplete}
              loading={actionLoading}
              icon="checkmark-circle"
              size="large"
            />
            <Button
              title="Skip"
              onPress={handleSkip}
              variant="secondary"
              loading={actionLoading}
              icon="play-skip-forward"
            />
          </View>
        )}

        {/* History timeline */}
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>History</Text>
          {history.length === 0 && (
            <Text style={styles.noHistory}>No history yet</Text>
          )}
          {history.map((entry, index) => {
            const cfg = HISTORY_ICONS[entry.action] ?? { icon: 'ellipse', color: COLORS.mutedForeground };
            const isLast = index === history.length - 1;
            return (
              <View key={entry.id} style={styles.historyItem}>
                {/* Timeline line */}
                <View style={styles.timelineDot}>
                  <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                {/* Content */}
                <View style={styles.historyContent}>
                  <Text style={styles.historyAction}>
                    {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Delete button */}
        <View style={styles.deleteSection}>
          <Button
            title="Delete Task"
            onPress={handleDelete}
            variant="destructive"
            icon="trash-outline"
          />
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.primary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 15,
    color: COLORS.mutedForeground,
  },

  // Title section
  titleSection: {
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Detail card
  detailCard: {
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    color: COLORS.primary,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  detailValueMuted: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    fontStyle: 'italic',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assigneeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Linked expense
  expenseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
  },
  expenseAmount: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },

  // Action buttons
  actionButtons: {
    gap: 10,
    marginBottom: 24,
  },

  // History section
  historySection: {
    marginBottom: 24,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 14,
  },
  noHistory: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    paddingVertical: 12,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineDot: {
    alignItems: 'center',
    width: 24,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
    minHeight: 24,
  },
  historyContent: {
    flex: 1,
    paddingBottom: 16,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  historyTime: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },

  // Delete section
  deleteSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
