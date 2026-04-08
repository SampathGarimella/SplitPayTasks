import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { Input, Button } from '../../components/common';
import type { AuthStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

function getPasswordStrength(pw: string): { label: PasswordStrength; ratio: number; color: string } {
  if (pw.length === 0) return { label: 'weak', ratio: 0, color: COLORS.red };

  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { label: 'weak', ratio: 0.25, color: COLORS.red };
  if (score === 2) return { label: 'fair', ratio: 0.5, color: COLORS.orange };
  if (score === 3) return { label: 'good', ratio: 0.75, color: COLORS.blue };
  return { label: 'strong', ratio: 1, color: COLORS.green };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignUpScreen({ navigation }: Props) {
  const { signUp, signInWithGoogle, signInWithApple, loading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validate = useCallback((): boolean => {
    const next: { fullName?: string; email?: string; password?: string } = {};

    if (!fullName.trim()) {
      next.fullName = 'Full name is required';
    }

    if (!email.trim()) {
      next.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address';
    }

    if (!password) {
      next.password = 'Password is required';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fullName, email, password]);

  // ---------------------------------------------------------------------------
  // Sign up with email
  // ---------------------------------------------------------------------------

  const handleSignUp = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }, [validate, signUp, email, password, fullName]);

  // ---------------------------------------------------------------------------
  // OAuth handlers
  // ---------------------------------------------------------------------------

  const handleGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Google Sign-In Failed', err.message ?? 'Something went wrong.');
    }
  }, [signInWithGoogle]);

  const handleApple = useCallback(async () => {
    try {
      await signInWithApple();
    } catch (err: any) {
      Alert.alert('Apple Sign-In Failed', err.message ?? 'Something went wrong.');
    }
  }, [signInWithApple]);

  // ---------------------------------------------------------------------------
  // Clear field error on change
  // ---------------------------------------------------------------------------

  const clearError = useCallback(
    (field: keyof typeof errors) =>
      setErrors((prev) => ({ ...prev, [field]: undefined })),
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isLoading = submitting || loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet-outline" size={36} color={COLORS.primaryForeground} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Split Pay to manage shared expenses</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              clearError('fullName');
            }}
            error={errors.fullName}
            autoCapitalize="words"
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError('email');
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="Min. 6 characters"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearError('password');
            }}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
          />

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthFill,
                    { width: `${strength.ratio * 100}%`, backgroundColor: strength.color },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label.charAt(0).toUpperCase() + strength.label.slice(1)}
              </Text>
            </View>
          )}

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={isLoading}
            disabled={isLoading}
            size="large"
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth Buttons */}
        <View style={styles.oauthRow}>
          <TouchableOpacity
            style={styles.oauthButton}
            onPress={handleGoogle}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={20} color={COLORS.primary} />
            <Text style={styles.oauthLabel}>Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={handleApple}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-apple" size={20} color={COLORS.primary} />
              <Text style={styles.oauthLabel}>Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },

  // Form
  form: {
    marginBottom: 24,
  },

  // Password strength
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 20,
    gap: 10,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.muted,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 48,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: COLORS.mutedForeground,
  },

  // OAuth
  oauthRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    gap: 8,
  },
  oauthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.blue,
  },
});
