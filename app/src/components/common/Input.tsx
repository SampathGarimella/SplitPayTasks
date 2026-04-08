import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getColors } from '../../config/constants';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  multiline = false,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  editable = true,
}: InputProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.input, color: colors.primary },
          multiline && styles.multiline,
          error ? { borderColor: colors.destructive } : null,
          !editable && styles.disabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});
