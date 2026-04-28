import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useNavigation, router, type Href } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { SwipeableTransactionRow } from '@/components/swipeable-transaction-row';
import { UndoSnackbar } from '@/components/undo-snackbar';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { monthName } from '@/lib/dates';
import { parseTripMetadata } from '@/lib/trip-metadata';
import type { TransactionWithCategory, Trip } from '@/types/finance';
import { effectiveBaseCents } from '@/types/finance';

export default function TripDetailScreen() {
  const { tripId, year: yStr, month: mStr } = useLocalSearchParams<{
    tripId: string;
    year: string;
    month: string;
  }>();
  const navigation = useNavigation();
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { trips, transactions } = useRepositories();

  const year = Number(yStr);
  const month = Number(mStr);
  const valid = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12 && tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [rows, setRows] = useState<TransactionWithCategory[]>([]);
  const [spentToday, setSpentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    transaction: TransactionWithCategory;
  } | null>(null);

  const load = useCallback(async () => {
    if (!valid || !tripId) {
      setLoading(false);
      return;
    }
    const t = await trips.getById(tripId);
    setTrip(t);
    const list = await transactions.listByTripAndMonth(tripId, year, month);
    setRows(list);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const st = await transactions.sumTripExpenseOnLocalDay(tripId, dayStart, dayEnd);
    setSpentToday(st);
    setLoading(false);
  }, [valid, tripId, year, month, trips, transactions]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: trip?.name ?? 'Trip',
    });
  }, [navigation, trip?.name]);

  const meta = useMemo(() => parseTripMetadata(trip?.metadata ?? null), [trip?.metadata]);
  const dailyBudget = meta.dailyBudgetCents;

  const monthExpense = useMemo(
    () => rows.filter((r) => r.type === 'expense').reduce((s, r) => s + effectiveBaseCents(r), 0),
    [rows],
  );

  const avgPerDay = useMemo(() => {
    const days = new Set(rows.filter((r) => r.type === 'expense').map((r) => r.occurredAt.slice(0, 10))).size;
    const d = Math.max(1, days);
    return Math.round(monthExpense / d);
  }, [rows, monthExpense]);

  const byCat = useMemo(() => {
    const m = new Map<string, { name: string; spent: number }>();
    for (const t of rows) {
      if (t.type !== 'expense') continue;
      const prev = m.get(t.categoryId) ?? { name: t.categoryName, spent: 0 };
      prev.spent += effectiveBaseCents(t);
      m.set(t.categoryId, prev);
    }
    return [...m.values()].sort((a, b) => b.spent - a.spent);
  }, [rows]);

  const overspent =
    dailyBudget !== undefined && dailyBudget > 0 && spentToday > dailyBudget ? spentToday - dailyBudget : 0;

  const onDelete = useCallback(
    (id: string) => {
      const txn = rows.find((r) => r.id === id);
      if (!txn) return;
      setRows((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete({ id, transaction: txn });
    },
    [rows],
  );

  const commitDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await transactions.delete(pendingDelete.id);
    setPendingDelete(null);
  }, [pendingDelete, transactions]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    setRows((prev) => {
      const restored = [...prev, pendingDelete.transaction];
      restored.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      return restored;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

  if (!valid) {
    return (
      <ScreenScaffold>
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>Invalid trip link.</Text>
      </ScreenScaffold>
    );
  }

  if (loading) {
    return (
      <ScreenScaffold>
        <ActivityIndicator color={colors.primary} />
      </ScreenScaffold>
    );
  }

  if (!trip) {
    return (
      <ScreenScaffold>
        <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant }}>Trip not found.</Text>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <Text style={[styles.kicker, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
        {monthName(month)} {year}
      </Text>
      <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>{trip.name}</Text>
      <Text style={[styles.meta, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
        {trip.status} · {new Date(trip.startAt).toLocaleDateString()}
        {trip.endAt ? ` → ${new Date(trip.endAt).toLocaleDateString()}` : ''}
      </Text>

      <View style={[styles.statRow, { gap: 12 }]}>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceContainerLowest, flex: 1 }]}>
          <Text style={[styles.statLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>This month</Text>
          <Text style={[styles.statVal, { color: colors.primary, fontFamily: headlineFont }]}>
            {format(monthExpense)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceContainerLowest, flex: 1 }]}>
          <Text style={[styles.statLbl, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Avg / day</Text>
          <Text style={[styles.statVal, { color: colors.chartPeakLabel, fontFamily: headlineFont }]}>
            {format(avgPerDay)}
          </Text>
        </View>
      </View>

      {dailyBudget !== undefined && dailyBudget > 0 ? (
        <View style={[styles.budgetBanner, { backgroundColor: colors.tertiaryFixed }]}>
          <MaterialIcons name="today" size={22} color={colors.insightCardTitle} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: labelFont, fontWeight: '700', color: colors.insightCardTitle }}>
              Today {format(spentToday)} / {format(dailyBudget)} budget
            </Text>
            {overspent > 0 ? (
              <Text style={{ fontFamily: bodyFont, color: colors.error, marginTop: 4 }}>
                Overspent today by {format(overspent)}
              </Text>
            ) : (
              <Text style={{ fontFamily: bodyFont, color: colors.insightCardBody, marginTop: 4 }}>
                On track for your daily budget.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {byCat.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: colors.primary, fontFamily: headlineFont }]}>By category</Text>
          {byCat.map((c) => (
            <View
              key={c.name}
              style={[styles.catRow, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={{ fontFamily: bodyFont, color: colors.onSurface, flex: 1 }}>{c.name}</Text>
              <Text style={{ fontFamily: labelFont, fontWeight: '700', color: colors.onSurface }}>{format(c.spent)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[styles.section, { color: colors.primary, fontFamily: headlineFont }]}>Transactions</Text>
      <View style={[styles.cardShell, { backgroundColor: colors.surfaceContainerLowest }]}>
        {rows.length === 0 ? (
          <Text style={{ padding: 16, fontFamily: bodyFont, color: colors.onSurfaceVariant }}>
            No transactions this month.
          </Text>
        ) : (
          rows.map((t) => (
            <SwipeableTransactionRow
              key={t.id}
              dense
              transaction={t}
              subtitle={`${t.categoryName} · ${new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
              onDelete={onDelete}
            />
          ))
        )}
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
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    marginTop: 6,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  statCard: {
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  statLbl: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  budgetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
  },
  section: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  cardShell: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
  },
});
