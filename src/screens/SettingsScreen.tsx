import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { createVendorDashboardUrl } from '../lib/auth-handoff';
import { config } from '../lib/config';
import { Toggle } from '../components/Toggle';
import { glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';

export function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const glassColors = isDark ? glass.dark : glass.light;
  const { user, organization, signOut } = useAuth();
  const { selectedCatalog, clearCatalog } = useCatalog();
  const navigation = useNavigation<any>();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('[SettingsScreen] Sign out error:', error);
    }
  };

  const handleSwitchCatalog = () => {
    navigation.navigate('CatalogSelect');
  };

  const handleOpenVendorPortal = async () => {
    const url = await createVendorDashboardUrl();
    if (url) {
      // Open vendor portal with auth - callback will redirect to home
      Linking.openURL(url);
    } else {
      // Fallback: open without auth
      Linking.openURL(config.vendorDashboardUrl);
    }
  };

  const styles = createStyles(colors, glassColors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons
                    name={isDark ? 'moon' : 'sunny'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.label}>Dark Mode</Text>
              </View>
              <Toggle
                value={isDark}
                onValueChange={toggleTheme}
              />
            </View>
          </View>
        </View>

        {/* Catalog Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catalog</Text>

          {/* Active Catalog Card */}
          <View style={styles.activeCatalogCard}>
            <View style={styles.activeCatalogRow}>
              <View style={styles.activeCatalogInfo}>
                <View style={styles.activeCatalogBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                <Text style={styles.activeCatalogName} numberOfLines={1}>
                  {selectedCatalog?.name || 'None selected'}
                </Text>
                {selectedCatalog?.location && (
                  <Text style={styles.activeCatalogLocation} numberOfLines={1}>{selectedCatalog.location}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.switchButton} onPress={handleSwitchCatalog}>
                <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                <Text style={styles.switchButtonText}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleOpenVendorPortal}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="storefront" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Open Vendor Portal</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                  <Ionicons name="person" size={18} color={colors.textSecondary} />
                </View>
                <Text style={styles.label}>Name</Text>
              </View>
              <Text style={styles.value}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                  <Ionicons name="mail" size={18} color={colors.textSecondary} />
                </View>
                <Text style={styles.label}>Email</Text>
              </View>
              <Text style={styles.value} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                  <Ionicons name="business" size={18} color={colors.textSecondary} />
                </View>
                <Text style={styles.label}>Organization</Text>
              </View>
              <Text style={styles.value}>{organization?.name}</Text>
            </View>
          </View>
        </View>

        {/* Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('TapToPaySettings')}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="card" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Payment Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>Luma v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, isDark: boolean) => {

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
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
    content: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
    card: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    activeCatalogCard: {
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 16,
      ...shadows.sm,
    },
    activeCatalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activeCatalogInfo: {
      flex: 1,
      marginRight: 12,
    },
    activeCatalogBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    activeBadgeText: {
      fontSize: 11,
      fontFamily: fonts.semiBold,
      color: colors.success,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    activeCatalogName: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    activeCatalogLocation: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginTop: 2,
    },
    switchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
    },
    switchButtonText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 56,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    divider: {
      height: 1,
      backgroundColor: glassColors.border,
      marginLeft: 64,
    },
    label: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    sublabel: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginTop: 2,
    },
    value: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      maxWidth: 150,
      textAlign: 'right',
    },
    signOutButton: {
      flexDirection: 'row',
      backgroundColor: colors.errorBg,
      borderRadius: 20,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...(isDark && {
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        ...shadows.sm,
      }),
    },
    signOutText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.error,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingBottom: 48,
    },
    version: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textMuted,
    },
  });
};
