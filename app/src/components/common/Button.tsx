import React, { useRef, useCallback } from 'react';
import {
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { getColors } from '../../config/constants';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: ButtonSize;
}

const SIZE_STYLES: Record<
  ButtonSize,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number; iconSize: number }
> = {
  small: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13, iconSize: 16 },
  medium: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, iconSize: 18 },
  large: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, iconSize: 20 },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'medium',
}: ButtonProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  
  const variantStyles = {
    primary: { bg: colors.primary, text: colors.primaryForeground },
    secondary: { bg: colors.secondary, text: colors.primary },
    destructive: { bg: colors.destructive, text: colors.destructiveForeground },
    ghost: { bg: 'transparent', text: colors.mutedForeground },
  };

  const v = variantStyles[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  // Fluid touch animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <TouchableWithoutFeedback
      onPress={isDisabled ? undefined : onPress}
      onPressIn={isDisabled ? undefined : handlePressIn}
      onPressOut={isDisabled ? undefined : handlePressOut}
    >
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: v.bg,
            paddingVertical: s.paddingVertical,
            paddingHorizontal: s.paddingHorizontal,
            opacity: isDisabled ? 0.5 : opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
          variant === 'ghost' && styles.ghost,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={v.text} />
        ) : (
          <View style={styles.content}>
            {icon && (
              <Ionicons
                name={icon}
                size={s.iconSize}
                color={v.text}
                style={styles.icon}
              />
            )}
            <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }]}>
              {title}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontWeight: '600',
  },
});
