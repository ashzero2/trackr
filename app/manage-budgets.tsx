import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { lightImpact } from '@/lib/haptics';
import { monthName, utcCalendarMonthNow } from '@/lib/dates';
import { useFormatMoney } from '@/hooks/use-format-money';
import { materialIconNameForCategory } from '@/lib/category-icons';
import type { Budget, Category } from '@/types/finance';

type EditTarget = { category: Category; budget: Budget | null };

const YEAR_OPTIONS = Array.from({ length: 18 }, (_, i) => 2018 + i);

export default function ManageBudgetsScreen() {
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { categories, budgets } = useRepositories();
  const start = utcCalendarMonthNow();
  const [year, setYear] = useState(start.year);
  const [month, setMonth] = useState(start.month);
  const [expenseCats, setExpenseCats] = useState<Category[]>([]);
  const [budgetRows, setBudgetRows] = useState<Budget[]>([]);
  const [yearModal, setYearModal] = useState(false);
  const [edit, setEdit] = useState<EditTarget | null>(null);

  const load = useCallback(async () => {
    const [cats, b] = await Promise.all([
      categories.listByType('expense'),
      budgets.listForMonth(year, month),
    ]);
    setExpenseCats(cats);
    setBudgetRows(b.filter((x) => x.categoryId));
  }, [categories, budgets, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const budgetByCat = useMemo(() => {
    const m = new Map<string, Budget>();
    for (const b of budgetRows) {
      if (b.categoryId) m.set(b.categoryId, b);
    }
    return m;
  }, [budgetRows]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['bottom']}>
      <View style={styles.head}>
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
        style={{ marginBottom: 16 }}>
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

      <Text style={[styles.hint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
        Set monthly limits for expense categories. Analytics and the dashboard use these for the selected month.
      </Text>

      <FlatList
        data={expenseCats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: c }) => {
          const b = budgetByCat.get(c.id) ?? null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${b ? `limit ${format(b.limitCents)}` : 'no limit'}`}
              onPress={() => setEdit({ category: c, budget: b })}
              style={[styles.row, { backgroundColor: colors.surfaceContainerLow }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerLowest }]}>
                <MaterialIcons name={materialIconNameForCategory(c.iconKey)} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.onSurface, fontFamily: bodyFont }]}>{c.name}</Text>
                <Text style={[styles.limit, { color: colors.onSurfaceVariant, fontFamily: labelFont }]}>
                  {b ? `Limit ${format(b.limitCents)}` : 'No limit set'}
                </Text>
              </View>
              <MaterialIcons name="edit" size={20} color={colors.onPrimaryContainer} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="category"
            title="No expense categories"
            subtitle="Add categories under Settings → Custom categories first"
          />
        }
      />

      <BudgetLimitModal
        visible={edit !== null}
        target={edit}
        year={year}
        month={month}
        onClose={() => {
          setEdit(null);
          load();
        }}
      />

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
    </SafeAreaView>
  );
}

function BudgetLimitModal({
  visible,
  target,
  year,
  month,
  onClose,
}: {
  visible: boolean;
  target: EditTarget | null;
  year: number;
  month: number;
  onClose: () => void;
}) {
  const { colors } = useAppColors();
  const { currencyCode } = useFormatMoney();
  const { budgets } = useRepositories();
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !target) return;
    if (target.budget) {
      setAmountText((target.budget.limitCents / 100).toFixed(2));
    } else {
      setAmountText('');
    }
  }, [visible, target]);

  if (!target) {
    return null;
  }

  const onSave = async () => {
    const parsed = Number.parseFloat(amountText.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount.');
      return;
    }
    setSaving(true);
    try {
      await budgets.upsert({
        categoryId: target.category.id,
        year,
        month,
        limitCents: Math.round(parsed * 100),
      });
      lightImpact();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = () => {
    if (!target.budget) {
      onClose();
      return;
    }
    Alert.alert('Remove budget?', `Clear the limit for “${target.category.name}” this month?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await budgets.delete(target.budget!.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.limitSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sheetTitle, { color: colors.primary, fontFamily: headlineFont }]}>
            {target.category.name}
          </Text>
          <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
            {monthName(month)} {year} · monthly limit ({currencyCode})
          </Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[
              styles.input,
              { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
            ]}
          />
          <View style={styles.rowBtns}>
            {target.budget ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove budget limit"
                onPress={onRemove}
                style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}>
                <Text style={{ color: colors.error, fontFamily: labelFont, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={[styles.ghostBtn, { borderColor: colors.outlineVariant }]}>
                <Text style={{ color: colors.onSurface, fontFamily: labelFont }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save budget limit"
                onPress={onSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    paddingHorizontal: 16,
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
  hint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    marginBottom: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  limit: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  limitSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
  },
  rowBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  ghostBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  saveBtn: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
});
