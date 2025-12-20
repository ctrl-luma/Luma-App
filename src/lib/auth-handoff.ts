/**
 * Auth Handoff Helper for opening Vendor Dashboard with authentication
 * Allows users to access the vendor portal without re-authenticating
 */

import { Linking } from 'react-native';
import { authService } from './api/auth';
import { config } from './config';

/**
 * Creates an authenticated URL to the vendor dashboard
 * Uses hash fragment method for cross-origin compatibility
 *
 * @returns The authenticated URL, or null if no tokens available
 */
export async function createVendorDashboardUrl(): Promise<string | null> {
  try {
    // Get current auth data
    const accessToken = await authService.getAccessToken();
    const refreshToken = await authService.getRefreshToken();
    const user = await authService.getUser();

    if (!accessToken || !refreshToken) {
      console.error('[AuthHandoff] No authentication tokens available');
      return null;
    }

    // Build the auth callback URL with tokens in hash fragment
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
    });

    if (user) {
      params.append('user', encodeURIComponent(JSON.stringify(user)));
    }

    // Use hash fragment for cross-origin compatibility
    const authCallbackUrl = `${config.vendorDashboardUrl}/auth/callback#${params.toString()}`;

    return authCallbackUrl;
  } catch (error) {
    console.error('[AuthHandoff] Error creating vendor dashboard URL:', error);
    return null;
  }
}

/**
 * Opens the vendor dashboard in a browser with authentication
 * The user will be automatically logged in
 */
export async function openVendorDashboard(): Promise<void> {
  try {
    const url = await createVendorDashboardUrl();

    if (!url) {
      console.error('[AuthHandoff] Cannot open vendor dashboard - no auth URL');
      // Fallback: open dashboard without auth
      await Linking.openURL(config.vendorDashboardUrl);
      return;
    }

    // Open the authenticated URL in browser
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      console.error('[AuthHandoff] Cannot open URL:', url);
    }
  } catch (error) {
    console.error('[AuthHandoff] Error opening vendor dashboard:', error);
  }
}
