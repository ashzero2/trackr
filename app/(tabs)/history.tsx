import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FabGradient } from '@/components/fab-gradient';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { TransactionRow } from '@/components/transaction-row';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useDatabase } from '@/contexts/database-context';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { daysInUtcMonth, formatDaySectionTitle, localDayKey, monthName, parseIsoToLocalDayKey, utcCalendarMonthNow } from '@/lib/dates';
import { useFormatMoney } from '@/hooks/use-format-money';
import type { TransactionWithCategory, TripMonthActivity } from '@/types/finance';

function groupByLocalDay(items: TransactionWithCategory[]): { dayKey: string; items: TransactionWithCategory[] }[] {
  const map = new Map<string, TransactionWithCategory[]>();
  for (const t of items) {
    const k = parseIsoToLocalDayKey(t.occurredAt);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const keys = [...map.keys()].sort((a, b) => (a > b ? -1 : 1));
  return keys.map((dayKey) => ({ dayKey, items: map.get(dayKey)! }));
}

function dayExpenseTotal(items: TransactionWithCategory[]): number {
  return items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);
}

function matchesQuery(t: TransactionWithCategory, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return (
    t.categoryName.toLowerCase().includes(s) ||
    (t.note?.toLowerCase().includes(s) ?? false) ||
    t.paymentMethod.toLowerCase().includes(s)
  );
}

const YEAR_OPTIONS = Array.from({ length: 18 }, (_, i) => 2018 + i);

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

  const filtered = useMemo(() => rows.filter((t) => matchesQuery(t, query)), [rows, query]);

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
  const displayAvgBase = segment === 'other' ? totalExpense : tripsMonthExpense;

  const avgDaily = useMemo(() => {
    const dim = daysInUtcMonth(year, month);
    return dim > 0 ? Math.round(displayAvgBase / dim) : 0;
  }, [displayAvgBase, year, month]);

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

  return (
    <ScreenScaffold
      contentBottomExtra={72}
      fab={
        <FabGradient
          icon="search"
          accessibilityLabel="Search transactions"
          onPress={() => setSearchOpen((o) => !o)}
        />
      }>
      <View style={styles.titleRow}>
        <Text style={[styles.pageTitle, { color: colors.primary, fontFamily: headlineFont }]}>
          Transaction history
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select year, currently ${year}`}
          onPress={() => setYearModal(true)}
          style={[styles.yearBtn, { backgroundColor: colors.surfaceContainerLow }]}>
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>{year}</Text>
          <MaterialIcons name="expand-more" size={20} color={colors.primary} importantForAccessibility="no" />
        </Pressable>
      </View>

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
              {seg === 'other' ? 'Other expenses' : 'Trips'}
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
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchant, category, payment…"
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

      <View style={{ gap: 24, marginTop: 8 }}>
        {segment === 'trips' ? (
          filteredTrips.length === 0 ? (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont }}>
              No trip-linked transactions this month.
            </Text>
          ) : (
            filteredTrips.map((t) => (
              <Pressable
                key={t.id}
                onPress={() =>
                  router.push({
                    pathname: '/trip-detail',
                    params: { tripId: t.id, year: String(year), month: String(month) },
                  } as unknown as Href)
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
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont }}>
            No everyday (non-trip) transactions this month.
          </Text>
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
                  <TransactionRow
                    key={t.id}
                    dense
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
          ))
        )}
      </View>

      <Modal visible={yearModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setYearModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>Year</Text>
            <FlatList
              data={YEAR_OPTIONS}
              keyExtractor={(y) => String(y)}
              renderItem={({ item: y }) => (
                <Pressable
                  style={styles.yearRow}
                  onPress={() => {
                    setYear(y);
                    setYearModal(false);
                  }}>
                  <Text style={{ fontFamily: bodyFont, fontSize: 17, color: colors.onSurface }}>{y}</Text>
                </Pressable>
              )}
            />
          </View>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
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
});
