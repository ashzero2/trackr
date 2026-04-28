import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { FabGradient } from '@/components/fab-gradient';
import { UndoSnackbar } from '@/components/undo-snackbar';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SwipeableTransactionRow } from '@/components/swipeable-transaction-row';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { elapsedDaysInUtcMonth, formatDaySectionTitle, localDayKey, monthName, utcCalendarMonthNow } from '@/lib/dates';
import { groupByLocalDay, dayExpenseTotal } from '@/lib/transaction-utils';
import { exportTransactionsCsv } from '@/lib/export-csv';
import { useFormatMoney } from '@/hooks/use-format-money';
import type { TransactionWithCategory, TripMonthActivity } from '@/types/finance';

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

export default function HistoryScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { ready, error, transactions, trips } = useDatabase();
  const startYm = utcCalendarMonthNow();
  const [year, setYear] = useState(startYm.year);
  const [month, setMonth] = useState(startYm.month);
  const [segment, setSegment] = useState<'other' | 'trips'>('other');
  const [rows, setRows] = useState<TransactionWithCategory[]>([]);
  const [tripRows, setTripRows] = useState<TripMonthActivity[]>([]);
  const [yearModal, setYearModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!transactions || !trips) return;
    const [otherList, tTrips] = await Promise.all([
      transactions.listByMonthWithoutTrip(year, month),
      trips.listTripsWithActivityInMonth(year, month),
    ]);
    setRows(otherList);
    setTripRows(tTrips);
  }, [transactions, trips, year, month]);

  useFocusEffect(
    useCallback(() => {
      if (ready && transactions && trips) load();
    }, [ready, transactions, trips, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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
      const txn = rows.find((r) => r.id === id);
      if (!txn) return;
      // Optimistically remove from UI
      setRows((prev) => prev.filter((r) => r.id !== id));
      // Stage for delayed deletion
      setPendingDelete({ id, transaction: txn });
    },
    [rows],
  );

  const commitDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await transactions?.delete(pendingDelete.id);
    setPendingDelete(null);
  }, [pendingDelete, transactions]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    // Restore the transaction to the list
    setRows((prev) => {
      const restored = [...prev, pendingDelete.transaction];
      restored.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      return restored;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.categoryId, r.categoryName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows
        .filter((t) => matchesQuery(t, query))
        .filter((t) => !categoryFilter || t.categoryId === categoryFilter),
    [rows, query, categoryFilter],
  );

  const filteredTrips = useMemo(() => {
    if (!query.trim()) return tripRows;
    const q = query.toLowerCase();
    return tripRows.filter((t) => t.name.toLowerCase().includes(q));
  }, [tripRows, query]);

  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0),
    [filtered],
  );

  const tripsMonthExpense = useMemo(
    () => filteredTrips.reduce((s, t) => s + t.monthExpenseCents, 0),
    [filteredTrips],
  );

  const displayExpense = segment === 'other' ? totalExpense : tripsMonthExpense;

  const avgDaily = useMemo(() => {
    const elapsed = elapsedDaysInUtcMonth(year, month);
    return elapsed > 0 ? Math.round(displayExpense / elapsed) : 0;
  }, [displayExpense, year, month]);

  const grouped = useMemo(() => groupByLocalDay(filtered), [filtered]);

  const todayKey = localDayKey(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = localDayKey(yest);

  if (error) {
    return (
      <ScreenScaffold>
        <Text style={{ fontFamily: bodyFont, color: colors.error }}>{error.message}</Text>
      </ScreenScaffold>
    );
  }

  if (!ready || !transactions || !trips) {
    return (
      <ScreenScaffold>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenScaffold>
    );
  }

  const headerRight = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Export transactions as CSV"
        onPress={() => {
          const filename = `trackr-${year}-${String(month).padStart(2, '0')}.csv`;
          void exportTransactionsCsv(segment === 'other' ? filtered : [], filename);
        }}
        style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerLow }]}
        hitSlop={MIN_TOUCH_TARGET}>
        <MaterialIcons name="download" size={20} color={colors.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={searchOpen ? 'Close search' : 'Search transactions'}
        onPress={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(''); }}
        style={[styles.iconBtn, { backgroundColor: searchOpen ? colors.primaryContainer : colors.surfaceContainerLow }]}
        hitSlop={MIN_TOUCH_TARGET}>
        <MaterialIcons name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.onPrimaryContainer : colors.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select year, currently ${year}`}
        onPress={() => setYearModal(true)}
        style={[styles.yearBtn, { backgroundColor: colors.surfaceContainerLow }]}>
        <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>{year}</Text>
        <MaterialIcons name="expand-more" size={20} color={colors.primary} importantForAccessibility="no" />
      </Pressable>
    </>
  );

  return (
    <ScreenScaffold
      headerTitle="History"
      headerRight={headerRight}
      contentBottomExtra={72}
      refreshing={refreshing}
      onRefresh={() => { void onRefresh(); }}
      fab={
        <FabGradient
          accessibilityLabel="Add transaction"
          onPress={() => router.push('/add-transaction')}
        />
      }>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthScroll}
        style={{ marginHorizontal: -24, marginBottom: 16 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const active = m === month;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${monthName(m)} ${year}`}
              onPress={() => setMonth(m)}
              style={[
                styles.monthChip,
                active
                  ? { backgroundColor: colors.primaryContainer }
                  : { backgroundColor: colors.surfaceContainerHigh },
              ]}>
              <Text
                style={{
                  color: active ? colors.onPrimary : colors.secondary,
                  fontFamily: active ? labelFont : bodyFont,
                  fontWeight: active ? '800' : '600',
                  fontSize: 13,
                }}>
                {monthName(m).slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.segment, { backgroundColor: colors.surfaceContainerHigh, marginBottom: 12 }]}>
        {(['other', 'trips'] as const).map((seg) => (
          <Pressable
            key={seg}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === seg }}
            onPress={() => setSegment(seg)}
            style={[
              styles.segChip,
              segment === seg && { backgroundColor: colors.primaryContainer },
            ]}>
            <Text
              style={{
                fontFamily: labelFont,
                fontWeight: '700',
                fontSize: 13,
                color: segment === seg ? colors.onPrimaryContainer : colors.onSurfaceVariant,
              }}>
              {seg === 'other' ? 'Everyday' : 'Trips'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.statKicker, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {segment === 'other' ? 'Total spending' : 'Trip spending'}
          </Text>
          <Text style={[styles.statValue, { color: colors.primary, fontFamily: headlineFont }]}>
            {format(displayExpense)}
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surfaceContainerLowest, borderLeftWidth: 4, borderLeftColor: colors.tertiaryFixedDim },
          ]}>
          <Text style={[styles.statKicker, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            Avg. daily
          </Text>
          <Text style={[styles.statValue, { color: colors.chartPeakLabel, fontFamily: headlineFont }]}>
            {format(avgDaily)}
          </Text>
        </View>
      </View>

      {searchOpen ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchant, category, amount…"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[
            styles.search,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLowest,
              fontFamily: bodyFont,
            },
          ]}
        />
      ) : null}

      {segment === 'other' && categoryOptions.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
          style={{ marginHorizontal: -24, marginBottom: 8 }}>
          {[{ id: null, name: 'All' }, ...categoryOptions].map((c) => {
            const active = categoryFilter === c.id;
            return (
              <Pressable
                key={c.id ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryFilter(c.id)}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.secondaryContainer : colors.surfaceContainerHigh },
                ]}>
                <Text style={{ fontFamily: labelFont, fontWeight: '700', fontSize: 12, color: active ? colors.onSecondaryContainer : colors.onSurfaceVariant }}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ gap: 24, marginTop: 8 }}>
        {segment === 'trips' ? (
          filteredTrips.length === 0 ? (
            <EmptyState
              icon="flight"
              title="No trips this month"
              subtitle="Transactions linked to a trip will show up here. Start a trip from Settings → Travel to track spending on your next journey."
            />
          ) : (
            filteredTrips.map((t) => (
              <Pressable
                key={t.id}
                onPress={() =>
                  router.push({
                    pathname: '/trip-detail',
                    params: { tripId: t.id, year: String(year), month: String(month) },
                  })
                }
                style={[styles.tripCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.onSurface }}>
                    {t.name}
                  </Text>
                  <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, marginTop: 4 }}>
                    {t.status} · {t.monthTxnCount} txn{t.monthTxnCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.primary }}>
                  {format(t.monthExpenseCents)}
                </Text>
              </Pressable>
            ))
          )
        ) : grouped.length === 0 ? (
          <EmptyState
            icon="receipt-long"
            title={`No transactions in ${monthName(month)} ${year}`}
            subtitle={query ? 'Try a different search term or clear filters' : 'Tap + to log a transaction'}
          />
        ) : (
          grouped.map(({ dayKey, items }) => (
            <View key={dayKey}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                  {formatDaySectionTitle(dayKey, todayKey, yesterdayKey)}
                </Text>
                <Text style={[styles.dayTotal, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                  {format(dayExpenseTotal(items))}
                </Text>
              </View>
              <View style={[styles.cardShell, { backgroundColor: colors.surfaceContainerLowest }]}>
                {items.map((t) => (
                  <SwipeableTransactionRow
                    key={t.id}
                    dense
                    transaction={t}
                    subtitle={`${t.categoryName} · ${new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
                    onDelete={onDelete}
                  />
                ))}
              </View>
            </View>
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

      <Modal visible={yearModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setYearModal(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Jump to month
            </Text>

            {/* Year row with arrows */}
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

            {/* Month grid */}
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
                      setYearModal(false);
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
              onPress={() => setYearModal(false)}
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
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterChipsRow: {
    paddingHorizontal: 24,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  monthScroll: {
    paddingHorizontal: 24,
    gap: 10,
    alignItems: 'center',
  },
  monthChip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  statKicker: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  search: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
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
  cardShell: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '50%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  yearRow: {
    paddingVertical: 14,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  segChip: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 12,
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
