import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, EXPENSE_CATEGORIES } from '../../config/constants';
import { Avatar, Badge, Card, EmptyState, FAB, LoadingScreen } from '../../components/common';
import { getExpenses } from '../../services/expenseService';
import { getGroups } from '../../services/groupService';
import { formatCurrency } from '../../utils/splitCalculator';
import { useAuth } from '../../hooks/useAuth';
import type { Expense, ExpenseCategory, GroupWithMembers, ExpenseSplit } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FilterCategory = ExpenseCategory | 'all';

export default function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const groupId: string | undefined = route.params?.groupId;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(groupId);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const userGroups = await getGroups();
      setGroups(userGroups);

      const targetGroupId = selectedGroup ?? userGroups[0]?.id;
      if (targetGroupId) {
        setSelectedGroup(targetGroupId);
        const data = await getExpenses(targetGroupId);
        setExpenses(data);
      } else {
        setExpenses([]);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ----------------------------------------------------------
  // Switch group
  // ----------------------------------------------------------

  const handleGroupChange = useCallback(async (gId: string) => {
    setSelectedGroup(gId);
    setLoading(true);
    try {
      const data = await getExpenses(gId);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses for group:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------
  // Filtering
  // ----------------------------------------------------------

  const filteredExpenses =
    activeFilter === 'all'
      ? expenses
      : expenses.filter((e) => e.category === activeFilter);

  // ----------------------------------------------------------
  // Expand / collapse splits
  // ----------------------------------------------------------

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  const getCategoryMeta = (cat: ExpenseCategory) =>
    EXPENSE_CATEGORIES.find((c) => c.value === cat) ?? EXPENSE_CATEGORIES[7];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ----------------------------------------------------------
  // Render expense card
  // ----------------------------------------------------------

  const renderExpense = ({ item }: { item: Expense }) => {
    const catMeta = getCategoryMeta(item.category);
    const isExpanded = expandedId === item.id;
    const currentGroup = groups.find((g) => g.id === item.group_id);
    const currency = currentGroup?.currency ?? 'USD';

    return (
      <Card style={styles.expenseCard} onPress={() => toggleExpand(item.id)}>
        <View style={styles.expenseRow}>
          {/* Payer avatar */}
          <Avatar
            name={item.payer?.full_name ?? '?'}
            color={item.payer?.color ?? COLORS.blue}
            size="medium"
            imageUrl={item.payer?.avatar_url}
          />

          {/* Description + meta */}
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={styles.expenseMeta}>
              <Text style={styles.payerName}>
                {item.payer?.id === user?.id ? 'You' : item.payer?.full_name ?? 'Someone'} paid
              </Text>
              <Text style={styles.expenseDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>

          {/* Amount + category badge */}
          <View style={styles.expenseRight}>
            <Text style={styles.expenseAmount}>
              {formatCurrency(item.amount, currency)}
            </Text>
            <Badge label={catMeta.label} color={catMeta.color} />
          </View>
        </View>

        {/* Expanded split details */}
        {isExpanded && item.splits && item.splits.length > 0 && (
          <View style={styles.splitsContainer}>
            <View style={styles.splitsDivider} />
            <Text style={styles.splitsTitle}>Split details</Text>
            {item.splits.map((split: ExpenseSplit) => (
              <View key={split.id} style={styles.splitRow}>
                <View style={styles.splitUser}>
                  <Avatar
                    name={split.user?.full_name ?? '?'}
                    color={split.user?.color ?? COLORS.blue}
                    size="small"
                    imageUrl={split.user?.avatar_url}
                  />
                  <Text style={styles.splitUserName}>
                    {split.user_id === user?.id ? 'You' : split.user?.full_name ?? 'Unknown'}
                  </Text>
                </View>
                <View style={styles.splitAmountRow}>
                  <Text style={styles.splitAmount}>
                    {formatCurrency(split.amount, currency)}
                  </Text>
                  {split.is_settled && (
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.green} style={{ marginLeft: 4 }} />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading && expenses.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Group selector (only if multiple groups) */}
      {groups.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupChips}
        >
          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.groupChip,
                selectedGroup === g.id && styles.groupChipActive,
              ]}
              onPress={() => handleGroupChange(g.id)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  selectedGroup === g.id && styles.groupChipTextActive,
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text
            style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {EXPENSE_CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.filterChip,
                isActive && {
                  backgroundColor: cat.color + '14',
                  borderColor: cat.color + '40',
                },
              ]}
              onPress={() =>
                setActiveFilter((prev) => (prev === cat.value ? 'all' : cat.value))
              }
            >
              <Ionicons
                name={cat.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={isActive ? cat.color : COLORS.mutedForeground}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.filterChipText,
                  isActive && { color: cat.color, fontWeight: '600' },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Expense list */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={
          filteredExpenses.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            subtitle="Add your first shared expense to start tracking who owes what."
            actionLabel="Add Expense"
            onAction={() =>
              navigation.navigate('AddExpense', { groupId: selectedGroup })
            }
          />
        }
      />

      {/* FAB */}
      <FAB
        onPress={() =>
          navigation.navigate('AddExpense', { groupId: selectedGroup })
        }
      />
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
  groupChips: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    marginRight: 8,
  },
  groupChipActive: {
    backgroundColor: COLORS.blue,
  },
  groupChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  groupChipTextActive: {
    color: '#ffffff',
  },
  filterChips: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: COLORS.blue + '14',
    borderColor: COLORS.blue + '40',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  filterChipTextActive: {
    color: COLORS.blue,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
  },
  expenseCard: {
    marginBottom: 10,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  expenseDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerName: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  expenseDate: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginLeft: 8,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  splitsContainer: {
    marginTop: 12,
  },
  splitsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  splitsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  splitUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitUserName: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 8,
  },
  splitAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
