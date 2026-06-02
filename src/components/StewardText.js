import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/brand';

// Usage:
// <StewardText variant="heading">Title</StewardText>
// <StewardText variant="body" color={COLORS.sage}>Secondary text</StewardText>
//
// Variants: heading | subheading | body | caption | label | mono

const variants = {
  heading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.25,
  },
  subheading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
    lineHeight: SIZES.xl * 1.3,
  },
  body: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.6,
  },
  bodyMedium: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.6,
  },
  caption: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.5,
  },
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  amount: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
  },
  stewardVoice: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    lineHeight: SIZES.md * 1.7,
  },
};

export default function StewardText({
  variant = 'body',
  color,
  style,
  children,
  ...props
}) {
  const base = variants[variant] || variants.body;
  return (
    <Text
      style={[base, color ? { color } : null, style]}
      {...props}
    >
      {children}
    </Text>
  );
}
