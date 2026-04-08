import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, EXPENSE_CATEGORIES } from '../../config/constants';
import { Avatar, Button, Input } from '../../components/common';
import { createExpense } from '../../services/expenseService';
import { getGroups } from '../../services/groupService';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  formatCurrency,
} from '../../utils/splitCalculator';
import { useAuth } from '../../hooks/useAuth';
import type {
  SplitType,
  ExpenseCategory,
  GroupWithMembers,
  GroupMember,
  User,
} from '../../types';

// ============================================================
// Types
// ============================================================

interface MemberSplitState {
  userId: string;
  user: User;
  selected: boolean;
  amount: string;
  percentage: string;
  shares: string;
}

const SPLIT_TYPES: { value: SplitType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'equal', label: 'Equal', icon: 'grid-outline' },
  { value: 'unequal', label: 'Unequal', icon: 'options-outline' },
  { value: 'percentage', label: 'Percentage', icon: 'pie-chart-outline' },
  { value: 'shares', label: 'Shares', icon: 'layers-outline' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// ============================================================
// Component
// ============================================================

export default function AddExpenseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const passedGroupId: string | undefined = route.params?.groupId;

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(passedGroupId);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [paidBy, setPaidBy] = useState<string>(user?.id ?? '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [memberStates, setMemberStates] = useState<MemberSplitState[]>([]);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState('none');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ----------------------------------------------------------
  // Load groups
  // ----------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const data = await getGroups();
        setGroups(data);
        if (!selectedGroupId && data.length === 1) {
          setSelectedGroupId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    })();
  }, [selectedGroupId]);

  // ----------------------------------------------------------
  // Build member states when group changes
  // ----------------------------------------------------------

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  useEffect(() => {
    if (!selectedGroup) return;

    const states: MemberSplitState[] = selectedGroup.members.map((m) => ({
      userId: m.user_id,
      user: m.user,
      selected: true,
      amount: '',
      percentage: '',
      shares: '1',
    }));
    setMemberStates(states);

    if (user && !paidBy) {
      setPaidBy(user.id);
    }
    if (selectedGroup.default_split_type) {
      setSplitType(selectedGroup.default_split_type);
    }
  }, [selectedGroup?.id]);

  // ----------------------------------------------------------
  // Calculated per-person amounts
  // ----------------------------------------------------------

  const parsedAmount = parseFloat(amount) || 0;

  const perPersonAmounts = useMemo(() => {
    const selected = memberStates.filter((m) => m.selected);
    if (selected.length === 0 || parsedAmount <= 0) return {};

    const result: Record<string, number> = {};

    try {
      if (splitType === 'equal') {
        const amounts = calculateEqualSplit(parsedAmount, selected.length);
        selected.forEach((m, i) => {
          result[m.userId] = amounts[i];
        });
      } else if (splitType === 'unequal') {
        selected.forEach((m) => {
          result[m.userId] = parseFloat(m.amount) || 0;
        });
      } else if (splitType === 'percentage') {
        const percentages = selected.map((m) => parseFloat(m.percentage) || 0);
        const totalPct = percentages.reduce((s, p) => s + p, 0);
        if (Math.abs(totalPct - 100) < 0.01) {
          const amounts = calculatePercentageSplit(parsedAmount, percentages);
          selected.forEach((m, i) => {
            result[m.userId] = amounts[i];
          });
        } else {
          // Show preview even if not exactly 100
          selected.forEach((m) => {
            const pct = parseFloat(m.percentage) || 0;
            result[m.userId] = Math.round((parsedAmount * pct) / 100 * 100) / 100;
          });
        }
      } else if (splitType === 'shares') {
        const shares = selected.map((m) => parseFloat(m.shares) || 0);
        const totalShares = shares.reduce((s, v) => s + v, 0);
        if (totalShares > 0) {
          const amounts = calculateSharesSplit(parsedAmount, shares);
          selected.forEach((m, i) => {
            result[m.userId] = amounts[i];
          });
        }
      }
    } catch {
      // Calculation may fail during partial input
    }

    return result;
  }, [memberStates, parsedAmount, splitType]);

  // ----------------------------------------------------------
  // Member state helpers
  // ----------------------------------------------------------

  const updateMember = (userId: string, updates: Partial<MemberSplitState>) => {
    setMemberStates((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, ...updates } : m)),
    );
  };

  const toggleMember = (userId: string) => {
    updateMember(userId, {
      selected: !memberStates.find((m) => m.userId === userId)?.selected,
    });
  };

  const selectAll = () => {
    setMemberStates((prev) => prev.map((m) => ({ ...m, selected: true })));
  };

  const selectedMembers = memberStates.filter((m) => m.selected);

  // ----------------------------------------------------------
  // Validation
  // ----------------------------------------------------------

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedGroupId) {
      newErrors.group = 'Please select a group';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!amount || parsedAmount <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }
    if (!paidBy) {
      newErrors.paidBy = 'Select who paid';
    }
    if (selectedMembers.length === 0) {
      newErrors.split = 'Select at least one person to split with';
    }

    // Validate split totals
    if (splitType === 'unequal' && parsedAmount > 0) {
      const total = selectedMembers.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
      if (Math.abs(total - parsedAmount) > 0.01) {
        newErrors.split = `Amounts must add up to ${formatCurrency(parsedAmount, selectedGroup?.currency)}. Current total: ${formatCurrency(total, selectedGroup?.currency)}`;
      }
    }

    if (splitType === 'percentage') {
      const total = selectedMembers.reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        newErrors.split = `Percentages must add up to 100%. Current total: ${total.toFixed(1)}%`;
      }
    }

    if (splitType === 'shares') {
      const total = selectedMembers.reduce((s, m) => s + (parseFloat(m.shares) || 0), 0);
      if (total <= 0) {
        newErrors.split = 'Total shares must be greater than zero';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const splits = selectedMembers.map((m) => {
        const amt = perPersonAmounts[m.userId] ?? 0;
        return {
          user_id: m.userId,
          amount: amt,
          percentage: splitType === 'percentage' ? parseFloat(m.percentage) || null : null,
          shares: splitType === 'shares' ? parseFloat(m.shares) || null : null,
        };
      });

      await createExpense(
        {
          group_id: selectedGroupId!,
          description: description.trim(),
          amount: parsedAmount,
          currency: selectedGroup?.currency ?? 'USD',
          category,
          paid_by: paidBy,
          split_type: splitType,
          notes: notes.trim() || null,
          is_recurring: isRecurring,
          recurrence_rule: isRecurring && recurrence !== 'none' ? recurrence : null,
        },
        splits,
      );

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------

  const currency = selectedGroup?.currency ?? 'USD';

  const renderGroupSelector = () => {
    if (passedGroupId || groups.length <= 1) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.optionChip,
                selectedGroupId === g.id && styles.optionChipActive,
              ]}
              onPress={() => setSelectedGroupId(g.id)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selectedGroupId === g.id && styles.optionChipTextActive,
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {errors.group && <Text style={styles.errorText}>{errors.group}</Text>}
      </View>
    );
  };

  const renderCategorySelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {EXPENSE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.categoryPill,
              category === cat.value && { backgroundColor: cat.color + '1A', borderColor: cat.color },
            ]}
            onPress={() => setCategory(cat.value as ExpenseCategory)}
          >
            <Ionicons
              name={cat.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={category === cat.value ? cat.color : COLORS.mutedForeground}
            />
            <Text
              style={[
                styles.categoryPillText,
                category === cat.value && { color: cat.color },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPayerSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Who paid?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {memberStates.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={[
              styles.payerOption,
              paidBy === m.userId && styles.payerOptionActive,
            ]}
            onPress={() => setPaidBy(m.userId)}
          >
            <Avatar
              name={m.user.full_name}
              color={m.user.color}
              size="small"
              imageUrl={m.user.avatar_url}
            />
            <Text
              style={[
                styles.payerName,
                paidBy === m.userId && styles.payerNameActive,
              ]}
              numberOfLines={1}
            >
              {m.userId === user?.id ? 'You' : m.user.full_name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {errors.paidBy && <Text style={styles.errorText}>{errors.paidBy}</Text>}
    </View>
  );

  const renderSplitTypeSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Split type</Text>
      <View style={styles.splitTypeRow}>
        {SPLIT_TYPES.map((st) => (
          <TouchableOpacity
            key={st.value}
            style={[
              styles.splitTypeOption,
              splitType === st.value && styles.splitTypeActive,
            ]}
            onPress={() => setSplitType(st.value)}
          >
            <Ionicons
              name={st.icon}
              size={18}
              color={splitType === st.value ? COLORS.blue : COLORS.mutedForeground}
            />
            <Text
              style={[
                styles.splitTypeLabel,
                splitType === st.value && styles.splitTypeLabelActive,
              ]}
            >
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSplitMembers = () => (
    <View style={styles.section}>
      <View style={styles.splitHeaderRow}>
        <Text style={styles.sectionTitle}>Split between</Text>
        {splitType === 'equal' && (
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        )}
      </View>

      {memberStates.map((m) => (
        <View key={m.userId} style={styles.memberRow}>
          {/* Selection checkbox (for equal and other types) */}
          <TouchableOpacity
            style={styles.memberCheckArea}
            onPress={() => toggleMember(m.userId)}
          >
            <View
              style={[
                styles.checkbox,
                m.selected && styles.checkboxChecked,
              ]}
            >
              {m.selected && (
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              )}
            </View>
            <Avatar
              name={m.user.full_name}
              color={m.user.color}
              size="small"
              imageUrl={m.user.avatar_url}
            />
            <Text style={styles.memberName} numberOfLines={1}>
              {m.userId === user?.id ? 'You' : m.user.full_name}
            </Text>
          </TouchableOpacity>

          {/* Per-member input based on split type */}
          <View style={styles.memberInputArea}>
            {splitType === 'equal' && m.selected && parsedAmount > 0 && (
              <Text style={styles.memberCalcAmount}>
                {formatCurrency(perPersonAmounts[m.userId] ?? 0, currency)}
              </Text>
            )}

            {splitType === 'unequal' && m.selected && (
              <View style={styles.memberInput}>
                <Input
                  placeholder="0.00"
                  value={m.amount}
                  onChangeText={(v) => updateMember(m.userId, { amount: v })}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            {splitType === 'percentage' && m.selected && (
              <View style={styles.memberInputRow}>
                <View style={styles.memberInput}>
                  <Input
                    placeholder="0"
                    value={m.percentage}
                    onChangeText={(v) => updateMember(m.userId, { percentage: v })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.memberInputSuffix}>%</Text>
                {parsedAmount > 0 && (
                  <Text style={styles.memberCalcAmountSmall}>
                    = {formatCurrency(perPersonAmounts[m.userId] ?? 0, currency)}
                  </Text>
                )}
              </View>
            )}

            {splitType === 'shares' && m.selected && (
              <View style={styles.memberInputRow}>
                <View style={styles.memberInput}>
                  <Input
                    placeholder="1"
                    value={m.shares}
                    onChangeText={(v) => updateMember(m.userId, { shares: v })}
                    keyboardType="number-pad"
                  />
                </View>
                <Text style={styles.memberInputSuffix}>shares</Text>
                {parsedAmount > 0 && (
                  <Text style={styles.memberCalcAmountSmall}>
                    = {formatCurrency(perPersonAmounts[m.userId] ?? 0, currency)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      ))}

      {/* Total validation feedback */}
      {splitType === 'unequal' && parsedAmount > 0 && (
        <View style={styles.splitTotalRow}>
          <Text style={styles.splitTotalLabel}>Total:</Text>
          <Text
            style={[
              styles.splitTotalValue,
              Math.abs(
                selectedMembers.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) - parsedAmount,
              ) > 0.01 && { color: COLORS.red },
            ]}
          >
            {formatCurrency(
              selectedMembers.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0),
              currency,
            )}{' '}
            / {formatCurrency(parsedAmount, currency)}
          </Text>
        </View>
      )}

      {splitType === 'percentage' && (
        <View style={styles.splitTotalRow}>
          <Text style={styles.splitTotalLabel}>Total:</Text>
          <Text
            style={[
              styles.splitTotalValue,
              Math.abs(
                selectedMembers.reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0) - 100,
              ) > 0.01 && { color: COLORS.red },
            ]}
          >
            {selectedMembers
              .reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0)
              .toFixed(1)}
            % / 100%
          </Text>
        </View>
      )}

      {errors.split && <Text style={styles.errorText}>{errors.split}</Text>}
    </View>
  );

  const renderRecurrence = () => (
    <View style={styles.section}>
      <View style={styles.recurringRow}>
        <View>
          <Text style={styles.sectionTitle}>Recurring expense</Text>
          <Text style={styles.recurringHint}>Automatically repeat this expense</Text>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
          thumbColor={isRecurring ? COLORS.blue : '#f4f3f4'}
        />
      </View>
      {isRecurring && (
        <View style={styles.recurrenceOptions}>
          {RECURRENCE_OPTIONS.filter((o) => o.value !== 'none').map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionChip,
                recurrence === opt.value && styles.optionChipActive,
              ]}
              onPress={() => setRecurrence(opt.value)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  recurrence === opt.value && styles.optionChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // ----------------------------------------------------------
  // Main render
  // ----------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderGroupSelector()}

        {/* Description */}
        <View style={styles.section}>
          <Input
            label="Description"
            placeholder="What was this expense for?"
            value={description}
            onChangeText={setDescription}
            error={errors.description}
          />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Input
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            error={errors.amount}
          />
        </View>

        {renderCategorySelector()}

        {selectedGroup && memberStates.length > 0 && (
          <>
            {renderPayerSelector()}
            {renderSplitTypeSelector()}
            {renderSplitMembers()}
          </>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Input
            label="Notes (optional)"
            placeholder="Add any extra details..."
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {renderRecurrence()}

        {/* Save button */}
        <View style={styles.saveSection}>
          <Button
            title="Save Expense"
            onPress={handleSave}
            loading={saving}
            icon="checkmark-circle-outline"
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
    backgroundColor: COLORS.background,
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
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
    paddingHorizontal: 12,
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
    marginLeft: 6,
  },
  // Payer selector
  payerOption: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    marginRight: 8,
    minWidth: 72,
  },
  payerOptionActive: {
    backgroundColor: COLORS.blue + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.blue,
  },
  payerName: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 6,
    textAlign: 'center',
  },
  payerNameActive: {
    color: COLORS.blue,
    fontWeight: '600',
  },
  // Split type selector
  splitTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  splitTypeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
  },
  splitTypeActive: {
    backgroundColor: COLORS.blue + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.blue,
  },
  splitTypeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  splitTypeLabelActive: {
    color: COLORS.blue,
  },
  // Split members
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    minHeight: 48,
  },
  memberCheckArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginLeft: 8,
    maxWidth: 120,
  },
  memberInputArea: {
    alignItems: 'flex-end',
  },
  memberInput: {
    width: 80,
  },
  memberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInputSuffix: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginLeft: 4,
  },
  memberCalcAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  memberCalcAmountSmall: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginLeft: 6,
  },
  // Split total row
  splitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  splitTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  splitTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.green,
  },
  // Recurring
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurringHint: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  recurrenceOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  // Generic chips
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    marginRight: 8,
  },
  optionChipActive: {
    backgroundColor: COLORS.blue,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  optionChipTextActive: {
    color: '#ffffff',
  },
  // Save
  saveSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  // Error
  errorText: {
    fontSize: 12,
    color: COLORS.destructive,
    marginTop: 6,
  },
});
