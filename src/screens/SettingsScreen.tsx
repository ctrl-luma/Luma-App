import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { useTerminal } from '../context/StripeTerminalContext';
import { billingService, SubscriptionInfo } from '../lib/api/billing';
import {
  checkBiometricCapabilities,
  isBiometricLoginEnabled,
  enableBiometricLogin,
  disableBiometricLogin,
  BiometricCapabilities,
} from '../lib/biometricAuth';

// Apple TTPOi 5.4: Region-correct terminology
const TAP_TO_PAY_NAME = Platform.OS === 'ios' ? 'Tap to Pay on iPhone' : 'Tap to Pay';
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
  const {
    deviceCompatibility,
    isInitialized,
    isWarming,
    configurationStage,
    configurationProgress,
  } = useTerminal();
  const navigation = useNavigation<any>();

  // Subscription info query
  const { data: subscriptionInfo, isLoading: subscriptionLoading } = useQuery<SubscriptionInfo>({
    queryKey: ['subscription-info'],
    queryFn: () => billingService.getSubscriptionInfo(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Biometric login state
  const [biometricCapabilities, setBiometricCapabilities] = useState<BiometricCapabilities | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Check biometric capabilities and status on mount and when screen is focused
  const checkBiometricStatus = useCallback(async () => {
    const capabilities = await checkBiometricCapabilities();
    setBiometricCapabilities(capabilities);

    if (capabilities.isAvailable) {
      const enabled = await isBiometricLoginEnabled();
      setBiometricEnabled(enabled);
    }
  }, []);

  useEffect(() => {
    checkBiometricStatus();
  }, [checkBiometricStatus]);

  // Refresh biometric status when screen is focused
  useFocusEffect(
    useCallback(() => {
      checkBiometricStatus();
    }, [checkBiometricStatus])
  );

  // Handle biometric toggle
  const handleBiometricToggle = async (value: boolean) => {
    console.log('[SettingsScreen] handleBiometricToggle called, value:', value);

    if (!biometricCapabilities?.isAvailable) {
      console.log('[SettingsScreen] Biometrics not available, returning');
      return;
    }

    setBiometricLoading(true);

    try {
      if (value) {
        // Enable biometric login (will prompt for biometric auth)
        const success = await enableBiometricLogin();
        if (success) {
          setBiometricEnabled(true);
        }
      } else {
        // Disable biometric login
        await disableBiometricLogin();
        setBiometricEnabled(false);
      }
    } catch (error) {
      console.error('[SettingsScreen] Error toggling biometric:', error);
      Alert.alert('Error', `Failed to ${value ? 'enable' : 'disable'} biometric login.`);
    } finally {
      setBiometricLoading(false);
    }
  };

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

  // Subscription management handlers
  const handleManageSubscription = () => {
    if (!subscriptionInfo) return;

    if (subscriptionInfo.platform === 'apple') {
      // Open iOS App Store subscription management
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (subscriptionInfo.platform === 'google') {
      // Open Google Play subscription management
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else if (subscriptionInfo.platform === 'stripe' && subscriptionInfo.manage_subscription_url) {
      // Open Stripe billing portal
      Linking.openURL(subscriptionInfo.manage_subscription_url);
    } else {
      // Fallback: open vendor portal billing page
      handleOpenVendorPortal();
    }
  };

  const getSubscriptionStatusText = () => {
    if (!subscriptionInfo) return 'Loading...';

    const { tier, status, cancel_at } = subscriptionInfo;

    if (tier === 'starter' || status === 'none') {
      return 'Free Plan';
    }

    if (status === 'canceled' || cancel_at) {
      const cancelDate = cancel_at ? new Date(cancel_at).toLocaleDateString() : '';
      return cancelDate ? `Cancels on ${cancelDate}` : 'Canceled';
    }

    if (status === 'past_due') {
      return 'Payment Past Due';
    }

    if (status === 'trialing') {
      return 'Trial';
    }

    return 'Active';
  };

  const getSubscriptionPlatformIcon = (): string => {
    if (!subscriptionInfo) return 'card-outline';

    switch (subscriptionInfo.platform) {
      case 'apple':
        return 'logo-apple';
      case 'google':
        return 'logo-google';
      default:
        return 'card-outline';
    }
  };

  const getSubscriptionPlatformName = (): string => {
    if (!subscriptionInfo) return '';

    switch (subscriptionInfo.platform) {
      case 'apple':
        return 'App Store';
      case 'google':
        return 'Google Play';
      case 'stripe':
        return 'Stripe';
      default:
        return '';
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

          <View style={styles.card}>
            {/* Active Catalog */}
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

            <View style={styles.divider} />

            {/* Payment Settings - for selected catalog */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('TapToPaySettings')}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Payment Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            {/* Current Plan */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="diamond-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>
                    {subscriptionInfo?.current_plan?.name || 'Starter Plan'}
                  </Text>
                  {subscriptionInfo?.current_plan?.price && (
                    <Text style={styles.sublabel}>
                      ${(subscriptionInfo.current_plan.price / 100).toFixed(2)}/month
                    </Text>
                  )}
                </View>
              </View>
              {subscriptionLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={[
                  styles.statusBadgeSuccess,
                  subscriptionInfo?.status === 'past_due' && styles.statusBadgeError,
                  subscriptionInfo?.cancel_at && styles.statusBadgeWarning,
                ]}>
                  <Ionicons
                    name={
                      subscriptionInfo?.status === 'past_due' ? 'warning' :
                      subscriptionInfo?.cancel_at ? 'time-outline' : 'checkmark-circle'
                    }
                    size={14}
                    color={
                      subscriptionInfo?.status === 'past_due' ? colors.error :
                      subscriptionInfo?.cancel_at ? colors.warning : colors.success
                    }
                  />
                  <Text style={[
                    styles.statusBadgeText,
                    {
                      color: subscriptionInfo?.status === 'past_due' ? colors.error :
                        subscriptionInfo?.cancel_at ? colors.warning : colors.success
                    }
                  ]}>
                    {getSubscriptionStatusText()}
                  </Text>
                </View>
              )}
            </View>

            {/* Manage Subscription - Only show for Pro/Enterprise */}
            {subscriptionInfo && subscriptionInfo.tier !== 'starter' && subscriptionInfo.status !== 'none' && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.row} onPress={handleManageSubscription}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                      <Ionicons name={getSubscriptionPlatformIcon() as any} size={18} color={colors.textSecondary} />
                    </View>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>Manage Subscription</Text>
                      <Text style={styles.sublabel}>
                        {subscriptionInfo.platform === 'stripe'
                          ? 'Open billing portal'
                          : `Manage via ${getSubscriptionPlatformName()}`
                        }
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            {/* Upgrade prompt for free users */}
            {(!subscriptionInfo || subscriptionInfo.tier === 'starter' || subscriptionInfo.status === 'none') && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('SignUp')}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="rocket-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>Upgrade to Pro</Text>
                      <Text style={styles.sublabel}>Unlock all features for $29.99/mo</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
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

            {/* Biometric Login Toggle - Only show if device supports biometrics */}
            {biometricCapabilities?.isAvailable && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons
                        name={
                          biometricCapabilities.biometricName === 'Face ID' || biometricCapabilities.biometricName === 'Face Unlock'
                            ? 'scan-outline'
                            : 'finger-print-outline'
                        }
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>{biometricCapabilities.biometricName} Login</Text>
                      <Text style={styles.sublabel}>Sign in faster using {biometricCapabilities.biometricName}</Text>
                    </View>
                  </View>
                  {biometricLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Toggle
                      value={biometricEnabled}
                      onValueChange={handleBiometricToggle}
                    />
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Tap to Pay Section - Apple TTPOi 3.6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{TAP_TO_PAY_NAME}</Text>
          <View style={styles.card}>
            {/* Device Status */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Device Status</Text>
              </View>
              {Platform.OS === 'ios' ? (
                deviceCompatibility.isCompatible ? (
                  <View style={styles.statusBadgeSuccess}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.statusBadgeText, { color: colors.success }]}>Compatible</Text>
                  </View>
                ) : (
                  <View style={styles.statusBadgeError}>
                    <Ionicons name="close-circle" size={14} color={colors.error} />
                    <Text style={[styles.statusBadgeText, { color: colors.error }]}>Not Supported</Text>
                  </View>
                )
              ) : (
                <View style={styles.statusBadgeSuccess}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>Ready</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Terminal Status - Apple TTPOi 3.9.1: Configuration progress indicator */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Terminal Status</Text>
              </View>
              {isWarming ? (
                <View style={styles.statusBadgeWarning}>
                  <ActivityIndicator size="small" color={colors.warning} />
                  <Text style={[styles.statusBadgeText, { color: colors.warning }]}>
                    {configurationProgress}%
                  </Text>
                </View>
              ) : isInitialized ? (
                <View style={styles.statusBadgeSuccess}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>Ready</Text>
                </View>
              ) : (
                <View style={styles.statusBadgeMuted}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.statusBadgeText, { color: colors.textMuted }]}>Not Initialized</Text>
                </View>
              )}
            </View>

            {/* Configuration Progress Bar - Apple TTPOi 3.9.1 */}
            {isWarming && (
              <View style={styles.progressSection}>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: `${configurationProgress}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={styles.progressStageText}>
                  {configurationStage === 'checking_compatibility' && 'Checking device compatibility...'}
                  {configurationStage === 'initializing' && 'Initializing payment terminal...'}
                  {configurationStage === 'fetching_location' && 'Fetching location...'}
                  {configurationStage === 'discovering_reader' && 'Discovering reader...'}
                  {configurationStage === 'connecting_reader' && 'Connecting to reader...'}
                  {configurationStage === 'ready' && 'Ready to accept payments!'}
                  {configurationStage === 'idle' && 'Preparing...'}
                </Text>
              </View>
            )}

            {/* Error message when device not compatible or terminal not ready */}
            {(!deviceCompatibility.isCompatible && deviceCompatibility.errorMessage) && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={18} color={colors.error} />
                <Text style={styles.errorBoxText}>{deviceCompatibility.errorMessage}</Text>
              </View>
            )}

            {(!isInitialized && !isWarming && deviceCompatibility.isCompatible) && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.warningBoxText}>
                  Terminal not initialized. Try opening the checkout screen to initialize the payment terminal.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Help & Education Section - Apple TTPOi 4.1, 4.2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Education</Text>
          <View style={styles.card}>
            {/* Learn About Tap to Pay */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('TapToPayEducation')}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="school-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Learn About {TAP_TO_PAY_NAME}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Stripe Help Center */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('https://support.stripe.com/')}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Stripe Help Center</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Apple Tap to Pay Terms - Apple TTPOi 3.3 */}
            {Platform.OS === 'ios' && (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => Linking.openURL('https://support.apple.com/en-us/HT213049')}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                      <Ionicons name="logo-apple" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.label}>Apple Tap to Pay Support</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.row}
                  onPress={() => Linking.openURL('https://www.apple.com/legal/privacy/en-ww/tap-to-pay/')}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.textSecondary + '15' }]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.label}>Apple Privacy Policy</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.divider} />
              </>
            )}

            {/* Contact Luma Support */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('mailto:support@lumapos.com?subject=Tap to Pay Support')}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.label}>Contact Luma Support</Text>
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
    activeCatalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
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
    labelContainer: {
      flex: 1,
    },
    value: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      maxWidth: 150,
      textAlign: 'right',
    },
    // Status badge styles for Tap to Pay section
    statusBadgeSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.success + '15',
      borderRadius: 8,
    },
    statusBadgeError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.error + '15',
      borderRadius: 8,
    },
    statusBadgeWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.warning + '15',
      borderRadius: 8,
    },
    statusBadgeMuted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.textMuted + '15',
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 12,
      fontFamily: fonts.semiBold,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 16,
      backgroundColor: colors.error + '10',
      borderTopWidth: 1,
      borderTopColor: colors.error + '20',
    },
    errorBoxText: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.error,
      lineHeight: 18,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 16,
      backgroundColor: colors.warning + '10',
      borderTopWidth: 1,
      borderTopColor: colors.warning + '20',
    },
    warningBoxText: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.warning,
      lineHeight: 18,
    },
    // Configuration progress styles - Apple TTPOi 3.9.1
    progressSection: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressStageText: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      textAlign: 'center',
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
