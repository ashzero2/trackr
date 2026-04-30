import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChartTooltip } from '@/components/chart-tooltip';
import { EmptyState } from '@/components/empty-state';
import { SkeletonCard } from '@/components/skeleton';
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
  computeMonthInsight,
  peakDayLabel,
} from '@/lib/analytics-buckets';
import { materialIconNameForCategory } from '@/lib/category-icons';
import { useFormatMoney } from '@/hooks/use-format-money';
import { monthName, monthRangeUtc, utcCalendarMonthNow } from '@/lib/dates';
import type { Budget, Category, MonthSummary } from '@/types/finance';

export default function AnalyticsScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { travelModeEnabled } = useUserProfile();
  const { ready, error, transactions, budgets, categories, trips } = useDatabase();
  const startYm = utcCalendarMonthNow();
  const [year, setYear] = useState(startYm.year);
  const [month, setMonth] = useState(startYm.month);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [mode, setMode] = useState<'week' | 'month'>('month');
  const [refreshing, setRefreshing] = useState(false);
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
  const [selectedPoint, setSelectedPoint] = useState<{
    index: number;
    value: number;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!transactions || !budgets || !categories || !trips) return;
    const y = year;
    const m = month;
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

    setInsight(computeMonthInsight(sc, s.totalExpenseCents));
  }, [transactions, budgets, categories, trips, mode, year, month]);

  useFocusEffect(
    useCallback(() => {
      if (ready && transactions && budgets && categories && trips) load();
    }, [ready, transactions, budgets, categories, trips, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Re-runs whenever `load` ref changes — which happens when `mode` changes,
  // since mode is in load's useCallback deps. This ensures chart data reloads
  // when the user toggles week/month while already on this screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

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
          <SkeletonCard height={48} />
          <SkeletonCard height={140} />
          <SkeletonCard height={200} />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      refreshing={refreshing}
      onRefresh={() => { void onRefresh(); }}>
      {/* Month selector */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${monthName(month)} ${year}, tap to change`}
        onPress={() => setMonthPickerOpen(true)}
        style={[styles.monthPickerBtn, { backgroundColor: colors.surfaceContainerLow }]}>
        <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
        <Text style={{ fontFamily: labelFont, fontWeight: '700', color: colors.primary }}>
          {monthName(month)} {year}
        </Text>
        <MaterialIcons name="expand-more" size={18} color={colors.primary} />
      </Pressable>

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

      <Pressable onPress={() => setSelectedPoint(null)} style={{ position: 'relative' }}>
        <SpendingTrendChart
          values={chartValues}
          labels={chartLabels}
          subtitle={trendSubtitle}
          peakLabel={peak}
          selectedIndex={selectedPoint?.index ?? null}
          onPointPress={(index, value, label) => {
            setSelectedPoint((prev) =>
              prev?.index === index ? null : { index, value, label },
            );
          }}
        />
      </Pressable>
      {selectedPoint ? (
        <ChartTooltip
          label={selectedPoint.label}
          formattedValue={format(selectedPoint.value)}
        />
      ) : null}

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
          onPress={() => router.push('/manage-budgets')}
          style={styles.adjustLimitsHit}>
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Adjust limits</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetScroll}>
        {budgetCards.length === 0 ? (
          <EmptyState
            icon="account-balance-wallet"
            title="No budgets set"
            subtitle="Add category budgets to track your limits"
            actionLabel="Set budgets"
            onAction={() => router.push('/manage-budgets')}
          />
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
      {/* Month+Year picker modal */}
      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Select month
            </Text>
            <View style={styles.pickerYearRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous year"
                onPress={() => setYear((y) => y - 1)}
                style={[styles.pickerArrow, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
              </Pressable>
              <Text style={{ fontFamily: headlineFont, fontWeight: '800', fontSize: 20, color: colors.onSurface }}>
                {year}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next year"
                onPress={() => setYear((y) => y + 1)}
                style={[styles.pickerArrow, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.pickerMonthGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const active = m === month;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${monthName(m)} ${year}`}
                    onPress={() => {
                      setMonth(m);
                      setMonthPickerOpen(false);
                    }}
                    style={[
                      styles.pickerMonthCell,
                      active
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerHigh },
                    ]}>
                    <Text
                      style={{
                        fontFamily: active ? labelFont : bodyFont,
                        fontWeight: active ? '800' : '600',
                        fontSize: 14,
                        color: active ? colors.onPrimary : colors.onSurface,
                      }}>
                      {monthName(m).slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close picker"
              onPress={() => setMonthPickerOpen(false)}
              style={[styles.pickerDone, { borderColor: colors.outlineVariant }]}>
              <Text style={{ fontFamily: labelFont, fontWeight: '700', color: colors.onSurface }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  monthPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  pickerYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  pickerArrow: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  pickerMonthCell: {
    width: '28%',
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  pickerDone: {
    marginTop: 18,
    alignSelf: 'center',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
