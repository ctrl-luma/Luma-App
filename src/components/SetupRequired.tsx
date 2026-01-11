import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { openVendorDashboard } from '../lib/auth-handoff';

export type SetupType = 'no-catalogs' | 'no-payment-account';

interface SetupRequiredProps {
  type: SetupType;
}

const SETUP_CONFIG = {
  'no-catalogs': {
    icon: 'storefront-outline' as const,
    title: 'Welcome to Luma!',
    message: 'Create your first catalog in the Vendor Portal to start selling.',
    buttonText: 'Open Vendor Portal',
    redirectPath: '/products',
  },
  'no-payment-account': {
    icon: 'card-outline' as const,
    title: 'Payment Setup Required',
    message: 'Set up your payment account in the Vendor Portal to accept payments.',
    buttonText: 'Set Up Payments',
    redirectPath: '/connect',
  },
};

export function SetupRequired({ type }: SetupRequiredProps) {
  const { colors } = useTheme();
  const config = SETUP_CONFIG[type];
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={64} color={colors.textMuted} />
      </View>

      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.message}>{config.message}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => openVendorDashboard(config.redirectPath)}
        activeOpacity={0.8}
      >
        <Ionicons name="storefront" size={18} color="#fff" />
        <Text style={styles.buttonText}>{config.buttonText}</Text>
        <Ionicons name="open-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      backgroundColor: colors.background,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
