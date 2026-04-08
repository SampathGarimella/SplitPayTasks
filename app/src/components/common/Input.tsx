import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { COLORS } from '../../config/constants';

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
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.errorBorder : null,
          !editable && styles.disabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
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
    color: COLORS.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorBorder: {
    borderColor: COLORS.destructive,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.destructive,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});
