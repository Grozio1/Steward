import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../constants/brand';
import StewardText from './StewardText';
import { formatCurrency } from '../data/store';

export default function AllocationBar({ allocation }) {
  const { name, amount, spent = 0, note } = allocation;
  const isAdhoc = allocation.layer === 'adhoc';
  const pct = amount > 0 ? Math.min(1, spent / amount) : 0;
  const over = !isAdhoc && spent > amount;
  const remaining = amount - spent;
  const barColor = over ? COLORS.ember : COLORS.forest;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StewardText style={styles.name}>{name}</StewardText>
        <View style={styles.amounts}>
          {isAdhoc ? (
            <StewardText style={styles.spent}>{formatCurrency(spent)}</StewardText>
          ) : (
            <>
              <StewardText style={[styles.spent, over && styles.over]}>
                {formatCurrency(spent)}
              </StewardText>
              <StewardText style={styles.slash}> / </StewardText>
              <StewardText style={styles.amount}>{formatCurrency(amount)}</StewardText>
            </>
          )}
        </View>
      </View>

      {/* Progress bar — hidden for ad hoc */}
      {!isAdhoc && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, pct * 100)}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      )}

      {/* Remaining / note */}
      <StewardText style={styles.note}>
        {isAdhoc
          ? spent > 0 ? `${formatCurrency(spent)} logged` : note
          : over
          ? `${formatCurrency(Math.abs(remaining))} over`
          : remaining > 0
          ? `${formatCurrency(remaining)} left`
          : note || ''}
      </StewardText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  name: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    flex: 1,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spent: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.forest,
  },
  over: {
    color: COLORS.ember,
  },
  slash: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  amount: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  track: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  fill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  note: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
  },
});
