import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, TASK_CATEGORIES } from '../../config/constants';
import { Avatar, Badge, Card, EmptyState, FAB, LoadingScreen } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { getTasks, completeTask, updateTask } from '../../services/taskService';
import { getGroups } from '../../services/groupService';
import type { Task, TaskCategory, GroupWithMembers, User } from '../../types';
import { format, isPast, isToday } from 'date-fns';

// ============================================================
// Helpers
// ============================================================

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: COLORS.red, label: 'High' },
  medium: { color: COLORS.orange, label: 'Medium' },
  low: { color: COLORS.green, label: 'Low' },
};

function getCategoryConfig(category: TaskCategory) {
  return TASK_CATEGORIES.find((c) => c.value === category) ?? TASK_CATEGORIES[6];
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  return format(date, 'MMM d');
}

function isOverdue(task: Task): boolean {
  if (task.status !== 'pending' || !task.due_date) return false;
  return isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

// ============================================================
// Filter bar types
// ============================================================

type FilterCategory = TaskCategory | 'all';
type FilterAssignee = string | 'all';
type FilterStatus = 'all' | 'pending' | 'completed';

// ============================================================
// TaskCard component
// ============================================================

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onPress: (task: Task) => void;
}

function TaskCard({ task, onToggleComplete, onPress }: TaskCardProps) {
  const overdue = isOverdue(task);
  const cat = getCategoryConfig(task.category);
  const priority = PRIORITY_CONFIG[task.priority];
  const isComplete = task.status === 'completed';

  return (
    <Card
      style={[styles.taskCard, overdue && styles.taskCardOverdue]}
      onPress={() => onPress(task)}
    >
      <View style={styles.taskRow}>
        {/* Checkbox */}
        <TouchableOpacity
          onPress={() => onToggleComplete(task)}
          style={[
            styles.checkbox,
            isComplete && styles.checkboxChecked,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isComplete && <Ionicons name="checkmark" size={14} color="#fff" />}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              isComplete && styles.taskTitleComplete,
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>

          <View style={styles.taskMeta}>
            {/* Category badge */}
            <Badge label={cat.label} color={cat.color} />

            {/* Priority dot */}
            <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />

            {/* Recurrence badge */}
            {task.recurrence !== 'none' && (
              <View style={styles.recurrenceBadge}>
                <Ionicons name="repeat" size={11} color={COLORS.blue} />
                <Text style={styles.recurrenceText}>
                  {RECURRENCE_LABELS[task.recurrence] ?? task.recurrence}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.taskBottom}>
            {/* Assignee */}
            {task.assignee && (
              <View style={styles.assigneeRow}>
                <Avatar
                  name={task.assignee.full_name}
                  color={task.assignee.color}
                  size="small"
                  imageUrl={task.assignee.avatar_url}
                />
                <Text style={styles.assigneeName} numberOfLines={1}>
                  {task.assignee.full_name}
                </Text>
              </View>
            )}

            {/* Due date */}
            {task.due_date && (
              <View style={styles.dueDateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={overdue ? COLORS.red : COLORS.mutedForeground}
                />
                <Text
                  style={[
                    styles.dueDateText,
                    overdue && styles.dueDateOverdue,
                  ]}
                >
                  {formatDueDate(task.due_date)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

// ============================================================
// Section Header
// ============================================================

interface SectionHeaderProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

function SectionHeader({ title, count, collapsed, onToggle }: SectionHeaderProps) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCountBadge}>
          <Text style={styles.sectionCount}>{count}</Text>
        </View>
      </View>
      <Ionicons
        name={collapsed ? 'chevron-forward' : 'chevron-down'}
        size={18}
        color={COLORS.mutedForeground}
      />
    </TouchableOpacity>
  );
}

// ============================================================
// Filter pill
// ============================================================

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterPill({ label, active, onPress }: FilterPillProps) {
  return (
    <TouchableOpacity
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Main Screen
// ============================================================

export default function TasksScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterAssignee, setFilterAssignee] = useState<FilterAssignee>('all');
  const showFilters = true; // Always show filters

  // ----------------------------------------------------------
  // Load data
  // ----------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const g = await getGroups();
      setGroups(g);

      const gid = selectedGroupId ?? g[0]?.id ?? null;
      if (gid) {
        setSelectedGroupId(gid);
        const t = await getTasks(gid);
        setTasks(t);
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  // Reload every time the screen comes into focus (e.g. after adding a task)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const loadTasks = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const t = await getTasks(selectedGroupId);
      setTasks(t);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
    }
  }, [selectedGroupId]);

  // Reload when group changes
  useEffect(() => {
    if (selectedGroupId) {
      setLoading(true);
      getTasks(selectedGroupId)
        .then((t) => setTasks(t))
        .catch((err) => console.error('Failed to load tasks:', err))
        .finally(() => setLoading(false));
    }
  }, [selectedGroupId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ----------------------------------------------------------
  // Members list (for filter)
  // ----------------------------------------------------------

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  const members = useMemo<User[]>(
    () => (currentGroup?.members ?? []).map((m) => m.user).filter(Boolean) as User[],
    [currentGroup],
  );

  // ----------------------------------------------------------
  // Filter & split tasks
  // ----------------------------------------------------------

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filterCategory !== 'all') {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (filterAssignee !== 'all') {
      result = result.filter((t) => t.assigned_to === filterAssignee);
    }
    return result;
  }, [tasks, filterCategory, filterAssignee]);

  const pendingTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'pending' || t.status === 'overdue'),
    [filteredTasks],
  );

  const completedTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'completed' || t.status === 'skipped'),
    [filteredTasks],
  );

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      try {
        if (task.status === 'pending' || task.status === 'overdue') {
          await completeTask(task.id);
        } else {
          await updateTask(task.id, { status: 'pending' });
        }
        await loadTasks();
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    },
    [loadTasks],
  );

  const handleTaskPress = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetail', { taskId: task.id, groupId: selectedGroupId });
    },
    [navigation, selectedGroupId],
  );

  const handleAddTask = useCallback(() => {
    navigation.navigate('AddTask', { groupId: selectedGroupId, groups });
  }, [navigation, selectedGroupId, groups]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading && tasks.length === 0) {
    return <LoadingScreen />;
  }

  const hasNoGroup = groups.length === 0;

  return (
    <View style={styles.container}>
      {/* Group selector */}
      {groups.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupSelector}
        >
          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              onPress={() => setSelectedGroupId(g.id)}
              style={[
                styles.groupPill,
                g.id === selectedGroupId && styles.groupPillActive,
              ]}
            >
              <Text
                style={[
                  styles.groupPillText,
                  g.id === selectedGroupId && styles.groupPillTextActive,
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Filter bar */}
      {showFilters && (
        <View style={styles.filterBar}>
          {/* Category filters */}
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.filterRow}>
            <FilterPill
              label="All"
              active={filterCategory === 'all'}
              onPress={() => setFilterCategory('all')}
            />
            {TASK_CATEGORIES.map((c) => (
              <FilterPill
                key={c.value}
                label={c.label}
                active={filterCategory === c.value}
                onPress={() => setFilterCategory(c.value)}
              />
            ))}
          </View>

          {/* Assignee filters */}
          {members.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: 10 }]}>Assignee</Text>
              <View style={styles.filterRow}>
                <FilterPill
                  label="All"
                  active={filterAssignee === 'all'}
                  onPress={() => setFilterAssignee('all')}
                />
                {members.map((m) => (
                  <FilterPill
                    key={m.id}
                    label={m.full_name}
                    active={filterAssignee === m.id}
                    onPress={() => setFilterAssignee(m.id)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Empty states */}
      {hasNoGroup ? (
        <EmptyState
          icon="people-outline"
          title="No Groups Yet"
          subtitle="Create or join a group to start managing tasks together."
        />
      ) : filteredTasks.length === 0 && !loading ? (
        <EmptyState
          icon="checkbox-outline"
          title="No Tasks"
          subtitle="Add your first task to get things organized."
          actionLabel="Add Task"
          onAction={handleAddTask}
        />
      ) : (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
          }
        >
          {/* Pending section */}
          <SectionHeader
            title="Pending"
            count={pendingTasks.length}
            collapsed={false}
            onToggle={() => {}}
          />
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onPress={handleTaskPress}
            />
          ))}
          {pendingTasks.length === 0 && (
            <Text style={styles.sectionEmpty}>All caught up!</Text>
          )}

          {/* Completed section */}
          <SectionHeader
            title="Completed"
            count={completedTasks.length}
            collapsed={completedCollapsed}
            onToggle={() => setCompletedCollapsed(!completedCollapsed)}
          />
          {!completedCollapsed &&
            completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onPress={handleTaskPress}
              />
            ))}
        </ScrollView>
      )}

      {/* FAB */}
      {!hasNoGroup && <FAB onPress={handleAddTask} />}
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

  // Group selector
  groupSelector: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  groupPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
  },
  groupPillActive: {
    backgroundColor: COLORS.blue,
  },
  groupPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  groupPillTextActive: {
    color: '#ffffff',
  },

  // Filter bar
  filterBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
  },
  filterPillActive: {
    backgroundColor: COLORS.blue,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },

  // Scroll content
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionCountBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  sectionEmpty: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Task card
  taskCard: {
    marginBottom: 10,
  },
  taskCardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
  },
  taskTitleComplete: {
    textDecorationLine: 'line-through',
    color: COLORS.mutedForeground,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.blue + '14',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recurrenceText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.blue,
  },
  taskBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  assigneeName: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    flex: 1,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    fontWeight: '500',
  },
  dueDateOverdue: {
    color: COLORS.red,
    fontWeight: '600',
  },
});
