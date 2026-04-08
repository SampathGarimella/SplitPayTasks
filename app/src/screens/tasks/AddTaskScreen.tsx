import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, TASK_CATEGORIES } from '../../config/constants';
import { Avatar, Button, Input } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { createTask } from '../../services/taskService';
import { getGroups } from '../../services/groupService';
import { getExpenses } from '../../services/expenseService';
import type {
  TaskCategory,
  TaskPriority,
  TaskRecurrence,
  GroupWithMembers,
  User,
  Expense,
} from '../../types';

// ============================================================
// Constants
// ============================================================

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: COLORS.green },
  { value: 'medium', label: 'Medium', color: COLORS.orange },
  { value: 'high', label: 'High', color: COLORS.red },
];

const RECURRENCE_OPTIONS: { value: TaskRecurrence; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================
// Main Screen
// ============================================================

export default function AddTaskScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const initialGroupId: string | null = route.params?.groupId ?? null;
  const passedGroups: GroupWithMembers[] | undefined = route.params?.groups;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('misc');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationOrder, setRotationOrder] = useState<string[]>([]);
  const [linkedExpenseId, setLinkedExpenseId] = useState<string | null>(null);
  const [showExpensePicker, setShowExpensePicker] = useState(false);

  // Data state
  const [groups, setGroups] = useState<GroupWithMembers[]>(passedGroups ?? []);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [saving, setSaving] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ----------------------------------------------------------
  // Load groups if not passed
  // ----------------------------------------------------------

  useEffect(() => {
    if (!passedGroups || passedGroups.length === 0) {
      getGroups()
        .then((g) => {
          setGroups(g);
          if (!selectedGroupId && g.length > 0) {
            setSelectedGroupId(g[0].id);
          }
        })
        .catch((err) => Alert.alert('Error', err.message));
    }
  }, [passedGroups, selectedGroupId]);

  // ----------------------------------------------------------
  // Load expenses for selected group
  // ----------------------------------------------------------

  useEffect(() => {
    if (selectedGroupId) {
      getExpenses(selectedGroupId)
        .then(setExpenses)
        .catch(() => setExpenses([]));
    }
  }, [selectedGroupId]);

  // ----------------------------------------------------------
  // Members
  // ----------------------------------------------------------

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  const members = useMemo<User[]>(
    () => (currentGroup?.members ?? []).map((m) => m.user).filter(Boolean) as User[],
    [currentGroup],
  );

  // Initialize rotation order with all members when toggling rotation on
  useEffect(() => {
    if (isRotating && rotationOrder.length === 0 && members.length > 0) {
      setRotationOrder(members.map((m) => m.id));
    }
  }, [isRotating, members, rotationOrder.length]);

  // ----------------------------------------------------------
  // Custom day toggle
  // ----------------------------------------------------------

  const toggleCustomDay = useCallback((dayIndex: number) => {
    setCustomDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b),
    );
  }, []);

  // ----------------------------------------------------------
  // Move rotation member up/down
  // ----------------------------------------------------------

  const moveRotationMember = useCallback((index: number, direction: 'up' | 'down') => {
    setRotationOrder((prev) => {
      const newOrder = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      return newOrder;
    });
  }, []);

  // ----------------------------------------------------------
  // Validation
  // ----------------------------------------------------------

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!selectedGroupId) newErrors.group = 'Please select a group';
    if (recurrence === 'custom' && customDays.length === 0) {
      newErrors.customDays = 'Select at least one day';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, selectedGroupId, recurrence, customDays]);

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      await createTask({
        group_id: selectedGroupId!,
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority,
        assigned_to: assignedTo,
        due_date: dueDate?.toISOString() ?? null,
        recurrence,
        custom_days: recurrence === 'custom' ? customDays : null,
        is_rotating: isRotating,
        rotation_order: isRotating ? rotationOrder : null,
        linked_expense_id: linkedExpenseId,
      });

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    selectedGroupId,
    title,
    description,
    category,
    priority,
    assignedTo,
    dueDate,
    recurrence,
    customDays,
    isRotating,
    rotationOrder,
    linkedExpenseId,
    navigation,
  ]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Task</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {/* Group selector (if multiple) */}
        {groups.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.label}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.pill, g.id === selectedGroupId && styles.pillActive]}
                  onPress={() => setSelectedGroupId(g.id)}
                >
                  <Text style={[styles.pillText, g.id === selectedGroupId && styles.pillTextActive]}>
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.group && <Text style={styles.errorText}>{errors.group}</Text>}
          </View>
        )}

        {/* Title */}
        <Input
          label="Title"
          placeholder="What needs to be done?"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
        />

        {/* Description */}
        <Input
          label="Description (optional)"
          placeholder="Add more details..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {TASK_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.categoryPill,
                  category === c.value && { backgroundColor: c.color + '20', borderColor: c.color },
                ]}
                onPress={() => setCategory(c.value)}
              >
                <Ionicons
                  name={c.icon as any}
                  size={16}
                  color={category === c.value ? c.color : COLORS.mutedForeground}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    category === c.value && { color: c.color },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.pillRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityPill,
                  priority === p.value && { backgroundColor: p.color + '20', borderColor: p.color },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text
                  style={[
                    styles.priorityPillText,
                    priority === p.value && { color: p.color },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Assign to */}
        <View style={styles.section}>
          <Text style={styles.label}>Assign to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assigneeList}>
            <TouchableOpacity
              style={[styles.assigneeChip, !assignedTo && styles.assigneeChipActive]}
              onPress={() => setAssignedTo(null)}
            >
              <Ionicons name="people-outline" size={16} color={!assignedTo ? COLORS.blue : COLORS.mutedForeground} />
              <Text style={[styles.assigneeChipText, !assignedTo && { color: COLORS.blue }]}>Unassigned</Text>
            </TouchableOpacity>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.assigneeChip, assignedTo === m.id && styles.assigneeChipActive]}
                onPress={() => setAssignedTo(m.id)}
              >
                <Avatar name={m.full_name} color={m.color} size="small" imageUrl={m.avatar_url} />
                <Text
                  style={[styles.assigneeChipText, assignedTo === m.id && { color: COLORS.blue }]}
                  numberOfLines={1}
                >
                  {m.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Due date */}
        <View style={styles.section}>
          <Text style={styles.label}>Due Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.mutedForeground} />
            <Text style={[styles.dateButtonText, dueDate && { color: COLORS.primary }]}>
              {dueDate
                ? dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : 'No due date'}
            </Text>
            {dueDate && (
              <TouchableOpacity onPress={() => setDueDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS !== 'ios');
                if (selectedDate) setDueDate(selectedDate);
              }}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.doneDateButton}>
              <Text style={styles.doneDateText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recurrence */}
        <View style={styles.section}>
          <Text style={styles.label}>Recurrence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {RECURRENCE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.pill, recurrence === r.value && styles.pillActive]}
                onPress={() => setRecurrence(r.value)}
              >
                <Text style={[styles.pillText, recurrence === r.value && styles.pillTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom day selector */}
          {recurrence === 'custom' && (
            <View style={styles.customDaysContainer}>
              <Text style={styles.sublabel}>Select days</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayChip,
                      customDays.includes(index) && styles.dayChipActive,
                    ]}
                    onPress={() => toggleCustomDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        customDays.includes(index) && styles.dayChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.customDays && <Text style={styles.errorText}>{errors.customDays}</Text>}
            </View>
          )}
        </View>

        {/* Rotating toggle */}
        {recurrence !== 'none' && members.length > 1 && (
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.label}>Rotating Assignment</Text>
                <Text style={styles.sublabel}>Automatically rotate among members</Text>
              </View>
              <Switch
                value={isRotating}
                onValueChange={setIsRotating}
                trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
                thumbColor={isRotating ? COLORS.blue : '#f4f3f4'}
              />
            </View>

            {/* Rotation order */}
            {isRotating && (
              <View style={styles.rotationContainer}>
                <Text style={styles.sublabel}>Rotation order (drag to reorder)</Text>
                {rotationOrder.map((userId, index) => {
                  const member = members.find((m) => m.id === userId);
                  if (!member) return null;
                  return (
                    <View key={userId} style={styles.rotationItem}>
                      <Text style={styles.rotationIndex}>{index + 1}</Text>
                      <Avatar name={member.full_name} color={member.color} size="small" imageUrl={member.avatar_url} />
                      <Text style={styles.rotationName}>{member.full_name}</Text>
                      <View style={styles.rotationArrows}>
                        <TouchableOpacity
                          onPress={() => moveRotationMember(index, 'up')}
                          disabled={index === 0}
                          style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                        >
                          <Ionicons name="chevron-up" size={18} color={index === 0 ? COLORS.muted : COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => moveRotationMember(index, 'down')}
                          disabled={index === rotationOrder.length - 1}
                          style={[styles.arrowButton, index === rotationOrder.length - 1 && styles.arrowButtonDisabled]}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={18}
                            color={index === rotationOrder.length - 1 ? COLORS.muted : COLORS.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Link to expense */}
        <View style={styles.section}>
          <Text style={styles.label}>Link to Expense (optional)</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowExpensePicker(!showExpensePicker)}
          >
            <Ionicons name="receipt-outline" size={18} color={COLORS.mutedForeground} />
            <Text style={[styles.dateButtonText, linkedExpenseId && { color: COLORS.primary }]}>
              {linkedExpenseId
                ? expenses.find((e) => e.id === linkedExpenseId)?.description ?? 'Selected expense'
                : 'No linked expense'}
            </Text>
            {linkedExpenseId && (
              <TouchableOpacity onPress={() => setLinkedExpenseId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showExpensePicker && expenses.length > 0 && (
            <View style={styles.expenseList}>
              {expenses.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.expenseItem, linkedExpenseId === e.id && styles.expenseItemActive]}
                  onPress={() => {
                    setLinkedExpenseId(e.id);
                    setShowExpensePicker(false);
                  }}
                >
                  <Text style={styles.expenseItemText}>{e.description}</Text>
                  <Text style={styles.expenseItemAmount}>
                    {e.currency} {e.amount.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {showExpensePicker && expenses.length === 0 && (
            <Text style={styles.noExpenses}>No expenses in this group yet</Text>
          )}
        </View>

        {/* Save button */}
        <View style={styles.saveSection}>
          <Button title="Create Task" onPress={handleSave} loading={saving} size="large" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.destructive,
    marginTop: 4,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: COLORS.blue + '14',
    borderColor: COLORS.blue,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  pillTextActive: {
    color: COLORS.blue,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },

  // Priority
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },

  // Assignee
  assigneeList: {
    gap: 8,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  assigneeChipActive: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue + '14',
  },
  assigneeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
    maxWidth: 100,
  },

  // Date picker
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.input,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.mutedForeground,
  },
  doneDateButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.blue,
  },

  // Custom days
  customDaysContainer: {
    marginTop: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayChipActive: {
    backgroundColor: COLORS.blue + '14',
    borderColor: COLORS.blue,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  dayChipTextActive: {
    color: COLORS.blue,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },

  // Rotation
  rotationContainer: {
    marginTop: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 12,
  },
  rotationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rotationIndex: {
    width: 20,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },
  rotationName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  rotationArrows: {
    flexDirection: 'row',
    gap: 4,
  },
  arrowButton: {
    padding: 4,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },

  // Expense picker
  expenseList: {
    marginTop: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  expenseItemActive: {
    backgroundColor: COLORS.blue + '14',
  },
  expenseItemText: {
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
  },
  expenseItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    marginLeft: 8,
  },
  noExpenses: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Save
  saveSection: {
    marginTop: 12,
    paddingBottom: 20,
  },
});
