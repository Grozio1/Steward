import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { formatCurrency } from '../../data/store';
import { loadBiography } from '../../ai/biography';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import FlameIcon from '../../components/FlameIcon';

// ─── Timeline interleaving ─────────────────────────────────────────────────────
// Chapters newest-first; milestones slotted below the chapter they belong to.

function buildTimelineItems(chapters, milestones) {
  const items = [];
  for (let i = 0; i < chapters.length; i++) {
    items.push({ type: 'chapter', data: chapters[i] });
    milestones
      .filter(m => m.year === chapters[i].year)
      .forEach(m => items.push({ type: 'milestone', data: m }));
  }
  return items;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ pulse }) {
  return (
    <Animated.View style={[sk.card, { opacity: pulse }]}>
      <View style={[sk.line, { width: '40%', marginBottom: SPACING.sm }]} />
      <View style={[sk.line, { width: '85%', marginBottom: SPACING.xs }]} />
      <View style={[sk.line, { width: '65%' }]} />
    </Animated.View>
  );
}

// ─── 2×2 stat grid (expanded chapter) ─────────────────────────────────────────

function StatGrid({ chapter }) {
  const cells = [
    {
      label: 'Income',
      value: chapter.income ? `${formatCurrency(chapter.income)}/mo` : '—',
    },
    { label: 'Debt paid',     value: formatCurrency(chapter.debtPaid || 0) },
    { label: 'Savings built', value: formatCurrency(chapter.savingsBuilt || 0) },
    {
      label: chapter.current ? 'Current debt' : 'End debt',
      value: formatCurrency(chapter.current
        ? (chapter.currentDebt || 0)
        : (chapter.endDebt || 0)),
    },
  ];

  return (
    <View style={st.statGrid}>
      {cells.map((cell, i) => (
        <View key={i} style={st.statCell}>
          <StewardText variant="label">{cell.label}</StewardText>
          <StewardText variant="bodyMedium" style={{ marginTop: 2 }}>{cell.value}</StewardText>
        </View>
      ))}
    </View>
  );
}

// ─── Chapter card ──────────────────────────────────────────────────────────────

function ChapterCard({ chapter, expanded, onToggle }) {
  const isCurrent = chapter.current;
  const cardVariant = isCurrent ? 'parchment' : 'default';
  const lifeEvents = chapter.lifeEvents || [];
  const priorities = chapter.priorities;
  const hasPriorities = Array.isArray(priorities)
    ? priorities.length > 0
    : Boolean(priorities);

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.75}>
      <StewardCard variant={cardVariant} style={st.chapterCard}>
        {/* Label row */}
        <View style={st.chapterHeader}>
          <StewardText
            variant="label"
            color={isCurrent ? COLORS.ember : COLORS.sage}
            style={{ flex: 1 }}
          >
            {chapter.label}
          </StewardText>
          {isCurrent && (
            <View style={st.inProgressBadge}>
              <StewardText style={st.inProgressLabel}>IN PROGRESS</StewardText>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={COLORS.placeholder}
            style={{ marginLeft: SPACING.xs }}
          />
        </View>

        <StewardText variant="bodyMedium" style={{ marginTop: SPACING.xs }}>
          {chapter.headline}
        </StewardText>
        {!!chapter.subline && (
          <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
            {chapter.subline}
          </StewardText>
        )}

        {/* Expanded content */}
        {expanded && (
          <>
            <StatGrid chapter={chapter} />

            {lifeEvents.length > 0 && (
              <View style={st.expandSection}>
                <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
                  LIFE EVENTS
                </StewardText>
                {lifeEvents.map((e, i) => (
                  <StewardText key={i} variant="caption" style={{ marginTop: 2 }}>
                    · {e}
                  </StewardText>
                ))}
              </View>
            )}

            {hasPriorities && (
              <View style={st.expandSection}>
                <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
                  PRIORITIES
                </StewardText>
                <StewardText variant="caption">
                  {Array.isArray(priorities) ? priorities.join(', ') : priorities}
                </StewardText>
              </View>
            )}

            {chapter.reviewDate && (
              <View style={st.reviewBadge}>
                <Ionicons name="checkmark-circle" size={13} color={COLORS.forest} />
                <StewardText variant="caption" color={COLORS.forest}>
                  Annual review · {chapter.reviewDate}
                  {chapter.reviewCorrections > 0
                    ? ` · ${chapter.reviewCorrections} change${chapter.reviewCorrections !== 1 ? 's' : ''}`
                    : ''}
                </StewardText>
              </View>
            )}
          </>
        )}
      </StewardCard>
    </TouchableOpacity>
  );
}

// ─── Timeline rows ─────────────────────────────────────────────────────────────

function ChapterRow({ chapter, expanded, onToggle }) {
  const dotColor = chapter.current ? COLORS.ember : COLORS.forest;
  return (
    <View style={tl.row}>
      <View style={tl.left}>
        <View style={[tl.dot, { backgroundColor: dotColor }]} />
        <View style={tl.line} />
      </View>
      <View style={tl.content}>
        <ChapterCard chapter={chapter} expanded={expanded} onToggle={onToggle} />
      </View>
    </View>
  );
}

function MilestoneRow({ milestone }) {
  const color = milestone.type === 'debt' ? COLORS.ember : COLORS.forest;
  return (
    <View style={tl.row}>
      <View style={tl.left}>
        <View style={[tl.milestoneDot, { backgroundColor: color }]} />
        <View style={tl.line} />
      </View>
      <View style={[tl.content, st.milestoneContent]}>
        <StewardText style={[st.milestoneLabel, { color }]}>
          {milestone.label}
        </StewardText>
        {milestone.amount > 0 && (
          <StewardText variant="caption">{formatCurrency(milestone.amount)}</StewardText>
        )}
      </View>
    </View>
  );
}

