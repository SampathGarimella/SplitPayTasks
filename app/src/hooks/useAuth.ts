import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../config/supabase';
import type { User } from '../types';

WebBrowser.maybeCompleteAuthSession();

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // Profile may not exist yet
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
): Promise<User> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const newProfile: Partial<User> = {
    id: userId,
    email,
    full_name: fullName || email.split('@')[0],
    avatar_url: avatarUrl ?? null,
    color: getRandomColor(),
  };

  const { data, error } = await supabase
    .from('users')
    .insert(newProfile)
    .select()
    .single();

  if (error) {
    // Race condition: profile may have been created concurrently
    const retry = await fetchProfile(userId);
    if (retry) return retry;
    throw new Error(`Failed to create profile: ${error.message}`);
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
    loading: true,
    initialized: false,
  });

  // Google OAuth config
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // ----------------------------------------------------------
  // Handle session changes
  // ----------------------------------------------------------

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        loading: false,
        initialized: true,
      }));
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
      setState((prev) => ({
        ...prev,
        session,
        user: null,
        loading: false,
        initialized: true,
      }));
    }
  }, []);

  // ----------------------------------------------------------
  // Initialize: restore session + listen for auth changes
  // ----------------------------------------------------------

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for changes
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
  // Handle Google OAuth response
  // ----------------------------------------------------------

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      setState((prev) => ({ ...prev, loading: true }));

      supabase.auth
        .signInWithIdToken({ provider: 'google', token: id_token })
        .then(({ error }) => {
          if (error) {
            Alert.alert('Google Sign-In Failed', error.message);
            setState((prev) => ({ ...prev, loading: false }));
          }
          // Session will be handled by onAuthStateChange
        });
    }
  }, [googleResponse]);

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
      // If email confirmation is required, notify user
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
      // Session will be handled by onAuthStateChange
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await googlePromptAsync();
      if (result?.type !== 'success') {
        setState((prev) => ({ ...prev, loading: false }));
      }
      // Success case handled in the googleResponse effect
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, [googlePromptAsync]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Apple Sign-In is only available on iOS.');
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
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
      // Session will be handled by onAuthStateChange
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false }));
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled -- not an error
        return;
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
    // State reset handled by onAuthStateChange
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
        .from('users')
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
