import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { stripeTerminalApi, ordersApi } from '../lib/api';

interface TipOption {
  label: string;
  value: number;
  isCustom?: boolean;
}

type RouteParams = {
  Checkout: {
    total: number;
    isQuickCharge?: boolean;
    quickChargeDescription?: string;
  };
};

export function CheckoutScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Checkout'>>();
  const { items, clearCart } = useCart();
  const { selectedCatalog, refreshCatalogs } = useCatalog();

  // Refresh catalog data when screen is focused to ensure latest settings
  useFocusEffect(
    useCallback(() => {
      refreshCatalogs();
    }, [refreshCatalogs])
  );

  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTipIndex, setSelectedTipIndex] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);

  const { total, isQuickCharge, quickChargeDescription } = route.params;
  const styles = createStyles(colors);

  // Use catalog settings for tip, email, and tax
  const showTipScreen = selectedCatalog?.showTipScreen ?? true;
  const promptForEmail = selectedCatalog?.promptForEmail ?? true;
  const tipPercentages = selectedCatalog?.tipPercentages ?? [15, 18, 20, 25];
  const allowCustomTip = selectedCatalog?.allowCustomTip ?? true;
  const taxRate = selectedCatalog?.taxRate ?? 0;

  // Calculate tax amount (based on subtotal)
  const taxAmount = useMemo(() => {
    if (taxRate <= 0) return 0;
    return Math.round(total * (taxRate / 100));
  }, [total, taxRate]);

  // Build tip options
  const tipOptions: TipOption[] = useMemo(() => {
    const options: TipOption[] = tipPercentages.map((pct: number) => ({
      label: `${pct}%`,
      value: pct / 100,
    }));
    // Add custom tip option if allowed
    if (allowCustomTip) {
      options.push({ label: 'Custom', value: -1, isCustom: true });
    }
    // Always add no tip option
    options.push({ label: 'No Tip', value: 0 });
    return options;
  }, [tipPercentages, allowCustomTip]);

  // Calculate tip and grand total (subtotal + tax + tip)
  const { tipAmount, grandTotal } = useMemo(() => {
    const subtotalWithTax = total + taxAmount;
    if (!showTipScreen || selectedTipIndex === null) {
      return { tipAmount: 0, grandTotal: subtotalWithTax };
    }
    const selectedOption = tipOptions[selectedTipIndex];
    if (selectedOption?.isCustom) {
      const customTip = parseInt(customTipAmount, 10) || 0;
      // Custom tip is entered in dollars, convert to cents
      const tipCents = customTip * 100;
      return { tipAmount: tipCents, grandTotal: subtotalWithTax + tipCents };
    }
    const tipPercentage = selectedOption?.value || 0;
    // Tip is calculated on subtotal (before tax)
    const tip = Math.round(total * tipPercentage);
    return { tipAmount: tip, grandTotal: subtotalWithTax + tip };
  }, [total, taxAmount, selectedTipIndex, showTipScreen, tipOptions, customTipAmount]);

  const handleTipSelect = (index: number) => {
    setSelectedTipIndex(index);
    const selectedOption = tipOptions[index];
    if (selectedOption?.isCustom) {
      setShowCustomTipInput(true);
    } else {
      setShowCustomTipInput(false);
      setCustomTipAmount('');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Include email for receipt if provided
      const receiptEmail = customerEmail.trim() || undefined;

      // Build description based on checkout type
      const description = isQuickCharge
        ? `${quickChargeDescription || 'Quick Charge'}${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`
        : `Order - ${items.length} items${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`;

      // 1. Create order in database first
      const orderItems = isQuickCharge
        ? undefined
        : items.map((item) => ({
            productId: item.product.productId,
            categoryId: item.product.categoryId || undefined,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
          }));

      const order = await ordersApi.create({
        catalogId: selectedCatalog?.id,
        items: orderItems,
        subtotal: total,
        taxAmount: taxAmount,
        tipAmount: tipAmount,
        totalAmount: grandTotal,
        paymentMethod: 'tap_to_pay',
        customerEmail: receiptEmail,
        isQuickCharge: isQuickCharge || false,
        description: isQuickCharge ? quickChargeDescription : undefined,
      });

      // 2. Create payment intent with tip included
      const paymentIntent = await stripeTerminalApi.createPaymentIntent({
        amount: grandTotal / 100, // Convert cents to dollars for API
        description,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          catalogId: selectedCatalog?.id || '',
          isQuickCharge: isQuickCharge ? 'true' : 'false',
          subtotal: total.toString(),
          taxAmount: taxAmount.toString(),
          tipAmount: tipAmount.toString(),
        },
        receiptEmail,
      });

      // 3. Link PaymentIntent to order
      await ordersApi.linkPaymentIntent(order.id, paymentIntent.id);

      // Navigate to payment processing screen
      navigation.navigate('PaymentProcessing', {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        amount: grandTotal,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: receiptEmail,
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to initiate payment. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {isQuickCharge ? 'Quick Charge' : 'Order Summary'}
          </Text>

          {isQuickCharge ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>${(total / 100).toFixed(2)}</Text>
            </View>
          ) : (
            <>
              {/* Itemized list */}
              {items.map((item) => (
                <View key={item.product.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    ${((item.product.price * item.quantity) / 100).toFixed(2)}
                  </Text>
                </View>
              ))}

              {/* Subtotal */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>
                  Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)} items)
                </Text>
                <Text style={styles.subtotalValue}>${(total / 100).toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Tip Selection */}
        {showTipScreen && (
          <View style={styles.tipSection}>
            <Text style={styles.tipTitle}>Add a Tip</Text>
            <View style={styles.tipOptions}>
              {tipOptions.map((option, index) => {
                const isSelected = selectedTipIndex === index;
                const calculatedTip = option.value > 0 ? Math.round(total * option.value) : 0;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.tipButton,
                      isSelected && styles.tipButtonSelected,
                    ]}
                    onPress={() => handleTipSelect(index)}
                  >
                    <Text
                      style={[
                        styles.tipButtonLabel,
                        isSelected && styles.tipButtonLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.value > 0 && !option.isCustom && (
                      <Text
                        style={[
                          styles.tipButtonAmount,
                          isSelected && styles.tipButtonAmountSelected,
                        ]}
                      >
                        ${(calculatedTip / 100).toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Tip Input */}
            {showCustomTipInput && (
              <View style={styles.customTipContainer}>
                <Text style={styles.customTipLabel}>Enter custom tip amount:</Text>
                <View style={styles.customTipInputRow}>
                  <Text style={styles.customTipDollar}>$</Text>
                  <TextInput
                    style={styles.customTipInput}
                    placeholder="0"
                    placeholderTextColor={colors.inputPlaceholder}
                    value={customTipAmount}
                    onChangeText={setCustomTipAmount}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Customer Email (Optional) */}
        {promptForEmail && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Customer Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={colors.inputPlaceholder}
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Receipt will be sent to this email
            </Text>
          </View>
        )}

        {/* Payment Amount Display */}
        <View style={styles.paymentAmount}>
          {(tipAmount > 0 || taxAmount > 0) && (
            <View style={styles.breakdownContainer}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>${(total / 100).toFixed(2)}</Text>
              </View>
              {taxAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tax ({taxRate}%)</Text>
                  <Text style={styles.breakdownValue}>${(taxAmount / 100).toFixed(2)}</Text>
                </View>
              )}
              {tipAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tip</Text>
                  <Text style={styles.breakdownValue}>${(tipAmount / 100).toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.breakdownDivider} />
            </View>
          )}
          <Text style={styles.paymentLabel}>Total to Charge</Text>
          <Text style={styles.paymentValue}>${(grandTotal / 100).toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="card-outline" size={22} color="#fff" />
              <Text style={styles.payButtonText}>Tap to Pay</Text>
            </>
          )}
        </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContent: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 20,
      marginBottom: 24,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 16,
      color: colors.text,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    // Itemized receipt styles
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemName: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    itemQuantity: {
      fontSize: 14,
      color: colors.textSecondary,
      minWidth: 30,
    },
    itemPrice: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginLeft: 12,
    },
    subtotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 4,
    },
    subtotalLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    subtotalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    inputSection: {
      marginBottom: 32,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.inputText,
    },
    inputHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 8,
    },
    paymentAmount: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    paymentLabel: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    paymentValue: {
      fontSize: 56,
      fontWeight: '700',
      color: colors.text,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
    },
    payButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 9999,
      gap: 10,
    },
    payButtonDisabled: {
      opacity: 0.7,
    },
    payButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    // Tip section styles
    tipSection: {
      marginBottom: 24,
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    tipOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    tipButton: {
      flex: 1,
      minWidth: '30%',
      minHeight: 70,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tipButtonLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    tipButtonLabelSelected: {
      color: '#fff',
    },
    tipButtonAmount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    tipButtonAmountSelected: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
    // Custom tip styles
    customTipContainer: {
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    customTipLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    customTipInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    customTipDollar: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    customTipInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    // Breakdown styles
    breakdownContainer: {
      width: '100%',
      marginBottom: 16,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    breakdownLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    breakdownValue: {
      fontSize: 15,
      color: colors.text,
    },
    breakdownDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 8,
      marginBottom: 8,
    },
  });
