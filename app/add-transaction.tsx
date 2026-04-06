import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFormatMoney } from '@/hooks/use-format-money';
import { lightImpact } from '@/lib/haptics';
import type { Category, EntryType, PaymentMethod } from '@/types/finance';

const PAYMENTS: PaymentMethod[] = ['VISA', 'CASH', 'ACH', 'OTHER'];

export default function AddTransactionScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useAppColors();
  const { currencyCode } = useFormatMoney();
  const { transactions, categories } = useRepositories();

  const [loading, setLoading] = useState(!!editId);
  const [type, setType] = useState<EntryType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('VISA');
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catList, setCatList] = useState<Category[]>([]);

  useEffect(() => {
    let alive = true;
    categories.listByType(type).then((c) => {
      if (alive) setCatList(c);
    });
    return () => {
      alive = false;
    };
  }, [categories, type]);

  const load = useCallback(async () => {
    if (!editId) {
      setLoading(false);
      return;
    }
    const row = await transactions.getById(editId);
    if (row) {
      setType(row.type);
      setAmountText((row.amountCents / 100).toFixed(2));
      setCategoryId(row.categoryId);
      setNote(row.note ?? '');
      setPaymentMethod(row.paymentMethod);
      setOccurredAt(new Date(row.occurredAt));
    }
    setLoading(false);
  }, [editId, transactions]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editId ? 'Edit transaction' : 'Add transaction',
    });
  }, [navigation, editId]);

  const selectedCategory = categoryId ? catList.find((c) => c.id === categoryId) ?? null : null;

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
    const cents = Math.round(parsed * 100);
    setSaving(true);
    try {
      const iso = occurredAt.toISOString();
      if (editId) {
        await transactions.update(editId, {
          amountCents: cents,
          type,
          categoryId,
          occurredAt: iso,
          note: note.trim() || null,
          paymentMethod,
        });
      } else {
        await transactions.insert({
          id: await Crypto.randomUUID(),
          amountCents: cents,
          type,
          categoryId,
          occurredAt: iso,
          note: note.trim() || null,
          paymentMethod,
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
              accessibilityLabel={`Payment method ${p}`}
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
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

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
  saveBtn: {
    marginTop: 28,
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
