import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { stripeConnectApi } from '../lib/api';

export function StripeOnboardingScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { refreshConnectStatus } = useAuth();
  const webViewRef = useRef<WebView>(null);

  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasShownCompletion, setHasShownCompletion] = useState(false);

  const styles = createStyles(colors);

  // Fetch the onboarding URL when the screen mounts
  useEffect(() => {
    fetchOnboardingUrl();
  }, []);

  const fetchOnboardingUrl = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await stripeConnectApi.getOnboardingLink();
      setOnboardingUrl(response.onboardingUrl);
    } catch (err: any) {
      console.error('Failed to get onboarding URL:', err);
      setError(err.message || 'Failed to load onboarding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Refresh connect status when closing
    refreshConnectStatus();
    // Check if we can go back, otherwise navigate to main tabs
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    // Prevent handling multiple times
    if (hasShownCompletion) return;

    // Check if we've been redirected back (onboarding complete or user returned)
    // The return URL is typically the vendor dashboard /connect page
    if (navState.url && (
      navState.url.includes('/connect') && !navState.url.includes('stripe.com')
    )) {
      // Mark as handled to prevent duplicate closes
      setHasShownCompletion(true);

      // Silently close and refresh status - no popup needed
      handleClose();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Payment Setup</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payment setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Payment Setup</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOnboardingUrl}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Setup</Text>
        <View style={styles.placeholder} />
      </View>

      {onboardingUrl && (
        <WebView
          ref={webViewRef}
          source={{ uri: onboardingUrl }}
          style={styles.webView}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
        />
      )}
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
      padding: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    placeholder: {
      width: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      gap: 16,
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    webView: {
      flex: 1,
    },
    webViewLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
  });
