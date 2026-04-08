import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { COLORS, AVATAR_COLORS } from '../../config/constants';
import { Avatar, Button, Input, Card } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

// ============================================================
// Main Screen
// ============================================================

export default function ProfileScreen() {
  const { user, signOut, updateProfile, loading } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [selectedColor, setSelectedColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // Notification preferences (stored locally for now)
  const [notifExpenseAdded, setNotifExpenseAdded] = useState(true);
  const [notifPaymentReminders, setNotifPaymentReminders] = useState(true);
  const [notifTaskDueSoon, setNotifTaskDueSoon] = useState(true);
  const [notifTaskOverdue, setNotifTaskOverdue] = useState(true);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // ----------------------------------------------------------
  // Avatar image picker
  // ----------------------------------------------------------

  const handlePickAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      try {
        setSaving(true);
        await updateProfile({ avatar_url: result.assets[0].uri });
      } catch (err: any) {
        Alert.alert('Error', err.message);
      } finally {
        setSaving(false);
      }
    }
  }, [updateProfile]);

  // ----------------------------------------------------------
  // Save name
  // ----------------------------------------------------------

  const handleSaveName = useCallback(async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    if (trimmed === user?.full_name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: trimmed });
      setEditingName(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }, [fullName, user?.full_name, updateProfile]);

  // ----------------------------------------------------------
  // Save color
  // ----------------------------------------------------------

  const handleColorSelect = useCallback(
    async (color: string) => {
      setSelectedColor(color);
      try {
        await updateProfile({ color });
      } catch (err: any) {
        Alert.alert('Error', err.message);
        setSelectedColor(user?.color ?? AVATAR_COLORS[0]);
      }
    },
    [updateProfile, user?.color],
  );

  // ----------------------------------------------------------
  // Sign out
  // ----------------------------------------------------------

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  }, [signOut]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarContainer}>
          <Avatar
            name={user.full_name}
            color={selectedColor}
            size="large"
            imageUrl={user.avatar_url}
          />
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Name section */}
      <Card style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          {editingName ? (
            <View style={styles.editNameRow}>
              <Input
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
              <View style={styles.editNameActions}>
                <TouchableOpacity
                  onPress={() => {
                    setFullName(user.full_name);
                    setEditingName(false);
                  }}
                  style={styles.editNameButton}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName} style={styles.editNameButton}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editableRow}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.fieldValue}>{user.full_name}</Text>
              <Ionicons name="pencil-outline" size={16} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Email */}
        <View style={[styles.fieldRow, styles.fieldRowLast]}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.editableRow}>
            <Text style={[styles.fieldValue, styles.fieldValueMuted]}>{user.email}</Text>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.mutedForeground} />
          </View>
        </View>
      </Card>

      {/* Color picker */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Avatar Color</Text>
        <Text style={styles.cardSubtitle}>Choose your display color</Text>
        <View style={styles.colorGrid}>
          {AVATAR_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                selectedColor === color && styles.colorSwatchSelected,
              ]}
              onPress={() => handleColorSelect(color)}
            >
              {selectedColor === color && (
                <Ionicons name="checkmark" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Notification preferences */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Notification Preferences</Text>

        <View style={styles.toggleItem}>
          <View style={styles.toggleInfo}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.blue} />
            <Text style={styles.toggleLabel}>Expense added</Text>
          </View>
          <Switch
            value={notifExpenseAdded}
            onValueChange={setNotifExpenseAdded}
            trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
            thumbColor={notifExpenseAdded ? COLORS.blue : '#f4f3f4'}
          />
        </View>

        <View style={styles.toggleItem}>
          <View style={styles.toggleInfo}>
            <Ionicons name="cash-outline" size={18} color={COLORS.orange} />
            <Text style={styles.toggleLabel}>Payment reminders</Text>
          </View>
          <Switch
            value={notifPaymentReminders}
            onValueChange={setNotifPaymentReminders}
            trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
            thumbColor={notifPaymentReminders ? COLORS.blue : '#f4f3f4'}
          />
        </View>

        <View style={styles.toggleItem}>
          <View style={styles.toggleInfo}>
            <Ionicons name="alarm-outline" size={18} color={COLORS.purple} />
            <Text style={styles.toggleLabel}>Task due soon</Text>
          </View>
          <Switch
            value={notifTaskDueSoon}
            onValueChange={setNotifTaskDueSoon}
            trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
            thumbColor={notifTaskDueSoon ? COLORS.blue : '#f4f3f4'}
          />
        </View>

        <View style={[styles.toggleItem, styles.toggleItemLast]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.toggleLabel}>Task overdue</Text>
          </View>
          <Switch
            value={notifTaskOverdue}
            onValueChange={setNotifTaskOverdue}
            trackColor={{ false: COLORS.muted, true: COLORS.blue + '60' }}
            thumbColor={notifTaskOverdue ? COLORS.blue : '#f4f3f4'}
          />
        </View>
      </Card>

      {/* Sign out */}
      <View style={styles.signOutSection}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="destructive"
          icon="log-out-outline"
          size="large"
        />
      </View>

      {/* App version */}
      <Text style={styles.versionText}>Split Pay & Tasks v{appVersion}</Text>
    </ScrollView>
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
  contentContainer: {
    paddingBottom: 100,
  },
  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },

  // Cards
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginBottom: 14,
  },

  // Fields
  fieldRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
    flex: 1,
  },
  fieldValueMuted: {
    color: COLORS.mutedForeground,
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },

  // Edit name
  editNameRow: {
    marginTop: 4,
  },
  editNameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: -8,
  },
  editNameButton: {
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedForeground,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.blue,
  },

  // Color picker
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },

  // Notification toggles
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleItemLast: {
    borderBottomWidth: 0,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // Sign out
  signOutSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },

  // Version
  versionText: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
});
