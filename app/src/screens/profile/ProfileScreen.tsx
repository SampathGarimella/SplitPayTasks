import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
  Switch,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useTheme } from '../../hooks/useTheme';
import { getColors, AVATAR_COLORS } from '../../config/constants';
import { Avatar, Button, Input, Card } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

// ============================================================
// Main Screen
// ============================================================

export default function ProfileScreen() {
  const { user, signOut, updateProfile, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const colors = getColors(isDark);

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

  // Avatar fluid touch animations
  const avatarScaleAnim = useRef(new Animated.Value(1)).current;
  const avatarOpacityAnim = useRef(new Animated.Value(1)).current;

  const handleAvatarPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(avatarScaleAnim, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(avatarOpacityAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScaleAnim, avatarOpacityAnim]);

  const handleAvatarPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(avatarScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(avatarOpacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScaleAnim, avatarOpacityAnim]);

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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <TouchableWithoutFeedback
          onPress={handlePickAvatar}
          onPressIn={handleAvatarPressIn}
          onPressOut={handleAvatarPressOut}
        >
          <Animated.View
            style={[
              styles.avatarContainer,
              {
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: avatarScaleAnim }],
                opacity: avatarOpacityAnim,
              },
            ]}
          >
            <Avatar
              name={user.full_name}
              color={selectedColor}
              size="large"
              imageUrl={user.avatar_url}
            />
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.blue, borderColor: colors.background }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>

      {/* Name section */}
      <Card style={styles.card}>
        <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Full Name</Text>
          {editingName ? (
            <View style={styles.editNameRow}>
              <Input
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
              <View style={styles.editNameActions}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setFullName(user.full_name);
                    setEditingName(false);
                  }}
                >
                  <View style={styles.editNameButton}>
                    <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </View>
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback onPress={handleSaveName}>
                  <View style={styles.editNameButton}>
                    <Text style={[styles.saveText, { color: colors.blue }]}>Save</Text>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </View>
          ) : (
            <TouchableWithoutFeedback onPress={() => setEditingName(true)}>
              <View style={styles.editableRow}>
                <Text style={[styles.fieldValue, { color: colors.primary }]}>{user.full_name}</Text>
                <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>

        {/* Email */}
        <View style={[styles.fieldRow, styles.fieldRowLast]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email</Text>
          <View style={styles.editableRow}>
            <Text style={[styles.fieldValue, styles.fieldValueMuted, { color: colors.mutedForeground }]}>{user.email}</Text>
            <Ionicons name="lock-closed-outline" size={14} color={colors.mutedForeground} />
          </View>
        </View>
      </Card>

      {/* Color picker */}
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Avatar Color</Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Choose your display color</Text>
        <View style={styles.colorGrid}>
          {AVATAR_COLORS.map((color) => (
            <TouchableWithoutFeedback
              key={color}
              onPress={() => handleColorSelect(color)}
            >
              <View
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  selectedColor === color && [styles.colorSwatchSelected, { borderColor: colors.primary }],
                ]}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>
      </Card>

      {/* Appearance */}
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Appearance</Text>

        <View style={[styles.toggleItem, styles.toggleItemLast]}>
          <View style={styles.toggleInfo}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? colors.purple : colors.orange} />
            <Text style={[styles.toggleLabel, { color: colors.primary }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.muted, true: colors.blue + '60' }}
            thumbColor={isDark ? colors.blue : '#f4f3f4'}
          />
        </View>
      </Card>

      {/* Notification preferences */}
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Notification Preferences</Text>

        <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="receipt-outline" size={18} color={colors.blue} />
            <Text style={[styles.toggleLabel, { color: colors.primary }]}>Expense added</Text>
          </View>
          <Switch
            value={notifExpenseAdded}
            onValueChange={setNotifExpenseAdded}
            trackColor={{ false: colors.muted, true: colors.blue + '60' }}
            thumbColor={notifExpenseAdded ? colors.blue : '#f4f3f4'}
          />
        </View>

        <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="cash-outline" size={18} color={colors.orange} />
            <Text style={[styles.toggleLabel, { color: colors.primary }]}>Payment reminders</Text>
          </View>
          <Switch
            value={notifPaymentReminders}
            onValueChange={setNotifPaymentReminders}
            trackColor={{ false: colors.muted, true: colors.blue + '60' }}
            thumbColor={notifPaymentReminders ? colors.blue : '#f4f3f4'}
          />
        </View>

        <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="alarm-outline" size={18} color={colors.purple} />
            <Text style={[styles.toggleLabel, { color: colors.primary }]}>Task due soon</Text>
          </View>
          <Switch
            value={notifTaskDueSoon}
            onValueChange={setNotifTaskDueSoon}
            trackColor={{ false: colors.muted, true: colors.blue + '60' }}
            thumbColor={notifTaskDueSoon ? colors.blue : '#f4f3f4'}
          />
        </View>

        <View style={[styles.toggleItem, styles.toggleItemLast]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
            <Text style={[styles.toggleLabel, { color: colors.primary }]}>Task overdue</Text>
          </View>
          <Switch
            value={notifTaskOverdue}
            onValueChange={setNotifTaskOverdue}
            trackColor={{ false: colors.muted, true: colors.blue + '60' }}
            thumbColor={notifTaskOverdue ? colors.blue : '#f4f3f4'}
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
      <Text style={[styles.versionText, { color: colors.mutedForeground }]}>Split Pay & Tasks v{appVersion}</Text>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },

  // Cards
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 14,
  },

  // Fields
  fieldRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  fieldValueMuted: {},
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
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
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
  },

  // Notification toggles
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  },

  // Sign out
  signOutSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },

  // Version
  versionText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
});
