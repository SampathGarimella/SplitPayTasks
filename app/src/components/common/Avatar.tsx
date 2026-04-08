import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

type AvatarSize = 'small' | 'medium' | 'large';

interface AvatarProps {
  name: string;
  color: string;
  size?: AvatarSize;
  imageUrl?: string | null;
}

const SIZE_MAP: Record<AvatarSize, { container: number; font: number }> = {
  small: { container: 32, font: 13 },
  medium: { container: 40, font: 16 },
  large: { container: 56, font: 22 },
};

export default function Avatar({ name, color, size = 'medium', imageUrl }: AvatarProps) {
  const dimensions = SIZE_MAP[size];
  const letter = (name ?? '?').charAt(0).toUpperCase();

  const containerStyle = {
    width: dimensions.container,
    height: dimensions.container,
    borderRadius: dimensions.container / 2,
    backgroundColor: color,
  };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, containerStyle]}
        accessibilityLabel={`${name}'s avatar`}
      />
    );
  }

  return (
    <View style={[styles.container, containerStyle]} accessibilityLabel={`${name}'s avatar`}>
      <Text style={[styles.letter, { fontSize: dimensions.font }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#ffffff',
    fontWeight: '600',
  },
  image: {
    resizeMode: 'cover',
  },
});
