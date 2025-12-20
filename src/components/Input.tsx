import React, { useRef } from 'react';
import {
  Animated,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/colors';
import { fonts } from '../lib/fonts';

interface InputProps extends Omit<TextInputProps, 'style'> {
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  icon,
  rightIcon,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.gray700, colors.primary],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor },
        containerStyle,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={colors.gray500}
          style={styles.icon}
        />
      )}
      <TextInput
        style={[
          styles.input,
          icon && styles.inputWithIcon,
          rightIcon && styles.inputWithRightIcon,
          inputStyle,
        ]}
        placeholderTextColor={colors.gray500}
        selectionColor={colors.primary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {rightIcon}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 41, 55, 0.5)',
    borderWidth: 2,
    borderColor: colors.gray700,
    borderRadius: 12,
  },
  icon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    outlineStyle: 'none',
  } as any,
  inputWithIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 48,
  },
});
