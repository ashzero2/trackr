import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { EmptyState } from '@/components/empty-state';
import { UndoSnackbar } from '@/components/undo-snackbar';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { lightImpact } from '@/lib/haptics';
import { autoInsertRule } from '@/lib/recurrence-checker';
import { frequencyLabel, todayIsoDate } from '@/lib/recurrence-engine';
import type { RecurringTransaction } from '@/types/finance';

export default function ManageRecurringScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { recurring, transactions } = useRepositories();
  const [rules, setRules] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await recurring.listAll();
    setRules(list);
    setLoading(false);
  }, [recurring]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDelete = (rule: RecurringTransaction) => {
    Alert.alert(
      `Delete "${rule.title}"?`,
      'The recurring rule is removed. Already-inserted transactions are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await recurring.delete(rule.id);
            await load();
          },
        },
      ],
    );
  };

  const onLogNow = async (rule: RecurringTransaction) => {
    try {
      await autoInsertRule(rule, todayIsoDate(), { recurring, transactions });
      lightImpact();
      await load();
      setToast({
        id: rule.id + Date.now(),
        message: `✓ Logged "${rule.title}" — ${format(rule.amountCents)}`,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log transaction.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>Back</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>
            Recurring
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add recurring transaction"
            onPress={() => router.push('/add-recurring')}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="add" size={18} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700', fontSize: 13 }}>
              New rule
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          Recurring rules auto-log or prompt you each time a transaction is due.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : rules.length === 0 ? (
          <EmptyState
            icon="repeat"
            title="No recurring rules yet"
            subtitle="Add a rule to auto-log regular expenses like rent or subscriptions"
            actionLabel="New rule"
            onAction={() => router.push('/add-recurring')}
          />
        ) : (
          rules.map((rule) => {
            const isDue = rule.nextDueAt <= todayIsoDate();
            return (
              <View
                key={rule.id}
                style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.onSurface }}>
                      {rule.title}
                    </Text>
                    <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, marginTop: 2 }}>
                      {format(rule.amountCents)} · {frequencyLabel(rule.frequency)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${rule.title}`}
                    onPress={() => onDelete(rule)}
                    style={styles.iconBtn}>
                    <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${rule.title}`}
                    onPress={() => router.push({ pathname: '/add-recurring', params: { id: rule.id } })}
                    style={styles.iconBtn}>
                    <MaterialIcons name="edit" size={20} color={colors.onSurfaceVariant} />
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.dueBadge,
                      { backgroundColor: isDue ? colors.errorContainer : colors.surfaceContainerHighest },
                    ]}>
                    <Text
                      style={{
                        fontFamily: labelFont,
                        fontWeight: '700',
                        fontSize: 11,
                        color: isDue ? colors.error : colors.onSurfaceVariant,
                      }}>
                      {isDue ? 'DUE' : `Next: ${rule.nextDueAt}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dueBadge,
                      { backgroundColor: colors.surfaceContainerHighest },
                    ]}>
                    <Text style={{ fontFamily: labelFont, fontWeight: '700', fontSize: 11, color: colors.onSurfaceVariant }}>
                      {rule.autoInsert ? 'Auto-log' : 'Confirm'}
                    </Text>
                  </View>
                </View>

                {isDue ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${rule.title} now`}
                    onPress={() => void onLogNow(rule)}
                    style={[styles.logBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>
                      Log now
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
        {toast ? (
          <UndoSnackbar
            key={toast.id}
            id={toast.id}
            message={toast.message}
            onExpire={() => setToast(null)}
            onUndo={() => setToast(null)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    paddingTop: 8,
    gap: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  iconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  logBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderRadius: 999,
  },
});