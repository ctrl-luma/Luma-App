import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { glass, gradients } from '../../lib/colors';
import { radius } from '../../lib/spacing';
import { shadows } from '../../lib/shadows';
import { useScaleAnimation } from '../../lib/animations';

export interface GlassCardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle' | 'solid';
  blur?: number;
  style?: ViewStyle;
  onPress?: () => void;
  disabled?: boolean;
  noPadding?: boolean;
  animated?: boolean;
}

export function GlassCard({
  children,
  variant = 'default',
  blur = 20,
  style,
  onPress,
  disabled = false,
  noPadding = false,
  animated = true,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const { scale, onPressIn, onPressOut, style: scaleStyle } = useScaleAnimation();
  const glassColors = isDark ? glass.dark : glass.light;

  // Determine background opacity based on variant
  const getBackgroundStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: glassColors.backgroundElevated,
        };
      case 'subtle':
        return {
          backgroundColor: glassColors.backgroundSubtle,
        };
      case 'solid':
        return {
          backgroundColor: isDark ? '#111827' : '#FFFFFF',
        };
      default:
        return {
          backgroundColor: glassColors.background,
        };
    }
  };

  // Get shadow based on variant
  const getShadow = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return shadows.lg;
      case 'subtle':
        return shadows.sm;
      case 'solid':
        return shadows.md;
      default:
        return shadows.md;
    }
  };

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...getBackgroundStyle(),
    ...getShadow(),
    borderColor: glassColors.border,
    ...(noPadding ? {} : styles.padding),
    ...(style as ViewStyle),
  };

  const content = (
    <View style={containerStyle}>
      {/* Gradient border effect on top edge */}
      <LinearGradient
        colors={isDark ? gradients.glassDark : gradients.glassLight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBorderGradient}
      />
      {children}
    </View>
  );

  // If no onPress, just render the card
  if (!onPress) {
    return content;
  }

  // With onPress, wrap in animated pressable
  return (
    <Animated.View style={animated ? scaleStyle : undefined}>
      <Pressable
        onPress={onPress}
        onPressIn={animated ? onPressIn : undefined}
        onPressOut={animated ? onPressOut : undefined}
        disabled={disabled}
        style={({ pressed }) => [
          pressed && !animated && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

// Variant without blur for better performance in lists
export function GlassCardSimple({
  children,
  variant = 'default',
  style,
  onPress,
  disabled = false,
  noPadding = false,
}: Omit<GlassCardProps, 'blur' | 'animated'>) {
  const { isDark } = useTheme();
  const glassColors = isDark ? glass.dark : glass.light;

  const getBackgroundStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return { backgroundColor: glassColors.backgroundElevated };
      case 'subtle':
        return { backgroundColor: glassColors.backgroundSubtle };
      case 'solid':
        return { backgroundColor: isDark ? '#111827' : '#FFFFFF' };
      default:
        return { backgroundColor: glassColors.background };
    }
  };

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...getBackgroundStyle(),
    ...shadows.sm,
    borderColor: glassColors.border,
    ...(noPadding ? {} : styles.padding),
    ...(style as ViewStyle),
  };

  if (!onPress) {
    return <View style={containerStyle}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  padding: {
    padding: 16,
  },
  topBorderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default GlassCard;
