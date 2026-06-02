import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/brand';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// STUB — Phase 1 build target
// Navigate mode is triggered when life goes wrong.
// AI acknowledges first (never starts with numbers), inventories what exists
// and what is flexible, builds a recovery arc with a visible timeline back to stability.
//
// CRITICAL: Crisis navigation is available on every tier. Never paywalled.

const LIFE_EVENTS = [
  { label: 'Job loss', icon: '◌' },
  { label: 'Divorce', icon: '◌' },
  { label: 'New baby', icon: '◌' },
  { label: 'Career change', icon: '◌' },
  { label: 'Loss of spouse', icon: '◌' },
  { label: 'Something else', icon: '◌' },
];

export default function NavigateScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <StewardText style={styles.heading}>Navigate</StewardText>
        <StewardText style={styles.sub}>
          Something changed. Tell me what happened and we'll figure out what matters right now.
        </StewardText>

        {/* Always-available note */}
        <View style={styles.alwaysRow}>
          <View style={styles.alwaysDot} />
          <StewardText style={styles.alwaysText}>
            Always available. No paywall. Ever.
          </StewardText>
        </View>

        {/* Event selector stub */}
        <StewardCard variant="outlined" style={styles.stub}>
          <StewardText style={styles.stubLabel}>COMING IN PHASE 1</StewardText>
          <StewardText style={styles.stubText}>
            Declare a life event. Steward acknowledges what's happening first, then inventories what you have, what's flexible, and builds a recovery arc with a visible timeline.
          </StewardText>
        </StewardCard>

        {/* Event type buttons — non-functional stub showing the intended UI */}
        <View style={styles.eventGrid}>
          {LIFE_EVENTS.map((e) => (
            <TouchableOpacity key={e.label} style={styles.eventBtn} activeOpacity={0.7}>
              <StewardText style={styles.eventLabel}>{e.label}</StewardText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.parchment },
  content: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },
  heading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.4,
  },
  sub: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    lineHeight: SIZES.base * 1.6,
  },
  alwaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  alwaysDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.ember,
  },
  alwaysText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.sage,
  },
  stub: {
    gap: SPACING.sm,
  },
  stubLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 1,
  },
  stubText: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  eventBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  eventLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
});
