const colors = {
  bg: '#F8F8F3',
  paper: '#FCFCF8',
  green: '#556B4F',
  greenDark: '#3F513A',
  sage: '#EEF1E9',
  text: '#161816',
  muted: '#6F7468',
  border: '#E5E7DF',
  card: '#FFFFFF',
  amber: '#C7923E',
  pending: '#A85B52',
  softPending: '#F4EDEA',
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 34,
} as const;

const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

const typography = {
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  heroEmphasis: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
  },
  accountTitle: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },
  navTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  productTitle: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
  },
  screenSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  meta: {
    fontSize: 13,
    fontWeight: fontWeight.regular,
  },
  capsMeta: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  chipText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  helperText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  footerText: {
    fontSize: 11,
    fontWeight: fontWeight.regular,
  },
  input: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
  },
  textLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
} as const;

const depth = {
  surfaceLevel1: {
    elevation: 1,
    shadowColor: colors.greenDark,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 10,
  },
  surfaceLevel2: {
    elevation: 2,
    shadowColor: colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 20,
  },
  surfaceLevel3: {
    elevation: 3,
    shadowColor: colors.greenDark,
    shadowOffset: {
      height: 18,
      width: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 30,
  },
} as const;

const press = {
  pressedDangerTint: '#F7EFEC',
  pressedOpacity: 0.82,
  pressedPrimaryTint: '#4B6046',
  pressedSurfaceTint: 'rgba(244, 240, 230, 0.72)',
} as const;

export const theme = {
  colors,
  depth,
  spacing,
  radius,
  fontSize,
  fontWeight,
  press,
  typography,
} as const;