function StartedMarker({ date }) {
  return (
    <View style={tl.row}>
      <View style={tl.left}>
        <View style={[tl.dot, { backgroundColor: COLORS.border }]} />
      </View>
      <View style={[tl.content, { paddingTop: 1, paddingBottom: 0 }]}>
        <StewardText variant="label">STARTED</StewardText>
        <StewardText variant="caption" style={{ marginTop: 2 }}>{date}</StewardText>
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function BiographyScreen({ route, navigation }) {
  const profile = route.params?.profile;

  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState(new Set());

  const pulse = useRef(new Animated.Value(0.5)).current;

  // Compute header values directly from profile — no need to wait for bio load.
  const yearsActive = profile
    ? Math.max(1, Math.round(
        ((Date.now() - new Date(profile.createdAt)) / (365.25 * 24 * 60 * 60 * 1000)) * 10
      ) / 10)
    : 1;
  const startDate = profile
    ? new Date(profile.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' })
    : '';

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();

    loadBiography(profile).then(data => {
      setBio(data);
      setLoading(false);
      loop.stop();
    });

    return () => loop.stop();
  }, []);

  const toggleChapter = year => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const timelineItems = bio
    ? buildTimelineItems(bio.chapters || [], bio.milestones || [])
    : [];

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      {/* Fixed forest header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <StewardText style={s.headerTitle}>Your financial story.</StewardText>
          <StewardText style={s.headerSub}>
            {yearsActive} {yearsActive === 1 ? 'year' : 'years'} active · since {startDate}
          </StewardText>
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <SkeletonCard pulse={pulse} />
          <SkeletonCard pulse={pulse} />
          <SkeletonCard pulse={pulse} />
        </View>
      ) : !bio ? (
        <View style={s.emptyWrap}>
          <FlameIcon size={32} bgColor={COLORS.sage} />
          <StewardText
            variant="subheading"
            style={{ textAlign: 'center', marginTop: SPACING.lg }}
          >
            Come back after your first annual review.
          </StewardText>
          <StewardText
            variant="body"
            color={COLORS.placeholder}
            style={{ textAlign: 'center', marginTop: SPACING.sm, lineHeight: SIZES.base * 1.7 }}
          >
            Your story starts building the moment you complete one.
          </StewardText>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card — forest bg, 3 stats */}
          <StewardCard variant="forest" style={s.summaryCard}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <StewardText style={s.summaryValue}>
                  {formatCurrency(bio.totals.debtPaid)}
                </StewardText>
                <StewardText style={s.summaryLabel}>Debt paid</StewardText>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <StewardText style={s.summaryValue}>
                  {formatCurrency(bio.totals.savingsBuilt)}
                </StewardText>
                <StewardText style={s.summaryLabel}>Savings built</StewardText>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <StewardText
                  style={[
                    s.summaryValue,
                    bio.totals.netWorthChange >= 0 && { color: '#A3D5B5' },
                  ]}
                >
                  {bio.totals.netWorthChange >= 0 ? '+' : ''}
                  {formatCurrency(bio.totals.netWorthChange)}
                </StewardText>
                <StewardText style={s.summaryLabel}>Net worth Δ</StewardText>
              </View>
            </View>
          </StewardCard>

          {/* Vertical timeline */}
          <View style={s.timeline}>
            {timelineItems.map((item, i) => {
              if (item.type === 'chapter') {
                return (
                  <ChapterRow
                    key={`chapter-${item.data.year}`}
                    chapter={item.data}
                    expanded={expandedYears.has(item.data.year)}
                    onToggle={() => toggleChapter(item.data.year)}
                  />
                );
              }
              if (item.type === 'milestone') {
                return (
                  <MilestoneRow
                    key={`milestone-${item.data.year}-${i}`}
                    milestone={item.data}
                  />
                );
              }
              return null;
            })}
            <StartedMarker date={bio.startDate} />
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },
  header: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: {
    paddingTop: 3,
    width: 28,
  },
  headerTitle: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.white,
    lineHeight: SIZES.xl * 1.2,
  },
  headerSub: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  loadingWrap: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  summaryCard: { marginBottom: SPACING.lg },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.white,
    textAlign: 'center',
  },
  summaryLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.forestLight,
  },
  timeline: {
    paddingLeft: SPACING.xs,
  },
});

// ─── Chapter card styles ───────────────────────────────────────────────────────

const st = StyleSheet.create({
  chapterCard: { marginBottom: 0 },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inProgressBadge: {
    backgroundColor: COLORS.emberMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    marginRight: SPACING.xs,
  },
  inProgressLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.ember,
    letterSpacing: 0.5,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statCell: {
    width: '50%',
    marginBottom: SPACING.md,
    paddingRight: SPACING.sm,
  },
  expandSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  milestoneContent: {
    paddingTop: 3,
    paddingBottom: SPACING.sm,
  },
  milestoneLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    letterSpacing: 0.3,
  },
});

// ─── Timeline styles ───────────────────────────────────────────────────────────

const tl = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  left: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: SPACING.md,
  },
  milestoneDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginTop: SPACING.xs + 2,
  },
  line: {
    flex: 1,
    width: 1.5,
    backgroundColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
    paddingLeft: SPACING.md,
    paddingBottom: SPACING.md,
  },
});

// ─── Skeleton styles ───────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  card: {
    backgroundColor: COLORS.parchmentDark,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  line: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
  },
});
