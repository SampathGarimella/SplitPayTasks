import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../config/constants';
import { Avatar, Card, EmptyState, LoadingScreen, Button } from '../../components/common';
import {
  getBalances,
  simplifyDebts,
  createSettlement,
} from '../../services/expenseService';
import { getGroups } from '../../services/groupService';
import { formatCurrency } from '../../utils/splitCalculator';
import { useAuth } from '../../hooks/useAuth';
import type { Balance, DebtSimplification, GroupWithMembers } from '../../types';

export default function BalancesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const passedGroupId: string | undefined = route.params?.groupId;

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(passedGroupId);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [debts, setDebts] = useState<DebtSimplification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // ----------------------------------------------------------
  // Load data
  // ----------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const userGroups = await getGroups();
      setGroups(userGroups);

      const targetGroupId = selectedGroupId ?? userGroups[0]?.id;
      if (targetGroupId) {
        setSelectedGroupId(targetGroupId);
        const [bal, dbt] = await Promise.all([
          getBalances(targetGroupId),
          simplifyDebts(targetGroupId),
        ]);
        setBalances(bal);
        setDebts(dbt);
      }
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleGroupChange = useCallback(async (gId: string) => {
    setSelectedGroupId(gId);
    setLoading(true);
    try {
      const [bal, dbt] = await Promise.all([
        getBalances(gId),
        simplifyDebts(gId),
      ]);
      setBalances(bal);
      setDebts(dbt);
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------
  // Settle up
  // ----------------------------------------------------------

  const handleSettleUp = (debt: DebtSimplification) => {
    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    const currency = selectedGroup?.currency ?? 'USD';

    Alert.alert(
      'Settle Up',
      `Record payment of ${formatCurrency(debt.amount, currency)} from ${debt.from.full_name} to ${debt.to.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const debtKey = `${debt.from.id}-${debt.to.id}`;
            setSettlingId(debtKey);
            try {
              await createSettlement(
                debt.from.id,
                debt.to.id,
                debt.amount,
                selectedGroupId!,
                currency,
              );
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to record settlement');
            } finally {
              setSettlingId(null);
            }
          },
        },
      ],
    );
  };

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const currency = selectedGroup?.currency ?? 'USD';
  const maxAbsBalance = Math.max(...balances.map((b) => Math.abs(b.amount)), 1);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading && balances.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Group selector */}
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
                selectedGroupId === g.id && styles.groupChipActive,
              ]}
              onPress={() => handleGroupChange(g.id)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  selectedGroupId === g.id && styles.groupChipTextActive,
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={[1]} // single item to render both sections
        keyExtractor={() => 'balances'}
        renderItem={() => null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
        }
        ListHeaderComponent={
          <>
            {/* Net Balances Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Net Balances</Text>

              {balances.length === 0 ? (
                <EmptyState
                  icon="wallet-outline"
                  title="No balances"
                  subtitle="Add expenses to see who owes what."
                />
              ) : (
                balances.map((b) => {
                  const isPositive = b.amount > 0;
                  const isZero = Math.abs(b.amount) < 0.01;
                  const barWidth = isZero ? 0 : (Math.abs(b.amount) / maxAbsBalance) * 100;

                  return (
                    <Card key={b.userId} style={styles.balanceCard}>
                      <View style={styles.balanceRow}>
                        <Avatar
                          name={b.userName}
                          color={b.userColor}
                          size="small"
                        />
                        <View style={styles.balanceInfo}>
                          <Text style={styles.balanceName}>
                            {b.userId === user?.id ? 'You' : b.userName}
                          </Text>
                          <Text
                            style={[
                              styles.balanceStatus,
                              isZero && { color: COLORS.mutedForeground },
                              isPositive && { color: COLORS.green },
                              !isPositive && !isZero && { color: COLORS.red },
                            ]}
                          >
                            {isZero
                              ? 'Settled up'
                              : isPositive
                                ? 'is owed'
                                : 'owes'}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.balanceAmount,
                            isZero && { color: COLORS.mutedForeground },
                            isPositive && { color: COLORS.green },
                            !isPositive && !isZero && { color: COLORS.red },
                          ]}
                        >
                          {isZero ? formatCurrency(0, currency) : formatCurrency(Math.abs(b.amount), currency)}
                        </Text>
                      </View>

                      {/* Visual balance bar */}
                      {!isZero && (
                        <View style={styles.barContainer}>
                          <View
                            style={[
                              styles.bar,
                              {
                                width: `${Math.max(barWidth, 4)}%`,
                                backgroundColor: isPositive ? COLORS.green : COLORS.red,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </Card>
                  );
                })
              )}
            </View>

            {/* Simplified Debts Section */}
            {debts.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash-outline" size={18} color={COLORS.blue} />
                  <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>
                    Simplified Debts
                  </Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Minimum transactions needed to settle up
                </Text>

                {debts.map((debt, index) => {
                  const debtKey = `${debt.from.id}-${debt.to.id}`;
                  const isSettling = settlingId === debtKey;

                  return (
                    <Card key={index} style={styles.debtCard}>
                      <View style={styles.debtRow}>
                        <View style={styles.debtUsers}>
                          <Avatar
                            name={debt.from.full_name}
                            color={debt.from.color}
                            size="small"
                            imageUrl={debt.from.avatar_url}
                          />
                          <View style={styles.debtArrow}>
                            <Ionicons name="arrow-forward" size={16} color={COLORS.mutedForeground} />
                          </View>
                          <Avatar
                            name={debt.to.full_name}
                            color={debt.to.color}
                            size="small"
                            imageUrl={debt.to.avatar_url}
                          />
                        </View>

                        <View style={styles.debtInfo}>
                          <Text style={styles.debtText}>
                            <Text style={styles.debtName}>
                              {debt.from.id === user?.id ? 'You' : debt.from.full_name.split(' ')[0]}
                            </Text>
                            {' pays '}
                            <Text style={styles.debtName}>
                              {debt.to.id === user?.id ? 'You' : debt.to.full_name.split(' ')[0]}
                            </Text>
                          </Text>
                          <Text style={styles.debtAmount}>
                            {formatCurrency(debt.amount, currency)}
                          </Text>
                        </View>

                        <Button
                          title="Settle"
                          onPress={() => handleSettleUp(debt)}
                          variant="secondary"
                          size="small"
                          loading={isSettling}
                          icon="checkmark-circle-outline"
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}

            {/* All settled state */}
            {balances.length > 0 && debts.length === 0 && (
              <View style={styles.allSettledContainer}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.green} />
                <Text style={styles.allSettledTitle}>All settled up!</Text>
                <Text style={styles.allSettledSubtitle}>
                  Everyone in this group is square.
                </Text>
              </View>
            )}
          </>
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
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginBottom: 12,
  },
  // Balance cards
  balanceCard: {
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceInfo: {
    flex: 1,
    marginLeft: 10,
  },
  balanceName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  balanceStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  barContainer: {
    height: 4,
    backgroundColor: COLORS.muted,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  // Debt cards
  debtCard: {
    marginBottom: 8,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtUsers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtArrow: {
    marginHorizontal: 6,
  },
  debtInfo: {
    flex: 1,
    marginLeft: 12,
  },
  debtText: {
    fontSize: 13,
    color: COLORS.mutedForeground,
  },
  debtName: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  // All settled
  allSettledContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  allSettledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 12,
  },
  allSettledSubtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
  },
});
