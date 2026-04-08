import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/constants';
import { EmptyState, LoadingScreen } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from '../../services/notificationService';
import type { AppNotification, NotificationType } from '../../types';
import { formatDistanceToNow } from 'date-fns';

// ============================================================
// Helpers
// ============================================================

const NOTIFICATION_ICONS: Record<NotificationType, { icon: string; color: string }> = {
  expense_added: { icon: 'receipt', color: COLORS.blue },
  payment_reminder: { icon: 'cash-outline', color: COLORS.orange },
  task_due: { icon: 'alarm-outline', color: COLORS.purple },
  task_overdue: { icon: 'alert-circle', color: COLORS.red },
  task_completed: { icon: 'checkmark-circle', color: COLORS.green },
  group_invite: { icon: 'people', color: COLORS.teal },
  settlement: { icon: 'swap-horizontal', color: COLORS.indigo },
};

// ============================================================
// Notification Item
// ============================================================

interface NotificationItemProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}

function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const config = NOTIFICATION_ICONS[notification.type] ?? { icon: 'notifications', color: COLORS.blue };
  const isUnread = !notification.read;

  return (
    <TouchableOpacity
      style={[styles.notificationItem, isUnread && styles.notificationItemUnread]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.notificationIcon, { backgroundColor: config.color + '14' }]}>
        <Ionicons name={config.icon as any} size={20} color={config.color} />
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}>
          {notification.title}
        </Text>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.notificationTime}>
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </Text>
      </View>

      {/* Unread indicator */}
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ============================================================
// Section Header
// ============================================================

interface SectionHeaderProps {
  title: string;
  count: number;
}

function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );
}

// ============================================================
// Main Screen
// ============================================================

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------------
  // Load notifications
  // ----------------------------------------------------------

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  // ----------------------------------------------------------
  // Split notifications
  // ----------------------------------------------------------

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications],
  );

  const readNotifications = useMemo(
    () => notifications.filter((n) => n.read),
    [notifications],
  );

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const handleNotificationPress = useCallback(
    async (notification: AppNotification) => {
      if (!notification.read) {
        try {
          await markAsRead(notification.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
          );
        } catch (err: any) {
          console.error('Failed to mark as read:', err.message);
        }
      }
    },
    [],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Read Notifications',
      'This will remove all read notifications. Unread notifications will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearNotifications();
              setNotifications((prev) => prev.filter((n) => !n.read));
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  }, []);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading) {
    return <LoadingScreen />;
  }

  const hasUnread = unreadNotifications.length > 0;
  const hasRead = readNotifications.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {hasUnread && (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerButton}>
              <Ionicons name="checkmark-done" size={20} color={COLORS.blue} />
            </TouchableOpacity>
          )}
          {hasRead && (
            <TouchableOpacity onPress={handleClearAll} style={styles.headerButton}>
              <Ionicons name="trash-outline" size={20} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="No Notifications"
          subtitle="You're all caught up! New notifications will appear here."
        />
      ) : (
        <FlatList
          data={[
            ...(hasUnread ? [{ type: 'header', key: 'unread-header', title: 'Unread', count: unreadNotifications.length } as const] : []),
            ...unreadNotifications.map((n) => ({ type: 'notification' as const, key: n.id, notification: n })),
            ...(hasRead ? [{ type: 'header', key: 'read-header', title: 'Earlier', count: readNotifications.length } as const] : []),
            ...readNotifications.map((n) => ({ type: 'notification' as const, key: n.id, notification: n })),
          ]}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <SectionHeader title={item.title} count={item.count} />;
            }
            return (
              <NotificationItem
                notification={item.notification}
                onPress={handleNotificationPress}
              />
            );
          }}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    paddingBottom: 100,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Notification item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notificationItemUnread: {
    backgroundColor: COLORS.blue + '08',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginBottom: 2,
  },
  notificationTitleUnread: {
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue,
    marginTop: 6,
  },
});
