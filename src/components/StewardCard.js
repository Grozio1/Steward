import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOW } from '../constants/brand';

export default function StewardCard({ children, style, variant = 'default' }) {
  return (
    <View style={[styles.base, styles[variant] || styles.default, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.soft,
  },
  default: {
    backgroundColor: COLORS.white,
  },
  forest: {
    backgroundColor: COLORS.forest,
  },
  ember: {
    backgroundColor: COLORS.ember,
  },
  parchment: {
    backgroundColor: COLORS.parchmentDark,
  },
  outlined: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
});
