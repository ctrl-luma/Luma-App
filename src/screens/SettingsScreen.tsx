import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { createVendorDashboardUrl } from '../lib/auth-handoff';
import { config } from '../lib/config';
import { Toggle } from '../components/Toggle';

export function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, organization, signOut } = useAuth();
  const { selectedCatalog, clearCatalog } = useCatalog();
  const navigation = useNavigation<any>();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
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

  const styles = createStyles(colors);

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
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="book" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.label}>Current Catalog</Text>
                  <Text style={styles.sublabel}>
                    {selectedCatalog?.name || 'None selected'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={handleSwitchCatalog}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.warning + '15' }]}>
                  <Ionicons name="swap-horizontal" size={18} color={colors.warning} />
                </View>
                <Text style={styles.label}>Switch Catalog</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
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
          <Text style={styles.version}>Luma v1.0.0</Text>
        </View>
      </ScrollView>
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
    content: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 20,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
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
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginLeft: 60,
    },
    label: {
      fontSize: 16,
      color: colors.text,
    },
    sublabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    value: {
      fontSize: 15,
      color: colors.textSecondary,
      maxWidth: 150,
      textAlign: 'right',
    },
    signOutButton: {
      flexDirection: 'row',
      backgroundColor: colors.errorBg,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.error + '30',
      gap: 8,
    },
    signOutText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.error,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    version: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });
