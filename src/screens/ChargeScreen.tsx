import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { fonts } from '../lib/fonts';
import { glass } from '../lib/colors';
import { shadows, glow } from '../lib/shadows';
import { PaymentsDisabledBanner } from '../components/PaymentsDisabledBanner';
import { SetupRequired } from '../components/SetupRequired';

// Responsive sizing constants
const MIN_BUTTON_SIZE = 56;
const MAX_BUTTON_SIZE = 110; // Larger for tablets
const MIN_GAP = 10;
const MAX_GAP = 28;

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
  buttonSize: number;
  glassColors: typeof glass.dark;
}

function KeypadButton({ keyValue, onPress, colors, buttonSize, glassColors }: KeypadButtonProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  // Scale font sizes based on button size
  const numberFontSize = Math.round(buttonSize * 0.32);
  const actionFontSize = Math.round(buttonSize * 0.2);
  const iconSize = Math.round(buttonSize * 0.32);
  const borderRadius = Math.round(buttonSize * 0.25);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      tension: 150,
      friction: 10,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
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
            width: buttonSize,
            height: buttonSize,
            borderRadius: borderRadius,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: pressed
              ? glassColors.backgroundElevated
              : glassColors.background,
            borderWidth: 1,
            borderColor: pressed ? glassColors.borderLight : glassColors.border,
            ...shadows.sm,
          },
        ]}
      >
        {keyValue === 'DEL' ? (
          <Ionicons
            name="backspace-outline"
            size={iconSize}
            color={colors.textSecondary}
          />
        ) : (
          <Text
            style={{
              fontSize: isAction ? actionFontSize : numberFontSize,
              fontFamily: isAction ? fonts.medium : fonts.semiBold,
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
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { isPaymentReady, connectLoading } = useAuth();
  const glassColors = isDark ? glass.dark : glass.light;
  const { catalogs, isLoading: catalogsLoading } = useCatalog();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);

  // Calculate responsive sizes based on screen dimensions
  const responsiveSizes = useMemo(() => {
    const minDimension = Math.min(screenWidth, screenHeight);
    const isTablet = minDimension >= 600;
    const isLargePhone = !isTablet && minDimension >= 380;

    // Max button size varies by device type
    const maxSize = isTablet ? MAX_BUTTON_SIZE : isLargePhone ? 76 : 64;
    const maxGap = isTablet ? MAX_GAP : isLargePhone ? 14 : 12;

    // Reserved space for fixed elements
    const headerHeight = 70;
    const footerHeight = 150;
    const amountDisplayHeight = isTablet ? 110 : 80;
    const safeAreaBuffer = isTablet ? 50 : 60;

    // Available height for keypad (4 rows + gaps)
    const availableHeight = screenHeight - headerHeight - footerHeight - amountDisplayHeight - safeAreaBuffer;

    // Available width for 3 buttons + gaps
    const horizontalPadding = isTablet ? 100 : 80;
    const availableWidth = screenWidth - horizontalPadding;

    // Divisors account for 4 buttons + gaps between them
    // On tablets, gaps are larger so we need bigger divisor
    const heightDivisor = isTablet ? 5.2 : 4.8;
    const widthDivisor = isTablet ? 3.6 : 3.5;
    const maxButtonFromHeight = availableHeight / heightDivisor;
    const maxButtonFromWidth = availableWidth / widthDivisor;

    // Use the smaller of the two constraints, then clamp to min/max for device type
    const constrainedSize = Math.min(maxButtonFromHeight, maxButtonFromWidth);
    const buttonSize = Math.max(MIN_BUTTON_SIZE, Math.min(maxSize, constrainedSize));

    // Calculate gap proportionally
    const gapRatio = (buttonSize - MIN_BUTTON_SIZE) / (maxSize - MIN_BUTTON_SIZE);
    const buttonGap = MIN_GAP + (maxGap - MIN_GAP) * Math.max(0, Math.min(1, gapRatio));

    // Amount font sizes scale with button size
    const amountFontSize = Math.round(buttonSize * 0.75);
    const currencyFontSize = Math.round(buttonSize * 0.5);

    return { buttonSize, buttonGap, amountFontSize, currencyFontSize };
  }, [screenWidth, screenHeight]);

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

  const styles = createStyles(colors, glassColors, responsiveSizes);

  // Check if payments are ready
  const paymentsDisabled = !connectLoading && !isPaymentReady;
  const noCatalogs = !catalogsLoading && catalogs.length === 0;

  // Disable charge button if payments not ready, no catalogs, or amount too low
  const chargeDisabled = cents < 50 || paymentsDisabled || noCatalogs;

  // Show setup guidance if no catalogs exist
  if (noCatalogs) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SetupRequired type="no-catalogs" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Payments Disabled Banner */}
      {paymentsDisabled && <PaymentsDisabledBanner compact />}

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

      {/* Centered Content - Amount & Keypad */}
      <View style={styles.mainContent}>
        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.currencySymbol, { fontSize: responsiveSizes.currencyFontSize }]}>$</Text>
          <Text style={[styles.amount, { fontSize: responsiveSizes.amountFontSize }]}>{displayAmount}</Text>
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYPAD_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.keypadRow, { gap: responsiveSizes.buttonGap }]}>
              {row.map((key) => (
                <KeypadButton
                  key={key}
                  keyValue={key}
                  onPress={handleKeypadPress}
                  colors={colors}
                  buttonSize={responsiveSizes.buttonSize}
                  glassColors={glassColors}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Charge Button - Fixed at Bottom */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            if (!chargeDisabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleCharge();
            }
          }}
          disabled={chargeDisabled}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={
                chargeDisabled
                  ? [colors.gray600, colors.gray700]
                  : [colors.primary, colors.primary700]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.chargeButton,
                chargeDisabled && styles.chargeButtonDisabled,
                pressed && !chargeDisabled && styles.chargeButtonPressed,
              ]}
            >
              <Ionicons name="flash" size={22} color="#fff" />
              <Text style={styles.chargeButtonText}>
                {paymentsDisabled
                  ? 'Payments Not Set Up'
                  : cents < 50
                    ? 'Enter Amount'
                    : `Charge $${displayAmount}`}
              </Text>
            </LinearGradient>
          )}
        </Pressable>

        <Text style={[styles.minimumHint, { opacity: cents > 0 && cents < 50 ? 1 : 0 }]}>
          Minimum charge is $0.50
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface ResponsiveSizes {
  buttonSize: number;
  buttonGap: number;
  amountFontSize: number;
  currencyFontSize: number;
}

const createStyles = (colors: any, glassColors: typeof glass.dark, sizes: ResponsiveSizes) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mainContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      paddingHorizontal: 16,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    title: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    noteButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    descriptionContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    descriptionInput: {
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    amountContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: Math.round(sizes.buttonGap * 1.5),
    },
    currencySymbol: {
      fontFamily: fonts.bold,
      color: colors.textMuted,
      marginRight: 2,
      marginTop: 4,
    },
    amount: {
      fontFamily: fonts.bold,
      color: colors.text,
      letterSpacing: -2,
    },
    keypad: {
      paddingHorizontal: 24,
      paddingBottom: sizes.buttonGap,
    },
    keypadRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: sizes.buttonGap,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: 12,
    },
    chargeButton: {
      flexDirection: 'row',
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...shadows.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
    },
    chargeButtonDisabled: {
      opacity: 0.4,
      shadowOpacity: 0,
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
};
