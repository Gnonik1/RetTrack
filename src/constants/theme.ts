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
  screenSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
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

export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  typography,
} as const;
