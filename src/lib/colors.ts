// Matches Luma Vendor site design system

// Primary blue palette (shared between themes)
const primaryPalette = {
  primary: '#2563EB',
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary200: '#BFDBFE',
  primary300: '#93BBFC',
  primary400: '#60A5FA',
  primary500: '#3B82F6',
  primary600: '#2563EB',
  primary700: '#1D4ED8',
  primary800: '#1E40AF',
  primary900: '#1E3A8A',
  primary950: '#172554',
};

// Status colors (shared between themes)
const statusColors = {
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.1)',
  successLight: '#86efac',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  errorLight: '#fca5a5',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  warningLight: '#fcd34d',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
};

// Gray palette
const grayPalette = {
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  gray950: '#030712',
};

// Dark theme colors
export const darkColors = {
  ...primaryPalette,
  ...statusColors,
  ...grayPalette,

  // Semantic colors
  background: '#000000',
  surface: '#111827',
  surfaceSecondary: '#1F2937',
  surfaceElevated: '#1F2937',

  // Card styling
  card: '#111827',
  cardBorder: '#1F2937',
  cardHover: '#1F2937',

  // Borders
  border: '#374151',
  borderLight: '#4B5563',
  borderSubtle: '#1F2937',

  // Text
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#111827',

  // Input
  inputBackground: '#1F2937',
  inputBorder: '#374151',
  inputText: '#F3F4F6',
  inputPlaceholder: '#6B7280',

  // Tab bar
  tabBar: '#111827',
  tabBarBorder: '#1F2937',
  tabInactive: '#6B7280',
  tabActive: '#2563EB',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  backdrop: 'rgba(0, 0, 0, 0.5)',

  // Shadows (for dark mode, use subtle glows)
  shadow: 'rgba(0, 0, 0, 0.5)',
  shadowPrimary: 'rgba(37, 99, 235, 0.25)',

  // Keypad
  keypadButton: '#1F2937',
  keypadButtonPressed: '#374151',
};

// Light theme colors
export const lightColors = {
  ...primaryPalette,
  ...statusColors,
  ...grayPalette,

  // Semantic colors
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceSecondary: '#F3F4F6',
  surfaceElevated: '#FFFFFF',

  // Card styling
  card: '#FFFFFF',
  cardBorder: '#E5E7EB',
  cardHover: '#F9FAFB',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderSubtle: '#F3F4F6',

  // Text
  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  textInverse: '#F3F4F6',

  // Input
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputText: '#111827',
  inputPlaceholder: '#9CA3AF',

  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabInactive: '#6B7280',
  tabActive: '#2563EB',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdrop: 'rgba(0, 0, 0, 0.3)',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowPrimary: 'rgba(37, 99, 235, 0.15)',

  // Keypad
  keypadButton: '#F3F4F6',
  keypadButtonPressed: '#E5E7EB',
};

// Type for theme colors
export type ThemeColors = typeof darkColors;

// Helper to get colors by theme
export const getColors = (isDark: boolean): ThemeColors => {
  return isDark ? darkColors : lightColors;
};

// Default export for backward compatibility (dark theme)
export const colors = darkColors;
