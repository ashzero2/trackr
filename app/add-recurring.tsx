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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { lightImpact } from '@/lib/haptics';
import { formatPaymentMethodLabel } from '@/lib/payment-method';
import { computeNextDue, toIsoDate } from '@/lib/recurrence-engine';
import type { Category, EntryType, PaymentMethod, RecurrenceFrequency } from '@/types/finance';

const FREQUENCIES: { key: RecurrenceFrequency; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

const PAYMENTS: PaymentMethod[] = ['CARD', 'CASH', 'ACH', 'OTHER'];

export default function AddRecurringScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useAppColors();
  const { currencyCode } = useFormatMoney();
  const { recurring, categories } = useRepositories();

  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EntryType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [startsAt, setStartsAt] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [autoInsert, setAutoInsert] = useState(false);

  const [catList, setCatList] = useState<Category[]>([]);
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editId ? 'Edit recurring rule' : 'New recurring rule' });
  }, [navigation, editId]);

  useEffect(() => {
    let alive = true;
    categories.listByType(type).then((c) => { if (alive) setCatList(c); });
    return () => { alive = false; };
  }, [categories, type]);

  const load = useCallback(async () => {
    if (!editId) { setLoading(false); return; }
    const rule = await recurring.getById(editId);
    if (rule) {
      setTitle(rule.title);
      setType(rule.type);
      setAmountText((rule.amountCents / 100).toFixed(2));
      setCategoryId(rule.categoryId);
      setPaymentMethod(rule.paymentMethod);
      setNote(rule.note ?? '');
      setFrequency(rule.frequency);
      setStartsAt(new Date(rule.startsAt + 'T00:00:00Z'));
      setAutoInsert(rule.autoInsert);
    }
    setLoading(false);
  }, [editId, recurring]);

  useEffect(() => { void load(); }, [load]);

  const selectedCategory = useMemo(
    () => (categoryId ? catList.find((c) => c.id === categoryId) ?? null : null),
    [categoryId, catList],
  );

  const onSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Enter a title.'); return; }
    const parsed = Number.parseFloat(amountText.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('Enter a valid amount.'); return; }
    if (!categoryId) { setError('Choose a category.'); return; }

    const amountCents = Math.round(parsed * 100);
    const startsAtIso = toIsoDate(startsAt);
    // First due = starts_at itself
    const nextDueAt = editId
      ? (await recurring.getById(editId))?.nextDueAt ?? startsAtIso
      : startsAtIso;

    setSaving(true);
    try {
      if (editId) {
        await recurring.update(editId, {
          title: title.trim(),
          amountCents,
          type,
          categoryId,
          paymentMethod,
          note: note.trim() || null,
          frequency,
          startsAt: startsAtIso,
          autoInsert,
        });
      } else {
        await recurring.insert({
          id: await Crypto.randomUUID(),
          title: title.trim(),
          amountCents,
          type,
          categoryId,
          paymentMethod,
          note: note.trim() || null,
          currencyCode,
          frequency,
          dayOfMonth: frequency === 'monthly' ? startsAt.getUTCDate() : null,
          dayOfWeek: (frequency === 'weekly' || frequency === 'biweekly') ? startsAt.getUTCDay() : null,
          startsAt: startsAtIso,
          endsAt: null,
          nextDueAt,
          autoInsert,
          lastInsertedAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      lightImpact();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
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

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Rent, Netflix"
          placeholderTextColor={colors.onSurfaceVariant}
          autoFocus={!editId}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont }]}
        />

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Type</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerHighest }]}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
              onPress={() => { setType(t); setCategoryId(null); }}
              style={[styles.segBtn, type === t && { backgroundColor: colors.primary }]}>
              <Text style={[styles.segText, { color: type === t ? colors.onPrimary : colors.onSurface, fontFamily: labelFont }]}>
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
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont }]}
        />

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Category</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedCategory ? `Category ${selectedCategory.name}` : 'Select category'}
          onPress={() => setCatPickerOpen(true)}
          style={[styles.input, styles.pickerTrigger, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={{ color: selectedCategory ? colors.onSurface : colors.onSurfaceVariant, fontFamily: bodyFont }}>
            {selectedCategory?.name ?? 'Select category'}
          </Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Frequency</Text>
        <View style={styles.freqRow}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: frequency === f.key }}
              onPress={() => setFrequency(f.key)}
              style={[
                styles.freqChip,
                { backgroundColor: frequency === f.key ? colors.primary : colors.surfaceContainerHigh },
              ]}>
              <Text style={{ fontFamily: labelFont, fontSize: 12, fontWeight: '700', color: frequency === f.key ? colors.onPrimary : colors.onSurfaceVariant }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
          {editId ? 'Start date' : 'First due date'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Date ${startsAt.toLocaleDateString()}`}
          onPress={() => setShowDate(true)}
          style={[styles.input, styles.pickerTrigger, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={{ color: colors.onSurface, fontFamily: bodyFont }}>
            {startsAt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </Pressable>

        {showDate && Platform.OS === 'android' ? (
          <DateTimePicker
            value={startsAt}
            mode="date"
            display="default"
            onChange={(_, d) => { setShowDate(false); if (d) setStartsAt(d); }}
          />
        ) : null}
        {showDate && Platform.OS === 'ios' ? (
          <View style={styles.iosDateWrap}>
            <DateTimePicker
              value={startsAt}
              mode="date"
              display="spinner"
              onChange={(_, d) => { if (d) setStartsAt(d); }}
            />
            <Pressable onPress={() => setShowDate(false)} style={[styles.iosDone, { backgroundColor: colors.primary }]}>
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
              onPress={() => setPaymentMethod(p)}
              style={[styles.payChip, { backgroundColor: paymentMethod === p ? colors.primary : colors.surfaceContainerHigh }]}>
              <Text style={{ color: paymentMethod === p ? colors.onPrimary : colors.onSecondaryContainer, fontFamily: labelFont, fontSize: 12, fontWeight: '600' }}>
                {formatPaymentMethodLabel(p)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Monthly rent"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, fontFamily: bodyFont }]}
        />

        <View style={[styles.switchRow, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontWeight: '700' }}>Auto-log</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: bodyFont, fontSize: 12, marginTop: 2 }}>
              Insert silently without asking for confirmation
            </Text>
          </View>
          <Switch
            value={autoInsert}
            onValueChange={setAutoInsert}
            trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
            thumbColor={autoInsert ? colors.primary : colors.surfaceContainerLowest}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editId ? 'Save changes' : 'Save recurring rule'}
          onPress={() => void onSave()}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.onPrimary, fontFamily: headlineFont }]}>Save</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={catPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setCatPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>Category</Text>
            <FlatList
              data={catList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalRow, { borderBottomColor: colors.outlineVariant }]}
                  onPress={() => { setCategoryId(item.id); setCatPickerOpen(false); }}>
                  <Text style={{ color: colors.onSurface, fontFamily: bodyFont, fontSize: 16 }}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40, gap: 8 },
  label: { fontSize: 12, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginTop: 6 },
  pickerTrigger: { justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  segBtn: { flex: 1, minHeight: MIN_TOUCH_TARGET, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontWeight: '600' },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  freqChip: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, justifyContent: 'center' },
  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  payChip: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginTop: 12 },
  saveBtn: { marginTop: 24, borderRadius: 999, minHeight: MIN_TOUCH_TARGET, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 17, fontWeight: '700' },
  error: { marginBottom: 8, fontSize: 14 },
  iosDateWrap: { marginTop: 8 },
  iosDone: { marginTop: 8, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  modalRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
