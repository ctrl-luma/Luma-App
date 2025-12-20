import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { stripeTerminalApi } from '../lib/api';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', 'DEL'],
];

export function ChargeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleCharge = async () => {
    if (cents < 50) {
      Alert.alert('Invalid Amount', 'Minimum charge is $0.50');
      return;
    }

    setLoading(true);
    try {
      // Create payment intent via API
      const paymentIntent = await stripeTerminalApi.createPaymentIntent({
        amount: cents / 100, // API expects dollars
        description: description || `Quick Charge - $${displayAmount}`,
        metadata: {
          type: 'quick_charge',
        },
      });

      // Navigate to payment processing screen
      navigation.navigate('PaymentProcessing', {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: cents,
      });

      // Reset form after navigation
      setAmount('');
      setDescription('');
      setShowDescription(false);
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to initiate payment. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quick Charge</Text>
        <TouchableOpacity
          style={styles.noteButton}
          onPress={() => setShowDescription(!showDescription)}
        >
          <Ionicons
            name={showDescription ? 'document-text' : 'document-text-outline'}
            size={22}
            color={showDescription ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
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
              <TouchableOpacity
                key={key}
                style={styles.keypadButton}
                onPress={() => handleKeypadPress(key)}
                activeOpacity={0.6}
              >
                {key === 'DEL' ? (
                  <Ionicons name="backspace-outline" size={28} color={colors.text} />
                ) : (
                  <Text
                    style={[
                      styles.keypadText,
                      key === 'C' && styles.keypadTextAction,
                    ]}
                  >
                    {key}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* Charge Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.chargeButton,
            (loading || cents < 50) && styles.chargeButtonDisabled,
          ]}
          onPress={handleCharge}
          disabled={loading || cents < 50}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flash" size={22} color="#fff" />
              <Text style={styles.chargeButtonText}>
                {cents < 50 ? 'Enter Amount' : `Charge $${displayAmount}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    noteButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    descriptionContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    descriptionInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.inputText,
    },
    amountContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 20,
    },
    currencySymbol: {
      fontSize: 48,
      fontWeight: '300',
      color: colors.textSecondary,
      marginRight: 4,
    },
    amount: {
      fontSize: 72,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    keypad: {
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    keypadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    keypadButton: {
      flex: 1,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
      marginVertical: 6,
    },
    keypadText: {
      fontSize: 32,
      fontWeight: '500',
      color: colors.text,
    },
    keypadTextAction: {
      color: colors.textSecondary,
      fontWeight: '400',
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 8,
    },
    chargeButton: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: 9999,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    chargeButtonDisabled: {
      opacity: 0.5,
    },
    chargeButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
    },
    minimumHint: {
      textAlign: 'center',
      marginTop: 12,
      fontSize: 14,
      color: colors.textMuted,
    },
  });
