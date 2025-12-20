// App configuration - reads from environment variables

export const config = {
  // API
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.lumapos.co',

  // Website
  websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://lumapos.co',

  // Stripe
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',

  // Environment
  isDev: __DEV__,
  isProd: !__DEV__,
} as const;
