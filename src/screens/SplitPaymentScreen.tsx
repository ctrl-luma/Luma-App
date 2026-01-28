import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { ordersApi, OrderPayment, stripeTerminalApi } from '../lib/api';
import { glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';
import Constants from 'expo-constants';

// Conditionally import Stripe Terminal - not available in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
type PaymentIntent = any;

let useStripeTerminal: any;
if (!isExpoGo) {
  try {
    const terminal = require('@stripe/stripe-terminal-react-native');
    useStripeTerminal = terminal.useStripeTerminal;
  } catch {
    useStripeTerminal = () => ({
      collectPaymentMethod: async () => ({ paymentIntent: null }),
      confirmPaymentIntent: async () => ({ paymentIntent: null }),
      retrievePaymentIntent: async () => ({ paymentIntent: null }),
    });
  }
} else {
  useStripeTerminal = () => ({
    collectPaymentMethod: async () => ({ paymentIntent: null }),
    confirmPaymentIntent: async () => ({ paymentIntent: null }),
    retrievePaymentIntent: async () => ({ paymentIntent: null }),
  });
}

type RouteParams = {
  SplitPayment: {
    orderId: string;
    orderNumber: string;
    totalAmount: number; // in cents
    customerEmail?: string;
  };
};

type PaymentMethod = 'card' | 'cash' | 'tap_to_pay';

export function SplitPaymentScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'SplitPayment'>>();
  const { clearCart } = useCart();
  const glassColors = isDark ? glass.dark : glass.light;
  const { collectPaymentMethod, confirmPaymentIntent, retrievePaymentIntent } = useStripeTerminal();

  const { orderId, orderNumber, totalAmount, customerEmail } = route.params;

  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(totalAmount);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add payment modal state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('tap_to_pay');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashTendered, setCashTendered] = useState('');

  const styles = createStyles(colors, glassColors, isDark);

  // Fetch existing payments
  const fetchPayments = useCallback(async () => {
    try {
      const response = await ordersApi.getPayments(orderId);
      setPayments(response.payments);
      setTotalPaid(response.totalPaid);
      setRemainingBalance(response.remainingBalance);

      // Check if order is complete
      if (response.remainingBalance <= 0) {
        handleOrderComplete();
      }
    } catch (error: any) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleOrderComplete = () => {
    clearCart();
    navigation.replace('PaymentResult', {
      success: true,
      amount: totalAmount,
      paymentIntentId: null,
      orderId,
      orderNumber,
      customerEmail,
      paymentMethod: 'split',
    });
  };

  // Process card/tap to pay payment
  const processCardPayment = async (amount: number) => {
    setIsProcessing(true);
    try {
      // Create a payment intent for this partial amount
      const { clientSecret, paymentIntentId } = await stripeTerminalApi.createPaymentIntent({
        amount,
        orderId,
        isQuickCharge: false,
      });

      // Retrieve the payment intent
      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(clientSecret);
      if (retrieveError || !paymentIntent) {
        throw new Error(retrieveError?.message || 'Failed to retrieve payment intent');
      }

      // Collect payment method
      const { paymentIntent: collectedIntent, error: collectError } = await collectPaymentMethod({
        paymentIntent,
      });
      if (collectError || !collectedIntent) {
        throw new Error(collectError?.message || 'Failed to collect payment method');
      }

      // Confirm the payment
      const { paymentIntent: confirmedIntent, error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collectedIntent,
      });
      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      // Add payment to order
      await ordersApi.addPayment(orderId, {
        paymentMethod: selectedMethod,
        amount,
        stripePaymentIntentId: paymentIntentId,
      });

      // Refresh payments
      await fetchPayments();
      setShowAddPayment(false);
      resetPaymentForm();
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message || 'Failed to process card payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process cash payment
  const processCashPayment = async (amount: number, tendered: number) => {
    setIsProcessing(true);
    try {
      await ordersApi.addPayment(orderId, {
        paymentMethod: 'cash',
        amount,
        cashTendered: tendered,
      });

      // Show change if any
      const change = tendered - amount;
      if (change > 0) {
        Alert.alert('Change Due', `Give customer $${(change / 100).toFixed(2)} in change`);
      }

      // Refresh payments
      await fetchPayments();
      setShowAddPayment(false);
      resetPaymentForm();
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message || 'Failed to process cash payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setCashTendered('');
    setSelectedMethod('tap_to_pay');
  };

  const handleAddPayment = async () => {
    const amountCents = Math.round(parseFloat(paymentAmount || '0') * 100);

    if (amountCents <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    if (amountCents > remainingBalance) {
      Alert.alert('Amount Too High', `Maximum payment is $${(remainingBalance / 100).toFixed(2)}`);
      return;
    }

    if (selectedMethod === 'cash') {
      const tenderedCents = Math.round(parseFloat(cashTendered || '0') * 100);
      if (tenderedCents < amountCents) {
        Alert.alert('Insufficient Cash', 'Cash tendered must be at least the payment amount');
        return;
      }
      await processCashPayment(amountCents, tenderedCents);
    } else {
      await processCardPayment(amountCents);
    }
  };

  const handlePayRemaining = () => {
    setPaymentAmount((remainingBalance / 100).toFixed(2));
  };

  const getPaymentMethodIcon = (method: PaymentMethod): string => {
    switch (method) {
      case 'cash':
        return 'cash-outline';
      case 'card':
        return 'card-outline';
      case 'tap_to_pay':
        return 'phone-portrait-outline';
      default:
        return 'card-outline';
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'tap_to_pay':
        return 'Tap to Pay';
      default:
        return 'Card';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Split Payment</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.summaryValue}>${(totalAmount / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Paid</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                ${(totalPaid / 100).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>Remaining</Text>
              <Text style={styles.remainingValue}>${(remainingBalance / 100).toFixed(2)}</Text>
            </View>
          </View>

          {/* Existing Payments */}
          {payments.length > 0 && (
            <View style={styles.paymentsSection}>
              <Text style={styles.sectionTitle}>Payments</Text>
              {payments.map((payment, index) => (
                <View key={payment.id || index} style={styles.paymentRow}>
                  <View style={styles.paymentLeft}>
                    <Ionicons
                      name={getPaymentMethodIcon(payment.paymentMethod)}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.paymentMethod}>
                      {getPaymentMethodLabel(payment.paymentMethod)}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    ${(payment.amount / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Add Payment Section */}
          {remainingBalance > 0 && (
            <View style={styles.addPaymentSection}>
              {!showAddPayment ? (
                <TouchableOpacity
                  style={styles.addPaymentButton}
                  onPress={() => setShowAddPayment(true)}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  <Text style={styles.addPaymentButtonText}>Add Payment</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.paymentForm}>
                  <Text style={styles.formTitle}>Add Payment</Text>

                  {/* Payment Method Selection */}
                  <View style={styles.methodSelection}>
                    {(['tap_to_pay', 'card', 'cash'] as PaymentMethod[]).map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.methodButton,
                          selectedMethod === method && styles.methodButtonSelected,
                        ]}
                        onPress={() => setSelectedMethod(method)}
                      >
                        <Ionicons
                          name={getPaymentMethodIcon(method)}
                          size={20}
                          color={selectedMethod === method ? '#fff' : colors.text}
                        />
                        <Text
                          style={[
                            styles.methodButtonText,
                            selectedMethod === method && styles.methodButtonTextSelected,
                          ]}
                        >
                          {getPaymentMethodLabel(method)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Amount</Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity
                        style={styles.remainingButton}
                        onPress={handlePayRemaining}
                      >
                        <Text style={styles.remainingButtonText}>Remaining</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Cash Tendered (for cash payments) */}
                  {selectedMethod === 'cash' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Cash Tendered</Text>
                      <View style={styles.amountInputContainer}>
                        <Text style={styles.dollarSign}>$</Text>
                        <TextInput
                          style={styles.amountInput}
                          value={cashTendered}
                          onChangeText={setCashTendered}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                      {/* Change calculation */}
                      {cashTendered && paymentAmount && (
                        <View style={styles.changeDisplay}>
                          <Text style={styles.changeLabel}>Change Due:</Text>
                          <Text style={styles.changeAmount}>
                            ${Math.max(0, (parseFloat(cashTendered) - parseFloat(paymentAmount))).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Form Actions */}
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={styles.cancelFormButton}
                      onPress={() => {
                        setShowAddPayment(false);
                        resetPaymentForm();
                      }}
                    >
                      <Text style={styles.cancelFormButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.processButton,
                        isProcessing && styles.processButtonDisabled,
                      ]}
                      onPress={handleAddPayment}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.processButtonText}>Process</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer - Complete if balance is 0 */}
        {remainingBalance <= 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleOrderComplete}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>Payment Complete</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    backButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    summaryCard: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: 20,
      ...shadows.md,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    remainingRow: {
      marginBottom: 0,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: glassColors.borderSubtle,
    },
    remainingLabel: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    remainingValue: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: colors.primary,
    },
    paymentsSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 12,
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: 8,
    },
    paymentLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    paymentMethod: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    paymentAmount: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.success,
    },
    addPaymentSection: {
      marginTop: 8,
    },
    addPaymentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary + '40',
      borderStyle: 'dashed',
    },
    addPaymentButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    paymentForm: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      ...shadows.md,
    },
    formTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 16,
    },
    methodSelection: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    methodButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: glassColors.background,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    methodButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    methodButtonText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    methodButtonTextSelected: {
      color: '#fff',
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: glassColors.border,
      paddingHorizontal: 14,
    },
    dollarSign: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      marginRight: 4,
    },
    amountInput: {
      flex: 1,
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: colors.text,
      paddingVertical: 14,
    },
    remainingButton: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    remainingButtonText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    changeDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingHorizontal: 4,
    },
    changeLabel: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.success,
    },
    changeAmount: {
      fontSize: 18,
      fontFamily: fonts.bold,
      color: colors.success,
    },
    formActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelFormButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelFormButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    processButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.success,
    },
    processButtonDisabled: {
      opacity: 0.6,
    },
    processButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      borderRadius: 20,
      backgroundColor: colors.success,
      gap: 10,
      ...shadows.md,
    },
    completeButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: '#fff',
    },
  });
