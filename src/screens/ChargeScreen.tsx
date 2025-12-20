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
import { colors } from '../lib/colors';

export function ChargeScreen({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const formatAmount = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    // Convert to dollars (cents to dollars)
    const cents = parseInt(digits || '0', 10);
    return (cents / 100).toFixed(2);
  };

  const handleAmountChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setAmount(digits);
  };

  const displayAmount = formatAmount(amount);

  const handleCharge = async () => {
    const cents = parseInt(amount || '0', 10);
    if (cents < 50) {
      Alert.alert('Invalid Amount', 'Minimum charge is $0.50');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate Stripe Terminal
      // 1. Create PaymentIntent on backend
      // 2. Collect payment with Tap to Pay
      // 3. Confirm payment
      Alert.alert('Coming Soon', 'Tap to Pay integration coming soon!');
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'backspace') {
      setAmount(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setAmount('');
    } else {
      // Limit to reasonable amount (prevent overflow)
      if (amount.length < 8) {
        setAmount(prev => prev + key);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Sale</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <Text style={styles.amount}>{displayAmount}</Text>
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
          <TouchableOpacity
            key={key}
            style={styles.keypadButton}
            onPress={() => handleKeypadPress(key)}
          >
            <Text style={styles.keypadText}>
              {key === 'backspace' ? '⌫' : key === 'clear' ? 'C' : key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.chargeButton, (loading || !amount) && styles.chargeButtonDisabled]}
          onPress={handleCharge}
          disabled={loading || !amount}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.chargeButtonText}>
              Charge ${displayAmount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  cancelText: {
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  amountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.textSecondary,
    marginRight: 8,
  },
  amount: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.text,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  keypadButton: {
    width: '33.33%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadText: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chargeButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  chargeButtonDisabled: {
    opacity: 0.5,
  },
  chargeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
});
