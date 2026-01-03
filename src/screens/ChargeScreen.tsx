import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../context/ThemeContext';
import { fonts } from '../lib/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(80, (SCREEN_WIDTH - 80) / 3); // Responsive button size

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', 'DEL'],
];

// Animated keypad button component
interface KeypadButtonProps {
  keyValue: string;
  onPress: (key: string) => void;
  colors: any;
}

function KeypadButton({ keyValue, onPress, colors }: KeypadButtonProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    // Light haptic for numbers, medium for actions
    if (keyValue === 'C' || keyValue === 'DEL') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(keyValue);
  }, [keyValue, onPress]);

  const isAction = keyValue === 'C' || keyValue === 'DEL';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={({ pressed }) => [
          {
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            borderRadius: BUTTON_SIZE / 2,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: pressed
              ? colors.keypadButtonPressed
              : colors.keypadButton,
          },
        ]}
      >
        {keyValue === 'DEL' ? (
          <Ionicons
            name="backspace-outline"
            size={28}
            color={colors.textSecondary}
          />
        ) : (
          <Text
            style={{
              fontSize: isAction ? 18 : 28,
              fontFamily: isAction ? fonts.medium : fonts.regular,
              color: isAction ? colors.textSecondary : colors.text,
            }}
          >
            {keyValue}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function ChargeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);

  const formatAmount = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const cents = parseInt(digits || '0', 10);
    return (cents / 100).toFixed(2);
  };

  const displayAmount = formatAmount(amount);
  const cents = parseInt(amount || '0', 10);

  const handleKeypadPress = (key: string) => {
    if (key === 'DEL') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (key === 'C') {
      setAmount('');
    } else {
      // Limit to reasonable amount (prevent overflow)
      if (amount.length < 8) {
        setAmount((prev) => prev + key);
      }
    }
  };

  const handleCharge = () => {
    if (cents < 50) {
      Alert.alert('Invalid Amount', 'Minimum charge is $0.50');
      return;
    }

    // Navigate to checkout screen with quick charge params
    // This ensures tip/email screens are shown based on catalog settings
    navigation.navigate('Checkout', {
      total: cents,
      isQuickCharge: true,
      quickChargeDescription: description || `Quick Charge - $${displayAmount}`,
    });

    // Reset form after navigation
    setAmount('');
    setDescription('');
    setShowDescription(false);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quick Charge</Text>
        <Pressable
          style={styles.noteButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowDescription(!showDescription);
          }}
        >
          <Ionicons
            name={showDescription ? 'document-text' : 'document-text-outline'}
            size={22}
            color={showDescription ? colors.primary : colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Description Input (Optional) */}
      {showDescription && (
        <View style={styles.descriptionContainer}>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.inputPlaceholder}
            value={description}
            onChangeText={setDescription}
            maxLength={100}
          />
        </View>
      )}

      {/* Amount Display */}
      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <Text style={styles.amount}>{displayAmount}</Text>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <KeypadButton
                key={key}
                keyValue={key}
                onPress={handleKeypadPress}
                colors={colors}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Charge Button */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.chargeButton,
            cents < 50 && styles.chargeButtonDisabled,
            pressed && cents >= 50 && styles.chargeButtonPressed,
          ]}
          onPress={() => {
            if (cents >= 50) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleCharge();
            }
          }}
          disabled={cents < 50}
        >
          <Ionicons name="flash" size={22} color="#fff" />
          <Text style={styles.chargeButtonText}>
            {cents < 50 ? 'Enter Amount' : `Charge $${displayAmount}`}
          </Text>
        </Pressable>

        <Text style={[styles.minimumHint, { opacity: cents > 0 && cents < 50 ? 1 : 0 }]}>
          Minimum charge is $0.50
        </Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: colors.text,
    },
    noteButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.keypadButton,
      borderRadius: 22,
    },
    descriptionContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    descriptionInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.inputText,
    },
    amountContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 20,
      minHeight: 140,
    },
    currencySymbol: {
      fontSize: 48,
      fontFamily: fonts.bold,
      color: colors.textSecondary,
      marginRight: 4,
    },
    amount: {
      fontSize: 56,
      fontFamily: fonts.bold,
      color: colors.text,
    },
    keypad: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    keypadRow: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      marginBottom: 12,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 8,
    },
    chargeButton: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    chargeButtonDisabled: {
      opacity: 0.4,
    },
    chargeButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    chargeButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
    minimumHint: {
      textAlign: 'center',
      marginTop: 12,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textMuted,
    },
  });
