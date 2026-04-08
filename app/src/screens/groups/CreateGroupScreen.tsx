import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, CURRENCIES } from '../../config/constants';
import { Button, Input } from '../../components/common';
import { createGroup } from '../../services/groupService';
import type { SplitType } from '../../types';

const SPLIT_TYPES: { value: SplitType; label: string; description: string }[] = [
  { value: 'equal', label: 'Equal', description: 'Split evenly among all members' },
  { value: 'unequal', label: 'Unequal', description: 'Enter custom amounts per person' },
  { value: 'percentage', label: 'Percentage', description: 'Split by percentage' },
  { value: 'shares', label: 'Shares', description: 'Split by share count' },
];

export default function CreateGroupScreen() {
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [defaultSplitType, setDefaultSplitType] = useState<SplitType>('equal');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const group = await createGroup(
        name.trim(),
        description.trim() || null,
        currency,
      );

      // Navigate to group detail or go back
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // Render
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

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.currencyOption,
                  currency === c && styles.currencyOptionActive,
                ]}
                onPress={() => setCurrency(c)}
              >
                <Text
                  style={[
                    styles.currencyOptionText,
                    currency === c && styles.currencyOptionTextActive,
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Default Split Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Split Type</Text>
          <Text style={styles.sectionHint}>
            This will be pre-selected when adding new expenses.
          </Text>

          {SPLIT_TYPES.map((st) => (
            <TouchableOpacity
              key={st.value}
              style={[
                styles.splitOption,
                defaultSplitType === st.value && styles.splitOptionActive,
              ]}
              onPress={() => setDefaultSplitType(st.value)}
            >
              <View style={styles.splitOptionContent}>
                <View
                  style={[
                    styles.radio,
                    defaultSplitType === st.value && styles.radioActive,
                  ]}
                >
                  {defaultSplitType === st.value && <View style={styles.radioDot} />}
                </View>
                <View style={styles.splitOptionText}>
                  <Text
                    style={[
                      styles.splitLabel,
                      defaultSplitType === st.value && styles.splitLabelActive,
                    ]}
                  >
                    {st.label}
                  </Text>
                  <Text style={styles.splitDescription}>{st.description}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Create button */}
        <View style={styles.saveSection}>
          <Button
            title="Create Group"
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.mutedForeground,
    marginBottom: 12,
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
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  currencyOptionActive: {
    backgroundColor: COLORS.blue + '1A',
    borderColor: COLORS.blue,
  },
  currencyOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedForeground,
  },
  currencyOptionTextActive: {
    color: COLORS.blue,
  },
  // Split type
  splitOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  splitOptionActive: {
    backgroundColor: COLORS.blue + '0D',
    borderColor: COLORS.blue,
  },
  splitOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: COLORS.blue,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.blue,
  },
  splitOptionText: {
    flex: 1,
  },
  splitLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  splitLabelActive: {
    color: COLORS.blue,
  },
  splitDescription: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  // Save
  saveSection: {
    marginTop: 8,
  },
});
