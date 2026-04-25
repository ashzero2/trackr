import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { lightImpact } from '@/lib/haptics';
import type { Category, EntryType, PaymentMethod, Trip } from '@/types/finance';
import { formatPaymentMethodLabel } from '@/lib/payment-method';

const PAYMENTS: PaymentMethod[] = ['CARD', 'CASH', 'ACH', 'OTHER'];

export default function AddTransactionScreen() {
  const { id: editId, duplicate: duplicateId } = useLocalSearchParams<{ id?: string; duplicate?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useAppColors();
  const { currencyCode } = useFormatMoney();
  const { travelModeEnabled, activeTripId, currencyCode: profileCurrency, setProfile } = useUserProfile();
  const { transactions, categories, trips } = useRepositories();

  const [loading, setLoading] = useState(!!(editId || duplicateId));
  const [type, setType] = useState<EntryType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catList, setCatList] = useState<Category[]>([]);
  const [tripList, setTripList] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [newTripModalOpen, setNewTripModalOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');

  useEffect(() => {
    let alive = true;
    categories.listByType(type).then((c) => {
      if (alive) setCatList(c);
    });
    return () => {
      alive = false;
    };
  }, [categories, type]);

  useEffect(() => {
    let alive = true;
    trips.listForTransactionPicker().then((list) => {
      if (alive) setTripList(list);
    });
    return () => {
      alive = false;
    };
  }, [trips]);

  useEffect(() => {
    if (editId || duplicateId) return;
    if (!travelModeEnabled) {
      setSelectedTripId(null);
      return;
    }
    let alive = true;
    (async () => {
      if (!activeTripId) {
        if (alive) setSelectedTripId(null);
        return;
      }
      const t = await trips.getById(activeTripId);
      if (!alive) return;
      if (t?.status === 'ACTIVE') {
        setSelectedTripId(activeTripId);
      } else {
        setSelectedTripId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId, duplicateId, travelModeEnabled, activeTripId, trips]);

  const load = useCallback(async () => {
    const sourceId = editId ?? duplicateId;
    if (!sourceId) {
      setLoading(false);
      return;
    }
    const row = await transactions.getById(sourceId);
    if (row) {
      setType(row.type);
      setAmountText((row.amountCents / 100).toFixed(2));
      setCategoryId(row.categoryId);
      setNote(row.note ?? '');
      setPaymentMethod(row.paymentMethod);
      // For duplicate: use today's date instead of the original
      setOccurredAt(duplicateId ? new Date() : new Date(row.occurredAt));
      setSelectedTripId(row.tripId);
    }
    setLoading(false);
  }, [editId, duplicateId, transactions]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editId ? 'Edit transaction' : duplicateId ? 'Duplicate transaction' : 'Add transaction',
    });
  }, [navigation, editId, duplicateId]);

  const selectedCategory = categoryId ? catList.find((c) => c.id === categoryId) ?? null : null;

  const selectedTripLabel = useMemo(() => {
    if (!selectedTripId) return 'None — everyday spending';
    const t = tripList.find((x) => x.id === selectedTripId);
    if (t) return `${t.name} (${t.status})`;
    return 'Trip selected';
  }, [selectedTripId, tripList]);

  const tripPickerRows = useMemo(() => {
    const rows: ({ rowKey: string; kind: 'none' } | { rowKey: string; kind: 'new' } | { rowKey: string; kind: 'trip'; trip: Trip })[] = [
      { rowKey: 'none', kind: 'none' },
    ];
    for (const t of tripList) rows.push({ rowKey: t.id, kind: 'trip', trip: t });
    rows.push({ rowKey: 'new', kind: 'new' });
    return rows;
  }, [tripList]);

  async function confirmIfFinishedTrip(tripId: string | null): Promise<boolean> {
    if (!tripId) return true;
    const tr = await trips.getById(tripId);
    if (!tr || (tr.status !== 'COMPLETED' && tr.status !== 'ARCHIVED')) return true;
    return new Promise((resolve) => {
      Alert.alert(
        'Attach to finished trip?',
        'This trip is no longer active. Continue and link this transaction to it?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ],
      );
    });
  }

  const onCreateQuickTrip = async () => {
    const n = newTripName.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter a short name for this trip.');
      return;
    }
    setSaving(true);
    try {
      const id = await Crypto.randomUUID();
      const iso = new Date().toISOString();
      await trips.insert({
        id,
        name: n,
        startAt: iso,
        endAt: null,
        status: 'ACTIVE',
        metadata: null,
      });
      await setProfile({ activeTripId: id, travelModeEnabled: true });
      const list = await trips.listForTransactionPicker();
      setTripList(list);
      setSelectedTripId(id);
      setNewTripModalOpen(false);
      setNewTripName('');
    } catch (e) {
      Alert.alert('Could not create trip', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const persistTxn = async (cents: number, iso: string, tripId: string | null, catId: string) => {
    const cur = profileCurrency;
    if (editId) {
      await transactions.update(editId, {
        amountCents: cents,
        type,
        categoryId: catId,
        occurredAt: iso,
        note: note.trim() || null,
        paymentMethod,
        tripId,
        currencyCode: cur,
        amountBaseCents: cents,
        exchangeRateToBase: 1,
      });
    } else {
      await transactions.insert({
        id: await Crypto.randomUUID(),
        amountCents: cents,
        type,
        categoryId: catId,
        occurredAt: iso,
        note: note.trim() || null,
        paymentMethod,
        tripId,
        currencyCode: cur,
        amountBaseCents: cents,
        exchangeRateToBase: 1,
      });
    }
    lightImpact();
    router.back();
  };

  const onSave = async () => {
    setError(null);
    const parsed = Number.parseFloat(amountText.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Choose a category.');
      return;
    }
    const catId = categoryId;
    const cents = Math.round(parsed * 100);
    const iso = occurredAt.toISOString();
    const tripId = selectedTripId;
    const okTrip = await confirmIfFinishedTrip(tripId);
    if (!okTrip) return;

    setSaving(true);
    try {
      await persistTxn(cents, iso, tripId, catId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editId) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await transactions.delete(editId);
            lightImpact();
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {error ? (
          <Text style={[styles.error, { color: colors.error, fontFamily: bodyFont }]}>{error}</Text>
        ) : null}

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Type</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerHighest }]}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
              accessibilityLabel={t === 'expense' ? 'Expense' : 'Income'}
              onPress={() => {
                setType(t);
                setCategoryId(null);
              }}
              style={[styles.segBtn, type === t && { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.segText,
                  {
                    color: type === t ? colors.onPrimary : colors.onSurface,
                    fontFamily: labelFont,
                  },
                ]}>
                {t === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
          Amount ({currencyCode})
        </Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.onSurfaceVariant}
          autoFocus={!editId}
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLowest,
              fontFamily: bodyFont,
            },
          ]}
        />

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Category</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedCategory ? `Category ${selectedCategory.name}` : 'Select category'}
          accessibilityHint="Opens a list of categories"
          onPress={() => setPickerOpen(true)}
          style={[
            styles.input,
            styles.pickerTrigger,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}>
          <Text style={{ color: selectedCategory ? colors.onSurface : colors.onSurfaceVariant, fontFamily: bodyFont }}>
            {selectedCategory?.name ?? 'Select category'}
          </Text>
        </Pressable>

        {travelModeEnabled ? (
          <>
            <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Trip</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont, fontSize: 12, marginTop: 4 }}>
              Only ACTIVE trips auto-fill. You can override for each transaction.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Trip ${selectedTripLabel}`}
              onPress={() => setTripPickerOpen(true)}
              style={[
                styles.input,
                styles.pickerTrigger,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}>
              <Text style={{ color: colors.onSurface, fontFamily: bodyFont }}>{selectedTripLabel}</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Merchant / note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional description"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLowest,
              fontFamily: bodyFont,
            },
          ]}
        />

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Date</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Transaction date ${occurredAt.toLocaleDateString()}`}
          accessibilityHint="Change the transaction date"
          onPress={() => setShowDate(true)}
          style={[
            styles.input,
            styles.pickerTrigger,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}>
          <Text style={{ color: colors.onSurface, fontFamily: bodyFont }}>
            {occurredAt.toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </Pressable>

        {showDate && Platform.OS === 'android' ? (
          <DateTimePicker
            value={occurredAt}
            mode="date"
            display="default"
            onChange={(_, d) => {
              setShowDate(false);
              if (d) setOccurredAt(d);
            }}
          />
        ) : null}
        {showDate && Platform.OS === 'ios' ? (
          <View style={styles.iosDateWrap}>
            <DateTimePicker
              value={occurredAt}
              mode="date"
              display="spinner"
              onChange={(_, d) => {
                if (d) setOccurredAt(d);
              }}
            />
            <Pressable
              onPress={() => setShowDate(false)}
              style={[styles.iosDone, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Payment</Text>
        <View style={styles.payRow}>
          {PAYMENTS.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === p }}
              accessibilityLabel={`Payment method ${formatPaymentMethodLabel(p)}`}
              onPress={() => setPaymentMethod(p)}
              style={[
                styles.payChip,
                {
                  backgroundColor: paymentMethod === p ? colors.primary : colors.surfaceContainerHigh,
                },
              ]}>
              <Text
                style={{
                  color: paymentMethod === p ? colors.onPrimary : colors.onSecondaryContainer,
                  fontFamily: labelFont,
                  fontSize: 12,
                  fontWeight: '600',
                }}>
                {formatPaymentMethodLabel(p)}
              </Text>
            </Pressable>
          ))}
        </View>

        {editId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete transaction"
            onPress={onDelete}
            disabled={saving}
            style={[styles.deleteBtn, { borderColor: colors.error, opacity: saving ? 0.5 : 1 }]}>
            <Text style={[styles.deleteText, { color: colors.error, fontFamily: labelFont }]}>
              Delete transaction
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editId ? 'Save changes' : 'Save transaction'}
          onPress={onSave}
          disabled={saving}
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
          ]}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.onPrimary, fontFamily: headlineFont }]}>
              Save
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Category
            </Text>
            <FlatList
              data={catList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                  onPress={() => {
                    setCategoryId(item.id);
                    setPickerOpen(false);
                  }}>
                  <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={tripPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setTripPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>Trip</Text>
            <FlatList
              data={tripPickerRows}
              keyExtractor={(item) => item.rowKey}
              renderItem={({ item }) => {
                if (item.kind === 'none') {
                  return (
                    <Pressable
                      style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                      onPress={() => {
                        setSelectedTripId(null);
                        setTripPickerOpen(false);
                      }}>
                      <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>
                        None — everyday spending
                      </Text>
                    </Pressable>
                  );
                }
                if (item.kind === 'new') {
                  return (
                    <Pressable
                      style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                      onPress={() => {
                        setTripPickerOpen(false);
                        setNewTripModalOpen(true);
                      }}>
                      <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700', fontSize: 16 }}>
                        + Start new trip
                      </Text>
                    </Pressable>
                  );
                }
                const t = item.trip;
                return (
                  <Pressable
                    style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                    onPress={() => {
                      setSelectedTripId(t.id);
                      setTripPickerOpen(false);
                    }}>
                    <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>
                      {t.name} · {t.status}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={newTripModalOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setNewTripModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>New trip</Text>
            <TextInput
              value={newTripName}
              onChangeText={setNewTripName}
              placeholder="Trip name"
              placeholderTextColor={colors.onSurfaceVariant}
              style={[
                styles.input,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <Pressable
              onPress={() => void onCreateQuickTrip()}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 16 }]}>
              <Text style={{ color: colors.onPrimary, fontFamily: headlineFont, fontWeight: '700' }}>Create & set active</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },
  segBtn: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginTop: 6,
  },
  pickerTrigger: {
    justifyContent: 'center',
  },
  payRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  payChip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  deleteBtn: {
    marginTop: 28,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 17,
    fontWeight: '700',
  },
  error: {
    marginBottom: 8,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosDateWrap: {
    marginTop: 8,
  },
  iosDone: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
