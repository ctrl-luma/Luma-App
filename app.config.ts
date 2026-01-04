import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const ENV = process.env.APP_ENV || 'development';

  return {
    ...config,
    name: ENV === 'production' ? 'Luma' : `Luma (${ENV})`,
    slug: 'luma-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    scheme: 'luma',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.lumapos.app',
      infoPlist: {
        NFCReaderUsageDescription: 'This app uses NFC to accept contactless payments',
        NSLocationWhenInUseUsageDescription: 'This app uses your location for payment processing',
      },
    },
    android: {
      package: 'com.lumapos.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.NFC',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      bundler: 'metro',
      backgroundColor: '#000000',
      themeColor: '#000000',
    },
    plugins: [
      'expo-font',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
      [
        '@stripe/stripe-react-native',
        {
          merchantIdentifier: 'merchant.com.lumapos',
          enableGooglePay: true,
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '2fde0ea8-4005-4003-a81c-492378f175b8',
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      env: ENV,
    },
  };
};
