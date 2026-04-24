import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { DashboardHeroCard } from '@/components/gradient-hero-preview';
import { FabGradient } from '@/components/fab-gradient';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { TransactionRow } from '@/components/transaction-row';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { SeedCategoryId } from '@/db/seed';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useFormatMoney } from '@/hooks/use-format-money';
import { addUtcMonths, formatDaySectionTitle, localDayKey } from '@/lib/dates';
import { groupByLocalDay, dayExpenseTotal } from '@/lib/transaction-utils';
import type { Budget, MonthSummary, TransactionWithCategory } from '@/types/finance';

function utcYearMonth(): { y: number; m: number } {
  const n = new Date();
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1 };
}

export default function DashboardScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { ready, error, transactions, budgets } = useDatabase();
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null);
  const [recent, setRecent] = useState<TransactionWithCategory[]>([]);
  const [byCat, setByCat] = useState<{ categoryId: string; categoryName: string; spentCents: number }[]>([]);
  const [budgetRows, setBudgetRows] = useState<Budget[]>([]);

  const load = useCallback(async () => {
    if (!transactions || !budgets) return;
    const { y, m } = utcYearMonth();
    const prev = addUtcMonths(y, m, -1);
    const [s, p, r, cat, b] = await Promise.all([
      transactions.summaryForMonth(y, m),
      transactions.summaryForMonth(prev.year, prev.month),
      transactions.listRecent(14),
      transactions.spendingByCategoryForMonth(y, m),
      budgets.listForMonth(y, m),
    ]);
    setSummary(s);
    setPrevSummary(p);
    setRecent(r);
    setByCat(cat);
    setBudgetRows(b);
  }, [transactions, budgets]);

  useFocusEffect(
    useCallback(() => {
      if (ready && transactions && budgets) {
        load();
      }
    }, [ready, transactions, budgets, load]),
  );

  const vsLastMonthPercent = useMemo(() => {
    if (!summary || !prevSummary) return null;
    const prev = prevSummary.totalExpenseCents;
    if (prev === 0) return null;
    const cur = summary.totalExpenseCents;
    return Math.round(((cur - prev) / prev) * 100);
  }, [summary, prevSummary]);

  const primaryBudget = useMemo(() => {
    const withCat = budgetRows.find((b) => b.categoryId);
    if (!withCat?.categoryId) return null;
    const spent = byCat.find((c) => c.categoryId === withCat.categoryId)?.spentCents ?? 0;
    const limit = withCat.limitCents;
    const left = Math.max(0, limit - spent);
    const pct = limit > 0 ? Math.min(1, spent / limit) : 0;
    const name = byCat.find((c) => c.categoryId === withCat.categoryId)?.categoryName ?? 'Budget';
    return { name, left, pct, spent, limit };
  }, [budgetRows, byCat]);

  const insightText = useMemo(() => {
    const total = summary?.totalExpenseCents ?? 0;
    const dining = byCat.find((c) => c.categoryId === SeedCategoryId.dining)?.spentCents ?? 0;
    if (total <= 0) return 'Add expenses to unlock personalized insights.';
    const ratio = dining / total;
    if (ratio >= 0.12) {
      return `Dining is about ${Math.round(ratio * 100)}% of your spending this month—worth a look if you’re trimming costs.`;
    }
    return `You’re spread across ${byCat.length} spending categories this month. Nice balance.`;
  }, [summary, byCat]);

  const todayKey = localDayKey(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = localDayKey(yest);

  const groupedRecent = useMemo(() => groupByLocalDay(recent), [recent]);

  if (error) {
    return (
      <ScreenScaffold>
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>{error.message}</Text>
      </ScreenScaffold>
    );
  }

  if (!ready || !transactions || !budgets) {
    return (
      <ScreenScaffold>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      contentBottomExtra={72}
      fab={
        <FabGradient
          accessibilityLabel="Add transaction"
          onPress={() => router.push('/add-transaction' as unknown as Href)}
        />
      }>
      <DashboardHeroCard
        monthlyExpenseCents={summary?.totalExpenseCents ?? 0}
        monthlyIncomeCents={summary?.totalIncomeCents ?? 0}
        loading={summary === null}
        vsLastMonthPercent={vsLastMonthPercent}
      />

      <View style={styles.bentoRow}>
        <View style={[styles.bentoCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={[styles.bentoIcon, { backgroundColor: colors.secondaryContainer }]}>
            <MaterialIcons name="account-balance-wallet" size={22} color={colors.onSecondaryContainer} />
          </View>
          <Text style={[styles.bentoKicker, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            Active budget
          </Text>
          {primaryBudget ? (
            <>
              <Text style={[styles.bentoTitle, { color: colors.onSurface, fontFamily: headlineFont }]}>
                {format(primaryBudget.left)} left
              </Text>
              <Text style={[styles.bentoHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                {primaryBudget.name} · {format(primaryBudget.spent)} /{' '}
                {format(primaryBudget.limit)}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(primaryBudget.pct * 100)}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text style={[styles.bentoHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
              Add category budgets from Analytics to track limits here.
            </Text>
          )}
        </View>

        <View style={[styles.bentoCard, { backgroundColor: colors.tertiaryFixed }]}>
          <View style={[styles.bentoIcon, { backgroundColor: colors.tertiary }]}>
            <MaterialIcons name="lightbulb-outline" size={22} color={colors.onTertiary} />
          </View>
          <Text style={[styles.bentoKicker, { color: colors.insightCardKicker, fontFamily: bodyFont }]}>
            Smart insight
          </Text>
          <Text style={[styles.insightBody, { color: colors.insightCardBody, fontFamily: bodyFont }]}>
            {insightText}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: headlineFont }]}>
          Recent activity
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all transactions"
          onPress={() => router.push('/history')}
          style={styles.viewAllHit}>
          <Text style={[styles.viewAll, { color: colors.onPrimaryContainer, fontFamily: labelFont }]}>View all</Text>
        </Pressable>
      </View>

      <View style={styles.activityGap}>
        {groupedRecent.map(({ dayKey, items }) => (
          <View key={dayKey} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                {formatDaySectionTitle(dayKey, todayKey, yesterdayKey)}
              </Text>
              <Text style={[styles.dayTotal, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                {format(dayExpenseTotal(items))}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {items.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  subtitle={`${t.categoryName} · ${new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
                  onPress={() =>
                    router.push({
                      pathname: '/add-transaction',
                      params: { id: t.id },
                    } as unknown as Href)
                  }
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loader: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    minHeight: 160,
  },
  bentoIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoKicker: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bentoTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  bentoHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  insightBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '700',
  },
  viewAllHit: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginRight: -8,
  },
  activityGap: {
    gap: 22,
    marginBottom: 8,
  },
  dayBlock: {
    gap: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayTotal: {
    fontSize: 12,
    fontWeight: '700',
  },
});
