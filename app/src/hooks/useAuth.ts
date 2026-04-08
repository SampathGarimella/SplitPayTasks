import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { User } from '../types';

// ============================================================
// Auth Context Types
// ============================================================

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'full_name' | 'avatar_url' | 'color'>>) => Promise<void>;
  googleEnabled: boolean;
  appleEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================
// Config checks
// ============================================================

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ENABLED = !!(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
const APPLE_ENABLED = Platform.OS === 'ios';

// ============================================================
// Random color for new profiles
// ============================================================

const PROFILE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

function getRandomColor(): string {
  return PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
}

// ============================================================
// Profile helpers
// ============================================================

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching profile:', error.message);
    return null;
  }
  return data as User;
}

async function ensureProfile(
  userId: string,
  email: string,
  fullName?: string,
  avatarUrl?: string | null,
): Promise<User | null> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  // Profile might be auto-created by the DB trigger — wait a moment and retry
  await new Promise((r) => setTimeout(r, 500));
  const retried = await fetchProfile(userId);
  if (retried) return retried;

  // Manual insert as fallback
  const newProfile = {
    id: userId,
    email,
    full_name: fullName || email.split('@')[0],
    avatar_url: avatarUrl ?? null,
    color: getRandomColor(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select()
    .single();

  if (error) {
    // Race condition: profile may have been created concurrently
    const retry = await fetchProfile(userId);
    if (retry) return retry;
    console.error('Failed to create profile:', error.message);
    return null;
  }

  return data as User;
}

// ============================================================
// AuthProvider Component
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: false,
    initialized: false,
  });

  // ----------------------------------------------------------
  // Handle session changes
  // ----------------------------------------------------------

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({
        session: null,
        user: null,
        loading: false,
        initialized: true,
      });
      return;
    }

    try {
      const profile = await ensureProfile(
        session.user.id,
        session.user.email ?? '',
        session.user.user_metadata?.full_name ?? session.user.user_metadata?.name,
        session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture,
      );

      setState({
        session,
        user: profile,
        loading: false,
        initialized: true,
      });
    } catch (err) {
      console.error('Error handling session:', err);
      setState({
        session,
        user: null,
        loading: false,
        initialized: true,
      });
    }
  }, []);

  // ----------------------------------------------------------
  // Initialize: restore session + listen for auth changes
  // ----------------------------------------------------------

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        handleSession(session);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);

  // ----------------------------------------------------------
  // Auth methods
  // ----------------------------------------------------------

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) throw error;
      Alert.alert(
        'Check Your Email',
        'We sent a confirmation link to your email address. Please verify to continue.',
      );
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!GOOGLE_ENABLED) {
      Alert.alert('Not Configured', 'Google Sign-In is not configured yet. Please use email/password.');
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const { makeRedirectUri } = await import('expo-auth-session');
      const { startAsync } = await import('expo-web-browser');

      const redirectUri = makeRedirectUri({ scheme: 'splitpay' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (data?.url) {
        const result = await startAsync({ url: data.url });
        if (result.type === 'success' && result.url) {
          // Extract tokens from URL
          const url = new URL(result.url);
          const accessToken = url.hash
            ? new URLSearchParams(url.hash.substring(1)).get('access_token')
            : url.searchParams.get('access_token');
          const refreshToken = url.hash
            ? new URLSearchParams(url.hash.substring(1)).get('refresh_token')
            : url.searchParams.get('refresh_token');

          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? '',
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      Alert.alert('Sign-In Failed', err.message || 'Google sign-in failed.');
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Apple Sign-In is only available on iOS.');
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const AppleAuth = require('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      Alert.alert('Sign-In Failed', err.message || 'Apple sign-in failed.');
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.session?.user.id) return;
    const profile = await fetchProfile(state.session.user.id);
    if (profile) {
      setState((prev) => ({ ...prev, user: profile }));
    }
  }, [state.session?.user.id]);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<User, 'full_name' | 'avatar_url' | 'color'>>) => {
      if (!state.session?.user.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', state.session.user.id)
        .select()
        .single();

      if (error) throw error;

      setState((prev) => ({ ...prev, user: data as User }));
    },
    [state.session?.user.id],
  );

  // ----------------------------------------------------------
  // Context value
  // ----------------------------------------------------------

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refreshProfile,
      updateProfile,
      googleEnabled: GOOGLE_ENABLED,
      appleEnabled: APPLE_ENABLED,
    }),
    [state, signUp, signIn, signInWithGoogle, signInWithApple, signOut, refreshProfile, updateProfile],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ============================================================
// Hook
// ============================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
