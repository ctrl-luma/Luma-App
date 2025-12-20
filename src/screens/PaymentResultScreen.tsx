import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';

type RouteParams = {
  PaymentResult: {
    success: boolean;
    amount: number;
    paymentIntentId: string;
    errorMessage?: string;
  };
};

export function PaymentResultScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentResult'>>();
  const { clearCart } = useCart();

  const { success, amount, errorMessage } = route.params;

  // Animation
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate success/failure icon
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Clear cart on success
    if (success) {
      clearCart();
    }
  }, []);

  const handleNewSale = () => {
    // Reset navigation to Menu tab
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  };

  const handleTryAgain = () => {
    navigation.goBack();
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success/Failure Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              backgroundColor: success ? colors.success + '15' : colors.error + '15',
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons
            name={success ? 'checkmark' : 'close'}
            size={64}
            color={success ? colors.success : colors.error}
          />
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={styles.title}>
            {success ? 'Payment Successful!' : 'Payment Failed'}
          </Text>

          {success ? (
            <>
              <Text style={styles.amount}>${(amount / 100).toFixed(2)}</Text>
              <Text style={styles.subtitle}>
                Transaction completed successfully
              </Text>
            </>
          ) : (
            <Text style={styles.errorText}>
              {errorMessage || 'The payment could not be processed. Please try again.'}
            </Text>
          )}
        </Animated.View>
      </View>

      {/* Actions */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        {success ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNewSale}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>New Sale</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain}>
              <Ionicons name="refresh-outline" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleNewSale}>
              <Text style={styles.secondaryButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    amount: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.success,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    footer: {
      padding: 20,
      paddingBottom: 36,
      gap: 12,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 9999,
      gap: 10,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
