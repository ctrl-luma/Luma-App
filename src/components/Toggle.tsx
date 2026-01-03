import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const TRACK_WIDTH = 44;
const TRACK_PADDING = 2;
const THUMB_SIZE = 20;
const THUMB_TRAVEL = TRACK_WIDTH - TRACK_PADDING * 2 - THUMB_SIZE;

export function Toggle({ value, onValueChange, disabled = false }: ToggleProps) {
  const { colors, isDark } = useTheme();

  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  }, [value, animatedValue]);

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  // Interpolate thumb position
  const thumbTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TRAVEL],
  });

  // Interpolate track color
  const offColor = isDark ? '#374151' : '#D1D5DB';
  const trackBackgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [offColor, colors.primary],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled}
      style={[styles.touchable, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBackgroundColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: thumbTranslateX }] },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    // Wrapper for touch handling
  },
  track: {
    width: TRACK_WIDTH,
    height: 24,
    borderRadius: 9999,
    justifyContent: 'center',
    paddingHorizontal: TRACK_PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
