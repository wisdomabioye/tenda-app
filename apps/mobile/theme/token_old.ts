type FontWeightToken = '400' | '500' | '600' | '700' | '800'

export interface Tone {
  base: string
  surface: string
  text: string
  border: string
}

export interface TextStyleToken {
  fontFamily: string
  fontSize: number
  lineHeight: number
  fontWeight: FontWeightToken
  letterSpacing?: number
}

export interface ColorScheme {
  surface: {
    background: string
    backgroundAlt: string
    card: string
    cardElevated: string
    inset: string
    overlay: string
    navbar: string
    tabBar: string
    sheet: string
    modal: string
    pressed: string
    inverse: string
  }

  brand: {
    primary: string
    primaryPressed: string
    primarySurface: string
    primaryBorder: string
    onPrimary: string
    focusRing: string
  }

  content: {
    primary: string
    secondary: string
    tertiary: string
    inverse: string
    link: string
    disabled: string
    placeholder: string
  }

  border: {
    subtle: string
    default: string
    strong: string
    divider: string
    input: string
    inputActive: string
    inputError: string
    inverse: string
  }

  control: {
    inputBackground: string
    inputBackgroundDisabled: string
    inputText: string
    inputPlaceholder: string
    inputLabel: string
    inputHelp: string

    selectedBackground: string
    selectedBorder: string

    disabledBackground: string
    disabledText: string
    disabledBorder: string
  }

  feedback: {
    success: Tone
    warning: Tone
    danger: Tone
    info: Tone
  }

  navigation: {
    headerBackground: string
    headerBorder: string
    tabBarBackground: string
    tabBarBorder: string
    iconActive: string
    iconInactive: string
  }

  utility: {
    scrim: string
    money: string
  }

  category: {
    delivery: Tone
    photo: Tone
    errand: Tone
    service: Tone
    digital: Tone
  }
}

const tone = (base: string, surface: string, text: string, border: string): Tone => ({
  base,
  surface,
  text,
  border,
})

export const colors: { light: ColorScheme; dark: ColorScheme } = {
  light: {
    surface: {
      background: '#FAFAF8',
      backgroundAlt: '#F3F3F0',
      card: '#FFFFFF',
      cardElevated: '#FFFFFF',
      inset: '#EEEFEA',
      overlay: 'rgba(255,255,255,0.72)',
      navbar: 'rgba(250,250,248,0.92)',
      tabBar: 'rgba(255,255,255,0.96)',
      sheet: '#FFFFFF',
      modal: '#FFFFFF',
      pressed: '#E9EDF2',
      inverse: '#151922',
    },

    brand: {
      primary: '#3B70C4',
      primaryPressed: '#2D57A0',
      primarySurface: '#EDF2FB',
      primaryBorder: '#C6D6F2',
      onPrimary: '#FFFFFF',
      focusRing: '#3B70C4',
    },

    content: {
      primary: '#243447',
      secondary: '#526173',
      tertiary: '#7B8794',
      inverse: '#FFFFFF',
      link: '#3B70C4',
      disabled: '#9AA3AF',
      placeholder: '#98A2B3',
    },

    border: {
      subtle: '#EEF1F4',
      default: '#D9E0E8',
      strong: '#BAC4D0',
      divider: '#E7ECF2',
      input: '#D6DCE4',
      inputActive: '#3B70C4',
      inputError: '#DC2626',
      inverse: 'rgba(255,255,255,0.22)',
    },

    control: {
      inputBackground: '#F4F6F8',
      inputBackgroundDisabled: '#EEF1F4',
      inputText: '#243447',
      inputPlaceholder: '#98A2B3',
      inputLabel: '#526173',
      inputHelp: '#7B8794',

      selectedBackground: '#EDF2FB',
      selectedBorder: '#AFC5EB',

      disabledBackground: '#EEF1F4',
      disabledText: '#9AA3AF',
      disabledBorder: '#E1E6EC',
    },

    feedback: {
      success: tone('#10B981', '#ECFDF5', '#047857', '#A7F3D0'),
      warning: tone('#F59E0B', '#FFFBEB', '#B45309', '#FDE68A'),
      danger: tone('#EF4444', '#FEF2F2', '#B91C1C', '#FECACA'),
      info: tone('#3B82F6', '#EFF6FF', '#1D4ED8', '#BFDBFE'),
    },

    navigation: {
      headerBackground: 'rgba(250,250,248,0.92)',
      headerBorder: '#E7ECF2',
      tabBarBackground: 'rgba(255,255,255,0.96)',
      tabBarBorder: '#E7ECF2',
      iconActive: '#3B70C4',
      iconInactive: '#7B8794',
    },

    utility: {
      scrim: 'rgba(10,14,20,0.48)',
      money: '#10B981',
    },

    category: {
      delivery: tone('#3B82F6', '#EFF6FF', '#1D4ED8', '#BFDBFE'),
      photo: tone('#8B5CF6', '#F5F3FF', '#6D28D9', '#DDD6FE'),
      errand: tone('#F59E0B', '#FFFBEB', '#B45309', '#FDE68A'),
      service: tone('#10B981', '#ECFDF5', '#047857', '#A7F3D0'),
      digital: tone('#EC4899', '#FDF2F8', '#BE185D', '#FBCFE8'),
    },
  },

  dark: {
    surface: {
      background: '#151922',
      backgroundAlt: '#1B2030',
      card: '#1E2330',
      cardElevated: '#252B3B',
      inset: '#121723',
      overlay: 'rgba(10,14,20,0.68)',
      navbar: 'rgba(21,25,34,0.90)',
      tabBar: 'rgba(21,25,34,0.96)',
      sheet: '#1C2231',
      modal: '#202738',
      pressed: '#2A3140',
      inverse: '#F5F7FB',
    },

    brand: {
      primary: '#3B70C4',
      primaryPressed: '#2D57A0',
      primarySurface: '#1E3258',
      primaryBorder: '#355E9E',
      onPrimary: '#FFFFFF',
      focusRing: '#7AA8F2',
    },

    content: {
      primary: '#E5EDF8',
      secondary: '#B8C4D4',
      tertiary: '#8A95A3',
      inverse: '#151922',
      link: '#7AA8F2',
      disabled: '#66717F',
      placeholder: '#748091',
    },

    border: {
      subtle: '#242B39',
      default: '#313A4A',
      strong: '#465063',
      divider: '#2A3140',
      input: '#384253',
      inputActive: '#7AA8F2',
      inputError: '#F87171',
      inverse: 'rgba(255,255,255,0.14)',
    },

    control: {
      inputBackground: '#202738',
      inputBackgroundDisabled: '#1A2130',
      inputText: '#E5EDF8',
      inputPlaceholder: '#748091',
      inputLabel: '#B8C4D4',
      inputHelp: '#8A95A3',

      selectedBackground: '#1E3258',
      selectedBorder: '#3B70C4',

      disabledBackground: '#1A2130',
      disabledText: '#66717F',
      disabledBorder: '#2C3444',
    },

    feedback: {
      success: tone('#10B981', '#063B2E', '#6EE7B7', '#14532D'),
      warning: tone('#F59E0B', '#4A3208', '#FCD34D', '#7C5A10'),
      danger: tone('#EF4444', '#4A1717', '#FCA5A5', '#7F1D1D'),
      info: tone('#3B82F6', '#142C5F', '#93C5FD', '#1D4ED8'),
    },

    navigation: {
      headerBackground: 'rgba(21,25,34,0.90)',
      headerBorder: 'rgba(184,196,212,0.12)',
      tabBarBackground: 'rgba(21,25,34,0.96)',
      tabBarBorder: '#2A3140',
      iconActive: '#7AA8F2',
      iconInactive: '#8A95A3',
    },

    utility: {
      scrim: 'rgba(0,0,0,0.65)',
      money: '#34D399',
    },

    category: {
      delivery: tone('#60A5FA', '#132743', '#BFDBFE', '#1D4ED8'),
      photo: tone('#A78BFA', '#251A46', '#DDD6FE', '#7C3AED'),
      errand: tone('#FBBF24', '#3D2B09', '#FDE68A', '#B45309'),
      service: tone('#34D399', '#0D332A', '#A7F3D0', '#047857'),
      digital: tone('#F472B6', '#43182F', '#FBCFE8', '#BE185D'),
    },
  },
}

