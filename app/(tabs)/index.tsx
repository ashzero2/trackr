import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { SkeletonCard, SkeletonTransactionRow } from '@/components/skeleton';
import { UndoSnackbar } from '@/components/undo-snackbar';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { DashboardHeroCard } from '@/components/gradient-hero-preview';
import { FabGradient } from '@/components/fab-gradient';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SwipeableTransactionRow } from '@/components/swipeable-transaction-row';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useFormatMoney } from '@/hooks/use-format-money';
import { computeMonthInsight, computeVelocityInsight } from '@/lib/analytics-buckets';
import { addUtcMonths, formatDaySectionTitle, localDayKey } from '@/lib/dates';
import { groupByLocalDay, dayExpenseTotal } from '@/lib/transaction-utils';
import type { Budget, MonthSummary, TransactionWithCategory } from '@/types/finance';

function matchesQuery(t: TransactionWithCategory, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  const amountStr = (t.amountCents / 100).toFixed(2);
  return (
    t.categoryName.toLowerCase().includes(s) ||
    (t.note?.toLowerCase().includes(s) ?? false) ||
    t.paymentMethod.toLowerCase().includes(s) ||
    amountStr.includes(s) ||
    amountStr.replace('.', '').startsWith(s.replace('.', ''))
  );
}

function utcYearMonth(): { y: number; m: number } {
  const n = new Date();
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1 };
}

export default function DashboardScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { ready, error, transactions, budgets, dataVersion } = useDatabase();
  const lastSeenVersion = useRef(-1);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null);
  const [recent, setRecent] = useState<TransactionWithCategory[]>([]);
  const [byCat, setByCat] = useState<{ categoryId: string; categoryName: string; spentCents: number }[]>([]);
  const [budgetRows, setBudgetRows] = useState<Budget[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

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
        // Only re-query SQLite when data has actually changed since last render
        if (dataVersion !== lastSeenVersion.current) {
          lastSeenVersion.current = dataVersion;
          load();
        }
      }
    }, [ready, transactions, budgets, load, dataVersion]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force a reload regardless of dataVersion
    lastSeenVersion.current = -1;
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Undo-able delete ──
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    transaction: TransactionWithCategory;
  } | null>(null);

  const onDelete = useCallback(
    (id: string) => {
      const txn = recent.find((r) => r.id === id);
      if (!txn) return;
      // Optimistically remove from UI
      setRecent((prev) => prev.filter((r) => r.id !== id));
      // Stage for delayed deletion
      setPendingDelete({ id, transaction: txn });
    },
    [recent],
  );

  const commitDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await transactions?.delete(pendingDelete.id);
    setPendingDelete(null);
  }, [pendingDelete, transactions]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    // Restore the transaction to the list
    setRecent((prev) => {
      const restored = [...prev, pendingDelete.transaction];
      restored.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      return restored;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

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

  const insightText = useMemo(
    () => computeMonthInsight(byCat, summary?.totalExpenseCents ?? 0),
    [summary, byCat],
  );

  const velocity = useMemo(() => {
    const { y, m } = utcYearMonth();
    return computeVelocityInsight(
      y, m,
      summary?.totalExpenseCents ?? 0,
      prevSummary?.totalExpenseCents ?? 0,
    );
  }, [summary, prevSummary]);

  const todayKey = localDayKey(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = localDayKey(yest);

  const filteredRecent = useMemo(
    () => (query.trim() ? recent.filter((t) => matchesQuery(t, query)) : recent),
    [recent, query],
  );

  const groupedRecent = useMemo(() => groupByLocalDay(filteredRecent), [filteredRecent]);

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
          <SkeletonCard height={160} />
          <View style={{ gap: 4, marginTop: 16 }}>
            <SkeletonTransactionRow />
            <SkeletonTransactionRow />
            <SkeletonTransactionRow />
          </View>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      contentBottomExtra={72}
      refreshing={refreshing}
      onRefresh={() => { void onRefresh(); }}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Search recent transactions'}
          onPress={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(''); }}
          style={[styles.searchBtn, { backgroundColor: searchOpen ? colors.primaryContainer : colors.surfaceContainerLow }]}>
          <MaterialIcons
            name={searchOpen ? 'close' : 'search'}
            size={20}
            color={searchOpen ? colors.onPrimaryContainer : colors.primary}
          />
        </Pressable>
      }
      fab={
        <FabGradient
          accessibilityLabel="Add transaction"
          onPress={() => router.push('/add-transaction')}
        />
      }>
      <DashboardHeroCard
        monthlyExpenseCents={summary?.totalExpenseCents ?? 0}
        monthlyIncomeCents={summary?.totalIncomeCents ?? 0}
        loading={summary === null}
        vsLastMonthPercent={vsLastMonthPercent}
      />

      {velocity ? (
        <View style={[styles.velocityRow, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="trending-up" size={16} color={colors.onSurfaceVariant} />
          <Text style={[styles.velocityText, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            On pace for{' '}
            <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{format(velocity.projectedCents)}</Text>
            {' '}this month
            {velocity.vsLastMonthPct !== null
              ? `  ${velocity.vsLastMonthPct >= 0 ? '↑' : '↓'}${Math.abs(velocity.vsLastMonthPct)}% vs last month`
              : null}
          </Text>
        </View>
      ) : null}

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set up a budget"
              onPress={() => router.push('/manage-budgets')}
              style={styles.emptyBudgetLink}>
              <Text style={[styles.bentoHint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
                No category budgets yet.
              </Text>
              <Text style={[styles.bentoHint, { color: colors.primary, fontFamily: bodyFont, fontWeight: '700', marginTop: 4 }]}>
                Set up a budget →
              </Text>
            </Pressable>
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

      {searchOpen ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search transactions…"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[
            styles.searchInput,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLowest,
              fontFamily: bodyFont,
            },
          ]}
        />
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.primary, fontFamily: headlineFont }]}>
          {query.trim() ? 'Search results' : 'Recent activity'}
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
        {groupedRecent.length === 0 && (
          <EmptyState
            icon="receipt-long"
            title="Nothing logged yet"
            subtitle="Tap + to add your first transaction"
            actionLabel="Add transaction"
            onAction={() => router.push('/add-transaction')}
          />
        )}
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
                <SwipeableTransactionRow
                  key={t.id}
                  transaction={t}
                  subtitle={`${t.categoryName} · ${new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
                  onDelete={onDelete}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {pendingDelete ? (
        <UndoSnackbar
          id={pendingDelete.id}
          message="Transaction deleted"
          onExpire={commitDelete}
          onUndo={undoDelete}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loader: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  velocityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  velocityText: {
    fontSize: 13,
    flex: 1,
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
  emptyBudgetLink: {
    flex: 1,
  },
  searchBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 4,
  },
});
