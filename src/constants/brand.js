// Steward brand system
// Source of truth for all visual decisions

export const COLORS = {
  // Primary palette (from brief)
  forest: '#1A3C2B',
  ember: '#C8883A',
  parchment: '#F7F3EC',
  sage: '#4A7060',
  hearth: '#1C1916',

  // Derived
  forestLight: '#2A5C43',
  forestMuted: '#1A3C2B22',
  emberLight: '#E8A85A',
  emberMuted: '#C8883A22',
  parchmentDark: '#EDE9E0',
  sageMuted: '#4A706033',

  // Utility
  white: '#FFFFFF',
  border: '#D8D3CA',
  placeholder: '#9C9888',
  error: '#B04030',
};

export const FONTS = {
  serif: {
    bold: 'PlayfairDisplay_700Bold',
  },
  sans: {
    light: 'Jost_300Light',
    regular: 'Jost_400Regular',
    medium: 'Jost_500Medium',
  },
};

export const SIZES = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
};

export const SHADOW = {
  soft: {
    shadowColor: '#1C1916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1C1916',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
};
