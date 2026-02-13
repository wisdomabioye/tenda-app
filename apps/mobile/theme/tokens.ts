export interface ColorScheme {
  // Surfaces
  background: string
  surface: string
  surfacePressed: string

  // Brand
  primary: string
  primaryPressed: string
  primaryTint: string
  onPrimary: string

  // Text
  text: string
  textSub: string
  textFaint: string
  textInverse: string
  textLink: string

  // Status
  success: string
  successTint: string
  onSuccess: string
  warning: string
  warningTint: string
  onWarning: string
  danger: string
  dangerTint: string
  onDanger: string
  info: string
  infoTint: string
  onInfo: string

  // Borders & Inputs
  border: string
  borderFaint: string
  input: string
  focusRing: string

  // Utility
  muted: string
  mutedText: string
  money: string
  disabled: string

  // Category colours (gig types)
  categoryDelivery: string
  categoryPhoto: string
  categoryErrand: string
  categoryService: string
  categoryDigital: string
}

export const colors: { light: ColorScheme; dark: ColorScheme } = {
  light: {
    // Surfaces
    background: '#ffffff',
    surface: '#f9fafb',
    surfacePressed: '#f3f4f6',

    // Brand
    primary: '#3b82f6',
    primaryPressed: '#2563eb',
    primaryTint: '#eff6ff',
    onPrimary: '#ffffff',

    // Text
    text: '#111827',
    textSub: '#6b7280',
    textFaint: '#9ca3af',
    textInverse: '#ffffff',
    textLink: '#3b82f6',

    // Status
    success: '#10b981',
    successTint: '#ecfdf5',
    onSuccess: '#059669',
    warning: '#f59e0b',
    warningTint: '#fffbeb',
    onWarning: '#d97706',
    danger: '#ef4444',
    dangerTint: '#fef2f2',
    onDanger: '#dc2626',
    info: '#3b82f6',
    infoTint: '#eff6ff',
    onInfo: '#2563eb',

    // Borders & Inputs
    border: '#e5e7eb',
    borderFaint: '#f3f4f6',
    input: '#f3f4f6',
    focusRing: '#3b82f6',

    // Utility
    muted: '#f3f4f6',
    mutedText: '#6b7280',
    money: '#10b981',
    disabled: '#9ca3af',

    // Category colours
    categoryDelivery: '#3b82f6',
    categoryPhoto: '#8b5cf6',
    categoryErrand: '#f59e0b',
    categoryService: '#10b981',
    categoryDigital: '#ec4899',
  },

  dark: {
    // Surfaces
    background: '#111827',
    surface: '#1f2937',
    surfacePressed: '#374151',

    // Brand
    primary: '#3b82f6',
    primaryPressed: '#2563eb',
    primaryTint: '#1e3a8a',
    onPrimary: '#ffffff',

    // Text
    text: '#f9fafb',
    textSub: '#9ca3af',
    textFaint: '#6b7280',
    textInverse: '#111827',
    textLink: '#60a5fa',

    // Status
    success: '#10b981',
    successTint: '#064e3b',
    onSuccess: '#34d399',
    warning: '#f59e0b',
    warningTint: '#78350f',
    onWarning: '#fbbf24',
    danger: '#ef4444',
    dangerTint: '#7f1d1d',
    onDanger: '#fca5a5',
    info: '#3b82f6',
    infoTint: '#1e3a8a',
    onInfo: '#93c5fd',

    // Borders & Inputs
    border: '#374151',
    borderFaint: '#1f2937',
    input: '#374151',
    focusRing: '#3b82f6',

    // Utility
    muted: '#374151',
    mutedText: '#9ca3af',
    money: '#10b981',
    disabled: '#6b7280',

    // Category colours
    categoryDelivery: '#60a5fa',
    categoryPhoto: '#a78bfa',
    categoryErrand: '#fbbf24',
    categoryService: '#34d399',
    categoryDigital: '#f472b6',
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const

export const radius = {
  sm: 6,
  md: 14,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const typography = {
  fonts: {
    display: {
      medium: 'SpaceGrotesk_500Medium',
      semibold: 'SpaceGrotesk_600SemiBold',
      bold: 'SpaceGrotesk_700Bold',
    },
    body: {
      regular: 'Manrope_400Regular',
      medium: 'Manrope_500Medium',
      semibold: 'Manrope_600SemiBold',
      bold: 'Manrope_700Bold',
    },
    sans: 'Manrope_400Regular',
    mono: 'JetBrainsMono',
  },
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 22,
    '2xl': 32,
    '3xl': 38,
    '4xl': 44,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 8,
  },
} as const

export const breakpoints = {
  xs: 0,
  sm: 390,
  md: 428,
  lg: 768,
  xl: 1024,
} as const
