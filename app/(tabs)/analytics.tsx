import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SpendingTrendChart } from '@/components/spending-trend-chart';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import {
  bucketLast7LocalDays,
  bucketUtcMonthDailyExpenses,
  compressMonthDailyToWeekBars,
  peakDayLabel,
} from '@/lib/analytics-buckets';
import { materialIconNameForCategory } from '@/lib/category-icons';
import { useFormatMoney } from '@/hooks/use-format-money';
import { utcCalendarMonthNow } from '@/lib/dates';
import type { Budget, Category, MonthSummary } from '@/types/finance';

function monthRangeUtc(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AnalyticsScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { travelModeEnabled } = useUserProfile();
  const { ready, error, transactions, budgets, categories, trips } = useDatabase();
  const [mode, setMode] = useState<'week' | 'month'>('month');
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [budgetList, setBudgetList] = useState<Budget[]>([]);
  const [spentByCat, setSpentByCat] = useState<{ categoryId: string; categoryName: string; spentCents: number }[]>(
    [],
  );
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [peak, setPeak] = useState<string | undefined>();
  const [catRows, setCatRows] = useState<Category[]>([]);
  const [insight, setInsight] = useState('');
  const [tripVsNormal, setTripVsNormal] = useState<{
    tripExpenseBaseCents: number;
    normalExpenseBaseCents: number;
  } | null>(null);
  const [tripYearBars, setTripYearBars] = useState<{ tripId: string; name: string; totalExpenseCents: number }[]>([]);

  const load = useCallback(async () => {
    if (!transactions || !budgets || !categories || !trips) return;
    const { year: y, month: m } = utcCalendarMonthNow();
    const [s, bl, sc, allCats, vs, yTrips] = await Promise.all([
      transactions.summaryForMonth(y, m),
      budgets.listForMonth(y, m),
      transactions.spendingByCategoryForMonth(y, m),
      categories.listAll(),
      trips.summaryTripVsNormalForMonth(y, m),
      trips.listTripExpenseTotalsForYear(y),
    ]);
    setTripVsNormal(vs);
    setTripYearBars(yTrips);
    setSummary(s);
    setBudgetList(bl);
    setSpentByCat(sc);
    setCatRows(allCats);

    if (mode === 'month') {
      const { start, end } = monthRangeUtc(y, m);
      const txs = await transactions.listExpensesBetween(start, end);
      const daily = bucketUtcMonthDailyExpenses(txs, y, m);
      const { values, labels } = compressMonthDailyToWeekBars(daily);
      setChartValues(values.length ? values : [0]);
      setChartLabels(labels.length ? labels : ['—']);
      setPeak(peakDayLabel(values, labels));
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const endEx = new Date();
      endEx.setDate(endEx.getDate() + 1);
      endEx.setHours(0, 0, 0, 0);
      const txs = await transactions.listExpensesBetween(start.toISOString(), endEx.toISOString());
      const { values, labels } = bucketLast7LocalDays(txs);
      setChartValues(values.length ? values : [0]);
      setChartLabels(labels);
      setPeak(peakDayLabel(values, labels));
    }

    const dining = sc.find((c) => c.categoryName.toLowerCase().includes('dining'))?.spentCents ?? 0;
    const total = s.totalExpenseCents || 1;
    const ratio = dining / total;
    if (ratio > 0.15) {
      setInsight(
        `Dining makes up about ${Math.round(ratio * 100)}% of this month’s expenses—small tweaks there move the needle fast.`,
      );
    } else {
      setInsight(
        `You’re logging steadily across categories. Keep recording transactions for sharper forecasts next month.`,
      );
    }
  }, [transactions, budgets, categories, trips, mode]);

  useFocusEffect(
    useCallback(() => {
      if (ready && transactions && budgets && categories && trips) load();
    }, [ready, transactions, budgets, categories, trips, load]),
  );

  const catIcon = useCallback(
    (categoryId: string | null) => {
      if (!categoryId) return 'category' as const;
      const c = catRows.find((x) => x.id === categoryId);
      return materialIconNameForCategory(c?.iconKey ?? 'category');
    },
    [catRows],
  );

  const budgetCards = useMemo(() => {
    return budgetList.filter((b) => b.categoryId);
  }, [budgetList]);

  const trendSubtitle = useMemo(() => {
    if (!summary) return '';
    if (mode === 'week') return 'Last 7 days (local), expenses only';
    return 'This month by week bucket (UTC month), expenses only';
  }, [summary, mode]);

  if (error) {
    return (
      <ScreenScaffold>
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>{error.message}</Text>
      </ScreenScaffold>
    );
  }

  if (!ready || !transactions || !budgets || !categories || !trips) {
    return (
      <ScreenScaffold>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <View style={styles.headRow}>
        <View>
          <Text style={[styles.kicker, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {mode === 'month' ? 'Monthly overview' : 'Weekly overview'}
          </Text>
          <Text style={[styles.bigTotal, { color: colors.primary, fontFamily: headlineFont }]}>
            {summary ? format(summary.totalExpenseCents) : '…'}
          </Text>
        </View>
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {(['week', 'month'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              accessibilityLabel={m === 'week' ? 'Weekly overview' : 'Monthly overview'}
              onPress={() => setMode(m)}
              style={[
                styles.segChip,
                mode === m && { backgroundColor: colors.surfaceContainerLowest },
              ]}>
              <Text
                style={{
                  fontFamily: labelFont,
                  fontWeight: '600',
                  fontSize: 13,
                  color: mode === m ? colors.primary : colors.onSurfaceVariant,
                }}>
                {m === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <SpendingTrendChart
        values={chartValues}
        labels={chartLabels}
        subtitle={trendSubtitle}
        peakLabel={peak}
      />

      {travelModeEnabled && tripVsNormal ? (
        <View style={[styles.tripCard, { backgroundColor: colors.surfaceContainerLowest, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: headlineFont, marginBottom: 12 }]}>
            Trips vs other (this month, base currency)
          </Text>
          <View style={styles.tripVsRow}>
            <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant }}>Trip-linked</Text>
            <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.primary }}>
              {format(tripVsNormal.tripExpenseBaseCents)}
            </Text>
          </View>
          <View style={styles.tripVsRow}>
            <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant }}>Everyday (no trip)</Text>
            <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.chartPeakLabel }}>
              {format(tripVsNormal.normalExpenseBaseCents)}
            </Text>
          </View>
        </View>
      ) : null}

      {travelModeEnabled && tripYearBars.length > 0 ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: headlineFont }]}>
            Trips this year (expenses)
          </Text>
          {tripYearBars.slice(0, 8).map((t) => (
            <View
              key={t.tripId}
              style={[styles.tripVsRow, { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant }]}>
              <Text style={{ fontFamily: bodyFont, color: colors.onSurface, flex: 1 }} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={{ fontFamily: labelFont, fontWeight: '700', color: colors.onSurface }}>{format(t.totalExpenseCents)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.budgetHeader}>
        <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: headlineFont }]}>
          Budget insights
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjust budget limits"
          onPress={() => router.push('/manage-budgets' as unknown as Href)}
          style={styles.adjustLimitsHit}>
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Adjust limits</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetScroll}>
        {budgetCards.length === 0 ? (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont, maxWidth: 260 }}>
            No category budgets for this month yet.
          </Text>
        ) : (
          budgetCards.map((b) => {
            const spent = spentByCat.find((s) => s.categoryId === b.categoryId)?.spentCents ?? 0;
            const limit = b.limitCents;
            const pct = limit > 0 ? Math.min(1, spent / limit) : 0;
            const over = spent > limit;
            const name =
              spentByCat.find((s) => s.categoryId === b.categoryId)?.categoryName ?? 'Category';
            return (
              <View key={b.id} style={[styles.budgetCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <View style={styles.budgetTop}>
                  <View style={[styles.budgetIcon, { backgroundColor: colors.secondaryContainer }]}>
                    <MaterialIcons name={catIcon(b.categoryId)} size={24} color={colors.onSecondaryContainer} />
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.surfaceContainerHighest }]}>
                    <Text style={[styles.tagText, { color: over ? colors.error : colors.onSurfaceVariant }]}>
                      {name.toUpperCase().slice(0, 12)}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 6, marginTop: 8 }}>
                  <View style={styles.spentRow}>
                    <Text style={[styles.spentLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                      Spent
                    </Text>
                    <Text style={[styles.spentVal, { color: over ? colors.error : colors.primary, fontFamily: headlineFont }]}>
                      {format(spent)}{' '}
                      <Text style={{ color: colors.onSurfaceVariant, fontSize: 15, fontWeight: '500' }}>
                        / {format(limit)}
                      </Text>
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round(pct * 100)}%`,
                          backgroundColor: over ? colors.error : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={{ color: over ? colors.error : colors.onSurfaceVariant, fontFamily: bodyFont, fontSize: 11 }}>
                    {over
                      ? `Exceeded by ${format(spent - limit)}`
                      : `${Math.round(pct * 100)}% of budget used`}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View
        style={[
          styles.insightCard,
          { backgroundColor: colors.tertiaryFixed, borderColor: colors.outlineVariant },
        ]}>
        <View style={[styles.insightIcon, { backgroundColor: colors.tertiaryFixedDim }]}>
          <MaterialIcons name="lightbulb" size={28} color={colors.insightCardTitle} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.insightTitle, { color: colors.insightCardTitle, fontFamily: headlineFont }]}>
            Smart insight
          </Text>
          <Text style={[styles.insightBody, { color: colors.insightCardBody, fontFamily: bodyFont }]}>{insight}</Text>
        </View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loader: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '500',
  },
  bigTotal: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segChip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  adjustLimitsHit: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingLeft: 8,
    marginRight: -8,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  budgetScroll: {
    gap: 16,
    paddingBottom: 8,
  },
  budgetCard: {
    width: 260,
    borderRadius: 24,
    padding: 20,
  },
  budgetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  budgetIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  spentLbl: {
    fontSize: 11,
    fontWeight: '700',
  },
  spentVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  insightIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  insightBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  tripCard: {
    borderRadius: 24,
    padding: 20,
  },
  tripVsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