export const spacing = {
  none: 0,
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  control: 16,
  card: 20,
  sheet: 24,
  full: 9999,
} as const

const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const

const fonts = {
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
  mono: 'JetBrainsMono',
} as const

export const typography = {
  fonts,
  weights: fontWeights,
  styles: {
    hero: {
      fontFamily: fonts.display.bold,
      fontSize: 44,
      lineHeight: 50,
      fontWeight: fontWeights.bold,
      letterSpacing: -0.8,
    } satisfies TextStyleToken,

    h1: {
      fontFamily: fonts.display.bold,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: fontWeights.bold,
      letterSpacing: -0.5,
    } satisfies TextStyleToken,

    h2: {
      fontFamily: fonts.display.semibold,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: fontWeights.semibold,
      letterSpacing: -0.3,
    } satisfies TextStyleToken,

    h3: {
      fontFamily: fonts.display.semibold,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: fontWeights.semibold,
    } satisfies TextStyleToken,

    title: {
      fontFamily: fonts.body.semibold,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: fontWeights.semibold,
    } satisfies TextStyleToken,

    body: {
      fontFamily: fonts.body.regular,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: fontWeights.regular,
    } satisfies TextStyleToken,

    bodySmall: {
      fontFamily: fonts.body.regular,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: fontWeights.regular,
    } satisfies TextStyleToken,

    label: {
      fontFamily: fonts.body.medium,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: fontWeights.medium,
      letterSpacing: 0.2,
    } satisfies TextStyleToken,

    caption: {
      fontFamily: fonts.body.medium,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: fontWeights.medium,
      letterSpacing: 0.2,
    } satisfies TextStyleToken,

    button: {
      fontFamily: fonts.body.semibold,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: fontWeights.semibold,
      letterSpacing: 0.1,
    } satisfies TextStyleToken,

    monoSmall: {
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: fontWeights.medium,
    } satisfies TextStyleToken,
  },
} as const

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
} as const

export const motion = {
  duration: {
    fast: 150,
    normal: 220,
    slow: 320,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    entrance: [0, 0, 0, 1],
    exit: [0.4, 0, 1, 1],
    emphasized: [0.2, 0, 0, 1],
  },
} as const

export const layers = {
  base: 0,
  header: 10,
  dropdown: 20,
  sheet: 30,
  modal: 40,
  toast: 50,
} as const

export const breakpoints = {
  xs: 0,
  sm: 390,
  md: 428,
  lg: 768,
  xl: 1024,
} as const

export type ThemeMode = keyof typeof colors
export type ThemeColors = (typeof colors)[ThemeMode]
