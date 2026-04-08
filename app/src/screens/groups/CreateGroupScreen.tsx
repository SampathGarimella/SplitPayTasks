import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { getColors, CURRENCIES, GROUP_TYPES, GROUP_PERMISSIONS } from '../../config/constants';
import { Button, Input } from '../../components/common';
import { createGroup, updateGroup, getGroup } from '../../services/groupService';
import type { SplitType, GroupType, GroupPermission } from '../../types';

const SPLIT_TYPES: { value: SplitType; label: string; description: string }[] = [
  { value: 'equal', label: 'Equal', description: 'Split evenly among all members' },
  { value: 'unequal', label: 'Unequal', description: 'Enter custom amounts per person' },
  { value: 'percentage', label: 'Percentage', description: 'Split by percentage' },
  { value: 'shares', label: 'Shares', description: 'Split by share count' },
];

const PERMISSION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'anyone', label: 'Anyone can add', description: 'All members can add expenses and tasks' },
  { value: 'owner_only', label: 'Owner only', description: 'Only group owner can add' },
];

export default function CreateGroupScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  
  const editingGroupId = route.params?.groupId;
  const isEditing = route.params?.editing ?? false;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [defaultSplitType, setDefaultSplitType] = useState<SplitType>('equal');
  const [groupType, setGroupType] = useState<string>('home');
  const [customType, setCustomType] = useState('');
  const [expensePermission, setExpensePermission] = useState('anyone');
  const [taskPermission, setTaskPermission] = useState('anyone');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!isEditing);

  // Load existing group data if editing
  React.useEffect(() => {
    if (isEditing && editingGroupId) {
      getGroup(editingGroupId).then((group) => {
        setName(group.name);
        setDescription(group.description ?? '');
        setCurrency(group.currency);
        setDefaultSplitType(group.default_split_type);
        setGroupType(group.group_type ?? 'home');
        setExpensePermission(group.expense_permission ?? 'anyone');
        setTaskPermission(group.task_permission ?? 'anyone');
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [isEditing, editingGroupId]);

  // ----------------------------------------------------------
  // Validation
  // ----------------------------------------------------------

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Group name must be at least 2 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  const handleCreate = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const finalType = groupType === 'custom' && customType.trim() ? customType.trim() : groupType;
      
      if (isEditing && editingGroupId) {
        await updateGroup(editingGroupId, {
          name: name.trim(),
          description: description.trim() || null,
          currency,
          group_type: finalType,
          expense_permission: expensePermission,
          task_permission: taskPermission,
        });
        navigation.goBack();
      } else {
        const group = await createGroup(
          name.trim(),
          description.trim() || null,
          currency,
          'UTC',
          finalType,
          expensePermission,
          taskPermission,
        );
        navigation.replace('GroupDetail', { groupId: group.id });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group Name */}
        <View style={styles.section}>
          <Input
            label="Group Name"
            placeholder="e.g., Apartment 4B, Weekend Trip"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Input
            label="Description (optional)"
            placeholder="What is this group for?"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Group Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Group Type</Text>
          <View style={styles.typeGrid}>
            {GROUP_TYPES.map((t) => (
              <TouchableWithoutFeedback
                key={t.value}
                onPress={() => setGroupType(t.value)}
              >
                <View
                  style={[
                    styles.typeOption,
                    { backgroundColor: colors.secondary },
                    groupType === t.value && { backgroundColor: t.color + '1A', borderColor: t.color },
                  ]}
                >
                  <Ionicons
                    name={t.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={groupType === t.value ? t.color : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.typeOptionText,
                      { color: colors.mutedForeground },
                      groupType === t.value && { color: t.color },
                    ]}
                  >
                    {t.label}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            ))}
          </View>
          {groupType === 'custom' && (
            <View style={{ marginTop: 12 }}>
              <Input
                placeholder="Enter custom type name"
                value={customType}
                onChangeText={setCustomType}
              />
            </View>
          )}
        </View>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Currency</Text>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map((c) => (
              <TouchableWithoutFeedback
                key={c}
                onPress={() => setCurrency(c)}
              >
                <View
                  style={[
                    styles.currencyOption,
                    { backgroundColor: colors.secondary },
                    currency === c && [styles.currencyOptionActive, { backgroundColor: colors.blue + '1A', borderColor: colors.blue }],
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyOptionText,
                      { color: colors.mutedForeground },
                      currency === c && [styles.currencyOptionTextActive, { color: colors.blue }],
                    ]}
                  >
                    {c}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            ))}
          </View>
        </View>

        {/* Default Split Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Default Split Type</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            This will be pre-selected when adding new expenses.
          </Text>

          {SPLIT_TYPES.map((st) => (
            <TouchableWithoutFeedback
              key={st.value}
              onPress={() => setDefaultSplitType(st.value)}
            >
              <View
                style={[
                  styles.splitOption,
                  { backgroundColor: colors.secondary },
                  defaultSplitType === st.value && [styles.splitOptionActive, { backgroundColor: colors.blue + '0D', borderColor: colors.blue }],
                ]}
              >
                <View style={styles.splitOptionContent}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: colors.border },
                      defaultSplitType === st.value && [styles.radioActive, { borderColor: colors.blue }],
                    ]}
                  >
                    {defaultSplitType === st.value && <View style={[styles.radioDot, { backgroundColor: colors.blue }]} />}
                  </View>
                  <View style={styles.splitOptionText}>
                    <Text
                      style={[
                        styles.splitLabel,
                        { color: colors.primary },
                        defaultSplitType === st.value && [styles.splitLabelActive, { color: colors.blue }],
                      ]}
                    >
                      {st.label}
                    </Text>
                    <Text style={[styles.splitDescription, { color: colors.mutedForeground }]}>{st.description}</Text>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>

        {/* Expense Permission */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Expense Permission</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Who can add expenses to this group?
          </Text>

          {PERMISSION_OPTIONS.map((opt) => (
            <TouchableWithoutFeedback
              key={`expense_${opt.value}`}
              onPress={() => setExpensePermission(opt.value)}
            >
              <View
                style={[
                  styles.splitOption,
                  { backgroundColor: colors.secondary },
                  expensePermission === opt.value && [styles.splitOptionActive, { backgroundColor: colors.green + '0D', borderColor: colors.green }],
                ]}
              >
                <View style={styles.splitOptionContent}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: colors.border },
                      expensePermission === opt.value && [styles.radioActive, { borderColor: colors.green }],
                    ]}
                  >
                    {expensePermission === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.green }]} />}
                  </View>
                  <View style={styles.splitOptionText}>
                    <Text
                      style={[
                        styles.splitLabel,
                        { color: colors.primary },
                        expensePermission === opt.value && { color: colors.green },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={[styles.splitDescription, { color: colors.mutedForeground }]}>{opt.description}</Text>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>

        {/* Task Permission */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Task Permission</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Who can add tasks to this group?
          </Text>

          {PERMISSION_OPTIONS.map((opt) => (
            <TouchableWithoutFeedback
              key={`task_${opt.value}`}
              onPress={() => setTaskPermission(opt.value)}
            >
              <View
                style={[
                  styles.splitOption,
                  { backgroundColor: colors.secondary },
                  taskPermission === opt.value && [styles.splitOptionActive, { backgroundColor: colors.purple + '0D', borderColor: colors.purple }],
                ]}
              >
                <View style={styles.splitOptionContent}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: colors.border },
                      taskPermission === opt.value && [styles.radioActive, { borderColor: colors.purple }],
                    ]}
                  >
                    {taskPermission === opt.value && <View style={[styles.radioDot, { backgroundColor: colors.purple }]} />}
                  </View>
                  <View style={styles.splitOptionText}>
                    <Text
                      style={[
                        styles.splitLabel,
                        { color: colors.primary },
                        taskPermission === opt.value && { color: colors.purple },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={[styles.splitDescription, { color: colors.mutedForeground }]}>{opt.description}</Text>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>

        {/* Create button */}
        <View style={styles.saveSection}>
          <Button
            title={isEditing ? "Save Changes" : "Create Group"}
            onPress={handleCreate}
            loading={saving}
            icon="people-outline"
          />
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  // Group Type
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Currency
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyOption: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  currencyOptionActive: {},
  currencyOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyOptionTextActive: {},
  // Split type
  splitOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  splitOptionActive: {},
  splitOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {},
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  splitOptionText: {
    flex: 1,
  },
  splitLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  splitLabelActive: {},
  splitDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  // Save
  saveSection: {
    marginTop: 8,
  },
});
