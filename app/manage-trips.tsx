import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { MIN_TOUCH_TARGET } from '@/constants/accessibility';
import { bodyFont, headlineFont, labelFont } from '@/constants/typography';
import { useAppColors } from '@/contexts/color-scheme-context';
import { useRepositories } from '@/contexts/database-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useFormatMoney } from '@/hooks/use-format-money';
import { parseTripMetadata } from '@/lib/trip-metadata';
import type { Trip, TripStatus } from '@/types/finance';

const STATUSES: TripStatus[] = ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];

const STATUS_LABELS: Record<TripStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Done',
  ARCHIVED: 'Archived',
};

export default function ManageTripsScreen() {
  const router = useRouter();
  const { colors } = useAppColors();
  const { format } = useFormatMoney();
  const { trips } = useRepositories();
  const { activeTripId, setProfile } = useUserProfile();
  const [rows, setRows] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetTripId, setBudgetTripId] = useState<string | null>(null);
  const [budgetText, setBudgetText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [renameTrip, setRenameTrip] = useState<Trip | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await trips.listAll();
    setRows(list);
    setLoading(false);
  }, [trips]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSetStatus = async (id: string, status: TripStatus) => {
    try {
      await trips.setStatus(id, status);
      if (status === 'ACTIVE') {
        await setProfile({ activeTripId: id });
      }
      if (status !== 'ACTIVE' && activeTripId === id) {
        await setProfile({ activeTripId: null });
      }
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update trip.');
    }
  };

  const openBudget = (t: Trip) => {
    const m = parseTripMetadata(t.metadata);
    setBudgetTripId(t.id);
    setBudgetText(m.dailyBudgetCents ? (m.dailyBudgetCents / 100).toFixed(2) : '');
  };

  const saveBudget = async () => {
    if (!budgetTripId) return;
    const t = await trips.getById(budgetTripId);
    if (!t) return;
    const parsed = Number.parseFloat(budgetText.replace(/,/g, ''));
    const cents =
      Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : undefined;
    const base = parseTripMetadata(t.metadata);
    const next: { dailyBudgetCents?: number } = { ...base };
    if (cents !== undefined) next.dailyBudgetCents = cents;
    else delete next.dailyBudgetCents;
    const metadata = Object.keys(next).length ? JSON.stringify(next) : null;
    await trips.update(budgetTripId, { metadata });
    setBudgetTripId(null);
    await load();
  };

  const onCreateTrip = async () => {
    const name = newTripName.trim();
    if (!name) { Alert.alert('Name required', 'Enter a name for this trip.'); return; }
    setSaving(true);
    try {
      const id = await Crypto.randomUUID();
      await trips.insert({ id, name, startAt: new Date().toISOString(), endAt: null, status: 'PLANNED', metadata: null });
      setCreateModalOpen(false);
      setNewTripName('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create trip.');
    } finally {
      setSaving(false);
    }
  };

  const onRenameTrip = async () => {
    if (!renameTrip) return;
    const name = renameDraft.trim();
    if (!name) { Alert.alert('Name required', 'Enter a name for this trip.'); return; }
    setSaving(true);
    try {
      await trips.rename(renameTrip.id, name);
      setRenameTrip(null);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not rename trip.');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteTrip = (t: Trip) => {
    Alert.alert(
      `Delete "${t.name}"?`,
      'The trip is removed. Linked transactions are kept but will no longer be associated with it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTripId === t.id) await setProfile({ activeTripId: null });
              await trips.delete(t.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete trip.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, paddingTop: 8, gap: 12 }}>
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
          <Text style={[styles.title, { color: colors.primary, fontFamily: headlineFont }]}>Trips</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new trip"
            onPress={() => { setNewTripName(''); setCreateModalOpen(true); }}
            style={[styles.newTripBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="add" size={18} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700', fontSize: 13 }}>New trip</Text>
          </Pressable>
        </View>
        <Text style={[styles.sub, { color: colors.onSurfaceVariant, fontFamily: bodyFont }]}>
          Only one trip can be ACTIVE. New expenses default to your active trip when Travel mode is on.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant }}>No trips yet.</Text>
        ) : (
          rows.map((t) => {
            const meta = parseTripMetadata(t.metadata);
            return (
              <View key={t.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: headlineFont, fontWeight: '800', color: colors.onSurface }}>
                      {t.name}
                    </Text>
                    <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, marginTop: 4 }}>
                      {STATUS_LABELS[t.status]}
                      {activeTripId === t.id ? ' · currently tracking' : ''}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${t.name}`}
                      onPress={() => { setRenameTrip(t); setRenameDraft(t.name); }}
                      style={styles.cardIconBtn}>
                      <MaterialIcons name="edit" size={18} color={colors.onSurfaceVariant} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${t.name}`}
                      onPress={() => onDeleteTrip(t)}
                      style={styles.cardIconBtn}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.actions}>
                  {STATUSES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => void onSetStatus(t.id, s)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: t.status === s ? colors.primary : colors.surfaceContainerHighest,
                        },
                      ]}>
                      <Text
                        style={{
                          fontFamily: labelFont,
                          fontSize: 11,
                          fontWeight: '700',
                          color: t.status === s ? colors.onPrimary : colors.onSurfaceVariant,
                        }}>
                        {STATUS_LABELS[s]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => openBudget(t)} style={styles.budgetBtn}>
                  <Text style={{ color: colors.primary, fontFamily: labelFont, fontWeight: '700' }}>
                    Daily budget…
                  </Text>
                </Pressable>
                {meta.dailyBudgetCents ? (
                  <Text style={{ fontFamily: bodyFont, color: colors.onSurfaceVariant, marginTop: 6 }}>
                    Budget: {format(meta.dailyBudgetCents)} / day
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={budgetTripId !== null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setBudgetTripId(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Daily budget
            </Text>
            <TextInput
              value={budgetText}
              onChangeText={setBudgetText}
              keyboardType="decimal-pad"
              placeholder="0.00 per day"
              placeholderTextColor={colors.onSurfaceVariant}
              style={[
                styles.input,
                { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <Pressable onPress={() => setBudgetTripId(null)} style={styles.ghost}>
                <Text style={{ fontFamily: labelFont }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveBudget()}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={createModalOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setCreateModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              New trip
            </Text>
            <TextInput
              value={newTripName}
              onChangeText={setNewTripName}
              placeholder="e.g. Tokyo spring"
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont }]}
            />
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <Pressable onPress={() => setCreateModalOpen(false)} style={styles.ghost}>
                <Text style={{ fontFamily: labelFont, color: colors.onSurface }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreateTrip()}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={renameTrip !== null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setRenameTrip(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.primary, fontFamily: headlineFont }]}>
              Rename trip
            </Text>
            <TextInput
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, fontFamily: bodyFont }]}
            />
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <Pressable onPress={() => setRenameTrip(null)} style={styles.ghost}>
                <Text style={{ fontFamily: labelFont, color: colors.onSurface }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onRenameTrip()}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
                <Text style={{ color: colors.onPrimary, fontFamily: labelFont, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: MIN_TOUCH_TARGET,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  cardIconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  budgetBtn: {
    marginTop: 12,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  ghost: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
});
